// Abyss Survivors — app orchestrator: scenes, flow, game loop, multiplayer.
import { Input, KEYMAPS, IS_TOUCH } from './core/input.js';
import { Audio } from './core/audio.js';
import { Save } from './core/save.js';
import { Game, makePlayer } from './game/game.js';
import { Renderer } from './render/render.js';
import { CHARACTERS } from './data/characters.js';
import { STAGES } from './data/stages.js';
import { WEAPONS, WEAPON_MAP } from './data/weapons.js';
import { PASSIVES } from './data/passives.js';
import { ENEMIES, BOSSES } from './data/enemies.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { getSprite } from './render/sprites.js';
import { Net } from './net/net.js';
import { serialize, GuestView } from './net/sync.js';

window.__weaponColors = Object.fromEntries(WEAPONS.map(w => [w.id, w.color]));

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const canvas = $('#game');
const renderer = new Renderer(canvas);

const App = {
  scene: 'menu', game: null, guest: null, net: null, paused: false,
  selChar: null, selStage: null, mode: 'solo', localCount: 1, localChars: [],
  lastT: 0, netAcc: 0, inputSeq: 0, lobbyPlayers: [], myCharNet: 'aria'
};
Save.load();
Audio.setMusicVol(Save.data.settings.music);
Audio.setSfxVol(Save.data.settings.sfx);

// ---------------- Scene management ----------------
function show(id) {
  $$('#screens .screen').forEach(s => s.classList.add('hidden'));
  const el = $('#' + id); if (el) el.classList.remove('hidden');
  App.scene = id;
}
function hideAllScreens() { $$('#screens .screen').forEach(s => s.classList.add('hidden')); }

$$('[data-go]').forEach(b => b.onclick = () => { Audio.sfx('select'); const t = b.dataset.go; if (t === 'achievements') buildAchievements(); if (t === 'codex') buildCodex('weapons'); if (t === 'charSelect') { App.mode = 'solo'; buildCharSelect(); } if (t === 'modeSelect') { applyStaticHostUI(); } show(t); });
$$('[data-back]').forEach(b => b.onclick = () => { Audio.sfx('select'); show(b.dataset.back); });

// ---------------- Start gate (unlock audio) ----------------
$('#startGateBtn').onclick = () => {
  Audio.init(); Audio.resume(); Audio.startMusic('menu');
  $('#startGate').classList.add('hidden');
  show('menu');
};
if (IS_TOUCH) { document.body.classList.add('touch'); Input.initTouchJoystick($('#touchPad')); }
function showTouchPad(on) { const p = $('#touchPad'); if (p) p.classList.toggle('hidden', !(on && IS_TOUCH)); }

// ---------------- Character select ----------------
function charCard(ch, locked, onClick) {
  const d = document.createElement('div'); d.className = 'pick-card' + (locked ? ' locked' : '');
  const spr = getSprite('player', ch.color, 26, ch.accent);
  const cv = document.createElement('canvas'); cv.width = spr.width; cv.height = spr.height;
  cv.getContext('2d').drawImage(spr, 0, 0);
  d.appendChild(cv);
  const w = WEAPON_MAP[ch.startWeapon];
  d.insertAdjacentHTML('beforeend', `<h4>${ch.name.split(' ')[0]}</h4><p>${ch.desc}</p><div class="badge">${ch.element} · ${w ? w.name : ''}</div>${locked ? `<div class="lock">🔒</div>` : ''}`);
  if (!locked && onClick) d.onclick = () => onClick(d, ch);
  else if (locked) d.title = unlockText(ch.unlock);
  return d;
}
function unlockText(u) { if (!u) return ''; if (u.ach) { const a = ACHIEVEMENTS.find(x => x.id === u.ach); return 'Unlock: ' + (a ? a.name + ' — ' + a.desc : u.ach); } return 'Locked'; }

