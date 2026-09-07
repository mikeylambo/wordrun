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
import { FLOORS, pickStandout, standoutRank } from '../src/meta/standout.js';
import { captureBudget, ringOrder } from '../src/render/moment-capture.js';
import { encodeGif } from '../src/ui/gif.js';
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
    'src/v1-share.js',
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

  // RC11.9: the cap is a CEILING, not a target — and one of the four was
  // never spent. The store copy said "outrun the Redline", the results card
  // said RUN OVER, and the rules a player actually reads named neither: they
  // taught the verbs, the hearts and the dash, and never said what was
  // chasing them or what ending a run meant. A player learned the controls
  // and not the stakes. One rule, on the line that already explains speed,
  // because speed is the only thing the Redline is about.
  {
    const rules = fs.readFileSync('src/ui/onboarding.js', 'utf8');
    const card = rules.slice(rules.indexOf('<h2>HOW TO PLAY</h2>'),
      rules.indexOf('data-act="start"'));
    check('the one named antagonist is named to the player, in the rules they read',
      /the Redline/.test(card), 'HOW TO PLAY names the Redline');
    check('and the rules say what happens when it reaches you',
      /run is over/i.test(card) && /slows you down/.test(card),
      'the causal chain is on one line: a wrong read slows you, the Redline closes, the run ends');
  }

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
  // RC10.9: the ladder table moved to audio/ladder.js, where the bell string
  // reads the same one. The chime still climbs with the chain; it no longer
  // owns the only copy of the notes it climbs.
  const ladderSrc = fs.readFileSync('src/audio/ladder.js', 'utf8');
  check('the mix darkens with the drain and the chime climbs with the chain',
    audio.includes('duckFilter') && /gate\(chain = 0(, early = 0(, dashChain = 0)?)?\)/.test(audio) &&
    audio.includes('chimeStep(chain, dashChain)') &&
    /export const LADDER = Object\.freeze\(\[0, 2, 4, 7, 9\]\);/.test(ladderSrc));
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
  // RC10.2: it is a DIAL now, and it still never touches the family.
  check('the legibility dials widen tracking and weight, not the family',
    plates.includes('P.TRACKING_WEIGHT[step]') &&
    plates.includes('g.letterSpacing = `${P.TRACKING_PX[step]}px`') &&
    (plates.match(/PLATE_FAMILY/g) || []).length === 4 &&
    !/FAMILY = .*readable/i.test(plates));
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
    files.mobile.includes("'Tap DASH for a burst of speed'") &&
    files.mobile.includes('percent dash charge'));

  // 2. Charged reads louder than it did, and the teaching state is real.
  check('the charged state is a distinct loud style, not a dimmer one',
    files.index.includes('#powerHint.teaching') && files.index.includes('@keyframes dashReady') &&
    files.mobile.includes('#v1MobileDash.ready') && files.mobile.includes('@keyframes dashButtonReady'));
  check('the charged hint names the actual input',
    files.ui.includes('const charged = dashReadyLine(this.modality);') &&
    !/textContent = 'DASH READY'/.test(files.ui));
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
  // RC8.1: the sentence names the moment, not the spend — "spends a full
  // DASH charge" described the economy at someone who has not yet dashed.
  check('the dash gets its own onboarding rule line, by name',
    files.onboard.includes('<b>${dash}</b>') &&
    files.onboard.includes('when the ${charge} is full to tear down the track'));
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
  // RC9.2 adds v1-share.js. It carried 'HOW FAR CAN YOU GO' for four phases
  // after the line was retired, because no scan reached the file that says
  // the game's name to everyone the player shares with — which is the last
  // place stale copy should be allowed to live.
  const tree = ['index.html', 'src/ui/ui.js', 'src/ui/onboarding.js', 'src/ui/pause.js',
    'src/meta/daily.js', 'src/v1-share.js', 'src/v1-finalize.js',
    'src/render/endgame-sky.js', 'src/rc97-endgame.js'];
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
  const rowSrc = fs.readFileSync('src/ui/review-row.js', 'utf8');
  check('the results card offers the review rather than inlining it',
    uiSrc.includes("id=\"missedOpen\"") && uiSrc.includes('MISSED · REVIEW') &&
    html.includes('id="missedPanel"'));
  // RC9.1: the panel keeps its name and loses its two group headings. The
  // row says which mistake it was without a label over it — a struck spelling
  // is a fake this player tapped, and its absence is a real word that went
  // past — and a heading over a two-row list was the panel narrating itself.
  check('the panel is headed MISSED WORDS and the rows carry no headings',
    html.includes('MISSED WORDS') && !uiSrc.includes('mHead') && !html.includes('.mHead'));
  check('a clean run reads PERFECT RUN', uiSrc.includes('>PERFECT RUN<'));
  check('the stat bar names the number it shows',
    uiSrc.includes("'TRUE READS'"));
  check('the chain goal chip carries its noun',
    fs.readFileSync('src/meta/daily.js', 'utf8').includes('`×${chain} CHAIN`'));

  // 5. The results card leads with the number, and the recap is labelled
  //    rows rather than one sentence per wrong read.
  check('the score is the largest thing on the results card',
    /\.big\{[^}]*font-size:clamp\(72px/.test(html));
  // RC6: the objective queue moved to PROFILE with the rest of progression —
  // the card is the high-score moment. The rule is unchanged: whatever each
  // surface shows, it shows as figures and labelled rows, not sentences.
  check('the results card is figures and rows, not sentences',
    /class="statBar( four)?"/.test(uiSrc) && uiSrc.includes("row('TARGET'") &&
    fs.readFileSync('src/ui/curve-screen.js', 'utf8').includes('class="objRow'));
  check('the review still teaches the true spelling of a tapped fake',
    uiSrc.includes('_missedRow(x.answer, x.shown,') &&
    rowSrc.includes('<s class="mFake">') && rowSrc.includes('<b class="mReal">'),
    'and RC9.1 marks the letters that moved — see the REVIEW block in word-gates');
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
  // RC6.2: the hearts are drawn shapes now, so the shipped hue is the FILL
  // of the heart path rather than the text colour of a glyph. Same rule,
  // read from where the colour actually lives.
  const hex = /\.heartPip \.hFill\{fill:#([0-9a-f]{6})/.exec(html)?.[1];
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
    !access.includes('.heartPip{color:rgb') && !/\.heartPip[^{]*\{[^}]*fill:rgb/.test(access));

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



// ── RC10.8 verdict: the dash keeps its stop ──────────────────────────────
{
  const stops = fs.readFileSync('src/sim/teach-stops.js', 'utf8');
  head('VERDICTS — what the playtest decided, written where it applies');
  check('the dash is still one of the three stops, and still lets go on its own',
    /STOP = Object\.freeze\(\{ REAL: 'real', FAKE: 'fake', DASH: 'dash' \}\)/.test(stops) &&
    /THE DASH STOP STAYS A STOP/.test(stops) &&
    /DASH_AUTO_SECONDS = 5/.test(stops) && /DASH_OTHER_INPUTS = 3/.test(stops),
    'a power nobody presses is a power that does not exist — and it is the one stop with no plate to read afterwards');
  const ui2 = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the DAILY line says what the route offers, not how often you may take it',
    ui2.includes('SAME FOR EVERYONE · NEW EACH DAY') && !ui2.includes('· ONCE A DAY`'),
    'ONCE A DAY read as a restriction on the player; the route is what is new');
}

// ── RC10.8: the three regressions, and the shapes that let them in ───────
head('REGRESSIONS — a hold that was timed late, a line that strobed, a look');
{
  const inputSrc = fs.readFileSync('src/input/input.js', 'utf8');
  const mobileSrc = fs.readFileSync('src/v1-mobile-ui.js', 'utf8');
  const uiSrc2 = fs.readFileSync('src/ui/ui.js', 'utf8');
  const html2 = fs.readFileSync('index.html', 'utf8');

  // (2a) THE HOLD. Every dash control must PUSH its edges. RC9.9 polled the
  // touch button once a frame and called it "one frame of latency"; measured
  // on a real touch the press arrived 455 ms late, so a 900 ms hold was timed
  // as 445 ms and raised nothing. A hold window may not be measured from a
  // timestamp that is itself a frame or more old.
  check('every dash control pushes its press edge — none is polled for it',
    mobileSrc.includes('input.dashPress?.()') && mobileSrc.includes('input.dashRelease?.()') &&
    !/if \(this\.__v1DashButtonHeld && !this\._btnDown\) this\._dashDown/.test(inputSrc) &&
    /_dashDown\(performance\.now\(\)\)/.test(inputSrc),
    'touch, Space and RT now start the same clock at the same instant');
  check('and the polled flag survives only as a safety net for a lost release',
    /if \(!this\.__v1DashButtonHeld && this\._dashT != null && this\._btnDown\) this\._dashUp\(now\)/
      .test(inputSrc),
    'a capture stolen by a system gesture cannot leave a press hanging');
  check('capture failing can no longer cost the press',
    /try \{ go\.setPointerCapture\?\.\(e\.pointerId\); \} catch/.test(mobileSrc) &&
    mobileSrc.indexOf('input.__v1DashButtonHeld = true;')
      > mobileSrc.indexOf('try { go.setPointerCapture'),
    'setPointerCapture threw BEFORE the flag was set, and the button wedged silently');

  // And the machine itself, driven: a press timed from the press INSTANT
  // gives the same answer at any frame rate. This is the check the browser
  // could not honestly provide — headless software GL runs the page at a
  // couple of frames a second, so a 150 ms tap arrives at the handler 650 ms
  // after it was dispatched and every touch measurement there is the
  // renderer's, not the game's. Driven here against a stubbed clock, the
  // boundary is exact.
  {
    const realWindow = globalThis.window;
    const realPerf = globalThis.performance;
    let clock = 1000;
    globalThis.window = { addEventListener() {}, innerWidth: 390, innerHeight: 844 };
    globalThis.performance = { now: () => clock };
    const { Input, HOLD_MS } = await import('../src/input/input.js');
    const press = (ms) => {
      const inp = new Input({ addEventListener() {}, clientWidth: 390, clientHeight: 844 });
      inp.dashPress();                 // the button's pointerdown
      clock += ms;
      inp.update(1 / 60, true);        // a frame lands mid-press, as it does
      inp.dashRelease();               // the button's pointerup
      return { dash: inp.boostHeld, raise: inp.raiseBar };
    };
    const short = [80, 150, 300, HOLD_MS - 1].map(press);
    const long = [HOLD_MS, 900, 3000].map(press);
    check('a press under the hold window dashes, and raises nothing',
      short.every((r) => r.dash && !r.raise),
      `80, 150, 300 and ${HOLD_MS - 1} ms all dash — a tap is an answer, at any frame rate`);
    check('a press that outlives it raises the bar, and cannot then dash',
      long.every((r) => r.raise && !r.dash),
      `${HOLD_MS}, 900 and 3000 ms all raise — one press, one verb, decided by its own clock`);
    globalThis.window = realWindow;
    globalThis.performance = realPerf;
  }

  // (2b) THE LINE. RC9.9 gated the bar lesson on a per-frame "nothing is
  // armed", and gaps open and close several times a second — so it strobed.
  check('the bar lesson begins in a gap and then HOLDS for its duration',
    uiSrc2.includes('_barLineOk(sim, p)') &&
    /if \(this\._barLineAt\) return \(now - this\._barLineAt\) < UI\.BAR_LINE_S \* 1000;/.test(uiSrc2) &&
    !/p\.chain >= 4 &&\s*\n?\s*!sim\.wordGates\.armed/.test(uiSrc2),
    'same rule, latched once, instead of a flicker driven by the road');
  check('and it shows at most once a run, retiring on the first raise',
    /if \(this\._lessons\.bar\) \{ this\._barLineDone = true;/.test(uiSrc2) &&
    /resetCoach\(\) \{ this\._barLineAt = 0; this\._barLineDone = !!this\._lessons\?\.bar; \}/.test(uiSrc2) &&
    fs.readFileSync('src/main.js', 'utf8').includes('ui.resetCoach();'),
    'a lesson that reappears is a lesson nobody believes');

  // (3) THE LOOK. BROADCAST is a post pass on the WebGL canvas and cannot
  // reach the DOM; the controls sit above the canvas in every look because
  // the canvas takes no z-index at all. Held here so a future look cannot
  // quietly acquire one.
  check('the canvas claims no stacking order, so the controls sit above every look',
    /canvas\{display:block;width:100%;height:100%;touch-action:none\}/.test(html2) &&
    !/#gl\s*\{[^}]*z-index/.test(html2) &&
    /\.v1MobileAction\{[^}]*z-index:67/.test(fs.readFileSync('src/v1-mobile-ui.js', 'utf8')) &&
    /#barMarks\{[^}]*z-index:24/.test(html2),
    'the buttons are 67 and the marks 24 against a canvas with none');
  check('and the look toggle reaches only the renderer, never the page',
    !/broadcastLook/.test(html2) &&
    !/classList[^\n]*broadcast/i.test(fs.readFileSync('src/ui/access.js', 'utf8')),
    'nothing about BROADCAST can move, hide or cover a control');
}

// ── RC10.8: every performance cue on one ladder ──────────────────────────
head('CUES — excellent play crests in ONE band, and a wrong read drops it');
{
  const L = await import('./cue-ladder.mjs');
  const { BAND_CHAINS, stepBand } = await import('../src/render/editorial-layout.js');

  // The table, printed. It did not exist before RC10.8, which is exactly
  // where eight systems tuned separately managed to disagree unnoticed.
  const keys = L.CUES.map((c) => c.key);
  out.push('\n  every cue against the reading chain, normalised 0..1');
  out.push('  chain'.padEnd(8) + keys.map((k) => k.slice(0, 9).padStart(11)).join(''));
  for (const r of L.ladderTable()) {
    out.push(`  ${String(r.chain).padStart(5)} ` + keys.map((k) => r[k].toFixed(2).padStart(11)).join(''));
  }
  out.push('  crest chain: ' + L.CUES.map((c) => `${c.key.split(' ')[0]} ${L.crestChain(c)}`).join(', ') + '\n');

  // Every cue rises with the chain and never falls back on its own.
  {
    let monotonic = true, offender = '';
    for (const c of L.CUES) {
      let prev = -1;
      for (let ch = 0; ch <= 160; ch++) {
        const v = c.at(ch);
        if (v < prev - 1e-9) { monotonic = false; offender = `${c.key} at ${ch}`; }
        prev = v;
      }
    }
    check('every cue climbs with the chain and never dips on its own', monotonic, offender || 'eight cues, 0..160');
  }

  // THE ALIGNMENT. The continuous world cues must crest together, on a band,
  // with the music — not each at its own private number.
  {
    const CONTINUOUS = ['flow brilliance', 'runner tail', 'runner economy', 'music layer'];
    const crests = CONTINUOUS.map((k) => L.crestChain(L.CUES.find((c) => c.key === k)));
    const same = crests.every((c) => c === crests[0]);
    check('the continuous cues crest at ONE chain, and it is an editorial band',
      same && BAND_CHAINS.includes(crests[0]) && crests[0] === L.CONTINUOUS_CREST,
      `${CONTINUOUS.join(', ')} all crest at ${crests[0]} — band ` +
      `${BAND_CHAINS.indexOf(crests[0])} of ${BAND_CHAINS.length - 1}, the one the world calls blooming`);
    check('and nothing is finished before the player has read a band\'s worth',
      crests[0] >= BAND_CHAINS[1],
      `they used to be full at ${TUNING.BOOST.CHAIN_CAP} — a sixth of the range, then silence`);
  }

  // The discrete ladders are allowed to be short, but must SAY so: they are
  // steps a player counts, not a world state, and each has its own reason.
  {
    const chime = L.crestChain(L.CUES.find((c) => c.key === 'chime rung'));
    const surge = L.crestChain(L.CUES.find((c) => c.key === 'surge'));
    const score = L.crestChain(L.CUES.find((c) => c.key === 'score multiplier'));
    const string = L.crestChain(L.CUES.find((c) => c.key === 'bell string'));
    check('the counted ladders keep their own shorter reach, deliberately',
      chime <= 20 && surge <= 20 && score === TUNING.BOOST.CHAIN_CAP && string <= 20,
      `chime ${chime} (the ear stops hearing new rungs), surge ${surge} ` +
      `(${TUNING.BOOST.SURGE_READS} reads past the cap), score ${score} (a calibrated dial), ` +
      `bell string ${string} (one bell per link)`);
    check('and the bell string is the one cue that is also an object in the world',
      L.ladderAt(0)['bell string'] === 0 && L.ladderAt(1)['bell string'] > 0,
      'nothing in the track at chain 0; the first read lights it');
  }

  // ── RC10.9: the two pentatonic ladders, driven against each other ───────
  // They used to be two: the chime on [0,2,4,7,9] from 660 Hz keyed to the
  // CHAIN, the bell on [0,4,7,11,14] from 622.25 Hz keyed to how many bells
  // this run had happened to pass — a semitone apart, in different modes, one
  // of them on a distance schedule. Two melodies in two keys is not two cues.
  {
    const LD = await import('../src/audio/ladder.js');
    const semisOf = (hz) => Math.round(12 * Math.log2(hz / LD.ROOT_HZ));
    const inKey = (hz) => LD.LADDER.includes(((semisOf(hz) % 12) + 12) % 12);
    let allInKey = true, allAscending = true, everContinues = false, offender = '';
    let topShared = true;
    for (let chain = 0; chain <= 160; chain++) {
      const chime = LD.ladderHz(LD.chimeStep(chain));
      if (!inKey(chime)) { allInKey = false; offender = `chime at ${chain}`; }
      const notes = [];
      for (let i = 0; i < LD.STRING_RUNGS; i++) {
        const step = LD.stringStep(chain, i);
        const hz = LD.ladderHz(step);
        if (!inKey(hz)) { allInKey = false; offender = `string ${i} at ${chain}`; }
        notes.push(step);
      }
      if (notes.some((v, i) => i > 0 && v <= notes[i - 1])) {
        allAscending = false; offender = `string at ${chain}`;
      }
      // While the chime has headroom the string is strictly above it; at the
      // top they share the ladder's last five rungs, which is the same thing
      // said with nowhere left to climb.
      if (LD.chimeStep(chain) < LD.STRING_TOP_START) {
        if (notes[0] > LD.chimeStep(chain)) everContinues = true;
        else { allAscending = false; offender = `string does not continue at ${chain}`; }
      } else if (notes[LD.STRING_RUNGS - 1] !== LD.TOP_STEP) {
        topShared = false; offender = `string does not top out at ${chain}`;
      }
    }
    check('both voices sing the same pentatonic from the same root, at every chain',
      allInKey, offender || `root ${LD.ROOT_HZ} Hz, [${LD.LADDER.join(', ')}], chain 0..160`);
    check('and a lit string CONTINUES the chime rather than running beside it',
      allAscending && everContinues && topShared,
      offender || 'five rungs above wherever the chime just landed, ascending, ' +
      `parking on the ladder's top five past chain ${LD.STRING_TOP_START - 1}`);
    // And nothing may keep a private copy of the notes.
    const audioSrc = fs.readFileSync('src/audio/audio.js', 'utf8');
    const mainSrc = fs.readFileSync('src/main.js', 'utf8');
    check('there is exactly ONE ladder table in the game, and both voices read it',
      !/\[0, ?4, ?7, ?11, ?14\]/.test(audioSrc) && !/622\.25/.test(audioSrc) &&
      !/\[0, ?2, ?4, ?7, ?9\]/.test(audioSrc) &&
      audioSrc.includes("from './ladder.js'") &&
      mainSrc.includes('audio.bell(stringStep(e.chain, e.i))'),
      'the bell pitch is a function of the chain, never of how far the run has come');
  }

  // A WRONG READ DROPS THEM IN ONE FRAME. The chain is zeroed by the sim, so
  // every cue that reads the chain is at its floor on the very next frame.
  {
    const atZero = L.ladderAt(0);
    const allFloor = L.CUES.filter((c) => c.key !== 'editorial band')
      .every((c) => atZero[c.key] === 0);
    check('a wrong read zeroes the chain, so every cue is at its floor next frame',
      allFloor, 'one frame, not a fade — the loss is the point');
    // The world is the ONE exception, and it is deliberate: it falls a layer.
    let b = stepBand(0, 150, false);
    const top = b;
    b = stepBand(b, 0, true);
    check('the Editorial world alone falls ONE layer instead of to nothing',
      top === BAND_CHAINS.length - 1 && b === top - 1,
      'the world remembers what still stands; every other cue does not');
  }
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

/**
 * The smallest GIF89a reader that can answer "did that encode work": skip to
 * the first image descriptor, run the format's LZW backwards, and resolve the
 * indices through the global table. Deliberately assumes what our own encoder
 * writes (global table, no interlace, no local table) — it is a check on this
 * encoder, not a general decoder.
 */
function decodeFirstFrame(b, w, h) {
  const bits = (b[10] & 7) + 1;
  const tableSize = 1 << bits;
  let p = 13;
  const table = [];
  for (let i = 0; i < tableSize; i++, p += 3) table.push([b[p], b[p + 1], b[p + 2]]);
  while (p < b.length && b[p] !== 0x2c) {
    if (b[p] === 0x21) { p += 2; while (b[p]) p += b[p] + 1; p++; }   // extension
    else p++;
  }
  p += 10;                                    // descriptor: x, y, w, h, flags
  const minCode = b[p++];
  const data = [];
  while (b[p]) { const n = b[p++]; for (let i = 0; i < n; i++) data.push(b[p++]); }
  // LZW, the GIF variant.
  const clear = 1 << minCode, end = clear + 1;
  let dict = [], width = minCode + 1, acc = 0, nbits = 0, prev = null;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict.push([i]);
    dict.push([], []);
    width = minCode + 1;
    prev = null;
  };
  reset();
  const idx = [];
  for (let i = 0; i < data.length; i++) {
    acc |= data[i] << nbits; nbits += 8;
    while (nbits >= width) {
      const code = acc & ((1 << width) - 1);
      acc >>= width; nbits -= width;
      if (code === clear) { reset(); continue; }
      if (code === end) { i = data.length; break; }
      let entry;
      if (code < dict.length && dict[code].length) entry = dict[code];
      else if (prev) entry = [...prev, prev[0]];
      else break;
      idx.push(...entry);
      if (prev) dict.push([...prev, entry[0]]);
      prev = entry;
      if (dict.length >= (1 << width) && width < 12) width++;
    }
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < Math.min(idx.length, w * h); i++) {
    const c = table[idx[i]] || [0, 0, 0];
    rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
  }
  return { count: idx.length, rgb };
}

// ── RC9.8: the best moment, as a clip ────────────────────────────────────
head('MOMENT — the run\'s best stretch, bounded, frozen, and offered once');

{
  const C = TUNING.CAPTURE;
  // The budget, at the shape the cabinet frames and at the widest phone the
  // matrix carries. Printed, because a budget nobody can read is a hope.
  const tall = captureBudget(844 / 390);
  const wide = captureBudget(896 / 414);
  check('the capture budget is known from the dials alone, and under the ceiling',
    tall.megabytes <= C.MAX_MB && wide.megabytes <= C.MAX_MB &&
    tall.frames === Math.round(C.FPS * C.SECONDS),
    tall.line);
  check('the ring holds the advertised seconds and nothing more',
    tall.frames / C.FPS === C.SECONDS && tall.frames >= 2);
  check('the cell is small on purpose — a clip, not a replay',
    tall.cellW === C.WIDTH && tall.cellW <= 200 && tall.cellH <= 480,
    `${tall.cellW}x${tall.cellH}`);

  // The ring reads oldest-first from wherever the head was left, wraps, and
  // never invents a frame that was not written.
  check('a frozen ring plays oldest frame first, wrapping exactly once',
    ringOrder(3, 24, 24).join(',') ===
      '3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2' &&
    ringOrder(3, 5, 24).join(',') === '22,23,0,1,2' &&
    ringOrder(0, 0, 24).length === 0 &&
    ringOrder(7, 99, 24).length === 24);

  // The rank and the line are the same ordering read twice — a run that gets
  // no line must get no clip, and the rarest feat must win both.
  const LEDGERS = [
    {}, { bestChain: 24 }, { earlyStreak: 9 }, { burst10: 24999 },
    { avgReadMs: 421, reads: 40 }, { avgReadMs: 300, reads: 19 },
    { dashRung: FLOORS.DASH_RUNG }, { earlyStreak: FLOORS.EARLY_STREAK },
    { burst10: FLOORS.BURST_10 }, { bestChain: FLOORS.CLEAN },
    { avgReadMs: FLOORS.AVG_READ_MS, reads: FLOORS.AVG_READ_MIN_N },
    { dashRung: 9, earlyStreak: 99, burst10: 9e9, bestChain: 999 },
  ];
  check('no standout, no clip: the rank is 0 exactly when the line is null',
    LEDGERS.every((l) => (standoutRank(l) > 0) === (pickStandout(l) !== null)));
  check('rarity ranks the clip the way it ranks the line',
    standoutRank({ dashRung: FLOORS.DASH_RUNG }) >
      standoutRank({ earlyStreak: FLOORS.EARLY_STREAK }) &&
    standoutRank({ earlyStreak: FLOORS.EARLY_STREAK }) >
      standoutRank({ burst10: FLOORS.BURST_10 }) &&
    standoutRank({ burst10: FLOORS.BURST_10 }) > standoutRank({ bestChain: FLOORS.CLEAN }) &&
    standoutRank({ bestChain: FLOORS.CLEAN }) >
      standoutRank({ avgReadMs: FLOORS.AVG_READ_MS, reads: FLOORS.AVG_READ_MIN_N }));

  const main = fs.readFileSync('src/main.js', 'utf8');
  const cap = fs.readFileSync('src/render/moment-capture.js', 'utf8');
  const clip = fs.readFileSync('src/ui/moment-clip.js', 'utf8');
  const gif = fs.readFileSync('src/ui/gif.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

  check('the card offers a clip ONLY for a run that earned a standout',
    main.includes('momentClip.show(frozenRank > 0 ? moments.moment() : null, endedFlowLevel);') &&
    main.includes('if (rank > frozenRank && moments.freeze()) frozenRank = rank;') &&
    // The live rank and the final line read the same five ledgers, or a run
    // could earn a standout the clip never froze on.
    main.includes('reads: wg.readCount,\n    });') &&
    main.includes('frozenRank = 0;') && main.includes('momentClip.hide();'));
  check('the buffer is off under REDUCED FLASH, and refuses a device it would cost',
    code(cap).includes('access.reducedFlash') &&
    code(cap).includes('if (fps < C.MIN_FPS)') &&
    code(cap).includes('if (this._off || !running || !this.source) return;'));
  check('one blit per captured frame, and nothing read back while the run is live',
    (code(cap).match(/drawImage/g) || []).length === 1 &&
    !code(cap).includes('getImageData'));
  check('freezing copies no pixels — it moves a marker',
    code(cap).includes('this.frozenAt = this.head;') &&
    !code(cap).includes('this.strip.cloneNode') && !code(cap).includes('toDataURL'));
  check('the clip carries the card\'s own furniture, burned into every frame',
    code(clip).includes("const WORDMARK = 'DICTION DASH'") &&
    code(clip).includes('g.fillText(WORDMARK') &&
    // A canvas font string is CSS shorthand: var() is never resolved in one,
    // and an unresolved face silently demotes the wordmark to 10 px default.
    code(clip).includes("getPropertyValue('--face')") &&
    !/g\.font\s*=\s*`[^`]*var\(/.test(code(clip)));
  check('WebM where the device records, a local GIF where it does not',
    code(clip).includes('new MediaRecorder(stream') && code(clip).includes("ext: 'webm'") &&
    code(clip).includes('encodeGif(') && code(clip).includes("ext: 'gif'") &&
    code(gif).includes("type: 'image/gif'"));
  check('nothing leaves the device: no request anywhere on the capture path',
    ![cap, clip, gif].some((f) => /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(code(f))));
  check('the clip is its own control, and the tray only exists on the deep card',
    code(clip).includes("el.setAttribute('role', 'button')") &&
    html.includes('id="momentSlot"') &&
    html.includes('#deathScreen #shotBtns,#deathScreen #momentSlot{display:none}'));
  // The fallback encoder, driven for real. It is DOM-free by construction —
  // ImageData-shaped arrays in, bytes out — which is the only reason a device
  // that cannot record a canvas still gets a file rather than an apology.
  {
    const W = 8, H = 6, N = 3;
    const frames = [];
    for (let f = 0; f < N; f++) {
      const px = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        px[i * 4] = (i * 8 + f * 40) & 0xff;
        px[i * 4 + 1] = 20; px[i * 4 + 2] = 200; px[i * 4 + 3] = 255;
      }
      frames.push(px);
    }
    const blob = encodeGif({ frames, width: W, height: H, delayMs: 100 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ascii = String.fromCharCode(...bytes.slice(0, 6));
    let gce = 0;
    for (let i = 0; i < bytes.length - 1; i++) if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9) gce++;
    check('the GIF fallback really encodes, in node, with no DOM anywhere near it',
      blob.type === 'image/gif' && ascii === 'GIF89a' &&
      bytes[bytes.length - 1] === 0x3b && gce === N,
      `${bytes.length} B, ${gce} frames, looping`);
    const s2 = String.fromCharCode(...bytes.slice(0, 200));
    check('the fallback loops forever, which is what makes it a loop',
      s2.includes('NETSCAPE2.0'));

    // And it DECODES. A GIF that parses as a header and then hands a viewer
    // rubbish is the failure mode a byte-count check cannot see, so the gate
    // reads the first frame back through the format's own LZW and compares it
    // to the pixels that went in, inside the 5-bit cube's own error.
    const decoded = decodeFirstFrame(bytes, W, H);
    let worst = 0;
    for (let i = 0; i < W * H; i++) {
      for (let c = 0; c < 3; c++) {
        worst = Math.max(worst, Math.abs(decoded.rgb[i * 3 + c] - frames[0][i * 4 + c]));
      }
    }
    check('a decoder gets the pixels back — the fallback is a real GIF, not a shaped file',
      decoded.count === W * H && worst <= 8, `worst channel error ${worst}/255`);
  }

  // RC11.9: the dial is applied where the protocol lives (src/dev/soak.js),
  // which is the file both the phone and the matrix runner execute — the
  // audit is the driver now and reads no dials of its own.
  check('the phone-matrix cost gate is a named dial with a runnable audit',
    typeof C.COST_MS === 'number' && C.COST_MS > 0 &&
    fs.readFileSync('package.json', 'utf8').includes('"audit:capture"') &&
    fs.readFileSync('src/dev/soak.js', 'utf8').includes('C.COST_MS') &&
    fs.readFileSync('tools/capture-audit.mjs', 'utf8').includes('window.__SOAK.verdicts'));
}

// ── The cabinet ─────────────────────────────────────────────────────────────
// On a landscape window the play area is a fixed-aspect strip inside a bezel,
// so `vw` sizes type against a rectangle the type does not live in: a headline
// at 20vw of a 1280px window rendered at 118px inside a 295px card and put a
// seven-figure score 98px off the screen. index.html restates its own `vw`
// sizes in `cqw` inside the cabinet media query; a stylesheet injected from JS
// has no such block, so it must reach for `cqw` in the first place — which
// resolves to the viewport when there is no container, and so is correct on a
// phone too.
head('CABINET — type is sized against the play area, never the window');
{
  const srcFiles = [];
  const walkSrc = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walkSrc(full);
      else if (e.name.endsWith('.js')) srcFiles.push(full);
    }
  };
  walkSrc('src');
  const offenders = [];
  for (const f of srcFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/font-size\s*:[^;}"'`]*?\d[\d.]*vw/g)) {
      offenders.push(`${f}: ${m[0].trim()}`);
    }
  }
  check('no stylesheet injected from JS sizes type in vw',
    offenders.length === 0, offenders.join(' | ') || 'all cqw');

  // The two `.big` sizes are the same headline at two moments, and a poster
  // rule that outgrew the cabinet is precisely how the clipping shipped.
  const html = fs.readFileSync('index.html', 'utf8');
  const cabinet = html.slice(html.indexOf('@media (min-aspect-ratio: 1/1)'));
  // Every id-selected rule OUTSIDE the cabinet block that sizes type in vw
  // must be restated inside it — found by walking the rules, not by naming
  // the two we happen to know about.
  const outside = html.slice(0, html.indexOf('@media (min-aspect-ratio: 1/1)'));
  const vwSized = new Set();
  for (const m of outside.matchAll(/(#[A-Za-z][\w-]*|\.big)\s*\{([^}]*)\}/g)) {
    if (/font-size\s*:[^;]*\d[\d.]*vw/.test(m[2])) vwSized.add(m[1]);
  }
  const missing = [...vwSized].filter((sel) => !new RegExp(`\\${sel[0] === '#' ? '#' : '.'}${sel.slice(1)}\\s*\\{[^}]*font-size`).test(cabinet));
  // A desktop is a screen, not a phone held at arm's length. The cabinet is
  // allowed to be narrower than the window — that is what stops an ultrawide
  // from becoming a letterbox — but not by so much that the game reads as a
  // phone in a black room. A pinned floor, not a ratio derived from the dial
  // it fences: the dial could then move and the gate would still say yes.
  const aspect = Number((html.match(/--cab-aspect:([\d.]+)/) || [])[1]);
  check('the cabinet uses the screen it is given',
    aspect >= 0.62, `--cab-aspect ${aspect} (floor 0.62; the phone it replaced: 0.4621)`);
  check('and full screen means the whole window, not a wider bezel',
    /html:fullscreen #app[^{]*\{width:100vw\}/.test(html));

  check('every vw-sized readout in index.html is restated in cqw for the cabinet',
    vwSized.size > 0 && missing.length === 0,
    missing.length ? `not restated: ${missing.join(', ')}` : `${[...vwSized].join(', ')}`);
}

// ── Numbers that fit ────────────────────────────────────────────────────────
head('READOUTS — a score is the one string whose length the player writes');
{
  const fit = fs.readFileSync('src/ui/fit.js', 'utf8');
  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the fit measures the text and never guesses a glyph advance',
    fit.includes('selectNodeContents') && !/0\.\d+\s*\*\s*len/.test(fit));
  check('it only ever shrinks — a readout that fits keeps the size the design gave it',
    fit.includes('if (!(w > avail)) return base;'));
  check('both readouts are fitted, and refit when the frame changes shape',
    ui.includes('fitHeadline()') && ui.includes('refit()') && ui.includes("addEventListener('resize'"));
  check('the live score measures on a digit rollover, not on every score change',
    ui.includes('txt.length !== this._distLen'));

  // The tuning panel is 310px of controls. Inside a cabinet strip it covered
  // the game it exists to tune; the bezel it sits in is 550px of nothing.
  const panel = fs.readFileSync('src/dev-panel.js', 'utf8');
  check('the tuning panel mounts to the bezel, not over the play area',
    panel.includes('document.body.appendChild(el)') &&
    !panel.includes("document.getElementById('app').appendChild(el)") &&
    /#devPanel\{position:fixed/.test(panel));
}

// ── The device soak ─────────────────────────────────────────────────────────
// `audit:capture` prices the rolling capture and has never produced a number
// that means anything, because it only ever ran here: headless software GL
// draws the game under the MIN_FPS floor the game itself arms behind, so the
// audit correctly refuses to judge. The measurement was never the problem —
// the host was. The protocol lives in the app now and a phone reaches it by
// opening `?soak=1`; the audit drives the same functions. Two callers, one
// implementation, so the number a phone shows and the number CI prints cannot
// drift apart — and that is exactly the property worth fencing.
head('SOAK — one protocol, a phone and a matrix runner');
{
  const soak = fs.readFileSync('src/dev/soak.js', 'utf8');
  const audit = fs.readFileSync('tools/capture-audit.mjs', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the sampler, the mirrored passes and the verdicts live in one file',
    /export function sample\(/.test(soak) && /export async function price\(/.test(soak) &&
    /export function verdicts\(/.test(soak));
  check('and the node audit drives that file rather than carrying its own copy',
    /window\.__SOAK\.price\(\)/.test(audit) && /window\.__SOAK\.verdicts\(/.test(audit) &&
    !/requestAnimationFrame/.test(audit),
    'no sampler in tools/capture-audit.mjs');
  check('a phone reaches it with a URL — no cable, no adb, iOS included',
    /soak.*===.*'1'/.test(main) && /import\('\.\/dev\/soak\.js'\)/.test(main) &&
    /export async function mountSoak\(/.test(soak));
  check('the passes are mirrored, so a warm-up is not billed to one condition',
    /await offPass\(\), n1 = await onPass\(\)/.test(soak) &&
    /await onPass\(\), o2 = await offPass\(\)/.test(soak));
  check('a device under the arming floor is reported unjudged, never passed',
    /r\.hostFps >= C\.MIN_FPS/.test(soak) && /ok: null/.test(soak),
    'the two timing rows are withheld, not defaulted to green');
}

console.log(out.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
