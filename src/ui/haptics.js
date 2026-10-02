/**
 * Haptics — phone vibration and controller rumble for the run's two physical
 * moments: a tapped fake (`hit`) and being run down (`kill`).
 *
 * main.js fires these from the same sim events that fire the sounds. They
 * used to ride a runtime wrapper around seven Audio methods, four of which
 * (takeoff and the three landings) no longer exist and one of which
 * (overdriveOn) nothing calls — so the table is the two that can happen.
 */

const PULSES = {
  hit:  { mobile: 62,            duration: 86,  weak: 0.52, strong: 0.82 },
  kill: { mobile: [90, 38, 145], duration: 190, weak: 0.78, strong: 1.00 },
};

let enabled = true;

function connectedPads() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  try { return [...(navigator.getGamepads() || [])].filter(Boolean); }
  catch { return []; }
}

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

// iOS Safari has never shipped navigator.vibrate, so an iPhone — likely half
// the audience — felt nothing at all. What iOS 18+ does have is the system
// tick a SWITCH control makes when it flips, and a label click flips it. One
// hidden switch, reused: no layout, no focus, nothing a player can see or
// reach. Where the platform declines (older iOS, outside a gesture), it is
// silently nothing, which is exactly what it was before.
let iosSwitch = null;
function switchTick() {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    if (!iosSwitch) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('switch', '');
      box.tabIndex = -1;
      label.appendChild(box);
      document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch { /* no switch haptics on this platform */ }
}

function mobilePulse(pattern) {
  if (!enabled) return;
  if (!canVibrate()) {
    // One tick per beat of the pattern, capped at two — a kill reads as a
    // double knock, a hit as one.
    switchTick();
    if (Array.isArray(pattern) && pattern.length > 1) setTimeout(switchTick, Math.min(160, pattern[0] + pattern[1]));
    return;
  }
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
  if (!enabled && canVibrate()) {
    try { navigator.vibrate(0); } catch {}
  }
  return enabled;
}
