/**
 * Numbers that always fit.
 *
 * A score is the one string in this game whose LENGTH is written by the player.
 * "1,172" and "12,409,931" are the same readout at five glyphs and ten, and a
 * font-size chosen for one clips the other — which is exactly what shipped: on
 * a 1280x800 desktop the results headline renders at 118px inside a 295px
 * cabinet card, so a seven-figure score measured 540px and left 98px of itself
 * off the screen. The player saw "L70,820".
 *
 * Two things caused that and only one of them was the number:
 *
 *   1. `#deathScreen.rc2Poster .big` was sized in `vw` — the WINDOW's width.
 *      Inside the cabinet frame the play area is a narrow strip in a wide
 *      window, so `vw` sizes type against a rectangle the type does not live
 *      in. (Fixed at the source: those rules read `cqw` now, which resolves to
 *      the container inside the frame and to the viewport outside it.)
 *   2. Even correctly sized, a long enough number overruns its card.
 *
 * This fixes (2), and does it by MEASURING rather than by guessing a glyph
 * advance: the game is about to change its face, and a ratio pinned to the
 * current one would quietly stop being true. Measurement costs a Range rect at
 * the moments a number is written — never per frame.
 *
 * It only ever shrinks. A readout that fits is left exactly as the stylesheet
 * drew it, so the design's sizes still own every ordinary case and this is the
 * floor under the extraordinary one.
 */

/** Below this the number stops being a headline, so it stops shrinking. */
const MIN_PX = 20;

/** A pixel of air: a readout that ends exactly on the boundary reads clipped. */
const SAFETY_PX = 1;

const range = typeof document !== 'undefined' ? document.createRange() : null;

/** The width of the text itself — not the block, which shrink-wraps or spans. */
function textWidth(el) {
  if (!range) return 0;
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
}

/**
 * Shrink `el`'s type until its text fits `avail` px.
 * @param {HTMLElement} el     the readout
 * @param {number} box         the width it must live inside
 * @param {number} [minPx]     the size below which it stops shrinking
 * @returns {number} the size in use, or 0 if nothing was measurable
 */
export function fitNumber(el, box, minPx = MIN_PX) {
  const avail = box - SAFETY_PX;
  if (!el || !range || !(avail > 0)) return 0;
  el.style.fontSize = '';                       // back to the stylesheet's intent
  const base = parseFloat(getComputedStyle(el).fontSize) || 0;
  if (!base) return 0;
  let w = textWidth(el);
  if (!(w > avail)) return base;                // fits: leave the design alone
  let px = Math.max(minPx, Math.floor(base * (avail / w)));
  el.style.fontSize = `${px}px`;
  // Type does not scale perfectly linearly — hinting and letter-spacing round
  // against you — and a headline two pixels too wide still clips. Correct down
  // from the estimate, which lands in one or two steps.
  for (let i = 0; i < 8 && px > minPx && textWidth(el) > avail; i++) {
    px = Math.max(minPx, px - Math.max(1, Math.round(px * 0.02)));
    el.style.fontSize = `${px}px`;
  }
  return px;
}

/** The content box of `el`'s parent — the card or row the number sits in. */
export function parentBox(el) {
  const p = el?.parentElement;
  if (!p) return 0;
  const cs = getComputedStyle(p);
  return p.getBoundingClientRect().width
    - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
}

/**
 * From a left-aligned readout's own left edge to the play area's right edge.
 * The HUD score is not centred in a card; what it must not do is run past the
 * frame, and its parent row shrink-wraps, so the parent cannot say that.
 */
export function runwayToEdge(el, padPx = 12) {
  const app = document.getElementById('app');
  if (!el || !app) return 0;
  return app.getBoundingClientRect().right - el.getBoundingClientRect().left - padPx;
}
