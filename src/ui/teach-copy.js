/**
 * RC8 — what the game says about a control, and which control it points at.
 *
 * Pure strings and ids: no DOM, no imports, so a gate can drive every line in
 * every modality and check that each one names a control that actually EXISTS
 * on the device in the player's hands. The build runs on a phone, on a
 * keyboard and (through the gamepad layer) on a pad, and a tutorial that says
 * "TAP REAL" to someone holding a keyboard has taught nothing.
 *
 * Every control named here is one `src/input/input.js` binds today:
 *   confirm/REAL  — the right tap zone and the REAL button, ArrowRight/KeyD, pad A
 *   reject/FAKE   — the left tap zone and the FAKE button, ArrowLeft/KeyA, (no pad)
 *   dash          — the DASH button, Space (or F/Shift), pad RT
 *   raise the bar — a HELD press on that SAME dash control, on every device
 *
 * THE DASH IS A PRESS, ON EVERY CONTROL, AND HAS BEEN SINCE THE DEBUGGING
 * PASS. The header this replaces said the touch button was "held", and that
 * one sentence is why HOLD kept walking back into the copy. `input.boostHeld`
 * is a name the sim's input record kept, not a rule: `Player._overdrive`
 * fires on its RISING EDGE and the dash then runs itself out on DRAIN_RATE,
 * so a button touched for one frame and a button leaned on for three seconds
 * buy the identical dash. Every DASH instruction therefore reads TAP DASH
 * (touch), PRESS SPACE (keyboard) or RT (pad) — never HOLD.
 *
 * The one control that IS genuinely held is the compression bar, and RC9.9
 * moved it onto the dash control itself: a press under HOLD_MS dashes on
 * release, a press that outlives HOLD_MS raises the bar and cannot dash. So
 * the bar line is still the only one in this file that may say HOLD — but it
 * now names the SAME control the dash lines name, on every device, which is
 * the whole point of the move. The distinction the copy has to keep is TAP
 * versus HOLD, not one control versus another: every DASH instruction still
 * reads TAP / PRESS / RT and never HOLD.
 *
 * Two more worth stating plainly rather than papering over:
 *   - the gamepad layer binds confirm and the dash but NEVER reject, so on a
 *     pad the fake stop can only name the pass — which is a real answer, and
 *     the one that word wants. Naming a pad button for it would be inventing
 *     a binding. The bar, since RC9.9, rides RT and so has a pad line at last.
 *   - the modality vocabularies do not mix. Touch says the button names and
 *     never says RIGHT or LEFT (it has no screen halves to point at any
 *     more); the keyboard says the arrows and never says REAL or FAKE. Both
 *     halves of that are gated.
 */

export const MODALITY = Object.freeze({ TOUCH: 'touch', KEY: 'key', PAD: 'pad' });

/** Which on-screen control a stop rings. Touch only — the other modalities
 *  have no on-screen control to ring, so they name the input instead. */
const RING = Object.freeze({
  real: 'v1MobileJump',
  fake: 'v1MobileFake',
  dash: 'v1MobileDash',
});

/**
 * The control token: the thing a player presses, named the way that device
 * names it. Every player-facing instruction is built from these, so a control
 * can be renamed in exactly one place and no surface can drift off it.
 */
const CONTROL = Object.freeze({
  touch: { real: 'TAP REAL', fake: 'TAP FAKE', dash: 'TAP DASH' },
  key: { real: '→', fake: '←', dash: 'PRESS SPACE' },
  pad: { real: 'A', fake: '', dash: 'RT' },
});

/** What to press for `which`, in this modality; '' where nothing is bound. */
export function control(which, modality = MODALITY.TOUCH) {
  return CONTROL[modality]?.[which] ?? CONTROL.touch[which] ?? '';
}

/**
 * THE charged phrase. One string for the state, built from the one control
 * token — the stop, the coach and the HUD hint all read it from here, so
 * they are byte-identical by construction rather than by three edits that
 * have to agree. ("THE BAR IS FULL" said a feeling and named nothing; it is
 * retired, and the bar it accidentally referred to is a different mechanic.)
 */
