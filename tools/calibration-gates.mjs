/**
 * Calibration gates (Phase H) — every "waiting on a human" number, measured,
 * decided and FROZEN.
 *
 * Five instruments, each printing the decision table the verdict was read
 * from (the RELEASE entry quotes them verbatim):
 *
 *   1. SPEED     the ceiling against the gated two-tier reading standard
 *   2. LADDER    held-accuracy readers (55/70/85/95 %) on every difficulty —
 *                does the daily route clear, how far does ENDLESS go
 *   3. EARLY     the EARLY_MULT break-even: 40 / 50 gates read at the arm
 *                edge against the whole route read at the line
 *   4. BAR       compression: a fast 95 % reader against a mid 85 % one, L0–L3
 *   5. SURGE     the FOV stack at peak flow, with and without REDUCED FLASH
 *   6. DASH      reads landed per dash (Phase I), sizing DASH_CHAIN_MULT
 *
 * The freeze: `--emit` writes calibration.golden.json holding the dials AND
 * the tables they produce. In gate mode the dials must equal the golden
 * (a tuning value cannot move without its table being regenerated) and the
 * instruments must reproduce the golden tables (the behaviour behind a
 * verdict cannot drift silently). Regenerate deliberately with
 * `npm run calibrate`, which also refreshes the Phase 0 behaviour snapshot.
 *
 * Readers here are deterministic: a seeded coin decides each gate's
 * correctness, and the answer lands at a fixed fraction of the 55 m window.
 * That isolates the dial under test from everything else.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { mulberry32 } from '../src/sim/rng.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, 'calibration.golden.json');
const args = process.argv.slice(2);
const EMIT = args.includes('--emit');

const R = TUNING.RUN, W = TUNING.WORDS, B = TUNING.BOOST, C = TUNING.CAMERA;
const S = TUNING.SCORE, M = TUNING.MODES;
const f2 = (v) => +v.toFixed(2);
const lines = [];
const say = (s = '') => lines.push(s);
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) pass++; else fail++;
  say(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};
const head = (t) => say(`\n${t}`);

// ── The dials this phase freezes ────────────────────────────────────────────
function dials() {
  return {
    'RUN.CEILING': R.CEILING, 'RUN.FLOOR': R.FLOOR, 'RUN.START_SPEED': R.START_SPEED,
    'RUN.SPEED_GAIN_MAX': R.SPEED_GAIN_MAX, 'RUN.SPEED_LOSS': R.SPEED_LOSS,
    'WORDS.ARM_DISTANCE_M': W.ARM_DISTANCE_M, 'WORDS.CRUISE_READS': W.CRUISE_READS,
    'WORDS.READ_WINDOW_MIN_S': W.READ_WINDOW_MIN_S,
    'WORDS.READ_WINDOW_HARD_MIN_S': W.READ_WINDOW_HARD_MIN_S,
    'WORDS.EARLY_MULT': W.EARLY_MULT, 'WORDS.LATE_MULT': W.LATE_MULT,
    'WORDS.COMPRESSION_THRESHOLD': W.COMPRESSION_THRESHOLD.slice(),
    'WORDS.COMPRESSION_MULT': W.COMPRESSION_MULT.slice(),
    'WORDS.LOOKAHEAD_GATES': W.LOOKAHEAD_GATES,
    'BOOST.SPEED_MULT': B.SPEED_MULT, 'BOOST.METER_MAX': B.METER_MAX,
    'BOOST.DRAIN_RATE': B.DRAIN_RATE, 'BOOST.CHAIN_STEP': B.CHAIN_STEP,
    'BOOST.CHAIN_CAP': B.CHAIN_CAP, 'BOOST.SURGE_READS': B.SURGE_READS,
    'BOOST.SURGE_EARLY_FRAC': B.SURGE_EARLY_FRAC,
    'CAMERA.FOV': C.FOV, 'CAMERA.FOV_MAX': C.FOV_MAX, 'CAMERA.SURGE_FOV': C.SURGE_FOV,
    'CAMERA.FOV_SPEED_GAIN': C.FOV_SPEED_GAIN, 'CAMERA.FOV_BOOST': C.FOV_BOOST,
    'CAMERA.ACCESS_MOTION_SCALE': C.ACCESS_MOTION_SCALE,
    'SCORE.PER_READ': S.PER_READ, 'SCORE.TIER_MULT': S.TIER_MULT.slice(),
    'SCORE.DASH_CHAIN_MULT': S.DASH_CHAIN_MULT.slice(),
    'DIFFICULTY.easy.REDLINE_PACE': M.DIFFICULTY.easy.REDLINE_PACE,
    'DIFFICULTY.normal.REDLINE_PACE': M.DIFFICULTY.normal.REDLINE_PACE,
    'DIFFICULTY.hard.REDLINE_PACE': M.DIFFICULTY.hard.REDLINE_PACE,
  };
}

// ── 1. SPEED ────────────────────────────────────────────────────────────────
function speedAfter(reads, ceiling) {
  let v = R.START_SPEED;
  for (let i = 0; i < reads; i++) v += R.SPEED_GAIN_MAX * Math.max(0, (ceiling - v) / (ceiling - R.FLOOR));
  return v;
}
function speedTable() {
  const rows = [];
  for (const c of [48, 56, 64, 72, 80]) {
    const v8 = speedAfter(W.CRUISE_READS, c), v20 = speedAfter(20, c);
    rows.push({ ceiling: c,
      cruise: f2(v8), cruiseWin: f2(W.ARM_DISTANCE_M / v8), cruiseOD: f2(W.ARM_DISTANCE_M / (v8 * B.SPEED_MULT)),
      deep20: f2(v20), deepWin: f2(W.ARM_DISTANCE_M / v20), deepOD: f2(W.ARM_DISTANCE_M / (v20 * B.SPEED_MULT)),
      ceilWin: f2(W.ARM_DISTANCE_M / c), ceilOD: f2(W.ARM_DISTANCE_M / (c * B.SPEED_MULT)),
      // The gated standard: comfort at cruise, hard at the ceiling, and hard
      // for a DASH at cruise. (DASH at the asymptotic ceiling is not gated —
      // the curve approaches the ceiling and never reaches it.)
      standard: (W.ARM_DISTANCE_M / v8 >= W.READ_WINDOW_MIN_S) &&
        (W.ARM_DISTANCE_M / c >= W.READ_WINDOW_HARD_MIN_S) &&
        (W.ARM_DISTANCE_M / (v8 * B.SPEED_MULT) >= W.READ_WINDOW_HARD_MIN_S),
    });
  }
  return rows;
}

// ── Readers ─────────────────────────────────────────────────────────────────
/**
 * Drive one run. `accuracy` is the held probability a gate is read correctly
 * (a seeded coin, decided once per gate); `answerAt` is where in the 55 m
 * window the answer lands (1.0 = the instant it arms, 0.06 = at the line);
 * `level` re-sets the compression bar in every gap; `earlyMult` overrides
 * the dial for the sweep and is restored after.
 */
