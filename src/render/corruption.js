/**
 * THE REDLINE — DICTION DASH's antagonist presentation.
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
import { makeContactShadow } from './contact-shadow.js';
import TUNING from '../TUNING.js';
import { corruptionIntensity, fieldScale } from './corruption-curve.js';
import { ACCESS } from '../ui/access.js';

const REDRAW_EVERY = 0.085;   // seconds between static re-rolls
const FIELD_MIN_BEHIND = 26;  // the field never crosses the camera boom
const FIELD_W = 56;
const FIELD_H = 13;
const TEAR_W = 5.4;
const TEAR_H = 9.0;
// The broken slabs (key art): red-lit blocks of struck-out copy crumbling in
// from the margins beside the tear. They stay outside the track edge, behind
// the runner — never on a camera-to-plate sight line — and their faces are
// struck bars, not glyphs: the word plate stays the only text in the world.
const SLAB_N = 14;
const SLAB_IN = TUNING.RUN.TRACK_HALF_W + 1.2;  // innermost edge a slab reaches
const fract = (v) => v - Math.floor(v);
const hash = (i, k) => fract(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);

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
      : r < 0.42 + heat * 0.4 ? (r < 0.18 + heat * 0.4 ? `rgba(${ACCESS.dangerCss},0.85)` : 'rgba(103,216,255,0.8)')
      : r < 0.8 ? 'rgba(220,245,255,0.75)' : 'rgba(10,16,23,0.9)';
    g.fillRect(Math.random() * w, Math.random() * h,
      1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  const bars = Math.floor(2 + density * 6);
  for (let i = 0; i < bars; i++) {
    const y = Math.random() * h;
    g.fillStyle = pale
      ? `rgba(210,240,255,${0.14 + Math.random() * 0.25})`
      : Math.random() < heat ? `rgba(${ACCESS.dangerCss},${0.18 + Math.random() * 0.3})`
        : `rgba(103,216,255,${0.14 + Math.random() * 0.28})`;
    g.fillRect(0, y, w, 1 + Math.random() * 3);
  }
  tex.needsUpdate = true;
}

/** A slab face: dark stone carrying lines of copy, each one struck through.
 *  Greyscale; the material wears the live danger accent. */
function slabTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgb(34,34,34)';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgb(90,90,90)';
  g.fillRect(0, 0, 128, 3);
  g.fillRect(0, 61, 128, 3);
  for (let i = 0; i < 3; i++) {
    const y = 12 + i * 17;
    const w = 70 + ((i * 37) % 40);
    g.fillStyle = 'rgb(200,200,200)';
    g.fillRect(12, y, w, 9);                         // the line of copy
    g.fillStyle = 'rgb(255,255,255)';
    g.fillRect(6, y + 3, w + 12, 3);                 // and its strikethrough
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
    // Same skeleton the BeastActor exposed (root/body), so the camera and
    // the view pose read it unchanged.
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);
    this.contact = makeContactShadow(scene, 2.1, 0.16);
    this.contact.scale.set(1.2, 0.72, 1);

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

    // The slabs: one instanced draw, laid each frame from a per-slab phase.
    this.slabMat = new THREE.MeshBasicMaterial({
      color: 0xff2a1f, map: slabTexture(), transparent: true, opacity: 0.9,
      depthWrite: false, fog: false, toneMapped: false,
    });
    this.slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.slabMat, SLAB_N);
    this.slabs.frustumCulled = false;
    this.slabs.count = 0;
    this.slabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.slabs);
    this._sm = new THREE.Matrix4();
    this._sq = new THREE.Quaternion();
    this._se = new THREE.Euler();
    this._sp = new THREE.Vector3();
    this._ss = new THREE.Vector3();

    this.t = 0;
    this._redrawT = 0;
    this._heat = 0;
    this.reset();
  }

  /** Lay the slabs: each rises out of the margin, leans in toward the track
   *  edge, tumbles, and crumbles away — then comes again. How many are live
   *  is the corruption intensity; REDUCED FLASH keeps them but slows them. */
  _laySlabs(intensity, gap) {
    const n = Math.round(Math.min(1, intensity * 1.3) * SLAB_N);
    const pace = ACCESS.reducedFlash ? 0.5 : 1;
    let c = 0;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const period = 2.6 + hash(i, 1) * 1.8;
      const p = fract((this.t * pace) / period + hash(i, 2));
      const rise = Math.min(1, p / 0.22);
      const fall = Math.max(0, (p - 0.78) / 0.22);
      const ease = 1 - (1 - rise) * (1 - rise);
      // Outer margin to the track edge as the slab lives; never inside it.
      const out = SLAB_IN + 1 + hash(i, 3) * 6;
      const lean = (out - SLAB_IN) * (0.45 * p) * (1 + intensity);
      const x = side * Math.max(SLAB_IN, out - lean);
      const w = 2.6 + hash(i, 4) * 2.8;
      const h = 1.3 + hash(i, 5) * 1.3;
      const y = -h + ease * (h + 0.6 + hash(i, 6) * 4.5) - fall * fall * 7;
      // Alongside the runner (the root sits `gap` behind them), from just
      // behind to a few strides ahead — beside the road, never over it.
      const z = -gap - (-4 + hash(i, 7) * 16);
      const s = 1 - fall * 0.6;
      this._se.set(
        (hash(i, 8) - 0.5) * 0.8 + p * (hash(i, 9) - 0.5) * 2.2,
        side * (0.5 + hash(i, 10) * 0.6),
        side * (0.15 + p * 0.9 * (hash(i, 11) - 0.3)),
      );
      this._sq.setFromEuler(this._se);
      this._sp.set(x, y, z);
      this._ss.set(w * s, h * s, 0.6 * s);
      this._sm.compose(this._sp, this._sq, this._ss);
      this.slabs.setMatrixAt(c++, this._sm);
    }
    this.slabs.count = c;
    this.slabs.instanceMatrix.needsUpdate = true;
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
    this._updateTear(dt, gap, x, groundY, playerD, killT, side, lunge, lungeT);
    // The contact shadow darkens as the tear closes in.
    this.contact.position.set(x, groundY + 0.04, -(playerD - gap));
    this.contact.material.opacity = 0.11 + Math.max(0, 1 - gap / 45) * 0.07;
    this.contact.visible = this.root.visible;
  }

  _updateTear(dt, gap, x, groundY, playerD, killT, side, lunge, lungeT) {
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

    // Colour-vision modes retint the scan bar's danger accent at runtime;
    // the shipped constant (0xff2a1f) remains the default.
    this.bar.material.color.setHex(ACCESS.danger);
    this.slabMat.color.setHex(ACCESS.danger);
    this.slabMat.opacity = 0.55 + intensity * 0.4;
    this._laySlabs(intensity, gap);

    this._redrawT -= dt;
    if (this._redrawT <= 0) {
      // Perf: at distance the static barely reads, so re-roll it on a slower
      // cadence. At full pressure this is exactly the shipped REDRAW_EVERY.
      this._redrawT = REDRAW_EVERY + (1 - Math.min(1, intensity * 2.2)) * 0.18;
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
