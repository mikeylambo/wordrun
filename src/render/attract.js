/**
 * RC6 — attract mode.
 *
 * A cabinet is never idle. Ten seconds after the title goes quiet the road
 * starts running behind the wordmark: the player's own BEST RUN ghost runs
 * its recorded line with the HUD score climbing beside it, and the first
 * touch of any kind puts the machine back in the player's hands.
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
 * With no ghost recorded yet, the road runs empty: the camera travels, and
 * the score stays at zero because nothing has scored.
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

export class AttractMode {
  /**
   * @param sim           the live sim — read for terrain, written ONLY as pose
   * @param playerActor   hidden while the ghost is the figure on the road
   * @param loadGhost     () => serialized best ghost, or null
   * @param bestScore     () => the score that ghost earned, or 0
   * @param onEnter/onExit presentation hooks (the HUD, owned by main.js)
   */
  constructor({ sim, playerActor, loadGhost, bestScore, onEnter, onExit }) {
    this.sim = sim;
    this.playerActor = playerActor;
    this.loadGhost = loadGhost;
    this.bestScore = bestScore;
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.idle = 0;
    this.active = false;
    this._best = 0;
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
    this._rest = { d: p.d, x: p.x, y: p.y, score: p.score };
    this._best = this.bestScore?.() || 0;
    this._loadReplay();
    // The ghost IS the runner here. Two figures on one line would read as a
    // race the player is not in.
    this.playerActor?.setVisible(false);
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
      p.score = this._rest.score;
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
        p.score = 0;
        this.sim.viewPrev = null;   // do not interpolate across the cut
        return;
      }
      p.d = g.d; p.x = g.x; p.y = g.y;
      // The score climbs the way it climbed on the night it was set: in
      // proportion to how far through that run the replay has come.
      const dur = g.duration || 0;
      const k = dur > 0 ? Math.max(0, Math.min(1, g.t / dur)) : 0;
      p.score = Math.floor(this._best * k);
      return;
    }
    // No ghost on record: the road simply runs.
    p.d += EMPTY_SPEED * dt;
    p.x = 0;
    p.y = this.sim.terrain.heightAt(0, p.d);
  }
}

export default AttractMode;
