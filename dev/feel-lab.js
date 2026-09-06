/**
 * Dev-only speed-feel lab. Never imported by src/, never bundled.
 *
 *   await import('/dev/feel-lab.js');
 *   __FEEL('sonic')   // applies the preset and restarts the run
 *   __FEEL()          // back to baseline
 *
 * The Redline's pace is read at sim.start(), so a preset that changes it only
 * takes effect on a fresh run — __FEEL restarts for you rather than leaving
 * you in a half-applied state, which is exactly the trap that made the first
 * headless measurement of these presets meaningless.
 *
 * RC8.3 adds the CUE readout:
 *
 *   __CUES()          // every speed cue, at the floor / start / cruise / ceiling
 *
 * The speed cues (camera, stanchions, wind streaks, ground frequency) are all
 * keyed off the SAME normalised speed the sim's curve lives in — speedN =
 * (v − RUN.FLOOR) / (RUN.CEILING − RUN.FLOOR) — so moving RUN.FLOOR silently
 * re-tunes every one of them. That is exactly what RC8.3 did, and the reason
 * the cue dials came out of the render files into TUNING.CUES: what the world
 * is doing at a given speed has to be readable in a table, not inferred from
 * three literals in two modules.
 */
import TUNING from '../src/TUNING.js';
import { PRESETS, applyPreset, snapshot } from './feel-presets.js';
import { WordGates } from '../src/sim/word-gates.js';

const ORIGINAL = snapshot(TUNING, PRESETS);

function restore() {
  for (const [group, values] of Object.entries(ORIGINAL)) {
    const target = group.split('.').reduce((o, k) => o?.[k], TUNING);
    if (!target) continue;
    for (const [k, v] of Object.entries(values)) target[k] = v;
  }
}

// Some proposals are a rule, not a number. This one patches the gate
// resolution so a word that slips past costs a heart the same way tapping a
// fake does — rc5's step wrapper turns obstaclesHit into the heart loss, so
// incrementing it here is exactly the change a real implementation would make.
if (!WordGates.prototype.__feelOmissionPatched) {
  WordGates.prototype.__feelOmissionPatched = true;
  const baseStep = WordGates.prototype.step;
  WordGates.prototype.step = function stepFeel(player, confirm, events, prox) {
    const g = this.current();
    const wasResolved = g?.resolved;
    const out = baseStep.call(this, player, confirm, events, prox);
    if (window.__FEEL_OMISSION_HEART && !wasResolved && g?.resolved &&
        !g.correct && g.real) {
      player.obstaclesHit++;   // an omission now costs a heart too
    }
    return out;
  };
}

export function feel(name = 'baseline', { restart = true } = {}) {
  const preset = PRESETS[name];
  if (!preset) return `unknown preset — try ${Object.keys(PRESETS).join(', ')}`;
  restore();
  applyPreset(TUNING, preset);
  window.__FEEL_OMISSION_HEART = !!preset.omissionCostsHeart;
  if (restart) { window.__QUIT?.(); window.__START?.(); }
  return {
    preset: preset.label,
    note: preset.note,
    gain: TUNING.RUN.SPEED_GAIN_MAX, loss: TUNING.RUN.SPEED_LOSS, floor: TUNING.RUN.FLOOR,
    pace: TUNING.MODES.DIFFICULTY.normal.REDLINE_PACE,
    armAt: TUNING.BOOST.MIN_ACTIVATE, dashMult: TUNING.BOOST.SPEED_MULT,
    fovGain: TUNING.CAMERA.FOV_SPEED_GAIN,
    omissionCostsHeart: !!preset.omissionCostsHeart,
    cues: cues(),
  };
}

/**
 * What every speed cue is doing at a given speed. The four families the world
 * sells speed with, in the units they are actually drawn in — degrees, metres,
 * opacity, and things per second, which is the one that reads as speed rather
 * than as intensity.
 */
export function cues(speeds = null) {
  const R = TUNING.RUN, C = TUNING.CAMERA, CU = TUNING.CUES;
  const cruise = (() => {
    let v = R.START_SPEED;
    for (let i = 0; i < TUNING.WORDS.CRUISE_READS; i++) {
      v += R.SPEED_GAIN_MAX * (R.CEILING - v) / (R.CEILING - R.FLOOR);
    }
    return Math.round(v * 100) / 100;
  })();
  const at = speeds || [R.FLOOR, R.START_SPEED, cruise, R.CEILING];
  const rows = at.map((v) => {
    const n = Math.max(0, Math.min(1, (v - R.FLOOR) / (R.CEILING - R.FLOOR)));
    const streak = Math.max(0, Math.min(1, (n - CU.STREAK_START) / (1 - CU.STREAK_START)));
    return {
      speed: v,
      speedN: +n.toFixed(3),
      fov: +(C.FOV + n * C.FOV_SPEED_GAIN * 20).toFixed(2),
      boomBack: +(C.BACK + n * C.BACK_SPEED_GAIN * 20).toFixed(2),
      boomHeight: +(C.HEIGHT - n * C.HEIGHT_SPEED_DROP).toFixed(2),
      lookAhead: +(C.LOOK_AHEAD + n * C.LOOK_SPEED_AHEAD).toFixed(2),
      streakOpacity: +(streak * CU.STREAK_OPACITY).toFixed(3),
      pylonsPerSec: +(v / CU.PYLON_SPACING_M).toFixed(2),
      rungsPerSec: +(v / CU.GRID_CELL_M).toFixed(2),
    };
  });
  console.table(rows);
  return rows;
}

window.__FEEL = feel;
window.__CUES = cues;
window.__FEEL_PRESETS = PRESETS;

const fromUrl = new URLSearchParams(location.search).get('feel');
if (fromUrl && PRESETS[fromUrl]) feel(fromUrl, { restart: false });
