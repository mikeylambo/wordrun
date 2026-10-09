/**
 * The priced continue's OFFER (Phase 14; the coin-op count, RC13.7).
 *
 * Death first passes through a short offer: buy the run back for ◆, or let
 * it end. This file is the offer itself — the screen, the draining bar, the
 * CONTINUE? 9 · 8 · 7 … digit and its tick, the two buttons. What a continue
 * COSTS and what buying one DOES to the run stay in main.js, which owns the
 * run: it passes `onBuy` / `onDecline` and reads `active` while the offer is
 * up (the frame loop and the advance key both stand down for it).
 */

import TUNING from '../TUNING.js';
import { ACCESS } from '../ui/access.js';

const CONT = TUNING.META.CONTINUE;

export class ContinueOffer {
  constructor({ audio, onBuy, onDecline }) {
    this.audio = audio;
    this.onBuy = onBuy;
    this.onDecline = onDecline;
    this.el = document.getElementById('continueOffer');
    this.buy = document.getElementById('continueBuy');
    this.pass = document.getElementById('continuePass');
    this.balance = document.getElementById('continueBalance');
    this.digit = document.getElementById('continueCount');
    this.bar = this.el?.querySelector('#continueTimer i');
    this.active = false;
    this._timer = null;
    this.buy?.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.uiTap();
      this.onBuy?.();
    });
    this.pass?.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.uiTap();
      this.decline();
    });
  }

  /** Whether an offer can be shown at all (the markup is present). */
  get available() { return !!this.el; }

  show(cost, balance) {
    this.active = true;
    this.buy.textContent = `CONTINUE ◆${cost}`;
    this.balance.textContent = `BALANCE ◆ ${Math.floor(balance)}`;
    this.el.classList.add('on');
    const { bar, digit } = this;
    const t0 = performance.now();
    bar.style.transform = 'scaleX(1)';
    let shown = -1;
    this._timer = setInterval(() => {
      const left = 1 - (performance.now() - t0) / (CONT.OFFER_SECONDS * 1000);
      if (left <= 0) { this.decline(); return; }
      bar.style.transform = `scaleX(${left.toFixed(3)})`;
      // RC13.7: the coin-op count, one digit and one tick per whole second.
      const secs = Math.ceil(left * CONT.OFFER_SECONDS);
      if (digit && secs !== shown) {
        shown = secs;
        digit.textContent = String(secs);
        digit.classList.toggle('urgent', secs <= 3);
        digit.classList.remove('beat');
        if (!ACCESS.reducedFlash) { void digit.offsetWidth; digit.classList.add('beat'); }
        this.audio.continueTick(secs);
      }
    }, 50);
  }

  hide() {
    this.active = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.el?.classList.remove('on');
  }

  /** LET IT END, or the count running out: the card proceeds. */
  decline() {
    this.hide();
    this.onDecline?.();
  }
}

export default ContinueOffer;
