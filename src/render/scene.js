/**
 * Scene, renderer, lights, fog.
 *
 * The mountain changes visual pressure as the player descends. RC9.7 hands the
 * late run to EndgameSky, which turns that pressure into a complete impossible
 * alpine day: sunset, moon country, high night, false dawn and morning.
 */

import * as THREE from 'three';
import '../rc97-endgame.js';
import TUNING from '../TUNING.js';
import { PALETTE, LIGHT } from './palette.js';
import { bandForDistance } from './art-direction.js';
import { EndgameSky } from './endgame-sky.js';

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
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
    this.camera = new THREE.PerspectiveCamera(
      TUNING.CAMERA.FOV, 1, 0.5, 420
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

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
