/**
 * The HUD, on both pointer classes. Run after `npm run build`.
 *
 * The top-left cluster is four separate elements — score, metres, hearts,
 * chain — and the chain used to be positioned by hand, outside the flow, at
 * a different left edge from the other three. This shoots them together and
 * PRINTS their boxes, so "aligned" is a number rather than an impression.
 *
 * It shoots twice because the DASH charge has two tells and each device gets
 * exactly one: the bar (`.meter-zone`) is hidden under `pointer:coarse`,
 * where the ring around the DASH button carries it instead.
 *
 * Needs playwright-core.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 4181; const OUT = path.resolve('dev/stills/look'); mkdirSync(OUT, { recursive: true });
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--port',String(PORT),'--strictPort'], { stdio:['ignore','pipe','inherit'] });
await new Promise((res,rej)=>{preview.stdout.on('data',b=>{if(String(b).includes(String(PORT)))res()});setTimeout(()=>rej(new Error('no preview')),20000)});
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const measure = async (page) => page.evaluate(() => {
  // Set the chain here, immediately before the read: it is event-driven off
  // a correct answer and the frame loop clears it after its hold.
  window.__RENDER.judgment.setChain(0);
  // The combo is a HELD tell: it lights on a correct read and fades after
  // J().HOLD_S. The chain below IS real (answered gate by gate), but the
  // hold has expired by the time the shutter opens, so it is pinned open
  // here — this frame is a record of the HUD's GEOMETRY, not of its timing.
  const held = document.getElementById('combo');
  held.classList.add('on');
  const box = (id) => { const e = document.getElementById(id); if (!e) return null;
    const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const zone = document.querySelector('.meter-zone');
  const c = document.getElementById('combo');
  return { comboText: (c.textContent||'').trim(), comboOn: c.classList.contains('on'),
    hudOn: document.getElementById('hud').classList.contains('on'),
    dist: box('dist'), distSub: box('distSub'), vitals: box('vitalsSlot'), combo: box('combo'),
    meter: box('meterWrap'), meterVisible: zone ? getComputedStyle(zone).display !== 'none' : false,
    armed: zone?.classList.contains('armed'), charged: zone?.classList.contains('charged') };
});
const drive = async (page) => page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  window.__START();
  const sim = window.__SIM, wg = sim.wordGates, T = window.__TUNING;
  // A REAL chain: answer the gates the way a player does, so the combo is
  // lit by the same event the game lights it with.
  let guard = 0;
  while (sim.player.chain < 7 && guard++ < 40000) {
    const g = wg.current();
    window.__STEP(1, { confirm: wg.armed(sim.player.d) && g.real && !g.resolved });
  }
  for (let f = 0; f < 240; f++) {   // lifts the launch veil, which __START snaps to black
    sim.player.boostMeter = T.BOOST.METER_MAX;
    sim.beast.gap = 48; sim.beast.desired = 48;
    window.__TICK(1, 1 / 60);
  }
  const t = document.getElementById('titleScreen'); if (t) t.style.display = 'none';
  return { chain: sim.player.chain, score: sim.player.score };
});

try {
  for (const [label, device] of [
    ['phone', { viewport:{width:390,height:844}, isMobile:true, hasTouch:true }],
    ['desktop', { viewport:{width:1280,height:800} }],
  ]) {
    const ctx = await browser.newContext(device);
    await ctx.addInitScript(()=>{try{localStorage.setItem('dictiondash.v1.__migrated','1');localStorage.setItem('dictiondash.v1.pref.onboarding.rc9','1');}catch{}});
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.goto(`http://localhost:${PORT}/?stills=1`, { waitUntil:'load' });
    await page.waitForFunction(()=>window.__SIM && window.__START);
    await page.evaluate(()=>document.fonts.ready);
    const d = await drive(page);
    console.log(` sim: chain ${d.chain}, score ${d.score}`);
    await page.waitForTimeout(700);   // let the HUD fade and the meter height settle
    const m = await measure(page);
    await page.screenshot({ path: path.join(OUT, `HUD-${label}.png`) });
    console.log(` HUD-${label}.png`);
    for (const [k, v] of Object.entries(m)) console.log(`   ${k.padEnd(13)}`, JSON.stringify(v));
    await ctx.close();
  }
} finally { await browser.close(); preview.kill(); }
