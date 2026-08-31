/**
 * One endless run, but a strong one must keep GOING somewhere.
 * Presentation bands only: physics stays continuous while the palette drifts.
 *
 * DICTION DASH naming (Phase 6): the mood arc is unnamed by design. Bands are
 * plain ids with hues, blend math and start distances — the visual variety
 * stays, the literary label layer is gone. The single exception is the
 * canonical 30K band, which carries the game's end-state name, FINISH —
 * one of exactly four approved names in the whole game (with the Redline,
 * CROSSED OUT and TODAY). That set is a ceiling, machine-enforced in
 * tools/corruption-gates.mjs. Phase 21 dropped the last of the literary
 * names — the end state and the daily seed both carried one — because they
 * were doing theme where a plain word does the job.
 */

export const MOUNTAIN_BANDS = [
  {
    id: 'slope', start: 0,
    sky: 0x071226, fog: 0x0b1a30, snow: 0x16243c, crest: 0x3d6690, shade: 0x0c1524,
    powder: 0x223454, ice: 0x2a84aa,
    pine: 0x0d3a4a, pineDark: 0x07222c, rock: 0x22364a, rockDark: 0x141f2c,
    key: 0x9fd8ff, hemiSky: 0x1e3a55, hemiGround: 0x05080e,
    fogNear: 48, fogFar: 205,
  },
  {
    id: 'treeline', start: 900,
    sky: 0x061420, fog: 0x0a1a28, snow: 0x122234, crest: 0x35907a, shade: 0x0a1220,
    powder: 0x1a463c, ice: 0x27b98e,
    pine: 0x0b3240, pineDark: 0x061e26, rock: 0x1d2f41, rockDark: 0x111b26,
    key: 0x8ff5d2, hemiSky: 0x175040, hemiGround: 0x04070c,
    fogNear: 42, fogFar: 180,
  },
  {
    id: 'glacier', start: 2000,
    sky: 0x051218, fog: 0x081c22, snow: 0x102630, crest: 0x2a9260, shade: 0x091419,
    powder: 0x14402e, ice: 0x33cc88,
    pine: 0x0a3a3d, pineDark: 0x052325, rock: 0x18303a, rockDark: 0x0d1b21,
    key: 0x7fe8a8, hemiSky: 0x14472e, hemiGround: 0x030608,
    fogNear: 36, fogFar: 158,
  },
  {
    id: 'cut', start: 3400,
    sky: 0x0a0c22, fog: 0x101334, snow: 0x1a1c44, crest: 0x6153b8, shade: 0x0e1028,
    powder: 0x2e2870, ice: 0x8a70ea,
    pine: 0x1a1c4a, pineDark: 0x0e1029, rock: 0x252856, rockDark: 0x151732,
    key: 0xb2a0ff, hemiSky: 0x342c72, hemiGround: 0x050510,
    fogNear: 31, fogFar: 145,
  },
  {
    id: 'night', start: 5000,
    sky: 0x030612, fog: 0x060c1e, snow: 0x0d1630, crest: 0x3a4da0, shade: 0x070c1a,
    powder: 0x1a2650, ice: 0x5070d0,
    pine: 0x082430, pineDark: 0x04141b, rock: 0x14222f, rockDark: 0x0a121b,
    key: 0x8fa8f0, hemiSky: 0x1c2a56, hemiGround: 0x020408,
    fogNear: 26, fogFar: 128,
  },
  {
    id: 'bones', start: 6800,
    sky: 0x0a080c, fog: 0x100e14, snow: 0x1c1822, crest: 0x8a7448, shade: 0x100e14,
    powder: 0x362e20, ice: 0xb0955c,
    pine: 0x231f2e, pineDark: 0x121019, rock: 0x2a2635, rockDark: 0x18151f,
    key: 0xd8c090, hemiSky: 0x453a26, hemiGround: 0x080709,
    fogNear: 25, fogFar: 122,
  },
  {
    id: 'whiteout', start: 8800,
    sky: 0xd7dce0, fog: 0xd7dce0, snow: 0xe8eaee, crest: 0xffffff, shade: 0xb9bec6,
    powder: 0xcdd2d8, ice: 0xa8d2de,
    pine: 0x9aa4ac, pineDark: 0x7c868e, rock: 0xa8adb3, rockDark: 0x8b9096,
    key: 0xffffff, hemiSky: 0xf5f7f8, hemiGround: 0x7b858a,
    fogNear: 18, fogFar: 95,
  },
  {
    id: 'glass', start: 10800,
    sky: 0x020609, fog: 0x05121a, snow: 0x0a161e, crest: 0x1e5a6a, shade: 0x050d13,
    powder: 0x0f2430, ice: 0x14586e,
    pine: 0x07222c, pineDark: 0x031317, rock: 0x11242e, rockDark: 0x08141b,
    key: 0x82b5ca, hemiSky: 0x173442, hemiGround: 0x020507,
    fogNear: 24, fogFar: 118,
  },
  {
    id: 'afterlight', start: 13200,
    sky: 0x120c0a, fog: 0x1e1410, snow: 0x241a14, crest: 0x8a6a2e, shade: 0x140e0a,
    powder: 0x342a14, ice: 0x9a7c38,
    pine: 0x3a2a1a, pineDark: 0x1e150d, rock: 0x40301f, rockDark: 0x241a10,
    key: 0xf5cf92, hemiSky: 0x584422, hemiGround: 0x0c0806,
    fogNear: 34, fogFar: 150,
  },
  {
    id: 'rust', start: 15600, announce: false,
    sky: 0x100b06, fog: 0x1a130a, snow: 0x221a10, crest: 0x7a5c30, shade: 0x130e08,
    powder: 0x2c2214, ice: 0x66562e,
    pine: 0x38290f, pineDark: 0x1d1507, rock: 0x3e3016, rockDark: 0x231a0c,
    key: 0xf1c98d, hemiSky: 0x463822, hemiGround: 0x0a0704,
    fogNear: 30, fogFar: 138,
  },
  {
    id: 'mouth', start: 17800, announce: false,
    sky: 0x020202, fog: 0x070608, snow: 0x0c0b0e, crest: 0x2c2320, shade: 0x060507,
    powder: 0x121014, ice: 0x27201c,
    pine: 0x161010, pineDark: 0x0a0606, rock: 0x181212, rockDark: 0x0c0808,
    key: 0x9a8072, hemiSky: 0x241d1a, hemiGround: 0x030202,
    fogNear: 22, fogFar: 108,
  },
  {
    id: 'moon', start: 20500, announce: false,
    sky: 0x131722, fog: 0x1c2130, snow: 0x2c3244, crest: 0x8a80b2, shade: 0x1b1f2c,
    powder: 0x3e3a5c, ice: 0x6a5f9c,
    pine: 0x2a3247, pineDark: 0x161b28, rock: 0x39415a, rockDark: 0x232937,
    key: 0xe9e2ff, hemiSky: 0x565078, hemiGround: 0x0e1119,
    fogNear: 40, fogFar: 165,
  },
  {
    id: 'deep-moon', start: 23000, announce: false,
    sky: 0x050b18, fog: 0x0a1424, snow: 0x101d33, crest: 0x2d4e78, shade: 0x0a1220,
    powder: 0x162743, ice: 0x1f4a74,
    pine: 0x0c2440, pineDark: 0x061424, rock: 0x172c48, rockDark: 0x0d1a2b,
    key: 0xb8d7f0, hemiSky: 0x1f3c5e, hemiGround: 0x050a12,
    fogNear: 34, fogFar: 174,
  },
  {
    id: 'high-night', start: 25000, announce: false,
    sky: 0x02050c, fog: 0x060d1a, snow: 0x0a1424, crest: 0x323f80, shade: 0x060c16,
    powder: 0x101c31, ice: 0x2a3a78,
    pine: 0x071b30, pineDark: 0x030e1a, rock: 0x112239, rockDark: 0x081221,
    key: 0xa8b8ff, hemiSky: 0x202c58, hemiGround: 0x03060c,
    fogNear: 28, fogFar: 155,
  },
  {
    id: 'still-night', start: 27000, announce: false,
    sky: 0x010409, fog: 0x040a13, snow: 0x081120, crest: 0x1e3c5e, shade: 0x040a13,
    powder: 0x0d1829, ice: 0x163854,
    pine: 0x051726, pineDark: 0x020b13, rock: 0x0d1d31, rockDark: 0x060f1c,
    key: 0x91c2e7, hemiSky: 0x142c46, hemiGround: 0x02050a,
    fogNear: 30, fogFar: 168,
  },
  {
    id: 'false-dawn', start: 28000, announce: false,
    sky: 0x120e24, fog: 0x1b1631, snow: 0x241e40, crest: 0x7a4e9c, shade: 0x151129,
    powder: 0x2e2750, ice: 0x5c3d8a,
    pine: 0x241e44, pineDark: 0x131026, rock: 0x2c2550, rockDark: 0x191532,
    key: 0xc490d8, hemiSky: 0x4c3572, hemiGround: 0x0b0916,
    fogNear: 36, fogFar: 190,
  },
  {
    id: 'first-light', start: 29200, announce: false,
    sky: 0x241c30, fog: 0x342a41, snow: 0x40344e, crest: 0xa88a8c, shade: 0x2a2236,
    powder: 0x50415f, ice: 0x8a7f9c,
    pine: 0x352a44, pineDark: 0x1d1626, rock: 0x443754, rockDark: 0x282033,
    key: 0xf0b088, hemiSky: 0x5e5170, hemiGround: 0x171224,
    fogNear: 44, fogFar: 225,
  },
  {
    id: 'dawn', name: 'FINISH', start: 30000, announce: false,
    sky: 0x3d5b78, fog: 0x567088, snow: 0x77909f, crest: 0xe2d9b8, shade: 0x5a7181,
    powder: 0x8aa0ae, ice: 0x8ac2c8,
    pine: 0x2a5560, pineDark: 0x173239, rock: 0x4c6673, rockDark: 0x30454f,
    key: 0xffd8a8, hemiSky: 0x8aa5b5, hemiGround: 0x2c3f49,
    fogNear: 56, fogFar: 280,
  },
  {
    id: 'morning', start: 31500, announce: false,
    sky: 0x6fa3c4, fog: 0x8db3c8, snow: 0xb8d2de, crest: 0xfff8e2, shade: 0x92adbb,
    powder: 0xc3d8e0, ice: 0x8fd0e6,
    pine: 0x2a6a70, pineDark: 0x174045, rock: 0x5a7884, rockDark: 0x3a525c,
    key: 0xffe4b8, hemiSky: 0xcde9f6, hemiGround: 0x527078,
    fogNear: 68, fogFar: 330,
  },
  {
    id: 'halo', start: 75000, announce: false,
    sky: 0x84bcd8, fog: 0xa9cfdf, snow: 0xcde2ea, crest: 0xffffff, shade: 0xa5c2cd,
    powder: 0xd4e5ea, ice: 0x9adcee,
    pine: 0x2f7a74, pineDark: 0x1c4a46, rock: 0x648489, rockDark: 0x425e63,
    key: 0xffe7bd, hemiSky: 0xdcf2fc, hemiGround: 0x5d7f7f,
    fogNear: 72, fogFar: 350,
  },
  {
    id: 'crown', start: 100000, announce: false,
    sky: 0x5f9ecb, fog: 0x94c2da, snow: 0xdceef2, crest: 0xffffff, shade: 0xb3cdd6,
    powder: 0xdfeef0, ice: 0x86cfe8,
    pine: 0x2a7a68, pineDark: 0x164237, rock: 0x5d7d82, rockDark: 0x3d585e,
    key: 0xffedc9, hemiSky: 0xeafaff, hemiGround: 0x5f8a80,
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
