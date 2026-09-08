/**
 * The bright pass — bloom in the DEFAULT look.
 *
 * Everything in this game that matters is a light: the track ribbon, the
 * word plate, the runner's rim, the Redline's scan bar. Until now none of
 * them bled. A bright pixel stopped exactly at its own edge, which is why
 * the shipped frame read flatter than every piece of key art drawn from it —
 * the art has bloom and the game did not. The look was never the modelling.
 *
 * The BROADCAST pass has carried a bright-pass bleed since Phase N, but it
 * is bundled with cel bands, an ink line and a vignette behind an opt-in
 * toggle, so the default look could not have the glow without taking the
 * whole style. This is that one element, alone, on by default.
 *
 * Threshold -> half-res extract -> separable blur -> add. Standard, cheap,
 * and deliberately conservative: the WORD PLATE outranks every visual change
 * in this game, so the strength is set from what the plate can carry (the
 * glyph-contrast measurement in dev/shoot-bloom-compare.mjs), not from what
 * looks most impressive on a still of the runner.
 *
 * REDUCED FLASH owns the glow, exactly as it does in BROADCAST: the setting
 * shrinks the radius and damps the strength rather than being ignored by a
 * look that is on by default.
 *
 * One thing changes beyond the glow, and it is worth stating plainly: three
 * applies its tone map only when a material renders straight to the canvas,
 * never into a render target (WebGLRenderer, `toneMapping = NoToneMapping`
 * unless `_currentRenderTarget === null`). So the old frame was
 * `sRGB(ACES(layer))` summed per additive draw, and this one is
 * `sRGB(ACES(sum))` — the tone map moved to AFTER compositing, which is the
 * order it belongs in. Additive glow now rolls off into the highlight
 * shoulder instead of each layer being compressed alone and the display
 * values added on top. The additive mid-tones sit a few percent deeper for
 * it. That is a real grade change, it is the correct one, and it is measured
 * against the plate in dev/shoot-bloom-compare.mjs rather than assumed.
 *
 * Integration is explicit — `Stage.render()` owns the branch and constructs
 * or disposes this pass. Nothing here wraps a live render function.
 */

import * as THREE from 'three';
import { PLATE_LAYER } from './word-gates.js';

