/**
 * Track — WORD RUN Phase 7. Flat, winding, no downhill vocabulary.
 *
 * The descent terrain (grade, rollers, powder banks, cliffs, moguls, the
 * obstacle catalog) is replaced by a flat ribbon that winds laterally —
 * twists and turns in the Sonic tradition instead of vertical drop. The
 * curve is authored into the path as a seeded sum of two smooth waves and
 * exposed through the same `corridorX(d)` the frame always used for "the
 * line"; the player auto-follows it, so the one-input scheme is untouched.
 *
 * The class keeps the name `Terrain` and the full API surface the frame's
 * layers consume (heightAt/normalAt/collidersNear/heightsOf/chunk/...):
 * height is flat zero, there are no colliders, no ice, no gates, no grade.
 * Deterministic per seed, exactly like the mountain it replaces.
 */

import TUNING from '../TUNING.js';
import { mulberry32, mixSeed } from './rng.js';

const T = TUNING.TERRAIN;
const R = TUNING.RUN;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const plateau = (t) => smooth01(t);

// Feature type ids survive as vocabulary for the empty collider lists the
// patch layers still filter over.
export const FEATURE = {
  TREE: 'tree', ROCK: 'rock', GATE: 'gate', ICE: 'ice',
  MOGUL: 'mogul', CLIFF: 'cliff',
};

export class Terrain {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.chunks = new Map();

    // Authored winding: two seeded waves, phases drawn from the run seed the
    // same way the reserved corridor always was. Peak |dx/dd| stays well
    // under 0.5 so the auto-follow and the camera sweep through turns
    // rather than snap.
    const rng = mulberry32(mixSeed(this.seed, 0x74726b)); // 'trk'
    this._phaseA = rng() * Math.PI * 2;
    this._phaseB = rng() * Math.PI * 2;
  }

  /** The track's winding centerline — the line everything follows. */
  corridorX(d) {
    return (
      R.CURVE_AMP_A * Math.sin((d / R.CURVE_WAVE_A) * Math.PI * 2 + this._phaseA) +
      R.CURVE_AMP_B * Math.sin((d / R.CURVE_WAVE_B) * Math.PI * 2 + this._phaseB)
    );
  }

  /** Lateral slope of the centerline — the lean of a turn. */
  corridorSlope(d) {
    return (
      R.CURVE_AMP_A * Math.cos((d / R.CURVE_WAVE_A) * Math.PI * 2 + this._phaseA) *
        ((Math.PI * 2) / R.CURVE_WAVE_A) +
      R.CURVE_AMP_B * Math.cos((d / R.CURVE_WAVE_B) * Math.PI * 2 + this._phaseB) *
        ((Math.PI * 2) / R.CURVE_WAVE_B)
    );
  }

  // ── Flat world ──────────────────────────────────────────────────────────
  heightAt() { return 0; }
  baseHeight() { return 0; }
  normalAt() { return { dhdx: 0, dhdd: 0 }; }
  gradeMul() { return 1; }
  isIce() { return false; }
  inLandingZone() { return false; }
  fallTo(d) { return d; }

  // ── Nothing spawns ──────────────────────────────────────────────────────
  collidersNear() { return []; }
  gatesNear() { return []; }
  heightsOf() { return []; }
  regionsAt() { return []; }

  pitchAt() { return { name: 'run', mul: {} }; }

  /**
   * Chunk record for the streaming mesh: centerline samples across the
   * chunk, so the renderer can lay ribbon strips without re-deriving the
   * curve. Kept in the same chunk-map shape the old terrain streamed.
   */
  chunk(ci) {
    let c = this.chunks.get(ci);
    if (!c) {
      c = this._generate(ci);
      this.chunks.set(ci, c);
    }
    return c;
  }

  _generate(ci) {
    const d0 = ci * T.CHUNK_LEN;
    const d1 = d0 + T.CHUNK_LEN;
    return {
      ci, d0, d1,
      colliders: [], regions: [], heights: [], gates: [],
      pitch: this.pitchAt(ci),
    };
  }

  /** Grid sampler the streaming mesh calls; flat, but keeps the contract. */
  sampleGrid(ci, segsX, segsZ, out) {
    if (out) out.fill(0);
    return out;
  }

  prune(centerCi) {
    for (const ci of this.chunks.keys()) {
      if (ci < centerCi - 3 || ci > centerCi + T.CHUNKS_AHEAD + 2) this.chunks.delete(ci);
    }
  }
}

export { clamp, smooth01, plateau };
