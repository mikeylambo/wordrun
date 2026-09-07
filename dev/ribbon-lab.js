/**
 * RC11 concept — THE RIBBON. Dev only, never imported by src/, never bundled.
 *
 * Three questions put to a frame rather than to a paragraph:
 *
 *  1. the road as a LIGHT SOURCE — an emissive surface carrying a gradient
 *     that flows along its length, violet -> blue -> cyan -> teal -> gold,
 *     with the lane lines become streaming baseline rules and the runner and
 *     the rails taking their colour from the surface under them;
 *  2. the road as a THING SUSPENDED — a parallax star field and page
 *     fragments falling away beneath it, so the ribbon hangs over a drop.
 *     The sky above is untouched;
 *  3. whether the word plate survives (1) — it keeps its dark backing and has
 *     to hold every legibility number over the brightest surface in the game.
 *
 * THE PALETTE SKIPS THE RESERVED ARC, and that is a constraint with teeth
 * rather than a note. TUNING.META.RESERVED_HUES fences six hues at 25 deg,
 * whose union is two arcs: [325..70] through zero (the Redline's danger
 * accents in every colour-vision mode, and streak-burst tier 3) and
 * [237..287] (streak-burst tier 2). So "violet" cannot be 270 and "gold"
 * cannot be 48 — both are inside a fence. The ramp is therefore built as a
 * walk over the LEGAL hue set only: it spends no parameter at all inside a
 * reserved arc, and steps across the one it has to cross. `hueTable()` prints
 * every stop and every intermediate against the fence, at every band, so the
 * check is in the shoot output rather than in a claim.
 */

import * as THREE from 'three';
import TUNING from '../src/TUNING.js';
import { flowLevel } from '../src/render/flow-curve.js';
import { RAIL, railX } from '../src/render/rails.js';

const R = TUNING.RUN;
const HW = R.TRACK_HALF_W;
const RES = TUNING.META.RESERVED_HUES;

// ── the fence ─────────────────────────────────────────────────────────────
const arcDist = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };
/** Distance from a hue to the nearest reserved hue, in degrees. */
export function hueClearance(h) {
  return Math.min(...RES.HUES.map((r) => arcDist(h, r.deg)));
}
export const hueLegal = (h) => hueClearance(h) >= RES.MIN_SEPARATION_DEG;

/**
 * The ramp, as legal hues only. Violet is pushed off 270 to 295 (the nearest
 * legal side of the streak-burst tier-2 fence) and gold off 48 to 74 (the
 * nearest legal side of the tier-3 fence). Between 295 and 237 the ramp does
 * not interpolate at all — it STEPS, because every hue between them is
 * fenced, and a gradient that crossed it would paint the Redline's own
 * language onto the road.
 */
export const STOPS = Object.freeze([
  { name: 'violet', hue: 295, sat: 0.72, val: 0.78 },
  { name: '(step over the tier-2 arc)', hue: 237, sat: 0.78, val: 0.80, step: true },
  { name: 'blue', hue: 225, sat: 0.84, val: 0.86 },
  { name: 'cyan', hue: 192, sat: 0.86, val: 0.98 },
  { name: 'teal', hue: 168, sat: 0.74, val: 0.90 },
  { name: 'gold', hue: 74, sat: 0.80, val: 1.00 },
]);

/** The ramp at 0..1, in HSV. `t` wraps; the step is a step. */
export function rampHSV(t) {
  const u = ((t % 1) + 1) % 1;
  const n = STOPS.length - 1;
  const f = u * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = f - i;
  const a = STOPS[i], b = STOPS[i + 1];
  // A `step` stop is not interpolated across: the arc between them is fenced,
  // so the ramp jumps and the seam is the point.
  if (b.step || a.step) {
    const pick = k < 0.5 ? a : b;
    return { h: pick.hue, s: pick.sat, v: pick.val };
  }
  return { h: a.hue + (b.hue - a.hue) * k, s: a.sat + (b.sat - a.sat) * k, v: a.val + (b.val - a.val) * k };
}