function buildCharSelect() {
  const grid = $('#charGrid'); grid.innerHTML = ''; App.selChar = null; $('#charConfirm').disabled = true;
  for (const ch of CHARACTERS) {
    const locked = !Save.isCharUnlocked(ch);
    grid.appendChild(charCard(ch, locked, (el, c) => {
      $$('#charGrid .pick-card').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
      App.selChar = c.id; $('#charConfirm').disabled = false; Audio.sfx('select');
    }));
  }
}
$('#charConfirm').onclick = () => { Audio.sfx('select'); buildStageSelect(); show('stageSelect'); };

// ---------------- Stage select ----------------
function buildStageSelect() {
  const grid = $('#stageGrid'); grid.innerHTML = ''; App.selStage = null; $('#stageConfirm').disabled = true;
  for (const s of STAGES) {
    const locked = !Save.isStageUnlocked(s);
    const d = document.createElement('div'); d.className = 'pick-card' + (locked ? ' locked' : '');
    d.style.background = `linear-gradient(180deg, ${s.ground[1]}, ${s.ground[0]})`;
    d.innerHTML = `<h4>${s.name}</h4><p>${s.desc}</p><div class="badge">${Math.round(s.timeLimit / 60)} min</div>${locked ? `<div class="lock">🔒</div>` : ''}`;
    if (!locked) d.onclick = () => { $$('#stageGrid .pick-card').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); App.selStage = s.id; $('#stageConfirm').disabled = false; Audio.sfx('select'); };
    else d.title = unlockText(s.unlock);
    grid.appendChild(d);
  }
}
$('#stageConfirm').onclick = () => {
  Audio.sfx('select');
  if (App.mode === 'host') { App.net.start(App.selStage); }
  else startLocalGame();
};

// ---------------- Mode select ----------------
// Static web build (GitHub Pages / file://) has no Node+ws server, so online co-op can't work.
const STATIC_HOST = location.protocol === 'file:' || /\.github\.io$|\.pages\.dev$/.test(location.hostname);
function applyStaticHostUI() {
  if (!STATIC_HOST) return;
  const note = $('#onlineNote'); if (note) note.classList.remove('hidden');
  $$('#modeGrid .mode-card').forEach(c => {
    if (c.dataset.mode === 'host' || c.dataset.mode === 'join') { c.classList.add('disabled'); c.setAttribute('aria-disabled', 'true'); }
  });
}
$$('#modeGrid .mode-card').forEach(c => c.onclick = () => {
  const m = c.dataset.mode;
  if (STATIC_HOST && (m === 'host' || m === 'join')) { Audio.sfx('select'); toast('🌐 Online needs the local server — try Same-Device Co-op'); return; }
  Audio.sfx('select');
  if (m === 'local2') { App.mode = 'local'; buildLocalSetup(); show('localSetup'); }
  else if (m === 'host') { App.mode = 'host'; startHost(); }
  else if (m === 'join') { App.mode = 'join'; startJoin(); }
});

// ---------------- Local co-op setup ----------------
function buildLocalSetup() {
  App.localCount = 2; App.localChars = ['aria', 'kael', 'vesna', 'doruk'];
  const cc = $('#localCount'); cc.innerHTML = '';
  [2, 3, 4].forEach(n => { const b = document.createElement('div'); b.className = 'pick-card'; b.innerHTML = `<h4>${n} Players</h4><p>${KEYMAPS.slice(0, n).map(k => k.name).join(' · ')}</p>`; b.onclick = () => { App.localCount = n; $$('#localCount .pick-card').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); renderLocalChars(); Audio.sfx('select'); }; if (n === 2) b.classList.add('sel'); cc.appendChild(b); });
  renderLocalChars();
}
function renderLocalChars() {
  const wrap = $('#localChars'); wrap.innerHTML = '';
  const unlocked = Save.unlockedChars();
  for (let i = 0; i < App.localCount; i++) {
    const slot = document.createElement('div'); slot.className = 'local-slot';
    slot.innerHTML = `<h4>Player ${i + 1} — ${KEYMAPS[i].name}</h4>`;
    const grid = document.createElement('div'); grid.className = 'grid small';
    for (const ch of unlocked) {
      const card = charCard(ch, false, (el) => { App.localChars[i] = ch.id; [...grid.children].forEach(x => x.classList.remove('sel')); el.classList.add('sel'); Audio.sfx('select'); });
      if (App.localChars[i] === ch.id) card.classList.add('sel');
      grid.appendChild(card);
    }
    slot.appendChild(grid); wrap.appendChild(slot);
  }
}
$('#localStart').onclick = () => { Audio.sfx('select'); App.selChar = App.localChars[0]; buildStageSelect(); show('stageSelect'); };

