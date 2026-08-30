/**
 * Run-stats export (Phase 21) — the calibration verdicts' only data path.
 *
 * The build is intentionally zero-network for Playables, so there is no
 * telemetry from anyone but the developer's own keyboard. The calibration
 * questions on the roadmap — is the speed ceiling ever approached, does the
 * drain bite, is HARD's pace fair — all want real-run numbers from real
 * players. This turns the local ledger into a blob someone can paste back by
 * hand, with the dials that were in force alongside the numbers so the
 * numbers can actually be read.
 *
 * Pure: no DOM, no storage, no clock of its own. Everything arrives as an
 * argument, which is what makes it gate-testable.
 *
 * Privacy: lifetime counters, the run just played, the settings in force and
 * the tuning constants. No identifiers, no free text, nothing typed by the
 * player. The daily seed is a calendar date, and it is what makes two
 * players' numbers comparable at all.
 */

export const EXPORT_VERSION = 1;

const n = (v, dp = 0) => (Number.isFinite(+v) ? +(+v).toFixed(dp) : null);

/**
 * @param {object} o
 * @param {object} o.stats     StatsManager.snapshot()
 * @param {object} [o.daily]   DailyManager.status()
 * @param {object} [o.run]     the run just finished
 * @param {object} o.tuning    TUNING
 * @param {object} [o.access]  ACCESS
 * @param {string} [o.seed]    the daily seed string (a date)
 * @param {string} [o.at]      ISO timestamp; injectable so tools are stable
 */
export function buildStatsExport({ stats = {}, daily, run, tuning, access, seed, at } = {}) {
  const R = tuning?.RUN ?? {};
  const B = tuning?.BOOST ?? {};
  const pace = tuning?.MODES?.DIFFICULTY?.[run?.difficulty]?.REDLINE_PACE
    ?? tuning?.RUN?.REDLINE_PACE ?? null;

  const read = (stats.correct || 0) + (stats.wrong || 0);

  return {
    v: EXPORT_VERSION,
    game: 'DICTION DASH',
    at: at ?? new Date().toISOString(),
    seed: seed ?? null,

    // What the player has done, ever.
    lifetime: {
      runs: n(stats.runs),
      metres: n(stats.metres),
      reads: read,
      correct: n(stats.correct),
      wrong: n(stats.wrong),
      accuracy: read > 0 ? n((stats.correct || 0) / read * 100, 1) : null,
      // The two failure modes are not the same mistake and must not be
      // averaged: tapping a fake costs a heart, missing a real costs speed.
      falseTaps: n(stats.falseTaps),
      missedReals: n(stats.missedReals),
      bestChain: n(stats.bestChain),
      bestDistance: n(stats.bestDistance),
      currency: n(stats.currency),
    },

    daily: daily ? { streak: n(daily.streak), playedToday: !!daily.playedToday } : null,

    // The run this export was taken from — the calibration sample.
    run: run ? {
      distance: n(run.distance),
      seconds: n(run.seconds, 1),
      mode: run.mode ?? null,
      difficulty: run.difficulty ?? null,
      continued: !!run.continued,
      reads: (run.correct || 0) + (run.wrong || 0),
      correct: n(run.correct),
      wrong: n(run.wrong),
      falseTaps: n(run.falseTaps),
      missedReals: n(run.missedReals),
      bestChain: n(run.bestChain),
      // The ceiling question, directly: what speed did this run actually
      // reach, and where did it end up.
      peakSpeed: n(run.peakSpeed, 1),
      endSpeed: n(run.endSpeed, 1),
      // Meter units spent, not a count of firings: the drain rate is the
      // dial being calibrated, so units are the useful unit.
      dashMeterSpent: n(run.dashMeterSpent, 1),
      heartsLeft: n(run.heartsLeft),
      bells: n(run.bells),
      endGap: n(run.endGap, 1),
    } : null,

    // The dials in force. Without these the numbers above cannot be read —
    // a peak of 41 means one thing against a ceiling of 64 and another
    // against 48.
    tuning: {
      floor: n(R.FLOOR), ceiling: n(R.CEILING),
      gainMax: n(R.SPEED_GAIN_MAX, 2), loss: n(R.SPEED_LOSS, 2),
      redlinePace: n(pace, 2),
      meterMax: n(B.METER_MAX), minActivate: n(B.MIN_ACTIVATE),
      drainRate: n(B.DRAIN_RATE), dashMult: n(B.SPEED_MULT, 2),
    },

    // Settings change perceived difficulty, so a verdict needs them.
    access: access ? {
      reducedFlash: !!access.reducedFlash,
      readableType: !!access.readableType,
      colorVision: access.mode ?? access.colorVision ?? 'off',
    } : null,
  };
}

/** The blob a player pastes back. Stable key order, readable line width. */
export function formatStatsExport(payload) {
  return JSON.stringify(payload, null, 1);
}

export default buildStatsExport;
