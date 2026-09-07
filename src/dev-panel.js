/**
 * On-screen tuning panel, for playtesting on a device that has no console.
 *
 * Loaded ONLY under `?dev=1`, through a dynamic import, so it lands in its own
 * chunk and the normal build neither downloads nor parses it. Everything here
 * reaches the game through the same globals the console would use, so the
 * panel is a convenience over `window.__TUNING`, never a second source of
 * truth: change a value here and the console sees it, and the reverse.
 *
 * Deliberately not part of the game's presentation — plain controls, no house
 * typography, no naming. Nothing in it is player-facing.
 */

import TUNING from './TUNING.js';

const CSS = `
#devPanel{position:absolute;z-index:120;left:8px;bottom:8px;width:310px;max-height:82vh;
  overflow-y:auto;padding:9px 10px 11px;border:1px solid rgba(140,220,255,.35);
  border-radius:3px;background:rgba(6,11,16,.93);backdrop-filter:blur(6px);
  font:500 10px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#cfe8f5;pointer-events:auto}
#devPanel.min{width:auto;max-height:none;overflow:visible;padding:6px 9px}
#devPanel.min .body{display:none}
#devPanel h4{margin:0 0 7px;font:700 9px/1 ui-monospace,monospace;letter-spacing:.16em;
  color:#8be4ff;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
#devPanel .grp{margin:9px 0 0;padding-top:7px;border-top:1px solid rgba(255,255,255,.09)}
#devPanel .lbl{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px;
  color:rgba(207,232,245,.72)}
#devPanel .lbl b{color:#eafaff;font-weight:700}
#devPanel input[type=range]{width:100%;height:16px;margin:0 0 4px;accent-color:#67d8ff}
#devPanel .row{display:flex;flex-direction:column;gap:4px;margin-bottom:5px}
#devPanel .row.wide button{width:100%;text-align:left;padding:7px 9px}
#devPanel button{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.06);color:#dff2fc;border-radius:2px;padding:5px 7px;
  font:600 9px/1 ui-monospace,monospace;letter-spacing:.06em}
#devPanel button.on{background:#67d8ff;border-color:#67d8ff;color:#06121a}
#devPanel button:active{background:rgba(255,255,255,.16)}
#devPanel .find{width:100%;margin:0 0 7px;padding:5px 6px;border-radius:2px;
  border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#eafaff;
  font:600 10px/1 ui-monospace,monospace}
#devPanel .sec>summary{cursor:pointer;list-style:none;padding:5px 0;color:#8be4ff;
  font:700 9px/1 ui-monospace,monospace;letter-spacing:.14em;
  border-top:1px solid rgba(255,255,255,.09)}
#devPanel .sec>summary::-webkit-details-marker{display:none}
#devPanel .sec>summary::before{content:'▸ ';opacity:.7}
#devPanel .sec[open]>summary::before{content:'▾ '}
#devPanel .knob{display:grid;grid-template-columns:1fr auto;gap:2px 6px;
  align-items:center;margin:0 0 4px}
#devPanel .knob .k{color:rgba(207,232,245,.66);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;direction:rtl;text-align:left}
#devPanel .knob.dirty .k{color:#caff4a}
#devPanel .knob input[type=number],#devPanel .knob input[type=text]{width:74px;
  border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#eafaff;
  border-radius:2px;padding:3px 4px;font:600 10px/1 ui-monospace,monospace}
#devPanel .knob input[type=range]{grid-column:1/-1;margin:0}
#devPanel .knob.ro input{opacity:.45;pointer-events:none}
#devPanel .io{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
#devPanel .io button{flex:1 1 auto}
#devPanel textarea{width:100%;height:88px;margin-top:5px;resize:vertical;
  border:1px solid rgba(255,255,255,.2);background:rgba(6,11,16,.9);color:#cfe8f5;
  border-radius:2px;padding:5px;font:500 9px/1.3 ui-monospace,monospace}
#devPanel .note{color:rgba(207,232,245,.5);margin-top:4px}
`;

