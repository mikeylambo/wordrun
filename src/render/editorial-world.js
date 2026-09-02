/**
 * The Editorial World (Phase M) — the page geometry, live.
 *
 * The renderer half of editorial-layout.js: seven instanced meshes (rules,
 * greeked type, full stops, dashes, brackets, drop caps, and the Redline's
 * correction bars), rebuilt from the pure layout as the player travels and
 * as the band changes. Integration is explicit — main.js constructs this
 * and calls update() from the frame loop; nothing wraps a live render
 * function.
 *
 * Colour discipline: every material tints the art-direction band's own
 * crest and ice — no hue is new — except the correction bars, which wear
 * the ACCESS danger colour so the Redline's red follows the player's
 * colour-vision mode and stays the only saturated red in the world.
 * REDUCED FLASH: nothing here pulses; the band change is a state change,
 * and the flow factor scales opacity smoothly like the pylons.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { ACCESS } from '../ui/access.js';
import { bandForDistance } from './art-direction.js';
import { corruptionIntensity } from './corruption-curve.js';
import {
  CAPS, CORRECTION_CAP, INK, REBUILD_AFTER,
  layoutCorrections, layoutPage, stepBand,
} from './editorial-layout.js';

const HALF_W = TUNING.RUN.TRACK_HALF_W;

export class EditorialWorld {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'editorial-world';
    scene.add(this.group);

    const mat = () => new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 1, fog: true,
    });
    this.matRule = mat();
    this.matType = mat();
    this.matMark = mat();
    this.matCap = mat();
    this.matCorrection = mat();

    const box = new THREE.BoxGeometry(1, 1, 1);
    const ball = new THREE.SphereGeometry(0.5, 18, 12);
    this.meshes = {
      rules: new THREE.InstancedMesh(box, this.matRule, CAPS.rules),
      type: new THREE.InstancedMesh(box, this.matType, CAPS.type),
      stops: new THREE.InstancedMesh(ball, this.matMark, CAPS.stops),
      dashes: new THREE.InstancedMesh(box, this.matMark, CAPS.dashes),
      brackets: new THREE.InstancedMesh(box, this.matMark, CAPS.brackets),
      caps: new THREE.InstancedMesh(box, this.matCap, CAPS.caps),
      corrections: new THREE.InstancedMesh(box, this.matCorrection, CORRECTION_CAP),
    };
    for (const m of Object.values(this.meshes)) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._ice = new THREE.Color();
    this._crest = new THREE.Color();

    this.band = 0;        // the world's memory — see stepBand
    this._builtBand = -1;
    this._anchor = null;
    this._flow = 1;
  }

  /** New run: the manuscript starts sparse again. */
  reset() {
    this.band = 0;
    this._builtBand = -1;
    this._anchor = null;
  }

  /** A wrong read drops ONE layer of the architecture (Phase M brief). */
  onWrongRead() {
    this.band = stepBand(this.band, 0, true);
  }

  setFlow(factor) { this._flow = factor; }

  _fill(mesh, list) {
    const n = Math.min(list.length, mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      const [x, y, z, sx, sy, sz] = list[i];
      this._p.set(x, y, z);
      this._s.set(sx, sy, sz);
      this._m.compose(this._p, this._q, this._s);
      mesh.setMatrixAt(i, this._m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }

  _paint(level, playerD) {
    const ink = INK[level];
    const band = bandForDistance(Math.max(0, playerD));
    this._ice.setHex(band.ice);
    this._crest.setHex(band.crest);
    this.matRule.color.copy(this._ice).multiplyScalar(0.9 + 0.6 * ink);
    this.matRule.opacity = 0.35 + 0.65 * ink;
    this.matType.color.copy(this._crest).multiplyScalar(0.8 + 0.9 * ink);
    this.matType.opacity = 0.30 + 0.70 * ink;
    this.matMark.color.copy(this._ice).multiplyScalar(1.0 + 0.7 * ink);
    this.matMark.opacity = 0.5 + 0.5 * ink;
    this.matCap.color.copy(this._crest).multiplyScalar(1.6);
    this.matCap.opacity = 0.95;
  }

  /**
   * Once a frame. `chain` rises the band; wrong reads arrive through
   * onWrongRead() from the sim-event drain, frame-accurate.
   */
  update(playerD, chain, beastGap) {
    this.band = stepBand(this.band, chain, false);

    const moved = this._anchor == null || Math.abs(playerD - this._anchor) > REBUILD_AFTER;
    if (this.band !== this._builtBand || moved) {
      this._builtBand = this.band;
      this._anchor = playerD;
      const page = layoutPage(this.terrain, playerD, this.band, HALF_W);
      this._fill(this.meshes.rules, page.rules);
      this._fill(this.meshes.type, page.type);
      this._fill(this.meshes.stops, page.stops);
      this._fill(this.meshes.dashes, page.dashes);
      this._fill(this.meshes.brackets, page.brackets);
      this._fill(this.meshes.caps, page.caps);
    }
    this._paint(this.band, playerD);
    // The earned light breathes with flow, exactly like the stanchions.
    const glow = Math.min(1.15, 0.75 + 0.25 * this._flow);
    this.matType.opacity *= glow;
    this.matRule.opacity *= glow;

    // The Redline's correction: red strikes through the nearest lines as
    // the gap closes — the editor catching the manuscript. The colour is
    // the live ACCESS danger accent, so every colour-vision mode keeps the
    // Redline's alarm as ITS one hue. Static — nothing to flash.
    const intensity = corruptionIntensity(beastGap);
    this.matCorrection.color.setHex(ACCESS.danger);
    this.matCorrection.opacity = 0.28 + 0.62 * intensity;
    this._fill(this.meshes.corrections,
      intensity > 0.02 ? layoutCorrections(this.terrain, playerD, intensity, HALF_W) : []);
  }
}

export default EditorialWorld;
