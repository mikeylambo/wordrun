# DICTION DASH — pre-release vertical slice

Cloned from DESCENT v1.0.0 (feature-frozen, released August 11, 2026) with
the dodge verb swapped for the word-gate verb and the world re-presented as
an unfinished manuscript chased by the Redline. Not yet released.

Frame inherited from the source release: 30 km canonical finish, persistent
pursuit pressure, authored landmarks, mobile portrait controls with dedicated
action buttons, controller support, haptics, PWA install, one-contact damage
with bell repair, all-time best, SAVE/SHARE, approved audio mix, endless
prestige beyond 30 km.

Slice history:

- Phase 1 — shell clone, DICTION DASH identity, gates at source parity.
- Phase 2 — word-gate verb + standalone word-list module, full suite green.
- Phase 3 — word bank ~560 across 5 tiers, spawn-rate ramp, neon/afterimage
  plate + wordmark identity, gate suite extended.
- Phase 4 — neon line-art world; the DESCENT pursuer replaced by an
  ambient corruption presentation driven by the same tuned gap value; threat
  audio reshaped to interference noise; corruption gate suite added.
- Phase 5 — naming rework (the Redline, the Caret, REDACTED),
  cursor-of-light character on the unchanged controller, and a
  streak-keyed vibrancy pass concentrated at the payoff moments.
- Phase 6 — naming simplification: the mood-band label layer is removed
  entirely (hues, blend math and structure untouched); exactly five names
  remain — the Redline, the Caret, REDACTED, PUBLISHED, TODAY'S DRAFT —
  and the cap is machine-enforced by the gate suite.
- Phase 7 — track & speed-consequence redesign: flat winding auto-followed
  track replaces the downhill terrain system; speed is a direct function
  of reading (gain per correct, loss+heart per wrong, floored/ceilinged);
  the hunt-pressure director is deleted and the Redline's gap is the pure
  integral of the speed differential against its steady pace. All suites
  rescoped and green.
- Playtest pass 1 — rules solidified from first human feedback: hearts are
  now spent only by tapping a fake (commission); a real word slipping past
  (omission) costs speed and the chain but never a heart, so game over is
  always either spent hearts or the Redline closing on a slow reader.
  The cursor-of-light is replaced by a procedural running figure of light
  with a distance-driven run cycle on the unchanged controller; the track
  light drifts through cyan/violet/teal hues and set-piece line art picks
  from a four-hue palette; the retired carve/spin/flip touch guide becomes
  a REAL tap ring; the full-screen interference overlays pause while
  invisible and the corruption canvases re-roll on an intensity-scaled
  cadence.
- Phase 8 — performance, speed curve and pickup audit. The run-start
  stutter was profiled to three first-use costs (audio graph build on the
  tap, a shader-compile burst, first canvas texture uploads) and all three
  now happen during title idle. The flat speed gain became a
  diminishing-returns curve toward a raised, calibration-exposed ceiling
  (shipped 64; `npm run calibrate:speed` prints the decision table) under
  a two-tier legibility standard gated at cruise and at the ceiling. The
  bell audit found strings still laid in the source frame's straight
  coordinates — uncollectible against the winding line, inert in play —
  so they now ride the travel line itself and bank the bare-number
  spendable balance (◆) alongside their meter drip and heart repair.
- Phase 8.5 — speed fantasy + phone play. Every speed cue (camera, runner
  cadence, wind/glide audio, spray) was still normalised to the retired
  34 m/s era and saturated halfway up the new curve; all are now keyed
  0..1 across floor→ceiling. The camera speaks Sonic grammar — closer,
  lower, wider, aimed further down-track, with a barely-in-control tremor
  near the ceiling — and three new presentation layers sell the rush:
  wind-streak lines riding the camera, glowing pylons flanking the track
  for parallax, and a comet tail stretching off the runner. A GitHub
  Pages workflow builds and publishes the branch so the game is playable
  from a phone.
- Phase 9 — depth: words and the color grammar. The word bank grew 563 →
  ~6,700 by harvesting the Barsmith catalog into generated bank.js,
  re-tiered by length; words draw as a seeded no-repeat walk through each
  tier and the word lane is salted per attempt (same daily track, fresh
  vocabulary every run). The color grammar became a system: world
  brilliance rides the chain through one pure flow curve (marquee pulse
  near peak, bounded under the plate and the Redline — both gated); a
  tapped fake drains light and treble for a beat instead of white-flashing;
  the correct chime climbs a pentatonic ladder with the chain.