/**
 * RC11.5 — EVERY tuning value, reflectively.
 *
 * The panel used to carry a hand-written list of nine sliders, which meant the
 * 360 other numbers in TUNING.js were reachable only from a console. This
 * walks the tree instead, so a knob added to TUNING appears here with no edit
 * to this file, and the export is the diff a human can paste back into
 * TUNING.js — not a wall of 369 values that says nothing about what moved.
 *
 * Frozen sub-objects (RESERVED_HUES, COSMETICS) render read-only rather than
 * silently swallowing an edit.
 */
const DEFAULTS = new Map();
function walkTuning(obj = TUNING, base = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const path = base ? `${base}.${k}` : k;
    if (Array.isArray(v)) {
      if (v.every((x) => typeof x === 'number' || typeof x === 'string')) {
        v.forEach((_, i) => out.push({ path: `${path}.${i}`, frozen: Object.isFrozen(v) }));
      } else walkTuning(v, path, out);
    } else if (v && typeof v === 'object') {
      walkTuning(v, path, out);
    } else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
      out.push({ path, frozen: Object.isFrozen(obj) });
    }
  }
  return out;
}

/** Sensible slider bounds for a number we know nothing about but its value. */
function bounds(v) {
  if (!Number.isFinite(v)) return null;
  if (Number.isInteger(v) && Math.abs(v) <= 12) return { min: Math.min(0, v - 4), max: v + 8, step: 1 };
  const mag = Math.abs(v) || 1;
  const max = mag * (v > 0 ? 3 : 1) + (v <= 0 ? mag * 2 : 0);
  const min = v < 0 ? v * 3 : 0;
  const span = max - min;
  const step = span > 200 ? 1 : span > 20 ? 0.1 : span > 2 ? 0.01 : 0.001;
  return { min: +min.toFixed(4), max: +max.toFixed(4), step };
}

/** Every value that differs from the defaults captured at mount, by path. */
function changed() {
  const out = {};
  for (const [path, was] of DEFAULTS) {
    const now = get(path);
    if (now !== was) out[path] = now;
  }
  return out;
}

/** A tuning value, addressed by path so the panel and the console agree. */
function get(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), TUNING);
}
function set(path, v) {
  const keys = path.split('.');
  const last = keys.pop();
  const obj = keys.reduce((o, k) => o[k], TUNING);
  obj[last] = v;
}

const SLIDERS = [
  { path: 'WORDS.LOOKAHEAD_OPACITY.0', label: 'plate 1 fade', min: 0.05, max: 1, step: 0.01 },
  { path: 'WORDS.LOOKAHEAD_OPACITY.1', label: 'plate 2 fade', min: 0.05, max: 1, step: 0.01 },
  { path: 'WORDS.LOOKAHEAD_OPACITY.2', label: 'plate 3 fade', min: 0.05, max: 1, step: 0.01 },
  { path: 'WORDS.EARLY_MULT', label: 'early read pays', min: 1, max: 6, step: 0.25 },
  { path: 'SCORE.TIER_MULT.4', label: 'hardest word pays', min: 1, max: 3, step: 0.05 },
  { path: 'RUN.CEILING', label: 'speed ceiling', min: 40, max: 110, step: 1 },
  { path: 'RUN.SPEED_GAIN_MAX', label: 'gain per read', min: 1, max: 10, step: 0.1 },
  { path: 'CAMERA.FOV_SPEED_GAIN', label: 'fov by speed', min: 0, max: 3, step: 0.05 },
  { path: 'CAMERA.MUSIC_PULSE_FOV', label: 'beat bob', min: 0, max: 80, step: 1 },
];

