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
  // Phase 7 scenario: the consequence of a wrong read reaches the gap
  // through speed alone. Start at neutral pace, miss the first real word
  // (no taps at all), and watch the presentation for the next 2 seconds —
  // the differential the miss creates must close the gap ≥8m, and the
  // corruption must escalate with every one of those metres.
  const CANDIDATES = [999, 12345, 42, 777001, 8675309, 101];
  const seed = CANDIDATES.find((s2) => {
    // first resolved gate must be a REAL word so silence misses it
    const sim2 = new Sim(s2);
    return sim2.wordGates.current().real;
  }) ?? 999;
  const sim = new Sim(seed);
  sim.start(seed);
  const input = emptyInput();
  let guard = 60 * 30;
  while (sim.wordGates.wrongCount === 0 && guard-- > 0) sim.step(input);
  const gapBefore = sim.beast.gap;
  const intensityBefore = corruptionIntensity(gapBefore);

  const samples = [];
  for (let i = 0; i < 120; i++) {
    sim.step(input);
    samples.push({ gap: sim.beast.gap, intensity: corruptionIntensity(sim.beast.gap) });
  }
  const gapClosed = gapBefore - sim.beast.gap;
  const intensityAfter = corruptionIntensity(sim.beast.gap);

  check('the missed read closes the gap ≥8m in 2s, purely via the speed it cost',
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
    'src/rc5.js',
    'src/render/endgame-sky.js',
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
}

// ── The five-name cap (Phase 6) ───────────────────────────────────────────
head('NAMING — five approved names, machine-enforced');