- Phase 12 — DICTION DASH. The game is renamed (wordmark, new icon set,
  manifest, page identity, share filenames, storage namespace with a
  one-time legacy migration, service-worker cache; the old title joins
  the retired-names gate). Playables readiness audited and green: zero
  external network calls through a full run, 1.75 MB against the 30 MB
  initial-load ceiling (npm run audit:size / audit:network). The dynamic
  music engine landed ahead of the score: four looping stem layers
  (drums/bass/lead/fx) on their own bus, volumes a pure gated function
  of speed and chain, synthesized placeholder loops standing in — real
  stems are a file drop into public/audio/stems/, no code changes.
- Phase 11 — curation and access. The harvested catalog bank was
  deliberately removed: the game returns to the hand-curated list, whose
  variety is now carried by the no-repeat walk, the per-attempt salt and
  the difficulty profiles rather than raw volume. Accessibility landed as
  a persisted settings surface: REDUCED FLASH (no marquee pulse, softer
  drain, stilled veil), READABLE TYPE on the plates, and colour-vision
  modes porting the axis-replacement palettes from the studio's earlier
  brain-training game to this game's semantic cues. Eleven legacy
  gate suites, the deploy logs and the retired air-beats module were
  deleted after grep-proof of deadness.
- Phase 10 — modes. ENDLESS (bell heart-repair) vs STANDARD (three hits,
  ever) × EASY/NORMAL/HARD reading difficulty (word-tier profile + the
  Redline's pace — the discovered-dead grace knob's honest successor).
  Title chips persist the choice; bests/ghosts/run counts store per
  variant with legacy keys preserved. The harvested bank also gained an
  audience filter (50 adult-register terms excluded and gated).
- Phase 13 — the word bank buff. The hand-curated bank grew 563 → 3,073
  (339 / 787 / 837 / 652 / 458 across the five tiers) by authoring under
  mechanical QC: charset and per-tier length windows, global dedupe, an
  audience blocklist, and dictionary validation of every new word (which
  stopped a typo before it shipped). Live play surfaced the predicted
  fake-collision class — the generator producing real words ('sago',
  'bandy', 'fro') as fakes — so the guard was rebuilt as the *complete*
  one-edit collision set: every string the generator's mutation classes
  can reach from any bank word, intersected with a 275k-word English
  dictionary (~7,600 entries, regenerated by `tools/build-guard.mjs`
  after any bank change). Gates tightened to Phase 13 scale, including a
  4,000-fake zero-collision sample.
- Phase 19 — broadcast presentation. The whole UI was set in
  ui-monospace, pinned in fourteen separate stylesheets, which read as
  terminal rather than television; it is now one platform display
  grotesque (SF Pro / Segoe / Roboto) declared once and inherited
  everywhere, with the wordmark reset in the same face. No webfont: a
  downloaded face would have been the only external request in the build.
  Scale went deliberately extreme — the score is now clamp(72px, 23vw,
  140px) and labels are 7-9px at wide tracking, which is the lower-third
  grammar. The copy came down with it. The title lost its rhetorical
  tagline (three separate layers were re-asserting it), its input hint,
  and its three-part metadata line; the results card lost a sentence per
  wrong read — four lines of the same slipped-by phrasing under a
  seven-word heading — in favour of two labelled rows that carry the same
  teaching, plus a three-column stat bar of figure-over-label. Daily goals
  became the target and nothing else ('REACH 1200M' to '1200M'). Both
  screens now print seven and eight words respectively, and gates hold
  them under twelve, hold the single type system, and hold the retired
  copy retired.
