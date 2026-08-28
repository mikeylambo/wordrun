import { makeRng, mixSeed } from '../sim/rng.js';

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
  // Phase 8 audit: strings were still laid in the source frame's straight
  // ribbon coordinates (a centre near x=0, arcs bent toward retired air
  // launches) while the Phase 7 winding line swings ±15.5m — with a 1.45m
  // pickup they were functionally uncollectible: wired to hearts and meter
  // on paper, inert in play. They now follow the travel line itself with a
  // small weave, and the pickup window absorbs the auto-follow's curve
  // drift, so the ambient-reward loop (meter drip, heart repair, banked
  // currency) actually happens.
  WEAVE: 0.8,
  PICKUP_X: 2.6,
  PICKUP_D: 1.9,
  HAZARD_PAD: 2.8,
  LOOK_AHEAD: 13,
};

/**
 * Bells are the run's ambient pickup: a route-shaped drip of boost meter,
 * the five-count heart-repair rhythm, and the banked currency. With no
 * steering verb they are deliberately NOT a skill test — they sit on the
 * line the runner already travels; the reward is rhythm, not aim.
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

  /** The travel line at distance d — the winding centerline when it exists. */
  _lineX(d) {
    return this.terrain?.corridorX ? this.terrain.corridorX(d) : 0;
  }

  /**
   * Keep a bell on the travel line: the weave stays well inside the pickup
   * window and the flat track has no solids, but the collider check stays
   * as the honest fallback for any future obstacle.
   */
  _safeX(rawX, d) {
    if (this._clearAt(rawX, d)) return rawX;
    const line = this._lineX(d);
    if (this._clearAt(line, d)) return line;
    return null;
  }

  _line(index) {
    if (this.cache.has(index)) return this.cache.get(index);
    const rng = makeRng(mixSeed(this.seed || 1, 0xb311 + index * 97));
    const baseD = BELL_LINES.START + index * BELL_LINES.SPACING +
      rng.range(-BELL_LINES.JITTER, BELL_LINES.JITTER);

    // The string rides the winding line itself, with a gentle seeded weave
    // for visual life — bounded so every bell stays inside the pickup
    // window of a runner who is simply running.
    const weaveAmp = rng.range(0.25, BELL_LINES.WEAVE);
    const weavePhase = rng.range(0, Math.PI * 2);
    const bells = [];
    for (let i = 0; i < BELL_LINES.COUNT; i++) {
      const t = i / Math.max(1, BELL_LINES.COUNT - 1);
      const d = baseD + i * BELL_LINES.STEP_D;
      const rawX = this._lineX(d) + Math.sin(weavePhase + t * Math.PI * 2) * weaveAmp;
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
