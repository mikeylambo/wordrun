/**
 * RC9.8 — what the rolling capture costs, on the phone matrix.
 *
 * The clip is a souvenir and the run is the game, so the buffer is only
 * allowed to exist if it cannot be felt. This prices it: for each phone-sized
 * viewport it plays the same stretch twice — once with the buffer off (the
 * REDUCED FLASH path, which is the shipped way to have no capture) and once
 * with it armed — and holds the difference at p95 under TUNING.CAPTURE.COST_MS.
 *
 * It also proves the three things the design rests on:
 *   - the budget is KNOWN before it is paid, and under the ceiling;
 *   - a device that cannot afford the capture refuses to arm it, measured
 *     rather than guessed;
 *   - NOTHING LEAVES THE DEVICE — the whole audit, capture and clip export
 *     included, makes zero external requests.
 *
 * A browser audit, so it runs on demand rather than inside the node-only gate
 * suites (the same shape as tools/network-audit.mjs):
 *
 *   npm run build && npm run audit:capture
 *
 * A HOST THAT COULD NOT RUN THE CAPTURE DOES NOT GET TO PRICE IT. Software
 * rendering (this machine's headless chromium draws the game at around 13 fps)
 * makes both the absolute frame times and the cost of one blit meaningless,
 * and the shipped game would refuse to arm a capture there at all — so both
 * timing assertions are held back behind the SAME floor the game itself uses,
 * TUNING.CAPTURE.MIN_FPS, and the audit says plainly when it could not judge.
 * Everything that is not a timing — the budget, the refusal, the clip, the
 * export, the network — is asserted on every host.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import TUNING from '../src/TUNING.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || process.env.CHROMIUM_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 5177;
const C = TUNING.CAPTURE;
const RC_BUDGET_MS = 20;      // dev/rc/device-soak.md: p95 on a 60 Hz phone

// The phone matrix: the narrow Android, the small iPhone, the common iPhone,
// the large one. Every one of them portrait, which is the game's shape.
const MATRIX = [
  { name: 'android 360x800', width: 360, height: 800 },
  { name: 'iphone se 375x667', width: 375, height: 667 },
  { name: 'iphone 13 390x844', width: 390, height: 844 },
  { name: 'iphone max 414x896', width: 414, height: 896 },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PASS_MS = 5000;          // one sampling pass
let PASS = 0, FAIL = 0, SKIPPED = 0;
/** The middle of two passes, so one unlucky window cannot decide a number. */
const mid = (a, b) => +((a + b) / 2).toFixed(2);
const check = (name, ok, detail = '') => {
  if (ok) { PASS++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
};

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* already gone */ } });
await wait(2500);

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});

const external = [];

/**
 * Sample rAF deltas in the page for `ms`, dropping the warm-up — and PLAY,
 * because a pass that lets the runner die is measuring the RUN OVER ceremony.
 * The reader answers every armed real word and leaves the fakes alone, which
 * is a clean run at whatever pace this host can draw one.
 */
const SAMPLER = (ms) => new Promise((res) => {
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

console.log('\n\x1b[1mCAPTURE — the budget, and what a frame pays for it\x1b[0m');

for (const dev of MATRIX) {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    hasTouch: true, isMobile: true, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!url.startsWith(`http://localhost:${PORT}`)) external.push(url);
  });
  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__SIM && window.__CAPTURE, null, { timeout: 20000 });
    await wait(1200);

    // A live run, kept live: a pass sampled across the RUN OVER ceremony is
    // measuring the ceremony. Every pass re-enters a running game first, and
    // the first three seconds after BEGIN RUN are the launch, not the run.
    const ensureRunning = async () => {
      const phase = await page.evaluate(() => window.__SIM?.phase);
      if (phase !== 'running') {
        await page.evaluate(() => { window.__QUIT?.(); window.__START?.(); });
        await wait(3000);
      }
    };
    await page.evaluate(() => window.__START?.());
    await wait(3000);

    const budget = await page.evaluate(() => ({
      line: window.__CAPTURE.budgetLine,
      mb: +window.__CAPTURE.megabytes.toFixed(2),
      cell: `${window.__CAPTURE.cellW}x${window.__CAPTURE.cellH}`,
      frames: window.__CAPTURE.frames,
    }));

    // OFF is the shipped way to have no capture; ON arms without waiting for
    // the device test. A pass that lost the run measured the RUN OVER
    // ceremony rather than the run, so it is taken again instead of being
    // billed to whichever condition it happened to fall in.
    const retry = async (fn) => {
      let last = null;
      for (let i = 0; i < 3; i++) { last = await fn(); if (!last.died) return last; }
      return last;
    };
    const offPass = () => retry(async () => {
      await ensureRunning();
      await page.evaluate(() => window.__CAPTURE.begin({ reducedFlash: true }));
      return page.evaluate(SAMPLER, PASS_MS);
    });
    const onPass = () => retry(async () => {
      await ensureRunning();
      const armed = await page.evaluate(() => {
        window.__CAPTURE.begin({});
        return window.__CAPTURE.arm();
      });
      const s = await page.evaluate(SAMPLER, PASS_MS);
      s.armed = armed;
      s.filled = await page.evaluate(() => window.__CAPTURE.filled);
      return s;
    });
    // OFF, ON, ON, OFF — a mirrored order, so that whatever a first pass pays
    // for warming up is split evenly between the two conditions instead of
    // being billed to whichever one happened to go first.
    await offPass();                       // thrown away: the warm-up itself
    const o1 = await offPass(), n1 = await onPass();
    const n2 = await onPass(), o2 = await offPass();
    const off = { p50: mid(o1.p50, o2.p50), p95: mid(o1.p95, o2.p95), frames: o1.frames + o2.frames };
    const on = { p50: mid(n1.p50, n2.p50), p95: mid(n1.p95, n2.p95), frames: n1.frames + n2.frames };
    const delta = +(on.p95 - off.p95).toFixed(2);
    const hostFps = off.p50 > 0 ? 1000 / off.p50 : 0;

    console.log(`\n  \x1b[1m${dev.name}\x1b[0m  ${budget.line}`);
    const lost = [o1, o2, n1, n2].some((p) => p.died) ? '  \x1b[33m(a pass lost the run)\x1b[0m' : '';
    console.log(`    off  p50 ${off.p50} ms  p95 ${off.p95} ms   (${off.frames} frames)`);
    console.log(`    on   p50 ${on.p50} ms  p95 ${on.p95} ms   (${on.frames} frames)${lost}`);
    check(`${dev.name}: the budget is known and under the ${C.MAX_MB} MB ceiling`,
      budget.mb > 0 && budget.mb <= C.MAX_MB, `${budget.mb} MB, ${budget.cell} x ${budget.frames}`);
    check(`${dev.name}: armed means frames actually captured`,
      (n1.armed || n2.armed) && Math.max(n1.filled, n2.filled) >= 2,
      `${Math.max(n1.filled, n2.filled)} cells filled`);
    if (hostFps >= C.MIN_FPS) {
      check(`${dev.name}: the buffer costs under ${C.COST_MS} ms at p95`,
        delta <= C.COST_MS, `${delta >= 0 ? '+' : ''}${delta} ms`);
      check(`${dev.name}: with the buffer on, p95 stays inside the ${RC_BUDGET_MS} ms RC budget`,
        on.p95 <= RC_BUDGET_MS, `${on.p95} ms`);
    } else {
      SKIPPED++;
      console.log(`    \x1b[33mnot priced\x1b[0m  this host draws the game at ` +
        `${hostFps.toFixed(0)} fps with the capture OFF, under the ${C.MIN_FPS} fps floor the ` +
        `game itself arms behind — so it would never run a capture here, and its ` +
        `frame times cannot judge one. Run this on a phone or a GPU host for the number.`);
    }
  } catch (err) {
    check(`${dev.name}: the audit completed`, false, String(err.message || err).split('\n')[0]);
  }
  await ctx.close();
}