function drive({ seed = 777, mode = 'standard', difficulty = 'normal', accuracy = 1,
  answerAt = 1.0, level = 0, gateLimit = Infinity, maxSteps = 60 * 900, earlyMult = null }) {
  const saved = W.EARLY_MULT;
  if (earlyMult != null) W.EARLY_MULT = earlyMult;
  const sim = new Sim(seed);
  sim.start(seed, null, { mode, difficulty, wordSalt: 0 });
  const coin = mulberry32((seed ^ Math.round(accuracy * 1000) * 7919) >>> 0);
  let decidedIndex = -1, decidedCorrect = true, steps = 0;
  while (sim.phase === PHASE.RUNNING && steps++ < maxSteps && !sim.routeFinished) {
    const wg = sim.wordGates, g = wg.current();
    if (wg.next >= gateLimit) break;
    const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
    if (!armed) sim.player.compressionLevel = level;
    if (armed && g.index !== decidedIndex) { decidedIndex = g.index; decidedCorrect = coin() < accuracy; }
    const rem = g.d - sim.player.d;
    const act = armed && rem <= W.ARM_DISTANCE_M * answerAt;
    // Correct = confirm a real / reject a fake. Wrong = the inverse action, so
    // a wrong read on a fake is a commission (heart) and on a real a slip.
    const sayReal = decidedCorrect ? !!g.real : !g.real;
    sim.step({ ...emptyInput(), confirm: act && sayReal, reject: act && !sayReal });
  }
  if (earlyMult != null) W.EARLY_MULT = saved;
  return {
    cleared: !!sim.routeFinished, gates: sim.wordGates.next,
    d: Math.round(sim.player.d), score: sim.score,
    peak: f2(sim.player.peakSpeed), hearts: sim.hearts, death: sim.deathCause,
    correct: sim.wordGates.correctCount, wrong: sim.wordGates.wrongCount,
  };
}