// ---------------- Game start (local / solo / host) ----------------
function startLocalGame() {
  const stage = STAGES.find(s => s.id === App.selStage) || STAGES[0];
  const seed = (Date.now() & 0xffffffff) || 1;
  const game = new Game({ stage, seed, callbacks: gameCallbacks(), echoGhost: Save.getEcho() });
  const n = App.mode === 'local' ? App.localCount : 1;
  for (let i = 0; i < n; i++) {
    const charId = App.mode === 'local' ? (App.localChars[i] || 'aria') : App.selChar;
    const keymapIdx = i;
    const pl = makePlayer(game, i, charId, { type: 'local', getMove: () => Input.getMove(keymapIdx) });
    pl.x = i * 50 - (n - 1) * 25; pl.y = 0;
    game.players.push(pl);
  }
  beginGame(game, stage);
}

function beginGame(game, stage) {
  App.game = game; App.guest = null; App.paused = false;
  Save.data.charsUsed[game.players[0].char.id] = true; Save.data.stagesUsed[stage.id] = true;
  hideAllScreens(); $('#hud').classList.remove('hidden'); showTouchPad(true);
  Audio.startMusic(stage.music || 'crypt');
  buildHudSlots();
}

function gameCallbacks() {
  return {
    sfx: n => Audio.sfx(n),
    toast: msg => toast(msg),
    levelup: (pl, choices) => openLevelUp(pl, choices),
    boss: b => toast('⚠️ ' + b.name + ' approaches!'),
    bossKilled: b => { Save.data.bossesKilled = Save.data.bossesKilled || {}; Save.data.bossesKilled[b.id] = true; toast('🏆 ' + b.name + ' defeated!'); },
    evolve: w => toast('🧬 Evolved into ' + w.name + '!'),
    coopRevive: () => { App.game.runStats.coopRevives = (App.game.runStats.coopRevives || 0) + 1; },
    gameover: (run, win) => onGameOver(run, win)
  };
}

// ---------------- Online: Host ----------------
async function startHost() {
  App.net = new Net();
  try { await App.net.connect(); } catch { toast('⚠️ Could not reach server'); show('modeSelect'); return; }
  App.net.on('created', m => { App.lobbyPlayers = [{ id: m.id, name: 'You (Host)', char: App.myCharNet, host: true }]; renderLobby(true); });
  App.net.on('lobby', m => { App.lobbyPlayers = m.players; renderLobby(true); });
  App.net.on('start', m => hostStartGame(m));
  App.net.on('hostleft', () => { });
  App.net.on('input', () => { });
  App.myCharNet = App.selChar || 'aria';
  App.net.create(App.selStage || 'crypt', 'Host', App.myCharNet);
  $('#joinForm').classList.add('hidden');
  show('lobby');
}
function hostStartGame(m) {
  const stage = STAGES.find(s => s.id === m.stage) || STAGES[0];
  const game = new Game({ stage, seed: m.seed, networked: true, autoLevel: true, isHost: true, callbacks: gameCallbacks() });
  let idx = 0;
  for (const lp of m.players) {
    const isMe = lp.id === App.net.id;
    const control = isMe ? { type: 'local', getMove: () => Input.getMove(0) } : { type: 'remote', getMove: () => { const inp = App.net.inputs.get(lp.id); return inp && inp.mv ? inp.mv : { x: 0, y: 0 }; } };
    const pl = makePlayer(game, idx, lp.char, control);
    pl._netId = lp.id; pl.x = idx * 50; game.players.push(pl); idx++;
  }
  beginGame(game, stage);
}

