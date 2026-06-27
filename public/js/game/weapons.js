// Weapon firing logic. fireWeapon spawns projectiles/effects into the game.
// `eff` is the per-fire effective stat block (already scaled by player multipliers).
export function fireWeapon(game, pl, slot, w, eff) {
  const fx = pl.facing.x, fy = pl.facing.y;
  const col = w.color, el = w.element;
  const onHit = {
    explode: eff.explode || 0, burn: eff.burn || 0, chill: eff.chill || 0,
    freeze: eff.freeze || 0, chain: eff.chain || 0, crit: eff.crit || 0,
    lifesteal: w.lifesteal || 0, dropGold: eff.dropGold || false, knock: eff.knockback || 4,
    goldScale: eff.goldScale || false
  };
  const base = { dmg: eff.damage, element: el, color: col, owner: pl, scale: eff.area, onHit, w };

  switch (w.pattern) {
    case 'whip': {
      // Horizontal sweeping strikes. Always covers BOTH sides (the iconic whip feel);
      // extra `amount` adds vertical fan strikes so it isn't purely left/right.
      const strikes = Math.max(2, eff.amount);
      for (let i = 0; i < strikes; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const yoff = i >= 2 ? ((i % 2 === 0 ? 1 : -1) * 30 * eff.area) : 0;
        game.spawnHitbox({ ...base, x: pl.x + dir * 36 * eff.area, y: pl.y + yoff, w: 92 * eff.area, h: 48 * eff.area, life: eff.duration, kb: eff.knockback, kbx: dir });
      }
      break;
    }
    case 'straight': {
      const spread = eff.amount > 1 ? 0.32 : 0;
      for (let i = 0; i < eff.amount; i++) {
        const off = eff.amount > 1 ? (i / (eff.amount - 1) - 0.5) * spread : 0;
        const a = Math.atan2(fy, fx) + off;
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, vx: Math.cos(a) * eff.speed, vy: Math.sin(a) * eff.speed, r: 7 * eff.area, mode: 'linear', pierce: eff.pierce || 0, life: 1.6, bounce: (eff.bounce || 0) });
      }
      break;
    }
    case 'twin': {
      for (let i = 0; i < eff.amount; i++) {
        const a = Math.atan2(fy, fx) + (i % 2 === 0 ? 0 : Math.PI) + Math.floor(i / 2) * 0.3;
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, vx: Math.cos(a) * eff.speed, vy: Math.sin(a) * eff.speed, r: 7 * eff.area, mode: 'linear', pierce: eff.pierce || 0, life: 1.6 });
      }
      break;
    }
    case 'homing': {
      for (let i = 0; i < eff.amount; i++) {
        const t = game.nearestEnemy(pl.x, pl.y, 700);
        let a = t ? Math.atan2(t.y - pl.y, t.x - pl.x) : Math.random() * 7;
        a += (Math.random() - 0.5) * 0.5;
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, vx: Math.cos(a) * eff.speed, vy: Math.sin(a) * eff.speed, r: 8 * eff.area, mode: 'homing', homStr: 4, pierce: eff.pierce || 0, life: 2.2 });
      }
      break;
    }
    case 'arc': {
      for (let i = 0; i < eff.amount; i++) {
        const t = game.nearestEnemy(pl.x, pl.y, 500) || { x: pl.x + (Math.random() - 0.5) * 300, y: pl.y - 200 };
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, tx: t.x, ty: t.y, t: 0, dur: 0.8, mode: 'lob', r: 11 * eff.area, pierce: eff.pierce || 2, life: 0.8, spin: 12 });
      }
      break;
    }
    case 'spiral': {
      for (let i = 0; i < eff.amount; i++) {
        const a = (i / eff.amount) * Math.PI * 2 + game.time;
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, vx: Math.cos(a) * eff.speed, vy: Math.sin(a) * eff.speed, r: 12 * eff.area, mode: 'spiral', spinCenter: pl, ang: a, life: 1.4, pierce: 99, spin: 14 });
      }
      break;
    }
    case 'boomerang': {
      const baseAng = Math.atan2(fy, fx);
      for (let i = 0; i < eff.amount; i++) {
        const a = baseAng + (i - (eff.amount - 1) / 2) * 0.4;
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, dir: a, speed: eff.speed, mode: 'boomerang', phase: 'out', t: 0, range: 0.55, r: 10 * eff.area, pierce: 99, life: 2.0, spin: 16 });
      }
      break;
    }
    case 'strike': {
      for (let i = 0; i < eff.amount; i++) {
        const t = game.randomEnemyNear(pl.x, pl.y, 480) || { x: pl.x + (Math.random() - 0.5) * 400, y: pl.y + (Math.random() - 0.5) * 300 };
        game.spawnStrike({ ...base, x: t.x, y: t.y, r: 40 * eff.area, chain: onHit.chain, target: t.id });
      }
      break;
    }
    case 'laser': {
      for (let i = 0; i < eff.amount; i++) {
        const a = Math.atan2(fy, fx) + (i - (eff.amount - 1) / 2) * 0.5;
        game.spawnLaser({ ...base, x: pl.x, y: pl.y, ang: a, len: eff.length, width: 16 * eff.area, life: eff.duration });
      }
      break;
    }
    case 'blizzard': {
      for (let i = 0; i < eff.amount; i++) {
        const a = Math.random() * 7;
        game.spawnProjectile({ ...base, x: pl.x + Math.cos(a) * 120, y: pl.y + Math.sin(a) * 120, vx: (Math.random() - 0.5) * eff.speed, vy: (Math.random() - 0.5) * eff.speed, r: 26 * eff.area, mode: 'drift', pierce: 99, life: 1.6 });
      }
      break;
    }
    case 'orbststraight': case 'orbitstraight': {
      for (let i = 0; i < eff.amount; i++) {
        const a = Math.random() * 7;
        game.spawnProjectile({ ...base, x: pl.x, y: pl.y, vx: Math.cos(a) * eff.speed, vy: Math.sin(a) * eff.speed, r: 8 * eff.area, mode: 'bounce', bounce: eff.bounce || 2, pierce: 0, life: 3.0, spin: 20 });
      }
      break;
    }
    // orbit / orbitblade handled persistently in game.updateOrbiters
  }
}
