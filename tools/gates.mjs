/**
 * Core frame gates — DICTION DASH Phase 7.
 *
 * The mountain suite this file used to be described carving, obstacles and
 * a hunted descent; that game is gone. What the frame still owes — and what
 * these gates hold — is:
 *
 *   TRACK      flat, winding, bounded curvature, auto-followed
 *   SPEED      a pure function of reading, deterministic, floored/ceilinged
 *   PURSUIT    gap = clamped integral of (speed − pace); nothing else
 *   BOOST      Overdrive still spends meter for real differential
 *   GHOSTS     record/replay determinism, seed-keyed, non-perturbing
 *   LOOP       instant restarts, stable daily seed, 60hz step budget
 *
 * Every assertion drives the real Sim through real fixed timesteps.
 *
 *   npm run gates
 */

import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { Terrain } from '../src/sim/terrain.js';
import { GhostPlayer } from '../src/sim/ghost.js';
import { hashString, dailySeedString } from '../src/sim/rng.js';

// ── tiny test harness ─────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) { PASS++; results.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; results.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
function head(t) { results.push(`\n\x1b[1m${t}\x1b[0m`); }
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

const R = TUNING.RUN;
const BE = TUNING.BEAST;
const DT = TUNING.SIM.DT;

const DAILY = hashString(dailySeedString(new Date('2026-08-06T12:00:00Z')));
const SEEDS = [DAILY, 12345, 999, 777001, 42, 8675309, 31337, 5150, 20260806, 101];

/** A competent reader: confirms each armed real word exactly once. */
function reader(sim) {
  const g = sim.wordGates.current();
  if (g.real && !g.confirmed && sim.wordGates.armed(sim.player.d)) return true;
  return false;
}

/** Run a sim for n steps with inputFn(sim, i) -> {confirm, boostHeld}. */
function run(seed, steps, inputFn = () => ({}), ghostData = null) {
  const sim = new Sim(seed);
  sim.start(seed, ghostData);
  const input = emptyInput();
  for (let i = 0; i < steps; i++) {
    const cmd = inputFn(sim, i) || {};
    input.confirm = !!cmd.confirm;
    input.boostHeld = !!cmd.boostHeld;
    sim.step(input);
    if (sim.phase === PHASE.DEAD) break;
  }
  return sim;
}

// ── TRACK ─────────────────────────────────────────────────────────────────
head('TRACK — flat, winding, auto-followed');

{
  const t = new Terrain(SEEDS[1]);
  let flat = true;
  for (let d = 0; d < 5000; d += 37) {
    for (const x of [-7, 0, 7]) if (t.heightAt(x, d) !== 0) { flat = false; break; }
  }
  check('the track is flat: heightAt is zero everywhere', flat);

  let maxSlope = 0;
  for (let d = 0; d < 8000; d += 1) {
    maxSlope = Math.max(maxSlope, Math.abs(t.corridorSlope(d)));
  }
  check('curvature is bounded: peak |dx/dd| stays under 0.5',
    maxSlope < 0.5, `peak ${maxSlope.toFixed(3)}`);

  let maxStep = 0;
  let prev = t.corridorX(0);
  for (let d = 0.5; d < 4000; d += 0.5) {
    const c = t.corridorX(d);
    maxStep = Math.max(maxStep, Math.abs(c - prev));
    prev = c;
  }
  check('the centerline is continuous (no jumps)', maxStep < 0.3,
    `max 0.5m-step delta ${maxStep.toFixed(3)}m`);

  const t2 = new Terrain(SEEDS[1]);
  const t3 = new Terrain(SEEDS[2]);
  check('the winding is seeded: same seed same path, new seed new path',
    t.corridorX(1234) === t2.corridorX(1234) && t.corridorX(1234) !== t3.corridorX(1234));

  check('nothing spawns on the track: no colliders, gates, ice, grade',
    t.collidersNear(500).length === 0 && t.gatesNear(500).length === 0 &&
    !t.isIce(3, 500) && t.gradeMul(500) === 1);
}

