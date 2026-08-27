/**
 * WordGates — the WORD RUN verb, as sim state. Deterministic, headless.
 *
 * A gate lives at a fixed downhill distance and shows one word, real or
 * faked. While the gate is armed (within ARM_DISTANCE_M) a confirm tap
 * locks in "that word is real". Crossing the gate line resolves it:
 *
 *   real  + confirmed  -> correct (gate bonus, chain link, boost fill)
 *   fake  + ignored    -> correct (same reward — a right read is a right read)
 *   fake  + confirmed  -> wrong   (the DESCENT-equivalent obstacle hit)
 *   real  + ignored    -> wrong   (no pick is a pick)
 *
 * Words, fakes and their order all derive from the run seed through the same
 * mixSeed/mulberry32 machinery the mountain uses, so a seed's gauntlet of
 * words is as replayable as its terrain — the ghost/daily-seed architecture
 * carries over untouched.
 */

import TUNING from '../TUNING.js';
import { mulberry32, mixSeed } from './rng.js';
import { pickWord, makeFake, tierCount } from '../words/wordlist.js';

const W = TUNING.WORDS;
const R = TUNING.RUN;
const B = TUNING.BOOST;

const WORD_STREAM = 0x77_6f_72; // 'wor' — its own rng lane, apart from terrain

export function tierAt(d) {
  return Math.min(tierCount() - 1, Math.floor(Math.max(0, d) / W.TIER_EVERY_M));
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

/** Build gate #index for a seed — pure, so tools can interrogate any gate. */
export function makeGate(seed, index) {
  const rng = mulberry32(mixSeed(mixSeed(seed, WORD_STREAM), index));
  const d = gateDistance(index);
  const tier = tierAt(d);
  const word = pickWord(tier, rng);
  const real = rng() >= W.FAKE_CHANCE;
  return {
    index,
    d,
    tier,
    real,
    shown: real ? word : makeFake(word, rng),
    answer: real ? word : null, // the true spelling behind a fake, for the sim/tools
    confirmed: false,
    resolved: false,
    correct: false,
  };
}

export class WordGates {
  constructor(seed) {
    this.reset(seed);
  }

  reset(seed) {
    this.seed = seed >>> 0;
    this.next = 0;          // first unresolved gate index
    this.gate = null;       // the gate currently in play (lazy-built)
    this.correctCount = 0;
    this.wrongCount = 0;
    this.streak = 0;        // consecutive correct reads
    this.bestStreak = 0;
  }

  /** The gate the player is currently approaching (always exists). */
  current() {
    if (!this.gate || this.gate.index !== this.next) {
      this.gate = makeGate(this.seed, this.next);
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
  step(player, confirm, events, proxMult = 1) {
    const g = this.current();

    if (confirm && this.armed(player.d) && !g.confirmed) {
      g.confirmed = true;
      events?.push({ t: 'word_confirm', index: g.index, word: g.shown });
    }

    if (player.d < g.d) return;

    // Crossing the line resolves the gate.
    g.resolved = true;
    g.correct = g.confirmed === g.real;

    if (g.correct) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;

      // THE speed mechanic (Phase 7): a correct read runs you faster,
      // deterministically, up to the legibility-gated ceiling.
      player.speed = Math.min(R.CEILING, player.speed + R.SPEED_GAIN);
      player.chain++;
      if (player.chain > player.bestChain) player.bestChain = player.chain;
      player.boostMeter = Math.min(B.METER_MAX,
        player.boostMeter + W.CORRECT_FILL * player.chainMult() * proxMult);
      player.gatesThreaded++; // the frame's "threaded a gate" ledger carries over
      player.lastCourage = proxMult;

      events?.push({
        t: 'word_correct', index: g.index, word: g.shown, real: g.real,
        tier: g.tier, chain: player.chain, chainMult: player.chainMult(),
        proxMult, x: player.x, y: player.y, d: player.d,
      });
    } else {
      this.wrongCount++;
      this.streak = 0;

      // The hit: a heart (through the obstacle ledger), a deterministic
      // speed loss down to the floor, a stagger, the chain, half the meter.
      player.obstaclesHit++;
      player.speed = Math.max(R.FLOOR, player.speed - R.SPEED_LOSS);
      player.staggerT = TUNING.PLAYER.STAGGER_TIME;
      player.boostMeter *= 1 - W.WRONG_METER_LOSS;
      if (player.chain > 0) {
        events?.push({ t: 'chain_lost', chain: player.chain, mult: player.chainMult() });
        player.chain = 0;
      }

      events?.push({
        t: 'word_wrong', index: g.index, word: g.shown, real: g.real,
        answer: g.answer, tier: g.tier,
        reason: g.real ? 'missed_real' : 'picked_fake',
        x: player.x, y: player.y, d: player.d,
      });
    }

    this.next++;
    this.gate = null;
  }
}
