import TUNING from '../TUNING.js';
import { makeRng, mixSeed } from './rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

const PATTERNS = ['cross', 'vault', 'downhill', 'uphill'];

export const SECOND_BEAST_RULES = {
  MIN_DISTANCE: 1600,
  HUNT_CHANCE: 0.30,
  DEEP_CHANCE_BONUS: 0.08,
  MIN_HUNTS_BETWEEN: 2,
  TRIGGER_MIN: 5.0,
  TRIGGER_MAX: 11.5,
  MAX_TRIGGER_DELAY: 3.0,
  SAFE_MAIN_GAP: 15,
  TELL_MIN: 0.78,
  TELL_MAX: 1.08,
  CHARGE_MIN: 2.20,
  CHARGE_MAX: 2.65,
  EXIT_TIME: 1.55,
  COLLIDE_X: 2.25,
  COLLIDE_D: 2.8,
  COLLIDE_Y: 2.65,
  VAULT_LIFT: 5.8,
};

/**
 * Rare second creature. It never rubber-bands behind the runner.
 * It is armed by some main-beast Hunts, commits to one readable world-space
 * ambush, then physically exits the scene. Appearances rotate through a small
 * choreography vocabulary so seeing it again is not the same event mirrored.
 */
export class SecondBeast {
  constructor(seed = 0) {
    this.seed = seed >>> 0;
    this.reset();
  }

  reset() {
    this.rng = makeRng(mixSeed(this.seed || 1, 0x82b2));
    this.active = false;
    this.phase = 'idle';
    this.phaseT = 0;
    this.kind = 'cross';
    this.side = 1;
    this.x = 0;
    this.d = 0;
    this.lift = 0;
    this.heading = 0;
    this.killed = false;
    this.killT = 0;
    this.appearances = 0;
    this.diagonalCount = 0;
    this.vaultCount = 0;
    this.lastSeenHunt = 0;
    this.lastAppearanceHunt = -999;
    this.armedHunt = 0;
    this.triggerAt = Infinity;
    this.tellTime = 0;
    this.chargeTime = 0;
    this.startX = 0;
    this.endX = 0;
    this.startD = 0;
    this.endD = 0;
    this.exitXDir = 1;
    this.exitDDir = 1;
    this.event = null;
    this.lastKind = null;
    this.patternCounts = { cross: 0, vault: 0, downhill: 0, uphill: 0 };
  }

  _depth(player) {
    return clamp(player.d / 18000, 0, 1);
  }

  _chooseKind() {
    let min = Infinity;
    for (const kind of PATTERNS) min = Math.min(min, this.patternCounts[kind] || 0);
    let pool = PATTERNS.filter((kind) => (this.patternCounts[kind] || 0) === min && kind !== this.lastKind);
    if (!pool.length) pool = PATTERNS.filter((kind) => (this.patternCounts[kind] || 0) === min);
    const kind = pool[Math.floor(this.rng.next() * pool.length)] || 'cross';
    this.patternCounts[kind] = (this.patternCounts[kind] || 0) + 1;
    this.lastKind = kind;
    return kind;
  }

  _armHunt(main, player) {
    if (main.hunts === this.lastSeenHunt) return;
    this.lastSeenHunt = main.hunts;
    this.armedHunt = 0;
    this.triggerAt = Infinity;

    if (player.d < SECOND_BEAST_RULES.MIN_DISTANCE) return;
    if (main.hunts - this.lastAppearanceHunt < SECOND_BEAST_RULES.MIN_HUNTS_BETWEEN) return;

    const chance = SECOND_BEAST_RULES.HUNT_CHANCE +
      this._depth(player) * SECOND_BEAST_RULES.DEEP_CHANCE_BONUS;
    if (!this.rng.chance(chance)) return;

    this.armedHunt = main.hunts;
    const latest = Math.max(
      SECOND_BEAST_RULES.TRIGGER_MIN + 0.5,
      Math.min(SECOND_BEAST_RULES.TRIGGER_MAX, main.modeDuration - 5.5)
    );
    this.triggerAt = this.rng.range(SECOND_BEAST_RULES.TRIGGER_MIN, latest);
  }

