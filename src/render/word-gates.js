/**
 * Word gate presentation — the word arriving at runner speed.
 *
 * Each gate is a billboarded plate above a thin line across the ribbon.
 * Legibility is the whole experiment (brief, priority 1), so the plate is
 * plain: near-white ground, heavy dark lowercase glyphs, no perspective
 * shear (billboard), constant world size — it grows on approach exactly the
 * way anything honest does at runner speed.
 *
 * Feedback obeys fairness (priority 2): confirm tints the plate before the
 * line so you know your answer registered; resolution pulses green/red and
 * a wrong gate shows what the truth was.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { makeGate } from '../sim/word-gates.js';
import { ACCESS } from '../ui/access.js';



const PLATE_ABOVE = 3.4;      // metres above the snow at the gate line
const LETTER_H = 2.05;        // world metres of glyph height (the legibility dial)
const CANVAS_H = 256;
const FONT_PX = 168;
const SHOW_AHEAD = 260;       // build plates well inside fog range
const LINGER = 0.65;          // seconds a resolved plate hangs on for feedback

// Neon identity: a dark glass plate on the bright snow is the highest
// contrast ground available, and the glow never touches the glyph cores —
// legibility (priority 1) outranks flourish (priority 4).
const COL = {
  plate: 'rgba(10,16,23,0.86)',
  edge: 'rgba(103,216,255,0.55)',
  ink: '#eefaff',
  confirm: '#67d8ff',
  // right/wrong are SEMANTIC and colour-vision modes replace the axis that
  // fails (ACCESS overrides at paint time); these are the shipped defaults.
  right: '#57e389',
  wrong: '#ff2a1f',
};

class Plate {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = CANVAS_H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;

    const lineGeo = new THREE.PlaneGeometry(TUNING.RUN.TRACK_HALF_W * 2, 0.55);
    this.lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false,
    });
    this.line = new THREE.Mesh(lineGeo, this.lineMat);
    this.line.rotation.x = -Math.PI / 2;
    this.line.renderOrder = 19;
    this.line.visible = false;

    scene.add(this.mesh);
    scene.add(this.line);
    this.key = null;
    this.state = null;
  }

  paint(word, state) {
    const cacheKey = `${word}|${ACCESS.epoch}`;
    if (this.key === cacheKey && this.state === state) return;
    this.key = cacheKey;
    this.state = state;
    const g = this.canvas.getContext('2d');
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    g.clearRect(0, 0, cw, ch);

    const accent = state === 'right' ? ACCESS.right
      : state === 'wrong' ? ACCESS.wrong
      : state === 'confirmed' ? COL.confirm
      : COL.edge;

    // Neon plate: dark glass, glowing rim.
    g.save();
    g.fillStyle = COL.plate;
    g.strokeStyle = accent;
    g.lineWidth = state === 'idle' ? 5 : 12;
    g.shadowColor = accent;
    g.shadowBlur = state === 'idle' ? 14 : 30;
    const r = 34;
    g.beginPath();
    g.roundRect(10, 10, cw - 20, ch - 20, r);
    g.fill();
    g.stroke();
    g.restore();

    // READABLE TYPE (accessibility): a wider-spaced humanist face instead
    // of the condensed monospace — Verdana-class faces are the widely
    // recommended dyslexia-friendlier system fonts.
    const font = ACCESS.readableType
      ? (px) => `700 ${px}px Verdana, 'DejaVu Sans', Arial, sans-serif`
      : (px) => `800 ${px}px ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
    if ('letterSpacing' in g) g.letterSpacing = ACCESS.readableType ? '5px' : '0px';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let text = word;
    // Long tier-4 words: shrink to fit rather than clipping — an unreadable
    // clip would fail the premise, a smaller-but-whole word tests it.
    let px = FONT_PX;
    g.font = font(px);
    while (px > 64 && g.measureText(text).width > cw - 90) {
      px -= 8;
      g.font = font(px);
    }
    const cx = cw / 2, cy = ch / 2 + 6;
    if (state === 'right' || state === 'wrong') {
      // Afterimage double-strike on resolution: two chromatic echoes trailing
      // upslope of the glyphs, then the solid core on top.
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = accent;
      g.fillText(text, cx - 14, cy);
      g.globalAlpha = 0.18;
      g.fillText(text, cx - 28, cy);
      g.restore();
    }
    g.save();
    // Soft neon halo behind the core glyphs — halo only, cores stay solid.
    g.shadowColor = state === 'idle' ? 'rgba(103,216,255,0.75)' : accent;
    g.shadowBlur = 22;
    g.fillStyle = state === 'wrong' ? ACCESS.wrong : COL.ink;
    g.fillText(text, cx, cy);
    g.shadowBlur = 0;
    g.fillText(text, cx, cy);
    g.restore();
    this.tex.needsUpdate = true;
  }

  place(word, d, groundY, camera, opacity = 1, centerX = 0) {
    // Constant world glyph height; plate width follows the word.
    const h = LETTER_H * (CANVAS_H / FONT_PX);
    const aspect = this.canvas.width / this.canvas.height;
    this.mesh.scale.set(h * aspect, h, 1);
    this.mesh.position.set(centerX, groundY + PLATE_ABOVE, -d);
    this.mesh.quaternion.copy(camera.quaternion);
    this.mat.opacity = opacity;
    this.mesh.visible = true;
    this.line.position.set(centerX, groundY + 0.06, -d);
    this.line.visible = true;
  }

  hide() {
    this.mesh.visible = false;
    this.line.visible = false;
  }
}

export class WordGateActors {
  constructor(scene, sim) {
    this.sim = sim;
    this.current = new Plate(scene);
    this.next = new Plate(scene);
    this.fx = new Plate(scene);   // resolved-gate feedback, its own plate
    this.lingerT = 0;
    this.lingerGate = null;
    this.lingerState = 'right';
  }

  reset() {
    this.lingerT = 0;
    this.lingerGate = null;
    this.current.hide();
    this.next.hide();
    this.fx.hide();
  }

  /** Called from the sim-event drain so feedback is frame-accurate. */
  onResolve(e) {
    // On a picked fake, the feedback is the true spelling; otherwise the word.
    const text = e.t === 'word_wrong' && e.reason === 'picked_fake' && e.answer
      ? e.answer : e.word;
    this.lingerGate = { text, d: e.d };
    this.lingerState = e.t === 'word_correct' ? 'right' : 'wrong';
    this.lingerT = LINGER;
  }

  update(dt, playerD, camera) {
    // No plates looming behind the title or death screens.
    if (this.sim.phase !== 'running' && this.sim.phase !== 'kill') {
      this.reset();
      return;
    }
    const wg = this.sim.wordGates;
    const terrain = this.sim.terrain;
    const g = wg.current();

    // Approaching gate — plates sit on the track's centerline through turns.
    if (!g.resolved && g.d - playerD < SHOW_AHEAD) {
      const state = g.confirmed ? 'confirmed' : 'idle';
      this.current.paint(g.shown, state);
      this.current.place(g.shown, g.d, terrain.heightAt(0, g.d), camera,
        1, terrain.corridorX(g.d));
      // Preview the one after, faint in the fog, so rhythm reads at speed.
      const n = makeGate(wg.seed, g.index + 1, wg.profile);
      if (n.d - playerD < SHOW_AHEAD) {
        this.next.paint(n.shown, 'idle');
        this.next.place(n.shown, n.d, terrain.heightAt(0, n.d), camera, 0.55,
          terrain.corridorX(n.d));
      } else {
        this.next.hide();
      }
    } else {
      this.current.hide();
      this.next.hide();
    }

    // Feedback linger on the plate just crossed.
    if (this.lingerT > 0 && this.lingerGate) {
      this.lingerT -= dt;
      const e = this.lingerGate;
      this.fx.paint(e.text, this.lingerState);
      this.fx.place(e.text, e.d, terrain.heightAt(0, e.d), camera,
        Math.max(0, this.lingerT / LINGER), terrain.corridorX(e.d));
      if (this.lingerT <= 0) this.fx.hide();
    } else {
      this.fx.hide();
    }
  }
}
