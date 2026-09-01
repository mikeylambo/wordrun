/**
 * WordGates — the DICTION DASH verb, as sim state. Deterministic, headless.
 *
 * A gate lives at a fixed downhill distance and shows one word, real or
 * faked. While the gate is armed (within ARM_DISTANCE_M) a confirm tap
 * locks in "that word is real". Crossing the gate line resolves it:
 *
 *   real  + confirmed  -> correct (gate bonus, chain link, boost fill)
 *   fake  + ignored    -> correct (same reward — a right read is a right read)
 *   fake  + confirmed  -> the hit (the DESCENT-equivalent obstacle hit: a
 *                                  heart, stagger, speed, chain, half meter)
 *   real  + ignored    -> a miss  (speed + chain only — no heart, no stagger)
 *
 * The asymmetry is the rulebook: hearts are spent only by ACTING wrongly
 * (tapping a fake). Letting a real word slip by is hesitation, not a crash —
 * it slows you, and a slow reader is the Redline's problem to punish, at
 * exactly the rate the speed differential dictates. Game over therefore
 * always arrives one of two legible ways: you tapped fakes until your hearts
 * ran out, or you read too slowly and the Redline closed the gap.
 *
 * Words, fakes and their order all derive from the run seed through the same
 * mixSeed/mulberry32 machinery the mountain uses, so a seed's gauntlet of
 * words is as replayable as its terrain — the ghost/daily-seed architecture
 * carries over untouched.
 */

import TUNING from '../TUNING.js';
import { mulberry32, mixSeed } from './rng.js';
import { pickWordCycle, makeFake, tierCount } from '../words/wordlist.js';

const W = TUNING.WORDS;
const R = TUNING.RUN;
const B = TUNING.BOOST;

const WORD_STREAM = 0x77_6f_72; // 'wor' — its own rng lane, apart from terrain

/** The default reading-difficulty profile — identical to the pre-mode game. */
export const DEFAULT_PROFILE = Object.freeze({
  TIER_MIN: 0,
  TIER_MAX: tierCount() - 1,
  TIER_EVERY_M: W.TIER_EVERY_M,
});

export function tierAt(d, prof = DEFAULT_PROFILE) {
  const t = prof.TIER_MIN + Math.floor(Math.max(0, d) / prof.TIER_EVERY_M);
  return Math.max(prof.TIER_MIN, Math.min(Math.min(prof.TIER_MAX, tierCount() - 1), t));
}

/**
 * Fresh words each attempt (Phase 9): the daily seed still authors the
 * TRACK, the bells and the fake/real coin structure — the shared racing
 * line — but the word rng lane is salted by the attempt number, so a
 * second run of the DAILY RUN reads new vocabulary on the same road.
 * Salt 0 is the identity (tools and ghosts replay exactly).
 */
export function wordSeedFor(seed, salt = 0) {
  return salt ? mixSeed(seed >>> 0, (0x73616c00 + (salt >>> 0)) >>> 0) : seed >>> 0;
}

const tierStarts = new Map();

/** First gate index whose distance reaches `tier` — memoized, monotonic. */
export function tierStartIndex(tier, prof = DEFAULT_PROFILE) {
  if (tier <= prof.TIER_MIN) return 0;
  const key = `${tier}:${prof.TIER_MIN}:${prof.TIER_MAX}:${prof.TIER_EVERY_M}`;
  if (tierStarts.has(key)) return tierStarts.get(key);
  let lo = 0;
  let hi = 1;
  while (tierAt(gateDistance(hi), prof) < tier) { lo = hi; hi *= 2; }
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tierAt(gateDistance(mid), prof) >= tier) hi = mid;
    else lo = mid + 1;
  }
  tierStarts.set(key, lo);
  return lo;
}

export function gateDistance(index) {
  // Arithmetic ramp with a floor, in closed form so it stays pure: spacing
  // for gap k is max(MIN, SPACING - k * r) where r derives from the
  // per-1000m ramp at the shipped top spacing.
  const r = W.SPACING_RAMP_PER_1000M * (W.SPACING_M / 1000);
  const span = W.SPACING_M - W.SPACING_MIN_M;
  const kRamp = r > 0 ? Math.ceil(span / r) : 0;
  const n = index;
  if (n <= 0) return W.FIRST_GATE_M;
  const m = Math.min(n, kRamp);
  const ramped = m * W.SPACING_M - r * (m * (m - 1)) / 2;
  const flat = (n - m) * W.SPACING_MIN_M;
  return W.FIRST_GATE_M + ramped + flat;
}

/**
 * Build gate #index for a seed — pure, so tools can interrogate any gate.
 * The word comes from the no-repeat cycle walk: gate k of a tier draws the
 * k-th word of a seeded coprime walk through that tier's pool, so a word
 * cannot recur until the entire pool has been seen (longer than any run's
 * stay in a tier). Real/fake and the fake's mutation keep their own
 * per-index rng stream.
 */
