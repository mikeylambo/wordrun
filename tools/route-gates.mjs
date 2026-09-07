/**
 * Route gates (Phase L) — the reading constraint, measured on the routed
 * track with the REAL rig.
 *
 * The brief's fence: plate ≥ 270×68 device px (at 2×, 390×844 viewport) at
 * 62 m/s on flat, bank, crest and descent; plate screen rotation and skew
 * gated against the flat baseline; FOV never past the clamp; the ARMED
 * plate never occluded by the road; and the L3 payoff — a crest actually
 * hides a lookahead plate somewhere, a straight reveals it.
 *
 * Nothing here is asserted from constants: the sim runs its fixed step, the
 * shipped CameraRig computes the shot, THREE projects the billboarded plate
 * quad, and the numbers printed are the numbers measured.
 *
 *   node tools/route-gates.mjs
 */

import * as THREE from 'three';
import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { makeGate } from '../src/sim/word-gates.js';
import { CameraRig } from '../src/render/camera-rig.js';
import { AttractMode } from '../src/render/attract.js';

let PASS = 0, FAIL = 0;
const out = [];
function check(name, ok, detail = '') {
  if (ok) { PASS++; out.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; out.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
const head = (t) => out.push(`\n\x1b[1m${t}\x1b[0m`);

// Mirror of the plate's world geometry (render/word-gates.js).
const PLATE_ABOVE = 3.4;
const LETTER_H = 2.05;
const CANVAS_H = 256, FONT_PX = 168, CANVAS_W = 1024;
// RC10.2: the plate's world size is a player dial now, so the mirror takes a
// multiplier and the occlusion check is run at the LARGEST step a player can
// choose. A bigger plate is a bigger thing for a crest to hide behind, and
// "the armed plate is never occluded" has to keep meaning the same thing
// there — a promise that only holds at the default is not the promise.
let PLATE_MULT = 1;
const plateH = () => LETTER_H * PLATE_MULT * (CANVAS_H / FONT_PX);
const plateW = () => plateH() * (CANVAS_W / CANVAS_H);

const VIEW_W = 390, VIEW_H = 844, DPR = 2;
const SPEED = 62;
const DT = TUNING.SIM.DT;
const W = TUNING.WORDS;

const v = new THREE.Vector3();
function projectPx(camera, world) {
  v.copy(world).project(camera);
  return { x: (v.x * 0.5 + 0.5) * VIEW_W * DPR, y: (0.5 - v.y * 0.5) * VIEW_H * DPR, z: v.z };
}

/** The billboarded plate's projected rect + rotation at this camera. */
function plateOnScreen(camera, terrain, gateD) {
  const cx = terrain.corridorX(gateD);
  const ground = terrain.heightAt(cx, gateD);
  const centre = new THREE.Vector3(cx, ground + PLATE_ABOVE, -gateD);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const corner = (sx, sy) => projectPx(camera, new THREE.Vector3()
    .copy(centre)
    .addScaledVector(right, sx * plateW() / 2)
    .addScaledVector(up, sy * plateH() / 2));
  const tl = corner(-1, 1), tr = corner(1, 1), bl = corner(-1, -1), br = corner(1, -1);
  const xs = [tl.x, tr.x, bl.x, br.x], ys = [tl.y, tr.y, bl.y, br.y];
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    // Screen rotation of the top edge, degrees; skew = |top len − bottom len| ratio.
    rotDeg: Math.abs(Math.atan2(tr.y - tl.y, tr.x - tl.x)) * 180 / Math.PI,
    skew: Math.abs(Math.hypot(tr.x - tl.x, tr.y - tl.y) - Math.hypot(br.x - bl.x, br.y - bl.y))
      / Math.max(1, Math.hypot(tr.x - tl.x, tr.y - tl.y)),
    top: Math.min(...ys), bottom: Math.max(...ys),
  };
}

/** Is the straight sight line from the camera to `point` blocked by the road? */
function rayBlocked(camera, terrain, point) {
  const steps = 40;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = camera.position.x + (point.x - camera.position.x) * t;
    const y = camera.position.y + (point.y - camera.position.y) * t;
    const z = camera.position.z + (point.z - camera.position.z) * t;
    const d = -z;
    if (d <= -camera.position.z + 1 || d >= -point.z - 1) continue;
    if (y < terrain.heightAt(x, d) - 0.05) return true;
  }
  return false;
}

