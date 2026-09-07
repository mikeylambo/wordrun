/**
 * The device soak, on the device.
 *
 * `npm run audit:capture` prices the rolling capture — the same stretch played
 * twice, once with the buffer off and once armed, holding the difference at
 * p95 under TUNING.CAPTURE.COST_MS. It has never produced a number that means
 * anything, because it only ever ran here: this machine's headless chromium
 * draws the game at ~13 fps in software, under the MIN_FPS floor the game
 * itself arms behind, so the audit correctly refuses to judge and says so.
 *
 * The measurement was never the problem — the HOST was. Everything the audit
 * does inside the page is plain browser work: sample rAF deltas, arm the
 * buffer, freeze a moment, export it. So it lives here, in the app, and both
 * callers drive the same code:
 *
 *   a phone   open `?soak=1` and read the verdicts off the screen. No cable,
 *             no adb, no remote debugging, and it works on iOS, which
 *             playwright cannot drive at all.
 *   the audit `npm run audit:capture` loads the same page across the emulated
 *             phone matrix and prints what this returns.
 *
 * One implementation, so the number a phone shows and the number CI prints
 * cannot drift apart.
 */

import TUNING from '../TUNING.js';

const C = TUNING.CAPTURE;
/** dev/rc/device-soak.md: the p95 a 60 Hz phone is allowed to spend. */
const RC_BUDGET_MS = 20;
const PASS_MS = 5000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** The middle of two passes, so one unlucky window cannot decide a number. */
const mid = (a, b) => +((a + b) / 2).toFixed(2);

/**
 * Sample rAF deltas for `ms` — and PLAY, because a pass that lets the runner
 * die is measuring the RUN OVER ceremony. The reader answers every armed real
 * word and leaves the fakes alone: a clean run at whatever pace this device
 * can draw one.
 */
export function sample(ms = PASS_MS) {
  return new Promise((res) => {
    const d = [];
    let last = performance.now();
    const t0 = last;
    // `code`, not `key`: input.js reads the physical key, so an event carrying
    // only `key` arrives as a press of nothing at all.
    const press = (code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
    };
    const play = () => {
      const sim = window.__SIM;
      if (!sim || sim.phase !== 'running' || sim.teach?.active) return;
      const g = sim.wordGates.current();
      if (g && !g.confirmed && g.real && sim.wordGates.armed(sim.player.d)) press('ArrowRight');
    };
    let died = false;
    const step = (now) => {
      d.push(now - last); last = now;
      if (window.__SIM?.phase !== 'running') died = true;
      play();
      if (now - t0 < ms) requestAnimationFrame(step);
      else {
        d.splice(0, Math.min(20, Math.floor(d.length / 4)));   // the pass's own warm-up
        d.sort((a, b) => a - b);
        const q = (p) => +d[Math.min(d.length - 1, Math.floor(d.length * p))].toFixed(2);
        res({ frames: d.length, p50: q(0.5), p95: q(0.95), died });
      }
    };
    requestAnimationFrame(step);
  });
}

/** A live run, kept live: the first seconds after BEGIN RUN are the launch. */
async function ensureRunning() {
  if (window.__SIM?.phase === 'running') return;
  window.__QUIT?.();
  window.__START?.();
  await wait(3000);
}

/** A pass that lost the run measured the ceremony, so it is taken again. */
async function retry(fn) {
  let last = null;
  for (let i = 0; i < 3; i++) { last = await fn(); if (!last.died) return last; }
  return last;
}

/**
 * The price of the buffer: OFF, ON, ON, OFF — a mirrored order, so whatever a
 * first pass pays for warming up is split evenly between the two conditions
 * instead of being billed to whichever one happened to go first.
 * @param ms per-pass sampling window; the default takes about half a minute.
 */
export async function price(ms = PASS_MS) {
  await ensureRunning();
  await wait(600);
  const budget = {
    line: window.__CAPTURE.budgetLine,
    mb: +window.__CAPTURE.megabytes.toFixed(2),
    cell: `${window.__CAPTURE.cellW}x${window.__CAPTURE.cellH}`,
    frames: window.__CAPTURE.frames,
  };
  // OFF is the shipped way to have no capture (the REDUCED FLASH path);
  // ON arms without waiting for the device test.
  const offPass = () => retry(async () => {
    await ensureRunning();
    window.__CAPTURE.begin({ reducedFlash: true });
    return sample(ms);
  });
  const onPass = () => retry(async () => {
    await ensureRunning();
    window.__CAPTURE.begin({});
    const armed = window.__CAPTURE.arm();
    const s = await sample(ms);
    s.armed = armed;
    s.filled = window.__CAPTURE.filled;
    return s;
  });
  await offPass();                       // thrown away: the warm-up itself
  const o1 = await offPass(), n1 = await onPass();
  const n2 = await onPass(), o2 = await offPass();
  const off = { p50: mid(o1.p50, o2.p50), p95: mid(o1.p95, o2.p95), frames: o1.frames + o2.frames };
  const on = { p50: mid(n1.p50, n2.p50), p95: mid(n1.p95, n2.p95), frames: n1.frames + n2.frames };
  return {
    budget, off, on,
    delta: +(on.p95 - off.p95).toFixed(2),
    hostFps: off.p50 > 0 ? +(1000 / off.p50).toFixed(0) : 0,
    armed: !!(n1.armed || n2.armed),
    filled: Math.max(n1.filled || 0, n2.filled || 0),
    lostARun: [o1, o2, n1, n2].some((p) => p.died),
  };
}

