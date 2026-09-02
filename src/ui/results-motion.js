/**
 * Results motion (Phase Q) — the score count-up as ONE pure curve.
 *
 * The results headline counts up from zero to the run's score on the music's
 * beat clock: the clock hands the card beats elapsed, this module hands back
 * the number to print. Pure — no DOM, no clock, no sim — so the gate can
 * drive the whole reveal in node: monotone, zero at the start, and EXACTLY
 * the score at the end (a headline that settles one point off the number the
 * run actually banked is a bug, not an easing artifact).
 *
 * Eight beats — two bars — is the reveal. Ease-out cubic: the number moves
 * hardest on the first beat and lands softly, which reads as a reveal rather
 * than a slot machine. When no music is playing (muted, or the track has not
 * loaded) the caller advances beats at FALLBACK_BPS from frame time, so the
 * reveal always finishes and always lands on the same number.
 */

export const COUNT_BEATS = 8;      // two bars of 4/4
export const FALLBACK_BPS = 3.2;   // beats per second when the clock is silent

/** Beats elapsed -> reveal progress 0..1, monotone, exactly 1 at the end. */
export function countProgress(beats) {
  const t = Math.max(0, Math.min(1, beats / COUNT_BEATS));
  return 1 - (1 - t) ** 3;
}

/** The number the headline prints at `beats` — floor(score) exactly at the end. */
export function countValue(score, beats) {
  const total = Math.floor(score ?? 0);
  if (beats >= COUNT_BEATS) return total;
  return Math.floor(total * countProgress(beats));
}
