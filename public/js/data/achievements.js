// Achievements. Each: { id, name, desc, icon, test(ctx) }.
// ctx = { p: profile (persistent), r: run (current/last run snapshot) }.
// Profile totals are accumulated by the persistence layer.
const A = [];
const add = (id, name, desc, icon, test) => A.push({ id, name, desc, icon, test });

// ---- Kill milestones ----
[10, 100, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000].forEach((n, i) =>
  add(`kill_${n}`, ['Bloodied','Slayer','Reaper','Butcher','Massacre','Apocalypse','Genocide','Annihilator','World-Ender','Death Incarnate'][i],
    `Defeat ${n.toLocaleString()} enemies (lifetime).`, '⚔️', c => c.p.totalKills >= n));

// ---- Single-run kill milestones ----
[100, 500, 1000, 2500, 5000].forEach((n, i) =>
  add(`runkill_${n}`, ['Frenzy','Carnage','Bloodbath','Onslaught','Extinction'][i],
    `Defeat ${n.toLocaleString()} enemies in one run.`, '💥', c => (c.r.kills || 0) >= n));

// ---- Survival milestones (minutes) ----
[5, 10, 15, 20, 25, 30, 45, 60].forEach((m) =>
  add(`survive_${m}`, `Survivor ${m}`, `Survive ${m} minutes in a single run.`, '⏳',
    c => (c.r.time || 0) >= m * 60));

// ---- Level milestones ----
[5, 10, 20, 30, 40, 50, 75, 100].forEach((n) =>
  add(`level_${n}`, `Level ${n}`, `Reach character level ${n} in a run.`, '⭐',
    c => (c.r.level || 0) >= n));

// ---- Gold milestones ----
[100, 500, 1000, 5000, 10000, 50000].forEach((n) =>
  add(`collect_${n}_gold`, `Coin ${n}`, `Collect ${n.toLocaleString()} gold (lifetime).`, '🪙',
    c => c.p.totalGold >= n));

// ---- Damage taken ----
add('take_500', 'Punching Bag', 'Take 500 total damage (lifetime).', '🩹', c => c.p.totalDamageTaken >= 500);
add('first_blood', 'First Blood', 'Defeat your first enemy.', '🩸', c => c.p.totalKills >= 1);

// ---- Boss kills ----
[1, 5, 10, 25, 50].forEach((n, i) =>
  add(`boss_${n}`, ['Giant Slayer','Boss Hunter','Bane of Bosses','Legend','Mythic'][i],
    `Defeat ${n} bosses (lifetime).`, '👹', c => c.p.bossKills >= n));

// ---- Evolutions ----
add('evolve_first', 'Metamorphosis', 'Evolve your first weapon.', '🧬', c => c.p.evolutions >= 1);
[3, 5, 10, 20].forEach((n) =>
  add(`evolve_${n}`, `Evolutionary ${n}`, `Perform ${n} weapon evolutions (lifetime).`, '🧬',
    c => c.p.evolutions >= n));

// ---- Per-character victories (survive 20m) ----
['aria','kael','vesna','doruk','lyra','mira','nyx','fenn','sol','gex','twins','ronin'].forEach(id =>
  add(`win_${id}`, `Champion: ${id}`, `Survive 20 minutes as ${id}.`, '🏆',
    c => (c.p.charWins && c.p.charWins[id])));

// ---- Original-feature achievements ----
add('corrupt_25', 'Tainted', 'Reach 25 Corruption in a run.', '🟣', c => (c.r.maxCorruption || 0) >= 25);
add('corrupt_50', 'Corrupted', 'Reach 50 Corruption in a run.', '🟣', c => (c.r.maxCorruption || 0) >= 50);
add('corrupt_100', 'Avatar of Ruin', 'Reach 100 Corruption in a run.', '🟪', c => (c.r.maxCorruption || 0) >= 100);
add('rift_1', 'Rift Walker', 'Clear your first Time Rift.', '🌀', c => c.p.riftsCleared >= 1);
[5, 15, 30].forEach(n => add(`rift_${n}`, `Rift Master ${n}`, `Clear ${n} Time Rifts (lifetime).`, '🌀', c => c.p.riftsCleared >= n));
add('affinity_3', 'Elementalist', 'Hold weapons of 3+ elements at once.', '🌈', c => (c.r.maxElements || 0) >= 3);
add('affinity_5', 'Archmage', 'Hold weapons of 5+ elements at once.', '🌈', c => (c.r.maxElements || 0) >= 5);
add('echo_unlock', 'Ghost in the Machine', 'Record an Echo of a 10+ minute run.', '👻', c => c.p.echoRecorded);

