/**
 * DailyManager — the daily loop, following the SLU Web Shell's Quest /
 * Challenge managers (modules/quests/QuestManager.ts, game/Challenges.ts)
 * adapted to DICTION DASH's one-mode shape and zero-dependency house style.
 *
 * Two shell ideas made concrete for this game:
 *
 *   - QUESTS -> three DAILY GOALS derived deterministically from the daily
 *     seed (a challenge definition per day, no authoring backlog). A goal
 *     completed by ANY run today stays completed for the day.
 *   - the shell's medal/streak instinct -> a consecutive-day PLAY STREAK,
 *     the retention spine of every daily word game (play once today to
 *     keep it; a missed calendar day resets it).
 *
 * Storage goes through the same adapter seam as StatsManager, and the
 * clock is injectable so the tools can replay week-long calendars.
 */

const DAY_MS = 86400000;

export function isoToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function isoYesterday(isoDay) {
  const t = Date.parse(`${isoDay}T00:00:00Z`);
  return new Date(t - DAY_MS).toISOString().slice(0, 10);
}

/** Tiny deterministic hash-rng (mulberry32 family), local on purpose so the
 *  meta layer stays standalone — same recipe the sim's rng.js uses. */
function roll(seed, lane) {
  let t = (seed ^ (lane * 0x9e3779b9)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The day's three goals, pure from the seed — same seed, same card. */
export function goalsFor(seed) {
  const s = seed >>> 0;
  const dist = 800 + Math.floor(roll(s, 1) * 5) * 200;   // 800..1600 m
  const chain = 5 + Math.floor(roll(s, 2) * 4);          // x5..x8
  const reads = 15 + Math.floor(roll(s, 3) * 4) * 5;     // 15..30
  return [
    { id: 'dist', label: `REACH ${dist}M`, target: dist },
    { id: 'chain', label: `CHAIN ×${chain}`, target: chain },
    { id: 'reads', label: `${reads} CLEAN READS`, target: reads },
  ];
}

function goalMet(goal, result) {
  if (goal.id === 'dist') return (result.distance ?? 0) >= goal.target;
  if (goal.id === 'chain') return (result.bestChain ?? 0) >= goal.target;
  if (goal.id === 'reads') return (result.correct ?? 0) >= goal.target;
  return false;
}

export class DailyManager {
  constructor(adapter, { today = isoToday } = {}) {
    this.adapter = adapter;
    this.today = today;
    this.state = adapter?.get('daily') ?? {};
    if (typeof this.state !== 'object' || this.state === null) this.state = {};
  }

  _dayRecord(seed) {
    const day = this.today();
    if (this.state.day?.date !== day || this.state.day?.seed !== seed) {
      this.state.day = { date: day, seed, done: {}, best: 0 };
    }
    return this.state.day;
  }

  /** Current streak WITHOUT recording a play (title screen display). */
  streak() {
    const day = this.today();
    const last = this.state.last;
    if (last === day) return this.state.streak || 0;
    if (last === isoYesterday(day)) return this.state.streak || 0; // alive, not yet extended
    return 0; // broken (or never started) until today is played
  }

  /** Today's goal card with completion flags, without recording. */
  status(seed) {
    const rec = this._dayRecord(seed);
    return {
      streak: this.streak(),
      playedToday: this.state.last === this.today(),
      best: rec.best,
      goals: goalsFor(seed).map((g) => ({ ...g, done: !!rec.done[g.id] })),
    };
  }

  /**
   * Record a finished run: extends/starts the play streak (once per calendar
   * day) and marks any goals this run satisfied. Returns the updated card
   * plus which goals this run newly completed, for the results screen.
   */
  recordRun(seed, result) {
    const day = this.today();
    if (this.state.last !== day) {
      this.state.streak = this.state.last === isoYesterday(day)
        ? (this.state.streak || 0) + 1 : 1;
      this.state.last = day;
    }

    const rec = this._dayRecord(seed);
    rec.best = Math.max(rec.best, Math.floor(result.distance ?? 0));
    const newlyDone = [];
    const goals = goalsFor(seed).map((g) => {
      const was = !!rec.done[g.id];
      const now = was || goalMet(g, result);
      if (now && !was) newlyDone.push(g.id);
      rec.done[g.id] = now;
      return { ...g, done: now };
    });

    this.adapter?.set('daily', this.state);
    return { streak: this.state.streak, best: rec.best, goals, newlyDone };
  }
}

export default DailyManager;
