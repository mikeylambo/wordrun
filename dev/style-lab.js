/**
 * Dev-only cel-shading mockup lab. Never imported by src/, never bundled.
 * Wraps Stage.render with a fullscreen treatment pass so every candidate look
 * is applied to the real scene at the same seed, camera and frame.
 */
import * as THREE from 'three';

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uPx;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uBands;      // luminance quantisation steps
uniform float uInk;        // outline strength
uniform float uInkWidth;   // outline sample radius (px)
uniform float uLumaInk;    // how much the outline listens to colour steps
uniform float uHalf;       // halftone strength
uniform float uHalfScale;  // halftone dot pitch (px)
uniform float uGlow;       // bright-pass bleed
uniform float uGlowRad;    // bleed radius (px)
uniform float uGlowThr;    // bleed threshold
uniform float uGrain;      // paper grain
uniform float uVign;       // vignette
uniform float uLift;       // shadow lift so bands read as ink, not mud
varying vec2 vUv;

float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  float vz = perspectiveDepthToViewZ(z, uNear, uFar);
  return -vz;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;

  // --- cel banding: quantise brightness, keep the hue ratio intact ---
  if (uBands > 0.5) {
    float l = luma(col);
    // perceptual-ish so the dark end does not collapse into one flat band
    float lp = pow(max(l, 0.0), 0.5);
    float q = floor(lp * uBands + 0.5) / uBands;
    float ql = pow(q, 2.0);
    ql = mix(ql, ql + uLift * (1.0 - ql), 1.0);
    col *= ql / max(l, 1e-4);
  }

  // --- ink: depth discontinuity + local luminance step ---
  if (uInk > 0.001) {
    vec2 w = uPx * uInkWidth;
    float d  = linDepth(vUv);
    float dl = linDepth(vUv - vec2(w.x, 0.0));
    float dr = linDepth(vUv + vec2(w.x, 0.0));
    float du = linDepth(vUv - vec2(0.0, w.y));
    float dd = linDepth(vUv + vec2(0.0, w.y));
    float dEdge = (abs(dl - dr) + abs(du - dd)) / max(d, 1.0);
    float depthLine = smoothstep(0.012, 0.075, dEdge);

    float c  = luma(col);
    float cl = luma(texture2D(tColor, vUv - vec2(w.x, 0.0)).rgb);
    float cr = luma(texture2D(tColor, vUv + vec2(w.x, 0.0)).rgb);
    float cu = luma(texture2D(tColor, vUv - vec2(0.0, w.y)).rgb);
    float cd = luma(texture2D(tColor, vUv + vec2(0.0, w.y)).rgb);
    float lEdge = abs(cl - cr) + abs(cu - cd);
    float lumaLine = smoothstep(0.10, 0.38, lEdge);

    // fade lines out at the fog wall so the horizon does not turn to scribble
    float far = 1.0 - smoothstep(uFar * 0.14, uFar * 0.42, d);
    float line = clamp(max(depthLine, lumaLine * uLumaInk), 0.0, 1.0) * far;
    col = mix(col, col * 0.10, line * uInk);
  }

  // --- bright-pass bleed: the broadcast glow around lit edges ---
  if (uGlow > 0.001) {
    vec3 bleed = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 16; i++) {
      float fi = float(i);
      float a = fi * 2.39996323;
      float r = sqrt((fi + 0.5) / 16.0) * uGlowRad;
      vec2 o = vec2(cos(a), sin(a)) * r * uPx;
      vec3 sc = texture2D(tColor, vUv + o).rgb;
      float sl = luma(sc);
      float m = smoothstep(uGlowThr, uGlowThr + 0.35, sl);
      float w = 1.0 / (1.0 + r * 0.12);
      bleed += sc * m * w;
      wsum += w;
    }
    col += (bleed / max(wsum, 1e-4)) * uGlow;
  }

  // --- halftone: a dot screen that only bites in the mid and low tones ---
  if (uHalf > 0.001) {
    float a = 0.463;
    vec2 p = vUv * uRes;
    vec2 rp = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
    float s = 6.2831853 / uHalfScale;
    float dots = sin(rp.x * s) * sin(rp.y * s);
    float l = luma(col);
    float bite = (1.0 - smoothstep(0.02, 0.55, l)) * smoothstep(0.0, 0.06, l);
    col *= 1.0 - uHalf * bite * smoothstep(0.0, 0.9, dots);
  }

  // --- paper grain ---
  if (uGrain > 0.001) {
    float n = hash(floor(vUv * uRes * 0.75));
    col += (n - 0.5) * uGrain;
  }

  if (uVign > 0.001) {
    vec2 q = vUv - 0.5;
    col *= 1.0 - uVign * dot(q, q) * 1.6;
  }

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const BASE = {
  uBands: 0, uInk: 0, uInkWidth: 1, uLumaInk: 0.75,
  uHalf: 0, uHalfScale: 8, uGlow: 0, uGlowRad: 8, uGlowThr: 0.35,
  uGrain: 0, uVign: 0, uLift: 0,
};
const style = (o) => ({ ...BASE, ...o });

