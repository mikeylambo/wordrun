/**
 * Objective queue (Phase 21) — the long progression runway.
 *
 * Temple Run 2's pattern, and the reason it is that pattern: exactly three
 * objectives are live at a time, drawn in order from a much larger pool, and
 * there is NO retroactive credit. If the live objective is 1,000 m and the
 * player runs 2,500 m, only the 1,000 m one clears — the 2,500 m version is
 * still in the queue and still has to be earned when it comes up. One
 * exceptional run therefore cannot front-load months of progression, which a
 * flat checklist of thresholds cannot avoid.
 *
 * This sits beside the daily goals rather than replacing them. The daily card
 * is derived from the day's seed and resets every day — the reason to come
 * back today. The queue is persistent and only ever moves forward — the
 * reason to come back for a month.
 *
 * Rewards are currency only. The balance already buys cosmetics, so that is
 * the cosmetic path; nothing here may hand out a gameplay-power bump, because
 * the whole point is to feed a leaderboard's credibility rather than
 * undermine it.
 *
 * Pure and standalone: no sim imports, no render imports, no DOM. Storage
 * goes through the same adapter seam as StatsManager and DailyManager.
 */

/** The pool. Each entry is one objective SHAPE with an escalating ladder. */
export const POOL = [
  {
    id: 'dist',
    steps: [600, 1200, 2000, 3000, 4200, 6000, 8000, 11000],
    label: (t) => `${t} M`,
    met: (t, r) => (r.distance ?? 0) >= t,
    progress: (t, r) => Math.min(1, (r.distance ?? 0) / t),
  },
  {
    // "Clean" is zero wrong reads of either kind — the strictest thing the
    // game asks for, so the ladder starts short.
    id: 'clean',
    steps: [300, 600, 1000, 1500, 2200, 3200],
    label: (t) => `${t} M CLEAN`,
    met: (t, r) => (r.wrong ?? 0) === 0 && (r.distance ?? 0) >= t,
    progress: (t, r) => ((r.wrong ?? 0) === 0 ? Math.min(1, (r.distance ?? 0) / t) : 0),
  },
  {
    id: 'chain',
    steps: [6, 9, 12, 16, 20, 25, 32],
    label: (t) => `×${t} CHAIN`,
    met: (t, r) => (r.bestChain ?? 0) >= t,
    progress: (t, r) => Math.min(1, (r.bestChain ?? 0) / t),
  },
  {
    id: 'reads',
    steps: [20, 35, 50, 70, 100, 140],
    label: (t) => `${t} READS`,
    met: (t, r) => (r.correct ?? 0) >= t,
    progress: (t, r) => Math.min(1, (r.correct ?? 0) / t),
  },
  {
    id: 'bells',
    steps: [20, 40, 70, 110, 160, 230],
    label: (t) => `${t} BELLS`,
    met: (t, r) => (r.bells ?? 0) >= t,
    progress: (t, r) => Math.min(1, (r.bells ?? 0) / t),
  },
  {
    // Never tapped a fake. Missing a real is allowed — the two mistakes are
    // not the same and the game has never treated them as the same.
    id: 'nofake',
    steps: [500, 900, 1400, 2000, 2800],
    label: (t) => `${t} M NO FAKES`,
    met: (t, r) => (r.falseTaps ?? 0) === 0 && (r.distance ?? 0) >= t,
    progress: (t, r) => ((r.falseTaps ?? 0) === 0 ? Math.min(1, (r.distance ?? 0) / t) : 0),
  },
  {
    id: 'streak',
    steps: [2, 3, 5, 7, 14, 30],
    label: (t) => `${t} DAY STREAK`,
    met: (t, r) => (r.streak ?? 0) >= t,
    progress: (t, r) => Math.min(1, (r.streak ?? 0) / t),
  },
  {
    id: 'dash',
    steps: [100, 250, 450, 700, 1000],
    label: (t) => `${t} DASH`,
    met: (t, r) => (r.dashMeterSpent ?? 0) >= t,
    progress: (t, r) => Math.min(1, (r.dashMeterSpent ?? 0) / t),
  },
];

export const LIVE_SLOTS = 3;

/** Reward for clearing the nth objective in the queue. Currency only. */
export function rewardFor(queueIndex) {
  return 10 + Math.floor(queueIndex / LIVE_SLOTS) * 5;
}

