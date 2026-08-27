/**
 * Sim — the whole game as a headless, deterministic state machine.
 */

import TUNING from '../TUNING.js';
import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { Beast } from './beast.js';
import { SecondBeast } from './second-beast.js';
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
  return { carve: 0, flip: 0, jump: false, boostHeld: false, dragging: false, confirm: false };
}

export class Sim {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.terrain = new Terrain(this.seed);
    this.player = new Player(this.terrain);
    this.beast = new Beast(this.seed);
    this.secondBeast = new SecondBeast(this.seed);
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

  start(seed = this.seed, ghostData = null, grace = 0) {
    if ((seed >>> 0) !== this.seed || !this.terrain) {
      this.seed = seed >>> 0;
      this.terrain = new Terrain(this.seed);
      this.player.terrain = this.terrain;
      this.secondBeast.seed = this.seed;
    }
    this.terrain.chunks.clear();
    this.player.reset();
    this.beast.reset();
    this.secondBeast.reset();
    this.wordGates.reset(this.seed);
    this.beast.grace = Math.max(0, Math.min(1, grace));
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
      if (this.secondBeast.killed) this.secondBeast.killT += dt;
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
    this.wordGates.step(this.player, input.confirm, this.events, proxMult);


    this.beast.step(dt, this.player);
    const secondEvent = this.secondBeast.step(dt, this.player, this.beast, this.terrain);
    if (secondEvent) this.events.push(secondEvent);

    this.recorder.step(dt, this.player);
    this.ghost.step(dt);
    this.terrain.prune(Math.floor(this.player.d / TUNING.TERRAIN.CHUNK_LEN));

    if (this.beast.killed || this.secondBeast.killed) {
      this.player.dead = true;
      this.recorder.finish(this.player);
      this.phase = PHASE.KILL;
      this.killTimer = 0;
      this.killSource = this.secondBeast.killed ? 'second' : 'main';
      this.events.push({
        t: 'kill',
        source: this.killSource,
        air: this.killSource === 'main' ? !!this.beast.killAir : !!this.player.airborne,
      });
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
      secondBeastActive: this.secondBeast.active,
      secondBeastKind: this.secondBeast.active ? this.secondBeast.kind : null,
      secondBeastAppearances: this.secondBeast.appearances,
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
      secondBeastActive: this.secondBeast.active,
      secondBeastPhase: this.secondBeast.phase,
      secondBeastKind: this.secondBeast.kind,
      secondBeastX: +this.secondBeast.x.toFixed(3),
      secondBeastD: +this.secondBeast.d.toFixed(3),
      secondBeastLift: +this.secondBeast.lift.toFixed(3),
      secondBeastAppearances: this.secondBeast.appearances,
      secondBeastDiagonal: this.secondBeast.diagonalCount,
      secondBeastVault: this.secondBeast.vaultCount,
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
