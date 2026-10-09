/**
 * CITY STREETS — the street-level city the runner now runs through.
 *
 * The skyline (render/skyline.js) put a city on the horizon, but the middle
 * distance was still the void the runner used to cross: black ground beyond
 * the rails, flat page marks floating on nothing. This file fills it, as
 * three layers streamed with the runner and placed deterministically per
 * seed, so the DAILY RUN's street is the same for everyone:
 *
 *   BUILDINGS  low, gappy blocks of lit facades 3.5–10 m off the rails, three
 *              to eight storeys, cross streets between them. One instanced
 *              draw; the window lattice is computed in the shader.
 *   PAVEMENT   a dark wet ground either side of the road, following the
 *              route. It writes a fainter wet mask than the road, so the
 *              mirror (render/road-reflection.js) rains on the whole street.
 *   LAMPS      a sparing line of street lamps, alternating kerbs, each with a
 *              soft pool of light.
 *
 * Rules: the plate is the brightest thing in frame — facades sit well under
 * it, and nothing here carries a glyph. Cool tints only (the reserved hues
 * stay reserved). Behind every walled place (tunnel, canyon, narrows) the
 * blocks step back and down so the page's walls stand in front of an
 * unbroken city; into a drop the city shrinks away and grows back. Five
 * facade styles (glass, concrete, ribbon floors, dark office, residential)
 * and roof crowns are all in the shader and the instance list — no images.
 * Nothing pulses, so REDUCED FLASH has nothing to damp.
 *
 * Integration is explicit: main.js constructs it and calls update() each
 * frame with the CITY STREETS setting; nothing wraps a live function.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { hash01 } from './skyline.js';
import { WET_MASK } from './road-reflection.js';

const HW = TUNING.RUN.TRACK_HALF_W;

export const STREET = Object.freeze({
  SLOT_M: 15,          // one building slot per side per this many metres
  BACK_M: 40,
  AHEAD_M: 300,
  GAP_CHANCE: 0.28,    // a cross street instead of a building
  SET_BACK: [3.5, 10],  // metres from the rail to the facade (portrait FOV is narrow)
  STOREYS: [3, 8],
  STOREY_M: 3.3,
  DEPTH: [10, 18],
  WINDOWS: 0.42,       // lit-pane brightness — far under the plate's white
  PAVE_OUT_M: 70,      // pavement width beyond each rail
  PAVE_STEP_M: 4,
  PAVE_WET: 0.22,      // the street's share of the road's wet mask
  LAMP_M: 46,          // one lamp per this many metres, alternating kerbs (sparing)
  LAMP_X: HW + 1.7,
  LAMP_H: 6.4,
  POOL_R: 3.6,
  WALLED_BACK_M: 16,   // extra set-back behind canyon/tunnel/narrows walls
  DROP_FADE_M: 48,     // the city shrinks into a drop over this distance
  CROWN_CHANCE: 0.34,  // a setback storey or two on the roof
});

// Lamps still step aside for every authored place; buildings only step BACK
// behind the walled ones and ease out around a drop.
const AVOID = new Set(['tunnel', 'canyon', 'narrows', 'drop']);
const WALLED = new Set(['tunnel', 'canyon', 'narrows']);
const SLOTS = Math.ceil((STREET.BACK_M + STREET.AHEAD_M) / STREET.SLOT_M) + 2;
const LAMPS = Math.ceil((STREET.BACK_M + STREET.AHEAD_M) / STREET.LAMP_M) + 2;
const ROWS = Math.ceil((STREET.BACK_M + STREET.AHEAD_M) / STREET.PAVE_STEP_M) + 1;

/** The building in slot k on a side, or null for a cross street: pure. */
export function buildingAt(seed, k, side) {
  const h = (n) => hash01(seed, k, side * 53 + n + 1000);
  if (h(0) < STREET.GAP_CHANCE) return null;
  const width = STREET.SLOT_M * (0.62 + h(1) * 0.3);
  const d = k * STREET.SLOT_M + STREET.SLOT_M / 2;
  const setBack = STREET.SET_BACK[0] + h(2) * (STREET.SET_BACK[1] - STREET.SET_BACK[0]);
  const storeys = STREET.STOREYS[0] + Math.floor(h(3) * (STREET.STOREYS[1] - STREET.STOREYS[0] + 1));
  const depth = STREET.DEPTH[0] + h(4) * (STREET.DEPTH[1] - STREET.DEPTH[0]);
  const crown = h(5) < STREET.CROWN_CHANCE ? STREET.STOREY_M * (1 + Math.floor(h(6) * 2)) : 0;
  return { d, side, width, setBack, height: storeys * STREET.STOREY_M, depth, crown };
}

