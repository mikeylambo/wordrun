/**
 * The words this player keeps getting wrong, and when to show them again.
 *
 * A local ledger — attempts, misses and last-seen per word — plus a lane that
 * substitutes a due word into roughly one gate in twelve. This is the only
 * system in the game that knows anything about a particular person, and it is
 * also the only one that can tell them they are getting better at something
 * real, which is the whole reason it exists.
 *
 * Two rules it must never break, both gated:
 *
 *  - The lane SUBSTITUTES; it does not reorder. The tier walk's no-repeat
 *    guarantee is a coprime stride over each tier's list, and reaching into it
 *    would corrupt the property for every word, not just the substituted one.
 *    The walk runs exactly as it would have and the lane swaps what is shown
 *    at a gate the walk has already chosen.
 *  - It is disabled on the DAILY RUN. That route is the same hundred words in
 *    the same order for everyone; a personal substitution would make two
 *    players' scores incomparable while looking identical.
 */

const CAP = 400;            // words held, LRU by last-seen
const LANE_EVERY = 12;      // roughly one gate in twelve
const RETIRE_CLEAN = 3;     // clean reads in a row before a word is retired

// The spaced schedule, in gates for the first step and days after that. A word
// missed once comes back inside the same run; one missed repeatedly comes back
// across sessions, which is where the learning actually happens.
const SCHEDULE_GATES = [8, 25];
const SCHEDULE_DAYS = [1, 7];

const now = () => Date.now();
const DAY_MS = 86400000;

export class NemesisLedger {
  constructor(adapter, key = 'nemesis') {
    this.adapter = adapter;
    this.key = key;
    const raw = adapter?.get?.(key);
    this.words = raw && typeof raw === 'object' && raw.words ? raw.words : {};
    this.retired = raw?.retired || 0;
  }

  _persist() {
    // Bounded on write rather than on read: a ledger that grows unbounded in
    // memory and is only trimmed on load is unbounded in practice.
    const ids = Object.keys(this.words);
    if (ids.length > CAP) {
      ids.sort((a, b) => (this.words[b].seen || 0) - (this.words[a].seen || 0));
      const keep = {};
      for (const id of ids.slice(0, CAP)) keep[id] = this.words[id];
      this.words = keep;
    }
    this.adapter?.set?.(this.key, { words: this.words, retired: this.retired });
  }

  /** Record how a word went. `id` is the TRUE spelling, never the fake. */
  record(id, correct, gateIndex = 0) {
    if (!id) return;
    const w = this.words[id] || (this.words[id] = { a: 0, m: 0, run: 0, seen: 0, due: 0 });
    w.a++;
    w.seen = now();
    if (correct) {
      w.run++;
      if (w.m > 0 && w.run >= RETIRE_CLEAN) {
        delete this.words[id];
        this.retired++;
        this._persist();
        return 'retired';
      }
      // Spacing is the whole point: a word read right goes FURTHER away, not
      // straight back into the next lane gate. Without this the same word
      // occupies every substitution until it retires — measured, one word
      // filled gates 12, 24, 36 and 48 of a single run.
      if (w.m > 0) {
        const step = SCHEDULE_GATES[Math.min(w.run, SCHEDULE_GATES.length - 1)];
        w.due = gateIndex + step * (w.run + 1);
        w.dueAt = w.run >= SCHEDULE_GATES.length
          ? now() + DAY_MS * SCHEDULE_DAYS[Math.min(w.run - SCHEDULE_GATES.length,
            SCHEDULE_DAYS.length - 1)]
          : 0;
      }
    } else {
      w.m++;
      w.run = 0;
      // First miss returns inside the run; a repeat offender returns across
      // sessions, on the interval its miss count has earned.
      w.due = w.m <= SCHEDULE_GATES.length
        ? gateIndex + SCHEDULE_GATES[w.m - 1]
        : 0;
      w.dueAt = w.m > SCHEDULE_GATES.length
        ? now() + DAY_MS * (SCHEDULE_DAYS[Math.min(w.m - SCHEDULE_GATES.length,
          SCHEDULE_DAYS.length) - 1])
        : 0;
    }
    this._persist();
    return correct ? 'correct' : 'missed';
  }

  /** The word most owed a reappearance at this gate, or null. */
  due(gateIndex) {
    const t = now();
    let best = null, bestMisses = 0;
    for (const [id, w] of Object.entries(this.words)) {
      if (w.m <= 0) continue;
      const readyByGate = w.due > 0 && gateIndex >= w.due;
      const readyByTime = w.dueAt > 0 && t >= w.dueAt;
      if (!readyByGate && !readyByTime) continue;
      // Most-missed first, and among equals the one least recently seen —
      // so a shelf of equally troublesome words rotates instead of one of
      // them owning every lane gate.
      if (w.m > bestMisses || (w.m === bestMisses && best && w.seen < this.words[best].seen)) {
        best = id; bestMisses = w.m;
      }
    }
    return best;
  }

  history(id) { return this.words[id] || null; }
  get size() { return Object.keys(this.words).length; }
  get retiredCount() { return this.retired; }

  /**
   * The lane. Pure in (gateIndex) apart from the ledger itself, and it never
   * touches the walk — the caller has already built its gate and this only
   * says which word to print on it.
   */
  substituteFor(gateIndex) {
    if (gateIndex <= 0 || gateIndex % LANE_EVERY !== 0) return null;
    return this.due(gateIndex);
  }
}

export const NEMESIS = { CAP, LANE_EVERY, RETIRE_CLEAN, SCHEDULE_GATES, SCHEDULE_DAYS };
export default NemesisLedger;
