/**
 * FINISH — the run's true ending, and what KEEP GOING does after it.
 *
 * At the canonical distance (or the DAILY RUN's hundredth gate, which raises
 * `routeFinished`) the runner genuinely escapes: the Redline stops at the
 * world-space point where the line was crossed and stays there while the
 * runner coasts away. The finish is consumed once per run. Choosing KEEP GOING
 * (the UI sets `keepGoingChosen` and a grace in `postFinishGraceRemaining`)
 * lets that grace run out, after which the pursuit resumes at a fixed gap and
 * every ordinary system is authoritative again.
 *
 * It lives in the sim because it decides who is alive. It used to be a runtime
 * replacement of Beast.prototype.step installed by rc97-endgame.js, reached
 * through a side-effect import in render/scene.js and reading the sim through
 * `globalThis.__SIM` — so the headless sim and the browser sim were not the
 * same program. Now it is opt-in and explicit: `sim.endgame = true` (main.js
 * sets it) routes the pursuer's step through stepFinish(). Headless tools
 * leave it off and drive the exact sim every golden was minted against.
 */

import TUNING from '../TUNING.js';
import { LUNGE, CHASE_MODE } from './beast.js';
import { ENDGAME } from '../design/endgame.js';

/** Clear the finish state for a new run. */
export function resetFinish(sim) {
  sim.escaped = false;
  sim.escapeConsumed = false;
  sim.keepGoingChosen = false;
  sim.postFinishGraceRemaining = 0;
  sim.postFinishActive = false;
  sim.beastReturnSerial = 0;
  sim.escapeD = 0;
  sim.beastStopD = 0;
}

/**
 * Step the finish rule in place of the pursuer. Returns true when it owned
 * this step (the pursuer must NOT also step), false when the ordinary
 * Beast.step should run.
 */
export function stepFinish(sim, dt) {
  const beast = sim.beast;
  const player = sim.player;

  // The exact canonical crossing is a real finish, but only once per run.
  // Player movement is already resolved before the pursuer steps, so the
  // player cannot be killed by another closure on the deterministic finish tick.
  if (
    sim.phase === 'running' &&
    !sim.escaped &&
    !sim.escapeConsumed &&
    // Two ways to finish: the canonical distance, or the DAILY RUN's
    // hundredth gate. Both come through here so the coast, the stopped
    // pursuit and the card are identical either way.
    (player.d >= ENDGAME.ESCAPE_DISTANCE || sim.routeFinished === true)
  ) {
    sim.escaped = true;
    sim.escapeConsumed = true;
    sim.keepGoingChosen = false;
    sim.postFinishGraceRemaining = 0;
    sim.postFinishActive = false;
    sim.escapeD = player.d;
    sim.beastStopD = player.d - beast.gap;
    sim.killSource = null;
    sim.killTimer = 0;
    player.dead = false;

    beast._playerD = player.d;
    beast.killed = false;
    beast.killT = 0;
    beast.mode = CHASE_MODE.RELIEF;
    beast.modeT = 0;
    beast.modeDuration = 999999;
    beast.attackT = 0;
    beast.lunge = LUNGE.IDLE;
    beast.lungeT = 0;
    beast.lungeCooldown = 999999;
    beast.airPounce = false;
    beast.killAir = false;
    beast.desired = beast.gap;

    sim.events.push({
      t: 'escape', d: player.d, x: player.x, y: player.y,
      beastStopD: sim.beastStopD,
    });
    return true;
  }

  if (!sim.escaped) return false;

  // The earned coast is literal peace: the Redline stays fixed in world space
  // while the runner moves away. KEEP GOING starts a separate grace timer;
  // only when that expires is pursuit allowed to exist again.
  beast._playerD = player.d;
  beast.killed = false;
  beast.mode = CHASE_MODE.RELIEF;
  beast.lunge = LUNGE.IDLE;
  beast.airPounce = false;
  beast.killAir = false;
  const stopD = Number.isFinite(sim.beastStopD) ? sim.beastStopD : player.d - beast.gap;
  beast.gap = Math.max(TUNING.BEAST.KILL_GAP + 0.5, player.d - stopD);
  beast.desired = beast.gap;

  if (!sim.keepGoingChosen) return true;
  sim.postFinishGraceRemaining = Math.max(0, (sim.postFinishGraceRemaining || 0) - dt);
  if (sim.postFinishGraceRemaining > 0) return true;

  // The finish remains consumed, but `escaped` returns false so every
  // ordinary pursuit/presentation system becomes authoritative again.
  sim.escaped = false;
  sim.postFinishActive = true;
  sim.beastReturnSerial = (sim.beastReturnSerial || 0) + 1;

  beast.gap = Math.min(TUNING.BEAST.MAX_GAP, 92);
  beast.desired = beast.gap;
  beast.mode = CHASE_MODE.STALK;
  beast.modeT = 0;
  // Drawn from the pursuer's own seeded stream (kept for determinism: the
  // draw is part of the replayable sequence even though nothing reads it).
  beast.modeDuration = beast._rand(10, 16);
  beast.attackT = 0;
  beast.lunge = LUNGE.IDLE;
  beast.lungeT = 0;
  beast.lungeCooldown = 4.5;
  beast.mistakePressure *= 0.15;
  beast.airPounce = false;
  beast.killAir = false;

  sim.events.push({
    t: 'beast_return', d: player.d, x: beast.x, gap: beast.gap,
  });
  return false;
}
