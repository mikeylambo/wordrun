/**
 * How much of a desktop screen should the game take?
 *
 * On a landscape display the play area is a fixed-aspect cabinet strip —
 * `--cab-aspect: 0.4621`, which is 390x844, the phone every reading
 * measurement in this build was taken at. On a 1920x1080 screen that is a
 * 469px column with 725px of bezel either side, and a player in full screen
 * still sees a phone.
 *
 * The camera's FOV is VERTICAL, so a wider frame at the same height changes
 * nothing about how large a word plate renders — it only reveals more of the
 * world to the sides. That makes this purely a composition question, which is
 * a question for eyes, not for a gate. One moment, four widths.
 *
 *   npm run build && node dev/shoot-framing-stills.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = 4176;
const OUT = path.resolve('dev/stills');
mkdirSync(OUT, { recursive: true });

// 0.4621 is what ships. 99 defeats the `min(100vw, …)` and gives full bleed.
const FRAMES = [
  { file: 'F1-cabinet-0.4621.png', aspect: 0.4621, note: 'ships today — the phone, framed' },
  { file: 'F2-wide-0.62.png', aspect: 0.62, note: 'a third wider' },
  { file: 'F3-wide-0.80.png', aspect: 0.80, note: 'nearly 4:5' },
  { file: 'F4-fullbleed.png', aspect: 99, note: 'the whole window, no bezel' },
];
const GATE = 4, PLATE_AT_M = 38, SPEED = 36, SETTLE_FRAMES = 66, CHAIN = 22, GAP = 42;

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => {
  preview.stdout.on('data', (b) => { if (String(b).includes(String(PORT))) res(); });
  preview.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 20000);
});

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const manifest = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('dictiondash.v1.__migrated', '1');
      localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      localStorage.setItem('dictiondash.v1.pref.mode', 'standard');
    } catch {}
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/?stills=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SIM && window.__START && window.__RENDER?.stage);
  await page.evaluate(() => document.fonts.ready);

  for (const f of FRAMES) {
    const state = await page.evaluate(async ({ aspect, GATE, PLATE_AT_M, SPEED, SETTLE_FRAMES, CHAIN, GAP }) => {
      document.documentElement.style.setProperty('--cab-aspect', String(aspect));
      // The renderer sizes itself from #app; a custom property does not fire
      // a resize, so the frame has to be told its shape changed.
      window.dispatchEvent(new Event('resize'));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (window.__SIM.phase !== 'title') window.__QUIT();
      window.__START();
      const sim = window.__SIM, wg = sim.wordGates;
      let guard = 0;
      while (wg.next < GATE && guard++ < 20000) {
        const g = wg.current();
        window.__STEP(1, { confirm: wg.armed(sim.player.d) && g.real && !g.resolved });
      }
      sim.player.chain = CHAIN;
      sim.player.speed = SPEED;
      let frames = 0;
      while (frames < 600) {
        sim.beast.gap = GAP; sim.beast.desired = GAP;
        window.__TICK(1, 1 / 60);
        frames++;
        if (frames >= SETTLE_FRAMES && wg.current().d - sim.player.d <= PLATE_AT_M) break;
      }
      const app = document.getElementById('app').getBoundingClientRect();
      const g = wg.current();
      // Word-plate legibility outranks every other visual change, so the
      // framing is only a question at all if the plate renders the same size.
      // A perspective camera's FOV is vertical: at a fixed viewport height and
      // a fixed distance, one world unit is `H / (2 d tan(fov/2))` pixels
      // however wide the frame gets.
      const stage = window.__RENDER.stage;
      const dM = g.d - sim.player.d;
      const pxPerMetre = app.height / (2 * dM * Math.tan(stage.camera.fov * Math.PI / 360));
      return { app: `${Math.round(app.width)}x${Math.round(app.height)}`,
        platePxPerM: +pxPerMetre.toFixed(2),
        bezelEachSide: Math.round((innerWidth - app.width) / 2),
        word: g.shown, chain: sim.player.chain,
        fov: +window.__RENDER.stage.camera.fov.toFixed(1),
        camAspect: +window.__RENDER.stage.camera.aspect.toFixed(3) };
    }, { ...f, GATE, PLATE_AT_M, SPEED, SETTLE_FRAMES, CHAIN, GAP });
    await page.screenshot({ path: path.join(OUT, f.file), timeout: 120000 });
    manifest.push({ ...f, ...state });
    console.log(f.file.padEnd(26), JSON.stringify(state));
  }
} finally {
  await browser.close();
  preview.kill();
}
writeFileSync(path.join(OUT, 'framing-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote', manifest.length, 'framing stills to', OUT);
