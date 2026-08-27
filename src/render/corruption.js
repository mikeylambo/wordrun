/**
 * THE REDLINE — WORD RUN's antagonist presentation.
 *
 * A red editing-pen chasing the draft. There is no creature: the same gap
 * value that placed the beast now places an advancing front of red-shot
 * noise — a localized strike-mark where the beast's body used to be (so the
 * side-offset approach, the lunge tell, the kill framing and the panned
 * audio all keep their exact spatial meaning), and a track-wide FIELD
 * behind it that reads as "it's coming from behind" at any distance.
 *
 * The Redline keeps the beast's one learnable move: the tell compresses it
 * and burns its scan-bar bright before the strike surges it forward. Red
 * belongs to the Redline alone — nothing else on screen may compete for it.
 *
 * Consumes sim values only through the update() arguments the BeastActor
 * contract already carried, plus corruption-curve for intensity shaping.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { corruptionIntensity, fieldScale } from './corruption-curve.js';

const REDRAW_EVERY = 0.085;   // seconds between static re-rolls
const FIELD_MIN_BEHIND = 26;  // the field never crosses the camera boom
const FIELD_W = 56;
const FIELD_H = 13;
const TEAR_W = 5.4;
const TEAR_H = 9.0;

function staticTexture(w = 96, h = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return { canvas, tex };
}

/**
 * Re-roll a static canvas. `heat` 0..1 pushes the mix from cyan interference
 * toward danger red; `density` scales how much of the frame is alive.
 */
