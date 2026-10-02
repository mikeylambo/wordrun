/**
 * The mix levels — one owner for every number between a voice and the master.
 *
 * Two layers, multiplied:
 *
 *   APPROVED — the user-approved V1 mix, captured live on-device with ?mix=1
 *     (2026-08-11). It is the canonical 0 dB reference: bells +4, heartbeat +6,
 *     beast +1. `surface: -5.5` is recorded here as approved but has nothing to
 *     scale since Phase 27 removed the surface beds.
 *   TRIM — the hidden live calibration panel (?mix=1 only), relative dB around
 *     APPROVED, persisted device-locally. Unity everywhere unless the panel is
 *     open, so a release build hears APPROVED exactly.
 *
 * This used to be two files (v1-mixer.js, v1-approved-mix.js) that each
 * re-wrapped Audio.prototype._tone/_burst/bell/_huntPulse/update and
 * ApprovedAudioAssets.prototype.setLoop/oneShot at import time, in an order
 * that only the import list in rc9-audio.js decided. audio/audio.js now asks
 * this module for a category's gain and applies it itself.
 */

import TUNING from '../TUNING.js';

const STORAGE_KEY = 'dictiondash:live-mix';
const ENABLED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mix') === '1';

export const APPROVED_DB = Object.freeze({
  master: 0,
  surface: -5.5,
  bells: 4,
  heartbeat: 6,
  beast: 1,
});

// Only faders something actually reads. The old BED and SURFACE rows scaled a
// recorded loop nothing plays and a bus nothing trims; a fader that moves
// nothing is worse than no fader.
const DEFAULT_DB = Object.freeze({
  master: 0,
  bells: 0,
  heartbeat: 0,
  beast: 0,
});

const dbToGain = (db) => Math.pow(10, Number(db || 0) / 20);
const clampDb = (v) => Math.max(-24, Math.min(12, Number(v) || 0));

const APPROVED = Object.freeze(Object.fromEntries(
  Object.entries(APPROVED_DB).map(([key, value]) => [key, dbToGain(value)]),
));

let db = { ...DEFAULT_DB };
if (ENABLED) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(DEFAULT_DB)) if (Number.isFinite(saved[key])) db[key] = clampDb(saved[key]);
    }
  } catch { /* calibration storage is optional */ }
}

/** The live trim for a fader, as a linear gain (1 unless ?mix=1 moved it). */
export function trim(key) { return dbToGain(db[key] ?? 0); }

/** The approved reference gain for a fader (1 for anything not approved). */
export function approved(key) { return APPROVED[key] ?? 1; }

/**
 * The gain a procedural voice in `category` plays at: approved × trim. Only
 * the bell and the heartbeat categories carry a fader; everything else is 1.
 */
export function categoryGain(category) {
  if (category !== 'bells' && category !== 'heartbeat') return 1;
  return approved(category) * trim(category);
}

function save() {
  if (!ENABLED) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* optional */ }
}
function setDb(key, value) {
  if (!(key in DEFAULT_DB)) return;
  db[key] = clampDb(value);
  save();
}
function reset() {
  db = { ...DEFAULT_DB };
  save();
}
function snapshot() {
  return {
    db: { ...db },
    base: { master: TUNING.AUDIO.MASTER, roarMax: TUNING.AUDIO.ROAR_MAX },
  };
}

// The previous calibration values were persisted by the live mixer. Clear them
// once when the approved baseline first arrives so they are not applied twice.
try {
  const markerKey = 'dictiondash:live-mix-baseline';
  const marker = 'approved-2026-08-11-a';
  if (localStorage.getItem(markerKey) !== marker) {
    reset();
    localStorage.setItem(markerKey, marker);
  }
} catch { /* storage is optional */ }

export const LIVE_MIX = {
  enabled: ENABLED,
  get db() { return { ...db }; },
  approvedDb: APPROVED_DB,
  setDb,
  reset,
  snapshot,
};

