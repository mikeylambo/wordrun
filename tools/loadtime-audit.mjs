/**
 * RC10.4 — how long until someone can play, on a phone that is not new.
 *
 * The size ceilings have always passed with room to spare (8.35 MB against a
 * 30 MB Playables limit), so this measures the only thing a player feels:
 * TIME TO FIRST PLAY. It loads the real build through a throttled 4G
 * connection on a throttled CPU and reports three moments —
 *
 *   paint        the first frame with anything on it
 *   interactive  BEGIN RUN is on screen and can be tapped
 *   playable     the sim exists and a run can actually start
 *
 * — plus what was on the wire before each. A budget nobody can see is a
 * budget nobody keeps, so the waterfall is printed every run.
 *
 *   npm run build && npm run audit:load
 *
 * A browser audit, so it runs on demand rather than inside the node-only
 * suites (the same shape as audit:network and audit:capture).
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = 5202;

// A mid-tier phone on a good 4G connection: the device this game is for.
const NET = { downloadThroughput: (12 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8,
  latency: 70, offline: false };
const CPU_SLOWDOWN = 4;
// The budgets. Interactive is the one that matters — it is the moment the
// player stops waiting — and 3 s on this profile is the line.
// Measured at 677 ms and 1087 ms on this profile after RC10.4. The budgets sit
// just above that with room for a slow CI box — tight enough that the fix
// cannot quietly rot, loose enough not to fail on a noisy run. (Before RC10.4:
// paint 2687 ms, interactive 2722 ms, and 7.1 MB on the wire first.)
const BUDGET_INTERACTIVE_MS = 1200;
const BUDGET_PLAYABLE_MS = 2000;

let PASS = 0, FAIL = 0;
const check = (name, ok, detail = '') => {
  if (ok) { PASS++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* already gone */ } });
await wait(2500);

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  serviceWorkers: 'block',       // a cold first visit, which is the one that counts
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', NET);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

const started = Date.now();
const reqs = [];
page.on('response', async (res) => {
  const url = new URL(res.url());
  let size = 0;
  try { size = Number((await res.headerValue('content-length')) || 0); } catch { /* streamed */ }
  reqs.push({ at: Date.now() - started, path: url.pathname, size });
});

console.log('\n\x1b[1mLOAD — time to first play, on a throttled phone\x1b[0m');
console.log(`  profile: ${(NET.downloadThroughput * 8 / 1024 / 1024).toFixed(0)} Mbps down, ` +
  `${NET.latency} ms RTT, ${CPU_SLOWDOWN}x CPU slowdown, cold cache\n`);

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'commit' });

// paint: the first frame the browser actually put something on.
await page.waitForFunction(() => performance.getEntriesByType('paint')
  .some((e) => e.name === 'first-contentful-paint'), null, { timeout: 60000 });
const paint = Date.now() - started;

// interactive: BEGIN RUN is on screen and hittable.
await page.waitForFunction(() => {
  const el = document.querySelector('#titleScreen .drop');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}, null, { timeout: 60000 });
const interactive = Date.now() - started;
const beforeInteractive = reqs.filter((r) => r.at <= interactive);

// playable: the sim exists, so a tap would start a run.
await page.waitForFunction(() => !!window.__SIM, null, { timeout: 60000 });
const playable = Date.now() - started;
const beforePlayable = reqs.filter((r) => r.at <= playable);

const sum = (rows) => rows.reduce((a, r) => a + r.size, 0);
console.log(`  paint        ${String(paint).padStart(5)} ms`);
console.log(`  interactive  ${String(interactive).padStart(5)} ms   ` +
  `${beforeInteractive.length} requests, ${kb(sum(beforeInteractive))} declared`);
console.log(`  playable     ${String(playable).padStart(5)} ms   ` +
  `${beforePlayable.length} requests, ${kb(sum(beforePlayable))} declared`);

console.log('\n  what was on the wire before the player could tap BEGIN RUN:');
for (const r of [...beforeInteractive].sort((a, b) => b.size - a.size).slice(0, 8)) {
  console.log(`      ${String(r.at).padStart(5)} ms  ${kb(r.size).padStart(9)}  ${r.path}`);
}

// The one thing that must never be on the critical path: the six-megabyte
// score. It is the largest file in the build by a factor of five.
const music = reqs.filter((r) => /\.mp3$/.test(r.path));
const musicBeforePlay = music.filter((r) => r.at <= playable);
console.log('');
check(`the title is tappable inside ${BUDGET_INTERACTIVE_MS} ms`,
  interactive <= BUDGET_INTERACTIVE_MS, `${interactive} ms`);
check(`and a run can start inside ${BUDGET_PLAYABLE_MS} ms`,
  playable <= BUDGET_PLAYABLE_MS, `${playable} ms`);
check('the score is not fetched before the game is playable',
  musicBeforePlay.length === 0,
  musicBeforePlay.length
    ? `${musicBeforePlay.map((r) => r.path).join(' ')} at ${musicBeforePlay[0].at} ms`
    : 'the 6.7 MB track waits its turn');

await browser.close();
console.log(`\n${FAIL ? '\x1b[31m' : '\x1b[32m'}${PASS} passed, ${FAIL} failed\x1b[0m\n`);
process.exit(FAIL ? 1 : 0);
