/**
 * RC13.7 — the attract CYCLE.
 *
 * render/attract.js puts the best run back on the road when the title goes
 * quiet. This is what a cabinet shows over it, in turn, until someone plays:
 *
 *   DEMO   — the title and the demo run, as before
 *   SCORES — the device's top ten (alternating the DAILY RUN and ENDLESS)
 *   HOW TO — the three verbs, in the teaching's own words and controls
 *
 * and PRESS START blinking under all of it. Presentation only: every panel is
 * pointer-events:none, so the first touch still reaches main.js, which ends
 * the attract exactly as before. The table rows come from meta/hiscore.js
 * via a loader main.js passes in; the copy comes from ui/teach-copy.js.
 */

import { TABLE_SIZE, normalise } from '../meta/hiscore.js';
import { MODALITY, confirmLesson, rejectLesson, dashReadyLine } from './teach-copy.js';
import { ACCESS } from './access.js';

const PHASES = Object.freeze([
  { key: 'demo', s: 14 },
  { key: 'scores', s: 8 },
  { key: 'howto', s: 8 },
]);

export class AttractPanels {
  /** @param loadTables () => [{ title, rows }, …] — one table per SCORES turn */
  constructor({ root = document, loadTables }) {
    this.loadTables = loadTables;
    this.title = root.getElementById('titleScreen');
    this.el = document.createElement('div');
    this.el.id = 'attractPanels';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = '<div class="apCard"></div><div class="apStart"></div>';
    this.card = this.el.firstChild;
    this.start = this.el.lastChild;
    (root.getElementById('app') || document.body).appendChild(this.el);
    this.active = false;
    this.t = 0;
    this.i = 0;
    this.turn = 0;
  }

  update(dt, active, modality = MODALITY.TOUCH) {
    if (active !== this.active) {
      this.active = active;
      this.t = 0; this.i = 0;
      this.el.classList.toggle('on', active);
      this.start.textContent = modality === MODALITY.TOUCH ? 'TAP TO START' : 'PRESS START';
      this.start.classList.toggle('still', ACCESS.reducedFlash);
      this._show('demo', modality);
      return;
    }
    if (!active) return;
    this.t += dt;
    if (this.t < PHASES[this.i].s) return;
    this.t = 0;
    this.i = (this.i + 1) % PHASES.length;
    this._show(PHASES[this.i].key, modality);
  }

  _show(key, modality) {
    const away = key !== 'demo';
    this.title?.classList.toggle('attractAway', this.active && away);
    document.getElementById('attractLine')?.classList.toggle('away', this.active && away);
    this.card.classList.toggle('on', this.active && away);
    if (key === 'scores') {
      const tables = this.loadTables?.() || [];
      const tb = tables.length ? tables[this.turn++ % tables.length] : { title: '', rows: [] };
      const rows = normalise(tb.rows);
      const lines = Array.from({ length: TABLE_SIZE }, (_, k) => {
        const r = rows[k];
        return `<li><span class="apN">${k + 1}</span><span class="apI">${r ? r.i : '---'}</span>`
          + `<span class="apS">${r ? r.s.toLocaleString('en-US') : '—'}</span></li>`;
      }).join('');
      this.card.innerHTML = `<div class="apHead">HIGH SCORES</div><div class="apSub">${tb.title}</div><ol>${lines}</ol>`;
    } else if (key === 'howto') {
      const lines = [confirmLesson(modality), rejectLesson(modality), dashReadyLine(modality)];
      this.card.innerHTML = `<div class="apHead">HOW TO PLAY</div>`
        + lines.map((l) => `<p>${l}</p>`).join('');
    }
  }
}

export default AttractPanels;
