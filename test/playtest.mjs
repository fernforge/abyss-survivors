// Headless playtest harness — loads the game in a REAL browser, starts a solo run,
// steps frames, reports console/page errors, and screenshots. Self-contained: it points
// at the locally-extracted system libs (see .chromelibs/) and chrome-headless-shell so a
// plain `node test/playtest.mjs` works in this sandbox (needs the server running first).
import puppeteer from 'puppeteer';
import { existsSync, readdirSync } from 'fs';

// --- locate locally-extracted libs + chrome-headless-shell so the browser can launch ---
const LIBDIR = new URL('../.chromelibs/lib', import.meta.url).pathname;
if (existsSync(LIBDIR)) process.env.LD_LIBRARY_PATH = LIBDIR + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
if (!process.env.CHROME_BIN) {
  const base = `${process.env.HOME}/.cache/puppeteer/chrome-headless-shell`;
  try { const v = readdirSync(base).find(d => d.startsWith('linux-')); if (v) { const c = `${base}/${v}/chrome-headless-shell-linux64/chrome-headless-shell`; if (existsSync(c)) process.env.CHROME_BIN = c; } } catch {}
}

const GAME_URL = process.env.GAME_URL || 'http://localhost:3000';
const errors = [];
const logs = [];

console.log('Launching chrome…', process.env.CHROME_BIN || '(default)');
const browser = await puppeteer.launch({
  headless: 'shell',
  executablePath: process.env.CHROME_BIN || undefined,
  pipe: true,
  timeout: 60000,
  protocolTimeout: 60000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
});
console.log('Chrome launched.');
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

page.on('console', m => { const t = m.type(); const txt = m.text(); logs.push(`[${t}] ${txt}`); if (t === 'error') errors.push('CONSOLE ERROR: ' + txt); });
page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message + '\n' + (e.stack || '')));
page.on('requestfailed', r => errors.push('REQ FAILED: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

console.log('Loading', GAME_URL);
await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 30000 });

// Wait for the start gate button to be present
await page.waitForSelector('#startGateBtn', { timeout: 10000 });
console.log('Page loaded. Clicking start gate…');
await page.click('#startGateBtn');
await new Promise(r => setTimeout(r, 300));

// Navigate: menu -> Play (data-go="charSelect") then pick char, stage, start.
// Find the primary Play button.
const goCharBtn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-go="charSelect"]')][0];
  if (b) { b.click(); return true; } return false;
});
console.log('Clicked charSelect:', goCharBtn);
await new Promise(r => setTimeout(r, 300));

// pick first unlocked char card
await page.evaluate(() => { const c = document.querySelector('#charGrid .pick-card:not(.locked)'); if (c) c.click(); });
await new Promise(r => setTimeout(r, 150));
await page.evaluate(() => document.querySelector('#charConfirm')?.click());
await new Promise(r => setTimeout(r, 300));

// pick first unlocked stage
await page.evaluate(() => { const c = document.querySelector('#stageGrid .pick-card:not(.locked)'); if (c) c.click(); });
await new Promise(r => setTimeout(r, 150));
await page.evaluate(() => document.querySelector('#stageConfirm')?.click());
await new Promise(r => setTimeout(r, 500));

// Check game state
const started = await page.evaluate(() => {
  // App is module-scoped; expose via window if available, else check hud visibility
  const hud = document.querySelector('#hud');
  return hud && !hud.classList.contains('hidden');
});
console.log('HUD visible (game started):', started);

// Sample diagnostics over time. We hook into window for game state.
await page.evaluate(() => {
  window.__diag = () => {
    // Try to reach the game via the module — not directly accessible. Use canvas + DOM HUD instead.
    const t = document.querySelector('#hudTimer')?.textContent;
    const lvl = document.querySelector('#hudLevel')?.textContent;
    const kills = document.querySelector('#hudKills')?.textContent;
    const gold = document.querySelector('#hudGold')?.textContent;
    const cor = document.querySelector('#corruptionVal')?.textContent;
    const wslots = document.querySelectorAll('#hudBottom .wslot').length;
    return { t, lvl, kills, gold, cor, wslots };
  };
});

// Move in a circle so enemies swarm and weapons connect (a straight-line flee kills nothing).
const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
const samples = [];
const SECS = 26;
for (let i = 0; i < SECS; i++) {
  const d = dirs[i % 4];
  await page.keyboard.down(d);
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.up(d);
  // auto-pick a level-up choice if overlay is open
  await page.evaluate(() => { const lv = document.querySelector('#levelup'); if (lv && !lv.classList.contains('hidden')) { const c = document.querySelector('#levelupCards .lvl-card'); if (c) c.click(); } });
  const s = await page.evaluate(() => window.__diag());
  samples.push(s);
  if (i % 2 === 1) console.log(`t+${i + 1}s`, JSON.stringify(s));
}

// Screenshot
await page.screenshot({ path: 'test/playtest.png' });
console.log('Screenshot saved to test/playtest.png');

console.log('\n=== ERRORS (' + errors.length + ') ===');
errors.forEach(e => console.log(e));

// Did the timer advance / kills happen?
const first = samples[0], last = samples[samples.length - 1];
console.log('\nFirst sample:', JSON.stringify(first));
console.log('Last  sample:', JSON.stringify(last));

await browser.close();
process.exit(errors.length ? 1 : 0);
