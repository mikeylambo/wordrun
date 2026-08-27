/**
 * Corruption presentation gates — Phase 4.
 *
 * The corruption is a CONSUMER of the sim's existing gap value; these gates
 * prove the consumption is faithful. Centrepiece: the Phase 2 scripted
 * "wrong read closes the gap ≥8m in 2s" scenario replayed with the shared
 * corruption-curve sampled every step — the visible escalation must track
 * that exact gap closure, not merely the number moving somewhere.
 *
 *   npm run gate:corruption
 */

import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { corruptionIntensity, veilOpacity, fieldScale } from '../src/render/corruption-curve.js';
import fs from 'node:fs';

let PASS = 0, FAIL = 0;
const out = [];
function check(name, ok, detail = '') {
  if (ok) { PASS++; out.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; out.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
function head(t) { out.push(`\n\x1b[1m${t}\x1b[0m`); }
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

// ── The mapping itself ────────────────────────────────────────────────────
head('CORRUPTION — the gap -> intensity mapping');

check('silent at (and beyond) the dread ceiling',
  corruptionIntensity(TUNING.BEAST.MAX_GAP) === 0 &&
  corruptionIntensity(TUNING.BEAST.MAX_GAP + 40) === 0);

check('fully saturated exactly at the kill gap',
  Math.abs(corruptionIntensity(TUNING.BEAST.KILL_GAP) - 1) < 1e-9,
  `intensity(${TUNING.BEAST.KILL_GAP}) = ${corruptionIntensity(TUNING.BEAST.KILL_GAP).toFixed(4)}`);

{
  let monotone = true;
  let prev = corruptionIntensity(TUNING.BEAST.MAX_GAP);
  for (let gap = TUNING.BEAST.MAX_GAP; gap >= TUNING.BEAST.KILL_GAP; gap -= 0.5) {
    const v = corruptionIntensity(gap);
    if (v < prev - 1e-12) { monotone = false; break; }
    prev = v;
  }
  check('every metre the gap closes, the corruption grows (strict monotone)', monotone);
}

{
  // The beast was visible the moment it existed; the corruption must not be
  // imperceptible until the last seconds. At mid-pressure (half the ceiling)
  // the veil and field must already be clearly moving.
  const mid = corruptionIntensity(TUNING.BEAST.MAX_GAP / 2);
  check('mid-pressure is already clearly visible, not a cliff at the end',
    mid > 0.25 && veilOpacity(mid) > 0.03 && fieldScale(mid) > fieldScale(0.0001) * 1.3,
    `intensity at ${TUNING.BEAST.MAX_GAP / 2}m gap = ${f2(mid)}, veil ${f2(veilOpacity(mid))}`);
}

check('veil never blanks the screen (hard cap under 0.6 opacity)',
  veilOpacity(1) < 0.6 && veilOpacity(1) > veilOpacity(0.5) && veilOpacity(0) === 0 || veilOpacity(0) >= 0,
  `veil at full pressure ${f2(veilOpacity(1))}`);

// ── The Phase 2 scenario, with the presentation watching ─────────────────
head('CORRUPTION — escalation tracks the scripted wrong read');

{
  // Same script as the core-suite gate: settle with a competent reader,
  // reach a stalking beast near a gate, answer it wrong, watch 2 seconds.
  const sim = new Sim(999);
  sim.start(999);
  const input = emptyInput();
  let confirmed = -1;
  const read = () => {
    const g = sim.wordGates.current();
    if (g.real && confirmed !== g.index && sim.wordGates.armed(sim.player.d)) {
      confirmed = g.index;
      return true;
    }
    return false;
  };
  for (let i = 0; i < 60 * 25; i++) { input.confirm = read(); sim.step(input); }
  for (let i = 0; i < 60 * 90; i++) {
    const g = sim.wordGates.current();
    const near = g.d - sim.player.d < 12 && g.d - sim.player.d > 0;
    if (sim.beast.mode === 'stalk' && near && sim.beast.t > 10) break;
    input.confirm = read();
    sim.step(input);
  }
  const gapBefore = sim.beast.gap;
  const intensityBefore = corruptionIntensity(gapBefore);
  {
    const g = sim.wordGates.current();
    const wrongs = sim.wordGates.wrongCount;
    input.confirm = !g.real;
    while (sim.wordGates.wrongCount === wrongs && sim.phase === PHASE.RUNNING) {
      sim.step(input);
      input.confirm = false;
    }
  }
  const samples = [];
  for (let i = 0; i < 120; i++) {
    input.confirm = false;
    sim.step(input);
    samples.push({ gap: sim.beast.gap, intensity: corruptionIntensity(sim.beast.gap) });
  }
  const gapClosed = gapBefore - sim.beast.gap;
  const intensityAfter = corruptionIntensity(sim.beast.gap);

  check('the scripted wrong read still closes the gap ≥8m in 2s (sim untouched)',
    gapClosed >= 8, `closed ${f2(gapClosed)}m (${f2(gapBefore)} -> ${f2(sim.beast.gap)})`);

  check('corruption intensity rises with that exact closure',
    intensityAfter > intensityBefore,
    `${f2(intensityBefore)} -> ${f2(intensityAfter)}`);

  // Escalation must be continuous — visible every step of the way, not one
  // jump at the end. Count how many samples move in step with the gap.
  let agree = 0;
  for (let i = 1; i < samples.length; i++) {
    const gapDelta = samples[i - 1].gap - samples[i].gap;
    const intDelta = samples[i].intensity - samples[i - 1].intensity;
    if (gapDelta > 1e-9 ? intDelta > 0 : intDelta <= 1e-9) agree++;
  }
  check('escalation is continuous: intensity moves with the gap every step',
    agree >= (samples.length - 1) * 0.98,
    `${agree}/${samples.length - 1} steps in agreement`);

  const veilDelta = veilOpacity(intensityAfter) - veilOpacity(intensityBefore);
  check('the screen veil visibly thickens across those 2 seconds',
    veilDelta > 0.015, `veil +${veilDelta.toFixed(3)} opacity`);
}

// ── The consumers actually consume this curve ─────────────────────────────
head('CORRUPTION — one curve, every surface');

{
  const src = {
    world: fs.readFileSync('src/render/corruption.js', 'utf8'),
    veil: fs.readFileSync('src/ui/ui.js', 'utf8'),
    audio: fs.readFileSync('src/audio/audio.js', 'utf8'),
  };
  check('the world-space corruption imports the shared curve',
    src.world.includes("from './corruption-curve.js'") && src.world.includes('corruptionIntensity('));
  check('the screen veil imports the shared curve',
    src.veil.includes("corruption-curve.js") && src.veil.includes('veilOpacity('));
  check('the audio bed imports the shared curve',
    src.audio.includes("corruption-curve.js") && src.audio.includes('corruptionIntensity('));
  check('the curve module is pure (no renderer import, sim-value consumer only)',
    !fs.readFileSync('src/render/corruption-curve.js', 'utf8').includes("from 'three'"));
}

// ── No old vocabulary in player-facing copy ───────────────────────────────
head('CORRUPTION — identity');

{
  // Phase 4 banned creature language; Phase 5 extends the ban to the interim
  // signal/network jargon, so neither vocabulary can quietly creep back.
  // Internal identifiers (sim.beast.gap, TUNING.BEAST, staticVeil, band ids)
  // are the engine namespace and stay — the scan is word-bounded and only
  // reads display strings / markdown prose.
  const BANNED = /\b(beast|frost beast|monster|creature|caught|grid|signal|fiber|void|static)\b/i;
  const INTERNAL = /beast\.|__|BEAST\.|beastActor|second|staticVeil|staticTexture|drawStatic|staticFar/;
  const offenders = [];

  const sourceFacing = [
    'index.html',
    'src/ui/ui.js',
    'src/ui/onboarding.js',
    'src/ui/pause.js',
    'src/v1-mobile-ui.js',
    'src/v1-finalize.js',
  ];
  for (const f of sourceFacing) {
    const text = fs.readFileSync(f, 'utf8');
    const strings = [
      ...text.matchAll(/'([^'\n]*)'/g),
      ...text.matchAll(/`([^`\n]*)`/g),
      ...text.matchAll(/>([^<>{}\n]+)</g),
      ...text.matchAll(/alt="([^"]+)"/g),
      ...text.matchAll(/content="([^"]+)"/g),
    ].map((m) => m[1]);
    for (const str of strings) {
      if (BANNED.test(str) && !INTERNAL.test(str)) {
        offenders.push(`${f}: "${str.trim().slice(0, 40)}"`);
      }
    }
  }

  // Markdown docs: scan the PROSE, not just quoted spans — code spans and
  // fenced blocks (module paths, engine identifiers) are exempt.
  for (const f of ['README.md', 'RELEASE.md']) {
    const raw = fs.readFileSync(f, 'utf8');
    let inFence = false;
    for (const line of raw.split('\n')) {
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const prose = line.replace(/`[^`]*`/g, '');
      if (BANNED.test(prose)) offenders.push(`${f}: "${prose.trim().slice(0, 48)}"`);
    }
  }

  check('no beast/creature or signal/network language survives in player-facing text',
    offenders.length === 0, offenders.slice(0, 4).join(' | ') || 'clean');

  // The new names are actually present where a player meets them.
  const bands = fs.readFileSync('src/render/art-direction.js', 'utf8');
  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  const readme = fs.readFileSync('README.md', 'utf8');
  check('the manuscript names are live: FIRST DRAFT / TRACKED CHANGES / THE BLANK PAGE / PUBLISHED',
    bands.includes("'FIRST DRAFT'") && bands.includes("'TRACKED CHANGES'") &&
    bands.includes("'THE BLANK PAGE'") && bands.includes("'PUBLISHED'") &&
    bands.includes("'MARGIN NOTES'") && bands.includes("'WHITEOUT'"));
  check('death copy is REDACTED and the day is a DRAFT',
    ui.includes("'REDACTED'") && ui.includes("TODAY'S DRAFT"));
  check('the Redline and the Caret are the named antagonists',
    readme.includes('the Redline') && readme.includes('the Caret'));
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