{
  // Auto-follow at the worst case: pin speed at the ceiling and measure how
  // far the runner ever drifts off the authored line. No steering input
  // exists; the track must carry the runner through every turn itself.
  let worst = 0;
  const sim = new Sim(SEEDS[3]);
  sim.start(SEEDS[3]);
  const input = emptyInput();
  for (let i = 0; i < 60 * 60; i++) {
    sim.player.speed = R.CEILING;
    sim.beast.gap = BE.MAX_GAP; // keep the run alive; this test is the line
    sim.hearts = 3;
    input.confirm = reader(sim);
    sim.step(input);
    worst = Math.max(worst, Math.abs(sim.player.x - sim.terrain.corridorX(sim.player.d)));
  }
  check('auto-follow holds the line at ceiling speed (one input, zero steering)',
    worst < 3.0, `worst drift ${worst.toFixed(2)}m over 60s at ${R.CEILING} m/s`);
}

// ── SPEED — a pure function of reading ────────────────────────────────────
head('SPEED — deterministic consequence, floored and ceilinged');

{
  // Unit-test the deltas in isolation from rendering AND from gate timing:
  // resolve words directly against a fresh sim's player.
  const sim = new Sim(SEEDS[2]);
  sim.start(SEEDS[2]);
  const input = emptyInput();

  // Ride to the first gate and answer it correctly.
  let guard = 60 * 30;
  const before = sim.player.speed;
  while (sim.wordGates.correctCount + sim.wordGates.wrongCount === 0 && guard-- > 0) {
    input.confirm = reader(sim);
    sim.step(input);
  }
  const firstWasCorrect = sim.wordGates.correctCount === 1;
  const expectedGain = R.SPEED_GAIN_MAX * (R.CEILING - before) / (R.CEILING - R.FLOOR);
  check('a correct read adds exactly the curve gain (headroom-proportional)',
    firstWasCorrect && Math.abs(sim.player.speed - (before + expectedGain)) < 1e-9,
    `${f2(before)} -> ${f2(sim.player.speed)} (+${f2(expectedGain)})`);

  // Now tap EVERY armed word: reals stay correct, the first fake is a
  // commission — the only wrong read that is also the DESCENT obstacle hit.
  const hitsBefore = sim.player.obstaclesHit;
  guard = 60 * 60;
  let speedBefore = sim.player.speed;
  while (sim.wordGates.wrongCount === 0 && guard-- > 0) {
    const g = sim.wordGates.current();
    if (!g.resolved) speedBefore = sim.player.speed;
    input.confirm = sim.wordGates.armed(sim.player.d) && !g.confirmed;
    sim.step(input);
  }
  check('tapping a fake (commission) subtracts exactly SPEED_LOSS',
    Math.abs(sim.player.speed - Math.max(R.FLOOR, speedBefore - R.SPEED_LOSS)) < 1e-9,
    `${f2(speedBefore)} -> ${f2(sim.player.speed)} (-${R.SPEED_LOSS})`);
  check('and costs exactly one heart through the obstacle ledger',
    sim.player.obstaclesHit === hitsBefore + 1 && sim.wordGates.falseTaps === 1);
}

