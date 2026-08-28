/**
 * Speed-ceiling calibration table (Phase 8).
 *
 * The diminishing-returns curve is fixed; the CEILING is the one value
 * that gets picked by feel. This prints, for each candidate ceiling, the
 * numbers that frame that choice: reading windows plain and in Overdrive
 * at cruise (8 clean reads in), deep in a streak (20 reads), and at the
 * asymptotic ceiling itself, plus how many clean reads 90% of the
 * headroom takes. Change TUNING.RUN.CEILING to the winner; the gate
 * suites assert the two-tier legibility standard around whatever is set.
 *
 *   node tools/speed-calibration.mjs            # shipped + candidates
 *   node tools/speed-calibration.mjs 58 66      # custom candidates
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
console.log(`comfort floor ${W.READ_WINDOW_MIN_S}s (at cruise = ${W.CRUISE_READS} reads) · hard floor ${W.READ_WINDOW_HARD_MIN_S}s (at ceiling)\n`);
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
