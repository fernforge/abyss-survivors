// Enemy definitions. Base stats; spawn director scales hp/damage by time + corruption.
// behavior: chase | zigzag | fast | tank | charger | shooter | splitter | exploder
//         | orbiter | summoner | ghost | healer | dasher | swarm
// minTier = minute it starts appearing. weight = relative spawn frequency.
export const ENEMIES = [
  // --- Early (0-4 min) ---
  { id: 'bat', name: 'Cave Bat', shape: 'bat', color: '#7a6b8f', hp: 7, speed: 62, dmg: 5, xp: 1, r: 9, behavior: 'zigzag', minTier: 0, weight: 10 },
  { id: 'slime', name: 'Slime', shape: 'slime', color: '#6ad36a', hp: 12, speed: 40, dmg: 6, xp: 1, r: 11, behavior: 'chase', minTier: 0, weight: 10 },
  { id: 'rat', name: 'Dire Rat', shape: 'rat', color: '#9a8b7a', hp: 6, speed: 78, dmg: 4, xp: 1, r: 8, behavior: 'fast', minTier: 0, weight: 8 },
  { id: 'skeleton', name: 'Skeleton', shape: 'skeleton', color: '#e0e0d0', hp: 16, speed: 50, dmg: 8, xp: 2, r: 11, behavior: 'chase', minTier: 1, weight: 9 },
  { id: 'spider', name: 'Cave Spider', shape: 'spider', color: '#5a4a6a', hp: 10, speed: 70, dmg: 6, xp: 1, r: 10, behavior: 'dasher', minTier: 1, weight: 7 },
  { id: 'mushroom', name: 'Sporeling', shape: 'mushroom', color: '#d36a8f', hp: 14, speed: 34, dmg: 7, xp: 2, r: 12, behavior: 'exploder', minTier: 2, weight: 5, explodeR: 40 },
  { id: 'wisp', name: 'Will-o-Wisp', shape: 'wisp', color: '#8fd4ff', hp: 9, speed: 66, dmg: 6, xp: 2, r: 9, behavior: 'orbiter', minTier: 2, weight: 6 },

  // --- Mid (4-10 min) ---
  { id: 'zombie', name: 'Zombie', shape: 'zombie', color: '#7a8f5a', hp: 30, speed: 38, dmg: 10, xp: 3, r: 13, behavior: 'tank', minTier: 3, weight: 8 },
  { id: 'wolf', name: 'Dire Wolf', shape: 'wolf', color: '#8a8a9a', hp: 22, speed: 92, dmg: 11, xp: 3, r: 12, behavior: 'charger', minTier: 3, weight: 7 },
  { id: 'archer', name: 'Bone Archer', shape: 'archer', color: '#cfc0a0', hp: 18, speed: 44, dmg: 9, xp: 3, r: 11, behavior: 'shooter', minTier: 4, weight: 6, range: 300, shotSpeed: 180 },
  { id: 'cultist', name: 'Cultist', shape: 'cultist', color: '#9a5aff', hp: 24, speed: 48, dmg: 10, xp: 4, r: 12, behavior: 'summoner', minTier: 5, weight: 4, summons: 'bat' },
  { id: 'ghoul', name: 'Ghoul', shape: 'ghoul', color: '#6a8f7a', hp: 28, speed: 58, dmg: 12, xp: 4, r: 12, behavior: 'splitter', minTier: 5, weight: 6, splitInto: 'slime', splitN: 2 },
  { id: 'imp', name: 'Imp', shape: 'imp', color: '#ff6a4a', hp: 20, speed: 84, dmg: 11, xp: 3, r: 10, behavior: 'shooter', minTier: 4, weight: 5, range: 260, shotSpeed: 220 },
  { id: 'ghost', name: 'Wraith', shape: 'ghost', color: '#b0c0ff', hp: 26, speed: 56, dmg: 12, xp: 4, r: 12, behavior: 'ghost', minTier: 6, weight: 5 },
  { id: 'golem', name: 'Stone Golem', shape: 'golem', color: '#8a8a7a', hp: 70, speed: 30, dmg: 16, xp: 6, r: 16, behavior: 'tank', minTier: 6, weight: 4 },

  // --- Late (10-20 min) ---
  { id: 'knight', name: 'Fallen Knight', shape: 'knight', color: '#9aa6c2', hp: 90, speed: 52, dmg: 18, xp: 8, r: 14, behavior: 'charger', minTier: 8, weight: 5 },
  { id: 'mage', name: 'Dark Mage', shape: 'mage', color: '#b06bff', hp: 60, speed: 46, dmg: 16, xp: 8, r: 13, behavior: 'shooter', minTier: 8, weight: 4, range: 340, shotSpeed: 200 },
  { id: 'reaper_minion', name: 'Specter', shape: 'ghost', color: '#caa6ff', hp: 75, speed: 70, dmg: 18, xp: 7, r: 13, behavior: 'ghost', minTier: 9, weight: 5 },
  { id: 'beast', name: 'Hellhound', shape: 'wolf', color: '#ff5a3a', hp: 80, speed: 100, dmg: 20, xp: 8, r: 14, behavior: 'charger', minTier: 10, weight: 5 },
  { id: 'demon', name: 'Lesser Demon', shape: 'demon', color: '#ff4a6a', hp: 120, speed: 56, dmg: 22, xp: 12, r: 16, behavior: 'chase', minTier: 11, weight: 4 },
  { id: 'crystal', name: 'Crystal Horror', shape: 'crystal', color: '#7fffe0', hp: 100, speed: 40, dmg: 18, xp: 10, r: 15, behavior: 'splitter', minTier: 10, weight: 4, splitInto: 'wisp', splitN: 3 },
  { id: 'titan', name: 'Iron Titan', shape: 'golem', color: '#6a7a8a', hp: 260, speed: 28, dmg: 28, xp: 18, r: 20, behavior: 'tank', minTier: 12, weight: 3 },
  { id: 'banshee', name: 'Banshee', shape: 'ghost', color: '#ff9ad4', hp: 110, speed: 62, dmg: 20, xp: 11, r: 14, behavior: 'shooter', minTier: 12, weight: 3, range: 360, shotSpeed: 240 },
  { id: 'swarmling', name: 'Swarmling', shape: 'bat', color: '#ff7a9a', hp: 14, speed: 110, dmg: 12, xp: 2, r: 8, behavior: 'swarm', minTier: 9, weight: 9 },

  // --- Endless (20+ min) ---
  { id: 'nightmare', name: 'Nightmare', shape: 'demon', color: '#9a2aff', hp: 400, speed: 60, dmg: 36, xp: 30, r: 18, behavior: 'charger', minTier: 16, weight: 4 },
  { id: 'colossus', name: 'Void Colossus', shape: 'golem', color: '#3a2a5a', hp: 900, speed: 26, dmg: 50, xp: 50, r: 26, behavior: 'tank', minTier: 18, weight: 2 },
  { id: 'devourer', name: 'Devourer', shape: 'demon', color: '#ff2a4a', hp: 600, speed: 70, dmg: 44, xp: 40, r: 20, behavior: 'chase', minTier: 20, weight: 3 }
];

