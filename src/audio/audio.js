/**
 * DICTION DASH audio identity (RC9 graph, Phase 4 timbres).
 * One Web Audio graph drives the reads, the bells, the dash, the page bed and
 * the Redline. The creature growls are gone: every threat cue is signal-noise
 * — interference whine, glitch ticks — driven by the SAME band curves and gap
 * value the beast cues used.
 *
 * This file owns the whole continuous mix. Five runtime layers used to wrap
 * update()/bell()/_tone()/_burst()/_thump() in an order set by an import list
 * (rc9-feedback, v1-final-mix, v1-mixer, v1-approved-mix, v1-finalize) plus an
 * instance patch on a polling boot (rc9-assets); their behaviour is inline
 * here now, and the levels are audio/live-mix.js. The Hunt machinery (drone,
 * pulse, start/end cues) went with them: the pursuer's mode has been 'run'
 * since Phase 7, so none of it could sound.
 */

import TUNING from '../TUNING.js';
import { corruptionIntensity } from '../render/corruption-curve.js';
import { chimeStep, ladderHz, STRING_RUNGS } from './ladder.js';
import { categoryGain, approved, trim } from './live-mix.js';
import { ApprovedAudioAssets } from './approved-assets.js';
import { PageBed } from './page-bed.js';

const A = TUNING.AUDIO;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

const RC9 = {
  // Far-range corruption bed: audible the moment the gap starts closing,
  // long before the close-range bands wake — the ears' version of the veil.
  STATIC_FAR: 0.085,
};

function noiseBuffer(ctx, seconds = 2, smooth = 0.72) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = last * smooth + w * (1 - smooth);
    d[i] = last * 1.7;
  }
  return buf;
}

