/**
 * Beast — a persistent rival, not a countdown.
 *
 * RC4 rhythm: STALK -> HUNT -> RELIEF. The beast is present from the start,
 * but commits in readable attacks. Great air and GO can win an exchange and
 * buy actual mountain back; raw distance never flips a mandatory-death switch.
 */

import TUNING from '../TUNING.js';
import { makeRng, mixSeed } from './rng.js';
import { CHASE, applyReleaseTuning } from '../design/release-tuning.js';

applyReleaseTuning(TUNING);

const BE = TUNING.BEAST;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

export const LUNGE = { IDLE: 'idle', TELL: 'tell', STRIKE: 'strike', RECOVER: 'recover' };
export const CHASE_MODE = { STALK: 'stalk', HUNT: 'hunt', RELIEF: 'relief' };

export class Beast {
  constructor(seed = 0) {
    this.seed = seed >>> 0;
    this.side = (seed & 1) ? 1 : -1;
    this.reset();
  }

  _rand(lo, hi) { return lo + (hi - lo) * this.rng.next(); }
  _depth(player) { return clamp(player.d / CHASE.DEEP_DISTANCE, 0, 1); }
  get d() { return this._playerD - this.gap; }

  reset() {
    this.rng = makeRng(mixSeed(this.seed || 1, 0x1a06));
    this.gap = BE.START_GAP;
    this.avgSpeed = TUNING.PLAYER.START_SPEED;
    this.mistakePressure = 0;
    this.desired = BE.START_GAP;
    this.killed = false;
    this.killT = 0;
    this.x = 0;
    this.t = 0;
    this.grace = 0;
    this._pushTail = 0;

    this.lunge = LUNGE.IDLE;
    this.lungeT = 0;
    this.lungeCooldown = 3.5;
    this._rollAcc = 0;
    this.lunges = 0;

    this.mode = CHASE_MODE.STALK;
    this.modeT = 0;
    this.modeDuration = this._rand(CHASE.FIRST_HUNT_MIN, CHASE.FIRST_HUNT_MAX);
    this.hunts = 0;
    this.escapes = 0;
    this.attackKind = 'rear';
    this.attackT = 0;
  }

  wakefulness() {
    if (this.grace <= 0) return 1;
    const linear = clamp(1 - this.t / BE.GRACE_TIME, 0, 1);
    return 1 - Math.pow(linear, BE.GRACE_FADE_EXP) * this.grace;
  }

  registerMistake(n = 1) {
    this.mistakePressure = Math.min(
      BE.MISTAKE_PRESSURE_CAP,
      this.mistakePressure + BE.MISTAKE_PRESSURE_PER * n
    );
  }

  _startHunt(player) {
    const depth = this._depth(player);
    this.mode = CHASE_MODE.HUNT;
    this.modeT = 0;
    this.attackT = 0;
    this.hunts++;
    this.modeDuration = this._rand(
      CHASE.HUNT_MIN + depth * 1.5,
      CHASE.HUNT_MAX + depth * 2.5
    );

    this.attackKind = this.rng.next() < 0.34 ? 'side' : 'rear';
    if (this.attackKind === 'side') this.side = this.rng.next() < 0.5 ? -1 : 1;

    // No gap snap here. The beast must visibly close the distance it wants.
    this.lunge = LUNGE.IDLE;
    this.lungeT = 0;
    this.lungeCooldown = 2.5;
  }

  _beginRelief(player, earned = false) {
    const depth = this._depth(player);
    this.mode = CHASE_MODE.RELIEF;
    this.modeT = 0;
    this.modeDuration = this._rand(
      Math.max(7, CHASE.RELIEF_MIN - depth * 4),
      Math.max(10, CHASE.RELIEF_MAX - depth * 5)
    );
    this.escapes++;
    this.lunge = LUNGE.RECOVER;
    this.lungeT = 0;
    this.lungeCooldown = Math.max(this.lungeCooldown, 3.5);
    this.mistakePressure *= earned ? 0.25 : 0.45;
  }

