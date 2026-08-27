/**
 * Actors — WORD RUN Phase 5.
 *
 * The runner is a CURSOR OF LIGHT: a blade of glow with a nib that touches
 * the page, drawing a bright ink stroke behind it as it runs. No rigging, no
 * skeleton — the same error-absorbent line-art language as the Redline and
 * the Caret. It is a visual swap on the existing controller: PlayerActor
 * keeps the exact update(p, slope, dt, gap) contract, the pivot for
 * airborne rotation, and the track-ribbon system (restyled as the drawn
 * line of the manuscript). Lane logic, hit-boxes and movement are untouched
 * sim state; this file only draws them.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const TRACK_SEGMENTS = 180;

const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false,
  blending: THREE.AdditiveBlending, fog: false,
});

/**
 * The cursor: bright octahedral core, soft halo shell, a down-pointing nib,
 * and three orbiting motes. Ghost builds the same construct, paler.
 */
function buildCursor(ghost = false) {
  const g = new THREE.Group();

  const coreColor = ghost ? 0x9fb9c8 : 0xeaffff;
  const haloColor = ghost ? 0x6f8b9c : 0x67d8ff;
  const nibColor = ghost ? 0x9fb9c8 : 0xbdf2ff;
  const baseOpacity = ghost ? TUNING.GHOST.OPACITY : 1;

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glow(coreColor, baseOpacity));
  core.scale.set(0.72, 2.6, 0.72);
  core.position.y = 1.06;
  g.add(core);

  const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), glow(haloColor, 0.34 * baseOpacity));
  halo.scale.set(0.9, 2.35, 0.9);
  halo.position.y = 1.06;
  g.add(halo);

  // The nib: where the cursor meets the page and the ink comes from.
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), glow(nibColor, 0.9 * baseOpacity));
  nib.rotation.x = Math.PI;
  nib.position.y = 0.25;
  g.add(nib);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), glow(haloColor, 0.22 * baseOpacity));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  g.add(pool);

  // Orbiting motes — punctuation caught in the cursor's field.
  const motes = new THREE.Group();
  motes.position.y = 1.15;
  const moteList = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.075, 0), glow(haloColor, 0.75 * baseOpacity));
    const a = (i / 3) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.62, (i - 1) * 0.34, Math.sin(a) * 0.62);
    m.userData.angle = a;
    m.userData.h = (i - 1) * 0.34;
    motes.add(m);
    moteList.push(m);
  }
  g.add(motes);

  const materials = [core.material, halo.material, nib.material, pool.material,
    ...moteList.map((m) => m.material)];
  if (ghost) for (const m of materials) m.transparent = true;

  return { group: g, core, halo, nib, pool, motes, moteList, materials, baseOpacity };
}

export class PlayerActor {
  constructor(scene) {
    const b = buildCursor(false);
    Object.assign(this, b);
    this.pivot = new THREE.Group();
    this.pivot.add(this.group);
    this.root = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);

    this.t = 0;
    this._lastD = 0;
    this._blink = 0;

    // The drawn line: the frame's track-ribbon system, restyled as a single
    // fine double-stroke of ink the nib leaves on the page.
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

    // Carve lean, exaggerated exactly like the old rig — the blade heels
    // over into the turn and snaps back upright.
    const carveN = Math.max(-1, Math.min(1, p.heading / TUNING.PLAYER.MAX_CARVE));
    const lean = -carveN * 0.62;
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

    const speedN = Math.min(1.35, p.speed / 32) + (p.overdrive ? 0.5 : 0);

    // Speed stretches the blade; Overdrive makes it borderline comet.
    const stretch = 1 + speedN * 0.16;
    this.core.scale.set(0.72, 2.6 * stretch, 0.72);
    this.halo.scale.set(0.9 + speedN * 0.12, 2.35 * stretch, 0.9 + speedN * 0.12);

    // A text cursor blinks. Calm far from the Redline, frantic close to it.
    const nerve = Math.max(0, Math.min(1, 1 - beastGap / 45));
    this._blink += dt * (1.6 + nerve * 6.5);
    const blink = 0.82 + Math.abs(Math.sin(this._blink * Math.PI)) * 0.18;
    this.core.material.opacity = this.baseOpacity * blink;
    this.halo.material.opacity = 0.34 * this.baseOpacity * (0.8 + speedN * 0.35) * blink;

    // Stagger: the construct destabilises — hard flicker and a shudder —
    // where the old rig windmilled its arms.
    if (p.staggerT > 0) {
      const jitter = Math.sin(this.t * 61) * 0.09;
      this.group.position.x = jitter;
      this.core.material.opacity *= 0.55 + Math.abs(Math.sin(this.t * 47)) * 0.45;
    } else {
      this.group.position.x *= 1 - Math.min(1, dt * 10);
    }

    // Motes orbit faster with speed; they flatten into the slipstream.
    for (const m of this.moteList) {
      m.userData.angle += dt * (2.2 + speedN * 3.4);
      const r = 0.62 + speedN * 0.1;
      m.position.set(Math.cos(m.userData.angle) * r, m.userData.h,
        Math.sin(m.userData.angle) * r + speedN * 0.3);
    }

    this._track(p);
  }

  setVisible(v) { this.root.visible = v; }
}

export class GhostActor {
  constructor(scene) {
    const b = buildCursor(true);
    this.group = b.group;
    this.materials = b.materials;
    this.baseOpacity = b.baseOpacity;
    this.root = new THREE.Group();
    this.root.add(this.group);
    this.root.visible = false;
    scene.add(this.root);
  }

  update(ghost, dt) {
    if (!ghost || !ghost.active) { this.root.visible = false; return; }
    this.root.visible = true;
    this.root.position.set(ghost.x, ghost.y, -ghost.d);
    for (const m of this.materials) if (m.transparent) m.opacity = ghost.opacity;
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