// ── 2. LADDER ───────────────────────────────────────────────────────────────
function ladderTable() {
  const out = [];
  for (const difficulty of ['easy', 'normal', 'hard']) {
    for (const accuracy of [0.55, 0.70, 0.85, 0.95, 1.0]) {
      const daily = drive({ mode: 'standard', difficulty, accuracy });
      const endless = drive({ mode: 'endless', difficulty, accuracy, maxSteps: 60 * 600 });
      out.push({ difficulty, accuracy,
        dailyCleared: daily.cleared, dailyGates: daily.gates, dailyDeath: daily.death,
        dailyScore: daily.score, endlessM: endless.d, endlessDeath: endless.death || 'alive@cap' });
    }
  }
  return out;
}

// ── 3. EARLY ────────────────────────────────────────────────────────────────
function earlyTable() {
  const out = [];
  for (const em of [3.0, 3.5, 4.0]) {
    const late100 = drive({ answerAt: 0.06, earlyMult: em }).score;
    const early40 = drive({ answerAt: 1.0, gateLimit: 40, earlyMult: em }).score;
    const early50 = drive({ answerAt: 1.0, gateLimit: 50, earlyMult: em }).score;
    const early100 = drive({ answerAt: 1.0, earlyMult: em }).score;
    // Meter coupling: the early rate also fills the dash. Reads from empty to
    // a full charge at chain 0 and at the chain cap, answering at the arm edge.
    const capMult = 1 + B.CHAIN_CAP * B.CHAIN_STEP;
    out.push({ earlyMult: em, late100, early40, early50, early100,
      beats40: early40 > late100, beats50: early50 > late100,
      ratio40: f2(early40 / late100), ratio50: f2(early50 / late100),
      chargeReadsChain0: Math.ceil(B.METER_MAX / (W.CORRECT_FILL * 1 * em)),
      chargeReadsAtCap: Math.ceil(B.METER_MAX / (W.CORRECT_FILL * capMult * em)) });
  }
  return out;
}

// ── 4. BAR ──────────────────────────────────────────────────────────────────
function barTable() {
  const readers = [
    { name: 'fast 95%', accuracy: 0.95, answerAt: 0.95 },   // beyond every bar
    { name: 'mid 85%', accuracy: 0.85, answerAt: 0.55 },    // clears L1/L2 bars, inside L3's
  ];
  return readers.map((r) => {
    const levels = [0, 1, 2, 3].map((level) => drive({ ...r, level }));
    return { reader: r.name, accuracy: r.accuracy, answerAt: r.answerAt,
      peak: levels[0].peak, scores: levels.map((x) => x.score),
      l3OverL0: f2(levels[3].score / levels[0].score) };
  });
}

// ── 5. SURGE / FOV ──────────────────────────────────────────────────────────
function fovStack() {
  const speedN = (v) => Math.max(0, Math.min(1, (v - R.FLOOR) / (R.CEILING - R.FLOOR)));
  const cruise = speedAfter(W.CRUISE_READS, R.CEILING);
  const rows = [];
  for (const [where, v] of [['cruise', cruise], ['ceiling', R.CEILING]]) {
    for (const dash of [false, true]) {
      for (const reduced of [false, true]) {
        const motion = reduced ? C.ACCESS_MOTION_SCALE : 1;
        const base = C.FOV + speedN(v) * C.FOV_SPEED_GAIN * 20 + (dash ? C.FOV_BOOST + 2.0 : 0);
        const surge = C.SURGE_FOV * motion;
        const unclamped = base + surge;
        rows.push({ where, dash, reduced, speed: f2(v), base: f2(base), surge: f2(surge),
          fov: f2(Math.min(C.FOV_MAX, unclamped)), clamped: unclamped > C.FOV_MAX,
          surgeVisible: f2(Math.max(0, Math.min(C.FOV_MAX, unclamped) - Math.min(C.FOV_MAX, base))) });
      }
    }
  }
  return rows;
}

