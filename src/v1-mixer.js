import TUNING from './TUNING.js';
import { Audio } from './audio/audio.js';
import { ApprovedAudioAssets } from './audio/approved-assets.js';

const STORAGE_KEY = 'dictiondash:live-mix';
const ENABLED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mix') === '1';
const DEFAULT_DB = Object.freeze({
  master: 0,
  wind: 0,
  surface: 0,
  bells: 0,
  heartbeat: 0,
  beast: 0,
});
const BASE = Object.freeze({
  master: TUNING.AUDIO.MASTER,
  windMax: TUNING.AUDIO.WIND_MAX,
  surfaceGlide: globalThis.__DASH_V1_FINAL_MIX?.surfaceGlide ?? 0.075,
  roarMax: TUNING.AUDIO.ROAR_MAX,
});

const dbToGain = (db) => Math.pow(10, Number(db || 0) / 20);
const clampDb = (v) => Math.max(-24, Math.min(12, Number(v) || 0));

let db = { ...DEFAULT_DB };
if (ENABLED) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(DEFAULT_DB)) if (Number.isFinite(saved[key])) db[key] = clampDb(saved[key]);
    }
  } catch { /* calibration storage is optional */ }
}

function gain(key) { return dbToGain(db[key] ?? 0); }
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
    base: {
      master: BASE.master,
      windMax: TUNING.AUDIO.WIND_MAX,
      surfaceGlide: globalThis.__DASH_V1_FINAL_MIX?.surfaceGlide ?? BASE.surfaceGlide,
      roarMax: TUNING.AUDIO.ROAR_MAX,
    },
  };
}

globalThis.__DASH_MIX = {
  enabled: ENABLED,
  get db() { return { ...db }; },
  gain,
  setDb,
  reset,
  snapshot,
};

// Category-wrap the already-final bell and Hunt-pulse implementations so every
// nested procedural layer (base + ship polish + final mix) follows one fader.
if (!Audio.prototype.__v1LiveMixCategories) {
  Audio.prototype.__v1LiveMixCategories = true;

  const baseTone = Audio.prototype._tone;
  Audio.prototype._tone = function toneV1Mix(options = {}) {
    const category = this.__v1MixCategory;
    const mult = category === 'bells' ? gain('bells') : category === 'heartbeat' ? gain('heartbeat') : 1;
    if (mult === 1) return baseTone.call(this, options);
    return baseTone.call(this, { ...options, vol: (options.vol ?? 0.1) * mult });
  };

  const baseBurst = Audio.prototype._burst;
  Audio.prototype._burst = function burstV1Mix(dur, vol, ...args) {
    const category = this.__v1MixCategory;
    const mult = category === 'bells' ? gain('bells') : category === 'heartbeat' ? gain('heartbeat') : 1;
    return baseBurst.call(this, dur, vol * mult, ...args);
  };

  const baseBell = Audio.prototype.bell;
  Audio.prototype.bell = function bellV1LiveMix(...args) {
    const prev = this.__v1MixCategory;
    this.__v1MixCategory = 'bells';
    try { return baseBell.apply(this, args); }
    finally { this.__v1MixCategory = prev; }
  };

  const basePulse = Audio.prototype._huntPulse;
  Audio.prototype._huntPulse = function pulseV1LiveMix(...args) {
    const prev = this.__v1MixCategory;
    this.__v1MixCategory = 'heartbeat';
    try { return basePulse.apply(this, args); }
    finally { this.__v1MixCategory = prev; }
  };

  // Last word in the continuous mix. Defaults are unity; ?mix=1 supplies live
  // calibration multipliers without changing deterministic simulation state.
  const baseUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateV1LiveMix(dt, player, bands, running) {
    const out = baseUpdate.call(this, dt, player, bands, running);
    if (!this.ready || !this.ctx || !player) return out;

    const sim = globalThis.__SIM;
    const phase = sim?.phase;
    const kill = phase === 'kill' || phase === 'dead';
    const live = !!running && !kill;
    const speedN = Math.max(0, Math.min(1, (player.speed - 10) / (TUNING.RUN.CEILING - 10)));
    const edge = player.airborne ? 0 : Math.max(0, Math.min(1, Math.abs(player.heading) / TUNING.PLAYER.MAX_CARVE));
    const onGround = live && !player.airborne && !player.onIce && !player.inPowder;

    if (this.wind?.gain?.gain) {
      const target = TUNING.AUDIO.WIND_MAX * speedN * speedN * (player.airborne ? 1.18 : 0.82) * gain('wind');
      this._set(this.wind.gain.gain, target, 0.06);
    }

    if (this.glide?.gain?.gain) {
      const glideBase = globalThis.__DASH_V1_FINAL_MIX?.surfaceGlide ?? BASE.surfaceGlide;
      const glide = glideBase * (0.32 + speedN * 0.68) * gain('surface');
      this._set(this.glide.gain.gain, onGround ? glide * (0.48 + edge * 1.35) : 0, 0.045);
    }

    if (this.roar?.gain?.gain) {
      this._set(this.roar.gain.gain, TUNING.AUDIO.ROAR_MAX * Math.max(0, Math.min(1, bands?.roar || 0)) * gain('beast'), 0.045);
    }

    if (this.master?.gain && !this.muted) {
      this._set(this.master.gain, TUNING.AUDIO.MASTER * gain('master'), 0.05);
    }

    return out;
  };
}

// Approved recordings use the same faders. This keeps the calibration panel
// representative of the release mix instead of controlling only procedural FX.
if (!ApprovedAudioAssets.prototype.__v1LiveMix) {
  ApprovedAudioAssets.prototype.__v1LiveMix = true;
  const baseLoop = ApprovedAudioAssets.prototype.setLoop;
  ApprovedAudioAssets.prototype.setLoop = function setLoopV1Mix(id, target, options = {}) {
    let scale = 1;
    if (id === 'page_grain_bed') scale = 1.12 * gain('wind');
    return baseLoop.call(this, id, target * scale, options);
  };

  const baseShot = ApprovedAudioAssets.prototype.oneShot;
  ApprovedAudioAssets.prototype.oneShot = function oneShotV1Mix(id, options = {}) {
    let scale = 1;
    if (id === 'beast_main_distant' || id === 'beast_main_leap' ||
        id === 'frost_beast_enter' || id === 'frost_beast_charge' || id === 'frost_beast_vault' || id === 'frost_beast_kill') {
      scale = gain('beast');
    }
    return baseShot.call(this, id, { ...options, gain: (options.gain ?? 1) * scale });
  };
}

function createMixerUi() {
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
    ['wind', 'WIND', -18, 9],
    ['surface', 'SURFACE', -24, 9],
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

createMixerUi();

globalThis.__DASH_V1_MIXER = {
  version: '1.0',
  hiddenByDefault: true,
  query: '?mix=1',
  dbFaders: true,
  copySnapshot: true,
  persistentCalibration: ENABLED,
  noExtraRaf: true,
};