- Phase 18 — the three things Phase 17 noted and did not do. (1) The bank
  speaks one spelling convention: ten British forms that arrived early were
  swapped for the American spellings the bank already leaned toward
  (armour/theatre/endeavour/marvellous/skilful) or dropped where the
  American twin was already shipped (harbour, kilometre, manoeuvre,
  neighbour, judgement). 'dialogue' and 'axe' were deliberately left alone
  — both are standard American usage, so "correcting" them would have made
  the bank worse. A 78-entry gate keeps the convention. (2) The dead UI
  paths are gone, after proving them dead: five 30 km runs produced zero
  landings, zero flubs, zero obstacle hits, zero airborne frames and zero
  lunges, so the trick-feedback line, the NO FEAR readout, the terrain-name
  card and the lunge tell could never appear. Removing the lunge cue also
  orphaned a close-range threat recording, which went with it. The FLOW
  readout stays: it is hidden, but its data is live. (3) The surface-glide
  synth voice lost the last ski word in the engine. Because an approved mix
  baseline scales it, the rename was verified rather than assumed: reading
  the smoothed AudioParams is not a valid check (setTargetAtTime never
  lands exactly and drifts with wall-clock), so the probe intercepts
  Audio._set and compares every parameter TARGET — value, tau and call
  order — across 56 speed x surface x dash states. 1,792 targets, zero
  differences.
- Phase 17 — word bank growth where it was actually needed. Driving the
  real sim 30 km on each difficulty showed the problem precisely: NORMAL
  and HARD reach tier 4 by 2,800 m and 1,500 m and then stay there, so a
  single full run drew 221 and 228 distinct real words from a pool of 458
  — 48% and 50% of the tier, every run. Two runs and a dedicated player
  had seen all of it, defeating the coprime no-repeat walk built to
  prevent exactly that. EASY's plateau tier gave up a healthy 27%, and
  that was the target. Tier 4 grew 458 -> 2,022 and tier 3 652 -> 1,300;
  tiers 0-1 were left alone because every run is past them inside the
  first kilometre. A full run now takes 11% of tier 4. Bank: 3,073 ->
  5,285. Four filters shaped the intake beyond Phase 13's: a plain
  inflection of a word already in the bank is not a new word to read; a
  non-primary spelling variant is not either, because a spelling game
  cannot be casually bilingual; and 376 academic or bureaucratic entries
  were cut by hand because a gate must ask "is that spelled right?" and
  never "have you met this word?". The collision guard was regenerated
  against the grown bank (7,588 -> 9,029) and a live gauntlet re-verified
  clean. The tier-depth gate was replaced by the ratio it was a proxy for:
  no full run may eat more than 30% of the tier it plateaus in.
- Phase 16 — the DASH becomes a headline mechanic. The game's second verb
  had existed since the clone under a name that explained nothing (GO),
  taught in one line among five, fired with a borrowed sound and no camera
  event — and TUNING carried its own admission that players "never learn
  Overdrive exists". It is now the DASH everywhere a player can read it
  (button, aria labels, HUD, onboarding, coach). Charged reads loud
  instead of dim: the mobile button goes full-strength with a lit rim and
  a pulse, and the floating hint — previously hidden on touch on the
  theory that the button already explained itself — now shows there,
  spelling out the actual input ("DASH READY · HOLD DASH"). Firing it
  lands on one frame across three channels: its own sound (a thump, a
  fast upward sweep and an air burst, replacing the reused shove), a
  camera punch of about 12 degrees of FOV added AFTER the rig's smoothing
  so it is an instant rather than an ease, and a burst of speed lines that
  spikes from nothing. The teaching beat holds while the meter is charged
  and retires permanently the first time the player actually dashes —
  persisted, so a returning player is never re-taught. REDUCED FLASH drops
  every pulse and keeps every word of the instruction.
- Phase 15 — residue and colour grammar. The frame this game was cloned
  from stopped showing through: a HOW TO SKI button and a "Share this
  DESCENT run" label became this game's own copy, fifteen `__DESCENT_*`
  globals and two `descent:` keys were renamed, and the ski vocabulary
  left the identifiers and comments (provenance credit in a comment
  stays — that history is honest). The recorded alpine-wind ambience bed
  is replaced by this game's own procedural atmosphere: paper grain,
  irregular page turns and slow ink blooms built from the engine's noise
  buffers, so the bed costs no download and plays even if the audio
  manifest never loads. Measuring reachability then retired six more
  inherited Foley assets — a carve sweep, a launch, two landings, a tree
  hit and a rock hit: five full 30 km runs (106,775 sim steps) produced
  zero airborne frames and zero obstacle hits, and the carve sweep needed
  82% of MAX_CARVE against a line that peaks at 48%. Eight files that
  could only ever be downloaded, never heard; the build fell 1.84 → 1.41
  MB. The generation spec was rewritten too, so regenerating audio can no
  longer quietly reintroduce ski Foley. Colour grammar: three shop skins
  wore colours that already meant something — GOLD and VIOLET sat exactly
  on the streak-burst escalation hues (a player who bought GOLD looked
  permanently mid-streak) and EMBER within one degree of the deuteranopia
  danger accent. The palette is now CYAN / LIME / MAGENTA / AURORA /
  COBALT, every hue at least 35° clear of every semantic colour, with the
  reserved set and the separation machine-enforced.
