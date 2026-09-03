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
import { pickWordCycle, makeFake, tierCount, familyForGate } from '../words/wordlist.js';
import { phraseAt } from './phrases.js';

const W = TUNING.WORDS;
const R = TUNING.RUN;
const B = TUNING.BOOST;

const WORD_STREAM = 0x77_6f_72; // 'wor' — its own rng lane, apart from terrain

/** The default reading-difficulty profile — identical to the pre-mode game.
 *  CHART (Phase L5+) picks the phrase chart: 'daily' is the authored
 *  100-gate course, anything else the seeded endless walk. */
export const DEFAULT_PROFILE = Object.freeze({
  TIER_MIN: 0,
  TIER_MAX: tierCount() - 1,
  TIER_EVERY_M: W.TIER_EVERY_M,
  CHART: 'endless',
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
  // Phase L5+: the phrase chart speaks first — it charts the SHAPE of a
  // stretch (a fake run, an alternation, a breather) and only ever biases
  // this coin; a 'coin' phrase returns null and the shipped draw stands.
  // The opening shaping below clamps charted patterns exactly like raw ones.
  const charted = phraseAt(seed, index, prof.CHART ?? 'endless').real;
  const raw = charted != null ? charted
    : mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), index))() >= W.FAKE_CHANCE;
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

/**
 * Build a gate. `lane` may supply a word to show INSTEAD of the one the tier
 * walk chose — a substitution, never a reordering. The walk has already run
 * and produced its word by the time the swap happens, so its no-repeat
 * guarantee is untouched: the same stride visits the same list in the same
 * order whether or not a lane word is printed over the top of it.
 */
