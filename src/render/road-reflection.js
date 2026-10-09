/**
 * Wet road — the screen-space mirror (playtest 10/9, the mockup's look).
 *
 * The road reflects the city that is actually on screen. The scene is drawn
 * ONCE, straight to the screen as always (its own tone mapping and MSAA);
 * the frame is copied, and one full-screen pass mirrors each road pixel
 * across the horizon line, blurs the sample along the mirror axis (wider the
 * further below the horizon — roughness), and screen-blends it on top.
 *
 * Where the road may reflect is written by the road shader itself: it puts
 * (1 − wet weight) into alpha (render/material-pass.js), already faded off the
 * rails, near the runner and toward the horizon. Everything else in the scene
 * writes alpha 1, so an actor standing on the road blocks its own patch.
 *
 * The word plate is a hard rule: every plate's screen box is zeroed as a
 * destination AND rejected as a mirror source, so the word is neither
 * covered nor reflected.
 *
 * Integration is explicit — `Stage.render()` owns the branch; nothing here
 * wraps a live render function.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const MAX_GUARDS = 8;

/**
 * The road shader's alpha-mask switch (render/material-pass.js reads it).
 * The canvas has an alpha channel so the mask can ride in it; while the
 * mirror is off the road writes alpha 1, so nothing behind the canvas shows.
 */
export const WET_MASK = { value: 0 };
export { MAX_GUARDS };

const _v = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _a = new THREE.Vector2();
const _b = new THREE.Vector2();

/** World point -> drawing-buffer pixels (y up, as uv). Shared by the screen passes. */
function toPx(v, camera, res, out) {
  v.project(camera);
  return out.set((v.x * 0.5 + 0.5) * res.x, (v.y * 0.5 + 0.5) * res.y);
}

/**
 * The horizon is where level directions vanish: two far points on the
 * camera's level heading, either side, give the line — roll included.
 * Writes a point on it and its unit normal pointing DOWN the screen.
 */
export function screenHorizon(camera, res, outPoint, outNormal) {
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _right.set(-_fwd.z, 0, _fwd.x);
  const far = camera.far * 0.9;
  toPx(_v.copy(camera.position).addScaledVector(_fwd, far).addScaledVector(_right, -far * 0.3), camera, res, _a);
  toPx(_v.copy(camera.position).addScaledVector(_fwd, far).addScaledVector(_right, far * 0.3), camera, res, _b);
  const dx = _b.x - _a.x, dy = _b.y - _a.y, len = Math.hypot(dx, dy) || 1;
  // uv y grows UP the screen, so "below the horizon" is the -y side.
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  outPoint.copy(_a);
  outNormal.set(nx, ny);
}

/** Every visible plate's screen box (px, padded) into `out` (Vector4s). */
export function plateGuards(camera, meshes, res, out) {
  const pad = Math.max(6, res.y * 0.008);
  let i = 0;
  for (const mesh of meshes) {
    if (i >= out.length) break;
    if (!mesh?.visible) continue;
    mesh.updateWorldMatrix(true, false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, front = false;
    for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      _v.set(cx, cy, 0).applyMatrix4(mesh.matrixWorld);
      if (_vc.copy(_v).applyMatrix4(camera.matrixWorldInverse).z < 0) front = true;
      toPx(_v, camera, res, _a);
      x0 = Math.min(x0, _a.x); y0 = Math.min(y0, _a.y);
      x1 = Math.max(x1, _a.x); y1 = Math.max(y1, _a.y);
    }
    if (!front) continue;
    out[i++].set(x0 - pad, y0 - pad, x1 + pad, y1 + pad);
  }
  for (; i < out.length; i++) out[i].set(-1, -1, -1, -1);
}


const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
uniform sampler2D tFrame;
uniform vec2 uRes;
uniform vec2 uH0;       // a point on the horizon line (px)
uniform vec2 uHn;       // unit normal of that line, pointing down the screen (px space)
uniform float uK;
uniform float uSpread;
uniform float uStretch;
uniform float uWobble;
uniform float uTime;
uniform vec4 uGuard[${MAX_GUARDS}];  // plate boxes in px: minX, minY, maxX, maxY
varying vec2 vUv;

float guarded(vec2 p) {
  for (int i = 0; i < ${MAX_GUARDS}; i++) {
    vec4 g = uGuard[i];
    if (p.x >= g.x && p.x <= g.z && p.y >= g.y && p.y <= g.w) return 1.0;
  }
  return 0.0;
}

