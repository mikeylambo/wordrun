/**
 * Speed-feel presets (dev). Candidate tunings for the Sonic question, applied
 * to the live TUNING object so the real game runs at each of them.
 *
 * Nothing here is shipped. `dev/feel-lab.js` applies these in the browser via
 * ?feel=/__FEEL(); `tools/feel-measure.mjs` drives real sims at each and
 * reports what a run actually feels like in numbers.
 *
 * The question being explored: the shipped tuning has a wide DESIGN range
 * (21..64, 3x) but a narrower LIVED one. At a steady accuracy the speed sits
 * at an equilibrium and a miss moves it 6 m/s, so moment to moment the run is
 * nearly flat. Sonic's feel is the opposite: a mistake dumps you, and climbing
 * back out is the whole sensation.
 *
 * RC8.3 SHIPPED part of what SONIC was proposing — the camera block below was
 * the lab's, and the run now carries it (and a little more) as baseline, with
 * the floor raised 16 → 21 and the dash lengthened. So the presets that follow
 * are re-pointed: they propose steps BEYOND the shipped tuning, never behind
 * it, because a preset that quietly lowers a dial the game already ships
 * measures the opposite of what its label claims. The cue dials
 * (TUNING.CUES — stanchions, wind streaks, ground frequency) are reachable
 * from here now too; they were literals inside the render files.
 */

/** Deep-assign only keys the preset names, so nothing else drifts. */
export function applyPreset(TUNING, preset) {
  for (const [group, values] of Object.entries(preset.set)) {
    const target = group.split('.').reduce((o, k) => o?.[k], TUNING);
    if (!target) continue;
    for (const [k, v] of Object.entries(values)) target[k] = v;
  }
  return preset;
}

/** Snapshot the keys a preset set touches, so a lab can restore them. */
export function snapshot(TUNING, presets) {
  const out = {};
  for (const p of Object.values(presets)) {
    if (!p?.set) continue;
    for (const [group, values] of Object.entries(p.set)) {
      const target = group.split('.').reduce((o, k) => o?.[k], TUNING);
      if (!target) continue;
      out[group] ??= {};
      for (const k of Object.keys(values)) if (!(k in out[group])) out[group][k] = target[k];
    }
  }
  return out;
}

