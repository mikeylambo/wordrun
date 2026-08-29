import TUNING from './TUNING.js';
import { Audio } from './audio/audio.js';
import { ApprovedAudioAssets } from './audio/approved-assets.js';

// User-approved V1 mix, captured live on-device with ?mix=1.
// These offsets are now the canonical 0 dB reference. The hidden mixer remains
// available as a relative trim layer around this baseline.
const APPROVED_DB = Object.freeze({
  master: 0,
  wind: -2,
  ski: -5.5,
  bells: 4,
  heartbeat: 6,
  beast: 1,
});

const dbToGain = (db) => Math.pow(10, Number(db || 0) / 20);
const APPROVED = Object.freeze(Object.fromEntries(
  Object.entries(APPROVED_DB).map(([key, value]) => [key, dbToGain(value)]),
));

// The previous calibration values were persisted by the live mixer. Clear them
// once when this approved baseline first arrives so they are not applied twice.
try {
  const markerKey = 'descent:v1-live-mix-baseline';
  const marker = 'approved-2026-08-11-a';
  if (localStorage.getItem(markerKey) !== marker) {
    globalThis.__DESCENT_MIX?.reset?.();
    localStorage.setItem(markerKey, marker);
  }
} catch { /* storage is optional */ }

const relativeGain = (key) => {
  const g = globalThis.__DESCENT_MIX?.gain?.(key);
  return Number.isFinite(g) ? g : 1;
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));

if (!Audio.prototype.__v1ApprovedMix) {
  Audio.prototype.__v1ApprovedMix = true;

  // Bell and heartbeat synthesis already run through category wrappers in the
  // live mixer. Add the approved reference gain outside those wrappers so a
  // 0 dB slider means the approved release level, not the old pre-mix level.
  const baseTone = Audio.prototype._tone;
  Audio.prototype._tone = function toneV1Approved(options = {}) {
    const category = this.__v1ApprovedMixCategory;
    const mult = category === 'bells' ? APPROVED.bells
      : category === 'heartbeat' ? APPROVED.heartbeat
        : 1;
    if (mult === 1) return baseTone.call(this, options);
    return baseTone.call(this, { ...options, vol: (options.vol ?? 0.1) * mult });
  };

  const baseBurst = Audio.prototype._burst;
  Audio.prototype._burst = function burstV1Approved(dur, vol, ...args) {
    const category = this.__v1ApprovedMixCategory;
    const mult = category === 'bells' ? APPROVED.bells
      : category === 'heartbeat' ? APPROVED.heartbeat
        : 1;
    return baseBurst.call(this, dur, vol * mult, ...args);
  };

  const baseBell = Audio.prototype.bell;
  Audio.prototype.bell = function bellV1Approved(...args) {
    const prev = this.__v1ApprovedMixCategory;
    this.__v1ApprovedMixCategory = 'bells';
    try { return baseBell.apply(this, args); }
    finally { this.__v1ApprovedMixCategory = prev; }
  };

  const basePulse = Audio.prototype._huntPulse;
  Audio.prototype._huntPulse = function pulseV1Approved(...args) {
    const prev = this.__v1ApprovedMixCategory;
    this.__v1ApprovedMixCategory = 'heartbeat';
    try { return basePulse.apply(this, args); }
    finally { this.__v1ApprovedMixCategory = prev; }
  };

  // This wrapper intentionally evaluates after v1-mixer.js. The mixer's values
  // remain live relative trims, while these approved gains become the permanent
  // release reference for the continuous procedural voices.
  const baseUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateV1Approved(dt, player, bands, running) {
    const out = baseUpdate.call(this, dt, player, bands, running);
    if (!this.ready || !this.ctx || !player) return out;

    const sim = globalThis.__SIM;
    const phase = sim?.phase;
    const kill = phase === 'kill' || phase === 'dead';
    const live = !!running && !kill;
    const speedN = clamp01((player.speed - 10) / (TUNING.RUN.CEILING - 10));
    const edge = player.airborne ? 0 : clamp01(Math.abs(player.heading) / TUNING.PLAYER.MAX_CARVE);
    const onSnow = live && !player.airborne && !player.onIce && !player.inPowder;

    if (this.wind?.gain?.gain) {
      const target = TUNING.AUDIO.WIND_MAX * speedN * speedN *
        (player.airborne ? 1.18 : 0.82) * APPROVED.wind * relativeGain('wind');
      this._set(this.wind.gain.gain, target, 0.06);
    }

    if (this.snow?.gain?.gain) {
      const glideBase = globalThis.__DESCENT_V1_FINAL_MIX?.packedSnowGlide ?? 0.075;
      const glide = glideBase * (0.32 + speedN * 0.68) * APPROVED.ski * relativeGain('ski');
      this._set(this.snow.gain.gain, onSnow ? glide * (0.48 + edge * 1.35) : 0, 0.045);
    }

    if (this.roar?.gain?.gain) {
      const target = TUNING.AUDIO.ROAR_MAX * clamp01(bands?.roar || 0) *
        APPROVED.beast * relativeGain('beast');
      this._set(this.roar.gain.gain, target, 0.045);
    }

    return out;
  };
}

// Keep approved recorded layers aligned with the exact mix that was heard while
// calibrating: the existing asset-side wind/ski trims remain inside v1-mixer;
// these factors bake only the user's final relative offsets.
if (!ApprovedAudioAssets.prototype.__v1ApprovedMix) {
  ApprovedAudioAssets.prototype.__v1ApprovedMix = true;

  const baseLoop = ApprovedAudioAssets.prototype.setLoop;
  ApprovedAudioAssets.prototype.setLoop = function setLoopV1Approved(id, target, options = {}) {
    let scale = 1;
    if (id === 'wind_alpine_bed') scale = APPROVED.wind;
    else if (id.startsWith('ski_')) scale = APPROVED.ski;
    return baseLoop.call(this, id, target * scale, options);
  };

  const baseShot = ApprovedAudioAssets.prototype.oneShot;
  ApprovedAudioAssets.prototype.oneShot = function oneShotV1Approved(id, options = {}) {
    let scale = 1;
    if (id === 'beast_main_distant' || id === 'beast_main_close' || id === 'beast_main_leap' ||
        id === 'frost_beast_enter' || id === 'frost_beast_charge' || id === 'frost_beast_vault' || id === 'frost_beast_kill') {
      scale = APPROVED.beast;
    }
    return baseShot.call(this, id, { ...options, gain: (options.gain ?? 1) * scale });
  };
}

globalThis.__DESCENT_V1_APPROVED_MIX = {
  version: '1.0',
  db: { ...APPROVED_DB },
  effective: {
    master: TUNING.AUDIO.MASTER,
    windMax: TUNING.AUDIO.WIND_MAX * APPROVED.wind,
    packedSnowGlide: (globalThis.__DESCENT_V1_FINAL_MIX?.packedSnowGlide ?? 0.075) * APPROVED.ski,
    roarMax: TUNING.AUDIO.ROAR_MAX * APPROVED.beast,
  },
  mixerZeroIsApprovedBaseline: true,
  noExtraRaf: true,
};
