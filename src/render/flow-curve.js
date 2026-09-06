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

// RC10.8 — 8 -> 50, the third editorial band (BAND_CHAINS[2], the one the
// world calls blooming, and the chain the music layer arrives on).
//
// It used to match BOOST.CHAIN_CAP, and the note said so as though scoring and
// brilliance had to agree. They do not: CHAIN_CAP is where the SCORE stops
// paying per link, and it is a calibrated dial with golden tables behind it.
// Brilliance is presentation. Matching them meant the world reached maximum
// glow, maximum tail and maximum posture economy at chain 8 and then had
// nothing left to say for the next hundred and forty-two reads — every cue
// crested in the first sixth of the range and went flat, which is what
// cue-ladder.js was written to make visible.
//
// At 50 the continuous cues crest WITH the music layer and the blooming band,
// so excellent play arrives somewhere rather than everywhere at once. The
// scoring model is untouched.
const FLOW_CHAIN_CAP = 50;
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
