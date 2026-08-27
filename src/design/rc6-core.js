import { airBeatsBetween, AIR_BEAT_RULES } from './air-beats.js';
import { CHASE } from './release-tuning.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const window01 = (d, centre, half) => smooth01(1 - Math.abs(d - centre) / half);

// These are deliberately sparse, readable behaviours. A landmark should change
// the problem without introducing a new control scheme or another UI system.
function specialHeight(x, d) {
  let h = 0;

  // HALFPIPE — the visual walls are now backed by the actual collision surface.
  const pipe = window01(d, 1810, 118);
  if (pipe > 0) {
    const side = clamp((Math.abs(x) - 7.8) / 10.2, 0, 1);
    h += pipe * side * side * 5.8;
  }

  // THE THROAT — a tighter, taller chute that physically funnels the run.
  const throat = window01(d, 3020, 145);
  if (throat > 0) {
    const side = clamp((Math.abs(x) - 8.9) / 8.2, 0, 1);
    h += throat * side * side * 4.4;
  }

  return h;
}

function patchTerrain(Terrain, TUNING) {
  const proto = Terrain.prototype;
  if (proto.__rc6Patched) return;
  proto.__rc6Patched = true;

  const baseHeightsOf = proto.heightsOf;
  proto.heightsOf = function heightsOfRC6(ci) {
    const h = baseHeightsOf.call(this, ci);
    if (h.__rc6Authored) return h;

    const d0 = ci * TUNING.TERRAIN.CHUNK_LEN;
    const d1 = d0 + TUNING.TERRAIN.CHUNK_LEN;
    const beats = airBeatsBetween(this.seed, d0, d1);

    for (const beat of beats) {
      if (beat.d <= TUNING.FEATURES.SAFE_START) continue;

      // Do not stack a random cliff on top of the authored launch.
      for (let i = h.length - 1; i >= 0; i--) {
        const f = h[i];
        if (f.type === 'cliff' && !f.authored && Math.abs(f.d - beat.d) < 76) h.splice(i, 1);
      }

      const halfX = beat.halfX;
      const cx = clamp(
        this.corridorX(beat.d) + beat.side * AIR_BEAT_RULES.SIDE_OFFSET,
        -TUNING.TERRAIN.HALF_WIDTH + halfX + 0.6,
        TUNING.TERRAIN.HALF_WIDTH - halfX - 0.6
      );
      h.push({
        type: 'cliff',
        authored: true,
        id: beat.id,
        x: cx,
        d: beat.d,
        halfX,
        drop: beat.drop,
        lip: beat.lip,
        infMin: beat.d - 12,
        infMax: beat.d + TUNING.FEATURES.CLIFF_RECOVER_START +
          TUNING.FEATURES.CLIFF_RECOVER_LEN + 2,
      });
    }

    h.sort((a, b) => a.d - b.d);
    Object.defineProperty(h, '__rc6Authored', { value: true, enumerable: false });
    return h;
  };

  const baseHeightAt = proto.heightAt;
  proto.heightAt = function heightAtRC6(x, d) {
    return baseHeightAt.call(this, x, d) + specialHeight(x, d);
  };

  const baseSampleGrid = proto.sampleGrid;
  proto.sampleGrid = function sampleGridRC6(x0, x1, nx, d0, d1, nd, out) {
    baseSampleGrid.call(this, x0, x1, nx, d0, d1, nd, out);
    let o = 0;
    for (let iz = 0; iz < nd; iz++) {
      const d = d0 + ((d1 - d0) * iz) / (nd - 1);
      for (let ix = 0; ix < nx; ix++) {
        const x = x0 + ((x1 - x0) * ix) / (nx - 1);
        out[o++] += specialHeight(x, d);
      }
    }
    return out;
  };

  const baseIce = proto.isIce;
  proto.isIce = function isIceRC6(x, d) {
    // BLACK GLASS — one landmark where the surface itself is the joke/problem.
    if (Math.abs(d - 11020) < 165 && Math.abs(x) < 14.8) return true;
    return baseIce.call(this, x, d);
  };

  const baseGrade = proto.gradeMul;
  proto.gradeMul = function gradeMulRC6(d) {
    const g = baseGrade.call(this, d);
    // THE THROAT gets noticeably faster without inventing a new mechanic.
    return g * (1 + window01(d, 3020, 155) * 0.16);
  };
}