export const STYLES = {
  current: null,
  // CEL — flat bands, hairline structure, nothing else added.
  toon: style({ uBands: 6, uInk: 0.5, uInkWidth: 1.0, uLumaInk: 0.28, uVign: 0.10, uLift: 0.06 }),
  // INK — fewer bands, a real drawn outline, lifted shadows.
  ink: style({ uBands: 4, uInk: 1.0, uInkWidth: 1.4, uLumaInk: 0.55, uGrain: 0.012, uVign: 0.20, uLift: 0.10 }),
  // BROADCAST — cel bands plus a bright-pass bleed: title-sequence glow.
  broadcast: style({ uBands: 5, uInk: 0.8, uInkWidth: 1.2, uLumaInk: 0.3, uGlow: 0.5, uGlowRad: 14, uGlowThr: 0.30, uVign: 0.18, uLift: 0.05 }),
  // PRESS — cel bands under a visible dot screen and paper grain.
  press: style({ uBands: 4, uInk: 0.9, uInkWidth: 1.2, uLumaInk: 0.5, uHalf: 0.55, uHalfScale: 9.0, uGrain: 0.03, uVign: 0.22, uLift: 0.14 }),
};

class Lab {
  constructor(stage, params) {
    this.stage = stage;
    const r = stage.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());

    this.depth = new THREE.DepthTexture(size.x, size.y);
    this.depth.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthTexture: this.depth,
      depthBuffer: true,
    });

    this.uniforms = {
      tColor: { value: this.rt.texture },
      tDepth: { value: this.depth },
      uPx: { value: new THREE.Vector2(1 / size.x, 1 / size.y) },
      uRes: { value: new THREE.Vector2(size.x, size.y) },
      uNear: { value: stage.camera.near },
      uFar: { value: stage.camera.far },
    };
    for (const [k, v] of Object.entries(params)) this.uniforms[k] = { value: v };

    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false })
    );
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.Camera();

    this._origRender = stage.render.bind(stage);
    stage.render = () => this.render();
    stage.__lab = this;
  }

  _resize() {
    const r = this.stage.renderer;
    const s = r.getDrawingBufferSize(new THREE.Vector2());
    if (s.x === this.rt.width && s.y === this.rt.height) return;
    this.rt.setSize(s.x, s.y);
    this.depth.image.width = s.x;
    this.depth.image.height = s.y;
    this.depth.needsUpdate = true;
    this.uniforms.uPx.value.set(1 / s.x, 1 / s.y);
    this.uniforms.uRes.value.set(s.x, s.y);
  }

  render() {
    this._resize();
    const r = this.stage.renderer;
    this.uniforms.uNear.value = this.stage.camera.near;
    this.uniforms.uFar.value = this.stage.camera.far;
    r.setRenderTarget(this.rt);
    r.render(this.stage.scene, this.stage.camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }

  dispose() {
    this.stage.render = this._origRender;
    this.rt.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    delete this.stage.__lab;
  }
}

export function applyStyle(name) {
  const stage = window.__RENDER?.stage;
  if (!stage) return 'no stage';
  if (stage.__lab) stage.__lab.dispose();
  const p = STYLES[name];
  if (!p) return 'current';
  new Lab(stage, p);
  return name;
}

window.__STYLE = applyStyle;
window.__STYLES = STYLES;

// ── Phase K: concept stills — the Editorial World as page geometry ─────────
// Typographic primitives laid along the track by flow band: margin rules,
// columns of greeked lines, punctuation as sculpture. Nothing here is a
// glyph — every "line of type" is a bar, so the background is unreadable by
// construction and the word plate stays the only text in the frame. Bands
// are the brief's five (chain 0 / 25 / 50 / 100 / 150+), not the shipped
// flow curve: a concept layer for a human to pick from, never bundled.
import TUNING from '../src/TUNING.js';
import { bandForDistance } from '../src/render/art-direction.js';

const STILL_BANDS = [0, 25, 50, 100, 150];
export function stillBand(chain) {
  let b = 0;
  for (let i = 1; i < STILL_BANDS.length; i++) if ((chain || 0) >= STILL_BANDS[i]) b = i;
  return b;
}

