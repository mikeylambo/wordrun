/**
 * RC11 — what the rails are actually doing, in world units.
 *
 * The rails were never geometry. They were a smoothstep on the terrain
 * shader's `lane` attribute (`abs(vP4Lane)` between 0.8 and 0.97), painted
 * flat on the ribbon, so everything a rail is supposed to have — a thickness,
 * a stand-off from the edge, a height, a line of its own — was implied by a
 * gradient over a vertex attribute rather than stated anywhere.
 *
 * This walks the DAILY and three ENDLESS seeds at 0.25 m and prints, per rail:
 *
 *   offset  the gap between the rail and the ribbon edge, in track space
 *   thick   the rail's width in world units
 *   height  how far it stands above the surface it rides
 *   angle   the heading change between consecutive rail segments, which is
 *           what creases when the line is sampled too coarsely
 *
 * Run:  node dev/measure-rails.mjs [--before]
 *
 * `--before` measures the painted band the geometry replaced, so the two
 * readings in RELEASE come from one script rather than from memory.
 */

import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { hashString, dailySeedString } from '../src/sim/rng.js';

const R = TUNING.RUN;
const T = TUNING.TERRAIN;
const BEFORE = process.argv.includes('--before');

// The mesh's own row spacing — the density a surface-painted rail inherits.
const MESH_ROWS_PER_CHUNK = 24;
const MESH_ROW_M = T.CHUNK_LEN / MESH_ROWS_PER_CHUNK;

// The painted band, read off material-pass.js: smoothstep(0.8, 0.97, |lane|)
// over a ribbon of half-width TRACK_HALF_W.
const BAND_IN = 0.80, BAND_OUT = 0.97;

const SEEDS = [
  ['DAILY', hashString(dailySeedString(new Date())) >>> 0],
  ['ENDLESS a', hashString('rc11-a') >>> 0],
  ['ENDLESS b', hashString('rc11-b') >>> 0],
  ['ENDLESS c', hashString('rc11-c') >>> 0],
];

const SPAN = 12000;

/** Where a rail's centreline sits in world space at distance d. */
function railPoint(t, d, side, cfg) {
  const cx = t.corridorX(d);
  const x = cx + side * (R.TRACK_HALF_W - cfg.inset);
  return { x, y: t.heightAt(x, d) + cfg.height, d };
}

function walk(name, seed, cfg) {
  const t = new Terrain(seed);
  const rows = [];
  for (const side of [-1, 1]) {
    let worstOffset = 0, bestOffset = Infinity;
    let worstThick = 0, bestThick = Infinity;
    let worstHeight = 0, bestHeight = Infinity;
    let worstAngle = 0, angleAt = 0;
    let prev = null, prevHeading = null;
    for (let d = 0; d < SPAN; d += cfg.step) {
      const cx = t.corridorX(d);
      const edgeX = cx + side * R.TRACK_HALF_W;
      const p = railPoint(t, d, side, cfg);
      // Offset from the ribbon edge, in track space.
      const off = Math.abs(edgeX - p.x);
      worstOffset = Math.max(worstOffset, off); bestOffset = Math.min(bestOffset, off);
      // Thickness and height, in world units, at this sample.
      worstThick = Math.max(worstThick, cfg.thick); bestThick = Math.min(bestThick, cfg.thick);
      const h = p.y - t.heightAt(p.x, d);
      worstHeight = Math.max(worstHeight, h); bestHeight = Math.min(bestHeight, h);
      // Heading change between the segments the rail is actually built from,
      // which is the sampling step — not the 0.25 m this walk uses.
      if (d % cfg.step === 0 && prev) {
        const heading = Math.atan2(p.x - prev.x, cfg.step);
        if (prevHeading !== null) {
          const dA = Math.abs(heading - prevHeading);
          if (dA > worstAngle) { worstAngle = dA; angleAt = d; }
        }
        prevHeading = heading;
      }
      prev = p;
    }
    rows.push({ side: side < 0 ? 'L' : 'R', worstOffset, bestOffset,
      worstThick, bestThick, worstHeight, bestHeight, worstAngle, angleAt });
  }
  return { name, seed, rows };
}

const cfg = BEFORE
  // The painted band: its outer limit is the visible rail edge, its span the
  // thickness, and it lies ON the surface, sampled at the mesh's own rows.
  ? { label: 'painted band (shader smoothstep on `lane`)',
      inset: (1 - (BAND_IN + BAND_OUT) / 2) * R.TRACK_HALF_W,
      thick: (BAND_OUT - BAND_IN) * R.TRACK_HALF_W,
      height: 0, step: MESH_ROW_M }
  : await (async () => {
      const M = await import('../src/render/rails.js');
      return { label: 'rail geometry (render/rails.js)',
        inset: M.RAIL.INSET_M, thick: M.RAIL.WIDTH_M,
        height: M.RAIL.HEIGHT_M, step: M.RAIL.STEP_M };
    })();

console.log(`RC11 rails — ${cfg.label}`);
console.log(`  ribbon half-width ${R.TRACK_HALF_W} m · mesh rows every ${MESH_ROW_M} m · ` +
  `rail segments every ${cfg.step} m (${(MESH_ROW_M / cfg.step).toFixed(1)}x the mesh)\n`);
console.log('  seed          rail | offset from edge (m) |  thickness (m) |   height (m) | worst segment angle');
for (const [name, seed] of SEEDS) {
  const r = walk(name, seed, cfg);
  for (const row of r.rows) {
    const off = row.bestOffset === row.worstOffset
      ? row.worstOffset.toFixed(4) : `${row.bestOffset.toFixed(4)}..${row.worstOffset.toFixed(4)}`;
    const th = row.bestThick === row.worstThick
      ? row.worstThick.toFixed(4) : `${row.bestThick.toFixed(4)}..${row.worstThick.toFixed(4)}`;
    const hh = row.bestHeight === row.worstHeight
      ? row.worstHeight.toFixed(4) : `${row.bestHeight.toFixed(4)}..${row.worstHeight.toFixed(4)}`;
    console.log(`  ${name.padEnd(10)} ${row.side.padEnd(4)} | ${off.padStart(20)} | ${th.padStart(14)} | ` +
      `${hh.padStart(12)} | ${(row.worstAngle * 1000).toFixed(3)} mrad @${row.angleAt.toFixed(0)}m`);
  }
}
