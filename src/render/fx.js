/**
 * Snow spray. One pooled Points cloud, no allocation after construction.
 *
 * Spray is not decoration here — it is the readout for the carve. How hard you
 * are on edge is otherwise invisible from behind, and priority 1 in the brief
 * is the feel of carving. The plume IS the feedback.
 */

import * as THREE from 'three';

const MAX = 340;

/**
 * Untextured Points render as hard squares, which at close range read as white
 * confetti rather than snow. A tiny generated radial falloff fixes it for the
 * cost of one 32px canvas and no asset file.
 */
function makeFlakeTexture() {
  const s = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

export class Spray {
  constructor(scene) {
    this.n = MAX;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo = geo;

    this.mat = new THREE.PointsMaterial({
      color: 0x8fe4ff,
      size: 0.42,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,    // individual flakes should stack into a plume, not a blob
      depthWrite: false,
      map: makeFlakeTexture(),
      alphaTest: 0.02,
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Park every particle far below the world until it is first used.
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -9999;
  }

  emit(x, y, z, count, spread, up, drift) {
    for (let i = 0; i < count; i++) {
      const j = this.head;
      this.head = (this.head + 1) % MAX;
      this.pos[j * 3] = x + (Math.random() - 0.5) * 0.7;
      this.pos[j * 3 + 1] = y + 0.08;
      this.pos[j * 3 + 2] = z + (Math.random() - 0.5) * 0.7;
      this.vel[j * 3] = (Math.random() - 0.5) * spread + drift;
      this.vel[j * 3 + 1] = up * (0.5 + Math.random());
      this.vel[j * 3 + 2] = (Math.random() - 0.2) * spread * 0.8 + 3.5;
      this.life[j] = 0.45 + Math.random() * 0.4;
    }
  }

  update(dt) {
    const p = this.pos, v = this.vel, l = this.life;
    for (let i = 0; i < MAX; i++) {
      if (l[i] <= 0) continue;
      l[i] -= dt;
      if (l[i] <= 0) { p[i * 3 + 1] = -9999; continue; }
      v[i * 3 + 1] -= 9 * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < MAX; i++) { this.life[i] = 0; this.pos[i * 3 + 1] = -9999; }
    this.geo.attributes.position.needsUpdate = true;
  }
}
