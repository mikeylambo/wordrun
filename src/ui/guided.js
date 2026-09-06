/**
 * RC7 — the teach band, which now says something only when the world has
 * STOPPED to say it.
 *
 * PD-1 hung a standing instruction here for as long as a fundamental went
 * undemonstrated; RC7 replaces that with the three stops (src/sim/teach-stops.js).
 * The run is the tutorial: it freezes at the first real word, the first fake
 * and the first full dash charge, and this surface carries the one line for
 * whichever stop is on — in the modality the player is actually using — plus
 * a ring on the control that line names, where there is a control to ring.
 *
 * Placement is unchanged: the 57% band, below the plate's reading zone and
 * above the answer buttons, where every other in-run line now speaks from.
 * REDUCED FLASH keeps the line and the ring and drops the ring's pulse — the
 * information survives, the motion does not.
 *
 * main.js constructs this and drives update() from the frame loop; the copy
 * lives in ui/teach-copy.js, which is pure so the gates can drive it.
 */

import { stopLine, stopRing } from './teach-copy.js';

export class GuidedTeach {
  constructor() {
    const style = document.createElement('style');
    style.textContent = `
      #guidedTeach{position:fixed;left:0;right:0;top:57%;z-index:6;
        text-align:center;pointer-events:none;opacity:0;
        transition:opacity .28s ease;transform:translateY(0)}
      #guidedTeach .gtMain{font:800 17px/1.3 var(--face,system-ui);
        letter-spacing:.22em;color:#eefaff;
        text-shadow:0 0 18px rgba(103,216,255,.65),0 2px 10px rgba(0,0,0,.8)}
      #guidedTeach.on{opacity:1}
    `;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.id = 'guidedTeach';
    this.el.innerHTML = '<div class="gtMain"></div>';
    document.body.appendChild(this.el);
    this.main = this.el.querySelector('.gtMain');
    this._key = '';
  }

  _show(key, main) {
    if (this._key !== key) {
      this._key = key;
      this.main.textContent = main;
    }
    this.el.classList.add('on');
  }

  hide() {
    this.el.classList.remove('on');
  }

  /**
   * One frame. `stop` is the active stop (or null), `modality` the control
   * scheme to teach in. Nothing is shown between stops — the run teaches by
   * stopping, not by hovering.
   */
  update({ running, enabled, stop, modality, veilUp, hintUp }) {
    const show = running && enabled && stop && !veilUp && !hintUp;
    if (!show) {
      this.hide();
      this._ring(null);
      return;
    }
    this._show(`${stop}:${modality}`, stopLine(stop, modality));
    this._ring(stopRing(stop, modality));
  }

  /** Ring the named control, and only it. */
  _ring(id) {
    if (this._ringId === id) return;
    if (this._ringId) document.getElementById(this._ringId)?.classList.remove('teachRing');
    this._ringId = id;
    if (id) document.getElementById(id)?.classList.add('teachRing');
  }
}

export default GuidedTeach;
