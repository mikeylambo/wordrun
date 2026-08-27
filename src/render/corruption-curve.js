/**
 * Corruption intensity — the ONE mapping from the sim's existing gap value to
 * how loud the danger presentation gets, shared by the world-space corruption,
 * the screen veil and the audio bed so they can never disagree.
 *
 * Pure math, no renderer imports: the gate suite replays the scripted
 * wrong-read scenario against this exact function and asserts the visible
 * escalation tracks the gap. This module is a CONSUMER of the tuned pressure
 * values — it computes nothing about pressure itself.
 */

import TUNING from '../TUNING.js';

/**
 * 0 at (or beyond) the dread ceiling, 1 at the kill gap. Shaped so far-range
 * motion is already visible (the beast used to give that for free just by
 * being a model on screen) while close range still dominates.
 */
export function corruptionIntensity(gap, maxGap = TUNING.BEAST.MAX_GAP) {
  const span = Math.max(1e-6, maxGap - TUNING.BEAST.KILL_GAP);
  const closed = Math.max(0, Math.min(1, (maxGap - gap) / span));
  return Math.pow(closed, 1.35);
}

/** Screen-veil opacity for the always-on static overlay (subtle at range). */
export function veilOpacity(intensity) {
  return Math.min(0.55, intensity * intensity * 0.5 + intensity * 0.08);
}

/** World-space field height scale behind the runner. */
export function fieldScale(intensity) {
  return 0.45 + intensity * 0.9;
}
