/**
 * DESCENT camera rig.
 *
 * Flow stays stable and readable. Flair lets the camera breathe around air.
 * Dread lowers and crowds the frame. Death is the one moment the camera breaks
 * its normal contract and whips around for the poster frame.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const C = TUNING.CAMERA;
const B = TUNING.BEAST;
const tmp = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = new THREE.Vector3();
    this.fov = C.FOV;
    this.roll = 0;
    this.first = true;
    this.whip = 0;
  }

  reset() {
    this.first = true;
    this.whip = 0;
    this.roll = 0;
    this.shake.set(0, 0, 0);
  }

  update(dt, p, gap, shakeAmp, killT, terrain, beastX = p.x, beastSide = 1) {
    // Speed feel is keyed 0..1 across the whole floor→ceiling range (the
    // old (v-14)/20 saturated — and kept growing past 1 — at 34 m/s era
    // values, so the climb from 40 to the new ceiling showed nothing and
    // the boom drifted away). Sonic grammar: closer, lower, wider, ahead.
    const R = TUNING.RUN;
    const speedN = Math.max(0, Math.min(1, (p.speed - R.FLOOR) / (R.CEILING - R.FLOOR)));
    let back = C.BACK + speedN * C.BACK_SPEED_GAIN * 20;
    let height = C.HEIGHT - speedN * C.HEIGHT_SPEED_DROP;

    const dread = Math.max(0, 1 - gap / C.DREAD_TILT_RANGE);
    back += dread * C.DREAD_TILT;
    height += dread * 0.7;

    const airHeight = p.airborne && terrain
      ? Math.max(0, p.y - terrain.heightAt(p.x, p.d)) : 0;
    // Ordinary hops keep the familiar close camera. Once the skier is truly
    // high above the slope, open the boom and raise it so the whole arc reads.
    // This is composition, not extra spectacle: the subject must remain visible
    // at the apex of the authored Bridge / Moonshot-size airs.
    const heroAir = p.airborne
      ? Math.max(0, Math.min(1, (airHeight - 5.5) / 12.0))
      : 0;
    back += heroAir * 6.5;
    height += heroAir * 1.8;

    if (killT <= 0 && gap < back + C.BEAST_CLEARANCE) {
      back = Math.min(C.BACK_MAX, gap + C.BEAST_CLEARANCE);
    }

    let angle = 0;
    if (killT > 0) {
      const k = Math.min(1, killT / B.KILL_WHIP_TIME);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      angle = Math.PI * C.KILL_ANGLE * e;
      back = C.KILL_BACK + 4 * (1 - e);
      height = 3.4 + (C.KILL_HEIGHT - 3.4) * e;
    }

    const camD = p.d - Math.cos(angle) * back;
    const groundAtCam = terrain
      ? terrain.heightAt(p.x, camD)
      : p.y + back * TUNING.TERRAIN.GRADE;

    // A little extra vertical room in the air makes a big cliff feel like the
    // mountain actually fell away beneath you instead of the camera simply
    // following the same boom at a higher Y.
    let camY = groundAtCam + height + airHeight * (C.AIR_HEIGHT_GAIN + 0.08);

    const target = tmp.set(
      p.x - beastSide * Math.sin(angle) * back * C.KILL_ORBIT,
      camY,
      -p.d + Math.cos(angle) * back
    );

    if (this.first) {
      this.pos.copy(target);
      this.first = false;
    } else {
      const smooth = p.airborne ? C.SMOOTH * 0.78 : C.SMOOTH;
      const k = 1 - Math.exp(-smooth * dt);
      this.pos.lerp(target, killT > 0 ? Math.min(1, dt * 9) : k);
    }

    // Barely-in-control tremor as the ceiling nears — additive with the
    // dread shake, tiny enough to never smear a plate.
    const speedShake = Math.max(0, speedN - 0.72) / 0.28 * C.SPEED_SHAKE;
    const amp = Math.max(shakeAmp, speedShake);
    if (amp > 0.001) {
      const t = performance.now() * 0.001;
      // Bias dread shake vertically/downhill; random lateral vibration reads as
      // generic "damage" while a low-frequency vertical pulse reads as weight.
      this.shake.set(
        Math.sin(t * 31.3) * amp * 0.55,
        Math.sin(t * 43.7) * amp * 0.82,
        Math.sin(t * 27.1) * amp * 0.62
      );
    } else {
      this.shake.multiplyScalar(1 - Math.min(1, dt * 10));
    }

    this.camera.position.copy(this.pos).add(this.shake);

    if (killT > 0) {
      const k = Math.min(1, killT / B.KILL_WHIP_TIME);
      const e = k * k * (3 - 2 * k);
      this.look.set(
        p.x + (beastX - p.x) * 0.35 * e,
        p.y + 1.5 + 0.7 * e,
        -p.d + C.KILL_LOOK_PAST * e
      );
    } else {
      const aheadD = p.d + C.LOOK_AHEAD + speedN * C.LOOK_SPEED_AHEAD;
      const groundAhead = terrain
        ? terrain.heightAt(p.x, aheadD)
        : p.y - C.LOOK_AHEAD * TUNING.TERRAIN.GRADE;
      // On hero air, aim closer to the skier's vertical level instead of
      // continuing to stare down the piste while the subject exits frame above.
      const airLookGain = C.AIR_LOOK_GAIN + heroAir * 0.28;
      this.look.set(
        p.x * C.LOOK_CENTRE_BIAS,
        groundAhead + C.LOOK_HEIGHT + airHeight * airLookGain,
        -aheadD
      );
    }
    this.camera.lookAt(this.look);

    // Camera roll belongs to FLOW, not spectacle: tiny sympathy with a hard
    // carve makes the arc feel physical while keeping the horizon trustworthy.
    let wantRoll = killT > 0 ? 0 : -p.heading * 0.075;
    if (p.airborne) {
      // A hint of trick rotation is enough to make air expressive without
      // turning the camera into an SSX imitation or destroying landing reads.
      wantRoll += Math.max(-0.08, Math.min(0.08, p.yaw * 0.025));
    }
    this.roll += (wantRoll - this.roll) * (1 - Math.exp(-7 * dt));
    this.camera.rotateZ(this.roll);

    const wantFov = C.FOV + speedN * C.FOV_SPEED_GAIN * 20 +
      (p.overdrive ? C.FOV_BOOST + 2.0 : 0) +
      (p.airborne ? Math.min(2.4, airHeight * 0.22) : 0) +
      heroAir * 4.5;
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-6 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
