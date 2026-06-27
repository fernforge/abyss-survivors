// Input: multi-player local keymaps + gamepad. Movement-only controls.
export const KEYMAPS = [
  { name: 'Arrows / WASD', up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] },
  { name: 'IJKL', up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'] },
  { name: 'Numpad', up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'] },
  { name: 'TFGH', up: ['KeyT'], down: ['KeyG'], left: ['KeyF'], right: ['KeyH'] }
];

export const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0));

class InputManager {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.touch = { active: false, x: 0, y: 0 }; // normalized joystick vector for player 0
    window.addEventListener('keydown', e => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      // prevent scroll on arrows/space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    }, { passive: false });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }
  // Wire an on-screen virtual joystick (touch). `pad` is the container element.
  initTouchJoystick(pad) {
    if (!pad) return;
    const stick = pad.querySelector('.stickKnob') || pad;
    const base = pad.querySelector('.stickBase') || pad;
    let originX = 0, originY = 0, id = null;
    const R = 56; // max travel in px
    const setVec = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      const cl = Math.min(len, R);
      const nx = len ? dx / len : 0, ny = len ? dy / len : 0;
      this.touch.active = true; this.touch.x = nx * (cl / R); this.touch.y = ny * (cl / R);
      stick.style.transform = `translate(${nx * cl}px,${ny * cl}px)`;
    };
    const reset = () => { this.touch.active = false; this.touch.x = 0; this.touch.y = 0; id = null; stick.style.transform = 'translate(0,0)'; };
    const start = (t) => { id = t.identifier; const r = base.getBoundingClientRect(); originX = r.left + r.width / 2; originY = r.top + r.height / 2; setVec(t.clientX - originX, t.clientY - originY); };
    pad.addEventListener('touchstart', e => { e.preventDefault(); if (id === null) start(e.changedTouches[0]); }, { passive: false });
    pad.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) setVec(t.clientX - originX, t.clientY - originY); }, { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === id) reset(); };
    pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);
  }
  down(code) { return this.keys.has(code); }
  anyDown(codes) { return codes.some(c => this.keys.has(c)); }
  pressed(code) { return this.justPressed.has(code); }
  endFrame() { this.justPressed.clear(); }

  // Movement vector for a local player index using its keymap + matching gamepad.
  getMove(playerIndex, useKeyboard = true) {
    let x = 0, y = 0;
    if (useKeyboard) {
      const km = KEYMAPS[playerIndex] || KEYMAPS[0];
      if (this.anyDown(km.left)) x -= 1;
      if (this.anyDown(km.right)) x += 1;
      if (this.anyDown(km.up)) y -= 1;
      if (this.anyDown(km.down)) y += 1;
    }
    // virtual touch joystick controls local player 0
    if (playerIndex === 0 && this.touch.active) { x += this.touch.x; y += this.touch.y; }
    const gp = this.getGamepad(playerIndex);
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.2) x += ax;
      if (Math.abs(ay) > 0.2) y += ay;
      if (gp.buttons[14] && gp.buttons[14].pressed) x -= 1;
      if (gp.buttons[15] && gp.buttons[15].pressed) x += 1;
      if (gp.buttons[12] && gp.buttons[12].pressed) y -= 1;
      if (gp.buttons[13] && gp.buttons[13].pressed) y += 1;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len };
  }
  getGamepad(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads[i] || null;
  }
}
export const Input = new InputManager();
