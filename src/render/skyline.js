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
import { GLOW_LAYER } from './glow-pass.js';
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
  // Roadside signs are parked (owner call, RC13.4): the city reads cleaner
  // without them. Flip to true to bring them back — code and gates stay live.
  SIGNS_ON: false,
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
  varying vec3 vNormalW;
  varying float vDist;
  void main() {
    vec3 sx = vec3(instanceMatrix[0].xyz), sy = vec3(instanceMatrix[1].xyz), sz = vec3(instanceMatrix[2].xyz);
    vSize = vec3(length(sx), length(sy), length(sz));
    vLocal = position;
    vNormalL = normal;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
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
  uniform float uTime;
  uniform vec3 uHaze;    // RC14.1: the horizon's city-glow, which the towers fade into
  uniform vec3 uLight2;  // a cooler second window tint
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalL;
  varying vec3 vNormalW;
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
      // TOWERS (RC14.1 facade): a glass curtain wall in a slab-and-mullion
      // frame, shaded by orientation so each tower reads as a volume, hazed
      // at the base, panes in two cool tints with a slow twinkle — and the
      // brightest panes are HDR, so they bloom in the glow pass.
      if (n.y < 0.5) {
        float hy = vLocal.y + 0.5;                       // 0 base .. 1 crown
        // Orientation: faces turned across the street catch the city's glow;
        // faces square to the runner sit in their own shadow.
        float side = abs(vNormalW.x);
        vec3 body = uBody * (0.55 + 0.75 * side) * (0.78 + 0.32 * hy);
        vec2 cell = vec2(f.x / 3.4, f.y / 4.2);
        vec2 g = fract(cell);
        // The frame: floor slabs and mullions, faintly lit edges of glass.
        float slab = 1.0 - smoothstep(0.0, 0.07, min(g.y, 1.0 - g.y));
        float mull = 1.0 - smoothstep(0.0, 0.05, min(g.x, 1.0 - g.x));
        body += uLight * 0.07 * max(slab, mull * 0.6);
        float pane = step(0.14, g.x) * step(g.x, 0.86) * step(0.2, g.y) * step(g.y, 0.8);
        vec2 id = floor(cell) + floor(vSize.xy);
        float r = hash(id);
        float on = r > 0.94 ? 1.9 : r > 0.82 ? 0.55 : r > 0.5 ? 0.16 : 0.03;
        // A slow twinkle: a few panes switch over minutes, never flicker.
        float tw = hash(id + 7.0);
        if (tw > 0.975) on = step(0.5, fract(uTime * 0.03 + tw * 13.0)) * 1.2;
        vec3 tint = mix(uLight, uLight2, step(0.6, hash(id + 3.0)));
        col = body + tint * pane * on * uLit * (0.85 + 0.35 * uFlow);
        // The crown: a lit cap line, and a beacon on the tall ones.
        col += uLight * 0.45 * smoothstep(0.485, 0.5, vLocal.y);
        float beacon = step(110.0, vSize.y) * step(0.494, vLocal.y) * step(abs(f.x), 0.9);
        col += vec3(1.6) * beacon * (0.55 + 0.45 * sin(uTime * 2.2 + hash(floor(vSize.xz)) * 6.28));
        // Ground haze: the street-level glow swallows the bases.
        col = mix(col, uHaze, (1.0 - smoothstep(0.0, 0.3, hy)) * 0.5);
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
    float fade = smoothstep(uFadeNear, uFadeFar, vDist) * (uMode < 0.5 ? 0.82 : 1.0);
    gl_FragColor = vec4(mix(col, uMode < 0.5 ? uHaze : uSky, fade), 1.0);
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
      uTime: { value: 0 },
      uHaze: { value: new THREE.Color(0x0a1a28) },
      uLight2: { value: new THREE.Color(0xe6f0ff) },
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
    this.towers.layers.enable(GLOW_LAYER);   // lit windows bloom (render/glow-pass.js)
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

    // RC14.1 — THE CITY'S LIGHT. A sky dome whose horizon carries the glow
    // of the city below it (the band the towers fade into, so they stand in
    // atmosphere instead of against a flat colour), and searchlight beams
    // sweeping slowly out of the skyline. Cool tones only: every warm hue is
    // reserved for a signal (TUNING.META.RESERVED_HUES).
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(940, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSky: { value: new THREE.Color(0x06101a) }, uHaze: { value: new THREE.Color(0x0a1a28) },
        uGlow: { value: new THREE.Color(0x7fd2ff) }, uFlow: { value: 0 } },
      vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform vec3 uSky; uniform vec3 uHaze; uniform vec3 uGlow; uniform float uFlow;
        varying vec3 vDir;
        void main(){
          float y = vDir.y;
          vec3 c = mix(uHaze, uSky * 0.62, smoothstep(0.0, 0.42, y));
          c = mix(c, uHaze * 0.8, 1.0 - smoothstep(-0.08, 0.0, y));
          // The light dome over the city ahead: brightest at the vanishing point.
          float ahead = pow(max(dot(vDir, normalize(vec3(0.0, 0.05, -1.0))), 0.0), 6.0);
          c += uGlow * ahead * (0.07 + 0.05 * uFlow) * (1.0 - smoothstep(0.0, 0.5, y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const beamTex = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 128;
      const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
      return new THREE.CanvasTexture(c);
    })();
    const beamGeo = new THREE.CylinderGeometry(16, 1.2, 520, 14, 1, true);
    beamGeo.translate(0, 260, 0);
    this.beams = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
        color: 0xbfe6ff, alphaMap: beamTex, transparent: true, opacity: 0.055,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      }));
      m.frustumCulled = false;
      m.userData = { side: i === 1 ? 1 : -1, ahead: 520 + i * 140, lateral: 150 + i * 40, phase: i * 2.1 };
      this.group.add(m);
      return m;
    });
    this._haze = new THREE.Color();
    this._glowCol = new THREE.Color(0x7fd2ff);
  }

  /** Per frame: re-lay when the window has moved a slot; tint every frame. */
  update(playerD, { sky, flow = 0 } = {}) {
    const now = performance.now() / 1000;
    if (sky?.isColor) {
      this.towerMat.uniforms.uSky.value.copy(sky); this.signMat.uniforms.uSky.value.copy(sky);
      // The haze: the sky, lifted by the city's own light (more with flow).
      this._haze.copy(sky).multiplyScalar(1.3).add(this._glowCol.clone().multiplyScalar(0.05 + 0.03 * flow));
      this.towerMat.uniforms.uHaze.value.copy(this._haze);
      this.dome.material.uniforms.uSky.value.copy(sky);
      this.dome.material.uniforms.uHaze.value.copy(this._haze);
    }
    this.towerMat.uniforms.uFlow.value = flow;
    this.towerMat.uniforms.uTime.value = now;
    this.dome.material.uniforms.uFlow.value = flow;
    const t = this.terrain;
    if (!t) return;
    // The dome and the beams travel with the runner; the beams sweep slowly.
    {
      const cx = t.corridorX(playerD);
      this.dome.position.set(cx, t.baseHeight(playerD), -playerD);
      for (const b of this.beams) {
        const u = b.userData;
        const d = playerD + u.ahead;
        b.position.set(t.corridorX(d) + u.side * u.lateral, t.baseHeight(d) - 10, -d);
        b.rotation.set(0.18 * Math.sin(now * 0.11 + u.phase), 0, u.side * (0.28 + 0.22 * Math.sin(now * 0.17 + u.phase)));
      }
    }
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
    for (let k = Math.max(1, j0); SKYLINE.SIGNS_ON && k <= j1 && s < SIGN_CAP; k++) {
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
