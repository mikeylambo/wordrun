/**
 * The curve screen. Figures only — no naming, no chrome, and nothing that
 * competes with the four names the game is allowed.
 *
 * Phase 1: the screen the data always deserved. Each tier is a sparkline of its
 * accuracy over the last two weeks, not a single bar — the SHAPE of the line is
 * the point, because seeing yourself climb is a better reason to come back than
 * any delta. Below it, the gallery: the words you have beaten outright, the
 * one thing here no other player's run can copy.
 */

const CSS = `
#curveScreen{position:absolute;inset:0;z-index:78;display:none;align-items:center;justify-content:center;
  padding:24px;background:rgba(6,11,16,.94);backdrop-filter:blur(8px);color:#eaf6fc}
#curveScreen.on{display:flex}
#curveScreen .card{width:min(92vw,400px);max-height:82vh;overflow-y:auto;text-align:left}
#curveScreen h3{font:800 11px/1 var(--face);letter-spacing:.26em;color:#8be4ff;margin:0 0 16px;text-align:center}
#curveScreen .cRow{display:grid;grid-template-columns:60px 1fr 76px;gap:10px;align-items:center;
  padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)}
#curveScreen .cK{font:600 8px/1.4 var(--face);letter-spacing:.2em;color:var(--dimmer)}
#curveScreen .spark{display:block;width:100%;height:26px;overflow:visible}
#curveScreen .spark polyline{fill:none;stroke:var(--ice);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}
#curveScreen .spark .dot{fill:var(--ice)}
#curveScreen .spark .base{stroke:rgba(103,216,255,.14);stroke-width:1}
#curveScreen .cV{font:700 12px/1 var(--face);text-align:right;letter-spacing:-.01em}
#curveScreen .cV s{color:var(--dimmer);text-decoration:none;font-weight:500;font-size:10px;margin-right:5px}
#curveScreen .up{color:#8be4ff}
#curveScreen .down{color:rgba(255,150,142,.85)}
#curveScreen .cHead{font:700 8px/1 var(--face);letter-spacing:.24em;color:var(--dimmer);margin:20px 0 8px}
#curveScreen .bRow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:baseline;padding:7px 0;
  border-bottom:1px solid rgba(255,255,255,.06)}
#curveScreen .bW{font:700 13px/1.2 var(--face);letter-spacing:-.01em;color:#eaf6fc}
#curveScreen .bMeta{font:500 9px/1.3 var(--face);letter-spacing:.04em;color:rgba(232,244,251,.5);text-align:right;white-space:nowrap}
#curveScreen .note{font:500 10px/1.5 var(--face);color:rgba(232,244,251,.5);margin:14px 0 0;text-align:center}
#curveScreen .btn{display:block;width:100%;margin-top:20px}
`;

const SPARK_W = 100;
const SPARK_H = 26;

/**
 * A thin polyline over a values array (0..1 pre-normalised), oldest → newest.
 * `null` days break the line into separate segments rather than drawing a
 * straight lie across a gap. The most recent real point gets a dot so the eye
 * lands on "where you are now".
 */
function spark(norm) {
  const n = norm.length;
  if (n < 2) return '';
  const x = (i) => (n === 1 ? 0 : (i / (n - 1)) * SPARK_W);
  const y = (v) => SPARK_H - 1 - v * (SPARK_H - 2);
  const segments = [];
  let run = [];
  for (let i = 0; i < n; i++) {
    if (norm[i] == null) { if (run.length) { segments.push(run); run = []; } continue; }
    run.push(`${x(i).toFixed(1)},${y(norm[i]).toFixed(1)}`);
  }
  if (run.length) segments.push(run);
  if (!segments.length) return '';
  let lastX = 0, lastY = 0;
  for (let i = n - 1; i >= 0; i--) { if (norm[i] != null) { lastX = x(i); lastY = y(norm[i]); break; } }
  const polys = segments.map((pts) =>
    pts.length === 1
      ? `<circle class="dot" cx="${pts[0].split(',')[0]}" cy="${pts[0].split(',')[1]}" r="1.6"/>`
      : `<polyline points="${pts.join(' ')}"/>`).join('');
  return `<svg class="spark" viewBox="0 0 ${SPARK_W} ${SPARK_H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<line class="base" x1="0" y1="${SPARK_H - 1}" x2="${SPARK_W}" y2="${SPARK_H - 1}"/>`
    + `${polys}<circle class="dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="1.9"/></svg>`;
}

