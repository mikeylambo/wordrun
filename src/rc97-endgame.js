/**
 * RC9.7+ — true ending and late-run contract patch.
 *
 * No new render loop. At the canonical finish the runner genuinely escapes and
 * both creatures withdraw. Choosing KEEP GOING may later resume the pursuit;
 * the finish itself is consumed once and can never interrupt that run again.
 */
import TUNING from './TUNING.js';
import { Terrain } from './sim/terrain.js';
import { Beast, LUNGE, CHASE_MODE } from './sim/beast.js';
import { SecondBeast } from './sim/second-beast.js';
import { UI } from './ui/ui.js';
import { bandForDistance } from './render/art-direction.js';
import { ENDGAME, applyEndgameTerrain } from './design/endgame.js';

applyEndgameTerrain(Terrain, TUNING);

if (!Beast.prototype.__rc97EscapePatched) {
  Beast.prototype.__rc97EscapePatched = true;
  const baseStep = Beast.prototype.step;
  const baseReset = Beast.prototype.reset;

  Beast.prototype.reset = function resetRC97(...args) {
    const out = baseReset.apply(this, args);
    const sim = globalThis.__SIM;
    if (sim?.beast === this) {
      sim.escaped = false;
      sim.escapeConsumed = false;
      sim.keepGoingChosen = false;
      sim.postFinishGraceRemaining = 0;
      sim.postFinishActive = false;
      sim.beastReturnSerial = 0;
      sim.escapeD = 0;
      sim.beastStopD = 0;
    }
    return out;
  };

  Beast.prototype.step = function stepRC97(dt, player) {
    const sim = globalThis.__SIM;

    // The exact canonical crossing is a real finish, but only once per run.
    // Player movement is already resolved before Beast.step(), so the player
    // cannot be killed by another closure on the deterministic finish tick.
    if (
      sim?.phase === 'running' &&
      !sim.escaped &&
      !sim.escapeConsumed &&
      player.d >= ENDGAME.ESCAPE_DISTANCE
    ) {
      sim.escaped = true;
      sim.escapeConsumed = true;
      sim.keepGoingChosen = false;
      sim.postFinishGraceRemaining = 0;
      sim.postFinishActive = false;
      sim.escapeD = player.d;
      sim.beastStopD = player.d - this.gap;
      sim.killSource = null;
      sim.killTimer = 0;
      player.dead = false;

      this._playerD = player.d;
      this.killed = false;
      this.killT = 0;
      this.mode = CHASE_MODE.RELIEF;
      this.modeT = 0;
      this.modeDuration = 999999;
      this.attackT = 0;
      this.lunge = LUNGE.IDLE;
      this.lungeT = 0;
      this.lungeCooldown = 999999;
      this.airPounce = false;
      this.killAir = false;
      this.desired = this.gap;

      const second = sim.secondBeast;
      if (second) {
        second.active = false;
        second.killed = false;
        second.killT = 0;
        second.phase = 'idle';
        second.phaseT = 0;
        second.armedHunt = 0;
        second.triggerAt = Infinity;
        second.lift = 0;
      }

      sim.events?.push?.({
        t: 'escape', d: player.d, x: player.x, y: player.y,
        beastStopD: sim.beastStopD,
      });
      return;
    }

    // The earned coast is literal peace. Beast One remains fixed in world
    // space while the runner moves away. KEEP GOING starts a separate grace
    // timer; only when that expires is pursuit allowed to exist again.
    if (sim?.escaped) {
      this._playerD = player.d;
      this.killed = false;
      this.mode = CHASE_MODE.RELIEF;
      this.lunge = LUNGE.IDLE;
      this.airPounce = false;
      this.killAir = false;
      const stopD = Number.isFinite(sim.beastStopD) ? sim.beastStopD : player.d - this.gap;
      this.gap = Math.max(TUNING.BEAST.KILL_GAP + 0.5, player.d - stopD);
      this.desired = this.gap;

      if (sim.keepGoingChosen) {
        sim.postFinishGraceRemaining = Math.max(0, (sim.postFinishGraceRemaining || 0) - dt);
        if (sim.postFinishGraceRemaining <= 0) {
          // The finish remains consumed, but `escaped` returns false so every
          // ordinary pursuit/presentation system becomes authoritative again.
          sim.escaped = false;
          sim.postFinishActive = true;
          sim.beastReturnSerial = (sim.beastReturnSerial || 0) + 1;

          this.gap = Math.min(TUNING.BEAST.MAX_GAP, 92);
          this.desired = this.gap;
          this.mode = CHASE_MODE.STALK;
          this.modeT = 0;
          this.modeDuration = typeof this.__v1NextStalkDuration === 'function'
            ? this.__v1NextStalkDuration(player, true)
            : this._rand(10, 16);
          this.attackT = 0;
          this.lunge = LUNGE.IDLE;
          this.lungeT = 0;
          this.lungeCooldown = 4.5;
          this.mistakePressure *= 0.15;
          this.airPounce = false;
          this.killAir = false;

          sim.events?.push?.({
            t: 'beast_return', d: player.d, x: this.x, gap: this.gap,
          });
          return baseStep.call(this, dt, player);
        }
      }
      return;
    }

    return baseStep.call(this, dt, player);
  };
}

if (!SecondBeast.prototype.__rc97EscapePatched) {
  SecondBeast.prototype.__rc97EscapePatched = true;
  const baseStep = SecondBeast.prototype.step;
  SecondBeast.prototype.step = function stepRC97(dt, player, main, terrain) {
    const sim = globalThis.__SIM;
    if (sim?.escaped) {
      this.active = false;
      this.killed = false;
      this.killT = 0;
      this.phase = 'idle';
      this.phaseT = 0;
      this.armedHunt = 0;
      this.triggerAt = Infinity;
      this.lift = 0;
      this.event = null;
      return null;
    }
    return baseStep.call(this, dt, player, main, terrain);
  };
}

// Hide late-zone labels and keep the title mechanically innocent. The world
// reveals its late run through light, not UI naming the secret progression.
// Phase 6: bands are unnamed anyway; the one exception is the finish band's
// approved name (PUBLISHED), which is allowed through — the finish is a
// state the player earned, not a secret being spoiled.
if (!UI.prototype.__rc97MysteryPatched) {
  UI.prototype.__rc97MysteryPatched = true;
  const baseSetSeed = UI.prototype.setSeed;
  UI.prototype.setSeed = function setSeedRC97(...args) {
    const out = baseSetSeed.apply(this, args);
    if (this.titleHint) {
      // Phase 19: the retired tagline used to be re-asserted here after a
      // finish. The title line carries the day's identity now.
      this.titleHint.textContent = globalThis.__CHALLENGE ? 'CHALLENGE' : "TODAY'S DRAFT";
    }
    return out;
  };

  const baseUpdate = UI.prototype.update;
  UI.prototype.update = function updateRC97(dt, sim, running) {
    const out = baseUpdate.call(this, dt, sim, running);
    if (sim?.distance >= 15600 && this.bandName &&
        !bandForDistance(sim.distance).name) {
      this.bandName.classList.remove('on');
      this._bandT = 0;
    }
    return out;
  };
}

globalThis.__RC97_ENDGAME_RULES = {
  version: '1.0-rc',
  escapeDistance: ENDGAME.ESCAPE_DISTANCE,
  deepStart: ENDGAME.DEEP_START,
  haloDistance: ENDGAME.HALO_DISTANCE,
  crownDistance: ENDGAME.CROWN_DISTANCE,
  beastStopsForFinish: true,
  keepGoingCanResumePursuit: true,
  finishConsumedOnce: true,
};