export function makeGate(seed, index, prof = DEFAULT_PROFILE, lane = null) {
  const rng = mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), index));
  const d = gateDistance(index);
  const tier = tierAt(d, prof);
  rng();                                   // keep the draw in step with isRealGate
  const real = isRealGate(seed, index, prof);
  const laneRng = mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), 0x7f000000 + tier));
  // The walk runs first and unconditionally, so its cursor advances exactly as
  // it would have. Only then is the printed word allowed to differ.
  const walked = pickWordCycle(tier, index - tierStartIndex(tier, prof), laneRng);
  const substitute = lane ? lane(index, tier) : null;
  const word = substitute || walked;
  // Phase L5+: a trap or exam phrase pins the mutation family for its whole
  // stretch — the player who names the family reads it. Unpinned gates keep
  // the shipped five-gate family walk.
  const pinned = phraseAt(seed, index, prof.CHART ?? 'endless').family;
  const family = pinned >= 0 ? pinned : familyForGate(seed, index);
  return {
    index,
    d,
    tier,
    real,
    family, // which mutation family a fake would bend with (instrumentation)
    shown: real ? word : makeFake(word, rng, family),
    // The true spelling, always: for a fake this is the word it was bent
    // from, which is what the recap and the resolved-plate feedback teach.
    // (Was `real ? word : null` — exactly backwards, so the picked-fake
    // feedback silently showed the misspelling again. Meta-gated now.)
    answer: word,
    // Which word the walk itself chose, so a gate can prove the lane changed
    // nothing about the sequence it was drawn from.
    walked,
    fromLane: !!substitute,
    confirmed: false,          // answered REAL
    rejected: false,           // answered FAKE
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

  /** Attach the nemesis lane. Absent on the DAILY RUN, which must be
   *  identical for everyone, and absent headlessly unless a test asks. */
  setLane(lane) { this.lane = lane || null; }

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
    this.lastResolvedCorrect = null;  // how the most recent gate went
    this.readCount = 0;     // resolved gates, for the average read time
    this.latencySum = 0;
    this.bestLatency = null;
    // N1: the answer buffer. Playtest: "I'm reading very far down the line
    // but can't select soon enough" — the lookahead plates let the word be
    // read up to 140m out, but a tap before ARM_DISTANCE_M was silently
    // swallowed, so a decided answer had to be consciously re-timed. The
    // buffer holds ONE pre-arm answer for the current gate and lands it on
    // the first armed frame. +1 said real, -1 said fake, 0 nothing held.
    this.held = 0;
    this.heldIndex = -1;
    this._prevIn = false;   // last step's raw answer input, for edge capture
  }

  /** The gate the player is currently approaching (always exists). */
  current() {
    if (!this.gate || this.gate.index !== this.next) {
      this.gate = makeGate(this.seed, this.next, this.profile, this.lane);
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
  step(player, confirm, events, proxMult = 1, now = 0, reject = false) {
    const g = this.current();
    const armed = this.armed(player.d);

    // Note when the word became answerable, so latency is measured from the
    // moment the player could first have acted rather than from the frame.
    if (armed && g.armedAt == null) g.armedAt = now;

    // N1: the answer buffer. A tap in the dead zone — the current gate still
    // beyond ARM_DISTANCE_M — is held instead of swallowed. Latest input
    // wins (the player can change their mind until the word arms), and the
    // hold belongs to exactly this gate, so a re-dealt or advanced index can
    // never inherit it. ARM_DISTANCE_M itself is untouched: the window in
    // which an answer can LAND is exactly what it always was — the buffer
    // only lets a decision made from the lookahead plates wait for it.
    // Capture on the RISING EDGE only. advance() can run several fixed
    // steps in one render frame with the SAME input object, so a live tap
    // that answers the armed word on the first step is still true on the
    // second — where the resolved gate has already advanced and the tap
    // would be captured as a pre-lock for the NEXT word, auto-answering it
    // with the previous answer. The edge makes one tap exactly one act.
    const inNow = confirm || reject;
    const inEdge = inNow && !this._prevIn;
    this._prevIn = inNow;
    if (inEdge && !armed && !g.resolved && g.d - player.d > W.ARM_DISTANCE_M) {
      this.held = confirm ? 1 : -1;
      this.heldIndex = g.index;
      events?.push({ t: 'word_held', index: g.index, said: confirm ? 'real' : 'fake' });
      confirm = false;
      reject = false;
    }
    // Delivery: the first armed frame plays the held answer — at the arm
    // edge, which is the earliest an answer has ever been able to land, so
    // it pays exactly what a frame-perfect live tap always paid, no more.
    // A live tap on the same frame is later information and wins.
    if (this.held !== 0 && this.heldIndex === g.index && armed && !g.confirmed && !g.rejected) {
      if (!confirm && !reject) {
        if (this.held > 0) confirm = true; else reject = true;
      }
      this.held = 0;
      this.heldIndex = -1;
    }

    // Phase C: two zones, one primitive. Right says real, left says fake, and
    // letting the word go on saying nothing still says fake — the passive path
    // is not removed, only given a voice for players who want to use it.
    // Whichever lands first is the answer; a second press cannot revise it.
    const answering = (confirm || reject) && armed && !g.confirmed && !g.rejected;
    if (answering) {
      if (confirm) g.confirmed = true; else g.rejected = true;
      g.answerDistance = Math.max(0, Math.min(W.ARM_DISTANCE_M, g.d - player.d));
      g.answerLatency = Math.max(0, now - (g.armedAt ?? now));
      // Phase F: the player's own bar. Beyond it the early multiplier pays
      // and the compression bonus rides on top; inside it the answer is worth
      // the late rate and nothing more. The word was legible the whole way —
      // what a late answer costs here is money, never the run.
      g.compressionLevel = player.compressionLevel | 0;
      const bar = player.compressionThreshold ? player.compressionThreshold() : 0;
      g.qualified = g.answerDistance >= bar;
      g.latencyMult = g.qualified ? latencyMultFor(g.answerDistance) : W.LATE_MULT;
      g.compressionMult = g.qualified && player.compressionMult ? player.compressionMult() : 1;
      events?.push({
        t: 'word_confirm', index: g.index, word: g.shown,
        said: confirm ? 'real' : 'fake',
        answerDistance: g.answerDistance, latencyMult: g.latencyMult,
      });
    }

    // Phase B: a tap resolves the gate where it was made, not where the line
    // is. Answering is the act; running the remaining metres is not part of
    // it, and holding the outcome back until the line made every answer feel
    // the same however early it came. An untouched gate still resolves at the
    // line exactly as before — the passive path is unchanged.
    const answered = g.confirmed || g.rejected;
    if (!answered && player.d < g.d) return;

    g.resolved = true;
    // Said real and it was real, or said fake and it was fake. Saying nothing
    // still says fake, which is why a passed fake is correct.
    g.correct = g.confirmed ? g.real : !g.real;
    this.lastResolvedCorrect = g.correct;
    // Passing pays the late rate: it is the safe answer, and it is the answer
    // the player gets for doing nothing.
    if (!answered) {
      g.answerDistance = 0;
      g.compressionMult = 1;
      g.answerLatency = Math.max(0, now - (g.armedAt ?? now));
      g.latencyMult = W.LATE_MULT;
    }
    // Read time is measured over ANSWERS, not over every gate. A passed fake
    // has no moment of decision to time — counting its full window transit as
    // a "read" would make the correct cautious play look slow, and the figure
    // is meant to say how fast the player decides, not how long they waited.
    if (answered) {
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
      // Phase D: the whole score, in one line. Reads pay; ground does not.
      //   base x tier x how early x the chain x compression (1.0 until Phase F)
      const S = TUNING.SCORE;
      const tierMult = S.TIER_MULT[Math.min(g.tier, S.TIER_MULT.length - 1)] ?? 1;
      // Phase I: the DASH chain rides the score term and nothing else. Index is
      // the reads already landed during this dash; the dash must be live NOW
      // (player.step ends it before this runs, so a read resolved on the frame
      // the meter empties pays no chain).
      const ladder = S.DASH_CHAIN_MULT;
      g.dashChain = player.overdrive ? player.dashChain : 0;
      g.dashMult = player.overdrive ? (ladder[Math.min(player.dashChain, ladder.length - 1)] ?? 1) : 1;
      g.score = S.PER_READ * tierMult * g.latencyMult * player.chainMult()
        * (g.compressionMult ?? 1) * g.dashMult;
      player.score += g.score;
      if (player.overdrive) player.dashChain++;
      // Phase I: a dash is a full charge spent whole (Phase 22's own rule).
      // Reads used to refill the meter mid-dash, and at the chain cap they
      // out-filled the drain — measured, a clean reader's first dash never
      // ended (97 reads in one dash on the daily route). The fill pauses while
      // the dash is live, so a dash is 2.94 s and the ladder means something.
      if (!player.overdrive) {
        player.boostMeter = Math.min(B.METER_MAX,
          player.boostMeter + W.CORRECT_FILL * player.chainMult() * proxMult * g.latencyMult);
      }
      // Surge accrues only while the chain is already capped and the answer
      // landed early. Anything less empties it — it measures holding a peak,
      // not reaching one.
      const capped = player.chain >= B.CHAIN_CAP;
      const early = g.answerDistance >= W.ARM_DISTANCE_M * B.SURGE_EARLY_FRAC;
      player.surgeReads = capped && early ? player.surgeReads + 1 : 0;
      player.gatesThreaded++; // the frame's "threaded a gate" ledger carries over
      player.lastCourage = proxMult;

      events?.push({
        t: 'word_correct', index: g.index, word: g.shown, real: g.real,
        // The TRUE spelling, so the per-word ledger keys on the word rather
        // than on whatever was printed — a correctly-passed fake is a read of
        // the word it was bent from.
        answer: g.answer, fromLane: !!g.fromLane, tier: g.tier, chain: player.chain, chainMult: player.chainMult(),
        latencyMult: g.latencyMult, answerDistance: g.answerDistance,
        answerLatency: g.answerLatency, dashChain: g.dashChain, dashMult: g.dashMult,
        score: g.score, // E4: the read's own worth, for the brilliance ledgers
        proxMult, x: player.x, y: player.y, d: player.d, gateD: g.d,
      });
    } else {
      this.wrongCount++;
      this.streak = 0;
      // Losing the level is the sting. A wrong read of any kind drops the bar
      // to the floor — the player chose the risk and it came due.
      player.compressionLevel = 0;
      player.surgeReads = 0;
      player.dashChain = 0;      // Phase I: a wrong read of any kind zeroes the dash chain

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
      // Phase C keeps the heart on exactly one action: saying REAL to a fake.
      // Rejecting a real word is a commission too, but not that one — it costs
      // what letting a word slip costs, because the player did read it and
      // decide, and the reject action must not be more dangerous than silence
      // or nobody will ever use it.
      const commission = g.confirmed && !g.real;
      if (commission) {
        player.obstaclesHit++;
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
          reason: g.real ? (g.rejected ? 'rejected_real' : 'missed_real') : 'picked_fake',
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
        reason: g.real ? (g.rejected ? 'rejected_real' : 'missed_real') : 'picked_fake',
        x: player.x, y: player.y, d: player.d, gateD: g.d,
      });
    }

    this.next++;
    this.gate = null;
  }
}