// ── 6. DASH ─────────────────────────────────────────────────────────────────
// Reads landed per dash, for readers who dash the instant the meter is full.
// Before Phase I, reads during a dash refilled the meter and at the chain cap
// out-filled the drain — a clean reader's first dash never ended (97 reads).
// The fill now pauses while a dash is live, so a dash is 2.94 s and this
// table is what sizes DASH_CHAIN_MULT (p90 reads-per-dash + 1 rungs).
function dashRun({ accuracy, mode = 'standard', maxSteps = 60 * 900 }) {
  const sim = new Sim(777); sim.start(777, null, { mode, difficulty: 'normal', wordSalt: 0 });
  const coin = mulberry32((777 ^ Math.round(accuracy * 1000) * 7919) >>> 0);
  let decidedIndex = -1, decidedCorrect = true, steps = 0, cur = null;
  const dashes = []; let topRung = 0;
  while (sim.phase === PHASE.RUNNING && steps++ < maxSteps && !sim.routeFinished) {
    const wg = sim.wordGates, g = wg.current();
    const armed = wg.armed(sim.player.d) && !g.confirmed && !g.rejected;
    if (armed && g.index !== decidedIndex) { decidedIndex = g.index; decidedCorrect = coin() < accuracy; }
    const sayReal = decidedCorrect ? !!g.real : !g.real;
    sim.step({ ...emptyInput(), confirm: armed && sayReal, reject: armed && !sayReal,
      boostHeld: sim.player.boostMeter >= B.MIN_ACTIVATE });
    for (const e of sim.events) {
      if (e.t === 'overdrive_on') cur = { reads: 0 };
      if (e.t === 'word_correct' && cur && e.dashMult > 0 && sim.player.overdrive) { cur.reads++; topRung = Math.max(topRung, e.dashChain); }
      if (e.t === 'overdrive_off' && cur) { dashes.push(cur.reads); cur = null; }
    }
    sim.events.length = 0;
  }
  const open = cur ? cur.reads : null; // a dash still running at the end
  const done = dashes.slice().sort((a, b) => a - b);
  const p = (q) => (done.length ? done[Math.min(done.length - 1, Math.floor(q * done.length))] : null);
  return { accuracy, dashes: done.length, openDashReads: open, max: done.length ? Math.max(...done) : null,
    median: p(0.5), p90: p(0.9), topRung, score: sim.score, cleared: !!sim.routeFinished };
}
function dashTable() { return [0.85, 0.95, 1.0].map((accuracy) => dashRun({ accuracy })); }

// ── Run every instrument ────────────────────────────────────────────────────
const tables = { speed: speedTable(), ladder: ladderTable(), early: earlyTable(), bar: barTable(), fov: fovStack(), dash: dashTable() };
const current = { dials: dials(), tables };

if (EMIT) {
  fs.writeFileSync(GOLDEN, JSON.stringify(current, null, 2) + '\n');
  console.log(`Wrote ${GOLDEN}`);
}

// ── Print the tables ────────────────────────────────────────────────────────
head(`SPEED — ceiling ${R.CEILING} against the gated two-tier standard (ARM ${W.ARM_DISTANCE_M} m, DASH ×${B.SPEED_MULT})`);
say('  ceiling | cruise8  win   OD   | deep20  win   OD   | ceil  win   OD   | standard');
for (const r of tables.speed) {
  say(`  ${String(r.ceiling).padStart(7)} | ${String(r.cruise).padStart(6)} ${String(r.cruiseWin).padStart(5)} ${String(r.cruiseOD).padStart(5)} | ` +
    `${String(r.deep20).padStart(6)} ${String(r.deepWin).padStart(5)} ${String(r.deepOD).padStart(5)} | ` +
    `${String(r.ceilWin).padStart(5)} ${String(r.ceilOD).padStart(5)}       | ${r.standard ? 'holds' : 'BREAKS'}${r.ceiling === R.CEILING ? '  <- shipped' : ''}`);
}
const shipped = tables.speed.find((r) => r.ceiling === R.CEILING);
check('the shipped ceiling holds comfort at cruise, hard at the ceiling, and hard for a DASH at cruise',
  !!shipped && shipped.standard,
  `${shipped?.cruiseWin}s / ${shipped?.ceilWin}s / ${shipped?.cruiseOD}s against ${W.READ_WINDOW_MIN_S}s / ${W.READ_WINDOW_HARD_MIN_S}s / ${W.READ_WINDOW_HARD_MIN_S}s`);

