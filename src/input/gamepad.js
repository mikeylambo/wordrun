/**
 * RC10.1 — the pad, as a file you can find from the import graph.
 *
 * This used to be a runtime patch. `v1-ship-polish.js` reassigned
 * `Input.prototype.update` at import time and folded pad axes into the live
 * input object from inside the wrapper, which is the exact pattern CLAUDE.md
 * forbids and for the exact reasons it gives: nothing named `input` led here,
 * the file it lived in was named like scaffolding, it was loaded through a
 * side-effect import six levels down an audio chain, and after RC9.9 it was
 * the only thing on the planet reaching into the dash machine from outside
 * input.js — a place no one would look when the dash changed.
 *
 * It is a READER. It owns no state the sim can see: it polls the pad, decides
 * what the buttons mean, and writes the same flags a thumb or a key writes,
 * through the same methods. Pointer and keyboard keep priority whenever they
 * are actively being used, because a plugged-in pad sitting on a desk must not
 * fight the hands that are actually playing.
 *
 * Standard mapping: left stick / d-pad carve, A confirms, RT or RB is the dash
 * control (tap to dash, hold to raise the bar — RC9.9's one rule, reached
 * through Input's own press/release methods rather than reimplemented here).
 */

const DEADZONE = 0.18;

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** The first connected pad, or null. Safe on every device and in node. */
export function firstPad() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  try {
    for (const p of navigator.getGamepads()) if (p?.connected) return p;
  } catch { /* a browser that refuses the query has no pad as far as we care */ }
  return null;
}

/** Is the player holding one? The modality the teaching copy speaks in. */
export function padConnected() {
  return firstPad() !== null;
}

/** A button's level, whether the pad reports it as pressed or as an axis. */
export function button(pad, index) {
  const b = pad?.buttons?.[index];
  if (!b) return 0;
  return Math.max(b.pressed ? 1 : 0, Number.isFinite(b.value) ? b.value : 0);
}

function axis(v) {
  const n = Number.isFinite(v) ? v : 0;
  const a = Math.abs(n);
  if (a <= DEADZONE) return 0;
  return Math.sign(n) * clamp((a - DEADZONE) / (1 - DEADZONE));
}

/** Stick first, d-pad as the fallback — one pair of axes either way. */
export function padAxes(pad) {
  const lx = axis(pad?.axes?.[0]);
  const ly = axis(pad?.axes?.[1]);
  const dx = button(pad, 15) - button(pad, 14);
  const dy = button(pad, 13) - button(pad, 12);
  return {
    x: Math.abs(lx) > 0.01 ? lx : dx,
    y: Math.abs(ly) > 0.01 ? ly : dy,
  };
}

export class PadReader {
  constructor() {
    this.jumpDown = false;
    this.dashDown = false;
    // Set by the menu navigation when A activated a BUTTON: the same press
    // must not also answer REAL on the frame the menu closes.
    this.confirmConsumed = false;
  }

  /**
   * One frame. Writes into `input` exactly as a thumb would, and returns
   * whether a pad is present at all.
   */
  update(input) {
    const pad = firstPad();
    if (!input || !pad || !input.enabled || input.script) {
      this.jumpDown = false;
      if (this.dashDown) { input?.dashRelease?.(); this.dashDown = false; }
      return false;
    }

    const a = button(pad, 0) > 0.5;
    const dash = button(pad, 7) > 0.34 || button(pad, 5) > 0.5;
    const axes = padAxes(pad);
    if (a || dash || Math.abs(axes.x) > 0.02 || Math.abs(axes.y) > 0.02) input.fireFirstGesture();

    // Hands on the screen or the keys win. A pad left on a desk reports a
    // steady zero, and a zero that overwrites a live thumb is a stuck stick.
    const pointerActive = input.primaryId !== null;
    const keyboardActive = input.keyLeft || input.keyRight || input.keyUp || input.keyDown ||
      Math.abs(input.keyX) > 0.02 || Math.abs(input.keyY) > 0.02;
    if (!pointerActive && !keyboardActive) {
      input.carve = clamp(axes.x, -1, 1);
      input.flip = clamp(axes.y, -1, 1);
      input.dragging = Math.abs(axes.x) > 0.02 || Math.abs(axes.y) > 0.02;
    }

    // RC9.9's one dash rule, through Input's own machine. RT is a press and a
    // release like every other dash control, so a tap dashes and a hold raises
    // the bar — there is no second implementation of that decision anywhere.
    if (dash && !this.dashDown) input.dashPress();
    else if (!dash && this.dashDown) input.dashRelease();
    this.dashDown = dash;

    if (!a) this.confirmConsumed = false;
    if (a && !this.jumpDown && !this.confirmConsumed) input.jump = true;
    this.jumpDown = a;
    return true;
  }
}

export default PadReader;
