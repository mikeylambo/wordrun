/**
 * Does the bloom cost the word plate anything?
 *
 * Word-plate legibility outranks every other visual or audio change in this
 * game, and a bright pass is exactly the kind of change that quietly spends
 * it — bloom softens glyph edges, and "it looks better" is not a defence.
 * So this measures instead of asserting. The same frame is shot twice, with
 * the composite's strength at 0 and at its shipped value, and the plate's
 * own screen rect is compared: mean luminance, RMS contrast, and the P90-P10
 * spread between the white glyphs and the plate face they sit on.
 *
 * Run after `npm run build`. Needs playwright-core and pngjs.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { PNG } = require('pngjs');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4175;
const OUT = path.resolve('dev/stills/bloom');
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

/** Luminance stats inside a rect of a PNG on disk. */
function stats(file, r) {
  const png = PNG.sync.read(readFileSync(file));
  const l = [];
  for (let y = Math.max(0, r.y0 | 0); y < Math.min(png.height, r.y1 | 0); y++) {
    for (let x = Math.max(0, r.x0 | 0); x < Math.min(png.width, r.x1 | 0); x++) {
      const i = (png.width * y + x) << 2;
      l.push(0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]);
    }
  }
  // Mean absolute luminance gradient across the rect. RMS contrast can rise
  // while edges soften — bright cores widen the histogram either way — so
  // the crispness of the glyph edges gets its own number.
  let grad = 0, gn = 0;
  const lum = (x, y) => {
    const i = (png.width * y + x) << 2;
    return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  };
  for (let y = Math.max(1, r.y0 | 0); y < Math.min(png.height - 1, r.y1 | 0); y++) {
    for (let x = Math.max(1, r.x0 | 0); x < Math.min(png.width - 1, r.x1 | 0); x++) {
      grad += Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
      gn++;
    }
  }
  l.sort((a, b) => a - b);
  const mean = l.reduce((a, b) => a + b, 0) / l.length;
  const rms = Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length);
  const p = (q) => l[Math.min(l.length - 1, Math.floor(l.length * q))];
  return { n: l.length, mean: +mean.toFixed(2), rms: +rms.toFixed(2),
    spread: +(p(0.9) - p(0.1)).toFixed(2), grad: +(grad / Math.max(1, gn)).toFixed(2) };
}

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
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(120);

  // One frame with the current gate armed and close enough to read.
  const rect = await page.evaluate(() => {
    window.__START();
    const sim = window.__SIM;
    const wg = sim.wordGates;
    const hold = () => {
      sim.player.chain = 24;
      sim.player.speed = 34;
      sim.beast.gap = 48;
      sim.beast.desired = 48;
    };
    // Settle the camera and the flow with every gate quietly retired, so the
    // run never dies and the frame under measurement is an ordinary one.
    for (let f = 0; f < 260; f++) {
      hold();
      const g = wg.current();
      if (g && !g.resolved && g.d - sim.player.d < 14) g.resolved = true;
      window.__TICK(1, 1 / 60);
    }
    // Then let ONE gate live and run up to it: the armed plate, at the
    // distance a player actually reads it.
    for (let f = 0; f < 900; f++) {
      hold();
      window.__TICK(1, 1 / 60);
      if (wg.current().d - sim.player.d <= 30) break;
    }
    const plate = window.__RENDER.wordGateActors.current.mesh;
    const cam = window.__RENDER.stage.camera;
    const VW = document.documentElement.clientWidth;
    const VH = document.documentElement.clientHeight;
    const V = plate.position.constructor;
    const xs = [], ys = [];
    for (const [px, py] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      const v = new V(px, py, 0).applyMatrix4(plate.matrixWorld).project(cam);
      xs.push((v.x * 0.5 + 0.5) * VW); ys.push((-v.y * 0.5 + 0.5) * VH);
    }
    return { word: wg.current().shown, visible: plate.visible,
      x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });

  // A sweep against the REAL baseline: `bypass` is the renderer drawing
  // straight to the canvas, the way the game did before this pass existed.
  // Comparing the pass at strength 0 to the pass at strength 0.55 would have
  // hidden the grade change the pass makes on its own.
  await page.waitForTimeout(2000);
  const SWEEP = [
    ['A-bypass.png', null],
    ['B-strength-0.png', 0],
    ['C-strength-035.png', 0.35],
    ['D-strength-055-shipped.png', 0.55],
    ['E-strength-080.png', 0.80],
  ];
  const shots = [];
  for (const [file, strength] of SWEEP) {
    await page.evaluate((v) => {
      const st = window.__RENDER.stage;
      if (v === null) {
        st.renderer.setRenderTarget(null);
        st.renderer.render(st.scene, st.camera);
      } else {
        st.bright.strength = v;
        st.render();
      }
    }, strength);
    const file_path = path.join(OUT, file);
    await page.screenshot({ path: file_path });
    shots.push([file, file_path]);
  }

  // The two looks must hand over cleanly: BROADCAST disposes the bright pass
  // and takes the frame. This has thrown once per render pass ever written;
  // it costs one boot to know it does not. ACCESS is not on window, so the
  // look is set the way a player sets it — the stored preference, at boot.
  const bctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await bctx.addInitScript(() => {
    try {
      localStorage.setItem('dictiondash.v1.__migrated', '1');
      localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
      localStorage.setItem('dictiondash.v1.pref.access', JSON.stringify({ broadcastLook: true }));
    } catch { /* private mode: defaults are fine */ }
  });
  const bpage = await bctx.newPage();
  const errs = [];
  bpage.on('pageerror', (e) => errs.push(e.message));
  await bpage.goto(`http://localhost:${PORT}/?stills=1`, { waitUntil: 'load' });
  await bpage.waitForFunction(() => window.__SIM && window.__START);
  const handover = await bpage.evaluate(() => {
    const st = window.__RENDER.stage;
    st.render();
    return { broadcastTookIt: !!st.broadcast, brightStoodDown: !st.bright };
  });
  await bpage.screenshot({ path: path.join(OUT, 'F-broadcast-look.png') });
  await bctx.close();
  console.log('  BROADCAST handover:', JSON.stringify({ ...handover, errors: errs }));

  console.log(`\nplate "${rect.word}"  ${Math.round(rect.x1 - rect.x0)}x${Math.round(rect.y1 - rect.y0)} px at (${Math.round(rect.x0)}, ${Math.round(rect.y0)})\n`);
  let base = null;
  for (const [file, p] of shots) {
    const pl = stats(p, rect);
    const fr = stats(p, { x0: 0, y0: 0, x1: 390, y1: 844 });
    const d = (v, b) => `${v >= b ? '+' : ''}${(((v / b) - 1) * 100).toFixed(1)}%`;
    if (!base) base = { pl, fr };
    console.log(' ', file.padEnd(18),
      `plate rms ${String(pl.rms).padStart(6)} (${d(pl.rms, base.pl.rms).padStart(6)})`,
      ` spread ${String(pl.spread).padStart(6)} (${d(pl.spread, base.pl.spread).padStart(6)})`,
      ` edge ${String(pl.grad).padStart(6)} (${d(pl.grad, base.pl.grad).padStart(6)})`,
      ` | frame mean ${String(fr.mean).padStart(6)} (${d(fr.mean, base.fr.mean).padStart(6)})`);
  }
  console.log(`\nwrote ${OUT}`);
} finally {
  await browser.close();
  preview.kill();
}