export class Audio {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.muted = false;
    this.musicMuted = false;   // RC-5: the score
    this.sfxMuted = false;     // RC-5: everything else
    this._footT = 0;
    // The mix category a procedural voice is being struck in ('bells' or
    // 'heartbeat'), so _tone/_burst can apply that fader — see live-mix.js.
    this._category = null;
    // Priority ducking: a bell briefly pulls the beds down so it reads
    // without the whole mix getting louder. Depth decays inside update().
    this._bedDuck = 0;
    this._bedDuckHold = 0;
    // The approved recordings (the Redline's step) and the procedural page
    // bed. Both are built lazily once the graph exists.
    this.approvedAssets = null;
    this.pageBed = null;
    this._lastStepSampleAt = -Infinity;
    globalThis.__AUDIO = this;
  }

  /**
   * Resume from a user gesture. The node graph itself is built by
   * prewarm() — construction is allowed before any gesture (the context
   * just starts suspended), only resume() needs the tap. Building the
   * ~40 node graph and two noise buffers used to happen ON the BEGIN RUN
   * tap and was one of the three run-start stutter sources (Phase 8).
   */
  start() {
    this.prewarm();
    if (this.ready && this.ctx.state === 'suspended') this.ctx.resume();
    this._ensureAssets();
  }

  /** Load the approved recordings once the graph exists. A missing manifest
   *  leaves the procedural mix intact (ApprovedAudioAssets swallows it). */
  _ensureAssets() {
    if (this.approvedAssets || !this.ready || !this.ctx || !this.bus) return;
    this.approvedAssets = new ApprovedAudioAssets(this.ctx, this.bus);
    this.approvedAssets.load();
  }

  /** Build the whole graph, suspended. Safe to call at page load. */
  prewarm() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = A.MASTER;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -7;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 5;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.18;
    // The drain's ears (Phase 9): a master lowpass, wide open in play,
    // slammed shut for a beat by duck() when a fake gets tapped — the
    // whole mix goes dark with the world, then recovers.
    this.duckFilter = ctx.createBiquadFilter();
    this.duckFilter.type = 'lowpass';
    this.duckFilter.frequency.value = 19500;
    this.duckFilter.Q.value = 0.3;
    this.master.connect(this.duckFilter);
    this.duckFilter.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.bus = {
      ambience: this._bus(0.92),
      surface: this._bus(0.95),
      threat: this._bus(0.92),
      score: this._bus(0),
      ui: this._bus(0.82),
      cinematic: this._bus(1),
      // RC-5: the score rides its OWN bus so MUSIC and SFX are separable.
      // It used to share `ambience` with the world bed, which made "music
      // off" impossible without silencing the world with it.
      music: this._bus(1),
    };

    this.noise = noiseBuffer(ctx, 2, 0.72);
    this.white = noiseBuffer(ctx, 1, 0.18);

    // Phase 27: every sustained noise bed is gone. Phase 24 removed the two
    // voices NAMED wind, which was not the same thing as removing the sound —
    // the glide voice was still a bandpass bed sweeping 1540-2850 Hz with
    // speed, running whenever the runner was on the ground, and that is a wind
    // by any ear. It was DESCENT's board-on-snow contact, renamed in Phase 18
    // rather than removed; this runner has no surface-contact fantasy to sell.
    // Powder and ice went with it as proven-dead: both keyed off player flags
    // that are set false at reset and never written again, so they measured 0
    // gain at every speed. The dash rush went too — it was the same bandpass
    // noise, and the dash still announces itself with the sweep and burst in
    // overdriveOn(). Impacts, bells, word cues and the music stems remain, so
    // the surface bus is still carrying its transients.
    // Phase 30: the last two sustained noise beds are gone, and they were the
    // ones that mattered. Phase 27 claimed every noise bed had been removed;
    // what it actually removed were the SPEED-keyed ones. These two were keyed
    // to the Redline — a wandering bandpass on white noise, and a highpassed
    // hiss rising with the square of corruption — so the wind came back for
    // exactly the stretch where the pursuit closes, which is the worst moment
    // to sound like weather. Broadband noise held at a level IS wind to an
    // ear, whatever the filter in front of it is called.
    // "roar" keeps its name and its band curve; its body is now a detuned pair
    // through a resonant lowpass, wobbling on the same LFO the bandpass used.
    // The pursuit reads as an electrical fault closing in rather than as air.
    this.roar = this._buzzVoice([57, 57.9, 115.4], 'lowpass', 5.5, this.bus.threat);

    this.roarLfo = ctx.createOscillator();
    this.roarLfoGain = ctx.createGain();
    this.roarLfo.frequency.value = 0.9;
    this.roarLfoGain.gain.value = 210;
    this.roarLfo.connect(this.roarLfoGain);
    this.roarLfoGain.connect(this.roar.filter.frequency);
    this.roarLfo.start();
    // The far static is now crackle rather than a bed: short bursts fired at a
    // rate the corruption curve sets. Same curve, same identity, no sustain.
    this._crackleT = 0;

    this.screamGain = ctx.createGain();
    this.screamGain.gain.value = 0;
    this.screamGain.connect(this.bus.threat);
    this.screamOscs = [];
    for (const f of [1174, 1187]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.value = 0.09;
      filt.type = 'bandpass';
      filt.frequency.value = 2400;
      filt.Q.value = 2.2;
      o.connect(g); g.connect(filt); filt.connect(this.screamGain);
      o.start();
      this.screamOscs.push(o);
    }

    // Phase J: the four-stem engine (Phase 12) is retired. The Phase 28 full
    // track plus its beat clock is the reactive layer now (music-track.js,
    // music-response.js); the stems only ever played their synthesized
    // placeholders under it, and were suppressed the moment the track was live.

    this.ready = true;
    globalThis.__AUDIO_RC9 = { version: '9.0', buses: Object.keys(this.bus), shared: true };
  }

  _bus(gain) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.master);
    return g;
  }

  _panner(pan = 0) {
    if (!this.ctx.createStereoPanner) return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }

  /** A sustained TONAL voice: detuned oscillators through a resonant filter.
   *  Same shape as _noiseVoice so the callers and the LFO wiring are
   *  unchanged, but nothing broadband ever reaches the bus. */
  _buzzVoice(freqs, type, q, bus, pan = 0) {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = 320;
    filter.Q.value = q;
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const oscs = freqs.map((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === freqs.length - 1 ? 'square' : 'sawtooth';
      o.frequency.value = f;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain);
    if (panner) { gain.connect(panner); panner.connect(bus); panner.pan.value = pan; }
    else gain.connect(bus);
    return { oscs, filter, gain, pan: panner };
  }

  _noiseVoice(freq, type, q, bus, pan = 0, buffer = this.noise) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const panner = this._panner(pan);
    src.connect(filter); filter.connect(gain);
    if (panner) { gain.connect(panner); panner.connect(bus); }
    else gain.connect(bus);
    src.start();
    return { src, filter, gain, pan: panner };
  }

  _set(param, value, tau = 0.08) {
    param.setTargetAtTime(value, this.ctx.currentTime, tau);
  }

  _panFor(x) {
    const p = globalThis.__SIM?.player;
    if (!p) return 0;
    return clamp((x - p.x) / 8, -1, 1);
  }

  /** MUSIC — the score alone. */
  setMusicMuted(m) {
    this.musicMuted = !!m;
    if (this.ready) this.bus.music.gain.setTargetAtTime(this.musicMuted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** SFX — everything that is not the score. The per-sound emitters below
   *  check `sfxMuted` beside `muted`; the continuous beds are scaled in
   *  update(), so nothing has to be muted in two places. */
  setSfxMuted(m) { this.sfxMuted = !!m; }

  setMuted(m) {
    this.muted = !!m;
    if (this.ready) this.master.gain.setTargetAtTime(this.muted ? 0 : A.MASTER, this.ctx.currentTime, 0.025);
  }

  suspend() { if (this.ready && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ready && this.ctx.state === 'suspended') this.ctx.resume(); }

  /** Continuous mix, driven every frame from simulation state. */
  update(dt, p, bands, running) {
    if (!this.ready) return;
    const sim = globalThis.__SIM;
    const phase = sim?.phase;
    const kill = phase === 'kill' || phase === 'dead';
    const run = running ? 1 : 0;

    // Phase E: during the last stand the mix stands down to almost nothing.
    // Silence is the tell — no label announces the moment, so the sudden
    // absence of everything has to carry it.
    const live = run && !kill;
    const roar = clamp(bands?.roar || 0);

    // Priority ducking: a bell asks for a short dip in the beds (bell()),
    // held briefly, then released on an exponential. It lets the bell read
    // without making the whole mix louder.
    if (this._bedDuckHold > 0) {
      this._bedDuckHold = Math.max(0, this._bedDuckHold - dt);
    } else if (this._bedDuck > 0) {
      this._bedDuck *= Math.exp(-dt * 8.5);
      if (this._bedDuck < 0.002) this._bedDuck = 0;
    }
    const duck = clamp(Math.max(this._bedDuck, roar * 0.12), 0, 0.22);

    const stand = (this.standActive ? 0.06 : 1) * (this.sfxMuted ? 0 : 1);
    // The duck SCALES the bed; it never replaces it. (As a separate layer it
    // wrote 0.92 over whatever the base had decided — which un-muted the
    // page bed for SFX OFF, and lifted it through the last stand's silence.)
    const ambience = (run ? (kill ? 0.20 : 0.92) : 0) * stand;
    const surface = (run ? (kill ? 0.03 : 0.95) : 0) * stand;
    if (live && duck > 0.001) {
      this._set(this.bus.ambience.gain, ambience * (1 - duck), 0.035);
      this._set(this.bus.surface.gain, surface * (1 - duck), 0.035);
    } else {
      this._set(this.bus.ambience.gain, ambience, 0.11);
      this._set(this.bus.surface.gain, surface, 0.08);
    }
    // RC-4 / playtest x3 ("the Redline is still loud"): the Redline family
    // (roar, scream, crackle, footfalls, the arrival strikes) sits well under
    // the mix. In play the bus TRACKS proximity — quiet at distance, still
    // rising as the pursuit closes so the approach keeps its meaning.
    if (live) this._set(this.bus.threat.gain, this.sfxMuted ? 0 : 0.55 + roar * 0.05, 0.045);
    else this._set(this.bus.threat.gain, this.sfxMuted ? 0 : (run ? (kill ? 0.20 : 0.55) : 0), 0.08);

    const beastPan = this._panFor(sim?.beast?.x ?? p.x);
    if (this.roar.pan) this._set(this.roar.pan.pan, beastPan, 0.05);
    this._set(this.roar.gain.gain, A.ROAR_MAX * roar * approved('beast') * trim('beast'), 0.045);
    if (!this.muted) this._set(this.master.gain, A.MASTER * trim('master'), 0.05);
    this._set(this.screamGain.gain, A.SCREAM_MAX * Math.pow(bands?.scream || 0, 2));

    // Far corruption, same intensity curve as the veil and the field — but
    // fired as crackle rather than held as a bed. A sustained hiss is wind; the
    // same noise in 25 ms bursts is interference, and it also gives the
    // approach a rhythm the sustained version never had.
    const gap = sim?.beast?.gap;
    const corr = run && !kill && gap != null ? corruptionIntensity(gap) : 0;
    if (corr > 0.02) {
      this._crackleT -= dt;
      if (this._crackleT <= 0) {
        // 0.5 s apart at the edge of perception down to ~55 ms at full pressure.
        this._crackleT = lerp(0.5, 0.055, corr * corr) * (0.6 + Math.random() * 0.8);
        this._burst(0.025 + Math.random() * 0.03, RC9.STATIC_FAR * corr * corr,
          4200 + Math.random() * 2600, 'highpass', beastPan * 0.5, this.bus.threat, 0.7);
      }
    } else this._crackleT = 0;

    if ((bands?.footfall || 0) > 0.01 && !kill) {
      const hz = lerp(A.FOOTFALL_HZ_FAR, A.FOOTFALL_HZ_NEAR, bands.footfall);
      this._footT -= dt;
      if (this._footT <= 0) {
        this._footT = 1 / hz;
        this._thump(A.FOOTFALL_MAX * bands.footfall, beastPan);
      }
    } else this._footT = 0;

    // The score bus carries the arrival thumps — FINISH (finishArrival) and a
    // dash ending on a climbed ladder (dashClimax). It used to be gated by the
    // Hunt mix, which has been 0 since the Hunt left in Phase 7, so neither
    // thump was ever heard. SCORE_BUS is a gentle level; tune it by ear.
    this._set(this.bus.score.gain, this.sfxMuted ? 0 : (kill ? 0.02 : A.SCORE_BUS), 0.06);

    // The page bed: procedural grain, page turns and ink blooms — the run's
    // atmosphere, built from the noise buffers (audio/page-bed.js).
    this._ensureAssets();
    if (!this.pageBed && this.noise) this.pageBed = new PageBed(this.ctx, this.bus.ambience, this.noise);
    const speedN = clamp((p.speed - 10) / (TUNING.RUN.CEILING - 10));
    this.pageBed.update(dt, { live: !!running && phase === 'running', speedN });
  }

  _tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.1, pan = 0, bus = this.bus.ui, delay = 0, filter = null }) {
    if (!this.ready || this.muted || this.sfxMuted) return;
    vol *= categoryGain(this._category);
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      f.Q.value = filter.q ?? 1;
      o.connect(f); node = f;
    }
    const p = this._panner(pan);
    node.connect(g);
    if (p) { g.connect(p); p.connect(bus); }
    else g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  _burst(dur, vol, freq, type = 'bandpass', pan = 0, bus = this.bus.surface, q = 1.1) {
    if (!this.ready || this.muted || this.sfxMuted) return;
    vol *= categoryGain(this._category);
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = type === 'highpass' ? this.white : this.noise;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this._panner(pan);
    s.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(bus); }
    else g.connect(bus);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.03);
  }

  _thump(vol, pan = 0, bus = this.bus.threat) {
    const threat = bus === this.bus.threat;
    // The recorded step is an ACCENT, not the cadence: at most one per 0.68 s
    // so a 1.2 s sample never stacks on every pursuit beat. The procedural
    // tick below stays the timing signal on every step.
    const assets = this.approvedAssets;
    if (threat && assets?.has('beast_main_step') && this.ctx.currentTime - this._lastStepSampleAt >= 0.68) {
      this._lastStepSampleAt = this.ctx.currentTime;
      assets.oneShot('beast_main_step', {
        bus: 'threat',
        gain: 0.28 * clamp(vol / Math.max(0.01, A.FOOTFALL_MAX)),
        pan,
      });
    }
    // The approach rhythm survives; the paw on snow becomes a data tick —
    // a hard square blip with a white-noise transient.
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.8), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    const p = this._panner(pan);
    o.connect(g);
    if (p) { g.connect(p); p.connect(bus); }
    else g.connect(bus);
    o.start(t); o.stop(t + 0.17);
    this._burst(0.07, vol * 0.35, 5200, 'highpass', pan, bus, 0.7);
    // A short low-mid body under the Redline's step, so it survives small
    // speakers without the step itself being turned up.
    if (threat && this.ready && !this.muted) {
      this._tone({ type: 'triangle', f0: 132, f1: 64, dur: 0.095, vol: Math.min(0.058, vol * 0.115), pan, bus });
      this._burst(0.065, Math.min(0.032, vol * 0.058), 1180, 'bandpass', pan, bus, 0.85);
    }
  }

  // Phase 31: takeoff, the three landings and the stunt shove are gone. They
  // are DESCENT's jump-and-land vocabulary, and no source in this game emits
  // takeoff, land_clean, land_bump, land_flub or stunt_escape — the jump verb
  // left in Phase 7. Proven dead by exhaustion, not by reading.

  hit() {
    this._burst(0.30, 0.43, 470, 'lowpass', 0, this.bus.surface);
    this._tone({ type: 'square', f0: 142, f1: 42, dur: 0.27, vol: 0.16, bus: this.bus.surface });
  }

  /**
   * The correct-read chime climbs a pentatonic ladder with the chain
   * (Phase 9): a streak becomes an ascending melody, and losing the chain
   * audibly resets the ladder. Bright = up = flow.
   */
  /**
   * A correct read. `early` is 0 at the gate line and 1 the instant the word
   * armed — Phase B's answer is audible rather than written: the attack gets
   * harder and a bright partial opens above it. A late read is byte for byte
   * the confirmation this game has always made.
   */
  gate(chain = 0, early = 0, dashChain = 0) {
    // Phase I: each dash-chain rung climbs the pentatonic ladder one more
    // step — the same melody, higher, for exactly as long as the chain holds.
    // RC8.3: the rung cap is the LADDER's length, not a literal 4. A sixth
    // rung that sounded identical to the fifth would be a rung the ear could
    // not hear, which is the one thing this cue exists to do.
    // RC10.9: the table, the root and the cap moved to audio/ladder.js, where
    // the bell string reads the same ones. The pitches here are unchanged.
    const c = chimeStep(chain, dashChain);
    const e = Math.max(0, Math.min(1, early));
    const f0 = ladderHz(c);
    this._tone({ f0, f1: f0 * 1.5, dur: 0.13 - 0.03 * e, vol: 0.10 + 0.045 * e, bus: this.bus.ui });
    if (c >= 5) this._tone({ type: 'sine', f0: f0 * 2, f1: f0 * 2.02, dur: 0.1, vol: 0.035, bus: this.bus.ui, delay: 0.01 });
    if (e > 0.35) {
      this._tone({ type: 'sine', f0: f0 * 3, f1: f0 * 3.01, dur: 0.09 + 0.05 * e,
        vol: 0.020 * e, bus: this.bus.ui, delay: 0.006 });
    }
    // N1: the typeset strike — one short mechanical percussive under the
    // melodic confirmation, the word being STAMPED into the page. Harder the
    // earlier the read; it is what makes a correct answer feel like impact.
    this._burst(0.035, 0.055 + 0.05 * e, 5200, 'highpass', 0, this.bus.ui, 0.8);
  }

  /**
   * A word resolved in SILENCE (a fake let by). The quiet page-settle —
   * one soft low tick, deliberately unlike the gate melody, so a word the
   * player never touched never sounds selected.
   */
  wordPass() {
    this._tone({ type: 'sine', f0: 340, f1: 296, dur: 0.07, vol: 0.035, bus: this.bus.ui });
  }

  /**
   * N1: a pre-arm answer was buffered. A tiny dry tick, panned to the side
   * the player pressed — acknowledgment, never fanfare: the read has not
   * paid yet, and the sound must not suggest it has.
   */
  wordHeld(real) {
    this._tone({ type: 'triangle', f0: real ? 1180 : 840, f1: real ? 1180 : 840,
      dur: 0.045, vol: 0.045, pan: real ? 0.3 : -0.3, bus: this.bus.ui });
  }

  /**
   * The last stand opens. Everything else falls away and one tone is held —
   * low, unwavering, and long enough to outlast the word. It is the only
   * sound in the game that does not decay on its own.
   */
  lastStand() {
    this.standActive = true;
    if (!this.ready || this.muted || this.sfxMuted) return;
    this._tone({ type: 'sine', f0: 116, f1: 116, dur: 6.0, vol: 0.085, bus: this.bus.cinematic });
    this._tone({ type: 'sine', f0: 232.5, f1: 232.5, dur: 6.0, vol: 0.030, bus: this.bus.cinematic, delay: 0.02 });
  }

  /** The stand resolves. Held, the world comes back up with it. */
  lastStandEnd(held) {
    this.standActive = false;
    if (!this.ready || this.muted || this.sfxMuted) return;
    if (held) {
      this._tone({ type: 'triangle', f0: 232, f1: 928, dur: 0.5, vol: 0.11, bus: this.bus.cinematic });
      this._burst(0.45, 0.16, 2600, 'bandpass', 0, this.bus.ambience);
    }
  }

  /** The drain: the whole mix darkens for a beat, then the light returns. */
  duck() {
    if (!this.ready) return;
    const f = this.duckFilter.frequency;
    const now = this.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(460, now);
    f.setTargetAtTime(19500, now + 0.14, 0.22);
  }

  // A missed real word: deflation, not a crash. Softer and shorter than
  // hit() with none of its impact burst — the rulebook asymmetry, audible.
  slip() { this._tone({ type: 'triangle', f0: 420, f1: 210, dur: 0.22, vol: 0.09, bus: this.bus.ui }); }

  /**
   * A bell in a lit string. RC10.9: `step` is a position on the SAME ladder
   * the correct-read chime climbs, handed in by the caller from the chain
   * (see audio/ladder.js `stringStep`). It used to be `bellsCollected % 5` on
   * a table of its own, rooted a semitone below the chime — two pentatonic
   * ladders in two keys, one of them keyed to distance. The timbre is still
   * the bell's; only the pitches now belong to the melody the chime started.
   */
  bell(step = 0) {
    const prev = this._category;
    this._category = 'bells';
    try { this._bellVoice(step); }
    finally { this._category = prev; }
    // The bell's top: a fifth above the struck note and a dry air tick. It
    // sits OUTSIDE the bell fader — it was tuned by ear at release level.
    if (this.ready && !this.muted) {
      const f = ladderHz(step);
      this._tone({ type: 'sine', f0: f * 1.5, f1: f * 1.505, dur: 0.15, vol: 0.028, bus: this.bus.ui });
      this._burst(0.055, 0.020, 4200, 'highpass', 0, this.bus.ui, 0.7);
    }
  }

  _bellVoice(step) {
    const f = ladderHz(step);
    this._tone({ type: 'sine', f0: f, f1: f * 1.004, dur: 0.34, vol: 0.075, bus: this.bus.ui });
    this._tone({ type: 'triangle', f0: f * 2.01, f1: f * 2.02, dur: 0.18, vol: 0.025, bus: this.bus.ui, delay: 0.006 });
    if ((step % STRING_RUNGS) === STRING_RUNGS - 1) this._tone({ type: 'sine', f0: f * 0.5, f1: f * 0.5, dur: 0.44, vol: 0.035, bus: this.bus.ui, delay: 0.025 });
    // RC10.1: the bright acoustic-looking partials that let a bell carry over
    // the beds. They lived in a runtime patch of this method — the patch and
    // the method disagreed about the interval table, which is exactly the
    // drift a wrapper invites — so they are simply part of the bell now, and
    // the one table above is the only one.
    this._tone({ type: 'sine', f0: f * 2.02, f1: f * 2.015, dur: 0.21, vol: 0.038, bus: this.bus.ui });
    this._tone({ type: 'triangle', f0: f * 3.01, f1: f * 2.98, dur: 0.105, vol: 0.014, bus: this.bus.ui, delay: 0.006 });
    // Presence on phone speakers: the struck note reinforced with a short
    // upper partial, then a quiet sustain under it. These four voices used to
    // live in three runtime patches of this method, each keeping a private
    // copy of the pre-RC10.9 interval table — so they sang a different
    // pentatonic from the bell they were reinforcing. They read the ladder now.
    if (this.ready && !this.muted) {
      this._tone({ type: 'sine', f0: f, f1: f * 1.002, dur: 0.22, vol: 0.030, bus: this.bus.ui });
      this._tone({ type: 'triangle', f0: f * 3.01, f1: f * 3.02, dur: 0.11, vol: 0.016, bus: this.bus.ui, delay: 0.004 });
    }
    this._bedDuck = Math.max(this._bedDuck, 0.10);
    this._bedDuckHold = Math.max(this._bedDuckHold, 0.28);
    if (this.ready && !this.muted) {
      this._tone({ type: 'sine', f0: f, f1: f * 1.003, dur: 0.30, vol: 0.011, bus: this.bus.ui });
      this._tone({ type: 'triangle', f0: f * 2.02, f1: f * 2.01, dur: 0.15, vol: 0.007, bus: this.bus.ui, delay: 0.004 });
    }
  }

  heartLost() {
    this._tone({ type: 'triangle', f0: 148, f1: 92, dur: 0.26, vol: 0.11, bus: this.bus.ui });
    this._burst(0.18, 0.08, 520, 'lowpass', 0, this.bus.ui);
  }

  heartRestore() {
    for (const [f, delay, vol] of [[523.25, 0, 0.055], [659.25, 0.06, 0.055], [880, 0.12, 0.07]]) {
      this._tone({ f0: f, f1: f * 1.01, dur: 0.28, vol, delay, bus: this.bus.ui });
    }
  }

  // ── Punctuation beats (Phase E2): discrete arrivals inside the continuous
  // systems. Sounds, never labels; every visual half of a beat lives with
  // its consumer and is REDUCED FLASH-safe there — sound is always kept.

  /** A big chain dies. Not the ordinary chainLost tick: one hard fall and a
   *  low exhale, sized to what was standing. Loss stays darkness. */
  chainBreak(chain = 0) {
    const big = Math.min(1, chain / 100);
    this._tone({ type: 'square', f0: 220, f1: 55, dur: 0.34 + big * 0.2, vol: 0.12 + big * 0.06,
      bus: this.bus.cinematic, filter: { type: 'lowpass', freq: 900, q: 1 } });
    this._burst(0.3 + big * 0.2, 0.1, 700, 'lowpass', 0, this.bus.ambience);
  }

  /** The world sets another layer: a low arrival note, rising by band. */
  bandRise(band = 1) {
    const f = 155.56 * Math.pow(2, [0, 0, 3, 5, 7][Math.min(band, 4)] / 12);
    this._tone({ type: 'sine', f0: f, f1: f, dur: 0.9, vol: 0.075, bus: this.bus.cinematic });
    this._tone({ type: 'triangle', f0: f * 2, f1: f * 2.01, dur: 0.5, vol: 0.035,
      bus: this.bus.cinematic, delay: 0.05 });
  }

  /** Real daylight opened from inside the scream range: the release. */
  redlineRelease() {
    this._tone({ type: 'sine', f0: 233, f1: 466, dur: 0.7, vol: 0.08, bus: this.bus.cinematic });
    this._burst(0.5, 0.09, 3200, 'highpass', 0, this.bus.ambience);
  }

  // ── Bookends (Phase N4): the run's opening beat and the route's arrival.

  /** The launch: the first word typesets in the dark, the road draws
   *  forward, the Redline arrives. Three scheduled sounds, one beat. */
  launch(quick = false) {
    // Re-sequenced with the visual: the cut to black (a soft tick), the
    // storm's strikes ON the black, then the rising breath as the road
    // draws the world in. Strikes stay at their turned-down level.
    // PD-2: a retry's quick cut gets the tick and ONE strike, nothing more.
    this._burst(0.04, 0.05, 5200, 'highpass', 0, this.bus.ui, 0.8);
    if (quick) {
      this._tone({ type: 'square', f0: 320, f1: 90, dur: 0.2, vol: 0.018,
        bus: this.bus.threat, delay: 0.26,
        filter: { type: 'bandpass', freq: 1100, q: 3 } });
      return;
    }
    this._tone({ type: 'square', f0: 320, f1: 90, dur: 0.26, vol: 0.020,
      bus: this.bus.threat, delay: 0.9,
      filter: { type: 'bandpass', freq: 1100, q: 3 } });
    this._tone({ type: 'square', f0: 420, f1: 140, dur: 0.14, vol: 0.011,
      bus: this.bus.threat, delay: 1.0,
      filter: { type: 'bandpass', freq: 1400, q: 3 } });
    this._tone({ type: 'square', f0: 520, f1: 180, dur: 0.12, vol: 0.009,
      bus: this.bus.threat, delay: 1.1,
      filter: { type: 'bandpass', freq: 1700, q: 3 } });
    this._tone({ type: 'sine', f0: 88, f1: 132, dur: 0.9, vol: 0.055,
      bus: this.bus.cinematic, delay: 1.5 });
  }

  /** The hundredth gate: reaching the route's end is an ARRIVAL — one
   *  full rising breath and a floor thump, bigger than the release. */
  finishArrival() {
    this._tone({ type: 'sine', f0: 233, f1: 466, dur: 0.95, vol: 0.09, bus: this.bus.cinematic });
    this._tone({ type: 'triangle', f0: 466, f1: 932, dur: 0.6, vol: 0.04,
      bus: this.bus.cinematic, delay: 0.12 });
    this._thump(0.24, 0, this.bus.score);
  }

  /** A dash ends on a climbed ladder: the endpoint hit, sized to the rung. */
  dashClimax(rung = 0) {
    const e = Math.min(1, rung / 4);
    this._tone({ type: 'sine', f0: 311 * (1 + e * 0.5), f1: 933, dur: 0.4 + 0.2 * e,
      vol: 0.1 + 0.06 * e, bus: this.bus.cinematic });
    this._thump(0.2 + 0.18 * e, 0, this.bus.score);
  }

  /**
   * The DASH (Phase 16) — its own sound, not the shove it used to borrow.
   *
   * Three parts, deliberately front-loaded so the transient lands on the
   * exact frame the camera punches: a hard low thump for the shove in the
   * back, a fast upward sweep that keeps rising after the thump has gone,
   * and a bright air burst over the top. The old cue was a single mid
   * sawtooth that read as "something changed" rather than "you launched".
   */
  dash() {
    if (!this.ready || this.muted || this.sfxMuted) return;
    const bus = this.bus.ambience;
    this._thump(0.34, 0, bus);
    this._tone({ type: 'sawtooth', f0: 180, f1: 1450, dur: 0.46, vol: 0.15, bus,
      filter: { type: 'lowpass', freq: 2400, q: 4.5 } });
    this._tone({ type: 'triangle', f0: 620, f1: 2400, dur: 0.30, vol: 0.075, bus });
    this._burst(0.36, 0.17, 3400, 'bandpass', 0, bus, 1.6);
    this._burst(0.5, 0.06, 7200, 'highpass', 0, bus, 0.7);
  }

  overdriveOn() {
    this._tone({ type: 'sawtooth', f0: 145, f1: 920, dur: 0.38, vol: 0.13, bus: this.bus.ambience, filter: { type: 'lowpass', freq: 1700, q: 3 } });
    this._burst(0.42, 0.14, 2500, 'bandpass', 0, this.bus.ambience);
  }

  /** The dash reaching full charge — the one moment the meter earns a sound. */
  dashReady() {
    if (!this.ready || this.muted || this.sfxMuted) return;
    this._tone({ type: 'triangle', f0: 740, f1: 1480, dur: 0.16, vol: 0.075, bus: this.bus.ui });
    this._tone({ type: 'sine', f0: 1480, f1: 1490, dur: 0.30, vol: 0.045, bus: this.bus.ui, delay: 0.05 });
    this._burst(0.16, 0.055, 5200, 'highpass', 0, this.bus.ui);
  }

  overdriveOff() { this._tone({ type: 'triangle', f0: 520, f1: 140, dur: 0.28, vol: 0.065, bus: this.bus.ambience }); }

  // One pursuer, so one death sound. The second-pursuer branch that used to
  // live here went with the character it belonged to; `killSource` has only
  // ever been 'main' since.
  kill() {
    if (!this.ready || this.muted || this.sfxMuted) return;
    {
      // Signal death: a full-band static crush collapsing into a power-down.
      this._burst(0.85, 0.5, 2400, 'bandpass', 0, this.bus.cinematic, 0.8);
      this._burst(0.6, 0.3, 6400, 'highpass', 0, this.bus.cinematic, 0.6);
      this._tone({ type: 'sawtooth', f0: 780, f1: 32, dur: 1.05, vol: 0.24, bus: this.bus.cinematic, filter: { type: 'lowpass', freq: 1500, q: 1.4 } });
      this._thump(0.3, 0, this.bus.cinematic);
    }
  }

  uiTap() { this._tone({ f0: 660, f1: 990, dur: 0.08, vol: 0.07, bus: this.bus.ui }); }



  courageBank(mult) {
    if (!this.ready || this.muted || this.sfxMuted) return;
    const k = clamp((mult - 1) / Math.max(0.01, TUNING.BOOST.PROX_MAX_MULT - 1));
    this._tone({ type: 'triangle', f0: 520, f1: 1180, dur: 0.30, vol: 0.055 + 0.07 * k, bus: this.bus.ui });
    this._tone({ type: 'triangle', f0: 780, f1: 1770, dur: 0.27, vol: 0.045 + 0.055 * k, bus: this.bus.ui, delay: 0.012 });
  }

  chainLink(n) {
    const step = Math.min(n, TUNING.BOOST.CHAIN_CAP);
    const f = 440 * Math.pow(2, step / 12);
    this._tone({ f0: f, f1: f * 1.45, dur: 0.12, vol: 0.075, bus: this.bus.ui });
  }

  chainLost() { this._tone({ type: 'triangle', f0: 500, f1: 125, dur: 0.40, vol: 0.10, bus: this.bus.ui }); }

  /**
   * A word retired — the one sound in the game that means "you got better,
   * specifically, at something you were bad at" (Phase 1). It is deliberately
   * NOT a louder gate() chime: a full major arpeggio that rings up and OPENS at
   * the top into a sustained fifth and a bright shimmer, so it reads as arrival
   * rather than as one more correct read. Distinct from heartRestore's three
   * rising blips (different intervals, a held chord, and the shimmer tail).
   */
  wordRetired() {
    if (!this.ready || this.muted || this.sfxMuted) return;
    const root = 523.25; // C5
    // I – III – V – VIII, climbing, each landing a beat after the last.
    const arp = [[1, 0], [1.26, 0.05], [1.5, 0.10], [2, 0.16]];
    for (const [mult, delay] of arp) {
      this._tone({ type: 'triangle', f0: root * mult, f1: root * mult * 1.005,
        dur: 0.26, vol: 0.075, bus: this.bus.ui, delay });
    }
    // The top opens: a held octave+fifth and a shimmer that outlasts the arp.
    this._tone({ type: 'sine', f0: root * 2, f1: root * 2.01, dur: 0.7, vol: 0.06,
      bus: this.bus.ui, delay: 0.16 });
    this._tone({ type: 'sine', f0: root * 3, f1: root * 3.02, dur: 0.6, vol: 0.03,
      bus: this.bus.ui, delay: 0.2 });
    this._burst(0.5, 0.05, 6400, 'highpass', 0, this.bus.ui, 0.7);
  }

}
