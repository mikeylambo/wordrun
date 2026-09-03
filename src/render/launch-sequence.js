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

// Playtest: 1.25s read as too short — the beat is now ~1.9s, still well
// inside the opening flat's seconds of empty road.
const DUR = 1.95;
const VEIL = 'rgba(4,8,16,';

export class LaunchSequence {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'launchVeil';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4;pointer-events:none;display:none;';
    // The Redline's arrival, promoted to a real transition (playtest: "one
    // looks good — it could be a great opening visual"): the MAIN slash
    // with a hot core, a red bloom breathing off the cut, and two echo
    // corrections striking through at staggered offsets — the editor's pen
    // crossing the page three times before the chase begins.
    const stroke = (top, height, angle) => {
      const s = document.createElement('div');
      s.style.cssText =
        `position:absolute;left:-14%;right:-14%;top:${top};height:${height}px;` +
        `transform:scaleX(0) rotate(${angle}deg);transform-origin:left center;` +
        'border-radius:3px;opacity:0;';
      this.el.appendChild(s);
      return s;
    };
    this.slash = stroke('37%', 5, -2);
    this.echoA = stroke('31%', 2, -1.2);
    this.echoB = stroke('43%', 3, -2.8);
    this.bloom = document.createElement('div');
    this.bloom.style.cssText =
      'position:absolute;left:0;right:0;top:22%;height:34%;opacity:0;';
    this.el.insertBefore(this.bloom, this.slash);
    document.body.appendChild(this.el);
    this.t = -1;
  }

  begin() {
    this.t = 0;
    this.el.style.display = 'block';
    // Every stroke wears the LIVE danger accent, so every colour-vision
    // mode keeps the Redline's arrival as ITS one hue.
    const c = ACCESS.dangerCss;
    this.slash.style.background =
      `linear-gradient(180deg,rgba(${c},0.65),rgba(255,255,255,0.9) 50%,rgba(${c},0.65))`;
    this.slash.style.boxShadow = `0 0 26px rgba(${c},0.95), 0 0 60px rgba(${c},0.5)`;
    this.echoA.style.background = `rgba(${c},0.75)`;
    this.echoA.style.boxShadow = `0 0 10px rgba(${c},0.6)`;
    this.echoB.style.background = `rgba(${c},0.8)`;
    this.echoB.style.boxShadow = `0 0 14px rgba(${c},0.7)`;
    this.bloom.style.background =
      `radial-gradient(120% 100% at 50% 50%, rgba(${c},0.30), transparent 70%)`;
    for (const s of [this.slash, this.echoA, this.echoB]) {
      s.style.transform = s.style.transform.replace(/scaleX\([^)]*\)/, 'scaleX(0)');
      s.style.opacity = '0';
    }
    this.bloom.style.opacity = '0';
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
      const a = Math.max(0, 0.9 * (1 - t / 1.3));
      this.el.style.background = `${VEIL}${a.toFixed(3)})`;
      if (t >= 1.3) this.cancel();
      return;
    }

    // 0.00–0.50  darkness holds; the armed plate's glow bleeds through the
    //            near-opaque veil — the first word typesetting in the dark.
    // 0.50–1.45  the road draws itself forward: the transparent front
    //            sweeps from the runner (bottom) to the horizon (top).
    // ~1.35      the Redline slashes into existence behind the reveal.
    if (t < 0.5) {
      this.el.style.background = `${VEIL}0.94)`;
    } else {
      const w = Math.min(1, (t - 0.5) / 0.95);
      const e = w * w * (3 - 2 * w);
      const front = 100 - e * 130;           // sweeps bottom→top, then past
      const a = 0.94 * (1 - w * 0.35);
      this.el.style.background =
        `linear-gradient(180deg,${VEIL}${a.toFixed(3)}) 0%,` +
        `${VEIL}${a.toFixed(3)}) ${Math.max(0, front - 18).toFixed(1)}%,` +
        `transparent ${Math.max(0, front).toFixed(1)}%)`;
    }
    // The arrival: main slash at 1.35, echoes at 1.44 and 1.51, the bloom
    // breathing off the cut and everything gone by the veil's end.
    const draw = (el, at, dur, angle, fadeAt) => {
      if (t < at) return;
      const s = Math.min(1, (t - at) / dur);
      const gone = Math.max(0, Math.min(1, (t - fadeAt) / 0.25));
      el.style.transform = `scaleX(${s.toFixed(3)}) rotate(${angle}deg)`;
      el.style.opacity = (Math.min(1, s * 2) * (1 - gone)).toFixed(3);
    };
    draw(this.slash, 1.35, 0.13, -2, 1.62);
    draw(this.echoA, 1.44, 0.10, -1.2, 1.66);
    draw(this.echoB, 1.51, 0.11, -2.8, 1.7);
    if (t >= 1.35) {
      const b = Math.min(1, (t - 1.35) / 0.1);
      const bGone = Math.max(0, Math.min(1, (t - 1.55) / 0.3));
      this.bloom.style.opacity = (b * (1 - bGone) * 0.9).toFixed(3);
    }
  }
}

export default LaunchSequence;
