/**
 * Ghost — record your run, race it tomorrow.
 *
 * FORMAT v1 (flat Int32 quintuples): [t, x, y, d, state] * n
 *   t     centiseconds since run start
 *   x     lateral, decimetres
 *   y     world height, decimetres
 *   d     downhill distance, decimetres
 *   state bitfield: 1 air, 2 stagger, 4 overdrive, 8 dead
 *
 * The brief specifies [t, x, z, state]. I record height as well: without it a
 * ghost that hucked a cliff replays as a silhouette snaking along the ground
 * through what was the best moment of the run, and air is the entire SSX layer
 * we are trying to prove. One extra int per sample, ~4KB for a two-minute run.
 *
 * Playback is dumb interpolation — no sim, no collision, no terrain query. That
 * is the point: it costs almost nothing and it can never desync. Swapping
 * localStorage for a fetch() is the only change networked ghosts need, because
 * nothing downstream of `load()` knows or cares where the array came from.
 */

import TUNING from '../TUNING.js';

const G = TUNING.GHOST;

export const GHOST_STATE = { AIR: 1, STAGGER: 2, OVERDRIVE: 4, DEAD: 8 };
export const GHOST_FORMAT = 1;
const STRIDE = 5;

// ── recording ─────────────────────────────────────────────────────────────

export class GhostRecorder {
  constructor() { this.reset(); }

  reset() {
    this.samples = [];
    this._acc = 0;
    this._t = 0;
    this._interval = 1 / G.SAMPLE_HZ;
    this.finished = false;
  }

  step(dt, player) {
    if (this.finished) return;
    this._t += dt;
    this._acc += dt;
    if (this._acc < this._interval) return;
    this._acc -= this._interval;
    this._push(player, 0);
  }

  /** Call once when the run ends so the death point is the final sample. */
  finish(player) {
    if (this.finished) return;
    this._push(player, GHOST_STATE.DEAD);
    this.finished = true;
  }

  _push(player, extra) {
    if (this.samples.length >= G.MAX_SAMPLES * STRIDE) return;
    let s = extra;
    if (player.airborne) s |= GHOST_STATE.AIR;
    if (player.staggerT > 0) s |= GHOST_STATE.STAGGER;
    if (player.overdrive) s |= GHOST_STATE.OVERDRIVE;
    this.samples.push(
      Math.round(this._t * 100),
      Math.round(player.x * 10),
      Math.round(player.y * 10),
      Math.round(player.d * 10),
      s
    );
  }

  serialize(meta) {
    return {
      v: GHOST_FORMAT,
      seed: meta.seed,
      distance: Math.round(meta.distance),
      hz: G.SAMPLE_HZ,
      s: this.samples,
    };
  }
}

// ── playback ──────────────────────────────────────────────────────────────

export class GhostPlayer {
  constructor(data) { this.load(data); }

  load(data) {
    this.data = data && Array.isArray(data.s) && data.s.length >= STRIDE ? data : null;
    this.t = 0;
    this.active = !!this.data;
    this.yankT = 0;
    this.count = this.data ? Math.floor(this.data.s.length / STRIDE) : 0;
    this.distance = this.data ? this.data.distance : 0;
    // Live pose the renderer reads.
    this.x = 0; this.y = 0; this.d = 0;
    this.air = false; this.overdrive = false;
    this.opacity = 0; this.yanking = false; this.done = false;
  }

  get duration() {
    return this.count ? this.data.s[(this.count - 1) * STRIDE] / 100 : 0;
  }

  reset() { if (this.data) this.load(this.data); }

  step(dt) {
    if (!this.active || !this.data) return;
    this.t += dt;
    const s = this.data.s;
    const end = this.duration;

    if (this.t >= end) {
      // At the ghost's death point it gets yanked upslope into the fog —
      // the same silhouette the kill lunge uses, for free.
      const i = (this.count - 1) * STRIDE;
      const k = Math.min(1, this.yankT / G.YANK_TIME);
      const ease = k * k;
      this.x = s[i + 1] / 10;
      this.y = s[i + 2] / 10 + ease * 2.4;
      this.d = s[i + 3] / 10 - ease * G.YANK_DIST;
      this.air = true;
      this.overdrive = false;
      this.yanking = true;
      this.opacity = G.OPACITY * (1 - k);
      this.yankT += dt;
      if (k >= 1) { this.done = true; this.active = false; }
      return;
    }

    // Binary search for the bracketing pair, then lerp. That is the whole sim.
    const tc = this.t * 100;
    let lo = 0, hi = this.count - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid * STRIDE] <= tc) lo = mid; else hi = mid;
    }
    const a = lo * STRIDE, b = hi * STRIDE;
    const ta = s[a], tb = s[b];
    const f = tb > ta ? (tc - ta) / (tb - ta) : 0;

    this.x = (s[a + 1] + (s[b + 1] - s[a + 1]) * f) / 10;
    this.y = (s[a + 2] + (s[b + 2] - s[a + 2]) * f) / 10;
    this.d = (s[a + 3] + (s[b + 3] - s[a + 3]) * f) / 10;
    this.air = (s[a + 4] & GHOST_STATE.AIR) !== 0;
    this.overdrive = (s[a + 4] & GHOST_STATE.OVERDRIVE) !== 0;
    this.opacity = G.OPACITY;
    this.yanking = false;
  }
}
