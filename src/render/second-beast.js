/**
 * THE CARET — DICTION DASH's second antagonist presentation.
 *
 * A proofreader's insertion mark. DESCENT's rare pale second pursuer becomes
 * a rare PALE editing event: a cluster of white-noise shards that crosses
 * the track on the exact same deterministic sim state (position, tell,
 * charge, exit) the frost beast used. Pale/white so it never reads as a
 * clone of the Redline's red-shot strike — the two-antagonist contrast
 * rule, kept.
 */

import * as THREE from 'three';
import { staticTexture, drawStatic, plane } from './corruption.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class SecondBeastActor {
  constructor(scene) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.visible = false;
    scene.add(this.root);

    this.tex = staticTexture(64, 96);

    // Three vertical shards, tallest centred: a spike of pale noise.
    this.shards = [];
    for (const [w, h, x, z, rot] of [
      [2.0, 6.4, 0, 0, 0],
      [1.1, 4.2, -1.35, 0.25, 0.16],
      [0.9, 3.4, 1.25, -0.2, -0.2],
    ]) {
      const s = plane(w, h, this.tex.tex, 0.7);
      s.position.set(x, h / 2, z);
      s.rotation.z = rot;
      this.body.add(s);
      this.shards.push(s);
    }

    // Pale scan bar — cyan-white, never the main corruption's red.
    this.bar = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.22),
      new THREE.MeshBasicMaterial({
        color: 0xaef2ff, transparent: true, opacity: 0.7, fog: false,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    this.bar.position.y = 4.4;
    this.body.add(this.bar);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 18),
      new THREE.MeshBasicMaterial({
        color: 0x02060a, transparent: true, opacity: 0.14, depthWrite: false,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.035;
    this.root.add(this.shadow);

    this.t = 0;
    this._redrawT = 0;
  }

  update(state, terrain, dt, killT = 0, player = null) {
    this.t += dt;
    if (!state || (!state.active && !state.killed && killT <= 0)) {
      this.root.visible = false;
      return;
    }

    this.root.visible = true;
    const groundY = terrain.heightAt(state.x, state.d);
    this.root.position.set(state.x, groundY + state.lift, -state.d);
    this.root.rotation.y = -state.heading;
    this.shadow.position.y = -state.lift + 0.035;
    this.shadow.material.opacity = 0.06 + 0.09 * (1 - clamp01(Math.abs(state.lift) / 6));

    const charge = state.phase === 'charge';
    this._redrawT -= dt;
    if (this._redrawT <= 0) {
      this._redrawT = charge ? 0.05 : 0.1;
      drawStatic(this.tex.canvas, this.tex.tex, charge ? 0.9 : 0.45, 0, true);
    }

    // Tell: the shards converge and crouch — the frost beast's wind-up beat.
    const crouch = state.phase === 'tell'
      ? 0.82 + clamp01(state.phaseT / Math.max(0.01, state.tellTime)) * 0.18
      : 1;
    this.body.scale.y += (crouch - this.body.scale.y) * (1 - Math.exp(-11 * dt));

    const spread = state.phase === 'tell'
      ? 1 - clamp01(state.phaseT / Math.max(0.01, state.tellTime)) * 0.45
      : charge ? 1.25 : 1;
    this.shards[1].position.x = -1.35 * spread;
    this.shards[2].position.x = 1.25 * spread;

    const flicker = charge
      ? 0.7 + Math.abs(Math.sin(this.t * 34)) * 0.3
      : 0.5 + Math.abs(Math.sin(this.t * 11)) * 0.2;
    for (const s of this.shards) s.material.opacity = flicker;
    this.bar.material.opacity = state.phase === 'tell' ? 1 : charge ? 0.85 : 0.55;

    // Charge lean along its own travel, per pattern.
    const e = clamp01(state.phaseT / Math.max(0.01, state.chargeTime || 1));
    if (charge && state.kind === 'vault') this.body.rotation.x = Math.sin(e * Math.PI) * 0.4;
    else if (charge && state.kind === 'cross') this.body.rotation.z = state.side * (0.14 + Math.sin(e * Math.PI) * 0.1);
    else if (charge) this.body.rotation.x = 0.16 + Math.sin(e * Math.PI) * 0.12;
    else {
      this.body.rotation.x *= 1 - Math.min(1, dt * 7);
      this.body.rotation.z *= 1 - Math.min(1, dt * 7);
    }

    if (state.phase === 'exit') {
      // A miss stays an authored beat: it streaks out of the scene, thinning.
      for (const s of this.shards) s.material.opacity *= 0.94;
      this.shadow.material.opacity *= 0.94;
    }

    if (killT > 0 && player) {
      const k = clamp01(killT / 0.5);
      const s = 1 + k * 2.2;
      this.body.scale.set(s, s, 1);
      for (const sh of this.shards) sh.material.opacity = 1;
      this.bar.material.opacity = 1;
    }
  }
}

export default SecondBeastActor;
