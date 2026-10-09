/**
 * The run's settlement — what a finished run pays into the player's record.
 *
 * Lifetime stats, the reading curve, the ◆ balance (one per correct read plus
 * chain milestones), the daily streak, medals and the objective queue: every
 * ledger a run feeds, in the order they must be judged (the streak before the
 * medals and objectives that read it). It was the middle third of
 * finalizeRun; main.js still owns the run's own record and the results card,
 * and calls this once per finished run.
 *
 * `app` carries the ledgers; `r` is the finished run.
 */

import TUNING from '../TUNING.js';
import { Storage } from '../storage/storage.js';
import { currencyForRun } from '../meta/currency.js';
import { newlyEarned, medalById } from '../meta/medals.js';
import { rankFor } from '../ui/results-motion.js';

export function settleRun(app, r) {
  const { metaStats, curve, metaDaily, DAILY_SEED, learn, mastery, nemesis, metaObjectives } = app;
  const { sim, wg, run, distance, finalScore, runMode, runContinued, hiPlace } = r;
  metaStats.increment('metres', Math.floor(distance));
  metaStats.increment('correct', wg.correctCount);
  metaStats.increment('wrong', wg.wrongCount);
  metaStats.increment('falseTaps', wg.falseTaps);
  metaStats.increment('missedReals', wg.missedReals);
  // Phase B: how fast the reading was, not just how right. Milliseconds, so
  // the lifetime average survives as an integer ledger.
  const avgReadMs = wg.readCount > 0 ? Math.round((wg.latencySum / wg.readCount) * 1000) : 0;
  const bestReadMs = wg.bestLatency != null ? Math.round(wg.bestLatency * 1000) : 0;
  if (wg.readCount > 0) {
    metaStats.increment('readMsTotal', avgReadMs * wg.readCount);
    metaStats.increment('reads', wg.readCount);
    if (bestReadMs > 0) metaStats.min?.('bestReadMs', bestReadMs);
  }
  metaStats.max('bestChain', sim.player.bestChain);
  metaStats.max('bestDistance', Math.floor(distance));
  metaStats.max('bestScore', finalScore);
  // The personal curve: what this run says about the reading, not the score.
  curve.addRun({
    perTier: run.tierTally, avgReadMs, reads: wg.readCount,
    retired: run.retiredThisRun.length,
  });
  // RC14.1: the READS bank the spendable balance — one ◆ per correct read and
  // a bonus at each chain milestone reached (META.CURRENCY). It replaced the
  // bells, which paid ~1.3 ◆ per read on a schedule nobody chose.
  const banked = currencyForRun({ correct: wg.correctCount, bestChain: sim.player.bestChain });
  if (banked > 0) metaStats.increment('currency', banked);
  const dailyCard = metaDaily.recordRun(DAILY_SEED, {
    distance, bestChain: sim.player.bestChain, correct: wg.correctCount,
  });
  // RC9.4: a finished DAILY RUN retires its own explanation. It is written
  // here rather than at the start of one, because a run abandoned on the
  // title has not taught anybody what the mode is.
  if (runMode === 'standard') learn('Daily');
  // RC13.8 — medals: this run's feats plus the lifetime figures, judged once.
  const medalIds = newlyEarned({
    bestChain: sim.player.bestChain, perfects: run.perfectsThisRun,
    rank: rankFor({ correct: wg.correctCount, wrong: wg.wrongCount, perfects: run.perfectsThisRun }),
    score: finalScore, continued: runContinued, madeTable: hiPlace > 0,
    finished: !!sim.escaped || !!sim.routeFinished, wrong: wg.wrongCount,
  }, { streak: dailyCard?.streak || 0, learned: mastery.count, beaten: nemesis.retiredCount },
  Storage.medals());
  if (medalIds.length) Storage.addMedals(medalIds);
  const medalsWon = medalIds.map((id) => {
    const m = medalById(id);
    const lit = m.unlocks && TUNING.META.COSMETICS.find((c) => c.id === m.unlocks);
    return lit ? `${m.label} · ${lit.label} LIT` : m.label;
  });
  // The rotating queue (Phase 21). Only the three LIVE objectives are judged
  // against this run — anything still in the queue gets no credit for a run
  // that would have satisfied it, so one exceptional run cannot front-load
  // months of progression. Rewards are currency, which is the cosmetic path;
  // nothing here touches gameplay power.
  const objectives = metaObjectives.recordRun({
    distance,
    wrong: wg.wrongCount,
    falseTaps: wg.falseTaps,
    correct: wg.correctCount,
    bestChain: sim.player.bestChain,
    chainMetres: sim.chainMetres || 0,
    streak: dailyCard.streak,
    dashMeterSpent: sim.player.boostSpent,
  });
  if (objectives.reward > 0) metaStats.increment('currency', objectives.reward);
  return { avgReadMs, bestReadMs, banked, dailyCard, medalsWon, objectives };
}

export default settleRun;