// Per band: how much of the page is set, and how bright the ink is.
const FILL = [0.20, 0.36, 0.58, 0.82, 1.0];
const INK = [0.42, 0.54, 0.70, 0.86, 1.0];
const ROW_PITCH = 1.5;        // metres between lines of type
const ROW_LEN = 0.55;         // depth of a line along the track
const WINDOW_BACK = 40;       // metres of page behind the runner
const WINDOW_AHEAD = 320;     // metres of page ahead (past the fog wall)
const REBUILD_AFTER = 90;     // metres of travel before the page is re-laid

// Deterministic per-row hash so the same row keeps its shape across rebuilds.
function h32(n) {
  let x = Math.imul(n | 0, 0x9e3779b1) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

class PageLayer {
  constructor(stage, terrain) {
    this.stage = stage;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'stills-page';
    stage.scene.add(this.group);

    const mat = (hex) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 1 });
    this.matRule = mat(0x2a84aa);
    this.matType = mat(0x3d6690);
    this.matMark = mat(0x2a84aa);
    this.matCap = mat(0x3d6690);

    const box = new THREE.BoxGeometry(1, 1, 1);
    const ball = new THREE.SphereGeometry(0.5, 18, 12);
    this.rules = new THREE.InstancedMesh(box, this.matRule, 420);
    this.type = new THREE.InstancedMesh(box, this.matType, 1400);
    this.stops = new THREE.InstancedMesh(ball, this.matMark, 40);
    this.dashes = new THREE.InstancedMesh(box, this.matMark, 40);
    this.brackets = new THREE.InstancedMesh(box, this.matMark, 120);
    this.caps = new THREE.InstancedMesh(box, this.matCap, 12);
    for (const m of [this.rules, this.type, this.stops, this.dashes, this.brackets, this.caps]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this.anchor = null;
    this.level = -1;
    this.bandId = null;

    this._origRender = stage.render.bind(stage);
    stage.render = () => { this.update(); this._origRender(); };
    stage.__page = this;
  }

  _put(mesh, i, x, y, z, sx, sy, sz) {
    this._p.set(x, y, z);
    this._s.set(sx, sy, sz);
    this._m.compose(this._p, this._q, this._s);
    mesh.setMatrixAt(i, this._m);
  }

  update() {
    const sim = window.__SIM;
    if (!sim) return;
    const p = sim.player;
    const level = window.__STILLS_LEVEL ?? stillBand(p.chain);
    const band = bandForDistance(Math.max(0, p.d));
    if (this.terrain !== sim.terrain) { this.terrain = sim.terrain; this.anchor = null; }
    const moved = this.anchor == null || Math.abs(p.d - this.anchor) > REBUILD_AFTER;
    if (level !== this.level || band.id !== this.bandId || moved) {
      this.level = level;
      this.bandId = band.id;
      this.anchor = p.d;
      this.build(p.d, level, band);
    }
  }

  build(d0, level, band) {
    const HW = TUNING.RUN.TRACK_HALF_W;
    const fill = FILL[level];
    const ink = INK[level];
    const ice = new THREE.Color(band.ice);
    const crest = new THREE.Color(band.crest);
    this.matRule.color.copy(ice).multiplyScalar(0.9 + 0.6 * ink);
    this.matRule.opacity = 0.35 + 0.65 * ink;
    this.matType.color.copy(crest).multiplyScalar(0.8 + 0.9 * ink);
    this.matType.opacity = 0.30 + 0.70 * ink;
    this.matMark.color.copy(ice).multiplyScalar(1.0 + 0.7 * ink);
    this.matMark.opacity = 0.5 + 0.5 * ink;
    this.matCap.color.copy(crest).multiplyScalar(1.6);
    this.matCap.opacity = 0.95;

    const line = (d) => this.terrain.corridorX(d);
    const dA = Math.floor((d0 - WINDOW_BACK) / ROW_PITCH) * ROW_PITCH;
    const dB = d0 + WINDOW_AHEAD;

    // Margin rules: one hairline each side at every band; a second past
    // chain 50, a third at the full page. Segments of 6 m follow the winding.
    let r = 0;
    const ruleCount = level >= 4 ? 3 : level >= 2 ? 2 : 1;
    for (let d = dA; d < dB && r < 420; d += 6) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < ruleCount; k++) {
          if (r >= 420) break;
          const off = HW + 2.4 + k * 0.55;
          this._put(this.rules, r++, line(d + 3) + side * off, 0.05, -(d + 3),
            0.07, 0.06, 6.0);
        }
      }
    }
    this.rules.count = r;

    // Greeked type: rows of bars flowing outward from the inner margin.
    // A paragraph ends on a short line and leaves a blank one; the full
    // page justifies every other line, the manuscript leaves them ragged.
    let t = 0;
    const columns = level >= 3 ? 2 : 1;
    const colW = level >= 2 ? 11 : 8.5;
    for (let d = dA, row = Math.round(dA / ROW_PITCH); d < dB; d += ROW_PITCH, row++) {
      for (const side of [-1, 1]) {
        for (let c = 0; c < columns; c++) {
          if (t >= 1400) break;
          const key = row * 4 + (side + 1) + c * 7919;
          const prevEnd = h32((row - 1) * 4 + (side + 1) + c * 7919 + 11) < 0.15;
          if (prevEnd) continue;                       // blank line after a paragraph
          if (h32(key) > fill) continue;               // unset at this band
          const end = h32(key + 11) < 0.15;
          const ragged = level >= 4 ? 1 : 0.55 + 0.45 * h32(key + 23);
          const w = colW * (end ? 0.3 + 0.4 * h32(key + 5) : ragged);
          const inner = HW + 4.2 + c * (colW + 2.2);
          this._put(this.type, t++, line(d) + side * (inner + w / 2), 0.05, -d,
            w, 0.08, ROW_LEN);
        }
      }
    }
    this.type.count = t;

    // Punctuation as sculpture, densifying by band.
    let s = 0, e = 0, b = 0, c = 0;
    if (level >= 1) {
      for (let d = Math.ceil(dA / 36) * 36; d < dB && s < 40; d += 36) {
        const side = (Math.round(d / 36) % 2) ? 1 : -1;
        this._put(this.stops, s++, line(d) + side * (HW + 3.3), 0.6, -d, 1.0, 1.0, 1.0);
      }
    }
    if (level >= 2) {
      for (let d = Math.ceil(dA / 54) * 54 + 18; d < dB && e < 40; d += 54) {
        for (const side of [-1, 1]) {
          if (e >= 40) break;
          this._put(this.dashes, e++, line(d) + side * (HW + 6.5), 2.4, -d, 0.14, 0.32, 3.0);
        }
      }
    }
    if (level >= 3) {
      for (let d = Math.ceil(dA / 27) * 27; d < dB && b < 120; d += 27) {
        for (const side of [-1, 1]) {
          if (b >= 118) break;
          const x = line(d) + side * (HW + 3.6);
          // A bracket: the upright, and a return at each end toward the track.
          this._put(this.brackets, b++, x, 2.3, -d, 0.16, 4.6, 0.16);
          this._put(this.brackets, b++, x - side * 0.4, 4.55, -d, 0.95, 0.14, 0.16);
          this._put(this.brackets, b++, x - side * 0.4, 0.09, -d, 0.95, 0.14, 0.16);
        }
      }
    }
    if (level >= 4) {
      for (let d = Math.ceil(dA / 72) * 72 + 30; d < dB && c < 12; d += 72) {
        const side = (Math.round(d / 72) % 2) ? -1 : 1;
        this._put(this.caps, c++, line(d) + side * (HW + 10.5), 1.1, -d, 2.2, 2.2, 2.2);
      }
    }
    this.stops.count = s; this.dashes.count = e; this.brackets.count = b; this.caps.count = c;
    for (const m of [this.rules, this.type, this.stops, this.dashes, this.brackets, this.caps]) {
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.stage.render = this._origRender;
    this.stage.scene.remove(this.group);
    for (const m of [this.rules, this.type, this.stops, this.dashes, this.brackets, this.caps]) {
      m.geometry.dispose();
    }
    for (const m of [this.matRule, this.matType, this.matMark, this.matCap]) m.dispose();
    delete this.stage.__page;
  }
}

/** Arm the page layer. `level` pins a band (0..4); omit it to follow the chain. */
export function applyStills(level) {
  const stage = window.__RENDER?.stage;
  const sim = window.__SIM;
  if (!stage || !sim) return 'no stage';
  window.__STILLS_LEVEL = level;
  if (!stage.__page) new PageLayer(stage, sim.terrain);
  else stage.__page.level = -1; // force a rebuild at the new level
  return `stills level ${level ?? 'chain'}`;
}
export function clearStills() {
  window.__STILLS_LEVEL = undefined;
  window.__RENDER?.stage?.__page?.dispose();
}
window.__STILLS = { apply: applyStills, clear: clearStills, band: stillBand };

// `?dev=1&stills=1` arms the page on load, following the chain. (Not
// `draft=`: that key is the challenge link's seed.)
if (new URLSearchParams(location.search).get('stills') === '1') {
  const arm = () => (window.__RENDER?.stage && window.__SIM ? applyStills() : setTimeout(arm, 50));
  arm();
}
