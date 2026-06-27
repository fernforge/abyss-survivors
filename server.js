// Abyss Survivors server: serves static client + room-based WebSocket relay
// for host-authoritative networked co-op.
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map(); // code -> { host, clients:Map<id,ws>, stage, seed, started }
let nextId = 1;

function code() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj, exceptId) {
  for (const [id, ws] of room.clients) if (id !== exceptId) send(ws, obj);
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.roomCode = null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'create': {
        let c = code(); while (rooms.has(c)) c = code();
        const room = { code: c, host: ws.id, clients: new Map([[ws.id, ws]]), stage: m.stage, seed: m.seed || (Date.now() & 0xffffffff), started: false, meta: new Map() };
        room.meta.set(ws.id, { name: m.name || 'Host', char: m.char || 'aria' });
        rooms.set(c, room); ws.roomCode = c;
        send(ws, { t: 'created', code: c, id: ws.id, seed: room.seed });
        break;
      }
      case 'join': {
        const room = rooms.get((m.code || '').toUpperCase());
        if (!room) { send(ws, { t: 'error', msg: 'Room not found' }); return; }
        if (room.started) { send(ws, { t: 'error', msg: 'Game already started' }); return; }
        if (room.clients.size >= 4) { send(ws, { t: 'error', msg: 'Room full' }); return; }
        room.clients.set(ws.id, ws); ws.roomCode = room.code;
        room.meta.set(ws.id, { name: m.name || ('P' + ws.id), char: m.char || 'aria' });
        const players = [...room.meta.entries()].map(([id, meta]) => ({ id, ...meta, host: id === room.host }));
        send(ws, { t: 'joined', code: room.code, id: ws.id, seed: room.seed, stage: room.stage, hostId: room.host, players });
        broadcast(room, { t: 'lobby', players }, null);
        break;
      }
      case 'setchar': {
        const room = rooms.get(ws.roomCode); if (!room) return;
        const meta = room.meta.get(ws.id); if (meta) { meta.char = m.char; meta.name = m.name || meta.name; }
        const players = [...room.meta.entries()].map(([id, mt]) => ({ id, ...mt, host: id === room.host }));
        broadcast(room, { t: 'lobby', players }, null);
        send(ws, { t: 'lobby', players });
        break;
      }
      case 'start': {
        const room = rooms.get(ws.roomCode); if (!room || room.host !== ws.id) return;
        room.started = true; room.stage = m.stage || room.stage;
        const players = [...room.meta.entries()].map(([id, mt]) => ({ id, ...mt, host: id === room.host }));
        broadcast(room, { t: 'start', stage: room.stage, seed: room.seed, players }, null);
        send(ws, { t: 'start', stage: room.stage, seed: room.seed, players });
        break;
      }
      case 'state': { // host -> guests
        const room = rooms.get(ws.roomCode); if (!room || room.host !== ws.id) return;
        broadcast(room, { t: 'state', s: m.s }, ws.id);
        break;
      }
      case 'input': { // guest -> host
        const room = rooms.get(ws.roomCode); if (!room) return;
        send(room.clients.get(room.host), { t: 'input', id: ws.id, mv: m.mv, seq: m.seq });
        break;
      }
      case 'event': { // misc relay (toast/levelup choice ack etc.)
        const room = rooms.get(ws.roomCode); if (!room) return;
        broadcast(room, { t: 'event', id: ws.id, e: m.e }, ws.id);
        break;
      }
    }
  });
  ws.on('close', () => {
    const room = rooms.get(ws.roomCode); if (!room) return;
    room.clients.delete(ws.id); room.meta.delete(ws.id);
    if (ws.id === room.host || room.clients.size === 0) {
      broadcast(room, { t: 'hostleft' }, null);
      rooms.delete(room.code);
    } else {
      const players = [...room.meta.entries()].map(([id, mt]) => ({ id, ...mt, host: id === room.host }));
      broadcast(room, { t: 'lobby', players, left: ws.id }, null);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Abyss Survivors running on http://localhost:${PORT}`));
