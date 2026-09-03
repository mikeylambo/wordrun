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
const LINGER = 0.85;          // seconds a resolved plate hangs on for feedback

// The plates are baked into canvas textures, so a face that finishes loading
// after the first bake would leave the word drawn in the fallback until the
// next distinct word came along. Bump a paint epoch when the bundled face
// resolves and every cached plate repaints itself once.
const PLATE_FAMILY = 'Atkinson Hyperlegible Next';
let fontEpoch = 0;
// Scratch for the gate ground line's orientation: lay it flat (-90 deg about
// X), then roll it into the ribbon's banked cross-section about world Z.
const _axisZ = new THREE.Vector3(0, 0, 1);
const _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _q = new THREE.Quaternion();

// The ribbon's cross-slope at a given distance, as a roll angle. Phase L:
// the terrain owns ONE surface function (segment roll + turn-lean combined
// in crossSlopeAt), so the ground line reads it instead of re-deriving the
// bank from a constant that had to be kept in sync with the mesh by hand.
const rollAt = (terrain, d) => Math.atan(
  terrain.crossSlopeAt ? terrain.crossSlopeAt(d) : 0);

export const plateFontReady = (typeof document !== 'undefined' && document.fonts?.load)
  ? Promise.all([
      document.fonts.load(`700 ${FONT_PX}px '${PLATE_FAMILY}'`),
      document.fonts.load(`800 ${FONT_PX}px '${PLATE_FAMILY}'`),
    ]).then(() => { fontEpoch++; }, () => {})
  : Promise.resolve();

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
    this.line.renderOrder = 19;
    this.line.visible = false;

    scene.add(this.mesh);
    scene.add(this.line);
    this.key = null;
    this.state = null;
  }

  paint(word, state) {
    const cacheKey = `${word}|${ACCESS.epoch}|${fontEpoch}`;
    if (this.key === cacheKey && this.state === state) return;
    this.key = cacheKey;
    this.state = state;
    const g = this.canvas.getContext('2d');
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    g.clearRect(0, 0, cw, ch);

    // N1: the held states look like idle with a commitment mark — the word
    // itself renders EXACTLY as idle does, because plate legibility outranks
    // every acknowledgment we could draw.
    const held = state === 'held-real' || state === 'held-fake';
    // 'passed' is the quiet dress: a word that resolved in silence fades
    // out dim and unaccented — never the selection green.
    const quiet = state === 'passed';
    const accent = state === 'right' ? ACCESS.right
      : state === 'wrong' ? ACCESS.wrong
      : state === 'confirmed' ? COL.confirm
      : COL.edge;

    // Neon plate: dark glass, glowing rim.
    g.save();
    if (quiet) g.globalAlpha = 0.55;
    g.fillStyle = COL.plate;
    g.strokeStyle = accent;
    g.lineWidth = state === 'idle' || held || quiet ? (held ? 7 : quiet ? 4 : 5) : 15;
    g.shadowColor = accent;
    g.shadowBlur = state === 'idle' || held || quiet ? (held ? 18 : quiet ? 8 : 14) : 44;
    const r = 34;
    g.beginPath();
    g.roundRect(10, 10, cw - 20, ch - 20, r);
    g.fill();
    g.stroke();
    g.restore();

    // Playtest: the verdict plate fills with its own colour — a translucent
    // accent wash under the glyphs, so right/wrong reads at a glance from
    // any distance. The word still paints solid on top; legibility first.
    if (state === 'right' || state === 'wrong') {
      g.save();
      g.globalAlpha = 0.2;
      g.fillStyle = accent;
      g.beginPath();
      g.roundRect(10, 10, cw - 20, ch - 20, r);
      g.fill();
      g.restore();
    }

    // The plate is the surface the entire game is read from, and it used to
    // render in whatever `ui-monospace` resolved to — SF Mono on iOS, Consolas
    // on Windows, something else again on Android. The word looked like a
    // different game on every device, and none of those faces were chosen for
    // telling letters apart. It is now Atkinson Hyperlegible Next, bundled
    // with the build: the Braille Institute drew it so I/l/1, O/0 and rn/m
    // cannot be confused, which is precisely the discrimination a one-edit
    // fake asks for.
    //
    // READABLE TYPE (accessibility) therefore no longer swaps the family —
    // the shipped face already is the legibility face. It opens the tracking
    // and adds weight instead, which is what the toggle was really buying.
    const FAMILY = `'${PLATE_FAMILY}', Verdana, 'DejaVu Sans', Arial, sans-serif`;
    const weight = ACCESS.readableType ? 800 : 700;
    const font = (px) => `${weight} ${px}px ${FAMILY}`;
    if ('letterSpacing' in g) g.letterSpacing = ACCESS.readableType ? '7px' : '1px';
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
    if (quiet) g.globalAlpha = 0.6;
    g.shadowColor = state === 'idle' || held || quiet ? 'rgba(103,216,255,0.75)' : accent;
    g.shadowBlur = quiet ? 10 : 22;
    g.fillStyle = state === 'wrong' ? ACCESS.wrong : COL.ink;
    g.fillText(text, cx, cy);
    g.shadowBlur = 0;
    g.fillText(text, cx, cy);
    g.restore();

    // N1: the buffered answer's acknowledgment — one bar in the plate's
    // bottom corner on the SIDE the player pressed (right = real, left =
    // fake, the same sides as the input zones). Under the word, never on it.
    if (held) {
      g.save();
      g.fillStyle = COL.confirm;
      g.shadowColor = COL.confirm;
      g.shadowBlur = 12;
      const bw = 170, by = ch - 30;
      if (state === 'held-real') g.fillRect(cw - 34 - bw, by, bw, 9);
      else g.fillRect(34, by, bw, 9);
      g.restore();
    }
    this.tex.needsUpdate = true;
  }

  place(word, d, groundY, camera, opacity = 1, centerX = 0, roll = 0) {
    // Constant world glyph height; plate width follows the word.
    const h = LETTER_H * (CANVAS_H / FONT_PX);
    const aspect = this.canvas.width / this.canvas.height;
    this.mesh.scale.set(h * aspect, h, 1);
    this.mesh.position.set(centerX, groundY + PLATE_ABOVE, -d);
    this.mesh.quaternion.copy(camera.quaternion);
    this.mat.opacity = opacity;
    this.mesh.visible = true;
    this.line.position.set(centerX, groundY + 0.06, -d);
    // Playtest: "some lines are out of place while the rest fit the road".
    // This one. It is a flat 14m plane laid at a constant 0.06 above the
    // centreline, but the ribbon BANKS into a turn — its edge lifts by up to
    // 0.53m over this track. So on any bend the line was buried up to 0.59m
    // under the road on the outer side and floating 0.47m over it on the
    // inner, which is a bar hanging in the air across the track. The grid
    // rungs never had the problem because they are part of the ribbon mesh
    // and get the bank by construction; this is the one ground marking drawn
    // separately, so it is the one that had to be told. Rolled into the
    // ribbon's own plane it sits flush at both rails.
    _q.setFromAxisAngle(_axisZ, roll);
    this.line.quaternion.copy(_q).multiply(_flat);
    this.line.visible = true;
  }

  hide() {
    this.mesh.visible = false;
    this.line.visible = false;
  }
}