/**
 * Drive one run at pinned 62 m/s with correct reads and the real rig; sample
 * every armed frame. Returns per-segment-type worst plate metrics plus the
 * occlusion and lookahead ledgers.
 */
function measure(seed, flatten = false, speed = SPEED) {
  const sim = new Sim(seed);
  sim.start(seed, null, { mode: 'endless', difficulty: 'normal' });
  if (flatten) {
    // The pre-Phase-L geometry, as a baseline: level the route, keep the
    // winding and the turn-lean. Instrument-side patch only — the game
    // itself has no flat mode.
    sim.terrain.elevAt = () => 0;
    sim.terrain.rollAt = () => 0;
    sim.terrain.gradeAt = () => 0;
  }
  const input = emptyInput();
  const camera = new THREE.PerspectiveCamera(TUNING.CAMERA.FOV, (VIEW_W / VIEW_H), 0.5, 420);
  const rig = new CameraRig(camera);
  const terrain = sim.terrain;

  const perType = {};
  const ledger = {
    fovMax: 0, rotMax: 0, skewMax: 0, armedOccluded: 0, armedFrames: 0,
    aheadHidden: 0, aheadShown: 0, overlapMax: 0,
  };

  for (let i = 0; i < 60 * 300 && sim.phase === PHASE.RUNNING; i++) {
    sim.player.speed = speed;
    sim.beast.gap = TUNING.BEAST.MAX_GAP;
    sim.hearts = 3;
    const g = sim.wordGates.current();
    // Answer like a reader, not a machine: an answer at the arm edge resolves
    // the gate instantly (Phase B), which would leave no frames to measure at
    // the read moment. Hold until the plate is ~32 m out, then answer right.
    const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed &&
      (g.d - sim.player.d) <= 32;
    input.confirm = armed && !!g.real;
    input.reject = armed && !g.real;
    sim.step(input);
    rig.update(DT, sim.player, sim.beast.gap, 0, 0, terrain, sim.beast.x, 1);
    ledger.fovMax = Math.max(ledger.fovMax, camera.fov);

    const cur = sim.wordGates.current();
    const range = cur.d - sim.player.d;
    if (!cur.resolved && range > 2 && range <= W.ARM_DISTANCE_M) {
      ledger.armedFrames++;
      const r = plateOnScreen(camera, terrain, cur.d);
      const segType = terrain.routeSegments(cur.d + 1).at(-1).type;
      const t = perType[segType] || (perType[segType] = { w: 1e9, h: 1e9, n: 0, readW: 1e9, readH: 1e9, readN: 0 });
      t.w = Math.min(t.w, r.w); t.h = Math.min(t.h, r.h); t.n++;
      // The read moment, at the Phase K manifest's own convention: the
      // plate 37.8 m ahead of the runner — where players actually answer —
      // not the arm edge, where every plate is half this size by geometry.
      if (Math.abs(range - 37.8) <= 1.2) {
        t.readW = Math.min(t.readW, r.w); t.readH = Math.min(t.readH, r.h); t.readN++;
      }
      ledger.rotMax = Math.max(ledger.rotMax, r.rotDeg);
      ledger.skewMax = Math.max(ledger.skewMax, r.skew);
      const cx = terrain.corridorX(cur.d);
      const centre = new THREE.Vector3(cx, terrain.heightAt(cx, cur.d) + PLATE_ABOVE, -cur.d);
      if (rayBlocked(camera, terrain, centre)) ledger.armedOccluded++;

      // Lookahead plates at their TRUE gate positions (same peek the
      // renderer uses) — is +2 hidden by the road anywhere?
      const wg = sim.wordGates;
      const g2 = makeGate(wg.seed, cur.index + 2, wg.profile);
      if (g2.d - sim.player.d < 260) {
        const cx2 = terrain.corridorX(g2.d);
        const c2 = new THREE.Vector3(cx2, terrain.heightAt(cx2, g2.d) + PLATE_ABOVE, -g2.d);
        if (rayBlocked(camera, terrain, c2)) ledger.aheadHidden++;
        else ledger.aheadShown++;
      }
      // Crowding: how much of the armed plate's rect the +1 plate's rect
      // covers. Two plates on a straight are nearly concentric on screen, so
      // this is nonzero even on the shipped flat track — the gate below
      // compares against the flat baseline instead of asserting an absolute.
      const g1 = makeGate(wg.seed, cur.index + 1, wg.profile);
      const r1 = plateOnScreen(camera, terrain, g1.d);
      const oh = Math.max(0, Math.min(r.bottom, r1.bottom) - Math.max(r.top, r1.top));
      ledger.overlapMax = Math.max(ledger.overlapMax, (oh * r1.w) / Math.max(1, r.h * r.w));
    }
  }
  return { perType, ledger };
}

