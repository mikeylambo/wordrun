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
