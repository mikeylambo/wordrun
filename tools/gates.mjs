/**
 * Phase gate verification — headless, no browser.
 *
 *   npm run gates          all four phases
 *   npm run gate:p2        one phase
 *
 * Every assertion here drives the real Sim through real fixed timesteps. If a
 * gate passes, the shipped game passes it, because this is the shipped game
 * minus the renderer.
 */

import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { Player } from '../src/sim/player.js';
import { Terrain, FEATURE } from '../src/sim/terrain.js';
import { GhostPlayer } from '../src/sim/ghost.js';
import { hashString, dailySeedString } from '../src/sim/rng.js';

// ── tiny test harness ─────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) { PASS++; results.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; results.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
function head(t) { results.push(`\n\x1b[1m${t}\x1b[0m`); }
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

// ── shared helpers ────────────────────────────────────────────────────────

const DAILY = hashString(dailySeedString(new Date('2026-08-06T12:00:00Z')));
const SEEDS = [DAILY, 12345, 999, 777001, 42, 8675309, 31337, 5150, 20260806, 101];

/** Run a sim for n steps, driving it with inputFn(sim, stepIndex) -> input. */
function run(seed, steps, inputFn, ghostData = null, stopAtD = Infinity, pinGap = null) {
  const sim = new Sim(seed);
  sim.start(seed, ghostData);
  const input = emptyInput();
  for (let i = 0; i < steps; i++) {
    if (pinGap != null) { sim.beast.gap = pinGap; sim.beast.mistakePressure = 0; }
    const cmd = inputFn(sim, i) || {};
    input.carve = cmd.carve ?? 0;
    input.flip = cmd.flip ?? 0;
    input.jump = !!cmd.jump;
    input.boostHeld = !!cmd.boostHeld;
    sim.step(input);
    if (sim.phase === PHASE.DEAD) break;
    if (sim.distance >= stopAtD) break;
  }
  return sim;
}

/**
 * Terminal velocity of the speed model in isolation.
 *
 * A featureless constant-grade plane: no obstacles, no gates, no moguls, no
 * powder banks. Nothing here but the carve -> speed curve, which is what the
 * assertion is actually about.
 */
const FLAT_PLANE = {
  heightAt: (x, d) => -d * TUNING.TERRAIN.GRADE,
  isIce: () => false,
  collidersNear: () => [],
  gatesNear: () => [],
  gradeMul: () => 1,     // a plane has no rollers; isolate the carve curve
};

function terminalSpeed(carve, steps = 900) {
  const p = new Player(FLAT_PLANE);
  const input = emptyInput();
  input.carve = carve;
  for (let i = 0; i < steps; i++) {
    p.step(TUNING.SIM.DT, input, 1, null);
    p.x = 0; // the plane has no lateral gradient, so this only avoids the banks
  }
  return p.speed;
}

/** Peak lateral velocity the player can actually command right now. */
function maxLateral(p) {
  const authority = p.staggerT > 0 ? TUNING.PLAYER.STAGGER_CARVE_SCALE : 1;
  return Math.max(2, p.speed * Math.sin(TUNING.PLAYER.MAX_CARVE * authority));
}

/**
 * Lateral metres available per metre of downhill travel.
 * This is tan(heading), not sin: carving hard also slows the downhill
 * component, which buys extra lateral room per metre of descent.
 */
function lateralPerMetre(p) {
  const authority = p.staggerT > 0 ? TUNING.PLAYER.STAGGER_CARVE_SCALE : 1;
  return Math.tan(TUNING.PLAYER.MAX_CARVE * authority) * 0.75; // safety margin
}

/**
 * Steer toward a lateral target.
 *
 * `ff` is a feed-forward lateral velocity in m/s. Without it a pure P
 * controller lags any target that is itself moving sideways — chasing a
 * wandering line, the error compounds until you are ten metres off it. The
 * feed-forward carries the target's own drift and leaves P to correct the
 * residual, which is the difference between tracking and trailing.
 */
function steerTo(sim, targetX, ff = 0) {
  const p = sim.player;
  const cap = maxLateral(p);
  const wantV = Math.max(-cap, Math.min(cap, ff + (targetX - p.x) * 2.5));
  const haveV = p.speed * Math.sin(p.heading);
  return Math.max(-1, Math.min(1, (wantV - haveV) * 0.35));
}

/**
 * Reference driver — stands in for a competent human.
 *
 * Two rules that matter:
 *  1. Pick the lane whose corridor stays open longest, with a bias toward
 *     holding the lane you already chose (a human does not dither).
 *  2. Hands off while airborne. In the air the horizontal axis is spin, not
 *     steering — a driver that keeps "steering" mid-flight spins itself into a
 *     flubbed landing every time.
 */
const HORIZON = 84;     // metres of mountain the driver reads ahead
const D_STEP = 2;       // horizon resolution, metres
const LANE_W = 1;       // lateral resolution, metres
const LANE_MIN = -15, LANE_MAX = 15;
const LANES = Math.round((LANE_MAX - LANE_MIN) / LANE_W) + 1;
const K_STEPS = Math.floor(HORIZON / D_STEP);
const AIM_AHEAD = 14;   // steer at the planned lane this far downhill
const REJOIN_DIST = Number(process.env.DESCENT_REJOIN ?? 4); // off-line -> plan a rejoin

/**
 * Receding-horizon path search over a (downhill x lateral) grid.
 *
 * A greedy "pick the longest open lane" driver walks itself into dead ends: the
 * lane that looks clearest for 40m can be walled off at 60m, and by then there
 * is no lateral budget left to escape. This searches the whole reachable set
 * instead, so it only commits to lanes that still have a way out.
 *
 * Lateral reach per step is bounded by the same MAX_CARVE the player has, so
 * the plan is always physically flyable — this is a skilled human reading the
 * mountain, not a driver cheating with teleportation.
 */
function autopilotTarget(sim, prev, biasToCorridor = false) {
  const p = sim.player;
  const cols = sim.terrain.collidersNear(p.d, 0, HORIZON + 8);

  // Which grid cells are unusable.
  const blocked = new Uint8Array(K_STEPS * LANES);
  for (const c of cols) {
    const k0 = Math.floor((c.d - c.r - 1.4 - p.d) / D_STEP);
    const k1 = Math.ceil((c.d + c.r + 1.4 - p.d) / D_STEP);
    const j0 = Math.floor((c.x - c.r - 1.9 - LANE_MIN) / LANE_W);
    const j1 = Math.ceil((c.x + c.r + 1.9 - LANE_MIN) / LANE_W);
    for (let k = Math.max(0, k0); k <= Math.min(K_STEPS - 1, k1); k++) {
      for (let j = Math.max(0, j0); j <= Math.min(LANES - 1, j1); j++) {
        blocked[k * LANES + j] = 1;
      }
    }
  }

  // How many lanes can be crossed per downhill step.
  const maxJump = Math.max(1,
    Math.floor((lateralPerMetre(p) * D_STEP) / LANE_W));

  const startLane = Math.max(0, Math.min(LANES - 1,
    Math.round((p.x - LANE_MIN) / LANE_W)));

  const parent = new Int16Array(K_STEPS * LANES).fill(-1);
  let frontier = new Uint8Array(LANES);
  let anyFrontier = false;
  for (let j = Math.max(0, startLane - maxJump); j <= Math.min(LANES - 1, startLane + maxJump); j++) {
    if (!blocked[0 * LANES + j]) { frontier[j] = 1; parent[0 * LANES + j] = startLane; anyFrontier = true; }
  }
  if (!anyFrontier) return prev ?? p.x; // nothing survives; hold the line

  let deepest = 0;
  let lastFrontier = frontier;
  for (let k = 1; k < K_STEPS; k++) {
    const next = new Uint8Array(LANES);
    let any = false;
    for (let i = 0; i < LANES; i++) {
      if (!frontier[i]) continue;
      const lo = Math.max(0, i - maxJump), hi = Math.min(LANES - 1, i + maxJump);
      for (let j = lo; j <= hi; j++) {
        if (next[j] || blocked[k * LANES + j]) continue;
        next[j] = 1; parent[k * LANES + j] = i; any = true;
      }
    }
    if (!any) break;
    frontier = next; lastFrontier = next; deepest = k;
  }

  // Among the deepest reachable lanes prefer the one nearest the centre of the
  // ribbon, with a nudge toward the lane we were already committed to.
  let bestJ = -1, bestScore = -Infinity;
  const prevLane = prev != null
    ? Math.round((prev - LANE_MIN) / LANE_W) : startLane;
  // Gravitate toward the reserved line when we know where it is, but never at
  // the cost of a lane that actually has a way out.
  const anchor = biasToCorridor
    ? sim.terrain.corridorX(p.d + deepest * D_STEP) : 0;
  for (let j = 0; j < LANES; j++) {
    if (!lastFrontier[j]) continue;
    const x = LANE_MIN + j * LANE_W;
    const score = -Math.abs(x - anchor) * 0.35
      - Math.max(0, Math.abs(x) - 13) * 6
      - Math.abs(j - prevLane) * 0.20;
    if (score > bestScore) { bestScore = score; bestJ = j; }
  }
  if (bestJ < 0) return prev ?? p.x;

  // Walk the plan back to the near field and aim there.
  const aimK = Math.max(0, Math.min(deepest, Math.round(AIM_AHEAD / D_STEP)));
  let j = bestJ;
  for (let k = deepest; k > aimK; k--) j = parent[k * LANES + j];
  return LANE_MIN + j * LANE_W;
}