/**
 * Is gate `index` a real spelling? Pure in (seed, index), so it can look
 * backwards without any state.
 *
 * The raw draw is a coin flip, which means a run can open with a long row of
 * fakes: measured over 4,000 seeds, 6.4% opened with four or more and the
 * worst opened with ten. Ten gates is 850 metres and half a minute in which
 * the player is never once shown a word worth tapping. Passing a fake is the
 * correct answer and does pay the speed gain, so this is not unfair — but a
 * player has no way to know that yet, the tap verb goes untaught, and every
 * uncertain tap in that stretch costs a heart. The opening is now shaped: the
 * first word is always real, and no more than two fakes run together until the
 * teaching window is over. After that the coin flip is untouched.
 */
export function isRealGate(seed, index, prof = DEFAULT_PROFILE) {
  const raw = mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), index))() >= W.FAKE_CHANCE;
  if (index === 0) return true;
  if (index >= W.OPENING_GATES || raw) return raw;
  let run = 0;
  for (let i = index - 1; i >= 0 && run < W.OPENING_MAX_FAKE_RUN; i--) {
    if (isRealGate(seed, i, prof)) break;
    run++;
  }
  return run >= W.OPENING_MAX_FAKE_RUN;
}

/**
 * How much a read is worth for landing early. Linear across the arm window:
 * answering the instant the word arms pays EARLY_MULT, answering at the line
 * pays LATE_MULT. Pure in the distance, so it is reproducible from a replay.
 */
export function latencyMultFor(answerDistance) {
  const t = Math.max(0, Math.min(1, answerDistance / W.ARM_DISTANCE_M));
  return W.LATE_MULT + (W.EARLY_MULT - W.LATE_MULT) * t;
}

export function makeGate(seed, index, prof = DEFAULT_PROFILE) {
  const rng = mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), index));
  const d = gateDistance(index);
  const tier = tierAt(d, prof);
  rng();                                   // keep the draw in step with isRealGate
  const real = isRealGate(seed, index, prof);
  const laneRng = mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), 0x7f000000 + tier));
  const word = pickWordCycle(tier, index - tierStartIndex(tier, prof), laneRng);
  return {
    index,
    d,
    tier,
    real,
    shown: real ? word : makeFake(word, rng),
    // The true spelling, always: for a fake this is the word it was bent
    // from, which is what the recap and the resolved-plate feedback teach.
    // (Was `real ? word : null` — exactly backwards, so the picked-fake
    // feedback silently showed the misspelling again. Meta-gated now.)
    answer: word,
    confirmed: false,
    resolved: false,
    correct: false,
    // Phase B: filled in at the moment of the answer.
    answerDistance: 0,         // metres still to run when the tap landed
    answerLatency: 0,          // seconds between arming and answering
    latencyMult: W.LATE_MULT,
  };
}

export class WordGates {
  constructor(seed) {
    this.reset(seed);
  }

  reset(seed, wordSalt = 0, profile = DEFAULT_PROFILE) {
    this.seed = wordSeedFor(seed, wordSalt);
    this.profile = profile; // reading-difficulty profile (Phase 10)
    this.next = 0;          // first unresolved gate index
    this.gate = null;       // the gate currently in play (lazy-built)
    this.correctCount = 0;
    this.wrongCount = 0;
    this.falseTaps = 0;     // commissions: fakes tapped (each cost a heart)
    this.missedReals = 0;   // omissions: real words let slip (each costs a heart)
    this.misses = [];       // this run's wrong reads, for the results recap
    this.streak = 0;        // consecutive correct reads
    this.bestStreak = 0;
    this.readCount = 0;     // resolved gates, for the average read time
    this.latencySum = 0;
    this.bestLatency = null;
  }

  /** The gate the player is currently approaching (always exists). */
  current() {
    if (!this.gate || this.gate.index !== this.next) {
      this.gate = makeGate(this.seed, this.next, this.profile);
    }
    return this.gate;
  }

  /** True while the current gate is close enough to read and answer. */
  armed(playerD) {
    const g = this.current();
    return !g.resolved && g.d - playerD <= W.ARM_DISTANCE_M && g.d - playerD > 0;
  }

