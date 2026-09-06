/**
 * RC9.8 — the run's best stretch, on the results card.
 *
 * A small canvas beside the still, looping the frames MomentCapture froze at
 * the instant a brilliance ledger crossed its floor. It plays where a still
 * would sit and does the one thing a still cannot: show what the standout line
 * is talking about.
 *
 * The card's own furniture is BURNED IN, not overlaid — the flow band and the
 * wordmark are drawn into every frame of the clip, so a clip that leaves the
 * device leaves as a piece of this game rather than as an anonymous few
 * seconds of a road. That is also why the export re-renders rather than
 * recording the on-screen element: the element is a preview, the export is the
 * artefact, and they are allowed to be different sizes.
 *
 * NOTHING LEAVES THE DEVICE. Capture is a canvas blit, encoding is local
 * (MediaRecorder, or the GIF encoder beside this file), and the result is a
 * Blob the player may choose to share. No request is made at any point, which
 * is what keeps `audit:network` at zero.
 *
 * A run with no standout has no frozen moment and this shows nothing at all —
 * there is no empty player, no placeholder and no button.
 */

import { encodeGif } from './gif.js';

const WORDMARK = 'DICTION DASH';
// The page's own face, resolved once. A canvas `font` string is CSS font
// shorthand and `var(--face)` is NOT resolved inside one — assigning it is
// silently rejected and the wordmark would come out in the 10 px default.
let FACE = null;
function face() {
  if (FACE) return FACE;
  try {
    FACE = getComputedStyle(document.documentElement).getPropertyValue('--face').trim();
  } catch { FACE = ''; }
  return (FACE ||= 'system-ui, sans-serif');
}

/** Can this device record a canvas to WebM? */
export function canRecord() {
  try {
    return typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      MediaRecorder.isTypeSupported('video/webm');
  } catch { return false; }
}

/** Draw one strip cell into `g`, with the card's band and wordmark burned in. */
function paint(g, moment, i, w, h, flow) {
  const row = moment.order[i % moment.order.length];
  g.drawImage(moment.canvas, 0, row * moment.cellH, moment.cellW, moment.cellH,
    0, 0, w, h);
  // The same flow band the share still carries, in the flow's own ice cyan.
  const bandH = Math.max(2, Math.round(h * 0.008));
  const bandW = Math.round(w * (0.22 + 0.7 * flow));
  g.fillStyle = `rgba(103,216,255,${(0.34 + 0.58 * flow).toFixed(3)})`;
  g.fillRect(Math.round((w - bandW) / 2), h - bandH * 3, bandW, bandH);
  // And the name, small, under it.
  const size = Math.max(7, Math.round(h * 0.026));
  g.font = `800 ${size}px ${face()}`;
  g.textAlign = 'center';
  g.fillStyle = 'rgba(214,240,252,0.62)';
  g.letterSpacing = `${(size * 0.24).toFixed(1)}px`;
  g.fillText(WORDMARK, w / 2, h - bandH * 5);
}

export class MomentClip {
  constructor() {
    this.el = null;
    this.moment = null;
    this.flow = 0;
    this._raf = 0;
    this._i = 0;
    this._t = 0;
  }

  /**
   * Mount (once) into the results card's shot tray. The clip IS its own
   * button: tapping it saves the file. A separate control would have been a
   * fifth thing on a tray that already has three, for an action nobody needs
   * explained once the thing is moving in front of them.
   */
  mount(parent) {
    if (this.el || !parent) return;
    const el = document.createElement('canvas');
    el.id = 'momentClip';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'The best stretch of this run — tap to save it');
    el.addEventListener('click', (e) => { e.stopPropagation(); this.save(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.save(); }
    });
    parent.appendChild(el);
    this.el = el;
    this.ctx = el.getContext('2d', { alpha: false });
  }

  /**
   * Export and hand the file to the player. The share sheet where the device
   * has one, a download where it does not — and in both cases the bytes were
   * made here and go nowhere until the player says so.
   */
  async save() {
    if (this._saving || !this.moment) return;
    this._saving = true;
    this.el?.classList.add('busy');
    try {
      const out = await this.export2x();
      if (!out) return;
      const name = `dictiondash-moment.${out.ext}`;
      const file = typeof File === 'function' ? new File([out.blob], name, { type: out.blob.type }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'DICTION DASH' }); return; }
        catch (err) { if (err?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* a device that cannot encode keeps the still */ }
    finally {
      this._saving = false;
      this.el?.classList.remove('busy');
    }
  }

  /** Show a frozen moment, or hide when there is none. */
  show(moment, flow = 0) {
    this.moment = moment || null;
    this.flow = flow;
    if (!this.el) return;
    const on = !!this.moment;
    this.el.classList.toggle('on', on);
    cancelAnimationFrame(this._raf);
    if (!on) return;
    this.el.width = this.moment.cellW;
    this.el.height = this.moment.cellH;
    this._i = 0;
    this._t = performance.now();
    const step = () => {
      this._raf = requestAnimationFrame(step);
      const now = performance.now();
      if (now - this._t < 1000 / this.moment.fps) return;
      this._t = now;
      paint(this.ctx, this.moment, this._i++, this.el.width, this.el.height, this.flow);
    };
    step();
  }

  hide() {
    cancelAnimationFrame(this._raf);
    this.moment = null;
    this.el?.classList.remove('on');
  }

  /**
   * The clip as a file, twice the preview's size so it survives being looked
   * at. WebM where the device can record; a GIF where it cannot. Returns
   * `{ blob, ext }`, or null when there is nothing to export.
   */
  async export2x() {
    const m = this.moment;
    if (!m) return null;
    const w = m.cellW * 2, h = m.cellH * 2;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const g = out.getContext('2d', { alpha: false });
    g.imageSmoothingQuality = 'high';

    if (canRecord()) {
      const stream = out.captureStream(m.fps);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      const done = new Promise((res) => { rec.onstop = res; });
      rec.start();
      // Two laps, so the loop reads as a loop rather than as a clip that ends.
      for (let i = 0; i < m.order.length * 2; i++) {
        paint(g, m, i, w, h, this.flow);
        await new Promise((r) => setTimeout(r, 1000 / m.fps));
      }
      rec.stop();
      await done;
      return { blob: new Blob(chunks, { type: 'video/webm' }), ext: 'webm' };
    }

    // The fallback path: quantise and encode locally.
    const frames = [];
    for (let i = 0; i < m.order.length; i++) {
      paint(g, m, i, w, h, this.flow);
      frames.push(g.getImageData(0, 0, w, h).data);
    }
    return { blob: encodeGif({ frames, width: w, height: h, delayMs: 1000 / m.fps }), ext: 'gif' };
  }
}

export default MomentClip;
