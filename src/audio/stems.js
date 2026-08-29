/**
 * Dynamic music stems (Phase 12) — the reactive ENGINE, not the music.
 *
 * Four looping stem layers (drums / bass / lead / fx), each with its own
 * gain node, all routed through one music bus into the game's existing
 * master chain (so mute and the drain's lowpass duck apply to the score
 * automatically). Layer volumes are automated from live sim state through
 * ONE pure mapping, `stemLevels({ speed, streak })` — the same two values
 * that drive the visual vibrancy system, by design:
 *
 *   bass  — the foundation: always present, swells with speed
 *   drums — locomotion: ride the speed curve floor→ceiling
 *   lead  — flow: wakes with the chain, the melodic reward
 *   fx    — the peak layer: needs BOTH high speed and a deep chain
 *
 * ASSET REPLACEMENT CONTRACT (no code changes needed): the loader tries
 * `audio/stems/<layer>.mp3` then `.wav` from the bundle for each of the
 * four layer names. Any file found is used verbatim (loops seamlessly as
 * authored; layers loop independently, so keep them the same BPM and a
 * shared bar multiple). Any file missing falls back to a deterministic
 * synthesized placeholder loop so the whole system is testable today.
 * Drop real stems into public/audio/stems/ and they ship.
 *
 * No player-facing copy, no UI — this module never touches the naming cap.
 */

import TUNING from '../TUNING.js';

export const STEM_LAYERS = ['drums', 'bass', 'lead', 'fx'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * The one pure mapping: sim state -> per-layer target gains (0..1).
 * Deterministic and monotone by construction — gated in the suite.
 */
export function stemLevels({ speed = 0, streak = 0 } = {}) {
  const R = TUNING.RUN;
  const speedN = clamp01((speed - R.FLOOR) / (R.CEILING - R.FLOOR));
  const flow = clamp01(streak / TUNING.BOOST.CHAIN_CAP);
  return {
    bass: 0.55 + 0.35 * speedN,
    drums: 0.12 + 0.88 * smooth(clamp01((speedN - 0.08) / 0.72)),
    lead: smooth(clamp01((flow - 0.2) / 0.6)),
    fx: smooth(clamp01((speedN * flow - 0.18) / 0.5)),
  };
}

/** Bar-aligned placeholder loops — pure math, no randomness, quiet. */
function placeholderBuffer(ctx, layer) {
  const BPM = 112;
  const bar = (60 / BPM) * 4;
  const seconds = bar * 2;
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const beat = (60 / BPM);

  for (let i = 0; i < n; i++) {
    const t = i / ctx.sampleRate;
    const inBeat = (t % beat) / beat;
    let v = 0;
    if (layer === 'drums') {
      // Eighth-note ticks, accented on the quarter: a metronome skeleton.
      const inEighth = (t % (beat / 2)) / (beat / 2);
      const accent = inBeat < 0.5 ? 1 : 0.45;
      v = Math.exp(-inEighth * 34) * Math.sin(2 * Math.PI * 190 * t) * accent * 0.5;
    } else if (layer === 'bass') {
      // Root-fifth pulse on A1, gated per beat.
      const note = (Math.floor(t / bar) % 2) === 0 ? 55 : 82.4;
      v = Math.sin(2 * Math.PI * note * t) * Math.exp(-inBeat * 3) * 0.4;
    } else if (layer === 'lead') {
      // A slow pentatonic arpeggio, one note per half-beat.
      const steps = [0, 3, 5, 7, 10, 7, 5, 3];
      const idx = Math.floor(t / (beat / 2)) % steps.length;
      const f = 440 * Math.pow(2, steps[idx] / 12);
      const inHalf = (t % (beat / 2)) / (beat / 2);
      v = Math.sin(2 * Math.PI * f * t) * Math.exp(-inHalf * 5) * 0.22;
    } else {
      // fx: a slow shimmer swell, one cycle per two bars.
      const swell = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / seconds);
      v = Math.sin(2 * Math.PI * 1244 * t) * Math.sin(2 * Math.PI * 3.1 * t) * swell * 0.12;
    }
    d[i] = v;
  }
  return buf;
}

export class StemMix {
  constructor(ctx, destination, baseUrl = '') {
    this.ctx = ctx;
    this.baseUrl = baseUrl;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0; // silent until a run is live
    this.bus.connect(destination);
    this.layers = {};
    for (const name of STEM_LAYERS) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.bus);
      this.layers[name] = { gain, source: null, buffer: null, placeholder: true };
    }
    this.started = false;
    this._load();
  }

  /** Try shipped stems, fall back to the synthesized placeholders. */
  async _load() {
    await Promise.all(STEM_LAYERS.map(async (name) => {
      const layer = this.layers[name];
      for (const ext of ['mp3', 'wav']) {
        try {
          const res = await fetch(`${this.baseUrl}audio/stems/${name}.${ext}`, { cache: 'force-cache' });
          if (!res.ok) continue;
          layer.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
          layer.placeholder = false;
          return;
        } catch { /* fall through to the next candidate */ }
      }
      layer.buffer = placeholderBuffer(this.ctx, name);
    })).then(() => {
      if (this.started) this._startSources();
    });
  }

  _startSources() {
    for (const name of STEM_LAYERS) {
      const layer = this.layers[name];
      if (layer.source || !layer.buffer) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = layer.buffer;
      src.loop = true;
      src.connect(layer.gain);
      src.start();
      layer.source = src;
    }
  }

  /** Begin looping (idempotent; sources also attach when loading finishes). */
  start() {
    this.started = true;
    this._startSources();
  }

  /**
   * Drive the mix from live sim state. Deterministic: targets come from
   * stemLevels alone; setTargetAtTime gives the crossfade its slew.
   */
  update(state, live) {
    const now = this.ctx.currentTime;
    const master = TUNING.AUDIO.MUSIC_MAX * (live ? 1 : 0);
    this.bus.gain.setTargetAtTime(master, now, live ? 0.3 : 0.12);
    if (!live) return;
    const levels = stemLevels(state);
    for (const name of STEM_LAYERS) {
      this.layers[name].gain.gain.setTargetAtTime(levels[name], now, 0.35);
    }
  }
}
