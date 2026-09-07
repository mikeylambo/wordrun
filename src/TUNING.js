/**
 * DICTION DASH — single source of truth for every tunable number.
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

    // ── Route grammar (Phase L) ─────────────────────────────────────────────
    // The track stops being one flat plane: a seeded walk of authored segment
    // types gives it climbs, descents, banks and crests. Geometry only — the
    // speed model, the gates and the Redline never read any of it (the Phase 0
    // behaviour snapshot stays byte-identical), so these are compositional
    // dials, not calibrated ones. Every value is bounded by the reading
    // constraint: grades and rolls stay gentle enough that the plate holds
    // its measured 270×68 px at 62 m/s on every segment type (route-gates).
    ROUTE: {
      // RC8.2 — the joins are EASED, not merely blended. The ramp is a
      // smoothstep over TRANS_M, so grade and roll leave and reach each
      // segment's value with zero derivative: the road is C1 in slope (C2 in
      // elevation) and the crease a linear ramp left at each ramp edge is
      // gone. The cost is arithmetic and bounded — a smoothstep's peak
      // gradient is 1.5x a line's, so the sharpest join in the vocabulary
      // (a crest's own apex, 0.190 of grade) changes at 0.0110 per metre
      // instead of 0.0073, and the gate asserts exactly that bound.
      //
      // RC10.8 — 26 -> 48, because that bound fenced the WRONG QUANTITY. It
      // bounded `rollAt`, the segment bank, and the surface a player actually
      // sees is `crossSlopeAt` = rollAt MINUS the ribbon's turn-lean
      // (corridorSlope x EDGE_BANK x 0.5). The lean is a second, unbudgeted
      // contribution, and at 26 the bank alone already spent 5.766e-3 of the
      // 5.769e-3 ceiling — so the rendered cross-slope ran to 8.29e-3 on the
      // DAILY seed, 1.44x the number every gate and every note claimed. That
      // is the dip a playtester felt: a road changing its cross-fall half
      // again as fast as the design allowed, on the one seed everybody plays.
      //
      // 48 is the shortest ramp that fits BOTH terms inside the published
      // 5.769e-3 (measured 5.658e-3 across seven seeds) while staying under
      // MIN_SEG_M so two windows still never overlap. The bank keeps its
      // magnitude and the lean keeps EDGE_BANK — nothing about the road's
      // character is given up, the joins simply take the length they always
      // needed. Grade joins gentle from 1.096e-2 to 5.94e-3 as a bonus.
      TRANS_M: 48,
      // No segment may be shorter than this. Two things need it: a segment
      // under TRANS_M would have its two ramp windows OVERLAP, which no
      // closed form covers and which reads as a step in the slope; and two
      // short opposing segments (the crest's halves are the only pair in the
      // vocabulary that can meet head-on) make a hump rather than a fold.
      // At 60 every segment keeps at least 34 m of its own character
      // between the two eased ends.
      MIN_SEG_M: 60,
      GRADE: 0.055,         // climb/descent rise per metre (~3.1°)
      CREST_GRADE: 0.095,   // the sharper pitch of a crest's two halves
      ROLL: 0.10,           // bank cross-slope, rise per metre across (~5.7°)
      ELEV_CAP_M: 16,       // the walk steers back before drifting past this
      INTRO_FLAT_M: 150,    // every run opens on level ground (teaching zone)
      EDGE_BANK: 0.35,      // turn-lean of the cross-section (was mesh-local)
      ADV_MIN_D_M: 600,     // L4 vocabulary (drop/tunnel/canyon/narrows) waits
    },
  },

  // ── The run (Phase 7, curve reworked Phase 8) ───────────────────────────
  // Speed is a direct consequence of reading. Phase 8 replaced the flat
  // +2.5/correct (which reached the old 40 ceiling in ~10 reads and then
  // pinned there for the whole run) with a diminishing-returns curve:
  //
  //   gain(speed) = SPEED_GAIN_MAX * (CEILING - speed) / (CEILING - FLOOR)
  //
  // — full gain at the floor, shrinking as speed climbs, asymptotic at the
  // ceiling. Each correct read closes a fixed fraction of the remaining
  // headroom, so top speed is approached, never hit: the run never feels
  // capped, and nearing the ceiling takes a sustained streak (~23 clean
  // reads to 90% of headroom at the shipped values), not ten.
  RUN: {
    START_SPEED: 27,           // = REDLINE_PACE: a run starts neutral
    // THE calibration value (Phase 8): deliberately pushed well past the
    // old 40. Reading windows at candidate settings (ARM 55m, plain /
    // Overdrive x1.4): 48 -> 1.15s/0.82s · 56 -> 0.98s/0.70s ·
    // 64 -> 0.86s/0.61s · 72 -> 0.76s/0.55s. Where "legible" ends and
    // "fun" ends are different lines; this one gets picked by feel.
    CEILING: 64,
    // RC8.3: 4.5 -> 4.1, and it did not move for its own sake. The gain is
    // scaled by (CEILING - FLOOR), so raising the floor steepens the whole
    // curve: at floor 21 with 4.5 a run reached 48.7 m/s after CRUISE_READS
    // and the reading window fell to 1.13 s, under the 1.15 s comfort floor
    // that does not move. 4.1 puts cruise back at 47.44 (window 1.16 s) and
    // still closes 9.53 % of the remaining headroom per read against the old
    // 9.38 % — the comfort floor pins where cruise LANDS, so a higher floor
    // buys the bottom of the run, not the top, and buys the climb a little
    // of its steepness. `npm run calibrate:speed` prints both sweeps.
    SPEED_GAIN_MAX: 4.1,       // m/s gained per correct read AT THE FLOOR
    // Both wrong reads lose this much speed, but only tapping a fake
    // (commission) also costs a heart + stagger + meter. Letting a real
    // word slip (omission) is speed-only: the Redline is its punisher.
    // Flat on purpose: near the ceiling a miss costs the same 6 m/s but
    // MORE reads to win back (each is worth less up there) — mistakes at
    // speed are automatically the expensive ones.
    SPEED_LOSS: 6,
    // FLOOR: repeated misses slow you, never stall you.
    //
    // RC8.3 raises it 16 -> 21. At 16 a run in trouble sat 11 m/s under
    // REDLINE_PACE and 8 under EASY's — the gap closed faster than any
    // recovery could open it, so the floor was a floor you died on rather
    // than one you climbed off. At 21 the deficit is 6 m/s on NORMAL and 3
    // on EASY: still fatal if the misses keep coming, and 21 is the HIGHEST
    // floor at which that stays true — the ladder instrument shows a 55 %
    // reader still run down by the Redline on all three difficulties at 21
    // and dying to hearts on EASY at 22, which would make the pursuit stop
    // being the fail state there. The sweep is in `npm run calibrate:speed`
    // and the verdict in tools/calibration-gates.mjs.
    // Reading window at the floor is ARM_DISTANCE_M/21 = 2.62 s, still more
    // than double the 1.15 s comfort floor — and gated, because a recovery
    // pace you cannot read at is not a recovery.
    FLOOR: 21,
    REDLINE_PACE: 27,          // the Redline's steady baseline, m/s

    // The authored winding (Sonic-tradition S-curves, no player steering):
    // peak |dx/dd| = 2π(AMP_A/WAVE_A + AMP_B/WAVE_B) ≈ 0.43 — sweeping,
    // never snapping.
    // Phase W (playtest: "more dynamic twists/turns"): a third, long wave —
    // the sweeper — layers macro S-curves under the two the road always had,
    // deepening the lateral excursion ~50% (23m vs 15.5m). Wave B gives back
    // a little amplitude so the analytic worst-case |dx/dd| stays 0.49,
    // under the 0.5 readability bound the TRACK gate enforces: deeper
    // sweeps, same curvature class, the plate still readable through every
    // turn. A literal loop or corkscrew stays rejected on the record — it
    // inverts the camera and destroys the read.
    CURVE_AMP_A: 11, CURVE_WAVE_A: 320,
    CURVE_AMP_B: 4.2, CURVE_WAVE_B: 130,
    CURVE_AMP_C: 8, CURVE_WAVE_C: 700,
    TRACK_HALF_W: 7,           // ribbon half-width around the centerline
    FOLLOW_AHEAD: 6,           // metres ahead the runner aims on the line
    FOLLOW_RESPONSE: 7,        // how quickly the runner settles onto it
  },

  // ── Word gates (the DICTION DASH verb) ──────────────────────────────────────
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
    // The teaching window. A run's first word is always real, and no more than
    // two fakes run together until this many gates have passed — see
    // isRealGate() for the measurement that motivated it.
    // Phase B. WHEN you answer, not only whether. The multiplier runs over the
    // existing 55 m window — the window itself is untouched, so every
    // legibility measurement holds. It pays score and meter fill only; it is
    // deliberately NOT applied to the speed gain, which is already an
    // asymptotic curve and would blow through the reading floor if tripled.
    // Phase F — voluntary compression. The player raises their own bar: at
    // level n the early-read multiplier pays ONLY for answers landing beyond
    // a threshold, and everything inside it pays the late rate. In exchange
    // every qualifying read is worth more.
    //
    // Read this next part before touching any of it. Compression does NOT
    // shrink ARM_DISTANCE_M and must never be made to. The window at the
    // ceiling with DASH active is already 0.63 s against a 0.75 s floor, and
    // ARM_DISTANCE_M cannot grow to compensate because it sits under
    // SPACING_MIN_M so exactly one word is ever answerable. Compression moves
    // the REWARD line instead: the word stays fully legible for the whole
    // 55 m at every level, the player can always answer late and live, and
    // what they lose by answering late is money rather than the run. Risk
    // without a legibility cost — no gate is ever threatened.
    COMPRESSION_THRESHOLD: [0, 0.30, 0.50, 0.68],   // fraction of the arm window
    COMPRESSION_MULT: [1.0, 1.15, 1.35, 1.60],
    LATE_MULT: 1.0,            // answering at the line: today's value
    // Phase H verdict, from the break-even table (tools/calibration-gates.mjs):
    // at 3.0, forty gates read at the arm edge scored 0.93x the whole route
    // read at the line — the knife edge Phase D left. 3.5 puts it over
    // (1.07x at forty, 1.42x at fifty) without 4.0's overshoot (1.21x at
    // forty, where the route's back half starts to look optional). The rate
    // also fills the dash: from empty at chain 0 that is 5 early reads, and 2
    // at the chain cap. RC10.9 raised CORRECT_FILL to absorb the meter the
    // bells used to pay and chose the value so those two numbers did not move.
    EARLY_MULT: 3.5,           // answering the instant it arms
    OPENING_GATES: 6,
    OPENING_MAX_FAKE_RUN: 2,
    // Phase A (render-ahead prototype). How many UNARMED gates are drawn
    // beyond the armed one. This is presentation only: it changes what the eye
    // can see, never what the hand can answer. ARM_DISTANCE_M is untouched and
    // must stay under SPACING_MIN_M so exactly one word is ever answerable.
    // The build before this phase drew exactly one preview plate at 0.55, so
    // LOOKAHEAD_GATES = 1 reproduces it; 0 draws none at all.
    // Phase H verdict, played on a 390-wide phone at cruise: 3 is the highest
    // count at which the armed plate is unambiguously the armed plate. Frozen
    // in tools/calibration-gates.mjs; a change is a one-line edit + `npm run
    // calibrate`.
    LOOKAHEAD_GATES: 3,
    LOOKAHEAD_OPACITY: [0.55, 0.32, 0.18, 0.11, 0.07, 0.05],
    ARM_DISTANCE_M: 55,
    FAKE_CHANCE: 0.5,          // fair coin: spamming confirm buys nothing
    // Tier ramps with distance, sharing the run's own ramp architecture.
    TIER_EVERY_M: 700,         // +1 tier per this many metres, clamped
    // Speed consequences live in TUNING.RUN (Phase 7); words keep only the
    // meter economy here.
    // RC10.9 — 6 -> 6.8, absorbing the meter the bells used to pay.
    //
    // Bells filled the dash on a DISTANCE schedule that could not be missed:
    // measured over the DAILY seed, 13.2 % of a 85 %-reader's whole meter and
    // 11.9 % of a 95 %-reader's, arriving whether or not a single word was
    // read correctly. That is a dash the reading did not buy, and it diluted
    // the only verb this game has. The bells now pay banked currency alone;
    // this is where their share went, onto the read.
    //
    // The dial is chosen so the CHARGE TABLE does not move: `ceil(100 / (F x
    // EARLY_MULT))` must stay 5 early reads at chain 0 and 2 at the cap, which
    // holds for F in [5.714, 7.143). 6.8 sits inside it and is +13.3 %, the
    // share the bells were paying — so a reader charges a dash in the same
    // number of reads, and every one of them is now a read.
    CORRECT_FILL: 6.8,         // boost meter per correct read (chain-multiplied)
    WRONG_METER_LOSS: 0.5,     // = BOOST.FLUB_METER_LOSS
    // Legibility floors (the falsifiable question, made checkable): at speed
    // v the reading window is ARM_DISTANCE_M / v seconds. Phase 8's curve
    // split the standard in two, because the ceiling became an asymptote a
    // run brushes rather than a wall it lives at:
    //   - COMFORT: the window a good-but-human streak plays in. Gated at
    //     the speed CRUISE_READS clean reads reach from the start.
    //   - HARD: the physical floor at the absolute ceiling — below this the
    //     asymptote itself would be illegible no matter the calibration.
    READ_WINDOW_MIN_S: 1.15,
    READ_WINDOW_HARD_MIN_S: 0.75,
    CRUISE_READS: 8,
    // RC9.6 — how often the DAILY's BACK HALF prefers a tagged word where the
    // tier walk offered an untagged one. The route opens on ordinary
    // vocabulary and tightens: a hundred gates that were notorious from gate
    // one would be a different game, not a harder second half. HARD carries
    // its own bias in MODES.DIFFICULTY; EASY carries none, ever.
    NOTORIOUS_DAILY_BIAS: 0.5,
  },

  // ── The plate, as a dial (RC10.2) ───────────────────────────────────────
  // Word-plate legibility outranks every other visual and audio change in
  // this game, and until now it was a SWITCH: READABLE TYPE opened the
  // tracking from 1px to 7px and added weight, and that was the whole range
  // on offer. One step serves the players it happens to fit and nobody else.
  //
  // Two dials, three steps each, index 0 = the shipped default so a player
  // who never opens settings sees exactly what shipped:
  //
  //   TRACKING — space between letters. The single best-supported lever for
  //     reading difficulty, and the one a one-edit fake asks the most of:
  //     `rn` versus `m` is a spacing problem before it is a shape problem.
  //   SIZE — the world height of the glyphs. It changes how BIG the word is,
  //     never how LONG it is on screen: the arm distance and the run's speed
  //     are untouched, so both reading floors hold at every step and the
  //     occlusion gate is re-run at the largest.
  //
  // The face is not a dial. It is Atkinson Hyperlegible Next at every step,
  // bundled, chosen by the Braille Institute for exactly this discrimination.
  PLATE: {
    TRACKING_PX: [1, 7, 12],      // letter-spacing on the plate canvas
    TRACKING_WEIGHT: [700, 800, 800],
    SIZE_MULT: [1, 1.12, 1.24],   // world glyph height, x LETTER_H
    MIN_FONT_PX: 64,              // the shrink-to-fit floor a long word may not pass
  },

  // ── Best-moment capture (RC9.8) ─────────────────────────────────────────
  // A rolling few seconds of the run, at a size a clip is actually watched
  // at, kept so the results card can offer the run's best stretch as a short
  // loop beside its still. Everything here is a BUDGET, and the budget is the
  // whole design: a capture that costs frames is a capture that changes the
  // run it is recording.
  //
  // The buffer is ONE canvas — a filmstrip of FRAMES cells — allocated once
  // and written by GPU blits from the game canvas. Nothing is read back and
  // no pixels are copied into JS memory until a clip is actually exported, so
  // the cost per captured frame is one drawImage into a small target.
  //
  //   144 x 312 px x 4 B x 24 frames = 4.11 MB of backing store, once.
  //   10 fps x 2.4 s = 24 frames — a loop, not a replay.
  //
  // It is OFF under REDUCED FLASH (a looping clip is motion the player asked
  // not to be given) and off wherever the device cannot afford it, which is
  // measured rather than guessed: see render/moment-capture.js.
  CAPTURE: {
    WIDTH: 144,                // cell width; height follows the canvas aspect
    FPS: 10,                   // capture and playback cadence
    SECONDS: 2.4,              // how much run the ring holds
    MAX_MB: 6,                 // the ceiling the gate holds the budget under
    // The device test. A run whose frames are already this slow does not get
    // a capture at all — the clip is a souvenir and the run is the game.
    MIN_FPS: 45,               // measured over SAMPLE frames before arming
    SAMPLE: 90,
    // What one frame is allowed to pay for the buffer, at p95, measured on
    // the phone matrix by `npm run audit:capture`. The RC frame budget is
    // 20 ms at 60 Hz (dev/rc/device-soak.md); this is what the capture may
    // take out of it, and it is a gate rather than a hope.
    COST_MS: 1.5,
  },

  // ── Speed cues (Phase 8.5; lifted out of the render files RC8.3) ────────
  // Everything in the world that says FAST, keyed the same way the camera is:
  // speedN = (speed − RUN.FLOOR) / (RUN.CEILING − RUN.FLOOR), 0 at the bottom
  // of the lived band and 1 at the ceiling.
  //
  // They lived as literals inside speed-fantasy.js and the ground shader,
  // which meant the one dial the feel lab could not reach was the one the
  // player actually looks at. RC8.3 raised RUN.FLOOR to 21, which narrows
  // that band from 48 m/s to 43 — every cue now moves 11.6 % more per m/s
  // than it did, and every cue reads a little lower at the same speed below
  // the ceiling. These values are re-tuned to that: the response at cruise is
  // held where it was, the top end is unchanged (speedN is 1 either way), and
  // the two frequency cues are tightened because frequency is the one channel
  // that reads as speed rather than as intensity.
  CUES: {
    // Wind streaks. Silent below START, a torrent at the ceiling.
    STREAK_START: 0.30,        // speedN the streaks fade in from (was 0.40)
    STREAK_OPACITY: 0.55,      // peak opacity of the streak lines (was 0.50)
    STREAK_LEN_M: 8,           // streak length added across the range
    STREAK_RUSH: 1.35,         // world m/s past the camera, per m/s of speed
    STREAK_DASH: 0.35,         // sustained bump to speedN while dashing
    // Stanchions — nearby verticals sweeping the frame, the classic parallax
    // cue. 21 → 18 m is +17 % posts per second at cruise; the pool grows so
    // the run of them still reaches the same distance down-track.
    PYLON_SPACING_M: 18,
    PYLON_PER_SIDE: 30,
    // The etched ground grid. Its cell size IS the ground frequency: at
    // cruise 6 m gave 7.9 rungs a second and 5 m gives 9.5.
    GRID_CELL_M: 5.0,
  },

  // ── Features / obstacles (per chunk, seeded) ────────────────────────────
  // DICTION DASH retune: the dodge verb is out, so nothing solid spawns and the
  // slalom gates are off — word gates are the only thing the mountain asks
  // of you. Structure kept (values retune, structure won't — brief).
  FEATURES: {
    TREE_COUNT: [0, 0],        // inclusive range rolled per chunk
    ROCK_COUNT: [0, 0],
    ICE_CHANCE: 0,
    GATE_CHANCE: 0,
    MOGUL_CHANCE: 0,
    // Cliffs are part of the dodge/trick verb — off in DICTION DASH. A word
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
    // uniform throughout. It is density and terrain character only.
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
    // With no edges in the snow, a runner in the air drifts back toward the
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
    // Sustained excellence, past the point the chain stops counting. The chain
    // caps at 8 and the flow colour grammar caps with it, so a player reading
    // perfectly at link 30 sees exactly what they saw at link 8. Surge is the
    // amplifier on top: it only accrues while the chain is already at cap AND
    // the answers keep landing early, and any wrong read or any late answer
    // empties it at once. It is a state you hold, not a level you reach.
    SURGE_READS: 6,            // qualifying reads past the cap for full surge
    SURGE_EARLY_FRAC: 0.5,     // an answer must clear half the window to count
    CHAIN_GATE_CREDIT: true,   // threading a gate also extends the chain

    // Phase 22 — the DASH becomes an event. At 8 of 100 the meter armed
    // after two reads and never disarmed: measured, a 95%-accuracy run was
    // dashing 53% of the time, which is a default state with a light on,
    // not a special move. A full charge only, so it is something you bank
    // over about ten reads and then spend whole.
    //
    // The multiplier deliberately did NOT go up with it. The reading window
    // is ARM_DISTANCE_M / speed, and ARM_DISTANCE_M cannot grow to
    // compensate — it sits below SPACING_MIN_M precisely so only one word is
    // ever in play. At the ceiling the shipped x1.4 already puts the window
    // at 0.63s, under the 0.75s floor below; x1.6 would make it 0.55s. The
    // event is longer, rarer and louder, not faster.
    // RC8.3 — the dash hits harder, and NOT through reading speed. The three
    // levers it may use are DURATION, the lens, and what it does to the
    // Redline; SPEED_MULT is the one it may not touch, because the reading
    // window is ARM_DISTANCE_M / (speed × SPEED_MULT) and at the ceiling
    // ×1.4 already puts it at 0.86 s. Longer, wider and further ahead of the
    // pursuit is a bigger event at the same legibility.
    MIN_ACTIVATE: 100,         // = METER_MAX: a full charge, spent whole
    // 34 -> 28: a dash is 3.57 s instead of 2.94 s. The ladder is sized to
    // the reads that fit in it, so this is the dial that moved it.
    DRAIN_RATE: 28,            // meter units per second while active
    SPEED_MULT: 1.40,          // +40% (brief) — NEVER raised: see above
    CARVE_SCALE: 0.55,         // turn radius widens while active
    ACCEL_MULT: 2.0,           // gets you to the higher cap quickly

    // ── The DASH (Phase 16) ────────────────────────────────────────────────
    // The mechanic above is the game's second verb, and for fifteen phases
    // it was called GO, hinted at once, and — by this file's own earlier
    // admission — missed entirely by players who never learned it existed.
    // The sim is unchanged. What changed is that firing it now LANDS: a
    // camera punch that decays on top of the sustained FOV lift, a burst of
    // speed lines, and its own sound instead of a borrowed one. A mechanic
    // nobody notices is a mechanic nobody uses.
    DASH: {
      KICK_FOV: 13,            // extra FOV on the instant of firing...
      KICK_DECAY: 3.0,         // ...decaying at this rate (e-folds/second)
      STREAK_BURST: 1.25,      // speed-line spike added on fire
      STREAK_DECAY: 2.2,       // and how fast that spike falls away
      // The teaching beat holds until the player has actually dashed once
      // — ever, not per run. A lesson that times out teaches nobody.
      TEACH_HOLD_S: 3.2,
      // Phase I: the meter rim steps hue per dash-chain rung. Cyan is the
      // resting tone; each rung walks toward green. Every value sits >= 25'
      // from the semantic set (reds 350–28, violet 262, gold 45) — gated.
      // RC8.3: six rungs, and the walk is RE-SPACED rather than extended.
      // Continuing the old 22° step would have put the sixth rung at 83°,
      // which clears the reserved set but sits 5° from the bell's own gold-
      // green at 78 — a meter rim wearing a pickup's colour. Six steps of 18°
      // across the same 195 → 105 span keep both endpoints, keep every rung
      // ≥ 25° from the semantic set, and keep the whole ladder ≥ 27° off the
      // bell.
      CHAIN_HUES: [195, 177, 159, 141, 123, 105],
    },
  },

  // ── Modes (Phase 10) ────────────────────────────────────────────────────
  // Two rule sets and three reading-difficulty profiles, all combinable.
  // ENDLESS is the game as it grew up: five bells repair a heart, so a
  // run ends when the Redline wins or hearts drain faster than bells
  // restore. STANDARD removes the repair: three hits, ever — bells still
  // pay meter and currency, the stakes just stop coming back.
  MODES: {
    RULES: {
      // ENDLESS is where you train: no end, hearts come back, its own board.
      endless: { HEART_REPAIR: true, GATES: 0 },
      // The DAILY RUN is where you compete. A fixed route of the same words in
      // the same order for everyone, so the score is finite and directly
      // comparable — which is the whole reason a board can exist at all. The
      // per-attempt word salt is pinned for it; re-rolling the vocabulary
      // would make two players' runs different games wearing one name.
      // Phase H2: the route repairs hearts on a clean reading streak, the
      // same ladder ENDLESS uses (3 clean on the last heart, 5 otherwise).
      // Phase H measured the old no-repair route as a two-commission budget
      // that an 85 % reader could not finish on any difficulty; that was not
      // the intended bar. Bells still never repair a heart in either mode.
      standard: { HEART_REPAIR: true, GATES: 100 },
    },
    // Difficulty is READING difficulty plus the Redline's pace — never the
    // speed curve itself (one system, shared). This also properly replaces
    // the frame's new-player grace, which Phase 7's pure-differential
    // rewrite left as a dead knob (beast.grace is inert): easing now comes
    // from choosing EASY, visibly, instead of a hidden fading curve.
    //
    // RC9.5 — WINDOW_SCALE, and why HARD is the only profile that has one.
    //
    // The ladder instrument said it plainly: pace 24/27/30 barely separates a
    // competent reader, because pace only decides how fast a COLLAPSED run is
    // ended, and a reader who is not collapsing never meets it. Tiers make the
    // words longer; nothing made the READ harder. So HARD gets the one lever
    // that does: less road to read the word on.
    //
    // It scales the ARM WINDOW, never ARM_DISTANCE_M itself — the constant is
    // fixed at 55 and may not grow, and every legibility measurement in the
    // build is taken against it. What moves is the fraction of that window
    // this profile gives you to answer in, which is a rule of the difficulty
    // rather than a property of the plate: the word is drawn identically, at
    // the same size, for the same distance. It simply stops counting sooner.
    //
    // The two-tier reading standard travels WITH the scale. HARD's floors are
    // the shipped floors times WINDOW_SCALE — 1.15 s becomes 1.01 s at cruise
    // and 0.75 s becomes 0.66 s at the ceiling — so the same standard is
    // applied to the same curve, at this profile's own window. Deriving them
    // rather than declaring them is what stops HARD's difficulty and HARD's
    // legibility drifting apart.
    //
    // 0.88 IS SETTLED (RC11.1). The decision was always a phone in a hand, and
    // the phone has now been in one: HARD played end to end, and the verdict
    // was that it is not distinguishable from NORMAL except that it makes
    // answering EARLY the natural move — which is the calibration table's own
    // prediction rather than a surprise. "A reader inside HARD's own floor
    // loses nothing to the window" is gated, and a competent reader noticing
    // nothing is that gate passing, not a null result: the window punishes
    // hesitation and it is not supposed to punish anything else.
    //
    // Nothing moved as a result, which is the point of writing it down. The
    // instruments still reprint every table from this one number if it ever
    // does move.
    DIFFICULTY: {
      // NOTORIOUS_BIAS (RC9.6): how often this profile prefers a word from the
      // notorious tag where the tier walk offered an untagged one. EASY is
      // zero and is gated at zero — the tag is a pressure, and EASY is the
      // profile that exists not to apply one.
      easy: {
        TIER_MIN: 0, TIER_MAX: 2, TIER_EVERY_M: 1100, REDLINE_PACE: 24,
        WINDOW_SCALE: 1, NOTORIOUS_BIAS: 0,
      },
      normal: {
        TIER_MIN: 0, TIER_MAX: 4, TIER_EVERY_M: 700, REDLINE_PACE: 27,
        WINDOW_SCALE: 1, NOTORIOUS_BIAS: 0,
      },
      hard: {
        TIER_MIN: 1, TIER_MAX: 4, TIER_EVERY_M: 500, REDLINE_PACE: 30,
        WINDOW_SCALE: 0.88, NOTORIOUS_BIAS: 0.5,
      },
    },
  },

  // ── Score (Phase 25) ────────────────────────────────────────────────────
  // Distance was the headline number, and distance only says how LONG you
  // ran. Score says how WELL: every metre and every correct read is worth
  // the chain multiplier you were holding when you earned it, so 2 km read
  // cleanly beats 3 km read sloppily. It uses the multiplier the chain
  // already computes (1.0 at a broken chain, 3.8 at the cap) rather than
  // inventing a second mastery curve to keep in sync with the first.
  //
  // Distance does not disappear — it is still the spine of the run and still
  // what the daily goals and objectives ask for. It just stops being the
  // thing you brag about.
  SCORE: {
    // Phase D: distance pays nothing. A metre is time served, not skill, and
    // a board built on it rewards the player who survived longest rather than
    // the one who read best. Distance stays on screen as pacing and on the
    // card as context; it is no longer a term in the score anywhere.
    PER_READ: 250,             // the pop a correct read pays, also multiplied
    // Harder words are worth more, so a deep run still outscores a shallow
    // one without paying for distance directly. Indexed by the gate's tier.
    // Flatter than it first looks like it should be, and measured rather than
    // guessed. The tier a gate lands in climbs with distance, so a steep
    // ladder quietly pays for depth — exactly the thing this phase removes
    // from the score. At this ladder the break-even is forty gates (Phase H,
    // EARLY_MULT 3.5): under half the route read at the arm edge outscores
    // the whole route read at the line.
    TIER_MULT: [1.0, 1.15, 1.3, 1.45, 1.6],
    // A continue buys the run back, so the score it produces is not the score
    // an unassisted run would have produced. Each continue keeps this share of
    // the total, compounding — one continue banks 70%, two 49%, three 34%.
    // The boards already refuse a continued run's best and ghost; this makes
    // the number on the card honest too, rather than only the record.
    CONTINUE_KEEP: 0.70,
    // STANDARD is a route with an end, so failing to reach it is a real
    // failure and the score says so. ENDLESS is exempt: every endless run
    // ends in death, so a death penalty there is just a global multiplier
    // that changes nothing about how anyone plays.
    STANDARD_FAIL_KEEP: 0.60,
    // Phase I — the DASH chain. During an active dash each correct read ramps
    // a temporary multiplier on the READ'S SCORE TERM ONLY: index = correct
    // reads already landed during this dash (the first pays [0]), capped at
    // the last entry. A wrong read of any kind zeroes it; it ends with the
    // dash. Never speed, never meter, never the window — the dash is
    // expression, not a rescue. Sized to measured reads-per-dash + 1 (see
    // tools/calibration-gates.mjs, DASH table), so the top rung is rare by
    // construction.
    // RC8.3: a sixth rung. The ladder is sized to the reads that fit in one
    // dash (p90 + 1), and a 3.57 s dash lands five where a 2.94 s dash landed
    // four — see the DASH table in tools/calibration-gates.mjs. The step is
    // unchanged at 0.25, so the top rung is 2.25x and every rung below it is
    // exactly where it was.
    DASH_CHAIN_MULT: [1.0, 1.25, 1.5, 1.75, 2.0, 2.25],
  },

  // ── Meta economy ────────────────────────────────────────────────────────
  META: {
    // The bare-number spendable balance (◆, deliberately unnamed — the
    // five-name cap stays at five). Bells are its only source; Phase 14
    // gave it the two sinks scoped since Phase 8.
    CURRENCY_PER_BELL: 1,
    // Phase J — board eligibility, encoded before any board exists so Pass 3
    // is a transport problem and not a rules problem. DAILY is scored and
    // recorded on NORMAL only (the title forces the chip, no copy); ENDLESS
    // bests store per difficulty; a continued run is never eligible; daily
    // goals clear on any difficulty. Gated in tools/meta-gates.mjs.
    BOARD_POLICY: {
      DAILY_DIFFICULTY: 'normal',
      ENDLESS_PER_DIFFICULTY: true,
      CONTINUE_ELIGIBLE: false,
      GOALS_ANY_DIFFICULTY: true,
    },

    // Sink 1 (Phase 14): the priced continue. Dying offers a short window
    // to buy the run back — hearts refilled, the Redline pushed out to its
    // starting gap — at a cost that doubles with each continue in the same
    // run, so a deep run gets exactly as expensive as it is precious.
    // A continued run keeps its distance, bells and goal credit but never
    // sets BEST TODAY and never saves a ghost: the boards stay unassisted,
    // which matters once challenge links exist.
    CONTINUE: {
      BASE_COST: 30,           // ◆ for the first continue of a run
      COST_GROWTH: 2,          // ×2 per additional continue, same run
      OFFER_SECONDS: 5,        // decision window before the card proceeds
      REVIVE_SPEED_PAD: 6,     // revive at Redline pace + this, clamped to RUN range
    },

    // Sink 2 (Phase 14, re-hued Phase 15): runner light palettes — the
    // halo, ground pool, comet tail and track trail take the hue; the core
    // stays white so the figure always reads. Cosmetic only: no palette
    // touches the semantic grammar.
    //
    // Phase 15 moved three of them. A cosmetic must never wear a colour
    // the game uses to MEAN something, and the first cut of this list
    // broke that twice over: GOLD (0xffd75e) and VIOLET (0xb387ff) sat on
    // top of the streak-burst escalation hues (0xffd977 / 0xb18cff), so a
    // player who bought GOLD looked permanently mid-streak and the peak
    // -flow payoff stopped meaning anything; EMBER (0xff9a3c) sat on the
    // deuteranopia danger accent (0xff7800), dressing the runner as the
    // thing chasing it for exactly the players who can least afford the
    // confusion. Red already had this protection through the Redline
    // gate — RESERVED_HUES below extends it to every semantic colour, and
    // the gate suite enforces the separation so the next skin can't
    // reintroduce the bug. Cyan is deliberately NOT reserved: it is the
    // world's resting tone, not an earned signal.
    //
    // Labels are functional colour words, not names — the cap stays at five.
    COSMETICS: [
      { id: 'default', label: 'CYAN', cost: 0, halo: 0x67d8ff, limb: 0x9fe8ff },
      { id: 'lime', label: 'LIME', cost: 120, halo: 0xb6ff4d, limb: 0xe4ffc0 },
      { id: 'magenta', label: 'MAGENTA', cost: 120, halo: 0xff5ed6, limb: 0xffc4f1 },
      { id: 'aurora', label: 'AURORA', cost: 250, halo: 0x7dffc4, limb: 0xd2ffe9 },
      { id: 'cobalt', label: 'COBALT', cost: 400, halo: 0x3d7cff, limb: 0xc0d4ff },
    ],

    // Hues (degrees) a cosmetic may not sit near, with the minimum
    // separation. Every entry is a colour that carries meaning: the
    // Redline's danger accent in each colour-vision mode, and the two
    // earned streak-burst escalation tiers.
    RESERVED_HUES: {
      MIN_SEPARATION_DEG: 25,
      HUES: [
        { deg: 3, why: 'the Redline danger accent' },
        { deg: 28, why: 'the deuteranopia danger accent' },
        { deg: 24, why: 'the protanopia danger accent' },
        { deg: 350, why: 'the tritanopia wrong-read cue' },
        { deg: 262, why: 'streak-burst escalation tier 2' },
        { deg: 45, why: 'streak-burst escalation tier 3' },
      ],
    },
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

    // ── The Overdrive push, and why it is not here ─────────────────────────
    // OVERDRIVE_PUSH / OVERDRIVE_PUSH_TAIL are DELETED, not retuned. They
    // were the retired director's: a shove written on top of a desired-gap
    // servo, back when a dash reached the gap through a 2.5 s smoothed
    // average and players felt none of it. Phase 7 replaced that whole
    // machine with one line — the gap is the clamped integral of
    // (effSpeed − pace) and NOTHING else writes it, which tools/gates.mjs
    // asserts step for step — and from that moment the two dials named a
    // mechanic no code read. RC8.3 went looking for them to make a dash push
    // harder and found them inert; a dial that reads like a lever and moves
    // nothing is worse than either value it could hold.
    //
    // What a dash actually does to the Redline, and it needs no new term:
    // SPEED_MULT × speed against the pace IS the shove. At cruise that is
    // 39 m/s of opening, which pins MAX_GAP inside a second. Below the pace,
    // where it matters, a dash turns a closing gap into an opening one, and
    // the lever that makes that last longer is DRAIN_RATE — which is the one
    // RC8.3 moved.

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
    BACK_SPEED_GAIN: -0.17,    // CLOSES IN as you accelerate (Phase 22; RC8.3 -0.16 → -0.17)
    // Phase 7 flat-track retune: the downhill grade used to pitch the view
    // for free. On a flat world the camera rides higher and aims lower —
    // ~21 degrees down — so the winding ribbon lays out ahead instead of
    // compressing into the horizon edge-on.
    HEIGHT: 9.0,
    LOOK_AHEAD: 12,
    LOOK_HEIGHT: 0.2,
    SMOOTH: 9.0,               // position lerp rate
    // ── Speed fantasy (Phase 8.5) ─────────────────────────────────────────
    // The old rig normalised speed against the 34 m/s era and pulled the
    // boom BACK as you sped up — which reads as slower. Sonic grammar is
    // the opposite: stay close, drop low, aim further down the track, and
    // stretch the FOV, all keyed 0..1 across the RUN floor→ceiling range.
    // Phase 22: the speed-keyed terms roughly double, and BACK_SPEED_GAIN
    // goes NEGATIVE — the rig closes in as you accelerate instead of easing
    // out. Measured against the constraint that outranks all of this: at
    // 62 m/s cruising the word plate is 270x68 px at the read moment, up
    // from 244x61, because a closer camera more than pays back a wider lens.
    // RC8.3: the speed-keyed camera terms are up ~6.5 %, which is exactly
    // what the narrower lived band (RUN.FLOOR 16 → 21) took out of speedN at
    // cruise. The shot at the ceiling is unchanged — speedN is 1 either way —
    // and the shot at cruise is back where it was, moving harder per m/s.
    HEIGHT_SPEED_DROP: 3.4,    // rig sinks this much at the ceiling
    LOOK_SPEED_AHEAD: 9.6,     // aim drifts this much further down-track
    SPEED_SHAKE: 0.05,         // barely-in-control tremor near the ceiling
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
    FOV_SPEED_GAIN: 1.12,      // FOV stretch across the full speed range (RC8.3: 1.05 → 1.12)
    FOV_BOOST: 22,             // extra FOV held for the length of a DASH (RC8.3: 16 -> 22)
    // The stretch, the dash boost and the dash punch all stack, and unclamped
    // they reach 106 degrees — a fisheye that shrank the plate to 93x23 px at
    // the far read, worse than anything shipped. The cap costs nothing while
    // cruising (88 degrees, under it) and only bites in the one case that
    // needed catching. Legibility outranks spectacle; this is where that is
    // enforced rather than asserted.
    FOV_MAX: 96,
    // REDUCED FLASH is a motion setting as much as a flash one: an aggressive
    // speed-keyed rig is a nausea vector. This scales every speed-keyed camera
    // term — the close-in, the drop, the lens stretch, the tremor — without
    // touching composition, so the picture is the same, just calmer.
    ACCESS_MOTION_SCALE: 0.45,
    // Degrees of FOV per unit of music response. The beat bob is deliberately
    // near the threshold of notice; crashes are rare enough to be felt.
    MUSIC_PULSE_FOV: 22,
    // Surge widens the view. Small: the plates are read at this width.
    SURGE_FOV: 5.5,
    MUSIC_ACCENT_FOV: 2.5,
    // Phase L2: how far the rig leans into a banked segment. Partial by
    // design — 1.0 would re-level the road and erase the bank; 0 would read
    // as a camera bolted to a gimbal. The plate's screen rotation equals
    // total camera roll and is gated (route-gates) at ≤ 4.5°.
    TRACK_ROLL_SYMPATHY: 0.35,
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
    CARVE_MAX: 0.22,
    ROAR_MAX: 0.30,
    FOOTFALL_MAX: 0.55,
    SCREAM_MAX: 0.50,
    FOOTFALL_HZ_NEAR: 2.6,
    FOOTFALL_HZ_FAR: 1.3,
  },
};

export default TUNING;
