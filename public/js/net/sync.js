// Host->guest snapshot serialize + a GuestView the Renderer can draw directly.
import { World } from '../render/world.js';
import { Particles } from '../render/particles.js';
import { getCharacter } from '../data/characters.js';
import { WEAPON_MAP } from '../data/weapons.js';

const R = Math.round;
export function serialize(game) {
  const c = game.centroid();
  const near = (a, b) => (a.x - c.x) ** 2 + (a.y - c.y) ** 2 < 1400 * 1400 || b;
  const E = [];
  for (const e of game.enemies) { if (e.dead) continue; if (E.length > 240) break; if (!near(e)) continue; E.push([e.id, R(e.x), R(e.y), e.shape, e.color, R(e.r), Math.max(0, R(e.hp / e.maxHp * 100)), e.boss ? 1 : 0, e.hitFlash > 0 ? 1 : 0, e.chill > 0 ? 1 : 0, e.elite ? 1 : 0]); }
  const G = []; for (const g of game.gems) { if (G.length > 160) break; if (!near(g)) continue; G.push([R(g.x), R(g.y), g.xp]); }
  const Pr = game.projectiles.slice(0, 200).map(p => [R(p.x), R(p.y), R(p.r), p.color, R((p.rot || 0) * 100), p.lobH ? R(p.lobH) : 0, p.mode === 'boomerang' ? 1 : 0]);
  const O = [], A = [];
  for (const pl of game.players) for (const slot of pl.weapons) {
    if (slot._ox) { const col = WEAPON_MAP[slot.id]?.color || '#fff'; for (const o of slot._ox) if (o) O.push([R(o.x), R(o.y), R(o.r), col, R((slot.angle || 0) * 100)]); }
    if (slot._R) A.push([R(pl.x), R(pl.y), R(slot._R), WEAPON_MAP[slot.id]?.color || '#fff']);
  }
  return {
    t: R(game.time * 10) / 10, cor: R(game.corruption), sh: R(game.shake),
    P: game.players.map(p => ({ i: p.idx, x: R(p.x), y: R(p.y), h: R(p.hp), m: R(p.maxHp), lv: p.level, fx: R(p.facing.x * 100) / 100, fy: R(p.facing.y * 100) / 100, c: p.char.id, dn: p.downed ? 1 : 0, al: p.alive ? 1 : 0, rt: R(p.reviveT * 10) / 10, iv: p.invuln > 0 ? 1 : 0 })),
    E, G,
    K: game.pickups.map(p => [R(p.x), R(p.y), p.kind]),
    Pr,
    Lz: game.lasers.map(l => [R(l.x), R(l.y), R(l.ang * 100) / 100, R(l.len), R(l.width), l.color, R(l.life * 100) / 100, R(l.maxLife * 100) / 100]),
    St: game.strikes.map(s => [R(s.x), R(s.y), R(s.r), s.color, R(s.life * 100) / 100]),
    Hb: game.hitboxes.map(h => [R(h.x), R(h.y), R(h.w), R(h.h), h.color, R(h.life / h.maxLife * 100) / 100]),
    Ep: game.eProjectiles.map(p => [R(p.x), R(p.y), R(p.r), p.color]),
    Rf: game.rifts.map(r => [R(r.x), R(r.y), R(r.r), r.state === 'active' ? 1 : 0, R(r.timer)]),
    F: game.floaters.map(f => [R(f.x), R(f.y), f.text, f.color, R(f.t * 100) / 100, f.life]),
    eg: game.echoPos ? [R(game.echoPos.x), R(game.echoPos.y)] : null
  };
}