head('LADDER — held-accuracy readers, answering the instant a word arms');
say('  diff    acc   | DAILY route (100 gates)              | ENDLESS');
for (const r of tables.ladder) {
  say(`  ${r.difficulty.padEnd(7)} ${String(Math.round(r.accuracy * 100)).padStart(3)}% | ` +
    `${r.dailyCleared ? 'CLEARS ' : 'fails  '} ${String(r.dailyGates).padStart(3)} gates ${(r.dailyDeath || (r.dailyCleared ? 'finish' : '')).padEnd(9)} ${String(r.dailyScore.toLocaleString()).padStart(9)} | ` +
    `${String(r.endlessM.toLocaleString()).padStart(7)} m ${r.endlessDeath}`);
}
// Phase H measured the no-repair daily route as a two-commission budget: an
// 85 % reader wiped out at gate 56 on every difficulty, and hearts, not pace,
// ended every route from 70 % up. Phase H2 is the rule change that followed:
// the DAILY RUN repairs a heart on a clean reading streak, the same ladder
// ENDLESS uses. The gate the design asks for is stated directly.
const row = (d, a) => tables.ladder.find((r) => r.difficulty === d && r.accuracy === a);
const DIFFS = ['easy', 'normal', 'hard'];
check('85 % finishes the daily route on NORMAL (Phase H2)', row('normal', 0.85).dailyCleared,
  `${row('normal', 0.85).dailyGates} gates, ${row('normal', 0.85).dailyDeath || 'finish'}`);
check('and 70 % does not', !row('normal', 0.70).dailyCleared,
  `${row('normal', 0.70).dailyGates} gates, ${row('normal', 0.70).dailyDeath}`);
check('a clean reader finishes on every difficulty — pace 30 is fair',
  DIFFS.every((d) => row(d, 1.0).dailyCleared));
check('the pace only bites once accuracy has collapsed the speed',
  DIFFS.every((d) => row(d, 0.55).dailyDeath === 'redlined'),
  `55 % is run down at ${DIFFS.map((d) => row(d, 0.55).dailyGates).join('/')} gates`);
check('more accuracy always reaches further on the route',
  DIFFS.every((d) => [0.55, 0.70, 0.85, 0.95, 1.0].map((a) => row(d, a).dailyGates)
    .every((g, i, arr) => i === 0 || g >= arr[i - 1])));

head('EARLY — the break-even: gates read at the arm edge against the whole route read at the line');
say('  EARLY_MULT | 100 late  | 40 early (ratio)   | 50 early (ratio)   | 100 early | charge reads chain0 / cap');
for (const r of tables.early) {
  say(`  ${String(r.earlyMult.toFixed(1)).padStart(10)} | ${String(r.late100.toLocaleString()).padStart(9)} | ` +
    `${String(r.early40.toLocaleString()).padStart(9)} (${r.ratio40}${r.beats40 ? ' ✓' : '  '}) | ` +
    `${String(r.early50.toLocaleString()).padStart(9)} (${r.ratio50}${r.beats50 ? ' ✓' : '  '}) | ` +
    `${String(r.early100.toLocaleString()).padStart(9)} | ${r.chargeReadsChain0} / ${r.chargeReadsAtCap}${r.earlyMult === W.EARLY_MULT ? '  <- shipped' : ''}`);
}
const ship = tables.early.find((r) => r.earlyMult === W.EARLY_MULT);
check('at the shipped EARLY_MULT, half the route read early beats all of it read late', !!ship && ship.beats50,
  `${ship?.early50.toLocaleString()} against ${ship?.late100.toLocaleString()}`);
check('and depth still pays at equal quality', !!ship && ship.early100 > ship.early50);

head('BAR — compression: clearing your own bar pays, setting one you cannot clear costs');
say('  reader     acc  answers at | L0        L1        L2        L3        | L3/L0   peak m/s');
for (const r of tables.bar) {
  say(`  ${r.reader.padEnd(10)} ${String(Math.round(r.accuracy * 100)).padStart(3)}%  ${String(r.answerAt).padStart(4)} of win | ` +
    r.scores.map((s) => String(s.toLocaleString()).padStart(9)).join(' ') + ` | ${String(r.l3OverL0).padStart(5)}   ${r.peak}`);
}
const fast = tables.bar[0], mid = tables.bar[1];
check('level 3 is reachable and pays for a fast 95 % reader at the ceiling',
  fast.scores[3] > fast.scores[0] && fast.peak >= R.CEILING - 3,
  `L3 ${fast.scores[3].toLocaleString()} > L0 ${fast.scores[0].toLocaleString()}, peaking ${fast.peak} m/s`);
check('and unprofitable for a mid 85 % reader who answers inside the bar',
  mid.scores[3] < mid.scores[0], `L3 ${mid.scores[3].toLocaleString()} < L0 ${mid.scores[0].toLocaleString()}`);
check('every level is monotone for the reader who clears it', fast.scores.every((v, i, a) => i === 0 || v > a[i - 1]));

