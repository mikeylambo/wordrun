/**
 * Replay review (Phase 21) — "see where it went wrong".
 *
 * Speed Stars' stated hook is analysing replays to uncover mistakes, and this
 * game already records everything needed for it: the ghost recorder samples
 * position and time throughout every run for the racing feature, and the word
 * gates already log every wrong read. Nothing new is collected here. This is a
 * second read of what was already saved — differentiate the ghost's distance
 * track against its own clock to recover the speed curve, then hang the run's
 * mistakes on it at the distance each one happened.
 *
 * The result is the one thing the results card could never say: not that you
 * missed four words, but that three of them came inside 200 m, right after the
 * fastest stretch of the run.
 *
 * Pure: samples in, plot out. No DOM, no storage, no sim.
 */

const STRIDE = 5;   // [t, x, y, d, state] — ghost.js FORMAT v1
const T = 0, D = 3;

/**
 * @param {object} o
 * @param {Int32Array|number[]} o.samples  the ghost recorder's flat samples
 * @param {Array} [o.misses]   this run's wrong reads (shown, answer, reason, d)
 * @param {number} [o.bins]    resolution of the returned curve
 * @param {number} [o.window]  metres per stretch when looking for the worst one
 */
export function buildReview({ samples = [], misses = [], bins = 40, window = 250 } = {}) {
  const n = Math.floor(samples.length / STRIDE);
  const empty = { bins: [], marks: [], peak: 0, distance: 0, worst: null, seconds: 0 };
  if (n < 3) return empty;

  const distance = samples[(n - 1) * STRIDE + D] / 10;
  const seconds = samples[(n - 1) * STRIDE + T] / 100;
  if (!(distance > 0)) return empty;

  // Speed between consecutive samples: decimetres and centiseconds back into
  // m/s. A sample pair with no elapsed time is a duplicate, not a stop.
  const sum = new Array(bins).fill(0);
  const hits = new Array(bins).fill(0);
  let peak = 0;
  for (let i = 0; i < n - 1; i++) {
    const dt = (samples[(i + 1) * STRIDE + T] - samples[i * STRIDE + T]) / 100;
    if (dt <= 0) continue;
    const dd = (samples[(i + 1) * STRIDE + D] - samples[i * STRIDE + D]) / 10;
    const v = dd / dt;
    if (!(v >= 0)) continue;
    const mid = (samples[(i + 1) * STRIDE + D] + samples[i * STRIDE + D]) / 20;
    const b = Math.min(bins - 1, Math.max(0, Math.floor((mid / distance) * bins)));
    sum[b] += v;
    hits[b] += 1;
    if (v > peak) peak = v;
  }

  // Carry the last known speed across bins the sampler skipped rather than
  // drawing a hole — a gap in the sample rate is not a stop.
  const curve = [];
  let last = 0;
  for (let b = 0; b < bins; b++) {
    const v = hits[b] > 0 ? sum[b] / hits[b] : last;
    last = v;
    curve.push({ x: bins > 1 ? b / (bins - 1) : 0, d: (b / bins) * distance, speed: +v.toFixed(2) });
  }

  // Mistakes, placed where they happened. A miss with no recorded distance
  // is kept but unplaced — the recap still teaches it, the chart just cannot
  // point at it.
  const marks = misses
    .filter((m) => Number.isFinite(m?.d) && m.d >= 0)
    .map((m) => ({
      x: Math.min(1, Math.max(0, m.d / distance)),
      d: m.d,
      kind: m.reason === 'picked_fake' ? 'fake' : 'real',
      shown: m.shown,
      answer: m.answer,
    }))
    .sort((a, b) => a.d - b.d);

  // The worst stretch: the densest `window` metres of mistakes. Reported only
  // when it is actually a cluster — two misses 1,500 m apart is not a stretch
  // and calling it one would be a story the data does not tell.
  let worst = null;
  for (let i = 0; i < marks.length; i++) {
    let j = i;
    while (j < marks.length && marks[j].d - marks[i].d <= window) j++;
    const count = j - i;
    if (count >= 3 && (!worst || count > worst.count)) {
      worst = { from: Math.floor(marks[i].d), to: Math.ceil(marks[j - 1].d), count };
    }
  }

  return { bins: curve, marks, peak: +peak.toFixed(2), distance, seconds, worst };
}

export default buildReview;
