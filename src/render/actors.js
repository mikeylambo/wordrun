/**
 * Actors — DICTION DASH.
 *
 * The runner is a RUNNING FIGURE OF LIGHT: a low-poly humanoid built from
 * glowing primitives with a procedural run cycle — no skeleton, no skinning,
 * just pivot groups swung by distance-driven phase, so it stays in the same
 * error-absorbent line-art language as the Redline and the Caret. It is a
 * visual swap on the existing controller: PlayerActor keeps the exact
 * update(p, slope, dt, gap) contract, the pivot for airborne rotation, and
 * the track-ribbon system (the ink stroke the runner draws down the page).
 * Lane logic, hit-boxes and movement are untouched sim state; this file
 * only draws them.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const TRACK_SEGMENTS = 180;

const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false,
  blending: THREE.AdditiveBlending, fog: false,
});

const box = (w, h, d, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);

/**
 * One articulated limb: a pivot group at the joint, the bone mesh hanging
 * below it, and a nested second joint (knee/elbow) with its own bone.
 */
function limb(material, x, y, upperLen, lowerLen, thick) {
  const joint = new THREE.Group();
  joint.position.set(x, y, 0);
  const upper = box(thick, upperLen, thick, material);
  upper.position.y = -upperLen / 2;
  joint.add(upper);
  const mid = new THREE.Group();
  mid.position.y = -upperLen;
  const lower = box(thick * 0.82, lowerLen, thick * 0.82, material);
  lower.position.y = -lowerLen / 2;
  mid.add(lower);
  joint.add(mid);
  return { joint, mid, upper, lower };
}

/**
 * The running man: hips, leaning torso, head, two arms (elbows held bent,
 * runner-style), two legs with knees, a halo shell and a light pool. Ghost
 * builds the same construct, paler.
 */
function buildRunner(ghost = false) {
  const g = new THREE.Group();

  const coreColor = ghost ? 0x9fb9c8 : 0xeaffff;
  const limbColor = ghost ? 0x8aa6b6 : 0x9fe8ff;
  const haloColor = ghost ? 0x6f8b9c : 0x67d8ff;
  const baseOpacity = ghost ? TUNING.GHOST.OPACITY : 1;

  const coreMat = glow(coreColor, 0.96 * baseOpacity);
  const limbMat = glow(limbColor, 0.9 * baseOpacity);

  // Everything above the legs leans as one piece — the sprinter's angle.
  const hips = new THREE.Group();
  hips.position.y = 0.98;
  g.add(hips);

  const pelvis = box(0.30, 0.16, 0.20, limbMat);
  pelvis.position.y = 0.02;
  hips.add(pelvis);

  const chest = new THREE.Group();
  chest.position.y = 0.1;
  hips.add(chest);

  const torso = box(0.36, 0.52, 0.22, coreMat);
  torso.position.y = 0.34;
  chest.add(torso);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.145, 0), coreMat);
  head.position.y = 0.76;
  chest.add(head);

  // Arms hang from the chest so they inherit the lean. Elbows stay bent —
  // the swing happens at the shoulder, like an actual runner.
  const armL = limb(limbMat, -0.245, 0.56, 0.32, 0.3, 0.095);
  const armR = limb(limbMat, 0.245, 0.56, 0.32, 0.3, 0.095);
  armL.mid.rotation.x = -1.35;
  armR.mid.rotation.x = -1.35;
  chest.add(armL.joint, armR.joint);

  // Legs hang from the hips; knees fold backward through the cycle.
  const legL = limb(limbMat, -0.115, 0, 0.46, 0.44, 0.12);
  const legR = limb(limbMat, 0.115, 0, 0.46, 0.44, 0.12);
  hips.add(legL.joint, legR.joint);

  // The light-being shell: a soft halo around the torso keeps the figure
  // reading as a construct of glow rather than a mannequin.
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), glow(haloColor, 0.22 * baseOpacity));
  halo.scale.set(1.0, 1.55, 1.0);
  halo.position.y = 1.28;
  g.add(halo);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), glow(haloColor, 0.22 * baseOpacity));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  g.add(pool);

  // The comet tail: a horizontal streak stretching behind the figure as
  // speed climbs — invisible at a jog, unmistakable near the ceiling.
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1), glow(haloColor, 0));
  tail.rotation.x = -Math.PI / 2;
  tail.position.y = 1.05;
  g.add(tail);

  const materials = [coreMat, limbMat, halo.material, pool.material, tail.material];
  if (ghost) for (const m of materials) m.transparent = true;

  return {
    group: g, hips, chest, head, halo, pool, tail,
    armL, armR, legL, legR,
    coreMat, limbMat, materials, baseOpacity,
  };
}