{
  // Omission: let a real word slip in silence. Phase 23 made this cost a
  // heart too. Handing its whole consequence to the Redline's differential
  // made DOING NOTHING a legal strategy — half of every gate is a fake,
  // passing a fake is the correct answer, so a run that never taps banked
  // 50% accuracy for free and could not lose a heart at all.
  //
  // The fairness the asymmetry was built for (the 'sped through Shore ->
  // game over' fix) is kept by degree, not by exemption: commission costs
  // the heart AND the stagger AND the meter; omission costs the heart alone.
  const seed = SEEDS.find((s2) => new Sim(s2).wordGates.current().real) ?? SEEDS[0];
  const sim = new Sim(seed);
  sim.start(seed);
  const input = emptyInput();
  let guard = 60 * 30;
  while (sim.player.d < sim.wordGates.current().d - 1 && guard-- > 0) sim.step(input);
  const speedBefore = sim.player.speed;
  const hitsBefore = sim.player.obstaclesHit;
  guard = 60 * 10;
  while (sim.wordGates.wrongCount === 0 && guard-- > 0) sim.step(input);
  check('missing a real word (omission) subtracts exactly SPEED_LOSS',
    Math.abs(sim.player.speed - Math.max(R.FLOOR, speedBefore - R.SPEED_LOSS)) < 1e-9,
    `${f2(speedBefore)} -> ${f2(sim.player.speed)}`);
  // Phase C moved the heart. It was on both wrong reads from Phase 23, which
  // existed to stop idling; the left zone makes that placement untenable,
  // because a reject that costs MORE than silence is a control nobody will
  // ever press. The heart now sits on exactly one action — saying REAL to a
  // fake — and the anti-idle property is re-established below by measurement
  // rather than by the heart, which was never the thing doing the work.
  check('an omission costs no heart — silence must not outrank the reject',
    sim.player.obstaclesHit === hitsBefore &&
    sim.wordGates.missedReals === 1 && sim.wordGates.falseTaps === 0,
    `hearts ledger ${hitsBefore} -> ${sim.player.obstaclesHit}`);
  check('and NOT the stagger — hesitation is still not a crash',
    sim.player.staggerT === 0,
    'commission stays strictly worse: heart + stagger + meter, against speed alone');

  // Exactly one action in the whole rulebook spends a heart.
  const spendsHeart = (kind, action) => {
    const s2 = new Sim(11); s2.start(11);
    let guard = 0;
    while (s2.phase === PHASE.RUNNING && guard++ < 100000) {
      const wg = s2.wordGates, g = wg.current();
      const match = (kind === 'real') === g.real;
      const armed = wg.armed(s2.player.d) && match && !g.confirmed && !g.rejected;
      const before = s2.player.obstaclesHit;
      s2.step({ ...emptyInput(),
        confirm: armed && action === 'right', reject: armed && action === 'left' });
      if (match && g.resolved) return s2.player.obstaclesHit > before;
    }
    return false;
  };
  const heartTable = [['real', 'right'], ['real', 'left'], ['real', 'pass'],
    ['fake', 'left'], ['fake', 'pass'], ['fake', 'right']];
  const spenders = heartTable.filter(([k, a]) => spendsHeart(k, a)).map(([k, a]) => `${k}+${a}`);
  check('exactly one action in the rulebook spends a heart',
    spenders.length === 1 && spenders[0] === 'fake+right',
    `spends a heart: ${spenders.join(', ') || 'nothing'}`);

  // Doing nothing is still not a strategy — the Redline does that work.
  const idle = (() => {
    const s3 = new Sim(4242); s3.start(4242);
    let guard = 0;
    while (s3.phase === PHASE.RUNNING && guard++ < 400000) s3.step(emptyInput());
    return { d: Math.round(s3.player.d), t: s3.time };
  })();
  check('doing nothing is still not a strategy',
    idle.d < 600 && idle.t < 30,
    `an untouched run ends at ${idle.d}m in ${idle.t.toFixed(1)}s, run down rather than wiped out`);
}

