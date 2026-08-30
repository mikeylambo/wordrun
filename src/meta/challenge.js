/**
 * Challenge links (Phase 14) — the async-social hook the deterministic
 * core has been promising since Phase 2.
 *
 * A challenge is nothing but coordinates: the seed string authors the
 * track, the mode/difficulty pick the rules, the word salt pins the
 * exact vocabulary lane, and the goal is the distance to beat. Encode
 * them in a URL and anyone who opens it is standing at the start of the
 * SAME run — same road, same bells, same gauntlet of words — with a
 * number to chase. No server, no account, no network call: the link IS
 * the data.
 *
 * Pure module: no DOM, no sim imports, caller supplies the location
 * pieces. Tools import it directly and assert the round trip.
 */

/** Query keys, deliberately short and stable — links get typed out loud. */
const KEYS = { seed: 'draft', mode: 'mode', difficulty: 'diff', salt: 'salt', goal: 'goal' };

const MODES = ['endless', 'standard'];
const DIFFICULTIES = ['easy', 'normal', 'hard'];

/**
 * Parse a query string (with or without the leading '?').
 * Returns null unless a plausible challenge is present; every field is
 * validated and defaulted so a mangled link degrades to a playable run
 * instead of a broken one.
 */
export function parseChallenge(search) {
  let params;
  try { params = new URLSearchParams(String(search ?? '')); } catch { return null; }
  const seedString = (params.get(KEYS.seed) || '').trim();
  // The seed string is the track's name: printable, short, no spaces.
  if (!seedString || seedString.length > 48 || /\s/.test(seedString)) return null;

  const mode = MODES.includes(params.get(KEYS.mode)) ? params.get(KEYS.mode) : 'endless';
  const difficulty = DIFFICULTIES.includes(params.get(KEYS.difficulty))
    ? params.get(KEYS.difficulty) : 'normal';
  const salt = clampInt(params.get(KEYS.salt), 1, 1, 9999);
  const goal = clampInt(params.get(KEYS.goal), 0, 0, 999999);
  return { seedString, mode, difficulty, salt, goal };
}

/**
 * Build the shareable link. `base` is origin+pathname (no query); the
 * caller passes its own location so this stays pure and testable.
 */
export function buildChallengeLink(base, { seedString, mode, difficulty, salt, goal }) {
  const params = new URLSearchParams();
  params.set(KEYS.seed, String(seedString));
  if (MODES.includes(mode) && mode !== 'endless') params.set(KEYS.mode, mode);
  if (DIFFICULTIES.includes(difficulty) && difficulty !== 'normal') {
    params.set(KEYS.difficulty, difficulty);
  }
  const s = clampInt(salt, 1, 1, 9999);
  if (s !== 1) params.set(KEYS.salt, String(s));
  const g = clampInt(goal, 0, 0, 999999);
  if (g > 0) params.set(KEYS.goal, String(g));
  return `${base}?${params.toString()}`;
}

function clampInt(raw, fallback, lo, hi) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export default { parseChallenge, buildChallengeLink };