export class GuestView {
  constructor(stage, seed) {
    this.stage = stage;
    this.world = new World(stage);
    this.particles = new Particles(800);
    this.time = 0; this.corruption = 0; this.shake = 0;
    this.players = []; this.enemies = []; this.gems = []; this.pickups = [];
    this.projectiles = []; this.lasers = []; this.strikes = []; this.hitboxes = [];
    this.eProjectiles = []; this.rifts = []; this.dmgNumbers = []; this.floaters = [];
    this.echoPos = null; this.state = 'play';
    this._eMap = new Map(); this._eMapNext = new Map(); this._pMap = new Map(); this._pMapNext = new Map();
    this.alpha = 0; this._last = 0;
  }
  centroid() { const ps = this.players.filter(p => p.alive); if (!ps.length) return { x: 0, y: 0 }; let x = 0, y = 0; for (const p of ps) { x += p.x; y += p.y; } return { x: x / ps.length, y: y / ps.length }; }
  apply(s) {
    this.time = s.t; this.corruption = s.cor; this.shake = s.sh;
    // players: interpolate by storing prev/next
    for (const pd of s.P) {
      let p = this.players.find(q => q.idx === pd.i);
      const ch = getCharacter(pd.c);
      if (!p) { p = { idx: pd.i, r: 13, walkPhase: 0, weapons: [], flashT: 0 }; this.players.push(p); }
      p.px = p.x ?? pd.x; p.py = p.y ?? pd.y; p.nx = pd.x; p.ny = pd.y;
      p.x = pd.x; p.y = pd.y; p.hp = pd.h; p.maxHp = pd.m; p.level = pd.lv;
      p.facing = { x: pd.fx, y: pd.fy }; p.downed = !!pd.dn; p.alive = !!pd.al; p.reviveT = pd.rt;
      p.color = ch.color; p.accent = ch.accent; p.char = ch; p.invuln = pd.iv ? 0.2 : 0;
      if (Math.abs(pd.fx) + Math.abs(pd.fy) > 0.1) p.walkPhase += 0.3;
    }
    // enemies: rebuild with interpolation targets
    const seen = new Set();
    const map = this._eMap;
    for (const ed of s.E) {
      const id = ed[0]; seen.add(id);
      let e = map.get(id);
      if (!e) { e = { id, walkPhase: Math.random() * 6, x: ed[1], y: ed[2] }; map.set(id, e); }
      e.px = e.x; e.py = e.y; e.nx = ed[1]; e.ny = ed[2];
      e.shape = ed[3]; e.color = ed[4]; e.r = ed[5]; e._hpp = ed[6]; e.hp = ed[6]; e.maxHp = 100;
      e.boss = !!ed[7]; e.hitFlash = ed[8] ? 0.1 : 0; e.chill = ed[9] ? 1 : 0; e.elite = !!ed[10];
    }
    for (const id of [...map.keys()]) if (!seen.has(id)) map.delete(id);
    this.enemies = [...map.values()];
    this.gems = s.G.map(g => ({ x: g[0], y: g[1], xp: g[2], r: g[2] >= 50 ? 8 : g[2] >= 10 ? 6 : 4, t: this.time }));
    this.pickups = s.K.map(k => ({ x: k[0], y: k[1], kind: k[2], t: this.time }));
    this.projectiles = s.Pr.map(p => ({ x: p[0], y: p[1], r: p[2], color: p[3], rot: p[4] / 100, lobH: p[5], mode: p[6] ? 'boomerang' : 'linear' }));
    this.lasers = s.Lz.map(l => ({ x: l[0], y: l[1], ang: l[2], len: l[3], width: l[4], color: l[5], life: l[6], maxLife: l[7], owner: { x: l[0], y: l[1] } }));
    this.strikes = s.St.map(st => ({ x: st[0], y: st[1], r: st[2], color: st[3], life: st[4], maxLife: 0.3 }));
    this.hitboxes = s.Hb.map(h => ({ x: h[0], y: h[1], w: h[2], h: h[3], color: h[4], life: h[5], maxLife: 1 }));
    this.eProjectiles = s.Ep.map(p => ({ x: p[0], y: p[1], r: p[2], color: p[3] }));
    this.rifts = s.Rf.map(r => ({ x: r[0], y: r[1], r: r[2], state: r[3] ? 'active' : 'idle', timer: r[4], pulse: this.time }));
    this.floaters = s.F.map(f => ({ x: f[0], y: f[1], text: f[2], color: f[3], t: f[4], life: f[5] }));
    this.echoPos = s.eg ? { x: s.eg[0], y: s.eg[1] } : null;
    // orbiters/auras -> attach to a synthetic slot list on first player for renderer
    this._orb = (s.O || []); this._aura = (s.A || []);
    if (this.players[0]) {
      this.players[0].weapons = [{ id: '_net', _col: this._orb[0] ? this._orb[0][3] : '#fff', _ox: this._orb.map(o => ({ x: o[0], y: o[1], r: o[2] })), angle: this._orb[0] ? this._orb[0][4] / 100 : 0 }];
      for (const a of this._aura) this.players[0].weapons.push({ id: '_netaura', _col: a[3], _R: a[2], _ox: null });
    }
  }
  update(dt) { this.time += dt; this.particles.update(dt); if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30); for (let i = this.dmgNumbers.length - 1; i >= 0; i--) { } }
}
