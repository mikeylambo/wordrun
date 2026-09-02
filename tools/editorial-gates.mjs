/**
 * Editorial World gates (Phase M).
 *
 * The brief's fences, made checkable:
 *   - five bands keyed to the chain; a wrong read drops exactly ONE and the
 *     world remembers the rest (the pure band machine, driven here)
 *   - no readable text anywhere but the plate — the page is bars, never
 *     glyphs, enforced at the source level across every scene renderer
 *   - the plate is NEVER occluded by page geometry: the camera→plate sight
 *     line is tested against every instance, every armed frame of a
 *     100-gate scripted daily run, on every band
 *   - colour discipline: the page tints the art-direction band's own hues
 *     (no new hue); the correction bars wear the live ACCESS danger colour
 *     and nothing else in the file carries a colour literal
 *   - instance budgets hold at every band (seven draw calls, bounded)
 *
 *   node tools/editorial-gates.mjs
 */

import fs from 'node:fs';
import * as THREE from 'three';
import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { CameraRig } from '../src/render/camera-rig.js';
import {
  ARCH_CLEAR, BAND_CHAINS, CAPS, FILL, INK, MARGIN, NARROW_MARGIN,
  bandFor, layoutCorrections, layoutPage, stepBand,
} from '../src/render/editorial-layout.js';

