/**
 * RC9.1 — one row of the review, as markup.
 *
 * The review is the one screen in this game that TEACHES rather than scores,
 * so its row is the thing most worth holding to a standard: a stranger has to
 * read it in one glance, and it has to be checkable that they can. This file
 * is pure — four strings in, one string out, no DOM and no storage — so the
 * gate suite drives the real renderer over the real word bank rather than
 * pattern-matching the source of a method it cannot call.
 *
 * Everything on the row already existed somewhere in the build. Nothing here
 * introduces data:
 *
 *   the pair      words/spelling-diff.js, over the fake the player was shown
 *   the meaning   words/definitions.js, built by tools/build-definitions.mjs
 *   the pips      words/danger.js, structural danger blended with the local
 *                 ledger's evidence for this player
 *   the line      meta/nemesis.js, when this row is a word just retired
 *
 * The colours are the semantic wrong/right pair, published to CSS by
 * ui/access.js for every colour-vision mode.
 */

import { defineWord } from '../words/definitions.js';
import { dangerFor, dangerBand } from '../words/danger.js';
import { diffSpelling } from '../words/spelling-diff.js';

const PIPS = { low: 1, mid: 2, high: 3 };

/** `pre<i class=…>mark</i>post` for one half of the pair. */
const span = (part, cls) => `${part.pre}<i class="${cls}">${part.mark}</i>${part.post}`;

/**
 * @param {object} o
 * @param {string} o.word            the TRUE spelling — every row carries it
 * @param {string} [o.shown]         the fake as it was shown, when there was one
 * @param {{a:number,m:number}} [o.evidence]  this player's ledger for the word
 * @param {{misses:number}} [o.retired]       set when the word was just beaten
 */
export function reviewRow({ word, shown = null, evidence = null, retired = null } = {}) {
  const real = String(word || '');
  if (!real) return '';
  const meaning = defineWord(real);
  // How hard this word is, as marks rather than a name — the same choice the
  // compression bar makes, and for the same reason. It answers the question a
  // review panel always raises: was that one on me, or is it just a horrible
  // word? Three pips means everybody struggles with it.
  const band = dangerBand(dangerFor(real, evidence));
  const pips = PIPS[band] ?? 1;
  const risk = `<span class="mRisk ${band}">${
    [0, 1, 2].map((i) => `<i${i < pips ? ' class="on"' : ''}></i>`).join('')}</span>`;

  // The edit itself, marked exactly. Every fake is one edit from its source,
  // so the letters that moved are known precisely rather than approximately —
  // a highlight over "the middle bit" is the version of this that teaches
  // nothing. A real word that simply slipped past has no fake to contrast,
  // so its row shows one spelling and says nothing unkind about the miss —
  // the absence of a struck word is the whole statement.
  const d = shown ? diffSpelling(shown, real) : null;
  const pair = d
    ? `<s class="mFake">${span(d.fake, 'x')}</s><b class="mReal">${span(d.real, 'o')}</b>`
    : `<b class="mReal">${real}</b>`;

  return `<div class="mRow${retired ? ' beaten' : ''}">`
    + `<div class="mPair">${pair}</div>${risk}`
    + (retired
      ? `<div class="mBeat">BEAT YOU ${retired.misses} TIME${retired.misses === 1 ? '' : 'S'} · GONE</div>`
      : '')
    + (meaning ? `<div class="mDef">${meaning}</div>` : '')
    + '</div>';
}

export default reviewRow;
