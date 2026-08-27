/**
 * Seeded PRNG. Every placement decision in the game routes through here so the
 * same seed always builds the same mountain.
 */

/** mulberry32 — fast, well-distributed, 32-bit state. */
export function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string -> uint32. Used to turn a date string into a seed. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix two integers into a fresh uint32 — used for per-chunk sub-seeds. */
export function mixSeed(seed, n) {
  let h = (seed ^ Math.imul(n + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Today's daily seed, e.g. "2026-08-06" -> uint32. */
export function dailySeedString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(date = new Date()) {
  return hashString(dailySeedString(date));
}

/** Convenience wrapper with the helpers a generator actually wants. */
export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (lo, hi) => lo + r() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + r() * (hi - lo + 1)), // inclusive
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length)],
  };
}
