/**
 * RC13.9 — the app's composition source, for the gates that read it as text.
 *
 * main.js is the composition root; the systems it wires that were folded out
 * of it live in src/app/ (one file per system, each imported by main.js). A
 * gate that asserts how the app is wired reads ALL of it, in a fixed order,
 * so moving a block out of main.js verbatim keeps every check meaningful.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

export function appSource() {
  const dir = path.join(ROOT, 'src/app');
  const parts = [fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
      parts.push(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  return parts.join('\n');
}

export default appSource;