// ---------------- Online: Join (guest) ----------------
async function startJoin() {
  App.net = new Net();
  try { await App.net.connect(); } catch { toast('⚠️ Could not reach server'); show('modeSelect'); return; }
  App.net.on('joined', m => { App.lobbyPlayers = m.players; App.guestStage = m.stage; renderLobby(false); });
  App.net.on('lobby', m => { App.lobbyPlayers = m.players; renderLobby(false); });
  App.net.on('start', m => guestStartGame(m));
  App.net.on('neterror', msg => { toast('⚠️ ' + msg); });
  App.net.on('hostleft', () => { toast('Host left the game'); endToMenu(); });
  App.net.on('state', s => { if (App.guest) App.guest.apply(s); });
  $('#joinForm').classList.remove('hidden');
  $('#lobbyCode').innerHTML = `<small>Enter your friend's room code</small>`;
  show('lobby');
}
$('#joinGo').onclick = () => {
  const code = $('#codeInput').value.trim().toUpperCase(); if (code.length < 4) return;
  App.myCharNet = App.selChar || 'aria';
  App.net.join(code, 'Player', App.myCharNet); Audio.sfx('select');
};
function guestStartGame(m) {
  const stage = STAGES.find(s => s.id === m.stage) || STAGES[0];
  App.guest = new GuestView(stage, m.seed); App.game = null; App.paused = false;
  hideAllScreens(); $('#hud').classList.remove('hidden'); showTouchPad(true);
  Audio.startMusic(stage.music || 'crypt');
  $('#hudBottom').innerHTML = '<div class="wslot">🌐</div>';
  toast('Connected! Host is in control of the world.');
}

// ---------------- Lobby UI ----------------
function renderLobby(isHost) {
  show('lobby');
  if (isHost && App.net.code) $('#lobbyCode').innerHTML = `${App.net.code}<small>room code — share with friends</small>`;
  const list = $('#lobbyPlayers'); list.innerHTML = '';
  for (const p of App.lobbyPlayers) {
    const ch = CHARACTERS.find(c => c.id === p.char) || CHARACTERS[0];
    const d = document.createElement('div'); d.className = 'lobby-player';
    d.innerHTML = `<span class="dot" style="background:${ch.color}"></span><b>${p.name || ('P' + p.id)}</b> <span class="muted">${ch.name.split(' ')[0]}${p.host ? ' 👑' : ''}</span>`;
    list.appendChild(d);
  }
  const charWrap = $('#lobbyChars'); charWrap.innerHTML = '';
  for (const ch of Save.unlockedChars()) {
    const card = charCard(ch, false, (el) => { App.myCharNet = ch.id; [...charWrap.children].forEach(x => x.classList.remove('sel')); el.classList.add('sel'); App.net.setChar(ch.id, isHost ? 'Host' : 'Player'); Audio.sfx('select'); });
    if (App.myCharNet === ch.id) card.classList.add('sel');
    charWrap.appendChild(card);
  }
  $('#lobbyStart').style.display = isHost ? '' : 'none';
  $('#lobbyHint').textContent = isHost ? 'Press Start when everyone has joined. Online co-op uses smart auto-draft for level-ups.' : 'Waiting for the host to start…';
}
$('#lobbyStart').onclick = () => { Audio.sfx('select'); buildStageSelect(); App.mode = 'host'; show('stageSelect'); };
$('#lobbyBack').onclick = () => { if (App.net) App.net.close(); endToMenu(); };