function patchBeast(Beast, TUNING) {
  const proto = Beast.prototype;
  if (proto.__rc6Patched) return;
  proto.__rc6Patched = true;
  const BE = TUNING.BEAST;

  const baseReset = proto.reset;
  proto.reset = function resetRC6() {
    baseReset.call(this);
    this.pursuitSpeed = 0;
    this.airPounce = false;
    this.killAir = false;
  };

  proto._startHunt = function startHuntRC6(player) {
    const depth = clamp(player.d / CHASE.DEEP_DISTANCE, 0, 1);
    this.mode = 'hunt';
    this.modeT = 0;
    this.attackT = 0;
    this.hunts++;
    this.modeDuration = this._rand(
      CHASE.HUNT_MIN + depth * 2.5,
      CHASE.HUNT_MAX + depth * 6.0
    );

    const r = this.rng.next();
    const leapChance = 0.18 + depth * 0.14;
    if (r < leapChance) this.attackKind = 'leap';
    else if (r < leapChance + 0.34) this.attackKind = 'side';
    else this.attackKind = 'rear';
    if (this.attackKind !== 'rear') this.side = this.rng.next() < 0.5 ? -1 : 1;

    this.airPounce = false;
    this.lunge = 'idle';
    this.lungeT = 0;
    this.lungeCooldown = this.attackKind === 'leap' ? 3.2 : 2.35;
  };

  proto._beginRelief = function beginReliefRC6(player, earned = false) {
    const depth = clamp(player.d / CHASE.DEEP_DISTANCE, 0, 1);
    this.mode = 'relief';
    this.modeT = 0;
    this.modeDuration = this._rand(
      Math.max(3.8, CHASE.RELIEF_MIN - depth * 1.4),
      Math.max(5.4, CHASE.RELIEF_MAX - depth * 2.1)
    );
    this.escapes++;
    this.lunge = 'recover';
    this.lungeT = 0;
    this.lungeCooldown = Math.max(this.lungeCooldown, 2.8);
    this.mistakePressure *= earned ? 0.25 : 0.42;
    this.airPounce = false;
  };

  proto.stuntShove = function stuntShoveRC6(metres) {
    if (this.killed || !Number.isFinite(metres) || metres <= 0) return 0;
    const before = this.gap;
    const bonus = this.mode === 'hunt' ? 2.5 : 0;
    this.gap = Math.min(BE.MAX_GAP, this.gap + metres + bonus);
    if (this.lunge === 'tell' || this.lunge === 'strike') {
      this.lunge = 'recover';
      this.lungeT = 0;
      this.airPounce = false;
    }
    this.lungeCooldown = Math.max(this.lungeCooldown, 2.2);
    return this.gap - before;
  };

  proto._advanceRhythm = function advanceRhythmRC6(dt, player) {
    this.modeT += dt;
    const depth = clamp(player.d / CHASE.DEEP_DISTANCE, 0, 1);

    if (this.mode === 'hunt') {
      this.attackT += dt;
      if (this.modeT >= this.modeDuration) this._beginRelief(player, false);
      return;
    }
    if (this.mode === 'relief') {
      if (this.modeT >= this.modeDuration) {
        this.mode = 'stalk';
        this.modeT = 0;
        this.modeDuration = this._rand(4.2, 7.7) * (1 - depth * 0.28);
      }
      return;
    }

    const provoked = this.t > 7 && this.mistakePressure >= CHASE.MISTAKE_HUNT_THRESHOLD;
    if (provoked || this.modeT >= this.modeDuration) this._startHunt(player);
  };

  proto.step = function stepRC6(dt, player) {
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
    const depth = clamp(player.d / CHASE.DEEP_DISTANCE, 0, 1);
    const asleep = 1 - this.wakefulness();

    if (this.mode === 'hunt') {
      // During a Hunt the beast is a physical pursuer, not a desired-gap servo.
      // If you stop, it catches you. If you ski beautifully, you can genuinely
      // pull away. Deeper mountain = a faster opponent, not an arbitrary kill.
      let pursuit = lerp(31.2, 37.6, depth) + this.mistakePressure * 1.15 - asleep * 5.0;
      if (this.attackKind === 'side' && this.attackT < CHASE.SIDE_ENTRY_TIME) pursuit -= 3.5;
      if (this.attackKind === 'leap' && this.attackT > 0.65 && this.attackT < 3.0) pursuit += 2.6;
      this.pursuitSpeed = Math.max(24, pursuit);
      this.gap += (player.speed - this.pursuitSpeed) * dt;
      this.desired = this.gap;
    } else {
      let desired;
      if (this.mode === 'relief') {
        desired = lerp(86, 74, depth) + sn * 7;
      } else {
        desired = lerp(CHASE.STALK_GAP_MAX, CHASE.STALK_GAP_MIN, depth) + sn * 8;
        desired -= this.mistakePressure * 5;
        desired += BE.GRACE_GAP * asleep * 0.5;
      }
      this.desired = clamp(desired, BE.DESIRED_FLOOR, BE.MAX_GAP);
      const delta = this.desired - this.gap;
      const maxStep = (delta > 0 ? BE.OPEN_RATE * 1.12 : BE.CLOSE_RATE) * dt;
      this.gap += clamp(delta, -maxStep, maxStep);
      this.pursuitSpeed = 0;
    }

    if (player.overdrive) this._pushTail = BE.OVERDRIVE_PUSH_TAIL;
    if (this._pushTail > 0) {
      const fade = Math.min(1, this._pushTail / BE.OVERDRIVE_PUSH_TAIL);
      this.gap += BE.OVERDRIVE_PUSH * fade * dt;
      this._pushTail = Math.max(0, this._pushTail - dt);
    }

    if (this.mode === 'hunt' && this.lunge === 'strike') this.gap -= BE.LUNGE_RATE * dt;
    else if (this.lunge === 'recover') this.gap += BE.LUNGE_RECOVER_RATE * dt;
    this.gap = Math.min(this.gap, BE.MAX_GAP);

    const ot = clamp(
      (this.gap - BE.OFFSET_FADE_NEAR) / (BE.OFFSET_FADE_FAR - BE.OFFSET_FADE_NEAR), 0, 1
    );
    const baseOffset = BE.OFFSET_MIN + (BE.APPROACH_OFFSET - BE.OFFSET_MIN) * smooth01(ot);
    let targetX = player.x + this.side * baseOffset;

    if (this.mode === 'hunt' && this.attackKind === 'side' && this.attackT < CHASE.SIDE_ENTRY_TIME) {
      const e = smooth01(this.attackT / CHASE.SIDE_ENTRY_TIME);
      targetX = player.x + this.side * lerp(CHASE.SIDE_ENTRY_X, baseOffset, e);
    } else if (this.mode === 'hunt' && this.attackKind === 'leap' && this.attackT < 2.8) {
      const e = smooth01(this.attackT / 2.8);
      targetX = player.x + this.side * lerp(10.5, baseOffset * 0.3, e);
    }

    const lat = 1 - Math.exp(-(this.mode === 'hunt' ? 2.55 : 1.35) * dt);
    this.x += (targetX - this.x) * lat;

    if (this.gap > 8) this.airPounce = false;
    if (this.gap <= BE.KILL_GAP) {
      if (player.airborne) {
        // No invisible 2D kill in mid-air. It has to visibly pounce first.
        if (!this.airPounce) {
          this.airPounce = true;
          this.attackKind = 'leap';
          this.lunge = 'tell';
          this.lungeT = 0;
          this.lungeCooldown = 0;
        }
        if (this.lunge !== 'strike') {
          this.gap = Math.max(this.gap, BE.KILL_GAP + 0.8);
          return;
        }
        this.killAir = true;
      }

      this.gap = BE.KILL_GAP;
      this.killed = true;
      this.killT = 0;
    }
  };
}

export function applyRC6Core(Terrain, Beast, TUNING) {
  patchTerrain(Terrain, TUNING);
  patchBeast(Beast, TUNING);
}

export default applyRC6Core;
