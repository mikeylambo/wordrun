/**
 * Editorial World layout (Phase M) — the page as pure geometry.
 *
 * The concept a human picked from the re-shot K stills, promoted: the world
 * beside the track is a manuscript being set as the player reads well.
 * Everything here is the PURE half — band arithmetic and instance layout as
 * plain numbers — so the gates drive the whole world in node: band rises and
 * falls, densities, positions, and the proof that no piece of page geometry
 * can ever cross the camera's sight line to a plate.
 *
 * Bands: five, keyed to the chain at the brief's thresholds. The world
 * REMEMBERS more than the chain does — crossing a threshold sets the band,
 * but a wrong read drops it by exactly ONE (the chain itself resets to
 * zero): one layer of the architecture falls per mistake, and the rest of
 * what you built stands until you climb past the next threshold again.
 * Band ids stay unnamed everywhere a player can read.
 *
 * Nothing in this file is a glyph. Every "line of type" is a bar; the
 * background is unreadable by construction and the word plate stays the
 * only text in the world (gated).
 */

export const BAND_CHAINS = [0, 25, 50, 100, 150];

/** The band the chain alone has earned. */
export function bandFor(chain) {
  let b = 0;
  for (let i = 1; i < BAND_CHAINS.length; i++) if ((chain || 0) >= BAND_CHAINS[i]) b = i;
  return b;
}

/** One step of the world's memory: rise with the chain, fall ONE on a wrong
 *  read. Pure — (state, chain, wrong) in, next state out. */
export function stepBand(state, chain, wrong) {
  const s = Math.max(0, Math.min(BAND_CHAINS.length - 1, state | 0));
  if (wrong) return Math.max(0, s - 1);
  return Math.max(s, bandFor(chain));
}

// Per band: how much of the page is set, and how bright the ink is.
export const FILL = [0.20, 0.36, 0.58, 0.82, 1.0];
export const INK = [0.42, 0.54, 0.70, 0.86, 1.0];

export const ROW_PITCH = 1.5;   // metres between lines of type
export const ROW_LEN = 0.55;    // depth of a line along the track
export const WINDOW_BACK = 40;  // metres of page behind the runner
export const WINDOW_AHEAD = 300;// metres of page ahead (past the fog wall)
export const REBUILD_AFTER = 90;// metres of travel before the page is re-laid
export const MARGIN = 2.4;      // metres beyond the track edge to the first rule

// Instance caps — seven draw calls, bounded however long the run gets.
export const CAPS = { rules: 420, type: 1400, stops: 40, dashes: 40, brackets: 120, caps: 12, arches: 150 };
// Phase L4: the narrows pull the margins in to this; everything else keeps
// MARGIN. The tunnel's crossbars clear the tallest sight line by metres —
// the occlusion gate proves it against every armed frame anyway.
export const NARROW_MARGIN = 1.2;
export const ARCH_CLEAR = 12;

