/**
 * The visual gate — the UI layer, pixel-compared against approved images.
 *
 * Word-plate legibility outranks every other visual change, and until now the
 * only thing that caught a visual regression was a playtest. This loads the
 * real build at phone width, puts the UI in a handful of fixed states, and
 * compares each screenshot with its approved baseline in tools/visual-baselines/.
 *
 * WHAT IS PINNED, AND WHY. The WebGL world is hidden: a running 3D scene is
 * never pixel-stable, and what this gate guards is the typography and layout
 * laid over it. Date is fixed so the daily seed line does not change every
 * day; animation and transitions are off; fonts are awaited. The comparison
 * itself runs in the page (two images on a canvas) so the gate adds no image
 * dependency.
 *
 *   npm run build && npm run gate:visual            compare
 *   npm run build && npm run gate:visual -- --update  re-approve after an intended change
 *
 * A browser gate, so it runs in CI (.github/workflows/visual.yml) and on
 * demand, not inside the node-only pre-commit suite.
 */

import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = 5203;
const DIR = 'tools/visual-baselines';
const UPDATE = process.argv.includes('--update');
// A pixel counts as changed past this per-channel delta; a state fails past
// this share of changed pixels. Loose enough for antialiasing between two
// Chromium builds, tight enough that a moved label or a swapped face fails.
const CHANNEL_DELTA = 48;
const MAX_CHANGED = 0.0005;

let PASS = 0;
let FAIL = 0;
const check = (name, ok, detail = '') => {
  if (ok) { PASS++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch { /* already gone */ } });
await wait(2500);

const browser = await chromium.launch({
  ...(fs.existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--font-render-hinting=none'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  serviceWorkers: 'block',
});
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.addStyleTag({ content: `
  canvas{visibility:hidden!important}
  html,body,#app{background:#050a12!important}
  *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}` });
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector('#titleScreen .drop');
await wait(600);

// Each state is set from the outside, the way a player would see it; none of
// them reaches into the sim.
const STATES = [
  ['title', async () => {}],
  ['title-modes-open', async () => { await page.click('#modeSummary'); }],
  ['hud', async () => {
    await page.click('#modeSummary');
    await page.evaluate(() => {
      document.getElementById('titleScreen')?.classList.remove('on');
      document.getElementById('hud')?.classList.add('on');
      document.getElementById('dist').textContent = '12,840';
      document.getElementById('distSub').textContent = 'SCORE · 412 M';
      const combo = document.getElementById('combo');
      combo.textContent = '×7'; combo.classList.add('on');
    });
  }],
  ['judge-reveal', async () => {
    await page.evaluate(() => {
      const j = document.getElementById('judge');
      j.textContent = 'MISSED'; j.dataset.kind = 'wrong'; j.classList.add('on');
      const line = document.createElement('span');
      line.className = 'judgeTrue';
      const b = document.createElement('b'); b.textContent = 'a';
      line.append('sep', b, 'rate');
      j.append(line);
    });
  }],
];

console.log('\n\x1b[1mVISUAL — the UI layer against its approved images\x1b[0m');
fs.mkdirSync(DIR, { recursive: true });
for (const [name, enter] of STATES) {
  await enter();
  await wait(150);
  const shot = await page.screenshot();
  const file = `${DIR}/${name}.png`;
  if (UPDATE || !fs.existsSync(file)) {
    fs.writeFileSync(file, shot);
    console.log(`  \x1b[33mSAVE\x1b[0m  ${file}`);
    continue;
  }
  const changed = await page.evaluate(async ([a, b, delta]) => {
    const load = (src) => new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const c = document.createElement('canvas');
    c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > delta || Math.abs(da[i + 1] - db[i + 1]) > delta ||
        Math.abs(da[i + 2] - db[i + 2]) > delta) n++;
    }
    return n / (da.length / 4);
  }, [`data:image/png;base64,${fs.readFileSync(file).toString('base64')}`,
    `data:image/png;base64,${shot.toString('base64')}`, CHANNEL_DELTA]);
  if (changed > MAX_CHANGED) fs.writeFileSync(`${DIR}/${name}.actual.png`, shot);
  check(`${name} matches its approved image`, changed <= MAX_CHANGED,
    `${(changed * 100).toFixed(2)}% of pixels changed (limit ${(MAX_CHANGED * 100).toFixed(2)}%)`);
}

await browser.close();
console.log(`\n${FAIL ? '\x1b[31m' : '\x1b[32m'}${PASS} passed, ${FAIL} failed\x1b[0m`);
process.exit(FAIL ? 1 : 0);
