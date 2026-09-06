/**
 * RC7 — the three stops.
 *
 * The run IS the tutorial. A first-timer's guided ENDLESS opening freezes
 * exactly three times, at the first instance of each thing the game has to
 * teach, and never again:
 *
 *   1. the first REAL word arms   — answering resumes and resolves it
 *   2. the first FAKE word arms   — any input, or two seconds, resumes
 *   3. the first full DASH charge — the dash resumes it
 *
 * This is RC3's study stop promoted. That one pinned the runner's POSITION a
 * fixed distance short of the plate; this one pauses the world outright at
 * the arm edge, which is both more honest (nothing is moving, so nothing is
 * being missed) and free of the constraint that made the old one awkward:
 * it needs no room in front of the plate, so it works for the dash — which
 * has no plate at all — and never touches ARM_DISTANCE_M.
 *
 * A stop is a PAUSE, not a slow-motion. Sim.step returns before advancing
 * anything: the clock, the pursuit, the player and the gate all hold at the
 * value they had when the stop began. That is also why the freeze cannot be
 * farmed for early-read value — the answer distance and the latency the
 * multiplier is priced from are frozen with everything else, so an answer
 * given during a stop is timed exactly as one given at the instant the stop
 * began, however long the player looks at it.
 *
 * Nothing here is reachable outside a guided ENDLESS opening: `enabled` is
 * false unless main.js turns it on for a first-timer with GUIDED TIPS on,
 * and the DAILY RUN's chart can never be 'guided'. Headless tools pass no
 * chart and drive the same sim they always did.
 */

import TUNING from '../TUNING.js';

export const STOP = Object.freeze({ REAL: 'real', FAKE: 'fake', DASH: 'dash' });

// The fake stop's other exit. Letting the word pass IS the lesson, so the
// world cannot wait forever for an input the correct answer never sends.
const FAKE_AUTO_SECONDS = 2;

export class TeachStops {
  constructor() { this.reset(); }

  reset() {
    this.enabled = false;
    // Which stops this player has already been shown — persisted by main.js
    // beside the other learned-lesson flags, so each fires once for a life.
    this.learned = { real: false, fake: false, dash: false };
    this.active = null;
    this.heldT = 0;
    this.frozen = null;
    this.firedThisRun = { real: false, fake: false, dash: false };
  }

  /**
   * Should the world hold on this step? Read at the top of Sim.step, before
   * anything advances, so the frame the player sees is the frozen one.
   */
  evaluate(sim) {
    if (!this.enabled || this.active) return null;
    const wg = sim.wordGates;
    if (wg.profile?.CHART !== 'guided') return null;

    // The word stops come first: a word is on screen and passing.
    const g = wg.current();
    if (!g.resolved && wg.armed(sim.player.d)) {
      const which = g.real ? STOP.REAL : STOP.FAKE;
      if (!this.learned[which] && !this.firedThisRun[which]) return which;
    }
    // The dash stop waits for a frame with no word in the way.
    if (!this.learned.dash && !this.firedThisRun.dash &&
        sim.player.boostMeter >= TUNING.BOOST.MIN_ACTIVATE && !sim.player.overdrive) {
      return STOP.DASH;
    }
    return null;
  }

  begin(which, frozenD = 0, frozenT = 0) {
    this.active = which;
    this.heldT = 0;
    // Where the runner stood and what the clock read when the world stopped.
    // The release step advances both by one fixed step before the gate is
    // read, so an answer would otherwise be priced 0.45m and 17ms later than
    // the frame the player actually answered on. The gate prices THESE.
    this.frozen = { d: frozenD, t: frozenT };
    this.firedThisRun[which] = true;
  }

  /**
   * One frozen step. Returns true when the world may run again; the input
   * that released it then flows into the very same step, so the tap that
   * answers a stopped word is the tap that resolves it.
   */
  tryRelease(input, dt) {
    this.heldT += dt;
    const answered = !!(input.confirm || input.reject);
    const dashed = !!(input.boostHeld || input.dashEdge);
    let go = false;
    switch (this.active) {
      // The answer is the lesson: the world waits for it, with no limit.
      case STOP.REAL: go = answered; break;
      // Any input at all, or the two seconds that ARE the correct answer.
      case STOP.FAKE: go = answered || dashed || this.heldT >= FAKE_AUTO_SECONDS; break;
      case STOP.DASH: go = dashed; break;
      default: go = true;
    }
    if (go) { this.active = null; this.heldT = 0; }
    return go;
  }
}

export default TeachStops;