{
  // The curve's shape (Phase 8): gains shrink monotonically with speed,
  // full-size at the floor, and the ceiling is an asymptote — a long
  // streak approaches it closely but the sim never reaches or passes it.
  const gainAt = (v) => R.SPEED_GAIN_MAX * (R.CEILING - v) / (R.CEILING - R.FLOOR);
  check('curve gain is full-size at the floor and shrinks monotonically',
    Math.abs(gainAt(R.FLOOR) - R.SPEED_GAIN_MAX) < 1e-9 &&
    gainAt(30) > gainAt(45) && gainAt(45) > gainAt(60) && gainAt(R.CEILING) === 0,
    `${f2(gainAt(R.FLOOR))} @floor -> ${f2(gainAt(45))} @45 -> ${f2(gainAt(60))} @60`);

  // Sustained skill: reaching 90% of the start->ceiling headroom must take
  // well more than the ~10 reads the flat gain needed to pin the old cap.
  let v = R.START_SPEED;
  let reads = 0;
  const target = R.CEILING - 0.1 * (R.CEILING - R.START_SPEED);
  while (v < target && reads < 200) { v += gainAt(v); reads++; }
  check('90% of the headroom takes a sustained streak (>= 18 clean reads)',
    reads >= 18 && reads < 200, `${reads} reads to ${f2(v)} of ${R.CEILING}`);

  const up = run(SEEDS[4], 60 * 120, (sim) => ({ confirm: reader(sim) }));
  check('a long perfect run approaches the ceiling but never reaches it',
    up.player.speed < R.CEILING && up.player.speed > R.CEILING - 4,
    `speed ${f2(up.player.speed)} / ceiling ${R.CEILING} after ${up.wordGates.correctCount} reads`);

  const sim = new Sim(SEEDS[5]);
  sim.start(SEEDS[5]);
  const input = emptyInput();
  for (let i = 0; i < 60 * 120 && sim.phase === PHASE.RUNNING; i++) {
    const g = sim.wordGates.current();
    // Deliberately wrong on every gate; pin the pursuit off so the floor
    // itself is what is under test.
    input.confirm = sim.wordGates.armed(sim.player.d) && !g.confirmed ? !g.real : false;
    sim.beast.gap = BE.MAX_GAP;
    sim.hearts = 3;
    sim.step(input);
  }
  check('repeated misses clamp at the floor, never a stall',
    sim.player.speed >= R.FLOOR - 1e-9 && sim.wordGates.wrongCount >= 4,
    `speed ${f2(sim.player.speed)} after ${sim.wordGates.wrongCount} straight misses`);
}

{
  // Legibility bounds, split by Phase 8 into the two-tier standard: the
  // COMFORT window (READ_WINDOW_MIN_S) must hold at the speed a
  // good-but-human streak of CRUISE_READS reaches — the speed the game is
  // actually played at — and the HARD floor must hold at the asymptotic
  // ceiling itself, else no calibration could save it. The final ceiling
  // is picked by feel (see tools/speed-calibration.mjs for the table).
  const W = TUNING.WORDS;
  let cruise = R.START_SPEED;
  for (let i = 0; i < W.CRUISE_READS; i++) {
    cruise += R.SPEED_GAIN_MAX * (R.CEILING - cruise) / (R.CEILING - R.FLOOR);
  }
  check(`comfort window holds at cruise (${W.CRUISE_READS} clean reads in)`,
    W.ARM_DISTANCE_M / cruise >= W.READ_WINDOW_MIN_S,
    `${(W.ARM_DISTANCE_M / cruise).toFixed(2)}s at ${f2(cruise)} m/s (floor ${W.READ_WINDOW_MIN_S}s)`);
  check('hard window holds at the asymptotic ceiling',
    W.ARM_DISTANCE_M / R.CEILING >= W.READ_WINDOW_HARD_MIN_S,
    `${(W.ARM_DISTANCE_M / R.CEILING).toFixed(2)}s at ${R.CEILING} m/s (hard floor ${W.READ_WINDOW_HARD_MIN_S}s)`);
  check('Overdrive at cruise stays above the hard window',
    W.ARM_DISTANCE_M / (cruise * TUNING.BOOST.SPEED_MULT) >= W.READ_WINDOW_HARD_MIN_S,
    `${(W.ARM_DISTANCE_M / (cruise * TUNING.BOOST.SPEED_MULT)).toFixed(2)}s while spending`);
  check('the floor keeps the run moving (a word at most ~5s away)',
    W.SPACING_M / R.FLOOR <= 6,
    `${(W.SPACING_M / R.FLOOR).toFixed(1)}s between gates at the floor`);
}

// ── PURSUIT — the gap is the differential, and nothing else ───────────────
head('PURSUIT — pure speed differential');