export const BLOOM = {
  // N7: 0.30 -> 0.12. Strength stopped mattering long before it was turned
  // up — 0.62 and 0.85 are near-identical frames — because at 0.30 there was
  // almost nothing in the world bright enough to bleed. The dial that changes
  // the QUALITY of the light, which is what separated the shipped frame from
  // the key art, is how much of the world is allowed to be a light source at
  // all. Below ~0.08 the sky above the horizon starts lifting and the blacks
  // go with it; 0.12 is the last stop before that.
  THRESHOLD: 0.12,   // luminance where a pixel starts to bleed
  KNEE: 0.30,        // soft shoulder above it, so nothing pops on
  STRENGTH: 0.78,    // how much of the blur is added back
  // Two blur iterations at quarter resolution. One narrow pass is what a
  // bright pass looks like when nobody checked it against the reference:
  // the halo hugs the edge, the frame reads a few percent brighter, and
  // none of the halation that makes the key art look lit ever appears.
  // Widening costs nothing here — quarter res is a sixteenth of the pixels.
  // Three passes, not two: a tight one for the core, a wide one, and a very
  // wide one for the halation that makes the reference art read as LIT rather
  // than merely bright. Two stopped at a halo that hugged its edge — the
  // frame came out a few percent brighter and none of the bloom you actually
  // see in the key art ever appeared. Each is a quarter-res 5-tap; the third
  // costs two more of the cheapest passes in the frame.
  RADII: [1.0, 2.4, 5.4],
  // REDUCED FLASH: the same dials BROADCAST damps, damped the same way.
  ACCESS_STRENGTH: 0.26,
  ACCESS_RADIUS: 0.55,
};

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Threshold with a soft knee, at half resolution. */
const BRIGHT_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tMask;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float keep = 1.0 - texture2D(tMask, vUv).a;   // the word plate emits nothing
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + uKnee, l) * keep, 1.0);
}
`;

/** One axis of a 9-tap Gaussian, using linear sampling for 5 fetches. */
const BLUR_FRAG = `
uniform sampler2D tColor;
uniform vec2 uPx;
uniform vec2 uDir;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 s = uDir * uPx * uRadius;
  vec3 c = texture2D(tColor, vUv).rgb * 0.2270270270;
  c += texture2D(tColor, vUv + s * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tColor, vUv - s * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tColor, vUv + s * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tColor, vUv - s * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * Scene + bloom, then the renderer's OWN tone map and colour transform.
 *
 * These two chunks are not decoration. The scene is rendered into a linear
 * half-float target, which skips the ACES tone map and the sRGB write that
 * a render straight to the canvas would have applied. Without them the
 * default look would shift the day this pass landed, for every pixel, with
 * the bloom getting the blame. With them, strength 0 is the old frame.
 */
const COMPOSITE_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tMask;
uniform float uStrength;
uniform float uExposure;
varying vec2 vUv;

// three's own ACES fit, written out rather than pulled in through
// <tonemapping_fragment>. The chunk compiles to nothing here: three only
// emits the tone-mapping define for a material it recognises as tone-mapped
// output, and a raw ShaderMaterial reading a render target is not that. The
// silent no-op is worse than no tone mapping at all, because the frame still
// LOOKS plausible — it is just a different, brighter grade than the one this
// game shipped, applied to every pixel, with the bloom taking the blame.
vec3 rrt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 c) {
  const mat3 IN = mat3(0.59719, 0.07600, 0.02840,
                       0.35458, 0.90834, 0.13383,
                       0.04823, 0.01566, 0.83777);
  const mat3 OUT = mat3( 1.60475, -0.10208, -0.00327,
                        -0.53108,  1.10813, -0.07276,
                        -0.07367, -0.00605,  1.07602);
  c *= uExposure / 0.6;
  return clamp(OUT * rrt(IN * c), 0.0, 1.0);
}