/**
 * The shared run cycle — drives one rig from a phase angle. Used by the
 * player and the ghost so the two figures stride identically.
 *   phase    : radians, 2π per full stride pair
 *   speedN   : normalised speed (0..~1.85 with Overdrive)
 *   airborne : freeze the cycle into a leap pose
 */
function poseRunner(r, phase, speedN, airborne, dt) {
  const swing = 0.75 + speedN * 0.35;      // shoulder/hip swing amplitude
  const sL = Math.sin(phase);
  const sR = Math.sin(phase + Math.PI);

  if (airborne) {
    // A held leap: lead leg reaching, trail leg extended, arms split.
    const k = 1 - Math.exp(-10 * dt);
    r.legL.joint.rotation.x += (-0.9 - r.legL.joint.rotation.x) * k;
    r.legR.joint.rotation.x += (0.7 - r.legR.joint.rotation.x) * k;
    r.legL.mid.rotation.x += (0.5 - r.legL.mid.rotation.x) * k;
    r.legR.mid.rotation.x += (0.9 - r.legR.mid.rotation.x) * k;
    r.armL.joint.rotation.x += (0.8 - r.armL.joint.rotation.x) * k;
    r.armR.joint.rotation.x += (-0.8 - r.armR.joint.rotation.x) * k;
    r.hips.position.y = 0.98;
    return;
  }

  // Ground cycle: legs alternate at the hip, knees fold hardest as the leg
  // swings through behind; arms counter-swing from the shoulder.
  r.legL.joint.rotation.x = sL * swing;
  r.legR.joint.rotation.x = sR * swing;
  r.legL.mid.rotation.x = Math.max(0.12, (1 - Math.cos(phase + 0.9)) * 0.55) * (0.9 + speedN * 0.4);
  r.legR.mid.rotation.x = Math.max(0.12, (1 - Math.cos(phase + Math.PI + 0.9)) * 0.55) * (0.9 + speedN * 0.4);
  r.armL.joint.rotation.x = sR * swing * 0.9;
  r.armR.joint.rotation.x = sL * swing * 0.9;

  // The body rides the stride: a small double-frequency bob.
  r.hips.position.y = 0.98 + Math.abs(Math.sin(phase)) * (0.035 + speedN * 0.03);
}

export class PlayerActor {
  constructor(scene) {
    const b = buildRunner(false);
    Object.assign(this, b);
    this.pivot = new THREE.Group();
    this.pivot.add(this.group);
    this.root = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);

    this.t = 0;
    this._lastD = 0;
    this._blink = 0;
    this._phase = 0;

