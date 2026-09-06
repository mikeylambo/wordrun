/**
 * Speed calibration tables (Phase 8; the FLOOR sweep added RC8.3).
 *
 * The diminishing-returns curve is fixed; the two ends of it get picked by
 * feel and then held to the gated standard. This prints both sweeps.
 *
 * CEILING — for each candidate, reading windows plain and in Overdrive at
 * cruise (CRUISE_READS clean reads in), deep in a streak (20 reads), and at
 * the asymptotic ceiling itself, plus how many clean reads 90 % of the
 * headroom takes.
 *
 * FLOOR — the dial RC8.3 moved. The floor is where a run bottoms out after
 * repeated misses AND the scale of the gain curve, because a read closes
 * SPEED_GAIN_MAX/(CEILING − FLOOR) of the remaining headroom. Raising it
 * therefore steepens the climb, and the 1.15 s comfort window at cruise is
 * what stops it: for each candidate floor this prints the largest gain that
 * still holds that window, what cruise then is, and — the number the floor
 * exists for — the reading window AT the floor, the pace a run recovers at.
 * Whether the Redline can still finish a collapsed run at a given floor is a
 * behavioural question, and its verdict lives in tools/calibration-gates.mjs.
 *
 *   node tools/speed-calibration.mjs            # shipped + candidates
 *   node tools/speed-calibration.mjs 58 66      # custom ceilings
 */

import TUNING from '../src/TUNING.js';

const R = TUNING.RUN;
const W = TUNING.WORDS;
const OD = TUNING.BOOST.SPEED_MULT;

const custom = process.argv.slice(2).map(Number).filter((v) => v > R.FLOOR);
const candidates = custom.length ? custom : [48, 56, R.CEILING, 72, 80];

const f = (v) => v.toFixed(2);

function speedAfter(reads, ceiling) {
  let v = R.START_SPEED;
  for (let i = 0; i < reads; i++) {
    v += R.SPEED_GAIN_MAX * Math.max(0, (ceiling - v) / (ceiling - R.FLOOR));
  }
  return v;
}

function readsTo90(ceiling) {
  const target = ceiling - 0.1 * (ceiling - R.START_SPEED);
  let v = R.START_SPEED;
  let n = 0;
  while (v < target && n < 500) {
    v += R.SPEED_GAIN_MAX * (ceiling - v) / (ceiling - R.FLOOR);
    n++;
  }
  return n;
}

console.log(`ARM ${W.ARM_DISTANCE_M}m · gain@floor ${R.SPEED_GAIN_MAX} · floor ${R.FLOOR} · start ${R.START_SPEED} · Overdrive x${OD}`);
console.log(`comfort floor ${W.READ_WINDOW_MIN_S}s (at cruise = ${W.CRUISE_READS} reads) · hard floor ${W.READ_WINDOW_HARD_MIN_S}s (at ceiling)`);
console.log(`window at the floor itself ${f(W.ARM_DISTANCE_M / R.FLOOR)}s — the pace a run recovers at\n`);
console.log('ceiling | cruise8  window  OD-win | deep20  window  OD-win | ceil window OD-win | reads->90%');
for (const c of candidates) {
  const v8 = speedAfter(W.CRUISE_READS, c);
  const v20 = speedAfter(20, c);
  const mark = c === R.CEILING ? ' <- shipped' : '';
  console.log(
    `${String(c).padStart(7)} | ${f(v8).padStart(7)} ${f(W.ARM_DISTANCE_M / v8).padStart(6)}s ${f(W.ARM_DISTANCE_M / (v8 * OD)).padStart(5)}s | ` +
    `${f(v20).padStart(6)} ${f(W.ARM_DISTANCE_M / v20).padStart(6)}s ${f(W.ARM_DISTANCE_M / (v20 * OD)).padStart(5)}s | ` +
    `${f(W.ARM_DISTANCE_M / c).padStart(5)}s ${f(W.ARM_DISTANCE_M / (c * OD)).padStart(5)}s | ${String(readsTo90(c)).padStart(6)}${mark}`);
}

// ── The FLOOR sweep (RC8.3) ────────────────────────────────────────────────
// For each candidate floor, the largest SPEED_GAIN_MAX that still holds the
// comfort window at cruise — because the floor scales the gain curve, the two
// dials cannot be chosen apart. `headroom/read` is the fraction of what is
// left to the ceiling that one clean read closes: it is the honest measure of
// "does the run start faster", and it is what the comfort window caps.
const speedAfterAt = (reads, floor, gain) => {
  let v = R.START_SPEED;
  for (let i = 0; i < reads; i++) v += gain * Math.max(0, (R.CEILING - v) / (R.CEILING - floor));
  return v;
};
console.log(`\nfloor sweep at ceiling ${R.CEILING} — the largest gain that still holds ${W.READ_WINDOW_MIN_S}s at cruise`);
console.log('floor | max gain  headroom/read | cruise8  window | floor window | deficit vs pace 24/27/30');
for (const floor of [16, 18, 20, 21, 22, 24]) {
  // Search the gain in hundredths; the window is monotone in the gain.
  let best = 0;
  for (let g = 0.1; g <= 8; g += 0.01) {
    if (W.ARM_DISTANCE_M / speedAfterAt(W.CRUISE_READS, floor, g) >= W.READ_WINDOW_MIN_S) best = g;
  }
  best = Math.round(best * 100) / 100;
  const v8 = speedAfterAt(W.CRUISE_READS, floor, best);
  const mark = floor === R.FLOOR ? '  <- shipped' : '';
  console.log(
    `${String(floor).padStart(5)} | ${f(best).padStart(8)}  ${(best / (R.CEILING - floor) * 100).toFixed(2).padStart(12)}% | ` +
    `${f(v8).padStart(7)} ${f(W.ARM_DISTANCE_M / v8).padStart(6)}s | ` +
    `${f(W.ARM_DISTANCE_M / floor).padStart(11)}s | ` +
    `${[24, 27, 30].map((p) => String(p - floor).padStart(2)).join(' / ')}${mark}`);
}
console.log('\nThe floor must stay under every REDLINE_PACE or the pursuit can never');
console.log('finish a collapsed run; how far under is a behavioural question, and the');
console.log('LADDER instrument in tools/calibration-gates.mjs holds the verdict.');
