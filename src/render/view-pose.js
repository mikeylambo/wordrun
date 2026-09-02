/**
 * View pose (Phase R) — 120 Hz presentation of the fixed 60 Hz sim.
 *
 * The sim steps at exactly TUNING.SIM.HZ and returns, from advance(), how far
 * the render frame sits between the last step and the next (alpha 0..1). On a
 * display faster than the timestep, drawing the last-stepped state duplicates
 * poses — the runner stands still every other frame at 120 Hz. This module
 * lerps the CONTINUOUS pose (x, y, d, heading; the Redline's gap and lane) by
 * that alpha; everything discrete — chain, hearts, phase, overdrive, the
 * armed word — reads through the prototype chain untouched, so no gameplay
 * state is ever invented between steps.
 *
 * Pure arithmetic, no sim import, no DOM: the gate drives it in node.
 */

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * The player as the renderer should see it this frame. Returns `player`
 * itself when there is nothing to interpolate (no captured pose, alpha at a
 * step boundary), else a view object whose continuous fields are lerped and
 * whose every other field falls through to the live player.
 */
export function viewPlayer(player, prev, alpha) {
  if (!prev || !(alpha > 0) || alpha >= 1) return player;
  const v = Object.create(player);
  v.x = lerp(prev.x, player.x, alpha);
  v.y = lerp(prev.y, player.y, alpha);
  v.d = lerp(prev.d, player.d, alpha);
  v.heading = lerp(prev.heading, player.heading, alpha);
  return v;
}

/** The Redline's continuous pose this frame: { gap, x }. */
export function viewBeast(beast, prev, alpha) {
  if (!prev || !(alpha > 0) || alpha >= 1) return { gap: beast.gap, x: beast.x };
  return {
    gap: lerp(prev.beastGap, beast.gap, alpha),
    x: lerp(prev.beastX, beast.x, alpha),
  };
}