/** Every hue the ramp ever paints, sampled fine, with its clearance. */
export function hueTable(samples = 256) {
  const rows = [];
  for (let i = 0; i < samples; i++) {
    const { h, s, v } = rampHSV(i / samples);
    rows.push({ t: i / samples, hue: h, sat: s, val: v, clearance: hueClearance(h) });
  }
  return rows;
}

/** The same HSV the shader uses, so the JS tints and the surface agree. */
export function hsv2rgb(h, s, v) {
  const c = new THREE.Color();
  const i = Math.floor(((h % 360) + 360) % 360 / 60);
  const f = ((h % 360) + 360) % 360 / 60 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return c.setRGB(rgb[0], rgb[1], rgb[2]);
}

// ── the surface ───────────────────────────────────────────────────────────
// A skin laid a centimetre over the road, sampled on the rails' own lattice so
// it folds over exactly the same joins they do.
const SKIN_LIFT = 0.012;
const SKIN_AHEAD = 320, SKIN_BEHIND = 20;
const SKIN_COLS = 12;
const SKIN_SAMPLES = Math.round((SKIN_AHEAD + SKIN_BEHIND) / RAIL.STEP_M) + 1;
/** Metres of road per full trip through the ramp. */
const RAMP_WAVE_M = 260;
/** How fast the gradient streams toward the runner, m/s. */
const RAMP_FLOW_MS = 34;
/** Baseline rules: pitch along the road, and how wide each rule reads. */
const RULE_PITCH_M = 3.2;
const RULE_WIDTH_M = 0.09;

const SKIN_VERT = `
attribute float aD;
attribute float aU;
varying float vD;
varying float vU;
varying float vDepth;
void main() {
  vD = aD; vU = aU;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const SKIN_FRAG = `
