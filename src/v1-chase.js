// V1 pursuit director — retired in DICTION DASH Phase 7.
//
// The cadence bands, keep-going pursuit resumption and return audio all
// computed HOW aggressively the pursuer hunted. The Redline now runs at one
// steady baseline pace and the gap is purely the speed differential over
// time (sim/beast.js), so there is nothing left to direct. The export
// surface stays for any layer that still imports it.

export const V1_CHASE = { retired: true };

globalThis.__DASH_V1_CHASE = {
  version: 'phase7',
  retired: true,
  pursuit: 'pure-speed-differential',
};