- Phase 14 — social + economy. Challenge links: a run compresses to a URL
  (seed, rules, word-lane salt, target distance — the deterministic core
  finally cashed in), copied from the death card, opened into a CHALLENGE
  title with locked rules and the same gauntlet on every attempt; no
  server, no network call. The ◆ balance got its two scoped sinks: a
  priced continue (short offer window, cost doubling per continue; a
  continued run keeps distance, bells and goal credit but never sets the
  best and never saves a ghost — boards stay unassisted) and five
  runner-light palettes in a title shop (halo, pool, comet tail, track
  trail; the core stays white, red stays the Redline's, both machine-
  gated). The deferred backlog moved into ROADMAP.md.
- Meta layer — the SLU shell's Layer-1 managers ported into `src/meta/`
  (stats ledger, deterministic daily goals, play streak) and wired to the
  run: goal chips and the streak on the title, and a learning recap on
  the results card that shows the true spelling behind every wrong read
  (fixing a latent bug where the true spelling was dropped exactly for
  fakes). New meta gate suite; all suites green.
- Phase 20 — the unreachable second pursuer retired. The rare pale figure
  that was supposed to cut across the track armed off the Redline's hunt
  counter, and Phase 7's pure-differential rewrite had deleted the hunt
  state machine: the counter is initialised to zero and never incremented,
  so the arming check returned on its first line, every run. Five full
  30 km runs (106,775 sim steps) produced zero appearances. Rather than
  re-arm a character nothing else in the design needs, it is gone: sim
  module, render module, escape patch, four interference stems and their
  manifest entries, the audio cue watcher and the two mixer layers. The
  approved-name cap drops five to four — the Redline, REDACTED, PUBLISHED,
  TODAY'S DRAFT — and the gate suite now enforces four and bans the retired
  name from live copy. The start button reads BEGIN RUN.
- Phase 20 — real type, and a meter that says what it holds. Both faces now
  ship with the build as latin-subset variable WOFF2 (68 KB together): the
  UI is Archivo, and the word plates are Atkinson Hyperlegible Next, drawn
  by the Braille Institute so I/l/1, O/0 and rn/m cannot be confused —
  exactly the discrimination a one-edit fake asks for. The plates had been
  rendering in whatever `ui-monospace` resolved to, which meant the single
  most important surface in the game looked like a different game on every
  device. Self-hosting keeps the zero-external-request rule intact (audit
  still reads 0); the faces are preloaded, service-worker cached, and their
  OFL texts ship beside them. READABLE TYPE no longer swaps to a system
  fallback — the shipped face already is the legibility face — so it buys
  tracking and weight instead. Plates repaint once the face resolves, so a
  pre-baked texture can never strand the fallback on screen. The wordmark
  is inline SVG now: loaded through <img> it was an isolated document that
  could not see the page's @font-face, so it could only ever have been set
  in a system stack. The DASH charge stopped being the source game's smooth
  glowing hairline and became a broadcast level meter — ten discrete cells,
  each worth about 0.3 s of dash, label lighting with the fill — and it is
  no longer called the GO METER, a name left over from before the mechanic
  was renamed. Gates: 33 / 53 / 80 / meta 70; v1 25 / 55 / 14. Build 1.20 MB.
