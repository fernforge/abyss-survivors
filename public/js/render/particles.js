// Lightweight pooled particle system (world-space).
export class Particles {
  constructor(max = 2000) { this.pool = []; this.active = []; this.max = max; }
  spawn(x, y, opt = {}) {
    if (this.active.length >= this.max) return;
    const p = this.pool.pop() || {};
    p.x = x; p.y = y;
    p.vx = opt.vx ?? 0; p.vy = opt.vy ?? 0;
    p.life = p.maxLife = opt.life ?? 0.5;
    p.r = opt.r ?? 3; p.r0 = p.r;
    p.color = opt.color ?? '#fff';
    p.glow = opt.glow ?? false;
    p.shrink = opt.shrink ?? true;
    p.gravity = opt.gravity ?? 0;
    p.fade = opt.fade ?? true;
    p.shape = opt.shape ?? 'circle';
    p.spin = opt.spin ?? 0; p.rot = opt.rot ?? 0;
    p.drag = opt.drag ?? 1;
    this.active.push(p);
    return p;
  }
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = (opt.dir ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (opt.spread ?? Math.PI * 2);
      const sp = (opt.speed ?? 80) * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, { ...opt, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
    }
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) { this.active.splice(i, 1); this.pool.push(p); continue; }
      p.vy += p.gravity * dt; p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      const t = p.life / p.maxLife;
      if (p.shrink) p.r = p.r0 * t;
    }
  }
  draw(ctx, cam) {
    ctx.save();
    for (const p of this.active) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = p.fade ? Math.max(0, t) : 1;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.r * 2; } else ctx.shadowBlur = 0;
      ctx.fillStyle = p.color;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (p.shape === 'rect') {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8); ctx.restore();
      } else if (p.shape === 'spark') {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot); ctx.fillRect(-p.r * 1.5, -p.r * 0.2, p.r * 3, p.r * 0.4); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.5, p.r), 0, 7); ctx.fill();
      }
    }
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  clear() { while (this.active.length) this.pool.push(this.active.pop()); }
}