export function dashReadyLine(modality = MODALITY.TOUCH) {
  return `DASH READY · ${control('dash', modality)}`;
}

/** The line for a stop, in the modality the player is actually using. */
const STOP_LINES = Object.freeze({
  touch: {
    real: 'SPELLED CORRECTLY · TAP REAL',
    fake: 'MISSPELLED · LET IT PASS, OR TAP FAKE',
  },
  key: {
    real: 'SPELLED RIGHT · →',
    fake: 'MISSPELLED · LET IT PASS, OR ←',
  },
  pad: {
    real: 'SPELLED RIGHT · A',
    fake: 'MISSPELLED · LET IT PASS',
  },
});

export function stopLine(which, modality = MODALITY.TOUCH) {
  if (which === 'dash') return dashReadyLine(modality);
  return STOP_LINES[modality]?.[which] || STOP_LINES.touch[which] || '';
}

/** The element id to ring, or null where there is nothing on screen to ring. */
export function stopRing(which, modality = MODALITY.TOUCH) {
  return modality === MODALITY.TOUCH ? (RING[which] || null) : null;
}

// ── The coach's fallback rungs ────────────────────────────────────────────
// With GUIDED TIPS off there are no stops, and these are the whole teaching.
// Same vocabulary, same controls, one line at a time.

/** The confirm verb — the whole game without the reject one. */
export function confirmLesson(modality = MODALITY.TOUCH) {
  return modality === MODALITY.TOUCH
    ? 'TAP REAL IF THE WORD IS SPELLED CORRECTLY'
    : `${control('real', modality)} IF THE WORD IS SPELLED RIGHT`;
}

/** The reject verb, offered as an option — passing is already an answer. */
export const PASS_LESSON = 'A MISSPELLED WORD CAN SIMPLY PASS';

export function rejectLesson(modality = MODALITY.TOUCH) {
  const c = control('fake', modality);
  return c ? `OR ${c} TO CALL IT OUT SOONER` : PASS_LESSON;
}

/**
 * The bar (Phase F compression) — taught, not secret, on the run band AND on
 * the HOW TO PLAY card, which is why the verb and the control are exported
 * apart: the card sets the control as a chip inside a sentence, the coach
 * says it as one line.
 *
 * RC9.9: the control is the DASH, on every device. It used to be a held press
 * on the right SCREEN ZONE — a half of the screen whose only other meaning is
 * "this word is spelled correctly" — with the two verbs told apart by a
 * stopwatch on the same pixel, and a keyboard raise on ArrowUp that shared
 * nothing with it. Nobody found either. The dash control is on screen, it is
 * on every device, and it is the one thing a new player has already been
 * taught to look for; a press it does not spend within 520 ms is a press that
 * was never an answer. So the verb is HOLD and the control is the dash's own
 * name in each modality — and no line here may say HOLD about the DASH
 * ITSELF, which is still, always, a tap.
 */
const BAR = Object.freeze({
  touch: { verb: 'Hold', control: 'DASH' },
  key: { verb: 'Hold', control: 'SPACE' },
  pad: { verb: 'Hold', control: 'RT' },
});

/** {verb, control} for raising the bar, or null where nothing is bound. */
export function barControl(modality = MODALITY.TOUCH) {
  return BAR[modality] || BAR.touch;
}

export function barLesson(modality = MODALITY.TOUCH) {
  const b = BAR[modality];
  if (!b) return '';
  return `${b.verb.toUpperCase()} ${b.control} TO RAISE THE BAR · ANSWER FASTER, SCORE MORE`;
}

/** What the charge is called on this device — the ring is a touch object. */
export function chargeNoun(modality = MODALITY.TOUCH) {
  return modality === MODALITY.TOUCH ? 'ring' : 'meter';
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

export default {
  MODALITY, control, dashReadyLine, stopLine, stopRing, confirmLesson,
  rejectLesson, barLesson, barControl, chargeNoun, modalityFor, PASS_LESSON,
};