    // The drawn line: the frame's track-ribbon system, a fine double-stroke
    // of ink the runner's footfalls leave on the page.
    this._lastTrackD = -999;
    this._trackHead = 0;
    this._trackReady = false;
    this._trackLeft = new THREE.Vector3();
    this._trackRight = new THREE.Vector3();
    this.trackPos = new Float32Array(TRACK_SEGMENTS * 4 * 3);
    for (let i = 0; i < this.trackPos.length; i += 3) this.trackPos[i + 1] = -9999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trackPos, 3));
    this.tracks = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0x67d8ff, transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    this.tracks.frustumCulled = false;
    scene.add(this.tracks);
  }

  _clearTracks() {
    for (let i = 0; i < this.trackPos.length; i += 3) this.trackPos[i + 1] = -9999;
    this.tracks.geometry.attributes.position.needsUpdate = true;
    this._trackHead = 0;
    this._trackReady = false;
    this._lastTrackD = -999;
  }

  _track(p) {
    if (p.airborne || p.staggerT > 0.15) { this._trackReady = false; return; }
    if (p.d - this._lastTrackD < 0.48) return;
    this._lastTrackD = p.d;
    const rightX = Math.cos(p.heading), rightZ = Math.sin(p.heading);
    const curL = new THREE.Vector3(p.x - rightX * 0.07, p.y + 0.03, -p.d - rightZ * 0.07);
    const curR = new THREE.Vector3(p.x + rightX * 0.07, p.y + 0.03, -p.d + rightZ * 0.07);
    if (this._trackReady) {
      const base = this._trackHead * 12, a = this.trackPos;
      a[base] = this._trackLeft.x; a[base + 1] = this._trackLeft.y; a[base + 2] = this._trackLeft.z;
      a[base + 3] = curL.x; a[base + 4] = curL.y; a[base + 5] = curL.z;
      a[base + 6] = this._trackRight.x; a[base + 7] = this._trackRight.y; a[base + 8] = this._trackRight.z;
      a[base + 9] = curR.x; a[base + 10] = curR.y; a[base + 11] = curR.z;
      this._trackHead = (this._trackHead + 1) % TRACK_SEGMENTS;
      this.tracks.geometry.attributes.position.needsUpdate = true;
    }
    this._trackLeft.copy(curL); this._trackRight.copy(curR); this._trackReady = true;
  }

  update(p, slope, dt, beastGap = 80) {
    this.t += dt;
    if (p.d < this._lastD - 5) this._clearTracks();
    this._lastD = p.d;
    this.root.position.set(p.x, p.y, -p.d);
    this.root.rotation.y = -p.heading;

    // Body lean into the turn, exactly like the old rig heeled over.
    const carveN = Math.max(-1, Math.min(1, p.heading / TUNING.PLAYER.MAX_CARVE));
    const lean = -carveN * 0.4;
    const slopePitch = Math.atan2(slope.dhdd, 1);
    const k = 1 - Math.exp(-12 * dt);
    this.group.rotation.z += ((p.airborne ? 0 : lean) - this.group.rotation.z) * k;
    this.group.rotation.x += ((p.airborne ? 0 : slopePitch) - this.group.rotation.x) * k;

    // Airborne spin/flip rides the same pivot the sim always drove.
    if (p.airborne) {
      this.pivot.rotation.y = p.yaw;
      this.pivot.rotation.x = p.pitch;
    } else {
      const settle = 1 - Math.exp(-10 * dt);
      this.pivot.rotation.y *= 1 - settle;
      this.pivot.rotation.x *= 1 - settle;
    }

    // Keyed 0..1.35 across the RUN floor→ceiling range (the old /32 maxed
    // out the animation at 43 m/s, so the top half of the curve looked
    // identical to the middle). Overdrive still stacks its own 0.5.
    const R = TUNING.RUN;
    const norm = Math.max(0, Math.min(1, (p.speed - R.FLOOR) / (R.CEILING - R.FLOOR)));
    const speedN = norm * 1.35 + (p.overdrive ? 0.5 : 0);

    // The run cycle is driven by distance, so stride matches the ground:
    // ~2.4m per full stride pair at base, longer as the figure sprints.
    const strideLen = 2.4 + speedN * 0.9;
    if (!p.airborne && p.speed > 0.5) {
      this._phase += (p.effSpeed ?? p.speed) * dt * (Math.PI * 2) / strideLen;
    }
    poseRunner(this, this._phase, speedN, p.airborne, dt);

    // Sprinter's lean deepens with speed; Overdrive is nearly horizontal fury.
    this.chest.rotation.x = -(0.16 + speedN * 0.22);

    // The figure still pulses like a cursor: calm far from the Redline,
    // frantic close to it — the nerve tell carried over from Phase 5.
    const nerve = Math.max(0, Math.min(1, 1 - beastGap / 45));
    this._blink += dt * (1.6 + nerve * 6.5);
    const blink = 0.86 + Math.abs(Math.sin(this._blink * Math.PI)) * 0.14;
    // Flow (Phase 9): the figure itself burns brighter with the chain —
    // main sets .flow each frame (glow × pulse); wrappers pass through.
    const flow = this.flow ?? 1;
    this.coreMat.opacity = Math.min(1, 0.96 * this.baseOpacity * blink * (0.85 + flow * 0.15));
    this.halo.material.opacity =
      Math.min(0.6, 0.22 * this.baseOpacity * (0.8 + speedN * 0.35) * blink * flow);
    // The halo stretches into a teardrop with speed — the whole construct
    // reads as motion even in a still frame.
    this.halo.scale.set(1.0 + speedN * 0.1, 1.55 + speedN * 0.12, 1.0 + speedN * 0.55);
    this.halo.position.z = speedN * 0.5;

    // Comet tail: length and brightness ride the top half of the range.
    const tailN = Math.max(0, norm - 0.25) / 0.75;
    this.tail.material.opacity = tailN * 0.4 * this.baseOpacity;
    this.tail.scale.y = 0.001 + tailN * 9;             // plane local y = world z
    this.tail.position.z = (0.001 + tailN * 9) / 2 + 0.4;

    // Stagger: the construct destabilises — hard flicker, a shudder, arms
    // thrown wide — where the old rig windmilled.
    if (p.staggerT > 0) {
      const jitter = Math.sin(this.t * 61) * 0.09;
      this.group.position.x = jitter;
      this.coreMat.opacity *= 0.55 + Math.abs(Math.sin(this.t * 47)) * 0.45;
      this.armL.joint.rotation.z = 0.9 + Math.sin(this.t * 31) * 0.3;
      this.armR.joint.rotation.z = -0.9 - Math.sin(this.t * 29) * 0.3;
    } else {
      this.group.position.x *= 1 - Math.min(1, dt * 10);
      this.armL.joint.rotation.z *= 1 - Math.min(1, dt * 8);
      this.armR.joint.rotation.z *= 1 - Math.min(1, dt * 8);
    }

    this._track(p);
  }

  /**
   * Cosmetic palette (Phase 14): tint the glow surfaces — halo, ground
   * pool, comet tail, track trail, limbs — leaving the white core alone so
   * the figure always reads. Cosmetic only; semantic cues live elsewhere.
   */
  setPalette({ halo, limb } = {}) {
    if (halo != null) {
      this.halo.material.color.setHex(halo);
      this.pool.material.color.setHex(halo);
      this.tail.material.color.setHex(halo);
      this.tracks.material.color.setHex(halo);
    }
    if (limb != null) this.limbMat.color.setHex(limb);
  }

  setVisible(v) { this.root.visible = v; }
}

