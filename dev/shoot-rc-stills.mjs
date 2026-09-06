/**
 * The RC audit stills. Builds nothing itself: run `npm run build` first, then
 * `node dev/shoot-rc-stills.mjs`. Serves dist/ and drives the REAL game through
 * its window.__ hooks, writing dev/stills/rc/{fresh,returning}/.
 *
 * Committed because the record has to be reproducible: every time the first
 * minute changes, the stills that claim to show it are re-shot by this script
 * rather than by whatever ad-hoc driver happened to exist that day.
 *
 *   fresh      — a profile that has never played: the title, the attract loop,
 *                the two TEACH prompts and the study stops, the first mistake,
 *                the DASH hint, RUN OVER, the card, and the quick AGAIN cut.
 *   returning  — a profile that has demonstrated both verbs: no teaching left,
 *                the full arrival only from the menu, the quick cut on retry.
 *
 * playwright-core is not a repo dependency; point PLAYWRIGHT_CORE at an install
 * and CHROME at a Chromium binary (both default to this machine's paths).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4173;
const ROOT = path.resolve('dev/stills/rc');

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' });
const stop = () => { try { preview.kill(); } catch { /* already gone */ } };
process.on('exit', stop);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(2500);

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});

/** One profile's shoot. `seed` runs before anything is played. */
async function shoot(dir, prepare) {
  mkdirSync(path.join(ROOT, dir), { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  const shots = [];
  const shot = async (name) => {
    await page.screenshot({ path: path.join(ROOT, dir, `${name}.png`) });
    shots.push(name);
    console.log(`  ${dir}/${name}.png`);
  };

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__SIM, null, { timeout: 20000 });
  await wait(1200);
  await prepare(page);
  return { page, ctx, shot, shots };
}

// ── fresh ────────────────────────────────────────────────────────────────
{
  const { page, ctx, shot } = await shoot('fresh', async () => {});
  await shot('01-title');

  // The attract loop: ten idle seconds on a quiet title.
  await page.waitForFunction(() => window.__ATTRACT_ACTIVE?.() === true,
    null, { timeout: 30000 }).catch(() => {});
  await wait(1400);
  await shot('02-attract-loop');
  await page.tap('body', { position: { x: 195, y: 420 } });   // any touch ends it
  await wait(600);

  // BEGIN RUN — straight into the run, no card in the way.
  await page.tap('body', { position: { x: 195, y: 150 } });
  await page.waitForFunction(() => window.__SIM?.phase === 'running', null, { timeout: 60000 });
  await page.waitForFunction(() => window.__SIM?.studyHold === true, null, { timeout: 60000 }).catch(() => {});
  await wait(500);
  await shot('03-study-stop-real');       // the world waits for the first verb
  await page.keyboard.press('ArrowRight');
  await wait(1400);
  await shot('04-first-correct');

  await page.waitForFunction(() => window.__SIM?.studyHold === true &&
    window.__SIM?.wordGates.next === 2, null, { timeout: 90000 }).catch(() => {});
  await wait(400);
  await shot('05-study-stop-fake');       // the other verb, also at rest
  await page.keyboard.press('ArrowLeft');
  await wait(1200);

  // The first mistake: say REAL to a fake and lose a heart for it.
  const heartsBefore = await page.evaluate(() => window.__SIM?.hearts);
  for (let i = 0; i < 400; i++) {
    const state = await page.evaluate(() => ({
      hearts: window.__SIM?.hearts,
      armed: window.__SIM?.wordGates.armed(window.__SIM.player.d),
      real: window.__SIM?.wordGates.current().real,
    }));
    if (state.hearts < heartsBefore) break;
    if (state.armed && !state.real) { await page.keyboard.press('ArrowRight'); await wait(260); }
    else await wait(90);
  }
  await wait(500);
  await shot('06-heart-lost');

  // The DASH hint, on the teach band with the rest of the teaching. Reading
  // CORRECTLY the whole way there: an idle wait let the run die of missed
  // words, and the still then showed the results card under the name of the
  // dash hint — a record that did not match the game.
  let hinted = false;
  for (let i = 0; i < 600 && !hinted; i++) {
    const s = await page.evaluate(() => ({
      hint: document.getElementById('powerHint')?.classList.contains('on') || false,
      over: document.getElementById('deathScreen')?.classList.contains('on') || false,
      armed: window.__SIM?.wordGates.armed(window.__SIM.player.d),
      real: window.__SIM?.wordGates.current().real,
    }));
    if (s.over) throw new Error('the run ended before the DASH hint — still would misreport');
    if (s.hint) { hinted = true; break; }
    if (s.armed) { await page.keyboard.press(s.real ? 'ArrowRight' : 'ArrowLeft'); await wait(240); }
    else await wait(80);
  }
  if (!hinted) throw new Error('never reached DASH READY');
  await shot('07-dash-ready');

  // RUN OVER and the card.
  await page.evaluate(() => window.__SIM && (window.__SIM.hearts = 0));
  await page.waitForFunction(() => document.getElementById('deathScreen')?.classList.contains('on'),
    null, { timeout: 40000 }).catch(() => {});
  await wait(900);
  await shot('08-run-over');
  await wait(2200);                        // the count-up settles
  await shot('09-results');
  await page.evaluate(() => document.getElementById('moreStats')?.click());
  await wait(500);
  await shot('10-results-more-stats');

  // AGAIN: the one-second cut, not the full arrival.
  await page.evaluate(() => document.getElementById('deathAgain')?.click());
  await wait(320);
  await shot('11-again-quick-cut');

  // PROFILE, which now carries the goals, the queue and the bank.
  await page.evaluate(() => window.__QUIT?.());
  await wait(700);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('dictiondash:show-curve')));
  await wait(600);
  await shot('12-profile');
  await ctx.close();
}

// ── returning ────────────────────────────────────────────────────────────
{
  const { page, ctx, shot } = await shoot('returning', async (p) => {
    // Both verbs demonstrated, through the game's own ledger — the same
    // counters a played run writes. GUIDED TIPS is left ON, so what these
    // stills prove is that a taught player is not taught again.
    await p.evaluate(() => {
      window.__META?.stats.increment('usedConfirm');
      window.__META?.stats.increment('usedReject');
    });
    await p.reload();
    await p.waitForFunction(() => window.__SIM, null, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));
  });
  await shot('01-title');

  await page.tap('body', { position: { x: 195, y: 150 } });
  await page.waitForFunction(() => window.__SIM?.phase === 'running', null, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3200));
  await shot('02-run-no-teaching');       // no TEACH, no study stop, no coach

  await page.evaluate(() => window.__SIM && (window.__SIM.hearts = 0));
  await page.waitForFunction(() => document.getElementById('deathScreen')?.classList.contains('on'),
    null, { timeout: 40000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2600));
  await page.evaluate(() => document.getElementById('deathAgain')?.click());
  await new Promise((r) => setTimeout(r, 320));
  await shot('03-retry-quick-cut');

  // The one ⚙ sheet, which is now the way to everything but the game.
  await page.evaluate(() => window.__QUIT?.());
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => document.getElementById('accessBtn')?.click());
  await new Promise((r) => setTimeout(r, 500));
  await shot('04-settings');
  await ctx.close();
}

await browser.close();
stop();
console.log('\nRC stills re-shot.');