void main() {
  float keep = 1.0 - texture2D(tMask, vUv).a;   // and receives none either
  vec3 col = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * uStrength * keep;
  gl_FragColor = vec4(aces(col), 1.0);
  #include <colorspace_fragment>
}
`;

const DOWNSCALE = 0.25;

export class BrightPass {
  constructor(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());

    // Half float, because additive glow routinely pushes past 1.0 and an
    // 8-bit target would clip exactly the pixels this pass exists to bleed.
    // Multisampled, because the renderer was built with antialias:true and
    // an offscreen target does not inherit it — losing that would trade one
    // quality gain for a worse one.
    this.scene = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 4,
    });
    const hw = Math.max(1, Math.floor(size.x * DOWNSCALE));
    const hh = Math.max(1, Math.floor(size.y * DOWNSCALE));
    const half = () => new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    this.a = half();
    this.b = half();
    this.mask = half();

    this.brightU = {
      tColor: { value: this.scene.texture },
      tMask: { value: this.mask.texture },
      uThreshold: { value: BLOOM.THRESHOLD },
      uKnee: { value: BLOOM.KNEE },
    };
    this.blurU = {
      tColor: { value: null },
      uPx: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      uDir: { value: new THREE.Vector2(1, 0) },
      uRadius: { value: BLOOM.RADII[0] },
    };
    this.compU = {
      tColor: { value: this.scene.texture },
      tBloom: { value: this.a.texture },
      tMask: { value: this.mask.texture },
      uStrength: { value: BLOOM.STRENGTH },
      uExposure: { value: 1 },
    };

    // The shipped dials, as instance fields. render() damps these for
    // REDUCED FLASH rather than overwriting them from the constants, so a
    // still driver or the tuning panel can move one and have it stick —
    // a sweep whose knob is reset every frame measures nothing.
    this.threshold = BLOOM.THRESHOLD;
    this.strength = BLOOM.STRENGTH;

    this.bright = this._quad(BRIGHT_FRAG, this.brightU);
    this.blur = this._quad(BLUR_FRAG, this.blurU);
    this.comp = this._quad(COMPOSITE_FRAG, this.compU);
    this.comp.mesh.material.toneMapped = false;  // this shader does it itself
    this._clear = renderer.getClearColor(new THREE.Color()).getHex();
    this.postCam = new THREE.Camera();
  }

  _quad(frag, uniforms) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: frag, uniforms,
        depthTest: false, depthWrite: false,
      })
    );
    mesh.frustumCulled = false;
    const s = new THREE.Scene();
    s.add(mesh);
    return { scene: s, mesh };
  }

  /** The adaptive-DPR governor resizes the drawing buffer between frames. */
  _resize(renderer) {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (s.x === this.scene.width && s.y === this.scene.height) return;
    this.scene.setSize(s.x, s.y);
    const hw = Math.max(1, Math.floor(s.x * DOWNSCALE));
    const hh = Math.max(1, Math.floor(s.y * DOWNSCALE));
    this.a.setSize(hw, hh);
    this.b.setSize(hw, hh);
    this.mask.setSize(hw, hh);
    this.blurU.uPx.value.set(1 / hw, 1 / hh);
  }

  _pass(renderer, quad, target) {
    renderer.setRenderTarget(target);
    renderer.render(quad.scene, this.postCam);
  }

  render(renderer, scene, camera, reducedFlash) {
    this._resize(renderer);
    this.brightU.uThreshold.value = this.threshold;
    this.compU.uStrength.value = reducedFlash
      ? Math.min(this.strength, BLOOM.ACCESS_STRENGTH) : this.strength;
    // The scene target skips the renderer's own tone map, so the composite
    // has to carry the live exposure the art direction is driving.
    this.compU.uExposure.value = renderer.toneMappingExposure;
    const scale = reducedFlash ? BLOOM.ACCESS_RADIUS : 1;

    renderer.setRenderTarget(this.scene);
    renderer.render(scene, camera);

    // The plate mask: the plate layer alone, on a transparent ground, so its
    // own alpha IS the coverage. The scene background is a solid colour and
    // would fill the whole target with alpha 1, so it steps aside for this
    // one render and is put straight back.
    const bg = scene.background;
    const layers = camera.layers.mask;
    scene.background = null;
    camera.layers.set(PLATE_LAYER);
    renderer.setRenderTarget(this.mask);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setClearColor(this._clear, 1);
    camera.layers.mask = layers;
    scene.background = bg;

    this._pass(renderer, this.bright, this.a);
    // Separable, twice: a tight pass for the core and a wide one for the
    // halation. Ping-pong a -> b -> a, so the composite always reads `a`.
    for (const r of BLOOM.RADII) {
      this.blurU.uRadius.value = r * scale;
      this.blurU.tColor.value = this.a.texture;
      this.blurU.uDir.value.set(1, 0);
      this._pass(renderer, this.blur, this.b);
      this.blurU.tColor.value = this.b.texture;
      this.blurU.uDir.value.set(0, 1);
      this._pass(renderer, this.blur, this.a);
    }

    renderer.setRenderTarget(null);
    renderer.render(this.comp.scene, this.postCam);
  }

  dispose(renderer) {
    renderer?.setRenderTarget(null);
    this.scene.dispose();
    this.a.dispose();
    this.b.dispose();
    this.mask.dispose();
    for (const q of [this.bright, this.blur, this.comp]) {
      q.mesh.geometry.dispose();
      q.mesh.material.dispose();
    }
  }
}

export default BrightPass;
