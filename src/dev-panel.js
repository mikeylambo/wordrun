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
#devPanel{position:absolute;z-index:120;left:8px;bottom:8px;width:236px;max-height:74vh;
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
`;

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

  // ── Numbers ─────────────────────────────────────────────────────────────
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
      });
      wrap.appendChild(input);
      g.appendChild(wrap);
    }
    body.appendChild(g);
  }

  return el;
}

export default mountDevPanel;
