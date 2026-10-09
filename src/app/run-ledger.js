/**
 * The run's own tallies — everything this run counts about itself that the
 * sim does not: which gates went right, how many PERFECTs, the brilliance
 * ledgers (E4), the words it retired and learned.
 *
 * They were a dozen loose `let`s across main.js, reset in two different
 * places. One object, one reset(), called once at the start of every run;
 * the sim-event drain writes it and the results card reads it.
 */

export class RunLedger {
  constructor() { this.reset(); }

  reset() {
    // Every resolved gate of this run, by index: 1 right, 0 wrong. The DAILY
    // RUN's share text is drawn from it (meta/share-grid.js).
    this.gateTrail = [];
    this.tierTally = {};
    this.perfectsThisRun = 0;   // RC13.7: PERFECT judgments, for the results tally
    this.retiredThisRun = [];
    this.learnedWords = 0;      // RC10.3: words mastered for the first time this run
    // E4 brilliance ledgers: the run notices its own best moments. A wrong read
    // breaks the burst window and the early streak — bursts are consecutive.
    this.burstWindow = [];
    this.burst10 = 0;
    this.earlyStreak = 0;
    this.bestEarlyStreak = 0;
    this.dashRungMax = 0;
  }
}

export default RunLedger;
