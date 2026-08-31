import TUNING from './TUNING.js';
import { Audio } from './audio/audio.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const SURFACE_GLIDE = 0.075;

// Final V1 mix: the isolated playtest showed the continuous surface-glide
// voice, not the wind, was doing most of the masking. Restore some atmospheric
// air while pulling the glide bed down more decisively. These are presentation-
// only values; the hidden ?mix=1 calibration panel can trim them live in dB.
TUNING.AUDIO.ROAR_MAX = 0.35;

function requestBedDuck(audio, depth = 0.08, hold = 0.22) {
  audio.__v1BedDuck = Math.max(audio.__v1BedDuck || 0, depth);
  audio.__v1BedDuckHold = Math.max(audio.__v1BedDuckHold || 0, hold);
}

if (!Audio.prototype.__v1FinalPriorityMix) {
  Audio.prototype.__v1FinalPriorityMix = true;

  const baseUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateV1FinalMix(dt, player, bands, running) {
    const out = baseUpdate.call(this, dt, player, bands, running);
    if (!this.ready || !this.ctx || !player) return out;

    const sim = globalThis.__SIM;
    const phase = sim?.phase;
    const kill = phase === 'kill' || phase === 'dead';
    const live = !!running && !kill;
    const speedN = clamp((player.speed - 10) / (TUNING.RUN.CEILING - 10));
    const edge = player.airborne ? 0 : clamp(Math.abs(player.heading) / TUNING.PLAYER.MAX_CARVE);
    const onGround = live && !player.airborne && !player.onIce && !player.inPowder;

    // The continuous glide bed was the masking layer on phone speakers. Keep all of
    // its speed/carve expression, but lower the actual continuous ceiling by
    // ~29% from the previous V1 mix (and ~38% from the original RC9 glide).
    if (this.glide?.gain?.gain) {
      const glide = SURFACE_GLIDE * (0.32 + speedN * 0.68);
      this._set(this.glide.gain.gain, onGround ? glide * (0.48 + edge * 1.35) : 0, 0.045);
    }

    // Short priority ducking lets bells / heartbeat / roars read without making
    // the entire mix louder. It recovers inside the existing Audio.update path.
    if ((this.__v1BedDuckHold || 0) > 0) {
      this.__v1BedDuckHold = Math.max(0, this.__v1BedDuckHold - dt);
    } else if ((this.__v1BedDuck || 0) > 0) {
      this.__v1BedDuck *= Math.exp(-dt * 8.5);
      if (this.__v1BedDuck < 0.002) this.__v1BedDuck = 0;
    }

    const roar = clamp(bands?.roar || 0);
    const hunting = !!(sim?.beast?.mode === 'hunt' && phase === 'running');
    const priorityDuck = clamp(Math.max(this.__v1BedDuck || 0, roar * 0.12, hunting ? 0.03 : 0), 0, 0.22);

    if (live && priorityDuck > 0.001) {
      this._set(this.bus.ambience.gain, 0.92 * (1 - priorityDuck), 0.035);
      this._set(this.bus.surface.gain, 0.95 * (1 - priorityDuck), 0.035);
    }

    // Slight threat-bus lift, rising with actual roar proximity rather than
    // permanently boosting every danger sound.
    if (live && this.bus?.threat) {
      this._set(this.bus.threat.gain, 0.94 + roar * 0.055, 0.045);
    }

    return out;
  };

  const baseBell = Audio.prototype.bell;
  Audio.prototype.bell = function bellV1FinalMix(step = 0, ...args) {
    const out = baseBell.call(this, step, ...args);
    requestBedDuck(this, 0.10, 0.28);
    if (this.ready && !this.muted && this.bus?.ui) {
      const intervals = [0, 4, 7, 11, 14];
      const f = 622.25 * Math.pow(2, intervals[step % intervals.length] / 12);
      this._tone?.({ type: 'sine', f0: f, f1: f * 1.003, dur: 0.30, vol: 0.011, bus: this.bus.ui });
      this._tone?.({ type: 'triangle', f0: f * 2.02, f1: f * 2.01, dur: 0.15, vol: 0.007, bus: this.bus.ui, delay: 0.004 });
    }
    return out;
  };

  const baseHuntPulse = Audio.prototype._huntPulse;
  Audio.prototype._huntPulse = function huntPulseV1FinalMix(accent, pan = 0) {
    const out = baseHuntPulse.call(this, accent, pan);
    requestBedDuck(this, accent ? 0.065 : 0.045, 0.15);
    if (this.ready && !this.muted && this.bus?.score) {
      this._tone?.({
        type: 'sine',
        f0: accent ? 64 : 76,
        f1: 40,
        dur: 0.20,
        vol: accent ? 0.024 : 0.013,
        pan: pan * 0.16,
        bus: this.bus.score,
      });
    }
    return out;
  };

  const baseHuntStart = Audio.prototype.huntStart;
  Audio.prototype.huntStart = function huntStartV1FinalMix(...args) {
    requestBedDuck(this, 0.085, 0.40);
    return baseHuntStart.call(this, ...args);
  };

}

globalThis.__DASH_V1_FINAL_MIX = {
  version: '1.1',
  windMax: 0.285,
  surfaceGlide: SURFACE_GLIDE,
  windRebalancedUp: true,
  glideReducedFurther: true,
  bellLift: true,
  heartbeatLift: true,
  roarLift: true,
  priorityDucking: true,
  liveCalibrationCompatible: true,
  noExtraRaf: true,
};
