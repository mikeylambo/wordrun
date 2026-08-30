/**
 * FAMILY GATE — word-bank content safety, machine-enforced.
 *
 * General-audience framing is a hard platform-eligibility requirement for
 * DICTION DASH, and until now it was the one invariant in this codebase kept
 * by hand. The approved-name cap, the Redline's exclusive red, the one-edit
 * fake-collision guard are all gated; the words themselves were not.
 *
 * Two surfaces are checked, and the second is the one hand curation cannot
 * see: the shipped bank, and EVERY misspelling the fake generator can reach
 * from it. `makeFake` is a bounded search over four mutations at every
 * position plus a last-resort substitution sweep, so the reachable set is
 * finite and enumerable — which means a mutation landing somewhere ugly is a
 * build failure rather than a screenshot.
 *
 *   node tools/family-gate.mjs
 */
import fs from 'node:fs';
import { TIERS, makeFake } from '../src/words/wordlist.js';
import { isBlocked } from '../src/words/family-blocklist.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const head = (t) => console.log(`\n${t}`);

// ── The list ────────────────────────────────────────────────────────────────
const RAW = fs.readFileSync(new URL('./family-content-blocklist.txt', import.meta.url), 'utf8');
const rules = { exact: [], part: [], safe: [] };
const malformed = [];
RAW.split('\n').forEach((line, n) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const m = /^(exact|part|safe)\s+([a-z]+)$/.exec(t);
  if (!m) { malformed.push(`line ${n + 1}: ${t}`); return; }
  rules[m[1]].push(m[2]);
});

head('LIST — the blocklist itself is well formed');
check('every line parses as `exact|part|safe <lowercase term>`',
  malformed.length === 0, malformed.slice(0, 3).join(' | ') || `${RAW.split('\n').length} lines`);
for (const kind of ['exact', 'part', 'safe']) {
  const dupes = rules[kind].filter((t, i) => rules[kind].indexOf(t) !== i);
  check(`no duplicate \`${kind}\` entries`, dupes.length === 0,
    dupes.slice(0, 3).join(', ') || `${rules[kind].length} terms`);
}
check('the list is not empty in any category',
  rules.exact.length > 50 && rules.part.length > 5 && rules.safe.length > 10,
  `${rules.exact.length} exact / ${rules.part.length} part / ${rules.safe.length} safe`);

const EXACT = new Set(rules.exact);
const hits = (word) => {
  if (EXACT.has(word)) return `exact:${word}`;
  for (const p of rules.part) if (word.includes(p)) return `part:${p}`;
  return null;
};

// ── The controls ────────────────────────────────────────────────────────────
// The `part` rules are the dangerous kind — 'ass' inside 'class' is the
// classic false positive — so ordinary vocabulary proves them honest. This
// runs BEFORE the bank scan on purpose: a `part` rule that swallows real
// words would otherwise report as a content failure and mislead whoever
// added it.
head('CONTROLS — the substring rules do not swallow ordinary words');
const swallowed = rules.safe.map((w) => [w, hits(w)]).filter(([, h]) => h);
check('no control word matches any rule', swallowed.length === 0,
  swallowed.map(([w, h]) => `${w} <- ${h}`).slice(0, 5).join(' | ')
    || `${rules.safe.length} controls clean`);

// ── The shipped bank ────────────────────────────────────────────────────────
head('BANK — every shipped word clears the list');
const bank = TIERS.flat();
const bankHits = bank.map((w) => [w, hits(w)]).filter(([, h]) => h);
check('no shipped word is blocked', bankHits.length === 0,
  bankHits.map(([w, h]) => `${w} <- ${h}`).slice(0, 8).join(' | ')
    || `${bank.length} words across ${TIERS.length} tiers`);