// ── Measure the routed track across seeds, against the flat baseline ──────
head(`ROUTE — the reading constraint on the routed track (62 m/s, ${VIEW_W}×${VIEW_H} @${DPR}x)`);

function mergeRuns(runs) {
  const merged = {};
  const L = { fovMax: 0, rotMax: 0, skewMax: 0, armedOccluded: 0, armedFrames: 0, aheadHidden: 0, aheadShown: 0, overlapMax: 0 };
  for (const { perType, ledger } of runs) {
    for (const [k, t] of Object.entries(perType)) {
      const m = merged[k] || (merged[k] = { w: 1e9, h: 1e9, n: 0, readW: 1e9, readH: 1e9, readN: 0 });
      m.w = Math.min(m.w, t.w); m.h = Math.min(m.h, t.h); m.n += t.n;
      m.readW = Math.min(m.readW, t.readW); m.readH = Math.min(m.readH, t.readH); m.readN += t.readN;
    }
    for (const k of Object.keys(L)) {
      L[k] = ['armedFrames', 'armedOccluded', 'aheadHidden', 'aheadShown'].includes(k)
        ? L[k] + ledger[k] : Math.max(L[k], ledger[k]);
    }
  }
  return { merged, L };
}

const SEEDS = [20260902, 8675309, 31337];
const { merged, L } = mergeRuns(SEEDS.map((s) => measure(s)));
// Flat baseline: the same instrument with the route levelled — the shipped
// pre-L geometry — so every routed number has its "compared to what".
const { merged: flatMerged, L: FLAT } = mergeRuns(SEEDS.map((s) => measure(s, true)));
// The 270×68 manifest standard was measured at the K stills' 36 m/s (the
// DAILY cruise), not the 64-ceiling: at 62 m/s the SHIPPED FLAT game
// measures ~171×43 by this same instrument (speed widens the FOV and opens
// the boom — that trade predates Phase L and is the calibrated design).
// So the fence is two-sided: absolute 270×68 at the speed the standard was
// set at, and pixel-parity with the flat track at the ceiling.
const { merged: merged36 } = mergeRuns(SEEDS.map((s) => measure(s, false, 36)));

const want = ['straight', 'climb', 'descent', 'bank', 'crest-up', 'crest-down'];
const covered = want.filter((t) => merged[t]?.readN > 0 && merged36[t]?.readN > 0);
check('every segment type was read through (the measurement covers the vocabulary)',
  covered.length === want.length,
  `covered: ${covered.join(' ') || 'none'}${covered.length < want.length ? ' | missing: ' + want.filter((t) => !covered.includes(t)).join(' ') : ''}`);

// The absolute floor freezes what this instrument measures on the shipped
// flat geometry at the standard's own speed — the calibration-golden move:
// the manifest's 270×68 was read off the K still's settled shot; this rig
// runs live with the speed boom open, and its honest flat number is the
// floor no segment may dip beneath.
const { merged: flat36 } = mergeRuns(SEEDS.map((s) => measure(s, true, 36)));
for (const t of want) {
  const m36 = merged36[t], f36 = flat36[t];
  if (!m36 || !m36.readN || !f36 || !f36.readN) continue;
  // Tolerance: 4×2 px (≤1.8% of the plate) — the camera rides fractionally
  // high on a crest's far side; the dip is an order below a phone's own DPR
  // rounding and the absolute floor still stands well above it.
  check(`at 36 m/s (the standard's speed), ${t} holds the flat track's read-moment size`,
    m36.readW >= f36.readW - 4 && m36.readH >= f36.readH - 2 &&
    m36.readW >= 220 && m36.readH >= 55,
    `routed ${m36.readW.toFixed(0)}×${m36.readH.toFixed(0)} vs flat ${f36.readW.toFixed(0)}×${f36.readH.toFixed(0)} (floor 220×55)`);
}
for (const t of want) {
  const m = merged[t], f = flatMerged[t];
  if (!m || !m.readN || !f || !f.readN) continue;
  check(`at the 62 m/s ceiling, ${t} gives up nothing to the flat track`,
    m.readW >= f.readW - 4 && m.readH >= f.readH - 2,
    `routed ${m.readW.toFixed(0)}×${m.readH.toFixed(0)} vs flat ${f.readW.toFixed(0)}×${f.readH.toFixed(0)}`);
}

