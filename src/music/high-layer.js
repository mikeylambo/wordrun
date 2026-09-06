/**
 * RC9.7 — the second layer, as arithmetic.
 *
 * Phase J retired the four-layer stem engine, and rightly: it only ever played
 * synthesized placeholders, was muted the instant the real track went live, and
 * no stems were ever produced. What it retired WITH the engine, though, was a
 * genuinely good idea — that the arrangement should thicken when a player is
 * reading brilliantly and thin out when they lose it. This re-opens exactly one
 * hook of it, and nothing else.
 *
 * The rule: a HIGH-FLOW layer fades in once the chain has earned the third
 * editorial band (chain >= 50, `BAND_CHAINS[2]` — the band the world calls
 * "blooming") and fades out when the chain breaks. It is the reward for a
 * state a player holds, so it may not flicker: `bandFor` is used rather than a
 * raw threshold, and every edge waits for a BEAT.
 *
 * BEAT-ALIGNED, AND NOT PER-BEAT. Those are different promises and this file
 * makes both. An edge starts on the next beat the clock crosses, so the layer
 * arrives musically instead of on whatever frame the fiftieth read landed on.
 * Between edges the gain moves on a straight seconds ramp and nothing about it
 * is rhythmic — a gain that pumped with the kick would be a per-beat event on
 * the one bus that is never allowed one.
 *
 * With no clock (no track playing, or a score map that failed to load) the
 * edges fire immediately. Silence is not a reason to hold a layer down.
 *
 * Pure: numbers in, gain out. No Web Audio, no DOM, no sim — the gate drives
 * this file directly and the audio side is a thin wrapper around it.
 */

import { bandFor, BAND_CHAINS } from '../render/editorial-layout.js';

/** The band that earns the layer: index 2 of BAND_CHAINS, i.e. chain >= 50. */
export const HIGH_BAND = 2;
export const HIGH_CHAIN = BAND_CHAINS[HIGH_BAND];

// Musical lengths, not frame counts. In slower than out: arriving is a state
// being earned and leaving is a state being lost.
const FADE_IN_S = 1.8;
const FADE_OUT_S = 0.9;

/** Has this chain earned the layer? One threshold, read through the band. */
export function highLayerWanted(chain) {
  return bandFor(chain || 0) >= HIGH_BAND;
}

export class HighLayerEnvelope {
  constructor() { this.reset(); }

  reset() {
    this.gain = 0;
    this.want = false;      // what the chain asks for
    this.moving = false;    // whether an edge has been released by a beat
    this.pending = false;   // an edge waiting for the next beat
  }

  /**
   * One frame.
   * @param {object} o
   * @param {number} o.chain    the run's reading chain
   * @param {number} o.dt       seconds since the last frame
   * @param {boolean} o.onBeat  did the clock cross a beat this frame
   * @param {boolean} o.hasClock is a track playing at all
   * @param {boolean} o.running is a run live (nothing sustains off the run)
   * @returns {number} gain 0..1
   */
  step({ chain = 0, dt = 0, onBeat = false, hasClock = true, running = true } = {}) {
    const want = running && highLayerWanted(chain);
    if (want !== this.want) {
      this.want = want;
      // A new edge always waits for a beat, even if one is already in flight —
      // a chain broken and rebuilt inside a bar reads as one musical change.
      this.pending = true;
      this.moving = false;
    }
    // The beat releases it. Without a clock there are no beats to wait for.
    if (this.pending && (onBeat || !hasClock)) {
      this.pending = false;
      this.moving = true;
    }
    if (!running && this.gain > 0) this.moving = true;   // a run ending is not musical
    if (this.moving) {
      const target = this.want ? 1 : 0;
      const rate = dt / (this.want ? FADE_IN_S : FADE_OUT_S);
      this.gain = target > this.gain
        ? Math.min(target, this.gain + rate)
        : Math.max(target, this.gain - rate);
      if (this.gain === target) this.moving = false;
    }
    return this.gain;
  }
}

export default HighLayerEnvelope;
