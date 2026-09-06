/**
 * RC9.8 — the rolling few seconds.
 *
 * The standout already knows the run's best stretch; this is what makes that
 * knowledge showable. A ring of small frames is written from the game canvas
 * while the run plays, and when a brilliance ledger crosses its floor the ring
 * is FROZEN — so the clip on the results card is the moment the card is about,
 * not the last few seconds before the runner died.
 *
 * THE BUDGET IS THE DESIGN. A capture that costs frames changes the run it is
 * recording, so:
 *
 *  - One canvas, allocated once: a filmstrip of `frames` cells, 4.11 MB of
 *    backing store at the shipped dials and never more. Nothing is read back
 *    into JS memory and no pixels are copied until a clip is exported.
 *  - One `drawImage` per captured frame, at 10 fps rather than every frame —
 *    a GPU blit into a 144x312 target, roughly a sixth of the frames the game
 *    draws.
 *  - It ARMS only after measuring the device. A run already dropping frames
 *    does not get a capture at all: the clip is a souvenir and the run is the
 *    game.
 *  - It is off entirely under REDUCED FLASH. A short loop that plays itself is
 *    motion, and the player has said no to motion.
 *
 * Freezing copies nothing either — it records where the ring's head was, so a
 * frozen strip and a live one are the same pixels read in a different order.
 * The ring then keeps running: a rarer standout later in the run re-freezes,
 * and the last freeze wins, exactly as the rarest ledger wins the line.
 *
 * Presentation only. Nothing here reads the sim, and nothing in the sim can
 * see it.
 */

import TUNING from '../TUNING.js';

const C = TUNING.CAPTURE;

/** The shape of the thing being filmed: height / width, 1 when unknowable. */
function sourceAspect(src) {
  const w = src?.clientWidth || 0, h = src?.clientHeight || 0;
  return w > 0 && h > 0 ? h / w : 1;
}

/**
 * The budget, from the dials and one number — the source canvas's aspect.
 * Pure, so the gates can print and hold the ceiling without a browser, and so
 * the running game knows what a capture costs BEFORE it decides to pay it.
 *
 * @param {number} aspect source height / source width
 */
export function captureBudget(aspect) {
  const cellW = C.WIDTH;
  const cellH = Math.max(2, Math.round(cellW * (aspect > 0 ? aspect : 1)));
  const frames = Math.max(2, Math.round(C.FPS * C.SECONDS));
  const bytes = cellW * cellH * 4 * frames;
  return {
    cellW, cellH, frames, bytes,
    megabytes: bytes / (1024 * 1024),
    line: `${cellW}x${cellH} px x 4 B x ${frames} frames = ` +
      `${(bytes / (1024 * 1024)).toFixed(2)} MB ` +
      `(${C.SECONDS}s at ${C.FPS} fps, ceiling ${C.MAX_MB} MB)`,
  };
}

/**
 * The rows of a ring, oldest first. `head` is the next cell to be written, so
 * the oldest of `filled` frames sits `filled` cells behind it.
 */
export function ringOrder(head, filled, frames) {
  const n = Math.min(filled, frames);
  const order = [];
  for (let i = 0; i < n; i++) order.push((head - n + i + frames * 2) % frames);
  return order;
}

export class MomentCapture {
  /**
   * @param {HTMLCanvasElement} source the game canvas
   * @param {{reducedFlash:boolean}} access
   */
  constructor(source, access = {}) {
    this.source = source;
    this.enabled = false;
    this.armed = false;
    const b = captureBudget(sourceAspect(source));
    this.frames = b.frames;
    this.cellW = b.cellW;
    this.cellH = b.cellH;
    this.strip = null;
    this.ctx = null;
    this.head = 0;          // next cell to write
    this.filled = 0;        // how many cells hold real pixels
    this.frozenAt = -1;     // head at the moment of the freeze, or -1
    this.frozenFilled = 0;
    this._t = 0;
    this._probe = 0;
    this._probeSum = 0;
    this._reason = access.reducedFlash ? 'reduced flash' : 'measuring';
    this._off = !!access.reducedFlash;
  }

  /**
   * What a capture costs on this device — known before it is paid, whether or
   * not the buffer ever arms. `budgetLine` is the printable form.
   */
  get bytes() { return this.cellW * this.cellH * 4 * this.frames; }
  get megabytes() { return this.bytes / (1024 * 1024); }
  get budgetLine() { return captureBudget(this.cellH / this.cellW).line; }
  /** Why there is no capture, or null while one is running. */
  get reason() { return this.enabled ? null : this._reason; }

