/**
 * Type specimen (dev only, `?dev=1` → "type specimen" in the panel).
 *
 * Every face the game ships, at the sizes and weights it is actually used at,
 * over the game's own ground, with the plate confusables a fake can hide in.
 * A type change is judged here in seconds, on the device in hand, before it
 * is judged in a run. Reads the live CSS tokens, so it shows what the build
 * really loads, never a second copy of the stack.
 */

const CONFUSABLES = [
  ['ILLICIT', 'ELICIT'], ['MODERN', 'MODEM'], ['BARN', 'BAM'], ['CLOSE', 'CL0SE'],
  ['LIGHT', 'L1GHT'], ['RIFLE', 'RlFLE'], ['separate', 'seperate'], ['rn m', 'Il1 O0'],
];

const TIERS = [
  ['--face', 'Archivo · interface', [
    ['800 9px', '.34em', 'BEGIN RUN · ENDLESS · DAILY RUN'],
    ['600 10px', '.24em', 'SCORE · 412 M'],
    ['800 40px', '.16em', 'PERFECT'],
  ]],
  ['--num', 'Big Shoulders Display · numerals', [
    ['900 80px', '-.01em', '12,840'],
    ['900 48px', '0', '×7'],
  ]],
  ['--title', 'Fraunces italic · FINISH', [
    ['italic 500 72px', '-.01em', 'FINISH'],
  ]],
];

let host = null;

export function toggleTypeSpecimen() {
  if (host) { host.remove(); host = null; return; }
  host = document.createElement('div');
  host.id = 'typeSpecimen';
  host.style.cssText = 'position:fixed;inset:0;z-index:9998;overflow:auto;background:#050a12;color:#f4fbff;' +
    'padding:56px 16px 40px;pointer-events:auto';
  const css = getComputedStyle(document.documentElement);
  const label = (t) => `<div style="font:600 10px/1 ui-monospace,monospace;color:#8aa2b2;margin:26px 0 10px">${t}</div>`;
  let html = '';
  for (const [token, name, rows] of TIERS) {
    html += label(`${token} — ${name} — ${css.getPropertyValue(token).trim().split(',')[0]}`);
    for (const [font, track, text] of rows) {
      html += `<div style="font:${font}/1.05 var(${token});letter-spacing:${track};margin:6px 0">${text}</div>`;
    }
  }
  html += label('--plate — Atkinson Hyperlegible Next · word plates (confusables)');
  html += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
  for (const [a, b] of CONFUSABLES) {
    for (const w of [a, b]) {
      html += `<span style="background:#eef7fb;color:#06101a;font:700 26px/1 var(--plate);padding:12px 16px;border-radius:3px">${w}</span>`;
    }
  }
  html += '</div>';
  html += `<p style="font:600 10px/1.5 ui-monospace,monospace;color:#8aa2b2;margin-top:28px">tap anywhere to close</p>`;
  host.innerHTML = html;
  host.addEventListener('click', () => toggleTypeSpecimen());
  for (const t of ['pointerdown', 'pointerup', 'touchstart']) host.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(host);
}
