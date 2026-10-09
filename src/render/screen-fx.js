/**
 * Screen FX — two prototypes the owner asked to see live (playtest 10/9),
 * drawn as ONE full-screen pass after the scene (and after the wet mirror):
 *
 *   SPEED BLUR     a radial blur at the frame's edges only, pulling toward
 *                  the vanishing point. Silent below half speed; it opens up
 *                  near the ceiling and on a DASH. The centre of the frame —
 *                  the road ahead, the runner, the plate — is never touched.
 *   HORIZON LIGHT  a band of cool light rising off the horizon at moments in
 *                  a run: a chain milestone, a DASH, every kilometre. One
 *                  swell and a slow fall; it never strobes.
 *
 * The plate is a hard rule for both: every plate's screen box (feathered)
 * zeroes the blur and the light. REDUCED FLASH halves the blur and the
 * light's peak and slows its rise. Each has its own settings switch.
 *
 * Integration is explicit: `Stage.render()` calls render() at the end of the
 * frame and main drives update()/pulse(); nothing wraps a live function.
 */

import * as THREE from 'three';
import { MAX_GUARDS, screenHorizon, plateGuards } from './road-reflection.js';

export const SCREEN_FX = Object.freeze({
  BLUR_FROM: 0.55,     // normalised speed where the edge blur starts
  BLUR_MAX: 0.6,       // at the ceiling
  BLUR_DASH: 0.45,     // added during a DASH
  LIGHT_PEAK: 0.34,    // horizon light at full swell (display-space add)
  LIGHT_RISE_S: 0.35,
  LIGHT_FALL_S: 1.9,
  LIGHT_COLOR: 0xbfe6ff,
  KM_M: 1000,
  CHAIN_EVERY: 25,
});

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
uniform sampler2D tFrame;
uniform vec2 uRes;
uniform vec2 uH0;
uniform vec2 uHn;
uniform vec2 uCenter;
uniform float uBlur;
uniform float uLight;
uniform vec3 uLightCol;
uniform vec4 uGuard[${MAX_GUARDS}];
varying vec2 vUv;

// 0 inside any plate box, rising to 1 over a 40 px feather outside it.
float clearOfPlates(vec2 p) {
  float m = 1e6;
  for (int i = 0; i < ${MAX_GUARDS}; i++) {
    vec4 g = uGuard[i];
    if (g.z < 0.0) continue;
    float d = max(max(g.x - p.x, p.x - g.z), max(g.y - p.y, p.y - g.w));
    m = min(m, d);
  }
  return smoothstep(0.0, 40.0, m);
}

void main() {
  vec2 p = vUv * uRes;
  float clear = clearOfPlates(p);
  vec3 add = vec3(0.0);
  float a = 0.0;

  if (uBlur > 0.002) {
    vec2 q = (p - uCenter) / uRes.y;
    float r = length(q * vec2(1.0, 0.8));
    float edge = smoothstep(0.30, 0.78, r) * uBlur * clear;
    if (edge > 0.002) {
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        acc += texture2D(tFrame, (p - (p - uCenter) * t * 0.17 * edge) / uRes).rgb;
      }
      add = acc / 8.0 * edge;
      a = edge;
    }
  }

  if (uLight > 0.002) {
    float s = dot(p - uH0, uHn);              // + below the horizon, - above
    float above = exp(-max(-s, 0.0) / (0.11 * uRes.y));
    float below = exp(-max(s, 0.0) / (0.025 * uRes.y));
    add += uLightCol * uLight * clear * (s < 0.0 ? above : below);
  }

  // Premultiplied: rgb = add + dst·(1 − a). Alpha stays 1 for the canvas.
  gl_FragColor = vec4(add, a);
}
`;

export class ScreenFx {
  constructor(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.frame = new THREE.FramebufferTexture(size.x, size.y);
    this.uniforms = {
      tFrame: { value: this.frame },
      uRes: { value: new THREE.Vector2(size.x, size.y) },
      uH0: { value: new THREE.Vector2() },
      uHn: { value: new THREE.Vector2(0, -1) },
      uCenter: { value: new THREE.Vector2(size.x / 2, size.y / 2) },
      uBlur: { value: 0 },
      uLight: { value: 0 },
      uLightCol: { value: new THREE.Color(SCREEN_FX.LIGHT_COLOR) },
      uGuard: { value: Array.from({ length: MAX_GUARDS }, () => new THREE.Vector4(-1, -1, -1, -1)) },
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }));
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.Camera();

    this.blur = 0;      // eased edge-blur amount
    this.light = 0;     // current horizon-light level
    this._target = 0;   // swell target, set by pulse()
    this._rising = false;
  }

  /** A moment: the horizon light swells once (k 0..1) and falls. */
  pulse(k = 1) {
    this._target = Math.max(this._target, Math.min(1, k));
    this._rising = true;
  }

  update(dt, { speedN = 0, dash = false, reducedFlash = false, blurOn = true, lightOn = true } = {}) {
    const F = SCREEN_FX;
    const want = blurOn
      ? (Math.max(0, (speedN - F.BLUR_FROM) / (1 - F.BLUR_FROM)) * F.BLUR_MAX + (dash ? F.BLUR_DASH : 0))
        * (reducedFlash ? 0.5 : 1)
      : 0;
    this.blur += (want - this.blur) * Math.min(1, dt * 4);
    const rise = F.LIGHT_RISE_S * (reducedFlash ? 2.5 : 1);
    if (this._rising) {
      this.light += dt / rise;
      if (this.light >= this._target) { this.light = this._target; this._rising = false; this._target = 0; }
    } else {
      this.light = Math.max(0, this.light - dt / F.LIGHT_FALL_S);
    }
    if (!lightOn) { this.light = 0; this._target = 0; this._rising = false; }
    this._peak = F.LIGHT_PEAK * (reducedFlash ? 0.5 : 1);
  }

  get active() { return this.blur > 0.003 || this.light > 0.003; }

  _resize(renderer) {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (s.x === this.frame.image.width && s.y === this.frame.image.height) return;
    this.frame.dispose();
    this.frame = new THREE.FramebufferTexture(s.x, s.y);
    this.uniforms.tFrame.value = this.frame;
    this.uniforms.uRes.value.set(s.x, s.y);
  }

  /** Draw over the finished frame. Copies the frame only when blur needs it. */
  render(renderer, camera, plates = []) {
    if (!this.active) return;
    this._resize(renderer);
    const u = this.uniforms;
    screenHorizon(camera, u.uRes.value, u.uH0.value, u.uHn.value);
    // The blur pulls toward the vanishing point: the horizon at mid-frame.
    const n = u.uHn.value, h = u.uH0.value, cx = u.uRes.value.x / 2;
    const cy = Math.abs(n.y) > 1e-4 ? h.y - (cx - h.x) * n.x / n.y : u.uRes.value.y / 2;
    u.uCenter.value.set(cx, cy);
    plateGuards(camera, plates, u.uRes.value, u.uGuard.value);
    u.uBlur.value = this.blur;
    u.uLight.value = this.light * (this._peak ?? SCREEN_FX.LIGHT_PEAK);
    if (this.blur > 0.003) renderer.copyFramebufferToTexture(this.frame);
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.postScene, this.postCam);
    renderer.autoClear = auto;
  }

  dispose() {
    this.frame.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
