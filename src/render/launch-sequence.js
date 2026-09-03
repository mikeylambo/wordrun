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
    // The Redline's arrival as a FULL-FRAME slash storm (art direction:
    // the playtest's slash-VFX reference, aiming at the FFX battle-intro
    // energy): nine long strokes covering the whole screen top to bottom,
    // at angles from -8 to -58 degrees, sweeping in on staggered beats
    // from BOTH sides so the cuts genuinely cross — the world entered
    // through a storm of corrections. The main stroke carries a white-hot
    // core; a second bright cut answers it from the right; the rest are
    // the flurry around them.
    this.strokes = [
      { top: 46, angle: -26, h: 6, at: 1.3, dur: 0.13, fade: 1.62, main: true },
      { top: 22, angle: -34, h: 4, at: 1.37, dur: 0.12, fade: 1.66, from: 'r', hot: true },
      { top: 8, angle: -14, h: 2.5, at: 1.42, dur: 0.11, fade: 1.68 },
      { top: 60, angle: -44, h: 3.5, at: 1.44, dur: 0.11, fade: 1.7, from: 'r' },
      { top: 34, angle: -8, h: 2, at: 1.47, dur: 0.1, fade: 1.7 },
      { top: 74, angle: -20, h: 3, at: 1.5, dur: 0.1, fade: 1.72 },
      { top: 16, angle: -50, h: 2, at: 1.52, dur: 0.1, fade: 1.72, from: 'r' },
      { top: 88, angle: -38, h: 2.5, at: 1.55, dur: 0.1, fade: 1.74 },
      { top: 52, angle: -58, h: 2, at: 1.58, dur: 0.09, fade: 1.76, from: 'r' },
    ];
    for (const s of this.strokes) {
      s.el = document.createElement('div');
      s.el.style.cssText =
        `position:absolute;left:-45%;right:-45%;top:${s.top}%;height:${s.h}px;` +
        `transform:scaleX(0) rotate(${s.angle}deg);` +
        `transform-origin:${s.from === 'r' ? 'right' : 'left'} center;` +
        'border-radius:3px;opacity:0;';
      this.el.appendChild(s.el);
    }
    this.bloom = document.createElement('div');
    this.bloom.style.cssText =
      'position:absolute;inset:0;opacity:0;';
    this.el.insertBefore(this.bloom, this.strokes[0].el);
    document.body.appendChild(this.el);
    this.t = -1;
  }

  begin() {
    this.t = 0;
    this.el.style.display = 'block';
    // Every stroke wears the LIVE danger accent, so every colour-vision
    // mode keeps the Redline's arrival as ITS one hue.
    const c = ACCESS.dangerCss;
    for (const s of this.strokes) {
      if (s.main || s.hot) {
        s.el.style.background =
          `linear-gradient(180deg,rgba(${c},0.65),rgba(255,255,255,${s.main ? 0.9 : 0.7}) 50%,rgba(${c},0.65))`;
        s.el.style.boxShadow = s.main
          ? `0 0 26px rgba(${c},0.95), 0 0 60px rgba(${c},0.5)`
          : `0 0 18px rgba(${c},0.85), 0 0 40px rgba(${c},0.4)`;
      } else {
        s.el.style.background = `rgba(${c},0.8)`;
        s.el.style.boxShadow = `0 0 ${Math.round(s.h * 4)}px rgba(${c},0.65)`;
      }
      s.el.style.transform = `scaleX(0) rotate(${s.angle}deg)`;
      s.el.style.opacity = '0';
    }
    this.bloom.style.background =
      `radial-gradient(110% 90% at 52% 48%, rgba(${c},0.26), transparent 72%)`;
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
    // The arrival: the cluster sweeps in on staggered beats, crossing
    // through the focal zone; the bloom breathes off the crossing and
    // everything is gone by the veil's end.
    for (const s of this.strokes) {
      if (t < s.at) continue;
      const k = Math.min(1, (t - s.at) / s.dur);
      const gone = Math.max(0, Math.min(1, (t - s.fade) / 0.25));
      s.el.style.transform = `scaleX(${k.toFixed(3)}) rotate(${s.angle}deg)`;
      s.el.style.opacity = (Math.min(1, k * 2) * (1 - gone)).toFixed(3);
    }
    if (t >= 1.3) {
      const b = Math.min(1, (t - 1.3) / 0.1);
      const bGone = Math.max(0, Math.min(1, (t - 1.58) / 0.3));
      this.bloom.style.opacity = (b * (1 - bGone) * 0.9).toFixed(3);
    }
  }
}

export default LaunchSequence;
