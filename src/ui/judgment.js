/**
 * RC11.4 — the judgment and the chain, at arcade weight.
 *
 * DDR and Pump It Up both put the same two things in the same place on every
 * single input: HOW GOOD that input was, and HOW MANY in a row. This game had
 * neither. A read's quality was scored, banked and never named; the chain was
 * written to `#chain` every frame behind `display:none!important`, and the
 * break path that would have animated it (`UI.chainLost`) had no caller at
 * all. Two systems' worth of per-frame work, drawing nothing.
 *
 * NOTHING HERE IS A NEW QUANTITY. The tiers are the compression thresholds
 * the game already prices reads against — `TUNING.WORDS.COMPRESSION_THRESHOLD`
 * as a fraction of the arm window — so the word on screen and the multiplier
 * in the score are the same judgment, read off the same number. Naming it is
 * presentation; deriving it here from anything else would be a second opinion.
 *
 * The colours are `--sem-right` / `--sem-wrong`, the semantic pair
 * `ui/access.js` already redefines for each colour-vision mode, so a judgment
 * is legible in all four without a new hue being chosen (and without one
 * having to be checked against the reserved set, because none is new).
 *
 * PLACEMENT IS A CONSTRAINT, NOT A TASTE. The word plate is the one thing on
 * screen that may never be fought: the band at 57 % is the teaching's, and the
 * plate lives above it. The judgment takes its own line at 66 % — under the
 * coach, over the runner — and stands down entirely while a stop or a coach
 * line is showing. Teaching outranks flash.
 */

import TUNING from '../TUNING.js';

const W = TUNING.WORDS;
const J = () => TUNING.JUDGE;   // read live: the dev panel edits this object

/**
 * The tiers, steepest first. `at` is the fraction of the arm window still
 * unspent when the answer landed — 1 the instant the word armed, 0 at the
 * line — which is exactly what the compression bar is priced on.
 */
export const TIERS = Object.freeze([
  { key: 'sharp', at: W.COMPRESSION_THRESHOLD[3] },
  { key: 'quick', at: W.COMPRESSION_THRESHOLD[2] },
  { key: 'clean', at: W.COMPRESSION_THRESHOLD[1] },
  { key: 'late', at: 0 },
]);

/** What a tier is CALLED. A string, edited live from the dev panel. */
export const labelFor = (key) => TUNING.JUDGE.LABELS[key] ?? String(key).toUpperCase();

/** What a correct read was worth, as a word. Pure: gates walk it in node. */
export function judgeRead(answerDistance = 0, armM = W.ARM_DISTANCE_M) {
  const frac = armM > 0 ? Math.max(0, Math.min(1, answerDistance / armM)) : 0;
  for (const t of TIERS) if (frac >= t.at) return t;
  return TIERS[TIERS.length - 1];
}

/** The three ways a read can go wrong or go by, named once. */
export const OUTCOME = Object.freeze({
  wrong: { key: 'wrong' },     // a fake, tapped
  missed: { key: 'missed' },   // a real word, let by
  passed: { key: 'passed' },   // a fake, correctly let by — a read, not an absence
});


/**
 * The glow burst behind a judgment. A canvas, not DOM nodes: a burst is a
 * dozen additive dots for half a second, and a dozen elements entering and
 * leaving the document on every read is layout churn the frame does not need.
 *
 * Every number it draws with is TUNING.JUDGE.BURST, read live, so the dev
 * panel tunes it without a reload. COUNT 0 switches it off outright.
 */
class Burst {
  constructor(host) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'judgeBurst';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    host.appendChild(this.canvas);
    this.parts = [];
    this._w = 0; this._h = 0;
  }

  _fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === this._w && h === this._h) return;
    this._w = w; this._h = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  fire(kind, reducedFlash = false) {
    const B = TUNING.JUDGE.BURST;
    if (reducedFlash || !B.COUNT) return;
    this._fit();
    const n = Math.round(B.COUNT * (kind === 'wrong' ? B.ON_WRONG : 1));
    const cx = this._w / 2;
    const cy = this._h * (TUNING.JUDGE.TOP_PCT / 100);
    const hue = kind === 'wrong' ? 'wrong' : 'right';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const v = B.SPEED_PX * (0.55 + Math.random() * 0.75);
      this.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8,
        life: B.LIFE_S * (0.7 + Math.random() * 0.6), t: 0, hue });
    }
  }

  clear() { this.parts.length = 0; if (this.ctx && this._w) this.ctx.clearRect(0, 0, this._w, this._h); }

  update(dt = 0) {
    if (!this.parts.length) return;
    this._fit();
    const B = TUNING.JUDGE.BURST;
    const g = this.ctx;
    g.clearRect(0, 0, this._w, this._h);
    const css = getComputedStyle(document.documentElement);
    const right = (css.getPropertyValue('--sem-right') || '#57e389').trim();
    const wrong = (css.getPropertyValue('--sem-wrong') || '#ff2a1f').trim();
    g.globalCompositeOperation = 'lighter';
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      const k = Math.exp(-B.DRAG * dt);
      p.vx *= k; p.vy = p.vy * k + B.GRAVITY_PX * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.t / p.life;
      g.globalAlpha = a * a;
      g.fillStyle = p.hue === 'wrong' ? wrong : right;
      g.shadowColor = g.fillStyle;
      g.shadowBlur = B.GLOW_PX * a;
      g.beginPath();
      g.arc(p.x, p.y, B.SIZE_PX * a, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'source-over';
  }
}