- Phase 21 — roadmap items 2 through 7. **Copy:** REDACTED became CROSSED
  OUT (classified-document language is heavier than a general-audience death
  screen needs); the recap gained a real MISSED WORDS heading, SLIPPED BY
  became UNCAUGHT, EVERY READ TRUE became PERFECT RUN, and the stat bar's
  bare TRUE became TRUE READS. **Family gate:** a maintained blocklist,
  machine-checked against the bank AND every misspelling the fake generator
  can reach — 402,101 mutations, 104 of them blocked, 83 of which the old
  rejection predicate would have shipped (`country → cuntry`,
  `etching → etchink`, `capacity → capakity`). Fixed at the source: makeFake
  now consults the blocklist alongside the real-word guard. **Stats export:**
  the local ledger, the run just played and the dials that were in force, as
  a blob a player can paste back — the only data path the calibration
  verdicts have in a zero-network build. **Objective queue:** three live at a
  time from a pool of 49, with no retroactive credit, so one exceptional run
  cannot front-load months of progression. **Replay review:** THE RUN plots
  the speed curve recovered from the ghost track with every wrong read hung
  where it happened, and names the worst stretch only when the data supports
  one. **Definitions:** 99% of the bank carries a short WordNet gloss,
  bundled offline and filtered through the same family blocklist, so the
  recap can say what a missed word means. **PUBLISHED:** the 30 km finish
  was two grey buttons under a caption reading 50 KM against a 30 km
  finish; it is a title card now, with the run's own numbers. Driving a
  test to that finish surfaced a crash left by the Phase 20 removal — a
  dangling reference in the escape branch, unreachable until 30 km and
  therefore invisible to every other test. The finish is now actually run
  by a gate rather than only read. Gates: 33 / 53 / 85 / meta 136 /
  family 11; v1 26 / 55 / 14. Build 1.51 MB.
- Phase 21b — the literary names retired. The four are now **the Redline,
  RUN OVER, FINISH, DAILY RUN**. PUBLISHED, TODAY'S DRAFT and CROSSED OUT
  were each doing theme where a plain word does the job: a player reading
  under time pressure should not have to decode a publishing metaphor to
  know they reached the end, lost, or which run is today's. RUN OVER carries
  the game's own verb — the run is over — instead of a proofreading gesture.
  The finish card's own FINISH button became END RUN so the title and the
  action stop competing. All three retired names join the enforced retired
  list; the bare word TODAY deliberately does not, because it is ordinary
  English and BEST TODAY is a live HUD label. The roadmap's standing
  constraints now state the cap as four and name them.
- Phase 22 — the speed camera, and the DASH as an event. The rig now CLOSES
  IN as you accelerate instead of easing out (BACK_SPEED_GAIN goes negative),
  drops nearly twice as far, aims further down-track, and stretches the lens
  half again as hard; the dash punch and speed-line spike go up with it.
  Measured against the constraint that outranks all of it: at 62 m/s
  cruising the word plate is 270x68 px at the read moment, up from 244x61,
  because a closer camera more than repays a wider lens. The one case that
  needed catching was the dash, where the stretch, the boost and the punch
  stack to 106 degrees and shrank the plate below anything shipped — so the
  total FOV is now clamped at 96, and the gate proves the clamp is
  load-bearing rather than decorative. REDUCED FLASH damps every speed-keyed
  camera term: a speed-keyed rig is a motion-sickness surface, not only a
  flash one, and the composition is unchanged, just calmer. The DASH armed
  at 8 of 100 — after two reads, and never disarmed, so a good run was
  dashing 53% of the time with a light permanently on. It now fires only on
  a full charge: banked over about ten reads, spent whole, and sustainable
  by reading well under speed. At 70% accuracy that is a rare rescue (3
  firings a run); at 95% it is eight long deliberate ones. The multiplier
  deliberately did not rise with it — the reading window is
  ARM_DISTANCE_M / speed and ARM_DISTANCE_M cannot grow to compensate,
  because it sits under the minimum gate spacing so only one word is ever
  in play.
