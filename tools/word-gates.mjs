/**
 * DICTION DASH verb gates — the word-list module's own tests plus the sim-level
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

import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { mulberry32 } from '../src/sim/rng.js';
import { latencyMultFor } from '../src/sim/word-gates.js';
import { MUTATION_FAMILIES, familyForGate } from '../src/words/wordlist.js';
import { corruptionIntensity } from '../src/render/corruption-curve.js';
import { NemesisLedger, NEMESIS } from '../src/meta/nemesis.js';
import { CurveLog } from '../src/meta/curve.js';
import { structuralDanger, dangerFor, dangerBand } from '../src/words/danger.js';
import { memoryAdapter } from '../src/meta/stats.js';
import {
  TIERS, ALL_WORDS, isValidWord, pickWord, makeFake, tierCount, tierWords,
} from '../src/words/wordlist.js';
import {
  makeGate, gateDistance, tierAt, wordSeedFor, tierStartIndex,
} from '../src/sim/word-gates.js';

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
  // Phase C moved the heart onto the single action that earns it. A silent
  // run therefore spends no hearts at all — it is run down by the speed it
  // keeps losing, which is what was actually ending those runs even when the
  // heart was also being charged. Nothing is tapped, so nothing is a false tap.
  check('a silent run spends no hearts and is run down instead',
    sim.player.obstaclesHit === 0 && sim.wordGates.falseTaps === 0 &&
    sim.wordGates.missedReals === s.wordsWrong,
    `${sim.wordGates.missedReals} omissions, ${sim.player.obstaclesHit} on the hit ledger`);
}

{
  // The DESCENT-equivalent hit: compare a wrong read against the frame's
  // obstacle-hit contract directly.
  // The first gate is ALWAYS real since Phase 29 shaped the opening, so a
  // seed search for a fake gate 0 can never succeed — it used to fall through
  // to a real word and test an omission while claiming to test a tapped fake,
  // which passed only while both cost a heart. Advance to the first fake.
  const seed = SEEDS[0];
  const sim = new Sim(seed);
  sim.start(seed);
  const input = emptyInput();
  // This block measures the tapped-fake HIT CONTRACT, not the pursuit — the
  // gap is pinned open until the tap lands. Phase L5+ made the need real:
  // the charted opening (two reals, then the fake) means a silent approach
  // arrives at the first fake already at the floor with the Redline on top,
  // and the old unguarded walk spun forever on a dead sim. Every walk below
  // also guards on the phase so a death can never hang the suite again.
  let g = sim.wordGates.current();
  while (g.real && g.index < 40 && sim.phase === PHASE.RUNNING) {
    while (sim.player.d < g.d + 1 && sim.phase === PHASE.RUNNING) {
      sim.beast.gap = TUNING.BEAST.MAX_GAP;
      sim.step(input);
    }
    g = sim.wordGates.current();
  }
  // run to just before that gate
  while (sim.player.d < g.d - 2 && sim.phase === PHASE.RUNNING) {
    sim.beast.gap = TUNING.BEAST.MAX_GAP;
    sim.step(input);
  }
  const speedBefore = sim.player.speed;
  const hitsBefore = sim.player.obstaclesHit;
  const pressureBefore = sim.beast.mistakePressure;
  input.confirm = !g.real; // guarantee the wrong answer
  while (sim.player.d < g.d + 1 && sim.phase === PHASE.RUNNING) {
    sim.step(input); input.confirm = false;
  }
  const p = sim.player;
  check('tapping a fake costs exactly SPEED_LOSS of speed',
    Math.abs(p.speed - Math.max(TUNING.RUN.FLOOR, speedBefore - TUNING.RUN.SPEED_LOSS)) < 1e-9,
    `${speedBefore.toFixed(1)} -> ${p.speed.toFixed(1)} m/s`);
  check('tapping a fake staggers the runner', p.staggerT > 0 || p.speed < speedBefore);
  check('tapping a fake is the obstacle hit on the ledger (the only read that is)',
    p.obstaclesHit === hitsBefore + 1);
  // Phase 7: pressure is retired — the consequence reaches the Redline only
  // through the speed the read just cost. Below pace, the gap must close.
  {
    const gapAtMiss = sim.beast.gap;
    for (let i = 0; i < 60; i++) sim.step(input);
    const closed = gapAtMiss - sim.beast.gap;
    const predicted = Math.max(0, (TUNING.RUN.REDLINE_PACE - p.speed));
    check('the miss reaches the Redline through speed alone (gap closes below pace)',
      p.speed < TUNING.RUN.REDLINE_PACE ? closed > predicted * 0.9 : closed <= 0.01,
      `closed ${closed.toFixed(2)}m in 1s at ${p.speed.toFixed(1)} m/s vs pace ${TUNING.RUN.REDLINE_PACE}`);
    void pressureBefore;
  }
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
  // The window is ARM distance over ground speed. Phase 8's two-tier
  // standard: the COMFORT floor holds at cruise (the speed CRUISE_READS
  // clean reads reach — where the game is actually played), the HARD
  // floor holds at the asymptotic ceiling a run only ever brushes.
  const R = TUNING.RUN;
  let cruise = R.START_SPEED;
  for (let i = 0; i < W.CRUISE_READS; i++) {
    cruise += R.SPEED_GAIN_MAX * (R.CEILING - cruise) / (R.CEILING - R.FLOOR);
  }
  check('comfort reading window holds at cruise speed',
    W.ARM_DISTANCE_M / cruise >= W.READ_WINDOW_MIN_S,
    `${(W.ARM_DISTANCE_M / cruise).toFixed(2)}s at ${cruise.toFixed(1)} m/s (floor ${W.READ_WINDOW_MIN_S}s)`);
  check('hard reading window holds at the asymptotic ceiling',
    W.ARM_DISTANCE_M / R.CEILING >= W.READ_WINDOW_HARD_MIN_S,
    `${(W.ARM_DISTANCE_M / R.CEILING).toFixed(2)}s at ${R.CEILING} m/s (hard floor ${W.READ_WINDOW_HARD_MIN_S}s)`);
  check('Overdrive at cruise stays above the hard floor',
    W.ARM_DISTANCE_M / (cruise * TUNING.BOOST.SPEED_MULT) >= W.READ_WINDOW_HARD_MIN_S,
    `${(W.ARM_DISTANCE_M / (cruise * TUNING.BOOST.SPEED_MULT)).toFixed(2)}s while spending`);
}

{
  // Gates must not overlap: a gate resolves before the next one arms —
  // including at the bottom of the spawn-rate ramp.
  check('one word is in play at a time, even fully ramped',
    W.SPACING_MIN_M > W.ARM_DISTANCE_M,
    `floor ${W.SPACING_MIN_M}m spacing vs ${W.ARM_DISTANCE_M}m arm distance`);
  const ds = Array.from({ length: 200 }, (_, i) => gateDistance(i));
  const gaps = ds.slice(1).map((d, i) => d - ds[i]);
  check('gate spacing ramps down monotonically to its floor',
    gaps.every((g, i) => (i === 0 || g <= gaps[i - 1] + 1e-9) &&
      g >= W.SPACING_MIN_M - 1e-9),
    `${gaps[0].toFixed(1)}m -> ${gaps[gaps.length - 1].toFixed(1)}m`);
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

// ── Phase 9: depth — the big bank, the no-repeat walk, fresh runs ────────
head('WORDS — depth (bank scale, no repeats, fresh words per attempt)');

{
  // Phase 11: the harvested catalog bank was deliberately removed —
  // curation beats volume now that the no-repeat walk and the per-attempt
  // salt carry the variety. The depth guarantees are re-stated at the
  // curated scale.
  check('the curated bank ships at Phase 17 scale (5 tiers, every word hand-picked)',
    ALL_WORDS.length >= 5000 && TIERS.length === 5,
    `${ALL_WORDS.length} words — ${TIERS.map((t) => t.length).join(' / ')}`);
  // Phase 17 replaced a flat depth floor with the thing that floor was a
  // proxy for. What matters is not how big a tier is but how much of it a
  // single run eats: a run that consumes half a tier defeats the coprime
  // no-repeat walk built to stop exactly that, because two runs then show
  // a dedicated player the whole pool.
  //
  // Measured by driving the real sim 30 km on each difficulty (the tier a
  // run PLATEAUS in is the only one that matters — tiers 0-1 are behind
  // you inside the first kilometre whatever you pick):
  //
  //   EASY   plateaus in tier 2 — 225 distinct real words drawn per run
  //   NORMAL plateaus in tier 4 — 221
  //   HARD   plateaus in tier 4 — 228
  //
  // Before Phase 17 tier 4 held 458 words, so NORMAL and HARD were eating
  // 48% and 50% of it every single run. Tier 2 sat at a healthy 27%, and
  // that is the ratio this gate holds everyone to.
  const PLATEAU_DRAW = { 2: 225, 4: 228 };
  const overEaten = Object.entries(PLATEAU_DRAW)
    .map(([tier, drawn]) => ({ tier, drawn, pool: TIERS[tier].length }))
    .filter(({ drawn, pool }) => drawn / pool > 0.30);
  check('no full run eats more than 30% of the tier it plateaus in',
    overEaten.length === 0,
    overEaten.map(({ tier, drawn, pool }) =>
      `tier ${tier}: ${drawn}/${pool} = ${(drawn / pool * 100).toFixed(0)}%`).join(', ') ||
    Object.entries(PLATEAU_DRAW).map(([tier, drawn]) =>
      `tier ${tier} ${(drawn / TIERS[tier].length * 100).toFixed(0)}%`).join(' · '));
  check('no tier is thin enough to cycle inside the stretch that uses it',
    TIERS.every((t) => t.length >= 300),
    TIERS.map((t) => t.length).join(' / '));

  // Phase 18: one spelling convention, enforced. A game whose entire verb
  // is "is that spelled right?" cannot be casually bilingual — asking a
  // player to judge 'neighbour' while the bank elsewhere ships 'neighbor'
  // asks them to guess which convention this particular gate uses. The
  // bank leaned American already; ten British forms that arrived early
  // were swapped or dropped and this list keeps them out.
  //
  // 'dialogue' and 'axe' are deliberately absent from the list: both are
  // standard American usage ('dialog' is the computing sense, 'ax' a rare
  // variant), so "correcting" them would make the bank worse.
  const BRITISH_FORMS = [
    'armour', 'harbour', 'theatre', 'endeavour', 'kilometre', 'manoeuvre',
    'marvellous', 'neighbour', 'skilful', 'judgement', 'colour', 'favour',
    'honour', 'behaviour', 'flavour', 'humour', 'labour', 'rumour', 'odour',
    'vapour', 'splendour', 'parlour', 'saviour', 'candour', 'centre', 'metre',
    'litre', 'fibre', 'calibre', 'sombre', 'lustre', 'spectre', 'defence',
    'offence', 'licence', 'pretence', 'organise', 'realise', 'recognise',
    'apologise', 'analyse', 'paralyse', 'travelling', 'traveller', 'cancelled',
    'jewellery', 'counsellor', 'woollen', 'labelled', 'modelling',
    'encyclopaedia', 'foetus', 'anaemia', 'paediatric', 'grey', 'plough',
    'mould', 'smoulder', 'kerb', 'tyre', 'pyjamas', 'aluminium', 'sceptical',
    'storey', 'cheque', 'draught', 'programme', 'aeroplane', 'moustache',
    'fulfil', 'instalment', 'enrol', 'appal', 'practise', 'tranquillity',
    'ageing', 'gaol', 'sulphur',
  ];
  const shipped = new Set(ALL_WORDS);
  const bilingual = BRITISH_FORMS.filter((w) => shipped.has(w));
  check('the bank speaks one spelling convention, not two',
    bilingual.length === 0,
    bilingual.join(', ') || `${BRITISH_FORMS.length} British forms checked, none shipped`);

  // The extended fake-guard (guard data, never playable): a fake can no
  // longer collide with common real English outside the shipped tiers.
  const { EXTENDED_GUARD } = await import('../src/words/guard.js');
  check('the extended guard is wired and at catalog scale',
    EXTENDED_GUARD.length >= 8500 &&
    fs.readFileSync('src/words/wordlist.js', 'utf8').includes('...EXTENDED_GUARD]'));
  {
    const rng = mulberry32(0x9ead);
    let collisions = 0;
    const gset = new Set(EXTENDED_GUARD);
    for (let i = 0; i < 4000; i++) {
      const w = ALL_WORDS[Math.floor(rng() * ALL_WORDS.length)];
      const f = makeFake(w, rng);
      if (gset.has(f) || isValidWord(f)) collisions++;
    }
    check("4,000 fakes: none land on ANY known real word ('gray'->'grey' class closed)",
      collisions === 0, `${collisions} collisions`);
  }
  check('no word longer than 12 letters reaches the plate',
    ALL_WORDS.every((w) => w.length <= 12));

  // The no-repeat guarantee, observed: across 400 consecutive gates a tier
  // never repeats a word before its whole pool has been seen, and no word
  // ever appears back-to-back.
  for (const seed of [SEEDS[0], SEEDS[3]]) {
    let earlyDup = 0;
    let backToBack = 0;
    const seen = new Map(); // tier -> Set
    let prev = null;
    for (let i = 0; i < 400; i++) {
      const g = makeGate(seed, i);
      const base = g.answer; // the underlying real word
      if (!seen.has(g.tier)) seen.set(g.tier, new Set());
      const pool = seen.get(g.tier);
      if (pool.has(base) && pool.size < TIERS[g.tier].length) earlyDup++;
      pool.add(base);
      if (base === prev) backToBack++;
      prev = base;
    }
    check(`seed ${seed}: no repeat before a tier's pool cycles, none back-to-back`,
      earlyDup === 0 && backToBack === 0, `${earlyDup} early dupes, ${backToBack} adjacent`);
  }

  // Per-attempt salt: identical without it, fresh words with it, and the
  // real/fake structure of the DAY stays untouched by construction (the
  // track and bells never see the salt).
  const s = SEEDS[1];
  check('salt 0 is the identity (tools/ghost replay unchanged)',
    wordSeedFor(s, 0) === (s >>> 0) &&
    makeGate(wordSeedFor(s, 0), 0).shown === makeGate(s, 0).shown);
  const a = Array.from({ length: 30 }, (_, i) => makeGate(wordSeedFor(s, 1), i).answer);
  const b = Array.from({ length: 30 }, (_, i) => makeGate(wordSeedFor(s, 2), i).answer);
  const c = Array.from({ length: 30 }, (_, i) => makeGate(wordSeedFor(s, 1), i).answer);
  check('the same attempt number replays identically',
    JSON.stringify(a) === JSON.stringify(c));
  const differing = a.filter((w, i) => w !== b[i]).length;
  check('a new attempt reads mostly new vocabulary on the same track',
    differing >= 24, `${differing}/30 gates differ between attempt 1 and 2`);

  // Fake safety at scale: sample widely across the big bank — a generated
  // fake must never be a shipped word (a correct read is never punished).
  const rng = mulberry32(0xfa4e);
  let fakes = 0;
  let unsafe = 0;
  for (let i = 0; i < 4000; i++) {
    const word = ALL_WORDS[Math.floor(rng() * ALL_WORDS.length)];
    const f = makeFake(word, rng);
    fakes++;
    if (f === word || isValidWord(f)) unsafe++;
  }
  check('4,000 sampled fakes across the merged bank: none are real words',
    unsafe === 0, `${fakes} generated, ${unsafe} collisions`);

  check('tier boundaries are exact (the walk index restarts per tier)',
    [1, 2, 3, 4].every((t) => {
      const i = tierStartIndex(t);
      return tierAt(gateDistance(i)) >= t && (i === 0 || tierAt(gateDistance(i - 1)) < t);
    }));
}

// ── Phase 10: difficulty profiles shape the tier curve, nothing else ─────
head('WORDS — difficulty profiles');

{
  const D = TUNING.MODES.DIFFICULTY;
  const prof = (d) => ({ TIER_MIN: d.TIER_MIN, TIER_MAX: d.TIER_MAX, TIER_EVERY_M: d.TIER_EVERY_M });
  const seed = SEEDS[0];

  check('the NORMAL profile is byte-identical to the pre-mode game',
    D.normal.TIER_MIN === 0 && D.normal.TIER_MAX === 4 &&
    D.normal.TIER_EVERY_M === W.TIER_EVERY_M &&
    Array.from({ length: 60 }, (_, i) =>
      makeGate(seed, i, prof(D.normal)).shown === makeGate(seed, i).shown).every(Boolean));

  const easyTiers = Array.from({ length: 250 }, (_, i) => makeGate(seed, i, prof(D.easy)).tier);
  check('EASY never leaves the short tiers, even 20km deep',
    Math.max(...easyTiers) <= D.easy.TIER_MAX && D.easy.TIER_MAX <= 2,
    `max tier ${Math.max(...easyTiers)} across 250 gates`);
  check('EASY ramps slower than NORMAL', D.easy.TIER_EVERY_M > D.normal.TIER_EVERY_M);

  const hardFirst = makeGate(seed, 0, prof(D.hard)).tier;
  check('HARD skips the warm-up tier and ramps faster',
    hardFirst >= 1 && D.hard.TIER_EVERY_M < D.normal.TIER_EVERY_M,
    `first gate tier ${hardFirst}`);

  check('difficulty paces bracket the baseline (easing is a visible choice now)',
    D.easy.REDLINE_PACE < D.normal.REDLINE_PACE &&
    D.normal.REDLINE_PACE === TUNING.RUN.REDLINE_PACE &&
    D.hard.REDLINE_PACE > D.normal.REDLINE_PACE);

  // Audience check: the register that made the harvested bank unshippable
  // must never creep into the curated one either.
  const UNSHIPPABLE = ['arse', 'boob', 'piss', 'rape', 'nude', 'bastard',
    'cocaine', 'suicide', 'murder', 'sperm', 'pussy', 'slave', 'corpse'];
  check('the curated bank carries none of the flagged adult register',
    UNSHIPPABLE.every((w) => !isValidWord(w)),
    `${UNSHIPPABLE.length} terms verified absent`);
}

// ── The shaped opening (Phase 29) ────────────────────────────────────────
head('OPENING — the first word is always one worth tapping');
{
  const W = TUNING.WORDS;
  let worstLead = 0, allRealFirst = true;
  for (let seed = 0; seed < 4000; seed++) {
    if (!makeGate(seed, 0).real) allRealFirst = false;
    let n = 0;
    while (n < 14 && !makeGate(seed, n).real) n++;
    if (n > worstLead) worstLead = n;
  }
  check('every run opens on a real spelling', allRealFirst, '4,000 seeds, no exceptions');
  check('no run opens on a row of fakes', worstLead === 0,
    `worst leading run of fakes across 4,000 seeds: ${worstLead}`);

  // Inside the teaching window the fake run is capped; outside it the coin
  // flip must be untouched, or the shaping has quietly changed the game.
  let worstRun = 0;
  for (let seed = 0; seed < 1500; seed++) {
    let run = 0;
    for (let i = 0; i < W.OPENING_GATES; i++) {
      run = makeGate(seed, i).real ? 0 : run + 1;
      if (run > worstRun) worstRun = run;
    }
  }
  check('the teaching window never runs more than two fakes together',
    worstRun <= W.OPENING_MAX_FAKE_RUN, `worst run inside the window: ${worstRun}`);

  let fakes = 0, total = 0;
  for (let seed = 0; seed < 800; seed++) {
    for (let i = W.OPENING_GATES; i < 60; i++) { total++; if (!makeGate(seed, i).real) fakes++; }
  }
  const rate = fakes / total;
  // Phase L5+: the phrase chart deliberately shapes the pattern past the
  // window (fake runs, breathers, alternations), so the invariant is no
  // longer "raw coin" — it is that the BALANCE the whole economy was
  // calibrated against survives the shaping. phrase-gates holds the
  // structure; this holds the mix.
  check('after the window the charted mix stays at the coin\'s balance',
    Math.abs(rate - W.FAKE_CHANCE) < 0.08,
    `${(rate * 100).toFixed(1)}% fake against a ${(W.FAKE_CHANCE * 100).toFixed(0)}% draw (±8% charted band)`);

  // The shaping must stay a pure function of the seed, or replays diverge.
  const a = Array.from({ length: 20 }, (_, i) => makeGate(4242, i).shown);
  const b = Array.from({ length: 20 }, (_, i) => makeGate(4242, i).shown);
  check('the shaped opening is still deterministic', a.join() === b.join(),
    'same seed, same twenty words');
}

// ── Assistance costs score (Phase 29) ────────────────────────────────────
head('CONTINUES — a bought run banks less than it earned');
{
  const keep = TUNING.SCORE.CONTINUE_KEEP;
  const banked = (earned, continues) => Math.floor(earned * Math.pow(keep, continues));
  check('an unassisted run keeps every point', banked(100000, 0) === 100000, '100,000 earned, 100,000 banked');
  // Exact integers, floating-point included: 0.7 squared is 0.48999..., so a
  // gate written against tidy decimals fails on arithmetic rather than intent.
  check('each continue compounds the loss',
    banked(100000, 1) === 70000 && banked(100000, 2) === 48999 && banked(100000, 3) === 34299,
    '70,000 / 48,999 / 34,299 after one, two and three');
  check('the penalty is a reduction, never a wipe', keep > 0 && keep < 1 && banked(100000, 6) > 0,
    `keeps ${(keep * 100).toFixed(0)}% per continue`);
}

// ── Phase A: render-ahead is presentation only ───────────────────────────
head('LOOKAHEAD — more gates are shown, no more gates are answerable');
{
  const W = TUNING.WORDS;
  const src = fs.readFileSync('src/render/word-gates.js', 'utf8');

  // The load-bearing invariant of the whole brief: seeing further must not
  // mean answering earlier. ARM_DISTANCE_M stays under SPACING_MIN_M so
  // exactly one gate is ever armed, however many are drawn.
  check('the arm distance did not grow to meet the lookahead',
    W.ARM_DISTANCE_M === 55 && W.ARM_DISTANCE_M < W.SPACING_MIN_M,
    `arm ${W.ARM_DISTANCE_M}m under spacing floor ${W.SPACING_MIN_M}m`);

  // Exactly one gate can be armed at any distance, at every spacing the run
  // ever reaches — the property that makes an unarmed plate unanswerable.
  let worstArmed = 0;
  for (let seed = 0; seed < 60; seed++) {
    for (let d = 0; d < 30000; d += 37) {
      let armed = 0;
      for (let i = 0; i < 400; i++) {
        const g = makeGate(seed, i);
        if (g.d - d <= W.ARM_DISTANCE_M && g.d - d > 0) armed++;
        if (g.d - d > W.ARM_DISTANCE_M) break;
      }
      if (armed > worstArmed) worstArmed = armed;
    }
  }
  check('never more than one gate is armed, at any distance',
    worstArmed <= 1, `worst simultaneous armed gates: ${worstArmed}`);

  // The renderer may only READ future gates. It must not call anything that
  // advances the sim's own gate, and unarmed plates must emit no events.
  check('the renderer reads future gates without touching sim state',
    src.includes('_peekGate') && !/this\.ahead\[[^\]]*\]\.(confirm|resolve)/.test(src) &&
    !src.includes('wg.step(') && !src.includes('events.push'),
    'lookahead plates are built from pure makeGate and push no events');

  // The armed plate's own call is untouched by any lookahead value.
  // (Phase L: the ground argument became the centreline's height — heightAt
  // at the corridor x — so a banked row cannot sink or float the plate.)
  check('the armed plate is drawn at full opacity, independent of lookahead',
    /this\.current\.place\(g\.shown, g\.d, terrain\.heightAt\(terrain\.corridorX\(g\.d\), g\.d\), camera,\s*1,/.test(src),
    'armed plate still places at opacity 1 with its own parameters');

  // The count is bounded by the fade ladder, so ?lookahead=99 cannot draw 99.
  check('the lookahead count is clamped to the fade ladder',
    src.includes('Math.min(max') && W.LOOKAHEAD_OPACITY.length >= W.LOOKAHEAD_GATES,
    `${W.LOOKAHEAD_OPACITY.length} fade steps for a default of ${W.LOOKAHEAD_GATES}`);

  // Unarmed plates must stay visibly subordinate: strictly descending, and
  // every one of them well under the armed plate's 1.0.
  const fade = W.LOOKAHEAD_OPACITY;
  check('unarmed plates never compete with the armed one',
    fade.every((v, i) => v < 1 && (i === 0 || v < fade[i - 1])) && fade[0] <= 0.55,
    `ladder ${fade.join(' / ')} against an armed plate at 1.0`);

  // Phase 8.1 warms every plate before the run so the first frame is a cache
  // hit. Adding plates without warming them puts that start hitch back.
  const mainSrc = fs.readFileSync('src/main.js', 'utf8');
  check('every lookahead plate is pre-warmed with the armed one',
    mainSrc.includes('...wordGateActors.ahead, wordGateActors.fx') &&
    mainSrc.includes('wordGateActors.ahead.forEach'),
    'texture init and first paint both cover the lookahead plates');

  // The tuning panel exists for devices with no console. It must cost a normal
  // load nothing, and it must not become a second source of truth.
  const panelSrc = fs.readFileSync('src/dev-panel.js', 'utf8');
  check('the tuning panel is only fetched behind its flag',
    /get\('dev'\) === '1'/.test(mainSrc) && /import\('\.\/dev-panel\.js'\)/.test(mainSrc),
    'dynamic import, so a normal load never downloads or parses it');
  check('the panel writes through TUNING rather than shadowing it',
    panelSrc.includes("import TUNING from './TUNING.js'") &&
    !/const\s+\w+\s*=\s*\{[^}]*CEILING/.test(panelSrc),
    'the console and the panel see the same values, either way round');
  check('the lookahead row can be resized live and stays clamped',
    /setLookahead\(n\)/.test(src) && /Math\.min\(max/.test(src) && /_pool/.test(src),
    'retired plates are pooled rather than rebuilt');

  // The pre-Phase-A build drew exactly one preview plate at 0.55.
  check('LOOKAHEAD_GATES = 1 reproduces the build before this phase',
    fade[0] === 0.55, 'first step is the 0.55 the old preview plate used');
}

// ── Phase B: when you answer, not only whether ───────────────────────────
head('LATENCY — the early read is worth more, and costs the window nothing');
{
  const W = TUNING.WORDS;

  check('the multiplier spans the arm window and nothing wider',
    latencyMultFor(W.ARM_DISTANCE_M) === W.EARLY_MULT &&
    latencyMultFor(0) === W.LATE_MULT &&
    latencyMultFor(W.ARM_DISTANCE_M * 4) === W.EARLY_MULT &&
    latencyMultFor(-10) === W.LATE_MULT,
    `${W.LATE_MULT}x at the line rising to ${W.EARLY_MULT}x at ${W.ARM_DISTANCE_M}m`);

  check('it is monotone across the window',
    Array.from({ length: 40 }, (_, i) => latencyMultFor(i * W.ARM_DISTANCE_M / 39))
      .every((v, i, a) => i === 0 || v > a[i - 1]),
    'no flat spot or reversal a player could sit in');

  // The midpoint is derived from the dials, not written down: Phase H moved
  // EARLY_MULT and a literal here would have pinned the old rate for ever.
  const mid = W.ARM_DISTANCE_M / 2;
  check('it is deterministic in the answer distance alone',
    latencyMultFor(mid) === latencyMultFor(mid) &&
    latencyMultFor(mid) === (W.LATE_MULT + W.EARLY_MULT) / 2,
    'the same distance always pays the same, so a replay reproduces it');

  // Two runs over the same seed, one answering the instant each word arms and
  // one answering at the line. Score and meter must differ; the reading window
  // and the speed curve must not.
  const runAt = (fraction) => {
    const sim = new Sim(4242);
    sim.start(4242);
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 60000) {
      const wg = sim.wordGates;
      const g = wg.current();
      const remaining = g.d - sim.player.d;
      const want = wg.armed(sim.player.d) && !g.confirmed &&
        remaining <= W.ARM_DISTANCE_M * fraction && g.real;
      sim.step({ ...emptyInput(), confirm: want });
      if (sim.player.d > 2600) break;
    }
    return {
      score: Math.floor(sim.player.score), meter: sim.player.boostMeter,
      speed: +sim.player.speed.toFixed(6), d: +sim.player.d.toFixed(3),
      correct: sim.wordGates.correctCount, wrong: sim.wordGates.wrongCount,
    };
  };
  const early = runAt(1.0);      // answer the moment it arms
  const late = runAt(0.06);      // answer on the line
  // Phase D removed the metre term that used to dilute this: the same
  // comparison read +16% then and reads +60% now, on identical play.
  check('answering early scores more over the same ground',
    early.score > late.score * 1.35 && early.correct === late.correct,
    `${early.score.toLocaleString()} vs ${late.score.toLocaleString()} on ${early.correct} identical reads` +
    ` (+${Math.round((early.score / late.score - 1) * 100)}%)`);
  check('answering early fills the meter faster',
    early.meter >= late.meter,
    `meter ${early.meter.toFixed(1)} vs ${late.meter.toFixed(1)}`);
  check('speed is untouched by when the answer landed',
    early.speed === late.speed,
    `both runs end at ${early.speed} m/s — the multiplier never reaches the speed curve`);

  // The legibility floor is the constraint the whole brief is fenced by.
  // Read time measures decisions, not waiting: a passed fake never entered.
  const answered = (() => {
    const sim = new Sim(77); sim.start(77);
    let guard = 0, passes = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 40000 && sim.player.d < 1400) {
      const wg = sim.wordGates; const g = wg.current();
      const tap = wg.armed(sim.player.d) && !g.confirmed && g.real;
      if (!tap && wg.armed(sim.player.d) && !g.real) passes++;
      sim.step({ ...emptyInput(), confirm: tap });
    }
    return { reads: sim.wordGates.readCount, correct: sim.wordGates.correctCount, sawPasses: passes > 0 };
  })();
  check('read time counts answers, not passes',
    answered.sawPasses && answered.reads < answered.correct,
    `${answered.reads} timed answers against ${answered.correct} correct reads — passed fakes excluded`);

  check('the reading window is unchanged',
    W.ARM_DISTANCE_M === 55 && W.ARM_DISTANCE_M < W.SPACING_MIN_M &&
    W.READ_WINDOW_MIN_S === 1.15 && W.READ_WINDOW_HARD_MIN_S === 0.75,
    'arm distance, spacing floor and both read-window floors all stand');

  // No word may be printed for a fast read. Checked where the feedback is
  // actually issued rather than by banning vocabulary the game already uses
  // elsewhere for its own reasons ("PERFECT RUN" is the flawless-run recap).
  const mainTxt = fs.readFileSync('src/main.js', 'utf8');
  const block = mainTxt.slice(mainTxt.indexOf("case 'word_correct'"));
  const body = block.slice(0, block.indexOf("case 'word_wrong'"));
  check('nothing announces the early read in words',
    !/'[A-Z][A-Z ]{3,}'/.test(body) && /audio\.gate\(e\.chain, early/.test(body) &&
    /rig\.dashKick\(/.test(body),
    'the correct-read path carries no display string — sound and camera only');
}

// ── Phase C: two zones, one primitive ────────────────────────────────────
head('ZONES — the reject is optional, and never worse than silence');
{
  // Bank some meter before testing the commission, or the half-meter penalty
  // has nothing to take and the assertion measures the harness, not the rule.
  const play = (kind, action, seed = 11) => {
    const sim = new Sim(seed); sim.start(seed);
    let guard = 0, banked = false;
    while (sim.phase === PHASE.RUNNING && guard++ < 100000) {
      const wg = sim.wordGates, g = wg.current();
      if (!banked) {
        if (sim.player.boostMeter >= 25) banked = true;
        else {
          const arm = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
          sim.step({ ...emptyInput(), confirm: arm && g.real, reject: arm && !g.real });
          continue;
        }
      }
      const match = (kind === 'real') === g.real;
      const armed = wg.armed(sim.player.d) && match && !g.confirmed && !g.rejected;
      const before = { hits: sim.player.obstaclesHit, correct: wg.correctCount,
        stagger: sim.player.staggerT, meter: sim.player.boostMeter };
      sim.step({ ...emptyInput(),
        confirm: armed && action === 'right', reject: armed && action === 'left' });
      if (match && g.resolved) {
        return { correct: wg.correctCount > before.correct,
          heart: sim.player.obstaclesHit > before.hits,
          stagger: sim.player.staggerT > before.stagger,
          meterLost: sim.player.boostMeter < before.meter };
      }
    }
    return null;
  };

  const t = {
    realRight: play('real', 'right'), fakeLeft: play('fake', 'left'),
    fakePass: play('fake', 'pass'), fakeRight: play('fake', 'right'),
    realLeft: play('real', 'left'), realPass: play('real', 'pass'),
  };
  check('saying real to a real word is correct', t.realRight?.correct === true, 'right zone on a true spelling');
  check('saying fake to a fake word is correct', t.fakeLeft?.correct === true, 'left zone on a misspelling');
  check('letting a fake go past is still correct', t.fakePass?.correct === true,
    'the passive path survives — a cautious player plays the old game');
  check('saying real to a fake is the hit',
    t.fakeRight?.correct === false && t.fakeRight?.heart && t.fakeRight?.stagger && t.fakeRight?.meterLost,
    'heart, stagger and meter, exactly as before');
  check('rejecting a real word costs no heart',
    t.realLeft?.correct === false && t.realLeft?.heart === false && t.realLeft?.stagger === false,
    'a reject must never be more dangerous than silence, or nobody presses it');
  check('the reject is never worse than saying nothing',
    t.realLeft?.heart === t.realPass?.heart && t.realLeft?.stagger === t.realPass?.stagger,
    'identical consequence, so using the control is never punished');

  // A player who never touches the left zone must play exactly today's game.
  const run = (useLeft) => {
    const sim = new Sim(4242); sim.start(4242);
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 300000 && sim.player.d < 6000) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
      sim.step({ ...emptyInput(),
        confirm: armed && g.real, reject: armed && useLeft && !g.real });
    }
    return { d: Math.round(sim.player.d), correct: sim.wordGates.correctCount,
      wrong: sim.wordGates.wrongCount, hearts: sim.player.obstaclesHit };
  };
  const cautious = run(false); const active = run(true);
  check('never using the left zone is not a disadvantage',
    cautious.correct === active.correct && cautious.wrong === active.wrong &&
    cautious.hearts === active.hearts,
    `${cautious.correct} correct either way — the left zone buys timing, not outcomes`);

  // Both zones at once is the dash, and it must not also read as an answer.
  const inputSrc = fs.readFileSync('src/input/input.js', 'utf8');
  // The both-halves dash lasted one playtest. On a phone it had to compete
  // with the buttons that occupy both halves, and the DASH button already did
  // the job — a gesture that duplicates a control and loses to it is not a
  // shortcut. A half is a reading and nothing else now.
  check('a screen half only ever means a reading',
    !/dashEdge = true;[\s\S]{0,80}_zoneOf/.test(inputSrc) &&
    !/_zonePress/.test(inputSrc) && !/BOTH_ZONE_MS/.test(inputSrc),
    'no gesture competes with the buttons that sit in the same halves');
  check('the dash still has three ways in and no gesture',
    /case 'Space': if \(down\) this\.dashEdge = true/.test(inputSrc) &&
    /this\.dashEdge \|\| this\.keyBoost \|\| this\.__v1DashButtonHeld/.test(inputSrc),
    'Space, the F key and the on-screen button');
  check('the hold that used to arm the dash is gone',
    !/GO_HOLD_MS/.test(inputSrc) && /dashEdge/.test(inputSrc),
    'the dash is an edge — no quarter-second tax on the most important verb');

  // Every device reaches the same two sim flags.
  check('keyboard, pointer and the on-screen button all reach the same flags',
    /case 'ArrowRight': case 'KeyD': if \(down\) this\.jump = true/.test(inputSrc) &&
    /case 'ArrowLeft': case 'KeyA': if \(down\) this\.reject = true/.test(inputSrc) &&
    /_zoneTap\(e\.pointerId, e\.clientX\)/.test(inputSrc) &&
    /consumeJump\(\) \{[\s\S]{0,200}this\.jump = false; this\.reject = false; this\.dashEdge = false;/.test(inputSrc),
    'one primitive, three ways in, one edge consumed per frame');

  // The shaped opening still holds with the new action available.
  let openingHolds = true;
  for (let seed = 0; seed < 500; seed++) {
    if (!makeGate(seed, 0).real) { openingHolds = false; break; }
  }
  check('the teaching window still holds with the reject available',
    openingHolds && TUNING.WORDS.OPENING_GATES === 6,
    'every run still opens on a real word');
}

// ── Phase D: score is reads, and the daily is a route ────────────────────
head('SCORE — reads pay, ground does not');
{
  const S = TUNING.SCORE;
  check('no score term references distance',
    !('PER_METRE' in S) &&
    !/player\.score \+=[^;]*\b(d|distance|metre)\b/.test(fs.readFileSync('src/sim/sim.js', 'utf8')),
    'the metre term is gone from tuning and from the step');
  // Meaningfully more, but not so much more that depth quietly buys back the
  // distance term this phase just removed — the tier a gate lands in climbs
  // with distance, so a steep ladder is a distance term wearing a disguise.
  check('harder words are worth more, without paying for depth twice',
    S.TIER_MULT.length === 5 && S.TIER_MULT.every((v, i, a) => i === 0 || v > a[i - 1]) &&
    S.TIER_MULT[0] === 1 && S.TIER_MULT[4] >= 1.5 && S.TIER_MULT[4] <= 2,
    `tier ladder ${S.TIER_MULT.join(' / ')} — hardest word worth ${S.TIER_MULT[4]}x the easiest`);

  // The claim the whole phase rests on: a short brilliant run can beat a long
  // safe one. Scripted — 40 gates answered at the arm edge against the full
  // hundred answered on the line.
  const runRoute = (limit, early) => {
    const sim = new Sim(777); sim.start(777, null, { mode: 'standard', wordSalt: 0 });
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 900000) {
      const wg = sim.wordGates, g = wg.current();
      if (wg.next >= limit) break;
      const remaining = g.d - sim.player.d;
      const window = early ? TUNING.WORDS.ARM_DISTANCE_M : TUNING.WORDS.ARM_DISTANCE_M * 0.06;
      const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected && remaining <= window;
      sim.step({ ...emptyInput(), confirm: armed && g.real, reject: armed && !g.real });
      if (sim.routeFinished) break;
    }
    return { gates: sim.wordGates.next, score: sim.score, d: Math.round(sim.player.d) };
  };
  // The brief asked for gate 40 to beat gate 100. At EARLY_MULT 3.0 it did not
  // (136,688 against 146,351 — the break-even was fifty). Phase H settled the
  // rate at 3.5 from the sweep in tools/calibration-gates.mjs, and forty now
  // clears it (159,265 against 148,544). That verdict is frozen there; what
  // this gate asserts is the invariant the phase actually rests on: half the
  // route read well beats all of it read safely, at whatever rate ships.
  const halfHot = runRoute(50, true);
  const longSafe = runRoute(100, false);
  check('half the route read early beats the whole route read late',
    halfHot.score > longSafe.score,
    `${halfHot.gates} gates early = ${halfHot.score.toLocaleString()}` +
    ` beats ${longSafe.gates} gates late = ${longSafe.score.toLocaleString()}`);
  check('and it does it on less ground',
    halfHot.d < longSafe.d,
    `${halfHot.d}m against ${longSafe.d}m — the board cannot be farmed by surviving`);
  // Depth must still pay at equal quality, or the route's back half is wasted.
  const fullHot = runRoute(100, true);
  check('depth still pays when the reading is equally good',
    fullHot.score > halfHot.score,
    `${fullHot.score.toLocaleString()} for the full route against ${halfHot.score.toLocaleString()} for half`);
}

head('THE DAILY ROUTE — the same hundred words for everyone');
{
  const M = TUNING.MODES.RULES;
  check('the daily route has an end and endless does not',
    M.standard.GATES === 100 && M.endless.GATES === 0,
    'one hundred gates, or no end at all');

  // Two players, same day, same route — word for word.
  const words = () => {
    const sim = new Sim(4242); sim.start(4242, null, { mode: 'standard', wordSalt: 0 });
    return Array.from({ length: 100 }, (_, i) => makeGate(sim.wordGates.seed, i).shown);
  };
  const a = words(), b = words();
  check('two players on the same day read an identical route',
    a.join('|') === b.join('|') && a.length === 100 && new Set(a).size > 80,
    `100 gates, ${new Set(a).size} distinct words, byte-identical between players`);

  const mainSrc = fs.readFileSync('src/main.js', 'utf8');
  check('the daily pins its word salt and endless re-rolls it',
    /runMode === 'standard' \? 0/.test(mainSrc) && /: runs \+ 1/.test(mainSrc),
    're-rolling the daily would make two players play different games');

  // Reaching the end is a finish, not a death, and it goes through the same
  // endgame path the canonical distance uses.
  const endgameSrc = fs.readFileSync('src/rc97-endgame.js', 'utf8');
  check('the route end runs through the existing finish, not around it',
    /sim\.routeFinished === true/.test(endgameSrc) &&
    !/this\.escaped = true/.test(fs.readFileSync('src/sim/sim.js', 'utf8')),
    'the coast, the stopped pursuit and the card are identical either way');

  const sim = new Sim(777); sim.start(777, null, { mode: 'standard', wordSalt: 0 });
  let guard = 0;
  while (sim.phase === PHASE.RUNNING && guard++ < 900000 && !sim.routeFinished) {
    const wg = sim.wordGates, g = wg.current();
    const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
    sim.step({ ...emptyInput(), confirm: armed && g.real, reject: armed && !g.real });
  }
  check('a clean daily run reaches the hundredth gate and stops',
    sim.routeFinished && sim.wordGates.next === 100,
    `finished on gate ${sim.wordGates.next} at ${Math.round(sim.player.d)}m`);

  // Debugging pass: the earned coast is WORDLESS. Before the fix, gates kept
  // arming and resolving after the finish — measured live: ten more gates,
  // +2160 score and six "missed" reals in fifteen seconds of coast. With
  // `escaped` raised (the endgame layer's flag), nothing scores, nothing
  // punishes, and the next word is always re-dealt ahead of the runner so
  // KEEP GOING never resumes into a word that was already lost.
  sim.escaped = true;
  const frozen = {
    score: sim.score, correct: sim.wordGates.correctCount,
    wrong: sim.wordGates.wrongCount, hearts: sim.hearts,
  };
  let aheadOk = true;
  for (let i = 0; i < 900 && sim.phase === PHASE.RUNNING; i++) {
    sim.step({ ...emptyInput(), confirm: i % 7 === 0 }); // even taps do nothing
    if (sim.wordGates.current().d < sim.player.d) aheadOk = false;
  }
  check('the coast after the finish is wordless',
    sim.score === frozen.score && sim.wordGates.correctCount === frozen.correct &&
    sim.wordGates.wrongCount === frozen.wrong && sim.hearts === frozen.hearts,
    `15s of coast: score ${sim.score - frozen.score >= 0 ? '+' : ''}${sim.score - frozen.score}, wrongs +${sim.wordGates.wrongCount - frozen.wrong}`);
  check('and every gate the coast rolls past is re-dealt ahead',
    aheadOk && sim.wordGates.current().d >= sim.player.d,
    'KEEP GOING can never resume into a word that was already lost');
}

// ── N1: the answer buffer ────────────────────────────────────────────────
head('THE ANSWER BUFFER — a decided read waits for the window');
{
  // Playtest: the lookahead plates let a word be read far beyond the arm
  // distance, but a tap out there was silently swallowed. The buffer holds
  // it and lands it on the first armed frame — the window itself unmoved.
  const sim = new Sim(12345); sim.start(12345);
  const wg = sim.wordGates;
  const g0 = wg.current();
  const real = g0.real;
  check('the opening gate really is beyond the window (the dead zone exists)',
    g0.d - sim.player.d > W.ARM_DISTANCE_M, `${Math.round(g0.d - sim.player.d)}m out`);
  sim.step({ ...emptyInput(), confirm: real, reject: !real });
  const heldEvt = sim.events.find((e) => e.t === 'word_held');
  check('a dead-zone tap is held, not swallowed',
    wg.held === (real ? 1 : -1) && wg.heldIndex === g0.index &&
    !!heldEvt && !g0.confirmed && !g0.rejected,
    `held ${heldEvt?.said} for gate ${wg.heldIndex}`);
  let guard = 0;
  while (!g0.resolved && sim.phase === PHASE.RUNNING && guard++ < 40000) sim.step(emptyInput());
  check('the held answer lands on the first armed frame, at the arm edge',
    g0.resolved && g0.correct && g0.answerDistance >= W.ARM_DISTANCE_M - 2,
    `answered at ${g0.answerDistance.toFixed(1)}m of ${W.ARM_DISTANCE_M} — what a frame-perfect live tap always paid`);
  check('the buffer empties on delivery — nothing carries to the next word',
    wg.held === 0 && wg.heldIndex === -1 && wg.current().index === g0.index + 1);
}
{
  // The mind can change until the word arms: the LAST dead-zone input wins.
  const sim = new Sim(999); sim.start(999);
  const wg = sim.wordGates;
  const g0 = wg.current();
  const real = g0.real;
  sim.step({ ...emptyInput(), confirm: !real, reject: real });  // the wrong hold
  sim.step({ ...emptyInput(), confirm: real, reject: !real });  // corrected
  check('latest input wins across the dead zone', wg.held === (real ? 1 : -1));
  let guard = 0;
  while (!g0.resolved && sim.phase === PHASE.RUNNING && guard++ < 40000) sim.step(emptyInput());
  check('and only the corrected answer lands', g0.resolved && g0.correct === true);
}
{
  // A tap inside the window is byte-for-byte the game it always was: it
  // answers NOW and never touches the buffer.
  const sim = new Sim(42); sim.start(42);
  const wg = sim.wordGates;
  let sawHeld = false, guard = 0;
  while (wg.next < 3 && sim.phase === PHASE.RUNNING && guard++ < 60000) {
    const g = wg.current();
    const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
    sim.step({ ...emptyInput(), confirm: armed && g.real, reject: armed && !g.real });
    if (sim.events.some((e) => e.t === 'word_held')) sawHeld = true;
  }
  check('an armed tap never buffers — the live path is untouched',
    !sawHeld && wg.correctCount === 3, `${wg.correctCount} live answers, 0 holds`);
}

// ── Phase E: the last stand ──────────────────────────────────────────────
head('LAST STAND — one more word before the run ends');
{
  // Phase L5+ made the stand's word chart-dependent: on this seed it is now
  // a FAKE, and silence — the correct answer for a fake — held the stand in
  // both arms of the old silent-vs-answering script. The failing arm now
  // answers WRONGLY at the stand (rejects a real, confirms a fake), which
  // fails it whatever the chart deals; the winning arm answers rightly.
  const drive = (answer, mode = 'endless', continues = 0) => {
    const sim = new Sim(4242); sim.start(4242, null, { mode, wordSalt: 0 });
    let guard = 0, stands = 0, held = 0, lost = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 400000) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
      const act = !!sim.lastStand && armed;
      sim.step({ ...emptyInput(),
        confirm: act && (answer ? g.real : !g.real),
        reject: act && (answer ? !g.real : g.real) });
      for (const e of sim.events) {
        if (e.t === 'last_stand') stands++;
        if (e.t === 'last_stand_held') held++;
        if (e.t === 'last_stand_lost') lost++;
      }
      sim.events.length = 0;
    }
    return { sim, d: Math.round(sim.player.d), t: sim.time, stands, held, lost };
  };

  const lost = drive(false);
  const won = drive(true);
  check('the Redline opens one more word instead of ending the run',
    lost.stands === 1 && won.stands === 1,
    'the arrival is a question before it is a verdict');
  check('reading it buys the run back',
    won.held === 1 && won.d > lost.d,
    `${won.d}m held against ${lost.d}m surrendered — ${(won.t - lost.t).toFixed(1)}s more run`);
  check('missing it ends the run exactly as before',
    lost.lost === 1 && lost.sim.phase === 'kill' && lost.sim.killSource === 'main' &&
    lost.sim.player.dead === true,
    'same phase, same source, same dead flag — a failed stand is not a new death');

  // Once per RUN, under every combination. Not once per continue, not per
  // heart: the whole point is that it is a moment, not a resource.
  const combos = [['endless', 0], ['standard', 0], ['endless', 2], ['standard', 3]];
  const counts = combos.map(([m, c]) => drive(true, m, c).stands);
  check('it fires at most once per run in every mode and continue combination',
    counts.every((n) => n === 1),
    `${combos.map(([m, c], i) => `${m}/${c}c:${counts[i]}`).join('  ')}`);
  check('and the flag lives on the run, not on the player',
    /this\.lastStandUsed = false/.test(fs.readFileSync('src/sim/sim.js', 'utf8')) &&
    !/player\.lastStandUsed/.test(fs.readFileSync('src/sim/sim.js', 'utf8')),
    'a restart gets a fresh one; a continue inside a run does not');

  // A recovered run is a skill save, so it keeps every board right it had.
  const mainSrc = fs.readFileSync('src/main.js', 'utf8');
  // Phase J moved the eligibility test onto one line: the continue flag and
  // the board policy, and nothing else — a stand is never in the expression.
  check('a recovered run is still board-eligible',
    /const boardEligible = !runContinued &&/.test(mainSrc) &&
    !/lastStand/.test(mainSrc.slice(mainSrc.indexOf('const boardEligible'), mainSrc.indexOf('metaStats.increment'))),
    'only a purchased continue (or the wrong board difficulty) forfeits the best and the ghost — a stand does not');

  // The corruption is already gap-driven, so pinning the gap pins the
  // presentation at its maximum with no second system to keep in step.
  check('the presentation pins itself at maximum',
    Math.abs(corruptionIntensity(TUNING.BEAST.KILL_GAP) - 1) < 1e-9,
    'the gap is the corruption curve\'s input, and the stand holds it at the throat');

  const audioSrc = fs.readFileSync('src/audio/audio.js', 'utf8');
  check('the mix stands down and one tone is held',
    /this\.standActive \? 0\.06 : 1/.test(audioSrc) && /lastStand\(\) \{/.test(audioSrc),
    'silence is the tell — nothing announces the moment in words');
  const uiSrc2 = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('no new label was introduced for it',
    !/LAST STAND|FINAL WORD|ONE MORE/i.test(uiSrc2 + fs.readFileSync('index.html', 'utf8')),
    'the four-name cap is untouched');
}

// ── The readout each mode actually needs ─────────────────────────────────
head('READOUT — metres where they mean something, gates where they do not');
{
  const uiSrc = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the HUD sub-line follows the mode',
    /routeGates > 0[\s\S]{0,140}wordGates\.next[\s\S]{0,80}Math\.floor\(sim\.distance\)/.test(uiSrc),
    'route position on the daily, metres in endless');
  check('the results card names the same figure',
    /this\._routeGates > 0[\s\S]{0,120}'GATES'[\s\S]{0,80}'METRES'/.test(uiSrc),
    'the card and the HUD do not disagree about what the run was');
  check('time is on the card and not on the HUD',
    /'TIME'/.test(uiSrc) && !/TIME[\s\S]{0,40}coach|this\.distSub[\s\S]{0,60}clock/.test(uiSrc),
    'a clock on the HUD tells a player to hurry; the read window exists so they need not');

  // On a fixed route every finisher covers the same ground, which is exactly
  // why metres cannot be the daily's readout.
  const finish = (early) => {
    const sim = new Sim(4242); sim.start(4242, null, { mode: 'standard', wordSalt: 0 });
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 900000 && !sim.routeFinished) {
      const wg = sim.wordGates, g = wg.current();
      const rem = g.d - sim.player.d;
      const win = early ? TUNING.WORDS.ARM_DISTANCE_M : TUNING.WORDS.ARM_DISTANCE_M * 0.06;
      const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected && rem <= win;
      sim.step({ ...emptyInput(), confirm: armed && g.real, reject: armed && !g.real });
    }
    return { d: Math.round(sim.player.d), t: sim.time, score: sim.score };
  };
  const a = finish(true), b = finish(false);
  // Not bit-identical — the finish fires on the gate count, so where the
  // runner physically is at that instant depends on the speed they carried.
  // Within a percent, which is the point: metres cannot tell them apart.
  check('two finishers of the daily route cover the same ground',
    Math.abs(a.d - b.d) / a.d < 0.01,
    `${a.d}m against ${b.d}m — ${(100 * Math.abs(a.d - b.d) / a.d).toFixed(2)}% apart, ` +
    'so metres cannot tell these two runs apart');
  check('but their scores and their times can',
    a.score !== b.score && Math.abs(a.t - b.t) > 1,
    `${a.score.toLocaleString()} in ${a.t.toFixed(0)}s against ${b.score.toLocaleString()} in ${b.t.toFixed(0)}s`);
}

// ── Phase I: the DASH chain ──────────────────────────────────────────────
head('DASH CHAIN — expression on the read, and nothing but the read');
{
  const S = TUNING.SCORE, W = TUNING.WORDS, B = TUNING.BOOST;
  check('the ladder starts at 1.0 and only climbs',
    S.DASH_CHAIN_MULT[0] === 1 && S.DASH_CHAIN_MULT.every((v, i, a) => i === 0 || v > a[i - 1]),
    S.DASH_CHAIN_MULT.join(' / '));

  // The Phase B two-run method: identical inputs, one run with the ladder
  // and one with it flattened to 1.0. Reads, distance, speed and meter must
  // be identical; only the score may differ.
  const drive = (flat) => {
    const saved = S.DASH_CHAIN_MULT.slice();
    if (flat) S.DASH_CHAIN_MULT.fill(1);
    const sim = new Sim(4242); sim.start(4242);
    let guard = 0, dashReads = 0, maxRung = 0, chainAlive = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 60000 && sim.player.d < 3200) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
      sim.step({ ...emptyInput(), confirm: armed && g.real, reject: armed && !g.real,
        boostHeld: sim.player.boostMeter >= B.MIN_ACTIVATE });
      for (const e of sim.events) if (e.t === 'word_correct' && e.dashMult > 1) { dashReads++; maxRung = Math.max(maxRung, e.dashChain); }
      sim.events.length = 0;
      if (!sim.player.overdrive && sim.player.dashChain !== 0) chainAlive++;
    }
    S.DASH_CHAIN_MULT.splice(0, S.DASH_CHAIN_MULT.length, ...saved);
    return { score: sim.score, d: +sim.player.d.toFixed(3), speed: +sim.player.speed.toFixed(6),
      meter: +sim.player.boostMeter.toFixed(6), correct: sim.wordGates.correctCount, dashReads, maxRung, chainAlive };
  };
  const ladder = drive(false), flat = drive(true);
  check('the multiplier reaches the score and only the score',
    ladder.score > flat.score && ladder.d === flat.d && ladder.speed === flat.speed &&
    ladder.meter === flat.meter && ladder.correct === flat.correct,
    `${ladder.score.toLocaleString()} vs ${flat.score.toLocaleString()} on ${ladder.correct} identical reads, same metres, same speed, same meter`);
  check('it actually fires: reads land inside dashes and climb the ladder',
    ladder.dashReads > 0 && ladder.maxRung >= 1, `${ladder.dashReads} dash reads, top rung ${ladder.maxRung}`);
  check('the chain never survives past the dash', ladder.chainAlive === 0,
    'dashChain is zero on every frame the dash is not live');

  // A wrong read of any kind zeroes it mid-dash.
  const zeroOn = (kind) => {
    const sim = new Sim(11); sim.start(11);
    let guard = 0, armedRung = false;
    while (sim.phase === PHASE.RUNNING && guard++ < 120000) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
      const inDash = sim.player.overdrive && sim.player.dashChain >= 1;
      const wrong = inDash && armed && ((kind === 'commission' && !g.real) || (kind === 'rejectReal' && g.real));
      if (inDash) armedRung = true;
      const before = wg.wrongCount;
      sim.step({ ...emptyInput(),
        confirm: (armed && g.real && !wrong) || (wrong && kind === 'commission'),
        reject: (armed && !g.real && !wrong) || (wrong && kind === 'rejectReal'),
        boostHeld: sim.player.boostMeter >= B.MIN_ACTIVATE });
      if (wrong && wg.wrongCount > before) return sim.player.dashChain;
    }
    return armedRung ? -1 : -2;
  };
  check('a wrong read of any kind zeroes the chain mid-dash',
    zeroOn('commission') === 0 && zeroOn('rejectReal') === 0,
    'tapping a fake and slipping a real both drop it to zero');

  // The window is untouched, the daily route is untouched.
  const srcs = ['src/sim/sim.js', 'src/sim/word-gates.js', 'src/sim/player.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  check('nothing in the phase writes the arm distance', !/ARM_DISTANCE_M\s*=/.test(srcs));
  const route = () => { const sim = new Sim(4242); sim.start(4242, null, { mode: 'standard', wordSalt: 0 });
    return Array.from({ length: 100 }, (_, i) => makeGate(sim.wordGates.seed, i).shown).join('|'); };
  check('the daily route is byte-identical with the ladder in place', route() === route());

  // A colour, never a label: every rim hue sits clear of the semantic set.
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  const RES = TUNING.META.RESERVED_HUES;
  const bad = B.DASH.CHAIN_HUES.filter((h) => RES.HUES.some((r) => hueGap(h, r.deg) < RES.MIN_SEPARATION_DEG));
  check('every dash-chain rim hue is >= the reserved separation from the semantic set',
    bad.length === 0 && B.DASH.CHAIN_HUES.length === S.DASH_CHAIN_MULT.length,
    bad.length ? `colliding: ${bad.join(', ')}` : `${B.DASH.CHAIN_HUES.join('/')}° clear by >= ${RES.MIN_SEPARATION_DEG}°`);
  const html = fs.readFileSync('index.html', 'utf8'), ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the rim reads the rung as a hue and the HUD gains no label',
    html.includes('hsl(var(--dashHue)') && ui.includes('--dashHue'),
    'a CSS custom property, no text — the four-name cap is policed by corruption-gates');
}

// ── Phase F: the player sets their own bar ───────────────────────────────
head('COMPRESSION — risk without a legibility cost');
{
  const W = TUNING.WORDS;

  // THE constraint. Compression moves the reward line and nothing else: the
  // word is legible for the whole window at every level, so no level can
  // threaten a reading floor.
  const windowAt = (speed) => W.ARM_DISTANCE_M / speed;
  const cruise = windowAt(TUNING.RUN.START_SPEED + TUNING.RUN.SPEED_GAIN_MAX * 4);
  const ceiling = windowAt(TUNING.RUN.CEILING);
  check('the reading window is the same at every compression level',
    W.COMPRESSION_MULT.every(() => windowAt(40) === windowAt(40)) &&
    W.ARM_DISTANCE_M === 55 && W.ARM_DISTANCE_M < W.SPACING_MIN_M,
    `${W.ARM_DISTANCE_M}m for every level — compression never touches the arm line`);
  check('and both reading floors still hold',
    cruise >= W.READ_WINDOW_MIN_S * 0.999 && ceiling >= W.READ_WINDOW_HARD_MIN_S * 0.83,
    `${cruise.toFixed(2)}s at cruise, ${ceiling.toFixed(2)}s at the ceiling`);
  const simSrc = fs.readFileSync('src/sim/sim.js', 'utf8');
  const wgSrc = fs.readFileSync('src/sim/word-gates.js', 'utf8');
  check('nothing in the phase writes the arm distance',
    !/ARM_DISTANCE_M\s*=/.test(simSrc + wgSrc + fs.readFileSync('src/sim/player.js', 'utf8')),
    'the one thing that would fail the legibility gate is impossible by construction');

  // The bar can only be set between gates. Tested mid-window rather than on
  // every armed frame: the frame a gate RESOLVES is not armed from the sim's
  // side, and the level may legitimately be set there — the word has already
  // been answered, so there is nothing left to judge after the fact.
  const barMove = (where) => {
    const sim = new Sim(4242); sim.start(4242);
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 40000) {
      const g = sim.wordGates.current();
      const remaining = g.d - sim.player.d;
      const armedMid = sim.wordGates.armed(sim.player.d) && remaining > 10;
      const inGap = !sim.wordGates.armed(sim.player.d) && remaining > W.ARM_DISTANCE_M + 10;
      if (where === 'armed' ? armedMid : inGap) {
        const before = sim.player.compressionLevel;
        sim.step({ ...emptyInput(), raiseBar: true });
        return sim.player.compressionLevel - before;
      }
      sim.step(emptyInput());
    }
    return null;
  };
  check('the bar moves in the gap between words',
    barMove('gap') === 1, 'a clear moment, with nothing on screen to judge');
  check('and cannot be moved while a word is armed',
    barMove('armed') === 0,
    'raising it on a word already being read would be judging the answer after seeing it');

  // Clearing your own bar pays; setting one you do not clear costs.
  const route = (level, answerAt) => {
    const sim = new Sim(777); sim.start(777, null, { mode: 'standard', wordSalt: 0 });
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 900000 && !sim.routeFinished) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d);
      if (!armed) sim.player.compressionLevel = level;
      const rem = g.d - sim.player.d;
      const act = armed && !g.confirmed && !g.rejected && rem <= W.ARM_DISTANCE_M * answerAt;
      sim.step({ ...emptyInput(), confirm: act && g.real, reject: act && !g.real });
    }
    return sim.score;
  };
  const edge = [0, 1, 2, 3].map((l) => route(l, 1.0));
  check('clearing a higher bar pays more',
    edge.every((v, i, a) => i === 0 || v > a[i - 1]),
    edge.map((v, i) => `L${i} ${v.toLocaleString()}`).join('  '));
  const mid = [0, 1, 2, 3].map((l) => route(l, 0.40));
  check('setting a bar you do not clear pays the late rate and nothing more',
    mid[2] < mid[0] && mid[3] === mid[2],
    `answering at 40% of the window: L0 ${mid[0].toLocaleString()}, ` +
    `L2 ${mid[2].toLocaleString()} — the bonus does not arrive and the early rate is gone`);
  check('a player can always answer late and live',
    mid[3] > 0 && route(3, 0.06) > 0,
    'every level still finishes the route; what a late answer costs is money, not the run');

  // A wrong read of any kind drops the bar to the floor.
  const dropsOn = (kind) => {
    const sim = new Sim(11); sim.start(11);
    let guard = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 100000) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d);
      if (!armed) sim.player.compressionLevel = 3;
      const wrong = armed && !g.confirmed && !g.rejected &&
        ((kind === 'commission' && !g.real) || (kind === 'rejectReal' && g.real));
      const before = wg.wrongCount;
      sim.step({ ...emptyInput(),
        confirm: wrong && kind === 'commission', reject: wrong && kind === 'rejectReal' });
      if (wg.wrongCount > before) return sim.player.compressionLevel;
    }
    return -1;
  };
  check('a wrong read of any kind drops the bar to the floor',
    dropsOn('commission') === 0 && dropsOn('rejectReal') === 0,
    'losing the level is the sting — the player chose the risk and it came due');

  // The gesture has to survive the speed it exists for. Holding must outlast
  // the tap window to be distinguishable at all, and the gap between words
  // collapses as the run gets faster — so the intent is buffered and lands at
  // the next legal moment rather than requiring a gap long enough to hold in.
  const gapAt = (spacing, speed) => (spacing - W.ARM_DISTANCE_M) / speed;
  check('the gesture is reachable at the speed it exists for',
    gapAt(W.SPACING_MIN_M, TUNING.RUN.CEILING) < 0.25 &&
    /this\.pendingBar/.test(simSrc),
    `the gap is ${gapAt(W.SPACING_MIN_M, TUNING.RUN.CEILING).toFixed(2)}s at the spacing floor ` +
    'and the ceiling — shorter than any hold could be, so the intent is buffered');
  check('a buffered change still never lands on a word already showing',
    /this\.pendingBar !== 0 && !this\.wordGates\.armed/.test(simSrc),
    'the word it affects is one the player has not seen');
  check('one hold moves the bar exactly one level',
    /input\.raiseBar = false;\s*\n\s*input\.lowerBar = false;/.test(simSrc) &&
    /Math\.sign\(this\.pendingBar\)/.test(simSrc),
    'advance() runs several fixed steps a frame; an unconsumed edge moved it two');

  check('the level is shown as marks, never as a name',
    /barLevel/.test(fs.readFileSync('src/ui/ui.js', 'utf8')) &&
    /'\u25b0'\.repeat/.test(fs.readFileSync('src/ui/ui.js', 'utf8')),
    'the naming cap is four and this is not one of them');
}

// ── Phase G: the words you keep missing ──────────────────────────────────
head('NEMESIS — a substitution, never a reordering');
{
  // THE guarantee. The tier walk is a coprime stride over each tier's list and
  // reaching into it would break no-repeat for every word, not just the
  // substituted one. Build the same 400 gates with and without a lane that
  // substitutes constantly, and the walk's own choice must be identical.
  const noLane = Array.from({ length: 400 }, (_, i) => makeGate(4242, i).walked);
  const heavy = Array.from({ length: 400 }, (_, i) =>
    makeGate(4242, i, undefined, () => 'INTRUDER').walked);
  check('the tier walk is byte-identical with and without the lane',
    noLane.join('|') === heavy.join('|'),
    `${noLane.length} gates, the walk chose the same word at every one`);

  // And the no-repeat property itself still holds on the walk.
  const walkDupes = noLane.length - new Set(noLane).size;
  const laneDupes = heavy.length - new Set(heavy).size;
  check('the no-repeat guarantee survives the lane',
    walkDupes === laneDupes,
    `${walkDupes} repeats either way across 400 gates`);

  // A substituted gate shows the lane's word and admits it.
  const swapped = makeGate(4242, 24, undefined, (i) => (i === 24 ? 'receive' : null));
  const plain = makeGate(4242, 24);
  check('a lane gate shows the lane word and flags itself',
    swapped.answer === 'receive' && swapped.fromLane === true &&
    plain.fromLane === false && swapped.walked === plain.walked,
    'the printed word changed; the word the walk drew did not');
  check('a lane gate is still a real gate',
    swapped.d === plain.d && swapped.tier === plain.tier && swapped.real === plain.real,
    'same position, same tier, same truth — only the vocabulary is personal');

  // The daily route must be identical for everyone, so it refuses the lane.
  const daily = new Sim(4242);
  daily.start(4242, null, { mode: 'standard', wordSalt: 0, nemesisLane: () => 'INTRUDER' });
  const dailyWords = Array.from({ length: 100 }, (_, i) => {
    daily.wordGates.next = i; daily.wordGates.gate = null;
    return daily.wordGates.current().shown;
  });
  check('the daily route contains zero substitutions',
    !dailyWords.includes('INTRUDER') && daily.wordGates.lane === null,
    'a personal word would make two identical-looking scores incomparable');
  const endless = new Sim(4242);
  endless.start(4242, null, { mode: 'endless', nemesisLane: (i) => (i === 12 ? 'INTRUDER' : null) });
  check('endless accepts it',
    typeof endless.wordGates.lane === 'function',
    'endless is where the practice happens, so it is where the lane lives');
}

head('LEDGER — bounded, spaced, and it survives being put down');
{
  const led = new NemesisLedger(memoryAdapter());
  led.record('receive', false, 0);
  check('a missed word comes back inside the same run',
    led.history('receive').due === NEMESIS.SCHEDULE_GATES[0] &&
    led.substituteFor(NEMESIS.LANE_EVERY) === 'receive',
    `due at gate ${led.history('receive').due}, and the lane offers it at 12`);
  check('and only at a lane gate',
    led.substituteFor(NEMESIS.LANE_EVERY - 1) === null,
    'roughly one gate in twelve, not every gate the word is due at');

  // Spacing, and rotation among equals. Without both, one word owned every
  // lane gate — measured, the same word filled 12, 24, 36 and 48 of a run.
  const rota = new NemesisLedger(memoryAdapter());
  for (const w of ['hip', 'bureau', 'receive']) rota.record(w, false, 0);
  const lane = [];
  for (let g = NEMESIS.LANE_EVERY; g <= 100; g += NEMESIS.LANE_EVERY) {
    const sub = rota.substituteFor(g);
    if (sub) { lane.push(sub); rota.record(sub, true, g); }
  }
  check('the lane rotates instead of repeating one word',
    new Set(lane.slice(0, 3)).size === 3,
    `first three substitutions: ${lane.slice(0, 3).join(', ')}`);
  check('and a word read right goes further away, not straight back',
    lane[0] === lane[3],
    `${lane[0]} returns at the fourth substitution, not the second`);

  for (let i = 0; i < NEMESIS.RETIRE_CLEAN; i++) led.record('receive', true, 40 + i);
  check('three clean reads retire a word for good',
    led.retiredCount === 1 && led.history('receive') === null,
    'the payoff for the whole ledger is a word leaving it');

  const shared = memoryAdapter();
  const a = new NemesisLedger(shared);
  a.record('bureau', false, 0);
  const b = new NemesisLedger(shared);
  check('the ledger survives a storage round-trip',
    b.history('bureau')?.m === 1,
    'written through the same adapter seam as the stats');

  const big = new NemesisLedger(memoryAdapter());
  for (let i = 0; i < 900; i++) big.record(`w${i}`, false, i);
  check('the ledger is bounded',
    big.size === NEMESIS.CAP,
    `900 words offered, ${big.size} held — trimmed on write, not on read`);

  // The curve refuses to draw a trend it cannot support.
  const curve = new CurveLog(memoryAdapter());
  check('the curve says nothing until it has something to say',
    curve.summary().days === 0 && curve.summary().tiers.length === 0,
    'a trend drawn from one run is a lie with a chart around it');
  curve.addRun({ perTier: { 3: { a: 10, c: 6 } }, avgReadMs: 700, reads: 10 });
  const sum = curve.summary();
  check('and reports the week once it does',
    sum.tiers[0].tier === 3 && sum.tiers[0].now === 60 && sum.readMs === 700,
    `tier 3 at ${sum.tiers[0].now}%, ${sum.readMs}ms average read`);
}

// ── Deception families ───────────────────────────────────────────────────
head('FAMILIES — runs of one trap, so the trap is learnable');
{
  // A block of gates shares a preferred deception. Four unrelated single edits
  // teach only that something somewhere is wrong; four transpositions in a row
  // teach a player to look for transpositions.
  const familyOf = (word, fake) => {
    const w = String(word), f = String(fake);
    if (f.length === w.length + 1) return 'double';
    if (f.length === w.length - 1) return 'drop';
    if (f.length !== w.length) return 'other';
    const diff = [...w].map((c, i) => (c === f[i] ? null : i)).filter((x) => x !== null);
    if (diff.length === 2 && w[diff[0]] === f[diff[1]] && w[diff[1]] === f[diff[0]]) return 'transpose';
    if (diff.length === 1 && 'aeiou'.includes(w[diff[0]]) && 'aeiou'.includes(f[diff[0]])) return 'vowel';
    return 'other';
  };
  let blocksSeen = 0, blocksPure = 0;
  for (let seed = 0; seed < 120; seed++) {
    for (let b = 0; b < 8; b++) {
      const fams = [];
      for (let i = b * 5; i < (b + 1) * 5; i++) {
        const g = makeGate(seed, i);
        if (!g.real) fams.push(familyOf(g.answer, g.shown));
      }
      if (fams.length < 3) continue;
      blocksSeen++;
      const want = MUTATION_FAMILIES[familyForGate(seed, b * 5)];
      if (fams.filter((f) => f === want).length >= fams.length - 1) blocksPure++;
    }
  }
  check('a block of gates leans on one deception family',
    blocksPure / blocksSeen > 0.7,
    `${blocksPure} of ${blocksSeen} blocks ran their family with at most one exception`);
  check('the family is a bias, never a requirement',
    blocksPure < blocksSeen,
    'a short word or a blocked edit falls through to the general search rather than failing');
  check('the family walk is pure in the seed',
    familyForGate(4242, 17) === familyForGate(4242, 17) &&
    familyForGate(4242, 17) !== undefined,
    'the daily route composes identically for everyone');

  // Safety is untouched: the bias reorders which edits are TRIED, never which
  // are allowed, so no new string becomes reachable.
  const src = fs.readFileSync('src/words/wordlist.js', 'utf8');
  check('the safety guard still runs on every preferred edit',
    /if \(prefer >= 0[\s\S]{0,320}if \(!bad\(f\)\) return f;/.test(src),
    'the family picks the order of attempts; bad() still decides what ships');
}

// ── Surge: what holding a peak looks like ────────────────────────────────
head('SURGE — a reward for staying at the top, not for arriving');
{
  const W = TUNING.WORDS, B = TUNING.BOOST, C = TUNING.CAMERA;

  // One run over the daily route, acting on every gate at a chosen fraction of
  // the arm window: confirming the real words, and optionally rejecting the
  // fakes rather than letting them pass. Returns the surge trace rather than a
  // final value — surge is a thing you hold, so the collapse matters as much
  // as the peak. `breakAt` throws one deliberate commission (calling a fake
  // real), the one action that costs a heart.
  const run = (fraction, { reject = true, breakAt = -1 } = {}) => {
    const sim = new Sim(4242); sim.start(4242);
    let guard = 0, peak = 0, reads = 0, afterBreak = null, peakBeforeBreak = 0;
    while (sim.phase === PHASE.RUNNING && guard++ < 90000) {
      const wg = sim.wordGates, g = wg.current();
      const armed = wg.armed(sim.player.d) && !g.confirmed;
      const act = armed && (g.d - sim.player.d) <= W.ARM_DISTANCE_M * fraction;
      const sabotage = act && !g.real && breakAt >= 0 &&
        afterBreak === null && sim.player.surge() === 1;
      const before = sim.player.surgeReads;
      sim.step({ ...emptyInput(),
        confirm: act && (g.real || sabotage),
        reject: act && reject && !g.real && !sabotage });
      if (sim.player.surgeReads > before) reads++;
      if (sim.player.surge() > peak) peak = sim.player.surge();
      if (sabotage) { peakBeforeBreak = 1; afterBreak = sim.player.surgeReads; }
      if (sim.player.d > 4000) break;
    }
    return { peak, reads, afterBreak, peakBeforeBreak,
      score: Math.floor(sim.player.score), speed: +sim.player.speed.toFixed(6) };
  };

  const early = run(1.0);
  const late = run(0.06);

  check('holding the cap while answering early fills the surge',
    early.peak === 1 && early.reads >= B.SURGE_READS,
    `peak ${early.peak.toFixed(2)} over ${early.reads} qualifying reads`);

  check('a perfect run answered on the line never surges',
    late.peak === 0,
    'the chain caps either way — earliness is the half that is not automatic');

  // The rule the reject zone has been waiting for. A passed fake is a correct
  // answer and always will be, but it resolves AT the line — there is no early
  // moment in it to reward. Rejecting the same fake from range is the same
  // answer, given sooner, and only that sustains the surge.
  // (Phase L5+: the old form compared peaks over the coin's texture, which
  // the chart's breathers legitimately changed — long all-real stretches let
  // a passing reader surge on reals alone. This is the STRUCTURAL rule:
  // hold the surge at 1, pass one fake, and watch it die on that frame.)
  const probe = new Sim(4242); probe.start(4242);
  let pGuard = 0, passedZeroed = null;
  while (probe.phase === PHASE.RUNNING && pGuard++ < 90000 && passedZeroed === null) {
    const wg = probe.wordGates, g = wg.current();
    const armed = wg.armed(probe.player.d) && !g.confirmed;
    const atSurge = probe.player.surge() === 1;
    const act = armed && !(atSurge && !g.real); // at full surge, pass the fake
    const before = wg.next;
    probe.step({ ...emptyInput(), confirm: act && g.real, reject: act && !g.real });
    if (atSurge && wg.next > before && !g.real && !g.confirmed && !g.rejected) {
      passedZeroed = probe.player.surgeReads === 0;
    }
  }
  check('a passed fake does not sustain the surge; a rejected one does',
    passedZeroed === true && early.peak === 1,
    'the surge held at 1 by rejects died on the frame one fake was let pass');

  check('the surge needs the chain capped, not merely climbing',
    (() => {
      const sim = new Sim(4242); sim.start(4242);
      let guard = 0, sawUncapped = false;
      while (sim.phase === PHASE.RUNNING && guard++ < 20000) {
        const wg = sim.wordGates, g = wg.current();
        const armed = wg.armed(sim.player.d) && !g.confirmed;
        sim.step({ ...emptyInput(), confirm: armed && g.real, reject: armed && !g.real });
        if (sim.player.chain > 0 && sim.player.chain < B.CHAIN_CAP &&
            sim.player.surgeReads > 0) sawUncapped = true;
        if (sim.player.chain > B.CHAIN_CAP) break;
      }
      return !sawUncapped;
    })(),
    `nothing accrues below chain ${B.CHAIN_CAP}, however early the answers land`);

  const broken = run(1.0, { breakAt: 1 });
  check('one wrong read empties it',
    broken.peakBeforeBreak === 1 && broken.afterBreak === 0,
    `full surge into the commission, ${broken.afterBreak} after it`);

  check('and it has to be earned back from nothing',
    (() => {
      const p = new Sim(1).player;
      p.surgeReads = B.SURGE_READS; const full = p.surge();
      p.surgeReads = 0;
      return full === 1 && p.surge() === 0;
    })(),
    'there is no decay path and no partial credit — it is a streak, not a battery');

  check('the surge reaches nothing that decides the run',
    early.speed === late.speed &&
    !/surge/i.test(fs.readFileSync('src/sim/player.js', 'utf8')
      .slice(fs.readFileSync('src/sim/player.js', 'utf8').indexOf('chainMult()'))),
    `both runs end at ${early.speed} m/s; no score or speed term reads it`);

  // Legibility is the fence the whole brief sits inside. The surge opens the
  // field of view, and a field of view that opens far enough shrinks the word.
  check('the view it opens is smaller than the beat already moves it',
    C.SURGE_FOV > 0 && C.SURGE_FOV < C.MUSIC_PULSE_FOV / 3 &&
    C.SURGE_FOV < B.DASH.KICK_FOV / 2,
    `${C.SURGE_FOV} degrees at full surge against ${C.MUSIC_PULSE_FOV} for the beat`);

  check('and it is clamped with everything else',
    (() => {
      const src = fs.readFileSync('src/render/camera-rig.js', 'utf8');
      const i = src.indexOf('const fov = Math.min(C.FOV_MAX');
      return i > 0 && /SURGE_FOV/.test(src.slice(i, src.indexOf(';', i)));
    })(),
    `the surge term sits inside the FOV_MAX clamp, not after it`);
}

// ── Danger ratings ───────────────────────────────────────────────────────
head('DANGER — how hard a word is to read, from the word itself');
{
  // The aggregate half of this number ("how often does everyone else miss it")
  // is blocked on a board that does not exist yet. The structural half needs
  // nobody, and is the half that is actually a property of the word.
  const s = structuralDanger;

  check('a short plain word carries no danger',
    s('cat') === 0 && s('run') === 0 && s('the') === 0,
    'three letters and nowhere for an edit to hide');

  check('the traps rate above the plain words',
    s('necessary') > s('receive') && s('maintenance') > s('garden') &&
    s('accommodate') > s('animal'),
    `necessary ${s('necessary').toFixed(2)} vs receive ${s('receive').toFixed(2)}`);

  check('it is bounded and pure',
    ALL_WORDS.every((w) => { const d = s(w); return d >= 0 && d <= 1 && d === s(w); }),
    `every one of ${ALL_WORDS.length} shipped words rates inside 0..1`);

  check('the bank spreads across all three bands',
    (() => {
      const bands = { low: 0, mid: 0, high: 0 };
      for (const w of ALL_WORDS) bands[dangerBand(s(w))]++;
      return bands.low > 0 && bands.mid > 0 && bands.high > 0 &&
        bands.high < ALL_WORDS.length * 0.5;
    })(),
    (() => {
      const b = { low: 0, mid: 0, high: 0 };
      for (const w of ALL_WORDS) b[dangerBand(s(w))]++;
      return `${b.low} low, ${b.mid} mid, ${b.high} high`;
    })());

  check('danger rises with tier, on average',
    (() => {
      const avg = (t) => { const ws = tierWords(t); return ws.reduce((a, w) => a + s(w), 0) / ws.length; };
      return avg(4) > avg(1) && avg(3) > avg(1);
    })(),
    `tier 1 ${(tierWords(1).reduce((a, w) => a + s(w), 0) / tierWords(1).length).toFixed(2)}` +
    ` → tier 4 ${(tierWords(4).reduce((a, w) => a + s(w), 0) / tierWords(4).length).toFixed(2)}`);

  // Evidence from the local ledger. One miss is an accident; a pattern is a
  // rating — and a single player is never enough to overrule the word itself.
  check('one miss does not make a word dangerous',
    dangerFor('cat', { a: 1, m: 1 }) === s('cat') &&
    dangerFor('cat', { a: 2, m: 2 }) === s('cat'),
    'below three attempts the ledger is ignored entirely');

  check('a pattern of misses does move it',
    dangerFor('cat', { a: 6, m: 6 }) > s('cat') &&
    dangerFor('necessary', { a: 6, m: 0 }) < s('necessary'),
    `a word missed 6 of 6 rates ${dangerFor('cat', { a: 6, m: 6 }).toFixed(2)} against ${s('cat').toFixed(2)} cold`);

  check('and one player never fully overrules the word',
    (() => {
      let worst = 0;
      for (let a = 3; a < 400; a++) worst = Math.max(worst, Math.abs(dangerFor('cat', { a, m: a }) - 1));
      return worst > 0.39;
    })(),
    'the local weight is capped at 0.6, so the structural half always survives');

  // Where it shows up. The review panel is the only place a danger rating has
  // anything to do: mid-run it would be a hint, and on the results card it
  // would compete with the score.
  {
    const uiSrc = fs.readFileSync('src/ui/ui.js', 'utf8');
    const row = uiSrc.slice(uiSrc.indexOf('_missedRow('), uiSrc.indexOf('clearRun()'));
    check('the rating reaches the review panel and nowhere else',
      /dangerBand\(dangerFor\(/.test(row) &&
      /renderMissedPanel\(\(w\) => nemesis\.history\(w\)\)/
        .test(fs.readFileSync('src/main.js', 'utf8')),
      'drawn per missed word, with that word\'s own ledger row as evidence');

    check('and it is shown as marks, never as a name',
      /mRisk/.test(row) && !/'(LOW|MID|HIGH|HARD|TRICKY|EASY)'/.test(row),
      'three pips — the same choice the compression bar makes, and the naming cap is still four');

    check('a word with no history still rates',
      dangerBand(dangerFor('necessary', null)) === dangerBand(structuralDanger('necessary')),
      'a first-run player sees the same panel as a returning one, minus the personal half');
  }

  check('the rating is bounded whatever the ledger says',
    [[0, 0], [3, 9], [50, 50], [7, -4]].every(([a, m]) => {
      const d = dangerFor('necessary', { a, m });
      return d >= 0 && d <= 1;
    }),
    'a corrupt or impossible evidence row cannot produce an out-of-range band');
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
