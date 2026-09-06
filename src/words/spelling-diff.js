/**
 * Where the fake and the real word part company.
 *
 * Every fake this game shows is exactly ONE edit from its source — the four
 * mutation families in wordlist.js are transpose-adjacent, double-a-letter,
 * drop-a-letter and substitute-a-vowel, and `makeFake` never composes two. So
 * the difference between the pair is always a single contiguous span, and
 * finding it needs no edit-distance table: trim the common prefix, trim the
 * common suffix, and whatever is left in the middle IS the edit.
 *
 * That matters for the review panel, which is the one screen in the game that
 * teaches rather than scores. "recieve / receive" is a row a player has to
 * read twice; "rec[ie]ve / rec[ei]ve" is a row they read once. The whole
 * point is to make the edit impossible to miss, so the marks are exact:
 * exactly the letters that moved, never a fuzzy highlight over the region.
 *
 * A doubled or dropped letter leaves one side's span EMPTY, which is correct
 * and is not an error — the caller draws a gap mark there ("a letter belongs
 * here" / "this letter should not be here"). `marks` counts the letters
 * actually painted across the pair and is never zero for a real edit, which
 * is what the gate asserts.
 *
 * Pure: two strings in, spans out. No DOM, no imports, no tuning.
 */

/**
 * @param {string} fake  the misspelling as it was shown
 * @param {string} real  the true spelling
 * @returns {{fake:{pre:string,mark:string,post:string},
 *            real:{pre:string,mark:string,post:string},
 *            marks:number}|null}
 *   null when either side is missing or the two are identical — a slipped
 *   REAL word has no fake to contrast, and a row for it shows one spelling.
 */
export function diffSpelling(fake, real) {
  const a = String(fake ?? '').toLowerCase();
  const b = String(real ?? '').toLowerCase();
  if (!a || !b || a === b) return null;

  // Longest common prefix.
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;

  // Longest common suffix, clamped so the two spans cannot overlap the
  // prefix on either side — without the clamp, a word like 'sees' would
  // count the same letter twice and produce a negative middle.
  let s = 0;
  while (s < a.length - p && s < b.length - p &&
    a[a.length - 1 - s] === b[b.length - 1 - s]) s++;

  const out = {
    fake: { pre: a.slice(0, p), mark: a.slice(p, a.length - s), post: a.slice(a.length - s) },
    real: { pre: b.slice(0, p), mark: b.slice(p, b.length - s), post: b.slice(b.length - s) },
  };
  out.marks = out.fake.mark.length + out.real.mark.length;
  return out;
}

export default diffSpelling;
