/**
 * WORD RUN audio identity (RC9 graph, Phase 4 timbres).
 * One shared Web Audio graph drives running, stream ambience, bells, GO,
 * Hunts and both threat presentations. The creature growls are gone: every
 * threat cue is now signal-noise — static beds, interference whine, glitch
 * ticks — driven by the SAME band curves and gap value the beast cues used.
 */

import TUNING from '../TUNING.js';
import { corruptionIntensity } from '../render/corruption-curve.js';

const A = TUNING.AUDIO;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

const RC9 = {
  AIR_WIND: 0.34,
  GLIDE: 0.12,
  POWDER: 0.24,
  ICE: 0.20,
  GO_RUSH: 0.24,
  HUNT_DRONE: 0.18,
  HUNT_BPM: [104, 126],
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
    this.surfaceMode = 'snow';
    this._footT = 0;
    this._huntBeatT = 0;
    this._huntBeat = 0;
    this._huntMix = 0;
    this._lastHunt = false;
    globalThis.__AUDIO = this;
  }

  /**
   * Resume from a user gesture. The node graph itself is built by
   * prewarm() — construction is allowed before any gesture (the context
   * just starts suspended), only resume() needs the tap. Building the
   * ~40 node graph and two noise buffers used to happen ON the DROP IN
   * tap and was one of the three run-start stutter sources (Phase 8).
   */
  start() {
    this.prewarm();
    if (this.ready && this.ctx.state === 'suspended') this.ctx.resume();
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
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.bus = {
      ambience: this._bus(0.92),
      surface: this._bus(0.95),
      threat: this._bus(0.92),
      score: this._bus(0),
      ui: this._bus(0.82),
      cinematic: this._bus(1),
    };

    this.noise = noiseBuffer(ctx, 2, 0.72);
    this.white = noiseBuffer(ctx, 1, 0.18);

    this.wind = this._noiseVoice(720, 'bandpass', 0.8, this.bus.ambience);
    this.air = this._noiseVoice(2350, 'highpass', 0.55, this.bus.ambience);
    this.snow = this._noiseVoice(1800, 'bandpass', 2.7, this.bus.surface);
    this.powder = this._noiseVoice(620, 'lowpass', 0.7, this.bus.surface);
    this.ice = this._noiseVoice(3900, 'bandpass', 5.2, this.bus.surface);
    this.goRush = this._noiseVoice(2800, 'bandpass', 1.1, this.bus.ambience);
    // "roar" keeps its name and its band curve; its body is now interference —
    // white noise through a wandering bandpass instead of a low growl.
    this.roar = this._noiseVoice(1650, 'bandpass', 0.9, this.bus.threat, 0, this.white);
    this.staticFar = this._noiseVoice(5200, 'highpass', 0.5, this.bus.threat, 0, this.white);

    this.roarLfo = ctx.createOscillator();
    this.roarLfoGain = ctx.createGain();
    this.roarLfo.frequency.value = 0.9;
    this.roarLfoGain.gain.value = 620;
    this.roarLfo.connect(this.roarLfoGain);
    this.roarLfoGain.connect(this.roar.filter.frequency);
    this.roarLfo.start();

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

    this.huntDrone = ctx.createGain();
    this.huntDrone.gain.value = RC9.HUNT_DRONE;
    this.huntDrone.connect(this.bus.score);
    for (const [f, type, gain] of [[55, 'sine', 0.11], [82.4, 'triangle', 0.045], [110, 'sine', 0.025]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.value = gain;
      o.connect(g); g.connect(this.huntDrone);
      o.start();
    }

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

    this._set(this.bus.ambience.gain, run ? (kill ? 0.20 : 0.92) : 0, 0.11);
    this._set(this.bus.surface.gain, run ? (kill ? 0.03 : 0.95) : 0, 0.08);
    this._set(this.bus.threat.gain, run ? (kill ? 0.30 : 0.92) : 0, 0.08);

    const speedN = clamp((p.speed - 7) / 30);
    const edge = p.airborne ? 0 : clamp(Math.abs(p.heading) / TUNING.PLAYER.MAX_CARVE);
    const airborne = !!p.airborne;
    const onIce = !airborne && !!p.onIce;
    const inPowder = !airborne && !!p.inPowder;
    const onSnow = !airborne && !onIce && !inPowder;
    this.surfaceMode = onIce ? 'ice' : inPowder ? 'powder' : airborne ? 'air' : 'snow';

    this._set(this.wind.gain.gain, A.WIND_MAX * speedN * speedN * (airborne ? 1.18 : 0.82));
    this._set(this.wind.filter.frequency, 460 + speedN * 1040 + (airborne ? 260 : 0));
    this._set(this.air.gain.gain, airborne ? RC9.AIR_WIND * (0.32 + speedN * 0.68) : 0, 0.05);
    this._set(this.air.filter.frequency, 1600 + speedN * 3200, 0.05);

    const glide = RC9.GLIDE * (0.32 + speedN * 0.68);
    this._set(this.snow.gain.gain, onSnow ? glide * (0.48 + edge * 1.35) : 0, 0.045);
    this._set(this.snow.filter.frequency, 1180 + speedN * 1050 + edge * 1900, 0.04);
    this._set(this.powder.gain.gain, inPowder ? RC9.POWDER * (0.48 + speedN * 0.52) * (0.72 + edge * 0.28) : 0, 0.06);
    this._set(this.powder.filter.frequency, 430 + speedN * 560, 0.05);
    this._set(this.ice.gain.gain, onIce ? RC9.ICE * (0.42 + speedN * 0.38 + edge * 0.74) : 0, 0.035);
    this._set(this.ice.filter.frequency, 2700 + speedN * 1700 + edge * 1250, 0.035);

    const go = p.overdrive ? 1 : 0;
    this._set(this.goRush.gain.gain, go * RC9.GO_RUSH * (0.55 + speedN * 0.45), 0.06);
    this._set(this.goRush.filter.frequency, 1800 + speedN * 2500, 0.05);

    const beastPan = this._panFor(sim?.beast?.x ?? p.x);
    if (this.roar.pan) this._set(this.roar.pan.pan, beastPan, 0.05);
    this._set(this.roar.gain.gain, A.ROAR_MAX * (bands?.roar || 0));
    this._set(this.screamGain.gain, A.SCREAM_MAX * Math.pow(bands?.scream || 0, 2));

    // Far corruption bed, same intensity curve as the veil and the field.
    const gap = sim?.beast?.gap;
    const corr = run && !kill && gap != null ? corruptionIntensity(gap) : 0;
    this._set(this.staticFar.gain.gain, RC9.STATIC_FAR * corr * corr, 0.12);
    if (this.staticFar.pan) this._set(this.staticFar.pan.pan, beastPan * 0.5, 0.1);

    if ((bands?.footfall || 0) > 0.01 && !kill) {
      const hz = lerp(A.FOOTFALL_HZ_FAR, A.FOOTFALL_HZ_NEAR, bands.footfall);
      this._footT -= dt;
      if (this._footT <= 0) {
        this._footT = 1 / hz;
        this._thump(A.FOOTFALL_MAX * bands.footfall, beastPan);
      }
    } else this._footT = 0;

    const hunting = !!(sim && sim.beast?.mode === 'hunt' && phase === 'running');
    const target = hunting ? 1 : 0;
    this._huntMix += (target - this._huntMix) * (1 - Math.exp(-dt * (hunting ? 4.8 : 2.8)));
    this._set(this.bus.score.gain, kill ? 0.02 : this._huntMix, 0.06);

    if (hunting && run && !kill) {
      const depth = clamp(p.d / 18000);
      const urgency = clamp(bands?.footfall || 0);
      const bpm = lerp(RC9.HUNT_BPM[0], RC9.HUNT_BPM[1], depth * 0.72 + urgency * 0.28);
      this._huntBeatT -= dt;
      if (this._huntBeatT <= 0) {
        this._huntBeatT += 60 / bpm;
        this._huntPulse((this._huntBeat++ % 4) === 0, beastPan);
      }
    } else if (!hunting && this._lastHunt) {
      this._huntBeatT = 0;
      this._huntBeat = 0;
    }
    this._lastHunt = hunting;
  }

  _tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.1, pan = 0, bus = this.bus.ui, delay = 0, filter = null }) {
    if (!this.ready || this.muted) return;
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
    if (!this.ready || this.muted) return;
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
  }

  _huntPulse(accent, pan = 0) {
    this._tone({ type: 'sine', f0: accent ? 66 : 78, f1: 38, dur: 0.22, vol: accent ? 0.17 : 0.09, pan: pan * 0.18, bus: this.bus.score });
    if (accent) this._burst(0.12, 0.055, 2400, 'highpass', 0, this.bus.score, 0.7);
  }

  takeoff() {
    this._burst(0.20, 0.18, 2700, 'bandpass', 0, this.bus.surface);
    this._burst(0.34, 0.10, 4200, 'highpass', 0, this.bus.ambience);
  }

  landClean() {
    const ice = this.surfaceMode === 'ice';
    this._burst(0.24, ice ? 0.22 : 0.36, ice ? 2100 : 760, ice ? 'bandpass' : 'lowpass', 0, this.bus.surface);
    this._tone({ type: 'triangle', f0: ice ? 690 : 430, f1: ice ? 940 : 650, dur: 0.13, vol: 0.06, bus: this.bus.surface });
  }

  landBump() { this._burst(0.11, 0.14, 660, 'lowpass', 0, this.bus.surface); }
  landFlub() {
    this._burst(0.38, 0.42, 330, 'lowpass', 0, this.bus.surface);
    this._tone({ type: 'sawtooth', f0: 170, f1: 48, dur: 0.34, vol: 0.12, bus: this.bus.surface });
  }

  hit() {
    this._burst(0.30, 0.43, 470, 'lowpass', 0, this.bus.surface);
    this._tone({ type: 'square', f0: 142, f1: 42, dur: 0.27, vol: 0.16, bus: this.bus.surface });
  }

  gate() { this._tone({ f0: 880, f1: 1320, dur: 0.13, vol: 0.10, bus: this.bus.ui }); }

  // A missed real word: deflation, not a crash. Softer and shorter than
  // hit() with none of its impact burst — the rulebook asymmetry, audible.
  slip() { this._tone({ type: 'triangle', f0: 420, f1: 210, dur: 0.22, vol: 0.09, bus: this.bus.ui }); }

  bell(step = 0) {
    const intervals = [0, 4, 7, 11, 14];
    const semis = intervals[step % intervals.length];
    const f = 622.25 * Math.pow(2, semis / 12);
    this._tone({ type: 'sine', f0: f, f1: f * 1.004, dur: 0.34, vol: 0.075, bus: this.bus.ui });
    this._tone({ type: 'triangle', f0: f * 2.01, f1: f * 2.02, dur: 0.18, vol: 0.025, bus: this.bus.ui, delay: 0.006 });
    if (step === 4) this._tone({ type: 'sine', f0: f * 0.5, f1: f * 0.5, dur: 0.44, vol: 0.035, bus: this.bus.ui, delay: 0.025 });
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

  huntStart(side = 0, kind = 'rear') {
    const pan = clamp(side * 0.75, -1, 1);
    this._tone({ type: 'square', f0: side < 0 ? 340 : side > 0 ? 390 : 365, f1: 96, dur: 0.42, vol: 0.075, pan, bus: this.bus.threat, filter: { type: 'bandpass', freq: 1100, q: 3 } });
    this._burst(0.34, 0.12, 4200, 'highpass', pan, this.bus.threat, 0.7);
    this._thump(0.16, pan * 0.35, this.bus.threat);
    if (kind === 'leap') this._tone({ type: 'triangle', f0: 620, f1: 1450, dur: 0.30, vol: 0.05, pan, bus: this.bus.threat, delay: 0.08 });
    this._huntBeatT = 0;
  }

  huntEnd() {
    this._tone({ type: 'triangle', f0: 330, f1: 495, dur: 0.28, vol: 0.035, bus: this.bus.score });
    this._tone({ f0: 165, f1: 110, dur: 0.42, vol: 0.025, bus: this.bus.score, delay: 0.03 });
  }

  secondBeastEnter(side = 0, kind = 'diagonal') {
    const pan = clamp(side * 0.9, -1, 1);
    this._burst(0.42, 0.17, 4300, 'highpass', pan, this.bus.threat, 2.4);
    this._tone({ type: 'triangle', f0: kind === 'vault' ? 780 : 620, f1: 205, dur: 0.72, vol: 0.09, pan, bus: this.bus.threat, filter: { type: 'bandpass', freq: 1250, q: 4 } });
    this._tone({ type: 'sine', f0: 94, f1: 52, dur: 0.64, vol: 0.085, pan, bus: this.bus.threat, delay: 0.06 });
  }

  secondBeastCharge(side = 0, kind = 'diagonal') {
    const pan = clamp(side * 0.95, -1, 1);
    this._burst(kind === 'vault' ? 0.62 : 0.48, 0.24, 3200, 'bandpass', pan, this.bus.threat, 1.8);
    this._tone({ type: 'sawtooth', f0: kind === 'vault' ? 180 : 140, f1: kind === 'vault' ? 620 : 84, dur: 0.55, vol: 0.065, pan, bus: this.bus.threat, filter: { type: 'lowpass', freq: 1200, q: 2 } });
  }

  overdriveOn() {
    this._tone({ type: 'sawtooth', f0: 145, f1: 920, dur: 0.38, vol: 0.13, bus: this.bus.ambience, filter: { type: 'lowpass', freq: 1700, q: 3 } });
    this._burst(0.42, 0.14, 2500, 'bandpass', 0, this.bus.ambience);
  }

  overdriveOff() { this._tone({ type: 'triangle', f0: 520, f1: 140, dur: 0.28, vol: 0.065, bus: this.bus.ambience }); }

  kill(source = globalThis.__SIM?.killSource || 'main') {
    if (!this.ready || this.muted) return;
    if (source === 'second') {
      this._burst(0.82, 0.46, 3200, 'bandpass', 0, this.bus.cinematic, 2.6);
      this._tone({ type: 'triangle', f0: 720, f1: 82, dur: 0.92, vol: 0.20, bus: this.bus.cinematic });
      this._thump(0.30, 0, this.bus.cinematic);
    } else {
      // Signal death: a full-band static crush collapsing into a power-down.
      this._burst(0.85, 0.5, 2400, 'bandpass', 0, this.bus.cinematic, 0.8);
      this._burst(0.6, 0.3, 6400, 'highpass', 0, this.bus.cinematic, 0.6);
      this._tone({ type: 'sawtooth', f0: 780, f1: 32, dur: 1.05, vol: 0.24, bus: this.bus.cinematic, filter: { type: 'lowpass', freq: 1500, q: 1.4 } });
      this._thump(0.3, 0, this.bus.cinematic);
    }
  }

  uiTap() { this._tone({ f0: 660, f1: 990, dur: 0.08, vol: 0.07, bus: this.bus.ui }); }

  lungeTell() {
    if (!this.ready || this.muted) return;
    const pan = this._panFor(globalThis.__SIM?.beast?.x ?? 0);
    const dur = TUNING.BEAST.LUNGE_TELL;
    // The wind-up you get to react to: a static swell sweeping upward.
    this._tone({ type: 'sawtooth', f0: 160, f1: 1350, dur, vol: 0.13, pan, bus: this.bus.threat, filter: { type: 'bandpass', freq: 1900, q: 3 } });
    this._burst(dur * 0.85, 0.16, 3400, 'highpass', pan, this.bus.threat, 0.8);
  }

  lungeStrike() {
    const pan = this._panFor(globalThis.__SIM?.beast?.x ?? 0);
    this._burst(0.30, 0.46, 2600, 'bandpass', pan, this.bus.threat, 1.6);
    this._tone({ type: 'square', f0: 640, f1: 52, dur: 0.26, vol: 0.16, pan, bus: this.bus.threat });
  }

  courageBank(mult) {
    if (!this.ready || this.muted) return;
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

  shove() {
    this._burst(0.50, 0.19, 2400, 'bandpass', 0, this.bus.ambience);
    this._tone({ type: 'sawtooth', f0: 230, f1: 980, dur: 0.40, vol: 0.09, bus: this.bus.ambience, filter: { type: 'lowpass', freq: 1900, q: 2 } });
  }
}
