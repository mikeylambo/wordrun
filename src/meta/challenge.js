/**
 * Challenge links (Phase 14) — the async-social hook the deterministic
 * core has been promising since Phase 2.
 *
 * A challenge is nothing but coordinates: the seed string authors the
 * track, the mode/difficulty pick the rules, the word salt pins the
 * exact vocabulary lane, and the goal is the score to beat. Encode
 * them in a URL and anyone who opens it is standing at the start of the
 * SAME run — same road, same bells, same gauntlet of words — with a
 * number to chase. No server, no account, no network call: the link IS
 * the data.
 *
 * Pure module: no DOM, no sim imports, caller supplies the location
 * pieces. Tools import it directly and assert the round trip.
 */

import TUNING from '../TUNING.js';

/** Query keys, deliberately short and stable — links get typed out loud. */
// `score` replaces the old `goal` (a distance) in Phase 25. A link carrying
// the retired key is read as having no target rather than a trivial one.
// RC9.2 adds `bar`: the compression level the challenger played at. Two runs
// at different bars are not the same dare — the bar changes both the reward
// line and what counts as an early read — so it travels with the mode and the
// difficulty, and a challenge run STARTS there. It is not locked afterwards:
// the bar is the one dial that belongs to the player, and a link that took it
// away would be a rule, not a coordinate.
// RC10.5 adds `ghost`: the challenger's RUN, as link-sized speeds (see
// meta/ghost-link.js). A number is a poor opponent — what a player wants to
// know is whether they are ahead, and only a second runner on the same road
// answers that. It is the last key on purpose: it is by far the longest, and a
// link truncated by a chat client loses the rival rather than the coordinates.
const KEYS = {
  seed: 'draft', mode: 'mode', difficulty: 'diff', salt: 'salt', goal: 'score', bar: 'bar',
  ghost: 'g',
};

/** base64url, and nothing else — the alphabet meta/ghost-link.js writes. */
const GHOST_RE = /^[A-Za-z0-9_-]+$/;
/** 180 s at 2 Hz is 360 bytes; 4/3 of that, rounded up, is the character cap. */
const GHOST_MAX_CHARS = 480;

/** The bar's own ceiling, read from the tuning that defines the levels. */
const MAX_BAR = TUNING.WORDS.COMPRESSION_MULT.length - 1;

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
  const goal = clampInt(params.get(KEYS.goal), 0, 0, 99999999);
  const bar = clampInt(params.get(KEYS.bar), 0, 0, MAX_BAR);
  // The rival, if one travelled. Anything malformed or over-long is simply not
  // a rival: the link still opens on the right road with the right target,
  // which is what a challenge was before RC10.5 and still is without this.
  const raw = (params.get(KEYS.ghost) || '').trim();
  const ghost = raw && raw.length <= GHOST_MAX_CHARS && GHOST_RE.test(raw) ? raw : null;
  return { seedString, mode, difficulty, salt, goal, bar, ghost };
}

/**
 * Build the shareable link. `base` is origin+pathname (no query); the
 * caller passes its own location so this stays pure and testable.
 */
export function buildChallengeLink(base,
  { seedString, mode, difficulty, salt, goal, bar, ghost }) {
  const params = new URLSearchParams();
  params.set(KEYS.seed, String(seedString));
  if (MODES.includes(mode) && mode !== 'endless') params.set(KEYS.mode, mode);
  if (DIFFICULTIES.includes(difficulty) && difficulty !== 'normal') {
    params.set(KEYS.difficulty, difficulty);
  }
  const s = clampInt(salt, 1, 1, 9999);
  if (s !== 1) params.set(KEYS.salt, String(s));
  const g = clampInt(goal, 0, 0, 99999999);
  if (g > 0) params.set(KEYS.goal, String(g));
  const b = clampInt(bar, 0, 0, MAX_BAR);
  if (b > 0) params.set(KEYS.bar, String(b));
  // Last, and only when it is well-formed and inside the cap. A link that
  // cannot carry the rival is still a perfectly good challenge.
  if (typeof ghost === 'string' && ghost && ghost.length <= GHOST_MAX_CHARS
    && GHOST_RE.test(ghost)) params.set(KEYS.ghost, ghost);
  return `${base}?${params.toString()}`;
}

function clampInt(raw, fallback, lo, hi) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export const CHALLENGE_GHOST = { MAX_CHARS: GHOST_MAX_CHARS, RE: GHOST_RE };

export default { parseChallenge, buildChallengeLink };
