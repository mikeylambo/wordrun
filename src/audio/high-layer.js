/**
 * RC9.7 — the second layer, as sound.
 *
 * The thin wrapper the pure envelope (music/high-layer.js) drives. It does
 * three things and refuses to do a fourth:
 *
 *  1. Routes through `audio.bus.music`, the same bus the track rides, so mute,
 *     the drain's lowpass and every duck already in the mix apply to it for
 *     free. There is no second music path and there must never be one — that
 *     is how the retired stem engine ended up with its own bus and its own
 *     MUSIC_MAX dial to keep in sync with the mix.
 *  2. Prefers a REAL FILE and falls back to a synthesized pad, so the
 *     mechanism ships working rather than waiting. The contract is in
 *     public/audio/music/README.md: drop `into-the-night.high.mp3` beside the
 *     track, same length, same tempo, loops at the same point, and this plays
 *     it instead with nothing else to change.
 *  3. Moves its gain, and only its gain. It draws nothing, it returns nothing
 *     the frame can key a visual off, and it never touches the music clock —
 *     it only reads it.
 *
 * REDUCED FLASH is a MOTION setting and this is not motion. It does not
 * silence the track and it does not silence this, exactly as it does not
 * silence the kick drum; what it governs is what the screen does, and this
 * layer's whole contract is that the screen does nothing about it.
 */

import { HighLayerEnvelope } from '../music/high-layer.js';
import { urlsFor } from '../music/setlist.js';

// The placeholder's voices, in the track's own key (A minor). A fifth and its
// octave, filtered dark and detuned a few cents apart so it reads as a pad
// rather than a test tone. Deliberately plain: it is a mechanism, not a mix.
const PAD_HZ = [220, 329.63, 440];
const PAD_DETUNE = [-4, 3, 6];
const PAD_PEAK = 0.16;

export class HighLayer {
  constructor() {
    this.env = new HighLayerEnvelope();
    this.el = null;
    this.real = false;
    this.gainNode = null;
    this._wired = false;
    this._voices = [];
    this._prevBeat = null;
  }

  /**
   * Stage the real layer if it is there. A miss is the expected case today
   * and is not an error: the placeholder covers it, and `real` says which is
   * playing so the gates and the audit can tell them apart.
   */
  async load(id = null) {
    // RC10.6: the layer belongs to a TRACK, so it follows whichever score the
    // session is playing rather than naming one. A setlist of one behaves
    // exactly as before.
    const urls = urlsFor(id || 'into-the-night');
    if (!urls) return false;
    this.url = urls.high;
    try {
      const res = await fetch(urls.high, { method: 'HEAD' });
      if (!res.ok) return false;
      const el = new Audio(urls.high);
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      this.el = el;
      this.real = true;
      return true;
    } catch {
      return false;   // no layer file — the pad stands in
    }
  }

  /** Route into the music bus. Idempotent; a second attach is a no-op. */
  attach(audio) {
    if (this._wired || !audio?.ctx || !audio?.bus?.music) return;
    const ctx = audio.ctx;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(audio.bus.music);
    if (this.el) {
      try {
        ctx.createMediaElementSource(this.el).connect(this.gainNode);
      } catch { /* a second source on one element throws; harmless */ }
    } else {
      // The placeholder. Free-running voices whose only amplitude is the
      // envelope's — nothing here starts, stops or ducks on a beat.
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1400;
      tone.Q.value = 0.4;
      tone.connect(this.gainNode);
      for (let i = 0; i < PAD_HZ.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = PAD_HZ[i];
        osc.detune.value = PAD_DETUNE[i];
        const g = ctx.createGain();
        g.gain.value = PAD_PEAK / PAD_HZ.length;
        osc.connect(g).connect(tone);
        try { osc.start(); } catch { /* already started */ }
        this._voices.push(osc);
      }
    }
    this._wired = true;
  }

  /**
   * One frame. `clock` is the MusicTrack's clock (or null), `chain` the run's
   * reading chain. Returns the envelope's gain, for the gates and the audit —
   * nothing in the frame is allowed to draw with it.
   */
  update({ clock = null, chain = 0, dt = 0, running = false } = {}) {
    const beat = clock?.playing ? Math.floor(clock.beat) : null;
    const onBeat = beat != null && this._prevBeat != null && beat !== this._prevBeat;
    this._prevBeat = beat;
    const gain = this.env.step({
      chain, dt, onBeat, hasClock: !!clock?.playing, running,
    });
    if (this.gainNode) {
      // A short time constant, because the ramp is already the envelope's —
      // this only stops a per-frame step from clicking.
      this.gainNode.gain.setTargetAtTime(gain, this.gainNode.context.currentTime, 0.02);
    }
    if (this.el) {
      if (gain > 0.001 && this.el.paused) this.el.play().catch(() => {});
      if (gain <= 0.001 && !this.el.paused) this.el.pause();
    }
    return gain;
  }

  stop() {
    this.env.reset();
    this._prevBeat = null;
    if (this.gainNode) this.gainNode.gain.value = 0;
    if (this.el) { this.el.pause(); this.el.currentTime = 0; }
  }
}

export default HighLayer;
