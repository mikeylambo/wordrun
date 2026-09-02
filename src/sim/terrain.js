/**
 * Track — DICTION DASH. A winding ribbon with authored route grammar.
 *
 * Phase 7 flattened the mountain into a ribbon that winds laterally; Phase L
 * gives that ribbon its third axis back as a seeded walk of authored segment
 * types — straights, long straights, climbs, descents, banks and crests —
 * so the road fills the frame instead of pinning the horizon to a line at
 * eye level. GEOMETRY ONLY: nothing in the speed model, the gates, the
 * Redline or the meter reads elevation or roll (gradeMul stays 1), so the
 * run plays byte-identically to the flat track — the Phase 0 behaviour
 * snapshot holds without regeneration, which is the proof.
 *
 * The profile is a pure function of the seed. Segments are generated
 * sequentially from one seeded stream, so the same seed always lays the
 * same road (the DAILY RUN identity) and elevation at every segment
 * boundary is accumulated exactly. Between segments, grade and roll ramp
 * linearly over ROUTE.TRANS_M centred on the boundary; a linear ramp is
 * symmetric, so the simple per-segment accumulation e1 = e0 + grade·len
 * stays EXACT at the boundaries and elevation inside a ramp has a closed
 * quadratic form — heightAt is O(log segs), no numeric integration.
 *
 * The class keeps the full API surface the frame consumes (heightAt /
 * normalAt / collidersNear / chunk / ...): still no colliders, no ice, no
 * spawned gates, no grade multiplier. Deterministic per seed.
 */

import TUNING from '../TUNING.js';
import { mulberry32, mixSeed } from './rng.js';

const T = TUNING.TERRAIN;
const R = TUNING.RUN;
const RT = TUNING.TERRAIN.ROUTE;

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