  /** Clean authored air visibly throws the pursuer back and ends the attack. */
  stuntShove(metres) {
    if (this.killed || !Number.isFinite(metres) || metres <= 0) return 0;
    const before = this.gap;
    const bonus = this.mode === CHASE_MODE.HUNT ? CHASE.ESCAPE_BONUS : 0;
    this.gap = Math.min(BE.MAX_GAP, this.gap + metres + bonus);
    if (this.mode === CHASE_MODE.HUNT) {
      this.mode = CHASE_MODE.RELIEF;
      this.modeT = 0;
      this.modeDuration = this._rand(CHASE.RELIEF_MIN, CHASE.RELIEF_MAX);
      this.escapes++;
      this.mistakePressure *= 0.25;
      this.lunge = LUNGE.RECOVER;
      this.lungeT = 0;
    }
    this.lungeCooldown = Math.max(this.lungeCooldown, 3.0);
    return this.gap - before;
  }

  proximityMult() {
    if (this.gap >= TUNING.BOOST.PROX_RANGE) return 1;
    const t = 1 - clamp(this.gap / TUNING.BOOST.PROX_RANGE, 0, 1);
    return 1 + t * (TUNING.BOOST.PROX_MAX_MULT - 1);
  }

  _advanceRhythm(dt, player) {
    this.modeT += dt;
    const depth = this._depth(player);

    if (this.mode === CHASE_MODE.HUNT) {
      this.attackT += dt;
      // Spending enough GO to push the beast back ends the exchange.
      if (player.overdrive && this.gap >= CHASE.ESCAPE_GAP) {
        this._beginRelief(player, true);
        return;
      }
      if (this.modeT >= this.modeDuration) this._beginRelief(player, false);
      return;
    }

    if (this.mode === CHASE_MODE.RELIEF) {
      if (this.modeT >= this.modeDuration) {
        this.mode = CHASE_MODE.STALK;
        this.modeT = 0;
        this.modeDuration = this._rand(7, 12) * lerp(1, 0.72, depth);
      }
      return;
    }

    const provoked = this.t > 8 && this.mistakePressure >= CHASE.MISTAKE_HUNT_THRESHOLD;
    if (provoked || this.modeT >= this.modeDuration) this._startHunt(player);
  }

  step(dt, player) {
    this._playerD = player.d;
    if (this.killed) { this.killT += dt; return; }
    this.t += dt;

    this._advanceRhythm(dt, player);
    this._lunge(dt);

    const speedK = 1 - Math.exp(-dt / BE.AVG_SPEED_TAU);
    this.avgSpeed += (player.speed - this.avgSpeed) * speedK;
    this.mistakePressure = Math.max(0, this.mistakePressure - BE.MISTAKE_PRESSURE_DECAY * dt);

    const sn = clamp(
      (this.avgSpeed - BE.SPEED_REF_LO) / (BE.SPEED_REF_HI - BE.SPEED_REF_LO), 0, 1
    );
    const depth = this._depth(player);
    const asleep = 1 - this.wakefulness();

    let desired;
    if (this.mode === CHASE_MODE.HUNT) {
      desired = lerp(CHASE.HUNT_GAP_EASY, CHASE.HUNT_GAP_DEEP, depth) + sn * 11;
      desired -= this.mistakePressure * 9;
      desired += BE.GRACE_GAP * asleep * 0.35;
      desired = clamp(desired, 8, 48);
    } else if (this.mode === CHASE_MODE.RELIEF) {
      desired = lerp(86, 76, depth) + sn * 8;
    } else {
      desired = lerp(CHASE.STALK_GAP_MAX, CHASE.STALK_GAP_MIN, depth) + sn * 8;
      desired -= this.mistakePressure * 5;
      desired += BE.GRACE_GAP * asleep * 0.5;
    }

    this.desired = clamp(desired, BE.DESIRED_FLOOR, BE.MAX_GAP);
    const delta = this.desired - this.gap;
    let closeRate = BE.CLOSE_RATE;
    let openRate = BE.OPEN_RATE;
    if (this.mode === CHASE_MODE.HUNT) closeRate *= 1 + depth * 0.32;
    else openRate *= 1.12;
    const maxStep = (delta > 0 ? openRate : closeRate) * dt;
    this.gap += clamp(delta, -maxStep, maxStep);

    if (player.overdrive) this._pushTail = BE.OVERDRIVE_PUSH_TAIL;
    if (this._pushTail > 0) {
      const fade = Math.min(1, this._pushTail / BE.OVERDRIVE_PUSH_TAIL);
      this.gap += BE.OVERDRIVE_PUSH * fade * dt;
      this._pushTail = Math.max(0, this._pushTail - dt);
    }

    if (this.mode === CHASE_MODE.HUNT && this.lunge === LUNGE.STRIKE) this.gap -= BE.LUNGE_RATE * dt;
    else if (this.lunge === LUNGE.RECOVER) this.gap += BE.LUNGE_RECOVER_RATE * dt;
    this.gap = Math.min(this.gap, BE.MAX_GAP);

    const ot = clamp(
      (this.gap - BE.OFFSET_FADE_NEAR) / (BE.OFFSET_FADE_FAR - BE.OFFSET_FADE_NEAR), 0, 1
    );
    const baseOffset = BE.OFFSET_MIN + (BE.APPROACH_OFFSET - BE.OFFSET_MIN) * smooth(ot);
    let targetX = player.x + this.side * baseOffset;

    if (this.mode === CHASE_MODE.HUNT && this.attackKind === 'side' && this.attackT < CHASE.SIDE_ENTRY_TIME) {
      const e = smooth(this.attackT / CHASE.SIDE_ENTRY_TIME);
      targetX = player.x + this.side * lerp(CHASE.SIDE_ENTRY_X, baseOffset, e);
    }

    const lat = 1 - Math.exp(-(this.mode === CHASE_MODE.HUNT ? 2.4 : 1.35) * dt);
    this.x += (targetX - this.x) * lat;

    if (this.gap <= BE.KILL_GAP) {
      this.gap = BE.KILL_GAP;
      this.killed = true;
      this.killT = 0;
    }
  }