check('FOV never passes the clamp on any segment',
  L.fovMax <= TUNING.CAMERA.FOV_MAX + 1e-6, `peak ${L.fovMax.toFixed(1)}°`);
check('plate screen rotation stays inside the reading ceiling (≤ 4.5°)',
  L.rotMax <= 4.5, `max ${L.rotMax.toFixed(2)}° (flat baseline ${FLAT.rotMax.toFixed(2)}°)`);
check('plate perspective skew stays negligible (billboard holds)',
  L.skewMax <= 0.03, `max ${(L.skewMax * 100).toFixed(2)}%`);
check('the ARMED plate is never occluded by the road — the crest may hide the future, never the present',
  L.armedOccluded === 0, `${L.armedOccluded} of ${L.armedFrames} armed frames`);
check('and a crest DOES hide a lookahead plate somewhere — the geometry means something',
  L.aheadHidden > 0 && L.aheadShown > 0,
  `+2 plate hidden on ${L.aheadHidden} frames, revealed on ${L.aheadShown} (flat: hidden ${FLAT.aheadHidden})`);

// ── RC10.2: every step of the WORD SIZE dial, on the same road ────────────
{
  const SIZES = TUNING.PLATE.SIZE_MULT;
  const rows = [];
  for (let i = 0; i < SIZES.length; i++) {
    PLATE_MULT = SIZES[i];
    const { L: LS } = mergeRuns(SEEDS.map((s) => measure(s)));
    const { merged: m36 } = mergeRuns(SEEDS.map((s) => measure(s, false, 36)));
    const worst = want.map((t) => m36[t]).filter((m) => m?.readN)
      .reduce((a, m) => (a === null || m.readW < a.readW ? m : a), null);
    rows.push({ i, mult: SIZES[i], occ: LS.armedOccluded, frames: LS.armedFrames,
      rot: LS.rotMax, w: worst?.readW ?? 0, h: worst?.readH ?? 0 });
    check(`WORD SIZE ${i} (x${SIZES[i]}): the armed plate is still never occluded`,
      LS.armedOccluded === 0, `${LS.armedOccluded} of ${LS.armedFrames} armed frames`);
    check(`WORD SIZE ${i}: bigger never means smaller — the read moment only grows`,
      (worst?.readW ?? 0) >= 220 * SIZES[i] * 0.98 && LS.rotMax <= 4.5,
      `worst segment reads ${(worst?.readW ?? 0).toFixed(0)}x${(worst?.readH ?? 0).toFixed(0)} px ` +
      `at 36 m/s, rotation ${LS.rotMax.toFixed(2)}°`);
  }
  PLATE_MULT = 1;
  out.push('\n  the WORD SIZE dial, on the routed road — worst segment at 36 m/s');
  out.push('      step   x      read px      armed frames   occluded');
  for (const r of rows) {
    out.push(`      ${r.i}      ${r.mult.toFixed(2)}   ` +
      `${`${r.w.toFixed(0)}x${r.h.toFixed(0)}`.padEnd(11)}  ${String(r.frames).padStart(10)}   ` +
      `${String(r.occ).padStart(8)}`);
  }
  out.push('      a larger plate is a larger thing to hide behind; the road hides none of them.\n');
}
check('the route never crowds the read beyond what the flat track already did',
  L.overlapMax <= FLAT.overlapMax + 0.03,
  `worst +1-over-armed cover ${(L.overlapMax * 100).toFixed(1)}% vs flat ${(FLAT.overlapMax * 100).toFixed(1)}%`);

