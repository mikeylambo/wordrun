// DESCENT release tuning.
// Keep the game tiny, but give the endless run rhythm: mountain -> hunt -> breath -> hunt.

export const CHASE = {
  // Give the first bell line and first launch a chance to teach the toy before
  // the first committed monster scene arrives.
  FIRST_HUNT_MIN: 14,
  FIRST_HUNT_MAX: 19,
  STALK_GAP_MIN: 52,
  STALK_GAP_MAX: 78,
  HUNT_GAP_EASY: 22,
  HUNT_GAP_DEEP: 7,
  HUNT_MIN: 22,
  HUNT_MAX: 32,
  RELIEF_MIN: 5,
  RELIEF_MAX: 8,

  // V1 cadence: the monster should not become a metronome. After each Relief,
  // deterministic weighted bands create short false-safety, ordinary stalking,
  // and occasional long eerie absences. Immediate band repeats are suppressed
  // by the runtime director, while mistakes can still provoke an early Hunt.
  STALK_SHORT_MIN: 8,
  STALK_SHORT_MAX: 14,
  STALK_NORMAL_MIN: 15,
  STALK_NORMAL_MAX: 25,
  STALK_LONG_MIN: 27,
  STALK_LONG_MAX: 40,
  STALK_SHORT_WEIGHT: 0.27,
  STALK_NORMAL_WEIGHT: 0.50,

  // KEEP GOING never advertises a new mode. The skier receives genuine quiet
  // after the finish before the distant pursuit gradually finds them again.
  RETURN_GRACE_MIN: 8.5,
  RETURN_GRACE_MAX: 12.5,
  RETURN_STALK_MIN: 10,
  RETURN_STALK_MAX: 16,

  // A 15K run is deep play, not "difficulty capped five kilometres ago."
  DEEP_DISTANCE: 18000,
  MISTAKE_HUNT_THRESHOLD: 1.55,
  ESCAPE_GAP: 58,
  ESCAPE_BONUS: 7,
  SIDE_ENTRY_TIME: 1.45,
  SIDE_ENTRY_X: 13,
};

export function applyReleaseTuning(T) {
  if (T.__RC5_RELEASE_TUNED) return T;
  T.__RC5_RELEASE_TUNED = true;

  // DICTION DASH retune: the dodge/trick verb is out, so the release pass no
  // longer re-arms cliffs or moguls — word gates are the only ask.
  T.FEATURES.CLIFF_CHANCE = 0;
  T.FEATURES.MOGUL_CHANCE = 0;
  T.FEATURES.MOGUL_AMP = 0.52;
  T.FEATURES.CLIFF_LIP_H = 1.36;
  T.FEATURES.CLIFF_DROP[0] = 6.8;
  T.FEATURES.CLIFF_DROP[1] = 11.2;
  T.FEATURES.PITCHES.open.cliff = 1.05;
  T.FEATURES.PITCHES.trees.cliff = 0.30;
  T.FEATURES.PITCHES.cliffs.cliff = 3.35;
  T.FEATURES.PITCHES.moguls.cliff = 0.88;
  T.FEATURES.PITCHES.moguls.mogul = 2.85;
  T.PLAYER.JUMP_IMPULSE = 8.45;

  T.BEAST.START_GAP = 66;
  T.BEAST.MAX_GAP = 96;
  T.BEAST.RAMP_PER_1000M = 0;
  T.BEAST.DESIRED_FLOOR = 0;
  T.BEAST.OPEN_RATE = 8.5;
  T.BEAST.CLOSE_RATE = 15;
  T.BEAST.LUNGE_CHANCE_PER_S = 0.30;
  T.BEAST.LUNGE_COOLDOWN = 5.2;
  // GO is decisive, but the physical chase already rewards its real speed.
  T.BEAST.OVERDRIVE_PUSH = 12.5;
  T.BEAST.OVERDRIVE_PUSH_TAIL = 0.62;

  // Getting caught is a reward beat too: quick whip, long readable hold, then
  // the stripped results screen. This restores the earlier kill-cam feeling.
  T.BEAST.KILL_WHIP_TIME = 0.50;
  T.BEAST.KILL_CAM_TIME = 2.20;

  return T;
}
