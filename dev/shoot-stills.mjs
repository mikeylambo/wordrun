/**
 * Phase K still driver. Builds nothing itself: run `npm run build` first,
 * then `node dev/shoot-stills.mjs`. Serves dist/ through `vite preview`,
 * drives the real game (same seed, same frame, same speed, same read moment)
 * through the window.__ hooks, and writes three PNGs plus a manifest of what
 * was actually on screen to dev/stills/.
 *
 * playwright-core is not a repo dependency; point PLAYWRIGHT_CORE at an
 * install (defaults to a plain `import('playwright-core')`), and CHROME at a
 * Chromium binary.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pwPath = process.env.PLAYWRIGHT_CORE || 'playwright-core';
const { chromium } = require(pwPath);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4173;
const OUT = path.resolve('dev/stills');
mkdirSync(OUT, { recursive: true });

// The three moments of the brief: sparse manuscript, chain 50 blooming,
// chain 150 typeset with the Redline close. Same seed, speed, gate and frame.
const SHOTS = [
  { file: 'K1-chain0-sparse-manuscript.png', chain: 0, gap: 48 },
  { file: 'K2-chain50-blooming.png', chain: 50, gap: 48 },
  { file: 'K3-chain150-typeset-redline-close.png', chain: 150, gap: 16 },
  // Measured, not asked for: the same page with the Redline inside its
  // scream range, where the correction blocks cross the plate.
  { file: 'K3b-chain150-typeset-redline-9m.png', chain: 150, gap: 9 },
];
const GATE = 4;          // the read moment: the gate after this many resolved
const PLATE_AT_M = 38;   // metres from runner to plate when the shutter fires
const SPEED = 36;        // one speed for every still (camera boom follows speed)
const SETTLE_FRAMES = 66; // camera and flow ease at 6/s and 3.5/s: >1s to land

const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => {
  preview.stdout.on('data', (b) => { if (String(b).includes(String(PORT))) res(); });
  preview.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 20000);
});

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const manifest = [];
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(() => {
    // The DAILY RUN: the same hundred words for everyone, so every still
    // reads the same word at the same gate. ENDLESS re-salts each run.
    try {
      localStorage.setItem('dictiondash.v1.__migrated', '1');
      localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      localStorage.setItem('dictiondash.v1.pref.mode', 'standard');
    } catch {}
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/?dev=1&stills=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SIM && window.__RENDER?.stage?.__page && window.__START);
  await page.evaluate(() => document.fonts.ready);

  for (const shot of SHOTS) {
    const state = await page.evaluate(async ({ chain, gap, GATE, PLATE_AT_M, SPEED, SETTLE_FRAMES }) => {
      // A fresh run, then the sim is stepped headlessly with every read
      // answered right until GATE gates are resolved.
      if (window.__SIM.phase !== 'title') window.__QUIT();
      window.__START();
      const sim = window.__SIM;
      const wg = sim.wordGates;
      let guard = 0;
      while (wg.next < GATE && guard++ < 20000) {
        const g = wg.current();
        const armed = wg.armed(sim.player.d);
        window.__STEP(1, { confirm: armed && g.real && !g.resolved });
      }
      // The moment: one chain and one speed for every still; the gap is held
      // every frame (the Redline would otherwise fall back at this pace), and
      // the frame runs live until the plate sits PLATE_AT_M ahead.
      sim.player.chain = chain;
      sim.player.speed = SPEED;
      let frames = 0;
      const dev = document.querySelector('#devPanel, .dev-panel, [data-dev-panel]');
      if (dev) dev.style.display = 'none';
      while (frames < 600) {
        sim.beast.gap = gap;
        sim.beast.desired = gap;
        window.__TICK(1, 1 / 60);
        frames++;
        const g = wg.current();
        if (frames >= SETTLE_FRAMES && g.d - sim.player.d <= PLATE_AT_M) break;
      }
      const g = wg.current();
      const stage = window.__RENDER.stage;
      return {
        seed: window.__SEED.string, gateIndex: g.index, plateAheadM: +(g.d - sim.player.d).toFixed(1),
        word: g.shown, real: g.real,
        chain: sim.player.chain, speed: +sim.player.speed.toFixed(1), gap: +sim.beast.gap.toFixed(1),
        band: window.__STILLS.band(sim.player.chain), fov: +stage.camera.fov.toFixed(1),
        cameraBack: +(-(stage.camera.position.z) - sim.player.d).toFixed(1), cameraHeight: +stage.camera.position.y.toFixed(1),
        flow: +window.__RENDER.materialPass.terrain.userData.uP9Flow.value.toFixed(2),
        instances: {
          rules: stage.__page.rules.count, type: stage.__page.type.count, stops: stage.__page.stops.count,
          dashes: stage.__page.dashes.count, brackets: stage.__page.brackets.count, caps: stage.__page.caps.count,
        },
        frames, d: +sim.player.d.toFixed(1),
      };
    }, { ...shot, GATE, PLATE_AT_M, SPEED, SETTLE_FRAMES });
    await page.screenshot({ path: path.join(OUT, shot.file) });
    manifest.push({ file: shot.file, ...state });
    console.log(shot.file, JSON.stringify(state));
  }
} finally {
  await browser.close();
  preview.kill();
}
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote', manifest.length, 'stills to', OUT);