  _spawn(player, terrain, main) {
    const R = SECOND_BEAST_RULES;
    const half = TUNING.TERRAIN.HALF_WIDTH - 1.0;
    this.active = true;
    this.phase = 'tell';
    this.phaseT = 0;
    this.kind = this._chooseKind();

    // When the runner has committed to an edge, enter from the opposite side.
    // This prevents an appearance from becoming irrelevant because both actors
    // happened to live on opposite margins for the whole encounter.
    this.side = Math.abs(player.x) > 3.5
      ? (player.x < 0 ? 1 : -1)
      : (this.rng.chance(0.5) ? -1 : 1);

    this.tellTime = this.rng.range(R.TELL_MIN, R.TELL_MAX);
    this.chargeTime = this.rng.range(R.CHARGE_MIN, R.CHARGE_MAX);

    // Freeze the interception line at tell time. None of the four patterns home
    // after the player once the warning appears.
    const projectedX = clamp(player.x + player.heading * 8.0, -half + 3, half - 3);
    const corridor = typeof terrain.corridorX === 'function'
      ? terrain.corridorX(player.d + 70)
      : 0;
    const targetX = clamp(projectedX * 0.82 + corridor * 0.18, -half + 3, half - 3);

    if (this.kind === 'cross') {
      const interceptD = player.d + clamp(player.speed * 1.35, 38, 58);
      this.startX = this.side * (half - 0.5);
      this.endX = -this.side * (half + 4.5);
      this.startD = interceptD - 12;
      this.endD = interceptD + 9;
      this.chargeTime = this.rng.range(2.18, 2.48);
    } else if (this.kind === 'vault') {
      this.startX = clamp(targetX + this.side * 18, -half, half);
      this.endX = clamp(targetX - this.side * 11, -half, half);
      this.startD = player.d + this.rng.range(40, 46);
      this.endD = this.startD + this.rng.range(52, 60);
      this.chargeTime = this.rng.range(2.28, 2.62);
    } else if (this.kind === 'downhill') {
      this.startX = this.side * (half - 2.0);
      this.endX = clamp(targetX - this.side * 5.0, -half, half);
      this.startD = player.d + this.rng.range(18, 25);
      this.endD = this.startD + this.rng.range(72, 82);
      this.chargeTime = this.rng.range(2.18, 2.46);
    } else {
      // Head-on/uphill pass: starts deep in the player's sightline and drives
      // back toward camera, crossing the frozen projected line on the way.
      this.startX = clamp(targetX + this.side * 12.0, -half, half);
      this.endX = clamp(targetX - this.side * 4.0, -half, half);
      this.startD = player.d + this.rng.range(62, 72);
      this.endD = player.d + this.rng.range(-8, 4);
      this.chargeTime = this.rng.range(2.24, 2.54);
    }

    this.exitXDir = Math.sign(this.endX - this.startX) || -this.side;
    this.exitDDir = Math.sign(this.endD - this.startD) || 1;
    this.x = this.startX;
    this.d = this.startD;
    this.lift = -1.35;
    this.heading = 0;
    this.appearances++;
    if (this.kind === 'vault') this.vaultCount++;
    else this.diagonalCount++;
    this.lastAppearanceHunt = main.hunts;
    this.armedHunt = 0;

    this.event = {
      t: 'second_beast_enter', kind: this.kind, side: this.side,
      x: this.x, y: terrain.heightAt(this.x, this.d), d: this.d,
    };
  }

  _finish() {
    this.active = false;
    this.phase = 'idle';
    this.phaseT = 0;
    this.lift = 0;
  }

