/**
 * Reachability gate (Phase 0.6) — every file in src/ must be reachable from the
 * the entry point index.html loads (src/boot.js, which imports src/main.js one
 * paint later — RC10.4), via static OR side-effect OR dynamic import.
 *
 * And (the patch-layer fold) no file may add behaviour by REPLACING a live
 * method at runtime — a prototype reassignment, an instance method swapped for
 * a wrapper, a `base = obj.method.bind(obj)` capture, or a requestAnimationFrame
 * boot that polls a window global until a system exists so it can be patched.
 * Reachability alone could not catch that layer: every patch file WAS
 * imported, by a side-effect import buried in a render module.
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
// RC10.4: ONE entry now. boot.js is what index.html loads; it dynamically
// imports the other two after a frame has been presented, and the walker
// follows dynamic imports, so the reachable set is unchanged.
const ENTRIES = ['src/boot.js'];

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

// ── No runtime patching ────────────────────────────────────────────────────
// Comments are stripped first: the files that replaced the patches explain
// what they replaced, in prose.
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const LIVE = '(?:sim|audio|stage|input|ui|render|Storage|window|globalThis|terrain|player|beast|actor|this\\.\\w+)';
const PATCH_SHAPES = [
  ['a prototype method reassigned', /\b[A-Za-z_$][\w$]*\.prototype\.[\w$]+\s*=(?!=)/],
  ['a prototype aliased to be rewritten', /\b(?:const|let|var)\s+[\w$]+\s*=\s*[\w$.]+\??\.prototype\b/],
  ['a prototype rewritten through Object.*', /Object\.(?:assign|defineProperty|defineProperties)\(\s*[A-Za-z_$][\w$.]*\.prototype\b/],
  // A callback slot an API offers for exactly this (onContinue,
  // onFirstGesture; three.js's onBeforeCompile and customProgramCacheKey) is
  // a hook, not a patch, and a `window.__NAME` debug handle defines a new
  // name rather than replacing one — both are excluded. Anything else
  // assigned a function on a live system is a method being replaced.
  ['a live instance method swapped for a function',
    new RegExp(`\\b${LIVE}\\.(?!on[A-Z]|customProgramCacheKey\\b|__)[\\w$]+\\s*=\\s*(?:async\\s+)?(?:function\\b|\\([^)]*\\)\\s*=>|[\\w$]+\\s*=>)`)],
  ['a base method captured to be wrapped', /=\s*[\w$.]+\.[\w$]+\.bind\(\s*[\w$.]+\s*\)/],
  ['a rAF boot polling a window global', /requestAnimationFrame\(\s*boot\s*\)/],
];
const patches = [];
for (const f of all) {
  const code = strip(fs.readFileSync(f, 'utf8'));
  for (const [what, re] of PATCH_SHAPES) {
    const m = code.match(re);
    if (m) patches.push(`${path.relative(ROOT, f)}: ${what} (\`${m[0].trim().slice(0, 48)}\`)`);
  }
}
const ok3 = patches.length === 0;
if (!ok3) fail++;
out.push(`  ${ok3 ? 'PASS' : 'FAIL'}  nothing patches a live system at runtime — `
  + (ok3 ? 'no prototype reassignment, no swapped instance method, no polling boot'
    : patches.join('; ')));

// The release-candidate patch files are gone, and the names stay retired:
// a behaviour belongs to a file named for its system, never for a build.
const layerNamed = all.map((f) => path.relative(ROOT, f)).filter((f) => /^src\/(?:rc\d|v1-)[^/]*\.js$/.test(f));
const ok4 = layerNamed.length === 0;
if (!ok4) fail++;
out.push(`  ${ok4 ? 'PASS' : 'FAIL'}  no file in src/ is named for a release layer (rc*/v1-*) — `
  + (ok4 ? 'every file is named for the system it owns' : layerNamed.join(', ')));

console.log(out.join('\n'));
console.log(`\nReachability gate: ${4 - fail} passed, ${fail} failed`);
if (fail) process.exit(1);
