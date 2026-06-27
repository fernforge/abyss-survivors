// Procedural sprite factory. Each shape is drawn once to an offscreen canvas and cached.
// Sprites are drawn in a [size x size] box centered, facing right/up as noted.
const cache = new Map();

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r|0},${g|0},${b|0})`;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Each drawer works in a coordinate space of size S, centered at S/2.
const DRAWERS = {
  bat(c, S, col) {
    const x = S / 2, y = S / 2;
    c.fillStyle = shade(col, -20);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - S * 0.5, y - S * 0.3, x - S * 0.55, y + S * 0.05); c.quadraticCurveTo(x - S * 0.3, y + S * 0.05, x, y + S * 0.12); c.fill();
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + S * 0.5, y - S * 0.3, x + S * 0.55, y + S * 0.05); c.quadraticCurveTo(x + S * 0.3, y + S * 0.05, x, y + S * 0.12); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y + S * 0.05, S * 0.16, S * 0.2, 0, 0, 7); c.fill();
    c.fillStyle = '#ff4a4a'; c.beginPath(); c.arc(x - S * 0.06, y, S * 0.04, 0, 7); c.arc(x + S * 0.06, y, S * 0.04, 0, 7); c.fill();
  },
  slime(c, S, col) {
    const x = S / 2, y = S * 0.56;
    const g = c.createLinearGradient(0, y - S * 0.3, 0, y + S * 0.3); g.addColorStop(0, shade(col, 40)); g.addColorStop(1, shade(col, -30));
    c.fillStyle = g; c.beginPath(); c.moveTo(x - S * 0.34, y + S * 0.28); c.quadraticCurveTo(x - S * 0.42, y - S * 0.34, x, y - S * 0.3); c.quadraticCurveTo(x + S * 0.42, y - S * 0.34, x + S * 0.34, y + S * 0.28); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(x - S * 0.1, y - S * 0.12, S * 0.07, S * 0.1, -0.4, 0, 7); c.fill();
    c.fillStyle = '#1a1a2a'; c.beginPath(); c.arc(x - S * 0.1, y, S * 0.045, 0, 7); c.arc(x + S * 0.1, y, S * 0.045, 0, 7); c.fill();
  },
  rat(c, S, col) {
    const x = S / 2, y = S / 2;
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y, S * 0.3, S * 0.2, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(x + S * 0.26, y - S * 0.04, S * 0.12, 0, 7); c.fill();
    c.strokeStyle = shade(col, -30); c.lineWidth = S * 0.04; c.beginPath(); c.moveTo(x - S * 0.28, y); c.quadraticCurveTo(x - S * 0.5, y + S * 0.18, x - S * 0.42, y + S * 0.3); c.stroke();
    c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(x + S * 0.3, y - S * 0.06, S * 0.03, 0, 7); c.fill();
  },
  skeleton(c, S, col) {
    const x = S / 2;
    c.fillStyle = col; c.beginPath(); c.arc(x, S * 0.36, S * 0.2, 0, 7); c.fill();
    rr(c, x - S * 0.14, S * 0.5, S * 0.28, S * 0.28, S * 0.05); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(x - S * 0.07, S * 0.36, S * 0.05, 0, 7); c.arc(x + S * 0.07, S * 0.36, S * 0.05, 0, 7); c.fill();
    c.strokeStyle = shade(col, -40); c.lineWidth = S * 0.03;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x - S * 0.12, S * 0.56 + i * S * 0.07); c.lineTo(x + S * 0.12, S * 0.56 + i * S * 0.07); c.stroke(); }
  },
  spider(c, S, col) {
    const x = S / 2, y = S / 2;
    c.strokeStyle = shade(col, -10); c.lineWidth = S * 0.04;
    for (let i = 0; i < 4; i++) { const a = 0.5 + i * 0.35; c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a) * S * 0.42, y - Math.sin(a) * S * 0.3 + S * 0.1); c.stroke(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * S * 0.42, y - Math.sin(a) * S * 0.3 + S * 0.1); c.stroke(); }
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y, S * 0.2, S * 0.24, 0, 0, 7); c.fill();
    c.fillStyle = '#ff3a3a'; for (let i = -1; i <= 1; i += 2) { c.beginPath(); c.arc(x + i * S * 0.06, y - S * 0.06, S * 0.03, 0, 7); c.fill(); }
  },
  mushroom(c, S, col) {
    const x = S / 2;
    c.fillStyle = shade(col, 50); rr(c, x - S * 0.1, S * 0.5, S * 0.2, S * 0.28, S * 0.06); c.fill();
    const g = c.createRadialGradient(x, S * 0.4, 2, x, S * 0.4, S * 0.32); g.addColorStop(0, shade(col, 40)); g.addColorStop(1, shade(col, -30));
    c.fillStyle = g; c.beginPath(); c.ellipse(x, S * 0.42, S * 0.32, S * 0.24, 0, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; for (const o of [[-0.15, 0], [0.12, -0.05], [0, 0.06]]) { c.beginPath(); c.arc(x + o[0] * S, S * 0.4 + o[1] * S, S * 0.04, 0, 7); c.fill(); }
  },
  wisp(c, S, col) {
    const x = S / 2, y = S / 2;
    const g = c.createRadialGradient(x, y, 1, x, y, S * 0.4); g.addColorStop(0, '#fff'); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, S * 0.4, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, S * 0.12, 0, 7); c.fill();
  },
  zombie(c, S, col) {
    const x = S / 2;
    c.fillStyle = shade(col, -10); rr(c, x - S * 0.16, S * 0.42, S * 0.32, S * 0.36, S * 0.06); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x, S * 0.34, S * 0.18, 0, 7); c.fill();
    c.fillStyle = '#1a3a1a'; c.fillRect(x - S * 0.1, S * 0.32, S * 0.06, S * 0.04); c.fillRect(x + S * 0.04, S * 0.32, S * 0.06, S * 0.04);
    c.strokeStyle = shade(col, -40); c.lineWidth = S * 0.02; c.beginPath(); c.moveTo(x - S * 0.08, S * 0.42); c.lineTo(x + S * 0.08, S * 0.42); c.stroke();
  },
  wolf(c, S, col) {
    const x = S / 2, y = S / 2;
    c.fillStyle = col; c.beginPath(); c.ellipse(x - S * 0.05, y, S * 0.32, S * 0.2, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(x + S * 0.18, y - S * 0.18); c.lineTo(x + S * 0.42, y - S * 0.05); c.lineTo(x + S * 0.18, y + S * 0.1); c.fill();
    c.fillStyle = shade(col, 30); c.beginPath(); c.moveTo(x - S * 0.2, y - S * 0.16); c.lineTo(x - S * 0.1, y - S * 0.34); c.lineTo(x, y - S * 0.16); c.fill();
    c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(x + S * 0.28, y - S * 0.05, S * 0.035, 0, 7); c.fill();
  },
  archer(c, S, col) {
    const x = S / 2;
    c.fillStyle = shade(col, -10); rr(c, x - S * 0.13, S * 0.46, S * 0.26, S * 0.3, S * 0.05); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x, S * 0.36, S * 0.16, 0, 7); c.fill();
    c.strokeStyle = '#8a5a2a'; c.lineWidth = S * 0.04; c.beginPath(); c.arc(x + S * 0.2, S * 0.5, S * 0.22, -1, 1); c.stroke();
    c.strokeStyle = '#eee'; c.lineWidth = S * 0.015; c.beginPath(); c.moveTo(x + S * 0.32, S * 0.32); c.lineTo(x + S * 0.32, S * 0.68); c.stroke();
  },
  cultist(c, S, col) {
    const x = S / 2;
    const g = c.createLinearGradient(0, S * 0.3, 0, S * 0.8); g.addColorStop(0, shade(col, 20)); g.addColorStop(1, shade(col, -40));
    c.fillStyle = g; c.beginPath(); c.moveTo(x, S * 0.22); c.lineTo(x + S * 0.26, S * 0.78); c.lineTo(x - S * 0.26, S * 0.78); c.closePath(); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(x, S * 0.4, S * 0.1, 0, 7); c.fill();
    c.fillStyle = '#ff3aff'; c.beginPath(); c.arc(x - S * 0.04, S * 0.4, S * 0.02, 0, 7); c.arc(x + S * 0.04, S * 0.4, S * 0.02, 0, 7); c.fill();
  },
  ghoul(c, S, col) {
    const x = S / 2, y = S / 2;
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y, S * 0.28, S * 0.3, 0, 0, 7); c.fill();
    c.fillStyle = shade(col, 40); c.beginPath(); c.arc(x - S * 0.1, y - S * 0.06, S * 0.05, 0, 7); c.arc(x + S * 0.1, y - S * 0.06, S * 0.05, 0, 7); c.fill();
    c.fillStyle = '#5a0000'; c.beginPath(); c.arc(x, y + S * 0.12, S * 0.08, 0, Math.PI); c.fill();
  },
  imp(c, S, col) {
    const x = S / 2, y = S / 2;
    c.fillStyle = col; c.beginPath(); c.arc(x, y, S * 0.22, 0, 7); c.fill();
    c.fillStyle = shade(col, -20); c.beginPath(); c.moveTo(x - S * 0.14, y - S * 0.18); c.lineTo(x - S * 0.24, y - S * 0.34); c.lineTo(x - S * 0.06, y - S * 0.2); c.fill();
    c.beginPath(); c.moveTo(x + S * 0.14, y - S * 0.18); c.lineTo(x + S * 0.24, y - S * 0.34); c.lineTo(x + S * 0.06, y - S * 0.2); c.fill();
    c.fillStyle = '#ffec3a'; c.beginPath(); c.arc(x - S * 0.07, y - S * 0.02, S * 0.04, 0, 7); c.arc(x + S * 0.07, y - S * 0.02, S * 0.04, 0, 7); c.fill();
  },
  ghost(c, S, col) {
    const x = S / 2, y = S * 0.45;
    c.globalAlpha = 0.85;
    c.fillStyle = col; c.beginPath(); c.arc(x, y, S * 0.26, Math.PI, 0); c.lineTo(x + S * 0.26, y + S * 0.24);
    for (let i = 0; i < 4; i++) { const wx = x + S * 0.26 - i * S * 0.13; c.lineTo(wx - S * 0.065, y + S * 0.14); c.lineTo(wx - S * 0.13, y + S * 0.24); }
    c.closePath(); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#1a1a3a'; c.beginPath(); c.arc(x - S * 0.09, y - S * 0.02, S * 0.05, 0, 7); c.arc(x + S * 0.09, y - S * 0.02, S * 0.05, 0, 7); c.fill();
  },
  golem(c, S, col) {
    const x = S / 2;
    const g = c.createLinearGradient(0, S * 0.2, 0, S * 0.8); g.addColorStop(0, shade(col, 30)); g.addColorStop(1, shade(col, -30));
    c.fillStyle = g; rr(c, x - S * 0.3, S * 0.28, S * 0.6, S * 0.52, S * 0.08); c.fill();
    c.fillStyle = shade(col, -40); for (const o of [[-0.15, 0.1], [0.12, 0.2], [-0.05, 0.35], [0.18, 0.4]]) c.fillRect(x + o[0] * S, S * 0.28 + o[1] * S, S * 0.1, S * 0.08);
    c.fillStyle = '#ff7a2a'; c.fillRect(x - S * 0.14, S * 0.36, S * 0.08, S * 0.05); c.fillRect(x + S * 0.06, S * 0.36, S * 0.08, S * 0.05);
  },
  knight(c, S, col) {
    const x = S / 2;
    c.fillStyle = col; rr(c, x - S * 0.18, S * 0.4, S * 0.36, S * 0.38, S * 0.05); c.fill();
    c.fillStyle = shade(col, 20); rr(c, x - S * 0.14, S * 0.26, S * 0.28, S * 0.2, S * 0.05); c.fill();
    c.fillStyle = '#ff3a3a'; c.fillRect(x - S * 0.08, S * 0.32, S * 0.16, S * 0.03);
    c.strokeStyle = shade(col, 50); c.lineWidth = S * 0.03; c.beginPath(); c.moveTo(x + S * 0.22, S * 0.2); c.lineTo(x + S * 0.22, S * 0.7); c.stroke();
  },
  mage(c, S, col) {
    const x = S / 2;
    c.fillStyle = shade(col, -20); c.beginPath(); c.moveTo(x, S * 0.2); c.lineTo(x + S * 0.24, S * 0.76); c.lineTo(x - S * 0.24, S * 0.76); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(x, S * 0.16); c.lineTo(x + S * 0.13, S * 0.4); c.lineTo(x - S * 0.13, S * 0.4); c.closePath(); c.fill();
    const g = c.createRadialGradient(x + S * 0.2, S * 0.34, 1, x + S * 0.2, S * 0.34, S * 0.12); g.addColorStop(0, '#fff'); g.addColorStop(1, col);
    c.fillStyle = g; c.beginPath(); c.arc(x + S * 0.2, S * 0.34, S * 0.08, 0, 7); c.fill();
  },
  demon(c, S, col) {
    const x = S / 2, y = S * 0.52;
    const g = c.createRadialGradient(x, y, 2, x, y, S * 0.34); g.addColorStop(0, shade(col, 40)); g.addColorStop(1, shade(col, -40));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, S * 0.3, 0, 7); c.fill();
    c.fillStyle = shade(col, -30); c.beginPath(); c.moveTo(x - S * 0.2, y - S * 0.24); c.lineTo(x - S * 0.34, y - S * 0.46); c.lineTo(x - S * 0.08, y - S * 0.28); c.fill();
    c.beginPath(); c.moveTo(x + S * 0.2, y - S * 0.24); c.lineTo(x + S * 0.34, y - S * 0.46); c.lineTo(x + S * 0.08, y - S * 0.28); c.fill();
    c.fillStyle = '#fff14a'; c.beginPath(); c.moveTo(x - S * 0.14, y - S * 0.05); c.lineTo(x - S * 0.04, y - S * 0.02); c.lineTo(x - S * 0.14, y + S * 0.02); c.fill();
    c.beginPath(); c.moveTo(x + S * 0.14, y - S * 0.05); c.lineTo(x + S * 0.04, y - S * 0.02); c.lineTo(x + S * 0.14, y + S * 0.02); c.fill();
    c.strokeStyle = '#2a0000'; c.lineWidth = S * 0.025; c.beginPath(); c.arc(x, y + S * 0.16, S * 0.1, 0.2, Math.PI - 0.2); c.stroke();
  },
  crystal(c, S, col) {
    const x = S / 2, y = S / 2;
    const g = c.createLinearGradient(x - S * 0.2, y - S * 0.3, x + S * 0.2, y + S * 0.3); g.addColorStop(0, '#fff'); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -40));
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y - S * 0.34); c.lineTo(x + S * 0.22, y - S * 0.05); c.lineTo(x + S * 0.12, y + S * 0.32); c.lineTo(x - S * 0.12, y + S * 0.32); c.lineTo(x - S * 0.22, y - S * 0.05); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = S * 0.015; c.beginPath(); c.moveTo(x, y - S * 0.34); c.lineTo(x, y + S * 0.32); c.stroke();
  },
  // player drawer (facing handled by caller via flip)
  player(c, S, col, accent) {
    const x = S / 2;
    // cloak/body
    const g = c.createLinearGradient(0, S * 0.35, 0, S * 0.82); g.addColorStop(0, shade(col, 30)); g.addColorStop(1, shade(col, -30));
    c.fillStyle = g; rr(c, x - S * 0.18, S * 0.42, S * 0.36, S * 0.38, S * 0.08); c.fill();
    // head
    c.fillStyle = accent || '#ffe0c0'; c.beginPath(); c.arc(x, S * 0.34, S * 0.16, 0, 7); c.fill();
    // hair/hood
    c.fillStyle = col; c.beginPath(); c.arc(x, S * 0.3, S * 0.17, Math.PI, 0); c.fill();
    // eyes
    c.fillStyle = '#222'; c.beginPath(); c.arc(x - S * 0.06, S * 0.34, S * 0.025, 0, 7); c.arc(x + S * 0.06, S * 0.34, S * 0.025, 0, 7); c.fill();
    // outline
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = S * 0.02; rr(c, x - S * 0.18, S * 0.42, S * 0.36, S * 0.38, S * 0.08); c.stroke();
  }
};

export function getSprite(shape, color, size, accent) {
  const S = Math.max(8, Math.round(size * 2.4));
  const key = shape + '|' + color + '|' + S + '|' + (accent || '');
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  // soft drop shadow baked at bottom
  c.save();
  const drawer = DRAWERS[shape] || DRAWERS.slime;
  // outline pass: draw slightly bigger dark silhouette for readability
  c.save(); c.translate(0, 0);
  drawer.call(DRAWERS, c, S, color, accent);
  c.restore();
  c.restore();
  cache.set(key, cv);
  return cv;
}

export function clearSpriteCache() { cache.clear(); }
