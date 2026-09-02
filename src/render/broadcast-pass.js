/**
 * The BROADCAST look — Phase N, reshaped by the Phase K decision.
 *
 * The shipped look stays the default. This is the style lab's `broadcast`
 * candidate (cel bands, a drawn ink line on depth and luminance steps, a
 * bright-pass bleed, a vignette) promoted to production as an OPT-IN
 * settings toggle, byte-for-byte the same dial values a human approved in
 * `dev/style-lab.js`. It is not a compositor under an Editorial World —
 * that world was looked at in `dev/stills/` and not taken.
 *
 * Integration is explicit: `Stage.render()` owns the branch and constructs
 * or disposes this pass as the setting flips. Nothing here wraps a live
 * `stage.render` at runtime — that is the Phase 0 banned pattern.
 *
 * REDUCED FLASH owns the glow: the bleed is the one element of this look
 * that pulses with scene brightness, so the accessibility setting shrinks
 * its radius and strength rather than being ignored by a cosmetic toggle.
 */

import * as THREE from 'three';

export const BROADCAST = {
  BANDS: 5,        // luminance quantisation steps
  INK: 0.8,        // outline strength
  INK_WIDTH: 1.2,  // outline sample radius (px)
  LUMA_INK: 0.3,   // how much the outline listens to colour steps
  GLOW: 0.5,       // bright-pass bleed strength
  GLOW_RAD: 14,    // bleed radius (px)
  GLOW_THR: 0.30,  // bleed threshold
  VIGN: 0.18,      // vignette
  LIFT: 0.05,      // shadow lift so bands read as ink, not mud
  // REDUCED FLASH controls the glow: half the radius, damped strength.
  ACCESS_GLOW_RAD: 7,
  ACCESS_GLOW: 0.35,
};

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uPx;
uniform float uNear;
uniform float uFar;
uniform float uGlow;
uniform float uGlowRad;
varying vec2 vUv;

float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  float vz = perspectiveDepthToViewZ(z, uNear, uFar);
  return -vz;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;

  // --- cel banding: quantise brightness, keep the hue ratio intact ---
  {
    float l = luma(col);
    // perceptual-ish so the dark end does not collapse into one flat band
    float lp = pow(max(l, 0.0), 0.5);
    float q = floor(lp * ${BROADCAST.BANDS.toFixed(1)} + 0.5) / ${BROADCAST.BANDS.toFixed(1)};
    float ql = pow(q, 2.0);
    ql = ql + ${BROADCAST.LIFT.toFixed(2)} * (1.0 - ql);
    col *= ql / max(l, 1e-4);
  }

  // --- ink: depth discontinuity + local luminance step ---
  {
    vec2 w = uPx * ${BROADCAST.INK_WIDTH.toFixed(1)};
    float d  = linDepth(vUv);
    float dl = linDepth(vUv - vec2(w.x, 0.0));
    float dr = linDepth(vUv + vec2(w.x, 0.0));
    float du = linDepth(vUv - vec2(0.0, w.y));
    float dd = linDepth(vUv + vec2(0.0, w.y));
    float dEdge = (abs(dl - dr) + abs(du - dd)) / max(d, 1.0);
    float depthLine = smoothstep(0.012, 0.075, dEdge);

    float cl = luma(texture2D(tColor, vUv - vec2(w.x, 0.0)).rgb);
    float cr = luma(texture2D(tColor, vUv + vec2(w.x, 0.0)).rgb);
    float cu = luma(texture2D(tColor, vUv - vec2(0.0, w.y)).rgb);
    float cd = luma(texture2D(tColor, vUv + vec2(0.0, w.y)).rgb);
    float lEdge = abs(cl - cr) + abs(cu - cd);
    float lumaLine = smoothstep(0.10, 0.38, lEdge);

    // fade lines out at the fog wall so the horizon does not turn to scribble
    float far = 1.0 - smoothstep(uFar * 0.14, uFar * 0.42, d);
    float line = clamp(max(depthLine, lumaLine * ${BROADCAST.LUMA_INK.toFixed(2)}), 0.0, 1.0) * far;
    col = mix(col, col * 0.10, line * ${BROADCAST.INK.toFixed(2)});
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
      float m = smoothstep(${BROADCAST.GLOW_THR.toFixed(2)}, ${(BROADCAST.GLOW_THR + 0.35).toFixed(2)}, sl);
      float w = 1.0 / (1.0 + r * 0.12);
      bleed += sc * m * w;
      wsum += w;
    }
    col += (bleed / max(wsum, 1e-4)) * uGlow;
  }

  // --- vignette ---
  {
    vec2 q = vUv - 0.5;
    col *= 1.0 - ${BROADCAST.VIGN.toFixed(2)} * dot(q, q) * 1.6;
  }

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export class BroadcastPass {
  constructor(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
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
      uNear: { value: 0.5 },
      uFar: { value: 420 },
      uGlow: { value: BROADCAST.GLOW },
      uGlowRad: { value: BROADCAST.GLOW_RAD },
    };
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
        depthTest: false, depthWrite: false,
      })
    );
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.Camera();
  }

  /** The adaptive-DPR governor resizes the drawing buffer between frames. */
  _resize(renderer) {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (s.x === this.rt.width && s.y === this.rt.height) return;
    this.rt.setSize(s.x, s.y);
    this.depth.image.width = s.x;
    this.depth.image.height = s.y;
    this.depth.needsUpdate = true;
    this.uniforms.uPx.value.set(1 / s.x, 1 / s.y);
  }

  render(renderer, scene, camera, reducedFlash) {
    this._resize(renderer);
    this.uniforms.uNear.value = camera.near;
    this.uniforms.uFar.value = camera.far;
    this.uniforms.uGlow.value = reducedFlash ? BROADCAST.ACCESS_GLOW : BROADCAST.GLOW;
    this.uniforms.uGlowRad.value = reducedFlash ? BROADCAST.ACCESS_GLOW_RAD : BROADCAST.GLOW_RAD;
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.postScene, this.postCam);
  }

  dispose(renderer) {
    renderer?.setRenderTarget(null);
    this.rt.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
