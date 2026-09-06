/**
 * RC10.3 — the words you have actually learned.
 *
 * The nemesis ledger already does real spaced repetition: a word you miss
 * comes back inside the run, then across days, and three clean reads in a row
 * retire it for good. That is the best thing this game does and until now it
 * was INVISIBLE — a player could beat forty words over a fortnight and see
 * nothing accumulate anywhere. `retiredCount` is not the number either: it
 * only counts words you got WRONG first, so the better you read the smaller it
 * gets, and a player who never misses is told they have mastered nothing.
 *
 * So: a word is MASTERED when you have read it correctly and are not currently
 * owed a repeat for it. Missing it takes it back; beating it through the
 * ledger's three clean reads returns it. Two systems, one honest number, and
 * it is self-correcting — nothing here has to remember why a word left.
 *
 * WHY STRINGS AND NOT A BITMAP. A bit per word over the bank would be 1.3 kB
 * against roughly 25 kB for the words themselves at a few thousand mastered,
 * and it would be keyed by position in a list this game appends to (RC9.6 put
 * 103 new words into the middle of four tiers). Every such edit would shift
 * indices under a stored bitmap and silently rewrite what a player had earned.
 * A word identifies itself. The set is bounded by the bank — you cannot master
 * a word that does not exist — and it is stored as one space-joined string, so
 * a full bank is about 95 kB and a realistic player is a few tens of kB.
 *
 * Pure and adapter-backed: no DOM, no sim, no game, so the gates drive the
 * real thing headlessly.
 */

export class MasteryLedger {
  /**
   * @param {{get:Function,set:Function}} adapter the meta storage seam
   * @param {(word:string)=>boolean} owed does the nemesis ledger want this
   *   word back? A word being practised is not a word mastered. Note this is
   *   OUTSTANDING MISSES, not "has an entry": the ledger records every word it
   *   sees, so merely having a history is true of a word read right first time.
   */
  constructor(adapter, owed = () => false, key = 'mastery') {
    this.adapter = adapter;
    this.key = key;
    this.owed = owed;
    const raw = adapter?.get?.(key);
    const words = typeof raw === 'string' ? raw : raw?.words;
    this.set = new Set(typeof words === 'string' && words
      ? words.split(' ').filter(Boolean) : []);
    this._dirty = false;
  }

  _persist() {
    this.adapter?.set?.(this.key, { words: [...this.set].join(' ') });
  }

  /**
   * A correct read. Returns true when this is the FIRST time the word has
   * been mastered — the moment worth telling anyone about.
   */
  mark(word) {
    if (!word || this.owed(word)) return false;
    if (this.set.has(word)) return false;
    this.set.add(word);
    this._persist();
    return true;
  }

  /** A wrong read. The word is being practised again, so it is not mastered. */
  unmark(word) {
    if (!word || !this.set.delete(word)) return false;
    this._persist();
    return true;
  }

  has(word) { return this.set.has(word); }
  get count() { return this.set.size; }

  /**
   * The count per tier, for the profile readout. Takes the bank's own tier
   * lists so this file needs to know nothing about how words are grouped.
   * @param {string[][]} tiers
   */
  byTier(tiers = []) {
    return tiers.map((words) => {
      let n = 0;
      for (const w of words) if (this.set.has(w)) n++;
      return { known: n, total: words.length };
    });
  }

  /** Everything, for the export. Sorted so two snapshots compare cleanly. */
  words() { return [...this.set].sort(); }
}

export default MasteryLedger;