uniform float uTime;
uniform float uSat;      // saturation, on the flow curve
uniform float uGain;     // overall emission
uniform float uRuleGain; // the baseline rules
uniform vec3  uStops[6];
uniform float uWave;
uniform float uFlowMS;
uniform float uRulePitch;
uniform float uRuleWidth;
uniform float uFogNear;
uniform float uFogFar;
varying float vD;
varying float vU;
varying float vDepth;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // The ramp, walked as five legs. Leg 0->1 is the STEP over the fenced arc:
  // it is chosen, never mixed, so no fenced hue is ever painted.
  float t = fract((vD - uTime * uFlowMS) / uWave);
  float f = t * 5.0;
  int i = int(min(4.0, floor(f)));
  float k = fract(f);
  vec3 a = uStops[i];        // (hue/360, sat, val)
  vec3 b = uStops[i + 1];
  vec3 hsvC = (i == 0) ? (k < 0.5 ? a : b) : mix(a, b, k);
  hsvC.y *= uSat;

  vec3 col = hsv2rgb(hsvC) * uGain;

  // The lane lines are baseline rules now, and they STREAM: one bright hair
  // across the ribbon every RULE_PITCH metres, travelling with the gradient.
  float rp = fract((vD - uTime * uFlowMS) / uRulePitch);
  float rule = smoothstep(uRuleWidth / uRulePitch, 0.0, min(rp, 1.0 - rp));
  col += vec3(0.86, 0.94, 1.0) * rule * uRuleGain;

  // The ribbon's own edge falloff, so the skin does not fight the rails.
  float edge = 1.0 - smoothstep(0.86, 1.0, abs(vU));
  // Fog, done by hand: the stock chunk mixes TOWARD the fog colour, which on an
  // additive surface would make the far road brighter rather than fade it out.
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(col * edge * fog, 1.0);
}`;

class RibbonLayer {
  constructor(stage, terrain) {
    this.stage = stage;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'ribbon-lab';
    stage.scene.add(this.group);
    this.t0 = performance.now() / 1000;

    // ── (1) the emissive surface
    const geo = new THREE.BufferGeometry();
    const verts = SKIN_SAMPLES * (SKIN_COLS + 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute('aD', new THREE.BufferAttribute(new Float32Array(verts), 1));
    geo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(verts), 1));
    const idx = [];
    for (let r = 0; r < SKIN_SAMPLES - 1; r++) {
      for (let c = 0; c < SKIN_COLS; c++) {
        const a = r * (SKIN_COLS + 1) + c;
        idx.push(a, a + 1, a + SKIN_COLS + 1, a + 1, a + SKIN_COLS + 2, a + SKIN_COLS + 1);
      }
    }
    geo.setIndex(idx);
    geo.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    const stops = STOPS.map((s) => new THREE.Vector3(s.hue / 360, s.sat, s.val));
    this.skinMat = new THREE.ShaderMaterial({
      vertexShader: SKIN_VERT, fragmentShader: SKIN_FRAG,
      uniforms: {
        uTime: { value: 0 }, uSat: { value: 1 }, uGain: { value: 1 },
        uRuleGain: { value: 0.35 }, uStops: { value: stops },
        uWave: { value: RAMP_WAVE_M }, uFlowMS: { value: RAMP_FLOW_MS },
        uRulePitch: { value: RULE_PITCH_M }, uRuleWidth: { value: RULE_WIDTH_M },
        uFogNear: { value: TUNING.FOG.NEAR }, uFogFar: { value: TUNING.FOG.FAR },
      },
      // R1/R2 shot with `transparent: false`, which put an ADDITIVE material in
      // the OPAQUE queue: the road drew after it and overwrote every pixel, so
      // the surface was invisible in both frames. An overlay on opaque geometry
      // belongs in the transparent queue, after it.
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.skin = new THREE.Mesh(geo, this.skinMat);
    this.skin.frustumCulled = false;
    this.skin.renderOrder = 4;   // after the road, before the plate (20)
    this.group.add(this.skin);

    // ── (2) the drop: a parallax star field and page fragments below
    // Three shells, each authored in a box AROUND the runner and slid back by
    // its own fraction of his travel — the near shell streams past, the far one
    // barely moves. Sizes are what a point has to be to survive a 780 px frame
    // at 200 m; the first shoot authored them at 0.55 and they were sub-pixel.
    this.stars = [];
    for (const [n, depth, size, op, par] of [
      [700, -34, 5.0, 1.0, 0.55], [620, -80, 9.0, 0.72, 0.25], [380, -165, 16.0, 0.45, 0.08]]) {
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        p[i * 3] = (Math.random() * 2 - 1) * 300;
        p[i * 3 + 1] = depth - Math.random() * Math.abs(depth) * 1.4;
        p[i * 3 + 2] = -Math.random() * 520;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const m = new THREE.PointsMaterial({
        color: 0xdcecff, size, sizeAttenuation: true, transparent: true,
        opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      this.stars.push({ pts, depth, par });
      this.group.add(pts);
    }
    const fragGeo = new THREE.PlaneGeometry(1, 1);
    this.fragMat = new THREE.MeshBasicMaterial({
      color: 0x8fb0d6, transparent: true, opacity: 0.42, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    });
    this.frags = new THREE.InstancedMesh(fragGeo, this.fragMat, 220);
    this.frags.frustumCulled = false;
    this.group.add(this.frags);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._fragSeed = Array.from({ length: 220 }, () => ({
      // Just off the ribbon's shoulders, not out on the horizon: a page has to
      // be seen falling to read as a drop rather than as distant litter.
      // R1/R2 clumped every fragment on one shoulder at road level. Spread
      // them evenly either side, start them well BELOW the ribbon, and let the
      // far ones fall further, so the eye reads a drop and not debris.
      x: (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 210),
      y: -22 - Math.random() * 150,
      z: Math.random(), w: 2.4 + Math.random() * 9, h: 1.2 + Math.random() * 4.5,
      spin: Math.random() * Math.PI, rate: 0.15 + Math.random() * 0.5,
      fall: 1.6 + Math.random() * 5,
    }));

    this._origRender = stage.render.bind(stage);
    stage.render = () => { this.update(); this._origRender(); };
    stage.__ribbon = this;
  }

  /** The colour the surface is painting at a given distance, right now. */
  surfaceColourAt(d) {
    const t = (d - this.skinMat.uniforms.uTime.value * RAMP_FLOW_MS) / RAMP_WAVE_M;
    const { h, s, v } = rampHSV(t);
    return hsv2rgb(h, Math.min(1, s * this.skinMat.uniforms.uSat.value), v);
  }

  update() {
    const sim = window.__SIM;
    const render = window.__RENDER;
    if (!sim || !render) return;
    const p = sim.player;
    if (this.terrain !== sim.terrain) this.terrain = sim.terrain;
    const t = window.__STILLS_FROZEN_T ?? (performance.now() / 1000 - this.t0);
    this.skinMat.uniforms.uTime.value = t;

    // Saturation rides the flow curve; a chain-0 road is nearly monochrome and
    // the crest is the full ramp.
    const flow = flowLevel(p.chain | 0);
    this.skinMat.uniforms.uSat.value = 0.18 + 0.82 * flow;
    // ADDITIVE on a road that already carries an etched grid, under ACES: a
    // gain of 1.0 clips the bright legs of the ramp to white and the palette
    // stops being a palette. 0.70 at the crest lifts the road's luminance from
    // about 0.04 to about 0.5 — a light source, still a colour.
    this.skinMat.uniforms.uGain.value = 0.22 + 0.48 * flow;
    this.skinMat.uniforms.uRuleGain.value = 0.10 + 0.30 * flow;

    // The skin, on the rails' own lattice.
    const pos = this.skin.geometry.getAttribute('position');
    const aD = this.skin.geometry.getAttribute('aD');
    const aU = this.skin.geometry.getAttribute('aU');
    const d0 = Math.floor((p.d - SKIN_BEHIND) / RAIL.STEP_M) * RAIL.STEP_M;
    let i = 0;
    for (let r = 0; r < SKIN_SAMPLES; r++) {
      const d = d0 + r * RAIL.STEP_M;
      const cx = this.terrain.corridorX(d);
      for (let c = 0; c <= SKIN_COLS; c++) {
        const u = (c / SKIN_COLS) * 2 - 1;
        const x = cx + u * HW;
        pos.array[i * 3] = x;
        pos.array[i * 3 + 1] = this.terrain.heightAt(x, d) + SKIN_LIFT;
        pos.array[i * 3 + 2] = -d;
        aD.array[i] = d;
        aU.array[i] = u;
        i++;
      }
    }
    pos.needsUpdate = true; aD.needsUpdate = true; aU.needsUpdate = true;

    // The drop: the field parallaxes against the runner, the fragments fall.
    for (const s of this.stars) {
      // The shell rides with the runner and lags by its parallax fraction, so
      // it is always in front of him rather than a kilometre down the road.
      s.pts.position.z = -p.d + (p.d % 260) * s.par;
      s.pts.position.x = this.terrain.corridorX(p.d);
    }
    for (let k = 0; k < this._fragSeed.length; k++) {
      const f = this._fragSeed[k];
      const z = -(p.d + f.z * 420 + 24);
      const y = f.y - ((t * f.fall) % 60);
      this._e.set(0, f.spin + t * f.rate, f.spin * 0.7);
      this._q.setFromEuler(this._e);
      this._p.set(f.x + this.terrain.corridorX(p.d) * 0.15, y, z);
      this._s.set(f.w, f.h, 1);
      this._m.compose(this._p, this._q, this._s);
      this.frags.setMatrixAt(k, this._m);
    }
    this.frags.count = this._fragSeed.length;
    this.frags.instanceMatrix.needsUpdate = true;

    // (1) the runner and the rails take light from the surface under them.
    const near = this.surfaceColourAt(p.d + 6);
    const ahead = this.surfaceColourAt(p.d + 40);
    render.playerActor?.setPalette({
      halo: near.clone().multiplyScalar(1.9).getHex(),
      limb: near.clone().lerp(new THREE.Color(0xffffff), 0.55).getHex(),
    });
    const rails = render.trackRails;
    if (rails) {
      rails.core.material.color.copy(ahead).lerp(new THREE.Color(0xffffff), 0.20);
      rails.glow.material.color.copy(ahead);
      // The first shoot drove these to near-white and the plate sat in front of
      // two beams. A rail lit BY the surface is dimmer than the surface.
      rails.core.material.opacity = 0.40 + 0.28 * flow;
      rails.glow.material.opacity = 0.10 + 0.20 * flow;
    }
  }

  dispose() {
    this.stage.render = this._origRender;
    this.stage.scene.remove(this.group);
    this.skin.geometry.dispose(); this.skinMat.dispose();
    for (const s of this.stars) { s.pts.geometry.dispose(); s.pts.material.dispose(); }
    this.frags.geometry.dispose(); this.fragMat.dispose();
    delete this.stage.__ribbon;
  }
}

export function applyRibbon() {
  const stage = window.__RENDER?.stage;
  const sim = window.__SIM;
  if (!stage || !sim) return 'no stage';
  if (!stage.__ribbon) new RibbonLayer(stage, sim.terrain);
  return 'ribbon armed';
}
export function clearRibbon() { window.__RENDER?.stage?.__ribbon?.dispose(); }


/**
 * The plate, measured off the pixels the game actually drew.
 *
 * The default context keeps no drawing buffer, so a screenshot cannot be read
 * back inside the page — the frame is re-rendered into a target and read from
 * there. Returns the plate's device-pixel box (the fence route-gates holds is
 * 270 x 68), the mean luminance inside it, the mean luminance of the surface
 * immediately below it, and the brightest road pixel in the lower frame.
 * A claim about legibility that cannot read a pixel is not a measurement.
 */
export function measurePlate() {
  const stage = window.__RENDER?.stage;
  const plate = window.__RENDER?.wordGateActors?.current?.mesh;
  if (!stage || !plate || !plate.visible) return { error: 'no armed plate' };
  const cam = stage.camera;
  const W = stage.renderer.domElement.width, H = stage.renderer.domElement.height;
  const xs = [], ys = [];
  const v = new THREE.Vector3();
  for (const [px, py] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
    v.set(px, py, 0).applyMatrix4(plate.matrixWorld).project(cam);
    xs.push((v.x * 0.5 + 0.5) * W);
    ys.push((-v.y * 0.5 + 0.5) * H);
  }
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };

  const target = new THREE.WebGLRenderTarget(W, H);
  const prev = stage.renderer.getRenderTarget();
  stage.renderer.setRenderTarget(target);
  stage.renderer.render(stage.scene, cam);
  const buf = new Uint8Array(W * H * 4);
  stage.renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);
  stage.renderer.setRenderTarget(prev);
  target.dispose();

  const stats = (x0, x1, y0, y1) => {
    let sum = 0, n = 0, peak = 0, min = 1;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
        const i = ((H - 1 - y) * W + x) * 4;   // readRenderTargetPixels is bottom-up
        const l = (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) / 255;
        sum += l; n++; if (l > peak) peak = l; if (l < min) min = l;
      }
    }
    return n ? { mean: sum / n, peak, min, n } : null;
  };
  const inside = stats(box.x0 + 8, box.x1 - 8, box.y0 + 8, box.y1 - 8);
  const below = stats(box.x0 - 40, box.x1 + 40, box.y1 + 10, box.y1 + 110);
  const road = stats(W * 0.18, W * 0.82, H * 0.60, H * 0.97);
  // WCAG-shaped contrast on relative luminance, which is what "the plate keeps
  // its dark backing" has to survive over a road that is now a light source.
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return {
    devicePx: { w: +(box.x1 - box.x0).toFixed(1), h: +(box.y1 - box.y0).toFixed(1) },
    plateMeanLuma: +inside.mean.toFixed(4),
    plateMinLuma: +inside.min.toFixed(4),
    platePeakLuma: +inside.peak.toFixed(4),
    surfaceBelowMeanLuma: below ? +below.mean.toFixed(4) : null,
    roadPeakLuma: +road.peak.toFixed(4),
    roadMeanLuma: +road.mean.toFixed(4),
    contrastPlateVsSurfaceBelow: below ? +ratio(inside.mean, below.mean).toFixed(2) : null,
    contrastPlateInkVsBacking: +ratio(inside.peak, inside.min).toFixed(2),
    contrastPlateVsBrightestRoad: +ratio(inside.min, road.peak).toFixed(2),
  };
}

window.__RIBBON = {
  apply: applyRibbon, clear: clearRibbon,
  hueTable, hueClearance, hueLegal, rampHSV, STOPS, measurePlate,
  RESERVED: RES,
};

if (new URLSearchParams(location.search).get('ribbon') === '1') {
  const arm = () => (window.__RENDER?.stage && window.__SIM ? applyRibbon() : setTimeout(arm, 50));
  arm();
}