export async function mountDevPanel() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'devPanel';
  el.innerHTML = `<h4><span>TUNING</span><span data-min>—</span></h4><div class="body"></div>`;
  document.getElementById('app').appendChild(el);
  const body = el.querySelector('.body');

  el.querySelector('[data-min]').addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.toggle('min');
  });
  // The panel sits over the track, so nothing inside it may reach the game.
  for (const t of ['pointerdown', 'pointerup', 'click', 'touchstart']) {
    el.addEventListener(t, (e) => e.stopPropagation());
  }

  // ── Look treatments ─────────────────────────────────────────────────────
  const lab = await import('../dev/style-lab.js').catch(() => null);
  if (lab) {
    const g = document.createElement('div');
    g.className = 'grp';
    g.innerHTML = '<div class="lbl"><span>look</span></div><div class="row wide"></div>';
    const row = g.querySelector('.row');
    for (const name of ['current', ...Object.keys(lab.STYLES).filter((k) => k !== 'current')]) {
      const b = document.createElement('button');
      b.textContent = name;
      b.onclick = () => {
        lab.applyStyle(name);
        for (const o of row.children) o.classList.toggle('on', o === b);
      };
      row.appendChild(b);
    }
    row.firstChild.classList.add('on');
    body.appendChild(g);
  }

  // ── Lookahead count, live ───────────────────────────────────────────────
  {
    const g = document.createElement('div');
    g.className = 'grp';
    g.innerHTML = '<div class="lbl"><span>gates ahead</span><b data-v></b></div><div class="row wide"></div>';
    const row = g.querySelector('.row');
    const out = g.querySelector('[data-v]');
    const actors = () => window.__RENDER?.wordGateActors;
    out.textContent = actors()?.ahead?.length ?? TUNING.WORDS.LOOKAHEAD_GATES;
    for (let n = 0; n <= TUNING.WORDS.LOOKAHEAD_OPACITY.length; n++) {
      const b = document.createElement('button');
      b.textContent = n;
      b.onclick = () => {
        const applied = actors()?.setLookahead(n) ?? n;
        TUNING.WORDS.LOOKAHEAD_GATES = applied;
        out.textContent = applied;
        for (const o of row.children) o.classList.toggle('on', o === b);
      };
      if (n === (actors()?.ahead?.length ?? 3)) b.classList.add('on');
      row.appendChild(b);
    }
    body.appendChild(g);
  }

  // ── The nine that get reached for most, kept at the top ─────────────────
  {
    const g = document.createElement('div');
    g.className = 'grp';
    for (const s of SLIDERS) {
      const wrap = document.createElement('div');
      const v = Number(get(s.path));
      wrap.innerHTML = `<div class="lbl"><span>${s.label}</span><b>${v}</b></div>`;
      const input = document.createElement('input');
      input.type = 'range';
      Object.assign(input, { min: s.min, max: s.max, step: s.step, value: v });
      const out = wrap.querySelector('b');
      input.addEventListener('input', () => {
        const nv = Number(input.value);
        set(s.path, nv);
        out.textContent = nv;
        onEdit();
      });
      wrap.appendChild(input);
      g.appendChild(wrap);
    }
    body.appendChild(g);
  }

  // ── EVERY tuning value, by section ──────────────────────────────────────
  const leaves = walkTuning();
  for (const l of leaves) DEFAULTS.set(l.path, get(l.path));

  const rows = [];          // {path, el, sync}
  const find = document.createElement('input');
  find.className = 'find';
  find.type = 'search';
  find.placeholder = `find (${leaves.length} values)…`;
  body.appendChild(find);

  const sections = new Map();
  for (const leaf of leaves) {
    const top = leaf.path.split('.')[0];
    if (!sections.has(top)) {
      const d = document.createElement('details');
      d.className = 'sec';
      d.innerHTML = `<summary>${top}</summary>`;
      body.appendChild(d);
      sections.set(top, d);
    }
    sections.get(top).appendChild(makeKnob(leaf, rows, onEdit));
  }

  find.addEventListener('input', () => {
    const q = find.value.trim().toLowerCase();
    for (const r of rows) r.el.style.display = !q || r.path.toLowerCase().includes(q) ? '' : 'none';
    for (const [, d] of sections) {
      const any = [...d.querySelectorAll('.knob')].some((k) => k.style.display !== 'none');
      d.style.display = any ? '' : 'none';
      if (q && any) d.open = true;
    }
  });

  // ── Export / import ─────────────────────────────────────────────────────
  const io = document.createElement('div');
  io.className = 'grp';
  io.innerHTML = `<div class="lbl"><span>json</span><b data-n>0 changed</b></div>
    <div class="io">
      <button data-act="diff">export changed</button>
      <button data-act="all">export all</button>
      <button data-act="apply">apply</button>
      <button data-act="reset">reset all</button>
    </div>
    <textarea spellcheck="false" placeholder='{"RUN.CEILING": 70}'></textarea>
    <div class="note">paths are TUNING keys; apply writes them live</div>`;
  body.appendChild(io);
  const ta = io.querySelector('textarea');
  const nOut = io.querySelector('[data-n]');

  function onEdit() {
    const d = changed();
    nOut.textContent = `${Object.keys(d).length} changed`;
    for (const r of rows) r.sync?.();
    window.__RENDER?.judgment?.syncStyle?.();
    window.__JUDGE?.syncStyle?.();
  }

  io.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'diff') ta.value = JSON.stringify(changed(), null, 2);
    else if (act === 'all') {
      const all = {};
      for (const [path] of DEFAULTS) all[path] = get(path);
      ta.value = JSON.stringify(all, null, 2);
    } else if (act === 'apply') {
      try {
        const obj = JSON.parse(ta.value || '{}');
        let n = 0;
        for (const [path, v] of Object.entries(obj)) {
          if (!DEFAULTS.has(path)) continue;
          set(path, v);
          n++;
        }
        ta.value = `applied ${n} of ${Object.keys(obj).length}`;
      } catch (err) { ta.value = `not JSON: ${err.message}`; }
      onEdit();
    } else if (act === 'reset') {
      for (const [path, was] of DEFAULTS) set(path, was);
      ta.value = '';
      onEdit();
    }
  });
  onEdit();

  return el;
}

