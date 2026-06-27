// Infinite chunked terrain. Generates a large atlas of ground-tile variants per biome
// (hundreds of distinct tiles across all stages) plus decoration props.
const TILE = 64;
const VARIANTS = 240; // distinct ground tile types per biome (×8 orient/flip = ~1900 visual permutations)

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Rounded-rect path helper (canvas roundRect isn't universal; this is deterministic).
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}

export class World {
  constructor(stage) {
    this.stage = stage;
    this.tiles = [];
    this.buildTiles();
    this.decorCache = new Map();
  }
  buildTiles() {
    const s = this.stage;
    // 8 procedural style families; each variant picks one + hashed parameters,
    // giving hundreds of visually distinct tile TYPES per biome.
    const FAMILIES = ['plain', 'speckle', 'cracked', 'mossy', 'cobble', 'brick', 'organic', 'veined'];
    for (let v = 0; v < VARIANTS; v++) {
      const cv = document.createElement('canvas'); cv.width = TILE; cv.height = TILE;
      const c = cv.getContext('2d');
      const rng = (i) => hash(v * 131 + i * 7 + 17, v * 977 + i * 13 + 31);
      const base = s.ground[Math.floor(rng(0) * s.ground.length)];
      const tint = Math.floor((rng(50) - 0.5) * 14);
      const fam = FAMILIES[Math.floor(rng(1) * FAMILIES.length)];
      // base gradient
      const ang = rng(2) * Math.PI * 2;
      const g = c.createLinearGradient(0, 0, Math.cos(ang) * TILE, Math.sin(ang) * TILE);
      g.addColorStop(0, shade(base, 7 + tint)); g.addColorStop(1, shade(base, -7 + tint));
      c.fillStyle = g; c.fillRect(0, 0, TILE, TILE);
      this.paintFamily(c, fam, base, s, rng, tint);
      // optional accent fleck
      if (rng(55) > 0.86) { c.fillStyle = s.accent + '44'; c.beginPath(); c.arc(rng(3) * TILE, rng(4) * TILE, 2 + rng(6) * 4, 0, 7); c.fill(); }
      // grout seam (sometimes)
      if (fam !== 'organic' && fam !== 'mossy' && rng(70) > 0.35) { c.strokeStyle = s.grout; c.lineWidth = 1 + rng(71) * 1.5; c.strokeRect(1, 1, TILE - 2, TILE - 2); }
      this.tiles.push(cv);
    }
  }
  paintFamily(c, fam, base, s, rng, tint) {
    const T = TILE;
    if (fam === 'plain' || fam === 'speckle') {
      const n = fam === 'speckle' ? 28 + Math.floor(rng(10) * 30) : 8 + Math.floor(rng(10) * 8);
      for (let i = 0; i < n; i++) { const a = rng(i * 3) * 0.13; c.fillStyle = rng(i) > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a + 0.05})`; c.beginPath(); c.arc(rng(i * 2) * T, rng(i * 2 + 1) * T, 0.8 + rng(i * 5) * 2.6, 0, 7); c.fill(); }
    } else if (fam === 'cracked') {
      c.strokeStyle = shade(base, -22); c.lineWidth = 1 + rng(9) * 1.4;
      const branches = 2 + Math.floor(rng(8) * 3);
      for (let b = 0; b < branches; b++) { let px = rng(b * 7) * T, py = rng(b * 7 + 1) * T; c.beginPath(); c.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (rng(b * 11 + k) - 0.5) * 26; py += (rng(b * 13 + k) - 0.5) * 26; c.lineTo(px, py); } c.stroke(); }
    } else if (fam === 'mossy') {
      for (let i = 0; i < 22; i++) { const x = rng(i * 2) * T, y = rng(i * 2 + 1) * T; const col = i % 3 === 0 ? s.accent : shade(base, 20); c.fillStyle = col + '55'; c.beginPath(); c.ellipse(x, y, 3 + rng(i) * 6, 2 + rng(i * 3) * 4, rng(i * 5) * 6, 0, 7); c.fill(); }
    } else if (fam === 'cobble') {
      const cells = 3 + Math.floor(rng(6) * 2);
      const sz = T / cells;
      for (let yy = 0; yy < cells; yy++) for (let xx = 0; xx < cells; xx++) {
        const ox = (rng(xx * 9 + yy) - 0.5) * 4, oy = (rng(xx + yy * 9) - 0.5) * 4;
        c.fillStyle = shade(base, Math.floor((rng(xx * 3 + yy * 7) - 0.5) * 26)); c.strokeStyle = s.grout; c.lineWidth = 1.5;
        const rad = sz * 0.34;
        rr(c, xx * sz + 3 + ox, yy * sz + 3 + oy, sz - 6, sz - 6, rad); c.fill(); c.stroke();
      }
    } else if (fam === 'brick') {
      const rows = 4; const rh = T / rows; const off = rng(5) > 0.5;
      for (let r = 0; r < rows; r++) { const shift = (off && r % 2) ? T / 6 : 0; for (let x = -1; x < 4; x++) { c.fillStyle = shade(base, Math.floor((rng(r * 5 + x) - 0.5) * 20)); c.strokeStyle = s.grout; c.lineWidth = 1.4; const bw = T / 3; rr(c, x * bw + shift + 1.5, r * rh + 1.5, bw - 3, rh - 3, 2); c.fill(); c.stroke(); } }
    } else if (fam === 'organic') {
      for (let i = 0; i < 6; i++) { c.fillStyle = shade(base, Math.floor((rng(i * 7) - 0.5) * 22)) + 'aa'; c.beginPath(); const cx = rng(i * 3) * T, cy = rng(i * 5) * T, rad = 8 + rng(i) * 16; c.moveTo(cx + rad, cy); for (let a = 0; a <= 8; a++) { const ang = a / 8 * Math.PI * 2; const rr2 = rad * (0.7 + rng(i * 11 + a) * 0.5); c.lineTo(cx + Math.cos(ang) * rr2, cy + Math.sin(ang) * rr2); } c.fill(); }
    } else if (fam === 'veined') {
      c.strokeStyle = s.accent + '66'; c.lineWidth = 1 + rng(4) * 1.5; c.shadowColor = s.accent; c.shadowBlur = 4;
      for (let b = 0; b < 2; b++) { let px = 0, py = rng(b * 7) * T; c.beginPath(); c.moveTo(px, py); while (px < T) { px += 8 + rng(px + b) * 8; py += (rng(px * 2 + b) - 0.5) * 18; c.lineTo(px, py); } c.stroke(); }
      c.shadowBlur = 0;
    }
  }
  tileAt(cx, cy) { return this.tiles[Math.floor(hash(cx, cy) * VARIANTS) % VARIANTS]; }

  draw(ctx, cam, w, h) {
    const x0 = Math.floor(cam.x / TILE) - 1, y0 = Math.floor(cam.y / TILE) - 1;
    const x1 = Math.ceil((cam.x + w) / TILE) + 1, y1 = Math.ceil((cam.y + h) / TILE) + 1;
    for (let cy = y0; cy < y1; cy++) {
      for (let cx = x0; cx < x1; cx++) {
        const t = this.tileAt(cx, cy);
        // per-cell rotation/flip multiplies visual variety ~8x without more memory
        const orient = Math.floor(hash(cx * 5 + 3, cy * 5 + 9) * 8);
        const dx = cx * TILE - cam.x, dy = cy * TILE - cam.y;
        if (orient === 0) { ctx.drawImage(t, dx, dy); }
        else {
          ctx.save(); ctx.translate(dx + TILE / 2, dy + TILE / 2);
          ctx.rotate((orient & 3) * Math.PI / 2);
          if (orient & 4) ctx.scale(-1, 1);
          ctx.drawImage(t, -TILE / 2, -TILE / 2); ctx.restore();
        }
      }
    }
    // decorations: deterministic per cell
    const dens = this.stage.decorDensity;
    for (let cy = y0; cy < y1; cy++) {
      for (let cx = x0; cx < x1; cx++) {
        const r = hash(cx * 7 + 13, cy * 13 + 7);
        if (r < dens) {
          const kind = this.stage.decor[Math.floor(hash(cx * 3, cy * 5) * this.stage.decor.length)];
          const px = cx * TILE + hash(cx, cy * 2) * TILE - cam.x;
          const py = cy * TILE + hash(cx * 2, cy) * TILE - cam.y;
          this.drawDecor(ctx, kind, px, py);
        }
      }
    }
  }
  drawDecor(ctx, kind, x, y) {
    let sp = this.decorCache.get(kind);
    if (!sp) { sp = this.makeDecor(kind); this.decorCache.set(kind, sp); }
    ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2);
  }
  makeDecor(kind) {
    const S = 40; const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d'); const acc = this.stage.accent;
    c.translate(S / 2, S / 2);
    const blob = (col, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill(); };
    switch (kind) {
      case 'tree': c.fillStyle = '#3a2a18'; c.fillRect(-3, 0, 6, 14); blob('#1d3a22', 12, 12); blob('#2a5030', 8, 8); break;
      case 'pine': c.fillStyle = '#2a2a18'; c.fillRect(-2, 6, 4, 8); c.fillStyle = '#1d3a3a'; c.beginPath(); c.moveTo(0, -14); c.lineTo(10, 8); c.lineTo(-10, 8); c.fill(); break;
      case 'bush': blob('#1d3a22', 11, 8); blob('#2a5030', 6, 5); break;
      case 'flower': c.fillStyle = acc; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.cos(i * 1.25) * 5, Math.sin(i * 1.25) * 5, 3, 0, 7); c.fill(); } c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, 0, 2.5, 0, 7); c.fill(); break;
      case 'mushroom': c.fillStyle = '#e8e0d0'; c.fillRect(-2, 0, 4, 8); c.fillStyle = '#c0506a'; c.beginPath(); c.ellipse(0, 0, 8, 5, 0, Math.PI, 0); c.fill(); break;
      case 'log': c.fillStyle = '#3a2a18'; c.beginPath(); c.ellipse(0, 0, 12, 5, 0.2, 0, 7); c.fill(); break;
      case 'bones': case 'bone': c.strokeStyle = '#d8d0c0'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -6); c.lineTo(8, 6); c.stroke(); c.beginPath(); c.moveTo(-8, 6); c.lineTo(8, -6); c.stroke(); break;
      case 'skull': c.fillStyle = '#d8d0c0'; c.beginPath(); c.arc(0, -2, 7, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(-3, -2, 2, 0, 7); c.arc(3, -2, 2, 0, 7); c.fill(); break;
      case 'pillar': c.fillStyle = '#3a3450'; c.fillRect(-7, -16, 14, 32); c.fillStyle = '#2a2440'; c.fillRect(-9, 12, 18, 6); c.fillRect(-9, -18, 18, 6); break;
      case 'candle': c.fillStyle = '#d8d0c0'; c.fillRect(-2, -2, 4, 10); c.fillStyle = '#ffb84a'; c.beginPath(); c.ellipse(0, -6, 2.5, 5, 0, 0, 7); c.fill(); c.shadowColor = '#ffb84a'; c.shadowBlur = 12; c.fill(); break;
      case 'crack': c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, -8); c.lineTo(-2, 0); c.lineTo(4, -4); c.lineTo(10, 8); c.stroke(); break;
      case 'rune': c.strokeStyle = acc; c.lineWidth = 2; c.shadowColor = acc; c.shadowBlur = 10; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.moveTo(0, -9); c.lineTo(0, 9); c.moveTo(-9, 0); c.lineTo(9, 0); c.stroke(); break;
      case 'lava': c.fillStyle = '#ff5a1a'; c.shadowColor = '#ff7a2a'; c.shadowBlur = 14; blob('#ff7a2a', 11, 7); c.fillStyle = '#ffd23a'; blob('#ffd23a', 5, 3); break;
      case 'ember': c.fillStyle = '#ff7a2a'; c.shadowColor = '#ff5a1a'; c.shadowBlur = 10; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill(); break;
      case 'rock': case 'snowrock': blob(kind === 'snowrock' ? '#5a6a7a' : '#5a5044', 11, 8); blob(kind === 'snowrock' ? '#7a8a9a' : '#6a6054', 6, 4); break;
      case 'ice': c.fillStyle = 'rgba(180,220,255,0.5)'; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 2); c.lineTo(0, 10); c.lineTo(-7, 2); c.fill(); break;
      case 'crystal': c.fillStyle = acc; c.shadowColor = acc; c.shadowBlur = 12; c.beginPath(); c.moveTo(0, -12); c.lineTo(6, 4); c.lineTo(0, 10); c.lineTo(-6, 4); c.fill(); break;
      case 'eye': c.fillStyle = '#fff'; blob('#fff', 9, 6); c.fillStyle = '#9a2aff'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, 2, 0, 7); c.fill(); break;
      case 'rift': c.strokeStyle = '#9a2aff'; c.lineWidth = 3; c.shadowColor = '#9a2aff'; c.shadowBlur = 16; c.beginPath(); c.ellipse(0, 0, 6, 13, 0.3, 0, 7); c.stroke(); break;
      default: blob(acc + '66', 7, 5);
    }
    return cv;
  }
}
export const TILE_SIZE = TILE;
