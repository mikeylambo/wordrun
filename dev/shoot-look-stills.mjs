/**
 * The LOOK stills — the title lockup, the attract loop, the camera at speed,
 * the bells, and the bloom ladder. Run after `npm run build`.
 *
 * These are the frames no unit gate can judge: whether the mark reads,
 * whether the attract is still on the road a minute in, whether the figure
 * is big enough to see in the state the game most wants to look good.
 *
 * Needs playwright-core.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4178;
const OUT = path.resolve('dev/stills/look');
mkdirSync(OUT, { recursive: true });

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
  await page.waitForTimeout(1200);

  await page.screenshot({ path: path.join(OUT, 'L1-title.png') });
  console.log('  L1-title.png');

  // rAF off, then drive the title forward by hand: past the ten-second idle
  // and a full minute into the attract loop, which is where the runner used
  // to have walked clean off the piste.
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const attract = await page.evaluate(() => {
    for (let f = 0; f < 60 * 72; f++) window.__TICK(1, 1 / 60);
    const sim = window.__SIM;
    const cx = sim.terrain.corridorX(sim.player.d);
    return {
      attractActive: !!window.__RENDER?.attract?.active,
      d: +sim.player.d.toFixed(0),
      offCentreline: +Math.abs(sim.player.x - cx).toFixed(2),
      halfWidth: window.__TUNING.RUN.TRACK_HALF_W,
    };
  });
  await page.screenshot({ path: path.join(OUT, 'L2-attract-72s.png') });
  console.log('  L2-attract-72s.png', JSON.stringify(attract));
  // ── The camera at DASH ────────────────────────────────────────────────
  //
  // The rig is tuned around the WORD PLATE — the TUNING comments say so, and
  // measure it — and the runner was never the constraint, so at the ceiling
  // he is a smudge. The lever is perspective, not lens: he sits ~7m from the
  // camera and the plate ~38m, so pulling the boom in a metre grows him about
  // ten times as much as it grows the plate. Both are measured here, because
  // "he looks bigger" is not a defence if the plate paid for it.
  const dash = async (label, cam) => {
    const m = await page.evaluate(({ cam }) => {
      const C = window.__TUNING.CAMERA;
      Object.assign(C, cam);
      if (window.__SIM.phase !== 'title') window.__QUIT();
      window.__START();
      const sim = window.__SIM;
      const wg = sim.wordGates;
      const hold = () => {
        sim.player.chain = 30;
        sim.player.speed = window.__TUNING.RUN.CEILING;
        sim.player.overdrive = true;
        sim.player.dashChain = 3;
        sim.beast.gap = 48; sim.beast.desired = 48;
        const g = wg.current();
        if (g && !g.resolved && g.d - sim.player.d < 14) g.resolved = true;
      };
      for (let f = 0; f < 260; f++) { hold(); window.__TICK(1, 1 / 60); }
      // Let one gate live and run up to the read moment, so the plate in the
      // frame is the plate a player is actually reading.
      for (let f = 0; f < 900; f++) {
        sim.player.chain = 30; sim.player.speed = window.__TUNING.RUN.CEILING;
        sim.player.overdrive = true; sim.player.dashChain = 3;
        sim.beast.gap = 48; sim.beast.desired = 48;
        window.__TICK(1, 1 / 60);
        if (wg.current().d - sim.player.d <= 30) break;
      }
      window.__RENDER.playerActor._phase = 1.9;
      window.__TICK(1, 1 / 600);
      // rAF is off in this driver, so the title screen's own fade-out never
      // completes and it sits over the frame these shots exist to judge.
      const title = document.getElementById('titleScreen');
      if (title) title.style.display = 'none';

      const R = window.__RENDER;
      const camera = R.stage.camera;
      const VW = document.documentElement.clientWidth;
      const VH = document.documentElement.clientHeight;
      const root = R.playerActor.root.position;
      const V = root.constructor;
      const py = (wx, wy, wz) => (-new V(wx, wy, wz).project(camera).y * 0.5 + 0.5) * VH;
      const px = (wx, wy, wz) => (new V(wx, wy, wz).project(camera).x * 0.5 + 0.5) * VW;
      // The figure is ~1.96 units tall from the sole to the crown.
      const runnerPx = Math.abs(py(root.x, root.y, root.z) - py(root.x, root.y + 1.96, root.z));
      const plate = R.wordGateActors.current.mesh;
      let plateW = 0, plateH = 0;
      if (plate.visible) {
        const xs = [], ys = [];
        for (const [ux, uy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
          const v = new V(ux, uy, 0).applyMatrix4(plate.matrixWorld).project(camera);
          xs.push((v.x * 0.5 + 0.5) * VW); ys.push((-v.y * 0.5 + 0.5) * VH);
        }
        plateW = Math.max(...xs) - Math.min(...xs);
        plateH = Math.max(...ys) - Math.min(...ys);
      }
      return {
        runnerPx: +runnerPx.toFixed(1),
        plate: `${Math.round(plateW)}x${Math.round(plateH)}`,
        fov: +camera.fov.toFixed(1),
        centreX: +px(root.x, root.y, root.z).toFixed(0),
      };
    }, { cam });
    await page.screenshot({ path: path.join(OUT, `${label}.png`) });
    console.log(' ', label.padEnd(30), JSON.stringify(m));
  };

  // ── The bells, close up ───────────────────────────────────────────────
  await page.evaluate(() => {
    if (window.__SIM.phase !== 'title') window.__QUIT();
    window.__START();
    const sim = window.__SIM;
    for (let f = 0; f < 200; f++) {
      sim.player.chain = 18; sim.player.speed = 30;
      sim.beast.gap = 60; sim.beast.desired = 60;
      const g = sim.wordGates.current();
      if (g && !g.resolved && g.d - sim.player.d < 14) g.resolved = true;
      window.__TICK(1, 1 / 60);
    }
    const R = window.__RENDER;
    for (const id of ['titleScreen', 'judge', 'combo']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    const V = R.playerActor.root.position.constructor;
    const M = R.bells.body.matrixWorld.constructor;
    const m = new M();
    // The nearest bell ahead of the runner, so the shot is of a bell in the
    // world rather than one behind the camera.
    let best = null;
    for (let i = 0; i < R.bells.body.count; i++) {
      R.bells.body.getMatrixAt(i, m);
      const q = new V().setFromMatrixPosition(m);
      const ahead = -q.z - sim.player.d;
      if (ahead > 2 && (!best || ahead < best.ahead)) best = { q, ahead };
    }
    if (best) {
      const cam = R.stage.camera;
      cam.fov = 32;
      cam.position.set(best.q.x + 1.15, best.q.y + 1.05, best.q.z + 4.4);
      cam.lookAt(best.q.x, best.q.y + 0.30, best.q.z);
      cam.updateProjectionMatrix();
      R.stage.render();
    }
    return !!best;
  });
  await page.screenshot({ path: path.join(OUT, 'B1-bell-closeup.png') });
  console.log('  B1-bell-closeup.png');

  const BASE = await page.evaluate(() => ({ ...window.__TUNING.CAMERA }));
  await dash('C0-dash-shipped', {});
  await dash('C1-dash-boom-in', { BACK_SPEED_GAIN: -0.24 });
  await dash('C2-dash-boom-in-lens-in', { BACK_SPEED_GAIN: -0.24, FOV_MAX: 88 });
  await dash('C3-dash-boom-in-more', { BACK_SPEED_GAIN: -0.30, FOV_MAX: 88 });
  await dash('C4-dash-lens-only', { ...BASE, FOV_MAX: 84 });

  // ── The bloom ladder, on one ordinary cruising frame ──────────────────
  await page.evaluate(() => {
    Object.assign(window.__TUNING.CAMERA, { BACK_SPEED_GAIN: -0.30, FOV_MAX: 88 });
    if (window.__SIM.phase !== 'title') window.__QUIT();
    window.__START();
    const sim = window.__SIM;
    const wg = sim.wordGates;
    for (let f = 0; f < 260; f++) {
      sim.player.chain = 26; sim.player.speed = 34;
      sim.beast.gap = 48; sim.beast.desired = 48;
      const g = wg.current();
      if (g && !g.resolved && g.d - sim.player.d < 14) g.resolved = true;
      window.__TICK(1, 1 / 60);
    }
    for (let f = 0; f < 900; f++) {
      sim.player.chain = 26; sim.player.speed = 34;
      sim.beast.gap = 48; sim.beast.desired = 48;
      window.__TICK(1, 1 / 60);
      if (wg.current().d - sim.player.d <= 30) break;
    }
    const title = document.getElementById('titleScreen');
    if (title) title.style.display = 'none';
  });
  // Strength alone stops mattering once everything above the threshold is
  // already blooming — 0.62 and 0.85 are near-identical frames. The dial that
  // changes the QUALITY of the light is the threshold: how much of the world
  // is allowed to be a light source at all.
  for (const [thr, str] of [[1, 0], [0.30, 0.62], [0.20, 0.70], [0.12, 0.78], [0.06, 0.85]]) {
    await page.evaluate(([t, s]) => {
      window.__RENDER.stage.bright.threshold = t;
      window.__RENDER.stage.bright.strength = s;
      window.__RENDER.stage.render();
    }, [thr, str]);
    const f = `G-thr${String(thr).replace('.', '')}-s${String(str).replace('.', '')}.png`;
    await page.screenshot({ path: path.join(OUT, f) });
    console.log(' ', f);
  }
} finally {
  await browser.close();
  preview.kill();
}
