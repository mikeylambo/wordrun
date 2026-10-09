/**
 * RC14.1 — what a run pays in ◆.
 *
 * One ◆ per correct read, and a bonus for each chain milestone the run's best
 * chain reached (TUNING.META.CURRENCY). Pure, so the gates can price runs in
 * node; main.js banks the result on the results card.
 */

import TUNING from '../TUNING.js';

export function currencyForRun({ correct = 0, bestChain = 0 } = {}) {
  const C = TUNING.META.CURRENCY;
  const reads = Math.max(0, Math.floor(correct)) * C.PER_READ;
  const bonus = C.CHAIN_BONUS.reduce((sum, [at, pay]) => sum + (bestChain >= at ? pay : 0), 0);
  return reads + bonus;
}

export default currencyForRun;
