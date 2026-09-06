/**
 * RC10.8 — `?profile=1`: what the road is doing, under the runner.
 *
 * A player reported the track dipping and there was no way to look. The route
 * gates walk `terrain.js` analytically and pass; the thing a player actually
 * sees is the MESH, built from `heightAt` per vertex, and nothing named the
 * two together. This names them, live, at the runner's own distance:
 *
 *   the segment type and how far into it we are
 *   grade, and how fast it is changing per metre
 *   roll (the segment bank) AND cross-slope (what heightAt actually renders)
 *   the mesh's own row-to-row reading, so an aliased join is visible as a gap
 *
 * A value over the RC8.2 ceiling is marked. That is the whole point: the bug
 * this was written for was a bound that fenced `rollAt` while the renderer
 * used `crossSlopeAt`, so the number everyone trusted was not the number
 * anyone saw.
 *
 * DEV ONLY, and off unless asked for by name. It is behind `?profile=1`, it is
 * loaded by dynamic import so it is not in the boot graph, and it draws into
 * its own corner element that takes no input. Nothing here is reachable from
 * a normal load and nothing in the game reads it.
 */

import TUNING from '../TUNING.js';

const RT = TUNING.TERRAIN.ROUTE;
/** The RC8.2 bounds, analytic: a smoothstep's peak gradient is 1.5/T of its jump. */
export const CEILING = {
  grade: (2 * RT.CREST_GRADE * 1.5) / RT.TRANS_M,
  roll: (RT.ROLL * 1.5) / RT.TRANS_M,
};
/** Mesh row spacing, mirrored from render/terrain-mesh.js. */
const MESH_ROW_M = TUNING.TERRAIN.CHUNK_LEN / 24;

const CSS = `
#profileOverlay{position:absolute;left:8px;bottom:calc(var(--safe-b) + 8px);z-index:88;
  pointer-events:none;font:600 10px/1.45 ui-monospace,monospace;color:#bfe8ff;
  background:rgba(4,8,14,.76);border:1px solid rgba(139,228,255,.24);border-radius:3px;
  padding:7px 9px;white-space:pre;text-shadow:0 1px 2px rgba(0,0,0,.8)}
#profileOverlay b{color:#8be4ff;font-weight:700}
#profileOverlay s{color:#ff7a7a;text-decoration:none;font-weight:700}
`;

const f = (n, p = 4) => (n < 0 ? '' : ' ') + n.toFixed(p);
const mark = (v, ceil) => (Math.abs(v) > ceil
  ? `<s>${f(v)} OVER ${(Math.abs(v) / ceil).toFixed(2)}x</s>` : f(v));

export class ProfileOverlay {
  constructor(terrain) {
    this.terrain = terrain;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.id = 'profileOverlay';
    this.el.setAttribute('aria-hidden', 'true');
    document.getElementById('app')?.appendChild(this.el);
    this._acc = 0;
  }

  /** Once a frame; redraws a few times a second, because it is text. */
  update(d, dt = 0) {
    this._acc += dt;
    if (this._acc < 0.12) return;
    this._acc = 0;
    const t = this.terrain;
    const seg = t.routeSegments(d + 1).filter((s) => s.d0 <= d).pop();
    const H = 0.5;
    // Analytic rates, as the gate walks them.
    const dGrade = (t.gradeAt(d + H) - t.gradeAt(d - H)) / (2 * H);
    const dRoll = (t.rollAt(d + H) - t.rollAt(d - H)) / (2 * H);
    const dCross = (t.crossSlopeAt(d + H) - t.crossSlopeAt(d - H)) / (2 * H);
    // And what the MESH shows: the flat quad between two rows.
    const r0 = Math.floor(d / MESH_ROW_M) * MESH_ROW_M;
    const yAt = (dd) => t.heightAt(t.corridorX(dd), dd);
    const meshGrade = (yAt(r0 + MESH_ROW_M) - yAt(r0)) / MESH_ROW_M;
    const gap = Math.abs(yAt(r0 + MESH_ROW_M / 2)
      - (yAt(r0) + yAt(r0 + MESH_ROW_M)) / 2);

    this.el.innerHTML =
      `<b>${(seg?.type || '?').padEnd(13)}</b>${(d - (seg?.d0 ?? 0)).toFixed(0)}m of ${(seg?.len ?? 0).toFixed(0)}m\n`
      + `d        ${d.toFixed(1)}m   elev ${f(t.elevAt(d), 2)}m\n`
      + `grade    ${f(t.gradeAt(d))}   d/dm ${mark(dGrade, CEILING.grade)}\n`
      + `roll     ${f(t.rollAt(d))}   d/dm ${mark(dRoll, CEILING.roll)}\n`
      + `cross    ${f(t.crossSlopeAt(d))}   d/dm ${mark(dCross, CEILING.roll)}\n`
      + `mesh     grade ${f(meshGrade)}   gap ${(gap * 100).toFixed(1)}cm`;
  }
}

export default ProfileOverlay;
