/**
 * The city of the key art — distant monoliths and roadside lightbox signs.
 *
 * Two instanced meshes, streamed with the runner and placed deterministically
 * per seed, so the DAILY RUN's skyline is the same for everyone:
 *
 *   TOWERS     pale monoliths 55–250 m off the track, their windows a lattice
 *              of lit panes, fading into the sky by their own distance curve
 *              (the world fog ends at 255 m and would swallow a horizon).
 *   BILLBOARDS backlit sign faces on posts, angled to meet the runner. They
 *              carry GREEKED type — bars, never glyphs — because the plate is
 *              the only readable text in this world, and a sign the eye could
 *              read would compete with the one it must.
 *
 * Neither is ever between the camera and the plate: both stand outside the
 * page margins (render/editorial-layout.js), and both sit well under the
 * plate's brightness — the world is lit, the word is lighter.
 * No hue is new: the panes and faces are the pale cyan-white of the plate's
 * own light; red stays the Redline's alone.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const HW = TUNING.RUN.TRACK_HALF_W;

export const SKYLINE = Object.freeze({
  TOWER_SPACING_M: 18,
  TOWER_BACK_M: 120,
  TOWER_AHEAD_M: 900,
  TOWER_NEAR_X: 90,
  TOWER_FAR_X: 320,
  SIGN_SPACING_M: 64,
  SIGN_BACK_M: 40,
  SIGN_AHEAD_M: 300,
  SIGN_X: HW + 15,
});

const TOWER_CAP = Math.ceil((SKYLINE.TOWER_BACK_M + SKYLINE.TOWER_AHEAD_M) / SKYLINE.TOWER_SPACING_M) * 2 + 4;
const SIGN_CAP = Math.ceil((SKYLINE.SIGN_BACK_M + SKYLINE.SIGN_AHEAD_M) / SKYLINE.SIGN_SPACING_M) + 2;

/** Deterministic [0,1) from a seed and a slot. */
export function hash01(seed, a, b = 0) {
  let x = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** The tower in slot k on a side: pure, so a gate can walk it. */
export function towerAt(seed, k, side) {
  const h = (n) => hash01(seed, k, side * 31 + n);
  const d = k * SKYLINE.TOWER_SPACING_M + h(1) * SKYLINE.TOWER_SPACING_M * 0.8;
  const lateral = SKYLINE.TOWER_NEAR_X + Math.pow(h(2), 0.7) * (SKYLINE.TOWER_FAR_X - SKYLINE.TOWER_NEAR_X);
  return {
    d, side, lateral,
    w: 9 + h(3) * 14,
    depth: 9 + h(4) * 14,
    height: 22 + Math.pow(h(5), 1.8) * 80 + (lateral / SKYLINE.TOWER_FAR_X) * 50,
    yaw: (h(6) - 0.5) * 0.5,
  };
}

/** The sign in slot k: alternate sides, angled to meet the runner. */
export function signAt(seed, k) {
  const h = (n) => hash01(seed, k, 900 + n);
  return {
    d: k * SKYLINE.SIGN_SPACING_M + h(1) * 18,
    side: (k & 1) ? 1 : -1,
    lateral: SKYLINE.SIGN_X + h(2) * 6,
    w: 7.5 + h(3) * 3,
    h: 3.4 + h(4) * 1.2,
    lift: 4.2 + h(5) * 2.2,
  };
}

// One shader for both meshes: lit panes (towers) or greeked type (signs) on
// a box face, faded into the sky by distance from the camera.
const VERT = /* glsl */`
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalL;
  varying float vDist;
  void main() {
    vec3 sx = vec3(instanceMatrix[0].xyz), sy = vec3(instanceMatrix[1].xyz), sz = vec3(instanceMatrix[2].xyz);
    vSize = vec3(length(sx), length(sy), length(sz));
    vLocal = position;
    vNormalL = normal;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uBody;
  uniform vec3 uLight;
  uniform vec3 uSky;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform float uLit;
  uniform float uMode;   // 0 towers, 1 signs
  uniform float uFlow;
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalL;
  varying float vDist;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 n = abs(vNormalL);
    // Face coordinates in metres.
    vec2 f = n.x > 0.5 ? vec2(vLocal.z * vSize.z, vLocal.y * vSize.y)
           : n.z > 0.5 ? vec2(vLocal.x * vSize.x, vLocal.y * vSize.y)
           : vec2(vLocal.x * vSize.x, vLocal.z * vSize.z);
    vec3 col = uBody;
    if (uMode < 0.5) {
      // TOWERS: panes in a lattice; most lit faintly, a few burning.
      if (n.y < 0.5) {
        vec2 cell = vec2(f.x / 3.4, f.y / 4.2);
        vec2 g = fract(cell);
        float pane = step(0.18, g.x) * step(g.x, 0.82) * step(0.22, g.y) * step(g.y, 0.78);
        float r = hash(floor(cell) + floor(vSize.xy));
        float on = r > 0.93 ? 0.75 : r > 0.55 ? 0.18 : 0.04;
        col = mix(uBody, uLight, pane * on * uLit * (0.85 + 0.3 * uFlow));
        // The crown: a lit cap line, the silhouette's edge against the sky.
        col += uLight * 0.35 * smoothstep(0.47, 0.5, vLocal.y);
      }
    } else {
      // SIGNS: a backlit face (+z) with greeked lines of type — bars, never
      // glyphs. The back and the edges stay dark housing.
      if (vNormalL.z > 0.5) {
        vec2 u = vLocal.xy + 0.5;                 // 0..1 across the face
        float frame = step(0.04, u.x) * step(u.x, 0.96) * step(0.07, u.y) * step(u.y, 0.93);
        float row = floor(u.y * 6.0);
        float g = fract(u.y * 6.0);
        float len = 0.35 + 0.55 * hash(vec2(row, floor(vSize.x * 3.0)));
        float bar = step(0.32, g) * step(g, 0.62) * step(0.1, u.x) * step(u.x, 0.1 + len * 0.8);
        bar *= step(1.0, row) * step(row, 4.0);
        vec3 face = mix(uLight, uLight * 0.62, bar);
        col = mix(uBody * 1.6, face * uLit, frame);
      }
    }
    float fade = smoothstep(uFadeNear, uFadeFar, vDist) * (uMode < 0.5 ? 0.78 : 1.0);
    gl_FragColor = vec4(mix(col, uSky, fade), 1.0);
  }
`;

function shaderMat(mode, fadeNear, fadeFar, lit) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uBody: { value: new THREE.Color(mode ? 0x0b141d : 0x3a5066) },
      uLight: { value: new THREE.Color(mode ? 0xd8ecf6 : 0xbfe6f5) },
      uSky: { value: new THREE.Color(0x06101a) },
      uFadeNear: { value: fadeNear },
      uFadeFar: { value: fadeFar },
      uLit: { value: lit },
      uMode: { value: mode },
      uFlow: { value: 0 },
    },
    fog: false,
  });
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class Skyline {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'skyline';
    scene.add(this.group);
    const box = new THREE.BoxGeometry(1, 1, 1);

    this.towerMat = shaderMat(0, 220, 980, 1.0);
    this.towers = new THREE.InstancedMesh(box, this.towerMat, TOWER_CAP);
    this.towers.frustumCulled = false;
    this.group.add(this.towers);

    // Signs are dimmer than the plate by construction (uLit < the plate's
    // un-tone-mapped white), and fade sooner.
    this.signMat = shaderMat(1, 70, 300, 0.78);
    this.signs = new THREE.InstancedMesh(box, this.signMat, SIGN_CAP);
    this.signs.frustumCulled = false;
    this.group.add(this.signs);

    const postMat = new THREE.MeshBasicMaterial({ color: 0x0d1822, fog: true });
    this.posts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), postMat, SIGN_CAP * 2);
    this.posts.frustumCulled = false;
    this.group.add(this.posts);

    this._key = null;
  }

  /** Per frame: re-lay when the window has moved a slot; tint every frame. */
  update(playerD, { sky, flow = 0 } = {}) {
    if (sky) { this.towerMat.uniforms.uSky.value.copy(sky); this.signMat.uniforms.uSky.value.copy(sky); }
    this.towerMat.uniforms.uFlow.value = flow;
    const t = this.terrain;
    if (!t) return;
    const seed = t.seed >>> 0;
    const key = `${seed}:${Math.floor(playerD / SKYLINE.TOWER_SPACING_M)}:${Math.floor(playerD / SKYLINE.SIGN_SPACING_M)}`;
    if (key === this._key) return;
    this._key = key;

    // Towers.
    let n = 0;
    const k0 = Math.floor((playerD - SKYLINE.TOWER_BACK_M) / SKYLINE.TOWER_SPACING_M);
    const k1 = Math.ceil((playerD + SKYLINE.TOWER_AHEAD_M) / SKYLINE.TOWER_SPACING_M);
    for (let k = Math.max(0, k0); k <= k1 && n < TOWER_CAP - 1; k++) {
      for (const side of [-1, 1]) {
        const tw = towerAt(seed, k, side);
        const cx = t.corridorX(tw.d);
        // Buried at the route's elevation, so a climb never leaves one
        // standing on air and a descent never sinks the skyline.
        const base = t.baseHeight(tw.d) - 18;
        _p.set(cx + side * tw.lateral, base + tw.height / 2, -tw.d);
        _q.setFromAxisAngle(_up, tw.yaw);
        _s.set(tw.w, tw.height, tw.depth);
        _m.compose(_p, _q, _s);
        this.towers.setMatrixAt(n++, _m);
      }
    }
    this.towers.count = n;
    this.towers.instanceMatrix.needsUpdate = true;

    // Signs and their posts.
    let s = 0;
    let q = 0;
    const j0 = Math.floor((playerD - SKYLINE.SIGN_BACK_M) / SKYLINE.SIGN_SPACING_M);
    const j1 = Math.ceil((playerD + SKYLINE.SIGN_AHEAD_M) / SKYLINE.SIGN_SPACING_M);
    for (let k = Math.max(1, j0); k <= j1 && s < SIGN_CAP; k++) {
      const sg = signAt(seed, k);
      const cx = t.corridorX(sg.d);
      const x = cx + sg.side * sg.lateral;
      const ground = t.baseHeight(sg.d);
      // Face the oncoming runner: the box's +z face turns toward the camera
      // (the runner travels −z) and angles in toward the road.
      const yaw = -sg.side * 0.62;
      _q.setFromAxisAngle(_up, yaw);
      _p.set(x, ground + sg.lift + sg.h / 2, -sg.d);
      _s.set(sg.w, sg.h, 0.35);
      _m.compose(_p, _q, _s);
      this.signs.setMatrixAt(s++, _m);
      // Two posts under the face, along its own width.
      for (const off of [-0.32, 0.32]) {
        _p.set(x + Math.cos(yaw) * off * sg.w, ground + sg.lift / 2, -sg.d - Math.sin(yaw) * off * sg.w);
        _q.identity();
        _s.set(0.28, sg.lift, 0.28);
        _m.compose(_p, _q, _s);
        this.posts.setMatrixAt(q++, _m);
      }
    }
    this.signs.count = s;
    this.posts.count = q;
    this.signs.instanceMatrix.needsUpdate = true;
    this.posts.instanceMatrix.needsUpdate = true;
  }

  reset() { this._key = null; }
}
