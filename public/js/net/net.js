// WebSocket client wrapper for networked co-op.
export class Net {
  constructor() {
    this.ws = null; this.id = null; this.code = null; this.isHost = false;
    this.seed = null; this.handlers = {}; this.connected = false;
    this.inputs = new Map(); // guestId -> latest {mv,seq}
  }
  on(t, fn) { this.handlers[t] = fn; }
  emit(t, ...a) { if (this.handlers[t]) this.handlers[t](...a); }
  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(`${proto}://${location.host}`);
      this.ws.onopen = () => { this.connected = true; resolve(); };
      this.ws.onerror = (e) => { reject(e); };
      this.ws.onclose = () => { this.connected = false; this.emit('close'); };
      this.ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        switch (m.t) {
          case 'created': this.id = m.id; this.code = m.code; this.isHost = true; this.seed = m.seed; this.emit('created', m); break;
          case 'joined': this.id = m.id; this.code = m.code; this.isHost = false; this.seed = m.seed; this.emit('joined', m); break;
          case 'lobby': this.emit('lobby', m); break;
          case 'start': this.seed = m.seed; this.emit('start', m); break;
          case 'state': this.emit('state', m.s); break;
          case 'input': this.inputs.set(m.id, m); this.emit('input', m); break;
          case 'event': this.emit('peerevent', m); break;
          case 'hostleft': this.emit('hostleft'); break;
          case 'error': this.emit('neterror', m.msg); break;
        }
      };
    });
  }
  create(stage, name, char, seed) { this.send({ t: 'create', stage, name, char, seed }); }
  join(code, name, char) { this.send({ t: 'join', code, name, char }); }
  setChar(char, name) { this.send({ t: 'setchar', char, name }); }
  start(stage) { this.send({ t: 'start', stage }); }
  sendState(s) { this.send({ t: 'state', s }); }
  sendInput(mv, seq) { this.send({ t: 'input', mv, seq }); }
  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  close() { if (this.ws) this.ws.close(); }
}
