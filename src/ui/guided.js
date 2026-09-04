/**
 * PD-1 — the TEACH surface. The guided coach's LOUD half: a centered,
 * large instruction that stays up until the player performs the action it
 * teaches. It owns only the FUNDAMENTALS (the confirm and the reject/pass
 * verbs); every later lesson — the dash, the bar, early value — stays on
 * the quiet contextual coach line, which yields nothing to this surface
 * because the two never speak at once (main tells the coach when TEACH is
 * active and the coach skips the rungs TEACH owns).
 *
 * Placement: ~62% screen height — below the plate's reading zone, above
 * the answer buttons, so the instruction sits between the word and the
 * control it names without ever crossing either. It hides during the
 * launch veil and whenever the dash hint is up (one instruction at a
 * time), and disappears for good as each lesson retires — the same
 * demonstrated-action flags the coach line has always used.
 *
 * main.js constructs this and drives update() from the frame loop —
 * explicit integration, no timers, nothing wrapped. Copy is functional
 * words only; the four-name cap is untouched.
 */

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
      #guidedTeach .gtSub{margin-top:8px;font:700 11px/1 var(--face,system-ui);
        letter-spacing:.3em;color:#8be4ff;
        text-shadow:0 0 12px rgba(103,216,255,.5),0 2px 8px rgba(0,0,0,.8)}
      #guidedTeach.on{opacity:1}
    `;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.id = 'guidedTeach';
    this.el.innerHTML = '<div class="gtMain"></div><div class="gtSub"></div>';
    document.body.appendChild(this.el);
    this.main = this.el.querySelector('.gtMain');
    this.sub = this.el.querySelector('.gtSub');
    this._key = '';
  }

  _show(key, main, sub) {
    if (this._key !== key) {
      this._key = key;
      this.main.textContent = main;
      this.sub.textContent = sub;
    }
    this.el.classList.add('on');
  }

  hide() {
    this.el.classList.remove('on');
  }

  /**
   * One frame's verdict. `lessons` are the persisted demonstrated-action
   * flags; `enabled` is the GUIDED TIPS chip; `veilUp`/`hintUp` silence
   * this surface while the launch or the dash hint owns the frame.
   * `hold` is the study stop (PD-4): the run is pinned at a plate and the
   * world is waiting — the instruction names both verbs and never the
   * truth, because reading the word IS the lesson.
   */
  update({ running, enabled, lessons, veilUp, hintUp, touch, hold }) {
    if (!running || !enabled || veilUp || hintUp) { this.hide(); return; }
    if (hold) {
      this._show('hold', 'READ THE WORD',
        touch ? 'SPELLED RIGHT? TAP RIGHT · MISSPELLED? TAP LEFT'
          : 'SPELLED RIGHT? PRESS → · MISSPELLED? PRESS ←');
      return;
    }
    if (!lessons.confirm) {
      this._show('confirm', 'IS IT SPELLED RIGHT?',
        touch ? 'TAP RIGHT' : 'PRESS →');
    } else if (!lessons.reject) {
      this._show('reject', 'MISSPELLED? LET IT PASS',
        touch ? 'OR TAP LEFT TO CALL IT' : 'OR PRESS ← TO CALL IT');
    } else {
      this.hide();
    }
  }
}

export default GuidedTeach;
