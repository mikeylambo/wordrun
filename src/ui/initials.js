/**
 * RC13.7 — ENTER YOUR INITIALS.
 *
 * A run that makes its board's top ten takes three letters, on the results
 * card, the way a cabinet always asked. Inline, not a modal: AGAIN and MENU
 * stay exactly where they were and still work — leaving the card commits the
 * letters on screen, so a score that qualified is never lost to a fast tap.
 *
 * Touch: ▲ / ▼ on each slot. Keyboard: type the letters, Backspace to step
 * back, Enter to commit. Controller: the arrows are buttons controller-nav
 * already walks. The rules (which letters, which boards, which place) live in
 * meta/hiscore.js; this file is only the slot machine.
 */

import { INITIALS_LEN, cleanInitials, stepLetter } from '../meta/hiscore.js';

export class InitialsEntry {
  constructor({ host, onCommit }) {
    this.host = host;
    this.onCommit = onCommit;
    this.isOpen = false;
    this.letters = ['A', 'A', 'A'];
    this.cursor = 0;
    host?.addEventListener('click', (e) => this._click(e));
  }

  _click(e) {
    if (!this.isOpen) return;
    e.stopPropagation();
    const b = e.target.closest?.('button');
    if (!b) return;
    if (b.classList.contains('iOk')) { this.commit(); return; }
    const k = +b.dataset.k;
    this.cursor = k;
    this.letters[k] = stepLetter(this.letters[k], b.classList.contains('iUp') ? 1 : -1);
    this._paint();
  }

  open({ place, initials = 'AAA' }) {
    if (!this.host) return;
    this.isOpen = true;
    this.place = place;
    const seed = (cleanInitials(initials) || 'AAA').split('');
    this.letters = seed.slice(0, INITIALS_LEN);
    this.cursor = 0;
    const slots = this.letters.map((_, k) =>
      `<span class="iSlot" data-k="${k}">`
      + `<button class="iUp" type="button" data-rc2-ui data-k="${k}" aria-label="Letter ${k + 1} up">▲</button>`
      + `<b></b>`
      + `<button class="iDn" type="button" data-rc2-ui data-k="${k}" aria-label="Letter ${k + 1} down">▼</button></span>`).join('');
    this.host.innerHTML =
      `<div class="iHead">NEW HIGH SCORE · #${place}</div>`
      + `<div class="iRow">${slots}<button class="btn primary iOk" type="button" data-rc2-ui>ENTER</button></div>`;
    this.host.classList.add('on');
    this._paint();
  }

  _paint() {
    this.host.querySelectorAll('.iSlot').forEach((s, k) => {
      s.querySelector('b').textContent = this.letters[k];
      s.classList.toggle('cur', k === this.cursor && this.isOpen);
    });
    const ok = this.host.querySelector('.iOk');
    if (ok) ok.disabled = !cleanInitials(this.letters.join(''));
  }

  /** Keyboard. Returns true when the key was the entry's to take. */
  key(e) {
    if (!this.isOpen) return false;
    if (e.code === 'Enter') { this.commit(); return true; }
    if (e.code === 'Backspace') { this.cursor = Math.max(0, this.cursor - 1); this._paint(); return true; }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      this.letters[this.cursor] = stepLetter(this.letters[this.cursor], e.code === 'ArrowUp' ? 1 : -1);
      this._paint();
      return true;
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      this.cursor = Math.max(0, Math.min(INITIALS_LEN - 1, this.cursor + (e.code === 'ArrowRight' ? 1 : -1)));
      this._paint();
      return true;
    }
    if (/^Key[A-Z]$/.test(e.code)) {
      this.letters[this.cursor] = e.code.slice(3);
      this.cursor = Math.min(INITIALS_LEN - 1, this.cursor + 1);
      this._paint();
      return true;
    }
    return false;
  }

  /** Write the row. A blocked set falls back to the house initials. */
  commit() {
    if (!this.isOpen) return;
    this.isOpen = false;
    const i = cleanInitials(this.letters.join('')) || 'AAA';
    this.onCommit?.(i);
    this.host.innerHTML = `<div class="iHead done">#${this.place} · ${i}</div>`;
  }

  close() {
    this.isOpen = false;
    if (!this.host) return;
    this.host.classList.remove('on');
    this.host.innerHTML = '';
  }
}

export default InitialsEntry;