// Phase A: how many unarmed plates to draw. `?lookahead=N` overrides the
// tuning so the count can be A/B'd on a phone inside one session.
function lookaheadCount() {
  const max = TUNING.WORDS.LOOKAHEAD_OPACITY.length;
  let n = TUNING.WORDS.LOOKAHEAD_GATES;
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('lookahead');
    if (q != null && q !== '' && Number.isFinite(+q)) n = +q;
  }
  return Math.max(0, Math.min(max, Math.floor(n)));
}

export class WordGateActors {
  constructor(scene, sim) {
    this.sim = sim;
    this.scene = scene;
    this.current = new Plate(scene);
    this.fx = new Plate(scene);   // resolved-gate feedback, its own plate
    // One plate per lookahead slot, built once. The armed plate is a separate
    // object and no code path below can touch it.
    this.ahead = Array.from({ length: lookaheadCount() }, () => new Plate(scene));
    this._peek = new Map();       // index -> gate, so makeGate is not re-run per frame
    this.lingerT = 0;
    this.lingerGate = null;
    this.lingerState = 'right';
  }

  /**
   * Grow or shrink the lookahead row at runtime, so the count can be A/B'd
   * without a reload. Retired plates are pooled rather than dropped — their
   * meshes are already in the scene and rebuilding them would raster again.
   */
  setLookahead(n) {
    const max = TUNING.WORDS.LOOKAHEAD_OPACITY.length;
    const want = Math.max(0, Math.min(max, Math.floor(n)));
    this._pool = this._pool || [];
    while (this.ahead.length > want) {
      const p = this.ahead.pop();
      p.hide();
      this._pool.push(p);
    }
    while (this.ahead.length < want) {
      this.ahead.push(this._pool.pop() || new Plate(this.scene));
    }
    return this.ahead.length;
  }

