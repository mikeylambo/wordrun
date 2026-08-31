/**
 * DICTION DASH's reading of a score map. This is the game-specific half of the
 * music layer: src/music/ describes the music and knows nothing about this
 * game, and this file knows nothing about how the music was analysed. Another
 * project keeps src/music/ verbatim and writes its own version of this file.
 *
 * Three rules shape everything here.
 *
 * MUSIC MODULATES, THE RUN DECIDES. The arrangement can tint the screen but
 * never overrule it. If the track is in a breakdown while the player is mid-
 * dash on an eight-read chain, the payoff still lands — the music only decides
 * how it is coloured. So every music term is a multiplier inside a band that
 * cannot reach zero, never a gate.
 *
 * SCREEN SPACE ONLY. The track is authored from a daily seed and crossed at
 * anywhere from 16 to 64 m/s, so world positions arrive at times no map can
 * predict; a light on every eighth bar would land on the beat only by accident.
 * Music therefore drives camera, post, sky and palette, and never geometry,
 * gates or anything a word is printed on.
 *
 * NOTHING FLASHES ON THE BEAT. 164 BPM is 2.73 beats a second, which is inside
 * the range photosensitivity guidance asks you to stay out of. Discrete visual
 * events key off the half-time snare (about 1.4 Hz) and off crashes, which are
 * rarer still. The kick drives continuous motion only.
 */

// A beat-locked bob big enough to feel and too small to fight the read.
const PULSE_MAX = 0.055;
const PULSE_WINDOW_S = 0.14;
// Music may swing the visual energy by this much either side, and no further.
const DRIVE_BAND = 0.25;
const ACCENT_WINDOW_S = 0.5;

/**
 * @param clock  a MusicClock, already updated this frame (or null when no
 *               track is playing — everything falls back to the run's own state)
 * @param run    { intensity 0..1 } — how hot the run itself is, from chain,
 *               dash and speed. This is the term that wins.
 * @param access { reducedFlash, motionScale }
 */
export function musicResponse(clock, run, access = {}) {
  const intensity = clamp01(run?.intensity ?? 0);
  const motion = access.motionScale ?? 1;
  const flashOk = !access.reducedFlash;

  if (!clock?.playing) {
    return { pulse: 0, accent: 0, shimmer: 0, drive: intensity, calm: false, section: null };
  }

  // Continuous motion, on the kick. Scaled by the run so a slow, careless run
  // is not given the same swagger as a fast clean one.
  const pulse = clock.pulse('kick', PULSE_WINDOW_S) * PULSE_MAX * motion * (0.4 + 0.6 * intensity);

  // Discrete accents, on crashes only — the rarest thing in the map.
  const accent = flashOk ? clock.pulse('crash', ACCENT_WINDOW_S) * motion : 0;

  // Hats are a texture amount, never a trigger.
  const shimmer = clamp01(clock.curve('hat')) * motion;

  // The run sets the level; the arrangement moves it inside a band.
  const energy = clamp01(clock.curve('energy'));
  const drive = clamp01(intensity * (1 - DRIVE_BAND + 2 * DRIVE_BAND * energy));

  // A section with no bass is the track's own quiet moment. It is a hint to
  // the palette, not a reason to stop rewarding the player.
  const section = clock.section;
  const calm = !!section && Array.isArray(section.layers) && !section.layers.includes('bass');

  return { pulse, accent, shimmer, drive, calm, section };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export default musicResponse;
