/**
 * RC7 — what a stop says, and which control it points at.
 *
 * Pure strings and ids: no DOM, no imports, so a gate can drive all three
 * stops under all three modalities and check that every line names a control
 * that actually EXISTS on the device in the player's hands. The build runs on
 * a phone, on a keyboard and (through the gamepad layer) on a pad, and a
 * tutorial that says "TAP REAL" to someone holding a keyboard has taught
 * nothing.
 *
 * Every control named here is one `src/input/input.js` binds today:
 *   confirm/REAL  — the right tap zone and button, ArrowRight/KeyD, pad A
 *   reject/FAKE   — the left tap zone and button, ArrowLeft/KeyA, (no pad)
 *   dash          — the DASH button (held), Space (a press), pad RT (held)
 *
 * Two of those are worth stating plainly rather than papering over:
 *   - the gamepad layer binds confirm and the dash but NEVER reject, so on a
 *     pad the fake stop can only name the pass — which is a real answer, and
 *     the one that word wants. Naming a pad button for FAKE would be
 *     inventing a binding the game does not have.
 *   - Space is an edge, not a hold (KeyF/Shift is the held variant), so the
 *     keyboard dash line says PRESS. The touch button and the pad trigger are
 *     genuinely held, and say HOLD.
 */

export const MODALITY = Object.freeze({ TOUCH: 'touch', KEY: 'key', PAD: 'pad' });

/** Which on-screen control a stop rings. Touch only — the other modalities
 *  have no on-screen control to ring, so they name the input instead. */
const RING = Object.freeze({
  real: 'v1MobileJump',
  fake: 'v1MobileFake',
  dash: 'v1MobileDash',
});

const LINES = Object.freeze({
  touch: {
    real: 'SPELLED RIGHT · TAP REAL',
    fake: 'MISSPELLED · LET IT PASS, OR TAP FAKE',
    dash: 'DASH READY · HOLD DASH',
  },
  key: {
    real: 'SPELLED RIGHT · →',
    fake: 'MISSPELLED · LET IT PASS, OR ←',
    dash: 'DASH READY · PRESS SPACE',
  },
  pad: {
    real: 'SPELLED RIGHT · A',
    fake: 'MISSPELLED · LET IT PASS',
    dash: 'DASH READY · HOLD RT',
  },
});

/** The line for a stop, in the modality the player is actually using. */
export function stopLine(which, modality = MODALITY.TOUCH) {
  return LINES[modality]?.[which] || LINES.touch[which] || '';
}

/** The element id to ring, or null where there is nothing on screen to ring. */
export function stopRing(which, modality = MODALITY.TOUCH) {
  return modality === MODALITY.TOUCH ? (RING[which] || null) : null;
}

/**
 * The modality to teach in. A connected pad wins (a player holding one is
 * looking at it), then touch, then the keyboard — the same order the coach
 * has always used to decide whether to say TAP or name a key.
 */
export function modalityFor({ touch = false, pad = false } = {}) {
  if (pad) return MODALITY.PAD;
  return touch ? MODALITY.TOUCH : MODALITY.KEY;
}

export default { MODALITY, stopLine, stopRing, modalityFor };
