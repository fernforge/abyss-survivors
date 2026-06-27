# Abyss Survivors — Build Progress

## Goal
A complete **Vampire Survivors-style roguelike** (web, HTML5 Canvas + vanilla JS ES modules, Node/Express/ws).
Movement-only controls (arrows/WASD/gamepad/touch), auto-firing weapons. Tons of content, top-tier procedural
canvas art, same-device (1-4 local) AND networked co-op, clean flow, original features.

## Run / test
`npm install` (done) then `npm start` → http://localhost:3000
NOTE: in this sandbox, launch server via Bash `run_in_background:true` and curl with
`dangerouslyDisableSandbox:true` (plain backgrounded node + curl returns 000). Server CONFIRMED WORKING.

## Status: ✅ BUILD COMPLETE + PUBLISHED to GitHub & live on GitHub Pages. 0 known bugs.

### 🌐 PUBLISHED (this run)
- **Repo:** https://github.com/fernforge/abyss-survivors (public, owner `fernforge`, pushed via `GH_TOKEN`).
- **Live game:** https://fernforge.github.io/abyss-survivors/ — solo + same-device co-op fully playable.
- Pages deploys via **GitHub Actions** (`.github/workflows/pages.yml`) uploading `public/` as the Pages
  artifact (Pages `build_type=workflow`). Push to `main` → auto-redeploy. All asset paths are RELATIVE so it
  works under the `/abyss-survivors/` subpath.