- Phase 23 — ENDLESS gets stakes. Three findings drove it, all measured on
  the real build. Doing nothing was a legal strategy: half of every gate is
  a fake, passing a fake is the correct answer, and an omission cost speed
  only — never a heart — so a silent run banked 50% accuracy for free and
  could only ever be run down by the Redline. The bell drip paid ~24 bells and
  ~4.7 hearts per kilometre with no player input at all, so a 70%-accuracy
  run lost 23 hearts and got all 23 back: the mode could not be lost by
  misreading. And a run had no arc because nothing was ever at stake.
  Now: BOTH wrong reads cost a heart (commission stays strictly worse —
  heart AND stagger AND meter, against the heart alone), and a heart comes
  back for a CLEAN READING STREAK instead of a drip nobody influences. The
  ladder shortens under pressure — three clean reads on your last heart,
  five otherwise — because a flat threshold put a 14x cliff between a 70%
  reader and an 85% one. The bells keep the meter drip and the banked
  currency; only the heart repair left them. Endless now reads as a skill
  ladder: idle 351 m, 55% 640 m, 70% 1,173 m, 85% 3,455 m, 95% 13,612 m,
  and STANDARD keeps its three-misreads-ever rule. A mid-skill run spends
  31% of itself one mistake from the end and claws back off the last heart
  about once — the arc the run never had. Speed itself is still flat at high
  skill (1.14x swing); the arc lives in the hearts now, not the speed.
- Phase 24 — playtest pass. The settings panel froze nothing, so reading it
  cost you hearts; it now freezes the run (0 m travelled with it open,
  against 24 m in the second after closing) without routing through the
  pause menu and stacking two overlays. The five pips beside the hearts had
  counted bells toward a repair that no longer happens, so they sat
  permanently empty; they now count the clean reading streak, follow the
  ladder as it shortens under pressure, stand down at full hearts, and read
  "Clean streak 2 of 5 to the next heart" aloud. KEEP THIS RUN? became KEEP
  GOING?. The wind bed is gone entirely — voice, trim bus, tuning constant
  and mixer fader — along with the airborne whoosh keyed to a state no build
  of this game can reach; it was an alpine noise curve inherited from a
  snowboarding game and this runner does not want one. HOW TO PLAY stopped
  being a controls list and became teaching: five sentences with the control
  set as a highlighted key inside them, naming the on-screen DASH button on
  touch and the F key only on a keyboard, and teaching the heart economy now
  that a wrong read costs one. The missed-word teaching moved off the
  results card into its own review panel — it was the best thing on that
  screen and it was competing with the score for it. The card keeps one
  line; the panel keeps every missed word with its definition, uncapped.

- Phase 25 — distance became a score. The run headline had been a metre
  count, which is a clock: it measures how long you survived and says
  nothing about how you ran, so a cautious 2,000 m and a blazing 2,000 m
  printed the same number. Score now accrues in the fixed-step sim — ten a
  metre, plus 250 for every true read — and both are multiplied by the same
  chain that already drives the meter, so it rises to 3.8x as the reading
  stays clean and collapses the moment it does not. The result rewards the
  quality of the run and not merely its length: across held accuracies the
  same ground is worth 13.2 points a metre when read badly and 51.5 when
  read well, and the spread runs 4,513 for an idler to 750,315 for a clean
  reader. Metres did not disappear; they moved to a sub-line under the score
  in the HUD and to the first cell of the results stat bar, because how far
  you got is still the thing you tell someone. Daily goals and objectives
  stay in metres on purpose — they are tasks, not scores, and a task should
  not move because you happened to read well. Because the stored number now
  means something different, the best-run keys and the challenge-link
  parameter moved rather than being reinterpreted: an old link parses to a
  goal of zero instead of quietly setting a metre count as a score to beat.