// ---------------- Level up ----------------
let levelFocus = 0, levelChoices = null, levelPlayer = null;
function openLevelUp(pl, choices) {
  levelChoices = choices; levelPlayer = pl; levelFocus = 0;
  $('#levelupTitle').textContent = `${pl.char.name.split(' ')[0]} — Level ${pl.level}!`;
  const wrap = $('#levelupCards'); wrap.innerHTML = '';
  choices.forEach((c, i) => {
    const lvlInfo = c.lvl ? `<div class="pips">${pips(c.lvl, c.max)}</div>` : '';
    const card = document.createElement('div');
    card.className = 'lvl-card' + (c.type === 'evolve' ? ' evolve' : '') + (i === 0 ? ' focus' : '');
    card.style.color = c.color;
    card.innerHTML = `<div class="tag">${tagFor(c)}</div><div class="ico">${c.icon}</div><h3 style="color:#fff">${c.title}</h3><p>${c.desc}</p>${lvlInfo}`;
    card.onclick = () => pickLevel(i);
    wrap.appendChild(card);
  });
  $('#levelup').classList.remove('hidden');
}
function tagFor(c) { return ({ evolve: 'Evolution', upweapon: 'Weapon +', newweapon: 'New Weapon', uppassive: 'Item +', newpassive: 'New Item', gold: 'Bonus', heal: 'Bonus' })[c.type] || ''; }
function pips(lvl, max) { let s = ''; for (let i = 1; i <= (max || 8); i++) s += `<span class="pip ${i <= lvl ? 'on' : ''}"></span>`; return s; }
function pickLevel(i) {
  if (!levelChoices) return; Audio.sfx('select');
  const c = levelChoices[i]; const pl = levelPlayer;
  $('#levelup').classList.add('hidden'); levelChoices = null;
  App.game.applyChoice(pl, c);
  buildHudSlots();
}
$('#rerollBtn').onclick = () => { if (!levelChoices) return; pickLevel(Math.floor(Math.random() * levelChoices.length)); };
function moveFocus(d) { if (!levelChoices) return; const cards = $$('#levelupCards .lvl-card'); cards[levelFocus]?.classList.remove('focus'); levelFocus = (levelFocus + d + cards.length) % cards.length; cards[levelFocus]?.classList.add('focus'); }

// ---------------- HUD ----------------
function buildHudSlots() {
  const g = App.game; if (!g) return;
  const pl = g.players[0]; const wrap = $('#hudBottom'); wrap.innerHTML = '';
  for (const slot of pl.weapons) {
    const w = WEAPON_MAP[slot.id]; if (!w) continue;
    const d = document.createElement('div'); d.className = 'wslot' + (w.evolved ? ' evolved' : '');
    d.style.color = w.color; d.innerHTML = `<span style="filter:drop-shadow(0 0 6px ${w.color})">${weaponEmoji(w)}</span><span class="lvl">${w.evolved ? '★' : slot.level}</span>`;
    d.title = w.name; wrap.appendChild(d);
  }
  for (const pid in pl.passives) { const p = PASSIVES.find(x => x.id === pid); if (!p) continue; const d = document.createElement('div'); d.className = 'wslot'; d.innerHTML = `${p.icon}<span class="lvl">${pl.passives[pid]}</span>`; d.title = p.name; wrap.appendChild(d); }
}
const EMO = { whip: '🗡️', bloodywhip: '🗡️', magicwand: '🪄', holywand: '🪄', knife: '🔪', thousandedge: '🔪', axe: '🪓', deathspiral: '🪓', fireball: '🔥', hellfire: '🔥', frostbolt: '❄️', blizzard: '❄️', lightning: '⚡', thunderloop: '⚡', cross: '✝️', heaven: '✝️', bible: '📖', unholy: '📕', garlic: '🧄', souleater: '👻', sunbeam: '☀️', solarflare: '🌟', scythe: '🌙', phantomreaper: '🌙', orbitblade: '⚔️', thousandcuts: '⚔️', laser: '🔆', deathray: '🔆', boomerang: '🪃', cometcall: '☄️', shuriken: '✴️', bladestorm: '✴️', coinshot: '🪙', fortune: '💰', twinshot: '✨', eclipse: '🌑' };
function weaponEmoji(w) { return EMO[w.id] || '✨'; }

