/**
 * The itch.io upload, zipped the way itch needs it.
 *
 * itch serves an HTML project by unpacking the zip and looking for
 * `index.html` AT THE ROOT — not inside a `dist/` folder. Getting that wrong
 * is the single most common way a browser upload lands as an unplayable
 * download, so this builds the archive from inside dist/ and then verifies
 * the entry is where it has to be rather than trusting the invocation.
 *
 *   npm run package:itch
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const OUT = path.resolve('dictiondash-web.zip');

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing — run `npm run build` first.');
  process.exit(1);
}
rmSync(OUT, { force: true });

// -r from INSIDE dist, so paths in the archive are index.html, assets/…
execFileSync('zip', ['-r', '-q', '-9', OUT, '.', '-x', '.DS_Store'], { cwd: DIST });

const listing = execFileSync('unzip', ['-Z1', OUT], { encoding: 'utf8' }).split('\n');
const rootEntry = listing.includes('index.html');
const nested = listing.some((f) => /^dist\//.test(f));
const mb = (statSync(OUT).size / 1024 / 1024).toFixed(1);

console.log(`${path.basename(OUT)} — ${mb} MB, ${listing.filter(Boolean).length} entries`);
console.log(`  index.html at the archive root: ${rootEntry ? 'yes' : 'NO'}`);
if (!rootEntry || nested) {
  console.error('  the archive is not shaped the way itch needs. Not shipping this.');
  process.exit(1);
}
console.log('  ready to upload — tick "This file will be played in the browser".');