/**
 * Stateful driver factory — each run gets its own lane memory.
 *
 * `mode: 'corridor'` holds the guaranteed clean line the generator reserves.
 * That is the line the P1 gate is about: proof that a clean 500m exists and
 * survives contact with the real physics, not just with a grid search.
 *
 * `mode: 'search'` (default) knows nothing about the reserved line and plans
 * from obstacle positions alone — the harder, more general navigability check.
 */
function makeAutopilot(opts = {}) {
  let target = null;
  const aim = opts.aim ?? 4;
  return (sim) => {
    const p = sim.player;
    if (p.airborne) {
      // Hands off: hold the pose so the landing is clean. Optionally trick.
      return opts.turns ? trickInput(sim, opts.turns) : { carve: 0 };
    }
    if (opts.mode === 'corridor') {
      const here = sim.terrain.corridorX(p.d);
      // On the line, hold it — it is guaranteed clear. Knocked off it by an
      // air, plan around obstacles until we are back on. Blending the two
      // everywhere just splits the difference and steers you between them.
      if (Math.abs(p.x - here) > REJOIN_DIST) {
        target = autopilotTarget(sim, target, true);
        return { carve: steerTo(sim, target), boostHeld: !!opts.boost };
      }
      // Feed-forward with the line's own lateral drift so we track rather
      // than trail it.
      const slope = sim.terrain.corridorX(p.d + 1) - here;
      target = sim.terrain.corridorX(p.d + aim);
      return {
        carve: steerTo(sim, target, slope * Math.max(4, p.speed * Math.cos(p.heading))),
        boostHeld: !!opts.boost,
      };
    }
    target = autopilotTarget(sim, target);
    return { carve: steerTo(sim, target), boostHeld: !!opts.boost };
  };
}

/** First cliff feature within maxD on a seed. */
function findCliff(seed, maxD = 900) {
  const t = new Terrain(seed);
  const n = Math.ceil(maxD / TUNING.TERRAIN.CHUNK_LEN);
  for (let ci = 0; ci < n; ci++) {
    for (const h of t.chunk(ci).heights) {
      if (h.type === FEATURE.CLIFF && h.d > 140) return h;
    }
  }
  return null;
}

/** Flattest stretch of open snow on a seed, for the control jump. */
function findFlat(seed, from = 160, to = 900) {
  const t = new Terrain(seed);
  const c0 = Math.floor(from / TUNING.TERRAIN.CHUNK_LEN);
  const c1 = Math.ceil(to / TUNING.TERRAIN.CHUNK_LEN);
  for (let ci = c0; ci < c1; ci++) {
    const ch = t.chunk(ci);
    if (ch.heights.length) continue;
    let d = ch.d0 + 20;
    if (d < from) d = from;
    let x = 0, ok = false;
    for (let cand = -12; cand <= 12; cand += 1.5) {
      const clash = ch.colliders.some(
        (c) => Math.abs(c.x - cand) < 5 && c.d > d - 10 && c.d < d + 45
      );
      if (!clash) { x = cand; ok = true; break; }
    }
    if (ok) return { d, x };
  }
  return null;
}

/**
 * Air controller: spin at full drag until `turns` full rotations are banked,
 * then release so the landing lines up. Returns an input command.
 */
function trickInput(sim, turns) {
  const p = sim.player;
  if (!p.airborne || turns <= 0) return { carve: 0 };
  const want = turns * Math.PI * 2;
  if (p.spinTotal >= want) return { carve: 0 };
  return { carve: 1 };
}

