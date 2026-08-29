import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const sw = read('public/sw.js');
const index = read('index.html');
const iconSource = read('public/icons/dictiondash.svg');
const pngPaths = [
  'public/apple-touch-icon.png',
  'public/apple-touch-icon.png',
  'public/icons/dictiondash-192.png',
  'public/icons/dictiondash-512.png',
  'public/icons/dictiondash-maskable-512.png',
];

const isPng = (p) => {
  if (!fs.existsSync(p)) return false;
  const b = fs.readFileSync(p);
  return b.length > 32 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
};

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.error(`FAIL ${label}`); }
};

check(manifest.name === 'DICTION DASH' && manifest.short_name === 'DICTION DASH',
  'PWA has canonical DICTION DASH app identity');
check(manifest.start_url === './' && manifest.scope === './' && manifest.display === 'standalone',
  'PWA launches from its deployed directory in standalone mode');
check(manifest.theme_color === '#596774' && manifest.background_color === '#0d141b',
  'PWA uses mountain chrome with a dark launch ground');
check(Array.isArray(manifest.icons) &&
      manifest.icons.some((i) => i.src === './icons/dictiondash-192.png' && i.type === 'image/png') &&
      manifest.icons.some((i) => i.src === './icons/dictiondash-512.png' && i.type === 'image/png'),
  'PWA manifest exposes explicit PNG 192 and 512 install icons');
check(manifest.icons.some((i) => i.src === './icons/dictiondash-maskable-512.png' && String(i.purpose || '').includes('maskable')),
  'PWA provides a PNG maskable adaptive-icon path');
check(pngPaths.every(isPng),
  'Apple touch, launcher, and maskable assets are real PNG files');
check(!manifest.icons.some((i) => /\.svg(?:$|\?)/i.test(i.src || '')),
  'install manifest no longer relies on SVG icons');
check(!/beast|monster|creature|eyes|horn/i.test(iconSource),
  'spoiler-safe icon source does not disclose the Beast');
check(iconSource.includes('#ff2a1f') && iconSource.includes('scan bar'),
  'spoiler-safe icon carries the red scan-bar identity, nothing more');
check(index.includes('rel="manifest" href="./manifest.webmanifest?v=4"') &&
      index.includes('rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png?v=4"') &&
      index.includes('apple-mobile-web-app-title'),
  'release page advertises cache-busted portable manifest and PNG Apple metadata');
check(index.includes("navigator.serviceWorker.register('./sw.js')"),
  'release page registers the service worker relative to its deploy directory');
check(sw.includes("const CACHE = 'dictiondash-v1-shell-1'") &&
      sw.includes("new URL('apple-touch-icon.png', BASE).href") &&
      sw.includes("new URL('icons/dictiondash-512.png', BASE).href") &&
      sw.includes("request.mode === 'navigate'"),
  'service worker refreshes the portable PNG install shell with network-first navigations');
check(sw.includes('self.skipWaiting()') && sw.includes('self.clients.claim()'),
  'new PWA shell activates cleanly after deployment');
check(!sw.includes('requestAnimationFrame') && !iconSource.includes('requestAnimationFrame'),
  'PWA layer adds no animation loop');

console.log(`\nV1 PWA gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
