/**
 * Phrases (Phase L5+) — the level-design layer. An encounter director that
 * COMPOSES what already exists: it charts the SHAPE of a stretch of gates
 * (the real/fake pattern and the mutation family) and lets the seeded word
 * generator fill it under the frozen calibration. No new mechanic, no new
 * words machinery — a phrase is a bias applied to the coin and the family,
 * nothing else. Spacing, tiers, scoring and the windows are untouched.
 *
 * Two charts:
 *
 *   DAILY — one AUTHORED 100-gate arrangement, a pure function of the gate
 *   index alone: the same dramatic arc every day and on every retry, with
 *   the vocabulary changing under it (the daily salt touches words, never
 *   the course). This is what makes the DAILY learnable — "the vowel
 *   stretch always wrecks me", "I finally held the closing ten" — the way
 *   a rhythm chart or a time-trial course is learnable.
 *
 *   ENDLESS — a seeded no-repeat walk over the same phrase set, opening on
 *   the teaching-safe cadence, re-salted per attempt with the word lane.
 *
 * Deterministic and pure-in-(seed, index): random access is required (the
 * lookahead plates and every tool peek forward), so the endless walk is
 * memoized per seed and extended lazily, exactly like the tier starts.
 *
 * A phrase can only ever return `null` ("no opinion") or a boolean; the
 * shipped opening shaping in isRealGate still clamps whatever comes back,
 * so the first word stays real and the teaching window stays gentle.
 */

import { mulberry32, mixSeed } from './rng.js';

const PHRASE_STREAM = 0x706872; // 'phr' — its own rng lane

