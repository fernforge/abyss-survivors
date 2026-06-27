// Playable characters. Each has base stat multipliers and a starting weapon.
// Stats are multipliers/additives applied on top of base player stats.
export const CHARACTERS = [
  {
    id: 'aria', name: 'Aria the Lampbearer', desc: 'Balanced holy fighter. Starts with the Whip.',
    color: '#ffd27f', accent: '#fff3d6', startWeapon: 'whip', unlock: null,
    stats: { maxHpMul: 1.0, speedMul: 1.0, mightMul: 1.0, areaMul: 1.0, luckAdd: 0.0 },
    passive: 'Recovers +0.2 HP/s.', bonus: a => { a.regen += 0.2; }, element: 'holy'
  },
  {
    id: 'kael', name: 'Kael Emberhand', desc: 'Glass-cannon pyromancer. +30% damage, -15% HP.',
    color: '#ff7a45', accent: '#ffd0a0', startWeapon: 'fireball', unlock: { ach: 'first_blood' },
    stats: { maxHpMul: 0.85, speedMul: 1.05, mightMul: 1.3, areaMul: 1.05, luckAdd: 0.0 },
    passive: '+30% Might.', bonus: () => {}, element: 'fire'
  },
  {
    id: 'vesna', name: 'Vesna Frostveil', desc: 'Ice control mage. Enemies near you are chilled.',
    color: '#7fd4ff', accent: '#d6f3ff', startWeapon: 'frostbolt', unlock: { ach: 'survive_5' },
    stats: { maxHpMul: 1.0, speedMul: 1.0, mightMul: 1.0, areaMul: 1.2, luckAdd: 0.1 },
    passive: 'Aura slows nearby foes by 12%.', bonus: a => { a.chillAura = 90; }, element: 'ice'
  },
  {
    id: 'doruk', name: 'Doruk Ironwall', desc: 'Tank. +60% HP, +2 armor, slower.',
    color: '#9aa6b2', accent: '#d9e1ea', startWeapon: 'axe', unlock: { ach: 'take_500' },
    stats: { maxHpMul: 1.6, speedMul: 0.9, mightMul: 1.0, areaMul: 1.0, luckAdd: 0.0 },
    passive: '+2 Armor.', bonus: a => { a.armor += 2; }, element: 'physical'
  },
  {
    id: 'lyra', name: 'Lyra Quickstep', desc: 'Speedy rogue. +25% move speed, +20% luck.',
    color: '#9affc0', accent: '#daffe9', startWeapon: 'knife', unlock: { ach: 'collect_500_gold' },
    stats: { maxHpMul: 0.95, speedMul: 1.25, mightMul: 1.0, areaMul: 0.95, luckAdd: 0.2 },
    passive: '+20% Luck.', bonus: () => {}, element: 'physical'
  },
  {
    id: 'mira', name: 'Mira Stormcaller', desc: 'Lightning adept. Crits chain to a nearby foe.',
    color: '#c79aff', accent: '#ecdcff', startWeapon: 'lightning', unlock: { ach: 'level_20' },
    stats: { maxHpMul: 0.95, speedMul: 1.05, mightMul: 1.1, areaMul: 1.05, luckAdd: 0.1 },
    passive: 'Hits have +8% chain chance.', bonus: a => { a.chainChance = (a.chainChance||0) + 0.08; }, element: 'lightning'
  },
  {
    id: 'nyx', name: 'Nyx the Hollow', desc: 'Shadow reaper. Lifesteal on kills, fragile.',
    color: '#b06bff', accent: '#2a1840', startWeapon: 'scythe', unlock: { ach: 'kill_2000' },
    stats: { maxHpMul: 0.8, speedMul: 1.1, mightMul: 1.15, areaMul: 1.1, luckAdd: 0.1 },
    passive: 'Heal 1 HP per 12 kills.', bonus: a => { a.killHeal = 12; }, element: 'shadow' },
  {
    id: 'fenn', name: 'Fenn Wildroot', desc: 'Nature druid. Garlic aura + faster pickups.',
    color: '#8fe36a', accent: '#dcffc9', startWeapon: 'garlic', unlock: { ach: 'survive_15' },
    stats: { maxHpMul: 1.15, speedMul: 1.0, mightMul: 1.0, areaMul: 1.15, luckAdd: 0.1 },
    passive: '+50% pickup range.', bonus: a => { a.magnetMul += 0.5; }, element: 'nature'
  },
  {
    id: 'sol', name: 'Sol Radiant', desc: 'Sun priest. Damaging light aura, holy resonance.',
    color: '#ffe066', accent: '#fff7cc', startWeapon: 'sunbeam', unlock: { ach: 'level_40' },
    stats: { maxHpMul: 1.1, speedMul: 1.0, mightMul: 1.1, areaMul: 1.25, luckAdd: 0.05 },
    passive: '+25% Area.', bonus: () => {}, element: 'holy'
  },
  {
    id: 'gex', name: 'Gex the Hoarder', desc: 'Greedy gremlin. +100% gold, magnet, glass.',
    color: '#ffd24a', accent: '#3a3010', startWeapon: 'coinshot', unlock: { ach: 'collect_5000_gold' },
    stats: { maxHpMul: 0.85, speedMul: 1.1, mightMul: 0.95, areaMul: 1.0, luckAdd: 0.3 },
    passive: '+100% Gold, +30% Luck.', bonus: a => { a.greed += 1.0; }, element: 'arcane'
  },
  {
    id: 'twins', name: 'The Gemini', desc: 'Two souls: fires twin opposite projectiles.',
    color: '#ff8fce', accent: '#ffd6ec', startWeapon: 'twinshot', unlock: { ach: 'evolve_first' },
    stats: { maxHpMul: 1.0, speedMul: 1.05, mightMul: 1.05, areaMul: 1.05, luckAdd: 0.15 },
    passive: '+1 projectile to all weapons.', bonus: a => { a.amount += 1; }, element: 'arcane'
  },
  {
    id: 'ronin', name: 'Ronin Bladeless', desc: 'Master duelist. Starts with the orbiting Katana.',
    color: '#ff5a5a', accent: '#ffd2d2', startWeapon: 'orbitblade', unlock: { ach: 'no_hit_5' },
    stats: { maxHpMul: 1.0, speedMul: 1.1, mightMul: 1.2, areaMul: 1.0, luckAdd: 0.0 },
    passive: '+20% Might, +10% Speed.', bonus: () => {}, element: 'physical'
  }
];

export function getCharacter(id) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; }
