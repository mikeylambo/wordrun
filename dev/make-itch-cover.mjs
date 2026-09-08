/**
 * The itch.io cover, composed rather than cropped.
 *
 * itch wants 630x500 and crops it several ways, so a straight gameplay grab
 * loses either the wordmark or the road. This lays the real inline wordmark
 * — read out of index.html, so it cannot drift from the one the game ships —
 * against a real gameplay frame bleeding off the right edge.
 *
 *   npm run build && node dev/shoot-runner-stills.mjs && node dev/make-itch-cover.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve('.');
const OUT = path.resolve('dev/release/itch');
mkdirSync(OUT, { recursive: true });

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const wordmark = /<svg id="titleWordmark"[\s\S]*?<\/svg>/.exec(html)[0]
  .replace('id="titleWordmark"', 'id="wm"')
  .replace(/var\(--face\)/g, "'Archivo'");
const shot = readFileSync(path.resolve('dev/stills/runner/R3-dash.png')).toString('base64');
const font = readFileSync(path.resolve('public/fonts/archivo-latin-var.woff2')).toString('base64');

const page = `<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${font}) format('woff2');
    font-weight:100 900;font-display:block}
  *{margin:0;box-sizing:border-box}
  body{width:630px;height:500px;overflow:hidden;background:#04070d;font-family:'Archivo',sans-serif}
  .wrap{position:relative;width:630px;height:500px}
  .shot{position:absolute;right:-56px;top:-292px;width:496px;
    filter:saturate(1.06) contrast(1.04)}
  /* The frame bleeds off the right; this feathers it into the ground so the
     cover reads as one image rather than a screenshot pasted on a panel. */
  .veil{position:absolute;inset:0;background:
    linear-gradient(90deg,#04070d 16%,rgba(4,7,13,.94) 38%,rgba(4,7,13,.55) 60%,rgba(4,7,13,0) 90%)}
  .glow{position:absolute;inset:0;background:
    radial-gradient(110% 78% at 82% 52%,rgba(103,216,255,.22),transparent 64%)}
  .mark{position:absolute;left:44px;top:92px;width:318px}
  .tag{position:absolute;left:47px;top:288px;width:330px;
    font-size:15px;font-weight:700;letter-spacing:.13em;line-height:1.65;
    color:#bfe8ff;text-transform:uppercase}
  .sub{position:absolute;left:47px;top:414px;font-size:11px;font-weight:700;
    letter-spacing:.24em;color:#5d7f92;text-transform:uppercase}
</style>
<div class="wrap">
  <img class="shot" src="data:image/png;base64,${shot}">
  <div class="veil"></div><div class="glow"></div>
  <div class="mark">${wordmark}</div>
  <div class="tag">Read fast.<br>Pick right.<br>Outrun the Redline.</div>
  <div class="sub">Endless word runner · Play in browser</div>
</div>`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(page, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'cover-630x500.png') });
  console.log('wrote', path.join(OUT, 'cover-630x500.png'));
} finally { await browser.close(); }
