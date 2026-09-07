/**
 * RC11 concept still driver — THE RIBBON.
 *
 * Same seed, gate, read moment, speed and frame as the Phase K set, so the
 * two can be laid side by side: the DAILY route for 2026-09-02 (pinned with
 * `?draft=`, which hashes to the identical seed), the fifth gate, the plate
 * 38 m ahead, 36 m/s, 390x844 at 2x. The only things that change between the
 * three frames are the chain and what the chain does to the surface.
 *
 * The Phase K page layer is deliberately NOT armed. The question here is the
 * road; arming both concepts would put two open decisions in one frame and
 * neither could be answered from it.
 *
 *   npm run build && node dev/shoot-ribbon-stills.mjs
 *
 * Writes three PNGs, a manifest of what was actually on screen, and the hue
 * gate — every colour the surface paints, at every band, against every
 * reserved hue — to dev/stills/rc11/. Nothing below is asserted: the numbers
 * are read back from the running page, and the plate's legibility is measured
 * off the real rendered pixels through a render-target readback.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pwPath = process.env.PLAYWRIGHT_CORE || 'playwright-core';
const { chromium } = require(pwPath);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = 4183;
const OUT = path.resolve('dev/stills/rc11');
mkdirSync(OUT, { recursive: true });

const SEED = '2026-09-02';        // the Phase K road, pinned
const SHOTS = [
  { file: 'R1-chain0-ribbon.png', chain: 0, gap: 48 },
  { file: 'R2-chain25-ribbon.png', chain: 25, gap: 48 },
  { file: 'R3-chain150-crest-ribbon.png', chain: 150, gap: 48 },
];
const GATE = 4;
const PLATE_AT_M = 38;
const SPEED = 36;
const SETTLE_FRAMES = 66;

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => {
  preview.stdout.on('data', (b) => { if (String(b).includes(String(PORT))) res(); });
  preview.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 30000);
});

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const manifest = [];
let hue = null;
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('dictiondash.v1.__migrated', '1');
      localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      localStorage.setItem('dictiondash.v1.pref.mode', 'standard');
      localStorage.setItem('dictiondash.v1.meta.stats',
        JSON.stringify({ usedDash: 3, usedStopReal: 1, usedStopFake: 1, usedConfirm: 9 }));
    } catch {}
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/?dev=1&ribbon=1&draft=${SEED}&mode=standard`,
    { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SIM && window.__RENDER?.stage && window.__START);
  await page.waitForFunction(() => !!window.__RIBBON, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !!window.__RENDER?.stage?.__ribbon, null, { timeout: 30000 });

  for (const shot of SHOTS) {
    const state = await page.evaluate(async ({ chain, gap, GATE, PLATE_AT_M, SPEED, SETTLE_FRAMES }) => {
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
      sim.player.chain = chain;
      sim.player.speed = SPEED;
      const dev = document.querySelector('#devPanel, .dev-panel, [data-dev-panel]');
      if (dev) dev.style.display = 'none';
      let frames = 0;
      while (frames < 600) {
        sim.beast.gap = gap;
        sim.beast.desired = gap;
        // The gradient is frozen at one phase for every still, so the three
        // frames differ by the CHAIN and nothing else.
        window.__STILLS_FROZEN_T = 6.0;
        window.__TICK(1, 1 / 60);
        frames++;
        const g = wg.current();
        if (frames >= SETTLE_FRAMES && g.d - sim.player.d <= PLATE_AT_M) break;
      }
      const g = wg.current();
      const stage = window.__RENDER.stage;
      const ribbon = stage.__ribbon;
      const cam = stage.camera;
      const plate = window.__RIBBON.measurePlate();

      return {
        seed: window.__SEED.string, gateIndex: g.index,
        plateAheadM: +(g.d - sim.player.d).toFixed(1), word: g.shown, real: g.real,
        chain: sim.player.chain, speed: +sim.player.speed.toFixed(1), gap: +sim.beast.gap.toFixed(1),
        fov: +cam.fov.toFixed(1),
        cameraBack: +(-(cam.position.z) - sim.player.d).toFixed(1),
        cameraHeight: +cam.position.y.toFixed(1),
        surfaceSat: +ribbon.skinMat.uniforms.uSat.value.toFixed(3),
        surfaceGain: +ribbon.skinMat.uniforms.uGain.value.toFixed(3),
        ruleGain: +ribbon.skinMat.uniforms.uRuleGain.value.toFixed(3),
        plate,
        frames, d: +sim.player.d.toFixed(1),
      };
    }, { ...shot, GATE, PLATE_AT_M, SPEED, SETTLE_FRAMES });
    await page.screenshot({ path: path.join(OUT, shot.file), timeout: 180000 });
    manifest.push({ file: shot.file, ...state });
    console.log(shot.file, JSON.stringify(state));
  }

  hue = await page.evaluate(() => {
    const R = window.__RIBBON;
    const rows = R.hueTable(360);
    let worst = Infinity, worstHue = null;
    for (const r of rows) if (r.clearance < worst) { worst = r.clearance; worstHue = r.hue; }
    return {
      reserved: R.RESERVED.HUES.map((h) => ({ deg: h.deg, why: h.why })),
      minSeparation: R.RESERVED.MIN_SEPARATION_DEG,
      stops: R.STOPS.map((s) => ({ ...s, clearance: +R.hueClearance(s.hue).toFixed(1),
        legal: R.hueLegal(s.hue) })),
      sampled: rows.length,
      worstClearance: +worst.toFixed(1),
      worstHue: +worstHue.toFixed(1),
      allLegal: rows.every((r) => r.clearance >= R.RESERVED.MIN_SEPARATION_DEG),
    };
  });
} finally {
  await browser.close();
  preview.kill();
}
writeFileSync(path.join(OUT, 'manifest.json'),
  JSON.stringify({ stills: manifest, hueGate: hue }, null, 2) + '\n');

console.log('\nHUE GATE — every colour the surface paints, against every reserved hue');
if (hue) {
  console.log(`  fence: ${hue.minSeparation}° from ` +
    hue.reserved.map((h) => `${h.deg}° (${h.why})`).join(', '));
  for (const s of hue.stops) {
    console.log(`  ${String(s.name).padEnd(30)} hue ${String(s.hue).padStart(3)}°  ` +
      `sat ${s.sat.toFixed(2)}  val ${s.val.toFixed(2)}  clearance ${String(s.clearance).padStart(5)}°  ` +
      (s.legal ? 'LEGAL' : 'RESERVED'));
  }
  console.log(`  ${hue.sampled} samples across the whole ramp: worst clearance ` +
    `${hue.worstClearance}° at hue ${hue.worstHue}° — ${hue.allLegal ? 'ALL LEGAL' : 'FENCE BREACHED'}`);
}
console.log('\nwrote', manifest.length, 'stills to', OUT);