  /**
   * The strip, once. A second run at the same screen shape re-uses the canvas
   * it already has rather than handing the collector four megabytes per
   * attempt — only a rotation or a resize builds a new one.
   */
  _alloc() {
    this._measure();
    const h = this.cellH * this.frames;
    if (!this.strip || this.strip.width !== this.cellW || this.strip.height !== h) {
      this.strip = document.createElement('canvas');
      this.strip.width = this.cellW;
      this.strip.height = h;
      this.ctx = this.strip.getContext('2d', { alpha: false });
    }
    this.head = 0;
    this.filled = 0;
    this.frozenAt = -1;
    this.frozenFilled = 0;
  }

  /**
   * Re-read the cell from the canvas as it is now. A rotation or a resize
   * between runs changes the shape of the thing being filmed, and the budget
   * has to follow it rather than describe the last run's screen.
   */
  _measure() {
    const b = captureBudget(sourceAspect(this.source));
    this.cellW = b.cellW;
    this.cellH = b.cellH;
    this.frames = b.frames;
  }

  /**
   * Arm the buffer without waiting for the measurement. The device test is
   * the shipped path and this is not it: the capture audit uses this to price
   * the buffer on a host that would refuse it, so the cost is measured rather
   * than assumed.
   */
  arm() {
    if (this._off || this.enabled) return this.enabled;
    try { this._alloc(); } catch { this._reason = 'no canvas'; return false; }
    this.armed = true;
    this.enabled = true;
    this._reason = null;
    return true;
  }

  /** A run is starting. Clears any frozen strip; re-measures the device. */
  begin(access = {}) {
    this._off = !!access.reducedFlash;
    this._measure();
    this.enabled = false;
    this.armed = false;
    this._probe = 0;
    this._probeSum = 0;
    this._t = 0;
    this.head = 0;
    this.filled = 0;
    this.frozenAt = -1;
    this.frozenFilled = 0;
    this._reason = this._off ? 'reduced flash' : 'measuring';
  }

  /**
   * One frame. `dt` is the frame's own delta, which is also the measurement:
   * the first CAPTURE.SAMPLE frames of a run decide whether this device can
   * afford a capture at all, and nothing is drawn until they have.
   */
  update(dt, running) {
    if (this._off || !running || !this.source) return;
    if (!this.armed) {
      if (dt > 0 && dt < 0.5) { this._probeSum += dt; this._probe++; }
      if (this._probe < C.SAMPLE) return;
      const fps = this._probe / this._probeSum;
      this.armed = true;
      if (fps < C.MIN_FPS) {
        this._reason = `device measured ${fps.toFixed(0)} fps, under the ${C.MIN_FPS} floor`;
        return;
      }
      try { this._alloc(); } catch { this._reason = 'no canvas'; return; }
      this.enabled = true;
      this._reason = null;
      return;
    }
    if (!this.enabled) return;
    this._t += dt;
    const step = 1 / C.FPS;
    if (this._t < step) return;
    // One frame per tick even after a long stall: catching up would spend
    // several blits on one frame, which is the opposite of the point.
    this._t = Math.min(this._t - step, step);
    this.ctx.drawImage(this.source, 0, this.head * this.cellH, this.cellW, this.cellH);
    this.head = (this.head + 1) % this.frames;
    if (this.filled < this.frames) this.filled++;
  }

  /**
   * Freeze the ring as it stands. Copies nothing — it records where the head
   * was, and the ring keeps running so a rarer moment later can re-freeze.
   */
  freeze() {
    if (!this.enabled || this.filled < 2) return false;
    this.frozenAt = this.head;
    this.frozenFilled = this.filled;
    return true;
  }

  get hasMoment() { return this.enabled && this.frozenAt >= 0 && this.frozenFilled >= 2; }

  /**
   * The frozen moment, oldest frame first: `{ canvas, cellW, cellH, order }`
   * where `order` lists the strip rows to play in sequence. Null when the run
   * had no moment worth keeping.
   */
  moment() {
    if (!this.hasMoment) return null;
    const order = ringOrder(this.frozenAt, this.frozenFilled, this.frames);
    return { canvas: this.strip, cellW: this.cellW, cellH: this.cellH, order, fps: C.FPS };
  }
}

export default MomentCapture;