export class Judgment {
  constructor(root = document) {
    this.el = root.getElementById('judge');
    this.combo = root.getElementById('combo');
    this.t = 0;
    this.chain = 0;
    this.muted = false;    // a stop or a coach line is speaking
    this.burst = this.el ? new Burst(this.el.parentElement || document.body) : null;
    this.syncStyle();
  }

  /** Teaching outranks flash: hold everything back while the coach speaks. */
  setMuted(on) {
    this.muted = !!on;
    if (on) this._hide();
  }

  _hide() {
    this.el?.classList.remove('on', 'punch');
    this.combo?.classList.remove('on', 'punch', 'lost');
  }

  _say(tierKey, kind, reducedFlash) {
    if (!this.el || this.muted) return;
    this.el.textContent = labelFor(tierKey);
    this.el.dataset.kind = kind;
    this.el.classList.add('on');
    this.el.classList.remove('punch');
    if (!reducedFlash) { void this.el.offsetWidth; this.el.classList.add('punch'); }
    this.t = J().HOLD_S;
    this.burst?.fire(kind, reducedFlash);
  }

  /** A read landed. `frac` is the arm window left; `chain` the new length. */
  read({ correct, answered = true, answerDistance = 0, armM, chain = 0, real = true },
    reducedFlash = false) {
    const tier = correct
      ? (answered ? judgeRead(answerDistance, armM) : OUTCOME.passed)
      : (real ? OUTCOME.missed : OUTCOME.wrong);
    this._say(tier.key, correct ? (answered ? 'right' : 'pass') : 'wrong', reducedFlash);
    this.setChain(chain, reducedFlash);
    return tier;
  }

  /** The chain, as a count a player can read at a glance. */
  setChain(n, reducedFlash = false) {
    const next = Math.max(0, n | 0);
    if (next === this.chain) return;
    const broke = next === 0 && this.chain > 0;
    this.chain = next;
    if (!this.combo) return;
    if (broke) {
      this.combo.classList.add('lost');
      this.combo.classList.remove('punch');
      this.t = Math.max(this.t, J().HOLD_S);
      return;
    }
    this.combo.classList.remove('lost');
    if (next <= 1) { this.combo.classList.remove('on', 'punch'); return; }
    this.combo.textContent = `×${next}`;
    this.combo.classList.add('on');
    this.combo.classList.remove('punch');
    if (!reducedFlash) { void this.combo.offsetWidth; this.combo.classList.add('punch'); }
  }

  /**
   * Push every tunable that lives in CSS into the custom properties the
   * stylesheet reads, so a dev-panel edit lands on the next frame without the
   * panel needing to know a single selector.
   */
  syncStyle(root = document.documentElement) {
    const j = J();
    const set = (k, v) => root.style.setProperty(k, v);
    set('--judge-size', `clamp(${j.SIZE_MIN_PX}px, ${j.SIZE_VW}vw, ${j.SIZE_MAX_PX}px)`);
    set('--judge-top', `${j.TOP_PCT}%`);
    set('--judge-punch-ms', `${j.PUNCH_MS}ms`);
    set('--judge-punch-scale', String(j.PUNCH_SCALE));
    set('--combo-size', `clamp(${j.COMBO_MIN_PX}px, ${j.COMBO_SIZE_VW}vw, ${j.COMBO_MAX_PX}px)`);
    set('--combo-top', `${j.COMBO_TOP_PX}px`);
    set('--combo-punch-ms', `${j.COMBO_PUNCH_MS}ms`);
    set('--combo-punch-scale', String(j.COMBO_PUNCH_SCALE));
  }

  update(dt = 0) {
    this.burst?.update(dt);
    if (this.t <= 0) return;
    this.t = Math.max(0, this.t - dt);
    if (this.t > 0) return;
    this.el?.classList.remove('on', 'punch');
    this.combo?.classList.remove('lost');
    if (this.chain <= 1) this.combo?.classList.remove('on', 'punch');
  }

  reset() {
    this.t = 0;
    this.chain = 0;
    this._hide();
    this.burst?.clear();
    if (this.combo) this.combo.textContent = '';
  }
}

export default Judgment;