function drawStatic(canvas, tex, density, heat, pale = false) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);

  const specks = Math.floor(40 + density * 220);
  for (let i = 0; i < specks; i++) {
    const r = Math.random();
    g.fillStyle = pale
      ? (r < 0.5 ? 'rgba(220,245,255,0.85)' : r < 0.8 ? 'rgba(150,225,255,0.7)' : 'rgba(255,255,255,0.9)')
      : r < 0.42 + heat * 0.4 ? (r < 0.18 + heat * 0.4 ? 'rgba(255,42,31,0.85)' : 'rgba(103,216,255,0.8)')
      : r < 0.8 ? 'rgba(220,245,255,0.75)' : 'rgba(10,16,23,0.9)';
    g.fillRect(Math.random() * w, Math.random() * h,
      1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  const bars = Math.floor(2 + density * 6);
  for (let i = 0; i < bars; i++) {
    const y = Math.random() * h;
    g.fillStyle = pale
      ? `rgba(210,240,255,${0.14 + Math.random() * 0.25})`
      : Math.random() < heat ? `rgba(255,42,31,${0.18 + Math.random() * 0.3})`
        : `rgba(103,216,255,${0.14 + Math.random() * 0.28})`;
    g.fillRect(0, y, w, 1 + Math.random() * 3);
  }
  tex.needsUpdate = true;
}

function plane(w, h, map, opacity = 1, blending = THREE.AdditiveBlending) {
  const mat = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity, depthWrite: false,
    blending, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.frustumCulled = false;
  return mesh;
}

export class CorruptionActor {
  constructor(scene) {
    // Same skeleton the BeastActor exposed: patch layers reach for root/body.
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);

    this.tearTex = staticTexture(72, 128);
    this.fieldTex = staticTexture(160, 48);

    // The tear: a vertical rip of static where the beast's body stood.
    this.core = plane(TEAR_W, TEAR_H, this.tearTex.tex, 0.92);
    this.core.position.y = TEAR_H / 2;
    this.body.add(this.core);

    this.shardL = plane(TEAR_W * 0.42, TEAR_H * 0.66, this.tearTex.tex, 0.5);
    this.shardL.position.set(-TEAR_W * 0.62, TEAR_H * 0.36, 0.2);
    this.shardL.rotation.z = 0.1;
    this.body.add(this.shardL);

    this.shardR = plane(TEAR_W * 0.36, TEAR_H * 0.5, this.tearTex.tex, 0.5);
    this.shardR.position.set(TEAR_W * 0.58, TEAR_H * 0.5, -0.2);
    this.shardR.rotation.z = -0.13;
    this.body.add(this.shardR);

    // The scan bar: the red "eye". Danger owns red; the tell burns it bright.
    this.bar = new THREE.Mesh(
      new THREE.PlaneGeometry(TEAR_W * 1.25, 0.34),
      new THREE.MeshBasicMaterial({
        color: 0xff2a1f, transparent: true, opacity: 0.55, fog: false,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    this.bar.position.y = TEAR_H * 0.62;
    this.body.add(this.bar);

    // The tongue: a floor-level strip of static licking toward the runner —
    // the part of the tear that reaches INTO the narrow portrait frame the
    // way the beast's shoulder used to.
    this.tongue = plane(13, 1.9, this.tearTex.tex, 0.6);
    this.tongue.position.set(0, 0.85, -2.4);
    this.body.add(this.tongue);

    // The field: the advancing front spanning the whole track behind the tear.
    this.field = plane(FIELD_W, FIELD_H, this.fieldTex.tex, 0.5);
    this.field.material.blending = THREE.NormalBlending;
    scene.add(this.field);

    this.t = 0;
    this._redrawT = 0;
    this._heat = 0;
    this.reset();
  }

  reset() {
    this.t = 0;
    this._redrawT = 0;
    this._heat = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.field.visible = false;
    this.root.visible = true;
  }

  /** Same signature the BeastActor carried — a drop-in consumer of the gap. */
  update(dt, gap, x, groundY, playerD, killT, side = 1, lunge = 'idle', lungeT = 0) {
    this.t += dt;
    const beastD = playerD - gap;
    this.root.position.set(x, groundY, -beastD);
    // Reach toward the runner's side of the frame: the beast's shoulders sat
    // on the frame edge; the tear leans the same way or it is simply unseen.
    this.body.position.x += ((-side * 1.15) - this.body.position.x) * (1 - Math.exp(-6 * dt));

    const intensity = corruptionIntensity(gap);

    // Heat: quiet cyan interference far out, red-shot as it closes; the tell
    // slams it to full red — that half-second is the move you learn to read.
    let heatTarget = Math.min(0.75, intensity * 0.9);
    if (lunge === 'tell') heatTarget = 1;
    if (lunge === 'strike') heatTarget = 1;
    this._heat += (heatTarget - this._heat) * (1 - Math.exp(-9 * dt));

    this._redrawT -= dt;
    if (this._redrawT <= 0) {
      this._redrawT = REDRAW_EVERY;
      drawStatic(this.tearTex.canvas, this.tearTex.tex, 0.35 + intensity * 0.65, this._heat);
      drawStatic(this.fieldTex.canvas, this.fieldTex.tex, 0.25 + intensity * 0.5, this._heat * 0.5);
    }

    // The tear breathes; urgency shortens the breath the way the gallop
    // cadence used to.
    const cadence = 3.2 + intensity * 5.5;
    const breath = 1 + Math.sin(this.t * cadence) * (0.03 + intensity * 0.05);
    const flicker = 0.86 + Math.abs(Math.sin(this.t * (17 + intensity * 26))) * 0.14;
    this.core.material.opacity = (0.55 + intensity * 0.4) * flicker;
    this.shardL.material.opacity = 0.3 + intensity * 0.35;
    this.shardR.material.opacity = 0.26 + intensity * 0.3;
    this.tongue.material.opacity = (0.35 + intensity * 0.5) * flicker;
    this.tongue.scale.x = 1 + intensity * 0.7;

    if (lunge === 'tell') {
      const k = Math.min(1, lungeT / Math.max(0.01, TUNING.BEAST.LUNGE_TELL));
      // Wind-up: compress and darken-to-red, the haunches-down analog.
      this.body.scale.y = breath * (1 - k * 0.28);
      this.body.scale.x = 1 + k * 0.22;
      this.body.position.z = k * 0.4;
      this.bar.material.opacity = 0.55 + k * 0.45;
      this.bar.scale.x = 1 + k * 1.6;
    } else if (lunge === 'strike') {
      this.body.scale.y = breath * 1.18;
      this.body.scale.x = 0.92;
      this.body.position.z = -1.4;
      this.bar.material.opacity = 1;
      this.bar.scale.x = 2.8;
    } else {
      this.body.scale.y += (breath - this.body.scale.y) * (1 - Math.exp(-8 * dt));
      this.body.scale.x += (1 - this.body.scale.x) * (1 - Math.exp(-8 * dt));
      this.body.position.z += (0 - this.body.position.z) * (1 - Math.exp(-8 * dt));
      this.bar.material.opacity = 0.3 + intensity * 0.4 + Math.sin(this.t * 2.2) * 0.08;
      this.bar.scale.x += (1 - this.bar.scale.x) * (1 - Math.exp(-6 * dt));
    }

    if (killT > 0) {
      // Engulf: the tear opens into the whole frame while the kill cam whips.
      const k = Math.min(1, killT / Math.max(0.01, TUNING.BEAST.KILL_WHIP_TIME));
      const s = 1 + k * 2.6;
      this.body.scale.set(s, s * 0.9, 1);
      this.core.material.opacity = 1;
      this.bar.material.opacity = 1;
      this.bar.scale.x = 1 + k * 4;
    }

    // The field trails the tear but never crosses the camera boom, so it can
    // encroach without ever blanking the frame — the beast rule, kept.
    const fieldD = Math.min(beastD - 4, playerD - FIELD_MIN_BEHIND);
    const fs = fieldScale(intensity);
    this.field.visible = true;
    this.field.position.set(0, groundY + (FIELD_H * fs) / 2 - 0.5, -fieldD);
    this.field.scale.set(1, fs, 1);
    this.field.material.opacity = 0.22 + intensity * 0.5;
  }

  setVisible(v) {
    this.root.visible = v;
    this.field.visible = v && this.field.visible;
  }
}

export { drawStatic, staticTexture, plane };