{
  // The complete approved set. This is a CEILING: adding a sixth name to the
  // game means consciously editing this list, and the checks below make any
  // back-door label channel (band announcements, retired vocabulary) fail.
  const APPROVED = ['The Redline', 'The Caret', 'REDACTED', 'PUBLISHED', "TODAY'S DRAFT"];
  check('the approved-name ceiling holds at exactly five',
    APPROVED.length === 5, APPROVED.join(' · '));

  // Gate 1: every retired stage name is gone from code, docs and copy —
  // scan the whole tracked tree except this gate file (which must carry the
  // list to enforce it).
  const RETIRED = [
    'FIRST DRAFT', 'MARGIN NOTES', 'THE FOOTNOTES', 'STRIKETHROUGH',
    'TRACKED CHANGES', 'DEAD LETTERS', 'WHITEOUT', 'BLACK INK', 'AFTERWORD',
    'OLD DRAFTS', 'THE BLANK PAGE', 'VELLUM', 'THE APPENDIX',
    'THE SMALL HOURS', 'CLEAN COPY',
    // DESCENT-inherited stage names fall under the same cap:
    'THE STILL', 'FALSE DAWN', 'FIRST LIGHT', 'CLEAN SIGNAL',
  ];
  const scanRoots = ['src', 'tools', 'public/ui', 'public/audio/approved'];
  const files = ['index.html', 'README.md', 'RELEASE.md',
    'public/manifest.webmanifest'];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(path);
      else if (/\.(js|mjs|md|html|svg|json|webmanifest)$/.test(e.name)) files.push(path);
    }
  };
  for (const r of scanRoots) walk(r);
  // Case-sensitive on the two shapes a label takes (ALL CAPS display form,
  // Title Case doc form) — lowercase engine ids ('whiteout' the band id, the
  // weather variable) are namespace, not labels, and stay.
  const titleCase = (n) => n.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
  const retiredHits = [];
  for (const f of files) {
    if (f.endsWith('corruption-gates.mjs')) continue; // the enforcement list itself
    const text = fs.readFileSync(f, 'utf8');
    for (const name of RETIRED) {
      if (text.includes(name) || text.includes(titleCase(name))) {
        retiredHits.push(`${f}: ${name}`);
      }
    }
  }
  check('every retired stage name is gone from code, docs and copy',
    retiredHits.length === 0,
    retiredHits.slice(0, 5).join(' | ') || `${files.length} files clean`);

  // Gate 2: the cap. The band table — the one channel that ever surfaced
  // zone titles — may carry at most the finish name; the announcer refuses
  // unnamed bands; and the functional labels are exactly the approved ones.
  const bands = (await import('../src/render/art-direction.js')).MOUNTAIN_BANDS;
  const namedBands = bands.filter((b) => b.name);
  check('the mood arc is unnamed: only the finish band carries a label, and it is PUBLISHED',
    namedBands.length === 1 && namedBands[0].id === 'dawn' && namedBands[0].name === 'PUBLISHED',
    namedBands.map((b) => `${b.id}:${b.name}`).join(', ') || 'no named bands');

  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the transition announcer refuses a band without an approved name',
    ui.includes('this.bandName && band.name'));
  check('death copy is REDACTED and the day is TODAY\'S DRAFT',
    ui.includes("'REDACTED'") && ui.includes("TODAY'S DRAFT"));
  const readme = fs.readFileSync('README.md', 'utf8');
  check('the Redline and the Caret are the named antagonists',
    readme.includes('the Redline') && readme.includes('the Caret'));

  // No OTHER "The Xxx" proper-noun label may appear in player-facing display
  // strings — the pattern a sixth name would most likely take.
  const nameShaped = [];
  for (const f of ['index.html', 'src/ui/ui.js', 'src/ui/onboarding.js',
    'src/ui/pause.js', 'src/v1-mobile-ui.js', 'src/v1-finalize.js',
    'src/rc5.js', 'src/render/endgame-sky.js']) {
    const text = fs.readFileSync(f, 'utf8');
    const strings = [
      ...text.matchAll(/'([^'\n]*)'/g),
      ...text.matchAll(/`([^`\n]*)`/g),
      ...text.matchAll(/>([^<>{}\n]+)</g),
    ].map((m) => m[1]);
    for (const str of strings) {
      for (const m of str.matchAll(/\bThe ([A-Z][a-z]+)\b/g)) {
        if (!['Redline', 'Caret'].includes(m[1])) nameShaped.push(`${f}: "The ${m[1]}"`);
      }
    }
  }
  check('no name-shaped label beyond the approved five in player-facing strings',
    nameShaped.length === 0, nameShaped.slice(0, 4).join(' | ') || 'clean');
}

// ── Vibrancy stays subordinate to legibility ─────────────────────────────
head('VIBRANCY — red belongs to the Redline alone');

{
  const saturatedRed = (hex) => {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    return r > 190 && g < 80 && b < 80;
  };
  const hexesIn = (text) => [...text.matchAll(/0x([0-9a-fA-F]{6})\b/g)]
    .map((m) => parseInt(m[1], 16));

  const bands = fs.readFileSync('src/render/art-direction.js', 'utf8');
  const bandReds = hexesIn(bands).filter(saturatedRed)
    .filter((h) => h !== 0xff2a1f); // DANGER_RED constant itself is the Redline's
  check('no world band colour is saturated red',
    bandReds.length === 0,
    bandReds.length ? bandReds.map((h) => '0x' + h.toString(16)).join(', ') : 'clean across 21 bands');

  const burst = fs.readFileSync('src/render/streak-burst.js', 'utf8');
  check('the payoff burst palette carries no red at any tier',
    hexesIn(burst).filter(saturatedRed).length === 0);

  const cursor = fs.readFileSync('src/render/actors.js', 'utf8');
  check('the running figure of light carries no red',
    hexesIn(cursor).filter(saturatedRed).length === 0);

  const speedFx = fs.readFileSync('src/render/speed-fantasy.js', 'utf8');
  check('the speed-fantasy layers (streaks, pylons) carry no red',
    hexesIn(speedFx).filter(saturatedRed).length === 0);

  const redline = fs.readFileSync('src/render/corruption.js', 'utf8');
  check('the Redline keeps its red scan bar',
    redline.includes('0xff2a1f'));

  const plate = fs.readFileSync('src/render/word-gates.js', 'utf8');
  check('the word plate keeps its solid-glyph-core-over-glow treatment',
    plate.includes('halo only, cores stay solid') &&
    plate.includes('g.shadowBlur = 0;'));

  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the burst fires from the payoff event, keyed to the chain',
    main.includes('streakBurst.fire(e)') && burst.includes('chain >= 7') &&
    burst.includes('chain >= 3'));
}

// ── The flow channel + the drain (Phase 9 color grammar) ─────────────────
head('FLOW — brilliance is earned; loss is darkness');

{
  const { flowFactor, flowLevel, flowGlow, flowPulse } =
    await import('../src/render/flow-curve.js');
  const src = fs.readFileSync('src/render/flow-curve.js', 'utf8');
  check('the flow curve is pure (no renderer or sim imports)',
    !src.includes("from 'three'") && !src.includes('../sim/'));

  check('idle world is dimmed but never dead; peak is bright but bounded',
    flowFactor(0, 0) >= 0.6 && flowFactor(0, 0) < 1 &&
    Math.max(...Array.from({ length: 60 }, (_, i) => flowFactor(8, i * 0.02))) < 2.5,
    `idle ${flowFactor(0, 0).toFixed(2)}, peak ≤ ${Math.max(...Array.from({ length: 60 }, (_, i) => flowFactor(8, i * 0.02))).toFixed(2)}`);
  check('flow rises monotonically with the chain (steady component)',
    [0, 1, 2, 4, 6, 8].every((c, i, a) => i === 0 || flowGlow(flowLevel(c)) > flowGlow(flowLevel(a[i - 1]))));
  check('the marquee pulse only wakes near peak flow',
    flowPulse(0.4, 0.1) === 1 && flowPulse(1, 0.11) !== 1);

  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the world consumes the one flow value (grid, line art, pylons, figure)',
    main.includes('uP9Flow.value = flowF') && main.includes('dataworld.setFlow(flowF)') &&
    main.includes('trackPylons.setFlow(flowF)') && main.includes('playerActor.flow = flowF'));

  // The drain: a tapped fake darkens the frame — it must NOT white-flash,
  // and red is never spent on mistakes (the Redline's channel stays pure).
  check('a wrong tap drains (dark + desaturate), never a bright crash-flash',
    main.includes('ui.drain()') && main.includes('audio.duck()') &&
    !/case 'word_wrong':[\s\S]{0,600}?hitFlash/.test(main));
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  check('the drain overlay is desaturation + dim, carrying no red',
    indexHtml.includes("mix-blend-mode:saturation") && indexHtml.includes('#drainDim') &&
    !/#drain\{[^}]*(255,\s*4?\d,)/.test(indexHtml));
  const audio = fs.readFileSync('src/audio/audio.js', 'utf8');
  check('the mix darkens with the drain and the chime climbs with the chain',
    audio.includes('duckFilter') && audio.includes('gate(chain = 0)') &&
    audio.includes('[0, 2, 4, 7, 9]'));
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