const firstLast = (arr) => {
  let first = null, last = null;
  for (const v of arr) { if (v != null) { if (first == null) first = v; last = v; } }
  return { first, last };
};

const relDate = (at, now = Date.now()) => {
  const days = Math.floor((now - at) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const wk = Math.floor(days / 7);
  return wk === 1 ? 'a week ago' : `${wk}w ago`;
};

/**
 * @param getData () => { series, beaten } — `series` is CurveLog.series(),
 *   `beaten` is NemesisLedger.beatenWords(). A single getter so the screen
 *   pulls fresh state every time it opens.
 */
export function buildCurveScreen(getData) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'curveScreen';
  el.innerHTML = '<div class="card"><h3>PROFILE</h3><div id="curveBody"></div>' +
    '<button class="btn" id="curveClose" data-rc2-ui>DONE</button></div>';
  document.getElementById('app').appendChild(el);
  const body = el.querySelector('#curveBody');

  const delta = (d, unit = '', invert = false) => {
    if (d == null || d === 0) return '';
    const good = invert ? d < 0 : d > 0;
    const sign = d > 0 ? '+' : '−';
    return `<s class="${good ? 'up' : 'down'}">${sign}${Math.abs(d)}${unit}</s>`;
  };

  const render = () => {
    const { series, beaten } = getData() || {};
    const rows = [];
    const hasTrend = series && series.tiers.length > 0;

    if (!hasTrend && (!beaten || beaten.length === 0)) {
      rows.push('<p class="note">Play a few runs and this fills in.</p>');
      body.innerHTML = rows.join('');
      return;
    }

    if (hasTrend) {
      for (const tier of series.tiers) {
        const vals = series.accuracy[tier];
        const { first, last } = firstLast(vals);
        if (last == null) continue;
        rows.push(`<div class="cRow"><span class="cK">TIER ${tier}</span>` +
          `<span>${spark(vals.map((v) => (v == null ? null : v / 100)))}</span>` +
          `<span class="cV">${delta(first != null ? last - first : null)}${last}%</span></div>`);
      }
      // Read time shares the window but wants its own scale (a flat 100% axis
      // would bury the trend), and faster is better, so the delta inverts.
      const rt = series.readMs;
      const nn = rt.filter((v) => v != null);
      if (nn.length) {
        const lo = Math.min(...nn), hi = Math.max(...nn);
        const span = hi - lo || 1;
        // Invert: a lower time sits HIGHER on the line (better = up).
        const norm = rt.map((v) => (v == null ? null : 1 - (v - lo) / span));
        const { first, last } = firstLast(rt);
        rows.push(`<div class="cRow"><span class="cK">READ TIME</span>` +
          `<span>${spark(norm)}</span>` +
          `<span class="cV">${delta(first != null ? last - first : null, 'ms', true)}` +
          `${(last / 1000).toFixed(2)}s</span></div>`);
      }
      rows.push(`<p class="note">Last two weeks. A gap is a day not played.</p>`);
    }

    if (beaten && beaten.length) {
      rows.push(`<div class="cHead">BEATEN — ${beaten.length}</div>`);
      for (const b of beaten) {
        const miss = `${b.m} miss${b.m === 1 ? '' : 'es'}`;
        rows.push(`<div class="bRow"><span class="bW">${b.id}</span>` +
          `<span class="bMeta">${miss} · ${relDate(b.at)}</span></div>`);
      }
    }

    body.innerHTML = rows.join('');
  };

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.id === 'curveClose') el.classList.remove('on');
  });
  document.addEventListener('dictiondash:show-curve', () => { render(); el.classList.add('on'); });
  return { el, render };
}

export default buildCurveScreen;
