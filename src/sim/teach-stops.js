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
// RC7.1 — the dash stop's exits. The other two stops teach an answer the
// player must give to continue at all; the dash is a POWER, and holding a
// frozen world hostage until someone finds a button they may not want is a
// worse lesson than letting them go. It releases on five seconds or on the
// third input that is not a dash — a player pressing other things is a
// player who has read the line and is not doing it. The RING and the LINE
// stay after the release, and the lesson itself retires only on a real
// hold, so the world offers it again next run rather than pretending it
// was learned.
const DASH_AUTO_SECONDS = 5;
const DASH_OTHER_INPUTS = 3;

// RC10.8 verdict — THE DASH STOP STAYS A STOP.
//
// The question put to the playtest was whether the dash still earns a freeze
// or whether the coach line alone could carry it, now that RC7.1 lets the line
// outlive the stop and follow the player through the run. The answer is that
// it earns it. The other two stops teach an ANSWER, which a player will meet
// again within seconds whether or not they understood it; the dash is a POWER,
// and a power nobody presses is a power that does not exist. It is also the
// only one of the three with no plate to look at, so a player who misses the
// moment has nothing to read afterwards.
//
// What keeps it honest is already here: it fires once per life, it releases on
// five seconds or on the third non-dash input rather than holding the world
// hostage, and the ring and the line stay after it lets go. Kept as a stop.

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
    this.otherInputs = 0;
    this._prevOther = false;
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
    this.otherInputs = 0;
    this._prevOther = false;
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
    const other = answered;   // anything that is not the dash
    let go = false;
    switch (this.active) {
      // The answer is the lesson: the world waits for it, with no limit.
      case STOP.REAL: go = answered; break;
      // Any input at all, or the two seconds that ARE the correct answer.
      case STOP.FAKE: go = answered || dashed || this.heldT >= FAKE_AUTO_SECONDS; break;
      // The dash lets go three ways; only one of them is the lesson.
      case STOP.DASH: {
        if (other && !this._prevOther) this.otherInputs++;
        this._prevOther = other;
        go = dashed || this.otherInputs >= DASH_OTHER_INPUTS ||
          this.heldT >= DASH_AUTO_SECONDS;
        break;
      }
      default: go = true;
    }
    if (go) { this.active = null; this.heldT = 0; }
    return go;
  }
}

export default TeachStops;