  _lunge(dt) {
    if (this.mode !== CHASE_MODE.HUNT && this.lunge === LUNGE.IDLE) {
      this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);
      return;
    }

    this.lungeT += dt;
    switch (this.lunge) {
      case LUNGE.TELL:
        if (this.lungeT >= BE.LUNGE_TELL) { this.lunge = LUNGE.STRIKE; this.lungeT = 0; }
        break;
      case LUNGE.STRIKE:
        if (this.lungeT >= BE.LUNGE_TIME) { this.lunge = LUNGE.RECOVER; this.lungeT = 0; }
        break;
      case LUNGE.RECOVER:
        if (this.lungeT >= BE.LUNGE_RECOVER) {
          this.lunge = LUNGE.IDLE;
          this.lungeT = 0;
          this.lungeCooldown = BE.LUNGE_COOLDOWN;
        }
        break;
      default:
        this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);
        this._rollAcc += dt;
        while (this._rollAcc >= 1) {
          this._rollAcc -= 1;
          if (this.mode !== CHASE_MODE.HUNT || this.lungeCooldown > 0) continue;
          if (this.gap < BE.LUNGE_MIN_GAP || this.gap > BE.LUNGE_MAX_GAP) continue;
          if (this.wakefulness() < 0.8) continue;
          if (this.rng.next() < BE.LUNGE_CHANCE_PER_S) {
            this.lunge = LUNGE.TELL;
            this.lungeT = 0;
            this.lunges++;
            break;
          }
        }
    }
  }

  bands() {
    const roarRange = Math.max(BE.ROAR_RANGE, 94);
    const footRange = Math.max(BE.FOOTFALL_RANGE, 38);
    const huntMix = this.mode === CHASE_MODE.HUNT ? 1 : 0.55;
    return {
      roar: clamp(1 - this.gap / roarRange, 0, 1) * huntMix,
      footfall: clamp(1 - this.gap / footRange, 0, 1),
      scream: clamp(1 - this.gap / BE.SCREAM_RANGE, 0, 1),
      shake: clamp(1 - this.gap / BE.SHAKE_RANGE, 0, 1) * BE.SHAKE_MAX,
    };
  }
}
