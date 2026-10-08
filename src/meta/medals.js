/**
 * RC13.8 — medals.
 *
 * A wall of things a player has DONE, shown in PROFILE and awarded on the
 * results card the run they are earned. Every label is a functional
 * description of the feat ("CHAIN ×50", "RANK S"), never a name: the game's
 * four-name cap is a ceiling, and twenty medal titles would be twenty names.
 *
 * Two medals are also keys. RANK S lights the WHITE-HOT runner and a 7-DAY
 * STREAK lights CHROME — both achromatic, so neither can wear a hue the game
 * uses to mean something (TUNING.META.RESERVED_HUES), which is exactly why
 * the gold and violet a player might expect are not on the list.
 *
 * Pure: a run summary and the lifetime figures in, the newly earned ids out.
 * Storage keeps the earned set; the gates drive every rule in node.
 */

export const MEDALS = Object.freeze([
  // The run — reading
  { id: 'chain25', group: 'RUN', label: 'CHAIN ×25', test: (r) => r.bestChain >= 25 },
  { id: 'chain50', group: 'RUN', label: 'CHAIN ×50', test: (r) => r.bestChain >= 50 },
  { id: 'chain100', group: 'RUN', label: 'CHAIN ×100', test: (r) => r.bestChain >= 100 },
  { id: 'perfect10', group: 'RUN', label: '10 PERFECT', test: (r) => r.perfects >= 10 },
  { id: 'perfect30', group: 'RUN', label: '30 PERFECT', test: (r) => r.perfects >= 30 },
  { id: 'rankA', group: 'RUN', label: 'RANK A', test: (r) => r.rank === 'A' || r.rank === 'S' },
  { id: 'rankS', group: 'RUN', label: 'RANK S', test: (r) => r.rank === 'S', unlocks: 'whitehot' },
  // The run — score, unassisted only
  { id: 'score25k', group: 'SCORE', label: '25,000', test: (r) => !r.continued && r.score >= 25000 },
  { id: 'score100k', group: 'SCORE', label: '100,000', test: (r) => !r.continued && r.score >= 100000 },
  { id: 'score250k', group: 'SCORE', label: '250,000', test: (r) => !r.continued && r.score >= 250000 },
  { id: 'topTen', group: 'SCORE', label: 'TOP TEN', test: (r) => r.madeTable === true },
  // The route
  { id: 'routeDone', group: 'ROUTE', label: 'ROUTE FINISHED', test: (r) => r.finished === true },
  { id: 'routeClean', group: 'ROUTE', label: 'ROUTE · NO MISSES', test: (r) => r.finished === true && r.wrong === 0 },
  // The habit
  { id: 'streak3', group: 'DAYS', label: '3-DAY STREAK', test: (_, l) => l.streak >= 3 },
  { id: 'streak7', group: 'DAYS', label: '7-DAY STREAK', test: (_, l) => l.streak >= 7, unlocks: 'chrome' },
  { id: 'streak30', group: 'DAYS', label: '30-DAY STREAK', test: (_, l) => l.streak >= 30 },
  // The learning
  { id: 'learned100', group: 'WORDS', label: '100 LEARNED', test: (_, l) => l.learned >= 100 },
  { id: 'learned1000', group: 'WORDS', label: '1,000 LEARNED', test: (_, l) => l.learned >= 1000 },
  { id: 'beaten10', group: 'WORDS', label: '10 BEATEN', test: (_, l) => l.beaten >= 10 },
]);

export const GROUPS = Object.freeze(['RUN', 'SCORE', 'ROUTE', 'DAYS', 'WORDS']);

const RUN_DEFAULTS = { bestChain: 0, perfects: 0, rank: '', score: 0, continued: false,
  madeTable: false, finished: false, wrong: 0 };
const LIFE_DEFAULTS = { streak: 0, learned: 0, beaten: 0 };

/** The medals this run earns that `have` does not already hold, in list order. */
export function newlyEarned(run = {}, life = {}, have = []) {
  const r = { ...RUN_DEFAULTS, ...run };
  const l = { ...LIFE_DEFAULTS, ...life };
  const held = new Set(have);
  return MEDALS.filter((m) => !held.has(m.id) && m.test(r, l)).map((m) => m.id);
}

/** The cosmetic ids the held medals have unlocked. */
export function unlockedCosmetics(have = []) {
  const held = new Set(have);
  return MEDALS.filter((m) => m.unlocks && held.has(m.id)).map((m) => m.unlocks);
}

export const medalById = (id) => MEDALS.find((m) => m.id === id) || null;
