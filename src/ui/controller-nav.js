/**
 * RC10.1 — menu navigation on a pad, ticked from the frame loop.
 *
 * This was the strangest thing in the retired ship-polish layer: the whole
 * controller UI was polled from inside a runtime patch of `Audio.update`,
 * purely because the audio bridge happened to be called once a frame. A
 * player pressing A on the results card went through the mixer. Nothing named
 * it, nothing imported it, and it would have survived any amount of reading
 * of the UI files it drives.
 *
 * It is a small, explicit thing now: which surface is on top, which of its
 * buttons has focus, and what A / B / START mean there. It reaches the rest of
 * the game the way a player does — by focusing and activating real buttons,
 * and by dispatching the same keys a keyboard sends — so there is no second
 * definition anywhere of what RESUME or AGAIN does.
 */

import { firstPad, button, padAxes } from '../input/gamepad.js';

/** The surfaces a pad can drive, outermost first. */
const ROOTS = [
  { id: 'rc97Ending', preferred: '[data-act="continue"]', cancel: 'Escape' },
  { id: 'rc2Pause', preferred: '[data-act="resume"]', cancel: 'KeyP' },
  { id: 'rc7Onboarding', preferred: '[data-act="start"]', cancel: null },
  { id: 'deathScreen', preferred: '#deathAgain', cancel: null },
];

function dispatchKey(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}

function activate(el) {
  if (!el) return;
  try {
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: -99 }));
  } catch {
    el.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
  }
}

export class ControllerNav {
  constructor(pad = null) {
    this.pad = pad;             // the PadReader, so A can be consumed once
    this.root = null;
    this.index = -1;
    this._prev = { confirm: false, cancel: false, pause: false, up: false, down: false };
  }

  /** The topmost surface currently on screen, with its config. */
  _visible() {
    for (const r of ROOTS) {
      const el = document.getElementById(r.id);
      if (el?.classList.contains('on')) return { ...r, el };
    }
    return null;
  }

  _buttons(el) {
    return el ? [...el.querySelectorAll('button')]
      .filter((b) => !b.disabled && b.offsetParent !== null) : [];
  }

  /** Move focus, or take it for the first time on this surface. */
  _focus(root, direction = 0) {
    const buttons = this._buttons(root.el);
    if (!buttons.length) return null;
    if (this.root !== root.id) {
      this.root = root.id;
      const preferred = root.preferred ? root.el.querySelector(root.preferred) : null;
      const i = preferred ? buttons.indexOf(preferred) : -1;
      this.index = i >= 0 ? i : 0;
    } else if (direction) {
      this.index = (this.index + direction + buttons.length) % buttons.length;
    }
    const el = buttons[Math.max(0, Math.min(buttons.length - 1, this.index))];
    el?.focus?.({ preventScroll: true });
    return el;
  }

  /** One frame. `phase` is the sim's, for the two things that depend on it. */
  update(phase = null) {
    const gp = firstPad();
    if (!gp) return;
    const axes = padAxes(gp);
    const now = {
      confirm: button(gp, 0) > 0.5,
      cancel: button(gp, 1) > 0.5,
      pause: button(gp, 9) > 0.5,
      up: button(gp, 12) > 0.5 || axes.y < -0.72,
      down: button(gp, 13) > 0.5 || axes.y > 0.72,
    };
    const edge = (k) => now[k] && !this._prev[k];
    const root = this._visible();

    if (root) {
      if (edge('up')) this._focus(root, -1);
      if (edge('down')) this._focus(root, 1);
      if (edge('confirm')) {
        // The same A press must not also answer REAL behind the surface.
        if (this.pad) this.pad.confirmConsumed = true;
        activate(this._focus(root, 0));
      }
      if (edge('cancel') && root.cancel) dispatchKey(root.cancel);
    } else {
      this.root = null;
      this.index = -1;
      if (edge('confirm') && (phase === 'title' || phase === 'dead')) {
        if (this.pad) this.pad.confirmConsumed = true;
        dispatchKey('Enter');
      }
    }

    if (edge('pause') && phase === 'running' && root?.id !== 'rc97Ending') dispatchKey('KeyP');
    this._prev = now;
  }
}

export default ControllerNav;