/** One row: a label, an editable field, and a slider where a slider helps. */
function makeKnob(leaf, rows, onEdit) {
  const { path, frozen } = leaf;
  const v0 = get(path);
  const wrap = document.createElement('div');
  wrap.className = `knob${frozen ? ' ro' : ''}`;
  const short = path.split('.').slice(1).join('.') || path;
  const label = document.createElement('span');
  label.className = 'k';
  label.textContent = short;
  label.title = path;
  wrap.appendChild(label);

  const field = document.createElement('input');
  const isNum = typeof v0 === 'number';
  const isBool = typeof v0 === 'boolean';
  field.type = isNum ? 'number' : 'text';
  if (isNum) field.step = 'any';
  field.value = isBool ? String(v0) : v0;
  wrap.appendChild(field);

  let range = null;
  if (isNum) {
    const b = bounds(v0);
    if (b) {
      range = document.createElement('input');
      range.type = 'range';
      Object.assign(range, { min: b.min, max: b.max, step: b.step, value: v0 });
      wrap.appendChild(range);
    }
  }

  const write = (raw) => {
    if (frozen) return;
    const v = isNum ? Number(raw) : isBool ? raw === 'true' : raw;
    if (isNum && !Number.isFinite(v)) return;
    set(path, v);
    onEdit();
  };
  field.addEventListener('change', () => { write(field.value); if (range) range.value = field.value; });
  range?.addEventListener('input', () => { write(range.value); field.value = range.value; });

  rows.push({
    path, el: wrap,
    sync: () => {
      const now = get(path);
      wrap.classList.toggle('dirty', now !== DEFAULTS.get(path));
      if (document.activeElement !== field) field.value = isBool ? String(now) : now;
      if (range && document.activeElement !== range) range.value = now;
    },
  });
  return wrap;
}

export default mountDevPanel;
