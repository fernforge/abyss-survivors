// Core game simulation: entities, spawn director, weapons, leveling, corruption,
// time rifts, elemental affinity, co-op down/revive, echo recording.
import { RNG } from '../core/rng.js';
import { Particles } from '../render/particles.js';
import { World } from '../render/world.js';
import { getCharacter } from '../data/characters.js';
import { getWeapon, WEAPON_MAP, BASE_WEAPONS } from '../data/weapons.js';
import { getPassive, PASSIVES } from '../data/passives.js';
import { ENEMIES, BOSSES, getEnemy } from '../data/enemies.js';
import { fireWeapon } from './weapons.js';

let UID = 1;
const BASE_HP = 100, BASE_SPEED = 135, BASE_MAGNET = 104;

const AFFINITY = [
  { els: ['fire', 'ice'], name: 'Thermal Shock', apply: a => a.might += 0.12 },
  { els: ['lightning', 'shadow'], name: 'Black Storm', apply: a => { a.might += 0.08; a.curse += 0.1; } },
  { els: ['holy', 'nature'], name: 'Lifebloom', apply: a => a.regen += 0.6 },
  { els: ['arcane', 'physical'], name: 'Spellblade', apply: a => { a.cdMul *= 0.92; } },
  { els: ['fire', 'lightning'], name: 'Overload', apply: a => a.might += 0.1 },
  { els: ['ice', 'holy'], name: 'Frostlight', apply: a => a.area += 0.12 }
];

export function makePlayer(game, idx, charId, control) {
  const ch = getCharacter(charId);
  const pl = {
    id: UID++, idx, char: ch, color: ch.color, accent: ch.accent, element: ch.element,
    control, // {type:'local', keymap} or {type:'remote', net}  or {type:'self'}
    x: idx * 40, y: 0, vx: 0, vy: 0, r: 13, facing: { x: 1, y: 0 },
    level: 1, xp: 0, xpNext: 8, gold: 0, kills: 0,
    weapons: [], passives: {}, S: null,
    hp: BASE_HP, maxHp: BASE_HP, speed: BASE_SPEED, magnet: BASE_MAGNET, armor: 0, regen: 0, revival: 0,
    alive: true, downed: false, reviveT: 0, invuln: 0, killHealCount: 0,
    flashT: 0, walkPhase: 0, dmgDealt: 0, noHitTime: 0, nearDeath: false, slowStarterOk: true,
    affinity: [], orbiters: {}, auraHitCd: {}
  };
  pl.weapons.push({ id: ch.startWeapon, level: 1, timer: 0 });
  recompute(pl);
  pl.hp = pl.maxHp;
  return pl;
}

function distinctElements(pl) {
  const s = new Set();
  for (const w of pl.weapons) { const def = WEAPON_MAP[w.id]; if (def) s.add(def.element); }
  return s;
}

export function recompute(pl) {
  const ch = pl.char, st = ch.stats;
  const a = {
    might: st.mightMul, area: st.areaMul, cdMul: 1, duration: 1, amount: 0, speedMul: st.speedMul,
    maxHpAdd: 0, maxHpMul: st.maxHpMul, armor: 0, regen: 0, magnetMul: 1, luck: st.luckAdd,
    growth: 1, greed: 1, projSpeedMul: 1, revival: 0, curse: 0
  };
  ch.bonus(a);
  for (const pid in pl.passives) { const p = getPassive(pid); if (p) p.apply(a, pl.passives[pid]); }
  // elemental affinity
  const els = distinctElements(pl); pl.affinity = [];
  for (const combo of AFFINITY) {
    if (combo.els.every(e => els.has(e))) { combo.apply(a); pl.affinity.push(combo.name); }
  }
  if (els.size >= 3) a.might += (els.size - 2) * 0.05; // scholar bonus
  pl._els = els.size;
  const oldMax = pl.maxHp;
  pl.S = a;
  pl.maxHp = Math.round((BASE_HP + a.maxHpAdd) * a.maxHpMul);
  if (oldMax) { pl.hp = Math.min(pl.maxHp, pl.hp + Math.max(0, pl.maxHp - oldMax)); }
  pl.speed = BASE_SPEED * a.speedMul;
  pl.magnet = BASE_MAGNET * a.magnetMul;
  pl.armor = a.armor; pl.regen = a.regen; pl.revival = a.revival;
}

export class Game {
  constructor(opts) {
    this.stage = opts.stage;
    this.rng = new RNG(opts.seed || (Date.now() & 0xffffffff) || 1);
    this.world = new World(this.stage);
    this.particles = new Particles(2500);
    this.players = [];
    this.enemies = [];
    this.projectiles = [];
    this.eProjectiles = [];
    this.gems = [];
    this.pickups = [];
    this.hitboxes = [];
    this.lasers = [];
    this.strikes = [];
    this.orbiters = [];
    this.dmgNumbers = [];
    this.floaters = [];
    this.rifts = [];
    this.echoGhost = opts.echoGhost || null;
    this.echoRecord = [];
    this.time = 0;
    this.corruption = 0;
    this.maxCorruption = 0;
    this.maxElements = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.spawnAcc = 0;
    this.bossIndex = 0;
    this.riftTimer = 110;
    this.riftsCleared = 0;
    this.state = 'play'; // play | choosing | over | win
    this.pendingLevelUps = [];
    this.activeChoice = null;
    this.networked = !!opts.networked;
    this.autoLevel = !!opts.autoLevel;
    this.isHost = opts.isHost !== false;
    this.callbacks = opts.callbacks || {};
    this.grid = new Map(); this.cellSize = 64;
    this.elapsedReal = 0;
    this.shake = 0;
    this.runStats = {};
    this.metDeath = false;
    this.gameOverDone = false;
  }

  emit(name, ...args) { if (this.callbacks[name]) this.callbacks[name](...args); }

