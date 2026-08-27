/**
 * DESCENT base palette.
 *
 * Distance-dependent mountain palettes live in art-direction.js. These values
 * are the near-slope defaults and the actor colours that must remain stable
 * across every band so the skier and creature keep their identities.
 */

import { PLAYER_ACCENT, DANGER_RED } from './art-direction.js';

export const PALETTE = {
  FOG: 0xc9d7e2,
  SKY: 0xc9d7e2,

  SNOW_LIT: 0xf0f5f9,
  SNOW_CREST: 0xffffff,
  SNOW_MID: 0xdde6ef,
  SNOW_SHADE: 0xc5d3df,
  POWDER: 0xd0deea,
  ICE: 0x9fc9e2,

  PINE: 0x294239,
  PINE_DARK: 0x1c302a,
  TRUNK: 0x343739,
  ROCK: 0x727b86,
  ROCK_DARK: 0x565f6b,

  GATE_POLE: 0x7d8996,
  GATE_TIP: 0xe8f7ff,

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

  GHOST: 0x93a3b4,
};

/** Cold directional key + hemisphere fill. No warm light anywhere. */
export const LIGHT = {
  KEY_COLOR: 0xffffff,
  KEY_INTENSITY: 1.75,
  KEY_DIR: [-0.62, 0.66, 0.34],
  HEMI_SKY: 0xe6f1f9,
  HEMI_GROUND: 0x687986,
  HEMI_INTENSITY: 0.52,
};

export default PALETTE;
