import fs from 'node:fs';
/**
 * Network-call audit vs the YouTube Playables rule (Phase 12): ZERO
 * external requests — no analytics, no CDN fonts, nothing that leaves the
 * bundle's own origin — through a full boot -> title -> run -> death.
 *
 *   npm run build && npx vite preview --port 5199 &
 *   node tools/network-audit.mjs
 *
 * Needs a local chromium (playwright-core); this is a browser audit, so it
 * runs on demand rather than inside the node-only gate suites.
 */

import { chromium } from 'playwright-core';

const ORIGIN = process.env.AUDIT_ORIGIN || 'http://localhost:5199';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// The board server is the one external host the web build may reach, and
// only outside a run (title tables, a signed score on the results card). The
// Playables build (VITE_BOARDS=off) may reach nothing at all: run this audit
// against that build with BOARDS=off to hold it to zero.
const BOARD_HOST = (() => {
  const m = /ENDPOINT: '([^']*)'/.exec(fs.readFileSync('src/TUNING.js', 'utf8'));
  try { return m?.[1] ? new URL(m[1]).host : ''; } catch { return ''; }
})();
const BOARDS_OFF = process.env.BOARDS === 'off';
let inRun = false;
const external = [];
const duringRun = [];
const boardCalls = [];
const internal = new Set();
page.on('request', (req) => {
  const url = req.url();
  if (url.startsWith('data:') || url.startsWith('blob:')) return;
  if (url.startsWith(ORIGIN)) {
    internal.add(new URL(url).pathname);
    if (inRun && /board-transport/.test(url)) duringRun.push(url);
    return;
  }
  if (inRun) duringRun.push(url);
  if (!BOARDS_OFF && new URL(url).host === BOARD_HOST) boardCalls.push(url);
  else external.push(url);
});

await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000); // warm-start, audio prewarm, SW install

// A full run: start, read for 30 headless seconds, render, die, death card.
inRun = true;
await page.evaluate(() => globalThis.__START?.());
await page.waitForTimeout(400);
await page.evaluate(() => {
  const sim = globalThis.__SIM;
  for (let i = 0; i < 60 * 30 && sim.phase === 'running'; i++) {
    const g = sim.wordGates.current();
    const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed;
    globalThis.__STEP?.(1, armed && g.real ? { confirm: true } : {});
  }
  sim.player.speed = 16;
  sim.beast.gap = 2.45;
});
await page.waitForTimeout(4000); // kill cam, death card, share-poster compose
inRun = false;
await browser.close();

console.log(`same-origin assets requested: ${internal.size}`);

// RC10.7 — the board carve-out, measured rather than promised. The one module
// that can make a request is reached by dynamic import from the board surface
// alone, so a boot, a run and a death card must never even LOAD it. If this
// name ever appears here, something in the play path imported it.
if (duringRun.length) {
  console.error('FAIL — requests during the run or its death card:');
  for (const u of duringRun.slice(0, 10)) console.error(`  ${u}`);
  process.exit(1);
}
console.log('nothing external and no board transport during the run or the death card');
if (boardCalls.length) console.log(`board server reached outside the run: ${boardCalls.length} request(s) — allowed in the web build`);
if (external.length) {
  console.error(`FAIL — ${external.length} external request(s):`);
  for (const u of external.slice(0, 10)) console.error('  ' + u);
  process.exit(1);
}
console.log(BOARDS_OFF ? 'PASS — zero external network calls through boot, run and death'
  : 'PASS — nothing external but the board server, and nothing at all during a run');