/** Same deterministic hash-rng the rest of the meta layer uses. */
function roll(seed, lane) {
  let t = (seed ^ (lane * 0x9e3779b9)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The full ordered queue for a player, pure from their seed.
 *
 * Built rung by rung: every shape's first step, then every shape's second,
 * and so on, so difficulty ramps across the whole pool instead of exhausting
 * one shape before starting the next. The order WITHIN a rung is shuffled
 * from the seed, so two players do not walk an identical list.
 */
export function queueFor(seed) {
  const s = seed >>> 0;
  const depth = Math.max(...POOL.map((p) => p.steps.length));
  const out = [];
  for (let rung = 0; rung < depth; rung++) {
    const rungItems = POOL
      .filter((p) => rung < p.steps.length)
      .map((p, i) => ({ p, key: roll(s, rung * 101 + i * 7 + 3) }));
    rungItems.sort((a, b) => a.key - b.key);
    for (const { p } of rungItems) {
      const target = p.steps[rung];
      out.push({ id: p.id, rung, target, label: p.label(target) });
    }
  }
  return out;
}

const shapeById = new Map(POOL.map((p) => [p.id, p]));

/** Decorate a queue entry with its live progress against a run result. */
export function describe(entry, result = null, index = 0) {
  const shape = shapeById.get(entry.id);
  return {
    ...entry,
    index,
    reward: rewardFor(index),
    progress: result && shape ? shape.progress(entry.target, result) : 0,
  };
}

export class ObjectiveQueue {
  /**
   * @param adapter storage adapter (get/set), same seam as the other managers
   * @param {object} [opts]
   * @param {number} [opts.seed] player queue seed; generated once and stored
   */
  constructor(adapter, { seed } = {}) {
    this.adapter = adapter;
    const stored = adapter?.get('objectives');
    this.state = (stored && typeof stored === 'object') ? stored : {};
    if (typeof this.state.seed !== 'number') {
      // Per-player, not per-day: two players should not walk the same list,
      // and one player's list must never reshuffle underneath them.
      this.state.seed = (seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0;
    }
    if (typeof this.state.cursor !== 'number') this.state.cursor = 0;
    if (!Array.isArray(this.state.live)) this.state.live = [];
    if (typeof this.state.cleared !== 'number') this.state.cleared = 0;
    this.queue = queueFor(this.state.seed);
    this._fill();
  }

  /** Top the live slots up from the queue. Never draws past the end. */
  _fill() {
    while (this.state.live.length < LIVE_SLOTS && this.state.cursor < this.queue.length) {
      this.state.live.push(this.state.cursor++);
    }
  }

  /** The three live objectives, optionally with progress against a run. */
  status(result = null) {
    return {
      // `clearedTotal`, not `cleared` — recordRun returns the ARRAY of what a
      // run just cleared under that name, and one of them silently winning a
      // spread is exactly the bug worth naming away.
      clearedTotal: this.state.cleared,
      remaining: this.queue.length - this.state.cursor,
      live: this.state.live.map((i) => describe(this.queue[i], result, i)),
    };
  }

  /**
   * Record a finished run. ONLY live objectives are tested — an objective
   * still in the queue gets no credit for a run that would have satisfied it,
   * which is the whole reason this is a queue and not a checklist.
   *
   * Replacements are drawn AFTER every live slot has been judged, so a
   * freshly drawn objective is never cleared by the run that drew it.
   */
  recordRun(result = {}) {
    const cleared = [];
    const kept = [];
    for (const i of this.state.live) {
      const entry = this.queue[i];
      const shape = shapeById.get(entry.id);
      if (shape?.met(entry.target, result)) cleared.push(describe(entry, result, i));
      else kept.push(i);
    }

    this.state.live = kept;
    this.state.cleared += cleared.length;
    const judged = new Set(kept);
    this._fill();

    // Progress is shown only for slots that were live DURING the run. A
    // freshly drawn objective reports zero even if the run would have
    // satisfied it — showing it part-filled would be the retroactive credit
    // this design exists to refuse, drawn as a picture.
    const live = this.state.live.map((i) => ({
      ...describe(this.queue[i], judged.has(i) ? result : null, i),
      fresh: !judged.has(i),
    }));

    const reward = cleared.reduce((sum, c) => sum + c.reward, 0);
    this.adapter?.set('objectives', this.state);
    return {
      cleared, reward, live,
      clearedTotal: this.state.cleared,
      remaining: this.queue.length - this.state.cursor,
    };
  }
}

export default ObjectiveQueue;