// Bosses summoned at fixed minutes. Big, telegraphed, drop a chest.
export const BOSSES = [
  { id: 'boss_warden', name: 'The Warden', shape: 'golem', color: '#c08a4a', hp: 1200, speed: 38, dmg: 30, xp: 200, r: 34, behavior: 'charger', minute: 4, boss: true },
  { id: 'boss_reaper', name: 'The Pale Reaper', shape: 'demon', color: '#caa6ff', hp: 3000, speed: 52, dmg: 40, xp: 400, r: 36, behavior: 'summoner', summons: 'reaper_minion', minute: 8, boss: true },
  { id: 'boss_dragon', name: 'Emberwyrm', shape: 'demon', color: '#ff5a2a', hp: 6000, speed: 46, dmg: 55, xp: 700, r: 42, behavior: 'shooter', range: 500, shotSpeed: 260, minute: 12, boss: true },
  { id: 'boss_lich', name: 'Lich King', shape: 'mage', color: '#7fffe0', hp: 12000, speed: 40, dmg: 70, xp: 1200, r: 40, behavior: 'summoner', summons: 'knight', minute: 16, boss: true },
  { id: 'boss_void', name: 'Avatar of the Abyss', shape: 'demon', color: '#9a2aff', hp: 28000, speed: 44, dmg: 90, xp: 2500, r: 50, behavior: 'charger', minute: 20, boss: true },
  { id: 'boss_death', name: 'DEATH', shape: 'demon', color: '#ffffff', hp: 120000, speed: 130, dmg: 65535, xp: 9999, r: 44, behavior: 'chase', minute: 30, boss: true }
];

export const ENEMY_MAP = Object.fromEntries([...ENEMIES, ...BOSSES].map(e => [e.id, e]));
export function getEnemy(id) { return ENEMY_MAP[id]; }
