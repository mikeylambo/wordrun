/**
 * RC11.2 — the results headline, driven rather than stuffed.
 *
 * A player reached 1,293,696 in ENDLESS and the headline was clipped at both
 * edges. `dev/measure-text-fit.mjs` came back clean, which meant the harness
 * was wrong rather than the photograph: forcing `.screen.on` and setting
 * `#finalDist.textContent` does not lay the card out the way `renderDeath`
 * does. So this calls the REAL card, with real scores, at every phone width.
 *
 * `.big` is `clamp(72px, 23vw, 140px)` with no fit logic at all — the word
 * plate got shrink-to-fit in RC10.2 and nothing else in the game ever did —
 * and `gate:calibration`'s headline-width check holds the DAILY ROUTE's
 * ceiling ("under seven digits"), which ENDLESS has never had.
 *
 *   npm run build && node dev/measure-headline-fit.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = 4198;

// Phone widths AND the framed (cabinet) widths. The first pass tested only
// phones and came back clean while the player had a photograph of a clipped
// headline — because on a wide window `#app` is a fixed portrait CARD and the
// headline is sized in `cqw` against it, so the two cases are not the same
// measurement at all.
const WIDTHS = [320, 360, 390, 430, 820, 1024, 1440];
const SCORES = [9_999, 99_999, 594_266, 1_293_696, 9_999_999, 99_999_999];

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => {
  preview.stdout.on('data', (b) => { if (String(b).includes(String(PORT))) res(); });
  preview.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 30000);
});

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
const rows = [];
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('dictiondash.v1.__migrated', '1');
        localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__UI && window.__SIM);
    await page.evaluate(() => document.fonts.ready);
    for (const score of SCORES) {
      const r = await page.evaluate((score) => {
        // The real card, through the real entry point.
        window.__UI.renderDeath({ distance: 12345, score, reward: 0, correct: 90,
          wrong: 4, bestChain: 40, best: 0, isPb: true, recap: [], objectives: {},
          lifetime: {}, review: null });
        document.getElementById('deathScreen').classList.add('on');
        // renderDeath starts a count-up that ui.update steps each frame; driving
        // that here needs the whole live frame, so the final value is simply
        // written in. The count-up only ever ends on this string.
        const el = document.getElementById('finalDist');
        el.textContent = score.toLocaleString('en-US');
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el.parentElement);
        // The headline is drawn inside #app, which on a wide window is a fixed
        // portrait card, NOT the viewport. Measure against the box that clips.
        const app = document.getElementById('app') || document.documentElement;
        const card = app.getBoundingClientRect();
        return { text: el.textContent, font: cs.fontSize,
          w: Math.round(box.width), card: Math.round(card.width),
          over: Math.round(Math.max(0, card.left - box.left) + Math.max(0, box.right - card.right)) };
      }, score);
      rows.push({ width, score, ...r });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  preview.kill();
}

console.log('RC11.2 — the results headline, driven through renderDeath\n');
console.log('  vw   | card | score          | font  | drawn |  fits | overflow');
let bad = 0;
for (const r of rows) {
  const fits = r.over <= 0;
  if (!fits) bad++;
  console.log(`  ${String(r.width).padStart(4)} | ${String(r.card).padStart(4)} | ${r.text.padStart(14)} | ` +
    `${r.font.padStart(5)} | ${String(r.w).padStart(5)} | ${(fits ? 'yes' : 'NO').padStart(5)} | ` +
    (fits ? '' : `clipped by ${r.over}px`));
}
console.log(`\n  ${bad} of ${rows.length} combinations are CLIPPED by the card that draws them.`);
