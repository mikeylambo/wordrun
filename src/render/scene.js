/**
 * Scene, renderer, lights, fog.
 *
 * The mountain changes visual pressure as the player descends. RC9.7 hands the
 * late run to EndgameSky, which turns that pressure into a complete impossible
 * long day: sunset, moon country, high night, false dawn and morning.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { PALETTE, LIGHT } from './palette.js';
import { bandForDistance } from './art-direction.js';
import { EndgameSky } from './endgame-sky.js';
import { RoadReflection } from './road-reflection.js';
import { ScreenFx } from './screen-fx.js';
import { ACCESS } from '../ui/access.js';

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      // The wet mirror reads its road mask from the frame's alpha
      // (render/road-reflection.js). Every path still ends at alpha 1.
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(PALETTE.SKY, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(PALETTE.FOG, TUNING.FOG.NEAR, TUNING.FOG.FAR);
    this.scene.background = new THREE.Color(PALETTE.SKY);

    // Deep morning opens the sightline well beyond the original fog range.
    // RC13.2: the far plane reaches the skyline (render/skyline.js). The
    // world fog still closes at 255 m; only the fog-free towers live out here.
    this.camera = new THREE.PerspectiveCamera(
      TUNING.CAMERA.FOV, 1, 0.5, 1000
    );

    const key = new THREE.DirectionalLight(LIGHT.KEY_COLOR, LIGHT.KEY_INTENSITY);
    key.position.set(...LIGHT.KEY_DIR);
    this.scene.add(key);
    this.key = key;

    const hemi = new THREE.HemisphereLight(
      LIGHT.HEMI_SKY, LIGHT.HEMI_GROUND, LIGHT.HEMI_INTENSITY
    );
    this.scene.add(hemi);
    this.hemi = hemi;

    this._targetSky = new THREE.Color(PALETTE.SKY);
    this._targetFog = new THREE.Color(PALETTE.FOG);
    this._targetKey = new THREE.Color(LIGHT.KEY_COLOR);
    this._targetHemiSky = new THREE.Color(LIGHT.HEMI_SKY);
    this._targetHemiGround = new THREE.Color(LIGHT.HEMI_GROUND);
    this._lastBand = null;
    this._fogNear = TUNING.FOG.NEAR;
    this._fogFar = TUNING.FOG.FAR;

    this.endgameSky = new EndgameSky({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      key: this.key,
      hemi: this.hemi,
    });

    // The screen FX prototypes (speed blur, horizon light): one pass,
    // silent until main's update() gives it something to do.
    this.fx = new ScreenFx(this.renderer);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
  }

  /**
   * RC9.3: the drawing buffer follows the CANVAS's own box, not the window's.
   *
   * On a screen wider than it is tall the play area is framed as a vertical
   * cabinet and the canvas is a portrait column inside a bezel — so the window
   * and the frame stopped being the same rectangle. Reading the element is
   * also simply more correct in the portrait case, where the two agree: the
   * canvas is what the projection has to match, and the window was only ever
   * a proxy for it. `updateStyle` stays false because CSS owns the box.
   */
  resize() {
    const el = this.renderer.domElement;
    const w = Math.max(1, el.clientWidth || window.innerWidth);
    const h = Math.max(1, el.clientHeight || window.innerHeight);
    // `this.dpr` is the single source for the pixel ratio: the constructor
    // seeds it from the device and the RC7.1 render-budget governor lowers
    // and raises it. Re-reading devicePixelRatio here would have thrown the
    // governor's choice away on every resize.
    this.dpr = Math.max(0.5, Math.min(this.dpr || window.devicePixelRatio || 1, 2));
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the key light anchored near the player and evolve the mountain mood. */
  followLight(x, y, z) {
    this.key.position.set(x + LIGHT.KEY_DIR[0] * 80, y + 90, z + LIGHT.KEY_DIR[2] * 80);
    this.key.target.position.set(x, y, z);
    this.key.target.updateMatrixWorld();

    const distance = Math.max(0, -z);

    // EndgameSky executes inside this existing per-frame path. It owns late-run
    // lighting without introducing a second animation loop.
    if (this.endgameSky.update(distance, x, y, z)) return;

    const band = bandForDistance(distance);
    if (band.id !== this._lastBand) {
      this._lastBand = band.id;
      this._targetSky.setHex(band.sky);
      this._targetFog.setHex(band.fog);
      this._targetKey.setHex(band.key);
      this._targetHemiSky.setHex(band.hemiSky);
      this._targetHemiGround.setHex(band.hemiGround);
    }

    const k = 0.018;
    this.scene.background.lerp(this._targetSky, k);
    this.scene.fog.color.lerp(this._targetFog, k);
    this.key.color.lerp(this._targetKey, k);
    this.hemi.color.lerp(this._targetHemiSky, k);
    this.hemi.groundColor.lerp(this._targetHemiGround, k);

    this._fogNear += (band.fogNear - this._fogNear) * k;
    this._fogFar += (band.fogFar - this._fogFar) * k;
    this.scene.fog.near = this._fogNear;
    this.scene.fog.far = this._fogFar;

    const depth = Math.min(1, distance / 4200);
    this.renderer.toneMappingExposure = 1.03 - depth * 0.13;
  }

  /**
   * The render-budget governor (RC7.1): an EMA of real frame time lowers the
   * pixel ratio by 0.15 after ~1.1 s of frames slower than 23.5 ms, and gives
   * it back 0.1 at a time after ~5 s under 17.4 ms. Floor 0.85, ceiling the
   * device's own ratio (max 2). It goes through resize() so the camera's
   * aspect follows the canvas, never the window.
   */
  _governBudget() {
    const b = this._budget || (this._budget = {
      last: performance.now(), ema: 16.7, slowFor: 0, fastFor: 0,
      ceiling: Math.min(window.devicePixelRatio || 1, 2),
    });
    const now = performance.now();
    const dtMs = Math.min(80, Math.max(1, now - b.last));
    b.last = now;
    b.ema += (dtMs - b.ema) * 0.035;
    const applyDpr = (next) => {
      next = Math.max(0.85, Math.min(b.ceiling, Math.round(next * 20) / 20));
      if (Math.abs(next - this.dpr) < 0.04) return;
      this.dpr = next;
      this.resize();
    };
    if (b.ema > 23.5) {
      b.slowFor += dtMs / 1000;
      b.fastFor = 0;
      // The wet mirror is the first thing a slow device gives up, before
      // any resolution. Playtest 10/9: it used to stay off for the session,
      // so one slow second (an app returning from the background) lost it
      // for good — it now comes back below, last, once frames are fast.
      if (b.slowFor > 1.1 && !b.reflectOff) { b.reflectOff = true; b.slowFor = 0; }
      else if (b.slowFor > 1.1) { applyDpr(this.dpr - 0.15); b.slowFor = 0; }
    } else if (b.ema < 17.4) {
      b.fastFor += dtMs / 1000;
      b.slowFor = 0;
      if (b.fastFor > 5.0 && this.dpr < b.ceiling - 0.01) { applyDpr(this.dpr + 0.1); b.fastFor = 0; }
      // Full resolution and still fast: the mirror returns. Each return
      // doubles the wait for the next, so a device that cannot hold both
      // settles instead of flickering.
      else if (b.reflectOff && b.fastFor > (b.reflectWait || 5)) {
        b.reflectOff = false;
        b.reflectWait = Math.min(80, (b.reflectWait || 5) * 2);
        b.fastFor = 0;
      }
    } else {
      b.slowFor = Math.max(0, b.slowFor - dtMs / 1800);
      b.fastFor = Math.max(0, b.fastFor - dtMs / 1600);
    }
  }

  /** `plates`: the word plates' meshes, which the wet mirror must never touch. */
  render(plates = []) {
    this._governBudget();
    // The wet mirror (render/road-reflection.js): the scene is drawn once,
    // into its target, then mirrored onto the road in one screen pass. The
    // plate meshes are handed in by main's frame loop.
    if (TUNING.WET.REFLECT > 0 && !this._budget.reflectOff) {
      if (!this.reflection) this.reflection = new RoadReflection(this.renderer);
      this.reflection.render(this.renderer, this.scene, this.camera, {
        plates,
        reducedFlash: ACCESS.reducedFlash,
        time: performance.now() / 1000,
      });
    } else {
      if (this.reflection) {
        this.reflection.dispose(this.renderer);
        this.reflection = null;
      }
      this.renderer.render(this.scene, this.camera);
    }
    // Speed blur + horizon light (render/screen-fx.js), over the finished
    // frame; main drives `this.fx` with the run's speed and its moments.
    this.fx.render(this.renderer, this.camera, plates);
  }
}