// ── The device test, the clip, and the promise about the network ──────────
console.log('\n\x1b[1mCAPTURE — the refusal, the clip, and where the bytes go\x1b[0m');
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!url.startsWith(`http://localhost:${PORT}`)) external.push(url);
  });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__SIM && window.__CAPTURE, null, { timeout: 20000 });
  await wait(1200);
  await page.evaluate(() => window.__START?.());

  // The shipped decision: measure, then arm or refuse. Nothing is forced here,
  // and the measurement takes CAPTURE.SAMPLE frames however long that is.
  await page.evaluate(() => window.__CAPTURE.begin({}));
  await page.waitForFunction(() => window.__CAPTURE.armed, null, { timeout: 60000 })
    .catch(() => {});
  const decided = await page.evaluate(() => ({
    enabled: window.__CAPTURE.enabled,
    armed: window.__CAPTURE.armed,
    reason: window.__CAPTURE.reason,
  }));
  check('the device decides for itself — a capture is armed or refused with a reason',
    decided.armed && (decided.enabled ? decided.reason === null : !!decided.reason),
    decided.enabled ? 'armed' : decided.reason);

  // REDUCED FLASH: no capture, whatever the device could afford.
  const flash = await page.evaluate(async () => {
    window.__CAPTURE.begin({ reducedFlash: true });
    for (let i = 0; i < 240; i++) window.__CAPTURE.update(1 / 60, true);
    return { enabled: window.__CAPTURE.enabled, filled: window.__CAPTURE.filled,
      reason: window.__CAPTURE.reason };
  });
  check('REDUCED FLASH means no capture at all',
    !flash.enabled && flash.filled === 0 && flash.reason === 'reduced flash');

  // A frozen moment, exported locally. This is the whole clip path: freeze,
  // show, encode.
  const clip = await page.evaluate(async () => {
    window.__CAPTURE.begin({});
    window.__CAPTURE.arm();
    for (let i = 0; i < 60; i++) window.__CAPTURE.update(1 / 6, true);
    const froze = window.__CAPTURE.freeze();
    const m = window.__CAPTURE.moment();
    window.__MOMENT.show(m, 0.7);
    const out = await window.__MOMENT.export2x();
    return {
      froze, rows: m?.order.length || 0,
      on: document.getElementById('momentClip')?.classList.contains('on'),
      ext: out?.ext || null, bytes: out?.blob.size || 0,
    };
  });
  check('a frozen moment plays on the card and exports as a file',
    clip.froze && clip.on && clip.rows >= 2 && clip.bytes > 0,
    `${clip.rows} frames, ${clip.ext}, ${(clip.bytes / 1024).toFixed(1)} kB`);

  // And with nothing frozen there is nothing offered — no empty player.
  const none = await page.evaluate(() => {
    window.__MOMENT.show(null, 0);
    return document.getElementById('momentClip')?.classList.contains('on');
  });
  check('a run with no standout offers no clip', none === false);
  await ctx.close();
}

check('zero external requests through capture, freeze and export',
  external.length === 0, external.slice(0, 3).join(' '));

await browser.close();
console.log(`\n${FAIL ? '\x1b[31m' : '\x1b[32m'}${PASS} passed, ${FAIL} failed\x1b[0m` +
  (SKIPPED ? `, \x1b[33m${SKIPPED} viewport(s) not priced — this host cannot judge frame ` +
    `times; run it on the phone matrix\x1b[0m\n` : '\n'));
process.exit(FAIL ? 1 : 0);
