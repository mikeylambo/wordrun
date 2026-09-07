/**
 * RC10.8 — every performance cue, on one ladder.
 *
 * Nine cues answer the reading chain and each was tuned alone: the flow
 * curve, the runner's comet tail, the chime's pentatonic ladder, the dash
 * rungs, the surge, the Editorial world's bands, the music layer, the runner's
 * own posture and — since RC10.9 — the bell string in the track ahead. Laid side by side against chain 0..150 they did not
 * agree about what "excellent" means — and a table nobody had ever printed is
 * exactly where that hides.
 *
 * THE FINDING. Flow brilliance saturated at chain 8 (`FLOW_CHAIN_CAP`), the
 * chime's ladder ran out around 8 + the dash rungs, and the surge filled six
 * reads past the cap — while the Editorial bands are 0 / 25 / 50 / 100 / 150
 * and the music layer waits for 50. So a player was at MAXIMUM brilliance,
 * maximum tail, top of the melody and full surge at chain 8, and then read
 * forty-two more words before the world admitted anything had happened. Five
 * of the eight cues crested in the first sixth of the range and said nothing
 * for the rest of it: not one crest, but one crest and a long silence.
 *
 * THE FIX was in the system that owned it, not here — `FLOW_CHAIN_CAP` is 50,
 * the third editorial band and the chain the music layer arrives on — so the
 * four continuous cues now crest as one event. This file is what holds them
 * there.
 *
 * WHAT THIS FILE IS. The ladder, as data: one row per cue, each a pure
 * function of the chain, normalised 0..1 so they can be compared at all. It
 * does not replace any system's own tuning — the flow curve still owns
 * brilliance, the editorial layout still owns bands — it states where each is
 * expected to be, so `npm run gates` can hold them together and print the
 * table that would have shown this in the first place.
 *
 * Pure: chain in, numbers out. No DOM, no sim, no audio.
 *
 * It lives in tools/ rather than src/ because nothing at RUN time reads it —
 * each system still owns its own tuning, and this only states where they are
 * expected to meet. A file the game never imports does not belong in src/,
 * which is the rule the reachability gate exists to keep.
 */

import TUNING from '../src/TUNING.js';
import { flowLevel } from '../src/render/flow-curve.js';
import { BAND_CHAINS, bandFor } from '../src/render/editorial-layout.js';
import { highLayerWanted } from '../src/music/high-layer.js';
import { litFraction } from '../src/design/bells.js';

/** The top of the ladder — the last editorial band, where the table ends. */
export const CREST_CHAIN = BAND_CHAINS[BAND_CHAINS.length - 1];   // 150
/** Where the continuous cues are expected to meet: the blooming band. */
export const CONTINUOUS_CREST = BAND_CHAINS[2];                   // 50
/** Where the ladder is sampled for the printed table and the gate. */
export const RUNGS = [0, 8, 25, 50, 75, 100, 125, 150];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * The cues, each normalised 0..1 against the chain.
 *
 * `slow` marks the ones that were already spread across the full range and
 * are the reference the others are held to.
 */
export const CUES = Object.freeze([
  Object.freeze({
    key: 'flow brilliance',
    at: (chain) => flowLevel(chain),
  }),
  Object.freeze({
    key: 'runner tail',
    // The tail rides the same flow factor the world does.
    at: (chain) => flowLevel(chain),
  }),
  Object.freeze({
    key: 'chime rung',
    // The pentatonic ladder, capped where the ear stops hearing a new rung.
    at: (chain) => clamp01(Math.min(chain, TUNING.BOOST.CHAIN_CAP
      + TUNING.SCORE.DASH_CHAIN_MULT.length - 1)
      / (TUNING.BOOST.CHAIN_CAP + TUNING.SCORE.DASH_CHAIN_MULT.length - 1)),
  }),
  Object.freeze({
    key: 'score multiplier',
    at: (chain) => clamp01(Math.min(chain, TUNING.BOOST.CHAIN_CAP) / TUNING.BOOST.CHAIN_CAP),
  }),
  Object.freeze({
    key: 'surge',
    at: (chain) => clamp01(Math.max(0, chain - TUNING.BOOST.CHAIN_CAP)
      / TUNING.BOOST.SURGE_READS),
  }),
  Object.freeze({
    key: 'editorial band',
    slow: true,
    at: (chain) => bandFor(chain) / (BAND_CHAINS.length - 1),
  }),
  Object.freeze({
    key: 'music layer',
    slow: true,
    at: (chain) => (highLayerWanted(chain) ? 1 : 0),
  }),
  Object.freeze({
    key: 'runner economy',
    // actors.js: economy opens as the flow factor passes 1.25 of 1.75.
    at: (chain) => clamp01((0.78 + (1.75 - 0.78) * flowLevel(chain) - 1.25) / 0.5),
  }),
  Object.freeze({
    key: 'bell string',
    // RC10.9: how much of a string the chain has lit. A counted ladder, one
    // bell per link, so it belongs with the chime and the surge rather than
    // with the continuous world cues — and it is the ONLY cue that is also an
    // object in the world the player runs through.
    at: (chain) => litFraction(chain),
  }),
]);

/** Every cue at one chain, as a row. */
export function ladderAt(chain) {
  const row = { chain };
  for (const c of CUES) row[c.key] = c.at(chain);
  return row;
}

/**
 * The chain at which a cue first reaches `frac` of its range. Used to say
 * "this one crests at 8 and that one at 150" in a number rather than a feeling.
 */
export function crestChain(cue, frac = 0.999, max = CREST_CHAIN * 2) {
  for (let c = 0; c <= max; c++) if (cue.at(c) >= frac) return c;
  return Infinity;
}

/** The whole table, for printing. */
export function ladderTable(rungs = RUNGS) {
  return rungs.map((c) => ladderAt(c));
}

export default { CUES, ladderAt, ladderTable, crestChain, CREST_CHAIN, CONTINUOUS_CREST, RUNGS };
