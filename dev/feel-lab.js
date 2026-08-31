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
 */
import TUNING from '../src/TUNING.js';
import { PRESETS, applyPreset, snapshot } from './feel-presets.js';

const ORIGINAL = snapshot(TUNING, PRESETS);

function restore() {
  for (const [group, values] of Object.entries(ORIGINAL)) {
    const target = group.split('.').reduce((o, k) => o?.[k], TUNING);
    if (!target) continue;
    for (const [k, v] of Object.entries(values)) target[k] = v;
  }
}

export function feel(name = 'baseline', { restart = true } = {}) {
  const preset = PRESETS[name];
  if (!preset) return `unknown preset — try ${Object.keys(PRESETS).join(', ')}`;
  restore();
  applyPreset(TUNING, preset);
  if (restart) { window.__QUIT?.(); window.__START?.(); }
  return {
    preset: preset.label,
    note: preset.note,
    gain: TUNING.RUN.SPEED_GAIN_MAX, loss: TUNING.RUN.SPEED_LOSS, floor: TUNING.RUN.FLOOR,
    pace: TUNING.MODES.DIFFICULTY.normal.REDLINE_PACE,
    armAt: TUNING.BOOST.MIN_ACTIVATE, dashMult: TUNING.BOOST.SPEED_MULT,
    fovGain: TUNING.CAMERA.FOV_SPEED_GAIN,
  };
}

window.__FEEL = feel;
window.__FEEL_PRESETS = PRESETS;

const fromUrl = new URLSearchParams(location.search).get('feel');
if (fromUrl && PRESETS[fromUrl]) feel(fromUrl, { restart: false });
