/**
 * Reachability gate (Phase 0.6) — every file in src/ must be reachable from the
 * two entry points index.html loads (src/main.js and src/v1-mobile-ui.js), via
 * static OR side-effect OR dynamic import.
 *
 * This is the standing gate that would have caught the original problem: the
 * heart/bell/HUD systems lived in src/rc5.js, loaded through a single
 * easy-to-miss `import '../rc5.js';` side effect buried in a render module, and
 * a copy that had drifted out of sync with the game. A file that no entry can
 * reach is either dead (delete it) or loaded by a mechanism this graph can't
 * see (make the import explicit) — either way the next session should not have
 * to discover which file is real by running the game.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES = ['src/main.js', 'src/v1-mobile-ui.js'];

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare specifier → external package
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return `${base} (MISSING)`;
}

function importsOf(src) {
  const specs = [];
  const staticRe = /(?:import\s[^'"]*?from\s*|import\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/g;
  const dynRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = staticRe.exec(src))) specs.push(m[1]);
  while ((m = dynRe.exec(src))) specs.push(m[1]);
  return specs;
}

const seen = new Set();
const missing = [];
function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const spec of importsOf(src)) {
    const r = resolveSpec(file, spec);
    if (!r) continue;
    if (r.endsWith('(MISSING)')) missing.push(`${path.relative(ROOT, file)} → ${spec}`);
    else walk(r);
  }
}
for (const e of ENTRIES) walk(path.join(ROOT, e));

const all = [];
(function collect(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) collect(p);
    else if (name.endsWith('.js')) all.push(p);
  }
})(path.join(ROOT, 'src'));

const orphans = all
  .filter((f) => !seen.has(f))
  .map((f) => path.relative(ROOT, f))
  .sort();

let fail = 0;
const out = ['\nREACHABILITY — every src file is reachable from an entry point'];
const ok1 = orphans.length === 0;
if (!ok1) fail++;
out.push(`  ${ok1 ? 'PASS' : 'FAIL'}  no unreachable file in src/ — `
  + (ok1 ? `all ${all.length} reachable from ${ENTRIES.join(' + ')}`
    : `${orphans.length} orphaned: ${orphans.join(', ')}`));

const ok2 = missing.length === 0;
if (!ok2) fail++;
out.push(`  ${ok2 ? 'PASS' : 'FAIL'}  every relative import resolves — `
  + (ok2 ? 'no dangling specifiers' : missing.join('; ')));

console.log(out.join('\n'));
console.log(`\nReachability gate: ${2 - fail} passed, ${fail} failed`);
if (fail) process.exit(1);