// The route vocabulary (L1–L3). Weights are relative draw odds; a type never
// repeats back-to-back except the straights, and vertical types are biased
// toward level as the walk nears ELEV_CAP_M. A crest emits its two halves as
// a pair so the whole engine stays one segment list.
const VOCAB = [
  { type: 'straight', w: 3 },
  { type: 'long-straight', w: 1 },
  { type: 'climb', w: 2 },
  { type: 'descent', w: 2 },
  { type: 'bank', w: 2 },
  { type: 'crest', w: 1.5 },
];

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

    // The route walk: its own seeded stream, drawn strictly sequentially so
    // the segment list is a pure function of the seed however far it is read.
    this._segRng = mulberry32(mixSeed(this.seed, 0x736567)); // 'seg'
    this._segs = [{ d0: 0, len: RT.INTRO_FLAT_M, grade: 0, roll: 0, e0: 0, type: 'intro' }];
    this._lastType = 'intro';
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

  // ── The route walk ──────────────────────────────────────────────────────

  _pushSeg(type, len, grade, roll) {
    const prev = this._segs[this._segs.length - 1];
    this._segs.push({
      d0: prev.d0 + prev.len, len, grade, roll,
      e0: prev.e0 + prev.grade * prev.len, type,
    });
  }

  _generateNext() {
    const rng = this._segRng;
    const prev = this._segs[this._segs.length - 1];
    const elev = prev.e0 + prev.grade * prev.len;

    // Draw a type: never the same non-straight twice in a row, and steer the
    // walk level as it nears the cap so elevation never runs away.
    let pick = null;
    for (let tries = 0; tries < 8 && !pick; tries++) {
      let total = 0;
      const odds = VOCAB.map(({ type, w }) => {
        let weight = w;
        if (type === this._lastType && type !== 'straight') weight = 0;
        if (type === 'climb' && elev > RT.ELEV_CAP_M * 0.55) weight = 0;
        if (type === 'descent' && elev < -RT.ELEV_CAP_M * 0.55) weight = 0;
        // A crest's apex must clear the cap too: it climbs before it falls.
        if (type === 'crest' && elev + RT.CREST_GRADE * 66 > RT.ELEV_CAP_M) weight = 0;
        total += weight;
        return { type, weight };
      });
      let roll = rng() * total;
      for (const o of odds) {
        roll -= o.weight;
        if (roll <= 0 && o.weight > 0) { pick = o.type; break; }
      }
    }
    pick = pick || 'straight';
    this._lastType = pick;

    switch (pick) {
      case 'straight': this._pushSeg(pick, 120 + rng() * 100, 0, 0); break;
      case 'long-straight': this._pushSeg(pick, 260 + rng() * 80, 0, 0); break;
      case 'climb': {
        // The cap is a hard bound, not a bias: size the pitch to the headroom.
        const len = Math.min(120 + rng() * 80, (RT.ELEV_CAP_M - elev) / RT.GRADE);
        this._pushSeg(pick, Math.max(60, len), RT.GRADE, 0);
        break;
      }
      case 'descent': {
        const len = Math.min(120 + rng() * 80, (elev + RT.ELEV_CAP_M) / RT.GRADE);
        this._pushSeg(pick, Math.max(60, len), -RT.GRADE, 0);
        break;
      }
      case 'bank': {
        const side = rng() < 0.5 ? -1 : 1;
        this._pushSeg(pick, 110 + rng() * 60, 0, side * RT.ROLL);
        break;
      }
      case 'crest': {
        // Two halves of one page-fold: up, then down, net zero elevation.
        const half = 48 + rng() * 18;
        this._pushSeg('crest-up', half, RT.CREST_GRADE, 0);
        this._pushSeg('crest-down', half, -RT.CREST_GRADE, 0);
        break;
      }
    }
  }

  /** The segment containing d (generating forward as needed), plus its index. */
  _segAt(d) {
    const segs = this._segs;
    while (segs[segs.length - 1].d0 + segs[segs.length - 1].len < d + RT.TRANS_M) {
      this._generateNext();
    }
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].d0 <= d) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  /** A per-segment property, linearly ramped over TRANS_M at each boundary. */
  _ramped(d, key) {
    const i = this._segAt(Math.max(0, d));
    const seg = this._segs[i];
    const h = RT.TRANS_M / 2;
    const intoStart = d - seg.d0;
    if (intoStart < h && i > 0) {
      const prev = this._segs[i - 1];
      return prev[key] + (seg[key] - prev[key]) * (intoStart + h) / RT.TRANS_M;
    }
    const fromEnd = seg.d0 + seg.len - d;
    if (fromEnd < h) {
      const next = this._segs[i + 1] || seg;
      return seg[key] + (next[key] - seg[key]) * (h - fromEnd) / RT.TRANS_M;
    }
    return seg[key];
  }

  /** Rise per metre of travel at d — the pitch of the road. */
  gradeAt(d) { return this._ramped(d, 'grade'); }

  /** Bank cross-slope at d — rise per metre across, positive = right edge up. */
  rollAt(d) { return this._ramped(d, 'roll'); }

  /** Centreline elevation. Closed form: the piecewise-linear base is exact at
   *  every boundary (the ramp is symmetric), plus a quadratic correction
   *  inside a ramp window. */
  elevAt(d) {
    if (d <= 0) return 0;
    const i = this._segAt(d);
    const seg = this._segs[i];
    let e = seg.e0 + seg.grade * (d - seg.d0);
    const h = RT.TRANS_M / 2;
    // Correction for the ramp at this segment's START boundary.
    const s0 = d - seg.d0; // signed offset from the boundary, here ≥ 0
    if (s0 < h && i > 0) {
      const gA = this._segs[i - 1].grade, gB = seg.grade;
      const s = s0; // in [0, h): boundary-relative position
      // Exact-vs-base correction inside the ramp: (gB−gA)·[(s+h)²/2T − s].
      // Zero at both ramp edges, so elevation is continuous by construction;
      // the boundary accumulation e0 is exact because the ramp is symmetric.
      e += (gB - gA) * (((s + h) * (s + h)) / (2 * RT.TRANS_M) - s);
    }
    // Correction for the ramp at this segment's END boundary (d inside it).
    const s1 = d - (seg.d0 + seg.len); // in [-h, 0) when inside
    if (s1 > -h && s1 < 0) {
      const next = this._segs[i + 1];
      if (next) {
        const gA = seg.grade, gB = next.grade;
        e += (gB - gA) * (((s1 + h) * (s1 + h)) / (2 * RT.TRANS_M));
      }
    }
    return e;
  }

  /** Total cross-slope: the segment bank plus the turn-lean of the ribbon. */
  crossSlopeAt(d) {
    return this.rollAt(d) - this.corridorSlope(d) * RT.EDGE_BANK * 0.5;
  }

  // ── The surface ─────────────────────────────────────────────────────────
  heightAt(x, d) {
    return this.elevAt(d) + ((x ?? 0) - this.corridorX(d)) * this.crossSlopeAt(d);
  }

  baseHeight(d) { return this.elevAt(d ?? 0); }
  normalAt(x, d) { return { dhdx: this.crossSlopeAt(d ?? 0), dhdd: this.gradeAt(d ?? 0) }; }
  gradeMul() { return 1; }   // the speed model NEVER reads the route — Phase L contract
  isIce() { return false; }
  inLandingZone() { return false; }
  fallTo(d) { return d; }

  /** The route as data, for instruments: [{d0, len, grade, roll, e0, type}]. */
  routeSegments(untilD) {
    this._segAt(untilD);
    return this._segs.filter((s) => s.d0 < untilD);
  }

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

  /** Grid sampler the streaming mesh calls; kept for the contract. */
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
