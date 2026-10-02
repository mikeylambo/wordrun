/**
 * The DAILY RUN as a few lines of text — the result you paste into a group
 * chat, readable without opening anything.
 *
 * Ten squares for the route's hundred words, one per ten: clean, one miss,
 * two or more, or not reached. It says HOW the run went and where it went
 * wrong without saying a single word on the route — the course is the same
 * for everyone today, and a share must not spoil it. It is plain text: no
 * image, no request, nothing for `audit:network` to see.
 *
 * Pure: the trail in, a string out. main.js keeps the trail; ui/share.js
 * puts the text in front of the link.
 */

export const GRID = Object.freeze({
  CLEAN: '🟩',
  ONE: '🟨',
  MORE: '🟧',
  UNREACHED: '⬛',
});

/**
 * @param {object} run
 * @param {Array<0|1|undefined>} run.trail  per-gate outcome by gate index —
 *   1 read right, 0 read wrong, undefined never resolved.
 * @param {number} run.gates   the route's length (TUNING.MODES.RULES.standard.GATES).
 * @param {number} run.score   the banked score.
 * @param {boolean} run.finished  reached the end of the route.
 * @param {string} run.seedString  the day, as the DAILY RUN names it.
 * @returns {string} three lines, or '' when there is no route to describe.
 */
export function shareGrid({ trail = [], gates = 0, score = 0, finished = false, seedString = '' } = {}) {
  if (!(gates > 0)) return '';
  const per = Math.max(1, Math.ceil(gates / 10));
  const squares = [];
  let read = 0;
  for (let s = 0; s < gates; s += per) {
    let resolved = 0;
    let wrong = 0;
    for (let i = s; i < Math.min(gates, s + per); i++) {
      if (trail[i] === undefined) continue;
      resolved++;
      if (!trail[i]) wrong++;
    }
    read += resolved;
    squares.push(resolved === 0 ? GRID.UNREACHED
      : wrong === 0 ? GRID.CLEAN : wrong === 1 ? GRID.ONE : GRID.MORE);
  }
  const right = trail.slice(0, gates).filter((v) => v === 1).length;
  const outcome = finished ? 'FINISH' : `RUN OVER AT ${read}/${gates}`;
  return [
    `DICTION DASH · DAILY RUN ${seedString}`.trim(),
    squares.join(''),
    `${outcome} · ${right}/${gates} RIGHT · ${Math.floor(score).toLocaleString('en-US')}`,
  ].join('\n');
}
