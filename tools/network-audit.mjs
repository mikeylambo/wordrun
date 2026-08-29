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

const external = [];
const internal = new Set();
page.on('request', (req) => {
  const url = req.url();
  if (url.startsWith('data:') || url.startsWith('blob:')) return;
  if (url.startsWith(ORIGIN)) internal.add(new URL(url).pathname);
  else external.push(url);
});

await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000); // warm-start, audio prewarm, SW install

// A full run: start, read for 30 headless seconds, render, die, death card.
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
await browser.close();

console.log(`same-origin assets requested: ${internal.size}`);
if (external.length) {
  console.error(`FAIL — ${external.length} external request(s):`);
  for (const u of external.slice(0, 10)) console.error('  ' + u);
  process.exit(1);
}
console.log('PASS — zero external network calls through boot, run and death');
