/**
 * Extended fake-guard builder (Phase 13) — writes src/words/guard.js.
 *
 * The guard is the COMPLETE collision set for the fake generator: every
 * string its mutation classes (deletion, adjacent swap, letter doubling,
 * any single-letter substitution) can produce from any shipped bank word,
 * intersected with real English (the ENABLE list via the
 * an-array-of-english-words dev dependency), minus the bank itself.
 * Because fakes are always exactly one such edit from a bank word, this
 * set provably contains every real word a fake could ever land on — the
 * 'gray' -> 'grey' class, closed by construction.
 *
 * Rerun after ANY bank change:  node tools/build-guard.mjs
 */

import fs from 'node:fs';
import words from 'an-array-of-english-words' with { type: 'json' };
const { ALL_WORDS } = await import('../src/words/wordlist.js');

const dict = new Set(words);
const VALID = new Set(ALL_WORDS);
const guard = new Set();
const letters = 'abcdefghijklmnopqrstuvwxyz';
for (const w of ALL_WORDS) {
  for (let i = 0; i < w.length; i++) {
    if (w.length > 3) {
      const del = w.slice(0, i) + w.slice(i + 1);
      if (dict.has(del) && !VALID.has(del)) guard.add(del);
    }
    if (i < w.length - 1 && w[i] !== w[i + 1]) {
      const swap = w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
      if (dict.has(swap) && !VALID.has(swap)) guard.add(swap);
    }
    const dbl = w.slice(0, i + 1) + w[i] + w.slice(i + 1);
    if (dict.has(dbl) && !VALID.has(dbl)) guard.add(dbl);
    for (const c of letters) {
      if (c === w[i]) continue;
      const sub = w.slice(0, i) + c + w.slice(i + 1);
      if (dict.has(sub) && !VALID.has(sub)) guard.add(sub);
    }
  }
}
const sorted = [...guard].sort();
const body = sorted.map((w) => `'${w}',`).join(' ').replace(/(.{76}) /g, '$1\n  ');
fs.writeFileSync('src/words/guard.js', `/**
 * GENERATED extended fake-guard — GUARD DATA, NOT CONTENT. Do not hand-edit.
 *
 * The complete collision set for the fake generator: every real English
 * word (ENABLE list) reachable from any shipped bank word by one of the
 * generator's mutation classes. A fake can NEVER be one of these, so a
 * correct read is never punished by generator luck. None of this is
 * playable vocabulary. Regenerate after bank changes:
 * node tools/build-guard.mjs  (${sorted.length} words)
 */

export const EXTENDED_GUARD = [
  ${body}
];
`);
console.log('guard.js written:', sorted.length, 'collision words');