// A cheap pure hash for index-keyed jitter inside authored phrases.
function h32(n) {
  let x = Math.imul(n | 0, 0x9e3779b1) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * The phrase vocabulary. `real(i, jitter)` answers for local index i;
 * null means "use the shipped coin". `family` pins the mutation family
 * for the whole phrase (null = the shipped family walk). Fake densities
 * are chosen so a full chart averages near the shipped FAKE_CHANCE.
 */
export const PHRASE_TYPES = {
  // Establishing rhythm: mostly real, a fake on the offbeat.
  cadence: { len: 6, real: (i) => i % 3 !== 2 },
  // All real: the chain-rebuild breather after a hard stretch.
  breather: { len: 5, real: () => true },
  // Suspicion then relief: fakes in a row, then one plainly real word
  // that punishes autopilot rejection.
  fakerun: { len: 4, real: (i) => i === 3 },
  // Strict alternation: pure tempo.
  alternate: { len: 6, real: (i) => i % 2 === 0 },
  // The trap: one mutation family for the whole phrase, mixed pattern —
  // the player who names the family reads it; the one who pattern-matches
  // the previous answer bleeds.
  trap: { len: 5, real: (i, j) => (i + (j < 0.5 ? 0 : 1)) % 5 % 2 === 1 },
  // The shipped generator's own texture, so the charted game still
  // contains the un-charted one. ENDLESS only — inside the daily the coin
  // would leak the (salted) seed into the course shape.
  coin: { len: 8, real: () => null },
  // Organic-feeling but fully authored: the daily's "loose" stretches use
  // this so the course stays a pure function of the index — the jitter the
  // caller passes is index-derived on the daily chart.
  mixed: { len: 8, real: (i, j) => j < 0.5 },
  // The closing exam: dense, family walking pair by pair.
  exam: { len: 10, real: (i, j) => (i % 4 === 0) || (i % 4 === 3 && j < 0.35) },
};

/**
 * The DAILY course — one hundred gates, authored. Families are FIXED per
 * slot (the vowel stretch is always the vowel stretch); `f` indexes
 * MUTATION_FAMILIES: 0 transpose, 1 double, 2 drop, 3 vowel.
 */
export const DAILY_CHART = [
  { type: 'cadence' },              //  0– 5  opening, teaching-safe
  { type: 'mixed' },                //  6–13  loose texture, still authored
  { type: 'breather' },             // 14–18  cadence established, build
  { type: 'alternate' },            // 19–24  pure tempo
  { type: 'trap', f: 0 },           // 25–29  the transposition stretch
  { type: 'mixed' },                // 30–37
  { type: 'fakerun' },              // 38–41  autopilot punisher
  { type: 'breather' },             // 42–46
  { type: 'alternate' },            // 47–52
  { type: 'trap', f: 3 },           // 53–57  the vowel stretch
  { type: 'fakerun' },              // 58–61
  { type: 'mixed' },                // 62–69
  { type: 'breather' },             // 70–74  the last calm
  { type: 'trap', f: 1 },           // 75–79  the double-letter stretch
  { type: 'alternate' },            // 80–85
  { type: 'fakerun' },              // 86–89
  { type: 'exam', f: -1 },          // 90–99  the curated closing ten
];

// Precomputed starts; the chart must cover exactly the daily's 100 gates.
const DAILY_STARTS = [];
{
  let at = 0;
  for (const slot of DAILY_CHART) {
    DAILY_STARTS.push(at);
    at += PHRASE_TYPES[slot.type].len;
  }
  DAILY_STARTS.push(at); // 100, asserted by the phrase gates
}
export const DAILY_CHART_LEN = DAILY_STARTS[DAILY_STARTS.length - 1];

/** The exam walks the four families pair by pair — still fixed per index. */
const examFamily = (local) => Math.floor(local / 2) % 4;

// ── ENDLESS: a seeded no-repeat walk, memoized per seed ───────────────────
const ENDLESS_SET = ['cadence', 'breather', 'fakerun', 'alternate', 'trap', 'coin', 'coin'];
const walks = new Map(); // seed -> { slots: [{type, f, start}], end }

function endlessWalk(seed, untilIndex) {
  let w = walks.get(seed >>> 0);
  if (!w) {
    if (walks.size > 32) walks.clear();
    // Every run opens on the cadence: the teaching window stays gentle
    // whatever the walk draws afterwards.
    w = { rng: mulberry32(mixSeed(seed >>> 0, PHRASE_STREAM)), slots: [], end: 0, last: '' };
    w.slots.push({ type: 'cadence', f: -1, start: 0 });
    w.end = PHRASE_TYPES.cadence.len;
    w.last = 'cadence';
    walks.set(seed >>> 0, w);
  }
  while (w.end <= untilIndex) {
    let type = ENDLESS_SET[Math.floor(w.rng() * ENDLESS_SET.length)];
    if (type === w.last && type !== 'coin') type = 'coin'; // no-repeat walk
    const f = type === 'trap' ? Math.floor(w.rng() * 4) : -1;
    w.slots.push({ type, f, start: w.end });
    w.end += PHRASE_TYPES[type].len;
    w.last = type;
  }
  return w.slots;
}

/**
 * The phrase verdict for gate `index`: { real: boolean|null, family: int }
 * (family -1 = no pin). `chart` is 'daily' or anything else for endless.
 */
export function phraseAt(seed, index, chart) {
  if (chart === 'daily' && index < DAILY_CHART_LEN) {
    let s = DAILY_CHART.length - 1;
    while (DAILY_STARTS[s] > index) s--;
    const slot = DAILY_CHART[s];
    const t = PHRASE_TYPES[slot.type];
    const local = index - DAILY_STARTS[s];
    const family = slot.type === 'exam' ? examFamily(local) : (slot.f ?? -1);
    // Daily jitter is INDEX-pure: the course is the course, every day.
    return { real: t.real(local, h32(index)), family };
  }
  // Endless (and the daily past its route): the seeded walk.
  const slots = endlessWalk(seed, index);
  let lo = 0, hi = slots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (slots[mid].start <= index) lo = mid; else hi = mid - 1;
  }
  const slot = slots[lo];
  const t = PHRASE_TYPES[slot.type];
  const local = index - slot.start;
  return { real: t.real(local, h32(mixSeed(seed, index))), family: slot.f ?? -1 };
}