// ══════════════════════════════════════════════════════════════════════════
// P1 — Slope + Carve
// ══════════════════════════════════════════════════════════════════════════
function P1() {
  head('P1 — Slope + Carve');

  // Determinism: identical seed + identical inputs => identical state.
  const script = (sim, i) => ({ carve: Math.sin(i / 47) * 0.8, jump: i % 190 === 120 });
  const a = run(SEEDS[0], 3600, script);
  const b = run(SEEDS[0], 3600, script);
  const sa = JSON.stringify(a.state());
  const sb = JSON.stringify(b.state());
  check('__STATE() deterministic across two runs of same seed', sa === sb,
    sa === sb ? `distance ${f2(a.distance)}m` : `\n        A=${sa}\n        B=${sb}`);

  const da = JSON.stringify(a.debug());
  const db = JSON.stringify(b.debug());
  check('full debug state deterministic (x, y, vy, heading, gap…)', da === db);

  // Different seeds must actually build different mountains.
  const c = run(SEEDS[1], 3600, script);
  check('different seed => different mountain',
    JSON.stringify(c.state()) !== sa,
    `seedA d=${f2(a.distance)} vs seedB d=${f2(c.distance)}`);

  // Endless terrain: no NaN, no fall-through, over a long haul.
  const long = run(SEEDS[2], 60 * 60 * 3, makeAutopilot()); // 3 sim-minutes
  const p = long.player;
  const finite = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.d) &&
                 Number.isFinite(p.speed) && Number.isFinite(long.beast.gap);
  check('endless terrain stays finite over 3 sim-minutes', finite,
    `reached ${f2(long.distance)}m, phase=${long.phase}`);

  // Sample the whole run rather than only the final frame: while grounded the
  // player must sit exactly on the surface, and must never be under it.
  {
    const sim = new Sim(SEEDS[2]); sim.start(SEEDS[2], null);
    const input = emptyInput();
    const ap = makeAutopilot();
    let worstGlue = 0, worstSink = 0, airFrames = 0, frames = 0;
    for (let i = 0; i < 60 * 60 * 3; i++) {
      const cmd = ap(sim);
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      sim.step(input);
      if (sim.phase !== PHASE.RUNNING) break;
      const g = sim.terrain.heightAt(sim.player.x, sim.player.d);
      if (sim.player.airborne) airFrames++;
      else worstGlue = Math.max(worstGlue, Math.abs(sim.player.y - g));
      worstSink = Math.max(worstSink, g - sim.player.y);
      frames++;
    }
    check('player never falls through the heightfield',
      worstGlue < 1e-9 && worstSink < 1e-9,
      `worst glue error ${worstGlue.toExponential(2)}, worst sink ${worstSink.toExponential(2)}`);
    check('airborne is the exception, not the default state',
      airFrames / frames < 0.25,
      `${(airFrames / frames * 100).toFixed(1)}% of frames airborne over ${frames} frames`);
  }

  // The renderer samples heights through a batched fast path. If it ever
  // disagrees with heightAt(), the cliff you see stops being the cliff you
  // land on — silently. Assert they are bit-identical.
  {
    let worst = 0, samples = 0;
    for (const seed of SEEDS.slice(0, 4)) {
      const t = new Terrain(seed);
      const NX = 31, ND = 49, HW = 26;
      const grid = new Float64Array(NX * ND);
      for (const d0 of [0, 60, 300, 480, 900]) {
        t.sampleGrid(-HW, HW, NX, d0, d0 + 60, ND, grid);
        let i = 0;
        for (let iz = 0; iz < ND; iz++) {
          const d = d0 + (60 * iz) / (ND - 1);
          for (let ix = 0; ix < NX; ix++) {
            const x = -HW + (2 * HW * ix) / (NX - 1);
            worst = Math.max(worst, Math.abs(grid[i++] - t.heightAt(x, d)));
            samples++;
          }
        }
      }
    }
    check('render heightfield is identical to the physics heightfield',
      worst === 0,
      `${samples} samples across 4 seeds, worst delta ${worst.toExponential(2)}`);
  }

  // ── The mountain has a shape ───────────────────────────────────────────
  {
    const t = new Terrain(SEEDS[0]);
    const tally = {};
    for (let ci = 0; ci < 60; ci++) {
      const c = t.chunk(ci);
      const n = c.pitch.name;
      tally[n] = tally[n] || { chunks: 0, trees: 0, cliffs: 0 };
      tally[n].chunks++;
      tally[n].trees += c.colliders.filter((x) => x.type === FEATURE.TREE).length;
      tally[n].cliffs += c.heights.filter((x) => x.type === FEATURE.CLIFF).length;
    }
    const names = Object.keys(tally);
    const treesPer = (n) => tally[n].trees / tally[n].chunks;
    const cliffsPer = (n) => tally[n].cliffs / tally[n].chunks;
    check('every pitch kind appears over a long run',
      names.length === TUNING.FEATURES.PITCH_ORDER.length,
      names.map((n) => `${n} x${tally[n].chunks}`).join(', '));
    check('pitches are actually different places, not reskins',
      tally.trees && tally.open && treesPer('trees') > treesPer('open') * 3 &&
      tally.cliffs && cliffsPer('cliffs') > Math.max(cliffsPer('trees'), cliffsPer('open')),
      `trees ${f2(treesPer('trees'))} trees/chunk vs open ${f2(treesPer('open'))}; ` +
      `cliff pitch ${f2(cliffsPer('cliffs'))} cliffs/chunk vs trees ${f2(cliffsPer('trees'))}`);

    // Two pitches of the same kind must never run back to back, or a "pitch"
    // is just noise rather than a section you can recognise.
    let repeats = 0;
    for (let pi = 1; pi < 40; pi++) {
      if (t.pitchAt(pi * TUNING.FEATURES.PITCH_CHUNKS).name ===
          t.pitchAt((pi - 1) * TUNING.FEATURES.PITCH_CHUNKS).name) repeats++;
    }
    check('the same pitch never runs twice in a row', repeats === 0,
      `${repeats} repeats across 40 pitches`);
  }

  // ── Grade modulation ───────────────────────────────────────────────────
  {
    const t = new Terrain(SEEDS[0]);
    let lo = 9, hi = 0;
    for (let d = 0; d < 3000; d += 2) {
      const g = t.gradeMul(d); lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    check('the slope actually varies in steepness', hi - lo > 0.5,
      `grade ranges ${f2(TUNING.TERRAIN.GRADE * lo)} to ${f2(TUNING.TERRAIN.GRADE * hi)} ` +
      `(${f2(Math.atan(TUNING.TERRAIN.GRADE * lo) * 180 / Math.PI)}deg to ` +
      `${f2(Math.atan(TUNING.TERRAIN.GRADE * hi) * 180 / Math.PI)}deg)`);

    // fallTo must be the exact integral of GRADE * gradeMul, or the visible
    // slope and the speed model disagree about what "steep" means.
    let num = 0; const h = 0.005;
    for (let d = 0; d < 600; d += h) num += TUNING.TERRAIN.GRADE * t.gradeMul(d + h / 2) * h;
    const analytic = t.fallTo(600);
    check('height field is the exact integral of the grade',
      Math.abs(analytic - num) < 0.02 && Math.abs(t.fallTo(0)) < 1e-9,
      `analytic ${f2(analytic)}m vs numeric ${f2(num)}m over 600m, fall(0)=${t.fallTo(0).toExponential(1)}`);

    // Steep must be measurably faster than shallow, through the real player.
    const speedAtGrade = (mul) => {
      const plane = { ...FLAT_PLANE, gradeMul: () => mul };
      const p = new Player(plane);
      const input = emptyInput();
      for (let i = 0; i < 900; i++) { p.step(TUNING.SIM.DT, input, 1, null); p.x = 0; }
      return p.speed;
    };
    const steep = speedAtGrade(hi), shallow = speedAtGrade(lo);
    check('steep pitches carry you and shallow ones bleed you',
      steep > shallow * 1.25,
      `${f2(shallow)} m/s on the shallowest vs ${f2(steep)} m/s on the steepest ` +
      `(${f2(steep / shallow)}x)`);
  }

  // Speed model, isolated from obstacles and powder.
  const vTuck = terminalSpeed(0);
  const vCarve = terminalSpeed(1);
  const vHalf = terminalSpeed(0.5);
  check('straight tuck is faster than full carve',
    vTuck > vCarve + 8, `tuck ${f2(vTuck)} m/s vs full carve ${f2(vCarve)} m/s`);
  // The curve is SPEED_CARVE_MIN + (SPEED_TUCK - SPEED_CARVE_MIN) * cos(h)^TUCK_EXP.
  // Full carve is MAX_CARVE (49 deg), not 90, so it never reaches the floor.
  const curve = (h) => TUNING.PLAYER.SPEED_CARVE_MIN +
    (TUNING.PLAYER.SPEED_TUCK - TUNING.PLAYER.SPEED_CARVE_MIN) *
    Math.pow(Math.cos(h), TUNING.PLAYER.TUCK_EXP);
  check('speed converges to the closed-form carve curve',
    Math.abs(vTuck - TUNING.PLAYER.SPEED_TUCK) < 0.05 &&
    Math.abs(vCarve - curve(TUNING.PLAYER.MAX_CARVE)) < 0.05,
    `tuck ${f2(vTuck)} (expect ${f2(TUNING.PLAYER.SPEED_TUCK)}), ` +
    `full carve ${f2(vCarve)} (expect ${f2(curve(TUNING.PLAYER.MAX_CARVE))})`);
  check('full carve scrubs at least a third of top speed',
    vCarve < vTuck * 0.68, `${f2(vCarve)} / ${f2(vTuck)} = ${f2(vCarve / vTuck)}`);
  check('carve angle maps monotonically to speed (analog, not binary)',
    vTuck > vHalf && vHalf > vCarve,
    `0.0 -> ${f2(vTuck)}, 0.5 -> ${f2(vHalf)}, 1.0 -> ${f2(vCarve)} m/s`);

  // Soft walls: powder slows you but never kills or ejects you.
  const wall = run(SEEDS[4], 900, () => ({ carve: 1 }));
  check('deep powder slows but does not kill',
    wall.phase !== PHASE.DEAD &&
    Math.abs(wall.player.x) <= TUNING.TERRAIN.HALF_WIDTH + 6.001 &&
    wall.player.speed >= TUNING.PLAYER.SPEED_FLOOR - 1e-6,
    `x=${f2(wall.player.x)} speed=${f2(wall.player.speed)}`);

  // Every seed must offer a clean line to hold in the first place.
  {
    let ok = 0; const bad = [];
    for (const s of SEEDS) {
      const t = new Terrain(s);
      let clear = true;
      for (let d = 0; d <= 520; d += 0.5) {
        const cx = t.corridorX(d);
        for (const c of t.collidersNear(d, 3, 3)) {
          if (Math.abs(c.d - d) < c.r + 0.6 &&
              Math.abs(c.x - cx) < c.r + 0.55) { clear = false; break; }
        }
        if (!clear) { bad.push(`${s}@${d.toFixed(0)}m`); break; }
      }
      if (clear) ok++;
    }
    check('generator reserves a genuinely obstacle-free line on every seed',
      ok === SEEDS.length, `${ok}/${SEEDS.length}${bad.length ? ` — fouled: ${bad.join(', ')}` : ''}`);
  }

  // The headline gate: hold a clean line for 500m, through the real physics.
  let cleanSeeds = 0;
  const detail = [];
  for (const s of SEEDS) {
    const r = run(s, 60 * 90, makeAutopilot({ mode: 'corridor' }), null, 500);
    const clean = r.distance >= 500 && r.player.obstaclesHit === 0;
    if (clean) cleanSeeds++;
    else detail.push(`${s}:${f2(r.distance)}m/${r.player.obstaclesHit}hit`);
  }
  check('clean line held 500m (10 seeds, obstaclesHit === 0)',
    cleanSeeds === SEEDS.length,
    `${cleanSeeds}/${SEEDS.length} clean${detail.length ? ` — misses: ${detail.join(', ')}` : ''}`);

  // Harder, informational: a driver that has never been told where the clean
  // line is, planning from obstacle geometry alone.
  {
    let hits = 0, dist = 0;
    for (const s of SEEDS) {
      const r = run(s, 60 * 90, makeAutopilot(), null, 500);
      hits += r.player.obstaclesHit; dist += r.distance;
    }
    check('mountain is navigable without knowing the reserved line',
      hits / SEEDS.length < 5,
      `blind path-search driver: ${(hits / SEEDS.length).toFixed(1)} hits per 500m ` +
      `over ${SEEDS.length} seeds`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// P2 — Air + Tricks
// ══════════════════════════════════════════════════════════════════════════
function P2() {
  head('P2 — Air + Tricks');

  const seed = SEEDS.find((s) => findCliff(s) && findFlat(s)) ?? SEEDS[0];
  const cliff = findCliff(seed);
  const flat = findFlat(seed);
  check('seed contains both a cliff and an open flat stretch', !!cliff && !!flat,
    cliff ? `cliff at d=${f2(cliff.d)} x=${f2(cliff.x)} drop=${f2(cliff.drop)}m` : 'none found');
  if (!cliff || !flat) return;

  /** Line the player up on a target lane and hold it until past `untilD`. */
  const lineTo = (targetX) => (sim) => ({ carve: steerTo(sim, targetX) });

  // --- The cliff line: aim at the chute, huck it, no rotation.
  const PIN = 60; // beast parked; P2 is about air, not survival
  const cliffRun = run(seed, 60 * 60, (sim) => {
    const p = sim.player;
    if (p.airborne) return trickInput(sim, 0);
    return { carve: steerTo(sim, cliff.x) };
  }, null, Infinity, PIN);

  // --- The flat control: same seed, jump on open snow, no rotation.
  const flatRun = run(seed, 60 * 60, (sim) => {
    const p = sim.player;
    if (p.airborne) return trickInput(sim, 0);
    const jump = !p.airborne && p.d > flat.d && p.d < flat.d + 1.2;
    return { carve: steerTo(sim, flat.x), jump };
  }, null, Infinity, PIN);

  // Measure the single biggest air each run produced.
  const bestAir = (seedX, inputFn, stopD) => {
    const sim = new Sim(seedX); sim.start(seedX, null);
    const input = emptyInput();
    let best = { hang: 0, fill: 0, clean: false, turns: 0 };
    for (let i = 0; i < 60 * 60 && sim.player.d < stopD; i++) {
      sim.beast.gap = PIN; sim.beast.mistakePressure = 0;
      const cmd = inputFn(sim, i) || {};
      input.carve = cmd.carve ?? 0; input.flip = cmd.flip ?? 0;
      input.jump = !!cmd.jump; input.boostHeld = false;
      sim.step(input);
      const l = sim.player.lastLanding;
      if (l && l.hangtime > best.hang) {
        best = { hang: l.hangtime, fill: l.fill, clean: l.clean, turns: l.turns };
      }
      if (sim.phase === PHASE.DEAD) break;
    }
    return best;
  };

  const airCliff = bestAir(seed, (sim) => {
    const p = sim.player;
    if (p.airborne) return trickInput(sim, 0);
    return { carve: steerTo(sim, cliff.x) };
  }, cliff.d + 120);

  const airFlat = bestAir(seed, (sim) => {
    const p = sim.player;
    if (p.airborne) return trickInput(sim, 0);
    return { carve: steerTo(sim, flat.x), jump: !p.airborne && p.d > flat.d && p.d < flat.d + 1.2 };
  }, flat.d + 120);

  check('cliff produces real hangtime', airCliff.hang > 0.6,
    `cliff hang ${f2(airCliff.hang)}s vs flat jump ${f2(airFlat.hang)}s`);

  check('deliberate cliff line banks measurably more boost than a flat line',
    airCliff.fill > airFlat.fill * 1.5 && airCliff.fill > 0,
    `cliff ${f2(airCliff.fill)} vs flat ${f2(airFlat.fill)} meter units ` +
    `(${airFlat.fill > 0 ? f2(airCliff.fill / airFlat.fill) : '∞'}x)`);

  // --- Rotation multiplies the fill on the same launch.
  const airCliff360 = bestAir(seed, (sim) => {
    const p = sim.player;
    if (p.airborne) return trickInput(sim, 1);
    return { carve: steerTo(sim, cliff.x) };
  }, cliff.d + 120);

  check('rotation multiplies fill on an identical launch',
    airCliff360.clean && airCliff360.fill > airCliff.fill * 1.4,
    `no-spin ${f2(airCliff.fill)} vs 360 ${f2(airCliff360.fill)} ` +
    `(turns=${f2(airCliff360.turns)}, clean=${airCliff360.clean})`);

  // --- Flub: release mid-rotation so the landing is sideways.
  //
  // The meter is pre-loaded to a known value so the forfeit is actually
  // measured. Flubbing with an empty meter proves nothing.
  const PRELOAD = 60;
  const flub = (() => {
    const sim = new Sim(seed); sim.start(seed, null);
    const input = emptyInput();
    let meterBefore = 0, sawFlub = false;
    for (let i = 0; i < 60 * 60 && sim.player.d < cliff.d + 130; i++) {
      const p = sim.player;
      sim.beast.gap = PIN; sim.beast.mistakePressure = 0;
      p.boostMeter = PRELOAD;                       // hold it topped up
      const cmd = p.airborne
        ? { carve: p.spinTotal < Math.PI * 0.55 ? 1 : 0 }   // stop at ~100deg
        : { carve: steerTo(sim, cliff.x) };
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      const flubsBefore = p.tricksFlubbed;
      meterBefore = p.boostMeter;
      sim.step(input);
      if (p.tricksFlubbed > flubsBefore) {
        sawFlub = true;
        return { sawFlub, meterBefore, meterAfter: p.boostMeter, staggerAfter: p.staggerT };
      }
      if (sim.phase === PHASE.DEAD) break;
    }
    return { sawFlub, meterBefore, meterAfter: sim.player.boostMeter, staggerAfter: 0 };
  })();

  check('misaligned landing is detected as a flub', flub.sawFlub);
  check('flubbed landing forfeits banked boost',
    flub.sawFlub && flub.meterBefore > 1 &&
    Math.abs(flub.meterAfter - flub.meterBefore * (1 - TUNING.BOOST.FLUB_METER_LOSS)) < 1e-6,
    `meter ${f2(flub.meterBefore)} -> ${f2(flub.meterAfter)} ` +
    `(${Math.round(TUNING.BOOST.FLUB_METER_LOSS * 100)}% of the bank, plus the whole pending fill)`);
  check('flubbed landing staggers for STAGGER_TIME',
    flub.sawFlub && Math.abs(flub.staggerAfter - TUNING.PLAYER.STAGGER_TIME) < 1e-6,
    `stagger ${f2(flub.staggerAfter)}s`);

  // A clean landing on the same launch must keep the bank AND add to it.
  {
    const sim = new Sim(seed); sim.start(seed, null);
    const input = emptyInput();
    let before = 0, after = 0, landed = false;
    for (let i = 0; i < 60 * 60 && sim.player.d < cliff.d + 130; i++) {
      const p = sim.player;
      sim.beast.gap = PIN; sim.beast.mistakePressure = 0;
      if (!landed) p.boostMeter = Math.min(p.boostMeter, PRELOAD);
      const cmd = p.airborne ? trickInput(sim, 0) : { carve: steerTo(sim, cliff.x) };
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      const landedBefore = p.tricksLanded;
      before = p.boostMeter;
      sim.step(input);
      if (p.tricksLanded > landedBefore && p.lastLanding.hangtime > 0.6) {
        after = p.boostMeter; landed = true; break;
      }
    }
    check('a clean landing keeps the bank and adds to it',
      landed && after > before,
      `meter ${f2(before)} -> ${f2(after)} on a clean cliff landing`);
  }

  // --- Small chatter must never be punished.
  const chatter = run(seed, 60 * 40, makeAutopilot(), null, Infinity, PIN);
  check('mogul chatter does not produce phantom flubs',
    chatter.player.tricksFlubbed === 0 || chatter.player.tricksFlubbed < 3,
    `flubs=${chatter.player.tricksFlubbed} landed=${chatter.player.tricksLanded} over ${f2(chatter.distance)}m`);

  // ── The chain ──────────────────────────────────────────────────────────
  {
    const p = new Player(FLAT_PLANE);
    check('chain multiplier starts at 1x and caps',
      p.chainMult() === 1 &&
      (() => { p.chain = 999; return p.chainMult(); })() ===
        1 + TUNING.BOOST.CHAIN_CAP * TUNING.BOOST.CHAIN_STEP,
      `1.00x at 0 links, ${f2(1 + TUNING.BOOST.CHAIN_CAP * TUNING.BOOST.CHAIN_STEP)}x ` +
      `at the ${TUNING.BOOST.CHAIN_CAP}-link cap`);
  }

  // The same trick must pay more deep into a chain than at the start of one.
  {
    const huckWithChain = (startChain) => {
      const sim = new Sim(seed); sim.start(seed, null);
      const input = emptyInput();
      let fill = 0;
      for (let i = 0; i < 60 * 60 && sim.player.d < cliff.d + 120; i++) {
        const p = sim.player;
        sim.beast.gap = PIN; sim.beast.mistakePressure = 0;
        p.chain = startChain;                      // hold the chain steady
        const cmd = p.airborne ? trickInput(sim, 0) : { carve: steerTo(sim, cliff.x) };
        input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
        sim.step(input);
        if (p.lastLanding && p.lastLanding.clean) fill = Math.max(fill, p.lastLanding.fill);
      }
      return fill;
    };
    const cold = huckWithChain(0);
    const hot = huckWithChain(TUNING.BOOST.CHAIN_CAP);
    const expect = 1 + TUNING.BOOST.CHAIN_CAP * TUNING.BOOST.CHAIN_STEP;
    check('an identical trick pays chain-multiplied',
      cold > 0 && Math.abs(hot / cold - expect) < 0.02,
      `${f2(cold)} cold vs ${f2(hot)} at ${TUNING.BOOST.CHAIN_CAP} links ` +
      `= ${f2(hot / cold)}x (expected ${f2(expect)}x)`);
  }

  // Any mistake must zero it — that is the whole tension.
  {
    const sim = new Sim(seed); sim.start(seed, null);
    const input = emptyInput();
    sim.player.chain = 6;
    sim.player.obstaclesHit = 0;
    let brokeOnHit = null;
    for (let i = 0; i < 60 * 60 && brokeOnHit === null; i++) {
      const p = sim.player;
      sim.beast.gap = PIN; sim.beast.mistakePressure = 0;
      const before = p.obstaclesHit;
      input.carve = 0; input.flip = 0; input.jump = false; input.boostHeld = false;
      sim.step(input);
      if (p.obstaclesHit > before) brokeOnHit = p.chain;
      if (sim.phase !== PHASE.RUNNING) break;
    }
    check('clipping anything resets the chain to zero', brokeOnHit === 0,
      brokeOnHit === null ? 'no hit occurred to test with' : `chain after a clip: ${brokeOnHit}`);
  }

  check('boost meter never exceeds METER_MAX',
    cliffRun.player.boostMeter <= TUNING.BOOST.METER_MAX + 1e-9 &&
    flatRun.player.boostMeter <= TUNING.BOOST.METER_MAX + 1e-9);
}

// ══════════════════════════════════════════════════════════════════════════
// P3 — Beast + Boost Spend
// ══════════════════════════════════════════════════════════════════════════
function P3() {
  head('P3 — Beast + Boost Spend');

  // Gap must never exceed the dread ceiling, ever.
  let maxGap = 0;
  const fast = run(SEEDS[0], 60 * 120, makeAutopilot(), null, 4000);
  check('gap never exceeds MAX_GAP (dread stays audible)',
    fast.beast.gap <= TUNING.BEAST.MAX_GAP + 1e-9);

  // Sample the ceiling continuously rather than only at the end.
  {
    const sim = new Sim(SEEDS[1]); sim.start(SEEDS[1], null);
    const input = emptyInput();
    const ap = makeAutopilot();
    for (let i = 0; i < 60 * 90; i++) {
      const cmd = ap(sim);
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      sim.step(input);
      maxGap = Math.max(maxGap, sim.beast.gap);
      if (sim.phase === PHASE.DEAD) break;
    }
    check('gap ceiling holds across a full 90s run', maxGap <= TUNING.BEAST.MAX_GAP + 1e-9,
      `max observed ${f2(maxGap)}m / ceiling ${TUNING.BEAST.MAX_GAP}m`);
  }

  // The headline gate: a mistake must be visible in the gap within 2 seconds.
  {
    const sim = new Sim(SEEDS[2]); sim.start(SEEDS[2], null);
    const input = emptyInput();
    const ap = makeAutopilot();
    // Settle into a rhythm first so the gap is not still opening from spawn.
    for (let i = 0; i < 60 * 25; i++) {
      const cmd = ap(sim);
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      sim.step(input);
    }
    const gapBefore = sim.beast.gap;
    sim.beast.registerMistake(1);          // one clipped tree
    for (let i = 0; i < 120; i++) {         // exactly 2 seconds
      const cmd = ap(sim);
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      sim.step(input);
    }
    const closed = gapBefore - sim.beast.gap;
    check('gap responds visibly within 2s of a mistake', closed >= 8,
      `closed ${f2(closed)}m in 2.00s (${f2(gapBefore)} -> ${f2(sim.beast.gap)})`);
  }

  // Proximity 2x, verified through the numbers the brief names.
  {
    const sim = new Sim(SEEDS[3]); sim.start(SEEDS[3], null);
    sim.beast.gap = 0.0001;
    check('proximity multiplier reaches 2x at the beast',
      Math.abs(sim.beast.proximityMult() - TUNING.BOOST.PROX_MAX_MULT) < 0.001,
      `mult=${sim.beast.proximityMult().toFixed(4)} at gap=${f2(sim.beast.gap)}m`);
    sim.beast.gap = TUNING.BOOST.PROX_RANGE / 2;
    check('proximity multiplier is 1.5x at half range',
      Math.abs(sim.beast.proximityMult() - 1.5) < 0.001,
      `mult=${sim.beast.proximityMult().toFixed(4)} at gap=${f2(sim.beast.gap)}m`);
    sim.beast.gap = TUNING.BOOST.PROX_RANGE + 5;
    check('proximity multiplier is 1x outside range',
      Math.abs(sim.beast.proximityMult() - 1) < 1e-9);
  }

  // The same trick banks double when it is taken under the beast's nose.
  {
    const seed = SEEDS.find((s) => findCliff(s)) ?? SEEDS[0];
    const cliff = findCliff(seed);
    const hucked = (forceGap) => {
      const sim = new Sim(seed); sim.start(seed, null);
      const input = emptyInput();
      let best = 0, bestHang = 0;
      for (let i = 0; i < 60 * 60 && sim.player.d < cliff.d + 120; i++) {
        const p = sim.player;
        // Pin the beast for the test; mistakes must not drag it off the pin.
        if (forceGap != null) { sim.beast.gap = forceGap; sim.beast.mistakePressure = 0; }
        const cmd = p.airborne ? trickInput(sim, 1) : { carve: steerTo(sim, cliff.x) };
        input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
        sim.step(input);
        // The computed fill, not the meter delta: the meter caps at METER_MAX
        // and the near-beast run fills fast enough to clip against it.
        const l = p.lastLanding;
        if (l && l.clean && l.hangtime > bestHang) { bestHang = l.hangtime; best = l.fill; }
      }
      return best;
    };
    // Pin just outside KILL_GAP: any closer and the beast eats the player
    // before the trick can land, which measures nothing.
    const NEAR = TUNING.BEAST.KILL_GAP + 0.5;
    const far = hucked(60);
    const near = hucked(NEAR);
    const expect = 1 + (1 - NEAR / TUNING.BOOST.PROX_RANGE) *
      (TUNING.BOOST.PROX_MAX_MULT - 1);
    check('same trick banks proportionally more under the beast (courage pays)',
      far > 0 && Math.abs(near / far - expect) < 0.05,
      `far(60m) ${f2(far)} vs near(${NEAR}m) ${f2(near)} = ` +
      `${far > 0 ? f2(near / far) : '∞'}x (expected ${f2(expect)}x, ceiling ${TUNING.BOOST.PROX_MAX_MULT}x)`);
  }

  // Overdrive: spends the meter, adds speed, widens the turn radius.
  // Measured at terminal velocity on the flat plane — comparing two runs still
  // mid-acceleration measures the accel curve, not the speed ceiling.
  {
    const topSpeed = (boost) => {
      const p = new Player(FLAT_PLANE);
      const input = emptyInput();
      input.boostHeld = boost;
      for (let i = 0; i < 900; i++) {
        if (boost) p.boostMeter = TUNING.BOOST.METER_MAX; // keep it lit
        p.step(TUNING.SIM.DT, input, 1, null);
        p.x = 0;
      }
      return p.speed;
    };
    const plain = topSpeed(false);
    const boosted = topSpeed(true);
    check('Overdrive raises top speed by exactly SPEED_MULT',
      Math.abs(boosted / plain - TUNING.BOOST.SPEED_MULT) < 0.01,
      `${f2(plain)} -> ${f2(boosted)} m/s = ${f2(boosted / plain)}x ` +
      `(target ${TUNING.BOOST.SPEED_MULT}x)`);

    const seed = SEEDS[0];
    const sim2 = new Sim(seed); sim2.start(seed, null);
    sim2.player.boostMeter = TUNING.BOOST.METER_MAX;
    const in2 = emptyInput(); in2.boostHeld = true;
    for (let i = 0; i < 90; i++) { in2.carve = 1; sim2.step(in2); }

    check('Overdrive drains the meter into boostSpent',
      sim2.player.boostSpent > 0 &&
      Math.abs((sim2.player.boostMeter + sim2.player.boostSpent) - TUNING.BOOST.METER_MAX) < 1e-6,
      `spent ${f2(sim2.player.boostSpent)}, left ${f2(sim2.player.boostMeter)}`);
    check('Overdrive widens the turn radius',
      sim2.player.overdrive &&
      Math.abs(sim2.player.carveTarget) <=
        TUNING.PLAYER.MAX_CARVE * TUNING.BOOST.CARVE_SCALE + 1e-9,
      `full-lock heading ${f2(Math.abs(sim2.player.carveTarget))} rad vs ` +
      `${f2(TUNING.PLAYER.MAX_CARVE)} rad without Overdrive`);

    const sim3 = new Sim(seed); sim3.start(seed, null);
    sim3.player.boostMeter = TUNING.BOOST.MIN_ACTIVATE - 0.01;
    const in3 = emptyInput(); in3.boostHeld = true;
    for (let i = 0; i < 30; i++) sim3.step(in3);
    check('Overdrive refuses to start below MIN_ACTIVATE',
      !sim3.player.overdrive && sim3.player.boostSpent === 0);
  }

  // Overdrive empties, then shuts itself off.
  {
    const sim = new Sim(SEEDS[5]); sim.start(SEEDS[5], null);
    sim.player.boostMeter = TUNING.BOOST.METER_MAX;
    const input = emptyInput(); input.boostHeld = true;
    let steps = 0;
    while (sim.player.boostMeter > 0 && steps < 60 * 20) { sim.step(input); steps++; }
    for (let i = 0; i < 10; i++) sim.step(input);
    const expected = TUNING.BOOST.METER_MAX / TUNING.BOOST.DRAIN_RATE;
    check('a full meter yields the expected Overdrive duration',
      !sim.player.overdrive && Math.abs(steps / 60 - expected) < 0.15,
      `${f2(steps / 60)}s (expected ${f2(expected)}s)`);
  }

  // Every run ends in death.
  {
    const perfect = run(SEEDS[6], 60 * 60 * 12, makeAutopilot()); // 12 sim-minutes max
    check('every run ends in death (beast catches even a clean line)',
      perfect.phase === PHASE.KILL || perfect.phase === PHASE.DEAD,
      `died at ${f2(perfect.distance)}m after ${f2(perfect.time)}s, phase=${perfect.phase}`);
    check('death cam has a beast to frame (gap collapsed to KILL_GAP)',
      perfect.beast.killed && Math.abs(perfect.beast.gap - TUNING.BEAST.KILL_GAP) < 1e-6,
      `gap at kill = ${f2(perfect.beast.gap)}m, kill cam ${TUNING.BEAST.KILL_CAM_TIME}s`);
  }

  // ── Does courage actually pay? ─────────────────────────────────────────
  // The slice exists to answer this. Two drivers with identical execution,
  // differing only in NERVE: one spends boost the instant it has any, keeping
  // the beast at arm's length; the other hoards, lets it close, and spends only
  // to escape. If hoarding does not win, the economy is decoration.
  {
    const cliffAhead = (sim, maxAhead) => {
      const p = sim.player, ci0 = Math.floor(p.d / TUNING.TERRAIN.CHUNK_LEN);
      for (let c = ci0; c <= ci0 + 3; c++)
        for (const h of sim.terrain.heightsOf(c))
          if (h.type === FEATURE.CLIFF && h.d > p.d + 12 && h.d < p.d + maxAhead) return h;
      return null;
    };
    const style = (seed, nerve) => {
      const sim = new Sim(seed); sim.start(seed, null, 0);
      const input = emptyInput();
      let committed = false, wasAir = false;
      for (let i = 0; i < 60 * 600; i++) {
        const p = sim.player;
        const cliff = cliffAhead(sim, 95);
        const targetX = cliff ? cliff.x : sim.terrain.corridorX(p.d + 4);
        if (cliff && !p.airborne) committed = true;
        if (!p.airborne && wasAir) committed = false;
        wasAir = p.airborne;
        if (p.airborne) {
          const h = p.y - sim.terrain.heightAt(p.x, p.d);
          input.carve = (committed && h > 2.5 && p.spinTotal < Math.PI * 2) ? 1 : 0;
        } else input.carve = steerTo(sim, targetX);
        input.flip = 0; input.jump = false;
        input.boostHeld = nerve === 'brave'
          ? (sim.beast.gap < 14 && p.boostMeter > 10)
          : (p.boostMeter > 12);
        sim.step(input);
        if (sim.phase !== PHASE.RUNNING) break;
      }
      return sim.distance;
    };
    const med = (nerve) => {
      const ds = SEEDS.map((s) => style(s, nerve)).sort((a, b) => a - b);
      return ds[Math.floor(ds.length / 2)];
    };
    const timid = med('timid'), brave = med('brave');
    check('nerve pays: hoarding boost and spending it late beats spending it early',
      brave > timid * 1.15,
      `brave ${Math.round(brave)}m vs timid ${Math.round(timid)}m ` +
      `(${f2(brave / timid)}x) — same execution, different nerve`);
  }

  // ── Opening grace ──────────────────────────────────────────────────────
  {
    const survive = (grace) => {
      const ds = [];
      for (const seed of SEEDS) {
        const sim = new Sim(seed); sim.start(seed, null, grace);
        const input = emptyInput();
        // A struggling player: drifts well off the reserved line.
        for (let i = 0; i < 60 * 400; i++) {
          const p = sim.player;
          const cx = sim.terrain.corridorX(p.d + 4) + Math.sin(i * 0.013) * 7;
          const wantV = Math.max(-20, Math.min(20, (cx - p.x) * 2.5));
          const haveV = p.speed * Math.sin(p.heading);
          input.carve = p.airborne ? 0 : Math.max(-1, Math.min(1, (wantV - haveV) * 0.35));
          input.flip = 0; input.jump = false; input.boostHeld = false;
          sim.step(input);
          if (sim.phase !== PHASE.RUNNING) break;
        }
        ds.push(sim.distance);
      }
      ds.sort((a, b) => a - b);
      return ds[Math.floor(ds.length / 2)];
    };
    const raw = survive(0);
    const eased = survive(1);
    check('opening grace gives a struggling player room to find the game',
      eased > raw * 1.5,
      `a drifting player reaches ${Math.round(raw)}m cold vs ${Math.round(eased)}m ` +
      `with full grace (${f2(eased / raw)}x)`);
    // Grace has to actually end, and end completely.
    {
      const b = new (Object.getPrototypeOf(new Sim(1).beast)).constructor(1);
      b.grace = 1;
      const at = (t) => { b.t = t; return b.wakefulness(); };
      const before = at(TUNING.BEAST.GRACE_TIME - 1);
      const after = at(TUNING.BEAST.GRACE_TIME + 0.001);
      const later = at(TUNING.BEAST.GRACE_TIME * 4);
      check('grace wears off completely — it delays the beast, it does not defang it',
        after === 1 && later === 1 && before < 1,
        `wakefulness ${f2(before)} at ${TUNING.BEAST.GRACE_TIME - 1}s -> ` +
        `${after} from ${TUNING.BEAST.GRACE_TIME}s onward`);
    }
  }

  // Even with full grace, the run still has to end.
  {
    const perfect = run(SEEDS[6], 60 * 60 * 12, makeAutopilot({ mode: 'corridor' }));
    check('grace does not break "every run ends in death"',
      perfect.phase === PHASE.KILL || perfect.phase === PHASE.DEAD,
      `died at ${f2(perfect.distance)}m after ${f2(perfect.time)}s`);
  }

  // Rate limit: ambient pursuit can never teleport shut. The lunge is the one
  // sanctioned exception, and it is bounded and always telegraphed.
  {
    const sim = new Sim(SEEDS[7]); sim.start(SEEDS[7], null);
    const input = emptyInput();
    const ap = makeAutopilot();
    let worstAmbient = 0, worstLunge = 0, prev = sim.beast.gap;
    for (let i = 0; i < 60 * 120; i++) {
      const cmd = ap(sim);
      input.carve = cmd.carve;
      if (i % 300 === 0) sim.beast.registerMistake(3); // hammer it with mistakes
      const lungingBefore = sim.beast.lunge === 'strike';
      sim.step(input);
      const rate = (prev - sim.beast.gap) * 60;
      if (lungingBefore || sim.beast.lunge === 'strike') worstLunge = Math.max(worstLunge, rate);
      else worstAmbient = Math.max(worstAmbient, rate);
      prev = sim.beast.gap;
      if (sim.phase !== PHASE.RUNNING) break;
    }
    check('ambient pursuit never closes faster than CLOSE_RATE',
      worstAmbient <= TUNING.BEAST.CLOSE_RATE + 1e-6,
      `worst ${f2(worstAmbient)} m/s / limit ${TUNING.BEAST.CLOSE_RATE} m/s`);
    check('even a lunge stays inside CLOSE_RATE + LUNGE_RATE',
      worstLunge <= TUNING.BEAST.CLOSE_RATE + TUNING.BEAST.LUNGE_RATE + 1e-6,
      `worst lunge ${f2(worstLunge)} m/s / ceiling ` +
      `${TUNING.BEAST.CLOSE_RATE + TUNING.BEAST.LUNGE_RATE} m/s`);
  }

  // ── Overdrive shove: the change the whole design pass hangs on ──────────
  {
    const seed = SEEDS[0];
    // Measured from CLOSE range, which is the only place it matters: the gap
    // is ceilinged at MAX_GAP so a shove out at 60m has nowhere to go. That is
    // the intended shape — Overdrive is an escape, not a cruise control.
    const measure = (boost, startGap) => {
      const sim = new Sim(seed); sim.start(seed, null);
      const input = emptyInput();
      for (let i = 0; i < 60 * 6; i++) { input.carve = 0; sim.step(input); }
      sim.beast.gap = startGap;
      const before = sim.beast.gap;
      input.boostHeld = boost;
      for (let i = 0; i < 60; i++) {            // exactly one second
        sim.player.boostMeter = TUNING.BOOST.METER_MAX;  // hold it lit
        sim.step(input);
      }
      return sim.beast.gap - before;
    };
    const idle = measure(false, 20);
    const lit = measure(true, 20);
    check('Overdrive visibly shoves the beast back within 1s',
      lit >= TUNING.BEAST.OVERDRIVE_PUSH * 0.9 && lit >= idle * 2.5,
      `from 20m: +${f2(lit)}m in one second with Overdrive vs +${f2(idle)}m without ` +
      `— ${f2(lit / idle)}x, and visible the whole time`);
    check('the shove still respects the MAX_GAP dread ceiling',
      measure(true, TUNING.BEAST.MAX_GAP - 4) <= 4 + 1e-6,
      `pushing from ${TUNING.BEAST.MAX_GAP - 4}m gains at most ` +
      `${f2(measure(true, TUNING.BEAST.MAX_GAP - 4))}m — it can never outrun the roar`);
    check('the shove beats what the desired-gap system could ever do alone',
      TUNING.BEAST.OVERDRIVE_PUSH > TUNING.BEAST.OPEN_RATE * 2,
      `push ${TUNING.BEAST.OVERDRIVE_PUSH} m/s vs ambient open rate ` +
      `${TUNING.BEAST.OPEN_RATE} m/s`);
  }

  // ── The lunge is always telegraphed ────────────────────────────────────
  {
    const sim = new Sim(SEEDS[2]); sim.start(SEEDS[2], null);
    const input = emptyInput();
    const ap = makeAutopilot();
    let strikes = 0, unTelegraphed = 0, tellFrames = 0, prevState = 'idle';
    for (let i = 0; i < 60 * 300; i++) {
      input.carve = ap(sim).carve;
      sim.step(input);
      const st = sim.beast.lunge;
      if (st === 'tell') tellFrames++;
      if (st === 'strike' && prevState !== 'strike') {
        strikes++;
        // Every strike must be preceded by a full tell.
        if (tellFrames < Math.round(TUNING.BEAST.LUNGE_TELL * 60) - 1) unTelegraphed++;
        tellFrames = 0;
      }
      if (st === 'idle') tellFrames = 0;
      prevState = st;
      if (sim.phase !== PHASE.RUNNING) { sim.start(SEEDS[2], null); }
    }
    check('the beast lunges, and every lunge is telegraphed first',
      strikes > 3 && unTelegraphed === 0,
      `${strikes} lunges over 5 sim-minutes, ${unTelegraphed} without a tell ` +
      `(tell is ${TUNING.BEAST.LUNGE_TELL}s)`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// P4 — Loop + Ghosts
// ══════════════════════════════════════════════════════════════════════════
function P4() {
  head('P4 — Loop + Ghosts');

  const seed = SEEDS[0];

  // Record a run.
  const rec = run(seed, 60 * 45, makeAutopilot());
  rec.recorder.finish(rec.player);
  const data = rec.recorder.serialize({ seed, distance: rec.distance });

  {
    // Rate must be measured against the recorder's own span, not sim.time:
    // recording stops at death while the clock runs on through the kill cam.
    const n = data.s.length / 5;
    const span = data.s[(n - 1) * 5] / 100;
    const hz = (n - 1) / span;
    check('run recorded ghost samples at SAMPLE_HZ',
      n > 0 && data.s.length % 5 === 0 &&
      Math.abs(hz - TUNING.GHOST.SAMPLE_HZ) < 0.35,
      `${n} samples over ${f2(span)}s of skiing = ${f2(hz)}hz ` +
      `(target ${TUNING.GHOST.SAMPLE_HZ}hz)`);
  }

  const bytes = JSON.stringify(data).length;
  check('ghost payload is small enough for localStorage', bytes < 200000,
    `${(bytes / 1024).toFixed(1)} KB for a ${f2(rec.distance)}m run`);

  check('ghost data is seed-keyed and round-trips through JSON',
    JSON.parse(JSON.stringify(data)).seed === seed);

  // Playback determinism: same data, two players, identical poses.
  {
    const g1 = new GhostPlayer(JSON.parse(JSON.stringify(data)));
    const g2 = new GhostPlayer(JSON.parse(JSON.stringify(data)));
    let same = true, samples = 0;
    for (let i = 0; i < 60 * 50; i++) {
      g1.step(TUNING.SIM.DT); g2.step(TUNING.SIM.DT);
      if (g1.x !== g2.x || g1.y !== g2.y || g1.d !== g2.d) { same = false; break; }
      samples++;
    }
    check('ghost replays deterministically', same, `${samples} poses matched`);
  }

  // Playback alongside a live run must not perturb the live run at all.
  {
    const solo = run(seed, 60 * 40, makeAutopilot());
    const withGhost = run(seed, 60 * 40, makeAutopilot(), JSON.parse(JSON.stringify(data)));
    check('ghost playback does not perturb the live sim',
      JSON.stringify(solo.state()) === JSON.stringify(withGhost.state()),
      `both ended at ${f2(solo.distance)}m`);
    check('ghost was actually active during that run',
      withGhost.ghost.count > 0 && withGhost.ghost.d > 0,
      `ghost reached d=${f2(withGhost.ghost.d)}m`);
  }

  // Ghost tracks the recorded line rather than drifting.
  {
    const sim = new Sim(seed); sim.start(seed, JSON.parse(JSON.stringify(data)));
    const input = emptyInput();
    const ap = makeAutopilot();
    let worst = 0;
    for (let i = 0; i < 60 * 40; i++) {
      const cmd = ap(sim);
      input.carve = cmd.carve; input.flip = 0; input.jump = false; input.boostHeld = false;
      sim.step(input);
      if (sim.ghost.active && !sim.ghost.yanking) {
        worst = Math.max(worst, Math.abs(sim.ghost.d - sim.player.d));
      }
      if (sim.phase !== PHASE.RUNNING) break;
    }
    check('ghost re-skis the same line as the run that recorded it',
      worst < 3.0,
      `worst divergence from the live line: ${f2(worst)}m (same inputs, same seed)`);
  }

  // Fog-yank at the death point.
  {
    const g = new GhostPlayer(JSON.parse(JSON.stringify(data)));
    const endD = data.s[data.s.length - 2] / 10;
    let t = 0;
    while (!g.done && t < 200) { g.step(TUNING.SIM.DT); t += TUNING.SIM.DT; }
    check('ghost is yanked upslope into the fog at its death point',
      g.done && g.d < endD - TUNING.GHOST.YANK_DIST * 0.9 && g.opacity <= 0.001,
      `yanked ${f2(endD - g.d)}m upslope, faded to ${g.opacity.toFixed(3)}`);
  }

  // Restart cost — the "<2s to be skiing again" gate, sim side.
  {
    const sim = new Sim(seed);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 20; i++) sim.start(seed, JSON.parse(JSON.stringify(data)));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
    check('sim restart is effectively instant', ms < 60,
      `${ms.toFixed(2)} ms per restart (budget for the whole loop is 2000 ms)`);
  }

  // Daily seed stability.
  {
    const s1 = hashString(dailySeedString(new Date('2026-08-06T00:30:00')));
    const s2 = hashString(dailySeedString(new Date('2026-08-06T23:30:00')));
    const s3 = hashString(dailySeedString(new Date('2026-08-07T09:00:00')));
    check('daily seed is stable within a day and changes the next',
      s1 === s2 && s1 !== s3,
      `06th=${s1} 07th=${s3}`);
  }

  // Sim step budget — the headroom the 60fps gate actually depends on.
  {
    const sim = new Sim(seed); sim.start(seed, JSON.parse(JSON.stringify(data)));
    const input = emptyInput();
    const ap = makeAutopilot();
    for (let i = 0; i < 600; i++) { input.carve = ap(sim).carve; sim.step(input); }
    const N = 6000;
    let live = 0;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) {
      // Keep the run alive: a dead sim short-circuits and would time nothing.
      sim.beast.gap = 60; sim.beast.mistakePressure = 0;
      input.carve = 0; sim.step(input); live++;
    }
    const us = Number(process.hrtime.bigint() - t0) / 1000 / live;
    check('sim step fits comfortably in a 60fps budget', us < 400,
      `${us.toFixed(1)} µs/step — ${(us / 16666 * 100).toFixed(2)}% of a 16.6 ms frame`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────
const which = (process.argv[2] || 'all').toLowerCase();
const phases = { p1: P1, p2: P2, p3: P3, p4: P4 };
console.log('\n\x1b[1mDESCENT — phase gate verification\x1b[0m');
console.log(`seed(daily 2026-08-06) = ${DAILY}`);

if (which === 'all') { P1(); P2(); P3(); P4(); }
else if (phases[which]) phases[which]();
else { console.error(`unknown phase "${which}" (use p1|p2|p3|p4|all)`); process.exit(2); }

console.log(results.join('\n'));
console.log(`\n${PASS} passed, ${FAIL} failed\n`);
process.exit(FAIL > 0 ? 1 : 0);