export class GhostActor {
  constructor(scene) {
    const b = buildRunner(true);
    Object.assign(this, b);
    this.tail.visible = false; // the comet tail is the live runner's alone
    this.root = new THREE.Group();
    this.root.add(this.group);
    this.root.visible = false;
    scene.add(this.root);
    this._phase = 0;
    this._lastD = null;
  }

  update(ghost, dt) {
    if (!ghost || !ghost.active) { this.root.visible = false; this._lastD = null; return; }
    this.root.visible = true;
    this.root.position.set(ghost.x, ghost.y, -ghost.d);
    for (const m of this.materials) if (m.transparent) m.opacity = ghost.opacity;

    // Stride from its own recorded motion, so the pale runner keeps pace.
    const v = this._lastD == null || dt <= 0 ? 0 : Math.max(0, (ghost.d - this._lastD) / dt);
    this._lastD = ghost.d;
    const R = TUNING.RUN;
    const speedN = Math.max(0, Math.min(1, (v - R.FLOOR) / (R.CEILING - R.FLOOR))) * 1.35;
    this._phase += v * dt * (Math.PI * 2) / (2.4 + speedN * 0.9);
    poseRunner(this, this._phase, speedN, false, dt);
    this.chest.rotation.x = -(0.16 + speedN * 0.22);

    if (ghost.yanking) {
      this.group.rotation.x = -1.1;
      this.group.rotation.z += dt * 6;
      this.root.position.y += Math.min(5, dt * 12);
    } else {
      this.group.rotation.x *= 1 - Math.min(1, dt * 8);
      this.group.rotation.z *= 1 - Math.min(1, dt * 8);
    }
  }
}

/**
 * The Redline fills the antagonist slot in the render graph, consuming the
 * exact update() contract (gap, side, lunge, killT) the beast carried.
 */
export { CorruptionActor as BeastActor } from './corruption.js';
