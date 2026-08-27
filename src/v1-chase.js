import { Beast, CHASE_MODE } from './sim/beast.js';
import { Audio } from './audio/audio.js';
import { EndgameSky } from './render/endgame-sky.js';
import { CHASE } from './design/release-tuning.js';

// V1 pursuit director. No player-facing mode name is introduced here: 30K is
// still a real finish, and KEEP GOING simply lets the mountain continue.

export const V1_CHASE = {
  STALK_BANDS: [
    { id: 'short', min: CHASE.STALK_SHORT_MIN, max: CHASE.STALK_SHORT_MAX },
    { id: 'normal', min: CHASE.STALK_NORMAL_MIN, max: CHASE.STALK_NORMAL_MAX },
    { id: 'long', min: CHASE.STALK_LONG_MIN, max: CHASE.STALK_LONG_MAX },
  ],
  RETURN_GRACE_MIN: CHASE.RETURN_GRACE_MIN,
  RETURN_GRACE_MAX: CHASE.RETURN_GRACE_MAX,
};

function pickStalkBand(beast) {
  const r = beast.rng.next();
  let index = r < CHASE.STALK_SHORT_WEIGHT
    ? 0
    : r < CHASE.STALK_SHORT_WEIGHT + CHASE.STALK_NORMAL_WEIGHT
      ? 1
      : 2;

  // The distribution is deterministic, but do not let the rhythm become a
  // repeated drumbeat. If the same band rolls twice, push the second draw into
  // a contrasting band using one more seeded value.
  if (index === beast.__v1LastStalkBand) {
    const contrast = beast.rng.next();
    if (index === 1) index = contrast < 0.5 ? 0 : 2;
    else index = 1;
  }
  beast.__v1LastStalkBand = index;
  return V1_CHASE.STALK_BANDS[index];
}

function installCadence() {
  if (Beast.prototype.__v1Cadence) return;
  Beast.prototype.__v1Cadence = true;

  Beast.prototype.__v1NextStalkDuration = function nextStalkDuration(player, returning = false) {
    if (returning) return this._rand(CHASE.RETURN_STALK_MIN, CHASE.RETURN_STALK_MAX);
    const band = pickStalkBand(this);
    return this._rand(band.min, band.max);
  };

  const baseReset = Beast.prototype.reset;
  Beast.prototype.reset = function resetV1Cadence(...args) {
    const out = baseReset.apply(this, args);
    this.__v1LastStalkBand = -1;
    return out;
  };

  const baseAdvance = Beast.prototype._advanceRhythm;
  Beast.prototype._advanceRhythm = function advanceRhythmV1(dt, player) {
    const before = this.mode;
    const out = baseAdvance.call(this, dt, player);
    if (before === CHASE_MODE.RELIEF && this.mode === CHASE_MODE.STALK && this.modeT === 0) {
      this.modeDuration = this.__v1NextStalkDuration(player, false);
    }
    return out;
  };
}

function installKeepGoingPursuit() {
  if (EndgameSky.prototype.__v1KeepGoingPursuit) return;
  EndgameSky.prototype.__v1KeepGoingPursuit = true;

  const baseContinue = EndgameSky.prototype._continue;
  EndgameSky.prototype._continue = function continueV1(...args) {
    const out = baseContinue.apply(this, args);
    const sim = globalThis.__SIM;
    if (!sim?.escapeConsumed) return out;

    sim.keepGoingChosen = true;
    sim.postFinishActive = false;
    sim.postFinishGraceRemaining = sim.beast?._rand(
      CHASE.RETURN_GRACE_MIN,
      CHASE.RETURN_GRACE_MAX,
    ) ?? CHASE.RETURN_GRACE_MIN;
    return out;
  };

  // Once pursuit has resumed, the older ending layer sees escaped=false and no
  // longer performs its periodic best-distance save. Preserve that persistence
  // contract without showing a new label or interrupting the run again.
  const baseUpdate = EndgameSky.prototype.update;
  EndgameSky.prototype.update = function updateV1Pursuit(distance, x, y, z) {
    const out = baseUpdate.call(this, distance, x, y, z);
    const sim = globalThis.__SIM;
    if (
      this.overrun &&
      sim?.escapeConsumed &&
      sim.postFinishActive &&
      distance - this.lastSavedDistance >= 250
    ) {
      this.lastSavedDistance = distance;
      this._recordBest(false);
    }
    return out;
  };
}

function playReturnRoar(audio, player) {
  if (!audio?.ready || audio.muted || !audio.ctx) return;
  const sim = globalThis.__SIM;
  const pan = typeof audio._panFor === 'function'
    ? audio._panFor(sim?.beast?.x ?? player?.x ?? 0)
    : 0;
  const bus = audio.bus?.threat;
  if (!bus) return;

  // This is a distant rediscovery cue, not a Hunt cue. The praised Hunt pulse
  // remains untouched; ordinary continuous roar/footstep mixing takes over as
  // Beast One closes the gap again.
  audio._tone({
    type: 'sawtooth', f0: 96, f1: 39, dur: 0.72, vol: 0.072,
    pan, bus, filter: { type: 'lowpass', freq: 330, q: 1.4 },
  });
  audio._burst(0.48, 0.085, 240, 'lowpass', pan, bus, 0.65);
  audio._burst(0.14, 0.022, 1900, 'bandpass', pan, bus, 0.85);
}

function installReturnAudio() {
  if (Audio.prototype.__v1ReturnAudio) return;
  Audio.prototype.__v1ReturnAudio = true;
  const baseUpdate = Audio.prototype.update;

  Audio.prototype.update = function updateV1Return(dt, player, ...rest) {
    const out = baseUpdate.call(this, dt, player, ...rest);
    const serial = globalThis.__SIM?.beastReturnSerial || 0;
    if (serial > (this.__v1ReturnSerial || 0)) {
      this.__v1ReturnSerial = serial;
      playReturnRoar(this, player);
    }
    return out;
  };
}

function installV1Chase() {
  installCadence();
  installKeepGoingPursuit();
  installReturnAudio();

  globalThis.__DESCENT_V1_CHASE = {
    version: '1.0-rc',
    finishRemainsOptionalStop: true,
    keepGoingResumesBothBeasts: true,
    returnGrace: [CHASE.RETURN_GRACE_MIN, CHASE.RETURN_GRACE_MAX],
    stalkBands: V1_CHASE.STALK_BANDS.map((b) => ({ ...b })),
    immediateBandRepeatsSuppressed: true,
    noPlayerFacingModeLabel: true,
    noExtraRaf: true,
  };
}

// v1-finalize queues first; queue this second so cadence/persistence wrap the
// final V1 prototype stack rather than being overwritten by it.
if (typeof queueMicrotask === 'function') queueMicrotask(installV1Chase);
else Promise.resolve().then(installV1Chase);