- Phase 26 — a music layer that other projects can take with them. The stem
  separation arrived warped: its "fixed tempo" setting does not leave timing
  alone, it flattens the music onto one constant tempo, so all four rendered
  stems sat on a synthetic 164.00 BPM against a master that averages 164.06
  and moves between 160.00 and 169.01. The error grows with playing time —
  0.08 s through the first minute, 0.26 s by the end — so no single offset
  repairs it. The MIDI transcription escaped that: it carries the real tempo
  map, 692 changes wide, and integrating note ticks through it lands every
  hit a constant 0.08 s ahead of the master with no drift at all. That
  constant is measured rather than assumed, by averaging the master's flux
  around every transcribed hit; the search has to be held under half a beat
  or each drum reports a different answer. So the timing comes from MIDI and
  the rendered audio is kept only for section-level loudness.
  The format stores everything in beats, and beat times are the only place
  seconds appear, because musical position survives re-timing and wall-clock
  does not — which is exactly the failure above. Sparse things are events,
  dense things are per-bar curves: no visual ever fires on an individual
  hi-hat, so hats ship as a busyness number instead of 784 timestamps. A
  generated map and a hand-authored overlay stay separate files and the
  generator never touches the overlay, so regenerating cannot destroy an
  afternoon of authoring. The whole map is 34 KB, under 10 KB gzipped.
  The runtime is two files that know nothing about this game, and the mapping
  that knows nothing about the analysis is a third. The clock takes playback
  position from the audio source rather than from frames, predicts forward
  between readings, and counts laps, because a single track loops many times
  across an unbounded run. It answers "how far to the next kick" rather than
  "did one just happen", since a visual started on the timestamp has no
  attack left. And it is honest about its own premise: measured against real
  playback, this browser reported a fresh position on 1492 of 1497 frames, so
  the smoothing mostly idled — it stays as insurance for the browsers that
  throttle, and it carried a dropped frame cleanly.
  What the game does with all this is deliberately hemmed in. Music modulates
  and the run decides: the arrangement can swing the visual energy a quarter
  either way and can never gate it, so a breakdown cannot mute a payoff the
  player earned. Music drives screen space only — camera, post, sky, palette —
  because the track is authored from a daily seed and crossed at 16 to 64 m/s,
  so a light on every eighth bar would land on the beat by accident. And
  nothing flashes on the beat: 164 BPM is 2.73 a second, inside the range
  photosensitivity guidance asks you to avoid, so discrete accents key off
  crashes and measure 0.55 Hz across the whole track. None of it is wired into
  the renderer yet, because there is no track in the build to sync to.
- Phase 27 — the wind was still there. Phase 24 removed the two voices NAMED
  wind and reported the sound gone, which was not the same claim and was not
  true. What a player actually heard was the glide voice: a bandpass noise bed
  sweeping 1542 to 2850 Hz with speed, running the whole time the runner was on
  the ground, measured at 0.011 to 0.037 gain across the speed range. That is a
  wind by any ear. It was DESCENT's board-on-snow contact, renamed in Phase 18
  to strip the last ski word from the engine — and renaming it was exactly why
  it survived, because the check that froze it in place asked what it was
  called rather than what it sounded like.
  It is gone, and two more went with it. Powder and ice were proven dead: both
  key off player flags that are set false at reset and never written again, so
  they measured zero gain at every speed. The dash rush was the same bandpass
  noise under a different name, and the dash still announces itself with the
  sweep and burst it always had. The trim node that existed to duck those three
  beds went too — with them gone it was an orphan connected to a bus with no
  input, and every transient on that bus routes to it directly and always did,
  so impacts, carves and wipeouts are untouched.
  Measured after: no voice in the audio path varies with speed at all. Going
  faster still reaches the ear, through the music stems, which take speed and
  chain exactly as they did — the run is scored rather than blown. The two
  gates that had frozen the old voice in place now assert its absence, and a
  new one fails if any sustained noise bed keyed to the runner's speed ever
  comes back.
- Phase 28 — the score is in the build. The whole song loops naturally, so
  there is no splice point to author and no overlay to write: the intro plays
  once on lap one and again on every lap after, which is what a track written
  to be listened to actually wants. It ships uncompressed at 6.73 MB because it
  fits — initial load goes from 1.51 MB to 8.28 MB, leaving 21.72 MB of
  headroom under the ceiling, and an encode would have cost quality to buy room
  nothing needs. It streams from a media element rather than a decoded buffer
  so a run can start before the whole file has arrived, and routes through the
  existing ambience bus, which means mute, the drain's lowpass and every duck
  in the mix already apply to it for free.
  The placeholder stem synth stands down the moment a real track is playing —
  it was always the fallback score, and two scores at once is not a mix.
  The camera reads the clock: a small bob on the kick and a larger, rarer kick
  on a crash, both scaled by the run's own intensity so a careless run is not
  handed the same swagger as a clean fast one. Measured in a real browser at
  the 100-second mark: the section resolves to the track's first bass drop-out,
  the drive term sits at 0.59 for a hot run, accents reach full strength, the
  beat never runs backwards, and the field of view moves on every frame instead
  of stepping. Reduced flash still removes every accent and scales the bob.
  Nothing here touches a word plate, and none of it can: the mapping reaches
  the camera and the post chain and has no path to geometry or to anything a
  word is printed on.
