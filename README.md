# 🩸 Abyss Survivors

A complete **Vampire Survivors-style roguelike** for the browser. Move to survive — your
weapons fire themselves. Built with HTML5 Canvas + vanilla JS (ES modules) on the front end
and a tiny Node/Express + `ws` server for online co-op. No build step, no framework.

> *Move to survive. The dark does the rest.*

### ▶ [**Play it now in your browser →**](https://fernforge.github.io/abyss-survivors/)

No install needed. Solo and **same-device co-op (2–4 players)** work right on the page.
Online room-code co-op needs the bundled Node server — run it locally (see Quick start) or deploy `server.js`.

---

## Quick start

```bash
npm install
npm start          # serves on http://localhost:3000
```

Open **http://localhost:3000**, click to enter (this unlocks audio), pick a survivor and a
realm, and descend.

---

## Controls

The only control is **movement** — everything else is automatic.

| Player | Keys |
|--------|------|
| P1 | Arrow keys **or** WASD |
| P2 | I J K L |
| P3 | Numpad 8/4/5/6 |
| P4 | T F G H |

- **Gamepads** are auto-detected (left stick / d-pad), one per player slot.
- **Touch devices** get an on-screen virtual joystick (bottom-left) automatically.
- **Esc** or the ❚❚ button pauses (solo / same-device only).
- On level-up, pick a card with the mouse/tap, ◀▶ + Enter, or number keys **1–4**.

---

## Features

### Core
- **12 characters**, each with unique starting weapon, stats and an identity bonus.
- **36 weapons** including evolutions (max a weapon + hold its paired passive → evolve).
- **22 passive items** that reshape your build.
- **28 enemies + 6 bosses** with distinct behaviours.
- **5 biomes** (Crypt, Woods, Inferno, Tundra, Abyss) with infinite, chunked procedural
  terrain — hundreds of tile variants per biome, all drawn procedurally on canvas.
- **139 achievements** with character/stage unlocks.
- A **Codex** (weapons, items, bestiary, features) and an **Achievements** browser.

### Original mechanics
1. **Corruption Meter** — rises with time and kills. Higher corruption means tougher enemies
   *and* richer rewards. Dread Shards spike it deliberately for high-risk/high-reward play.
2. **Time Rifts** — periodic portals; enter for a ~22s bullet-hell surge, then a chest.
3. **Elemental Affinity** — weapon elements combine (e.g. *Thermal Shock*) for stat bonuses.
4. **Echo Ghost** — your best run is recorded and replays as a translucent helper ghost.
5. **Co-op revival** — downed players can be revived by teammates standing near them.

### Multiplayer
- **Same-device co-op**: 2–4 players on one screen, each with their own key set.
- **Online co-op**: host creates a room and shares a 4-letter code; up to 4 players.
  Netplay is **host-authoritative** — the host runs the full simulation and streams
  snapshots (~15 Hz); guests send input (~30 Hz) and render interpolated state.

### Quality-of-life
- Off-screen **boss/elite arrows** point you toward threats.
- **Minimap** (top-right) plots players, enemies, bosses, rifts and chests.
- Settings: music / SFX volume, minimap toggle, screen-shake toggle, erase progress.

---

## Project layout

```
server.js                 Express static host + ws room relay (online co-op)
public/
  index.html, css/        UI shell + theme
  js/
    main.js               orchestrator: scenes, flow, game loop, HUD, netcode wiring
    core/                 rng, input (keymaps + gamepad + touch), audio (WebAudio), save
    data/                 characters, weapons, passives, enemies, stages, achievements
    game/                 game.js (simulation), weapons.js (firing patterns)
    render/               sprites, particles, world (infinite terrain), render (scene + overlays)
    net/                  net.js (ws client), sync.js (snapshot serialize + GuestView)
test/                     headless test harnesses (see below)
```

---

## Development & tests

These run in plain Node (no browser needed) by stubbing a minimal canvas:

```bash
node test/simtest.mjs            # drives the real sim across stages/chars/co-op/evolutions
node test/rendertest.mjs         # exercises the full render path + overlays for runtime errors
node test/balance.mjs 900 5 0    # multi-seed balance report: balance.mjs [seconds] [seeds] [stageIdx]
node test/nettest.mjs            # ws netcode smoke test — needs the server running first
```

`npm start` runs the server; `npm test` runs the sim test.

---

## Tech notes
- Pure ES modules, no bundler — served as-is.
- All art is generated procedurally to offscreen canvases and cached (no image assets).
- Audio is synthesized at runtime via the Web Audio API (no audio files).
