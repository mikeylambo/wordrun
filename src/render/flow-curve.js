/**
 * Flow curve (Phase 9) — ONE pure mapping from the chain to the world's
 * energy, the mirror of corruption-curve.js on the reward side.
 *
 * The color grammar: saturation/brilliance belongs to FLOW. At chain 0 the
 * world idles slightly dimmed (headroom is the point — brilliance must be
 * earned); each link feeds light back in; past FLOW_PEAK_START the world
 * begins to PULSE — arcade-marquee rhythm, amplitude still bounded so the
 * word plate keeps winning the frame and the Redline's red keeps winning
 * every duel (both machine-checked).
 *
 * Pure: no renderer imports, no sim imports — consumers pass the chain in
 * and multiply the returned factors into their own intensities.
 */

const FLOW_CHAIN_CAP = 8;      // matches BOOST.CHAIN_CAP: full flow at 8 links
const FLOW_PEAK_START = 0.6;   // pulsing begins above this flow level
const GLOW_MIN = 0.78;         // the idle world: dimmed, never dead
const GLOW_MAX = 1.75;         // the earned world: bright, never blinding
const PULSE_HZ = 2.3;          // marquee rhythm at peak
const PULSE_AMP = 0.34;        // bounded: the plate still wins the frame

/** Chain -> flow level 0..1. */
export function flowLevel(chain) {
  return Math.max(0, Math.min(1, (chain || 0) / FLOW_CHAIN_CAP));
}

/** Steady brightness multiplier for world glow at a flow level. */
export function flowGlow(flow) {
  return GLOW_MIN + (GLOW_MAX - GLOW_MIN) * Math.max(0, Math.min(1, flow));
}

/** Marquee pulse factor at time t (seconds) — 1.0 below the peak band. */
export function flowPulse(flow, t) {
  const band = Math.max(0, (flow - FLOW_PEAK_START) / (1 - FLOW_PEAK_START));
  return 1 + Math.sin(t * Math.PI * 2 * PULSE_HZ) * PULSE_AMP * band * band;
}

/** The one number consumers multiply in: glow × pulse. */
export function flowFactor(chain, t) {
  const f = flowLevel(chain);
  return flowGlow(f) * flowPulse(f, t);
}
