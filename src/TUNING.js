/**
 * DESCENT — single source of truth for every tunable number.
 *
 * Rule: no magic numbers anywhere else in src/sim or src/render. If you find
 * yourself typing a float into a system file, it belongs here instead.
 *
 * Units: metres, seconds, radians. Distance ("d") is downhill travel and always
 * increases. Lateral ("x") is signed, 0 = centre of the ribbon.
 */

export const TUNING = {
  // ── Simulation ──────────────────────────────────────────────────────────
  SIM: {
    HZ: 60,                    // fixed timestep rate; render is decoupled
    DT: 1 / 60,
    MAX_STEPS_PER_FRAME: 5,    // spiral-of-death guard
  },

  // ── Terrain ─────────────────────────────────────────────────────────────
  TERRAIN: {
    GRADE: 0.30,               // mean fall per metre of downhill travel (~16.7 deg)

    // ── Grade modulation ───────────────────────────────────────────────────
    // The mountain used to be one constant slope for its entire length, so a
    // run had no shape and steepness meant nothing. Two sine terms give it
    // long rollers: steep pitches where you fly, shallow ones where your speed
    // dies and the beast closes. Both terms are analytically integrable, so
    // the height field stays exact and smooth — see baseHeight().
    // Grade ranges over GRADE * (1 +/- (AMP_A + AMP_B)).
    GRADE_AMP_A: 0.28, GRADE_WAVE_A: 420,
    GRADE_AMP_B: 0.14, GRADE_WAVE_B: 170,
    HALF_WIDTH: 20,            // ribbon is 40u wide (brief)
    POWDER_X: 17.5,            // beyond this you are in deep powder
    POWDER_WALL_GAIN: 0.55,    // how fast the banks rise past HALF_WIDTH
    POWDER_WALL_EXP: 1.55,
    POWDER_WALL_CAP: 9,

    CHUNK_LEN: 60,             // metres of downhill per chunk
    CHUNKS_AHEAD: 6,
    CHUNKS_BEHIND: 1,

    // Gentle rolling noise (deterministic sin-sum, phases drawn from the seed)
    ROLL_A_AMP: 0.90, ROLL_A_FD: 0.037, ROLL_A_FX: 0.031,
    ROLL_B_AMP: 0.45, ROLL_B_FD: 0.093, ROLL_B_FX: 0.071,

    // Mesh resolution per chunk
    SEGS_X: 30,
    SEGS_Z: 48,
  },

  // ── The run (Phase 7) ───────────────────────────────────────────────────
  // Speed is a direct consequence of reading: a correct read adds SPEED_GAIN,
  // a wrong read subtracts SPEED_LOSS (and costs a heart), bounded by FLOOR
  // and CEILING. The Redline runs at a steady REDLINE_PACE, and the gap is
  // purely the speed differential integrated over time — the relationship
  // between FLOOR/CEILING and REDLINE_PACE is the main difficulty knob.
  RUN: {
    START_SPEED: 27,           // = REDLINE_PACE: a run starts neutral
    SPEED_GAIN: 2.5,           // m/s added per correct read
    // Both wrong reads lose this much speed, but only tapping a fake
    // (commission) also costs a heart + stagger + meter. Letting a real
    // word slip (omission) is speed-only: the Redline is its punisher.
    SPEED_LOSS: 6,
    // FLOOR: repeated misses slow you, never stall you — reading window at
    // the floor is ARM_DISTANCE_M/16 ≈ 3.4s, an easy recovery pace.
    FLOOR: 16,
    // CEILING: gated against legibility — 55m/40 = 1.38s plain, and still
    // ≥0.9s under Overdrive's 1.4x. A long streak cannot spiral past it.
    CEILING: 40,
    REDLINE_PACE: 27,          // the Redline's steady baseline, m/s

    // The authored winding (Sonic-tradition S-curves, no player steering):
    // peak |dx/dd| = 2π(AMP_A/WAVE_A + AMP_B/WAVE_B) ≈ 0.43 — sweeping,
    // never snapping.
    CURVE_AMP_A: 11, CURVE_WAVE_A: 320,
    CURVE_AMP_B: 4.5, CURVE_WAVE_B: 130,
    TRACK_HALF_W: 7,           // ribbon half-width around the centerline
    FOLLOW_AHEAD: 6,           // metres ahead the runner aims on the line
    FOLLOW_RESPONSE: 7,        // how quickly the runner settles onto it
  },

  // ── Word gates (the WORD RUN verb) ──────────────────────────────────────
  // A word arrives at runner speed; the player confirms it (tap) or lets it
  // pass. Real+confirmed / fake+ignored = clean gate. Fake+confirmed = the
  // hit (heart). Real+missed = speed loss only — the Redline punishes slow.
  // Gates are spaced in METRES, so the speed your reading earns is also your
  // reading difficulty — one system, shared.
  WORDS: {
    FIRST_GATE_M: 90,          // matches FEATURES.SAFE_START (fair start)
    SPACING_M: 85,             // metres of downhill between gates at the top
    // Spawn rate ramps the way the beast does (RAMP_PER_1000M precedent):
    // gates pack closer as the run deepens, never below the floor — and the
    // floor stays above ARM_DISTANCE_M so one word is in play at a time.
    SPACING_RAMP_PER_1000M: 4, // metres of spacing lost per 1000m travelled
    SPACING_MIN_M: 62,
    // The word must be legible for the whole approach. ARM distance is where
    // the plate becomes readable and the answer window opens.
    ARM_DISTANCE_M: 55,
    FAKE_CHANCE: 0.5,          // fair coin: spamming confirm buys nothing
    // Tier ramps with distance, sharing the run's own ramp architecture.
    TIER_EVERY_M: 700,         // +1 tier per this many metres, clamped
    // Speed consequences live in TUNING.RUN (Phase 7); words keep only the
    // meter economy here.
    CORRECT_FILL: 6,           // boost meter per correct read (chain-multiplied)
    WRONG_METER_LOSS: 0.5,     // = BOOST.FLUB_METER_LOSS
    // Legibility floor (the falsifiable question, made checkable): at speed v
    // the reading window is ARM_DISTANCE_M / v seconds. The word-gates suite
    // asserts this stays above READ_WINDOW_MIN_S at the shipped top speed.
    READ_WINDOW_MIN_S: 1.15,
  },

  // ── Features / obstacles (per chunk, seeded) ────────────────────────────
  // WORD RUN retune: the dodge verb is out, so nothing solid spawns and the
  // slalom gates are off — word gates are the only thing the mountain asks
  // of you. Structure kept (values retune, structure won't — brief).
  FEATURES: {
    TREE_COUNT: [0, 0],        // inclusive range rolled per chunk
    ROCK_COUNT: [0, 0],
    ICE_CHANCE: 0,
    GATE_CHANCE: 0,
    MOGUL_CHANCE: 0,
    // Cliffs are part of the dodge/trick verb — off in WORD RUN. A word
    // arriving while you are ballistic with no steering would be a cheap hit
    // (fairness is priority 2 in the brief), so the ground stays under you.
    CLIFF_CHANCE: 0,

    // Nothing spawns in the first N metres of a run (fair start)
    SAFE_START: 90,

    // ── Pitches ────────────────────────────────────────────────────────────
    // Every 60m of mountain used to be statistically identical to every other
    // 60m, so runs had no story — they only got harder because the beast
    // ramped. The descent is now a sequence of pitches with their own
    // character, which is what lets a player PLAN ("don't burn boost here,
    // the trees are coming") instead of only reacting.
    //
    // This is not the biome switching the brief rules out: the palette stays
    // alpine throughout. It is density and terrain character only.
    PITCH_CHUNKS: 5,           // 300m per pitch
    PITCHES: {
      // multipliers on the base counts and chances below
      open:   { tree: 0.35, rock: 0.55, cliff: 0.55, mogul: 0.6, gate: 1.5, ice: 0.8 },
      trees:  { tree: 1.95, rock: 1.25, cliff: 0.15, mogul: 0.5, gate: 0.5, ice: 1.0 },
      cliffs: { tree: 0.40, rock: 0.50, cliff: 2.60, mogul: 1.2, gate: 0.6, ice: 0.7 },
      moguls: { tree: 0.75, rock: 1.40, cliff: 0.40, mogul: 2.2, gate: 0.9, ice: 1.4 },
    },
    // The first pitch is always `open` so a run starts readable.
    PITCH_ORDER: ['open', 'trees', 'cliffs', 'moguls'],

    // ── The reserved line ──────────────────────────────────────────────────
    // Purely random placement occasionally walls the ribbon off completely: an
    // unwinnable 40u fence that no amount of skill gets through. This reserves
    // a wandering carving line that solids never spawn in, so a clean line
    // always exists. It is not the ONLY line — natural gaps are everywhere —
    // just a promise that one exists. Phases come from the run seed, so the
    // shape differs every day.
    //
    // Three constraints on the shape, all learned the hard way:
    //   * HALF_W must exceed the widest obstacle's blocked extent (ROCK_RADIUS
    //     + clearance), or a rock sitting just outside the line still walls off
    //     its centreline and the guarantee is worthless.
    //   * Max |dx/dd| = AMP_A*2pi/WAVE_A + AMP_B*2pi/WAVE_B must stay well under
    //     the player's lateral capability (tan(MAX_CARVE) ~= 1.14 m per m).
    //   * Gentler still than that, because a big air costs ~1.2s with no
    //     steering at all. A line that whips across the ribbon during that is
    //     unfollowable by construction. Current max ~= 0.30.
    CORRIDOR_AMP_A: 6.0, CORRIDOR_WAVE_A: 220,
    CORRIDOR_AMP_B: 2.2, CORRIDOR_WAVE_B: 110,
    CORRIDOR_HALF_W: 3.6,

    TREE_RADIUS: 1.15,
    TREE_HEIGHT: 6.5,
    ROCK_RADIUS: 1.35,
    ROCK_HEIGHT: 1.9,
    GATE_POLE_RADIUS: 0.35,
    GATE_POLE_HEIGHT: 3.0,
    GATE_HALF_SPAN: [2.6, 5.0], // half-distance between the two poles

    ICE_HALF_X: 5.5,
    ICE_HALF_D: 9.0,

    MOGUL_HALF_X: 8.5,
    MOGUL_HALF_D: 15.0,
    MOGUL_AMP: 0.35,           // peak-to-trough
    MOGUL_WAVE_D: 9.0,
    MOGUL_WAVE_X: 6.0,

    CLIFF_HALF_X: [7, 11],     // lateral extent of the chute
    // Gap the chute must leave beside the reserved carving line.
    CLIFF_LINE_CLEARANCE: 3.5,
    CLIFF_LIP_H: 0.95,         // kicker height just before the edge
    CLIFF_LIP_SPREAD: 3.0,
    CLIFF_DROP: [5.5, 8.5],    // vertical drop
    CLIFF_FALL_LEN: 4.0,       // how quickly the floor falls away
    CLIFF_RECOVER_START: 16,   // gully climbs back to grade between these
    CLIFF_RECOVER_LEN: 18,
    // Flight path + landing zone kept free of solids. A cliff throws you 4-6m
    // off your line with no steering authority; if trees flank the landing, the
    // brave line is punished for being brave.
    CLIFF_LANDING_LEN: 50,
    CLIFF_LANDING_PAD: 5,
    // The APPROACH is reserved too, not just the landing. Measured: a driver
    // that detours to cliffs took 5.1 hits per run against a survivor's 1.9,
    // and lost 1100m for its trouble — because leaving the clean line to reach
    // a chute meant crossing the trees that flank it. A cliff you can see has
    // to be a cliff you can reach, or the brave line is punished twice and
    // "courage pays" is a lie the tuning tells.
    CLIFF_APPROACH_LEN: 42,
    // The approach widens into a funnel as it runs back upslope, because you
    // arrive from wherever you happened to be — usually the clean line, which
    // can be fifteen metres away. A straight-sided approach only helps someone
    // already lined up, which is nobody.
    CLIFF_APPROACH_FLARE: 0.26,
  },

  // ── Player: carve + speed ───────────────────────────────────────────────
  PLAYER: {
    START_SPEED: 14,
    SPEED_TUCK: 34,            // straight-line terminal velocity
    SPEED_CARVE_MIN: 13,       // terminal velocity at full lock
    TUCK_EXP: 2.2,             // how sharply carving scrubs the target
    // Steeper is faster, shallow is slower. Without this the grade is pure
    // decoration and "the flats" cannot exist as a place you dread.
    GRADE_SPEED_GAIN: 0.42,
    ACCEL: 6.5,                // m/s^2 toward target when under
    DECEL: 15.0,               // m/s^2 toward target when over (edge scrub)
    SPEED_FLOOR: 6,

    MAX_CARVE: 0.85,           // radians of heading at full drag (~49 deg)
    CARVE_RESPONSE: 11.0,      // how fast heading chases the input
    CARVE_KEY_RATE: 3.4,       // digital keys ramp to analog at this rate
    ICE_RESPONSE: 0.9,         // heading response while on an ice patch

    POWDER_DRAG: 26.0,         // m/s^2 bleed while past POWDER_X
    POWDER_PUSHBACK: 5.0,      // gentle nudge back toward the ribbon

    GRAVITY: 22.0,
    JUMP_IMPULSE: 7.5,
    AIR_LAUNCH_EPS: 0.02,      // ballistic-vs-ground tolerance for takeoff

    STAGGER_TIME: 0.4,
    STAGGER_CARVE_SCALE: 0.25, // steering authority while staggering

    HIT_SPEED_COST: 0.42,      // fraction of speed lost on an obstacle clip
    FLUB_SPEED_COST: 0.30,
    CLEAN_SPEED_BONUS: 1.6,
    GATE_SPEED_BONUS: 3.0,
    GATE_MAX_BONUS_SPEED: 40,  // gates stop helping past this

    MODEL_RIGHT_LEAN: 0.55,    // visual only: roll into the carve
  },

  // ── Air + tricks ────────────────────────────────────────────────────────
  AIR: {
    SPIN_RATE: 8.5,            // rad/s of yaw at full horizontal drag
    FLIP_RATE: 6.5,            // rad/s of pitch at full vertical drag
    // With no edges in the snow, a skier in the air drifts back toward the
    // direction of travel. Without this, launching mid-carve at 30 m/s throws
    // you 20m+ sideways before you land and air lines become unreadable.
    HEADING_BLEED_TAU: 0.55,
    MIN_TRICK_TIME: 0.18,      // below this it is a bump, not a trick
    CLEAN_YAW: 0.45,           // rad of yaw error still counted as clean
    CLEAN_PITCH: 0.50,
    SETTLE_TIME: 0.15,         // visual snap-upright after landing
  },

  // ── Boost economy ───────────────────────────────────────────────────────
  BOOST: {
    METER_MAX: 100,
    FILL_RATE: 14,             // metre units per second of hangtime
    ROT_BONUS: 1.6,            // extra multiplier per full turn (spin + flip)
    ROT_CAP: 3.0,              // cap on turns counted

    PROX_RANGE: 30,            // beast closer than this multiplies the fill
    PROX_MAX_MULT: 2.0,        // "courage pays" — up to 2x

    // Flub forfeits this trick's fill outright, plus this fraction of the
    // stored meter. Set to 1.0 for the strict "lose everything" reading.
    FLUB_METER_LOSS: 0.5,

    // ── The chain ──────────────────────────────────────────────────────────
    // Every trick used to be worth the same whether it was your first or your
    // ninth, so a run had no build and nothing to lose. Now clean landings
    // stack and any mistake resets it. Losing a fat chain is the thing that
    // makes someone restart before the death screen has finished animating.
    CHAIN_STEP: 0.35,          // multiplier added per link
    CHAIN_CAP: 8,              // links counted
    CHAIN_GATE_CREDIT: true,   // threading a gate also extends the chain

    MIN_ACTIVATE: 8,           // meter needed to kick Overdrive on
    DRAIN_RATE: 34,            // meter units per second while active
    SPEED_MULT: 1.40,          // +40% (brief)
    CARVE_SCALE: 0.55,         // turn radius widens while active
    ACCEL_MULT: 2.0,           // gets you to the higher cap quickly
  },

  // ── Beast ───────────────────────────────────────────────────────────────
  BEAST: {
    START_GAP: 62,
    MAX_GAP: 80,               // dread must stay audible (brief)
    MIN_GAP: 2.5,              // below this it has you
    KILL_GAP: 2.5,

    // Desired gap as a function of how fast you have been travelling
    SPEED_REF_LO: 12,
    SPEED_REF_HI: 34,
    GAP_AT_LO: 18,
    GAP_AT_HI: 76,
    AVG_SPEED_TAU: 2.5,        // smoothing window for "avg speed"

    MISTAKE_PRESSURE_PER: 1.0, // added per obstacle hit / flub
    // Decay slow enough that a mistake still reads 2s later. At 0.28/s the
    // pressure had already halved before the player could see the gap move,
    // and a fumble felt free.
    MISTAKE_PRESSURE_DECAY: 0.15,
    MISTAKE_GAP_COST: 22,      // metres of desired gap per unit of pressure
    MISTAKE_PRESSURE_CAP: 3.5,

    RAMP_PER_1000M: 14,        // slow tightening so every run ends
    // Must be below KILL_GAP or the beast converges to a gap it can never
    // close and the run never ends. There is no lower rubber-band floor by
    // design: get deep enough and it WILL have you.
    DESIRED_FLOOR: 0,

    OPEN_RATE: 9,              // m/s the gap may grow
    CLOSE_RATE: 14,            // m/s the gap may shrink (tunable max)

    // ── Overdrive push ─────────────────────────────────────────────────────
    // The whole thesis is "boost outruns the beast", and it was true only
    // through a six-link chain of which four links were invisible: land trick
    // -> meter -> speed -> a 2.5s SMOOTHED average -> desired gap -> the gap
    // creeps open at 9 m/s. Players felt none of it.
    //
    // So Overdrive now shoves the gap open directly, outside the desired-gap
    // system and outside OPEN_RATE. You spend, and you watch it fall away.
    OVERDRIVE_PUSH: 26,        // m/s the gap opens while Overdrive is lit
    OVERDRIVE_PUSH_TAIL: 0.7,  // seconds the shove keeps working after you let go

    // ── The lunge ──────────────────────────────────────────────────────────
    // A smooth number is a timer, not an opponent. This gives it one move you
    // can learn: it winds up (audible), lunges hard, then has to recover.
    LUNGE_MIN_GAP: 12,         // will not bother lunging closer than this
    LUNGE_MAX_GAP: 55,         // or further out than this
    LUNGE_CHANCE_PER_S: 0.34,  // rolled once a second inside that band
    LUNGE_TELL: 0.55,          // wind-up you get to react to
    LUNGE_TIME: 0.9,           // how long the burst lasts
    LUNGE_RATE: 15,            // m/s extra closure during the burst
    LUNGE_RECOVER: 1.1,        // it falls back afterwards
    LUNGE_RECOVER_RATE: 7,
    LUNGE_COOLDOWN: 5.5,

    // ── Opening grace ──────────────────────────────────────────────────────
    // Measured: a player drifting ~7m off the line dies at 423m / 16s, over
    // and over, and never sees a cliff or learns Overdrive exists. The beast
    // starts lazy and wakes up. Scaled per run by main.js: full grace on your
    // first runs of the day, none once you know what you are doing.
    GRACE_TIME: 42,            // seconds before it is fully awake
    GRACE_GAP: 26,             // metres of extra desired gap at t=0
    GRACE_MISTAKE_FORGIVE: 0.65, // fraction of mistake pressure ignored at t=0
    // A hard floor matters more than the bonus above. The desired gap is
    // derived from your speed, and a struggling player is slow BECAUSE they
    // keep getting hit — so mistakes compound into a doom spiral that a flat
    // bonus cannot arrest. This floor cannot be spiralled through. It fades
    // with the rest of the grace.
    GRACE_MIN_GAP: 38,
    // Fades on a curve, not a straight line: a linear fade is half gone by the
    // halfway point, which is exactly when a struggling player is in trouble.
    GRACE_FADE_EXP: 0.55,
    GRACE_RUNS: 4,             // grace fades out over this many runs on a seed

    // It closes off to one side, not straight up your back. Converging on your
    // exact lateral position puts it between the camera and you, and a beast
    // that blanks the whole screen is not dread — it is an occluder. Peripheral
    // is the brief's word, and it only lines up for the kill.
    // Portrait FOV is narrow: at ~8m the half-width of frame is only ~2.5m, so
    // the offset has to be small or the beast is simply off-screen. This puts
    // its shoulder on the frame edge — seen, not centred.
    APPROACH_OFFSET: 3.2,
    OFFSET_MIN: 1.7,           // never fully centres: it must not eclipse you
    OFFSET_FADE_NEAR: 4,       // narrowed to OFFSET_MIN by here (the lunge)
    OFFSET_FADE_FAR: 15,       // fully offset by here
    MODEL_SCALE: 0.72,

    ROAR_RANGE: 60,
    FOOTFALL_RANGE: 30,
    SCREAM_RANGE: 10,
    SHAKE_RANGE: 10,
    SHAKE_MAX: 0.55,

    KILL_CAM_TIME: 1.5,        // sim-frozen kill sequence duration
    KILL_WHIP_TIME: 0.55,      // camera 180 whip
  },

  // ── Camera ──────────────────────────────────────────────────────────────
  CAMERA: {
    FOV: 68,
    BACK: 10.5,                // metres behind the runner
    BACK_SPEED_GAIN: 0.10,     // pulls back as you accelerate
    // Phase 7 flat-track retune: the downhill grade used to pitch the view
    // for free. On a flat world the camera rides higher and aims lower —
    // ~21 degrees down — so the winding ribbon lays out ahead instead of
    // compressing into the horizon edge-on.
    HEIGHT: 9.0,
    LOOK_AHEAD: 12,
    LOOK_HEIGHT: 0.2,
    SMOOTH: 9.0,               // position lerp rate
    AIR_HEIGHT_GAIN: 0.55,     // rig rises with you on big airs
    AIR_LOOK_GAIN: 0.62,       // and the aim rises too, or you exit frame
    LOOK_CENTRE_BIAS: 0.8,     // 1 = dead on you, 0 = always centred on the piste
    DREAD_TILT_RANGE: 26,      // beast within this tilts the rig back
    DREAD_TILT: 2.2,
    BEAST_CLEARANCE: 8.0,      // boom stays this far behind the beast
    BACK_MAX: 19,
    KILL_ORBIT: 0.85,          // how wide the death whip arcs around you
    // Stopping short of a full 180 gives a three-quarter view. Dead-on, the
    // beast lines up exactly behind you and eclipses the subject of the shot.
    KILL_ANGLE: 0.82,          // fraction of PI the whip travels
    KILL_BACK: 8.5,
    KILL_HEIGHT: 5.4,
    KILL_LOOK_PAST: 5.5,       // aim this far upslope of you at the end
    FOV_SPEED_GAIN: 0.42,      // FOV stretch with speed
    FOV_BOOST: 9,              // extra FOV while Overdrive is up
  },

  // ── Fog / draw distance ─────────────────────────────────────────────────
  FOG: { NEAR: 55, FAR: 255 },

  // ── Ghost ───────────────────────────────────────────────────────────────
  GHOST: {
    SAMPLE_HZ: 10,
    OPACITY: 0.30,
    YANK_TIME: 0.9,            // fog-yank duration at the ghost's death point
    YANK_DIST: 34,             // how far upslope it gets dragged
    MAX_SAMPLES: 6000,         // ~10 minutes at 10hz, then recording stops
  },

  // ── Audio ───────────────────────────────────────────────────────────────
  AUDIO: {
    MASTER: 0.55,
    WIND_MAX: 0.30,
    CARVE_MAX: 0.22,
    ROAR_MAX: 0.30,
    FOOTFALL_MAX: 0.55,
    SCREAM_MAX: 0.50,
    FOOTFALL_HZ_NEAR: 2.6,
    FOOTFALL_HZ_FAR: 1.3,
  },
};

export default TUNING;
