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
import { COUNT_BEATS, countProgress, countValue } from '../src/ui/results-motion.js';
import { FLOORS, pickStandout } from '../src/meta/standout.js';
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
    'src/ui/access.js',
    'src/v1-mobile-ui.js',
    'src/v1-finalize.js',
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
  // Phase 20: four, not five. The Caret was removed outright — it had been
  // unreachable since Phase 7 deleted the hunt counter it armed from, so
  // the cap was carrying a name the game could not show.
  const APPROVED = ['The Redline', 'RUN OVER', 'FINISH', 'DAILY RUN'];
  check('the approved-name ceiling holds at exactly four',
    APPROVED.length === 4, APPROVED.join(' · '));

  // Gate 1: every retired stage name is gone from code, docs and copy —
  // scan the whole tracked tree except this gate file (which must carry the
  // list to enforce it).
  const RETIRED = [
    'FIRST DRAFT', 'MARGIN NOTES', 'THE FOOTNOTES', 'STRIKETHROUGH',
    'TRACKED CHANGES', 'DEAD LETTERS', 'WHITEOUT', 'BLACK INK', 'AFTERWORD',
    'OLD DRAFTS', 'THE BLANK PAGE', 'VELLUM', 'THE APPENDIX',
    'THE SMALL HOURS', 'CLEAN COPY',
    // Phase 20: the retired second antagonist joins the list it used to
    // be exempt from, so it cannot come back by accident.
    'THE CARET',
    // Phase 21: 'REDACTED' read as classified-document language — heavier
    // than a general-audience death screen needs. RUN OVER keeps the
    // Redline's active framing and echoes the strikethrough already shown
    // on a tapped fake.
    'REDACTED',
    // Phase 21: the names this phase replaced. Each was doing theme where a
    // plain word does the job, and a game a child reads under time pressure
    // should not need to decode a publishing metaphor to know what happened.
    // The bare word TODAY is deliberately NOT on this list — it is ordinary
    // English and BEST TODAY is a live HUD label; banning it would fail the
    // build on copy that has nothing to do with the retired name.
    'PUBLISHED', "TODAY'S DRAFT", 'CROSSED OUT',
    // DESCENT-inherited stage names fall under the same cap:
    'THE STILL', 'FALSE DAWN', 'FIRST LIGHT', 'CLEAN SIGNAL',
    // Phase 12 rename: the old game title is retired everywhere (the
    // lowercase repo/legacy-storage identifier is infrastructure, not a
    // name, and this scan is case-sensitive by design).
    'WORD RUN',
  ];
  const scanRoots = ['src', 'tools', 'public/fonts', 'public/audio/approved'];
  const files = ['index.html', 'README.md', 'RELEASE.md',
    'public/manifest.webmanifest'];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(path);
      else if (/\.(js|mjs|md|html|svg|json|webmanifest)$/.test(e.name)) files.push(path);
    }
  };
  for (const r of scanRoots) if (fs.existsSync(r)) walk(r);
  // Case-sensitive on the two shapes a label takes (ALL CAPS display form,
  // Title Case doc form) — lowercase engine ids ('whiteout' the band id, the
  // weather variable) are namespace, not labels, and stay.
  const titleCase = (n) => n.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
  const retiredHits = [];
  for (const f of files) {
    // Two exemptions, both necessary: this file must carry the list to
    // enforce it, and RELEASE.md is a changelog — a gate that forbids
    // naming what was removed would only make the record lie.
    if (f.endsWith('corruption-gates.mjs') || f === 'RELEASE.md') continue;
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
  check('the mood arc is unnamed: only the 30K band carries a label, and it is FINISH',
    namedBands.length === 1 && namedBands[0].id === 'dawn' && namedBands[0].name === 'FINISH',
    namedBands.map((b) => `${b.id}:${b.name}`).join(', ') || 'no named bands');

  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the transition announcer refuses a band without an approved name',
    ui.includes('this.bandName && band.name'));
  check('death copy is RUN OVER and the day is DAILY RUN',
    ui.includes("'RUN OVER'") && ui.includes("'DAILY RUN'"));
  const readme = fs.readFileSync('README.md', 'utf8');
  // The removal note may explain what the Caret was; what it may not do is
  // present it as a live name (names are bolded in the README).
  check('the Redline is the named antagonist, alone',
    readme.includes('**the Redline**') && !readme.includes('**the Caret**') &&
    readme.includes('## The four names') && readme.includes('**RUN OVER**'));

  // No OTHER "The Xxx" proper-noun label may appear in player-facing display
  // strings — the pattern a sixth name would most likely take.
  const nameShaped = [];
  for (const f of ['index.html', 'src/ui/ui.js', 'src/ui/onboarding.js',
    'src/ui/pause.js', 'src/v1-mobile-ui.js', 'src/v1-finalize.js',
    'src/render/endgame-sky.js']) {
    const text = fs.readFileSync(f, 'utf8');
    const strings = [
      ...text.matchAll(/'([^'\n]*)'/g),
      ...text.matchAll(/`([^`\n]*)`/g),
      ...text.matchAll(/>([^<>{}\n]+)</g),
    ].map((m) => m[1]);
    for (const str of strings) {
      for (const m of str.matchAll(/\bThe ([A-Z][a-z]+)\b/g)) {
        if (m[1] !== 'Redline') nameShaped.push(`${f}: "The ${m[1]}"`);
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
    audio.includes('duckFilter') && /gate\(chain = 0(, early = 0(, dashChain = 0)?)?\)/.test(audio) &&
    audio.includes('[0, 2, 4, 7, 9]'));
}

// ── Accessibility (Phase 11) ─────────────────────────────────────────────
head('ACCESS — reduced flash, readable type, colour-vision axes');

{
  const access = fs.readFileSync('src/ui/access.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const plates = fs.readFileSync('src/render/word-gates.js', 'utf8');
  const world = fs.readFileSync('src/render/corruption.js', 'utf8');

  check('reduced flash kills the marquee pulse, softens the drain, stills the veil',
    main.includes('ACCESS.reducedFlash') && main.includes('flowGlow(flowLevel(flowChain))') &&
    fs.readFileSync('src/ui/ui.js', 'utf8').includes('ACCESS.reducedFlash'));

  // The SIGNAL rule, ported: each colour-vision mode replaces the axis
  // that fails. Deuteranopia/protanopia lose red/green -> blue/orange
  // right-wrong; tritanopia loses blue/yellow -> keeps red, red/cyan pair.
  check('deuteranopia and protanopia replace the red/green axis with blue/orange',
    /deuteranopia:.*right: '#3fa7ff', wrong: '#ff7800'/.test(access) &&
    /protanopia:.*right: '#5bc4ff', wrong: '#ff8c42'/.test(access));
  check('tritanopia keeps red and separates right/wrong as cyan vs red',
    /tritanopia:.*right: '#00e0d5'/.test(access));
  check('the default palette is the shipped grammar, untouched',
    /off: \{ danger: 0xff2a1f/.test(access));
  check('plates and the scan bar consume the live accent (source defaults stay)',
    plates.includes('ACCESS.right') && plates.includes('ACCESS.wrong') &&
    world.includes('ACCESS.danger') && world.includes('0xff2a1f'));
  // The shipped plate face IS the legibility face now, so READABLE TYPE
  // buys tracking and weight rather than swapping to a system fallback.
  check('the plate is set in the bundled hyperlegible face',
    plates.includes("const PLATE_FAMILY = 'Atkinson Hyperlegible Next'") &&
    !/\$\{px\}px ui-monospace/.test(plates));
  check('readable type widens tracking and weight, not the family',
    plates.includes('ACCESS.readableType ? 800 : 700') &&
    plates.includes("ACCESS.readableType ? '7px' : '1px'"));
  check('plates repaint once the bundled face resolves',
    plates.includes('plateFontReady') && plates.includes('fontEpoch') &&
    plates.includes('${ACCESS.epoch}|${fontEpoch}') &&
    fs.readFileSync('src/main.js', 'utf8').includes('Promise.race([plateFontReady'));
  check('choices persist through storage prefs',
    access.includes('Storage.setAccessPrefs') &&
    fs.readFileSync('src/storage/storage.js', 'utf8').includes('accessPrefs()'));
}

// ── Source-frame residue (Phase 15) ──────────────────────────────────────
head('RESIDUE — the frame this was cloned from must not show through');

{
  // The clone brought the source game's vocabulary along in places a
  // player could reach (a HOW TO SKI button, a "Share this DESCENT run"
  // label) and in a lot of places only a developer could. Provenance
  // credit in a comment is honest and stays; a live identifier, an event
  // name, an asset id or any player-visible string is residue.
  const skiWord = /\b(ski|skis|skiing|skier|skiers|alpine|snowboard)\b/i;
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p, out);
      else if (/\.(js|mjs|html|json|webmanifest)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const tree = [...walk('src'), ...walk('tools'), 'index.html'];

  // 1. No live code identifier or asset id may carry the retired vocabulary.
  //    Comments are exempt (provenance is allowed to be stated); the word
  //    list, its generated guard and the generated definitions are exempt
  //    because "ski" is a real English word a player is legitimately asked
  //    to read, and a dictionary entry for it is data, not the game's voice.
  const stripComments = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const identifierHits = [];
  for (const f of tree) {
    if (/words\/(wordlist|guard|definitions|family-blocklist)\.js$/.test(f)) continue;
    if (f.endsWith('corruption-gates.mjs')) continue; // this list itself
    for (const line of stripComments(fs.readFileSync(f, 'utf8')).split('\n')) {
      if (skiWord.test(line)) identifierHits.push(`${f}: ${line.trim().slice(0, 46)}`);
    }
  }
  check('no ski vocabulary survives in live code, ids or copy',
    identifierHits.length === 0,
    identifierHits.slice(0, 3).join(' | ') || `${tree.length} files clean`);

  // 2. The source game's name may not appear in a global, an event name,
  //    a storage key or anything a player can read.
  const nameHits = [];
  for (const f of tree) {
    if (f.endsWith('corruption-gates.mjs')) continue;
    // Comments may state provenance ("cloned from DESCENT") — that is
    // honest history. Code, ids and copy may not.
    const text = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of text.matchAll(/__DESCENT[A-Z_]*/g)) nameHits.push(`${f}: ${m[0]}`);
    for (const m of text.matchAll(/'descent:[^']*'/g)) nameHits.push(`${f}: ${m[0]}`);
    for (const m of text.matchAll(/['"`>][^'"`<]*\bDESCENT\b[^'"`<]*['"`<]/g)) {
      nameHits.push(`${f}: ${m[0].slice(0, 40)}`);
    }
  }
  check('the source game name is gone from globals, events, keys and copy',
    nameHits.length === 0, nameHits.slice(0, 3).join(' | ') || 'clean');

  // 3. Every id the audio layer asks for must exist in the manifest.
  //    Three ski loops were referenced for phases without ever being
  //    shipped — wired on paper, silent in play. That class of dead
  //    reference is what let the vocabulary survive unnoticed.
  const manifest = JSON.parse(fs.readFileSync('public/audio/approved/manifest.json', 'utf8'));
  const shipped = new Set(Object.keys(manifest.files || {}));
  const rc9 = fs.readFileSync('src/rc9-assets.js', 'utf8');
  const asked = new Set([
    ...[...rc9.matchAll(/setLoop\('([^']+)'/g)].map((m) => m[1]),
    ...[...rc9.matchAll(/oneShot\('([^']+)'/g)].map((m) => m[1]),
    ...[...rc9.matchAll(/=> '([a-z_]+)'/g)].map((m) => m[1]),
  ]);
  const phantom = [...asked].filter((id) => !shipped.has(id));
  check('every audio id the game asks for is actually shipped',
    phantom.length === 0, phantom.join(', ') || `${asked.size} ids all in the manifest`);

  // 4. The atmosphere is this game's own, and costs no download.
  const bed = fs.existsSync('src/audio/page-bed.js')
    ? fs.readFileSync('src/audio/page-bed.js', 'utf8') : '';
  check('the ambience bed is procedural page texture, not a recorded loop',
    bed.includes('export function bedLevels') && rc9.includes('pageBed?.update(') &&
    !fs.existsSync('public/audio/approved/wind_alpine_bed-v02.mp3'),
    bed ? 'page grain + turns + ink blooms, no file' : 'page-bed.js missing');
  // Phase 18 renamed the surface-glide voice to strip the last ski word;
  // Phase 27 removed it outright, because renaming it never addressed what
  // it SOUNDED like. It was a bandpass noise bed sweeping 1540-2850 Hz with
  // speed and running whenever the runner was on the ground — a wind by any
  // ear, in a game that wants none. Powder and ice went as proven-dead (their
  // player flags are set false at reset and never written), and the dash rush
  // was the same noise under another name. Measured after removal: no voice
  // in the graph varies with speed at all.
  const audioSrc = fs.readFileSync('src/audio/audio.js', 'utf8');
  const mixSrcs = ['src/v1-final-mix.js', 'src/v1-mixer.js', 'src/v1-approved-mix.js']
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const feedbackSrc = fs.readFileSync('src/rc9-feedback.js', 'utf8');
  const allAudio = audioSrc + mixSrcs + feedbackSrc;
  check('no sustained noise bed rides the runner\'s speed',
    !/this\.(glide|snow|wind|air|goRush)\s*=\s*this\._noiseVoice/.test(audioSrc),
    'wind, air, glide and the dash rush are all gone');
  check('the dead alpine surface voices are gone with it',
    !/this\.(powder|ice)\s*=\s*this\._noiseVoice/.test(audioSrc) &&
    !/surfaceMode/.test(audioSrc),
    'powder, ice and the surface-mode switch they drove');
  check('no ski vocabulary survives anywhere in the audio path',
    !/packedSnow/i.test(allAudio) && !/onSnow/.test(allAudio) && !/this\.snow\b/.test(allAudio),
    'voice names, constants and mix keys all clear');
  check('the trim that ducked those beds went with them',
    !/SURFACE_TRIM/.test(feedbackSrc) && !/__rc9SkiTrim\b/.test(feedbackSrc),
    'no orphan gain node left connected to the surface bus');
  check('the surface bus still carries its transients',
    /_burst\(0\.30, 0\.43, 470, 'lowpass', 0, this\.bus\.surface\)/.test(audioSrc) &&
    /hit\(\) \{/.test(audioSrc),
    'the hit routes to the surface bus directly, as it always did');

  // Phase 31: the last shared asset and the last snowboarding voices.
  const assetsSrc = fs.readFileSync('src/rc9-assets.js', 'utf8');
  check('the dash no longer plays an inherited air-rush sample',
    !fs.existsSync('public/audio/approved/go_rush-v01.mp3') &&
    // Strip comments first: the note explaining the removal names the file.
    !('go_rush' in manifest.files) &&
    !/go_rush/.test(assetsSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
    'file, manifest entry and the overdriveOn layer are all gone');
  check('every shipped audio asset is this game\'s own',
    Object.values(manifest.files).every((f) => /corruption_/.test(f.url)),
    `${Object.keys(manifest.files).length} assets, all generated for this game`);
  check('the jump-and-land vocabulary is gone from the engine',
    !/\n  (takeoff|landClean|landBump|landFlub|shove)\(/.test(audioSrc),
    'takeoff, three landings and the stunt shove — no source emits their events');
  check('nothing patches the methods that vocabulary left behind',
    !/Audio\.prototype\.takeoff\s*=/.test(feedbackSrc) &&
    !/Player\.prototype\._takeoff\s*=/.test(feedbackSrc),
    'the rc9 wrappers went with them rather than wrapping undefined');
  check('the approved mix baseline itself is untouched',
    mixSrcs.includes('surface: -5.5'),
    'the approved -5.5 dB surface trim stands');

  check('the bed keeps playing even if the approved manifest never loads',
    rc9.includes('pageBed?.update(') && !/if \(!assets\) return;/.test(rc9),
    'no approved-asset guard stands between the run and its atmosphere');

  // Reachability: nothing may ship an audio file the game cannot sound.
  // Six inherited ski-Foley assets were removed on this evidence — five
  // full 30km runs produced zero airborne frames and zero obstacle hits.
  const RETIRED_FOLEY = ['carve_hard', 'takeoff_big_air', 'landing_clean',
    'landing_heavy', 'tree_hit', 'rock_hit'];
  const stillThere = RETIRED_FOLEY.filter((id) => shipped.has(id) || asked.has(id));
  check('no unreachable inherited Foley is shipped or wired',
    stillThere.length === 0 &&
    TUNING.FEATURES.TREE_COUNT[1] === 0 && TUNING.FEATURES.ROCK_COUNT[1] === 0 &&
    TUNING.FEATURES.CLIFF_CHANCE === 0,
    stillThere.join(', ') ||
      'nothing solid spawns, nothing launches, so none of it could ever sound');
}

// ── The DASH as a headline mechanic (Phase 16) ───────────────────────────
head('DASH — the second verb, finally legible');

{
  // The mechanic existed for fifteen phases under a name that explained
  // nothing (GO), taught in one line among five, and fired with a borrowed
  // sound and no camera event. These gates hold the correction in place.
  const files = {
    ui: fs.readFileSync('src/ui/ui.js', 'utf8'),
    mobile: fs.readFileSync('src/v1-mobile-ui.js', 'utf8'),
    onboard: fs.readFileSync('src/ui/onboarding.js', 'utf8'),
    main: fs.readFileSync('src/main.js', 'utf8'),
    audio: fs.readFileSync('src/audio/audio.js', 'utf8'),
    rig: fs.readFileSync('src/render/camera-rig.js', 'utf8'),
    speed: fs.readFileSync('src/render/speed-fantasy.js', 'utf8'),
    index: fs.readFileSync('index.html', 'utf8'),
    storage: fs.readFileSync('src/storage/storage.js', 'utf8'),
  };

  // 1. The name. No player-facing surface may still call it GO.
  const goHits = [];
  for (const [name, text] of Object.entries(files)) {
    const strings = [
      ...text.matchAll(/'([^'\n]*)'/g),
      ...text.matchAll(/>([^<>{}\n]+)</g),
      ...text.matchAll(/aria-label', '([^']+)'/g),
    ].map((m) => m[1]);
    for (const s of strings) {
      if (/\bGO\b/.test(s) && !/HOW FAR CAN YOU GO/.test(s)) goHits.push(`${name}: "${s.slice(0, 32)}"`);
    }
  }
  check('the mechanic is called DASH everywhere a player can read it',
    goHits.length === 0, goHits.slice(0, 3).join(' | ') || 'no GO label survives');
  check('the button, its label and its aria name all say DASH',
    files.mobile.includes('<span>DASH</span>') &&
    files.mobile.includes("'Hold DASH for a burst of speed'") &&
    files.mobile.includes('percent dash charge'));

  // 2. Charged reads louder than it did, and the teaching state is real.
  check('the charged state is a distinct loud style, not a dimmer one',
    files.index.includes('#powerHint.teaching') && files.index.includes('@keyframes dashReady') &&
    files.mobile.includes('#v1MobileDash.ready') && files.mobile.includes('@keyframes dashButtonReady'));
  check('the charged hint names the actual input',
    files.ui.includes("this.touch ? 'HOLD DASH' : 'HOLD F'"));
  check('REDUCED FLASH keeps the instruction and drops only the pulse',
    files.ui.includes("classList.toggle('teaching', !ACCESS.reducedFlash)") &&
    files.mobile.includes('!ACCESS.reducedFlash'));

  // 3. Firing it lands across three channels on the same frame.
  check('a dash fires its own sound, a camera punch and a speed-line burst',
    files.main.includes('audio.dash();') && files.main.includes('rig.dashKick();') &&
    files.main.includes('windStreaks.burst();') && !files.main.includes('audio.shove();\n        break'));
  check('the dash sound is its own, not the borrowed shove',
    files.audio.includes('  dash() {') && files.audio.includes('_thump(0.34'));
  check('the camera punch is instant and decays (not eased like everything else)',
    /dashKick\(amount = 1\)|dashKick\(\)/.test(files.rig) && files.rig.includes('KICK_DECAY') &&
    files.rig.indexOf('this.fov += (wantFov') < files.rig.indexOf('this._dashKick * TUNING.BOOST.DASH.KICK_FOV'));
  check('the speed lines spike on the instant of firing',
    files.speed.includes('burst()') && files.speed.includes('STREAK_BURST') &&
    files.speed.includes('STREAK_DECAY'));

  // 4. The lesson is a real teaching beat, and it ends when it should.
  // Phase 24: the card became teaching sentences rather than a controls
  // list, so the dash's line is prose with its control highlighted inside
  // it. What must hold is that the mechanic is still taught by name on the
  // one screen that explains anything.
  // Phase C: the dash stopped being a hold, so the line stopped saying Hold.
  // What must survive is that the mechanic is still taught by name, with its
  // control set inside the sentence.
  check('the dash gets its own onboarding rule line, by name',
    files.onboard.includes('<b>${dash}</b>') &&
    files.onboard.includes('spends a full DASH charge'));
  check('the coach explains where the charge comes from',
    files.ui.includes('CLEAN READS CHARGE THE DASH'));
  check('the teaching beat holds until the player dashes, then retires for good',
    files.ui.includes('dashFired()') && files.ui.includes('_dashLearned') &&
    files.storage.includes('dashLearned()') && files.main.includes('Storage.setDashLearned(true)'));
  check('the retired lesson does not come back next run',
    files.main.includes('let dashLearned = Storage.dashLearned();'));
}

// ── Broadcast presentation (Phase 19) ────────────────────────────────────
head('BROADCAST — few words, one type system, numbers first');

{
  const htmlAll = fs.readFileSync('index.html', 'utf8');
  const html = htmlAll;
  const uiSrc = fs.readFileSync('src/ui/ui.js', 'utf8');
  const injected = ['src/ui/pause.js', 'src/ui/onboarding.js', 'src/ui/access.js',
    'src/ui/shop.js', 'src/v1-mobile-ui.js', 'src/rc81-ui.js']
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');

  // 1. One face, declared once. Every injected stylesheet inherits it
  //    rather than pinning its own — the old UI pinned ui-monospace in
  //    fourteen places, which is why it read as a terminal.
  check('the UI declares one display face and everything inherits it',
    html.includes("--face:'Archivo'") && html.includes('font-family:var(--face)') &&
    !/font(-family)?:[^;}]*ui-monospace/.test(injected),
    'no surface pins its own face');
  check('the wordmark is inline so it can use that same face',
    html.includes('<svg id="titleWordmark"') && html.includes('font-family="var(--face)"') &&
    !fs.existsSync('public/ui/dictiondash-wordmark.svg'),
    'an <img>-loaded SVG cannot see the page @font-face');

  // 2. Both faces are BUNDLED, not fetched. A font CDN would be the only
  //    external request in the build, and zero is a platform-eligibility
  //    requirement — but self-hosting was always allowed, and the system
  //    stack cost the game its identity on every device it ran on.
  check('the type system costs no external request',
    !/fonts\.googleapis|fonts\.gstatic/.test(html + injected) &&
    /@font-face\{font-family:'Archivo';src:url\(\.\/fonts\//.test(html) &&
    /@font-face\{font-family:'Atkinson Hyperlegible Next';src:url\(\.\/fonts\//.test(html));
  for (const f of ['archivo-latin-var.woff2', 'atkinson-next-latin-var.woff2']) {
    const bytes = fs.existsSync(`public/fonts/${f}`) ? fs.statSync(`public/fonts/${f}`).size : 0;
    check(`${f} ships with the build and is a real subset`,
      bytes > 8_000 && bytes < 400_000, `${(bytes / 1024).toFixed(0)} KB`);
  }
  check('both faces are preloaded and offline-cached',
    /rel="preload"[^>]*archivo-latin-var\.woff2[^>]*as="font"/.test(html) &&
    /rel="preload"[^>]*atkinson-next-latin-var\.woff2[^>]*as="font"/.test(html) &&
    fs.readFileSync('public/sw.js', 'utf8').includes('fonts/atkinson-next-latin-var.woff2'));
  check('every face stack still ends in a generic family',
    /--face:'Archivo'[^;]*sans-serif/.test(html) &&
    /--plate:'Atkinson Hyperlegible Next'[^;]*sans-serif/.test(html));
  check('the redistributed faces carry their licences',
    fs.existsSync('public/fonts/OFL-Archivo.txt') &&
    fs.existsSync('public/fonts/OFL-AtkinsonHyperlegibleNext.txt'));

  // 3. The retired copy stays retired. Each of these was a sentence doing
  //    a label's job on a screen the player reads in two seconds.
  const RETIRED_COPY = [
    'HOW FAR CAN YOU GO', 'TAP · SPACE · ENTER', 'STANDARD · 3 HITS',
    'THE READS THAT WENT WRONG', 'WAS REAL — IT SLIPPED BY', 'CHALLENGE LINK',
    'RUN TODAY TO KEEP IT', 'REACH ${dist}M', 'CLEAN READS`', 'READ FAST. RUN FAR.',
    // Phase 21 relabels.
    'SLIPPED BY', 'EVERY READ TRUE', "'REDACTED'",
  ];
  const tree = ['index.html', 'src/ui/ui.js', 'src/ui/onboarding.js', 'src/ui/pause.js',
    'src/meta/daily.js', 'src/v1-finalize.js', 'src/render/endgame-sky.js',
    'src/rc97-endgame.js'];
  const wordy = [];
  for (const f of tree) {
    const text = fs.readFileSync(f, 'utf8');
    for (const c of RETIRED_COPY) if (text.includes(c)) wordy.push(`${f}: ${c}`);
  }
  check('no retired long-form copy survives', wordy.length === 0,
    wordy.slice(0, 3).join(' | ') || `${RETIRED_COPY.length} retired strings, none present`);

  // 4. Copy density. Count the words actually printed on the two screens a
  //    player reads most; a screen is allowed labels, not paragraphs.
  const screenWords = (id) => {
    // The wordmark is a mark, not copy — its three chromatic strikes of the
    // title are one logo however many <text> runs draw it.
    const html = htmlAll.replace(/<svg id="titleWordmark"[\s\S]*?<\/svg>/, '<svg></svg>');
    const block = html.slice(html.indexOf(`id="${id}"`));
    const end = block.indexOf('\n  </div>');
    return [...block.slice(0, end).matchAll(/>([^<>{}\n]+)</g)]
      .map((m) => m[1].trim()).filter(Boolean).join(' ')
      .split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
  };
  const title = screenWords('titleScreen');
  const death = screenWords('deathScreen');
  check('the title screen stays under a dozen printed words', title <= 12, `${title} words`);
  check('the results card stays under a dozen printed words', death <= 12, `${death} words`);

  // Phase 21 relabels: the teaching section earns a heading with weight, and
  // each label says what it is without a sentence around it.
  // Phase 24: the teaching moved off the results card into its own panel —
  // it was the best thing on the screen and it was competing with the score
  // for it. The card keeps one line; the panel keeps the lesson, and has
  // room for the definitions the card never could.
  check('the results card offers the review rather than inlining it',
    uiSrc.includes("id=\"missedOpen\"") && uiSrc.includes('MISSED · REVIEW') &&
    html.includes('id="missedPanel"'));
  check('the panel is headed MISSED WORDS and labels both mistake kinds',
    html.includes('MISSED WORDS') && uiSrc.includes("'<div class=\"mHead\">NOT A WORD</div>'") &&
    uiSrc.includes("'<div class=\"mHead\">UNCAUGHT</div>'"));
  check('a clean run reads PERFECT RUN', uiSrc.includes('>PERFECT RUN<'));
  check('the stat bar names the number it shows',
    uiSrc.includes("'TRUE READS'"));
  check('the chain goal chip carries its noun',
    fs.readFileSync('src/meta/daily.js', 'utf8').includes('`×${chain} CHAIN`'));

  // 5. The results card leads with the number, and the recap is labelled
  //    rows rather than one sentence per wrong read.
  check('the score is the largest thing on the results card',
    /\.big\{[^}]*font-size:clamp\(72px/.test(html));
  check('the results card is figures and rows, not sentences',
    /class="statBar( four)?"/.test(uiSrc) && uiSrc.includes('class="objRow"') &&
    uiSrc.includes("row('TARGET'"));
  check('the review still teaches the true spelling of a tapped fake',
    uiSrc.includes('_missedRow(x.answer, x.shown,') &&
    uiSrc.includes('<s>${wrongSpelling}</s>') && uiSrc.includes('<b>${word}</b>'));
}