{
  // Behavioral purity: replay a mixed run and integrate the differential
  // independently. The sim's gap must equal the clamped integral exactly.
  const sim = new Sim(SEEDS[6]);
  sim.start(SEEDS[6]);
  const input = emptyInput();
  let expected = BE.START_GAP;
  let agree = true;
  for (let i = 0; i < 60 * 90 && sim.phase === PHASE.RUNNING; i++) {
    // A noisy read pattern: right, right, wrong, right...
    const g = sim.wordGates.current();
    const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed;
    input.confirm = armed && (g.index % 3 === 2 ? !g.real : g.real);
    input.boostHeld = i % 700 > 500; // spend sometimes: Overdrive is speed too
    sim.step(input);
    expected = Math.min(BE.MAX_GAP,
      Math.max(BE.KILL_GAP, expected + (sim.player.effSpeed - R.REDLINE_PACE) * DT));
    if (Math.abs(sim.beast.gap - expected) > 1e-6) { agree = false; break; }
  }
  check('gap equals the clamped integral of (speed − pace), step for step',
    agree, `held for a 90s mixed run (reads, misses, Overdrive)`);
}

{
  // No pressure/hunt state machine remains in the pursuit source.
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/sim/beast.js', 'utf8');
  const dead = ['_startHunt', '_beginRelief', '_advanceRhythm', 'mistakePressure +=',
    'MISTAKE_HUNT_THRESHOLD', 'LUNGE_CHANCE', 'modeDuration', 'registerMistake(n'];
  const found = dead.filter((token) => src.includes(token));
  check('no hunt-provoke/pressure machinery in the pursuit source',
    found.length === 0, found.join(', ') || 'clean');
  check('registerMistake is inert: pressure cannot reach the gap',
    /registerMistake\(\)\s*\{\s*\}/.test(src));
}

{
  // Death by differential: pin the player below pace and the gap must close
  // to the kill at exactly the differential rate.
  const sim = new Sim(SEEDS[7]);
  sim.start(SEEDS[7]);
  const input = emptyInput();
  sim.beast.gap = 20;
  let steps = 0;
  while (sim.phase === PHASE.RUNNING && steps < 60 * 60) {
    sim.player.speed = R.FLOOR;
    sim.hearts = 3; // isolate the gap-kill from the heart wipeout
    sim.step(input);
    steps++;
  }
  const expectSteps = Math.ceil(((20 - BE.KILL_GAP) / (R.REDLINE_PACE - R.FLOOR)) / DT);
  check('the Redline catches a runner below pace, at the differential rate',
    sim.phase !== PHASE.RUNNING && Math.abs(steps - expectSteps) <= 2,
    `${steps} steps vs ${expectSteps} predicted (${f2((R.REDLINE_PACE - R.FLOOR))} m/s closure)`);
}

{
  // Overdrive is the one legitimate speed multiplier — and therefore gap.
  const sim = new Sim(SEEDS[8]);
  sim.start(SEEDS[8]);
  const input = emptyInput();
  sim.player.boostMeter = 100;
  sim.player.speed = R.REDLINE_PACE; // neutral pace: only Overdrive moves the gap
  const g0 = sim.beast.gap;
  for (let i = 0; i < 60; i++) { input.boostHeld = true; sim.player.speed = R.REDLINE_PACE; sim.step(input); }
  const opened = sim.beast.gap - g0;
  const predicted = R.REDLINE_PACE * (TUNING.BOOST.SPEED_MULT - 1);
  check('Overdrive opens the gap at exactly the extra speed it buys',
    Math.abs(opened - predicted) < 0.2 && sim.player.boostSpent > 0,
    `+${f2(opened)}m in 1s vs ${f2(predicted)} predicted; spent ${f2(sim.player.boostSpent)} meter`);
}

// ── GHOSTS + LOOP (carried from the mountain suite) ───────────────────────
head('GHOSTS + LOOP — determinism carried forward');

