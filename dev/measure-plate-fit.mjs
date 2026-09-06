/**
 * RC10.2 — does every word still FIT, at every step of the legibility dials?
 *
 * The plate shrinks a long word to fit rather than clipping it, down to a
 * floor of TUNING.PLATE.MIN_FONT_PX. Widening the tracking pushes long words
 * into that floor sooner, and a word that reaches the floor and is STILL too
 * wide would render clipped — which is the one failure the whole legibility
 * constraint exists to prevent.
 *
 * Text metrics need the real font in a real canvas, so this is a browser
 * measurement rather than a gate: it renders every real word AND a one-edit
 * fake for each (a fake can be a character longer than its word) at every
 * tracking step, and reports the worst fitted size and any overflow.
 *
 *   npm run build && node dev/measure-plate-fit.mjs
 *
 * Committed because the numbers in RELEASE have to be reproducible. The gate
 * in word-gates.mjs holds the INPUTS this measured — the plate's character
 * cap and the tracking ceiling — so moving either fails the build and sends
 * whoever moved it back here.
 *
 * Last run (RC10.2, 10,747 strings, longest 13 chars):
 *   step 0  track  1px   worst 120px  commencement    overflow 0
 *   step 1  track  7px   worst 104px  commencement    overflow 0
 *   step 2  track 12px   worst  96px  announceement   overflow 0
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { ALL_WORDS, makeFake } from './src/words/wordlist.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 5197;
const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch {} });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(2500);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.__SIM, null, { timeout: 20000 });
await wait(2000);
// Every real word, and a fake for each — the fakes are what a plate actually
// shows half the time and a one-edit fake can be LONGER than its real word.
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const WORDS = [...new Set([...ALL_WORDS, ...ALL_WORDS.map((w) => makeFake(w, rnd))])]
  .filter(Boolean);
console.log(`measuring ${WORDS.length} plate strings, longest ${Math.max(...WORDS.map((w) => w.length))} chars`);
const out = await page.evaluate(async (WORDS) => {
  await document.fonts.ready;
  const CANVAS_W = 1024, CANVAS_H = 256, FONT_PX = 168, MIN = 64;
  const TRACK = [1, 7, 12], WEIGHT = [700, 800, 800];
  const FAMILY = "'Atkinson Hyperlegible Next', Verdana, 'DejaVu Sans', Arial, sans-serif";
  const c = document.createElement('canvas');
  c.width = CANVAS_W; c.height = CANVAS_H;
  const g = c.getContext('2d');
  const words = WORDS;
  const res = [];
  for (let s = 0; s < TRACK.length; s++) {
    let worstPx = 999, worstWord = '', overflow = 0, overWord = '';
    for (const w of words) {
      g.letterSpacing = `${TRACK[s]}px`;
      let px = FONT_PX;
      g.font = `${WEIGHT[s]} ${px}px ${FAMILY}`;
      while (px > MIN && g.measureText(w).width > CANVAS_W - 90) {
        px -= 8;
        g.font = `${WEIGHT[s]} ${px}px ${FAMILY}`;
      }
      const width = g.measureText(w).width;
      if (px < worstPx) { worstPx = px; worstWord = w; }
      if (width > CANVAS_W - 90) { overflow++; if (!overWord) overWord = w; }
    }
    res.push({ step: s, track: TRACK[s], words: words.length,
      worstPx, worstWord, overflow, overWord });
  }
  return res;
}, WORDS);
console.log(JSON.stringify(out, null, 1));
await browser.close();
