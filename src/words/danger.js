/**
 * How dangerous a word is to read under time pressure.
 *
 * The brief defers the full version until a board exists, because the honest
 * version of this number is "how often do OTHER people miss it" and there is
 * no aggregate to ask yet. What can be computed today is the half that needs
 * nobody: the structural traps a misspelling can hide in. A word with a
 * doubled letter, an adjacent vowel pair or one of the suffixes English cannot
 * make up its mind about is a word where a single edit is genuinely hard to
 * see — and that is a property of the word, not of the population.
 *
 * The local ledger supplies the other half for the one player it knows about.
 * Blending them gives a usable rating now and a slot for real telemetry later:
 * when the board lands, the aggregate replaces `local` and nothing else moves.
 */

// Suffixes English is not consistent about, where one letter decides it.
const TRAP_SUFFIXES = ['able', 'ible', 'ance', 'ence', 'ant', 'ent',
  'tion', 'sion', 'cian', 'ary', 'ery', 'ory', 'ally', 'ely'];

/** 0..1 from the word's own shape. Pure, and needs no player at all. */
export function structuralDanger(word) {
  const w = String(word || '').toLowerCase();
  if (w.length < 3) return 0;
  let d = 0;

  // Length: more letters, more places for one edit to hide.
  d += Math.min(0.30, (w.length - 4) * 0.045);

  // A doubled letter — the single richest source of real misspellings, both
  // because one can be dropped and because one can be added elsewhere.
  if (/(.)\1/.test(w)) d += 0.22;

  // Adjacent vowels: ie/ei/ai/ea and friends, where a transposition is almost
  // invisible at speed.
  const vowelRuns = w.match(/[aeiou]{2,}/g) || [];
  d += Math.min(0.24, vowelRuns.length * 0.12);

  // A trap suffix.
  if (TRAP_SUFFIXES.some((s) => w.endsWith(s))) d += 0.18;

  // Letter PAIRS that resolve as a different single glyph under motion: rn
  // reads as m, cl as d, vv as w. Testing for the letters individually — as
  // this did first — matched almost every word in the bank and was a constant
  // offset wearing a signal's clothes.
  if (/rn|cl|vv|ii/.test(w)) d += 0.06;

  return Math.max(0, Math.min(1, d));
}

/**
 * The shipped rating. `evidence` is optional and comes from the local ledger:
 * { a, m } attempts and misses. It is only trusted once there is enough of it
 * — a single miss is an accident, not a rating.
 */
export function dangerFor(word, evidence = null) {
  const structural = structuralDanger(word);
  const attempts = evidence?.a | 0;
  if (attempts < 3) return structural;
  const local = Math.max(0, Math.min(1, (evidence.m | 0) / attempts));
  // Confidence grows with attempts and never reaches certainty on one player.
  const weight = Math.min(0.6, attempts / 20);
  return structural * (1 - weight) + local * weight;
}

/** A coarse band, for anywhere a number would be noise. */
export function dangerBand(d) {
  return d >= 0.62 ? 'high' : d >= 0.34 ? 'mid' : 'low';
}

export default dangerFor;
