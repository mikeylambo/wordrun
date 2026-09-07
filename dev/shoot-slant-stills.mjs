/**
 * RC11.2 — the four slant candidates, at the worst slant on the DAILY route.
 *
 * A player asked whether the tilt is a glitch. It is not, but it is not the
 * authored bank either: bank segments are 10.5 % of the route while 71 % of it
 * reached the eye with more than a degree of tilt, because the rig leaned into
 * `rollAt` (the segment bank) while the mesh is built from `crossSlopeAt` (the
 * bank MINUS the ribbon's turn-lean) — so the camera cancelled a third of one
 * term and none of the other, and the other applies wherever the road curves.
 *
 * The four frames are shot at 2249 m on the 2026-09-02 road, the single worst
 * point on it (bank 5.64°, turn-lean 4.78°), in ONE browser session with the dials mutated between shots:
 *
 *   A  shipped              rig reads rollAt          worst 8.2°
 *   B  rig reads crossSlope                           worst 6.6°
 *   C  B, and no turn-lean  EDGE_BANK 0               worst 3.7°
 *   D  B, and half of both  ROLL x0.6, EDGE_BANK x0.5 worst 3.7°
 *
 *   npm run build && node dev/shoot-slant-stills.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = 4196;
const OUT = path.resolve('dev/stills/rc11-slant');
mkdirSync(OUT, { recursive: true });

const SEED = '2026-09-02';
// The worst apparent slant on THIS seed — 8.36 deg at 2249 m, of which the
// bank is 5.64 and the turn-lean 4.78. The first shoot used the worst point of
// a DIFFERENT seed (today's daily rather than the pinned 2026-09-02 road) and
// then ran 54 m past it during the settle, so all four frames landed on a
// straight with no bank in them at all and compared nothing.
const AT_M = 2249;
const SETTLE_FRAMES = 90;
const SETTLE_M = 36 * (SETTLE_FRAMES / 60);   // land ON the worst point
const SHOTS = [
  { file: 'S-A-shipped.png', readsCross: false, roll: 1, bank: 1 },
  { file: 'S-B-camera-reads-crossslope.png', readsCross: true, roll: 1, bank: 1 },
  { file: 'S-C-no-turn-lean.png', readsCross: true, roll: 1, bank: 0 },
  { file: 'S-D-half-of-both.png', readsCross: true, roll: 0.6, bank: 0.5 },
];

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => {
  preview.stdout.on('data', (b) => { if (String(b).includes(String(PORT))) res(); });
  preview.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 30000);
});

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const manifest = [];
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('dictiondash.v1.__migrated', '1');
      localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      localStorage.setItem('dictiondash.v1.meta.stats',
        JSON.stringify({ usedDash: 3, usedStopReal: 1, usedStopFake: 1, usedConfirm: 9 }));
    } catch {}
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/?draft=${SEED}&mode=standard`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SIM && window.__START);
  await page.evaluate(() => document.fonts.ready);

  for (const shot of SHOTS) {
    const state = await page.evaluate(async ({ readsCross, roll, bank, AT_M, SETTLE_M, SETTLE_FRAMES }) => {
      const T = window.__TUNING;
      const RT = T.TERRAIN.ROUTE;
      // The rig reads this every frame, so it takes effect live.
      T.CAMERA.TRACK_ROLL_READS_CROSS = readsCross;
      // EDGE_BANK is read inside crossSlopeAt, so it is live too. ROLL is
      // baked into the segment list, so scaling it needs the terrain rebuilt.
      RT.EDGE_BANK = 0.35 * bank;
      if (window.__SIM.phase !== 'title') window.__QUIT();
      window.__START();
      const sim = window.__SIM;
      if (roll !== 1) {
        for (const s of sim.terrain._segs) s.roll *= roll;
        sim.terrain.chunks.clear();
        window.__RENDER.terrainMesh.reset?.(sim.terrain);
      }
      // Run to the worst point, answering every armed real word.
      let guard = 0;
      while (sim.player.d < AT_M - SETTLE_M && guard++ < 400000) {
        const wg = sim.wordGates;
        const g = wg.current();
        window.__STEP(1, { confirm: wg.armed(sim.player.d) && g.real && !g.resolved });
      }
      sim.player.speed = 36;
      const dev = document.querySelector('#devPanel, .dev-panel, [data-dev-panel]');
      if (dev) dev.style.display = 'none';
      for (let i = 0; i < SETTLE_FRAMES; i++) { sim.beast.gap = 48; sim.beast.desired = 48; window.__TICK(1, 1 / 60); }
      const t = sim.terrain;
      const d = sim.player.d;
      const degOf = (r) => Math.atan(r) * 180 / Math.PI;
      const cross = t.crossSlopeAt(d);
      const taken = readsCross ? cross : t.rollAt(d);
      return {
        d: +d.toFixed(1), roll: RT.ROLL * roll, edgeBank: +RT.EDGE_BANK.toFixed(3), readsCross,
        surfaceTiltDeg: +degOf(cross).toFixed(2),
        bankDeg: +degOf(t.rollAt(d)).toFixed(2),
        leanDeg: +degOf(cross - t.rollAt(d)).toFixed(2),
        cameraRollDeg: +(window.__RENDER.rig.roll * 180 / Math.PI).toFixed(2),
        apparentSlantDeg: +Math.abs(degOf(cross) - degOf(taken) * T.CAMERA.TRACK_ROLL_SYMPATHY).toFixed(2),
      };
    }, { ...shot, AT_M, SETTLE_M, SETTLE_FRAMES });
    await page.screenshot({ path: path.join(OUT, shot.file), timeout: 180000 });
    manifest.push({ file: shot.file, ...state });
    console.log(shot.file, JSON.stringify(state));
  }
} finally {
  await browser.close();
  preview.kill();
}
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('\nwrote', manifest.length, 'frames to', OUT);