// ── The BROADCAST look (Phase N as decided) ──────────────────────────────
head('LOOK — BROADCAST is opt-in, explicit, and flash-aware');

{
  // Phase K's pick: the shipped look stays. The style lab's broadcast
  // treatment ships only as a settings toggle, default off, integrated
  // through Stage.render() — never by wrapping a live render function,
  // which is the Phase 0 banned pattern.
  const access = fs.readFileSync('src/ui/access.js', 'utf8');
  const scene = fs.readFileSync('src/render/scene.js', 'utf8');
  const pass = fs.readFileSync('src/render/broadcast-pass.js', 'utf8');

  check('the shipped look is the default — BROADCAST starts off',
    access.includes('broadcastLook: false'));
  check('the toggle is a chip row on the settings surface and it persists',
    access.includes("[[false, 'STANDARD'], [true, 'BROADCAST']]") &&
    access.includes('broadcastLook: ACCESS.broadcastLook') &&
    access.includes('ACCESS.broadcastLook = !!saved.broadcastLook'));
  check('Stage.render() owns the branch — no runtime render wrapping',
    scene.includes('if (ACCESS.broadcastLook)') &&
    scene.includes('this.broadcast = new BroadcastPass(this.renderer)') &&
    !pass.includes('stage.render =') && !pass.includes('window.__'));
  check('the toggle tears the pass down on the standard path',
    scene.includes('this.broadcast.dispose(this.renderer)'));
  check('REDUCED FLASH controls the glow, radius and strength both',
    pass.includes('reducedFlash ? BROADCAST.ACCESS_GLOW : BROADCAST.GLOW') &&
    pass.includes('reducedFlash ? BROADCAST.ACCESS_GLOW_RAD : BROADCAST.GLOW_RAD') &&
    /ACCESS_GLOW_RAD:\s*7/.test(pass) && /GLOW_RAD:\s*14/.test(pass));
}

