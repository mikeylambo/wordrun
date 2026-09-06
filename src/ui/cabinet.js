/**
 * RC9.3 — the keyboard legend, for the framed cabinet.
 *
 * A phone tells a player what its controls are by drawing them: REAL, FAKE and
 * DASH are three buttons at the bottom of the screen and there is nothing to
 * explain. A keyboard draws nothing, so the same three controls — plus the
 * hold that sets the bar — are glyphs standing where those buttons would be.
 * Same place, same order, so a player who has seen either layout recognises
 * the other.
 *
 * They dim on the same bargain the coach's lessons make: each one fades for
 * good the moment its control has actually been used, and a player who
 * already knows the game watches the legend disappear over their first run
 * rather than being told anything. The flags are the SAME persisted flags
 * (`usedConfirm` / `usedReject` / `usedDash` / `usedBar`) the coach retires
 * its rungs on — no new state, and no second opinion about what this player
 * has learned.
 *
 * Layout only: this file reads nothing from the sim and writes nothing to it.
 * It is off entirely on a touch device (the buttons are the legend there) and
 * off on a portrait window (there is no cabinet to frame).
 */

const KEYS = [
  { id: 'reject', glyph: '←', label: 'FAKE' },
  { id: 'bar', glyph: '↑', label: 'BAR' },
  { id: 'dash', glyph: 'SPACE', label: 'DASH' },
  { id: 'confirm', glyph: '→', label: 'REAL' },
];

export class KeyLegend {
  constructor(el = document.getElementById('keyLegend')) {
    this.el = el;
    this.cells = new Map();
    if (!this.el) return;
    this.el.innerHTML = KEYS
      .map((k) => `<div data-k="${k.id}"><i>${k.glyph}</i><span>${k.label}</span></div>`)
      .join('');
    for (const k of KEYS) {
      this.cells.set(k.id, this.el.querySelector(`[data-k="${k.id}"]`));
    }
    this._on = null;
  }

  /**
   * One frame's worth of state. `learned` is the lesson map main.js already
   * keeps; `framed` is whether the cabinet is on; `touch` turns the whole
   * thing off, because a device with the buttons drawn does not need them
   * named.
   */
  update({ framed = false, touch = false, running = false, learned = null } = {}) {
    if (!this.el) return;
    const on = framed && !touch && running;
    if (on !== this._on) {
      this._on = on;
      this.el.classList.toggle('on', on);
    }
    if (!on) return;
    const L = learned || {};
    for (const k of KEYS) {
      const cell = this.cells.get(k.id);
      if (cell) cell.classList.toggle('used', !!L[k.id]);
    }
  }
}

/** Is the window wider than it is tall — the one condition the cabinet asks. */
export function isFramed() {
  try { return matchMedia('(min-aspect-ratio: 1/1)').matches; } catch { return false; }
}

export default KeyLegend;