  // ---------- spatial grid ----------
  rebuildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cx = Math.floor(e.x / this.cellSize), cy = Math.floor(e.y / this.cellSize);
      const k = cx + ',' + cy;
      let arr = this.grid.get(k); if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(e);
    }
  }
  forEnemiesNear(x, y, radius, fn) {
    const r = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize), cy = Math.floor(y / this.cellSize);
    for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) {
      const arr = this.grid.get(gx + ',' + gy); if (!arr) continue;
      for (const e of arr) if (!e.dead) fn(e);
    }
  }
  nearestEnemy(x, y, maxR = 600) {
    let best = null, bd = maxR * maxR;
    this.forEnemiesNear(x, y, maxR, e => { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } });
    return best;
  }
  randomEnemyNear(x, y, maxR = 500) {
    const list = [];
    this.forEnemiesNear(x, y, maxR, e => list.push(e));
    return list.length ? list[Math.floor(this.rng.next() * list.length)] : null;
  }
  alivePlayers() { return this.players.filter(p => p.alive && !p.downed); }
  anyAlive() { return this.players.some(p => p.alive); }
  nearestPlayer(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.players) { if (!p.alive || p.downed) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    if (!best) for (const p of this.players) { if (!p.alive) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  centroid() {
    const ps = this.players.filter(p => p.alive);
    if (!ps.length) return { x: 0, y: 0 };
    let x = 0, y = 0; for (const p of ps) { x += p.x; y += p.y; } return { x: x / ps.length, y: y / ps.length };
  }

  // ---------- spawn factories (used by weapons.js) ----------
  spawnProjectile(o) { o.id = UID++; o.hits = new Set(); o.life = o.life || 1.5; o.maxLife = o.life; o.rot = 0; this.projectiles.push(o); return o; }
  spawnHitbox(o) { o.id = UID++; o.hits = new Set(); o.maxLife = o.life; o.kind = 'box'; this.hitboxes.push(o); return o; }
  spawnLaser(o) { o.id = UID++; o.hitCd = {}; o.maxLife = o.life; this.lasers.push(o); return o; }
  spawnStrike(o) { o.id = UID++; o.life = 0.3; o.maxLife = 0.3; o.hit = false; this.strikes.push(o); return o; }

  // ---------- enemy spawning ----------
  difficulty() { return 1 + this.time / 60 * 0.3 + this.corruption / 100 * 1.4; }
  hpScale() { return (1 + this.time / 60 * 0.42) * (1 + this.corruption / 100 * 1.7) * (1 + (this.players.length - 1) * 0.6); }
  dmgScale() { return 1 + this.time / 120 * 0.5 + this.corruption / 100 * 0.8; }

  spawnEnemy(def, x, y, opt = {}) {
    const hp = Math.round(def.hp * (def.boss ? 1 : this.hpScale()) * (opt.hpMul || 1));
    const e = {
      id: UID++, def, x, y, vx: 0, vy: 0, r: def.r, shape: def.shape, color: def.color,
      hp, maxHp: hp, dmg: Math.round(def.dmg * this.dmgScale() * (opt.dmgMul || 1)), speed: def.speed,
      xp: def.xp, behavior: def.behavior, dead: false, hitFlash: 0, chill: 0, burn: 0, burnDmg: 0,
      stun: 0, kbVx: 0, kbVy: 0, t: this.rng.next() * 100, boss: !!def.boss, elite: !!opt.elite,
      shotCd: this.rng.range(0.5, 1.5), chargeCd: this.rng.range(1, 2.5), charging: 0, dashCd: this.rng.range(0.5, 2),
      walkPhase: this.rng.next() * 6, attackCd: 0
    };
    if (opt.elite) { e.hp *= 2.4; e.maxHp = e.hp; e.r *= 1.35; e.xp *= 4; e.dmg = Math.round(e.dmg * 1.3); }
    this.enemies.push(e);
    return e;
  }

  spawnRingAround(cx, cy, n, defs, opt) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.next();
      const dist = this.rng.range(520, 700);
      const def = defs[Math.floor(this.rng.next() * defs.length)];
      this.spawnEnemy(def, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, opt);
    }
  }

  director(dt) {
    const minute = this.time / 60;
    // available enemies by tier
    const pool = ENEMIES.filter(e => e.minTier <= minute);
    // spawn rate scales with time, corruption, player count
    const rate = (0.8 + minute * 0.5) * (1 + this.corruption / 100 * 1.3) * (1 + (this.players.length - 1) * 0.5);
    this.spawnAcc += dt * rate;
    const c = this.centroid();
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length > 700) break;
      const def = this.rng.weighted(pool);
      const a = this.rng.next() * Math.PI * 2;
      const dist = this.rng.range(580, 720);
      const elite = this.rng.chance(0.02 + this.corruption / 100 * 0.05);
      this.spawnEnemy(def, c.x + Math.cos(a) * dist, c.y + Math.sin(a) * dist, { elite });
    }
    // swarm walls every ~30s
    if (Math.floor(this.time) % 30 === 0 && Math.floor(this.time) !== this._lastSwarm && minute >= 1) {
      this._lastSwarm = Math.floor(this.time);
      const side = this.rng.int(0, 3);
      const swarmDefs = pool.filter(e => e.behavior === 'swarm' || e.weight >= 8);
      if (swarmDefs.length) this.spawnWall(c, side, 10 + Math.floor(minute), swarmDefs);
    }
    // bosses
    while (this.bossIndex < BOSSES.length && minute >= BOSSES[this.bossIndex].minute) {
      const b = BOSSES[this.bossIndex++];
      const a = this.rng.next() * Math.PI * 2;
      const boss = this.spawnEnemy(b, c.x + Math.cos(a) * 520, c.y + Math.sin(a) * 520);
      this.shake = 18; this.emit('boss', b);
      this.callbacks.sfx && this.callbacks.sfx('boss');
      if (b.id === 'boss_death') { this.metDeath = true; this.runStats.metDeath = true; }
    }
  }
  spawnWall(c, side, n, defs) {
    for (let i = 0; i < n; i++) {
      let x, y; const spread = (i / n - 0.5) * 900;
      if (side === 0) { x = c.x + spread; y = c.y - 520; }
      else if (side === 1) { x = c.x + spread; y = c.y + 520; }
      else if (side === 2) { x = c.x - 520; y = c.y + spread; }
      else { x = c.x + 520; y = c.y + spread; }
      this.spawnEnemy(defs[i % defs.length], x, y);
    }
  }

  // ---------- time rifts (original feature) ----------
  updateRifts(dt) {
    this.riftTimer -= dt;
    if (this.riftTimer <= 0 && this.rifts.length === 0) {
      this.riftTimer = 150;
      const c = this.centroid(); const a = this.rng.next() * 7;
      this.rifts.push({ id: UID++, x: c.x + Math.cos(a) * 360, y: c.y + Math.sin(a) * 360, r: 46, state: 'idle', timer: 0, pulse: 0 });
      this.emit('toast', '🌀 A Time Rift has opened nearby!');
    }
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const rift = this.rifts[i]; rift.pulse += dt;
      if (rift.state === 'idle') {
        for (const p of this.alivePlayers()) {
          if ((p.x - rift.x) ** 2 + (p.y - rift.y) ** 2 < (rift.r + p.r) ** 2) {
            rift.state = 'active'; rift.timer = 22;
            this.callbacks.sfx && this.callbacks.sfx('rift');
            this.emit('toast', '⚠️ RIFT SURGE! Survive 22 seconds!');
            const pool = ENEMIES.filter(e => e.minTier <= this.time / 60 + 4);
            this.spawnRingAround(rift.x, rift.y, 24 + Math.floor(this.time / 60), pool, { elite: this.rng.chance(0.3) });
            break;
          }
        }
        // despawn idle rift after a while
        rift.timer += dt; if (rift.timer > 40) this.rifts.splice(i, 1);
      } else if (rift.state === 'active') {
        rift.timer -= dt;
        // periodic radial bullets
        rift._b = (rift._b || 0) + dt;
        if (rift._b > 1.4) {
          rift._b = 0;
          const n = 14;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * 7 + rift.timer;
            this.eProjectiles.push({ id: UID++, x: rift.x, y: rift.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 8, dmg: Math.round(8 * this.dmgScale()), life: 6, color: '#b06bff' });
          }
        }
        if (this.time % 4 < dt) this.spawnRingAround(rift.x, rift.y, 8, ENEMIES.filter(e => e.minTier <= this.time / 60 + 2));
        if (rift.timer <= 0) {
          rift.state = 'done'; this.riftsCleared++;
          this.spawnChest(rift.x, rift.y, true);
          this.corruption = Math.min(200, this.corruption + 6);
          this.emit('toast', '🌀 Rift cleared! Reward dropped.');
          this.rifts.splice(i, 1);
        }
      }
    }
  }

  // ---------- pickups ----------
  spawnGem(x, y, xp) {
    this.gems.push({ id: UID++, x, y, xp, r: xp >= 50 ? 8 : xp >= 10 ? 6 : 4, vx: (this.rng.next() - 0.5) * 40, vy: (this.rng.next() - 0.5) * 40, mag: false, t: 0 });
  }
  spawnPickup(x, y, kind) { this.pickups.push({ id: UID++, x, y, kind, r: 12, t: 0, vy: -30, vx: (this.rng.next() - 0.5) * 30 }); }
  spawnChest(x, y, big) { this.pickups.push({ id: UID++, x, y, kind: big ? 'chest_big' : 'chest', r: 16, t: 0, vy: -20, vx: 0 }); }

  // ---------- damage application ----------
  damageEnemy(e, dmg, opt = {}, fromPlayer = null) {
    if (e.dead) return;
    let d = dmg;
    let crit = false;
    const luck = fromPlayer ? fromPlayer.S.luck : 0;
    if (opt.crit && this.rng.chance(opt.crit)) { d *= 2.2; crit = true; }
    else if (this.rng.chance(0.04 + luck * 0.3)) { d *= 1.8; crit = true; }
    d = Math.round(d);
    e.hp -= d; e.hitFlash = 0.12;
    if (opt.chill) e.chill = Math.max(e.chill, 1.5 * (opt.chill || 1));
    if (opt.freeze) e.stun = Math.max(e.stun, opt.freeze);
    if (opt.burn) { e.burn = Math.max(e.burn, 2.5); e.burnDmg = Math.max(e.burnDmg, opt.burn); }
    this.dmgNumbers.push({ x: e.x + (this.rng.next() - 0.5) * 8, y: e.y - e.r, val: d, t: 0, crit, color: crit ? '#ffd23a' : '#fff' });
    if (crit && fromPlayer) this.callbacks.sfx && this.callbacks.sfx('crit');
    else this.callbacks.sfx && this.callbacks.sfx('hit');
    this.particles.burst(e.x, e.y, crit ? 6 : 3, { color: opt.color || '#fff', speed: 90, life: 0.25, r: 2.5, glow: true });
    // lifesteal
    if (opt.lifesteal && fromPlayer) fromPlayer.hp = Math.min(fromPlayer.maxHp, fromPlayer.hp + d * opt.lifesteal);
    if (e.hp <= 0) this.killEnemy(e, fromPlayer, opt);
    else if (opt.chain && opt.chain > 0) this.doChain(e, d * 0.6, opt, fromPlayer);
  }
  doChain(from, dmg, opt, pl) {
    let chains = opt.chain, last = from; const hit = new Set([from.id]);
    while (chains-- > 0) {
      let best = null, bd = 200 * 200;
      this.forEnemiesNear(last.x, last.y, 200, e => { if (hit.has(e.id)) return; const d = (e.x - last.x) ** 2 + (e.y - last.y) ** 2; if (d < bd) { bd = d; best = e; } });
      if (!best) break;
      this.lightningArc(last.x, last.y, best.x, best.y);
      this.damageEnemy(best, dmg, { ...opt, chain: 0, color: '#fff07a' }, pl);
      hit.add(best.id); last = best;
    }
  }
  lightningArc(x1, y1, x2, y2) {
    const seg = 4; for (let i = 0; i < seg; i++) {
      const t = i / seg; this.particles.spawn(x1 + (x2 - x1) * t + (this.rng.next() - 0.5) * 16, y1 + (y2 - y1) * t + (this.rng.next() - 0.5) * 16, { color: '#fff07a', r: 3, life: 0.15, glow: true, shrink: true });
    }
  }
  killEnemy(e, pl, opt = {}) {
    if (e.dead) return; e.dead = true;
    this.kills++; this.corruption = Math.min(200, this.corruption + (e.boss ? 0 : 0.012));
    if (pl) { pl.kills++; pl.killHealCount++; const kh = pl.S.killHeal || 0; if (kh && pl.killHealCount >= kh) { pl.killHealCount = 0; pl.hp = Math.min(pl.maxHp, pl.hp + 1); } }
    this.particles.burst(e.x, e.y, e.boss ? 40 : 8, { color: e.color, speed: e.boss ? 240 : 120, life: 0.5, r: e.boss ? 5 : 3, glow: true, gravity: 40 });
    // xp + drops
    const xpGain = Math.round(e.xp * (pl ? pl.S.growth : 1) * (1 + this.corruption / 200));
    this.spawnGem(e.x, e.y, xpGain);
    if (this.rng.chance(0.012 + (pl ? pl.S.luck * 0.04 : 0))) this.spawnPickup(e.x, e.y, this.rng.pick(['heart', 'magnet', 'bomb', 'gold']));
    else if (this.rng.chance(0.5)) this.spawnPickup(e.x, e.y, 'coin');
    // corruption shard from elites
    if (e.elite && this.rng.chance(0.5)) this.spawnPickup(e.x, e.y, 'shard');
    if (e.boss) {
      this.bossKills++; this.shake = 14; this.callbacks.sfx && this.callbacks.sfx('explode');
      this.spawnChest(e.x, e.y, true);
      this.emit('bossKilled', e.def);
      if (e.def.id === 'boss_death') { this.runStats.deathKilled = true; this.emit('toast', '☠️ You defeated DEATH!'); }
      for (let i = 0; i < 8; i++) this.spawnPickup(e.x + (this.rng.next() - 0.5) * 60, e.y + (this.rng.next() - 0.5) * 60, 'gold');
    }
    this.runStats.bestiary = this.runStats.bestiary || {};
    this.runStats.bestiary[e.def.id] = true;
    // splitter
    if (e.def.behavior === 'splitter' && e.def.splitInto && !e.boss) {
      const sub = getEnemy(e.def.splitInto);
      for (let i = 0; i < (e.def.splitN || 2); i++) this.spawnEnemy(sub, e.x + (this.rng.next() - 0.5) * 30, e.y + (this.rng.next() - 0.5) * 30, { hpMul: 0.5 });
    }
    if (e.def.behavior === 'exploder' && !e.boss) {
      this.particles.burst(e.x, e.y, 16, { color: '#ff9a4a', speed: 160, life: 0.4, r: 4, glow: true });
      this.forEnemiesNear(e.x, e.y, e.def.explodeR || 40, t => { if (t !== e) this.damageEnemy(t, 12, { color: '#ff9a4a' }, pl); });
    }
  }

  damagePlayer(pl, dmg, src) {
    if (!pl.alive || pl.downed || pl.invuln > 0) return;
    let d = dmg;
    const reduce = pl.S.dmgReduce || 0;
    d = Math.max(1, d * (1 - reduce) - pl.armor);
    pl.hp -= d; pl.invuln = 0.5; pl.flashT = 0.3; pl.nearDeath = pl.nearDeath || pl.hp < pl.maxHp * 0.01;
    pl.noHitTime = 0;
    this.runStats.totalDamageTaken = (this.runStats.totalDamageTaken || 0) + d;
    this.callbacks.sfx && this.callbacks.sfx('hurt');
    this.shake = Math.max(this.shake, 6);
    this.particles.burst(pl.x, pl.y, 6, { color: '#ff4a4a', speed: 100, life: 0.3, r: 3, glow: true });
    // thorns
    const thorns = pl.S.thorns || 0;
    if (thorns && src && src.hp !== undefined) this.damageEnemy(src, dmg * thorns, { color: '#ff5a7a' }, pl);
    if (pl.hp <= 0) this.downPlayer(pl);
  }
  downPlayer(pl) {
    if (pl.revival > 0) {
      pl.revival--; pl.hp = pl.maxHp; pl.invuln = 3;
      this.emit('toast', '🪬 Revived!'); this.callbacks.sfx && this.callbacks.sfx('revive');
      this.particles.burst(pl.x, pl.y, 40, { color: '#8fe36a', speed: 200, life: 0.8, r: 4, glow: true });
      return;
    }
    pl.hp = 0;
    if (this.players.length > 1) {
      // co-op: downed, can be revived by ally standing nearby
      pl.downed = true; pl.reviveT = 0;
      this.emit('toast', `${pl.char.name} is down! Stand near them to revive.`);
    } else {
      pl.alive = false;
      this.endGame(false);
    }
    if (this.time < 60) this.runStats.diedEarly = true;
  }

  // ---------- main update ----------
  update(dt) {
    if (this.state === 'over' || this.state === 'win') return;
    if (this.state === 'choosing') { return; }
    dt = Math.min(dt, 0.05);
    this.time += dt; this.elapsedReal += dt;
    this.maxCorruption = Math.max(this.maxCorruption, this.corruption);
    this.maxElements = Math.max(this.maxElements, ...this.players.map(p => p._els || 0));
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    // corruption passive creep
    this.corruption = Math.min(200, this.corruption + dt * 0.15);

    this.rebuildGrid();
    if (this.isHost) { this.director(dt); this.updateRifts(dt); }
    this.updatePlayers(dt);
    this.updateOrbiters(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateEProjectiles(dt);
    this.updateHitboxes(dt);
    this.updateLasers(dt);
    this.updateStrikes(dt);
    this.updateGemsPickups(dt);
    this.particles.update(dt);
    this.updateFloaters(dt);
    // echo recording (host/solo)
    if (this.players[0]) { this.echoRecord.push(this.players[0].x, this.players[0].y); if (this.echoRecord.length > 36000) this.echoRecord.splice(0, 2); }
    this.updateEcho(dt);
    // run stat snapshot
    this.snapshotRunStats();
    if (!this.anyAlive() && this.state === 'play') this.endGame(false);
  }

  snapshotRunStats() {
    const p = this.players[0]; if (!p) return;
    const r = this.runStats;
    r.kills = this.kills; r.time = this.time; r.level = Math.max(...this.players.map(x => x.level));
    r.gold = this.players.reduce((s, x) => s + x.gold, 0);
    r.maxCorruption = this.maxCorruption; r.maxElements = this.maxElements;
    r.bossKills = this.bossKills; r.riftsCleared = this.riftsCleared;
    r.noHitTime = Math.max(...this.players.map(x => x.noHitTime));
    r.weaponSlotsFull = this.players.some(x => x.weapons.length >= 6);
    r.passiveSlotsFull = this.players.some(x => Object.keys(x.passives).length >= 6);
    r.maxedWeapon = this.players.some(x => x.weapons.some(w => { const d = WEAPON_MAP[w.id]; return d && !d.evolved && w.level >= d.maxLevel; }));
    r.nearDeath = this.players.some(x => x.nearDeath);
    r.coop = this.players.length > 1;
    r.maxedWeaponsList = {};
    for (const x of this.players) for (const w of x.weapons) { const d = WEAPON_MAP[w.id]; if (d && !d.evolved && w.level >= d.maxLevel) r.maxedWeaponsList[w.id] = true; }
    r.charId = this.players[0].char.id; r.stageId = this.stage.id;
  }

  updatePlayers(dt) {
    for (const pl of this.players) {
      if (!pl.alive) continue;
      pl.invuln = Math.max(0, pl.invuln - dt);
      pl.flashT = Math.max(0, pl.flashT - dt);
      if (pl.downed) { this.updateDowned(pl, dt); continue; }
      // movement from control
      let mv = { x: 0, y: 0 };
      if (pl.control && pl.control.getMove) mv = pl.control.getMove();
      const len = Math.hypot(mv.x, mv.y);
      if (len > 0.05) { pl.facing.x = mv.x / len; pl.facing.y = mv.y / len; pl.walkPhase += dt * 12; }
      pl.x += mv.x * pl.speed * dt; pl.y += mv.y * pl.speed * dt;
      // regen + noHit
      if (pl.regen) pl.hp = Math.min(pl.maxHp, pl.hp + pl.regen * dt);
      pl.noHitTime += dt;
      // weapons
      for (const slot of pl.weapons) {
        const w = WEAPON_MAP[slot.id]; if (!w) continue;
        if (w.pattern === 'orbit' || w.pattern === 'orbitblade' || w.pattern === 'aura') continue; // persistent
        slot.timer -= dt;
        if (slot.timer <= 0) {
          const eff = this.effStats(pl, w, slot.level);
          slot.timer = eff.cooldown;
          fireWeapon(this, pl, slot, w, eff);
          this.callbacks.sfx && this.callbacks.sfx('shoot');
        }
      }
      // slowStarter achievement check
      if (pl.kills >= 20 && pl.level < 5) pl.slowStarterOk = false;
      if (pl.level >= 5 && pl.slowStarterOk) this.runStats.slowStarter = true;
    }
  }
  updateDowned(pl, dt) {
    // ally nearby revives
    let near = false;
    for (const a of this.players) { if (a === pl || !a.alive || a.downed) continue; if ((a.x - pl.x) ** 2 + (a.y - pl.y) ** 2 < 60 * 60) near = true; }
    if (near) {
      pl.reviveT += dt;
      this.particles.spawn(pl.x + (this.rng.next() - 0.5) * 20, pl.y - 10, { color: '#8fe36a', r: 3, life: 0.4, glow: true, vy: -40 });
      if (pl.reviveT >= 3) { pl.downed = false; pl.hp = pl.maxHp * 0.5; pl.invuln = 2; this.emit('coopRevive'); this.emit('toast', `${pl.char.name} revived!`); this.callbacks.sfx && this.callbacks.sfx('revive'); }
    } else pl.reviveT = Math.max(0, pl.reviveT - dt);
  }

  effStats(pl, w, level) {
    const s = w.stat(level); const a = pl.S;
    const out = { ...s };
    out.damage = (s.damage || 0) * a.might;
    if (s.goldScale) out.damage += pl.gold * 0.02;
    out.cooldown = Math.max(0.05, (s.cooldown || 1) * a.cdMul);
    out.amount = (s.amount || 1) + a.amount;
    out.area = (s.area || 1) * a.area;
    out.duration = (s.duration || 0.3) * a.duration;
    out.speed = (s.speed || 300) * a.projSpeedMul;
    out.pierce = (s.pierce || 0) + (a.pierceBonus || 0);
    out.bounce = (s.bounce || 0) + (a.bounce || 0);
    out.knockback = s.knockback || 4;
    out.explode = s.explode; out.burn = s.burn; out.chill = s.chill; out.freeze = s.freeze;
    out.chain = (s.chain || 0); out.crit = s.crit; out.length = s.length; out.dropGold = s.dropGold; out.goldScale = s.goldScale;
    out.orbitR = (s.orbitR || 80); out.arc = s.arc; out.nova = s.nova;
    return out;
  }

  // ---------- persistent orbiters & auras ----------
  updateOrbiters(dt) {
    for (const pl of this.players) {
      if (!pl.alive || pl.downed) continue;
      for (const slot of pl.weapons) {
        const w = WEAPON_MAP[slot.id]; if (!w) continue;
        if (w.pattern === 'orbit' || w.pattern === 'orbitblade') {
          const eff = this.effStats(pl, w, slot.level);
          slot.angle = (slot.angle || 0) + dt * (w.pattern === 'orbitblade' ? 3.2 : 1.8);
          slot._hcd = slot._hcd || {};
          const n = eff.amount, R = (eff.orbitR) * eff.area;
          for (let i = 0; i < n; i++) {
            const ang = slot.angle + (i / n) * Math.PI * 2;
            const ox = pl.x + Math.cos(ang) * R, oy = pl.y + Math.sin(ang) * R;
            const rr = 16 * eff.area;
            this.forEnemiesNear(ox, oy, rr + 24, e => {
              if ((e.x - ox) ** 2 + (e.y - oy) ** 2 < (rr + e.r) ** 2) {
                const key = e.id; const now = this.time;
                if (!slot._hcd[key] || slot._hcd[key] < now) {
                  slot._hcd[key] = now + 0.35;
                  this.damageEnemy(e, eff.damage, { color: w.color, lifesteal: w.lifesteal || 0, knock: 6 }, pl);
                }
              }
            });
            slot._ox = slot._ox || []; slot._ox[i] = { x: ox, y: oy, r: rr };
          }
        } else if (w.pattern === 'aura') {
          const eff = this.effStats(pl, w, slot.level);
          slot._auraTick = (slot._auraTick || 0) - dt;
          const R = 52 * eff.area;
          slot._R = R;
          if (slot._auraTick <= 0) {
            slot._auraTick = eff.cooldown;
            this.forEnemiesNear(pl.x, pl.y, R + 30, e => {
              if ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < (R + e.r) ** 2) {
                this.damageEnemy(e, eff.damage, { color: w.color, knock: eff.knockback, chill: w.element === 'ice' ? 1 : 0, lifesteal: w.lifesteal || 0 }, pl);
                // knock back from player
                const a = Math.atan2(e.y - pl.y, e.x - pl.x); e.kbVx += Math.cos(a) * eff.knockback * 6; e.kbVy += Math.sin(a) * eff.knockback * 6;
              }
            });
            if (eff.nova && this.rng.chance(0.25)) this.forEnemiesNear(pl.x, pl.y, R * 2.2, e => this.damageEnemy(e, eff.damage * 2, { color: '#fff2b0' }, pl));
          }
        }
      }
      // chill aura (vesna)
      if (pl.S.chillAura) this.forEnemiesNear(pl.x, pl.y, pl.S.chillAura, e => { e.chill = Math.max(e.chill, 0.5); });
    }
  }

  updateEnemies(dt) {
    const friction = Math.pow(0.86, dt * 60);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.t += dt; e.walkPhase += dt * 8;
      if (e.burn > 0) { e.burn -= dt; e.hp -= e.burnDmg * dt; if (e.hp <= 0) { this.killEnemy(e, null); continue; } if (this.rng.chance(0.3)) this.particles.spawn(e.x + (this.rng.next() - 0.5) * e.r, e.y, { color: '#ff7a2a', r: 2, life: 0.3, glow: true, vy: -30 }); }
      let slow = 1;
      if (e.chill > 0) { e.chill -= dt; slow *= 0.55; }
      if (e.stun > 0) { e.stun -= dt; slow = 0; }
      const enemySlowStat = this.players[0] ? (this.players[0].S.enemySlow || 0) : 0;
      slow *= (1 - enemySlowStat);
      const target = this.nearestPlayer(e.x, e.y);
      if (target) this.enemyAI(e, target, dt, slow);
      // knockback velocity
      e.x += e.kbVx * dt; e.y += e.kbVy * dt; e.kbVx *= friction; e.kbVy *= friction;
      // contact damage to players
      if (target && (e.x - target.x) ** 2 + (e.y - target.y) ** 2 < (e.r + target.r) ** 2) {
        e.attackCd -= dt;
        if (e.attackCd <= 0) { e.attackCd = 0.5; this.damagePlayer(target, e.dmg, e); }
      }
    }
    // soft separation between enemies to avoid full overlap (sampled for perf)
    this.separateEnemies(dt);
  }
  enemyAI(e, target, dt, slow) {
    const dx = target.x - e.x, dy = target.y - e.y; const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist; const sp = e.speed * slow;
    switch (e.behavior) {
      case 'zigzag': { const perp = Math.sin(e.t * 6) * 0.6; e.x += (ux + -uy * perp) * sp * dt; e.y += (uy + ux * perp) * sp * dt; break; }
      case 'fast': case 'swarm': e.x += ux * sp * dt; e.y += uy * sp * dt; break;
      case 'orbiter': { const ang = e.t * 1.6; const desired = 130; const tx = target.x + Math.cos(ang) * desired, ty = target.y + Math.sin(ang) * desired; e.x += ((tx - e.x) / 100) * sp * dt * 4; e.y += ((ty - e.y) / 100) * sp * dt * 4; break; }
      case 'charger': {
        e.chargeCd -= dt;
        if (e.charging > 0) { e.charging -= dt; e.x += e.cdx * sp * 2.4 * dt; e.y += e.cdy * sp * 2.4 * dt; }
        else { e.x += ux * sp * 0.6 * dt; e.y += uy * sp * 0.6 * dt; if (e.chargeCd <= 0 && dist < 300) { e.chargeCd = this.rng.range(1.6, 3); e.charging = 0.6; e.cdx = ux; e.cdy = uy; } }
        break;
      }
      case 'dasher': {
        e.dashCd -= dt;
        if (e.dashCd <= 0) { e.dashCd = this.rng.range(0.6, 1.4); e.x += ux * 40; e.y += uy * 40; this.particles.spawn(e.x, e.y, { color: e.color, r: 3, life: 0.2 }); }
        else { e.x += ux * sp * dt; e.y += uy * sp * dt; }
        break;
      }
      case 'shooter': {
        const want = e.def.range || 280;
        if (dist > want) { e.x += ux * sp * dt; e.y += uy * sp * dt; }
        else if (dist < want * 0.6) { e.x -= ux * sp * 0.6 * dt; e.y -= uy * sp * 0.6 * dt; }
        e.shotCd -= dt;
        if (e.shotCd <= 0 && dist < want * 1.2) {
          e.shotCd = this.rng.range(1.2, 2.4);
          const ss = e.def.shotSpeed || 200;
          this.eProjectiles.push({ id: UID++, x: e.x, y: e.y, vx: ux * ss, vy: uy * ss, r: 7, dmg: e.dmg, life: 4, color: e.color });
        }
        break;
      }
      case 'summoner': {
        if (dist > 220) { e.x += ux * sp * dt; e.y += uy * sp * dt; }
        e.shotCd -= dt;
        if (e.shotCd <= 0) { e.shotCd = this.rng.range(3, 5); const sub = getEnemy(e.def.summons); if (sub && this.enemies.length < 650) for (let k = 0; k < (e.boss ? 4 : 2); k++) this.spawnEnemy(sub, e.x + (this.rng.next() - 0.5) * 60, e.y + (this.rng.next() - 0.5) * 60); }
        e.x += ux * sp * 0.3 * dt; e.y += uy * sp * 0.3 * dt;
        break;
      }
      case 'ghost': e.x += ux * sp * dt; e.y += uy * sp * dt; break; // passes through (no separation)
      case 'tank': e.x += ux * sp * dt; e.y += uy * sp * dt; break;
      default: e.x += ux * sp * dt; e.y += uy * sp * dt;
    }
  }
  separateEnemies(dt) {
    // grid-based light separation; skip ghosts
    for (const [k, arr] of this.grid) {
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i]; if (a.behavior === 'ghost' || a.boss) continue;
        for (let j = i + 1; j < arr.length; j++) {
          const b = arr[j]; if (b.behavior === 'ghost' || b.boss) continue;
          const dx = b.x - a.x, dy = b.y - a.y; const d2 = dx * dx + dy * dy; const min = a.r + b.r;
          if (d2 < min * min && d2 > 0.01) { const d = Math.sqrt(d2); const push = (min - d) * 0.5; const ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
        }
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt; p.rot += (p.spin || 0) * dt;
      if (p.life <= 0) { this.projectiles.splice(i, 1); continue; }
      // movement
      if (p.mode === 'homing') {
        const t = this.nearestEnemy(p.x, p.y, 320);
        if (t) { const a = Math.atan2(t.y - p.y, t.x - p.x); const cs = Math.hypot(p.vx, p.vy); const ca = Math.atan2(p.vy, p.vx); let na = ca + Math.max(-p.homStr * dt, Math.min(p.homStr * dt, Math.atan2(Math.sin(a - ca), Math.cos(a - ca)))); p.vx = Math.cos(na) * cs; p.vy = Math.sin(na) * cs; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.mode === 'boomerang') {
        p.t += dt; const owner = p.owner;
        const tt = p.t / (p.range * 2);
        if (p.t < p.range) { p.x += Math.cos(p.dir) * p.speed * dt; p.y += Math.sin(p.dir) * p.speed * dt; }
        else {
          // return to owner
          const a = Math.atan2(owner.y - p.y, owner.x - p.x); p.x += Math.cos(a) * (p.speed * 1.2) * dt; p.y += Math.sin(a) * (p.speed * 1.2) * dt;
          if ((owner.x - p.x) ** 2 + (owner.y - p.y) ** 2 < 400) { this.projectiles.splice(i, 1); continue; }
        }
      } else if (p.mode === 'lob') {
        p.t += dt; const tt = Math.min(1, p.t / p.dur);
        p.x = p._sx === undefined ? (p._sx = p.x, p.x) : p.x;
        if (p._ix === undefined) { p._ix = p.x; p._iy = p.y; }
        p.x = p._ix + (p.tx - p._ix) * tt; p.y = p._iy + (p.ty - p._iy) * tt;
        p.lobH = Math.sin(tt * Math.PI) * 60;
        if (tt >= 1) { this.explodeAt(p.x, p.y, 60 * p.scale, p.dmg, p.onHit, p.owner, p.color); this.projectiles.splice(i, 1); continue; }
      } else if (p.mode === 'spiral') {
        p.x += p.vx * dt; p.y += p.vy * dt; const c = p.spinCenter; // drift outward
      } else if (p.mode === 'bounce') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        // bounce off nearest enemy hit handled in collision; also wrap via random redirect occasionally
      } else if (p.mode === 'drift') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99; p.vy *= 0.99;
      } else { p.x += p.vx * dt; p.y += p.vy * dt; }
      // collision
      const hitR = p.r;
      this.forEnemiesNear(p.x, p.y, hitR + 30, e => {
        if (p.hits.has(e.id)) return;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (hitR + e.r) ** 2) {
          const opt = { ...p.onHit, color: p.color, crit: p.onHit.crit };
          this.damageEnemy(e, p.dmg, opt, p.owner);
          if (p.onHit.explode) this.explodeAt(p.x, p.y, p.onHit.explode * p.scale, p.dmg * 0.7, p.onHit, p.owner, p.color);
          // knockback
          if (!e.boss) { const a = Math.atan2(e.y - p.y, e.x - p.x); e.kbVx += Math.cos(a) * (p.onHit.knock || 4) * 8; e.kbVy += Math.sin(a) * (p.onHit.knock || 4) * 8; }
          p.hits.add(e.id);
          if (p.mode === 'bounce' && p.bounce > 0) { p.bounce--; const t2 = this.nearestEnemy(p.x, p.y, 260); if (t2 && t2.id !== e.id) { const a = Math.atan2(t2.y - p.y, t2.x - p.x); const sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.hits.clear(); p.hits.add(e.id); } }
          else if (p.pierce > 0) { p.pierce--; }
          else if (p.mode !== 'boomerang' && p.mode !== 'spiral' && p.mode !== 'drift') { p.life = 0; }
        }
      });
    }
  }
  explodeAt(x, y, r, dmg, onHit, owner, color) {
    this.particles.burst(x, y, 18, { color: color || '#ff9a4a', speed: 200, life: 0.4, r: 4, glow: true });
    this.shake = Math.max(this.shake, 4);
    this.forEnemiesNear(x, y, r, e => { if ((e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) this.damageEnemy(e, dmg, { ...onHit, explode: 0, color }, owner); });
  }
  updateEProjectiles(dt) {
    for (let i = this.eProjectiles.length - 1; i >= 0; i--) {
      const p = this.eProjectiles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) { this.eProjectiles.splice(i, 1); continue; }
      for (const pl of this.players) {
        if (!pl.alive || pl.downed || pl.invuln > 0) continue;
        if ((pl.x - p.x) ** 2 + (pl.y - p.y) ** 2 < (pl.r + p.r) ** 2) { this.damagePlayer(pl, p.dmg, null); this.eProjectiles.splice(i, 1); break; }
      }
    }
  }
  updateHitboxes(dt) {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const h = this.hitboxes[i]; h.life -= dt;
      if (h.life <= 0) { this.hitboxes.splice(i, 1); continue; }
      const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2, y0 = h.y - h.h / 2, y1 = h.y + h.h / 2;
      this.forEnemiesNear(h.x, h.y, Math.max(h.w, h.h), e => {
        if (h.hits.has(e.id)) return;
        if (e.x + e.r > x0 && e.x - e.r < x1 && e.y + e.r > y0 && e.y - e.r < y1) {
          this.damageEnemy(e, h.dmg, { ...h.onHit, color: h.color }, h.owner);
          if (!e.boss) { e.kbVx += (h.kbx || 1) * (h.kb || 6) * 10; }
          h.hits.add(e.id);
        }
      });
    }
  }
  updateLasers(dt) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i]; l.life -= dt;
      if (l.life <= 0) { this.lasers.splice(i, 1); continue; }
      // follow owner origin, fixed angle
      l.x = l.owner.x; l.y = l.owner.y;
      const ex = l.x + Math.cos(l.ang) * l.len, ey = l.y + Math.sin(l.ang) * l.len;
      this.enemies.forEach(e => {
        if (e.dead) return;
        // distance from point to segment
        const t = Math.max(0, Math.min(1, ((e.x - l.x) * (ex - l.x) + (e.y - l.y) * (ey - l.y)) / (l.len * l.len)));
        const px = l.x + (ex - l.x) * t, py = l.y + (ey - l.y) * t;
        if ((e.x - px) ** 2 + (e.y - py) ** 2 < (l.width + e.r) ** 2) {
          const now = this.time; if (!l.hitCd[e.id] || l.hitCd[e.id] < now) { l.hitCd[e.id] = now + 0.15; this.damageEnemy(e, l.dmg * dt * 6, { ...l.onHit, color: l.color }, l.owner); }
        }
      });
    }
  }
  updateStrikes(dt) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i]; s.life -= dt;
      if (!s.hit) {
        s.hit = true;
        this.particles.burst(s.x, s.y, 16, { color: s.color, speed: 160, life: 0.3, r: 3, glow: true });
        this.forEnemiesNear(s.x, s.y, s.r, e => { if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (s.r + e.r) ** 2) this.damageEnemy(e, s.dmg, { ...s.onHit, chain: s.chain, color: s.color }, s.owner); });
      }
      if (s.life <= 0) this.strikes.splice(i, 1);
    }
  }

  updateGemsPickups(dt) {
    const friction = Math.pow(0.9, dt * 60);
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i]; g.t += dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= friction; g.vy *= friction;
      let pulled = null, pd = Infinity;
      for (const pl of this.players) { if (!pl.alive || pl.downed) continue; const d = (pl.x - g.x) ** 2 + (pl.y - g.y) ** 2; if (d < (pl.magnet) ** 2 || g.mag) { if (d < pd) { pd = d; pulled = pl; } } }
      if (pulled) {
        g.mag = true; const a = Math.atan2(pulled.y - g.y, pulled.x - g.x); const sp = 300 + 1 / (Math.sqrt(pd) + 1) * 4000;
        g.x += Math.cos(a) * sp * dt; g.y += Math.sin(a) * sp * dt;
        if (pd < (pulled.r + 6) ** 2) { this.giveXP(pulled, g.xp); this.gems.splice(i, 1); this.callbacks.sfx && this.callbacks.sfx('gem'); }
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]; pk.t += dt; pk.y += (pk.vy || 0) * dt; pk.x += (pk.vx || 0) * dt; pk.vy = (pk.vy || 0) + 60 * dt; if (pk.vy > 0) pk.vy *= 0.9;
      for (const pl of this.players) {
        if (!pl.alive || pl.downed) continue;
        if ((pl.x - pk.x) ** 2 + (pl.y - pk.y) ** 2 < (pl.r + pk.r + 4) ** 2) { this.applyPickup(pl, pk); this.pickups.splice(i, 1); break; }
      }
    }
  }
  giveXP(pl, xp) {
    pl.xp += xp;
    while (pl.xp >= pl.xpNext) {
      pl.xp -= pl.xpNext; pl.level++;
      // Flatter early curve → builds come online fast (VS-style rapid early levels),
      // then ramps so late levels still feel earned.
      pl.xpNext = Math.floor(5 + pl.level * 3.2 + pl.level * pl.level * 0.45);
      this.queueLevelUp(pl);
    }
  }
  applyPickup(pl, pk) {
    switch (pk.kind) {
      case 'coin': pl.gold += Math.round((1 + this.rng.int(0, 4)) * pl.S.greed); this.callbacks.sfx && this.callbacks.sfx('pickup'); break;
      case 'gold': pl.gold += Math.round((10 + this.rng.int(0, 20)) * pl.S.greed); this.floater(pl.x, pl.y, '+gold', '#ffd24a'); this.callbacks.sfx && this.callbacks.sfx('pickup'); break;
      case 'heart': pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.25); this.floater(pl.x, pl.y, '+HP', '#ff5a6a'); this.callbacks.sfx && this.callbacks.sfx('pickup'); break;
      case 'magnet': for (const g of this.gems) g.mag = true; this.floater(pl.x, pl.y, 'MAGNET', '#7fd4ff'); this.callbacks.sfx && this.callbacks.sfx('pickup'); break;
      case 'bomb': { this.shake = 16; this.enemies.forEach(e => { if (!e.dead && !e.boss) this.damageEnemy(e, 9999, { color: '#fff' }, pl); }); this.floater(pl.x, pl.y, 'NUKE!', '#ff9a4a'); this.callbacks.sfx && this.callbacks.sfx('explode'); break; }
      case 'shard': this.corruption = Math.min(200, this.corruption + 8); this.floater(pl.x, pl.y, '+CORRUPTION', '#b06bff'); this.callbacks.sfx && this.callbacks.sfx('rift'); break;
      case 'chest': case 'chest_big': this.openChest(pl, pk.kind === 'chest_big'); break;
    }
  }
  openChest(pl, big) {
    this.callbacks.sfx && this.callbacks.sfx('chest');
    // try evolution first
    const evo = this.findEvolvable(pl);
    if (evo) { this.evolveWeapon(pl, evo); return; }
    // else gold + maybe level up draft
    const g = (big ? 100 : 30) + this.rng.int(0, big ? 200 : 50);
    pl.gold += Math.round(g * pl.S.greed); this.floater(pl.x, pl.y, `+${Math.round(g)} gold`, '#ffd24a');
    if (big) this.queueLevelUp(pl);
  }
  findEvolvable(pl) {
    for (const slot of pl.weapons) {
      const w = WEAPON_MAP[slot.id];
      if (w && w.evolution && slot.level >= w.maxLevel && pl.passives[w.evolution.req]) return slot;
    }
    return null;
  }
  evolveWeapon(pl, slot) {
    const w = WEAPON_MAP[slot.id]; const into = WEAPON_MAP[w.evolution.into];
    slot.id = into.id; slot.level = 1; slot.timer = 0;
    recompute(pl);
    this.runStats.evolutions = (this.runStats.evolutions || 0) + 1;
    this.emit('evolve', into);
    this.callbacks.sfx && this.callbacks.sfx('evolve');
    this.floater(pl.x, pl.y, `EVOLVED: ${into.name}!`, into.color);
    this.particles.burst(pl.x, pl.y, 50, { color: into.color, speed: 240, life: 0.9, r: 4, glow: true });
  }

  // ---------- level up choices ----------
  queueLevelUp(pl) {
    const choices = this.generateChoices(pl);
    // networked or remote players auto-draft to avoid pausing everyone
    if (this.autoLevel || (pl.control && pl.control.type === 'remote')) {
      const pick = this.autoPick(pl, choices);
      this.applyChoiceNoAdvance(pl, pick);
      this.emit('toast', `${pl.char.name} Lv${pl.level}: ${pick.title}`);
      this.callbacks.sfx && this.callbacks.sfx('levelup');
      return;
    }
    this.pendingLevelUps.push({ player: pl, choices });
    this.callbacks.sfx && this.callbacks.sfx('levelup');
    if (this.state === 'play') this.openNextChoice();
  }
  autoPick(pl, choices) {
    const order = ['evolve', 'newweapon', 'upweapon', 'newpassive', 'uppassive', 'heal', 'gold'];
    for (const t of order) { const c = choices.find(x => x.type === t); if (c) return c; }
    return choices[0];
  }
  applyChoiceNoAdvance(pl, choice) {
    const prevState = this.state;
    this.applyChoiceCore(pl, choice);
    this.state = prevState;
  }
  openNextChoice() {
    if (this.pendingLevelUps.length === 0) { this.state = 'play'; this.activeChoice = null; return; }
    this.activeChoice = this.pendingLevelUps.shift();
    this.state = 'choosing';
    this.emit('levelup', this.activeChoice.player, this.activeChoice.choices);
  }
  generateChoices(pl) {
    const choices = [];
    // evolution available?
    const evo = this.findEvolvable(pl);
    if (evo) { const w = WEAPON_MAP[evo.id]; choices.push({ type: 'evolve', slot: evo, weapon: WEAPON_MAP[w.evolution.into], from: w, title: `EVOLVE → ${WEAPON_MAP[w.evolution.into].name}`, desc: WEAPON_MAP[w.evolution.into].desc, color: WEAPON_MAP[w.evolution.into].color, icon: '🧬' }); }
    // upgradable owned weapons
    const upW = pl.weapons.filter(s => { const w = WEAPON_MAP[s.id]; return w && !w.evolved && s.level < w.maxLevel; });
    for (const s of upW) { const w = WEAPON_MAP[s.id]; choices.push({ type: 'upweapon', slot: s, weapon: w, title: `${w.name} → Lv${s.level + 1}`, desc: w.desc, color: w.color, icon: '⚔️', lvl: s.level + 1, max: w.maxLevel }); }
    // upgradable passives
    for (const pid in pl.passives) { const p = getPassive(pid); if (p && pl.passives[pid] < p.maxLevel) choices.push({ type: 'uppassive', id: pid, passive: p, title: `${p.name} → Lv${pl.passives[pid] + 1}`, desc: p.desc, color: p.color, icon: p.icon, lvl: pl.passives[pid] + 1, max: p.maxLevel }); }
    // new weapons
    if (pl.weapons.length < 6) {
      for (const w of BASE_WEAPONS) { if (!pl.weapons.find(s => s.id === w.id)) choices.push({ type: 'newweapon', weapon: w, title: `NEW: ${w.name}`, desc: w.desc, color: w.color, icon: '✨' }); }
    }
    // new passives
    if (Object.keys(pl.passives).length < 6) {
      for (const p of PASSIVES) { if (!pl.passives[p.id]) choices.push({ type: 'newpassive', passive: p, title: `NEW: ${p.name}`, desc: p.desc, color: p.color, icon: p.icon }); }
    }
    // shuffle and trim, evolution always first if present
    const evoChoice = choices.find(c => c.type === 'evolve');
    let rest = this.rng.shuffle(choices.filter(c => c.type !== 'evolve'));
    let count = 3 + (this.rng.chance(Math.min(0.6, pl.S.luck)) ? 1 : 0);
    let final = evoChoice ? [evoChoice, ...rest].slice(0, count) : rest.slice(0, count);
    if (final.length === 0) final = [{ type: 'gold', title: 'Pile of Gold', desc: '+200 gold', color: '#ffd24a', icon: '🪙' }, { type: 'heal', title: 'Full Heal', desc: 'Restore all HP', color: '#ff5a6a', icon: '❤️' }];
    return final;
  }
  applyChoice(pl, choice) {
    this.applyChoiceCore(pl, choice);
    this.openNextChoice();
  }
  applyChoiceCore(pl, choice) {
    switch (choice.type) {
      case 'evolve': this.evolveWeapon(pl, choice.slot); break;
      case 'upweapon': choice.slot.level++; break;
      case 'newweapon': pl.weapons.push({ id: choice.weapon.id, level: 1, timer: 0 }); break;
      case 'uppassive': pl.passives[choice.id]++; break;
      case 'newpassive': pl.passives[choice.passive.id] = 1; break;
      case 'gold': pl.gold += 200; break;
      case 'heal': pl.hp = pl.maxHp; break;
    }
    recompute(pl);
    // track maxed weapons
    for (const s of pl.weapons) { const w = WEAPON_MAP[s.id]; if (w && !w.evolved && s.level >= w.maxLevel) { this.runStats.maxedWeaponsList = this.runStats.maxedWeaponsList || {}; this.runStats.maxedWeaponsList[s.id] = true; } }
  }

  floater(x, y, text, color) { this.floaters.push({ x, y, text, color, t: 0, life: 1.2 }); }
  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.t += dt; f.y -= 24 * dt; if (f.t > f.life) this.floaters.splice(i, 1); }
    for (let i = this.dmgNumbers.length - 1; i >= 0; i--) { const d = this.dmgNumbers[i]; d.t += dt; d.y -= 36 * dt; if (d.t > 0.6) this.dmgNumbers.splice(i, 1); }
  }

  // ---------- echo ghost (original feature) ----------
  updateEcho(dt) {
    if (!this.echoGhost || !this.echoGhost.length) return;
    this._echoT = (this._echoT || 0) + dt;
    const idx = Math.min(this.echoGhost.length - 2, Math.floor(this._echoT * 60) * 2);
    this.echoPos = { x: this.echoGhost[idx], y: this.echoGhost[idx + 1] };
    // ghost emits a small damaging pulse
    this._echoFire = (this._echoFire || 0) - dt;
    if (this._echoFire <= 0 && this.echoPos) {
      this._echoFire = 0.8;
      this.forEnemiesNear(this.echoPos.x, this.echoPos.y, 60, e => this.damageEnemy(e, 8 * this.difficulty(), { color: '#9affd0' }, this.players[0]));
      this.particles.spawn(this.echoPos.x, this.echoPos.y, { color: '#9affd0', r: 8, life: 0.4, glow: true });
    }
  }

  endGame(win) {
    if (this.gameOverDone) return; this.gameOverDone = true;
    this.state = win ? 'win' : 'over';
    this.snapshotRunStats();
    this.runStats.win = win;
    this.callbacks.sfx && this.callbacks.sfx('death');
    this.emit('gameover', this.runStats, win);
  }
}
