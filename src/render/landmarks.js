/**
 * Landmarks — the city the road runs through (key-art pass).
 *
 * Two pieces, both pure scenery, both read the band table for colour:
 *
 *  SKYLINE — a distant ring of tall pale towers on the horizon ahead. It
 *  follows the runner (it is a backdrop, not a place you reach), sits past
 *  the fog wall with fog disabled, and is tinted from the live fog colour
 *  each frame, so the endgame sky and every band carry it with no table of
 *  its own. Two depths: a pale far rank and a slightly denser near rank,
 *  each a single instanced draw.
 *
 *  BILLBOARDS — lit roadside hoardings on posts, well beyond the page
 *  margins and angled toward the oncoming runner. Their faces are greeked
 *  bars: the word plate stays the only text in the world (editorial gate),
 *  so a billboard is an advertisement you never get to read.
 *
 * Colour discipline: no hue is new — towers mix the live fog toward the
 * band crest, billboards wear the band ice. Red belongs to the Redline.
 * REDUCED FLASH: nothing here pulses.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { MOUNTAIN_BANDS, bandBlend } from './art-direction.js';

const HALF_W = TUNING.RUN.TRACK_HALF_W;

// Skyline ring. Radii stay inside the camera's far plane (420).
const RANKS = [
  { n: 52, r0: 350, r1: 392, w: [12, 26], h: [26, 78], arc: 1.35, pale: 0.55, seed: 11 },
  { n: 36, r0: 275, r1: 310, w: [10, 20], h: [12, 40], arc: 1.2, pale: 0.3, seed: 71 },
];

// Billboards: one every PITCH metres, alternating sides, far past the page.
const BB_PITCH = 96;
const BB_OFF = HALF_W + 36;
const BB_AHEAD = 380;
const BB_BEHIND = 30;
const BB_CAP = Math.ceil((BB_AHEAD + BB_BEHIND) / BB_PITCH) + 2;
const BB_W = 15;
const BB_H = 6.4;
const BB_LIFT = 9.5;

function h32(n) {
  let x = Math.imul(n | 0, 0x9e3779b1) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Facade: a pale wall with a grid of windows, some lit. Greyscale — the
 *  material colour tints it. */
function facadeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(200,200,200)';
  g.fillRect(0, 0, 64, 256);
  // Vertical shading so the tower reads as a volume, lighter at the crown.
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  for (let y = 6, row = 0; y < 250; y += 8, row++) {
    for (let x = 4, col = 0; x < 60; x += 7, col++) {
      const lit = h32(row * 31 + col * 7) < 0.16;
      g.fillStyle = lit ? 'rgb(255,255,255)' : 'rgb(176,176,176)';
      g.fillRect(x, y, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Billboard face: a frame, a bright block, and greeked lines — bars only. */
function billboardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 110;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(28,28,28)';
  g.fillRect(0, 0, 256, 110);
  g.strokeStyle = 'rgb(255,255,255)';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 248, 102);
  g.fillStyle = 'rgb(255,255,255)';
  g.fillRect(18, 22, 72, 66);                    // the image block
  g.fillStyle = 'rgb(235,235,235)';
  g.fillRect(104, 24, 128, 14);                  // headline bar
  g.fillStyle = 'rgb(150,150,150)';
  for (let i = 0; i < 4; i++) g.fillRect(104, 50 + i * 11, 128 - (i % 2) * 34 - (i === 3 ? 50 : 0), 5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Landmarks {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.entries = [];

    this.skyline = new THREE.Group();
    this.skyline.name = 'skyline';
    scene.add(this.skyline);

    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const facade = facadeTexture();
    this.rankMats = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    const shade = new THREE.Color();

    for (const rank of RANKS) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: facade, fog: false });
      const mesh = new THREE.InstancedMesh(box, mat, rank.n);
      mesh.frustumCulled = false;
      for (let i = 0; i < rank.n; i++) {
        const k = rank.seed * 1000 + i;
        const a = (i / (rank.n - 1) - 0.5) * 2 * rank.arc + (h32(k) - 0.5) * 0.04;
        const r = rank.r0 + h32(k + 1) * (rank.r1 - rank.r0);
        const w = rank.w[0] + h32(k + 2) * (rank.w[1] - rank.w[0]);
        // A clustered downtown: the tallest towers gather dead ahead.
        const centre = Math.cos(a * 1.4) * 0.5 + 0.5;
        const h = rank.h[0] + (rank.h[1] - rank.h[0]) * (0.35 * h32(k + 3) + 0.65 * centre * h32(k + 4));
        this._p.set(Math.sin(a) * r, -24, -Math.cos(a) * r);
        this._q.setFromAxisAngle(this._up, -a);
        this._s.set(w, h + 24, w * (0.6 + 0.5 * h32(k + 5)));
        this._m.compose(this._p, this._q, this._s);
        mesh.setMatrixAt(i, this._m);
        mesh.setColorAt(i, shade.setScalar(0.86 + 0.22 * h32(k + 6)));
      }
      mesh.renderOrder = -10;
      this.skyline.add(mesh);
      this.rankMats.push(mat);
    }

    // Billboards: one instanced face, one instanced pair of posts.
    this.bbFaceMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, map: billboardTexture(), fog: true, side: THREE.DoubleSide,
    });
    this.bbFaces = new THREE.InstancedMesh(new THREE.PlaneGeometry(BB_W, BB_H), this.bbFaceMat, BB_CAP);
    this.bbPostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    this.bbPosts = new THREE.InstancedMesh(box, this.bbPostMat, BB_CAP * 2);
    for (const m of [this.bbFaces, this.bbPosts]) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }

    this._fog = new THREE.Color();
    this._crest = new THREE.Color();
    this._ice = new THREE.Color();
    this._mix = new THREE.Color();
    this._anchor = null;
  }

  reset() {
    this._anchor = null;
  }

  _layBillboards(d0) {
    const t = this.terrain;
    let faces = 0, posts = 0;
    const k0 = Math.floor((d0 - BB_BEHIND) / BB_PITCH);
    const k1 = Math.ceil((d0 + BB_AHEAD) / BB_PITCH);
    for (let k = k0; k <= k1 && faces < BB_CAP; k++) {
      if (k < 1) continue;
      const d = k * BB_PITCH + (h32(k) - 0.5) * 20;
      const seg = t.segTypeAt ? t.segTypeAt(d) : 'straight';
      if (seg === 'drop' || seg === 'tunnel') continue;
      const side = (k % 2) ? 1 : -1;
      const x = t.corridorX(d) + side * BB_OFF;
      const gy = t.heightAt(x, d);
      const lift = BB_LIFT + h32(k + 9) * 3;
      // Angled toward the oncoming runner, the way a roadside hoarding is.
      this._q.setFromAxisAngle(this._up, -side * 0.55);
      this._p.set(x, gy + lift, -d);
      this._s.set(1, 1, 1);
      this._m.compose(this._p, this._q, this._s);
      this.bbFaces.setMatrixAt(faces++, this._m);
      for (const px of [-0.3, 0.3]) {
        const ox = Math.cos(0.55) * BB_W * px;
        const oz = Math.sin(0.55) * BB_W * px * side;
        this._p.set(x + ox, gy - 1, -d + oz);
        this._s.set(0.45, lift - BB_H / 2 + 1, 0.45);
        this._m.compose(this._p, this._q, this._s);
        this.bbPosts.setMatrixAt(posts++, this._m);
      }
    }
    this.bbFaces.count = faces;
    this.bbPosts.count = posts;
    this.bbFaces.instanceMatrix.needsUpdate = true;
    this.bbPosts.instanceMatrix.needsUpdate = true;
  }

  update(playerD) {
    const t = this.terrain;
    if (!t) return;
    const d = Math.max(0, playerD || 0);
    const cx = t.corridorX(d);
    this.skyline.position.set(cx, t.heightAt(cx, d), -d);

    if (this._anchor == null || Math.abs(d - this._anchor) > 40) {
      this._anchor = d;
      this._layBillboards(d);
    }

    // Tint: the live fog (so the endgame sky carries it) pushed toward the
    // band crest — pale towers standing out of the haze.
    const mix = bandBlend(d, 220);
    const a = MOUNTAIN_BANDS[mix.from], b = MOUNTAIN_BANDS[mix.to];
    this._crest.setHex(a.crest).lerp(this._mix.setHex(b.crest), mix.t);
    this._ice.setHex(a.ice).lerp(this._mix.setHex(b.ice), mix.t);
    this._fog.copy(this.scene.fog.color);
    const bright = this._fog.r + this._fog.g + this._fog.b > 1.5;
    RANKS.forEach((rank, i) => {
      const c = this.rankMats[i].color.copy(this._fog);
      if (bright) c.multiplyScalar(0.9 - 0.12 * i);       // whiteout: towers read darker
      else {
        // Pale and hazy: crest toward grey, so the towers read as distance,
        // not as a second neon layer competing with the road.
        c.lerp(this._crest, rank.pale);
        const l = (c.r + c.g + c.b) / 3;
        c.lerp(this._mix.setRGB(l, l, l), 0.45).multiplyScalar(1.5 - 0.45 * i);
      }
    });
    this.bbFaceMat.color.copy(this._ice).multiplyScalar(1.6);
    this.bbPostMat.color.copy(this._fog).lerp(this._crest, 0.25);
  }
}

export default Landmarks;