  /** One deterministic step. Returns a transient event object or null. */
  step(dt, player, main, terrain) {
    const R = SECOND_BEAST_RULES;
    this.event = null;
    if (this.killed) {
      this.killT += dt;
      return null;
    }

    // Hunts may ARM an encounter, but once Beast Two has entered the world it
    // finishes its own choreography even if the black beast's Hunt ends. This
    // prevents mid-appearance fades and makes every tell a trustworthy promise.
    if (!this.active) {
      if (main.mode === 'hunt') {
        this._armHunt(main, player);
        if (this.armedHunt === main.hunts && main.modeT >= this.triggerAt) {
          const tooClose = main.gap < R.SAFE_MAIN_GAP;
          const expired = main.modeT >= this.triggerAt + R.MAX_TRIGGER_DELAY;
          if (!tooClose) this._spawn(player, terrain, main);
          else if (expired) {
            this.armedHunt = 0;
            this.triggerAt = Infinity;
          }
        }
      } else {
        this.armedHunt = 0;
        this.triggerAt = Infinity;
      }
    }

    if (!this.active) return this.event;

    this.phaseT += dt;
    const ground = terrain.heightAt(this.x, this.d);

    if (this.phase === 'tell') {
      const e = smooth01(this.phaseT / Math.max(0.01, this.tellTime));
      this.lift = lerp(-1.35, -0.08, e);
      if (this.phaseT >= this.tellTime) {
        this.phase = 'charge';
        this.phaseT = 0;
        this.lift = 0;
        this.event = {
          t: 'second_beast_charge', kind: this.kind, side: this.side,
          x: this.x, y: ground, d: this.d,
        };
      }
      return this.event;
    }

    if (this.phase === 'charge') {
      const e = clamp(this.phaseT / Math.max(0.01, this.chargeTime), 0, 1);
      const se = smooth01(e);
      const prevX = this.x;
      const prevD = this.d;
      this.x = lerp(this.startX, this.endX, se);
      this.d = lerp(this.startD, this.endD, e);
      const stepD = this.d - prevD;
      const signedD = Math.abs(stepD) < 0.001 ? (stepD < 0 ? -0.001 : 0.001) : stepD;
      this.heading = Math.atan2(this.x - prevX, signedD);

      if (this.kind === 'vault') {
        this.lift = Math.sin(e * Math.PI) * R.VAULT_LIFT;
      } else if (this.kind === 'downhill') {
        this.lift = Math.sin(e * Math.PI) * 2.7;
      } else if (this.kind === 'uphill') {
        this.lift = Math.sin(e * Math.PI) * 1.25;
      } else {
        this.lift = Math.sin(e * Math.PI) * 0.55;
      }

      // Contact is world-space and 3D. High air can genuinely clear a vault;
      // moving off the committed line genuinely dodges every other pattern.
      if (e > 0.10 && e < 0.98) {
        const beastGround = terrain.heightAt(this.x, this.d);
        const beastCentreY = beastGround + this.lift + 1.45;
        const playerCentreY = player.y + 0.95;
        if (
          Math.abs(player.x - this.x) <= R.COLLIDE_X &&
          Math.abs(player.d - this.d) <= R.COLLIDE_D &&
          Math.abs(playerCentreY - beastCentreY) <= R.COLLIDE_Y
        ) {
          this.killed = true;
          this.killT = 0;
          this.phase = 'kill';
          this.event = {
            t: 'second_beast_kill', kind: this.kind, side: this.side,
            x: this.x, y: beastGround + this.lift, d: this.d,
          };
          return this.event;
        }
      }

      if (e >= 1) {
        this.phase = 'exit';
        this.phaseT = 0;
        this.lift = 0;
      }
      return this.event;
    }

    if (this.phase === 'exit') {
      const e = smooth01(this.phaseT / R.EXIT_TIME);
      const xSpeed = this.kind === 'cross' ? 25 : 18;
      const dSpeed = this.kind === 'uphill' ? 23 : 20;
      this.x += this.exitXDir * dt * xSpeed;
      this.d += this.exitDDir * dt * dSpeed;
      // Never dissolve downward into the snow. A miss keeps moving along the
      // committed vector until it is outside the piste / swallowed by distance.
      this.lift = lerp(0, this.kind === 'vault' ? 1.2 : 0.25, e);
      const outOfBounds = Math.abs(this.x) > TUNING.TERRAIN.HALF_WIDTH + 8;
      const inDistance = Math.abs(this.d - player.d) > 145;
      if (this.phaseT >= R.EXIT_TIME || outOfBounds || inDistance) this._finish();
    }

    return this.event;
  }
}

/** Main beast keeps sustained pursuit and side pressure; scripted shortcuts move to beast two. */
export function applyTwoBeastSplit(Beast) {
  const proto = Beast.prototype;
  if (proto.__rc82Split) return;
  proto.__rc82Split = true;

  proto._startHunt = function startHuntRC82(player) {
    const depth = clamp(player.d / 18000, 0, 1);
    this.mode = 'hunt';
    this.modeT = 0;
    this.attackT = 0;
    this.hunts++;
    this.modeDuration = this._rand(22 + depth * 2.5, 32 + depth * 6.0);

    this.attackKind = this.rng.next() < 0.28 ? 'side' : 'rear';
    if (this.attackKind === 'side') this.side = this.rng.next() < 0.5 ? -1 : 1;

    this.airPounce = false;
    this.lunge = 'idle';
    this.lungeT = 0;
    this.lungeCooldown = 2.35;
  };
}

export default SecondBeast;
