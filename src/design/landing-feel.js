// RC7.1 landing feel.
// The player still has to finish a rotation. This only makes a deliberate
// neutral square-up in the final metres before contact count the way it looks.

const TAU = Math.PI * 2;
const wrapPi = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
};

export function applyLandingFeel(Player, TUNING) {
  const proto = Player?.prototype;
  if (!proto || proto.__rc71LandingPatched) return;
  proto.__rc71LandingPatched = true;

  const A = TUNING.AIR;
  const HEIGHT = 2.35;
  const GRACE = 0.18;
  const NEUTRAL = 0.13;
  const CURRENT_MULT = 1.65;
  const BEST_MULT = 1.14;

  const clearAssist = (p) => {
    p._rc71LandingWindow = 0;
    p._rc71BestYaw = Infinity;
    p._rc71BestPitch = Infinity;
  };

  const baseReset = proto.reset;
  proto.reset = function resetRC71() {
    baseReset.call(this);
    clearAssist(this);
  };

  const baseStep = proto.step;
  proto.step = function stepRC71(dt, input, ...rest) {
    if (this.airborne) {
      const ground = this.terrain.heightAt(this.x, this.d);
      const clearance = this.y - ground;
      const neutral = Math.abs(input.carve || 0) <= NEUTRAL && Math.abs(input.flip || 0) <= NEUTRAL;

      if (neutral && clearance >= -0.05 && clearance <= HEIGHT) {
        let yawErr = wrapPi(this.yaw);
        let pitchErr = wrapPi(this.pitch);

        // When the player has visibly stopped rotating near the snow, let the
        // body finish settling toward the nearest complete rotation. It never
        // rescues a half-finished spin: the assist only engages reasonably near
        // upright and only while the trick inputs are released.
        if (Math.abs(yawErr) < A.CLEAN_YAW * 2.25 && Math.abs(pitchErr) < A.CLEAN_PITCH * 2.25) {
          const k = (1 - Math.exp(-7.5 * dt)) * 0.58;
          this.yaw -= yawErr * k;
          this.pitch -= pitchErr * k;
          yawErr = wrapPi(this.yaw);
          pitchErr = wrapPi(this.pitch);
        }

        this._rc71LandingWindow = GRACE;
        this._rc71BestYaw = Math.min(this._rc71BestYaw, Math.abs(yawErr));
        this._rc71BestPitch = Math.min(this._rc71BestPitch, Math.abs(pitchErr));
      } else if (!neutral) {
        // Continuing to spin/flip cancels the square-up commitment.
        clearAssist(this);
      } else {
        this._rc71LandingWindow = Math.max(0, this._rc71LandingWindow - dt);
      }
    } else {
      clearAssist(this);
    }

    return baseStep.call(this, dt, input, ...rest);
  };

  const baseLand = proto._land;
  proto._land = function landRC71(proxMult, events, vyGround) {
    const yawNow = Math.abs(wrapPi(this.yaw));
    const pitchNow = Math.abs(wrapPi(this.pitch));
    const assisted = this._rc71LandingWindow > 0 &&
      this._rc71BestYaw <= A.CLEAN_YAW * BEST_MULT &&
      this._rc71BestPitch <= A.CLEAN_PITCH * BEST_MULT &&
      yawNow <= A.CLEAN_YAW * CURRENT_MULT &&
      pitchNow <= A.CLEAN_PITCH * CURRENT_MULT;

    if (assisted) {
      // Snap only the residual wrapped error. Full completed turns remain full
      // completed turns for trick accounting.
      this.yaw -= wrapPi(this.yaw);
      this.pitch -= wrapPi(this.pitch);
    }

    const out = baseLand.call(this, proxMult, events, vyGround);
    if (this.lastLanding) this.lastLanding.assisted = assisted;
    clearAssist(this);
    return out;
  };
}

export default applyLandingFeel;
