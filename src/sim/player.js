/**
 * Player — DICTION DASH Phase 7: the runner on a flat winding track.
 *
 * Movement is the track's business, not the thumb's: the runner auto-follows
 * the authored centerline through every turn, so the game keeps exactly one
 * input — the tap that judges a word. Speed is a direct consequence of
 * reading (word-gates.js applies the deltas from TUNING.RUN); nothing here
 * accelerates or brakes on its own. Overdrive still multiplies pace while
 * the meter drains, which is what makes banked boost worth something.
 *
 * The class keeps the field and method surface the frame's patch layers
 * expect (reset/_collide/chainMult, the trick-era flags now permanently
 * false), fixed 60hz, deterministic, no renderer dependencies.
 */

import TUNING from '../TUNING.js';

const R = TUNING.RUN;
const B = TUNING.BOOST;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Player {
  constructor(terrain) {
    this.terrain = terrain;
    this.reset();
  }

  reset() {
    this.x = this.terrain.corridorX ? this.terrain.corridorX(0) : 0;
    this.d = 0;
    this.speed = R.START_SPEED;
    this.effSpeed = R.START_SPEED;
    this.heading = 0;
    this.y = 0;
    this.vy = 0;

    // Trick-era surface, permanently at rest on a flat track.
    this.airborne = false;
    this.hangtime = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.spinTotal = 0;
    this.flipTotal = 0;
    this.onIce = false;
    this.inPowder = false;
    this.tricksLanded = 0;
    this.tricksFlubbed = 0;
    this.lastLanding = null;

    this.staggerT = 0;
    this.boostMeter = 0;
    this.boostSpent = 0;
    this.overdrive = false;
    this.overdriveT = 0;
    this.obstaclesHit = 0;
    this.gatesThreaded = 0;
    this.chain = 0;
    this.bestChain = 0;
    // Calibration ledger (Phase 21): the highest speed this run actually
    // reached, so a pasted stats export can answer whether the ceiling is
    // ever approached rather than only whether it is set.
    this.peakSpeed = R.START_SPEED;
    // Phase 25: score accrues in the fixed-step sim so it is deterministic,
    // ghost-comparable and identical for everyone on the same seed.
    this.score = 0;
    this.lastCourage = 1;
    this.dead = false;
    this._hitCooldown = 0;
  }

  chainMult() {
    return 1 + Math.min(this.chain, B.CHAIN_CAP) * B.CHAIN_STEP;
  }

  /** Kept for the contact patch layers; a flat empty track never collides. */
  _collide() {}

  _overdrive(dt, input, events) {
    const want = !!input.boostHeld;
    if (want && !this.overdrive && this.boostMeter >= B.MIN_ACTIVATE) {
      this.overdrive = true;
      this.overdriveT = 0;
      events?.push({ t: 'overdrive_on' });
    }
    if (this.overdrive) {
      if (!want || this.boostMeter <= 0) {
        this.overdrive = false;
        events?.push({ t: 'overdrive_off' });
      } else {
        const drain = Math.min(this.boostMeter, B.DRAIN_RATE * dt);
        this.boostMeter -= drain;
        this.boostSpent += drain;
        this.overdriveT += dt;
      }
    }
  }

  step(dt, input, proxMult = 1, events = null) {
    if (this.dead) return;

    this._overdrive(dt, input, events);

    // Speed holds between reads; Overdrive multiplies it while spending.
    this.effSpeed = this.speed * (this.overdrive ? B.SPEED_MULT : 1);
    this.d += this.effSpeed * dt;

    // Auto-follow: settle onto the centerline a few metres ahead, and lean
    // with the curve — the turn is the track's, the thumb stays on words.
    const target = this.terrain.corridorX(this.d + R.FOLLOW_AHEAD);
    const k = 1 - Math.exp(-R.FOLLOW_RESPONSE * dt);
    this.x += (target - this.x) * k;
    const slope = this.terrain.corridorSlope
      ? this.terrain.corridorSlope(this.d) : 0;
    this.heading = Math.atan(slope);

    this.y = this.terrain.heightAt(this.x, this.d);

    if (this.staggerT > 0) this.staggerT = Math.max(0, this.staggerT - dt);
    if (this._hitCooldown > 0) this._hitCooldown = Math.max(0, this._hitCooldown - dt);
  }
}
