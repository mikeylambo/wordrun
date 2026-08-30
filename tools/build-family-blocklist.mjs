/**
 * Generate src/words/family-blocklist.js from tools/family-content-blocklist.txt.
 *
 * The .txt is the maintained source of truth (comments, categories, the
 * Scunthorpe controls); the .js is what ships, so the fake generator can
 * refuse a blocked mutation at runtime rather than only failing a build.
 * `tools/family-gate.mjs` asserts the two are in sync, so an edit to the
 * list that is never regenerated fails the build.
 *
 *   node tools/build-family-blocklist.mjs
 */
import fs from 'node:fs';

const RAW = fs.readFileSync(new URL('./family-content-blocklist.txt', import.meta.url), 'utf8');
const exact = [], part = [];
for (const line of RAW.split('\n')) {
  const m = /^(exact|part)\s+([a-z]+)$/.exec(line.trim());
  if (!m) continue;
  (m[1] === 'exact' ? exact : part).push(m[2]);
}
exact.sort(); part.sort();

const wrap = (arr) => {
  const out = [];
  let line = ' ';
  for (const w of arr) {
    const t = ` '${w}',`;
    if (line.length + t.length > 76) { out.push(line); line = ' '; }
    line += t;
  }
  if (line.trim()) out.push(line);
  return out.join('\n');
};

const src = `/**
 * GENERATED — do not edit. Source: tools/family-content-blocklist.txt
 * Regenerate with: node tools/build-family-blocklist.mjs
 *
 * General-audience framing is a hard platform-eligibility requirement, and
 * the fake generator mutates real words one edit at a time — so 'clock' can
 * reach 'cock' and 'grape' can reach 'rape' without anyone authoring it.
 * makeFake() consults these two lists in its rejection predicate, alongside
 * the real-word guard, so a blocked string is never returned as a fake.
 *
 * BLOCKED_EXACT rejects the whole string; BLOCKED_PART rejects any string
 * containing it, and is reserved for terms that cannot be innocent (the
 * Scunthorpe controls that keep that list honest live in the .txt and are
 * enforced by tools/family-gate.mjs).
 */

export const BLOCKED_EXACT = new Set([
${wrap(exact)}
]);

export const BLOCKED_PART = [
${wrap(part)}
];

/** True when a candidate string may not be shown to a player. */
export function isBlocked(word) {
  if (BLOCKED_EXACT.has(word)) return true;
  for (const p of BLOCKED_PART) if (word.includes(p)) return true;
  return false;
}

export default isBlocked;
`;

fs.writeFileSync(new URL('../src/words/family-blocklist.js', import.meta.url), src);
console.log(`family-blocklist.js written — ${exact.length} exact, ${part.length} part`);