/** The shipped decision: measure, then arm or refuse — with a reason. */
export async function decide() {
  await ensureRunning();
  window.__CAPTURE.begin({});
  for (let i = 0; i < 600 && !window.__CAPTURE.armed; i++) await wait(100);
  return { enabled: window.__CAPTURE.enabled, armed: window.__CAPTURE.armed,
    reason: window.__CAPTURE.reason };
}

/** REDUCED FLASH means no capture at all, whatever the device could afford. */
export function flashOff() {
  window.__CAPTURE.begin({ reducedFlash: true });
  for (let i = 0; i < 240; i++) window.__CAPTURE.update(1 / 60, true);
  return { enabled: window.__CAPTURE.enabled, filled: window.__CAPTURE.filled,
    reason: window.__CAPTURE.reason };
}

/** The whole clip path: freeze, show, encode — all of it on the device. */
export async function clip() {
  window.__CAPTURE.begin({});
  window.__CAPTURE.arm();
  for (let i = 0; i < 60; i++) window.__CAPTURE.update(1 / 6, true);
  const froze = window.__CAPTURE.freeze();
  const m = window.__CAPTURE.moment();
  window.__MOMENT.show(m, 0.7);
  const out = await window.__MOMENT.export2x();
  return { froze, rows: m?.order.length || 0,
    on: document.getElementById('momentClip')?.classList.contains('on'),
    ext: out?.ext || null, bytes: out?.blob?.size || 0 };
}

/**
 * Everything this page has fetched that did not come from this origin. The
 * node audit reads the same promise off CDP, which sees more; this is what a
 * phone can see about itself, and for a build with a hard zero it is enough.
 */
export function externalRequests() {
  return performance.getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith(location.origin));
}

/**
 * The verdicts, from a `price()` result. Returned rather than printed so the
 * phone can paint them and the node audit can log them in its own format.
 * A device under MIN_FPS gets `null` for the two timing rows: it would never
 * run a capture at all, so its frame times cannot judge one.
 */
export function verdicts(r) {
  const rows = [
    { name: `the budget is known and under the ${C.MAX_MB} MB ceiling`,
      ok: r.budget.mb > 0 && r.budget.mb <= C.MAX_MB,
      detail: `${r.budget.mb} MB, ${r.budget.cell} x ${r.budget.frames}` },
    { name: 'armed means frames actually captured',
      ok: r.armed && r.filled >= 2, detail: `${r.filled} cells filled` },
  ];
  if (r.hostFps >= C.MIN_FPS) {
    rows.push({ name: `the buffer costs under ${C.COST_MS} ms at p95`,
      ok: r.delta <= C.COST_MS, detail: `${r.delta >= 0 ? '+' : ''}${r.delta} ms` });
    rows.push({ name: `with the buffer on, p95 stays inside the ${RC_BUDGET_MS} ms RC budget`,
      ok: r.on.p95 <= RC_BUDGET_MS, detail: `${r.on.p95} ms` });
  } else {
    rows.push({ name: 'not priced', ok: null,
      detail: `this device draws the game at ${r.hostFps} fps with the capture OFF, `
        + `under the ${C.MIN_FPS} fps floor the game itself arms behind — so it would `
        + `never run a capture here, and its frame times cannot judge one.` });
  }
  return rows;
}