function updateHud() {
  const g = App.game || App.guest; if (!g) return;
  const t = g.time || 0;
  $('#hudTimer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const corPct = Math.min(100, (g.corruption || 0) / 100 * 100);
  $('#corruptionFill').style.width = corPct + '%'; $('#corruptionVal').textContent = Math.floor(g.corruption || 0);
  if (App.game) {
    const pl = App.game.players[0];
    $('#hudLevel').textContent = 'Lv ' + pl.level;
    $('#xpBar').style.width = (pl.xp / pl.xpNext * 100) + '%';
    $('#hudKills').textContent = App.game.kills;
    $('#hudGold').textContent = App.game.players.reduce((s, p) => s + p.gold, 0);
    const aff = $('#affinityRow'); const tags = pl.affinity || [];
    if (aff.dataset.n != tags.length) { aff.dataset.n = tags.length; aff.innerHTML = tags.map(a => `<span class="affinity-tag">✦ ${a}</span>`).join(''); }
  } else if (App.guest) {
    const pl = App.guest.players.find(p => p.idx !== undefined) || App.guest.players[0];
    if (pl) { $('#hudLevel').textContent = 'Lv ' + (pl.level || 1); $('#xpBar').style.width = '0%'; }
  }
}

// ---------------- Toasts ----------------
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
  $('#toasts').appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; setTimeout(() => d.remove(), 400); }, 2600);
}

// ---------------- Pause ----------------
function togglePause() {
  if (!App.game) return;
  if (App.game.state === 'choosing' || App.game.state === 'over' || App.game.state === 'win') return;
  App.paused = !App.paused;
  if (App.paused) { renderPauseStats(); $('#pause').classList.remove('hidden'); }
  else $('#pause').classList.add('hidden');
}
$('#pauseBtn').onclick = togglePause;
$('#resumeBtn').onclick = togglePause;
$('#quitBtn').onclick = () => { App.game.endGame(false); };
function renderPauseStats() {
  const g = App.game; const pl = g.players[0];
  $('#pauseStats').innerHTML = stat('Time', fmt(g.time)) + stat('Level', pl.level) + stat('Kills', g.kills) + stat('Gold', g.players.reduce((s, p) => s + p.gold, 0)) + stat('Corruption', Math.floor(g.corruption)) + stat('Rifts', g.riftsCleared);
}
function stat(k, v) { return `<div><span>${k}</span><b>${v}</b></div>`; }
function fmt(t) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }

