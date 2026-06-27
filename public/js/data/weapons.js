// Weapons. All fire automatically. `pattern` is read by the weapons-system.
// stat(level) returns the effective per-level stats. Level 1..maxLevel.
// evolution: { into: weaponId, req: passiveId } — evolves when weapon maxed + passive owned.
const L = (base, perLvl) => (lvl) => base + perLvl * (lvl - 1);

export const WEAPONS = [
  {
    id: 'whip', name: 'Holy Whip', element: 'holy', color: '#fff0b0', pattern: 'whip',
    desc: 'Strikes horizontally in the direction you face.', maxLevel: 8,
    evolution: { into: 'bloodywhip', req: 'hollowheart' },
    stat: l => ({ damage: L(10, 5)(l), cooldown: L(1.2, -0.06)(l), amount: 1 + (l >= 3 ? 1 : 0) + (l >= 6 ? 1 : 0), area: L(1, 0.12)(l), knockback: 8, duration: 0.25 })
  },
  {
    id: 'bloodywhip', name: 'Bloody Whip', element: 'shadow', color: '#ff5a7a', pattern: 'whip', evolved: true,
    desc: 'EVOLVED. Strikes both sides and heals on hit.', maxLevel: 1, lifesteal: 0.06,
    stat: () => ({ damage: 40, cooldown: 0.7, amount: 2, area: 1.6, knockback: 12, duration: 0.3 })
  },
  {
    id: 'magicwand', name: 'Magic Wand', element: 'arcane', color: '#9ad0ff', pattern: 'homing',
    desc: 'Fires at the nearest enemy automatically.', maxLevel: 8,
    evolution: { into: 'holywand', req: 'emptytome' },
    stat: l => ({ damage: L(10, 4)(l), cooldown: L(1.3, -0.07)(l), amount: 1 + Math.floor((l - 1) / 2), speed: 320, pierce: 0 + (l >= 5 ? 1 : 0), area: L(1, 0.05)(l) })
  },
  {
    id: 'holywand', name: 'Holy Wand', element: 'holy', color: '#fff7c0', pattern: 'homing', evolved: true,
    desc: 'EVOLVED. Fires with no cooldown.', maxLevel: 1,
    stat: () => ({ damage: 24, cooldown: 0.18, amount: 4, speed: 420, pierce: 1, area: 1.2 })
  },
  {
    id: 'knife', name: 'Throwing Knife', element: 'physical', color: '#dfe7ef', pattern: 'straight',
    desc: 'Fires quickly in the direction you face. Pierces.', maxLevel: 8,
    evolution: { into: 'thousandedge', req: 'bracer' },
    stat: l => ({ damage: L(8, 3)(l), cooldown: L(0.7, -0.04)(l), amount: 2 + Math.floor((l - 1) / 2), speed: 520, pierce: 1 + (l >= 4 ? 1 : 0), area: 1 })
  },
  {
    id: 'thousandedge', name: 'Thousand Edge', element: 'physical', color: '#ffffff', pattern: 'straight', evolved: true,
    desc: 'EVOLVED. A relentless stream of blades.', maxLevel: 1,
    stat: () => ({ damage: 16, cooldown: 0.07, amount: 2, speed: 620, pierce: 2, area: 1 })
  },
  {
    id: 'axe', name: 'War Axe', element: 'physical', color: '#cfd8e3', pattern: 'arc',
    desc: 'Hurls heavy axes upward in an arc. High damage.', maxLevel: 8,
    evolution: { into: 'deathspiral', req: 'candelabra' },
    stat: l => ({ damage: L(28, 10)(l), cooldown: L(1.6, -0.07)(l), amount: 1 + Math.floor((l - 1) / 2), speed: 360, pierce: 2, area: L(1, 0.08)(l) })
  },
  {
    id: 'deathspiral', name: 'Death Spiral', element: 'shadow', color: '#b06bff', pattern: 'spiral', evolved: true,
    desc: 'EVOLVED. Whirling blades spiral outward in all directions.', maxLevel: 1,
    stat: () => ({ damage: 40, cooldown: 1.0, amount: 8, speed: 300, pierce: 99, area: 1.3 })
  },
  {
    id: 'fireball', name: 'Fireball', element: 'fire', color: '#ff7a30', pattern: 'homing',
    desc: 'Lobs explosive fire at the nearest enemy.', maxLevel: 8,
    evolution: { into: 'hellfire', req: 'spinach' },
    stat: l => ({ damage: L(18, 7)(l), cooldown: L(1.7, -0.08)(l), amount: 1 + Math.floor((l - 1) / 3), speed: 260, pierce: 0, area: L(1.2, 0.12)(l), explode: 60 })
  },
  {
    id: 'hellfire', name: 'Hellfire', element: 'fire', color: '#ff3b1a', pattern: 'homing', evolved: true,
    desc: 'EVOLVED. Massive explosions that pierce and burn.', maxLevel: 1,
    stat: () => ({ damage: 60, cooldown: 1.1, amount: 2, speed: 300, pierce: 3, area: 1.8, explode: 110, burn: 8 })
  },
  {
    id: 'frostbolt', name: 'Frostbolt', element: 'ice', color: '#7fd4ff', pattern: 'homing',
    desc: 'Chilling bolts that slow enemies.', maxLevel: 8,
    evolution: { into: 'blizzard', req: 'clock' },
    stat: l => ({ damage: L(12, 5)(l), cooldown: L(1.4, -0.06)(l), amount: 1 + Math.floor(l / 3), speed: 300, pierce: 1, area: L(1, 0.08)(l), chill: 1.2 })
  },
  {
    id: 'blizzard', name: 'Blizzard', element: 'ice', color: '#cdeeff', pattern: 'blizzard', evolved: true,
    desc: 'EVOLVED. A roaming storm freezes everything.', maxLevel: 1,
    stat: () => ({ damage: 22, cooldown: 0.25, amount: 3, speed: 220, pierce: 2, area: 1.5, chill: 2.0, freeze: 0.4 })
  },
  {
    id: 'lightning', name: 'Lightning Rune', element: 'lightning', color: '#fff07a', pattern: 'strike',
    desc: 'Smites random enemies from the sky.', maxLevel: 8,
    evolution: { into: 'thunderloop', req: 'duplicator' },
    stat: l => ({ damage: L(22, 9)(l), cooldown: L(2.0, -0.1)(l), amount: 1 + Math.floor(l / 2), area: L(1, 0.1)(l), chain: l >= 5 ? 2 : 0 })
  },
  {
    id: 'thunderloop', name: 'Thunder Loop', element: 'lightning', color: '#ffffff', pattern: 'strike', evolved: true,
    desc: 'EVOLVED. Endless storm, every bolt chains.', maxLevel: 1,
    stat: () => ({ damage: 50, cooldown: 0.5, amount: 4, area: 1.4, chain: 4 })
  },
  {
    id: 'cross', name: 'Cross', element: 'holy', color: '#ffe9a0', pattern: 'boomerang',
    desc: 'Holy crosses that boomerang back to you.', maxLevel: 8,
    evolution: { into: 'heaven', req: 'clover' },
    stat: l => ({ damage: L(14, 6)(l), cooldown: L(1.6, -0.07)(l), amount: 1 + Math.floor((l - 1) / 2), speed: 340, pierce: 99, area: L(1, 0.1)(l) })
  },
  {
    id: 'heaven', name: 'Heaven Sword', element: 'holy', color: '#fffbe0', pattern: 'boomerang', evolved: true,
    desc: 'EVOLVED. Crit crosses that return endlessly.', maxLevel: 1,
    stat: () => ({ damage: 44, cooldown: 0.9, amount: 3, speed: 380, pierce: 99, area: 1.4, crit: 0.5 })
  },
  {
    id: 'bible', name: 'Sacred Tome', element: 'holy', color: '#ffe066', pattern: 'orbit',
    desc: 'Holy books orbit around you.', maxLevel: 8,
    evolution: { into: 'unholy', req: 'spellbinder' },
    stat: l => ({ damage: L(12, 5)(l), cooldown: L(3.0, -0.1)(l), amount: 1 + Math.floor(l / 2), area: L(1, 0.1)(l), orbitR: 70 + l * 6, duration: 3 })
  },
  {
    id: 'unholy', name: 'Unholy Vespers', element: 'shadow', color: '#b06bff', pattern: 'orbit', evolved: true,
    desc: 'EVOLVED. Permanent orbit of dark tomes.', maxLevel: 1,
    stat: () => ({ damage: 36, cooldown: 0.1, amount: 5, area: 1.5, orbitR: 110, duration: 99 })
  },
  {
    id: 'garlic', name: 'Garlic Aura', element: 'nature', color: '#d8ffb0', pattern: 'aura',
    desc: 'Damaging aura that repels nearby foes.', maxLevel: 8,
    evolution: { into: 'souleater', req: 'pummarola' },
    stat: l => ({ damage: L(5, 2)(l), cooldown: 0.5, area: L(1.2, 0.16)(l), knockback: 4 })
  },
  {
    id: 'souleater', name: 'Soul Eater', element: 'shadow', color: '#a06bff', pattern: 'aura', evolved: true,
    desc: 'EVOLVED. Aura grows with every kill and heals you.', maxLevel: 1, lifesteal: 0.04,
    stat: () => ({ damage: 14, cooldown: 0.4, area: 2.0, knockback: 6 })
  },
  {
    id: 'sunbeam', name: 'Sun Halo', element: 'holy', color: '#ffe680', pattern: 'aura',
    desc: 'A radiant ring of light burns nearby foes.', maxLevel: 8,
    evolution: { into: 'solarflare', req: 'crown' },
    stat: l => ({ damage: L(8, 3)(l), cooldown: 0.4, area: L(1.4, 0.18)(l), knockback: 2 })
  },
  {
    id: 'solarflare', name: 'Solar Flare', element: 'holy', color: '#fff2b0', pattern: 'aura', evolved: true,
    desc: 'EVOLVED. Blinding radiance, periodic supernova.', maxLevel: 1,
    stat: () => ({ damage: 22, cooldown: 0.35, area: 2.4, knockback: 4, nova: true })
  },
  {
    id: 'scythe', name: 'Reaper Scythe', element: 'shadow', color: '#c79aff', pattern: 'orbitblade',
    desc: 'A scythe sweeps a deadly arc around you.', maxLevel: 8,
    evolution: { into: 'phantomreaper', req: 'skull' },
    stat: l => ({ damage: L(20, 8)(l), cooldown: L(1.4, -0.05)(l), amount: 1 + Math.floor(l / 3), area: L(1.1, 0.12)(l), orbitR: 90, arc: 1.4 })
  },
  {
    id: 'phantomreaper', name: 'Phantom Reaper', element: 'shadow', color: '#e0c0ff', pattern: 'orbitblade', evolved: true,
    desc: 'EVOLVED. Twin phantom scythes that reap souls.', maxLevel: 1, lifesteal: 0.03,
    stat: () => ({ damage: 48, cooldown: 0.7, amount: 3, area: 1.6, orbitR: 120, arc: 6.28 })
  },
  {
    id: 'orbitblade', name: 'Katana Orbit', element: 'physical', color: '#ff9a9a', pattern: 'orbitblade',
    desc: 'Spinning blades constantly orbit you.', maxLevel: 8,
    evolution: { into: 'thousandcuts', req: 'attractorb' },
    stat: l => ({ damage: L(10, 4)(l), cooldown: 0.2, amount: 2 + Math.floor(l / 2), area: L(1, 0.08)(l), orbitR: 80 + l * 4, arc: 6.28 })
  },
  {
    id: 'thousandcuts', name: 'Thousand Cuts', element: 'physical', color: '#ffffff', pattern: 'orbitblade', evolved: true,
    desc: 'EVOLVED. A whirlwind of six blades.', maxLevel: 1,
    stat: () => ({ damage: 26, cooldown: 0.15, amount: 6, area: 1.3, orbitR: 110, arc: 6.28 })
  },
  {
    id: 'laser', name: 'Arc Laser', element: 'arcane', color: '#9affd0', pattern: 'laser',
    desc: 'A piercing beam sweeps the field.', maxLevel: 8,
    evolution: { into: 'deathray', req: 'lens' },
    stat: l => ({ damage: L(10, 4)(l), cooldown: L(2.2, -0.1)(l), amount: 1 + Math.floor(l / 4), area: L(1, 0.1)(l), length: 600, duration: 0.4 })
  },
  {
    id: 'deathray', name: 'Death Ray', element: 'arcane', color: '#caffec', pattern: 'laser', evolved: true,
    desc: 'EVOLVED. A continuous annihilating beam.', maxLevel: 1,
    stat: () => ({ damage: 28, cooldown: 0.6, amount: 2, area: 1.6, length: 800, duration: 0.7 })
  },
  {
    id: 'boomerang', name: 'Star Boomerang', element: 'nature', color: '#ffd27a', pattern: 'boomerang',
    desc: 'Returns to you, hitting foes both ways.', maxLevel: 8,
    evolution: { into: 'cometcall', req: 'wings' },
    stat: l => ({ damage: L(12, 5)(l), cooldown: L(1.5, -0.07)(l), amount: 1 + Math.floor(l / 3), speed: 360, pierce: 99, area: L(1, 0.1)(l) })
  },
  {
    id: 'cometcall', name: 'Comet Call', element: 'arcane', color: '#ffe9b0', pattern: 'boomerang', evolved: true,
    desc: 'EVOLVED. Returning comets leave a fiery wake.', maxLevel: 1,
    stat: () => ({ damage: 40, cooldown: 0.8, amount: 3, speed: 420, pierce: 99, area: 1.5, burn: 5 })
  },
  {
    id: 'shuriken', name: 'Spirit Shuriken', element: 'physical', color: '#bfe9ff', pattern: 'orbitstraight',
    desc: 'Shuriken ricochet around the battlefield.', maxLevel: 8,
    evolution: { into: 'bladestorm', req: 'mirror' },
    stat: l => ({ damage: L(9, 4)(l), cooldown: L(1.2, -0.05)(l), amount: 1 + Math.floor(l / 2), speed: 380, bounce: 2 + Math.floor(l / 3), area: 1 })
  },
  {
    id: 'bladestorm', name: 'Blade Storm', element: 'physical', color: '#ffffff', pattern: 'orbitstraight', evolved: true,
    desc: 'EVOLVED. Endless ricocheting blades.', maxLevel: 1,
    stat: () => ({ damage: 22, cooldown: 0.3, amount: 4, speed: 460, bounce: 6, area: 1.2 })
  },
  {
    id: 'coinshot', name: 'Coin Shot', element: 'arcane', color: '#ffd24a', pattern: 'straight',
    desc: 'Fires coins. Gold scales their damage.', maxLevel: 8,
    evolution: { into: 'fortune', req: 'greedring' },
    stat: l => ({ damage: L(11, 4)(l), cooldown: L(0.85, -0.05)(l), amount: 2 + Math.floor(l / 2), speed: 480, pierce: 1, area: 1, goldScale: true })
  },
  {
    id: 'fortune', name: 'Fortune Burst', element: 'arcane', color: '#ffe680', pattern: 'straight', evolved: true,
    desc: 'EVOLVED. Showers coins that explode into gold.', maxLevel: 1,
    stat: () => ({ damage: 26, cooldown: 0.4, amount: 4, speed: 520, pierce: 2, area: 1.2, goldScale: true, dropGold: true })
  },
  {
    id: 'twinshot', name: 'Gemini Bolts', element: 'arcane', color: '#ff8fce', pattern: 'twin',
    desc: 'Fires twin bolts to opposite sides.', maxLevel: 8,
    evolution: { into: 'eclipse', req: 'yinyang' },
    stat: l => ({ damage: L(10, 4)(l), cooldown: L(1.1, -0.05)(l), amount: 2 + Math.floor(l / 3) * 2, speed: 420, pierce: 1 + Math.floor(l / 4), area: 1 })
  },
  {
    id: 'eclipse', name: 'Eclipse', element: 'shadow', color: '#d0a0ff', pattern: 'twin', evolved: true,
    desc: 'EVOLVED. Light and dark bolts that converge.', maxLevel: 1,
    stat: () => ({ damage: 30, cooldown: 0.45, amount: 6, speed: 520, pierce: 3, area: 1.3 })
  }
];

export const WEAPON_MAP = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
export function getWeapon(id) { return WEAPON_MAP[id]; }
// Weapons that can appear in level-up pool (non-evolved only).
export const BASE_WEAPONS = WEAPONS.filter(w => !w.evolved);
