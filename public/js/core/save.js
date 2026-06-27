// Persistent profile + achievement evaluation + unlocks (localStorage).
import { ACHIEVEMENTS, ACH_TOTAL } from '../data/achievements.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES } from '../data/stages.js';

const KEY = 'abyss_survivors_save_v1';
const DEFAULT = {
  totalKills: 0, totalGold: 0, totalDamageTaken: 0, bossKills: 0, evolutions: 0,
  runsCompleted: 0, riftsCleared: 0, deaths: 0, coopWins: 0, coopRevives: 0,
  echoRecorded: false, deathKilled: false,
  charsUsed: {}, stagesUsed: {}, weaponsMaxed: {}, bestiary: {}, bossesKilled: {}, charWins: {},
  achievements: {}, achCount: 0, bestEcho: null, bestEchoTime: 0,
  settings: { music: 0.35, sfx: 0.5, minimap: true, shake: true }
};

export const Save = {
  data: null,
  load() {
    try { this.data = { ...structuredClone(DEFAULT), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
    catch { this.data = structuredClone(DEFAULT); }
    // ensure nested objects exist
    for (const k of ['charsUsed', 'stagesUsed', 'weaponsMaxed', 'bestiary', 'bossesKilled', 'charWins', 'achievements', 'settings'])
      if (!this.data[k]) this.data[k] = structuredClone(DEFAULT[k]);
    // backfill any new setting keys for older saves
    this.data.settings = { ...structuredClone(DEFAULT.settings), ...this.data.settings };
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {} },

  // merge a finished run's stats into the profile, then evaluate achievements
  recordRun(run) {
    const p = this.data;
    p.totalKills += run.kills || 0;
    p.totalGold += run.gold || 0;
    p.totalDamageTaken += run.totalDamageTaken || 0;
    p.bossKills += run.bossKills || 0;
    p.evolutions += run.evolutions || 0;
    p.riftsCleared += run.riftsCleared || 0;
    p.runsCompleted += 1;
    if (!run.win) p.deaths += 1;
    if (run.charId) p.charsUsed[run.charId] = true;
    if (run.stageId) p.stagesUsed[run.stageId] = true;
    Object.assign(p.weaponsMaxed, run.maxedWeaponsList || {});
    Object.assign(p.bestiary, run.bestiary || {});
    if (run.deathKilled) p.deathKilled = true;
    if (run.coop && (run.time || 0) >= 900) p.coopWins += 1;
    if (run.coopRevives) p.coopRevives += run.coopRevives;
    if ((run.time || 0) >= 600) p.echoRecorded = true;
    // char "win" = survive 20 min
    if ((run.time || 0) >= 1200 && run.charId) p.charWins[run.charId] = true;
    // bosses killed set
    if (run.bossesKilledSet) Object.assign(p.bossesKilled, run.bossesKilledSet);
    const newly = this.evaluate(run);
    this.save();
    return newly;
  },

  // returns array of newly unlocked achievement objects
  evaluate(run) {
    const ctx = { p: this.data, r: run || {} };
    this.data.achCount = Object.keys(this.data.achievements).length;
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.achievements[a.id]) continue;
      let ok = false; try { ok = a.test(ctx); } catch { ok = false; }
      if (ok) { this.data.achievements[a.id] = true; newly.push(a); }
    }
    this.data.achCount = Object.keys(this.data.achievements).length;
    return newly;
  },

  hasAch(id) { return !!this.data.achievements[id]; },
  achProgress() { return { done: this.data.achCount, total: ACH_TOTAL }; },

  // unlock gating for characters/stages
  isCharUnlocked(ch) { if (!ch.unlock) return true; if (ch.unlock.ach) return this.hasAch(ch.unlock.ach); return true; },
  isStageUnlocked(s) { if (!s.unlock) return true; if (s.unlock.ach) return this.hasAch(s.unlock.ach); return true; },
  unlockedChars() { return CHARACTERS.filter(c => this.isCharUnlocked(c)); },
  unlockedStages() { return STAGES.filter(s => this.isStageUnlocked(s)); },

  saveEcho(path, time) {
    if (time > (this.data.bestEchoTime || 0)) {
      // downsample to keep storage small (~ every 6th sample)
      const ds = []; for (let i = 0; i < path.length; i += 12) { ds.push(Math.round(path[i]), Math.round(path[i + 1])); }
      this.data.bestEcho = ds; this.data.bestEchoTime = time; this.data.echoRecorded = true; this.save();
    }
  },
  getEcho() { return this.data.bestEcho; }
};