// ---------------- Game over ----------------
function onGameOver(run, win) {
  Audio.stopMusic();
  // record echo of player path
  if (App.game && App.game.echoRecord) Save.saveEcho(App.game.echoRecord, run.time);
  run.bossesKilledSet = Save.data.bossesKilled;
  const newly = Save.recordRun(run);
  $('#gameoverTitle').textContent = win ? 'Victory!' : (run.metDeath ? 'Claimed by DEATH' : 'You Fell');
  $('#gameoverStats').innerHTML = stat('Survived', fmt(run.time)) + stat('Level', run.level) + stat('Kills', run.kills) + stat('Gold', run.gold) + stat('Bosses', run.bossKills || 0) + stat('Max Corruption', Math.floor(run.maxCorruption || 0)) + stat('Rifts Cleared', run.riftsCleared || 0) + stat('Elements', run.maxElements || 0);
  const na = $('#newAch'); na.innerHTML = '';
  if (newly.length) { na.innerHTML = `<h3 style="color:var(--gold)">🏆 ${newly.length} New Achievement${newly.length > 1 ? 's' : ''}!</h3>`; for (const a of newly.slice(0, 8)) na.insertAdjacentHTML('beforeend', `<div class="ach"><div class="ico">${a.icon}</div><div><h4>${a.name}</h4><p>${a.desc}</p></div></div>`); if (newly.length > 8) na.insertAdjacentHTML('beforeend', `<p class="muted">…and ${newly.length - 8} more</p>`); }
  $('#hud').classList.add('hidden'); showTouchPad(false);
  show('gameover');
}
$('#againBtn').onclick = () => { Audio.sfx('select'); if (App.mode === 'host' || App.mode === 'join') { endToMenu(); } else { startLocalGame(); } };
$('#menuBtn').onclick = () => { Audio.sfx('select'); endToMenu(); };
function endToMenu() {
  if (App.net) { App.net.close(); App.net = null; }
  App.game = null; App.guest = null; App.paused = false; App.mode = 'solo';
  $('#hud').classList.add('hidden'); showTouchPad(false); Audio.startMusic('menu'); show('menu');
}

