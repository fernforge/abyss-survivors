// Pure-Node simulation test. Stubs a minimal canvas/document so render/world.js can
// build its cached tile canvases, then drives the real Game sim for many frames and
// reports any thrown errors. Tests the highest-risk code (the sim) with zero browser.

// ---- Minimal canvas 2D context stub (no-op; sim never reads pixels) ----
function makeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({
    canvas: { width: 0, height: 0 },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    putImageData: noop, drawImage: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    rect: noop, fill: noop, stroke: noop, clip: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, transform: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 0 }), createPattern: () => ({}), setLineDash: noop, arcTo: noop,
    roundRect: noop,
  }, {
    get(t, k) { if (k in t) return t[k]; return undefined; },
    set(t, k, v) { t[k] = v; return true; }
  });
}
function makeCanvas() {
  const cv = { width: 0, height: 0, style: {} };
  cv.getContext = () => makeCtx();
  return cv;
}
globalThis.document = { createElement: (tag) => tag === 'canvas' ? makeCanvas() : { style: {} } };
globalThis.window = globalThis;
globalThis.performance = globalThis.performance || { now: () => 0 };

// ---- Import the real sim & data ----
const { Game, makePlayer } = await import('../public/js/game/game.js');
const { STAGES } = await import('../public/js/data/stages.js');
const { CHARACTERS } = await import('../public/js/data/characters.js');
const { WEAPONS } = await import('../public/js/data/weapons.js');
const { ENEMIES, BOSSES } = await import('../public/js/data/enemies.js');
const { PASSIVES } = await import('../public/js/data/passives.js');
const { ACHIEVEMENTS } = await import('../public/js/data/achievements.js');

console.log(`Loaded: ${CHARACTERS.length} chars, ${WEAPONS.length} weapons, ${PASSIVES.length} passives, ${ENEMIES.length} enemies, ${BOSSES.length} bosses, ${ACHIEVEMENTS.length} achievements, ${STAGES.length} stages`);

let failures = 0;
function check(cond, msg) { if (!cond) { console.log('  ✗ ' + msg); failures++; } }

// Auto-pick level-up choices (simulate the player choosing the first option).
function runStage(stageIdx, charId, seconds, autoMove) {
  const stage = STAGES[stageIdx];
  let levelups = 0, evolves = 0, bosses = 0, lastChoices = null;
  const callbacks = {
    sfx: () => {}, toast: () => {}, boss: () => { bosses++; },
    bossKilled: () => {}, evolve: () => { evolves++; },
    coopRevive: () => {},
    levelup: (pl, choices) => { lastChoices = { pl, choices }; },
    gameover: () => {}
  };
  const game = new Game({ stage, seed: 12345 + stageIdx, callbacks });
  // Smart kiting bot: flee the centroid of nearby enemies (with a perpendicular drift
  // so it sweeps the field and collects XP gems) — mimics real VS play and lets runs
  // survive into late game to exercise bosses, evolutions and rifts.
  let bt = 0, theGame = game;
  function botMove() {
    const me = theGame.players[0]; if (!me) return { x: 0, y: 0 };
    let cx = 0, cy = 0, n = 0;
    for (const e of theGame.enemies) {
      const dx = e.x - me.x, dy = e.y - me.y; const d2 = dx * dx + dy * dy;
      if (d2 < 220 * 220) { const w = 1 / (d2 + 400); cx += dx * w; cy += dy * w; n++; }
    }
    // nearest loose gem (so the bot collects XP like a human, not just circling)
    let gx = 0, gy = 0, gd = 1e18;
    for (const g of theGame.gems) { const dx = g.x - me.x, dy = g.y - me.y, d2 = dx * dx + dy * dy; if (d2 < gd) { gd = d2; gx = dx; gy = dy; } }
    let mx, my;
    if (n) {
      let ax = -cx, ay = -cy; const am = Math.hypot(ax, ay) || 1; ax /= am; ay /= am; // away from horde
      const px = -ay, py = ax; // strafe perpendicular
      const hpFrac = me.hp / me.maxHp;
      if (hpFrac > 0.55) {
        // healthy: face INTO the horde (toward = -away) so directional weapons connect,
        // with strafe so we don't body-block, and drift toward the nearest gem.
        let tx = -ax * 0.5 + px * 0.7, ty = -ay * 0.5 + py * 0.7;
        if (gd < 260 * 260) { const gm = Math.hypot(gx, gy) || 1; tx += gx / gm * 0.6; ty += gy / gm * 0.6; }
        mx = tx; my = ty;
      } else { mx = ax * 0.9 + px * 0.5; my = ay * 0.9 + py * 0.5; } // hurt: retreat
    } else if (gd < 1e17) { const gm = Math.hypot(gx, gy) || 1; mx = gx / gm; my = gy / gm; }
    else { mx = Math.cos(bt * 0.5); my = Math.sin(bt * 0.5); }
    const m = Math.hypot(mx, my) || 1; return { x: mx / m, y: my / m };
  }
  const pl = makePlayer(game, 0, charId, { type: 'local', getMove: botMove });
  pl.x = 0; pl.y = 0;
  game.players.push(pl);

  const dt = 1 / 60;
  const frames = Math.floor(seconds / dt);
  for (let f = 0; f < frames; f++) {
    bt += dt;
    game.update(dt);
    // resolve pending level-up by applying first choice (mimics UI)
    if (lastChoices) {
      const { pl: lp, choices } = lastChoices; lastChoices = null;
      if (choices && choices.length) { levelups++; game.applyChoice(lp, choices[0]); }
    }
    if (game.state === 'over' || game.state === 'win') break;
  }
  return { game, pl, levelups, evolves, bosses, frames: Math.min(frames, game._framesRun || frames) };
}

