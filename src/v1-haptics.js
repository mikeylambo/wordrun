import { Audio } from './audio/audio.js';

const PULSES = {
  takeoff:    { mobile: 10,          duration: 24,  weak: 0.16, strong: 0.08 },
  landClean:  { mobile: 18,          duration: 42,  weak: 0.28, strong: 0.14 },
  landBump:   { mobile: 28,          duration: 54,  weak: 0.34, strong: 0.28 },
  landFlub:   { mobile: [34, 18, 34],duration: 82,  weak: 0.44, strong: 0.50 },
  hit:        { mobile: 62,          duration: 86,  weak: 0.52, strong: 0.82 },
  overdriveOn:{ mobile: 22,          duration: 48,  weak: 0.72, strong: 0.34 },
  kill:       { mobile: [90, 38, 145],duration: 190, weak: 0.78, strong: 1.00 },
};

let enabled = true;

function connectedPads() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  try { return [...(navigator.getGamepads() || [])].filter(Boolean); }
  catch { return []; }
}

function mobilePulse(pattern) {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* unsupported device/browser */ }
}

function padPulse(spec) {
  if (!enabled) return;
  for (const pad of connectedPads()) {
    try {
      const actuator = pad.vibrationActuator;
      if (actuator?.playEffect) {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: spec.duration,
          weakMagnitude: spec.weak,
          strongMagnitude: spec.strong,
        }).catch?.(() => {});
        continue;
      }
      const haptic = pad.hapticActuators?.[0];
      if (haptic?.pulse) haptic.pulse(Math.max(spec.weak, spec.strong), spec.duration);
    } catch { /* controller exposes no supported actuator */ }
  }
}

export function pulse(kind) {
  const spec = PULSES[kind];
  if (!spec || !enabled || document.hidden) return;
  mobilePulse(spec.mobile);
  padPulse(spec);
}

export function setHapticsEnabled(on) {
  enabled = !!on;
  if (!enabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(0); } catch {}
  }
  return enabled;
}

// Audio one-shots are already fired from deterministic sim events. Wrapping those
// exact one-shots keeps vibration frame-locked to gameplay without polling or a
// second animation loop. Unsupported devices simply no-op.
if (!Audio.prototype.__v1Haptics) {
  Audio.prototype.__v1Haptics = true;
  for (const method of Object.keys(PULSES)) {
    const base = Audio.prototype[method];
    if (typeof base !== 'function') continue;
    Audio.prototype[method] = function hapticOneShot(...args) {
      const out = base.apply(this, args);
      pulse(method);
      return out;
    };
  }
}

globalThis.__DASH_HAPTICS = {
  version: '1.0-rc',
  pulse,
  setEnabled: setHapticsEnabled,
  get enabled() { return enabled; },
  mobileVibration: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
  controllerRumble: true,
  noExtraRaf: true,
};