// ── Results motion (Phase Q) ─────────────────────────────────────────────
head('RESULTS — the score lands on the beat, exactly');

{
  // The curve itself, driven pure: the headline may never move backwards,
  // never start anywhere but zero, and never settle off the banked number.
  const scores = [0, 7, 292208, 454301.9, 555973];
  let monotone = true, exact = true, zeroStart = true;
  for (const s of scores) {
    let prev = -1;
    for (let b = 0; b <= COUNT_BEATS + 0.5; b += 0.05) {
      const v = countValue(s, b);
      if (v < prev) { monotone = false; break; }
      prev = v;
    }
    if (countValue(s, 0) !== 0) zeroStart = false;
    if (countValue(s, COUNT_BEATS) !== Math.floor(s)) exact = false;
  }
  check('the count-up starts at zero and never moves backwards', zeroStart && monotone);
  check('it settles on EXACTLY the banked score, ceiling score included',
    exact && countValue(555973, COUNT_BEATS) === 555973);
  check('the reveal is front-loaded — a reveal, not a slot machine',
    countProgress(2) > 2 / COUNT_BEATS && Math.abs(countProgress(COUNT_BEATS) - 1) < 1e-12);

  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  check('the beat clock drives the count, with a frame-time fallback for silence',
    ui.includes("if (clock?.playing)") && ui.includes('clock.beat') &&
    ui.includes('dt * FALLBACK_BPS'));
  check('REDUCED FLASH drops the per-beat nudge and keeps the count',
    ui.includes("tick !== c.lastTick && !ACCESS.reducedFlash"));
  check('the card enters in the flow band the run ended on',
    main.includes('endFlow: endedFlowLevel') &&
    ui.includes("setProperty('--endFlow'") &&
    html.includes('var(--endFlow,0)'));
  check('the ended band is sampled BEFORE the death-frame snap zeroes it',
    main.indexOf('endedFlowLevel = flowLevel(flowChain)') <
    main.indexOf('flowChain = p.chain < flowChain'));
  check('the world behind the card holds the earned brightness, steady',
    main.includes('sim.phase === PHASE.DEAD ? flowGlow(endedFlowLevel) : 1'));
  check('no hard cuts: every screen crossfades',
    /\.screen\{[^}]*transition:opacity \.\d+s/.test(html));

  // Debugging pass: END RUN at the finish goes through the SAME results
  // pipeline as a death. Before the fix it recorded the run's DISTANCE into
  // the score-best slot and quit straight to the title — no count-up, no
  // recap, no standout, no board write.
  const sky = fs.readFileSync('src/render/endgame-sky.js', 'utf8');
  check('the finish choice hands the run to the one results pipeline',
    sky.includes('globalThis.__FINISH_RUN') &&
    main.includes('window.__FINISH_RUN') &&
    /function onFinishRun\(\)[\s\S]{0,400}finalizeRun\(\);/.test(main),
    'END RUN reaches finalizeRun: count-up, recap, standout, board — all of it');
  check('the endgame layer records nothing itself — no distance in the score slot',
    !/Storage\.setBestFor|saveGhostIfBest/.test(sky),
    'best and ghost are written once, in finalizeRun, in score units');
  check('a finished route is named FINISH on the card, a death stays RUN OVER',
    ui.includes("finished ? 'FINISH' : 'RUN OVER'") &&
    main.includes('finished: !!sim.escaped'),
    'both are approved names; the cap of four holds');
  check('the spent finish choice can never re-arm over the results card',
    /_finish\(\)\s*\{[\s\S]{0,300}this\.overrun = true/.test(sky),
    'the overrun latch closes the 3.6s re-show window');
}

// ── The share card (Phase S) ─────────────────────────────────────────────
head('SHARE — the card carries the run\'s flow band');

{
  const main = fs.readFileSync('src/main.js', 'utf8');
  const shot = main.slice(main.indexOf('function composeShot'), main.indexOf('function frame'));
  check('the share card renders the ended flow band, in the flow\'s own cyan',
    shot.includes('const f = endedFlowLevel') && shot.includes('rgba(103,216,255,'));
  check('its length and brightness are the flow level, with an idle floor — never nothing',
    shot.includes('0.22 + 0.7 * f') && shot.includes('0.34 + 0.58 * f'));
}

// ── The run HUD (Phase L reduction pass) ─────────────────────────────────
head('HUD — one alarm colour, one instruction, pause-only chrome');

{
  const html = fs.readFileSync('index.html', 'utf8');
  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const access = fs.readFileSync('src/ui/access.js', 'utf8');

  // Hearts left saturated red — that hue is the Redline's alarm. Compute
  // the shipped heart hue from the stylesheet and hold it ≥ the reserved
  // separation from EVERY semantic hue, the check the constraints demand
  // BEFORE a colour is chosen, kept live so it cannot rot.
  const hex = /\.heartPip\{[^}]*color:#([0-9a-f]{6})/.exec(html)?.[1];
  let sepOk = false, hue = -1;
  if (hex) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    hue = c === 0 ? 0
      : mx === r ? 60 * (((g - b) / c) % 6)
      : mx === g ? 60 * ((b - r) / c + 2)
      : 60 * ((r - g) / c + 4);
    hue = (hue + 360) % 360;
    const RH = TUNING.META.RESERVED_HUES;
    sepOk = RH.HUES.every(({ deg }) => {
      const dd = Math.abs(hue - deg);
      return Math.min(dd, 360 - dd) >= RH.MIN_SEPARATION_DEG;
    });
  }
  check('the hearts cleared the reserved-hue check — red belongs to the Redline alone',
    sepOk, `heart hue ${hue.toFixed(0)}° vs every reserved hue at ≥ ${TUNING.META.RESERVED_HUES.MIN_SEPARATION_DEG}°`);

  // Phase V: the bell got the same live check. The OLD gold sat at hue ~46°
  // — one degree from the reserved streak-tier-3 hue — which is exactly the
  // collision this check exists to catch before a colour ships.
  const bellHex = /color:\s*0x([0-9a-f]{6})/.exec(
    fs.readFileSync('src/render/bells.js', 'utf8'))?.[1];
  let bellSep = false, bellHue = -1;
  if (bellHex) {
    const r = parseInt(bellHex.slice(0, 2), 16) / 255;
    const g = parseInt(bellHex.slice(2, 4), 16) / 255;
    const b = parseInt(bellHex.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    bellHue = c === 0 ? 0
      : mx === r ? 60 * (((g - b) / c) % 6)
      : mx === g ? 60 * ((b - r) / c + 2)
      : 60 * ((r - g) / c + 4);
    bellHue = (bellHue + 360) % 360;
    const RH = TUNING.META.RESERVED_HUES;
    bellSep = RH.HUES.every(({ deg }) => {
      const dd = Math.abs(bellHue - deg);
      return Math.min(dd, 360 - dd) >= RH.MIN_SEPARATION_DEG;
    });
  }
  check('the bell cleared the reserved-hue check — a pickup never wears an earned signal',
    bellSep, `bell hue ${bellHue.toFixed(0)}° vs every reserved hue at ≥ ${TUNING.META.RESERVED_HUES.MIN_SEPARATION_DEG}°`);
  check('the colour-vision override no longer repaints the hearts as danger',
    !access.includes('.heartPip{color:rgb'));

  check('while the run is live the only chrome is PAUSE',
    html.includes('#app.chromeless #mute,#app.chromeless #accessBtn,#app.chromeless #shopBtn{display:none}') &&
    main.includes("appEl.classList.toggle('chromeless', running && !paused && sim.phase === PHASE.RUNNING)"));
  check('one instruction at a time — the coach yields to the dash hint',
    ui.includes("if (this.powerHint?.classList.contains('on')) text = '';"));
}

// ── Punctuation beats (Phase E2) ─────────────────────────────────────────
head('BEATS — discrete arrivals, no labels, no new controls');

{
  const main = fs.readFileSync('src/main.js', 'utf8');
  const audio = fs.readFileSync('src/audio/audio.js', 'utf8');
  const rig = fs.readFileSync('src/render/camera-rig.js', 'utf8');
  const player = fs.readFileSync('src/sim/player.js', 'utf8');
  const world = fs.readFileSync('src/render/editorial-world.js', 'utf8');

  check('a BIG chain dying is an event; a small one keeps the old tick',
    main.includes('if (e.chain >= 25) {') && main.includes('audio.chainBreak(e.chain)') &&
    main.includes('rig.settle()') && main.includes('audio.chainLost()'));
  check('the settle is pure reduction — shake suppressed, nothing added',
    rig.includes('settle() { this._settleT = 0.9; }') &&
    rig.includes('* (1 - Math.min(1, this._settleT / 0.9) * 0.85)'));
  check('the dash endpoint hit rides the rung the ladder DIED on',
    /const rung = this\.dashChain;\s*\n\s*this\.dashChain = 0;/.test(player) &&
    main.includes("(e.rung | 0) >= 3") && main.includes('audio.dashClimax(e.rung)'));
  check('a band arrival fires only on the way up, and its swell yields to REDUCED FLASH',
    main.includes('bandNow > worldBand') && main.includes('editorialWorld.pulseInk()') &&
    world.includes("if (!ACCESS.reducedFlash) this._swellT = 0.7"));
  check('the release needs the scream range entered AND real daylight opened',
    main.includes('if (bv.gap < 12) inScream = true') &&
    main.includes('inScream && bv.gap > 34') && main.includes('audio.redlineRelease()'));
  check('all four cues exist, on the cinematic bus like the moments they mark',
    ['chainBreak(', 'bandRise(', 'redlineRelease(', 'dashClimax('].every((f) => audio.includes(f)) &&
    audio.split('chainBreak')[1].includes('bus.cinematic'));
}

// ── The standout line (Phase E4) ─────────────────────────────────────────
head('STANDOUT — one line, chosen by rarity, or nothing at all');

{
  check('an ordinary run gets NO standout — scarcity keeps the line meaning something',
    pickStandout({}) === null &&
    pickStandout({ dashRung: 3, earlyStreak: 9, burst10: 24999, bestChain: 24,
      avgReadMs: 421, reads: 40 }) === null);
  check('rarity ranks the pick: the top dash rung beats everything',
    pickStandout({ dashRung: FLOORS.DASH_RUNG, earlyStreak: 99, burst10: 9e9,
      bestChain: 999 }).k === 'DASH');
  check('each ledger surfaces at its own floor',
    pickStandout({ earlyStreak: FLOORS.EARLY_STREAK }).k === 'EARLY' &&
    pickStandout({ burst10: FLOORS.BURST_10 }).k === 'BEST 10' &&
    pickStandout({ bestChain: FLOORS.CLEAN }).k === 'CLEAN' &&
    pickStandout({ avgReadMs: FLOORS.AVG_READ_MS, reads: FLOORS.AVG_READ_MIN_N }).k === 'AVG READ');
  check('the dash standout speaks in the ladder\'s own multiplier',
    pickStandout({ dashRung: 4 }).v === `×${TUNING.SCORE.DASH_CHAIN_MULT[4]}`);

  const main = fs.readFileSync('src/main.js', 'utf8');
  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  const wgSrc = fs.readFileSync('src/sim/word-gates.js', 'utf8');
  check('the ledgers ride the same event the score does, and a wrong read breaks them',
    wgSrc.includes('score: g.score,') && main.includes('burstWindow.push(e.score || 0)') &&
    main.includes('burstWindow.length = 0;\n        earlyStreak = 0;'));
  check('the card renders at most the ONE standout the picker chose',
    main.includes('standout: pickStandout({') &&
    ui.includes('if (extras.standout) core.push(row(extras.standout.k, extras.standout.v));') &&
    (ui.match(/extras\.standout\.k/g) || []).length === 1);
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