console.log('\n=== Solo sim: each stage, 1 char, ~90s of sim time ===');
for (let s = 0; s < STAGES.length; s++) {
  const char = CHARACTERS[s % CHARACTERS.length];
  try {
    const r = runStage(s, char.id, 90, { x: 0.6, y: 0.3 });
    const g = r.game;
    console.log(`Stage "${STAGES[s].name}" / ${char.name}: t=${g.time.toFixed(0)}s kills=${g.kills} lv=${r.pl.level} levelups=${r.levelups} gemsOnGround=${g.gems.length} enemies=${g.enemies.length} corruption=${g.corruption.toFixed(0)} state=${g.state}`);
    check(g.time > 0, 'time advanced');
    check(g.kills >= 0, 'kills non-negative');
    check(r.pl.level >= 1, 'player level >= 1');
    check(Number.isFinite(r.pl.x) && Number.isFinite(r.pl.y), 'player pos finite');
    check(Number.isFinite(g.corruption), 'corruption finite');
    check(g.enemies.length < 5000, 'enemy count bounded');
    check(g.projectiles.length < 8000, 'projectile count bounded');
    for (const e of g.enemies) { if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) { check(false, 'enemy NaN field'); break; } }
  } catch (e) {
    console.log(`Stage ${s} THREW: ${e.stack || e}`); failures++;
  }
}

console.log('\n=== Long solo run (8 min sim, stage 0) to exercise bosses/evolutions/rifts ===');
try {
  const r = runStage(0, 'kael', 8 * 60, { x: 0.5, y: 0.5 });
  const g = r.game;
  console.log(`8min: survived=${g.time.toFixed(0)}s kills=${g.kills} lv=${r.pl.level} levelups=${r.levelups} evolves=${r.evolves} bossSpawns=${r.bosses} weapons=${r.pl.weapons.length} passives=${Object.keys(r.pl.passives).length} rifts=${g.riftsCleared} corruption=${g.corruption.toFixed(0)} state=${g.state}`);
  check(r.levelups > 3, 'multiple level-ups in 8 min');
  check(r.pl.weapons.length >= 1, 'has weapons');
} catch (e) { console.log('Long run THREW: ' + (e.stack || e)); failures++; }

console.log('\n=== Local 4-player co-op (stage 0, 60s) ===');
try {
  const stage = STAGES[0];
  const game = new Game({ stage, seed: 999, callbacks: { sfx(){}, toast(){}, boss(){}, bossKilled(){}, evolve(){}, coopRevive(){}, levelup(pl, ch){ if(ch&&ch[0]) game.applyChoice(pl, ch[0]); }, gameover(){} } });
  for (let i = 0; i < 4; i++) { const pl = makePlayer(game, i, CHARACTERS[i].id, { type: 'local', getMove: () => ({ x: Math.sin(i)*0.5, y: Math.cos(i)*0.5 }) }); pl.x = i*40; game.players.push(pl); }
  for (let f = 0; f < 60*60; f++) { game.update(1/60); if (game.state==='over'||game.state==='win') break; }
  console.log(`4p: t=${game.time.toFixed(0)} kills=${game.kills} alive=${game.players.filter(p=>!p.dead).length}/4 state=${game.state}`);
  check(game.players.length === 4, '4 players');
} catch (e) { console.log('Co-op THREW: ' + (e.stack || e)); failures++; }

