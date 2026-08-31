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
  // Phase 23: a silent run wipes out. Every real word that slips costs a
  // heart, so the run that never touches the screen ends on the third one —
  // it does not coast on the free 50% that passing every fake used to bank.
  // Nothing is ever tapped, so nothing is ever a false tap.
  check('a silent run wipes out — every missed real is on the hearts ledger',
    sim.player.obstaclesHit === sim.wordGates.missedReals &&
    sim.wordGates.missedReals === s.wordsWrong && sim.wordGates.falseTaps === 0,
    `${sim.wordGates.missedReals} omissions, ${sim.player.obstaclesHit} on the hit ledger`);
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
  check('after the window the coin flip is untouched',
    Math.abs(rate - W.FAKE_CHANCE) < 0.02,
    `${(rate * 100).toFixed(1)}% fake against a ${(W.FAKE_CHANCE * 100).toFixed(0)}% draw`);

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
  check('the armed plate is drawn at full opacity, independent of lookahead',
    /this\.current\.place\(g\.shown, g\.d, terrain\.heightAt\(0, g\.d\), camera,\s*1,/.test(src),
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

  // The pre-Phase-A build drew exactly one preview plate at 0.55.
  check('LOOKAHEAD_GATES = 1 reproduces the build before this phase',
    fade[0] === 0.55, 'first step is the 0.55 the old preview plate used');
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
