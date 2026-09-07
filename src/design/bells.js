import TUNING from '../TUNING.js';
import { makeRng, mixSeed } from '../sim/rng.js';

export const HEARTS = {
  MAX: 3,

  // Phase 23. Hearts used to be repaired by the bell drip inherited from the
  // source game: 7 bells every 295 m, auto-collected off the travel line, one
  // heart per five. Measured, that is ~24 bells and ~4.7 hearts per kilometre
  // — a 70%-accuracy run lost 23 hearts and got all 23 back, so ENDLESS could
  // not be lost by misreading at all. The fail state regenerated faster than
  // anyone could spend it, which is why the mode had no stakes.
  //
  // A heart now comes back for a CLEAN READING STREAK. It is the same reward
  // pointed at the verb the game is about: earned rather than dripped, and it
  // gives a run the arc it never had — down to one heart, and the way back is
  // a run of correct reads you have to actually produce.
  // Indexed by hearts REMAINING: the closer to the end, the shorter the way
  // back. A flat threshold made a cliff — measured, a 70% reader died at
  // 843 m and an 85% reader ran 12 km, because the repair rate crosses the
  // loss rate at about 80% accuracy and nothing either side of it is close.
  // Shortening the ladder under pressure smooths that AND gives a run the
  // shape it never had: on the last heart, a handful of clean reads is a
  // genuine way out, so falling behind becomes a comeback instead of a
  // formality. [unused, 1 heart, 2 hearts]
  STREAK_REPAIR_BY_HEARTS: [3, 3, 5],
  STREAK_REPAIR_DEFAULT: 5,

  // RC10.9: the bells keep the banked currency and nothing else. The five-note
  // cadence they ring is no longer a constant here at all — it is the chain
  // chime's own ladder, continued (src/audio/ladder.js), which is the point of
  // the change. The boost-meter dial went with the meter it paid; the read
  // absorbed its share (TUNING.WORDS.CORRECT_FILL) and now pays all of it.
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

  // RC10.9 — how much of a string the chain has earned. Measured, a bell was
  // collected on 100 % of runs at every accuracy: no steering verb exists, the
  // string rides `corridorX` and weaves 0.25–0.8 m inside a 2.6 m window, so
  // the count was the odometer with a pickup's costume on. Phase 23 had
  // already made this argument once and taken HEARTS off them for it — "a fail
  // state should not be refilled by something the player has no say in" — and
  // then left the meter and the currency exactly where they were.
  //
  // A bell now lights only while a chain is live, and the chain says how much
  // of the string lights. Nothing about WHERE a bell is has changed: the field
  // is still seeded from the route alone, so the DAILY lays out identically
  // for everyone and only the lit state reads the player.
  // The whole string at the chain cap. With COUNT 7 against a cap of 8 this
  // lands on the simplest rule the game could have: ONE BELL PER LINK.
  LIT_FULL_CHAIN: TUNING.BOOST.CHAIN_CAP,
};

/**
 * How many of a string's bells the chain has lit, leading end first — so the
 * string grows FORWARD along the track as the chain builds, and a player who
 * has just started a chain sees it reaching further ahead with each read.
 *
 * Zero at chain 0, by construction and by gate: an unlit bell is not a bell.
 * One at the very first link, so a first read is visibly answered by the world
 * rather than by a threshold nobody was told about.
 */
export function litCount(chain = 0) {
  const c = Math.max(0, chain | 0);
  if (c === 0) return 0;
  const full = Math.max(1, BELL_LINES.LIT_FULL_CHAIN);
  return Math.min(BELL_LINES.COUNT, Math.ceil(BELL_LINES.COUNT * Math.min(c, full) / full));
}

/** The same thing 0..1, for whatever wants to draw it. */
export function litFraction(chain = 0) {
  return litCount(chain) / BELL_LINES.COUNT;
}

/** Is this particular bell lit right now? Position is seeded; this is not. */
export function bellLit(bell, chain = 0) {
  return (bell?.i | 0) < litCount(chain);
}

/**
 * Bells are the CHAIN, made visible in the track ahead. The field is seeded
 * from the route and nothing else — every player meets the same strings in the
 * same places, and the DAILY is identical for everyone — but a bell only lights
 * while a chain is live, and the chain says how much of its string lights.
 *
 * With no steering verb they are deliberately NOT a test of aim; they sit on
 * the line the runner already travels. RC10.9 moved what they test from the
 * hand to the reading: collection stays automatic, having anything to collect
 * does not. They pay banked currency and nothing else — no hearts (Phase 23),
 * no boost meter (RC10.9), because a dash the reading did not buy is a dash
 * that dilutes the only verb this game has.
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

  /**
   * RC10.9: a bell must be LIT to be collected. An unlit bell is not missed
   * and not consumed — it simply falls behind unlit, and the same string lights
   * for the next player who arrives at it holding a chain. That is the whole
   * change: collection is still automatic, because there is nothing to steer;
   * what is no longer automatic is having anything to collect.
   */
  collectNear(player, chain = 0) {
    const lit = litCount(chain);
    if (lit <= 0) return [];
    const nearby = this.around(player.d, 6, 8);
    const picked = [];
    for (const bell of nearby) {
      if (bell.i >= lit) continue;
      if (Math.abs(player.d - bell.d) > BELL_LINES.PICKUP_D) continue;
      if (Math.abs(player.x - bell.x) > BELL_LINES.PICKUP_X) continue;
      this.collected.add(bell.id);
      picked.push(bell);
    }
    return picked;
  }
}

export default BellField;