console.log('\n=== applyChoice over every weapon & passive (sanity: no throw on any pick) ===');
try {
  const game = new Game({ stage: STAGES[0], seed: 7, callbacks: { sfx(){}, toast(){}, boss(){}, bossKilled(){}, evolve(){}, coopRevive(){}, levelup(){}, gameover(){} } });
  const pl = makePlayer(game, 0, CHARACTERS[0].id, { type: 'local', getMove: () => ({x:0,y:0}) });
  game.players.push(pl);
  let picks = 0;
  // Use real choice objects (shape matters: upweapon needs .slot, newweapon needs .weapon).
  for (const w of WEAPONS) {
    if (w.evolved) continue;
    try {
      const slot = pl.weapons.find(s => s.id === w.id);
      const choice = slot ? { type: 'upweapon', slot, weapon: w } : { type: 'newweapon', weapon: w };
      if (pl.weapons.length < 6 || slot) { game.applyChoiceCore(pl, choice); picks++; }
    } catch (e) { check(false, 'applyChoice weapon ' + w.id + ': ' + e.message); }
  }
  for (const p of PASSIVES) {
    try {
      const have = pl.passives[p.id];
      const choice = have ? { type: 'uppassive', id: p.id, passive: p } : { type: 'newpassive', passive: p };
      if (Object.keys(pl.passives).length < 6 || have) { game.applyChoiceCore(pl, choice); picks++; }
    } catch (e) { check(false, 'applyChoice passive ' + p.id + ': ' + e.message); }
  }
  console.log(`Applied ${picks} choices; final weapons=${pl.weapons.length} passives=${Object.keys(pl.passives).length}`);
  // run a few seconds with everything equipped
  for (let f=0; f<5*60; f++) game.update(1/60);
  console.log(`Loaded build ran 5s OK: kills=${game.kills} proj=${game.projectiles.length}`);
} catch (e) { console.log('applyChoice sweep THREW: ' + (e.stack || e)); failures++; }

console.log('\n=== Evolution path (max a weapon + grant its passive → evolve) ===');
try {
  let evolved = null;
  const game = new Game({ stage: STAGES[0], seed: 3, callbacks: { sfx(){}, toast(){}, boss(){}, bossKilled(){}, coopRevive(){}, levelup(){}, gameover(){}, evolve(w){ evolved = w; } } });
  const pl = makePlayer(game, 0, 'aria', { type: 'local', getMove: () => ({ x: 0, y: 0 }) });
  game.players.push(pl);
  const whip = WEAPONS.find(w => w.id === 'whip');
  const slot = pl.weapons.find(s => s.id === 'whip');
  slot.level = whip.maxLevel;                       // max the whip
  pl.passives[whip.evolution.req] = 1;              // grant required passive (hollowheart)
  game.applyChoiceCore(pl, { type: 'uppassive', id: whip.evolution.req, passive: PASSIVES.find(p=>p.id===whip.evolution.req) });
  const choices = game.generateChoices(pl);
  const evoChoice = choices.find(c => c.type === 'evolve');
  check(!!evoChoice, 'evolution offered when weapon maxed + passive owned');
  if (evoChoice) {
    game.applyChoiceCore(pl, evoChoice);
    const evoSlot = pl.weapons.find(s => s.id === whip.evolution.into);
    check(!!evoSlot, 'whip became ' + whip.evolution.into);
    check(!!evolved, 'evolve callback fired');
    // run a few seconds with the evolved weapon
    for (let f=0; f<3*60; f++) game.update(1/60);
    console.log(`Evolved to "${WEAPONS.find(w=>w.id===whip.evolution.into)?.name}" and ran 3s: kills=${game.kills}`);
  }
} catch (e) { console.log('Evolution test THREW: ' + (e.stack || e)); failures++; }

console.log(`\n=== DONE: ${failures} failure(s) ===`);
process.exit(failures ? 1 : 0);
