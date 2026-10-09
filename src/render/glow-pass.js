/**
 * RC14.1 — the glow pass: light that blooms, and a word that never does.
 *
 * The world rendered in one plain pass, so nothing in it could GLOW — the lit
 * windows, the runner's rim and aura, the rails were bright pixels with hard
 * edges, which is the single biggest thing between this frame and the
 * reference it is reaching for. A full-scene bloom would also bloom the word
 * plate, and plate legibility outranks every visual change in this game. So
 * the bloom is SELECTIVE:
 *
 *   1. Only objects on GLOW_LAYER are drawn into a quarter-size target — the
 *      light sources, and the word plates as solid black OCCLUDERS, so no
 *      light behind a plate can bleed through it and the plate itself never
 *      contributes a halo.
 *   2. Two separable blur passes spread that light.
 *   3. It is added over the finished frame.
 *
 * Cost: one quarter-resolution draw of a handful of meshes and four small
 * blur passes. The render-budget governor (scene.js) turns it off before it
 * ever lets the frame rate fall, and REDUCED FLASH halves it.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

export const GLOW_LAYER = 1;

const QUAD_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BLUR_FS = /* glsl */`
  uniform sampler2D uTex;
  uniform vec2 uStep;
  uniform float uThresh;   // first pass only: only what is BRIGHT blooms
  varying vec2 vUv;
  vec3 k(vec2 uv) { vec3 c = texture2D(uTex, uv).rgb; return max(c - vec3(uThresh), vec3(0.0)); }
  void main() {
    // 9-tap gaussian, linear-sampled.
    vec3 c = k(vUv) * 0.2270270270;
    c += k(vUv + uStep * 1.3846153846) * 0.3162162162;
    c += k(vUv - uStep * 1.3846153846) * 0.3162162162;
    c += k(vUv + uStep * 3.2307692308) * 0.0702702703;
    c += k(vUv - uStep * 3.2307692308) * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;
const COMPOSE_FS = /* glsl */`
  uniform sampler2D uTex;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec3 g = texture2D(uTex, vUv).rgb * uStrength;
    // Linear light out to the display (the frame below is already sRGB).
    gl_FragColor = vec4(pow(max(g, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
  }
`;

export class GlowPass {
  constructor(renderer) {
    const opts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(4, 4, opts);
    this.rtB = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blur = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false,
      uniforms: { uTex: { value: null }, uStep: { value: new THREE.Vector2() }, uThresh: { value: 0 } },
    });
    this.compose = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: COMPOSE_FS, depthTest: false, depthWrite: false,
      transparent: true, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uTex: { value: null }, uStrength: { value: 1 } },
    });
    this._black = new THREE.Color(0, 0, 0);
    this._size = new THREE.Vector2();
    this.enabled = true;
  }

  _fit(renderer) {
    renderer.getDrawingBufferSize(this._size);
    const w = Math.max(4, Math.round(this._size.x / 4));
    const h = Math.max(4, Math.round(this._size.y / 4));
    if (this.rtA.width !== w || this.rtA.height !== h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); }
    return { w, h };
  }

  _pass(renderer, mat, src, dst) {
    this.quad.material = mat;
    mat.uniforms.uTex.value = src.texture;
    renderer.setRenderTarget(dst);
    renderer.render(this.qScene, this.qCam);
  }

  /** After the frame is drawn: bloom the glow layer over it. */
  render(renderer, scene, camera, reducedFlash = false) {
    if (!this.enabled) return;
    const G = TUNING.GLOW;
    const { w, h } = this._fit(renderer);
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    const prevBg = scene.background;
    const prevMask = camera.layers.mask;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();

    // 1. The light sources (and the plates as black occluders), alone.
    scene.background = null;
    camera.layers.set(GLOW_LAYER);
    renderer.setClearColor(this._black, 1);
    renderer.autoClear = true;
    renderer.setRenderTarget(this.rtA);
    renderer.render(scene, camera);
    camera.layers.mask = prevMask;
    scene.background = prevBg;

    // 2. Spread it — two separable passes, the second twice as wide.
    for (const r of [1, 2]) {
      this.blur.uniforms.uThresh.value = r === 1 ? G.THRESHOLD : 0;
      this.blur.uniforms.uStep.value.set(r / w, 0);
      this._pass(renderer, this.blur, this.rtA, this.rtB);
      this.blur.uniforms.uThresh.value = 0;
      this.blur.uniforms.uStep.value.set(0, r / h);
      this._pass(renderer, this.blur, this.rtB, this.rtA);
    }

    // 3. Add it over the finished frame.
    renderer.autoClear = false;
    this.compose.uniforms.uStrength.value = G.STRENGTH * (reducedFlash ? 0.5 : 1);
    this._pass(renderer, this.compose, this.rtA, prevTarget);
    renderer.autoClear = prevAuto;
    renderer.setClearColor(prevClear, prevAlpha);
  }

  dispose() { this.rtA.dispose(); this.rtB.dispose(); this.blur.dispose(); this.compose.dispose(); }
}

export default GlowPass;