void main() {
  float m = clamp(1.0 - texture2D(tFrame, vUv).a, 0.0, 1.0);
  vec2 p = vUv * uRes;
  float s = dot(p - uH0, uHn);
  vec3 add = vec3(0.0);
  if (m > 0.003 && s > 0.0 && guarded(p) < 0.5) {
    // Wet asphalt STRETCHES a reflection toward the viewer: a pixel s below
    // the horizon mirrors only s × uStretch above it, so the whole road
    // samples the skyline band rather than the empty sky over it.
    vec2 q = p - (1.0 + uStretch) * s * uHn;
    q.x += sin(vUv.y * 80.0 + uTime) * 0.002 * uRes.x * uWobble;
    vec3 refl = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 7; i++) {
      float t = float(i) / 3.0 - 1.0;
      vec2 sp = q - uHn * (t * s * uStretch * uSpread * 4.0);
      vec2 su = sp / uRes;
      float inside = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
      float w = (1.0 - abs(t) * 0.6) * inside * (1.0 - guarded(sp));
      refl += texture2D(tFrame, su).rgb * w;
      wsum += w;
    }
    refl = clamp(refl / max(wsum, 1e-4), 0.0, 1.0);
    // Wet asphalt mirrors LIGHT, not the dark between it: a soft knee keeps
    // windows, beams and glow and lets the night sky fall away, so the road
    // reads as reflecting rather than fogged.
    float l = dot(refl, vec3(0.2126, 0.7152, 0.0722));
    refl *= smoothstep(0.03, 0.38, l);
    // Fade out before the mirrored point runs off the top of the frame, so
    // no hard line appears where the source ends.
    float edge = smoothstep(0.0, 0.22, (uRes.y - q.y) / uRes.y);
    add = refl * uK * m * edge;
  }
  // Screen blend in display space, as the mockup was made: the blend state
  // computes 1 − (1 − dst)(1 − add); alpha is forced to 1 for the canvas.
  gl_FragColor = vec4(add, 1.0);
}
`;

function halfFloatOk(renderer) {
  const ext = renderer.extensions;
  return renderer.capabilities.isWebGL2 &&
    (ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'));
}

export class RoadReflection {
  constructor(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.frame = new THREE.FramebufferTexture(size.x, size.y);
    this.frame.minFilter = THREE.LinearFilter;
    this.frame.magFilter = THREE.LinearFilter;
    this.uniforms = {
      tFrame: { value: this.frame },
      uRes: { value: new THREE.Vector2(size.x, size.y) },
      uH0: { value: new THREE.Vector2() },
      uHn: { value: new THREE.Vector2(0, 1) },
      uK: { value: TUNING.WET.REFLECT },
      uSpread: { value: TUNING.WET.REFLECT_SPREAD },
      uStretch: { value: TUNING.WET.REFLECT_STRETCH },
      uWobble: { value: 1 },
      uTime: { value: 0 },
      uGuard: { value: Array.from({ length: MAX_GUARDS }, () => new THREE.Vector4(-1, -1, -1, -1)) },
    };
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
        depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcColorFactor,
        blendEquationAlpha: THREE.AddEquation,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor,
      })
    );
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.Camera();
  }

  _resize(renderer) {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (s.x === this.frame.image.width && s.y === this.frame.image.height) return;
    this.frame.dispose();
    this.frame = new THREE.FramebufferTexture(s.x, s.y);
    this.frame.minFilter = THREE.LinearFilter;
    this.frame.magFilter = THREE.LinearFilter;
    this.uniforms.tFrame.value = this.frame;
    this.uniforms.uRes.value.set(s.x, s.y);
  }

  _horizon(camera) {
    screenHorizon(camera, this.uniforms.uRes.value, this.uniforms.uH0.value, this.uniforms.uHn.value);
  }

  _guards(camera, meshes) {
    plateGuards(camera, meshes, this.uniforms.uRes.value, this.uniforms.uGuard.value);
  }

  render(renderer, scene, camera, { plates = [], reducedFlash = false, time = 0 } = {}) {
    this._resize(renderer);
    this._horizon(camera);
    this._guards(camera, plates);
    this.uniforms.uK.value = TUNING.WET.REFLECT;
    this.uniforms.uSpread.value = TUNING.WET.REFLECT_SPREAD;
    this.uniforms.uStretch.value = TUNING.WET.REFLECT_STRETCH;
    // REDUCED FLASH keeps the reflection but stills the ripple.
    this.uniforms.uWobble.value = reducedFlash ? 0 : 1;
    this.uniforms.uTime.value = time;
    WET_MASK.value = 1;
    renderer.render(scene, camera);
    renderer.copyFramebufferToTexture(this.frame);
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.postScene, this.postCam);
    renderer.autoClear = auto;
  }

  dispose(renderer) {
    WET_MASK.value = 0;
    this.frame.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
