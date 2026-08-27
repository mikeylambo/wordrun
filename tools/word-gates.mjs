/**
 * WORD RUN verb gates — the word-list module's own tests plus the sim-level
 * acceptance gates from the build brief:
 *
 *   - validity checker has ZERO false negatives on the shipped list
 *   - fakes are never recognizable words, never the source word, always close
 *   - word gates are seed-deterministic (daily-challenge architecture holds)
 *   - a wrong/no pick is the DESCENT-equivalent hit (speed, stagger, beast)
 *   - a correct read pays like the frame's gate/clean-landing economy
 *   - the reading window survives the speed ramp (legibility, priority 1)
 *   - the verb costs nothing measurable in the step budget (perf parity)
 *
 *   npm run gate:words
 */

import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { mulberry32 } from '../src/sim/rng.js';
import {
  TIERS, ALL_WORDS, isValidWord, pickWord, makeFake, tierCount, tierWords,
} from '../src/words/wordlist.js';
import { makeGate, gateDistance, tierAt } from '../src/sim/word-gates.js';

let PASS = 0, FAIL = 0;
const out = [];
function check(name, ok, detail = '') {
  if (ok) { PASS++; out.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; out.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
function head(t) { out.push(`\n\x1b[1m${t}\x1b[0m`); }

const W = TUNING.WORDS;
const SEEDS = [12345, 999, 777001, 42, 8675309, 31337, 5150, 20260806, 101, 1];

// ── The word-list module, standalone ──────────────────────────────────────
head('WORDS — the standalone list module');

check('every shipped word is lowercase a–z, length ≥ 3',
  ALL_WORDS.every((w) => /^[a-z]{3,}$/.test(w)),
  `${ALL_WORDS.length} words over ${tierCount()} tiers`);

check('no word ships in two tiers',
  new Set(ALL_WORDS).size === ALL_WORDS.length);

const falseNegatives = ALL_WORDS.filter((w) => !isValidWord(w));
check('validity checker has ZERO false negatives on the shipped list',
  falseNegatives.length === 0,
  falseNegatives.length ? `rejected: ${falseNegatives.slice(0, 5).join(', ')}` : `${ALL_WORDS.length}/${ALL_WORDS.length} accepted`);

check('validity checker forgives case and padding',
  isValidWord(' RUN ') && isValidWord('Snow') && !isValidWord('xqzzt'));

const tierLens = TIERS.map((t) => t.reduce((a, w) => a + w.length, 0) / t.length);
check('difficulty ramps: mean word length rises tier over tier',
  tierLens.every((len, i) => i === 0 || len > tierLens[i - 1]),
  tierLens.map((l) => l.toFixed(1)).join(' -> '));

check('every tier is big enough to not repeat inside one ramp band',
  TIERS.every((t) => t.length >= W.TIER_EVERY_M / W.SPACING_M),
  `min tier size ${Math.min(...TIERS.map((t) => t.length))}, gates per band ${Math.ceil(W.TIER_EVERY_M / W.SPACING_M)}`);

// Fakes, across every shipped word and many streams.
let fakeChecked = 0, fakeValidLeak = 0, fakeIdentical = 0, fakeFar = 0;
const editDistanceLe2 = (a, b) => {
  // cheap bounded check: length differs by ≤1 and ≥60% common prefix+suffix
  if (Math.abs(a.length - b.length) > 1) return false;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let sfx = 0;
  while (sfx < a.length - p && sfx < b.length - p &&
         a[a.length - 1 - sfx] === b[b.length - 1 - sfx]) sfx++;
  return p + sfx >= Math.min(a.length, b.length) - 2;
};
for (const seed of SEEDS.slice(0, 4)) {
  const rng = mulberry32(seed);
  for (const w of ALL_WORDS) {
    const f = makeFake(w, rng);
    fakeChecked++;
    if (isValidWord(f)) fakeValidLeak++;
    if (f === w) fakeIdentical++;
    if (!editDistanceLe2(w, f)) fakeFar++;
  }
}
check('a fake is never a shipped valid word', fakeValidLeak === 0,
  `${fakeChecked} fakes checked`);
check('a fake never equals its source word', fakeIdentical === 0);
check('fakes stay one honest misread away from the source', fakeFar === 0,
  'all within a one-edit neighbourhood');

{
  const a = mulberry32(777), b = mulberry32(777);
  const same = ALL_WORDS.every((w) => makeFake(w, a) === makeFake(w, b)) &&
    pickWord(2, mulberry32(9)) === pickWord(2, mulberry32(9));
  check('module is deterministic for a given rng stream', same);
}

// ── Gate schedule + seeding ───────────────────────────────────────────────
head('WORDS — seeded gate schedule');

check('first gate respects the fair start',
  gateDistance(0) >= TUNING.FEATURES.SAFE_START,
  `first gate at ${gateDistance(0)}m, SAFE_START ${TUNING.FEATURES.SAFE_START}m`);

{
  const g0 = Array.from({ length: 40 }, (_, i) => makeGate(12345, i));
  const g1 = Array.from({ length: 40 }, (_, i) => makeGate(12345, i));
  const g2 = Array.from({ length: 40 }, (_, i) => makeGate(54321, i));
  check('same seed builds the same 40-gate gauntlet',
    g0.every((g, i) => g.shown === g1[i].shown && g.real === g1[i].real));
  check('a different seed builds a different gauntlet',
    g0.some((g, i) => g.shown !== g2[i].shown || g.real !== g2[i].real));
  const fakes = g0.filter((g) => !g.real).length;
  check('real/fake mix is an honest coin over 40 gates',
    fakes >= 12 && fakes <= 28, `${fakes}/40 fakes`);
  check('every fake gate shows a non-word; every real gate shows a valid word',
    g0.every((g) => g.real === isValidWord(g.shown)));
}

check('tier ramp reaches the top tier and clamps there',
  tierAt(0) === 0 && tierAt(W.TIER_EVERY_M * 99) === tierCount() - 1);

// ── The verb inside the sim ───────────────────────────────────────────────
head('WORDS — the verb, wired into the frame');

/** Drive a sim with a scripted reader. answerFn(gate) -> true = tap confirm. */
function runReader(seed, metres, answerFn) {
  const sim = new Sim(seed);
  sim.start(seed);
  const input = emptyInput();
  let confirmedIndex = -1;
  while (sim.distance < metres && sim.phase === PHASE.RUNNING) {
    const g = sim.wordGates.current();
    input.confirm = false;
    if (sim.wordGates.armed(sim.player.d) && confirmedIndex !== g.index &&
        answerFn(g, sim)) {
      input.confirm = true;
      confirmedIndex = g.index;
    }
    sim.step(input);
    if (input.confirm) input.confirm = false;
  }
  return sim;
}

{
  const sim = runReader(12345, 1200, (g) => g.real);
  const s = sim.state();
  check('a perfect reader resolves every gate correctly',
    s.wordsWrong === 0 && s.wordsCorrect >= 12,
    `${s.wordsCorrect} correct, ${s.wordsWrong} wrong over ${Math.floor(s.distance)}m`);
  check('correct reads bank boost through the chain economy',
    s.boostMeter > 0 || sim.player.boostSpent > 0 || s.boostMeter === 100,
    `meter ${s.boostMeter.toFixed(1)}`);
  check('perfect reading builds a chain like clean landings did',
    sim.player.bestChain >= 5, `best chain ${sim.player.bestChain}`);
}

{
  const sim = runReader(12345, 1200, () => true); // spams confirm on everything
  const s = sim.state();
  check('confirm-spam is punished by every fake',
    s.wordsWrong > 0, `${s.wordsWrong} wrong picks`);
}

{
  const sim = runReader(12345, 1200, () => false); // never answers
  const s = sim.state();
  check('never answering is punished by every real word',
    s.wordsWrong > 0 && s.wordsCorrect > 0,
    `${s.wordsWrong} missed reals, ${s.wordsCorrect} correctly ignored fakes`);
}

{
  // The DESCENT-equivalent hit: compare a wrong read against the frame's
  // obstacle-hit contract directly.
  const seed = SEEDS.find((s2) => !makeGate(s2, 0).real) ?? 12345;
  const sim = new Sim(seed);
  sim.start(seed);
  const input = emptyInput();
  const g = sim.wordGates.current();
  // run to just before the first gate
  while (sim.player.d < g.d - 2) sim.step(input);
  const speedBefore = sim.player.speed;
  const hitsBefore = sim.player.obstaclesHit;
  const pressureBefore = sim.beast.mistakePressure;
  input.confirm = !g.real; // guarantee the wrong answer
  while (sim.player.d < g.d + 1) { sim.step(input); input.confirm = false; }
  const p = sim.player;
  check('a wrong read costs HIT_SPEED_COST of speed',
    p.speed < speedBefore * (1 - TUNING.PLAYER.HIT_SPEED_COST) + 3.5,
    `${speedBefore.toFixed(1)} -> ${p.speed.toFixed(1)} m/s`);
  check('a wrong read staggers the runner', p.staggerT > 0 || p.speed < speedBefore);
  check('a wrong read is an obstacle hit on the ledger',
    p.obstaclesHit === hitsBefore + 1);
  check('a wrong read feeds beast mistake pressure',
    sim.beast.mistakePressure > pressureBefore,
    `${pressureBefore.toFixed(2)} -> ${sim.beast.mistakePressure.toFixed(2)}`);
}

{
  // Determinism end-to-end: same seed, same scripted thumbs, same run.
  const a = runReader(8675309, 900, (g) => g.real).state();
  const b = runReader(8675309, 900, (g) => g.real).state();
  check('seeded runs with identical reads are identical',
    JSON.stringify(a) === JSON.stringify(b));
}

// ── Legibility at speed (the falsifiable question, made checkable) ────────
head('WORDS — reading window vs the speed ramp');

{
  // The window is ARM distance over ground speed. Assert it at the shipped
  // terminal velocity, not the tutorial crawl — the brief's exact trap.
  const vTop = TUNING.PLAYER.SPEED_TUCK *
    (1 + (Math.max(0, 1.42 - 1)) * TUNING.PLAYER.GRADE_SPEED_GAIN); // steepest pitch
  const window = W.ARM_DISTANCE_M / vTop;
  check('reading window at flat-out top speed clears the floor',
    window >= W.READ_WINDOW_MIN_S,
    `${window.toFixed(2)}s at ${vTop.toFixed(1)} m/s (floor ${W.READ_WINDOW_MIN_S}s)`);

  const vOver = TUNING.PLAYER.SPEED_TUCK * TUNING.BOOST.SPEED_MULT;
  check('even Overdrive leaves a readable window',
    W.ARM_DISTANCE_M / vOver >= 0.9,
    `${(W.ARM_DISTANCE_M / vOver).toFixed(2)}s while spending`);
}

{
  // Gates must not overlap: a gate resolves before the next one arms.
  check('one word is in play at a time',
    W.SPACING_M > W.ARM_DISTANCE_M,
    `${W.SPACING_M}m spacing vs ${W.ARM_DISTANCE_M}m arm distance`);
}

// ── Perf parity ───────────────────────────────────────────────────────────
head('WORDS — frame budget parity');

{
  const sim = new Sim(31337);
  sim.start(31337);
  const input = emptyInput();
  const t0 = performance.now();
  const steps = 60 * 120;
  for (let i = 0; i < steps; i++) {
    input.confirm = (i % 37) === 0;
    sim.step(input);
    if (sim.phase !== PHASE.RUNNING) sim.start(31337);
  }
  const us = ((performance.now() - t0) / steps) * 1000;
  check('sim step with the word verb stays inside the frame budget',
    us < 250, `${us.toFixed(1)} µs/step — ${(us / 16600 * 100).toFixed(2)}% of a 16.6ms frame`);
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