const CSS = `
#soak{position:fixed;inset:0;z-index:2000;overflow-y:auto;padding:18px 16px 40px;
  background:#060b10;color:#dff2fc;font:500 13px/1.5 ui-monospace,Menlo,Consolas,monospace}
#soak h1{font:800 13px/1.3 ui-monospace,monospace;letter-spacing:.22em;color:#8be4ff;margin:0 0 4px}
#soak .sub{color:rgba(223,242,252,.5);margin-bottom:16px;font-size:11px}
#soak .grp{margin:16px 0 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}
#soak .k{font-size:10px;letter-spacing:.2em;color:rgba(223,242,252,.45);margin-bottom:6px}
#soak .n{font-size:15px;font-weight:700}
#soak .row{display:flex;gap:9px;align-items:flex-start;padding:7px 0;
  border-bottom:1px solid rgba(255,255,255,.06)}
#soak .row b{flex:0 0 auto;font-weight:800;font-size:11px;letter-spacing:.1em}
#soak .pass b{color:#57e389}#soak .fail b{color:#ff6b60}#soak .skip b{color:#ffcc66}
#soak .row span{color:rgba(223,242,252,.82)}
#soak .row i{display:block;font-style:normal;color:rgba(223,242,252,.5);font-size:11px}
#soak button{margin-top:22px;width:100%;padding:14px;border:1px solid rgba(139,228,255,.5);
  border-radius:3px;background:rgba(18,42,54,.6);color:#bff0ff;font:800 12px/1 ui-monospace,monospace;
  letter-spacing:.18em}
#soak .big{font-size:22px;font-weight:800;letter-spacing:.02em;margin:2px 0 10px}
`;

/**
 * `?soak=1`: run the whole thing and paint it, big enough to read on a phone
 * held at arm's length. It takes about half a minute — five sampling passes
 * and a device test — and says so while it works.
 */
export async function mountSoak() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'soak';
  document.body.appendChild(el);

  const paint = (bodyHtml, note = '') => {
    el.innerHTML = `<h1>DEVICE SOAK</h1><div class="sub">${note}</div>${bodyHtml}`;
  };
  paint('', 'warming up…');

  const run = async () => {
    paint('', 'measuring — five passes, about 40 seconds. Keep the screen on.');
    const r = await price();
    const rows = verdicts(r);
    const ext = externalRequests();
    const dec = await decide();
    const fl = flashOff();
    let cl = null;
    try { cl = await clip(); } catch { cl = null; }
    document.getElementById('momentClip')?.classList.remove('on');

    rows.push({ name: 'the device decides for itself — armed or refused, with a reason',
      ok: dec.armed && (dec.enabled ? dec.reason === null : !!dec.reason),
      detail: dec.enabled ? 'armed' : String(dec.reason) });
    rows.push({ name: 'REDUCED FLASH means no capture at all',
      ok: !fl.enabled && fl.filled === 0 && fl.reason === 'reduced flash',
      detail: String(fl.reason) });
    rows.push({ name: 'a frozen moment plays on the card and exports as a file',
      ok: !!cl && cl.froze && cl.on && cl.rows >= 2 && cl.bytes > 0,
      detail: cl ? `${cl.rows} rows, ${cl.ext}, ${(cl.bytes / 1024).toFixed(0)} kB` : 'no clip' });
    rows.push({ name: 'nothing left the device', ok: ext.length === 0,
      detail: ext.slice(0, 3).join(' | ') || 'zero external requests' });

    const failed = rows.filter((x) => x.ok === false).length;
    const skipped = rows.filter((x) => x.ok === null).length;
    paint(
      `<div class="big">${failed ? `${failed} FAILED` : skipped ? 'PASSED, PARTLY UNJUDGED' : 'ALL PASSED'}</div>`
      + `<div class="grp"><div class="k">THIS DEVICE</div>`
      + `<div class="n">${innerWidth}x${innerHeight} · ${devicePixelRatio}x · ${r.hostFps} fps</div>`
      + `<div class="k" style="margin-top:9px">FRAME TIME, p50 / p95</div>`
      + `<div class="n">off ${r.off.p50} / ${r.off.p95} ms</div>`
      + `<div class="n">on&nbsp; ${r.on.p50} / ${r.on.p95} ms &nbsp;<span style="opacity:.6">`
      + `(${r.delta >= 0 ? '+' : ''}${r.delta} ms)</span></div>`
      + `<div class="k" style="margin-top:9px">BUFFER</div><div class="n">${r.budget.line}</div></div>`
      + '<div class="grp">'
      + rows.map((x) => `<div class="row ${x.ok === null ? 'skip' : x.ok ? 'pass' : 'fail'}">`
        + `<b>${x.ok === null ? 'N/J' : x.ok ? 'PASS' : 'FAIL'}</b>`
        + `<span>${x.name}<i>${x.detail}</i></span></div>`).join('')
      + '</div><button type="button">RUN AGAIN</button>',
      r.lostARun ? 'a pass lost the run and was retaken' : 'five passes, mirrored off/on/on/off');
    el.querySelector('button')?.addEventListener('click', run);
  };

  // The game has to be up before anything can be priced.
  for (let i = 0; i < 300 && !(window.__SIM && window.__CAPTURE); i++) await wait(100);
  await run();
}

// The node audit drives exactly these, so the phone and CI cannot drift.
window.__SOAK = { sample, price, decide, flashOff, clip, externalRequests, verdicts,
  RC_BUDGET_MS };

export default mountSoak;
