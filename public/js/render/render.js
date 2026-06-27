// Renderer: draws the whole scene each frame with camera + screen shake + lighting.
import { getSprite } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  render(game) {
    const ctx = this.ctx, w = this.w, h = this.h;
    // camera follows centroid
    const c = game.centroid();
    const tx = c.x - w / 2, ty = c.y - h / 2;
    this.cam.x += (tx - this.cam.x) * 0.12; this.cam.y += (ty - this.cam.y) * 0.12;
    let sx = 0, sy = 0;
    const shakeOn = !(window.__settings && window.__settings.shake === false);
    if (shakeOn && game.shake > 0.2) { sx = (Math.random() - 0.5) * game.shake; sy = (Math.random() - 0.5) * game.shake; }
    const cam = { x: this.cam.x + sx, y: this.cam.y + sy };

    ctx.clearRect(0, 0, w, h);
    game.world.draw(ctx, cam, w, h);

    // gems
    for (const g of game.gems) {
      const x = g.x - cam.x, y = g.y - cam.y;
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      const col = g.xp >= 50 ? '#ff5aff' : g.xp >= 10 ? '#7fffe0' : '#5affc0';
      ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = col;
      ctx.save(); ctx.translate(x, y); ctx.rotate(g.t * 2);
      ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; ctx.lineTo(Math.cos(a) * g.r, Math.sin(a) * g.r); } ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // pickups
    for (const pk of game.pickups) {
      const x = pk.x - cam.x, y = pk.y - cam.y;
      if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue;
      this.drawPickup(ctx, pk, x, y, game.time);
    }

    // rifts
    for (const rift of game.rifts) this.drawRift(ctx, rift, cam, game.time);

    // strikes (lightning columns)
    for (const s of game.strikes) {
      const x = s.x - cam.x, y = s.y - cam.y; const a = s.life / s.maxLife;
      ctx.globalAlpha = a; ctx.strokeStyle = s.color; ctx.lineWidth = 6; ctx.shadowColor = s.color; ctx.shadowBlur = 16;
      ctx.beginPath(); let px = x; ctx.moveTo(px, y - h); for (let i = 0; i < 8; i++) { px = x + (Math.random() - 0.5) * 16; ctx.lineTo(px, y - h + (h + 40) * i / 8); } ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(x, y, s.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // enemy projectiles
    for (const p of game.eProjectiles) {
      const x = p.x - cam.x, y = p.y - cam.y; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // enemies (sorted by y for depth)
    const ens = game.enemies;
    for (const e of ens) {
      const x = e.x - cam.x, y = e.y - cam.y;
      if (x < -60 || x > w + 60 || y < -60 || y > h + 60) continue;
      this.drawEnemy(ctx, e, x, y);
    }

    // lasers
    for (const l of game.lasers) {
      const x = l.x - cam.x, y = l.y - cam.y; const ex = x + Math.cos(l.ang) * l.len, ey = y + Math.sin(l.ang) * l.len;
      const a = Math.min(1, l.life / l.maxLife + 0.3);
      ctx.globalAlpha = a; ctx.strokeStyle = l.color; ctx.shadowColor = l.color; ctx.shadowBlur = 18;
      ctx.lineWidth = l.width * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = l.width * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // hitboxes (whip slashes)
    for (const hb of game.hitboxes) {
      const x = hb.x - cam.x, y = hb.y - cam.y; const a = hb.life / hb.maxLife;
      ctx.globalAlpha = a * 0.8; const grad = ctx.createLinearGradient(x - hb.w / 2, y, x + hb.w / 2, y);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, hb.color); grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.shadowColor = hb.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.ellipse(x, y, hb.w / 2, hb.h / 2, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // player projectiles
    for (const p of game.projectiles) {
      const x = p.x - cam.x, y = p.y - cam.y;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
      ctx.save(); ctx.translate(x, y - (p.lobH || 0)); ctx.rotate(p.rot || 0);
      ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fillStyle = p.color;
      if (p.mode === 'boomerang' || p.w && p.w.pattern === 'boomerang') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.r * 0.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-p.r, -p.r); ctx.lineTo(p.r, 0); ctx.lineTo(-p.r, p.r); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-p.r * 0.3, -p.r * 0.3, p.r * 0.4, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // orbiters (drawn from slot positions)
    for (const pl of game.players) {
      if (!pl.alive || pl.downed) continue;
      for (const slot of pl.weapons) {
        if (slot._ox) for (const o of slot._ox) { if (!o) continue; const col = slot._col || slotColor(slot); const x = o.x - cam.x, y = o.y - cam.y; ctx.save(); ctx.translate(x, y); ctx.rotate((slot.angle || 0) * 3); ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -o.r); ctx.lineTo(o.r, 0); ctx.lineTo(0, o.r); ctx.lineTo(-o.r, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
        if (slot._R) { const col = slot._col || slotColor(slot); ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pl.x - cam.x, pl.y - cam.y, slot._R, 0, 7); ctx.fill(); ctx.globalAlpha = 0.4; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
      }
    }
    ctx.shadowBlur = 0;

    // echo ghost
    if (game.echoPos) {
      ctx.globalAlpha = 0.4; const x = game.echoPos.x - cam.x, y = game.echoPos.y - cam.y;
      ctx.shadowColor = '#9affd0'; ctx.shadowBlur = 14;
      const sp = getSprite('player', '#9affd0', 13, '#caffe9'); ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // players
    for (const pl of game.players) this.drawPlayer(ctx, pl, cam, game.time);

    // particles
    game.particles.draw(ctx, cam);

    // damage numbers
    for (const d of game.dmgNumbers) {
      const x = d.x - cam.x, y = d.y - cam.y; ctx.globalAlpha = Math.max(0, 1 - d.t / 0.6);
      ctx.font = `bold ${d.crit ? 22 : 15}px Arial`; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(d.val, x + 1, y + 1); ctx.fillStyle = d.color; ctx.fillText(d.val, x, y);
    }
    ctx.globalAlpha = 1;
    // floaters
    for (const f of game.floaters) {
      const x = f.x - cam.x, y = f.y - cam.y; ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(f.text, x + 1, y + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';

    // fog / vignette
    this.drawLighting(ctx, game, w, h);

    // screen-space overlays (off-screen boss arrows + minimap)
    this.drawOverlays(ctx, game, w, h, cam);
  }

  drawOverlays(ctx, game, w, h, cam) {
    const margin = 46;
    // --- off-screen boss / elite arrows ---
    const cx = w / 2, cy = h / 2;
    for (const e of (game.enemies || [])) {
      if (!e || (!e.boss && !e.elite)) continue;
      const sx = e.x - cam.x, sy = e.y - cam.y;
      const on = sx >= -40 && sx <= w + 40 && sy >= -40 && sy <= h + 40;
      if (on) continue;
      // direction from screen center toward the enemy
      let dx = sx - cx, dy = sy - cy;
      const ang = Math.atan2(dy, dx);
      // clamp to a rounded rect inset by margin
      const hw = w / 2 - margin, hh = h / 2 - margin;
      let t = Infinity;
      if (dx !== 0) t = Math.min(t, hw / Math.abs(dx));
      if (dy !== 0) t = Math.min(t, hh / Math.abs(dy));
      const ax = cx + dx * t, ay = cy + dy * t;
      const col = e.color || '#ff5a4a';
      const sz = e.boss ? 16 : 10;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.shadowColor = col; ctx.shadowBlur = e.boss ? 16 : 8;
      ctx.fillStyle = col; ctx.globalAlpha = e.boss ? 0.95 : 0.7;
      ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, sz * 0.7); ctx.lineTo(-sz * 0.7, -sz * 0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (e.boss) {
        // small label + hp under arrow
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
        const dist = Math.round(Math.hypot(e.x - (cam.x + cx), e.y - (cam.y + cy)) / 10);
        ctx.fillText(dist + 'm', ax, ay + (ay < cy ? -sz - 6 : sz + 14));
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    if (window.__settings && window.__settings.minimap === false) return;
    // --- minimap (top-right) ---
    const M = 124, pad = 12, scale = 1 / 13;
    const mx = w - M - pad, my = pad;
    const c = game.centroid();
    ctx.save();
    // panel
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#0a0612';
    roundRect(ctx, mx, my, M, M, 10); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a3aa0'; ctx.stroke();
    ctx.globalAlpha = 1;
    // clip to panel
    ctx.beginPath(); roundRect(ctx, mx, my, M, M, 10); ctx.clip();
    const ox = mx + M / 2, oy = my + M / 2;
    const mp = (px, py) => [ox + (px - c.x) * scale, oy + (py - c.y) * scale];
    const inB = (X, Y) => X >= mx && X <= mx + M && Y >= my && Y <= my + M;
    // gems (faint)
    ctx.fillStyle = '#3affc0'; ctx.globalAlpha = 0.5;
    for (const g of (game.gems || [])) { const [X, Y] = mp(g.x, g.y); if (inB(X, Y)) ctx.fillRect(X, Y, 1, 1); }
    ctx.globalAlpha = 1;
    // enemies
    for (const e of (game.enemies || [])) {
      const [X, Y] = mp(e.x, e.y); if (!inB(X, Y)) continue;
      if (e.boss) { ctx.fillStyle = e.color || '#ff3aff'; ctx.beginPath(); ctx.arc(X, Y, 3.2, 0, 7); ctx.fill(); }
      else if (e.elite) { ctx.fillStyle = e.color || '#ffb14a'; ctx.fillRect(X - 1.5, Y - 1.5, 3, 3); }
      else { ctx.fillStyle = '#ff5a4a'; ctx.fillRect(X - 0.8, Y - 0.8, 1.8, 1.8); }
    }
    // rifts
    for (const r of (game.rifts || [])) { const [X, Y] = mp(r.x, r.y); if (!inB(X, Y)) continue; ctx.fillStyle = r.state === 'active' ? '#ff3aff' : '#b06bff'; ctx.shadowColor = '#b06bff'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(X, Y, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    // pickups (chests)
    for (const pk of (game.pickups || [])) { if (!pk.kind || !String(pk.kind).startsWith('chest')) continue; const [X, Y] = mp(pk.x, pk.y); if (!inB(X, Y)) continue; ctx.fillStyle = '#ffd24a'; ctx.fillRect(X - 1.5, Y - 1.5, 3, 3); }
    // players
    for (const pl of (game.players || [])) {
      if (!pl.alive && !pl.downed) continue;
      const [X, Y] = mp(pl.x, pl.y); ctx.fillStyle = pl.downed ? '#888' : (pl.color || '#fff');
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(X, Y, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  drawEnemy(ctx, e, x, y) {
    const bob = Math.sin(e.walkPhase) * (e.r * 0.06);
    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.7, e.r * 0.7, e.r * 0.3, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    const sp = getSprite(e.shape, e.color, e.r);
    if (e.boss || e.elite) { ctx.shadowColor = e.color; ctx.shadowBlur = e.boss ? 22 : 10; }
    ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2 + bob);
    ctx.shadowBlur = 0;
    if (e.hitFlash > 0) { ctx.globalAlpha = e.hitFlash / 0.12 * 0.8; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2 + bob); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (e.chill > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    // boss hp bar
    if (e.boss) {
      const bw = 70, p = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = '#000a'; ctx.fillRect(x - bw / 2 - 1, y - e.r - 16, bw + 2, 7);
      ctx.fillStyle = '#ff3a4a'; ctx.fillRect(x - bw / 2, y - e.r - 15, bw * p, 5);
    }
  }
  drawPlayer(ctx, pl, cam, time) {
    const x = pl.x - cam.x, y = pl.y - cam.y;
    if (pl.downed) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = pl.color; ctx.beginPath(); ctx.ellipse(x, y, pl.r, pl.r * 0.5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText('DOWN', x, y - 18);
      if (pl.reviveT > 0) { ctx.strokeStyle = '#8fe36a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, pl.r + 8, -Math.PI / 2, -Math.PI / 2 + (pl.reviveT / 3) * Math.PI * 2); ctx.stroke(); }
      ctx.textAlign = 'left'; return;
    }
    if (!pl.alive) return;
    const bob = Math.sin(pl.walkPhase) * 2;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + pl.r * 0.7, pl.r * 0.8, pl.r * 0.34, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    const sp = getSprite('player', pl.color, pl.r, pl.accent);
    ctx.save(); ctx.translate(x, y + bob);
    if (pl.facing.x < -0.1) ctx.scale(-1, 1);
    if (pl.invuln > 0 && Math.floor(pl.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    ctx.shadowColor = pl.color; ctx.shadowBlur = 8;
    ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
    ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (pl.flashT > 0) { ctx.globalAlpha = pl.flashT / 0.3 * 0.6; ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(x, y, pl.r * 1.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    // name + hp bar (co-op or always small)
    const showName = true;
    if (showName) {
      const bw = 36, p = Math.max(0, pl.hp / pl.maxHp);
      ctx.fillStyle = '#000a'; ctx.fillRect(x - bw / 2 - 1, y - pl.r - 14, bw + 2, 6);
      ctx.fillStyle = p > 0.3 ? '#6aff8a' : '#ff5a4a'; ctx.fillRect(x - bw / 2, y - pl.r - 13, bw * p, 4);
    }
  }
  drawPickup(ctx, pk, x, y, time) {
    const bob = Math.sin(time * 3 + pk.t) * 3;
    y += bob;
    const map = { coin: ['🪙', '#ffd24a'], gold: ['💰', '#ffd24a'], heart: ['❤️', '#ff5a6a'], magnet: ['🧲', '#7fd4ff'], bomb: ['💣', '#ff9a4a'], shard: ['🔮', '#b06bff'], chest: ['📦', '#c08a4a'], chest_big: ['🎁', '#ffd24a'] };
    const [emoji, col] = map[pk.kind] || ['❓', '#fff'];
    ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.font = `${pk.kind.startsWith('chest') ? 26 : 18}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y); ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  drawRift(ctx, rift, cam, time) {
    const x = rift.x - cam.x, y = rift.y - cam.y;
    const active = rift.state === 'active';
    const col = active ? '#ff3aff' : '#9a4aff';
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(time * (active ? 2 : 1) * (i + 1) * 0.4);
      ctx.strokeStyle = col; ctx.globalAlpha = 0.6 - i * 0.15; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.ellipse(0, 0, rift.r * (1 - i * 0.2), rift.r * (1 - i * 0.2) * 0.6, 0, 0, 7); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    if (active) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(rift.timer) + 's', x, y - rift.r - 8); ctx.textAlign = 'left'; }
  }
  drawLighting(ctx, game, w, h) {
    // radial vignette from player(s)
    const c = game.centroid();
    const cx = c.x - this.cam.x, cy = c.y - this.cam.y;
    const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, game.stage.fog || 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    // corruption tint
    if (game.corruption > 5) { ctx.globalAlpha = Math.min(0.25, game.corruption / 400); ctx.fillStyle = '#7a1aff'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function slotColor(slot) {
  const map = (window).__weaponColors || {};
  return map[slot.id] || '#fff';
}