// ---- Skill / challenge ----
add('no_hit_5', 'Untouchable', 'Survive 5 minutes without taking damage.', '🛡️', c => (c.r.noHitTime || 0) >= 300);
add('full_build', 'Arsenal', 'Fill all 6 weapon slots in one run.', '🗡️', c => (c.r.weaponSlotsFull));
add('full_passive', 'Loaded', 'Fill all 6 passive slots in one run.', '💎', c => (c.r.passiveSlotsFull));
add('max_weapon', 'Mastery', 'Max out a weapon to level 8.', '🔱', c => (c.r.maxedWeapon));
add('one_hp', 'On the Edge', 'Finish a 15+ min run having dropped below 1% HP.', '💔', c => (c.r.nearDeath && (c.r.time||0) >= 900));
add('pacifist_start', 'Slow Starter', 'Reach level 5 before killing 20 enemies.', '🕊️', c => c.r.slowStarter);
add('greed_run', 'Dragon Hoard', 'Collect 2000 gold in one run.', '🐉', c => (c.r.gold || 0) >= 2000);
add('coop_win', 'Brothers in Arms', 'Survive 15 minutes in co-op.', '🤝', c => c.p.coopWins >= 1);
add('coop_revive', 'Guardian Angel', 'Revive a downed ally in co-op.', '😇', c => c.p.coopRevives >= 1);

// ---- Collection ----
add('try_5_chars', 'Dilettante', 'Play 5 different characters.', '🎭', c => c.p.charsUsed && Object.keys(c.p.charsUsed).length >= 5);
add('try_all_chars', 'Cast of Thousands', 'Play all 12 characters.', '🎭', c => c.p.charsUsed && Object.keys(c.p.charsUsed).length >= 12);
add('try_all_stages', 'Wanderer', 'Visit all 5 stages.', '🗺️', c => c.p.stagesUsed && Object.keys(c.p.stagesUsed).length >= 5);
add('unlock_half', 'Curator', 'Unlock half of all achievements.', '🏅', c => (c.p.achCount || 0) >= 60);
add('unlock_all', 'Completionist', 'Unlock every other achievement.', '🌟', c => (c.p.achCount || 0) >= ACH_TOTAL - 1);

// ---- Funny / hidden ----
add('die_first', 'Tutorial Victim', 'Die in the first 60 seconds.', '⚰️', c => c.r.diedEarly);
add('the_end', 'Meeting DEATH', 'Encounter DEATH at 30 minutes.', '💀', c => c.r.metDeath);
add('beat_death', 'Defied Fate', 'Defeat DEATH itself.', '☠️', c => c.p.deathKilled);
add('runs_10', 'Persistent', 'Complete 10 runs.', '🔁', c => c.p.runsCompleted >= 10);
add('runs_50', 'Addicted', 'Complete 50 runs.', '🔁', c => c.p.runsCompleted >= 50);
add('runs_100', 'No Life', 'Complete 100 runs.', '🔁', c => c.p.runsCompleted >= 100);

// ---- Per-weapon mastery (use each base weapon at lvl 8 once) ----
['whip','magicwand','knife','axe','fireball','frostbolt','lightning','cross','bible','garlic',
 'sunbeam','scythe','orbitblade','laser','boomerang','shuriken','coinshot','twinshot'].forEach(id =>
  add(`master_${id}`, `Master: ${id}`, `Max out the ${id} weapon.`, '🔨',
    c => c.p.weaponsMaxed && c.p.weaponsMaxed[id]));

// ---- Bestiary: defeat each enemy type ----
['bat','slime','rat','skeleton','spider','mushroom','wisp','zombie','wolf','archer','cultist',
 'ghoul','imp','ghost','golem','knight','mage','beast','demon','crystal','titan','banshee',
 'nightmare','colossus','devourer'].forEach(id =>
  add(`bestiary_${id}`, `Bestiary: ${id}`, `Defeat a ${id}.`, '📖',
    c => c.p.bestiary && c.p.bestiary[id]));

// ---- Each boss ----
['boss_warden','boss_reaper','boss_dragon','boss_lich','boss_void'].forEach(id =>
  add(`kill_${id}`, `Slain: ${id}`, `Defeat ${id}.`, '👑',
    c => c.p.bossesKilled && c.p.bossesKilled[id]));

export const ACHIEVEMENTS = A;
export const ACH_TOTAL = A.length;
export const ACH_MAP = Object.fromEntries(A.map(a => [a.id, a]));