  /** A future gate, built once and cached. Pure in (seed, index) — reading it
   *  cannot advance or mutate the sim's own gate state. */
  _peekGate(seed, index, profile) {
    const key = `${seed}:${index}`;
    let g = this._peek.get(key);
    if (!g) {
      g = makeGate(seed, index, profile);
      if (this._peek.size > 32) this._peek.clear();
      this._peek.set(key, g);
    }
    return g;
  }

  reset() {
    this.lingerT = 0;
    this.lingerGate = null;
    this.current.hide();
    for (const p of this.ahead) p.hide();
    this.fx.hide();
  }

  /** Called from the sim-event drain so feedback is frame-accurate. */
  onResolve(e) {
    // On a picked fake, the feedback is the true spelling; otherwise the word.
    const text = e.t === 'word_wrong' && e.reason === 'picked_fake' && e.answer
      ? e.answer : e.word;
    // Phase B: an early answer resolves before the line, so the feedback
    // belongs at the gate's own position, not at the runner's.
    // Design pass: a PASSIVE correct (a fake let by in silence) lingers in
    // the quiet 'passed' dress — no green, no selection language. The
    // bright right/wrong flashes belong to answers the player made.
    this.lingerGate = { text, d: e.gateD ?? e.d };
    this.lingerState = e.t === 'word_correct'
      ? (e.answered === false ? 'passed' : 'right')
      : 'wrong';
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
      // N1: a buffered answer shows on the plate it is held for.
      const heldHere = wg.held !== 0 && wg.heldIndex === g.index;
      const state = g.confirmed ? 'confirmed'
        : heldHere ? (wg.held > 0 ? 'held-real' : 'held-fake')
        : 'idle';
      this.current.paint(g.shown, state);
      // Ground the plate at the CENTRELINE's height — heightAt(x=0) would
      // pick up the cross-slope of a banked row and sink or float the plate.
      this.current.place(g.shown, g.d, terrain.heightAt(terrain.corridorX(g.d), g.d), camera,
        1, terrain.corridorX(g.d), rollAt(terrain, g.d));
      // The unarmed gates ahead, stepping down in opacity so they read as
      // information rather than competing with the armed plate. They are drawn
      // at their true world positions, so a bend occludes them exactly as it
      // occludes anything else — that occlusion is the interesting part.
      const fade = TUNING.WORDS.LOOKAHEAD_OPACITY;
      for (let i = 0; i < this.ahead.length; i++) {
        const n = this._peekGate(wg.seed, g.index + 1 + i, wg.profile);
        if (n.d - playerD < SHOW_AHEAD) {
          this.ahead[i].paint(n.shown, 'idle');
          this.ahead[i].place(n.shown, n.d, terrain.heightAt(terrain.corridorX(n.d), n.d), camera,
            fade[i], terrain.corridorX(n.d), rollAt(terrain, n.d));
        } else {
          this.ahead[i].hide();
        }
      }
    } else {
      this.current.hide();
      for (const p of this.ahead) p.hide();
    }

    // Feedback linger on the plate just crossed.
    if (this.lingerT > 0 && this.lingerGate) {
      this.lingerT -= dt;
      const e = this.lingerGate;
      this.fx.paint(e.text, this.lingerState);
      this.fx.place(e.text, e.d, terrain.heightAt(terrain.corridorX(e.d), e.d), camera,
        Math.max(0, this.lingerT / LINGER), terrain.corridorX(e.d));
      if (this.lingerT <= 0) this.fx.hide();
    } else {
      this.fx.hide();
    }
  }
}