  /**
   * One fixed step. `confirm` is an edge (one tap), consumed here. Applies
   * rewards/penalties directly to the player so the hit is byte-identical to
   * the frame's obstacle hit, and pushes events for presentation.
   * `proxMult` is the frame's courage multiplier: reading well with the
   * beast in range banks more, exactly as clean landings did.
   */
  step(player, confirm, events, proxMult = 1, now = 0) {
    const g = this.current();
    const armed = this.armed(player.d);

    // Note when the word became answerable, so latency is measured from the
    // moment the player could first have acted rather than from the frame.
    if (armed && g.armedAt == null) g.armedAt = now;

    if (confirm && armed && !g.confirmed) {
      g.confirmed = true;
      g.answerDistance = Math.max(0, Math.min(W.ARM_DISTANCE_M, g.d - player.d));
      g.answerLatency = Math.max(0, now - (g.armedAt ?? now));
      g.latencyMult = latencyMultFor(g.answerDistance);
      events?.push({
        t: 'word_confirm', index: g.index, word: g.shown,
        answerDistance: g.answerDistance, latencyMult: g.latencyMult,
      });
    }

    // Phase B: a tap resolves the gate where it was made, not where the line
    // is. Answering is the act; running the remaining metres is not part of
    // it, and holding the outcome back until the line made every answer feel
    // the same however early it came. An untouched gate still resolves at the
    // line exactly as before — the passive path is unchanged.
    if (!g.confirmed && player.d < g.d) return;

    g.resolved = true;
    g.correct = g.confirmed === g.real;
    // Passing pays the late rate: it is the safe answer, and it is the answer
    // the player gets for doing nothing.
    if (!g.confirmed) {
      g.answerDistance = 0;
      g.answerLatency = Math.max(0, now - (g.armedAt ?? now));
      g.latencyMult = W.LATE_MULT;
    }
    // Read time is measured over ANSWERS, not over every gate. A passed fake
    // has no moment of decision to time — counting its full window transit as
    // a "read" would make the correct cautious play look slow, and the figure
    // is meant to say how fast the player decides, not how long they waited.
    if (g.confirmed) {
      this.readCount++;
      this.latencySum += g.answerLatency;
      if (g.correct && (this.bestLatency == null || g.answerLatency < this.bestLatency)) {
        this.bestLatency = g.answerLatency;
      }
    }

    if (g.correct) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;

      // THE speed mechanic (Phase 7, curve Phase 8): a correct read closes
      // a fixed fraction of the remaining headroom — big gains when slow,
      // vanishing gains near the ceiling, which is approached, never hit.
      const gain = R.SPEED_GAIN_MAX *
        Math.max(0, (R.CEILING - player.speed) / (R.CEILING - R.FLOOR));
      player.speed = Math.min(R.CEILING, player.speed + gain);
      if (player.speed > player.peakSpeed) player.peakSpeed = player.speed;
      player.chain++;
      if (player.chain > player.bestChain) player.bestChain = player.chain;
      // The pop for reading right, worth the multiplier the read just earned
      // AND how early it landed. Speed is deliberately left out of this.
      player.score += TUNING.SCORE.PER_READ * player.chainMult() * g.latencyMult;
      player.boostMeter = Math.min(B.METER_MAX,
        player.boostMeter + W.CORRECT_FILL * player.chainMult() * proxMult * g.latencyMult);
      player.gatesThreaded++; // the frame's "threaded a gate" ledger carries over
      player.lastCourage = proxMult;

      events?.push({
        t: 'word_correct', index: g.index, word: g.shown, real: g.real,
        tier: g.tier, chain: player.chain, chainMult: player.chainMult(),
        latencyMult: g.latencyMult, answerDistance: g.answerDistance,
        answerLatency: g.answerLatency,
        proxMult, x: player.x, y: player.y, d: player.d, gateD: g.d,
      });
    } else {
      this.wrongCount++;
      this.streak = 0;

      // Phase 23: BOTH wrong reads now cost a heart. Handing the omission's
      // consequence to the Redline's differential alone made doing nothing a
      // legal strategy — half of every gate is a fake, passing a fake is the
      // correct answer, and a run that never taps can never lose a heart. So
      // idling banked 50% accuracy for free and could only ever be killed by
      // falling behind.
      //
      // Commission is still strictly the worse mistake, which is the fairness
      // this asymmetry was built for: tapping a fake costs the heart AND the
      // stagger AND the meter. Letting a word slip costs the heart alone.
      const commission = !g.real; // g.confirmed on a fake
      player.obstaclesHit++;
      if (commission) {
        this.falseTaps++;
        player.staggerT = TUNING.PLAYER.STAGGER_TIME;
        player.boostMeter *= 1 - W.WRONG_METER_LOSS;
      } else {
        this.missedReals++;
      }
      // The learning recap: remember what was on the plate and what the
      // truth was, so the results screen can teach instead of just scold.
      if (this.misses.length < 12) {
        this.misses.push({
          shown: g.shown, answer: g.answer, real: g.real,
          reason: g.real ? 'missed_real' : 'picked_fake',
          // Where it happened (Phase 21). The recap has always known WHAT
          // went wrong; the replay review needs WHERE, and the gate has
          // carried its own distance since Phase 7.
          d: g.d, index: g.index,
        });
      }
      player.speed = Math.max(R.FLOOR, player.speed - R.SPEED_LOSS);
      if (player.chain > 0) {
        events?.push({ t: 'chain_lost', chain: player.chain, mult: player.chainMult() });
        player.chain = 0;
      }

      events?.push({
        t: 'word_wrong', index: g.index, word: g.shown, real: g.real,
        answer: g.answer, tier: g.tier, hit: commission,
        reason: g.real ? 'missed_real' : 'picked_fake',
        x: player.x, y: player.y, d: player.d, gateD: g.d,
      });
    }

    this.next++;
    this.gate = null;
  }
}