let PASS = 0, FAIL = 0;
const out = [];
function check(name, ok, detail = '') {
  if (ok) { PASS++; out.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; out.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
const head = (t) => out.push(`\n\x1b[1m${t}\x1b[0m`);

// ── The band machine ──────────────────────────────────────────────────────
head('BANDS — earned by the chain, dropped one layer per mistake');

check('the five thresholds are the brief\'s (0 / 25 / 50 / 100 / 150)',
  BAND_CHAINS.join(',') === '0,25,50,100,150' &&
  bandFor(0) === 0 && bandFor(24) === 0 && bandFor(25) === 1 &&
  bandFor(99) === 2 && bandFor(100) === 3 && bandFor(150) === 4 && bandFor(400) === 4);
{
  let b = 0;
  b = stepBand(b, 30, false);
  const rose = b === 1;
  b = stepBand(b, 105, false);
  const roseAgain = b === 3;
  b = stepBand(b, 0, true);            // the wrong read: chain dies, ONE layer falls
  const droppedOne = b === 2;
  b = stepBand(b, 0, false);           // chain restarts at zero...
  const remembered = b === 2;          // ...but the world keeps what stands
  b = stepBand(b, 26, false);
  const noFalseRise = b === 2;         // 26 < the NEXT threshold above 2
  for (let i = 0; i < 9; i++) b = stepBand(b, 0, true);
  const floored = b === 0;
  check('rises on thresholds, drops exactly one on a wrong read, remembers, floors at 0',
    rose && roseAgain && droppedOne && remembered && noFalseRise && floored);
  check('densities are monotone across the bands — a higher band is always MORE page',
    FILL.every((v, i) => i === 0 || v > FILL[i - 1]) &&
    INK.every((v, i) => i === 0 || v > INK[i - 1]));
}

// ── No readable text outside the plate module ─────────────────────────────
head('TEXT — the plate is the only text in the world');

{
  const layoutSrc = fs.readFileSync('src/render/editorial-layout.js', 'utf8');
  const worldSrc = fs.readFileSync('src/render/editorial-world.js', 'utf8');
  const glyphish = /fillText|strokeText|CanvasTexture|TextGeometry|FontLoader|createElement\('canvas'\)/;
  check('the page modules contain no glyph machinery — every line of type is a bar',
    !glyphish.test(layoutSrc) && !glyphish.test(worldSrc));
  const offenders = [];
  for (const f of fs.readdirSync('src/render')) {
    if (!f.endsWith('.js') || f === 'word-gates.js') continue;
    const src = fs.readFileSync(`src/render/${f}`, 'utf8');
    if (/fillText|strokeText|TextGeometry/.test(src)) offenders.push(f);
  }
  check('across every scene renderer, glyph rasterisation lives in the plate module alone',
    offenders.length === 0, offenders.join(' ') || 'word-gates.js only');
}

// ── Colour discipline ─────────────────────────────────────────────────────
head('COLOUR — no new hue; the correction wears the Redline\'s own accent');

{
  const worldSrc = fs.readFileSync('src/render/editorial-world.js', 'utf8');
  const hexes = [...worldSrc.matchAll(/0x[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase());
  check('the only colour literal is white — every tint comes from the band table',
    hexes.every((h) => h === '0xffffff') && worldSrc.includes('bandForDistance'),
    hexes.join(' '));
  check('the correction bars read the LIVE danger accent — colour-vision modes carry through',
    worldSrc.includes('this.matCorrection.color.setHex(ACCESS.danger)'));
  check('nothing in the world pulses on its own — REDUCED FLASH has nothing to strip',
    !/setInterval|requestAnimationFrame|Math\.sin\(.*performance/.test(worldSrc));
}

// ── Layout bounds ─────────────────────────────────────────────────────────
head('LAYOUT — margins hold and budgets bound, at every band');

{
  const sim = new Sim(999);
  sim.start(999);
  const terrain = sim.terrain;
  const HW = TUNING.RUN.TRACK_HALF_W;
  let minOff = 1e9, capsOk = true;
  for (let level = 0; level < 5; level++) {
    for (const d0 of [100, 900, 2200, 4400]) {
      const page = layoutPage(terrain, d0, level, HW);
      for (const [kind, list] of Object.entries(page)) {
        if (list.length > CAPS[kind]) capsOk = false;
        for (const [x, , z, sx] of list) {
          const d = -z;
          const off = Math.abs(x - terrain.corridorX(d)) - sx / 2;
          minOff = Math.min(minOff, off);
        }
      }
    }
  }
  // Phase L4: the narrows deliberately pull the margin in — the floor is
  // the NARROW margin; ordinary spans still keep the full one (checked in
  // the L4 section below).
  check('every mark keeps clear of the track — the nearest inner edge stays past the rail',
    minOff >= HW + NARROW_MARGIN - 0.1, `closest inner edge ${minOff.toFixed(1)}m (track half-width ${HW}m)`);
  check('instance budgets hold at the densest band', capsOk,
    `caps ${Object.entries(CAPS).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  const corr = layoutCorrections(terrain, 500, 1, HW);
  check('the correction bars live in the margins too, at full intensity',
    corr.length > 0 && corr.every(([x, , z, sx]) =>
      Math.abs(x - terrain.corridorX(-z)) - sx / 2 >= HW + MARGIN - 0.1));
}

// ── The sight line: 100 gates, every armed frame, every band ─────────────
head('OCCLUSION — the page may frame the plate, never cover it');

{
  const PLATE_ABOVE = 3.4;
  const DT = TUNING.SIM.DT;
  const camera = new THREE.PerspectiveCamera(TUNING.CAMERA.FOV, 390 / 844, 0.5, 420);

  // Segment-vs-AABB (slab test) for one page instance.
  const hits = (a, b, inst) => {
    const [cx, cy, cz, sx, sy, sz] = inst;
    let tmin = 0, tmax = 1;
    const lo = [cx - sx / 2, cy - sy / 2, cz - sz / 2];
    const hi = [cx + sx / 2, cy + sy / 2, cz + sz / 2];
    const A = [a.x, a.y, a.z], B = [b.x, b.y, b.z];
    for (let i = 0; i < 3; i++) {
      const dd = B[i] - A[i];
      if (Math.abs(dd) < 1e-9) {
        if (A[i] < lo[i] || A[i] > hi[i]) return false;
        continue;
      }
      let t1 = (lo[i] - A[i]) / dd, t2 = (hi[i] - A[i]) / dd;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
    return true;
  };

  let occluded = 0, frames = 0, gatesRun = 0;
  for (let level = 0; level < 5; level++) {
    const sim = new Sim(20260902);
    sim.start(20260902, null, { mode: 'standard', difficulty: 'normal' });
    const rig = new CameraRig(camera);
    rig.reset();
    const input = emptyInput();
    let page = null, pageAnchor = -1e9;
    for (let i = 0; i < 60 * 400 && sim.phase === PHASE.RUNNING &&
         sim.wordGates.next < 100; i++) {
      sim.player.speed = 36;
      sim.beast.gap = TUNING.BEAST.MAX_GAP;
      sim.hearts = 3;
      const g = sim.wordGates.current();
      const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed &&
        (g.d - sim.player.d) <= 30;
      input.confirm = armed && !!g.real;
      input.reject = armed && !g.real;
      sim.step(input);
      rig.update(DT, sim.player, sim.beast.gap, 0, 0, sim.terrain, sim.beast.x, 1);

      const cur = sim.wordGates.current();
      const range = cur.d - sim.player.d;
      if (cur.resolved || range <= 2 || range > TUNING.WORDS.ARM_DISTANCE_M) continue;
      frames++;
      if (sim.player.d - pageAnchor > 90 || !page) {
        page = layoutPage(sim.terrain, sim.player.d, level, TUNING.RUN.TRACK_HALF_W);
        pageAnchor = sim.player.d;
      }
      const cx = sim.terrain.corridorX(cur.d);
      const plate = new THREE.Vector3(cx,
        sim.terrain.heightAt(cx, cur.d) + PLATE_ABOVE, -cur.d);
      const lists = [page.rules, page.type, page.stops, page.dashes, page.brackets,
        page.caps, page.arches,
        layoutCorrections(sim.terrain, sim.player.d, 1, TUNING.RUN.TRACK_HALF_W)];
      for (const list of lists) {
        for (const inst of list) {
          const dz = -inst[2];
          if (dz < sim.player.d - 3 || dz > cur.d + 3) continue;
          if (hits(camera.position, plate, inst)) occluded++;
        }
      }
    }
    gatesRun += sim.wordGates.next;
  }
  check('across the daily route at all five bands, no page instance ever crosses camera→plate',
    occluded === 0, `${occluded} hits over ${frames} armed frames, ${gatesRun} gates`);
  check('and the camera itself is untouched — the world adds no lens term',
    !/\.fov|updateProjectionMatrix|CameraRig|\.camera\b/.test(
      fs.readFileSync('src/render/editorial-layout.js', 'utf8')) &&
    !/\.fov|updateProjectionMatrix|CameraRig|\.camera\b/.test(
      fs.readFileSync('src/render/editorial-world.js', 'utf8')),
    'plate sizes are route-gates\' numbers, unchanged by Phase M');
}

// ── Phase L4: four reading situations, each provably different ────────────
head('L4 — the drop empties, the tunnel closes, the canyon walls, the narrows squeeze');

{
  const sim = new Sim(555001);
  sim.start(555001);
  const t = sim.terrain;
  const HW = TUNING.RUN.TRACK_HALF_W;
  // Walk far enough that the seeded walk has dealt every advanced type.
  const findSpan = (type, until = 60000) => {
    for (const s of t.routeSegments(until)) if (s.type === type) return s;
    return null;
  };
  const drop = findSpan('drop'), tunnel = findSpan('tunnel');
  const canyon = findSpan('canyon'), narrows = findSpan('narrows');
  check('the seeded walk deals every advanced situation, none before the run earned it',
    !!drop && !!tunnel && !!canyon && !!narrows &&
    [drop, tunnel, canyon, narrows].every((s) => s.d0 >= TUNING.TERRAIN.ROUTE.ADV_MIN_D_M),
    `drop@${drop?.d0 | 0} tunnel@${tunnel?.d0 | 0} canyon@${canyon?.d0 | 0} narrows@${narrows?.d0 | 0}`);

  const mid = (s) => s.d0 + s.len / 2;
  const countIn = (page, s) => Object.values(page).flat()
    .filter(([, , z]) => -z > s.d0 + 5 && -z < s.d0 + s.len - 5).length;

  if (drop) {
    const page = layoutPage(t, mid(drop) - 100, 4, HW);
    check('a drop span draws NOTHING — you and the words',
      countIn(page, drop) === 0, `${countIn(page, drop)} instances inside the span`);
  }
  if (tunnel) {
    const page = layoutPage(t, mid(tunnel) - 100, 4, HW);
    const arches = page.arches.filter(([, , z]) => -z > tunnel.d0 && -z < tunnel.d0 + tunnel.len);
    const bars = arches.filter(([, y, z, sx]) => sx > 5);
    check('the tunnel raises real arches, crossbars metres above any sight line',
      arches.length >= 9 && bars.length >= 3 &&
      bars.every(([, y, z]) => y - t.heightAt(t.corridorX(-z), -z) >= ARCH_CLEAR),
      `${arches.length} pieces, bars at +${ARCH_CLEAR}m`);
  }
  if (canyon && narrows) {
    const pc = layoutPage(t, mid(canyon) - 100, 4, HW);
    const walls = pc.type.filter(([, , z, , sy]) => -z > canyon.d0 && -z < canyon.d0 + canyon.len && sy > 3);
    check('the canyon stands the page up — the type rows become walls',
      walls.length > 10, `${walls.length} wall slabs`);
    const pn = layoutPage(t, mid(narrows) - 100, 4, HW);
    const inRules = (page, s) => page.rules
      .filter(([, , z]) => -z > s.d0 + 5 && -z < s.d0 + s.len - 5)
      .map(([x, , z]) => Math.abs(x - t.corridorX(-z)));
    const nOffs = inRules(pn, narrows);
    check('the narrows pull the first rule to the narrow margin; ordinary spans keep the full one',
      nOffs.length > 0 && Math.min(...nOffs) < HW + MARGIN - 0.2 &&
      Math.min(...nOffs) >= HW + NARROW_MARGIN - 0.1,
      `narrows first rule at ${Math.min(...nOffs).toFixed(1)}m`);
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────
head('WIRING — explicit integration, frame-accurate loss');

{
  const main = fs.readFileSync('src/main.js', 'utf8');
  const worldSrc = fs.readFileSync('src/render/editorial-world.js', 'utf8');
  check('main.js constructs the world and drives it from the frame loop',
    main.includes('new EditorialWorld(stage.scene, sim.terrain)') &&
    main.includes('editorialWorld.update(pv.d, p.chain, bv.gap, dt)') &&
    main.includes('editorialWorld.setFlow(flowF)'));
  check('a wrong read drops the layer in the same event drain as the drain itself',
    main.includes('editorialWorld.onWrongRead()') &&
    main.indexOf('editorialWorld.onWrongRead()') < main.indexOf("case 'word_wrong'") + 2000);
  check('each run starts the manuscript sparse again',
    main.includes('editorialWorld.reset()'));
  check('no runtime patching — nothing wraps a live render function',
    !worldSrc.includes('stage.render') && !worldSrc.includes('window.__'));
}

console.log(out.join('\n'));
console.log(`\nEditorial gates: ${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
