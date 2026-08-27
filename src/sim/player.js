/**
 * Player — carving, speed, air, tricks and collisions.
 * Fixed 60hz; deterministic; no renderer dependencies.
 */

import TUNING from '../TUNING.js';

const P = TUNING.PLAYER;
const A = TUNING.AIR;
const B = TUNING.BOOST;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const TAU = Math.PI * 2;

function wrapPi(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

export class Player {
  constructor(terrain) {
    this.terrain = terrain;
    this.reset();
  }

  reset() {
    this.x = 0;
    this.d = 0;
    this.speed = P.START_SPEED;
    this.heading = 0;
    this.carveTarget = 0;
    this.y = this.terrain.heightAt(0, 0);
    this._xPrev = 0;
    this._dPrev = 0;
    this.airborne = false;
    this.hangtime = 0;
    this.airStartY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.spinTotal = 0;
    this.flipTotal = 0;
    this.settle = 0;
    this.staggerT = 0;
    this.onIce = false;
    this.inPowder = false;
    this.boostMeter = 0;
    this.boostSpent = 0;
    this.overdrive = false;
    this.overdriveT = 0;
    this.tricksLanded = 0;
    this.tricksFlubbed = 0;
    this.obstaclesHit = 0;
    this.gatesThreaded = 0;
    this.chain = 0;
    this.bestChain = 0;
    this.lastCourage = 1;
    this.lastLanding = null;
    this._gatesSeen = new Set();
    this._hitCooldown = 0;
    this.dead = false;
    this.vy = this._groundVy();
  }

  chainMult() {
    return 1 + Math.min(this.chain, B.CHAIN_CAP) * B.CHAIN_STEP;
  }

  _breakChain(events) {
    if (this.chain > 0) {
      events?.push({ t: 'chain_lost', chain: this.chain, mult: this.chainMult() });
      this.chain = 0;
    }
  }

  _groundVy() {
    const dt = TUNING.SIM.DT;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nd = this.d + Math.cos(this.heading) * this.speed * dt;
    return (this.terrain.heightAt(nx, nd) - this.terrain.heightAt(this.x, this.d)) / dt;
  }

  get grounded() { return !this.airborne; }

  step(dt, input, proxMult, events) {
    if (this.dead) return;
    this._hitCooldown = Math.max(0, this._hitCooldown - dt);
    if (this.staggerT > 0) this.staggerT = Math.max(0, this.staggerT - dt);
    if (this.settle > 0) this.settle = Math.max(0, this.settle - dt);
    this.onIce = !this.airborne && this.terrain.isIce(this.x, this.d);
    this._xPrev = this.x;
    this._dPrev = this.d;
    this._steer(dt, input);
    this._overdrive(dt, input, events);
    this._speed(dt);
    this._move(dt);
    this._vertical(dt, input, proxMult, events);
    this._collide(events);
    this._gates(events);
  }

  _steer(dt, input) {
    if (this.airborne) {
      const spinRate = input.carve * A.SPIN_RATE;
      const flipRate = input.flip * A.FLIP_RATE;
      this.yaw += spinRate * dt;
      this.pitch += flipRate * dt;
      this.spinTotal += Math.abs(spinRate) * dt;
      this.flipTotal += Math.abs(flipRate) * dt;
      this.heading *= Math.exp(-dt / A.HEADING_BLEED_TAU);
      this.carveTarget = 0;
      return;
    }

    let authority = 1;
    if (this.staggerT > 0) authority *= P.STAGGER_CARVE_SCALE;
    if (this.overdrive) authority *= B.CARVE_SCALE;
    this.carveTarget = clamp(input.carve, -1, 1) * P.MAX_CARVE * authority;
    const response = this.onIce ? P.ICE_RESPONSE : P.CARVE_RESPONSE;
    const k = 1 - Math.exp(-response * dt);
    this.heading += (this.carveTarget - this.heading) * k;
  }

  _overdrive(dt, input, events) {
    const want = !!input.boostHeld && !this.airborne;
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

  _speed(dt) {
    const tuck = Math.max(0, Math.cos(this.heading));
    let target = P.SPEED_CARVE_MIN +
      (P.SPEED_TUCK - P.SPEED_CARVE_MIN) * Math.pow(tuck, P.TUCK_EXP);

    const gm = this.terrain.gradeMul ? this.terrain.gradeMul(this.d) : 1;
    target *= 1 + (gm - 1) * P.GRADE_SPEED_GAIN;
    if (this.overdrive) target *= B.SPEED_MULT;
    if (this.staggerT > 0) target *= 0.55;
    if (this.airborne) target = this.speed;

    let rate = target > this.speed ? P.ACCEL : P.DECEL;
    if (this.overdrive && target > this.speed) rate *= B.ACCEL_MULT;
    if (target > this.speed) this.speed = Math.min(target, this.speed + rate * dt);
    else this.speed = Math.max(target, this.speed - rate * dt);

    // Off-piste is a soft failure state, not a secret elevated highway. The
    // farther up the bank you climb, the more the snow kills speed, erases the
    // outward heading and feeds you back toward the piste. This keeps the goofy
    // bank shape while removing the permanent wall-ride exploit.
    this.inPowder = Math.abs(this.x) > TUNING.TERRAIN.POWDER_X;
    if (this.inPowder && !this.airborne) {
      const over = Math.abs(this.x) - TUNING.TERRAIN.POWDER_X;
      const bankSpan = Math.max(1, TUNING.TERRAIN.HALF_WIDTH - TUNING.TERRAIN.POWDER_X);
      const severity = clamp(over / bankSpan, 0, 1.6);
      const drag = P.POWDER_DRAG * (0.45 + severity * 1.45);
      this.speed -= drag * dt;

      const inward = -Math.sign(this.x) * P.MAX_CARVE * 0.34;
      const turnK = 1 - Math.exp(-(2.2 + severity * 5.5) * dt);
      this.heading += (inward - this.heading) * turnK;

      const push = P.POWDER_PUSHBACK * (1 + severity * 4.2);
      this.x -= Math.sign(this.x) * push * dt;
    }

    this.speed = Math.max(P.SPEED_FLOOR, this.speed);
  }

  _move(dt) {
    this.d += this.speed * Math.cos(this.heading) * dt;
    this.x += this.speed * Math.sin(this.heading) * dt;
    // Leave enough shoulder for recoveries, but never let the bank become a
    // stable top surface outside the rendered piste.
    const lim = TUNING.TERRAIN.HALF_WIDTH + 1.25;
    this.x = clamp(this.x, -lim, lim);
  }

  _vertical(dt, input, proxMult, events) {
    const groundNow = this.terrain.heightAt(this.x, this.d);
    const groundPrev = this.terrain.heightAt(this._xPrev, this._dPrev);
    const vyGround = (groundNow - groundPrev) / dt;

    if (!this.airborne) {
      if (input.jump && this.staggerT <= 0) {
        this.vy = vyGround + P.JUMP_IMPULSE;
        this.y = groundNow;
        this._takeoff(groundNow, events);
        return;
      }
      const vyBallistic = this.vy - P.GRAVITY * dt;
      const yBallistic = this.y + vyBallistic * dt;
      if (yBallistic > groundNow + P.AIR_LAUNCH_EPS) {
        this.vy = vyBallistic;
        this.y = yBallistic;
        this._takeoff(groundNow, events);
      } else {
        this.vy = vyGround;
        this.y = groundNow;
      }
      return;
    }

    this.vy -= P.GRAVITY * dt;
    this.y += this.vy * dt;
    this.hangtime += dt;
    if (this.y <= groundNow) {
      this.y = groundNow;
      this._land(proxMult, events, vyGround);
    }
  }

  _takeoff(groundY, events) {
    this.airborne = true;
    this.hangtime = 0;
    this.airStartY = groundY;
    this.yaw = 0;
    this.pitch = 0;
    this.spinTotal = 0;
    this.flipTotal = 0;
    events?.push({ t: 'takeoff', x: this.x, y: this.y, d: this.d });
  }

  _land(proxMult, events, vyGround) {
    const hang = this.hangtime;
    this.airborne = false;
    this.hangtime = 0;

    if (hang < A.MIN_TRICK_TIME) {
      this.yaw = 0;
      this.pitch = 0;
      this.vy = vyGround;
      events?.push({ t: 'land_bump', x: this.x, y: this.y, d: this.d });
      return;
    }

    const yawErr = Math.abs(wrapPi(this.yaw));
    const pitchErr = Math.abs(wrapPi(this.pitch));
    const clean = yawErr < A.CLEAN_YAW && pitchErr < A.CLEAN_PITCH;
    const turns = Math.min(B.ROT_CAP, (this.spinTotal + this.flipTotal) / TAU);
    const rotFactor = 1 + turns * B.ROT_BONUS;
    const chainMult = this.chainMult();
    const fill = hang * rotFactor * proxMult * chainMult * B.FILL_RATE;
    this.lastCourage = proxMult;

    if (clean) {
      this.tricksLanded++;
      this.chain++;
      if (this.chain > this.bestChain) this.bestChain = this.chain;
      this.boostMeter = Math.min(B.METER_MAX, this.boostMeter + fill);
      this.speed = Math.min(this.speed + P.CLEAN_SPEED_BONUS, P.SPEED_TUCK * B.SPEED_MULT);
    } else {
      this.tricksFlubbed++;
      this.staggerT = P.STAGGER_TIME;
      this.speed *= 1 - P.FLUB_SPEED_COST;
      this.boostMeter *= 1 - B.FLUB_METER_LOSS;
      if (this.boostMeter < B.MIN_ACTIVATE * 0.25) this.boostMeter = 0;
      this._breakChain(events);
    }

    this.lastLanding = {
      clean, hangtime: hang, turns, fill: clean ? fill : 0,
      proxMult, chainMult, chain: this.chain,
    };
    this.settle = A.SETTLE_TIME;
    this.yaw = wrapPi(this.yaw);
    this.pitch = wrapPi(this.pitch);
    this.vy = vyGround;
    events?.push({
      t: clean ? 'land_clean' : 'land_flub',
      fill: clean ? fill : 0, turns, hang,
      proxMult, chain: this.chain, chainMult,
      x: this.x, y: this.y, d: this.d,
    });
  }

  _collide(events) {
    if (this._hitCooldown > 0) return;
    const near = this.terrain.collidersNear(this.d, 3, 3);
    for (const c of near) {
      const dx = this.x - c.x;
      const dd = this.d - c.d;
      const rr = c.r + 0.55;
      if (dx * dx + dd * dd > rr * rr) continue;
      const groundAt = this.terrain.heightAt(c.x, c.d);
      if (this.airborne && this.y > groundAt + c.h) continue;

      this.obstaclesHit++;
      this.speed *= 1 - P.HIT_SPEED_COST;
      this.staggerT = P.STAGGER_TIME;
      this._hitCooldown = 0.35;
      this._breakChain(events);
      if (this.airborne) {
        this.airborne = false;
        this.hangtime = 0;
        this.y = this.terrain.heightAt(this.x, this.d);
        this.vy = this._groundVy();
        this.yaw = 0;
        this.pitch = 0;
        this.boostMeter *= 1 - B.FLUB_METER_LOSS;
      }
      events?.push({ t: 'hit', kind: c.type, x: this.x, y: this.y, d: this.d });
      return;
    }
  }

  _gates(events) {
    for (const g of this.terrain.gatesNear(this.d, 1.5, 1.5)) {
      if (this._gatesSeen.has(g.id)) continue;
      if (Math.abs(this.d - g.d) > 1.2) continue;
      if (Math.abs(this.x - g.x) < g.halfSpan - 0.4) {
        this._gatesSeen.add(g.id);
        this.gatesThreaded++;
        if (this.speed < P.GATE_MAX_BONUS_SPEED) {
          this.speed = Math.min(P.GATE_MAX_BONUS_SPEED, this.speed + P.GATE_SPEED_BONUS);
        }
        if (B.CHAIN_GATE_CREDIT) {
          this.chain++;
          if (this.chain > this.bestChain) this.bestChain = this.chain;
        }
        events?.push({
          t: 'gate', chain: this.chain, chainMult: this.chainMult(),
          x: this.x, y: this.y, d: this.d,
        });
      } else if (Math.abs(this.d - g.d) < 0.8) {
        this._gatesSeen.add(g.id);
      }
    }
  }
}

export { wrapPi };
