/**
 * localStorage — best distance, replay ghost, and tiny player preferences.
 * Everything is namespaced and defensive: storage failure may remove optional
 * conveniences, never the run itself.
 */

const NS = 'wordrun.v1';
const ONBOARDING_VERSION = 'rc9';
const key = (k) => `${NS}.${k}`;

// Mode/difficulty variant (Phase 10): bests, run counts and ghosts are
// scoped per variant so an EASY run can never claim the STANDARD board.
// The default combination keeps the legacy key shape, so every best and
// ghost recorded before modes existed stays exactly where it was.
let VARIANT = '';
const vkey = (type, seed) => `${type}.${seed}${VARIANT ? `.${VARIANT}` : ''}`;

function safeGet(k) {
  try { return localStorage.getItem(key(k)); } catch { return null; }
}
function safeSet(k, v) {
  try { localStorage.setItem(key(k), v); return true; } catch { return false; }
}
function safeRemove(k) {
  try { localStorage.removeItem(key(k)); } catch { /* nothing to do */ }
}

export const Storage = {
  /** Select the mode/difficulty variant all seed-scoped reads/writes use.
   *  '' = the legacy default (endless + normal). */
  setVariant(v) { VARIANT = String(v || ''); },
  variant() { return VARIANT; },

  modePref() { return safeGet('pref.mode') || 'endless'; },
  setModePref(m) { return safeSet('pref.mode', String(m)); },
  difficultyPref() { return safeGet('pref.difficulty') || 'normal'; },
  setDifficultyPref(d) { return safeSet('pref.difficulty', String(d)); },

  available() {
    try {
      const probe = key('__probe');
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch { return false; }
  },

  bestFor(seed) {
    const v = Number(safeGet(vkey('best', seed)));
    return Number.isFinite(v) && v > 0 ? v : 0;
  },

  setBestFor(seed, distance) {
    const d = Math.floor(distance);
    if (d <= this.bestFor(seed)) return false;
    safeSet(vkey('best', seed), String(d));
    if (d > this.bestAllTime()) safeSet('best.all', String(d));
    return true;
  },

  bestAllTime() {
    const v = Number(safeGet('best.all'));
    return Number.isFinite(v) && v > 0 ? v : 0;
  },

  runsToday(seed) {
    const v = Number(safeGet(vkey('runs', seed)));
    return Number.isFinite(v) && v > 0 ? v : 0;
  },

  bumpRuns(seed) {
    const n = this.runsToday(seed) + 1;
    safeSet(vkey('runs', seed), String(n));
    return n;
  },

  // Onboarding is remembered per release instead of forever. A player who saw
  // RC7 instructions will see the RC9 card once, then returning runs skip it.
  onboardingSeen(version = ONBOARDING_VERSION) {
    return safeGet(`pref.onboarding.${version}`) === '1';
  },

  setOnboardingSeen(seen = true, version = ONBOARDING_VERSION) {
    return safeSet(`pref.onboarding.${version}`, seen ? '1' : '0');
  },

  ghostEnabled() {
    const raw = safeGet('pref.ghost');
    return raw == null ? true : raw !== '0';
  },

  setGhostEnabled(enabled) {
    return safeSet('pref.ghost', enabled ? '1' : '0');
  },

  /** Your best run on this seed, or null. */
  loadGhost(seed) {
    const raw = safeGet(vkey('ghost', seed));
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.s) || data.s.length < 5) return null;
      return data;
    } catch {
      safeRemove(vkey('ghost', seed));
      return null;
    }
  },

  /** Only keep a ghost if it beat the one already stored. */
  saveGhostIfBest(seed, data) {
    const existing = this.loadGhost(seed);
    if (existing && existing.distance >= data.distance) return false;
    const ok = safeSet(vkey('ghost', seed), JSON.stringify(data));
    if (!ok) {
      this.pruneOldSeeds(seed);
      return safeSet(vkey('ghost', seed), JSON.stringify(data));
    }
    return true;
  },

  pruneOldSeeds(keepSeed) {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(`${NS}.ghost.`)) continue;
        if (!k.startsWith(`${NS}.ghost.${keepSeed}`)) doomed.push(k);
      }
      for (const k of doomed) localStorage.removeItem(k);
    } catch { /* nothing to do */ }
  },
};

export default Storage;
