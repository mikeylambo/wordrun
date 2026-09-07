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
 * RC11.9 — THE PROTOCOL LIVES IN THE APP, NOT HERE. Everything this does
 * inside the page is plain browser work, and the one thing this host could
 * never supply is a real GPU. So the sampler, the mirrored off/on/on/off
 * passes and the verdicts moved to src/dev/soak.js, which a phone reaches by
 * opening `?soak=1` — no cable, no adb, and iOS included, which playwright
 * cannot drive at all. This drives the same functions across the emulated
 * matrix, so the number a phone shows and the number this prints are the same
 * number computed by the same code.
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

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || process.env.CHROMIUM_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 5177;
// The dials and the RC budget live with the protocol now (src/dev/soak.js),
// which is the code that applies them.

// The phone matrix: the narrow Android, the small iPhone, the common iPhone,
// the large one. Every one of them portrait, which is the game's shape.
const MATRIX = [
  { name: 'android 360x800', width: 360, height: 800 },
  { name: 'iphone se 375x667', width: 375, height: 667 },
  { name: 'iphone 13 390x844', width: 390, height: 844 },
  { name: 'iphone max 414x896', width: 414, height: 896 },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0, SKIPPED = 0;
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
    await page.goto(`http://localhost:${PORT}/?soak=probe`);
    await page.waitForFunction(() => window.__SIM && window.__CAPTURE && window.__SOAK,
      null, { timeout: 20000 });
    await wait(1200);

    // One call, into the app's own protocol: the budget, the mirrored
    // off/on/on/off passes, and the verdicts. Whatever a phone reports at
    // `?soak=1` is this, computed by this code, on that device's GPU.
    const r = await page.evaluate(() => window.__SOAK.price());
    const rows = await page.evaluate((res) => window.__SOAK.verdicts(res), r);

    console.log(`\n  \x1b[1m${dev.name}\x1b[0m  ${r.budget.line}`);
    const lost = r.lostARun ? '  \x1b[33m(a pass lost the run)\x1b[0m' : '';
    console.log(`    off  p50 ${r.off.p50} ms  p95 ${r.off.p95} ms   (${r.off.frames} frames)`);
    console.log(`    on   p50 ${r.on.p50} ms  p95 ${r.on.p95} ms   (${r.on.frames} frames)${lost}`);
    for (const row of rows) {
      if (row.ok === null) {
        SKIPPED++;
        console.log(`    \x1b[33mnot priced\x1b[0m  ${row.detail} ` +
          'Run this on a phone (open `?soak=1` on the device) or a GPU host for the number.');
      } else {
        check(`${dev.name}: ${row.name}`, row.ok, row.detail);
      }
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
  await page.goto(`http://localhost:${PORT}/?soak=probe`);
  await page.waitForFunction(() => window.__SIM && window.__CAPTURE && window.__SOAK,
    null, { timeout: 20000 });
  await wait(1200);

  // The shipped decision: measure, then arm or refuse. Nothing is forced here,
  // and the measurement takes CAPTURE.SAMPLE frames however long that is.
  const decided = await page.evaluate(() => window.__SOAK.decide());
  check('the device decides for itself — a capture is armed or refused with a reason',
    decided.armed && (decided.enabled ? decided.reason === null : !!decided.reason),
    decided.enabled ? 'armed' : decided.reason);

  // REDUCED FLASH: no capture, whatever the device could afford.
  const flash = await page.evaluate(() => window.__SOAK.flashOff());
  check('REDUCED FLASH means no capture at all',
    !flash.enabled && flash.filled === 0 && flash.reason === 'reduced flash');

  // A frozen moment, exported locally. This is the whole clip path: freeze,
  // show, encode.
  const clip = await page.evaluate(() => window.__SOAK.clip());
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
