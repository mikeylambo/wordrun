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
const TOUCH = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const KEYS = { viewport: { width: 1280, height: 800 } };

async function shoot(dir, prepare, device = TOUCH) {
  mkdirSync(path.join(ROOT, dir), { recursive: true });
  const ctx = await browser.newContext(device);
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

/**
 * Drive until the named teaching stop is on screen, reading correctly the
 * whole way. Throws rather than filing a still of the wrong screen.
 */
async function driveToStop(page, which, cap = 1600) {
  for (let i = 0; i < cap; i++) {
    const s = await page.evaluate(() => ({
      stop: window.__SIM?.teach?.active,
      band: document.getElementById('guidedTeach')?.classList.contains('on') || false,
      armed: window.__SIM?.wordGates.armed(window.__SIM.player.d),
      real: window.__SIM?.wordGates.current().real,
      over: document.getElementById('deathScreen')?.classList.contains('on') || false,
    }));
    if (s.over) throw new Error(`the run ended before the ${which} stop`);
    if (s.stop === which && s.band) return;          // frozen AND speaking
    if (!s.stop && s.armed) await page.keyboard.press(s.real ? 'ArrowRight' : 'ArrowLeft');
    await wait(s.stop ? 110 : 70);
  }
  const st = await page.evaluate(() => ({
    stop: window.__SIM?.teach?.active, next: window.__SIM?.wordGates.next,
    hearts: window.__SIM?.hearts, enabled: window.__SIM?.teach?.enabled,
    learned: window.__SIM?.teach?.learned, fired: window.__SIM?.teach?.firedThisRun,
    band: document.getElementById('guidedTeach')?.classList.contains('on'),
    chart: window.__SIM?.wordGates.profile?.CHART,
  }));
  throw new Error(`never reached the ${which} stop — ${JSON.stringify(st)}`);
}

/** The three stops, in order, shot for whichever controls this device has. */
async function shootStops(page, shot, suffix) {
  await driveToStop(page, 'real');
  await shot(`03-stop-real${suffix}`);
  await page.keyboard.press('ArrowRight');
  await driveToStop(page, 'fake');
  await shot(`04-stop-fake${suffix}`);
  await wait(2400);                                   // the pass releases it
  await driveToStop(page, 'dash');
  await shot(`05-stop-dash${suffix}`);
  await page.keyboard.press('Space');
  await wait(500);
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
  await shootStops(page, shot, '');

  // RUN OVER and the card.
  await page.evaluate(() => window.__SIM && (window.__SIM.hearts = 0));
  await page.waitForFunction(() => document.getElementById('deathScreen')?.classList.contains('on'),
    null, { timeout: 40000 }).catch(() => {});
  await wait(900);
  await shot('06-run-over');
  await wait(2200);                        // the count-up settles
  await shot('07-results');
  await page.evaluate(() => document.getElementById('moreStats')?.click());
  await wait(500);
  await shot('08-results-more-stats');

  // AGAIN: the one-second cut, not the full arrival.
  await page.evaluate(() => document.getElementById('deathAgain')?.click());
  await wait(320);
  await shot('09-again-quick-cut');

  // PROFILE, which now carries the goals, the queue and the bank.
  await page.evaluate(() => window.__QUIT?.());
  await wait(700);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('dictiondash:show-curve')));
  await wait(600);
  await shot('10-profile');
  await ctx.close();
}

// ── fresh, on a keyboard ─────────────────────────────────────────────────
// The same three stops on a 1280x800 desktop viewport: the lines must name
// the KEYS this player has, and no ring may appear — there is no on-screen
// control to ring.
{
  const { page, ctx, shot } = await shoot('fresh', async () => {}, KEYS);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__SIM?.phase === 'running', null, { timeout: 60000 });
  await shootStops(page, shot, '-keyboard');
  const rings = await page.evaluate(() => document.querySelectorAll('.teachRing').length);
  if (rings) throw new Error('a ring appeared on a keyboard viewport');
  await ctx.close();
}

// ── returning ────────────────────────────────────────────────────────────
{
  const { page, ctx, shot } = await shoot('returning', async (p) => {
    // Both verbs demonstrated, through the game's own ledger — the same
    // counters a played run writes. GUIDED TIPS is left ON, so what these
    // stills prove is that a taught player is not taught again.
    await p.evaluate(() => {
      for (const k of ['usedStopReal', 'usedStopFake', 'usedStopDash',
        'usedConfirm', 'usedReject']) window.__META?.stats.increment(k);
    });
    await p.reload();
    await p.waitForFunction(() => window.__SIM, null, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));
  });
  await shot('01-title');

  await page.tap('body', { position: { x: 195, y: 150 } });
  await page.waitForFunction(() => window.__SIM?.phase === 'running', null, { timeout: 60000 });
  // Prove the ABSENCE: read a dozen words with every stop already seen —
  // no freeze, no ring, no line, at any point.
  for (let i = 0; i < 260; i++) {
    const s = await page.evaluate(() => ({
      stop: window.__SIM?.teach?.active,
      ring: !!document.querySelector('.teachRing'),
      band: document.getElementById('guidedTeach')?.classList.contains('on') || false,
      armed: window.__SIM?.wordGates.armed(window.__SIM.player.d),
      real: window.__SIM?.wordGates.current().real,
      next: window.__SIM?.wordGates.next,
    }));
    if (s.stop || s.ring || s.band) throw new Error(`a returning profile was taught: ${s.stop || 'ring/line'}`);
    if (s.next > 8) break;
    if (s.armed) await page.keyboard.press(s.real ? 'ArrowRight' : 'ArrowLeft');
    await new Promise((r) => setTimeout(r, 70));
  }
  await shot('02-run-no-teaching');       // no stop, no ring, no line

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
