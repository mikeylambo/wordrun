/**
 * Terrain — the mountain as pure maths.
 *
 * No Three.js in here. The renderer asks this module for heights and feature
 * lists; the sim asks it the exact same questions. One source of truth means
 * the cliff you see is the cliff you launch off.
 *
 * Chunks are generated lazily from (seed, chunkIndex) and cached. Chunk content
 * never changes once rolled, so the mountain is stable in both directions and
 * a ghost recorded on seed S skis the identical slope on every replay.
 */

import TUNING from '../TUNING.js';
import { makeRng, mixSeed } from './rng.js';

const T = TUNING.TERRAIN;
const F = TUNING.FEATURES;

export const FEATURE = {
  TREE: 'tree',
  ROCK: 'rock',
  ICE: 'ice',
  GATE: 'gate',
  MOGUL: 'mogul',
  CLIFF: 'cliff',
};

// ── small maths helpers ───────────────────────────────────────────────────
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth01 = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Plateau window: 1 across the middle, smoothly 0 at +/- halfW. */
function plateau(u, halfW, edgeFrac) {
  const a = Math.abs(u);
  if (a >= halfW) return 0;
  const edge = halfW * edgeFrac;
  if (edge <= 1e-6) return 1;
  return smooth01((halfW - a) / edge);
}

export class Terrain {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.heightCache = new Map();

    // Rolling-noise phases are drawn once from the seed so the undulation is
    // part of the mountain's identity, not a global constant.
    const r = makeRng(mixSeed(this.seed, 0x5eed));
    this.phA = r.range(0, Math.PI * 2);
    this.phB = r.range(0, Math.PI * 2);
    this.phC = r.range(0, Math.PI * 2);
    this.phD = r.range(0, Math.PI * 2);

    // Phases of the guaranteed corridor.
    this.cpA = r.range(0, Math.PI * 2);
    this.cpB = r.range(0, Math.PI * 2);

    // Phases of the grade modulation, and the constant that pins fall(0) = 0.
    this.gpA = r.range(0, Math.PI * 2);
    this.gpB = r.range(0, Math.PI * 2);
    this._fall0 = 0;
    this._fall0 = this.fallTo(0) / T.GRADE;