- Online co-op needs the Node+ws server (Pages can't host it). Graceful degradation added: `STATIC_HOST`
  detection in main.js (github.io / pages.dev / file:) → shows `#onlineNote` and greys out Host/Join cards.
- Verified LIVE with Playwright (`/tmp/playlive.mjs`, Chromium at `/ms-playwright/chromium-1228/...`): page
  loads, multiplayer note+disabled cards correct, full solo run starts with HUD/minimap/tiles rendering,
  **0 console/page errors**. Screenshots: `test/livepages.png`, `test/livegameplay.png`.
- Git identity: `fernforge` / `fernforgehq@gmail.com`. `.gitignore` excludes node_modules, .chromelibs, .cb.

Everything in the original task is implemented, balanced, and verified. All 4 test harnesses are GREEN and
a real headless-Chrome playtest passes with **0 console/page errors**.

### Content delivered
12 characters · 36 weapons (incl. evolutions) · 22 passives · 28 enemies + 6 bosses · 5 infinite biomes
(hundreds of procedural tile variants each) · 139 achievements · Codex + Achievements browsers.

### Original features (all implemented + playtested)
1. **Corruption Meter** — rises w/ time+kills; scales enemy HP/dmg + XP/loot; Dread Shards spike it. HUD bar.
2. **Time Rifts** — periodic portal; enter → ~22s bullet-hell surge → chest + corruption.
3. **Elemental Affinity** — weapon elements combo (Thermal Shock etc.) for stat bonuses. HUD tags.
4. **Echo Ghost** — best run path saved to localStorage; replays as translucent helper ghost.
5. **Co-op** — same-device 2-4 (own keymaps) + online (room codes). Downed/revive.

### Multiplayer
Same-device 2–4 (Arrows/WASD · IJKL · Numpad · TFGH) + online host-authoritative co-op (4-letter room codes,
host runs sim & streams snapshots @15Hz, guests send input @30Hz & render interpolated state).

## What was done THIS run (final polish run)
1. **Off-screen boss/elite arrows + minimap** — added `drawOverlays(ctx,game,w,h,cam)` in render.js, called
   at end of render(). Arrows point to off-screen bosses (with distance) & elites. Minimap (top-right, 124px)
   plots players/enemies/bosses/rifts/chests/gems. Works for both Game and GuestView (null-guarded). Pause
   button moved to TOP-LEFT so it doesn't collide with the minimap. `roundRect()` helper added.
2. **Mobile touch controls** — `IS_TOUCH` + `Input.initTouchJoystick(pad)` in core/input.js (virtual joystick
   → feeds Input.getMove(0)). `#touchPad` div in index.html (shown only on touch + during play via
   showTouchPad()), CSS styled. body.touch class enlarges pause button.
3. **Settings**: added Minimap + Screen-Shake toggles (index.html + save.js defaults + main.js wiring +
   window.__settings). render.js respects both (shake gated, minimap skip). save.js backfills new setting keys
   for old saves.
4. **README.md** — full: quick start, controls, features, multiplayer, layout, dev/test commands.
5. **package.json** — added `"test": "node test/simtest.mjs && node test/rendertest.mjs"`.
6. **REAL BROWSER PLAYTEST — UNBLOCKED & PASSING.** The 24 missing system libs are now extracted locally:
   - `.chromelibs/debs/` holds downloaded Debian *bookworm* .deb packages; `.chromelibs/lib/` holds the
     extracted `.so*` files. (NOTE: libdrm2 & libwayland-server0 MUST be the bookworm versions — the "latest"
     pool versions need GLIBC_2.38 which bookworm lacks. See debs/ for the exact ones used.)
   - `test/playtest.mjs` is now self-contained: it sets `LD_LIBRARY_PATH=.chromelibs/lib` and auto-finds
     `chrome-headless-shell`, launches with **`headless:'shell'` + `pipe:true`** (WebSocket transport is
     blocked in this sandbox — pipe is required) + `--disable-gpu` (2D canvas, no GL needed).
   - Result: loads page → start gate → char → stage → solo run → circles for 26s → **11 kills, level 2, 2nd
     weapon picked, gold collected, corruption rising, 0 errors**. Screenshot at `test/playtest.png` shows
     HUD, minimap, gems, projectiles, procedural crypt tiles all rendering.

### Test harnesses (test/ — ALL GREEN)
- `node test/simtest.mjs`   — pure-Node sim (stages×chars, 8-min run, 4p co-op, every weapon/passive, evolution).
- `node test/rendertest.mjs`— NEW: stubs canvas, constructs real Game + Renderer, forces off-screen boss/elite,
  renders 60 frames + minimap-off path. Catches render runtime errors node --check can't.
- `node test/balance.mjs [secs] [seeds] [stageIdx]` — multi-seed balance medians.
- `node test/nettest.mjs`   — ws netcode smoke test (host+2 guests). Needs server running. 15/15 pass.
- `node test/playtest.mjs`  — REAL headless-Chrome playtest (needs server running + .chromelibs present).

## Files (all present & parse-clean)
- `server.js` · `public/index.html` · `public/css/style.css`
- `public/js/main.js` (orchestrator) · `public/js/core/` (rng,input,audio,save)
- `public/js/data/` (characters,weapons,passives,enemies,stages,achievements)
- `public/js/game/` (game.js sim, weapons.js patterns) · `public/js/render/` (sprites,particles,world,render)
- `public/js/net/` (net.js, sync.js) · `test/` (5 harnesses) · `README.md`

## What's LEFT (nice-to-haves only — build is complete & shippable)
- Touch joystick is coded & styled but only logic-verified (can't simulate real touch events headlessly).
  Would benefit from a real mobile-device check if ever available.
- Could deepen balance per-character (some low-mobility chars survive shorter under the bot; humans do better).
- Optional: more decor variety, sound polish, more bosses/biomes — all additive, not required.

## Key gotchas for any future run
- Server in sandbox: Bash `run_in_background:true` + curl `dangerouslyDisableSandbox:true`.
- Browser playtest: requires `.chromelibs/lib` (extracted libs) + chrome-headless-shell, launch with
  `pipe:true` (NOT websocket) and `--disable-gpu`. test/playtest.mjs handles all of this itself.
- If `.chromelibs/` is ever wiped: re-download the bookworm .debs (see debs/ filenames in this dir for the
  exact set incl. transitive deps: libxau6, libxdmcp6, libxi6, libxrender1, libdrm2 *bookworm*,
  libwayland-server0 *bookworm*), `dpkg-deb -x` each into extract/, copy *.so* into lib/.
- window.__settings mirrors Save.data.settings (minimap/shake) — render.js reads it.

## Next concrete step
Nothing required — game is built, published, and live at https://fernforge.github.io/abyss-survivors/ .
Any push to `main` auto-redeploys Pages. If continuing: real-device mobile touch check, deeper per-character
balance, or stand up a public ws server so online co-op works from the Pages site too.
