/**
 * Phase N4 — the authored launch.
 *
 * The game's fantasy is abstract, so the opening presentation works harder:
 * every run begins with a ~1.2 s beat that TEACHES the premise without one
 * word of lore — darkness in which the first word typesets, the road
 * revealing itself forward from under the runner, and one slash of the
 * Redline's own red arriving behind. Then you are already reading.
 *
 * Presentation ONLY. The sim runs underneath from the first frame, input is
 * never blocked (the veil is pointer-events: none), and the opening flat
 * means the first word is still seconds away when the veil clears — the
 * launch costs zero reading time. REDUCED FLASH replaces the staged reveal
 * and the slash with one smooth fade. main.js constructs this, begin() is
 * called by startRun, update(dt) by the frame loop, cancel() by
 * quitToTitle — explicit integration, nothing wrapped.
 */

import { ACCESS } from '../ui/access.js';

const DUR = 1.25;
const VEIL = 'rgba(4,8,16,';

export class LaunchSequence {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'launchVeil';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4;pointer-events:none;display:none;';
    this.slash = document.createElement('div');
    this.slash.style.cssText =
      'position:absolute;left:-12%;right:-12%;top:37%;height:3px;' +
      'transform:scaleX(0) rotate(-2deg);transform-origin:left center;' +
      'border-radius:2px;';
    this.el.appendChild(this.slash);
    document.body.appendChild(this.el);
    this.t = -1;
  }

  begin() {
    this.t = 0;
    this.el.style.display = 'block';
    // The slash wears the LIVE danger accent, so every colour-vision mode
    // keeps the Redline's arrival as ITS one hue.
    this.slash.style.background = `rgba(${ACCESS.dangerCss},0.9)`;
    this.slash.style.boxShadow = `0 0 14px rgba(${ACCESS.dangerCss},0.8)`;
    this.slash.style.transform = 'scaleX(0) rotate(-2deg)';
    this.slash.style.opacity = '0';
  }

  cancel() {
    this.t = -1;
    this.el.style.display = 'none';
  }

  update(dt) {
    if (this.t < 0) return;
    this.t += dt;
    const t = this.t;
    if (t >= DUR) { this.cancel(); return; }

    if (ACCESS.reducedFlash) {
      // One smooth fade — no staged reveal, no slash.
      const a = Math.max(0, 0.9 * (1 - t / 0.9));
      this.el.style.background = `${VEIL}${a.toFixed(3)})`;
      if (t >= 0.9) this.cancel();
      return;
    }

    // 0.00–0.30  darkness holds; the armed plate's glow bleeds through the
    //            near-opaque veil — the first word typesetting in the dark.
    // 0.30–0.95  the road draws itself forward: the transparent front
    //            sweeps from the runner (bottom) to the horizon (top).
    // ~0.85      the Redline slashes into existence behind the reveal.
    if (t < 0.3) {
      this.el.style.background = `${VEIL}0.94)`;
    } else {
      const w = Math.min(1, (t - 0.3) / 0.65);
      const e = w * w * (3 - 2 * w);
      const front = 100 - e * 130;           // sweeps bottom→top, then past
      const a = 0.94 * (1 - w * 0.35);
      this.el.style.background =
        `linear-gradient(180deg,${VEIL}${a.toFixed(3)}) 0%,` +
        `${VEIL}${a.toFixed(3)}) ${Math.max(0, front - 18).toFixed(1)}%,` +
        `transparent ${Math.max(0, front).toFixed(1)}%)`;
    }
    if (t >= 0.85) {
      const s = Math.min(1, (t - 0.85) / 0.12);
      const gone = Math.max(0, (t - 1.05) / 0.2);
      this.slash.style.transform = `scaleX(${s.toFixed(3)}) rotate(-2deg)`;
      this.slash.style.opacity = (Math.min(1, s * 2) * (1 - gone)).toFixed(3);
    }
  }
}

export default LaunchSequence;
