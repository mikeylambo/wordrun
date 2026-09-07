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

/**
 * The tiers, steepest first. `at` is the fraction of the arm window still
 * unspent when the answer landed — 1 the instant the word armed, 0 at the
 * line — which is exactly what the compression bar is priced on.
 */
export const TIERS = Object.freeze([
  { key: 'sharp', at: W.COMPRESSION_THRESHOLD[3], label: 'SHARP' },
  { key: 'quick', at: W.COMPRESSION_THRESHOLD[2], label: 'QUICK' },
  { key: 'clean', at: W.COMPRESSION_THRESHOLD[1], label: 'CLEAN' },
  { key: 'late', at: 0, label: 'LATE' },
]);

/** What a correct read was worth, as a word. Pure: gates walk it in node. */
export function judgeRead(answerDistance = 0, armM = W.ARM_DISTANCE_M) {
  const frac = armM > 0 ? Math.max(0, Math.min(1, answerDistance / armM)) : 0;
  for (const t of TIERS) if (frac >= t.at) return t;
  return TIERS[TIERS.length - 1];
}

/** The three ways a read can go wrong or go by, named once. */
export const OUTCOME = Object.freeze({
  wrong: { key: 'wrong', label: 'MISREAD' },   // a fake, tapped
  missed: { key: 'missed', label: 'MISSED' },  // a real word, let by
  passed: { key: 'passed', label: 'PASSED' },  // a fake, correctly let by
});

const HOLD_S = 0.62;      // how long a judgment stays before it fades
const PUNCH_S = 0.17;     // the scale-in, which REDUCED FLASH omits

export class Judgment {
  constructor(root = document) {
    this.el = root.getElementById('judge');
    this.combo = root.getElementById('combo');
    this.t = 0;
    this.chain = 0;
    this.muted = false;    // a stop or a coach line is speaking
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

  _say(label, key, reducedFlash) {
    if (!this.el || this.muted) return;
    this.el.textContent = label;
    this.el.dataset.kind = key;
    this.el.classList.add('on');
    this.el.classList.remove('punch');
    if (!reducedFlash) { void this.el.offsetWidth; this.el.classList.add('punch'); }
    this.t = HOLD_S;
  }

  /** A read landed. `frac` is the arm window left; `chain` the new length. */
  read({ correct, answered = true, answerDistance = 0, armM, chain = 0, real = true },
    reducedFlash = false) {
    const tier = correct
      ? (answered ? judgeRead(answerDistance, armM) : OUTCOME.passed)
      : (real ? OUTCOME.missed : OUTCOME.wrong);
    this._say(tier.label, correct ? (answered ? 'right' : 'pass') : 'wrong', reducedFlash);
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
      this.t = Math.max(this.t, HOLD_S);
      return;
    }
    this.combo.classList.remove('lost');
    if (next <= 1) { this.combo.classList.remove('on', 'punch'); return; }
    this.combo.textContent = `×${next}`;
    this.combo.classList.add('on');
    this.combo.classList.remove('punch');
    if (!reducedFlash) { void this.combo.offsetWidth; this.combo.classList.add('punch'); }
  }

  update(dt = 0) {
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
    if (this.combo) this.combo.textContent = '';
  }
}

export default Judgment;
