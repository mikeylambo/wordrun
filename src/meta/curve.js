/**
 * The curve screen — what the player is actually getting better at.
 *
 * Every other screen reports a run. This one reports a person: per-tier
 * accuracy over the last seven days, how the read time is trending, and the
 * words that have been beaten outright. "Your hardest-tier accuracy went 61%
 * to 74% this week" is a better reason to come back than any score, and it is
 * the one thing here a runner cannot copy — the game is measurably teaching
 * something real, and this is where it says so.
 *
 * Reads the same adapter seam as everything else in meta/ and writes one key.
 * No naming: it is a screen of figures, not a fifth named thing.
 */

const KEY = 'curve';
const DAYS = 7;
const DAY_MS = 86400000;
const dayOf = (t = Date.now()) => Math.floor(t / DAY_MS);

export class CurveLog {
  constructor(adapter, key = KEY) {
    this.adapter = adapter;
    this.key = key;
    const raw = adapter?.get?.(key);
    this.days = (raw && typeof raw === 'object' && raw.days) ? raw.days : {};
    this._trim();
  }

  _trim() {
    const cutoff = dayOf() - (DAYS * 4);
    for (const k of Object.keys(this.days)) {
      if (Number(k) < cutoff) delete this.days[k];
    }
  }

  /** One run's reading, folded into today. */
  addRun({ perTier = {}, avgReadMs = 0, reads = 0, retired = 0 } = {}) {
    const d = String(dayOf());
    const day = this.days[d] || (this.days[d] = { t: {}, ms: 0, reads: 0, retired: 0 });
    for (const [tier, v] of Object.entries(perTier)) {
      const slot = day.t[tier] || (day.t[tier] = { a: 0, c: 0 });
      slot.a += v.a || 0;
      slot.c += v.c || 0;
    }
    if (reads > 0) { day.ms += avgReadMs * reads; day.reads += reads; }
    day.retired += retired;
    this._trim();
    this.adapter?.set?.(this.key, { days: this.days });
  }

  /**
   * The trend, as arrays rather than a single delta (Phase 1). Per tier, the
   * daily accuracy over the last `days` days, oldest → newest; and the daily
   * average read time over the same window. A day with no runs is `null`, never
   * fabricated or interpolated — a gap in the line is the truth that nothing was
   * played, and the sparkline draws it as a break. Exactly `days` entries in
   * every array, so the caller can map day-to-x without bounds games.
   */
  series(days = 14, now = Date.now()) {
    const today = dayOf(now);
    const first = today - days + 1;
    const tierSet = new Set();
    for (let d = first; d <= today; d++) {
      const day = this.days[String(d)];
      if (day) for (const t of Object.keys(day.t)) tierSet.add(Number(t));
    }
    const tiers = [...tierSet].sort((a, b) => a - b);
    const accuracy = {};
    for (const t of tiers) accuracy[t] = [];
    const readMs = [];
    for (let d = first; d <= today; d++) {          // oldest → newest
      const day = this.days[String(d)];
      for (const t of tiers) {
        const slot = day?.t?.[String(t)];
        accuracy[t].push(slot && slot.a > 0 ? Math.round((100 * slot.c) / slot.a) : null);
      }
      readMs.push(day && day.reads > 0 ? Math.round(day.ms / day.reads) : null);
    }
    return { days, tiers, accuracy, readMs };
  }

  /**
   * The week against the week before it. Returns null where there is not
   * enough history to say anything honest — a trend drawn from one run is a
   * lie with a chart around it.
   */
  summary(now = Date.now()) {
    const today = dayOf(now);
    const bucket = (from, to) => {
      const acc = { t: {}, ms: 0, reads: 0, retired: 0, days: 0 };
      for (let d = from; d <= to; d++) {
        const day = this.days[String(d)];
        if (!day) continue;
        acc.days++;
        for (const [tier, v] of Object.entries(day.t)) {
          const slot = acc.t[tier] || (acc.t[tier] = { a: 0, c: 0 });
          slot.a += v.a; slot.c += v.c;
        }
        acc.ms += day.ms; acc.reads += day.reads; acc.retired += day.retired;
      }
      return acc;
    };
    const thisWeek = bucket(today - DAYS + 1, today);
    const lastWeek = bucket(today - (DAYS * 2) + 1, today - DAYS);
    const pct = (s) => (s && s.a > 0 ? Math.round((100 * s.c) / s.a) : null);
    const tiers = [];
    for (const tier of Object.keys(thisWeek.t).sort()) {
      tiers.push({
        tier: Number(tier),
        now: pct(thisWeek.t[tier]),
        was: pct(lastWeek.t[tier]),
        reads: thisWeek.t[tier].a,
      });
    }
    return {
      days: thisWeek.days,
      tiers,
      readMs: thisWeek.reads > 0 ? Math.round(thisWeek.ms / thisWeek.reads) : null,
      readMsWas: lastWeek.reads > 0 ? Math.round(lastWeek.ms / lastWeek.reads) : null,
      retired: thisWeek.retired,
    };
  }
}

export default CurveLog;