// Deterministic per-row hash so the same row keeps its shape across rebuilds.
export function h32(n) {
  let x = Math.imul(n | 0, 0x9e3779b1) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Lay the page for [d0-WINDOW_BACK, d0+WINDOW_AHEAD] at a band level.
 * `terrain` supplies corridorX/heightAt so every mark rides the routed
 * surface — the page climbs the banks and folds over the crests.
 * `halfW` is the track half-width the margins are set from.
 *
 * Returns plain arrays of [x, y, negZ, sx, sy, sz] per instance kind.
 */
export function layoutPage(terrain, d0, level, halfW) {
  const HW = halfW;
  const fill = FILL[level];
  const line = (d) => terrain.corridorX(d);
  const ground = (x, d) => terrain.heightAt(x, d);
  const seg = (d) => (terrain.segTypeAt ? terrain.segTypeAt(d) : 'straight');
  const dA = Math.floor((d0 - WINDOW_BACK) / ROW_PITCH) * ROW_PITCH;
  const dB = d0 + WINDOW_AHEAD;

  const out = { rules: [], type: [], stops: [], dashes: [], brackets: [], caps: [], arches: [] };

  // Margin rules: one hairline each side at every band; a second past the
  // mid bands, a third at the full page. Segments of 6 m follow the winding.
  // Phase L4: a drop span draws NOTHING (the world empties to you and the
  // words); the narrows pull the margin in and double the rules.
  const ruleCount = level >= 4 ? 3 : level >= 2 ? 2 : 1;
  for (let d = dA; d < dB && out.rules.length < CAPS.rules; d += 6) {
    const st = seg(d + 3);
    if (st === 'drop') continue;
    const margin = st === 'narrows' ? NARROW_MARGIN : MARGIN;
    const rows = st === 'narrows' ? ruleCount + 1 : ruleCount;
    for (const side of [-1, 1]) {
      for (let k = 0; k < rows; k++) {
        if (out.rules.length >= CAPS.rules) break;
        const off = HW + margin + k * 0.55;
        const x = line(d + 3) + side * off;
        out.rules.push([x, ground(x, d + 3) + 0.05, -(d + 3), 0.07, 0.06, 6.0]);
      }
    }
  }

  // Greeked type: rows of bars flowing outward from the inner margin.
  // A paragraph ends on a short line and leaves a blank one; the full page
  // justifies every other line, the manuscript leaves them ragged.
  // Phase L4: inside a canyon the type stands up — the same rows become
  // walls of set text, the page as architecture at reading height.
  const columns = level >= 3 ? 2 : 1;
  const colW = level >= 2 ? 11 : 8.5;
  for (let d = dA, row = Math.round(dA / ROW_PITCH); d < dB; d += ROW_PITCH, row++) {
    const st = seg(d);
    if (st === 'drop') continue;
    const margin = st === 'narrows' ? NARROW_MARGIN : MARGIN;
    for (const side of [-1, 1]) {
      for (let c = 0; c < columns; c++) {
        if (out.type.length >= CAPS.type) break;
        const key = row * 4 + (side + 1) + c * 7919;
        const prevEnd = h32((row - 1) * 4 + (side + 1) + c * 7919 + 11) < 0.15;
        if (prevEnd) continue;                       // blank line after a paragraph
        if (h32(key) > fill) continue;               // unset at this band
        const end = h32(key + 11) < 0.15;
        const ragged = level >= 4 ? 1 : 0.55 + 0.45 * h32(key + 23);
        const w = colW * (end ? 0.3 + 0.4 * h32(key + 5) : ragged);
        const inner = HW + margin + 1.8 + c * (colW + 2.2);
        const x = line(d) + side * (inner + w / 2);
        if (st === 'canyon') {
          const wallH = 4.5 + fill * 7 * h32(key + 41);
          out.type.push([x, ground(x, d) + wallH / 2, -d, w, wallH, ROW_LEN]);
        } else {
          out.type.push([x, ground(x, d) + 0.05, -d, w, 0.08, ROW_LEN]);
        }
      }
    }
  }

  // Phase L4 — the tunnel: brackets grown to arches, an overhead crossbar
  // every 9 m at ARCH_CLEAR metres, far above any camera→plate sight line.
  for (let d = Math.ceil(dA / 9) * 9; d < dB && out.arches.length < CAPS.arches - 2; d += 9) {
    if (seg(d) !== 'tunnel') continue;
    const cx = line(d);
    const gy = ground(cx, d);
    for (const side of [-1, 1]) {
      out.arches.push([cx + side * (HW + 1.5), gy + ARCH_CLEAR / 2, -d, 0.25, ARCH_CLEAR, 0.25]);
    }
    out.arches.push([cx, gy + ARCH_CLEAR + 0.15, -d, (HW + 1.5) * 2, 0.3, 0.25]);
  }

  // Punctuation as sculpture, densifying by band.
  if (level >= 1) {
    for (let d = Math.ceil(dA / 36) * 36; d < dB && out.stops.length < CAPS.stops; d += 36) {
      if (seg(d) === 'drop') continue;
      const side = (Math.round(d / 36) % 2) ? 1 : -1;
      const x = line(d) + side * (HW + 3.3);
      out.stops.push([x, ground(x, d) + 0.6, -d, 1.0, 1.0, 1.0]);
    }
  }
  if (level >= 2) {
    for (let d = Math.ceil(dA / 54) * 54 + 18; d < dB && out.dashes.length < CAPS.dashes; d += 54) {
      if (seg(d) === 'drop') continue;
      for (const side of [-1, 1]) {
        if (out.dashes.length >= CAPS.dashes) break;
        const x = line(d) + side * (HW + 6.5);
        out.dashes.push([x, ground(x, d) + 2.4, -d, 0.14, 0.32, 3.0]);
      }
    }
  }
  if (level >= 3) {
    for (let d = Math.ceil(dA / 27) * 27; d < dB && out.brackets.length < CAPS.brackets - 2; d += 27) {
      if (seg(d) === 'drop') continue;
      for (const side of [-1, 1]) {
        if (out.brackets.length >= CAPS.brackets - 2) break;
        const x = line(d) + side * (HW + 3.6);
        const gy = ground(x, d);
        // A bracket: the upright, and a return at each end toward the track.
        out.brackets.push([x, gy + 2.3, -d, 0.16, 4.6, 0.16]);
        out.brackets.push([x - side * 0.4, gy + 4.55, -d, 0.95, 0.14, 0.16]);
        out.brackets.push([x - side * 0.4, gy + 0.09, -d, 0.95, 0.14, 0.16]);
      }
    }
  }
  if (level >= 4) {
    for (let d = Math.ceil(dA / 72) * 72 + 30; d < dB && out.caps.length < CAPS.caps; d += 72) {
      if (seg(d) === 'drop') continue;
      const side = (Math.round(d / 72) % 2) ? -1 : 1;
      const x = line(d) + side * (HW + 10.5);
      out.caps.push([x, ground(x, d) + 1.1, -d, 2.2, 2.2, 2.2]);
    }
  }
  return out;
}

/**
 * The Redline's editorial correction (Phase M): as the gap closes, red
 * strikethrough bars land across the nearest greeked lines — the editor
 * catching the manuscript. Density is the corruption intensity the sim
 * already owns; positions are deterministic per row. Pure: intensity and
 * the player's d in, instances out. The bars live in the MARGINS, outside
 * every camera→plate sight line (gated with the rest of the page).
 */
export const CORRECTION_CAP = 24;
export function layoutCorrections(terrain, playerD, intensity, halfW) {
  const n = Math.round(Math.max(0, Math.min(1, intensity)) * CORRECTION_CAP);
  const out = [];
  const line = (d) => terrain.corridorX(d);
  for (let i = 0; i < n; i++) {
    // Struck rows cluster just ahead of the runner, where the eye is.
    const d = playerD - 6 + h32(i * 131 + Math.floor(playerD / 9)) * 42;
    const st = terrain.segTypeAt ? terrain.segTypeAt(d) : 'straight';
    if (st === 'drop') continue; // nothing to strike through in the void
    const margin = st === 'narrows' ? NARROW_MARGIN : MARGIN;
    const side = h32(i * 613) < 0.5 ? -1 : 1;
    const w = 5 + h32(i * 271) * 5;
    const x = line(d) + side * (halfW + margin + 1.8 + w / 2);
    out.push([x, terrain.heightAt(x, d) + 0.16, -d, w, 0.1, 0.22]);
  }
  return out;
}