/** The ?mix=1 calibration dock. Mounted by main.js only when enabled. */
export function mountMixPanel() {
  if (!ENABLED || typeof document === 'undefined' || document.getElementById('v1LiveMixer')) return;

  const style = document.createElement('style');
  style.id = 'v1-live-mixer-style';
  style.textContent = `
    #v1MixDock{position:fixed;z-index:180;left:max(10px,env(safe-area-inset-left,0px));bottom:max(10px,env(safe-area-inset-bottom,0px));font-family:ui-monospace,"SF Mono",monospace;color:#f4fafc;pointer-events:auto}
    #v1MixToggle{border:1px solid rgba(255,255,255,.3);background:rgba(9,15,20,.78);color:#fff;padding:9px 11px;font:700 10px/1 inherit;letter-spacing:.16em;backdrop-filter:blur(8px);border-radius:3px}
    #v1LiveMixer{display:none;width:min(310px,86vw);margin-bottom:7px;padding:12px;background:rgba(7,12,16,.90);border:1px solid rgba(255,255,255,.18);border-radius:4px;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.24)}
    #v1LiveMixer.open{display:block}
    #v1LiveMixer h3{margin:0 0 4px;font:700 11px/1 inherit;letter-spacing:.18em}
    #v1LiveMixer .sub{margin:0 0 10px;font:700 8px/1.35 inherit;letter-spacing:.07em;opacity:.58}
    .v1MixRow{display:grid;grid-template-columns:78px 1fr 54px;gap:8px;align-items:center;margin:8px 0}
    .v1MixRow label{font:700 9px/1 inherit;letter-spacing:.08em}
    .v1MixRow input{width:100%;accent-color:#67d8ff;touch-action:none}
    .v1MixVal{text-align:right;font:600 9px/1 inherit;font-variant-numeric:tabular-nums;opacity:.82}
    .v1MixActions{display:flex;gap:7px;margin-top:11px}
    .v1MixActions button{flex:1;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;padding:9px 7px;font:700 8px/1 inherit;letter-spacing:.12em}
  `;
  document.head.appendChild(style);

  const dock = document.createElement('div');
  dock.id = 'v1MixDock';
  dock.dataset.rc2Ui = '1';
  const panel = document.createElement('div');
  panel.id = 'v1LiveMixer';
  panel.innerHTML = '<h3>V1 LIVE MIX</h3><div class="sub">RELATIVE dB · DEVICE-LOCAL · ?mix=1 ONLY</div>';

  const rows = [
    ['master', 'MASTER', -18, 6],
    ['bells', 'BELLS', -18, 9],
    ['heartbeat', 'HEARTBEAT', -18, 9],
    ['beast', 'BEAST', -18, 9],
  ];

  const outputs = new Map();
  const sliders = new Map();
  const sync = () => {
    for (const [key] of rows) {
      const slider = sliders.get(key);
      const out = outputs.get(key);
      if (!slider || !out) continue;
      slider.value = String(db[key]);
      out.textContent = `${db[key] >= 0 ? '+' : ''}${db[key].toFixed(1)} dB`;
    }
  };

  for (const [key, label, min, max] of rows) {
    const row = document.createElement('div');
    row.className = 'v1MixRow';
    const lab = document.createElement('label');
    lab.textContent = label;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = '0.5';
    slider.value = String(db[key]);
    slider.setAttribute('aria-label', `${label} level`);
    const out = document.createElement('div');
    out.className = 'v1MixVal';
    slider.addEventListener('input', () => {
      setDb(key, Number(slider.value));
      out.textContent = `${db[key] >= 0 ? '+' : ''}${db[key].toFixed(1)} dB`;
    });
    row.append(lab, slider, out);
    panel.appendChild(row);
    sliders.set(key, slider);
    outputs.set(key, out);
  }

  const actions = document.createElement('div');
  actions.className = 'v1MixActions';
  const copy = document.createElement('button');
  copy.textContent = 'COPY MIX';
  const resetButton = document.createElement('button');
  resetButton.textContent = 'RESET';
  actions.append(copy, resetButton);
  panel.appendChild(actions);

  const toggle = document.createElement('button');
  toggle.id = 'v1MixToggle';
  toggle.textContent = 'MIX';
  toggle.type = 'button';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });

  copy.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = JSON.stringify(snapshot(), null, 2);
    try { await navigator.clipboard.writeText(text); copy.textContent = 'COPIED'; }
    catch { copy.textContent = 'COPY FAILED'; }
    setTimeout(() => { copy.textContent = 'COPY MIX'; }, 900);
  });
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    reset();
    sync();
  });

  dock.addEventListener('pointerdown', (e) => e.stopPropagation());
  dock.addEventListener('pointerup', (e) => e.stopPropagation());
  dock.append(panel, toggle);
  document.body.appendChild(dock);
  sync();
}

