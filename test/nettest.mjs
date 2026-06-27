// Networked co-op smoke test: drives the real ws relay (host + 2 guests) through
// create → join → setchar → start → state(host→guests) → input(guest→host) → disconnect.
import WebSocket from 'ws';

const URL = 'ws://localhost:3000';
let failures = 0;
const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(URL);
  ws.inbox = [];
  ws.on('message', d => { try { ws.inbox.push(JSON.parse(d)); } catch {} });
  ws.send2 = o => ws.send(JSON.stringify(o));
  return new Promise((res, rej) => { ws.on('open', () => res(ws)); ws.on('error', rej); });
}
const last = (ws, t) => [...ws.inbox].reverse().find(m => m.t === t);

console.log('Connecting host + 2 guests…');
const host = await client();
const g1 = await client();
const g2 = await client();

// host creates room
host.send2({ t: 'create', stage: 'crypt', char: 'aria', name: 'Host' });
await wait(150);
const created = last(host, 'created');
check(!!created && created.code && created.code.length === 4, 'host received room code: ' + (created?.code));
const code = created.code, seed = created.seed;

// guests join
g1.send2({ t: 'join', code, char: 'kael', name: 'Guest1' });
g2.send2({ t: 'join', code: code.toLowerCase(), char: 'vesna', name: 'Guest2' }); // lowercase -> server uppercases
await wait(200);
const j1 = last(g1, 'joined'), j2 = last(g2, 'joined');
check(!!j1 && j1.seed === seed, 'guest1 joined with same seed');
check(!!j2, 'guest2 joined (case-insensitive code)');
const hostLobby = last(host, 'lobby');
check(!!hostLobby && hostLobby.players.length === 3, 'host sees 3 players in lobby (got ' + hostLobby?.players.length + ')');

// guest changes character
g1.send2({ t: 'setchar', char: 'doruk', name: 'Guest1' });
await wait(150);
const lob = last(host, 'lobby');
const g1meta = lob?.players.find(p => p.id === j1.id);
check(g1meta && g1meta.char === 'doruk', 'guest1 char change propagated to host');

// non-host tries to start (should be ignored)
g1.send2({ t: 'start', stage: 'crypt' });
await wait(120);
check(!last(g2, 'start'), 'non-host start ignored');

// host starts
host.send2({ t: 'start', stage: 'woods' });
await wait(150);
const s1 = last(g1, 'start'), s2 = last(g2, 'start'), sh = last(host, 'start');
check(!!s1 && !!s2 && !!sh, 'all three got start');
check(s1 && s1.stage === 'woods' && s1.seed === seed && s1.players.length === 3, 'start payload correct');

// host streams a state snapshot -> guests receive, host does not echo
const snap = { time: 1.5, players: [{ idx: 0, x: 10, y: 20 }], enemies: [] };
host.send2({ t: 'state', s: snap });
await wait(120);
check(!!last(g1, 'state') && last(g1, 'state').s.time === 1.5, 'guest1 received state snapshot');
check(!!last(g2, 'state'), 'guest2 received state snapshot');
const hostStateEcho = host.inbox.filter(m => m.t === 'state').length;
check(hostStateEcho === 0, 'host did not receive its own state echo');

// guest sends input -> only host receives
g1.send2({ t: 'input', mv: { x: 1, y: 0 }, seq: 1 });
await wait(120);
const hin = last(host, 'input');
check(!!hin && hin.id === j1.id && hin.mv.x === 1, 'host received guest1 input with id');
check(!last(g2, 'input'), 'guest2 did not receive guest1 input');

// guest2 disconnects -> host gets lobby update with left
g2.close();
await wait(200);
const lobAfter = last(host, 'lobby');
check(lobAfter && lobAfter.left === j2.id && lobAfter.players.length === 2, 'host notified of guest2 leaving');

// host disconnects -> remaining guest gets hostleft
host.close();
await wait(200);
check(!!last(g1, 'hostleft'), 'guest1 notified host left');

g1.close();
await wait(100);
console.log(`\n=== NET DONE: ${failures} failure(s) ===`);
process.exit(failures ? 1 : 0);
