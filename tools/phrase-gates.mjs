/**
 * Phrase gates (Phase L5+) — the level-design layer, held to its contract.
 *
 * The chart may shape the real/fake pattern and pin the mutation family;
 * it may touch NOTHING else. These gates prove the authored DAILY course
 * is index-pure (the same course every day, every retry, every player),
 * that the word walk, spacing and tiers are byte-identical with the chart
 * on or off, that the balance stays near the shipped coin, and that the
 * teaching window survives every phrase.
 *
 *   node tools/phrase-gates.mjs
 */

import TUNING from '../src/TUNING.js';
import {
  DEFAULT_PROFILE, gateDistance, isRealGate, makeGate,
} from '../src/sim/word-gates.js';
import { DAILY_CHART, DAILY_CHART_LEN, phraseAt } from '../src/sim/phrases.js';

let PASS = 0, FAIL = 0;
const out = [];
function check(name, ok, detail = '') {
  if (ok) { PASS++; out.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; out.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
const head = (t) => out.push(`\n\x1b[1m${t}\x1b[0m`);

const daily = { ...DEFAULT_PROFILE, CHART: 'daily' };
const endless = { ...DEFAULT_PROFILE, CHART: 'endless' };

head('THE COURSE — one authored hundred, index-pure');

check('the daily chart covers exactly the route\'s hundred gates',
  DAILY_CHART_LEN === TUNING.MODES.RULES.standard.GATES,
  `${DAILY_CHART.length} phrases, ${DAILY_CHART_LEN} gates`);

{
  // Index-pure: the SAME course for every seed (every day, every retry,
  // every player) — only the words change under it.
  const a = [], b = [];
  for (let i = 0; i < 100; i++) {
    a.push(isRealGate(20260902, i, daily) ? 1 : 0);
    b.push(isRealGate(777777, i, daily) ? 1 : 0);
  }
  check('the daily course is a pure function of the gate index — seeds change words, never shape',
    a.join('') === b.join(''));
  check('the opening stays taught: gate 0 real, no fake run past two in the window',
    a[0] === 1 && !/000/.test(a.slice(0, TUNING.WORDS.OPENING_GATES).join('')));
  check('the autopilot punisher is where the chart says: three fakes then one plainly real',
    a.slice(38, 42).join('') === '0001');
  check('every breather is all real — the chain-rebuild is honoured',
    a.slice(14, 19).join('') === '11111' && a.slice(42, 47).join('') === '11111' &&
    a.slice(70, 75).join('') === '11111');
  const fakes = a.filter((v) => v === 0).length;
  check('the course balance stays near the shipped coin',
    fakes >= 40 && fakes <= 60, `${fakes} fakes in 100`);
}

{
  // The trap stretches pin their family for every gate in the phrase.
  const fams = (lo, hi) => {
    const s = new Set();
    for (let i = lo; i <= hi; i++) s.add(makeGate(20260902, i, daily).family);
    return s;
  };
  check('the transposition stretch is all transposition (25–29)',
    fams(25, 29).size === 1 && fams(25, 29).has(0));
  check('the vowel stretch is all vowel (53–57)',
    fams(53, 57).size === 1 && fams(53, 57).has(3));
  check('the double-letter stretch is all double (75–79)',
    fams(75, 79).size === 1 && fams(75, 79).has(1));
  check('the closing exam walks every family, pair by pair (90–99)',
    fams(90, 99).size === 4);
}

head('THE CONTRACT — shape only, nothing else moves');

{
  // The word walk is untouched: the same (seed, index) chooses the same
  // walked word with the chart on or off — the chart never reorders,
  // never substitutes, never advances a cursor.
  let same = true;
  for (let i = 0; i < 200; i += 7) {
    if (makeGate(8675309, i, daily).walked !== makeGate(8675309, i, endless).walked) same = false;
  }
  check('the word walk is byte-identical with the chart on or off', same);
  check('spacing and tiers never consult the chart',
    gateDistance(37) === gateDistance(37) &&
    makeGate(999, 37, daily).d === makeGate(999, 37, endless).d &&
    makeGate(999, 37, daily).tier === makeGate(999, 37, endless).tier);
}

head('ENDLESS — a seeded walk that opens gently and keeps the balance');

{
  const a = [], b = [];
  for (let i = 0; i < 500; i++) {
    a.push(isRealGate(111, i, endless) ? 1 : 0);
    b.push(isRealGate(222, i, endless) ? 1 : 0);
  }
  check('two seeds walk two different endless charts', a.join('') !== b.join(''));
  const a2 = [];
  for (let i = 0; i < 500; i++) a2.push(isRealGate(111, i, endless) ? 1 : 0);
  check('the walk is deterministic per seed', a.join('') === a2.join(''));
  check('every endless run still opens real and gently',
    a[0] === 1 && b[0] === 1 &&
    !/000/.test(a.slice(0, TUNING.WORDS.OPENING_GATES).join('')) &&
    !/000/.test(b.slice(0, TUNING.WORDS.OPENING_GATES).join('')));
  const fr = a.filter((v) => v === 0).length / a.length;
  check('the long-run balance stays near the shipped coin',
    fr >= 0.38 && fr <= 0.62, `${(fr * 100).toFixed(0)}% fakes over 500 gates`);
  // The endless breather test: over 500 gates a run of 5 straight reals
  // (a breather phrase) must appear somewhere — the walk really mixes.
  check('the walk deals real breathing room somewhere in a long run',
    /11111/.test(a.join('')) && /11111/.test(b.join('')));
}
void phraseAt;

// ── PD-1: the GUIDED opening (ENDLESS only) ──────────────────────────────
head('GUIDED — a teaching opening for the first-timer, never for the DAILY');
{
  let jitterFree = true, pinned = true, pattern = true, tailIdentical = true;
  for (const seed of [1, 4242, 999, 8675309]) {
    for (let i = 0; i < 6; i++) {
      const g = phraseAt(seed, i, 'guided');
      if (g.family !== 0) pinned = false;
      if (g.real !== (i % 3 !== 2)) pattern = false;
      const g2 = phraseAt(seed ^ 0x5a5a5a, i, 'guided');
      if (g2.real !== g.real || g2.family !== g.family) jitterFree = false;
    }
    for (let i = 6; i < 60; i++) {
      const a = phraseAt(seed, i, 'guided');
      const b = phraseAt(seed, i, 'endless');
      if (a.real !== b.real || a.family !== b.family) tailIdentical = false;
    }
  }
  check('the guided opening is authored, not drawn — identical on every seed',
    jitterFree && pattern, 'real real fake real real fake, the cadence shape');
  check('its fakes are pinned to transposition — the easiest family to see',
    pinned);
  check('past the opening the guided run IS the endless run, verdict for verdict',
    tailIdentical, '54 gates compared across four seeds');
  const dailySame = [0, 3, 25, 55, 90].every((i) => {
    const a = phraseAt(777, i, 'daily');
    const b = phraseAt(777, i, 'daily');
    return a.real === b.real && a.family === b.family;
  });
  check('and the DAILY never sees it — its course belongs to everyone equally',
    dailySame &&
    /GATES > 0 \? 'daily' : \(opts\.chart \|\| 'endless'\)/.test(
      (await import('node:fs')).readFileSync('src/sim/sim.js', 'utf8')),
    'the sim clamps any chart request to daily on a routed run');
}

console.log(out.join('\n'));
console.log(`\nPhrase gates: ${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
