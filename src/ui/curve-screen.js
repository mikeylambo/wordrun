/**
 * The curve screen. Figures only — no naming, no chrome, and nothing that
 * competes with the four names the game is allowed.
 */

const CSS = `
#curveScreen{position:absolute;inset:0;z-index:78;display:none;align-items:center;justify-content:center;
  padding:24px;background:rgba(6,11,16,.94);backdrop-filter:blur(8px);color:#eaf6fc}
#curveScreen.on{display:flex}
#curveScreen .card{width:min(92vw,400px);max-height:82vh;overflow-y:auto;text-align:left}
#curveScreen h3{font:800 11px/1 var(--face);letter-spacing:.26em;color:#8be4ff;margin:0 0 16px;text-align:center}
#curveScreen .cRow{display:grid;grid-template-columns:64px 1fr 88px;gap:10px;align-items:baseline;
  padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)}
#curveScreen .cK{font:600 8px/1.4 var(--face);letter-spacing:.2em;color:var(--dimmer)}
#curveScreen .cBar{height:3px;background:rgba(103,216,255,.16);position:relative;top:-2px}
#curveScreen .cBar i{display:block;height:100%;background:var(--ice)}
#curveScreen .cV{font:700 12px/1 var(--face);text-align:right;letter-spacing:-.01em}
#curveScreen .cV s{color:var(--dimmer);text-decoration:none;font-weight:500;font-size:10px;margin-right:6px}
#curveScreen .up{color:#8be4ff}
#curveScreen .down{color:rgba(255,150,142,.85)}
#curveScreen .note{font:500 10px/1.5 var(--face);color:rgba(232,244,251,.5);margin:14px 0 0;text-align:center}
#curveScreen .btn{display:block;width:100%;margin-top:20px}
`;

export function buildCurveScreen(getSummary) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'curveScreen';
  el.innerHTML = '<div class="card"><h3>YOUR READING</h3><div id="curveBody"></div>' +
    '<button class="btn" id="curveClose" data-rc2-ui>DONE</button></div>';
  document.getElementById('app').appendChild(el);
  const body = el.querySelector('#curveBody');

  const arrow = (now, was) => {
    if (now == null || was == null) return '';
    const d = now - was;
    if (d === 0) return '';
    return `<s class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</s>`;
  };

  const render = () => {
    const s = getSummary();
    const rows = [];
    if (!s || s.days === 0) {
      rows.push('<p class="note">Play a few runs and this fills in.</p>');
    } else {
      for (const t of s.tiers) {
        if (t.now == null) continue;
        rows.push(`<div class="cRow"><span class="cK">TIER ${t.tier}</span>` +
          `<span class="cBar"><i style="width:${t.now}%"></i></span>` +
          `<span class="cV">${arrow(t.now, t.was)}${t.now}%</span></div>`);
      }
      if (s.readMs != null) {
        const was = s.readMsWas;
        const d = was != null ? was - s.readMs : null;
        rows.push(`<div class="cRow"><span class="cK">READ TIME</span>` +
          `<span class="cBar"></span><span class="cV">` +
          `${d ? `<s class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '−' : '+'}${Math.abs(d)}ms</s>` : ''}` +
          `${(s.readMs / 1000).toFixed(2)}s</span></div>`);
      }
      rows.push(`<div class="cRow"><span class="cK">BEATEN</span>` +
        `<span class="cBar"></span><span class="cV">${s.retired}</span></div>`);
      rows.push(`<p class="note">Last seven days${s.days < 3 ? ' — still filling in' : ''}.</p>`);
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
