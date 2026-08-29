/**
 * Speed fantasy (Phase 8.5) — the two strongest "you are FAST" cues that
 * were missing, both presentation-only and keyed 0..1 across the RUN
 * floor→ceiling range:
 *
 *   WindStreaks — anime-style wind lines rushing past the camera. Live as
 *   a child of the camera (no fog, no culling), so they cost one small
 *   attribute update per frame. Silent below ~40% of the range; a torrent
 *   near the ceiling and in Overdrive.
 *
 *   TrackPylons — glowing stanchions flanking the track every few metres.
 *   Nearby verticals sweeping through the frame are the classic parallax
 *   speed cue (Sonic's loops and posts); an instanced mesh recycles a
 *   fixed pool along the corridor ahead.
 *
 * Palette stays in the cyan/white family — red belongs to the Redline.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const R = TUNING.RUN;

const norm = (speed) =>
  Math.max(0, Math.min(1, (speed - R.FLOOR) / (R.CEILING - R.FLOOR)));

const STREAKS = 64;

export class WindStreaks {
  constructor(camera) {
    this.pos = new Float32Array(STREAKS * 6);
    this.seeds = [];
    for (let i = 0; i < STREAKS; i++) {
      this.seeds.push({
        angle: Math.random() * Math.PI * 2,
        radius: 2.2 + Math.random() * 5.5,
        z: -8 - Math.random() * 46,
        jitter: 0.6 + Math.random() * 0.8,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xbfeaff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 30;
    camera.add(this.lines);
  }

  update(dt, speed, overdrive) {
    const n = norm(speed) + (overdrive ? 0.35 : 0);
    // Fade in from 40% of the range; full torrent at the ceiling.
    const vis = Math.max(0, (n - 0.4) / 0.6);
    this.lines.material.opacity = Math.min(1, vis) * 0.5;
    this.lines.visible = vis > 0.001;
    if (!this.lines.visible) return;

    const len = 1.5 + n * 8;      // streak length grows with speed
    const rush = speed * 1.35;    // world-ish m/s past the camera
    const a = this.pos;
    for (let i = 0; i < STREAKS; i++) {
      const s = this.seeds[i];
      s.z += rush * dt * s.jitter; // camera looks down -z; past = +z
      if (s.z > 4) {
        s.z = -46 - Math.random() * 12;
        s.angle = Math.random() * Math.PI * 2;
        s.radius = 2.2 + Math.random() * 5.5;
      }
      const x = Math.cos(s.angle) * s.radius;
      const y = Math.sin(s.angle) * s.radius * 0.75;
      const base = i * 6;
      a[base] = x; a[base + 1] = y; a[base + 2] = s.z;
      a[base + 3] = x; a[base + 4] = y; a[base + 5] = s.z - len;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

const PYLONS_PER_SIDE = 26;
const PYLON_SPACING = 21;

export class TrackPylons {
  constructor(scene, terrain) {
    this.terrain = terrain;
    const geo = new THREE.BoxGeometry(0.16, 2.3, 0.16);
    geo.translate(0, 1.15, 0);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x8fe0ff, transparent: true, opacity: 0.75, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, PYLONS_PER_SIDE * 2);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
  }

  update(playerD) {
    const first = Math.floor((playerD - PYLON_SPACING) / PYLON_SPACING);
    let i = 0;
    for (let k = 0; k < PYLONS_PER_SIDE; k++) {
      const d = (first + k) * PYLON_SPACING;
      const line = this.terrain.corridorX(d);
      const edge = R.TRACK_HALF_W + 0.9;
      for (const side of [-1, 1]) {
        this._m.makeTranslation(line + side * edge, 0, -d);
        this.mesh.setMatrixAt(i++, this._m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
