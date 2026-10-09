/**
 * Hearts — the fail state, and the clean-reading streak that wins one back.
 *
 * (RC14.1: this lived in design/bells.js beside the bell field. The bells were
 * cut at the 10/8 playtest — they were collected automatically, so they were
 * an odometer in a pickup's costume — and hearts kept their own file.)
 */

export const HEARTS = {
  MAX: 3,

  // Phase 23. Hearts used to be repaired by the bell drip inherited from the
  // source game: 7 bells every 295 m, auto-collected off the travel line, one
  // heart per five. Measured, that is ~24 bells and ~4.7 hearts per kilometre
  // — a 70%-accuracy run lost 23 hearts and got all 23 back, so ENDLESS could
  // not be lost by misreading at all. The fail state regenerated faster than
  // anyone could spend it, which is why the mode had no stakes.
  //
  // A heart now comes back for a CLEAN READING STREAK. It is the same reward
  // pointed at the verb the game is about: earned rather than dripped, and it
  // gives a run the arc it never had — down to one heart, and the way back is
  // a run of correct reads you have to actually produce.
  // Indexed by hearts REMAINING: the closer to the end, the shorter the way
  // back. A flat threshold made a cliff — measured, a 70% reader died at
  // 843 m and an 85% reader ran 12 km, because the repair rate crosses the
  // loss rate at about 80% accuracy and nothing either side of it is close.
  // Shortening the ladder under pressure smooths that AND gives a run the
  // shape it never had: on the last heart, a handful of clean reads is a
  // genuine way out, so falling behind becomes a comeback instead of a
  // formality. [unused, 1 heart, 2 hearts]
  STREAK_REPAIR_BY_HEARTS: [3, 3, 5],
  STREAK_REPAIR_DEFAULT: 5,

};