// ── Generated module is in sync ─────────────────────────────────────────────
head('SYNC — the shipped list matches the maintained one');
const gen = fs.readFileSync(new URL('../src/words/family-blocklist.js', import.meta.url), 'utf8');
// Parse only inside the two array literals — the file's own header quotes
// example words ('clock', 'grape') that are not entries.
const lit = (name, open, close) => {
  const i = gen.indexOf(name);
  const a = gen.indexOf(open, i), b = gen.indexOf(close, a);
  return [...gen.slice(a, b).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
};
const genExact = [...lit('export const BLOCKED_EXACT', '[', ']'),
  ...lit('export const BLOCKED_PART', '[', ']')];
const wantAll = [...new Set([...rules.exact, ...rules.part])].sort();
const haveAll = [...new Set(genExact)].sort();
check('src/words/family-blocklist.js is regenerated from the .txt',
  wantAll.length === haveAll.length && wantAll.every((w, i) => w === haveAll[i]),
  wantAll.length === haveAll.length ? `${wantAll.length} terms in sync`
    : `run: node tools/build-family-blocklist.mjs (${haveAll.length} shipped vs ${wantAll.length} listed)`);
check('the runtime predicate agrees with this gate on every listed term',
  [...rules.exact, ...rules.part].every((t) => isBlocked(t)) &&
  rules.safe.every((w) => !isBlocked(w)));

// ── Every reachable fake ────────────────────────────────────────────────────
// The risk hand curation cannot see: makeFake mutates a real word one edit at
// a time, so 'clock' reaches 'cock' and 'grape' reaches 'rape' without anyone
// authoring either. Two checks — the size of the raw risk surface, and an
// end-to-end sweep proving the shipped generator never returns one.
head('FAKES — the generator can never return a blocked string');
const VOWELS = 'aeiou';
const MUTATIONS = [
  (w, i) => (i < w.length - 1 && w[i] !== w[i + 1]
    ? w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) : null),
  (w, i) => w.slice(0, i + 1) + w[i] + w.slice(i + 1),
  (w, i) => (w.length > 3 ? w.slice(0, i) + w.slice(i + 1) : null),
  (w, i) => {
    const c = w[i];
    if (!VOWELS.includes(c)) return null;
    const alt = VOWELS[(VOWELS.indexOf(c) + 1 + Math.floor(i / 2)) % VOWELS.length];
    return alt === c ? null : w.slice(0, i) + alt + w.slice(i + 1);
  },
];

const risky = [];
let reachable = 0;
for (const w of bank) {
  for (const m of MUTATIONS) {
    for (let i = 0; i < w.length; i++) {
      const f = m(w, i);
      if (!f) continue;
      reachable++;
      if (hits(f)) risky.push(`${w}→${f}`);
    }
  }
  for (let i = w.length - 1; i >= 0; i--) {
    for (const c of 'zxqjkvw') {
      if (w[i] === c) continue;
      reachable++;
      const f = w.slice(0, i) + c + w.slice(i + 1);
      if (hits(f)) risky.push(`${w}→${f}`);
    }
  }
}
// This one is expected to be non-zero and is not a failure — it is the reason
// the runtime rejection exists. What must hold is that every single one of
// them is refused, which the sweep below proves.
console.log(`  \x1b[36mNOTE\x1b[0m  ${reachable.toLocaleString('en-US')} mutations reachable; ` +
  `${risky.length} would be blocked (e.g. ${risky.slice(0, 4).join(', ')})`);
check('every risky mutation is caught by the runtime predicate',
  risky.length > 0 && risky.every((r) => isBlocked(r.split('→')[1])),
  `${risky.length} refusals the generator must make`);

// End-to-end: run the SHIPPED generator over the whole bank on several
// deterministic rand streams, including the degenerate ones that force the
// exhaustive sweep and the last-resort substitution path.
const STREAMS = [
  ['zero', () => 0],
  ['one', () => 0.9999999],
  ['mid', () => 0.5],
];
let lcg = 1;
STREAMS.push(['lcg', () => { lcg = (lcg * 1664525 + 1013904223) >>> 0; return lcg / 4294967296; }]);

const escaped = [];
let produced = 0;
for (const [, rand] of STREAMS) {
  for (const w of bank) {
    const f = makeFake(w, rand);
    produced++;
    if (isBlocked(f)) escaped.push(`${w} → ${f}`);
  }
}
check('the shipped generator never returns a blocked fake', escaped.length === 0,
  escaped.slice(0, 6).join(' | ')
    || `${produced.toLocaleString('en-US')} fakes over ${STREAMS.length} rand streams`);

console.log(`\nFamily gates: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
