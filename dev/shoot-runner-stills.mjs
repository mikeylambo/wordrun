/**
 * The runner's states, shot at gameplay size. Builds nothing itself: run
 * `npm run build` first, then `node dev/shoot-runner-stills.mjs`.
 *
 * The figure is the one thing on screen the player watches for the whole
 * run, and it is the one thing no unit gate can judge. This drives the real
 * game into each of its postures — the five that N5 claims to have authored —
 * and writes dev/stills/runner/. The last pair are a deliberate close-up and
 * a solid-black silhouette test: if he does not read as a person at 100px of
 * pure outline, the silhouette is not finished.
 *
 * playwright-core is not a repo dependency; point PLAYWRIGHT_CORE at an
 * install and CHROME at a Chromium binary.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4174;
const OUT = path.resolve('dev/stills/runner');
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { file: 'R1-normal-flow.png', chain: 0, gap: 48, speed: 30 },
  { file: 'R2-high-flow.png', chain: 50, gap: 48, speed: 40 },
  { file: 'R3-dash.png', chain: 30, gap: 48, speed: 46, overdrive: true },
  { file: 'R4-dread-redline-close.png', chain: 12, gap: 11, speed: 34 },
  { file: 'R5-ghost-beside-player.png', chain: 20, gap: 48, speed: 36, ghost: true },
  // The two poses on the sheet that are not the run cycle.
  { file: 'R8-land.png', chain: 20, gap: 48, speed: 34, land: true },
  { file: 'R9-idle.png', chain: 0, gap: 60, speed: 0, idle: true },
];

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
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
try {
  const ctx = await browser.newContext({
    // Device scale 1, like the RC shoot: this set is committed as the record
    // of what the figure looks like, and a 4MB record nobody opens is worse
    // than a 1MB one everybody does.
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('dictiondash.v1.__migrated', '1');
      localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      localStorage.setItem('dictiondash.v1.pref.mode', 'standard');
    } catch { /* private mode: defaults are fine */ }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/?stills=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SIM && window.__START);
  await page.evaluate(() => document.fonts.ready);
  // The game's own frame loop would re-render whatever the sim drifted to
  // between the last __TICK and the shutter, which is how a "DASH" still ends
  // up showing a jog. Neutralise rAF and drive every frame from here.
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(120);

  for (const shot of SHOTS) {
    const state = await page.evaluate(async (s) => {
      if (window.__SIM.phase !== 'title') window.__QUIT();
      window.__START();
      const sim = window.__SIM;
      const wg = sim.wordGates;
      const dev = document.querySelector('#devPanel, .dev-panel, [data-dev-panel]');
      if (dev) dev.style.display = 'none';
      const hold = () => {
        sim.player.chain = s.chain;
        sim.player.speed = s.speed;
        sim.beast.gap = s.gap;
        sim.beast.desired = s.gap;
        if (s.overdrive) { sim.player.overdrive = true; sim.player.dashChain = 3; }
        // Quietly retire each gate as it arrives. These stills are about the
        // FIGURE; a MISSED banner across the frame is the driver's artefact,
        // not the runner's state, and it hides the thing being judged.
        const g = wg.current();
        if (g && !g.resolved && g.d - sim.player.d < 14) g.resolved = true;
      };
      // Long enough for the camera boom, the flow ease and the N5 ignition
      // to all land on the value the shot is claiming to show.
      for (let f = 0; f < 220; f++) { hold(); window.__TICK(1, 1 / 60); }
      // The stride is distance-driven, so the pose is addressable: park it
      // mid-cycle, legs split, rather than shooting whichever crossing the
      // settle loop happened to stop on.
      hold();
      window.__RENDER.playerActor._phase = 1.9;
      window.__TICK(1, 1 / 600);
      if (s.land) {
        // A leap, then the frame just after touchdown: the absorption.
        for (let f = 0; f < 24; f++) { hold(); sim.player.airborne = true; window.__TICK(1, 1 / 60); }
        sim.player.airborne = false;
        for (let f = 0; f < 5; f++) { hold(); window.__TICK(1, 1 / 60); }
      }
      if (s.idle) {
        // At rest on the road, which is the state the title is played over.
        for (let f = 0; f < 90; f++) { sim.player.speed = 0; window.__TICK(1, 1 / 60); }
      }
      if (s.ghost) {
        // A ghost alongside, one stride out of step, so the two figures can
        // be compared in the same frame at the same size.
        const gh = window.__RENDER.ghostActor;
        for (let f = 0; f < 40; f++) {
          gh.update({ active: true, x: sim.player.x - 2.1, y: sim.player.y,
            d: sim.player.d + 1.1, opacity: 0.42 }, 1 / 60);
        }
        gh._phase = 1.9 + Math.PI;   // half a stride out, so both poses read
        gh.update({ active: true, x: sim.player.x - 2.1, y: sim.player.y,
          d: sim.player.d + 1.1, opacity: 0.42 }, 1 / 600);
        window.__RENDER.stage.render();
      }
      const p = sim.player;
      return { chain: p.chain, speed: +p.speed.toFixed(1), gap: +sim.beast.gap.toFixed(1),
        overdrive: !!p.overdrive, flow: +(window.__RENDER.playerActor.flow ?? 1).toFixed(2),
        ignite: +(window.__RENDER.playerActor._ignite ?? 0).toFixed(2) };
    }, shot);
    await page.screenshot({ path: path.join(OUT, shot.file), timeout: 120000 });
    console.log(`  ${shot.file}`, JSON.stringify(state));
  }

  // The silhouette test. The camera drops in behind the figure at portrait
  // height; then everything but the runner is hidden and the rim is turned
  // off, leaving solid black on white — the shape, and only the shape.
  for (const [file, solid] of [['R6-closeup.png', false], ['R7-silhouette-test.png', true]]) {
    await page.evaluate((asSolid) => {
      const r = window.__RENDER;
      const sim = window.__SIM;
      const cam = r.stage.camera;
      r.ghostActor.root.visible = false;
      // Back to a RUNNING pose: the last state shot left him standing, and
      // a silhouette test of an idle figure tests nothing about the run.
      r.playerActor._idle = 0;
      r.playerActor._phase = 1.9;
      sim.player.speed = 34;
      window.__TICK(1, 1 / 600);
      if (asSolid) {
        // And with the bloom OFF. This frame is a hard-edged shape test;
        // bleeding the white ground over the black figure softens exactly
        // the edge the test exists to judge.
        r.stage.bright.strength = 0;
      }
      if (asSolid) {
        r.stage.scene.fog = null;
        r.stage.renderer.setClearColor(0xffffff, 1);
        r.stage.scene.background = null;
        r.stage.scene.traverse((o) => {
          if ((o.isMesh || o.isInstancedMesh || o.isLine || o.isLineSegments) &&
              !r.playerActor.root.getObjectById(o.id)) o.visible = false;
        });
        r.playerActor.tracks.visible = false;
        r.playerActor.shadow.visible = false;
        r.playerActor.halo.visible = false;
        r.playerActor.pool.visible = false;
        r.playerActor.tail.visible = false;
        r.playerActor.limbMat.visible = false;   // rim off: the outline alone
        r.playerActor.coreMat.visible = false;
        r.playerActor.bodyMat.color.setHex(0x000000);
      }
      // Placed in the runner's OWN frame, so the shot lands behind his
      // shoulder whatever the track is doing and whatever height it is at.
      r.stage.scene.updateMatrixWorld(true);
      const eye = r.playerActor.root.position.clone().set(0.5, 1.28, 3.3);
      const at = r.playerActor.root.position.clone().set(0, 0.98, 0);
      r.playerActor.root.localToWorld(eye);
      r.playerActor.root.localToWorld(at);
      cam.fov = 34;
      cam.position.copy(eye);
      cam.lookAt(at);
      cam.updateProjectionMatrix();
      r.stage.render();
      // Hide the HUD, but never an ancestor of the canvas — the whole point
      // of these two frames is the figure with nothing typeset over him.
      const canvas = document.querySelector('canvas');
      const keep = new Set();
      for (let n = canvas; n; n = n.parentElement) keep.add(n);
      for (const el of document.querySelectorAll('body *')) {
        if (!keep.has(el)) el.style.visibility = 'hidden';
      }
    }, solid);
    await page.screenshot({ path: path.join(OUT, file), timeout: 120000 });
    console.log(`  ${file}`);
  }
  console.log(`\nwrote ${OUT}`);
} finally {
  await browser.close();
  preview.kill();
}
