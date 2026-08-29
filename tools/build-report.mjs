/**
 * Build-size report vs the YouTube Playables ceilings (Phase 12):
 * initial load ≤ 30 MB, no single file > 30 MB, archive ≤ 200 MB.
 *
 *   npm run build && node tools/build-report.mjs
 *
 * "Initial load" is scored as the WHOLE dist: the service worker precaches
 * the entire shell on first visit, so first-load cost and bundle cost are
 * the same number here — the strictest honest reading of the ceiling.
 */

import fs from 'node:fs';
import path from 'node:path';

const MB = 1024 * 1024;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push({ p, size: fs.statSync(p).size });
  }
})('dist');

files.sort((a, b) => b.size - a.size);
const total = files.reduce((a, f) => a + f.size, 0);
const biggest = files[0];

console.log(`dist total: ${(total / MB).toFixed(2)} MB across ${files.length} files`);
console.log('largest files:');
for (const f of files.slice(0, 8)) {
  console.log(`  ${(f.size / MB).toFixed(2).padStart(7)} MB  ${f.p}`);
}
console.log('\nPlayables ceilings:');
const checks = [
  ['initial load <= 30 MB', total <= 30 * MB, `${(total / MB).toFixed(2)} MB`],
  ['largest single file <= 30 MB', biggest.size <= 30 * MB, `${(biggest.size / MB).toFixed(2)} MB (${biggest.p})`],
  ['total archive <= 200 MB', total <= 200 * MB, `${(total / MB).toFixed(2)} MB`],
];
let fail = 0;
for (const [label, ok, detail] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label} — ${detail}`);
  if (!ok) fail++;
}
console.log(`\nheadroom to the 30 MB initial ceiling: ${((30 * MB - total) / MB).toFixed(2)} MB`);
if (fail) process.exit(1);
