/**
 * Sim — the whole game as a headless, deterministic state machine.
 */

import TUNING from '../TUNING.js';
import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { Beast } from './beast.js';
import { ENDGAME } from '../design/endgame.js';
import { GhostRecorder, GhostPlayer } from './ghost.js';
import { WordGates } from './word-gates.js';
// Phase 7: the RC6 beat/pursuit pass and the landing-feel pass are retired
// with the downhill verb — the track is flat and the pursuit is a pure
// speed differential. See sim/terrain.js and sim/beast.js.

export const PHASE = {
  TITLE: 'title',
  RUNNING: 'running',
  KILL: 'kill',
  DEAD: 'dead',
};

export function emptyInput() {
  return { carve: 0, flip: 0, jump: false, boostHeld: false, dragging: false,
    confirm: false, reject: false, raiseBar: false, lowerBar: false };
}

export class Sim {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.terrain = new Terrain(this.seed);
    this.player = new Player(this.terrain);
    this.beast = new Beast(this.seed);
    this.wordGates = new WordGates(this.seed);
    this.recorder = new GhostRecorder();
    this.ghost = new GhostPlayer(null);
    this.phase = PHASE.TITLE;
    this.time = 0;
    this.steps = 0;
    this.events = [];
    this.killTimer = 0;
    this.killSource = null;
    this._acc = 0;
    this._lastStuntId = null;
    this.stuntsCleared = 0;
  }

  /**
   * opts (Phase 10): { wordSalt, mode: 'endless'|'standard',
   * difficulty: 'easy'|'normal'|'hard' }. Defaults reproduce the
   * pre-mode game exactly. (The old grace parameter is gone: Phase 7's
   * pure-differential Redline left it inert; easing now lives in the
   * EASY difficulty's slower pace, chosen visibly instead of fading
   * silently.)
   */
  start(seed = this.seed, ghostData = null, opts = {}) {
    if ((seed >>> 0) !== this.seed || !this.terrain) {
      this.seed = seed >>> 0;
      this.terrain = new Terrain(this.seed);
      this.player.terrain = this.terrain;
    }
    this.terrain.chunks.clear();
    this.player.reset();
    this.beast.reset();
    const M = TUNING.MODES;
    this.mode = M.RULES[opts.mode] ? opts.mode : 'endless';
    this.routeFinished = false;
    this.lastStandUsed = false;
    this.pendingBar = 0;
    this.lastStand = null;
    this.rules = M.RULES[this.mode];
    this.difficulty = M.DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    const diff = M.DIFFICULTY[this.difficulty];
    // Same daily track, fresh vocabulary per attempt (Phase 9): the salt
    // only touches the word rng lane, so ghosts and determinism hold.
    // The difficulty profile shapes the word-tier curve and the Redline's
    // pace — never the track or the speed curve.
    this.wordGates.reset(this.seed, opts.wordSalt || 0, {
      TIER_MIN: diff.TIER_MIN, TIER_MAX: diff.TIER_MAX, TIER_EVERY_M: diff.TIER_EVERY_M,
    });
    this.beast.pace = diff.REDLINE_PACE;
    this.recorder.reset();
    this.ghost.load(ghostData);
    this.phase = PHASE.RUNNING;
    this.time = 0;
    this.steps = 0;
    this.killTimer = 0;
    this.killSource = null;
    this._acc = 0;
    this.events.length = 0;
    this._lastStuntId = null;
    this.stuntsCleared = 0;
    return this;
  }

  step(input) {
    const dt = TUNING.SIM.DT;
    this.steps++;
    this.time += dt;

    if (this.phase === PHASE.KILL) {
      this.killTimer += dt;
      this.beast.step(dt, this.player);
      this.ghost.step(dt);
      if (this.killTimer >= TUNING.BEAST.KILL_CAM_TIME) this.phase = PHASE.DEAD;
      return;
    }
    if (this.phase !== PHASE.RUNNING) return;


    const proxMult = this.beast.proximityMult();
    this.player.step(dt, input, proxMult, this.events);
    // The verb: a correct read adds speed, a wrong read subtracts it (and
    // costs a heart via the obstacle ledger). The Redline feels both only
    // through the speed differential — no pressure is registered anywhere.
    // Phase F: the bar never moves while a word is up. Raising it on a word
    // already on screen would be judging the answer after seeing it.
    if (input.raiseBar || input.lowerBar) {
      // Consume the edge HERE, not in the frame loop. advance() runs several
      // fixed steps per frame, and an edge left standing is applied by every
      // one of them — one hold moved the bar two levels before this.
      this.pendingBar += input.raiseBar ? 1 : -1;
      input.raiseBar = false;
      input.lowerBar = false;
    }
    // The intent is buffered and lands at the next moment nothing is armed.
    // Requiring the gesture to begin AND end inside a gap made it impossible
    // exactly where it mattered: the gap runs 1.11s early on but only 0.11s
    // at the spacing floor and the ceiling, against a hold that must outlast
    // the 0.22s tap window to be distinguishable at all. Buffering keeps the
    // rule the restriction was written for, and the word the change affects
    // is still one the player has not seen.
    if (this.pendingBar !== 0 && !this.wordGates.armed(this.player.d)) {
      const levels = TUNING.WORDS.COMPRESSION_MULT.length - 1;
      const before = this.player.compressionLevel;
      const dir = Math.sign(this.pendingBar);
      this.player.compressionLevel = Math.max(0, Math.min(levels, before + dir));
      this.pendingBar -= dir;
      if (this.player.compressionLevel !== before) {
        this.events.push({ t: 'bar_set', level: this.player.compressionLevel });
      }
    }

    this.wordGates.step(this.player, input.confirm, this.events, proxMult, this.time,
      input.reject);

    // The DAILY RUN's route has an end: the hundredth gate. Reaching it is a
    // finish, not a death, and it is the only way that mode stops other than
    // being run down.
    // Raising the flag only. The finish itself belongs to the endgame layer,
    // which stops the pursuit, pins the runner's coast and shows the card —
    // setting `escaped` here directly would skip all of it.
    const routeGates = this.rules.GATES | 0;
    if (routeGates > 0 && this.wordGates.next >= routeGates && !this.routeFinished) {
      this.routeFinished = true;
      this.events.push({ t: 'route_finished', gates: routeGates, score: this.score });
    }


    this.beast.step(dt, this.player);

    this.recorder.step(dt, this.player);
    this.ghost.step(dt);
    this.terrain.prune(Math.floor(this.player.d / TUNING.TERRAIN.CHUNK_LEN));

    // Phase E — the last stand. The flattest death in the game is being run
    // down with nothing to do about it. Once per run, the Redline's arrival
    // opens one more word instead of ending the run: the gap holds at the
    // throat, the corruption sits at its maximum, and the answer decides it.
    // A skill save, the opposite of a continue, so a run that survives it
    // keeps every board right it had.
    if (this.lastStand) {
      // The pursuit is pinned for the duration. The beast re-arms its kill
      // every frame at this gap, so it has to be held off every frame too.
      this.beast.killed = false;
      this.beast.killT = 0;
      this.beast.gap = TUNING.BEAST.KILL_GAP;
      if (this.wordGates.next > this.lastStand.index) {
        const won = this.wordGates.lastResolvedCorrect === true;
        this.lastStand = null;
        if (won) {
          this.beast.gap = ENDGAME.LAST_STAND_RECOVER_M;
          this.beast.desired = ENDGAME.LAST_STAND_RECOVER_M;
          this.events.push({ t: 'last_stand_held', gap: this.beast.gap });
        } else {
          this.beast.killed = true;
          this.events.push({ t: 'last_stand_lost' });
        }
      }
    } else if (this.beast.killed && !this.lastStandUsed && !this.player.dead) {
      this.lastStandUsed = true;
      this.lastStand = { index: this.wordGates.next };
      this.beast.killed = false;
      this.beast.killT = 0;
      this.events.push({ t: 'last_stand', index: this.lastStand.index });
    }

    if (this.beast.killed) {
      this.player.dead = true;
      this.recorder.finish(this.player);
      this.phase = PHASE.KILL;
      this.killTimer = 0;
      this.killSource = 'main';
      this.events.push({ t: 'kill', source: 'main', air: !!this.beast.killAir });
    }
  }

  advance(realDt, input) {
    this._acc += Math.min(realDt, 0.25);
    let n = 0;
    while (this._acc >= TUNING.SIM.DT && n < TUNING.SIM.MAX_STEPS_PER_FRAME) {
      this.step(input);
      if (input.jump) input.jump = false;
      if (input.confirm) input.confirm = false;
      this._acc -= TUNING.SIM.DT;
      n++;
    }
    if (n === TUNING.SIM.MAX_STEPS_PER_FRAME) this._acc = 0;
    return this._acc / TUNING.SIM.DT;
  }

  drainEvents() {
    if (!this.events.length) return null;
    const e = this.events.slice();
    this.events.length = 0;
    return e;
  }

  get distance() { return Math.max(0, this.player.d); }
  get score() { return Math.floor(this.player.score); }

  state() {
    const p = this.player;
    return {
      seed: this.seed,
      distance: +this.distance.toFixed(3),
      speed: +p.speed.toFixed(4),
      gap: +this.beast.gap.toFixed(4),
      boostMeter: +p.boostMeter.toFixed(4),
      boostSpent: +p.boostSpent.toFixed(4),
      tricksLanded: p.tricksLanded,
      tricksFlubbed: p.tricksFlubbed,
      obstaclesHit: p.obstaclesHit,
      stuntsCleared: this.stuntsCleared,
      wordsCorrect: this.wordGates.correctCount,
      wordsWrong: this.wordGates.wrongCount,
      wordStreak: this.wordGates.streak,
      bestWordStreak: this.wordGates.bestStreak,
      killSource: this.killSource,
    };
  }

  get pitch() {
    return this.terrain.pitchAt(
      Math.floor(this.player.d / TUNING.TERRAIN.CHUNK_LEN)
    );
  }

  debug() {
    const p = this.player;
    return {
      phase: this.phase,
      steps: this.steps,
      time: +this.time.toFixed(4),
      x: +p.x.toFixed(4),
      y: +p.y.toFixed(4),
      vy: +p.vy.toFixed(4),
      heading: +p.heading.toFixed(4),
      airborne: p.airborne,
      hangtime: +p.hangtime.toFixed(4),
      onIce: p.onIce,
      inPowder: p.inPowder,
      staggerT: +p.staggerT.toFixed(4),
      overdrive: p.overdrive,
      gatesThreaded: p.gatesThreaded,
      desiredGap: +this.beast.desired.toFixed(3),
      pursuitSpeed: +(this.beast.pursuitSpeed || 0).toFixed(3),
      attackKind: this.beast.attackKind,
      airPounce: !!this.beast.airPounce,
      killAir: !!this.beast.killAir,
      mistakePressure: +this.beast.mistakePressure.toFixed(3),
      avgSpeed: +this.beast.avgSpeed.toFixed(3),
      proximityMult: +this.beast.proximityMult().toFixed(4),
      killSource: this.killSource,
      lastLanding: p.lastLanding,
      ghostActive: this.ghost.active,
      chain: p.chain,
      chainMult: +p.chainMult().toFixed(3),
      bestChain: p.bestChain,
      pitch: this.pitch.name,
      gradeMul: +this.terrain.gradeMul(p.d).toFixed(3),
      lunge: this.beast.lunge,
      lunges: this.beast.lunges,
      wakefulness: +this.beast.wakefulness().toFixed(3),
      stuntsCleared: this.stuntsCleared,
      lastStuntId: this._lastStuntId,
      wordGate: (() => {
        const g = this.wordGates.current();
        return {
          index: g.index, d: +g.d.toFixed(2), shown: g.shown, real: g.real,
          tier: g.tier, confirmed: g.confirmed,
          armed: this.wordGates.armed(this.player.d),
        };
      })(),
    };
  }
}
