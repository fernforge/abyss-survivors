// Render smoke test: stubs canvas/window, constructs a real Game with a boss + elite
// off-screen, and calls Renderer.render() many times to exercise drawOverlays (boss
// arrows + minimap) and the whole draw path for runtime errors. Catches things
// node --check can't (undefined ctx methods, bad math, null fields).

function makeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({
    canvas: { width: 0, height: 0 },
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    putImageData: noop, drawImage: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    rect: noop, fill: noop, stroke: noop, clip: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, transform: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 0 }), createPattern: () => ({}), setLineDash: noop, arcTo: noop, roundRect: noop,
  }, { get(t, k) { return k in t ? t[k] : undefined; }, set(t, k, v) { t[k] = v; return true; } });
}
function makeCanvas() { const cv = { width: 0, height: 0, style: {} }; cv.getContext = () => makeCtx(); return cv; }
globalThis.document = { createElement: (tag) => tag === 'canvas' ? makeCanvas() : { style: {} } };
globalThis.window = globalThis;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.performance = globalThis.performance || { now: () => 0 };

const { Game, makePlayer } = await import('../public/js/game/game.js');
const { Renderer } = await import('../public/js/render/render.js');
const { STAGES } = await import('../public/js/data/stages.js');

let failures = 0;
const check = (c, m) => { if (!c) { console.log('  ✗ ' + m); failures++; } };

const game = new Game({ stage: STAGES[0], seed: 7, callbacks: { sfx() {}, toast() {}, boss() {}, bossKilled() {}, evolve() {}, coopRevive() {}, levelup() {}, gameover() {} } });
const pl0 = makePlayer(game, 0, 'aria', { type: 'local', getMove: () => ({ x: 1, y: 0 }) });
pl0.x = 0; pl0.y = 0; game.players.push(pl0);

const canvas = makeCanvas();
const r = new Renderer(canvas);
r.w = 1280; r.h = 720;

// run a bit so entities exist
for (let i = 0; i < 120; i++) game.update(1 / 60);

// force a boss + elite far off-screen to exercise arrows
const c = game.centroid();
if (game.enemies[0]) { game.enemies[0].boss = true; game.enemies[0].x = c.x + 4000; game.enemies[0].y = c.y - 3000; }
if (game.enemies[1]) { game.enemies[1].elite = true; game.enemies[1].x = c.x - 5000; game.enemies[1].y = c.y + 2000; }

try {
  for (let i = 0; i < 60; i++) { game.update(1 / 60); r.render(game); }
  console.log('  ✓ rendered 60 frames with off-screen boss + elite, minimap on');
} catch (e) { console.log('  ✗ render threw: ' + e.stack); failures++; }

// minimap-off path
globalThis.window.__settings = { minimap: false };
try { r.render(game); console.log('  ✓ rendered with minimap disabled'); }
catch (e) { console.log('  ✗ render(minimap off) threw: ' + e.stack); failures++; }

console.log(`\n=== RENDER TEST: ${failures} failure(s) ===`);
process.exit(failures ? 1 : 0);
