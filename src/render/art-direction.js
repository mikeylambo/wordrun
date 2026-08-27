/**
 * One endless mountain, but a strong run must keep GOING somewhere.
 * Presentation bands only: physics stays continuous while the palette drifts.
 *
 * V1 turns the late run into one impossible alpine day. Past AFTERLIGHT the
 * bands stop announcing themselves: players discover night, dawn and prestige
 * skies by surviving long enough to see them. The canonical arc resolves at
 * 30K; Overrun keeps the morning mountain going indefinitely.
 */

export const MOUNTAIN_BANDS = [
  {
    id: 'slope', name: 'THE SLOPE', start: 0,
    sky: 0xc9d7e2, fog: 0xc9d7e2, snow: 0xf0f5f9, crest: 0xffffff,
    shade: 0xc5d3df, powder: 0xd0deea, ice: 0x9fc9e2,
    pine: 0x294239, pineDark: 0x1c302a, rock: 0x727b86, rockDark: 0x565f6b,
    key: 0xffffff, hemiSky: 0xe6f1f9, hemiGround: 0x687986,
    fogNear: 48, fogFar: 205,
  },
  {
    id: 'treeline', name: 'TREELINE', start: 900,
    sky: 0xaebdca, fog: 0xaebdca, snow: 0xe4eaf0, crest: 0xf6f8fa,
    shade: 0xaebbc7, powder: 0xbac8d4, ice: 0x8ab5cf,
    pine: 0x172d28, pineDark: 0x10211e, rock: 0x626975, rockDark: 0x484e58,
    key: 0xe9f4ff, hemiSky: 0xcbdbe7, hemiGround: 0x4f5b63,
    fogNear: 42, fogFar: 180,
  },
  {
    id: 'glacier', name: 'BLUE ICE', start: 2000,
    sky: 0x8298aa, fog: 0x8298aa, snow: 0xd9e5ee, crest: 0xf1fbff,
    shade: 0x8fa7ba, powder: 0x9db4c6, ice: 0x67b4db,
    pine: 0x172625, pineDark: 0x0d1818, rock: 0x4d5663, rockDark: 0x303843,
    key: 0xcdeaff, hemiSky: 0xaec8d9, hemiGround: 0x394851,
    fogNear: 36, fogFar: 158,
  },
  {
    id: 'cut', name: 'THE CUT', start: 3400,
    sky: 0x657785, fog: 0x657785, snow: 0xd0dae1, crest: 0xedf4f7,
    shade: 0x7d8d99, powder: 0x8d9da9, ice: 0x568daa,
    pine: 0x11191a, pineDark: 0x080d0e, rock: 0x343b43, rockDark: 0x20262c,
    key: 0xc3d9e3, hemiSky: 0x879ca9, hemiGround: 0x272f35,
    fogNear: 31, fogFar: 145,
  },
  {
    id: 'night', name: 'NIGHT RUN', start: 5000,
    sky: 0x354552, fog: 0x354552, snow: 0xbecbd4, crest: 0xdfeaf0,
    shade: 0x596b78, powder: 0x687b88, ice: 0x467e9c,
    pine: 0x0c1214, pineDark: 0x050809, rock: 0x272e35, rockDark: 0x171c21,
    key: 0x9ec9dc, hemiSky: 0x5f7888, hemiGround: 0x182126,
    fogNear: 26, fogFar: 128,
  },
  {
    id: 'bones', name: 'THE BONES', start: 6800,
    sky: 0x2d343d, fog: 0x303842, snow: 0xc8c7c3, crest: 0xeee8df,
    shade: 0x706f70, powder: 0x817f7d, ice: 0x4d7586,
    pine: 0x111111, pineDark: 0x060606, rock: 0x332f31, rockDark: 0x1d1a1b,
    key: 0xd6c7b8, hemiSky: 0x6e6870, hemiGround: 0x211d20,
    fogNear: 25, fogFar: 122,
  },
  {
    id: 'whiteout', name: 'WHITEOUT', start: 8800,
    sky: 0xd7dce0, fog: 0xd7dce0, snow: 0xf3f2ef, crest: 0xffffff,
    shade: 0xc3c7ca, powder: 0xd9dddf, ice: 0xb4d7df,
    pine: 0x3c4447, pineDark: 0x252b2e, rock: 0x6b7074, rockDark: 0x505559,
    key: 0xffffff, hemiSky: 0xf5f7f8, hemiGround: 0x7b858a,
    fogNear: 18, fogFar: 95,
  },
  {
    id: 'glass', name: 'BLACK GLASS', start: 10800,
    sky: 0x18212a, fog: 0x1d2730, snow: 0x8fa0aa, crest: 0xb9cbd3,
    shade: 0x455662, powder: 0x596975, ice: 0x274c61,
    pine: 0x070b0d, pineDark: 0x020405, rock: 0x161b20, rockDark: 0x090c0f,
    key: 0x82b5ca, hemiSky: 0x3c5665, hemiGround: 0x0b1014,
    fogNear: 24, fogFar: 118,
  },
  {
    id: 'afterlight', name: 'AFTERLIGHT', start: 13200,
    sky: 0x52616f, fog: 0x586775, snow: 0xd8dde0, crest: 0xf8f3ea,
    shade: 0x8c9297, powder: 0xa1a7aa, ice: 0x6f9daf,
    pine: 0x15191b, pineDark: 0x090b0c, rock: 0x3f4247, rockDark: 0x25282c,
    key: 0xf0c6a5, hemiSky: 0x9da8b1, hemiGround: 0x34373b,
    fogNear: 34, fogFar: 150,
  },
  {
    id: 'rust', name: 'OLD SNOW', start: 15600, announce: false,
    sky: 0x5b5658, fog: 0x615c5e, snow: 0xd8d1ca, crest: 0xf4e9dc,
    shade: 0x948984, powder: 0xa79a92, ice: 0x7f9092,
    pine: 0x241817, pineDark: 0x0d0909, rock: 0x4e3c3a, rockDark: 0x291f1e,
    key: 0xf1b08d, hemiSky: 0xa8948e, hemiGround: 0x3b2b2a,
    fogNear: 30, fogFar: 138,
  },
  {
    id: 'mouth', name: 'DEEP CUT', start: 17800, announce: false,
    sky: 0x16191d, fog: 0x1e2126, snow: 0xa7adb0, crest: 0xd8dcdd,
    shade: 0x50565a, powder: 0x666c70, ice: 0x3d5962,
    pine: 0x050607, pineDark: 0x010202, rock: 0x131518, rockDark: 0x070809,
    key: 0xb74c3f, hemiSky: 0x42464c, hemiGround: 0x0a0b0d,
    fogNear: 22, fogFar: 108,
  },
  {
    id: 'moon', name: 'MOON SNOW', start: 20500, announce: false,
    sky: 0x7f8792, fog: 0x87909a, snow: 0xe8e8e2, crest: 0xffffff,
    shade: 0xa9adb1, powder: 0xbfc1c1, ice: 0x98bdc6,
    pine: 0x1b2023, pineDark: 0x090c0e, rock: 0x51565c, rockDark: 0x2d3136,
    key: 0xe6edf3, hemiSky: 0xcbd2da, hemiGround: 0x555c63,
    fogNear: 40, fogFar: 165,
  },
  {
    id: 'deep-moon', name: 'DEEP MOUNTAIN', start: 23000, announce: false,
    sky: 0x182337, fog: 0x1d293a, snow: 0xb8c6d1, crest: 0xe9f3fa,
    shade: 0x66798a, powder: 0x7e8f9e, ice: 0x4b7796,
    pine: 0x071016, pineDark: 0x03070b, rock: 0x202b35, rockDark: 0x10171e,
    key: 0xb8d7f0, hemiSky: 0x536b82, hemiGround: 0x111c25,
    fogNear: 34, fogFar: 174,
  },
  {
    id: 'high-night', name: 'HIGH NIGHT', start: 25000, announce: false,
    sky: 0x081421, fog: 0x101b28, snow: 0x9eafbd, crest: 0xd6e8f4,
    shade: 0x4a6072, powder: 0x617486, ice: 0x3a6789,
    pine: 0x03080c, pineDark: 0x010304, rock: 0x111b24, rockDark: 0x070d12,
    key: 0x9fcdf0, hemiSky: 0x38546c, hemiGround: 0x08121a,
    fogNear: 28, fogFar: 155,
  },
  {
    id: 'still-night', name: 'THE STILL', start: 27000, announce: false,
    sky: 0x060c16, fog: 0x0e1721, snow: 0x93a5b2, crest: 0xd1e2ec,
    shade: 0x405465, powder: 0x566a79, ice: 0x315d7a,
    pine: 0x020507, pineDark: 0x000102, rock: 0x0c141b, rockDark: 0x04080c,
    key: 0x91c2e7, hemiSky: 0x30495e, hemiGround: 0x060d13,
    fogNear: 30, fogFar: 168,
  },
  {
    id: 'false-dawn', name: 'FALSE DAWN', start: 28000, announce: false,
    sky: 0x28253a, fog: 0x343144, snow: 0xbab9c3, crest: 0xe9e4e8,
    shade: 0x696778, powder: 0x7e7a89, ice: 0x5c7188,
    pine: 0x0b0a12, pineDark: 0x040407, rock: 0x24222c, rockDark: 0x121119,
    key: 0xaf7890, hemiSky: 0x6c647f, hemiGround: 0x211d29,
    fogNear: 36, fogFar: 190,
  },
  {
    id: 'first-light', name: 'FIRST LIGHT', start: 29200, announce: false,
    sky: 0x615b70, fog: 0x77717f, snow: 0xd5cdd1, crest: 0xf8eee6,
    shade: 0x91858d, powder: 0xa79aa0, ice: 0x8397a7,
    pine: 0x17141a, pineDark: 0x08070a, rock: 0x403943, rockDark: 0x242028,
    key: 0xe6a17f, hemiSky: 0xa092a5, hemiGround: 0x443943,
    fogNear: 44, fogFar: 225,
  },
  {
    id: 'dawn', name: 'DAWN', start: 30000, announce: false,
    sky: 0x91a9ba, fog: 0xaeb7b9, snow: 0xeee8dd, crest: 0xfffbef,
    shade: 0xb7aeb0, powder: 0xc8c1bc, ice: 0xa9c5ce,
    pine: 0x25302d, pineDark: 0x111715, rock: 0x625a58, rockDark: 0x393433,
    key: 0xffd0a0, hemiSky: 0xc9d6dc, hemiGround: 0x75665f,
    fogNear: 56, fogFar: 280,
  },
  {
    id: 'morning', name: 'MORNING', start: 31500, announce: false,
    sky: 0xa8cada, fog: 0xb9ced8, snow: 0xf4f7f6, crest: 0xffffff,
    shade: 0xc7d2d5, powder: 0xdbe2e3, ice: 0xa7d4e4,
    pine: 0x26463c, pineDark: 0x14281f, rock: 0x6a7274, rockDark: 0x454d50,
    key: 0xffe0b5, hemiSky: 0xe4f4fb, hemiGround: 0x718a85,
    fogNear: 68, fogFar: 330,
  },
  {
    id: 'halo', name: 'HALO', start: 75000, announce: false,
    sky: 0x8ec4df, fog: 0xb9d5e1, snow: 0xf6f9f8, crest: 0xffffff,
    shade: 0xc6d7dc, powder: 0xe0e8e8, ice: 0x9dd7eb,
    pine: 0x244a3d, pineDark: 0x11261e, rock: 0x667477, rockDark: 0x414c4f,
    key: 0xffe7bd, hemiSky: 0xe9f7ff, hemiGround: 0x75918a,
    fogNear: 72, fogFar: 350,
  },
  {
    id: 'crown', name: 'CROWN', start: 100000, announce: false,
    sky: 0x6fa5cb, fog: 0xa6c8da, snow: 0xfbfcfa, crest: 0xffffff,
    shade: 0xbdced5, powder: 0xe1e9e8, ice: 0x88cce7,
    pine: 0x1d4336, pineDark: 0x0c2219, rock: 0x5d6b70, rockDark: 0x39464b,
    key: 0xffedc9, hemiSky: 0xf0fbff, hemiGround: 0x6f8d85,
    fogNear: 78, fogFar: 370,
  },
];

export const PLAYER_ACCENT = 0x67d8ff;
export const DANGER_RED = 0xff2a1f;

export function bandIndex(distance) {
  let index = 0;
  for (let i = 1; i < MOUNTAIN_BANDS.length; i++) {
    if (distance >= MOUNTAIN_BANDS[i].start) index = i;
    else break;
  }
  return index;
}

export function bandForDistance(distance) {
  return MOUNTAIN_BANDS[bandIndex(Math.max(0, distance))];
}

export function bandBlend(distance, transition = 220) {
  const d = Math.max(0, distance);
  const current = bandIndex(d);
  if (current >= MOUNTAIN_BANDS.length - 1) return { from: current, to: current, t: 0 };
  const nextStart = MOUNTAIN_BANDS[current + 1].start;
  // Late-run lighting should feel like the sky changing over kilometres, not a
  // palette switch when a hidden threshold is crossed.
  const width = nextStart >= 13200 ? Math.max(transition, 760) : transition;
  const begin = nextStart - width;
  if (d <= begin) return { from: current, to: current, t: 0 };
  const raw = Math.max(0, Math.min(1, (d - begin) / width));
  const t = raw * raw * (3 - 2 * raw);
  return { from: current, to: current + 1, t };
}