{
  const a = run(SEEDS[1], 60 * 40, (sim) => ({ confirm: reader(sim) }));
  const b = run(SEEDS[1], 60 * 40, (sim) => ({ confirm: reader(sim) }));
  check('a seeded run with identical reads is identical',
    JSON.stringify(a.state()) === JSON.stringify(b.state()),
    `both at ${f2(a.distance)}m`);
}

{
  const seed = SEEDS[2];
  const rec = run(seed, 60 * 45, (sim) => ({ confirm: reader(sim) }));
  rec.recorder.finish(rec.player);
  const data = rec.recorder.serialize({ seed, distance: rec.distance });

  check('ghost data is seed-keyed and round-trips through JSON',
    JSON.parse(JSON.stringify(data)).seed === seed);

  const g1 = new GhostPlayer(JSON.parse(JSON.stringify(data)));
  const g2 = new GhostPlayer(JSON.parse(JSON.stringify(data)));
  let same = true;
  for (let i = 0; i < 60 * 40; i++) {
    g1.step(DT); g2.step(DT);
    if (g1.x !== g2.x || g1.d !== g2.d) { same = false; break; }
  }
  check('ghost replays deterministically', same);

  const solo = run(seed, 60 * 30, (sim) => ({ confirm: reader(sim) }));
  const withGhost = run(seed, 60 * 30, (sim) => ({ confirm: reader(sim) }),
    JSON.parse(JSON.stringify(data)));
  check('ghost playback does not perturb the live sim',
    JSON.stringify(solo.state()) === JSON.stringify(withGhost.state()),
    `both ended at ${f2(solo.distance)}m`);
  check('ghost was actually active during that run',
    withGhost.ghost.count > 0 && withGhost.ghost.d > 0,
    `ghost reached d=${f2(withGhost.ghost.d)}m`);

  // The ghost re-runs the same line the live runner takes: auto-follow makes
  // the line a pure function of the seed, so divergence is numeric noise.
  const sim = new Sim(seed);
  sim.start(seed, JSON.parse(JSON.stringify(data)));
  const input = emptyInput();
  let worst = 0;
  for (let i = 0; i < 60 * 30 && sim.phase === PHASE.RUNNING; i++) {
    input.confirm = reader(sim);
    sim.step(input);
    if (sim.ghost.active && !sim.ghost.yanking) {
      worst = Math.max(worst, Math.abs(sim.ghost.x - sim.terrain.corridorX(sim.ghost.d)));
    }
  }
  check('the ghost runs the authored line, like every runner on this seed',
    worst < 3.0, `worst off-line ${f2(worst)}m`);
}

{
  const t0 = performance.now();
  const sim = new Sim(SEEDS[9]);
  for (let i = 0; i < 50; i++) sim.start(SEEDS[9]);
  const perRestart = (performance.now() - t0) / 50;
  check('sim restart is effectively instant', perRestart < 40,
    `${perRestart.toFixed(2)} ms per restart`);

  check('daily seed is stable within a day and changes the next',
    hashString(dailySeedString(new Date('2026-08-06T09:00:00Z'))) ===
      hashString(dailySeedString(new Date('2026-08-06T23:00:00Z'))) &&
    hashString(dailySeedString(new Date('2026-08-06T12:00:00Z'))) !==
      hashString(dailySeedString(new Date('2026-08-07T12:00:00Z'))));

  const sim2 = new Sim(SEEDS[0]);
  sim2.start(SEEDS[0]);
  const input = emptyInput();
  const t1 = performance.now();
  const steps = 60 * 120;
  for (let i = 0; i < steps; i++) {
    input.confirm = (i % 41) === 0;
    sim2.step(input);
    if (sim2.phase !== PHASE.RUNNING) sim2.start(SEEDS[0]);
  }
  const us = ((performance.now() - t1) / steps) * 1000;
  check('sim step fits comfortably in a 60fps budget', us < 250,
    `${us.toFixed(1)} µs/step — ${(us / 16600 * 100).toFixed(2)}% of a 16.6ms frame`);
}

console.log(results.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
