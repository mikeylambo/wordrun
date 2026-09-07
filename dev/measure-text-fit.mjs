/**
 * RC11.2 — does every string in the game FIT?
 *
 * A player reached 1,293,696 in ENDLESS and the results headline was clipped at
 * both edges. The headline is `font-size: clamp(72px, 23vw, 140px)` with no fit
 * logic at all: the plate got a shrink-to-fit in RC10.2 and nothing else in the
 * game ever did. `gate:calibration` DOES hold a headline-width check, but it
 * holds it against the DAILY ROUTE's ceiling ("stays under seven digits"),
 * and ENDLESS has no ceiling — so the one number that could overflow was the
 * one number the check could not see.
 *
 * This walks the real DOM at the narrowest phones and reports every element
 * whose text is wider than the box it is drawn in, with the game driven into
 * each screen and stuffed with the WORST content it can legally hold: the
 * longest word in the bank, an eight-digit score, a maximum-length seed, a
 * full recap.
 *
 *   npm run build && node dev/measure-text-fit.mjs
 *
 * Not a gate, for the same reason measure-plate-fit is not: text metrics need
 * the real font in a real browser. The GATE holds the inputs this measures.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = 4193;

const WIDTHS = [320, 360, 390, 430];   // iPhone SE .. Pro Max
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
    const ctx = await browser.newContext({
      viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('dictiondash.v1.__migrated', '1');
        localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SIM && window.__START);
    await page.evaluate(() => document.fonts.ready);

    const found = await page.evaluate(() => {
      // Stuff every screen with the worst content it can legally hold, then
      // show them all at once and measure. Nothing here is a guess about what
      // a string might be: the numbers are the widest the systems can produce.
      const WORST = {
        finalDist: (99999999).toLocaleString(),
        deathTag: 'RUN OVER',
        dist: (99999999).toLocaleString(),
        seedLine: 'SEED 2026-09-07 · BEST 99,999,999 · RUN 99',
        deathSeed: 'SEED 2026-09-07 · BEST 99,999,999 · RUN 99',
        dailyNote: '100 WORDS · SAME FOR EVERYONE · NEW EACH DAY',
        coach: 'HOLD DASH TO RAISE THE BAR — A SHORTER WINDOW PAYS MORE',
        titleStreak: '30 DAY STREAK · BEST 99 DAYS',
        titleMastery: 'MASTERED 5,381 OF 5,381 WORDS',
      };
      for (const [id, text] of Object.entries(WORST)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      }
      for (const s of document.querySelectorAll('.screen')) s.classList.add('on');
      const out = [];
      const seen = new Set();
      const VW = document.documentElement.clientWidth;
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent || el.children.length) continue;
        if (el.closest('svg')) continue;          // SVG text scales with its viewBox
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        // TWO failure modes, and the one that shipped is the second.
        //  (a) the text is wider than the box that draws it — a clipped label;
        //  (b) the box itself runs off the SCREEN — which is what a 1,293,696
        //      score does, because an inline element simply grows and nothing
        //      in the chain has a width to clip it against.
        const boxOver = el.scrollWidth - Math.ceil(r.width);
        const screenOver = Math.max(0, Math.ceil(-r.left), Math.ceil(r.right - VW));
        const over = Math.max(boxOver > 1 ? boxOver : 0, screenOver);
        if (over > 1) {
          const key = (el.id || el.className || el.tagName) + '|' + el.textContent.slice(0, 20);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            id: el.id || '', cls: String(el.className || '').slice(0, 28),
            text: el.textContent.trim().slice(0, 30),
            how: screenOver > 0 ? 'off-screen' : 'clipped',
            box: Math.round(r.width), needs: Math.max(el.scrollWidth, Math.round(r.width)), over,
            font: cs.fontSize,
          });
        }
      }
      return out;
    });
    for (const f of found) rows.push({ width, ...f });
    await ctx.close();
  }
} finally {
  await browser.close();
  preview.kill();
}

console.log('RC11.2 — text that does not fit its box, at the narrowest phones');
console.log('  worst legal content in every field: 99,999,999 score, longest seed line, full coach line\n');
if (!rows.length) console.log('  nothing overflows at 320 / 360 / 390 / 430 px.');
else {
  console.log('  vw  | element              | font  |  box  needs  over | how        | text');
  for (const r of rows) {
    console.log(`  ${String(r.width).padStart(3)} | ${(r.id || r.cls).padEnd(20)} | ` +
      `${r.font.padStart(5)} | ${String(r.box).padStart(4)} ${String(r.needs).padStart(6)} ${String(r.over).padStart(5)} | ` +
      `${r.how.padEnd(10)} | ${r.text}`);
  }
  console.log(`\n  ${rows.length} overflowing element(s).`);
}