head(`SURGE — FOV at peak flow (base ${C.FOV}°, clamp ${C.FOV_MAX}°, surge +${C.SURGE_FOV}°, REDUCED FLASH ×${C.ACCESS_MOTION_SCALE})`);
say('  where    dash  reduced | speed  base    +surge  fov    clamped  surge visible');
for (const r of tables.fov) {
  say(`  ${r.where.padEnd(8)} ${String(r.dash).padEnd(5)} ${String(r.reduced).padEnd(7)} | ${String(r.speed).padStart(5)}  ${String(r.base).padStart(6)}  ${String(r.surge).padStart(6)}  ${String(r.fov).padStart(5)}  ${String(r.clamped).padEnd(7)}  ${r.surgeVisible}°`);
}
const cruiseSurge = tables.fov.find((r) => r.where === 'cruise' && !r.dash && !r.reduced);
const cruiseSurgeR = tables.fov.find((r) => r.where === 'cruise' && !r.dash && r.reduced);
check('the surge is a visible term at cruise and never breaches the FOV clamp',
  cruiseSurge.surgeVisible > 0 && tables.fov.every((r) => r.fov <= C.FOV_MAX));
check('REDUCED FLASH damps the surge like every other motion term',
  cruiseSurgeR.surgeVisible < cruiseSurge.surgeVisible && cruiseSurgeR.surgeVisible > 0,
  `${cruiseSurge.surgeVisible}° → ${cruiseSurgeR.surgeVisible}°`);

head(`DASH — reads landed per dash on the daily route, dashing the instant the meter is full (ladder ${S.DASH_CHAIN_MULT.join(' / ')})`);
say('  reader | dashes | reads/dash median  p90  max | open dash | top rung hit | score');
for (const r of tables.dash) {
  say(`  ${String(Math.round(r.accuracy * 100)).padStart(4)}%  | ${String(r.dashes).padStart(6)} | ${String(r.median ?? '—').padStart(16)}  ${String(r.p90 ?? '—').padStart(3)}  ${String(r.max ?? '—').padStart(3)} | ${String(r.openDashReads ?? '—').padStart(9)} | ${String(r.topRung).padStart(12)} | ${r.score.toLocaleString()}`);
}
const d95 = tables.dash.find((r) => r.accuracy === 0.95), d100 = tables.dash.find((r) => r.accuracy === 1.0);
check('the ladder is sized to a realistic reader: 95 % p90 reads-per-dash + 1 <= rungs',
  d95.p90 != null && d95.p90 + 1 <= S.DASH_CHAIN_MULT.length,
  `p90 ${d95.p90} reads, ${S.DASH_CHAIN_MULT.length} rungs`);
check('the top rung is reachable but not the norm: the median 95 % dash does not hit it',
  d95.median != null && d95.median < S.DASH_CHAIN_MULT.length - 1, `median ${d95.median}`);
check('a dash is spent whole: even a clean reader has finite dashes (no fill while live)',
  d100.dashes > 0 && (d100.openDashReads ?? 0) <= S.DASH_CHAIN_MULT.length, `${d100.dashes} finite dashes, max ${d100.max} reads`);
check('the ceiling score on the daily route stays under seven digits (headline width)',
  tables.dash.every((r) => r.score < 1000000), `max ${Math.max(...tables.dash.map((r) => r.score)).toLocaleString()}`);

// ── The freeze ──────────────────────────────────────────────────────────────
head('FREEZE — dials and tables match calibration.golden.json');
if (!fs.existsSync(GOLDEN)) {
  check('golden fixture exists (run `npm run calibrate` to mint it)', false);
} else {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const moved = Object.keys(current.dials).filter((k) => JSON.stringify(current.dials[k]) !== JSON.stringify(golden.dials?.[k]));
  check('no calibrated dial has moved without its table being regenerated', moved.length === 0,
    moved.length ? moved.map((k) => `${k}: ${JSON.stringify(golden.dials?.[k])} → ${JSON.stringify(current.dials[k])}`).join('; ') : `${Object.keys(current.dials).length} dials frozen`);
  const drifted = Object.keys(tables).filter((k) => JSON.stringify(tables[k]) !== JSON.stringify(golden.tables?.[k]));
  check('every decision table reproduces byte-for-byte', drifted.length === 0,
    drifted.length ? `drifted: ${drifted.join(', ')}` : 'speed, ladder, early, bar, fov, dash');
}

console.log(lines.join('\n'));
console.log(`\nCalibration gates: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
