import { makeRng, mixSeed } from '../sim/rng.js';
import { nearestAirBeat, AIR_BEAT_RULES } from './air-beats.js';

export const HEARTS = {
  MAX: 3,
  BELLS_PER_HEART: 5,
  POWER_PER_BELL: 1.25,
};

export const BELL_LINES = {
  START: 115,
  SPACING: 295,
  JITTER: 26,
  COUNT: 7,
  STEP_D: 13.5,
  PICKUP_X: 1.45,
  PICKUP_D: 1.9,
  SAFE_HALF_WIDTH: 10.5,
  HAZARD_PAD: 2.8,
  LOOK_AHEAD: 13,
  AIR_MIN_AHEAD: 42,
  AIR_MAX_AHEAD: 145,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Bells are route suggestions, not currency. A line must be continuous enough
 * to read at speed and honest enough that following it never deliberately feeds
 * the skier into a solid. The terrain's guaranteed corridor is the final safety
 * net when a decorative arc cannot find room.
 */
export class BellField {
  constructor(seed = 0, terrain = null) {
    this.cache = new Map();
    this.terrain = terrain;
    this.reset(seed, terrain);
  }

  reset(seed = this.seed, terrain = this.terrain) {
    this.seed = seed >>> 0;
    this.terrain = terrain || this.terrain;
    this.collected = new Set();
    this.cache.clear();
  }

  setTerrain(terrain) {
    if (terrain === this.terrain) return;
    this.terrain = terrain;
    this.cache.clear();
  }

  _clearAt(x, d) {
    if (!this.terrain?.collidersNear) return true;
    const near = this.terrain.collidersNear(d, 7, BELL_LINES.LOOK_AHEAD);
    for (const c of near) {
      const dd = c.d - d;
      if (dd < -5 || dd > BELL_LINES.LOOK_AHEAD) continue;
      const clearance = Math.abs(x - c.x) - ((c.r || 0.7) + BELL_LINES.HAZARD_PAD);
      if (clearance < 0) return false;
    }
    return true;
  }

  _safeX(rawX, d) {
    const raw = clamp(rawX, -BELL_LINES.SAFE_HALF_WIDTH, BELL_LINES.SAFE_HALF_WIDTH);
    if (!this.terrain?.collidersNear) return raw;
    if (this._clearAt(raw, d)) return raw;

    const candidates = [];
    for (let x = -BELL_LINES.SAFE_HALF_WIDTH; x <= BELL_LINES.SAFE_HALF_WIDTH + 0.01; x += 1.15) {
      candidates.push(x);
    }

    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const x = clamp(candidate, -BELL_LINES.SAFE_HALF_WIDTH, BELL_LINES.SAFE_HALF_WIDTH);
      if (!this._clearAt(x, d)) continue;
      const score = -Math.abs(x - raw);
      if (score > bestScore) {
        bestScore = score;
        best = x;
      }
    }

    if (best != null) return best;

    // Solids are forbidden from the terrain's reserved corridor. Prefer that
    // boring-but-honest line to deleting a bell and leaving the player with a
    // broken visual invitation.
    if (this.terrain?.corridorX) {
      const corridor = clamp(this.terrain.corridorX(d),
        -BELL_LINES.SAFE_HALF_WIDTH, BELL_LINES.SAFE_HALF_WIDTH);
      if (this._clearAt(corridor, d)) return corridor;
    }
    return null;
  }

  _line(index) {
    if (this.cache.has(index)) return this.cache.get(index);
    const rng = makeRng(mixSeed(this.seed || 1, 0xb311 + index * 97));
    let baseD = BELL_LINES.START + index * BELL_LINES.SPACING +
      rng.range(-BELL_LINES.JITTER, BELL_LINES.JITTER);

    // Only bend a string toward a launch that is genuinely AHEAD of this line.
    // RC6 could snap adjacent strings backward onto the same beat, clustering
    // collectibles and creating a long empty stretch afterwards.
    const probe = baseD + BELL_LINES.AIR_MIN_AHEAD;
    const nearAir = nearestAirBeat(this.seed, probe, BELL_LINES.AIR_MAX_AHEAD);
    const useAir = nearAir &&
      nearAir.d >= baseD + BELL_LINES.AIR_MIN_AHEAD &&
      nearAir.d <= baseD + BELL_LINES.AIR_MAX_AHEAD;
    const bells = [];

    if (useAir && this.terrain?.corridorX) {
      baseD = nearAir.d - (BELL_LINES.COUNT - 1) * BELL_LINES.STEP_D - 4;
      const targetX = clamp(
        this.terrain.corridorX(nearAir.d) + nearAir.side * AIR_BEAT_RULES.SIDE_OFFSET,
        -BELL_LINES.SAFE_HALF_WIDTH,
        BELL_LINES.SAFE_HALF_WIDTH
      );
      const startX = clamp(targetX - nearAir.side * 4.8,
        -BELL_LINES.SAFE_HALF_WIDTH, BELL_LINES.SAFE_HALF_WIDTH);

      for (let i = 0; i < BELL_LINES.COUNT; i++) {
        const t = i / Math.max(1, BELL_LINES.COUNT - 1);
        const d = baseD + i * BELL_LINES.STEP_D;
        const rawX = lerp(startX, targetX, t) + Math.sin(t * Math.PI) * nearAir.side * 1.2;
        const x = this._safeX(rawX, d);
        if (x == null) continue;
        bells.push({
          id: `${index}:${i}`,
          line: index,
          i,
          x,
          d,
          airBeat: nearAir.id,
          phase: rng.range(0, Math.PI * 2),
        });
      }
    } else {
      const centre = rng.range(-6.2, 6.2);
      const direction = rng.next() < 0.5 ? -1 : 1;
      const sweep = rng.range(2.0, 5.2);
      const slant = rng.range(0.4, 0.95) * direction;

      for (let i = 0; i < BELL_LINES.COUNT; i++) {
        const t = i / Math.max(1, BELL_LINES.COUNT - 1);
        const arc = Math.sin(t * Math.PI) * sweep;
        const rawX = centre + (i - (BELL_LINES.COUNT - 1) / 2) * slant + arc * direction;
        const d = baseD + i * BELL_LINES.STEP_D;
        const x = this._safeX(rawX, d);
        if (x == null) continue;
        bells.push({
          id: `${index}:${i}`,
          line: index,
          i,
          x,
          d,
          phase: rng.range(0, Math.PI * 2),
        });
      }
    }

    this.cache.set(index, bells);
    return bells;
  }

  around(distance, behind = 85, ahead = 560) {
    const lo = Math.floor((distance - behind - BELL_LINES.START - BELL_LINES.JITTER) / BELL_LINES.SPACING) - 1;
    const hi = Math.ceil((distance + ahead - BELL_LINES.START + BELL_LINES.JITTER) / BELL_LINES.SPACING) + 1;
    const out = [];
    for (let index = Math.max(0, lo); index <= hi; index++) {
      for (const bell of this._line(index)) {
        if (bell.d < distance - behind || bell.d > distance + ahead) continue;
        if (!this.collected.has(bell.id)) out.push(bell);
      }
    }
    return out;
  }

  collectNear(player) {
    const nearby = this.around(player.d, 6, 8);
    const picked = [];
    for (const bell of nearby) {
      if (Math.abs(player.d - bell.d) > BELL_LINES.PICKUP_D) continue;
      if (Math.abs(player.x - bell.x) > BELL_LINES.PICKUP_X) continue;
      this.collected.add(bell.id);
      picked.push(bell);
    }
    return picked;
  }
}

export default BellField;
