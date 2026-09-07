/**
 * RC10.9 — ONE pentatonic ladder, two voices.
 *
 * The correct-read chime and the bell string were two ladders, and they did
 * not know about each other: the chime climbed [0, 2, 4, 7, 9] from 660 Hz on
 * the CHAIN, the bell climbed [0, 4, 7, 11, 14] from 622.25 Hz on the number
 * of bells collected — a distance schedule. Different root a semitone apart,
 * different intervals, uncorrelated by construction. Two melodies playing over
 * each other in different keys is not two cues; it is one cue and some noise.
 *
 * Now a bell string is the chain's own melody carried out into the track
 * ahead: the same table, the same root, starting one rung ABOVE wherever the
 * chime just landed. Hearing the string is hearing what the next five reads
 * will sound like, which is the only thing a pickup on an auto-followed line
 * can honestly be.
 *
 * Pure: integers in, semitones and hertz out. No Web Audio, no DOM, no sim —
 * so the gates can walk both voices against each other in node.
 */

import TUNING from '../TUNING.js';

/** The major pentatonic, in semitones. The one table. */
export const LADDER = Object.freeze([0, 2, 4, 7, 9]);
/** The one root. Both voices sing from it. */
export const ROOT_HZ = 660;
/**
 * The ladder may climb two octaves and no further. The chime already stopped
 * there — its index caps at CHAIN_CAP + the top dash rung — and a string that
 * kept climbing past it would leave the melody it is supposed to continue.
 */
export const MAX_OCTAVE = 2;
/** Rungs in one string's cadence — five, because the ladder has five steps. */
export const STRING_RUNGS = LADDER.length;

const clampi = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Semitones above ROOT_HZ for ladder position `step`. */
export function ladderSemis(step) {
  const s = Math.max(0, step | 0);
  return LADDER[s % LADDER.length] + 12 * Math.min(MAX_OCTAVE, Math.floor(s / LADDER.length));
}

/** The pitch of ladder position `step`. */
export function ladderHz(step) {
  return ROOT_HZ * Math.pow(2, ladderSemis(step) / 12);
}

/** The ladder's last position — where both voices stop climbing. */
export const TOP_STEP = TUNING.BOOST.CHAIN_CAP + TUNING.SCORE.DASH_CHAIN_MULT.length - 1;

/**
 * Where the CHIME sits: the reading chain, plus the dash rung it is riding,
 * capped at the top of the ladder. This is the note the player just heard.
 */
export function chimeStep(chain = 0, dashChain = 0) {
  const topRung = TUNING.SCORE.DASH_CHAIN_MULT.length - 1;
  return clampi((chain | 0) + clampi(dashChain | 0, 0, topRung), 0, TOP_STEP);
}

/** The highest rung a string may START on: the one that lands its last note
 *  exactly on the ladder's top. A string that climbed past it would fold back
 *  down an octave mid-cadence, which is the one thing a continuation cannot do. */
export const STRING_TOP_START = TOP_STEP - STRING_RUNGS + 1;

/**
 * Where the STRING sits: the five rungs immediately above the chime, so a lit
 * string is the chain's melody continued rather than a second one. `i` is the
 * bell's place in its string; a string is longer than the cadence, so it wraps
 * — the same five-note cadence the bells have always rung, now in the chime's
 * own key and starting where the chime left off.
 *
 * Past chain cap the string parks on the ladder's top five rungs and stays
 * there. It cannot climb higher without leaving the two octaves the chime is
 * confined to, and the chime only ever reaches those rungs itself while a dash
 * chain is running — where the two voices are then singing the same notes,
 * which is the correlation this whole file exists to guarantee.
 */
export function stringStep(chain = 0, i = 0) {
  const start = Math.min(chimeStep(chain, 0) + 1, STRING_TOP_START);
  return start + ((((i | 0) % STRING_RUNGS) + STRING_RUNGS) % STRING_RUNGS);
}

export default { LADDER, ROOT_HZ, MAX_OCTAVE, STRING_RUNGS, TOP_STEP, STRING_TOP_START,
  ladderSemis, ladderHz, chimeStep, stringStep };