// ---------------- Achievements screen ----------------
let achFilter = 'all';
$$('#achFilter .chip').forEach(c => c.onclick = () => { $$('#achFilter .chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); achFilter = c.dataset.filter; buildAchievements(); });
function buildAchievements() {
  const pr = Save.achProgress(); $('#achCount').textContent = `${pr.done} / ${pr.total}`;
  const grid = $('#achGrid'); grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const done = Save.hasAch(a.id);
    if (achFilter === 'done' && !done) continue; if (achFilter === 'locked' && done) continue;
    const d = document.createElement('div'); d.className = 'ach' + (done ? '' : ' locked');
    d.innerHTML = `<div class="ico">${done ? a.icon : '🔒'}</div><div><h4>${a.name}</h4><p>${a.desc}</p></div>`;
    grid.appendChild(d);
  }
}

// ---------------- Codex screen ----------------
$$('#codexTabs .chip').forEach(c => c.onclick = () => { $$('#codexTabs .chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); buildCodex(c.dataset.tab); });
function buildCodex(tab) {
  const body = $('#codexBody'); body.innerHTML = '';
  const elColor = { fire: '#ff7a30', ice: '#7fd4ff', lightning: '#fff07a', shadow: '#b06bff', holy: '#ffe066', nature: '#8fe36a', arcane: '#9ad0ff', physical: '#cfd8e3' };
  if (tab === 'weapons') {
    for (const w of WEAPONS) { const d = document.createElement('div'); d.className = 'codex-item'; d.innerHTML = `<h4 style="color:${w.color}">${weaponEmoji(w)} ${w.name}</h4><span class="el" style="color:${elColor[w.element]}">${w.element}${w.evolved ? ' · EVOLVED' : ''}</span><p>${w.desc}${w.evolution ? ` <br><span class="muted">Evolves with ${PASSIVES.find(p => p.id === w.evolution.req)?.name || w.evolution.req}</span>` : ''}</p>`; body.appendChild(d); }
  } else if (tab === 'passives') {
    for (const p of PASSIVES) { const d = document.createElement('div'); d.className = 'codex-item'; d.innerHTML = `<h4>${p.icon} ${p.name}</h4><span class="el">Max Lv ${p.maxLevel}</span><p>${p.desc}</p>`; body.appendChild(d); }
  } else if (tab === 'enemies') {
    const all = [...ENEMIES, ...BOSSES];
    for (const e of all) { const seen = Save.data.bestiary[e.id] || Save.data.bossesKilled[e.id]; const d = document.createElement('div'); d.className = 'codex-item'; const spr = getSprite(e.shape, e.color, 16); const cv = document.createElement('canvas'); cv.width = spr.width; cv.height = spr.height; cv.style.float = 'right'; cv.getContext('2d').drawImage(spr, 0, 0); if (seen) d.appendChild(cv); d.insertAdjacentHTML('beforeend', `<h4>${seen ? e.name : '???'}</h4><span class="el">${e.boss ? 'BOSS' : e.behavior}</span><p>${seen ? `HP ${e.hp} · DMG ${e.dmg}${e.boss ? ` · appears @ ${e.minute}min` : ''}` : 'Not yet encountered.'}</p>`); body.appendChild(d); }
  } else if (tab === 'features') {
    const feats = [
      ['🟣 Corruption', 'Corruption rises over time and with kills. Higher corruption means deadlier enemies but far richer XP and loot. Grab purple Dread Shards from elites to spike it for big rewards.'],
      ['🌀 Time Rifts', 'Periodically a rift tears open nearby. Step in to trigger a 22-second bullet-hell surge — survive it for a guaranteed treasure and corruption.'],
      ['🌈 Elemental Affinity', 'Carrying weapons of different elements forms synergies (Thermal Shock, Black Storm, Lifebloom and more) that passively boost your build.'],
      ['👻 Echo Ghost', 'Your best run is recorded. In future runs a translucent ghost of your past self retraces your path and lends a hand in battle.'],
      ['🤝 Shared Draft Co-op', 'Play 2–4 on one keyboard, each with their own keys — or jump online with a room code. Revive downed allies by standing close.']
    ];
    for (const [t, p] of feats) { const d = document.createElement('div'); d.className = 'codex-item codex-feature'; d.innerHTML = `<h4>${t}</h4><p>${p}</p>`; body.appendChild(d); }
  }
}

// ---------------- Settings ----------------
$('#musicVol').value = Save.data.settings.music; $('#sfxVol').value = Save.data.settings.sfx;
$('#musicVol').oninput = e => { Save.data.settings.music = +e.target.value; Audio.setMusicVol(+e.target.value); Save.save(); };
$('#sfxVol').oninput = e => { Save.data.settings.sfx = +e.target.value; Audio.setSfxVol(+e.target.value); Save.save(); };
$('#minimapToggle').checked = Save.data.settings.minimap !== false;
$('#shakeToggle').checked = Save.data.settings.shake !== false;
$('#minimapToggle').onchange = e => { Save.data.settings.minimap = e.target.checked; window.__settings = Save.data.settings; Save.save(); };
$('#shakeToggle').onchange = e => { Save.data.settings.shake = e.target.checked; window.__settings = Save.data.settings; Save.save(); };
window.__settings = Save.data.settings;
$('#wipeSave').onclick = () => { if (confirm('Erase ALL progress and achievements?')) { localStorage.clear(); location.reload(); } };

// ---------------- Global input (menus + pause) ----------------
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (levelChoices) return; togglePause(); }
  if (levelChoices) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveFocus(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') moveFocus(1);
    else if (e.code === 'Enter' || e.code === 'Space') pickLevel(levelFocus);
    else if (/Digit([1-4])/.test(e.code)) { const n = +e.code.slice(5) - 1; if (n < levelChoices.length) pickLevel(n); }
  }
});

// ---------------- Main loop ----------------
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - App.lastT) / 1000 || 0); App.lastT = ts;
  if (App.game) {
    if (!App.paused) App.game.update(dt);
    renderer.render(App.game);
    updateHud();
    // host networking
    if (App.net && App.net.isHost) {
      App.netAcc += dt;
      if (App.netAcc >= 1 / 15) { App.netAcc = 0; App.net.sendState(serialize(App.game)); }
    }
  } else if (App.guest) {
    App.guest.update(dt);
    renderer.render(App.guest);
    updateHud();
    // guest sends input
    if (App.net) { App.netAcc += dt; if (App.netAcc >= 1 / 30) { App.netAcc = 0; App.net.sendInput(Input.getMove(0), App.inputSeq++); } }
  }
  Input.endFrame();
}
requestAnimationFrame(loop);
