/**
 * What a run actually FEELS like, in numbers.
 *
 * The speed system is easy to reason about at equilibrium and misleading
 * there: at a steady accuracy the speed settles, and what a player feels is
 * the swing AROUND that settle point, not the point itself. This drives real
 * Sims — the shipped word gates, the shipped curve — with a reader held at a
 * fixed accuracy, and reports the shape of the speed trace.
 *
 * The number that matters is `swing`: the ratio of the fast tenth of the run
 * to the slow tenth. A run that hovers reads near 1.0 however high its
 * ceiling is; a run that plunges and climbs reads high.
 *
 *   node tools/feel-measure.mjs
 */
import TUNING from '../src/TUNING.js';
import { Sim, emptyInput } from '../src/sim/sim.js';
import { PRESETS, applyPreset, snapshot } from '../dev/feel-presets.js';

const ORIGINAL = snapshot(TUNING, PRESETS);
const restore = () => {
  for (const [group, values] of Object.entries(ORIGINAL)) {
    const target = group.split('.').reduce((o, k) => o?.[k], TUNING);
    for (const [k, v] of Object.entries(values)) target[k] = v;
  }
};

/** Deterministic reader: hits its target accuracy on a fixed cycle, no rng. */
function runOnce(seed, accuracy, seconds = 150, dash = true) {
  const sim = new Sim(seed);
  globalThis.__SIM = sim;
  sim.start();
  const input = emptyInput();
  const speeds = [];
  let armedFrames = 0, dashFrames = 0, frames = 0, reads = 0, hit = 0;

  let decidedFor = -1;   // the gate index this reader has already answered
  for (let i = 0; i < 60 * seconds && sim.phase === 'running'; i++) {
    const g = sim.wordGates.current();
    input.confirm = false;
    // A gate is armed for ~2 s, which is ~120 frames. The reader must decide
    // ONCE per gate, not once per frame — counting a read per frame was the
    // first version of this and it made every accuracy produce the same
    // trace, because the quota saturated inside a single word.
    if (g && g.index !== decidedFor && sim.wordGates.armed(sim.player.d) && !g.confirmed) {
      decidedFor = g.index;
      const wantRight = (hit + 1) <= accuracy * (reads + 1);
      reads++;
      if (wantRight) hit++;
      // Answering right means tapping a real word and passing a fake. A
      // wrong answer is the inverse — and passing a real is an omission,
      // which is a different mistake from tapping a fake, exactly as the
      // game treats them.
      input.confirm = wantRight ? !!g.real : !g.real;
    }
    // Spend the dash the moment it is available, which is what a player who
    // has learned it does.
    input.boostHeld = dash && sim.player.boostMeter >= TUNING.BOOST.MIN_ACTIVATE;
    if (sim.player.boostMeter >= TUNING.BOOST.MIN_ACTIVATE) armedFrames++;
    if (sim.player.overdrive) dashFrames++;
    sim.step(input);
    speeds.push(sim.player.speed);
    frames++;
  }
  globalThis.__SIM = undefined;

  // Ignore the opening ramp: the first 15 s is every preset climbing off the
  // same start speed and tells us nothing about steady feel.
  const warm = speeds.slice(Math.min(900, Math.floor(speeds.length / 3)));
  const sorted = [...warm].sort((a, b) => a - b);
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] ?? 0;
  const mean = warm.reduce((a, b) => a + b, 0) / (warm.length || 1);
  return {
    mean, p10: q(0.10), p90: q(0.90), min: sorted[0] ?? 0, max: sorted[sorted.length - 1] ?? 0,
    swing: q(0.10) > 0 ? q(0.90) / q(0.10) : 0,
    armedPct: frames ? (armedFrames / frames) * 100 : 0,
    dashPct: frames ? (dashFrames / frames) * 100 : 0,
    distance: sim.distance, died: sim.phase !== 'running' ? 1 : 0,
  };
}

const SEEDS = [12345, 999, 8675309];
const ACCURACIES = [0.70, 0.85, 0.95];

const avg = (rows, k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;

for (const [key, preset] of Object.entries(PRESETS)) {
  restore();
  applyPreset(TUNING, preset);
  console.log(`\n${preset.label}  —  ${preset.note}`);
  console.log('  acc |  slow p10   mean   fast p90 |  swing | armed  dashing | window | died  dist');
  for (const acc of ACCURACIES) {
    const rows = SEEDS.map((s) => runOnce(s, acc));
    const p10 = avg(rows, 'p10'), mean = avg(rows, 'mean'), p90 = avg(rows, 'p90');
    const win = TUNING.WORDS?.ARM_DISTANCE_M ? TUNING.WORDS.ARM_DISTANCE_M / p90 : 55 / p90;
    console.log(`  ${(acc * 100).toFixed(0)}% | ${p10.toFixed(1).padStart(8)} ${mean.toFixed(1).padStart(6)} ${p90.toFixed(1).padStart(9)} |`
      + ` ${avg(rows, 'swing').toFixed(2).padStart(5)}x | ${avg(rows, 'armedPct').toFixed(0).padStart(4)}% ${avg(rows, 'dashPct').toFixed(0).padStart(7)}% |`
      + ` ${win.toFixed(2)}s | ${(avg(rows, 'died') * 100).toFixed(0).padStart(3)}% ${avg(rows, 'distance').toFixed(0).padStart(6)}m`);
  }
}
restore();
console.log('\nswing = fast tenth / slow tenth of the run. A run that hovers reads ~1.0');
console.log('however high its ceiling; a run that plunges and climbs reads high.');
console.log('window = seconds to read a word at the fast end. Below ~0.75s it stops being fair.\n');
