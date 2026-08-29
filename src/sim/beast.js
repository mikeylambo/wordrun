/**
 * The pursuit — WORD RUN Phase 7. Pure speed differential, no director.
 *
 * The Redline runs at one steady baseline pace (TUNING.RUN.REDLINE_PACE).
 * The gap to the player is nothing but that differential integrated over
 * time: read well and you pull away, misread and it gains. There is no
 * hunt/stalk/relief state machine, no mistake pressure, no lunges, no
 * grace curve — the consequence of a wrong read reaches the gap through
 * the speed it just cost you, and through nothing else.
 *
 * The class keeps the name `Beast` and the API surface every presentation
 * layer consumes (gap/x/side/lunge/bands()/proximityMult()), so the
 * tear/veil/field escalation and the panned audio need no changes; the
 * retired director's fields survive as inert constants.
 */

import TUNING from '../TUNING.js';
import { mulberry32 } from './rng.js';

const BE = TUNING.BEAST;
const R = TUNING.RUN;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

// Vocabulary kept for the layers that import it; the states never change.
export const LUNGE = { IDLE: 'idle', TELL: 'tell', STRIKE: 'strike', RECOVER: 'recover' };
export const CHASE_MODE = { STALK: 'stalk', HUNT: 'hunt', RELIEF: 'relief' };

export class Beast {
  constructor(seed = 0) {
    this.seed = seed >>> 0;
    this.side = (seed & 1) ? 1 : -1;
    this._rng = mulberry32(this.seed ^ 0x52454431); // 'RED1'
    this.rng = { next: () => this._rng() };
    this.reset();
  }

  _rand(lo, hi) { return lo + this._rng() * (hi - lo); }

  reset() {
    this.gap = BE.START_GAP;
    this.desired = BE.START_GAP;   // debug mirror; the gap has no servo now
    this.x = 0;
    this.t = 0;
    this.killed = false;
    this.killT = 0;
    this.killAir = false;
    // Phase 10: pace is per-difficulty (EASY 24 / NORMAL 27 / HARD 30),
    // set by sim.start; the default is the shipped baseline. This is the
    // honest successor to the old grace curve, which the Phase 7 rewrite
    // left inert — easing is a visible choice now, not a hidden fade.
    this.pace = R.REDLINE_PACE;

    // Inert director surface, kept so consumers never branch differently.
    this.mode = 'run';
    this.lunge = LUNGE.IDLE;
    this.lungeT = 0;
    this.lunges = 0;
    this.hunts = 0;
    this.attackKind = null;
    this.attackT = 0;
    this.airPounce = false;
    this.mistakePressure = 0;
    this.pursuitSpeed = this.pace;
    this.avgSpeed = R.START_SPEED;
  }

  /** Inert: mistakes reach the gap through the speed they cost, only. */
  registerMistake() {}

  /** Inert: authored stunt shoves belonged to the retired director. */
  stuntShove() { return 0; }

  wakefulness() { return 1; }

  proximityMult() {
    if (this.gap >= TUNING.BOOST.PROX_RANGE) return 1;
    const t = 1 - clamp(this.gap / TUNING.BOOST.PROX_RANGE, 0, 1);
    return 1 + t * (TUNING.BOOST.PROX_MAX_MULT - 1);
  }

  step(dt, player) {
    if (this.killed) { this.killT += dt; return; }
    this.t += dt;

    // THE mechanic: gap is the speed differential over time. Nothing else
    // ever writes it.
    const v = player.effSpeed ?? player.speed;
    this.gap = clamp(this.gap + (v - this.pace) * dt, BE.KILL_GAP, BE.MAX_GAP);
    this.desired = this.gap;
    this.pursuitSpeed = this.pace;
    const k = 1 - Math.exp(-dt / BE.AVG_SPEED_TAU);
    this.avgSpeed += (v - this.avgSpeed) * k;

    // Peripheral approach: the same side-offset placement the frame always
    // used, so the tear sits on the frame edge, never eclipsing the runner.
    const ot = clamp(
      (this.gap - BE.OFFSET_FADE_NEAR) / (BE.OFFSET_FADE_FAR - BE.OFFSET_FADE_NEAR), 0, 1
    );
    const baseOffset = BE.OFFSET_MIN + (BE.APPROACH_OFFSET - BE.OFFSET_MIN) * smooth(ot);
    const targetX = player.x + this.side * baseOffset;
    this.x += (targetX - this.x) * (1 - Math.exp(-1.8 * dt));

    if (this.gap <= BE.KILL_GAP) {
      this.gap = BE.KILL_GAP;
      this.killed = true;
      this.killT = 0;
    }
  }

  /** Distance bands driving dread audio + screen encroachment — unchanged. */
  bands() {
    const roar = 1 - clamp(this.gap / BE.ROAR_RANGE, 0, 1);
    const footfall = 1 - clamp(this.gap / BE.FOOTFALL_RANGE, 0, 1);
    const scream = 1 - clamp(this.gap / BE.SCREAM_RANGE, 0, 1);
    const shake = (1 - clamp(this.gap / BE.SHAKE_RANGE, 0, 1)) * BE.SHAKE_MAX;
    return { roar, footfall, scream, shake };
  }
}