    this._pitchCache = new Map();
  }

  /**
   * Local steepness as a multiple of the mean grade.
   *
   * A constant slope makes steepness meaningless — there is no fast pitch to
   * savour and no shallow one to dread. Two sine terms give the mountain long
   * rollers, and the player's speed model reads this directly.
   */
  gradeMul(d) {
    return 1
      + T.GRADE_AMP_A * Math.sin((d / T.GRADE_WAVE_A) * Math.PI * 2 + this.gpA)
      + T.GRADE_AMP_B * Math.sin((d / T.GRADE_WAVE_B) * Math.PI * 2 + this.gpB);
  }

  /**
   * Exact integral of GRADE * gradeMul from 0 to d — i.e. total fall.
   *
   * Both sine terms integrate in closed form, so this stays precise and
   * perfectly smooth at any distance. Numerically integrating instead would
   * introduce derivative kinks, and a kink in the height field is a spurious
   * launch waiting to happen.
   */
  fallTo(d) {
    const wa = T.GRADE_WAVE_A / (Math.PI * 2);
    const wb = T.GRADE_WAVE_B / (Math.PI * 2);
    const a = T.GRADE_AMP_A * wa;
    const b = T.GRADE_AMP_B * wb;
    const term =
      d
      - a * Math.cos((d / T.GRADE_WAVE_A) * Math.PI * 2 + this.gpA)
      - b * Math.cos((d / T.GRADE_WAVE_B) * Math.PI * 2 + this.gpB);
    return T.GRADE * (term - this._fall0);
  }

  /**
   * Which pitch a chunk belongs to, and its density multipliers.
   *
   * Each pitch is chosen from its predecessor so the same kind never runs
   * twice back to back, which means the sequence is a chain. Memoised, because
   * walking that chain from the origin on every chunk generation would make
   * terrain cost grow with distance travelled.
   */
  pitchAt(ci) {
    const pi = Math.floor(Math.max(0, ci) / F.PITCH_CHUNKS);
    const name = this._pitchName(pi);
    return { index: pi, name, mul: F.PITCHES[name] };
  }

  _pitchName(pi) {
    if (pi <= 0) return 'open';           // a run always starts readable
    const hit = this._pitchCache.get(pi);
    if (hit) return hit;
    const prev = this._pitchName(pi - 1);
    const r = makeRng(mixSeed(this.seed, 0x9147 + pi));
    const options = F.PITCH_ORDER.filter((n) => n !== prev);
    const name = options[Math.floor(r.next() * options.length)];
    this._pitchCache.set(pi, name);
    return name;
  }

  /**
   * Lateral centre of the guaranteed-clear line at a given downhill distance.
   * Continuous in d, so it stitches across chunk boundaries for free.
   */
  corridorX(d) {
    return F.CORRIDOR_AMP_A * Math.sin((d / F.CORRIDOR_WAVE_A) * Math.PI * 2 + this.cpA) +
           F.CORRIDOR_AMP_B * Math.sin((d / F.CORRIDOR_WAVE_B) * Math.PI * 2 + this.cpB);
  }

  // ── chunk generation ────────────────────────────────────────────────────
  //
  // Two independent RNG streams per chunk:
  //   A. height features (cliffs, moguls) — depends on nothing
  //   B. solids, gates, ice — may consult A of the neighbouring chunks
  //
  // Splitting them is what lets a cliff near a chunk boundary reserve a landing
  // zone that reaches into the next chunk. With a single stream, chunk N would
  // have to generate chunk N-1 to find out what was coming, which recurses
  // forever. Two streams means heightsOf(ci) is a cheap pure function of
  // (seed, ci) that any chunk can ask about without triggering generation.

  /** Cliffs and moguls for a chunk. Pure in (seed, ci), memoised. */
  heightsOf(ci) {
    let h = this.heightCache.get(ci);
    if (h) return h;
    h = [];
    const d0 = ci * T.CHUNK_LEN;
    const d1 = d0 + T.CHUNK_LEN;
    if (d1 > F.SAFE_START) {
      const rng = makeRng(mixSeed(this.seed, ci));
      const dLo = Math.max(d0, F.SAFE_START);
      const spanX = (m) => rng.range(-T.HALF_WIDTH + m, T.HALF_WIDTH - m);
      const pitch = this.pitchAt(ci).mul;

      if (rng.chance(Math.min(0.95, F.CLIFF_CHANCE * pitch.cliff))) {
        const halfX = rng.range(F.CLIFF_HALF_X[0], F.CLIFF_HALF_X[1]);
        const cd = rng.range(dLo + 8, d1 - 12);
        const drop = rng.range(F.CLIFF_DROP[0], F.CLIFF_DROP[1]);
        // The reserved line is a CARVING line. A cliff sitting on it would
        // launch you whether you wanted air or not, and the whole question the
        // slice is asking is whether players CHOOSE to leave the ground. So the
        // chute goes beside the line, never across it: holding the line is a
        // clean carve, hucking is a decision to leave it.
        let cx = null;
        for (let t = 0; t < 10; t++) {
          const cand = clamp(spanX(4),
            -T.HALF_WIDTH + halfX * 0.5, T.HALF_WIDTH - halfX * 0.5);
          const clearsLine =
            Math.abs(cand - this.corridorX(cd)) > halfX + F.CLIFF_LINE_CLEARANCE &&
            Math.abs(cand - this.corridorX(cd + 25)) > halfX + F.CLIFF_LINE_CLEARANCE;
          if (clearsLine) { cx = cand; break; }
        }
        if (cx !== null) {
          h.push({
            type: FEATURE.CLIFF, x: cx, d: cd, halfX, drop,
            lip: F.CLIFF_LIP_H,
            infMin: cd - 12,
            infMax: cd + F.CLIFF_RECOVER_START + F.CLIFF_RECOVER_LEN + 2,
          });
        }
      }
      if (rng.chance(Math.min(0.95, F.MOGUL_CHANCE * pitch.mogul))) {
        const cx = spanX(3);
        const cd = rng.range(dLo + 2, d1 - 2);
        h.push({
          type: FEATURE.MOGUL, x: cx, d: cd,
          halfX: F.MOGUL_HALF_X, halfD: F.MOGUL_HALF_D,
          infMin: cd - F.MOGUL_HALF_D, infMax: cd + F.MOGUL_HALF_D,
        });
      }
    }
    this.heightCache.set(ci, h);
    return h;
  }

  chunk(ci) {
    let c = this.chunks.get(ci);
    if (!c) {
      c = this._generate(ci);
      this.chunks.set(ci, c);
    }
    return c;
  }

  /** Drop cached chunks far behind the player to keep the Maps bounded. */
  prune(currentCi) {
    const keep = T.CHUNKS_AHEAD + T.CHUNKS_BEHIND + 3;
    for (const ci of this.chunks.keys()) {
      if (ci < currentCi - keep || ci > currentCi + keep) this.chunks.delete(ci);
    }
    for (const ci of this.heightCache.keys()) {
      if (ci < currentCi - keep - 2 || ci > currentCi + keep + 2) this.heightCache.delete(ci);
    }
  }

  /**
   * True if (x, d) is inside a cliff's flight path or landing zone.
   * Nothing solid may spawn here: a ramp that fires you into a tree is not a
   * ramp, it is a trap, and the whole point of a cliff is that taking it is
   * the brave line rather than the stupid one.
   */
  inLandingZone(x, d) {
    const ci = Math.floor(d / T.CHUNK_LEN);
    for (let c = ci - 1; c <= ci + 1; c++) {
      for (const h of this.heightsOf(c)) {
        if (h.type !== FEATURE.CLIFF) continue;
        if (d <= h.d - F.CLIFF_APPROACH_LEN || d >= h.d + F.CLIFF_LANDING_LEN) continue;
        // Flare the reserved width upslope of the lip so the run-in is a funnel.
        const back = Math.max(0, h.d - d);
        const halfW = h.halfX + F.CLIFF_LANDING_PAD + back * F.CLIFF_APPROACH_FLARE;
        if (Math.abs(x - h.x) < halfW) return true;
      }
    }
    return false;
  }

  _generate(ci) {
    // Stream B — offset well away from stream A so the two never correlate.
    const rng = makeRng(mixSeed(this.seed, ci + 0x40000000));
    const d0 = ci * T.CHUNK_LEN;
    const d1 = d0 + T.CHUNK_LEN;

    const colliders = []; // { type, x, d, r, h, gateId?, side? }
    const regions = [];   // ice patches
    const gates = [];     // { id, x, d, halfSpan }
    const heights = this.heightsOf(ci);

    // Chunks that overlap the safe start get nothing but empty snow.
    if (d1 <= F.SAFE_START) {
      return { ci, d0, d1, colliders, regions, heights, gates, pitch: this.pitchAt(ci) };
    }
    const dLo = Math.max(d0, F.SAFE_START);
    const pitch = this.pitchAt(ci).mul;

    const spanD = () => rng.range(dLo + 2, d1 - 2);
    const spanX = (margin = 2) =>
      rng.range(-T.HALF_WIDTH + margin, T.HALF_WIDTH - margin);

    // Mogul fields want their own space too, though they are only bumps.
    const clearsMoguls = (x, d, pad) => {
      for (let c = ci - 1; c <= ci + 1; c++) {
        for (const h of this.heightsOf(c)) {
          if (h.type !== FEATURE.MOGUL) continue;
          if (Math.abs(d - h.d) < h.halfD + pad &&
              Math.abs(x - h.x) < h.halfX + pad) return false;
        }
      }
      return true;
    };

    /** Every rule a solid object has to satisfy to exist. */
    const solidOk = (x, d, pad) =>
      Math.abs(x - this.corridorX(d)) >= F.CORRIDOR_HALF_W &&
      !this.inLandingZone(x, d) &&
      clearsMoguls(x, d, pad);

    // Gate pair — thread it for a speed bonus, clip a pole and you pay.
    if (rng.chance(Math.min(0.95, F.GATE_CHANCE * pitch.gate))) {
      for (let tries = 0; tries < 10; tries++) {
        const gx = spanX(6);
        const gd = spanD();
        const halfSpan = rng.range(F.GATE_HALF_SPAN[0], F.GATE_HALF_SPAN[1]);
        if (!solidOk(gx - halfSpan, gd, 3) || !solidOk(gx + halfSpan, gd, 3)) continue;
        const id = ci * 16 + gates.length;
        gates.push({ id, x: gx, d: gd, halfSpan });
        for (const side of [-1, 1]) {
          colliders.push({
            type: FEATURE.GATE, x: gx + side * halfSpan, d: gd,
            r: F.GATE_POLE_RADIUS + 0.25, h: F.GATE_POLE_HEIGHT,
            gateId: id, side,
          });
        }
        break;
      }
    }

    // Ice patch — a region, not a solid. Steering goes away on it.
    if (rng.chance(Math.min(0.95, F.ICE_CHANCE * pitch.ice))) {
      const ix = spanX(4);
      const id = spanD();
      if (clearsMoguls(ix, id, 1) && !this.inLandingZone(ix, id)) {
        regions.push({
          type: FEATURE.ICE, x: ix, d: id,
          halfX: F.ICE_HALF_X, halfD: F.ICE_HALF_D,
        });
      }
    }

    // Trees and rocks last, dodging everything already placed.
    const placeSolid = (type, count, radius, height) => {
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 12; tries++) {
          const x = spanX(1);
          const d = spanD();
          if (!solidOk(x, d, 2)) continue;
          let clash = false;
          for (const c of colliders) {
            if (Math.abs(c.x - x) < c.r + radius + 3.2 &&
                Math.abs(c.d - d) < c.r + radius + 3.2) { clash = true; break; }
          }
          if (clash) continue;
          colliders.push({ type, x, d, r: radius, h: height });
          break;
        }
      }
    };

    placeSolid(FEATURE.TREE,
      Math.round(rng.int(F.TREE_COUNT[0], F.TREE_COUNT[1]) * pitch.tree),
      F.TREE_RADIUS, F.TREE_HEIGHT);
    placeSolid(FEATURE.ROCK,
      Math.round(rng.int(F.ROCK_COUNT[0], F.ROCK_COUNT[1]) * pitch.rock),
      F.ROCK_RADIUS, F.ROCK_HEIGHT);

    colliders.sort((a, b) => a.d - b.d);
    return { ci, d0, d1, colliders, regions, heights, gates, pitch: this.pitchAt(ci) };
  }

  // ── height field ────────────────────────────────────────────────────────

  /** Base slope + rolling undulation + powder banks, without features. */
  baseHeight(x, d) {
    let h = -this.fallTo(d);
    h += T.ROLL_A_AMP * Math.sin(d * T.ROLL_A_FD + this.phA) *
                        Math.cos(x * T.ROLL_A_FX + this.phB);
    h += T.ROLL_B_AMP * Math.sin(d * T.ROLL_B_FD + this.phC) *
                        Math.cos(x * T.ROLL_B_FX + this.phD);
    const over = Math.abs(x) - T.HALF_WIDTH;
    if (over > 0) {
      h += Math.min(T.POWDER_WALL_CAP,
        T.POWDER_WALL_GAIN * Math.pow(over, T.POWDER_WALL_EXP));
    }
    return h;
  }

  /** Height contribution of one mogul field / cliff at (x, d). */
  static featureHeight(f, x, d) {
    if (d < f.infMin || d > f.infMax) return 0;

    if (f.type === FEATURE.MOGUL) {
      const w = plateau(x - f.x, f.halfX, 0.6) * plateau(d - f.d, f.halfD, 0.5);
      if (w <= 0) return 0;
      const a = F.MOGUL_AMP * 0.5;
      const bd = 0.5 - 0.5 * Math.cos((d * Math.PI * 2) / F.MOGUL_WAVE_D);
      const bx = 0.5 - 0.5 * Math.cos((x * Math.PI * 2) / F.MOGUL_WAVE_X);
      return w * a * (bd * 0.65 + bx * 0.35) * 2;
    }

    if (f.type === FEATURE.CLIFF) {
      const w = plateau(x - f.x, f.halfX, 0.35);
      if (w <= 0) return 0;
      const dd = d - f.d;
      // Kicker just before the edge, then the floor falls away and climbs back.
      const lip = f.lip * Math.exp(-Math.pow((dd + 1.4) / F.CLIFF_LIP_SPREAD, 2));
      const fall = smooth01(dd / F.CLIFF_FALL_LEN);
      const back = smooth01((dd - F.CLIFF_RECOVER_START) / F.CLIFF_RECOVER_LEN);
      return w * (lip - f.drop * (fall - back));
    }
    return 0;
  }

  /** Ground height at any point on the mountain. This is the collision surface. */
  heightAt(x, d) {
    let h = this.baseHeight(x, d);
    const ci = Math.floor(d / T.CHUNK_LEN);
    for (let c = ci - 1; c <= ci + 1; c++) {
      const hs = this.heightsOf(c);
      for (let i = 0; i < hs.length; i++) h += Terrain.featureHeight(hs[i], x, d);
    }
    return h;
  }

  /**
   * Fill `out` with heights for a regular grid — the mesh builder's fast path.
   *
   * This MUST stay numerically identical to heightAt(). It is faster only
   * because it hoists work that heightAt has to redo per call:
   *   - the rolling noise is separable, so the sin(d) and cos(x) terms are
   *     computed once per row and once per column instead of per vertex
   *   - height features are gathered once per grid, and filtered per row by
   *     their d-range, instead of three Map lookups per vertex
   *
   * A visual heightfield that drifts from the physics one is the exact bug the
   * "one source of truth" promise is about, so tools/gates.mjs asserts these
   * two agree to the bit across a dense sample.
   */
  sampleGrid(x0, x1, nx, d0, d1, nd, out) {
    // Gather every height feature that could touch this grid, once.
    const ci0 = Math.floor(d0 / T.CHUNK_LEN) - 1;
    const ci1 = Math.floor(d1 / T.CHUNK_LEN) + 1;
    const feats = [];
    for (let c = ci0; c <= ci1; c++) {
      const hs = this.heightsOf(c);
      for (let i = 0; i < hs.length; i++) feats.push(hs[i]);
    }

    // Per-column terms: everything in the noise that depends only on x.
    const xs = new Float64Array(nx);
    const cosA = new Float64Array(nx);
    const cosB = new Float64Array(nx);
    const wall = new Float64Array(nx);
    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ((x1 - x0) * ix) / (nx - 1);
      xs[ix] = x;
      cosA[ix] = Math.cos(x * T.ROLL_A_FX + this.phB);
      cosB[ix] = Math.cos(x * T.ROLL_B_FX + this.phD);
      const over = Math.abs(x) - T.HALF_WIDTH;
      wall[ix] = over > 0
        ? Math.min(T.POWDER_WALL_CAP, T.POWDER_WALL_GAIN * Math.pow(over, T.POWDER_WALL_EXP))
        : 0;
    }

    const rowFeats = [];
    let o = 0;
    for (let iz = 0; iz < nd; iz++) {
      const d = d0 + ((d1 - d0) * iz) / (nd - 1);
      const sinA = T.ROLL_A_AMP * Math.sin(d * T.ROLL_A_FD + this.phA);
      const sinB = T.ROLL_B_AMP * Math.sin(d * T.ROLL_B_FD + this.phC);
      const base = -this.fallTo(d);   // must match baseHeight() exactly

      // Only features whose downhill influence covers this row.
      rowFeats.length = 0;
      for (let i = 0; i < feats.length; i++) {
        const f = feats[i];
        if (d >= f.infMin && d <= f.infMax) rowFeats.push(f);
      }

      for (let ix = 0; ix < nx; ix++) {
        let h = base + sinA * cosA[ix] + sinB * cosB[ix] + wall[ix];
        for (let i = 0; i < rowFeats.length; i++) {
          h += Terrain.featureHeight(rowFeats[i], xs[ix], d);
        }
        out[o++] = h;
      }
    }
    return out;
  }

  /** Downhill + lateral gradient, for orienting the player model to the slope. */
  normalAt(x, d, eps = 0.6) {
    const h = this.heightAt(x, d);
    const dhdd = (this.heightAt(x, d + eps) - h) / eps;
    const dhdx = (this.heightAt(x + eps, d) - h) / eps;
    return { h, dhdd, dhdx };
  }

  // ── queries the sim needs ───────────────────────────────────────────────

  /** Every solid within [d - back, d + fwd]. */
  collidersNear(d, back = 6, fwd = 8) {
    const out = [];
    const c0 = Math.floor((d - back) / T.CHUNK_LEN);
    const c1 = Math.floor((d + fwd) / T.CHUNK_LEN);
    for (let c = c0; c <= c1; c++) {
      const chunk = this.chunk(c);
      for (const col of chunk.colliders) {
        if (col.d >= d - back && col.d <= d + fwd) out.push(col);
      }
    }
    return out;
  }

  gatesNear(d, back = 4, fwd = 6) {
    const out = [];
    const c0 = Math.floor((d - back) / T.CHUNK_LEN);
    const c1 = Math.floor((d + fwd) / T.CHUNK_LEN);
    for (let c = c0; c <= c1; c++) {
      for (const g of this.chunk(c).gates) {
        if (g.d >= d - back && g.d <= d + fwd) out.push(g);
      }
    }
    return out;
  }

  /** True when (x, d) sits on an ice patch. */
  isIce(x, d) {
    const ci = Math.floor(d / T.CHUNK_LEN);
    for (let c = ci - 1; c <= ci + 1; c++) {
      for (const r of this.chunk(c).regions) {
        if (r.type !== FEATURE.ICE) continue;
        if (Math.abs(x - r.x) < r.halfX && Math.abs(d - r.d) < r.halfD) return true;
      }
    }
    return false;
  }
}

export { clamp, smooth01, plateau };
