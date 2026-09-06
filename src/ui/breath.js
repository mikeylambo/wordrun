/**
 * RC9.9 — the held breath.
 *
 * A stop freezes the world. Everything the sim owns holds at the value it had
 * when the stop began, which is exactly right and which also, until now, left
 * the screen looking switched off: a still frame with a line of text on it.
 * The player cannot tell a deliberate pause from a hang.
 *
 * So the five things that are STILL TRUE during a stop breathe — the stop's
 * own line, the bar's three marks, the hearts, the score's glow, and the ring
 * on the control the stop is pointing at. Nothing moves, nothing flashes;
 * they brighten and dim together, on the music's own clock, at a rate slow
 * enough that it reads as respiration rather than as animation.
 *
 * ONE BREATH PER TWO BARS. At the score's 164 BPM that is 0.34 Hz — half the
 * 0.6 Hz ceiling, and musically a phrase rather than a pulse. Tying it to the
 * beat rather than to a wall clock is what keeps it from becoming a second
 * rhythm arguing with the track underneath it.
 *
 * Pure: beats in, a number in 0..1 out. No DOM, no audio, no game — main.js
 * writes the one value to one custom property and CSS spends it, so there is
 * a single writer and the gates can drive every branch in node.
 */

/** Beats per breath. One breath every two bars of 4/4. */
export const BREATH_BEATS = 8;
/** The ceiling the brief sets, and what the gate holds this under. */
export const BREATH_HZ_MAX = 0.6;
/** The score's tempo, for the fallback when no clock is playing. */
export const BREATH_FALLBACK_BPM = 164;

/** The breath's frequency at a tempo, in Hz — the number the gate checks. */
export function breathHz(bpm = BREATH_FALLBACK_BPM) {
  return bpm / 60 / BREATH_BEATS;
}

/**
 * The breath, 0..1, as a raised cosine — no corners, no edges, and equal time
 * spent arriving and leaving. A stop that is not active is not breathing, and
 * REDUCED FLASH is not breathing either: both return the REST value, which is
 * full brightness. Held still means held LIT, not held dark — the alternative
 * would dim a HUD the player is being asked to read.
 *
 * @param {object} o
 * @param {boolean} o.active      is a stop on screen
 * @param {boolean} o.reducedFlash the player asked for no motion
 * @param {number|null} o.beat    the music clock's beat, or null when silent
 * @param {number} o.seconds      a wall clock, for the silent fallback
 * @returns {number} 0..1, where 1 is the rest state
 */
export function breathAt({ active = false, reducedFlash = false,
  beat = null, seconds = 0 } = {}) {
  if (!active || reducedFlash) return 1;
  // The music's clock when there is one. MUSIC OFF is a mix decision and must
  // not decide whether the screen looks alive, so silence falls back to the
  // same rate counted in seconds.
  const phase = beat != null && Number.isFinite(beat)
    ? beat / BREATH_BEATS
    : seconds * breathHz();
  return 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
}

export default breathAt;