const FACADE_VERT = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vL;
varying vec3 vN;
varying float vSeed;
varying float vDist;
varying float vH;
void main() {
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vL = position * sc;
  vH = sc.y;
  vN = normal;
  vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vDist = -mvPosition.z;
  #include <fog_vertex>
}
`;

const FACADE_FRAG = `
#include <common>
#include <fog_pars_fragment>
uniform float uWin;
varying vec3 vL;
varying vec3 vN;
varying float vSeed;
varying float vDist;
varying float vH;

float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  // Playtest 10/9 — five facade STYLES, one per building (quantised seed: an
  // interpolated varying drifts by ulps across a face, and a raw hash of it
  // speckles). 0 glass curtain wall · 1 concrete grid · 2 ribbon floors ·
  // 3 dark office with fins and one lit floor · 4 small-window residential.
  float bs = floor(vSeed * 64.0);
  float style = floor(fract(bs * 0.6180339) * 5.0);
  vec3 body = vec3(0.010, 0.016, 0.030);
  if (style < 0.5) body = vec3(0.012, 0.022, 0.040);
  else if (style < 1.5) body = vec3(0.018, 0.022, 0.030);
  vec3 col = body;
  float near = 1.0 - smoothstep(70.0, 160.0, vDist);
  float S = ${STREET.STOREY_M.toFixed(2)};
  if (vN.y < 0.5) {
    vec2 f = abs(vN.x) > 0.5 ? vec2(vL.z, vL.y) : vec2(vL.x, vL.y);
    float cw = style < 0.5 ? 1.6 : style > 3.5 ? 2.1 : 2.6;
    vec2 c = floor(f / vec2(cw, S));
    vec2 g = fract(f / vec2(cw, S));
    float upper = step(S, vL.y);
    float r = h1(c + bs * 1.618);
    float floorR = h1(vec2(c.y, bs));
    float win, lit;
    vec3 pane = mix(vec3(0.52, 0.72, 0.94), vec3(0.78, 0.90, 1.0), fract(r * 7.0));
    float glow = 0.45 + 0.55 * fract(r * 13.0);
    if (style < 0.5) {
      // Glass: thin mullions, near-full panes, a sky sheen rising up the face.
      win = step(0.07, g.x) * step(g.x, 0.93) * step(0.1, g.y) * step(g.y, 0.9);
      lit = step(0.72, r);
      col += win * upper * vec3(0.008, 0.02, 0.04) * (0.4 + 0.6 * vL.y / max(vH, 1.0)) * near;
    } else if (style < 1.5) {
      // Concrete grid: deep-set windows and a pale slab line at every floor.
      win = step(0.24, g.x) * step(g.x, 0.76) * step(0.3, g.y) * step(g.y, 0.74);
      lit = step(0.6, r);
      col += vec3(0.02, 0.025, 0.032) * (1.0 - step(0.07, g.y)) * upper * near;
    } else if (style < 2.5) {
      // Ribbon floors: whole storeys lit as continuous bands.
      win = step(0.04, g.x) * step(g.x, 0.96) * step(0.34, g.y) * step(g.y, 0.7);
      lit = step(0.7, floorR);
      glow = 0.55 + 0.3 * floorR;
    } else if (style < 3.5) {
      // Dark office: vertical fins, and just one floor still working.
      win = step(0.3, g.x) * step(g.x, 0.7) * step(0.3, g.y) * step(g.y, 0.74);
      float workFloor = floor(h1(vec2(bs, 3.0)) * max(1.0, vH / S - 1.0)) + 1.0;
      lit = 1.0 - step(0.5, abs(c.y - workFloor));
      col += vec3(0.016, 0.026, 0.036) * (1.0 - smoothstep(0.08, 0.14, abs(g.x - 0.5) - 0.36)) * near;
    } else {
      // Residential: small windows, a few lit late.
      win = step(0.34, g.x) * step(g.x, 0.66) * step(0.32, g.y) * step(g.y, 0.66);
      lit = step(0.66, r);
    }
    lit *= upper;
    win = mix(0.3, win, near);
    col += win * upper * (lit * pane * glow * uWin + (1.0 - lit) * vec3(0.012, 0.02, 0.034));
    // A cool storefront band at street level on some blocks.
    float store = step(0.45, fract(vSeed * 5.3))
      * smoothstep(0.35, 0.6, vL.y) * (1.0 - smoothstep(2.3, 2.6, vL.y))
      * step(0.12, g.x) * step(g.x, 0.88);
    col += vec3(0.22, 0.50, 0.70) * store * 0.55 * uWin;
    // The parapet: a pale cap along the roofline, so blocks read as forms.
    col += vec3(0.03, 0.05, 0.07) * smoothstep(vH - 0.5, vH - 0.15, vL.y);
  } else {
    col = body * 1.4;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class CityStreet {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'city-street';
    // Authored as light already — the dataworld line-art pass leaves it be.
    this.group.userData.dataworldSkip = true;
    scene.add(this.group);

    // BUILDINGS — a unit box standing on y = 0.
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    this.facadeMat = new THREE.ShaderMaterial({
      vertexShader: FACADE_VERT,
      fragmentShader: FACADE_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uWin: { value: STREET.WINDOWS } }]),
      fog: true,
    });
    this.buildings = new THREE.InstancedMesh(box, this.facadeMat, SLOTS * 4); // a block + its crown
    this.buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.buildings.frustumCulled = false;
    this.group.add(this.buildings);

    // PAVEMENT — two ribbons, rebuilt from the route every frame (cheap:
    // four vertices a row). `across` carries metres from the rail.
    const pg = new THREE.BufferGeometry();
    this._pos = new Float32Array(ROWS * 4 * 3);
    const across = new Float32Array(ROWS * 4);
    for (let r = 0; r < ROWS; r++) {
      across[r * 4 + 0] = STREET.PAVE_OUT_M;
      across[r * 4 + 1] = 0;
      across[r * 4 + 2] = 0;
      across[r * 4 + 3] = STREET.PAVE_OUT_M;
    }
    const idx = [];
    for (let r = 0; r < ROWS - 1; r++) {
      const a = r * 4, b = (r + 1) * 4;
      idx.push(a, b, a + 1, a + 1, b, b + 1);         // left ribbon
      idx.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3); // right ribbon
    }
    pg.setIndex(idx);
    pg.setAttribute('position', new THREE.BufferAttribute(this._pos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('across', new THREE.BufferAttribute(across, 1));
    pg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(ROWS * 4 * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    this.paveMat = new THREE.MeshStandardMaterial({
      color: 0x2c3f5a, emissive: 0x0b1626, roughness: 0.38, metalness: 0.1, side: THREE.DoubleSide,
    });
    this.paveMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWetMask = WET_MASK;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float across;\nvarying float vAcross;\nvarying vec3 vPaveW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAcross = across;\nvPaveW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWetMask;\nvarying float vAcross;\nvarying vec3 vPaveW;')
        // The kerb: a slightly paler sidewalk band right off the rail.
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 + 0.9 * (1.0 - smoothstep(2.6, 3.2, vAcross));')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float pD = length(vPaveW - cameraPosition);
          float pm = smoothstep(4.0, 14.0, pD) * (1.0 - smoothstep(90.0, 200.0, pD));
          gl_FragColor.a = 1.0 - pm * ${STREET.PAVE_WET.toFixed(2)} * uWetMask;
        }`);
    };
    this.paveMat.customProgramCacheKey = () => 'dictiondash-city-pavement';
    this.pavement = new THREE.Mesh(pg, this.paveMat);
    this.pavement.frustumCulled = false;
    this.group.add(this.pavement);

    // LAMPS — pole + arm (one dark mesh), head (pale), pool (additive).
    const pole = new THREE.BoxGeometry(0.14, STREET.LAMP_H, 0.14);
    pole.translate(0, STREET.LAMP_H / 2, 0);
    const arm = new THREE.BoxGeometry(1.7, 0.1, 0.1);
    arm.translate(0.85, STREET.LAMP_H - 0.05, 0);
    const lampGeo = mergeBoxes(pole, arm);
    this.poles = new THREE.InstancedMesh(lampGeo,
      new THREE.MeshBasicMaterial({ color: 0x1b2a3a, fog: true }), LAMPS);
    const head = new THREE.BoxGeometry(0.6, 0.1, 0.26);
    head.translate(1.45, STREET.LAMP_H - 0.14, 0);
    this.heads = new THREE.InstancedMesh(head,
      new THREE.MeshBasicMaterial({ color: 0xcfeeff, fog: true, toneMapped: false }), LAMPS);
    const poolGeo = new THREE.PlaneGeometry(STREET.POOL_R * 2, STREET.POOL_R * 2);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.translate(1.45, 0.04, 0);
    this.pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({
      color: 0x5fa8d8, map: poolTexture(), transparent: true, opacity: 0.26,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    }), LAMPS);
    for (const m of [this.poles, this.heads, this.pools]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.group.add(m);
    }

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._y = new THREE.Vector3(0, 1, 0);
  }

  _avoid(d0, d1, set = AVOID) {
    const t = this.terrain;
    if (!t.segTypeAt) return false;
    for (let d = d0; d <= d1; d += 4) if (set.has(t.segTypeAt(d))) return true;
    return set.has(t.segTypeAt(d1));
  }

  /** 1 clear of any drop, easing to 0 at its edge (0 inside it). */
  _dropFade(d) {
    const t = this.terrain;
    if (!t.segTypeAt) return 1;
    let nearest = Infinity;
    for (let o = -STREET.DROP_FADE_M; o <= STREET.DROP_FADE_M; o += 6) {
      if (t.segTypeAt(d + o) === 'drop') nearest = Math.min(nearest, Math.abs(o));
    }
    if (nearest === Infinity) return 1;
    const x = Math.min(1, nearest / STREET.DROP_FADE_M);
    return x * x * (3 - 2 * x);
  }

  /** Heading of the route at d, as a yaw that turns local -Z down the road. */
  _yaw(d) {
    const dx = this.terrain.corridorX(d + 1) - this.terrain.corridorX(d - 1);
    return Math.atan2(-dx / 2, 1);
  }

  update(playerD, on) {
    this.group.visible = !!on;
    if (!on) return;
    const t = this.terrain;

    // Buildings.
    let n = 0;
    const k0 = Math.floor((playerD - STREET.BACK_M) / STREET.SLOT_M);
    for (let k = k0; k < k0 + SLOTS; k++) {
      for (const side of [-1, 1]) {
        const b = buildingAt(t.seed >>> 0, k, side);
        if (!b) continue;
        // Playtest 10/9 — no gaps. Authored walls (canyon, tunnel, narrows)
        // stand in FRONT of the city: the block steps back and down behind
        // them. A drop stays the designed empty moment, and the city
        // shrinks into it and grows back out over DROP_FADE_M.
        const walled = this._avoid(b.d - b.width / 2 - 6, b.d + b.width / 2 + 6, WALLED);
        const dropFade = this._dropFade(b.d);
        if (dropFade <= 0.02) continue;
        const setBack = b.setBack + (walled ? STREET.WALLED_BACK_M : 0);
        const height = b.height * (walled ? 0.8 : 1) * dropFade;
        const off = HW + setBack + b.depth / 2;
        const x = t.corridorX(b.d) + side * off;
        const y = t.heightAt(t.corridorX(b.d) + side * HW, b.d) - 0.4;
        this._q.setFromAxisAngle(this._y, this._yaw(b.d));
        this._s.set(b.depth, height + 0.4, b.width);
        this._p.set(x, y, -b.d);
        this._m.compose(this._p, this._q, this._s);
        this.buildings.setMatrixAt(n++, this._m);
        // A crown on some blocks: a setback storey or two on the roof.
        if (b.crown > 0 && dropFade > 0.98) {
          this._s.set(b.depth * 0.62, b.crown, b.width * 0.62);
          this._p.set(x, y + height + 0.4, -b.d);
          this._m.compose(this._p, this._q, this._s);
          this.buildings.setMatrixAt(n++, this._m);
        }
      }
    }
    this.buildings.count = n;
    this.buildings.instanceMatrix.needsUpdate = true;

    // Pavement.
    const p = this._pos;
    const dA = Math.floor((playerD - STREET.BACK_M) / STREET.PAVE_STEP_M) * STREET.PAVE_STEP_M;
    for (let r = 0; r < ROWS; r++) {
      const d = dA + r * STREET.PAVE_STEP_M;
      const cx = t.corridorX(d);
      const yl = t.heightAt(cx - HW, d) - 0.06;
      const yr = t.heightAt(cx + HW, d) - 0.06;
      const xs = [cx - HW - STREET.PAVE_OUT_M, cx - HW + 0.3, cx + HW - 0.3, cx + HW + STREET.PAVE_OUT_M];
      const ys = [yl, yl, yr, yr];
      for (let j = 0; j < 4; j++) {
        const o = (r * 4 + j) * 3;
        p[o] = xs[j]; p[o + 1] = ys[j]; p[o + 2] = -d;
      }
    }
    this.pavement.geometry.attributes.position.needsUpdate = true;

    // Lamps — sparing: one per LAMP_M, alternating kerbs, arms reaching in.
    let L = 0;
    const l0 = Math.floor((playerD - STREET.BACK_M) / STREET.LAMP_M);
    for (let k = l0; k < l0 + LAMPS; k++) {
      {
        const side = (k & 1) ? 1 : -1;
        const d = k * STREET.LAMP_M + STREET.LAMP_M / 2;
        if (this._avoid(d - 2, d + 2)) continue;
        const x = t.corridorX(d) + side * STREET.LAMP_X;
        const y = t.heightAt(x, d);
        // Local +X is the arm; point it across the road toward the centre.
        this._q.setFromAxisAngle(this._y, this._yaw(d) + (side > 0 ? Math.PI : 0));
        this._s.set(1, 1, 1);
        this._p.set(x, y, -d);
        this._m.compose(this._p, this._q, this._s);
        this.poles.setMatrixAt(L, this._m);
        this.heads.setMatrixAt(L, this._m);
        this.pools.setMatrixAt(L, this._m);
        L++;
      }
    }
    for (const m of [this.poles, this.heads, this.pools]) {
      m.count = L;
      m.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Two non-indexed-compatible boxes into one geometry (positions + normals). */
function mergeBoxes(a, b) {
  const out = new THREE.BufferGeometry();
  const parts = [a.toNonIndexed(), b.toNonIndexed()];
  for (const name of ['position', 'normal']) {
    const arrs = parts.map((g) => g.attributes[name].array);
    const merged = new Float32Array(arrs.reduce((s, x) => s + x.length, 0));
    let o = 0;
    for (const x of arrs) { merged.set(x, o); o += x.length; }
    out.setAttribute(name, new THREE.BufferAttribute(merged, 3));
  }
  return out;
}
