/**
 * RC6 — attract mode.
 *
 * A cabinet is never idle. Ten seconds after the title goes quiet the road
 * starts running behind the wordmark: the player's own BEST RUN ghost runs
 * its recorded line, and the first touch of any kind puts the machine back in
 * the player's hands.
 *
 * RC11.8 — IT SHOWS THE RUN, NOT A SCORE. The loop used to raise the HUD and
 * climb the score in proportion to how far through the recording it had come.
 * Nothing on screen was earning it: no word plate, no bell, no read — a number
 * counting up beside an empty road, which reads as a demo faking a game rather
 * than a game showing itself. The figure on the track is the whole attract now.
 *
 * It is PRESENTATION over the existing pieces, not a second game. There is
 * no second sim: the ghost this plays is the one the run recorder already
 * writes, the pose it drives is the same pose the camera and the world have
 * always followed, and the score it shows is the best that ghost actually
 * scored. Nothing here can be reached while a run is live — main.js only
 * feeds it a quiet title — and `exit()` restores the resting pose it found,
 * so a run started from attract begins exactly as one started from a cold
 * title (sim.start() resets the pose regardless; this only keeps the frame
 * between them honest).
 *
 * With no ghost recorded yet, the road simply runs empty: the camera travels.
 */

const IDLE_SECONDS = 10;
// The empty road's travel speed, and the fallback for a ghost whose samples
// run out. Cruise, not the ceiling: this is scenery, not a demonstration of
// how fast the game gets.
const EMPTY_SPEED = 26;
// A ghost shorter than this is not worth replaying: it would restart every
// couple of seconds and read as a stutter rather than a run. A brief first
// attempt therefore shows the empty road, exactly as no ghost at all does.
const MIN_REPLAY_SECONDS = 6;

import TUNING from '../TUNING.js';

export class AttractMode {
  /**
   * @param sim           the live sim — read for terrain, written ONLY as pose
   * @param playerActor   hidden while the ghost is the figure on the road
   * @param loadGhost     () => serialized best ghost, or null
   * @param onEnter/onExit presentation hooks, owned by main.js
   */
  constructor({ sim, playerActor, loadGhost, onEnter, onExit }) {
    this.sim = sim;
    this.playerActor = playerActor;
    this.loadGhost = loadGhost;
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.idle = 0;
    this.active = false;
  }

  /** One frame. `eligible` is true only on a title with nothing else on it. */
  update(dt, eligible) {
    if (!eligible) {
      this.idle = 0;
      if (this.active) this.exit();
      return;
    }
    if (!this.active) {
      this.idle += dt;
      if (this.idle >= IDLE_SECONDS) this.enter();
      return;
    }
    this._advance(dt);
  }

  enter() {
    if (this.active) return;
    this.active = true;
    this.idle = 0;
    const p = this.sim.player;
    this._rest = { d: p.d, x: p.x, y: p.y, heading: p.heading, score: p.score };
    this._loadReplay();
    // With a ghost on record the ghost IS the runner: two figures on one line
    // would read as a race the player is not in. With no ghost, the player's
    // own figure stays on the road — the ask is a running character, and an
    // empty road running by itself is scenery, not an attract.
    this.playerActor?.setVisible(!this.sim.ghost?.active);
    p.score = 0;
    this.onEnter?.();
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.idle = 0;
    const p = this.sim.player;
    this.sim.ghost.load(null);
    this.playerActor?.setVisible(true);
    if (this._rest) {
      p.d = this._rest.d; p.x = this._rest.x; p.y = this._rest.y;
      p.heading = this._rest.heading; p.score = this._rest.score;
      this._rest = null;
    }
    // A pose that jumped this frame must not be interpolated from the last
    // one — that would draw the camera flying back down the road.
    this.sim.viewPrev = null;
    this.onExit?.();
  }

  /** Load the best ghost, but only if it is long enough to watch. */
  _loadReplay() {
    const g = this.sim.ghost;
    g.load(this.loadGhost?.() || null);
    if (g.active && g.duration < MIN_REPLAY_SECONDS) g.load(null);
  }

  _advance(dt) {
    const p = this.sim.player;
    const g = this.sim.ghost;
    if (g?.active) {
      g.step(dt);
      // The replay ends where the run ended — but NOT with the death yank.
      // That animation drags the ghost backwards up the road (it is a
      // silhouette being pulled into the fog), and with the camera following
      // this pose it read as the whole world reversing. The loop restarts at
      // the moment the recording runs out instead.
      if (g.yanking || g.done) {
        this._loadReplay();
        // A replay that cannot reload leaves the road empty; the player's
        // figure comes back so there is still someone running on it.
        this.playerActor?.setVisible(!g.active);
        this.sim.viewPrev = null;   // do not interpolate across the cut
        return;
      }
      p.d = g.d; p.x = g.x; p.y = g.y;
      // The recording carries the line but not the facing, and the camera
      // takes its roll from the heading — so read it off the corridor here
      // too, or the replay runs the right path pointing the wrong way.
      const t = this.sim.terrain;
      p.heading = Math.atan(t.corridorSlope ? t.corridorSlope(p.d) : 0);
      return;
    }
    // No ghost on record: the road simply runs — down the CORRIDOR, the same
    // way a real run does.
    //
    // It used to run down world x = 0, which is not the track. The corridor
    // WINDS: every other system rides `corridorX(d)` — the player's own
    // auto-follow, the verge pylons, the word plates, the bells — and this
    // one line did not. So the figure walked dead straight while the road
    // curved out from under him, and because the camera follows this pose,
    // a title left alone for half a minute ended up staring at the side of a
    // terrain band with the runner stranded off the piste. The bug only ever
    // showed on a profile with no ghost worth replaying, which is exactly the
    // profile a new player has, on the screen they see first.
    const R = TUNING.RUN;
    const terrain = this.sim.terrain;
    p.d += EMPTY_SPEED * dt;
    const target = terrain.corridorX(p.d + R.FOLLOW_AHEAD);
    p.x += (target - p.x) * (1 - Math.exp(-R.FOLLOW_RESPONSE * dt));
    p.heading = Math.atan(terrain.corridorSlope ? terrain.corridorSlope(p.d) : 0);
    p.y = terrain.heightAt(p.x, p.d);
  }
}

export default AttractMode;
