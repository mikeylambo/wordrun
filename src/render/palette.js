/**
 * WORD RUN base palette — the near-track defaults at run start.
 *
 * Distance-dependent palettes live in art-direction.js. These values are the
 * near-track defaults and the actor colours that must remain stable across
 * every band so the runner keeps their identity.
 */

import { PLAYER_ACCENT, DANGER_RED } from './art-direction.js';

export const PALETTE = {
  FOG: 0x081222,
  SKY: 0x050a12,

  SNOW_LIT: 0x121c2c,
  SNOW_CREST: 0x2e4a66,
  SNOW_MID: 0x0e1624,
  SNOW_SHADE: 0x0a111e,
  POWDER: 0x1a2740,
  ICE: 0x1d5f7c,

  PINE: 0x0d3a4a,
  PINE_DARK: 0x07222c,
  TRUNK: 0x141f2c,
  ROCK: 0x22364a,
  ROCK_DARK: 0x141f2c,

  GATE_POLE: 0x2a3f55,
  GATE_TIP: 0x9fe8ff,

  // The skier gets one deliberate saturated identity colour. Danger still owns
  // red; the player owns glacial cyan.
  PLAYER_BODY: 0x222c36,
  PLAYER_LIGHT: 0xe4edf3,
  PLAYER_DARK: 0x111820,
  PLAYER_SKI: 0x1c242c,
  PLAYER_ACCENT,

  BEAST_BODY: 0x08090b,
  BEAST_SECONDARY: 0x15171a,
  BEAST_EYE: DANGER_RED,
  BEAST_MAW: 0x8f1410,

  GHOST: 0x4a8ba8,
};

/** Cold directional key + hemisphere fill. No warm light anywhere. */
export const LIGHT = {
  KEY_COLOR: 0x9fd8ff,
  KEY_INTENSITY: 1.75,
  KEY_DIR: [-0.62, 0.66, 0.34],
  HEMI_SKY: 0x1e3a55,
  HEMI_GROUND: 0x05080e,
  HEMI_INTENSITY: 0.52,
};

export default PALETTE;
