/**
 * Speed-feel presets (dev). Candidate tunings for the Sonic question, applied
 * to the live TUNING object so the real game runs at each of them.
 *
 * Nothing here is shipped. `dev/feel-lab.js` applies these in the browser via
 * ?feel=/__FEEL(); `tools/feel-measure.mjs` drives real sims at each and
 * reports what a run actually feels like in numbers.
 *
 * The question being explored: the shipped tuning has a wide DESIGN range
 * (16..64, 4x) but a narrow LIVED one. At a steady accuracy the speed sits at
 * an equilibrium and a miss moves it 6 m/s — about an eighth — so moment to
 * moment the run is nearly flat. Sonic's feel is the opposite: a mistake dumps
 * you, and climbing back out is the whole sensation.
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
  // fatal on its own, because the Redline's pace (27) sits 11 m/s above the
  // speed floor (16). Anything below pace means the gap is closing, so a
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

  // Both, plus the camera actually selling the top end: the rig closes in
  // and drops low as you accelerate instead of pulling back, and the lens
  // stretches far harder across the range.
  sonic: {
    label: 'SONIC',
    note: 'DROP + DASH GEAR + the camera sells it',
    set: {
      RUN: { SPEED_GAIN_MAX: 6.5, SPEED_LOSS: 12, FLOOR: 11 },
      'MODES.DIFFICULTY.easy': { REDLINE_PACE: 17 },
      'MODES.DIFFICULTY.normal': { REDLINE_PACE: 20 },
      'MODES.DIFFICULTY.hard': { REDLINE_PACE: 23 },
      BOOST: { MIN_ACTIVATE: 34, SPEED_MULT: 1.75, ACCEL_MULT: 2.6 },
      CAMERA: {
        BACK_SPEED_GAIN: -0.16,   // close in at speed instead of pulling back
        HEIGHT_SPEED_DROP: 3.2,   // and drop low
        FOV_SPEED_GAIN: 1.05,     // lens stretch across the range
        FOV_BOOST: 16,            // held while dashing
        LOOK_SPEED_AHEAD: 9,
      },
      'BOOST.DASH': { KICK_FOV: 13, KICK_DECAY: 3.0, STREAK_BURST: 1.25 },
    },
  },
};

export default PRESETS;