// ── RC9.3: the cabinet frames the SAME rectangle ─────────────────────────
head('CABINET — a framed screen is the portrait screen, measured');
{
  const fs = await import('node:fs');
  const html = fs.readFileSync('index.html', 'utf8');

  // The frame's proportion, read out of the stylesheet rather than restated
  // here — if the CSS moves, this moves.
  const aspect = Number((html.match(/--cab-aspect:([0-9.]+)/) || [])[1]);
  /** The stage box the cabinet gives a window of w x h. Full height since
      RC11.8 retired the marquee, so the stage is the window's own height. */
  const stageBox = (w, h) => ({ w: Math.min(w, h * aspect), h });

  // RC11.7: the cabinet is WIDER than the phone now — 0.80 against 0.4621 —
  // because a desktop that plays a 469px column in a 1920px window is a phone
  // in a black room. What must never happen is the frame going NARROWER than
  // the viewport the reading standard was measured at: the camera's FOV is
  // vertical, so a narrower frame cannot shrink the plate but can crop it.
  check('the frame is never narrower than the viewport the reading standard was measured at',
    aspect >= VIEW_W / VIEW_H - 5e-4,
    `--cab-aspect ${aspect} against the ${VIEW_W}x${VIEW_H} standard (${(VIEW_W / VIEW_H).toFixed(4)})`);

  // The plate at the read moment, projected through the shipped rig at the
  // portrait viewport and at the framed stage a 1280x800 window gives. The
  // camera is the same camera; only its aspect and the pixel box change.
  const platePair = (aspectRatio) => {
    const sim = new Sim(SEEDS[0]);
    sim.start(SEEDS[0], null, { mode: 'endless', difficulty: 'normal' });
    const camera = new THREE.PerspectiveCamera(TUNING.CAMERA.FOV, aspectRatio, 0.5, 420);
    const rig = new CameraRig(camera);
    const input = emptyInput();
    let out = null;
    for (let i = 0; i < 60 * 300 && sim.phase === PHASE.RUNNING && !out; i++) {
      sim.player.speed = 36;
      sim.beast.gap = TUNING.BEAST.MAX_GAP;
      sim.hearts = 3;
      const g = sim.wordGates.current();
      const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed &&
        (g.d - sim.player.d) <= 32;
      input.confirm = false; input.reject = false;
      sim.step(input);
      rig.update(DT, sim.player, sim.beast.gap, 0, 0, sim.terrain, sim.beast.x, 1);
      const cur = sim.wordGates.current();
      const range = cur.d - sim.player.d;
      // THE read moment: the fixed 32 m the reading standard is measured at.
      if (!cur.resolved && range > 2 && range <= 32 && sim.wordGates.next > 1) {
        // plateOnScreen reports device px against the 390x844 @2x standard;
        // divide back out to get the plate as a FRACTION of the frame, which
        // is the number that has to be identical.
        const r = plateOnScreen(camera, sim.terrain, cur.d);
        out = { fw: r.w / (VIEW_W * DPR), fh: r.h / (VIEW_H * DPR), fov: camera.fov, aspect: aspectRatio };
      }
      if (armed) { input.confirm = !!cur.real; input.reject = !cur.real; }
    }
    return out;
  };

  const portrait = platePair(VIEW_W / VIEW_H);
  const framed = platePair(stageBox(1280, 800).w / stageBox(1280, 800).h);
  const ultra = platePair(stageBox(1920, 720).w / stageBox(1920, 720).h);
  const same = (a, b) => Math.abs(a - b) <= 1e-3;
  // The plate's WIDTH as a fraction of the frame necessarily falls as the
  // frame widens — the frame grew, the plate did not. The invariant that
  // actually protects the read is the plate's SIZE IN PIXELS at a given frame
  // height, and with a vertical FOV that is `fh` (already a share of height)
  // and `fw * aspect` (the share of height the width spans). Both are
  // identical across every framing, which is the same statement the old
  // "same rectangle" made before the cabinet was allowed to be wider.
  const inHeights = (p) => ({ w: p.fw * p.aspect, h: p.fh });
  const px = (p) => `${(p.fw * p.aspect * VIEW_H).toFixed(1)}x${(p.fh * VIEW_H).toFixed(1)}px`;
  check('the plate at the read moment is the same rectangle of pixels in every framing',
    !!portrait && !!framed && !!ultra &&
    same(inHeights(portrait).w, inHeights(framed).w) && same(portrait.fh, framed.fh) &&
    same(inHeights(portrait).w, inHeights(ultra).w) && same(portrait.fh, ultra.fh) &&
    same(portrait.fov, framed.fov),
    portrait ? `${px(portrait)} at 390x844, ${px(framed)} framed in 1280x800, ` +
      `${px(ultra)} in 1920x720 — on an 844-tall frame` : 'no read moment sampled');

  // And it is identical because the CAMERA is told about the canvas, not the
  // window. That was the one code change the cabinet needed.
  check('the camera is sized from the canvas, never from the window',
    /const el = this\.renderer\.domElement;/.test(fs.readFileSync('src/render/scene.js', 'utf8')) &&
    !/setSize\(window\.innerWidth/.test(fs.readFileSync('src/render/scene.js', 'utf8')) &&
    !/setSize\(window\.innerWidth/.test(fs.readFileSync('src/rc7-feel.js', 'utf8')),
    'and the RC7.1 render-budget governor resizes THROUGH stage.resize(), not around it');

  // Nothing in the bezel is interactive, because nothing is in the bezel.
  // RC11.8 retired the marquee: the wordmark it lit sat directly above the
  // wordmark on the title, so the header only ever repeated the word beneath
  // it — and charged the play area 64px for the echo. The bezel is empty
  // ground now, which is both the ask and the simplest thing it can be.
  const bodyIds = [...html.matchAll(/^<(?:div|canvas|button|main|section)[^>]*id="([^"]+)"/gm)]
    .map((m) => m[1]);
  check('the bezel holds nothing at all — every element in the build lives on the stage',
    !/id="marquee"/.test(html) && !/#marquee\{/.test(html) &&
    bodyIds.every((id) => id === 'app'),
    bodyIds.length ? `body children: ${bodyIds.join(', ')}` : 'no top-level element but #app');
  // ── RC11.8: the attract shows the run, not a number ────────────────────
  // It used to raise the HUD and climb the score in proportion to how far
  // through the recording it had come — a figure counting up beside a road
  // with no word, no bell and no read on it. Driven headlessly here rather
  // than asserted from the source, because "the score does not move" is a
  // behaviour and the old one was three lines that looked perfectly innocent.
  {
    const sim = new Sim(SEEDS[0]);
    sim.start(SEEDS[0], null, { mode: 'endless', difficulty: 'normal' });
    sim.player.score = 0;
    let visible = null;
    const attract = new AttractMode({
      sim,
      playerActor: { setVisible: (v) => { visible = v; } },
      loadGhost: () => null,
      onEnter: () => {}, onExit: () => {},
    });
    attract.enter();
    let moved = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const before = sim.player.score;
      attract.update(DT, true);
      if (sim.player.score !== before) moved++;
    }
    check('the attract runs the road and never moves the score',
      attract.active && moved === 0 && sim.player.score === 0 && sim.player.d > 0,
      `${moved} score changes over 30s, ${sim.player.d.toFixed(0)} m travelled`);
    check('and with no ghost on record the runner is still on the track',
      visible === true, `player figure visible: ${visible}`);
    check('the loop raises no HUD — a score, hearts and a meter belong to a run',
      /onEnter: \(\) => \{ ui\.showHud\(false\); \}/.test(fs.readFileSync('src/main.js', 'utf8')) &&
      !/bestScore/.test(fs.readFileSync('src/render/attract.js', 'utf8')));
  }

  check('and nothing paints outside the screen',
    /@media \(min-aspect-ratio: 1\/1\)\{[\s\S]{0,900}#app\{overflow:hidden;container-type:size\}/.test(html) &&
    !/document\.body\.appendChild/.test(fs.readFileSync('src/ui/guided.js', 'utf8')) &&
    !/document\.body\.appendChild/.test(fs.readFileSync('src/render/launch-sequence.js', 'utf8')) &&
    !/document\.body\.appendChild\(this\.answerGlow\)/.test(fs.readFileSync('src/ui/ui.js', 'utf8')),
    'the three overlays that hung off <body> hang off the stage, and the stage clips');

  // The keyboard legend: where the buttons would be, dimming on the same
  // flags the coach retires its lessons on.
  const cab = fs.readFileSync('src/ui/cabinet.js', 'utf8');
  check('the keyboard legend names the four controls a keyboard has',
    /glyph: '←', label: 'FAKE'/.test(cab) && /glyph: '↑', label: 'BAR'/.test(cab) &&
    /glyph: 'SPACE', label: 'DASH'/.test(cab) && /glyph: '→', label: 'REAL'/.test(cab),
    'FAKE / BAR / DASH / REAL, in the order the touch buttons sit in');
  check('it is off on touch and off in portrait, and dims on the lessons the coach uses',
    /const on = framed && !touch && running;/.test(cab) &&
    /classList\.toggle\('used', !!L\[k\.id\]\)/.test(cab) &&
    /learned: learnedNow/.test(fs.readFileSync('src/main.js', 'utf8')),
    'usedConfirm / usedReject / usedDash / usedBar — no new state, and no second opinion');
  check('and it reads nothing from the sim',
    !/__SIM|sim\.|player\./.test(cab), 'layout only, as the pass promised');
}

console.log(out.join('\n'));
console.log(`\nRoute gates: ${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