export const PRESETS = {
  baseline: {
    label: 'BASELINE',
    note: 'shipped',
    set: {},
  },

  // The obvious Sonic lever — make a mistake DUMP you — turns out to be
  // fatal on its own, because the Redline's pace (27) sits above the speed
  // floor (16 when this was written, 21 since RC8.3 — which is that same
  // finding, taken as far as the gated reading window allows). Anything
  // below pace means the gap is closing, so a
  // big loss is not drama, it is death: SPEED_LOSS 14 alone ends a run at
  // 181 m. Falling only becomes survivable drama if there is room BELOW to
  // fall into, so this drops the pace and the floor with the bigger loss.
  drop: {
    label: 'DROP',
    note: 'a miss dumps you — and there is room below to survive it',
    set: {
      RUN: { SPEED_GAIN_MAX: 6.5, SPEED_LOSS: 12, FLOOR: 11 },
      'MODES.DIFFICULTY.easy': { REDLINE_PACE: 17 },
      'MODES.DIFFICULTY.normal': { REDLINE_PACE: 20 },
      'MODES.DIFFICULTY.hard': { REDLINE_PACE: 23 },
    },
  },

  // The shipped economy, but the dash stops being a nudge. Armed at 34 of
  // 100 instead of 8, so it is a state you reach rather than a light that is
  // always on, and worth a full second minimum at a multiplier you feel.
  dashgear: {
    label: 'DASH GEAR',
    note: 'the dash becomes a mode you earn, not a light that is always on',
    set: {
      BOOST: { MIN_ACTIVATE: 34, SPEED_MULT: 1.75, ACCEL_MULT: 2.6 },
    },
  },

  // Both, plus the camera pushed a step PAST what RC8.3 shipped: the rig
  // closes in and drops lower still, and the lens stretches further across
  // the range. The old numbers here (-0.16 / 3.2 / 1.05 / 16 / 9) are the
  // shipped baseline now, so proposing them would have measured nothing.
  sonic: {
    label: 'SONIC',
    note: 'DROP + DASH GEAR + the camera pushed past the shipped tuning',
    set: {
      RUN: { SPEED_GAIN_MAX: 6.5, SPEED_LOSS: 12, FLOOR: 11 },
      'MODES.DIFFICULTY.easy': { REDLINE_PACE: 17 },
      'MODES.DIFFICULTY.normal': { REDLINE_PACE: 20 },
      'MODES.DIFFICULTY.hard': { REDLINE_PACE: 23 },
      BOOST: { MIN_ACTIVATE: 34, SPEED_MULT: 1.75, ACCEL_MULT: 2.6 },
      CAMERA: {
        BACK_SPEED_GAIN: -0.24,   // close in harder at speed
        HEIGHT_SPEED_DROP: 4.4,   // and drop lower
        FOV_SPEED_GAIN: 1.35,     // lens stretch across the range
        FOV_BOOST: 28,            // held while dashing
        LOOK_SPEED_AHEAD: 13,
      },
      'BOOST.DASH': { KICK_FOV: 18, KICK_DECAY: 3.0, STREAK_BURST: 1.6 },
    },
  },

  // RC8.3's own question, kept as a preset because the answer was a judgement
  // and the next person deserves the dial. The three FREQUENCY cues — posts,
  // rungs, streaks — are the ones that read as speed rather than as
  // intensity, and this is what "louder still" costs: at the ceiling it is
  // 4.6 posts and 16 rungs a second against the shipped 3.6 and 12.8.
  //
  // This one is a LOOK, not a curve: the cues are presentation and the sim
  // never reads them, so `npm run feel` reports it identical to BASELINE by
  // construction. Judge it in the browser with __FEEL('cues') and read the
  // numbers with __CUES().
  cues: {
    label: 'CUES LOUD',
    note: 'the frequency cues pushed past the shipped re-tune',
    set: {
      CUES: {
        STREAK_START: 0.22, STREAK_OPACITY: 0.66,
        PYLON_SPACING_M: 14, PYLON_PER_SIDE: 38, GRID_CELL_M: 4.0,
      },
    },
  },

  // "What if the Redline just went away and hearts were the fail state?"
  // The Redline's pace is set to zero, so it can never close the gap. This
  // one is deliberately shipped WITHOUT any other change, because the point
  // is to feel what it exposes: word-gates.js says in its own comment that
  // an omission "hands the consequence to the Redline's differential", so
  // with the Redline gone, letting every word slip costs nothing at all.
  // Only tapping a fake takes a heart. Do nothing and you cannot die.
  norush: {
    label: 'NO REDLINE',
    note: 'hearts as the only fail state — and nothing punishes doing nothing',
    set: {
      'MODES.DIFFICULTY.easy': { REDLINE_PACE: 0 },
      'MODES.DIFFICULTY.normal': { REDLINE_PACE: 0 },
      'MODES.DIFFICULTY.hard': { REDLINE_PACE: 0 },
    },
  },

  // The version that actually works: no Redline, and BOTH kinds of wrong
  // read cost a heart. Now "three mistakes and you are out" is the whole
  // rule, speed is a reward rather than a survival tax, and idling dies on
  // the third word instead of running forever. `omissionCostsHeart` is read
  // by dev/feel-lab.js, which patches the gate resolution — the sim has no
  // such rule today, which is exactly the change this preset is proposing.
  hearts: {
    label: 'HEARTS ONLY',
    note: 'no Redline + every wrong read costs a heart',
    omissionCostsHeart: true,
    set: {
      'MODES.DIFFICULTY.easy': { REDLINE_PACE: 0 },
      'MODES.DIFFICULTY.normal': { REDLINE_PACE: 0 },
      'MODES.DIFFICULTY.hard': { REDLINE_PACE: 0 },
    },
  },
};

export default PRESETS;
