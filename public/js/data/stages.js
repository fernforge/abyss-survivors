// Stages / biomes. Each defines a palette used to procedurally generate hundreds of
// ground tile variants + decoration props. timeLimit in seconds (endless after).
export const STAGES = [
  {
    id: 'crypt', name: 'The Forgotten Crypt', desc: 'Cold stone halls. A gentle start.',
    ground: ['#1d1a26', '#23202e', '#1a1722', '#262232'], grout: '#0e0c14',
    accent: '#3a3450', fog: 'rgba(20,16,32,0.45)', timeLimit: 1800, unlock: null,
    decor: ['bones', 'pillar', 'candle', 'crack', 'rune'], decorDensity: 0.05,
    music: 'crypt'
  },
  {
    id: 'forest', name: 'Whispering Woods', desc: 'A moonlit forest crawling with beasts.',
    ground: ['#16241a', '#1b2c1f', '#142019', '#1f3324'], grout: '#0a120c',
    accent: '#2f5a38', fog: 'rgba(12,24,16,0.4)', timeLimit: 1800, unlock: { ach: 'survive_5' },
    decor: ['tree', 'bush', 'mushroom', 'flower', 'log'], decorDensity: 0.07,
    music: 'forest'
  },
  {
    id: 'inferno', name: 'Ashen Inferno', desc: 'Lakes of fire and falling ember.',
    ground: ['#2a1410', '#331a12', '#241010', '#3a1d14'], grout: '#140805',
    accent: '#7a2a10', fog: 'rgba(40,16,8,0.5)', timeLimit: 1800, unlock: { ach: 'survive_15' },
    decor: ['lava', 'rock', 'ember', 'skull', 'crack'], decorDensity: 0.06,
    music: 'inferno'
  },
  {
    id: 'frost', name: 'Frostbound Tundra', desc: 'An endless, howling blizzard.',
    ground: ['#1a2430', '#1f2c3a', '#16202c', '#243240'], grout: '#0c1218',
    accent: '#3a5a7a', fog: 'rgba(180,210,240,0.12)', timeLimit: 1800, unlock: { ach: 'level_20' },
    decor: ['ice', 'snowrock', 'crystal', 'pine', 'bone'], decorDensity: 0.06,
    music: 'frost'
  },
  {
    id: 'void', name: 'The Abyss', desc: 'Reality unravels. Endless nightmare.',
    ground: ['#0e0a18', '#140e22', '#0a0814', '#170f26'], grout: '#060410',
    accent: '#5a2a8a', fog: 'rgba(20,8,40,0.5)', timeLimit: 999999, unlock: { ach: 'survive_20' },
    decor: ['rune', 'crystal', 'eye', 'rift', 'bone'], decorDensity: 0.05,
    music: 'void'
  }
];

export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));
export function getStage(id) { return STAGE_MAP[id] || STAGES[0]; }
