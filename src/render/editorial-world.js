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
import { MOUNTAIN_BANDS, bandBlend } from './art-direction.js';
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
      arches: new THREE.InstancedMesh(box, this.matRule, CAPS.arches),
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
    this._mix = new THREE.Color();

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

  /** E2: the arrival beat when a band is earned — one brief swell of ink
   *  over ~0.7 s. REDUCED FLASH skips the swell; the arrival note stays. */
  pulseInk() {
    if (!ACCESS.reducedFlash) this._swellT = 0.7;
  }

  /** N1: one correct read typesets — a 0.22s local brightening of the page,
   *  scaled by how early the answer landed. REDUCED FLASH skips it; the
   *  audio strike carries the tell there. */
  typesetSnap(early = 0) {
    if (ACCESS.reducedFlash) return;
    this._snapT = 0.22;
    this._snapAmp = 0.5 + 0.5 * Math.max(0, Math.min(1, early));
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
    // Phase V: the page's colour TRAVELS. The mood arc's bands used to snap
    // at their thresholds; the page now lerps between neighbouring bands
    // exactly as the sky does, so surviving deeper visibly walks the world
    // through the arc's whole palette — vibrance from hues that already
    // exist, never a new literal (gated).
    const mix = bandBlend(Math.max(0, playerD), 220);
    const a = MOUNTAIN_BANDS[mix.from], b = MOUNTAIN_BANDS[mix.to];
    this._ice.setHex(a.ice).lerp(this._mix.setHex(b.ice), mix.t);
    this._crest.setHex(a.crest).lerp(this._mix.setHex(b.crest), mix.t);
    // Phase V role split — material separation: the PAGE MASS (rules, type)
    // wears the arc's warm crest family end to end, while the punctuation
    // sculpture keeps the cool ice accent. The track's own lines stay ice
    // outside this file, so the road reads as a surface and the page reads
    // as a world instead of both dissolving into one neon wireframe.
    this.matRule.color.copy(this._crest).multiplyScalar(0.75 + 0.55 * ink);
    this.matRule.opacity = 0.35 + 0.65 * ink;
    this.matType.color.copy(this._crest).multiplyScalar(0.8 + 0.9 * ink);
    this.matType.opacity = 0.30 + 0.70 * ink;
    this.matMark.color.copy(this._ice).multiplyScalar(1.1 + 0.7 * ink);
    this.matMark.opacity = 0.5 + 0.5 * ink;
    this.matCap.color.copy(this._ice).multiplyScalar(1.7);
    this.matCap.opacity = 0.95;
  }

  /**
   * Once a frame. `chain` rises the band; wrong reads arrive through
   * onWrongRead() from the sim-event drain, frame-accurate.
   */
  update(playerD, chain, beastGap, dt = 1 / 60) {
    this.band = stepBand(this.band, chain, false);
    this._swellT = Math.max(0, (this._swellT || 0) - dt);

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
      this._fill(this.meshes.arches, page.arches);
    }
    this._paint(this.band, playerD);
    // The earned light breathes with flow, exactly like the stanchions;
    // a fresh band arrives on one swell of ink (E2), decaying smoothly.
    // N1: each correct read lands its own short, sharper snap — the word
    // visibly typesets INTO the page, so every answer is a construction
    // event, not only a score event.
    this._snapT = Math.max(0, (this._snapT || 0) - dt);
    const swell = 1 + (this._swellT || 0) / 0.7 * 0.35
      + (this._snapT || 0) / 0.22 * 0.28 * (this._snapAmp || 0);
    const glow = Math.min(1.15, 0.75 + 0.25 * this._flow) * swell;
    this.matType.opacity = Math.min(1, this.matType.opacity * glow);
    this.matRule.opacity = Math.min(1, this.matRule.opacity * glow);

    // The Redline's correction: red strikes through the nearest lines as
    // the gap closes — the editor catching the manuscript. The colour is
    // the live ACCESS danger accent, so every colour-vision mode keeps the
    // Redline's alarm as ITS one hue. Static — nothing to flash.
    // (Debug pass N1: this block sat BELOW the return and never ran — the
    // corrections were invisible live. The gate now proves it executes.)
    const intensity = corruptionIntensity(beastGap);
    this.matCorrection.color.setHex(ACCESS.danger);
    this.matCorrection.opacity = 0.28 + 0.62 * intensity;
    this._fill(this.meshes.corrections,
      intensity > 0.02 ? layoutCorrections(this.terrain, playerD, intensity, HALF_W) : []);
    return this.band;
  }
}

export default EditorialWorld;
