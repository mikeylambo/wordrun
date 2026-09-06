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
- Phase 29 — playtest pass. The reported opening problem was real and
  measurable: the real/fake draw is a coin flip, so 6.4% of runs over 4,000
  seeds opened with four or more fakes in a row and the worst opened with ten.
  Ten gates is 850 metres and half a minute in which the player is never once
  shown a word worth tapping. Passing a fake is the correct answer and does pay
  the full speed gain, so those runs were not unfair — but a new player has no
  way to know that, the tap verb goes untaught, and every uncertain tap in that
  stretch costs a heart. The opening is shaped now: the first word of every run
  is real, and no more than two fakes run together for the first six gates.
  After the teaching window the coin flip is exactly as it was, measured at
  49.7% against a 50% draw, and the shaping is still a pure function of the
  seed so replays and challenge links hold.
  Assistance now costs score as well as records. A continued run already could
  not set a best or leave a ghost; it now banks 70% of what it earned per
  continue, compounding, and the results card says so where the number is
  rather than only refusing the record quietly.
  Filling the dash meter was the best moment in a run and it happened in
  silence. It gets a rising-edge cue — a short two-tone lift and one flash of
  the cells — fired once per fill and never again until the meter empties and
  refills, with REDUCED FLASH keeping the sound and dropping the pulse.
  The settings panel is reachable from the pause menu, not only from the title,
  so wanting to change a setting mid-run no longer means ending the run.
  Returning from it lands back on the pause menu rather than resuming a run
  nobody asked to resume.
  Two other reports were checked and found already fixed: the panel does freeze
  the run (0 metres travelled with it open against 18.9 in the same span after
  closing), and both wrong reads do cost a heart, confirmed by driving all four
  cases in the real build rather than the pure engine, which has no hearts.
  Running THROUGH a misspelled word is the correct play and costs nothing by
  design — that one is a presentation problem, not a rules problem.
- Phase 30 — HUD stack and the STANDARD failure. The hearts sat at a fixed
  offset below a score headline whose height is clamp(38px..66px), so the
  collision depended entirely on viewport width: on a phone there was a gap,
  and on a wide screen the number grew straight through them, taking the metre
  line with it. They live in the HUD column's flow now, so the spacing follows
  the headline instead of guessing at it — measured clear at 390, 430, 768,
  1280 and 1670 wide, where before the hearts began 13px inside the score's own
  box. The charge pips ride along with them, as they always did.
  Failing a STANDARD route now costs score, keeping 60% of what the run earned.
  ENDLESS is deliberately exempt: every endless run ends in death, so a death
  penalty there is a global multiplier that changes nothing about how anyone
  plays, while STANDARD is a route with an end and falling short of it is a
  real failure. The card names which reduction applied rather than printing a
  bare smaller number.
- Phase A — render-ahead, as a prototype with a stop at the end of it. The
  three unarmed gates beyond the armed one are drawn at their true positions on
  the winding centreline, stepping down 0.55 / 0.32 / 0.18 while the armed
  plate keeps its exact treatment. Nothing about the engine changed: the
  renderer builds future gates through the pure seed function and its own
  cache, so reading ahead cannot advance the gate the player is answering, and
  no unarmed plate arms, resolves or emits an event. ARM_DISTANCE_M is
  untouched at 55, still under the 62 metre spacing floor, and the suite proves
  by exhaustion — sixty seeds across thirty kilometres — that exactly one gate
  is ever answerable however many are drawn. Seeing further is not answering
  earlier, and that distinction is the load-bearing one.
  Proving the armed plate unchanged took two attempts. Comparing frame-indexed
  render traces across lookahead values failed, and the failure was the test's:
  the run advances on real time, so a trace keyed to frame numbers differs run
  to run for reasons that have nothing to do with lookahead. Keyed to the gate
  instead — every value in the call being a pure function of it — the armed
  plate's parameters are identical at 0, 1, 3 and 6.
  That widened comparison also turned up a real regression. The run-start warm
  from Phase 8.1 paints the first plates before BEGIN RUN so the opening frame
  is a cache hit; it named the old preview plate directly, so it threw once per
  run and, worse, would have left the new plates cold to raster and upload on
  the start frame — the exact hitch Phase 8.1 existed to remove. The warm now
  covers every plate the first frame draws, and the gate asserts the row rather
  than a fixed second plate.
  `?lookahead=0|1|2|3|4|6` overrides the count for an A/B in one session. The
  build before this phase drew one preview plate at 0.55, so 1 reproduces it
  and 0 draws none at all.
- Phase 31 — the last sound shared with the source game. Comparing the two
  repositories asset by asset found exactly one file in common, and it was the
  one being reported: `go_rush-v01.mp3`, identical byte for byte, md5 and all.
  Its own generation brief describes it as "compressed air opening into a
  bright aerodynamic whoosh" — an air sound, playing on the verb the player
  presses most, because it was layered onto the dash. Phase 27 removed the
  synthesised rush and left the recorded one behind, which is exactly why the
  wind kept being audible after the wind was reported gone. Removing a voice by
  name twice while the sample survived is the lesson: the file and the manifest
  entry are gone, and a gate now asserts every shipped asset was generated for
  this game rather than inherited.
  The same comparison found five voices this game cannot reach: takeoff, the
  three landings, and the stunt shove — the jump-and-land vocabulary of a
  snowboarding game, whose events no source in this build emits since the jump
  verb left in Phase 7. Two patch-layer wrappers had gone stale around them and
  were worse than dead: one wrapped a player method that no longer exists, so
  it would have thrown had anything ever called it. All of it is out, and the
  surface bus keeps its real transients.
  Of thirty-four sound methods the two games still share by name, the rest are
  the audio engine itself — buses, tone and noise helpers, the update loop —
  which is shared framework rather than shared sound.
- Phase 32 — a tuning panel, because the console is not reachable where the
  playtesting happens. Every live value was already exposed on `window.__TUNING`
  and read per frame, which is useless on a phone. The panel is the same object
  behind buttons and sliders: the look treatments, the lookahead count as a live
  0–6 row, and seven numbers including the three plate fades. It writes straight
  through to the tuning object, so a change made in either place is visible in
  the other — the panel is a convenience, never a second source of truth.
  It loads only under `?dev=1`, through a dynamic import, so it lands in its own
  4.6 KB chunk beside the 6.4 KB treatment lab and a normal load fetches
  neither. The lookahead row can now be resized while a run is in progress,
  pooling retired plates rather than rebuilding textures, which is what makes an
  A/B of the count a single tap rather than a reload.
  The treatments themselves were built during the earlier mockup pass and had
  never been reachable from the build at all — they were dev-only files nothing
  imported, which is why looking for them found nothing.
- Phase B — when you answer, not only whether. A tap now resolves the gate
  where it was made rather than holding the outcome until the line: answering
  is the act, and running the remaining metres is not part of it. A word left
  alone still resolves at the line exactly as before, so the passive path — the
  gentle-failure spine — is untouched.
  The reward runs across the existing 55 metre window and changes nothing about
  it: answering the instant a word arms pays 3x, answering at the line pays 1x,
  linearly between. It reaches score and meter fill only. It is deliberately
  kept off the speed curve, which is already asymptotic and would have driven
  the reading window through its own floor if tripled — both floors are gated
  and both still stand at 1.15 s and 0.75 s.
  Two scripted runs over the same seed, one answering at the arm edge and one
  at the line, land on the same 32 reads, the same distance and the same
  62.41 m/s: the multiplier reaches the score and stops. The gap is +16% for
  now because distance still pays, and it widens sharply at Phase D when it
  stops.
  Nothing announces this in words — the four-name cap forbids it and the design
  does not need it. An early read hardens the chime's attack, opens a bright
  partial above it, and taps the camera; a late read gets today's confirmation
  unchanged. The gate checks the correct-read path carries no display string at
  all rather than banning vocabulary the game already uses elsewhere.
  One deviation from the brief, deliberate: read time is averaged over ANSWERS
  rather than over every gate. A passed fake has no moment of decision to time,
  and counting its full window transit would have made the correct cautious
  play read as slow. The results card carries the one new figure, replacing
  lifetime kilometres — which said the least of the three now that distance is
  on its way out as a board metric.
- Phase C — two zones, one primitive. The right half of the screen says the
  word is real, the left half says it is fake, and saying nothing still says
  fake. The passive path is untouched on purpose: a cautious player who never
  reaches for the left zone plays exactly the game they already knew, and a
  scripted pair of runs confirms it — 84 correct reads either way, identical
  hearts and identical mistakes. The left zone buys timing, not outcomes.
  The heart moved, deliberately, and this needed thinking about because
  Phase 23 had put it on both wrong reads to stop idling. It now sits on
  exactly one action — saying REAL to a fake — because a reject that costs
  MORE than silence is a control nobody would ever press, which would have
  made the whole phase decorative. The worry was that idling would come back;
  it does not. An untouched run ends at 328 metres in 14.4 seconds with zero
  hearts spent, run down rather than wiped out. The speed differential was
  always what ended those runs; the heart was never doing that work.
  Two real faults surfaced while building it. The two-thumb dash was detected
  on the release, and a reading fires when a thumb lifts — so the first half
  of the gesture had already been spent as an answer before the second half
  landed, measured as two edges where there should be one. Deciding on the
  press instead fixes it with no cost anywhere: waiting to see whether a
  second thumb arrives would have taxed every single answer by the width of
  the window, and Phase B had just made answer latency worth score. And a gate
  that claimed to test a tapped fake had been testing an omission since
  Phase 29 shaped the opening — it searched for a seed whose first gate is
  fake, which can no longer exist, and passed only while both mistakes cost a
  heart. Both are gated now.
  The 250 ms hold that armed the dash is gone; it is an edge on Space or on
  both zones. The arrow and WASD pairs became the two zones, which cost
  nothing: they drove a steering axis the sim has ignored since the track
  became auto-followed, and nothing reads it.
- Phase D — the score is reads, and the daily is a route. Distance pays
  nothing now: a metre is time served rather than skill, and a board built on
  it ranks the player who survived longest above the one who read best.
  Distance stays on screen as pacing and on the card as context; it is not a
  term anywhere in the score. What pays is the read — base, times the word's
  tier, times how early the answer landed, times the chain, with a placeholder
  for Phase F's compression.
  The tier ladder went in flatter than it first looks like it should, and the
  reason is worth recording: the tier a gate lands in climbs with distance, so
  a steep ladder is a distance term wearing a disguise, quietly buying back
  exactly what this phase removed. Measured across the ladders, the difference
  is large — with 1/1.25/1.6/2/2.5 the first forty gates average tier 1.90
  against 3.16 for the full hundred, and the back half of the route carries
  the score on depth alone. At 1/1.15/1.3/1.45/1.6 the break-even is fifty
  gates: half the route read at the arm edge outscores the whole route read at
  the line, 181,352 against 146,351, on 3,802 metres against 7,016.
  The brief asked for that comparison at forty gates rather than fifty. It
  does not hold there and the gate says so plainly: forty-early scores 136,688
  against 146,351, a few percent the wrong side of a knife edge that two and a
  half times the content against a three times rate put there by construction.
  Reaching it needs the early multiplier near 4.0, which is a feel decision
  rather than a gate's to make — so both dials are on the tuning panel now and
  the shipped values are the brief's own. Depth still pays at equal quality:
  the full route read well is 404,815 against half at 181,352.
  The DAILY RUN is a fixed route of one hundred gates. Its word salt is pinned
  where ENDLESS re-rolls it every attempt, because a daily that re-rolls is two
  players playing different games under one name — verified byte-identical
  across players, a hundred gates and a hundred distinct words. Reaching the
  hundredth gate raises a flag the existing endgame layer reads, rather than
  setting the finish directly: the coast, the stopped pursuit and the card are
  the same as the canonical finish because they are literally the same code.
  ENDLESS is untouched and endless — it is where the practice happens.
- Phase E — the last stand. Being run down was the flattest ending in the
  game: the gap closes, and there is nothing to do about it but watch. Once
  per run, the Redline's arrival now opens one more word instead of ending
  the run. The gap holds at the throat, the corruption sits at its worst, and
  the answer decides it — read it and the Redline is pushed back out to forty
  metres; miss it, or let it cross, and the run ends exactly as it would have.
  Measured: surrendering the stand ends at 344 m in 15.2 s, holding it reaches
  466 m and 5.7 seconds more run. It fires once and only once in every mode
  and continue combination, because the flag lives on the run rather than on
  the player — a restart gets a fresh one and a purchased continue inside a
  run does not.
  Getting the suspension right took a second pass. The first version cleared
  the Redline's kill once, on entry, and the stand lasted a single frame:
  the pursuit re-arms its kill every frame at that gap, so it has to be held
  off every frame too, not once. The tell was the two runs finishing at an
  identical 328 m.
  A recovered run keeps every board right it had. This is a skill save and
  the exact opposite of a continue — a continue is bought and forfeits the
  best and the ghost; a stand is read, and forfeits nothing.
  No label announces it, and none was needed. The corruption presentation is
  already driven by the gap, so pinning the gap pins the picture at exactly
  1.000 with no second system to keep in step, and the mix drops to six
  percent under one held tone that does not decay. Silence is the tell.
- The readout each mode actually needs. Distance survived Phase D as a
  sub-line out of habit, and on the DAILY RUN it had already stopped meaning
  anything: the route is a hundred gates, so every finisher covers the same
  ground — measured, two runs scoring 404,815 and 146,351 finish 0.75% apart
  in metres. A number that cannot tell those two runs apart is not a readout.
  The daily shows position on its route instead, 6 / 100, which is the thing
  two players can actually compare and the thing that says how much is left.
  ENDLESS keeps metres, because it has no route to be partway through and
  distance is the honest endurance figure there.
  Time went onto the results card and deliberately not onto the HUD. A clock
  on screen tells a player to hurry, and this game's entire posture is that
  the word stays readable long enough to be read — the window floors exist for
  that. Phase B already prices answering early, and it is calibrated; a live
  timer would double that pressure with nothing calibrating it. On the card it
  is a record of the run rather than a demand during it, and on a fixed route
  it is the one figure besides score that separates two finishers.
- Phase F — the player sets their own bar. At level n the early-read
  multiplier pays only for answers landing beyond a threshold, and everything
  inside it pays the late rate; in exchange every qualifying read is worth
  more. Clearing a bar you set yourself pays 404,815 / 465,537 / 546,501 /
  647,705 across the four levels on the same route. Setting one you do not
  clear costs: answering at forty percent of the window scores 239,824 at
  level 0 and 137,580 at level 2, where the bonus never arrives and the early
  rate is gone with it.
  The constraint the whole phase is fenced by holds. Compression does not
  shrink the arm window and cannot be made to — the word is fully legible for
  all 55 metres at every level, both reading floors still measure 1.22 s at
  cruise and 0.86 s at the ceiling, and a gate asserts nothing in the phase
  ever writes ARM_DISTANCE_M. What a late answer costs at a high bar is money,
  never the run: every level still finishes the route answering on the line.
  Two faults, both found by playing it rather than reading it. One hold moved
  the bar two levels, because advance() runs several fixed steps per frame and
  an edge left standing is applied by all of them — the same shape as any edge
  in a fixed-step loop, and the reason confirm has always carried its own
  guard. And the gesture as specified was unreachable exactly where it
  mattered: it had to begin and end inside the gap between words, but that gap
  runs 1.11 s early in a run and 0.11 s at the spacing floor and the ceiling,
  against a hold that must outlast the 0.22 s tap window to be told apart from
  an answer at all. An expert at speed had no window to use it in. The intent
  is buffered now and lands at the next moment nothing is armed, which keeps
  the rule the restriction was written for — the bar never moves while a word
  is on screen — while making the control usable at the speed it exists for.
  The level shows as marks beside the meter and is never named: the cap is
  four names and this is not one of them. A wrong read of any kind drops it to
  the floor, which is the sting the risk is priced against.
- Phase G — the words you keep missing, and the curve that shows you beating
  them. A local per-word ledger holds attempts, misses and last-seen for up to
  400 words, trimmed on write rather than on read because a ledger bounded only
  at load is unbounded in practice. It rides the same adapter seam as the
  stats, so it round-trips wherever they do.
  The lane substitutes into roughly one gate in twelve and does not reorder
  anything. That distinction is the phase: the tier walk's no-repeat guarantee
  is a coprime stride, and reaching into it would break the property for every
  word rather than the substituted one. The walk runs first and unconditionally
  and only then is the printed word allowed to differ — proved by building the
  same 400 gates with and without a lane that substitutes constantly and
  finding the walk's own choice identical at every one, with the same zero
  repeats either way. A substituted gate keeps its position, its tier and its
  truth; only the vocabulary is personal.
  It is off on the DAILY RUN, and the sim refuses it there rather than trusting
  the caller — that route is the same hundred words in the same order for
  everyone, and a personal substitution would make two scores incomparable
  while looking identical.
  Playing it found the flaw a schedule exists to prevent. A word stayed due
  until it retired, so one word filled gates 12, 24, 36 and 48 of a single run
  — spaced repetition with no spacing. A word read right now goes further away
  each time, and among equally-missed words the lane takes the one least
  recently seen, so a shelf of troublesome words rotates instead of one of them
  owning every substitution. Three clean reads retire a word for good, and the
  results card names it: the word, how many times it beat you, and that it is
  gone.
  The curve screen is the retention hook and the strongest thing to say about
  this game to a platform: per-tier accuracy this week against last, the read
  time trend, and the count of words beaten. It refuses to draw a trend it
  cannot support — a chart from a single run is a lie with a chart around it —
  and it is figures only, with no name of its own.
- Deferred list — the three items the mastery brief parked, minus the board.
  Deception families: a block of five gates now shares a preferred mutation,
  so four transpositions in a row teach a player to look for transpositions
  where four unrelated single edits taught only that something somewhere was
  wrong. The family is a bias on the ORDER edits are attempted in, never on
  which are allowed, so no new string becomes reachable and the safety guard
  still decides what ships — 422 of 454 blocks run their family with at most
  one exception, and the exceptions are short words where the preferred edit
  has nowhere to go. Pure in the seed, so the daily route composes identically
  for everyone.
  Flow-state escalation: holding a capped chain while answering early accrues
  a surge that opens the field of view a little and pushes the music stems as
  though the chain went further. Deliberately small — the word plates are read
  at this field of view, so the reward for reading well cannot be a harder
  read — and it reaches nothing that decides the run: no score term, no speed
  term, and it sits inside the same FOV clamp as everything else.
  Building it surfaced a rule worth keeping. A passed fake is a correct answer
  and always will be, but it resolves AT the line: there is no early moment in
  it to reward, so passing tops out partway on runs of consecutive real words.
  Rejecting the same fake from range is the same answer given sooner, and only
  that sustains the surge. The reject zone has been optional and never worse
  than silence since Phase C; this is the first thing that makes it better,
  without making silence cost anything.
  Word danger ratings, half of one. The honest version of this number is how
  often everyone ELSE misses a word, and there is no aggregate to ask yet, so
  the structural half ships and the slot stays open: length, doubled letters,
  adjacent vowel runs, the suffixes English cannot make up its mind about, and
  the letter pairs that resolve as a different glyph under motion (rn as m, cl
  as d). The local ledger supplies a personal correction, ignored below three
  attempts because one miss is an accident, and weighted to at most 0.6 so one
  player never fully overrules the word itself. It shows in the review panel
  as three pips beside each missed word — marks, not a name — answering the
  question a review always raises: was that one on me, or is it just a
  horrible word. The first draft scored confusable LETTERS rather than pairs,
  which matched almost every word in the bank: a constant offset dressed up
  as a measurement.
  Charge-banking was rejected rather than deferred, and the per-band hue
  palette is filed with the visual pass.
- Playtest pass 2 — four reports, four root causes, eleven new gates.
  The wind came back with the Redline, and it had. Phase 27's note claimed
  every sustained noise bed was gone; what it actually removed were the
  SPEED-keyed ones. Two PURSUIT-keyed beds were left running — a wandering
  bandpass on white noise, and a highpassed hiss rising with the square of
  corruption — so the sound returned for exactly the stretch where the pursuit
  closes, which is the worst moment in the run to sound like weather. Held
  broadband noise is wind to an ear whatever the filter in front of it is
  called. Both are gone: the pursuit voice is now a detuned pair through a
  resonant lowpass on the same LFO, which reads as an electrical fault, and
  the far corruption layer fires as short crackle at a rate the same curve
  sets rather than being held open. The gate that guards this is about SUSTAIN
  rather than naming — a voice may be fired as a transient, never assigned and
  held on a bus — because naming is what the last two attempts policed and the
  sound came back anyway.
  The road's lines did not connect, and could not have. The etched `grid` took
  both axes from world space while the rails followed the ribbon, so on a bend
  they were in two different coordinate systems: world-X stripes are not
  parallel to a rail that is sliding in X through a turn, so they wandered
  across the ribbon and were cut off by its edge at whatever angle the corner
  made. The `grid` is drawn in track space now — the across-axis comes from the
  lane attribute, which became signed to carry it — so every stripe runs
  parallel to the rails and every rung ends on one. The `grid` also stops at the
  rail instead of running on into the strip outboard of it, and the verge posts
  were snapped from the generator's own x (a point off the side of the only
  visible ground in the scene, which is why they stood on nothing) to the
  ribbon edge at its banked height. Rail, `grid` and posts now share one line.
  The continue's price was invisible while it mattered. The multiplier was
  applied once, at the recap, so the HUD went on counting from the full total
  for the rest of the run and the number only fell after it was too late to
  read as a cost. It is taken off the live score the instant the continue is
  bought — measured at 133,495 to 93,446, exactly the 0.70 the tuning says —
  with the drop shown happening beside the score, and the recap no longer
  charges for it a second time. The death card still reports the full amount.
  The results card was carrying two parallel goal systems in two places:
  today's chips floating loose under the score, and the rotating queue under
  its own heading much further down, which read together as six unrelated
  targets. They print once now, in one block. The chart caption stopped
  repeating the miss count the button above it already gives, and said where
  instead. The scrim behind the card was the larger problem — it started at 8%
  opacity over the run's last frame, which at a death is the corruption at full
  strength, the busiest image the game can produce, sitting at near-full
  contrast directly behind the score and every label under it. The shot is
  context, not content.
- Debugging pass — three reports, and one process failure of my own.
  The space bar was firing the dash for a single frame. Phase C made the dash
  an EDGE — `dashEdge` latches for one frame and `consumeJump` clears it — but
  the consumer was never converted from the HOLD model it was written as: the
  dash ended the instant its input went false. So a tap switched Overdrive on
  and off inside 16ms, spent 0.6 of a 100-unit meter, and read as a dead key.
  The on-screen button and the F key only ever worked because they happen to
  be holds. A full charge is spent whole now, which is what the tuning has
  claimed since `MIN_ACTIVATE` was set equal to `METER_MAX`: activation is the
  commitment, the dash runs until the meter is empty, and all three controls
  give the same 2.95s.
  Two things were drawn without following the ribbon. The runner's ink trail
  was the only thing on the ground with fog disabled, and at 180 samples it
  recorded the whole run — so its far end held full additive brightness for
  130m while the road beneath it faded out, which is what makes a ground mark
  read as a line laid OVER a scene rather than left on it. It is a 48-segment
  tail now and takes the same fog as the road. The gate's ground line is the
  one road marking drawn separately from the ribbon mesh, and so the one that
  had to be told the ribbon BANKS: flat at a constant 0.06, it was buried up
  to 0.59m under the road at one rail and floating 0.47m over it at the other,
  on a track whose edge lifts 0.53m at its worst bend. It is rolled into the
  ribbon's own cross-section now, from the same bank constant the mesh uses.
  There was onboarding for the two zones — it just stopped existing after the
  first run of the DAY, which for anyone past their first sitting is never.
  A lesson now runs until the player has performed the action it teaches and
  then goes quiet for good, so someone who taps REAL on instinct never sees a
  word of it and someone who has not found the left zone keeps being told it
  is there. The dash had no in-run teaching at all: one line said where the
  charge comes from and nothing ever named the control. It is named now, at
  the moment the bar is full, which is the only moment the instruction can be
  acted on.
  Two findings worth recording rather than acting on. The props module —
  trees, rocks and the verge posts — draws nothing: this terrain generates no
  colliders at all, so every instance count is zero. That means the verge-post
  placement fixed in the previous pass was dead code, and the posts visible in
  the world are the speed-fantasy stanchions, which were always track-relative.
  And the previous pass appended to this file AFTER its final gate run and did
  not re-run, so it shipped a red banned-vocabulary gate: `grid` is the
  engine's name for the road's etched pattern, and naming it in prose trips a
  scan that exempts code spans for exactly that reason.

- Phase 0 — reconcile the architecture. A pure-refactor trust-repair pass:
  zero player-visible change, proven by a behaviour-snapshot gate
  (`tools/refactor-snapshot.mjs`) that records the exact hearts/bells/repair/
  death/score trajectory of five scripted runs and asserts it byte-identical
  before and after. **The runtime monkey-patch is gone.** `src/rc5.js` — a
  file named like scaffolding that actually held hearts, heart-repair, bell
  collection, a second HUD and dead hunt-mode lighting, loaded through one
  easy-to-miss side-effect import in `render/material-pass.js` and drifted out
  of sync with the code — was dissolved into its real homes: hearts, the
  streak-repair ladder and the bell pickup into `sim/sim.js`'s step loop (with
  the field on `sim.bells`); the bell meshes into `render/bells.js`; the hearts
  HUD into `ui/ui.js` (styles in `index.html`); the pickup/heart/loss sounds
  onto the sim's own events in `main.js`. The tiny prototype synth was already
  dead (the main `Audio` engine had superseded it) and went with the file. The
  hunt-mode lighting dim and the hunt audio stinger were deleted outright —
  they keyed on `beast.mode === 'hunt'`, a state that has not existed since the
  pursuit director was removed. `sim.debug()` no longer throws: it read
  `this.beast.modeT` / `modeDuration`, fields the live `Beast` never had, so
  `window.__DEBUG()` threw on every call — dropped. The verge-post branch in
  `render/props.js` (a confirmed duplicate of `speed-fantasy.js`'s
  `TrackPylons`, and dead anyway since every feature count is zero) was
  stripped, and the file now says plainly what it draws and does not. Five
  orphaned files with zero references were deleted (`rc3.js`,
  `design/landing-feel.js`, `design/rc6-core.js`, `design/release-tuning.js`,
  `design/landmarks.js` — the last a name-collision with the live
  `render/landmarks.js`). The gates that verified behaviour by string-matching
  `rc5.js` now point at the real homes and prefer the exported `HEARTS.*`
  constants. Three standing gates were added: the behaviour snapshot, a
  `sim.debug()` no-throw check, and a reachability gate that fails the build if
  any `src/` file is unreachable from the two entry points — the check that
  would have surfaced `rc5.js` in the first place. And the process that let a red
  gate ship is closed: a `.githooks/pre-commit` re-runs the full suite as the
  last thing before every commit, after every file including this one. The
  DASH arming-threshold note left stale on the roadmap (it recommended raising
  `MIN_ACTIVATE`, which shipped at `= METER_MAX` in Phase 22) was retired, and
  the leaderboard's policy ruling recorded as settled.

- Phase 1 — the curve screen and the nemesis words made worth building. The
  data already earned this; it just had no presentation to match. `CurveLog`
  kept 28 days of per-day, per-tier buckets and `summary()` collapsed all of it
  into one week-vs-week delta. A new `series(days = 14)` returns the daily
  per-tier accuracy and average read time as arrays, oldest → newest, with a
  day never played left `null` rather than interpolated — and the curve screen
  now draws each tier as a thin SVG sparkline instead of a single bar, so a
  player can SEE themselves climbing over two weeks, gaps and all, not just be
  told a number moved. A retired word used to be visible only on the death card
  of the run that beat it and then thrown away; `NemesisLedger` now keeps a
  bounded gallery (last 40, newest first) of beaten words with what each cost —
  misses and attempts and when — and the curve screen shows it as the game's
  proof of work. The retirement itself, the single most personal moment in the
  game, gets its own beat AT the read now, not a text line two screens later:
  its own one-shot cue in `audio.js` (a full major arpeggio that opens into a
  held fifth and a shimmer — deliberately not a louder correct-read chime), and
  an escalated burst that reuses the reserved escalation palette so it adds no
  new hue the colour grammar does not already own. The death-card mention stays,
  now a recap of something already felt. And the title's YOUR READING entry
  wears a single dot when there is something new since it was last opened —
  measured by the lifetime retired count, so it survives sessions and clears on
  open — an indicator, not a notification-bait number. New gates: `series()`
  is exactly `days` long, oldest-first, gaps `null`, never fabricated; the
  gallery is bounded and survives a storage round-trip; and the retirement
  flourish introduces no hex the reserved-hue separation does not permit.

- Phase 5 — delivery polish: the bundle is code-split. Vite's own build output
  warned about the single ~1.19 MB chunk; the shop, pause and onboarding panels
  are none of them needed for the first frame, so they now load behind dynamic
  `import()` as their own chunks (shop ~3.1 KB, pause ~3.9 KB, onboarding
  ~6.2 KB) and the main chunk drops to ~1.13 MB — less JavaScript to parse
  before the game is interactive on the lower-end devices Playables gets played
  on. They are preloaded a couple of frames after the title paints, so they are
  ready before a player can reach them, and every call site is guarded, so the
  window before a chunk lands is a safe no-op rather than a broken pause or a
  dead shop button; a panel that lands mid-run catches itself up to the current
  state on construction. (A `let`-in-TDZ trap on the first setup-time loader
  call was found and fixed by a browser smoke pass — the node build alone did
  not surface it.) Fresh audit numbers, taken after the split: `audit:size`
  8.26 MB total (unchanged — the 6.73 MB music track dominates, and the split
  only moves JavaScript between chunks), all Playables ceilings green with
  21.7 MB of headroom to the 30 MB initial limit; `audit:network` still zero
  external calls across boot, run and death (22 same-origin assets — the new
  chunks are same-origin module loads, so they add nothing off-origin). The
  120 fps / WebGPU showcase pass is deliberately left for after there is a
  public link worth featuring, per the roadmap.

- Phase H — calibration verdicts. Every number the roadmap had parked as
  "waiting on a human" was run through an instrument, decided, and frozen.
  The instrument is `tools/calibration-gates.mjs`: five measurements, each
  printing the table its verdict was read from, and a freeze — the file
  holds a golden of the 32 calibrated dials AND the tables they produce, so a
  dial cannot move without `npm run calibrate` regenerating its table, and a
  table cannot drift without a dial having moved. (The same script refreshes
  the Phase 0 behaviour snapshot, whose trajectories carry the score.) The
  readers are deterministic: a seeded coin decides each gate, and the answer
  lands at a fixed fraction of the 55 m window, so the dial under test is the
  only thing that varies. Runs in a third of a second.
  **Speed ceiling — keep 64.** The gated standard is two-tier (comfort at
  cruise, hard at the ceiling, and hard for a DASH at cruise): at 64 that is
  1.17 s / 0.86 s / 0.83 s against floors of 1.15 / 0.75 / 0.75. The one
  sub-floor figure in the table, 0.61 s, is a DASH at the asymptotic ceiling
  — a speed the diminishing-returns curve approaches and never reaches (twenty
  clean reads sit at 58.8 m/s). 72 breaks the hard floor plain (0.76 s);
  nothing moves, so the plate size at the read moment is untouched.
      ceiling | cruise8  win   OD   | deep20  win   OD   | ceil  win   OD   | standard
           48 |  41.75  1.32  0.94 |  46.99  1.17  0.84 |  1.15  0.82       | holds
           56 |  44.84  1.23  0.88 |  53.33  1.03  0.74 |  0.98  0.70       | holds
           64 |  47.17  1.17  0.83 |  58.83  0.93  0.67 |  0.86  0.61       | holds  <- shipped
           72 |  48.98  1.12  0.80 |  63.57  0.87  0.62 |  0.76  0.55       | BREAKS
  **Drain bite and HARD's pace-30 fairness — and a finding the brief did not
  expect.** Held-accuracy readers at 55 / 70 / 85 / 95 / 100 % on every
  difficulty, answering the instant a word arms, on the daily route and in
  ENDLESS:
      diff    acc   | DAILY route (100 gates)              | ENDLESS
      easy     55% | fails     4 gates redlined          0 |     289 m redlined
      easy     70% | fails    20 gates wipeout      20,302 |   1,749 m wipeout
      easy     85% | fails    56 gates wipeout     124,129 |   9,196 m wipeout
      easy     95% | fails    99 gates wipeout     326,047 |  35,185 m alive@cap
      easy    100% | CLEARS  100 gates finish      395,456 |  37,683 m alive@cap
      normal   55% | fails     3 gates redlined          0 |     205 m redlined
      normal   70% | fails    20 gates wipeout      22,029 |   1,749 m wipeout
      normal   85% | fails    56 gates wipeout     141,378 |   9,196 m wipeout
      normal   95% | fails    99 gates wipeout     388,382 |  35,185 m alive@cap
      normal  100% | CLEARS  100 gates finish      471,624 |  37,683 m alive@cap
      hard     55% | fails     3 gates redlined          0 |     205 m redlined
      hard     70% | fails    20 gates wipeout      26,098 |   1,749 m wipeout
      hard     85% | fails    56 gates wipeout     159,295 |   9,196 m wipeout
      hard     95% | fails    99 gates wipeout     409,290 |  35,185 m alive@cap
      hard    100% | CLEARS  100 gates finish      494,716 |  37,683 m alive@cap
  Pace 30 is fair: a clean reader finishes the route on HARD exactly as on
  EASY. But the brief asked to confirm that HARD at 85 % clears the route
  and HARD at 70 % does not, and the table says 85 % clears it on NO
  difficulty. The reason is a rule, not a dial: STANDARD repairs no hearts,
  so the route allows exactly two wrong reads on FAKES in a hundred gates —
  about 96 % fake recognition. Hearts, not the Redline, end the route for
  every reader from 70 % up (the wipeout gate is 20 / 56 / 99 on all three
  difficulties), and the pace only bites once accuracy has collapsed the
  speed (the 55 % rows are the only "redlined" deaths). The same holds in
  ENDLESS: distance at a held accuracy is identical across difficulties above
  55 %, because a fast reader outruns pace 24, 27 and 30 alike. Two readings
  of that. One: the difficulty knobs — pace and tier — do not differentiate a
  competent held-accuracy reader at all; HARD's teeth are the word tier,
  which lowers a HUMAN's accuracy, and a held-accuracy sim cannot see that,
  so real HARD is harder than this table shows. Two: the daily route is a
  mastery target by construction (Phase 30's `STANDARD_FAIL_KEEP` exists
  because most runs are expected to fail it and keep 60 %), and that is
  consistent with the score model — a failed route read early still
  outscores a full route read late. So the rule was not tuned away to make
  the brief's sentence true. The gate freezes what is actually true: a clean
  reader clears on every difficulty; hearts, not pace, end the route from
  70 % up; 70 % never clears; and 85 % clears nowhere. Whether a two-
  commission budget is the intended bar for the DAILY RUN is a design
  question for a human, raised in this hand-off rather than decided in a
  gate. (Phase 23's earlier ladder read 843 m and 12 km for 70 % and 85 %
  readers with a different error mix; same ordering, same order of
  magnitude.)
  **`EARLY_MULT` — 3.5.** The sweep, forty and fifty gates read at the arm
  edge against the whole route read at the line, plus the meter coupling the
  rate carries (reads from empty to a full dash, at chain 0 and at the cap):
      EARLY_MULT | 100 late  | 40 early (ratio)   | 50 early (ratio)   | 100 early | charge chain0 / cap
             3.0 |   146,351 |   136,688 (0.93  ) |   181,352 (1.24 ✓) |   404,815 | 6 / 2
             3.5 |   148,544 |   159,265 (1.07 ✓) |   211,296 (1.42 ✓) |   471,624 | 5 / 2  <- shipped
             4.0 |   150,736 |   181,842 (1.21 ✓) |   241,239 (1.60 ✓) |   538,433 | 5 / 2
  At 3.0, forty gates read early scored 0.93× the whole route read late —
  the knife edge the Phase D note left, a few percent the wrong side of the
  brief's original ask. 3.5 puts forty over the line at 1.07× without 4.0's
  overshoot, where under half the route read early is worth 1.21× all of it
  read safely and the back half starts to look optional. The meter cost is
  one read: a dash charges from empty in five early reads at chain 0 instead
  of six, and in two at the chain cap either way. Score only; speed, the
  window and `ARM_DISTANCE_M` are untouched, and the daily route is the same
  hundred words in the same order — every player's score moves by the same
  rule.
  **Compression — keep.** A fast 95 % reader answering at 0.95 of the window
  and a mid 85 % reader answering at 0.55 (clear of the level-1 and level-2
  bars, inside level 3's), across every level:
      reader     acc  answers at | L0        L1        L2        L3        | L3/L0   peak
      fast 95%    95%  0.95      |   374,080   430,192   505,008   598,528 |   1.60   63.9
      mid 85%     85%  0.55      |    95,167   109,442   128,475    41,076 |   0.43   60.0
  Level 3 is reachable at the ceiling (63.9 m/s) and worth 1.6× for the
  reader who clears it, monotone across the ladder; for the reader who set a
  bar they cannot clear it pays 0.43× — an answer inside the bar loses both
  the early rate and the bonus, which is the whole point of the bet.
  **Surge — keep, one number for a human eye.** The FOV stack at peak flow
  (base 68°, clamp 96°, surge +5.5°, REDUCED FLASH ×0.45):
      where    dash   reduced | speed   base   +surge   fov    clamped  surge visible
      cruise   no     no      | 47.17   81.64   5.50    87.14  no       5.5°
      cruise   no     yes     | 47.17   81.64   2.48    84.11  no       2.5°
      cruise   yes    no      | 47.17   99.64   5.50    96.00  yes      0°
      ceiling  no     no      | 64.00   89.00   5.50    94.50  no       5.5°
      ceiling  yes    no      | 64.00  107.00   5.50    96.00  yes      0°
  The surge is a real term at cruise — +5.5°, damped to +2.5° under REDUCED
  FLASH like every other motion term — and never breaches the clamp. It is
  also invisible under any DASH: the speed and DASH terms alone reach 99.6°
  at cruise and 107° at the ceiling, so the clamp is already doing the work
  and the surge has nothing to add. That is what "peak-flow intensity"
  measures to; how it FEELS on a phone is the on-device check the brief
  asks a human for.
  **`LOOKAHEAD_GATES` — 3, decided.** The question was text-soup, not
  correctness, and it had to be played; it was, on a 390-wide phone at
  cruise, and 3 is the highest count at which the armed plate is
  unambiguously the armed plate. The build honours
  `?lookahead=N` on any URL, so the A/B is three links on the live preview:
  https://wordrun-git-claude-game-brief-clean-073628-mikeylambos-projects.vercel.app/?lookahead=2
  https://wordrun-git-claude-game-brief-clean-073628-mikeylambos-projects.vercel.app/?lookahead=3
  https://wordrun-git-claude-game-brief-clean-073628-mikeylambos-projects.vercel.app/?lookahead=4
  What to look for, on a 390-wide phone, once a run has settled into cruise
  (eight or so clean reads, around 47 m/s): ignore the words and watch the
  plates. The armed word — the one you can answer — must be the plate your
  eye lands on without hunting, every time, with the fainter plates behind it
  reading as depth rather than as competing text. Pick the highest count at
  which that is still true. If at 4 you ever find yourself reading a plate
  you cannot yet answer, or the row reads as a paragraph, that count is too
  high; if 2 feels like the road ends too soon, that one is too low. The
  pick was 3, the shipped default, so nothing moved; the golden was re-minted
  to record the verdict as decided rather than provisional.
  Also in this phase: `gate:v1` had been red since Phase 0.2 — a v1 polish
  check still asserted the props.js verge-post placement that phase deleted
  (the finishing brief's Phase J orders the same deletion). It now asserts
  the truth: props.js places no posts, and the one set of stanchions in
  `speed-fantasy.js` stands on the ribbon edge. The stale Phase D comment
  that quoted the 3.0 break-even was rewritten to the 3.5 numbers, and the
  roadmap was replaced with the finishing brief's backlog.

- Phase H2 — the DAILY RUN repairs hearts. Phase H's ladder found that the
  no-repair route was a two-commission budget: STANDARD repaired no hearts,
  so a hundred gates allowed exactly two wrong reads on fakes, and an 85 %
  reader wiped out at gate 56 on every difficulty. That was never the
  intended bar. The rule now: the DAILY RUN keeps STANDARD's no-drip (bells
  pay meter and currency, never a heart, in either mode) and uses ENDLESS's
  clean-streak repair — three clean reads on the last heart, five otherwise —
  one flag in `TUNING.MODES.RULES.standard`. `STANDARD_FAIL_KEEP` is
  unchanged: dying short of the finish still keeps 60 %. The ladder,
  re-driven under the new rule:
      diff    acc   | DAILY route (100 gates)              | ENDLESS
      easy     55% | fails     4 gates redlined          0 |     289 m redlined
      easy     70% | fails    22 gates wipeout      21,652 |   1,749 m wipeout
      easy     85% | CLEARS  100 gates finish      225,360 |   9,196 m wipeout
      easy     95% | CLEARS  100 gates finish      327,560 |  35,185 m alive@cap
      easy    100% | CLEARS  100 gates finish      395,456 |  37,683 m alive@cap
      normal   55% | fails     3 gates redlined          0 |     205 m redlined
      normal   70% | fails    22 gates wipeout      23,555 |   1,749 m wipeout
      normal   85% | CLEARS  100 gates finish      265,970 |   9,196 m wipeout
      normal   95% | CLEARS  100 gates finish      390,244 |  35,185 m alive@cap
      normal  100% | CLEARS  100 gates finish      471,624 |  37,683 m alive@cap
      hard     55% | fails     3 gates redlined          0 |     205 m redlined
      hard     70% | fails    22 gates wipeout      27,977 |   1,749 m wipeout
      hard     85% | CLEARS  100 gates finish      283,887 |   9,196 m wipeout
      hard     95% | CLEARS  100 gates finish      411,152 |  35,185 m alive@cap
      hard    100% | CLEARS  100 gates finish      494,716 |  37,683 m alive@cap
  The gate the design asks for is stated directly and frozen: 85 % finishes
  the route on NORMAL, 70 % does not (gate 22, wipeout — the repair ladder
  cannot outrun a wrong read every third gate), a clean reader finishes on
  every difficulty, and the pace only bites once accuracy has collapsed the
  speed. The route's bar moved from "two commissions in a hundred" to
  "about one in seven, sustained" — a mastery target a good reader can
  actually reach, and one that still fails a 70 % reader outright. ENDLESS
  is untouched (its rows are identical to Phase H). The Phase 0 behaviour
  snapshot was regenerated: its STANDARD script now repairs a heart where it
  used to wipe out, which is the change, recorded.

- Phase I — the DASH chain. The DASH was a rescue; it is expression now.
  During an active dash each correct read ramps a temporary multiplier on the
  read's score term — `TUNING.SCORE.DASH_CHAIN_MULT` [1.0, 1.25, 1.5, 1.75,
  2.0], indexed by the correct reads already landed in THIS dash, so the
  first pays 1.0 and the fifth 2.0. A wrong read of any kind zeroes it; it
  ends with the dash. Score only: never speed, never meter, never the window
  (`ARM_DISTANCE_M` is unwritten, and the Phase F gate now covers this phase's
  files too). Proven the Phase B way — identical inputs, one run with the
  ladder and one with it flattened to 1.0: 184,355 against 163,935 on 41
  identical reads, same metres, same speed, same meter.
  **The finding that sized it.** The brief expected a ~2.95 s dash to cross
  about three gates and asked for the array to be sized to reads-per-dash +
  1. Driving it found the dash was not finite at all: reads DURING a dash
  refilled the meter (the fill line never checked the dash), and at the
  chain cap 79.8 of meter per read out-filled a 34-per-second drain, so a
  clean reader's first dash never ended — 97 reads in one dash on the daily
  route, an 85 % reader's median dash carrying 10. A ladder sized to that is
  meaningless, and Phase 22's own rule says a dash is "a full charge, spent
  whole". So it is: no meter gain while a dash is live (reads or bells; the
  read still pays score and speed, the bell still banks currency). A dash is
  2.94 s now, and the table that sizes the ladder reads, for readers dashing
  the instant the meter is full on the daily route:
      reader | dashes | reads/dash median  p90  max | top rung hit | score
        85%  |     17 |                2    3    3 |            2 | 292,208
        95%  |     18 |                3    4    4 |            3 | 454,301
       100%  |     19 |                3    4    4 |            3 | 555,973
  p90 is four reads, so five rungs is exactly reads-per-dash + 1; the median
  95 % dash reaches the fourth rung (1.75×) and the fifth (2.0×) sits one
  read beyond the best dash measured — reachable only at the ceiling on the
  route's tightest spacing, which is the rarity the brief asked for by
  construction. The ceiling score on the daily route with the ladder and
  compression multiplying is 555,973 for a clean reader — six digits, under
  the results headline's width. All of it frozen in the calibration golden
  (a new DASH table and the ladder as a dial).
  **Within the cap.** The ten-cell meter's lit rim steps hue per rung
  (`BOOST.DASH.CHAIN_HUES` 195 → 172 → 150 → 128 → 105°, cyan walking to
  green, each ≥ 25° from the semantic set — gated), the correct-read chime
  climbs its pentatonic ladder one extra rung per step, and the runner's
  comet tail brightens per rung. A colour, a note and a light; no label.
  Gates: the multiplier reaches score and only score; it fires and climbs;
  it never survives past the dash (zero on every frame the dash is not
  live); a tapped fake and a slipped real both zero it mid-dash; the daily
  route is byte-identical; every rim hue clears the reserved separation.

- Phase J — the last human items that were not calibration. Three, all
  closed. **Board eligibility, encoded before a board exists.**
  `TUNING.META.BOARD_POLICY` holds the four decided rules — DAILY is scored
  and recorded on NORMAL only; ENDLESS bests store per difficulty (already
  true); a continued run is never eligible (already true); daily goals clear
  on any difficulty (unchanged) — so Pass 3 is a transport problem, not a
  rules problem. On the title it is shown, never said: while the DAILY chip
  is on, the difficulty row locks to NORMAL (dimmed, the one chip lit); the
  player's ENDLESS difficulty preference is left exactly where it was and
  comes back when the chip does. The sim, the warmed plates, the challenge
  link and the stats export all run the EFFECTIVE difficulty, and a best is
  recorded only for a board-eligible run — a challenge link that pins DAILY
  on HARD still plays and still scores, it just cannot set the day's best.
  Gated: the constant, the lock, the eligibility line, and that goals still
  record on every difficulty. **The stem engine is retired.** The four-layer
  reactive mix (Phase 12) only ever played its synthesized placeholders, was
  muted the instant the Phase 28 track went live, and no real stems were
  ever produced; the full track plus its beat clock IS the reactive layer
  (`music-track.js`, `music-response.js`). `src/audio/stems.js`,
  `public/audio/stems/` and its README are deleted, the engine's bus and
  its `MUSIC_MAX` dial are gone from the audio graph and from tuning, and
  the gates that asserted the engine now assert its absence and the track's
  presence. **Verge posts** — already resolved in Phase 0.2 (the props.js
  placement path drew nothing and is deleted; the stanchions in
  `speed-fantasy.js` are the only posts, gated in `gate:v1`); Phase M
  rebuilds them as ribbon geometry. Confirmed and closed.
- Phase K — concept stills, for a human to pick from. Four frames of the
  real game in `dev/stills/` with a dev-only page layer armed: the Editorial
  World drawn as page geometry along the track — margin rules, columns of
  greeked lines, full stops, dashes, brackets and drop caps, set denser and
  brighter through five bands (chain 0 / 25 / 50 / 100 / 150+). Every "line
  of type" is a box, never a glyph, so the background is unreadable by
  construction and the plate stays the only text in the world; colours are
  the art-direction band's own crest and ice, nothing red. It lives at the
  bottom of `dev/style-lab.js` (`?dev=1&stills=1`, or `__STILLS.apply(n)`
  to pin a band), never imported by `src/`, never bundled. The driver,
  `dev/shoot-stills.mjs`, steps the sim headlessly on the DAILY RUN with
  every read answered right until the fifth gate resolves, pins one chain,
  one speed and one gap, runs the live frame until the plate sits 37.8 m
  ahead, and reads the numbers back off the page into `manifest.json` —
  same seed, same word (`all`), same frame, 36 m/s, in every still. K1 is the
  sparse manuscript at chain 0, K2 the bloom at 50, K3 the typeset page at
  150 with the Redline at 16 m (the rig tilts back for it — the one camera
  difference, measured). K3b was not asked for and is kept because it was
  measured: at 9 m, inside the scream range, today's correction blocks cross
  the plate. That is the shipped Redline, not the page, and it wants a
  decision before "the Redline as an editorial correction" is built. Two
  more readings in the README: portrait hides the margins beside the runner,
  so a flat page only enters the frame 30 m out (the page has to climb the
  banks if it goes ahead), and the ink sits close to the track's cyan. No
  gameplay file changed; every suite stayed green untouched. **Phase L does
  not start until a human picks or redirects.**
- Phase N — the Phase K decision, and BROADCAST as a look toggle. The pick
  came back: **the look stays as shipped.** The Editorial World and its
  route grammar (Phases L and M) came off the roadmap — the stills stay in
  `dev/stills/` as the record, with the decision written at the top — and
  the two questions that only existed inside that direction (the Redline as
  an editorial correction, a distinct paper ink) closed with it. What was
  promoted is the one candidate a human kept coming back to: the style
  lab's **broadcast** treatment (cel bands, a drawn ink line on depth and
  luminance steps, a bright-pass bleed, a vignette), shipped byte-for-byte
  at the lab's approved dial values in `src/render/broadcast-pass.js` — as
  an OPT-IN toggle, never the default. The settings surface gets a fourth
  chip row, LOOK: STANDARD / BROADCAST, persisted with the other prefs and
  applied live mid-run. Integration is the explicit kind Phase 0 demands:
  `Stage.render()` owns the one branch, constructing the pass when the chip
  flips on and tearing it down (render target, quad, material) when it
  flips off — no wrapped render functions, no `window.__` hooks; the pass
  re-fits its render target every frame so the RC7.1 adaptive-DPR governor
  keeps working under it. REDUCED FLASH is honoured, not bypassed, by the
  cosmetic layer: the bleed is the one element of this look that pulses
  with scene brightness, so reduced flash halves its radius (14 → 7 px) and
  damps its strength (0.5 → 0.35). Word-plate legibility keeps its rank:
  the plates are the brightest, highest-contrast quads in the frame, the
  banding preserves hue ratios, and the default path is untouched — a
  player who never opens the panel never sees a changed frame. Five gates
  under `gate:corruption` hold the shape: default off, the chip row
  persists, Stage owns the branch, the teardown is real, and reduced flash
  controls the glow.
- Phase Q — title, results, motion. The title was audited against the
  brief's list — wordmark, mode chips, BEGIN RUN, the streak and today's
  goals, the live world behind them — and holds; the seed line stays (it is
  the DAILY RUN's identity, and the challenge link re-titles it) and so
  does the reading-curve entry (Phase G's surface would be orphaned without
  it). The transitions were already soft — every screen crossfades over
  0.32 s with the world rendering underneath, now held by a gate — so the
  phase's real work was the two motion beats the results card lacked.
  **The score counts up on the beat clock.** `src/ui/results-motion.js` is
  the whole reveal as one pure curve: eight beats — two bars — of ease-out,
  monotone, zero at the start and EXACTLY the banked score at the end, so
  the gate drives the entire animation in node without a browser. The card
  seeds the counter at zero and `ui.update` steps it each frame from the
  music clock's beat position; silence (muted, track not loaded) advances
  it at a fallback rate from frame time, so the reveal always finishes and
  always lands on the same number. Each whole beat nudges the headline
  1.8 % — REDUCED FLASH drops the nudge and keeps the count. Measured on
  the built game: an untouched run's headline sampled mid-reveal ran
  610 → 5,297 monotonically and settled at 5,298, the sim's score to the
  point, with the ease-out landing visible in the samples. **The card
  enters in the flow band the run ended on.** The flow level is sampled
  every running frame BEFORE the death-frame snap zeroes it (the fatal
  read collapses the chain in the same frame the card is built, so
  sampling after would always say zero — that ordering is now a gate),
  rides onto the card as `--endFlow`, scales the headline's glow, and
  holds the world behind the card at the same earned brightness — steady,
  no pulse — instead of collapsing it to neutral: the collapse already
  landed with the drain; the card is the payoff, not the punishment. Ten
  checks under `gate:corruption` freeze the curve and the wiring.
- Phase R — onboarding, performance, devices. **The lesson set is
  complete.** The left zone was already taught (the Phase C coach's second
  line) and already retired on first use through `learn('Reject')` — that
  was verified, not rebuilt. The compression hold was the gap: no line in
  the game ever said the bar existed. It joins the action-gated chain with
  one sentence — HOLD RIGHT / UP ARROW TO RAISE THE BAR — shown only to a
  player already holding a four-link chain with the bar still at zero (the
  bar is the reward knob for someone who has stopped needing the other
  lessons), and retired for good on the first raise that actually moves
  the level, not on an accidental hold that went nowhere. Persisted with
  the other used-control flags. **120 Hz, without touching the sim.** The
  fixed 60 Hz step already returned its interpolation alpha from
  `advance()` and nothing consumed it, so a display faster than the
  timestep drew the same pose twice. `advance()` now captures the pose
  before each step — write-only state the sim itself never reads, and the
  behaviour snapshot holds bit-identical — and `src/render/view-pose.js`
  presents one lerped view: continuous fields (x, y, d, heading, the
  Redline's gap and lane) interpolate; everything discrete falls through a
  prototype chain untouched, so no gameplay state is invented between
  steps and nothing can write back into the sim. The runner, the camera
  rig, the light, the plates, the spray and the Redline all draw the view
  pose. Measured with rAF uncapped on the built game: 97.9 fps against
  the 60 Hz sim with a duplicate-pose ratio of 0.000 across 249 frames —
  every rendered frame a unique pose (un-interpolated, ~38 % would repeat
  at that rate) — with a full run to the results card clean at both
  refresh regimes. That measurement is this container's headless
  Chromium; the phone matrix can only add numbers, not change the
  mechanism. WebGPU is skipped per the brief's own rule — the three.js
  path already presents past 60. **Input parity and caching, audited:**
  every control has a touch and a keyboard path and the coach names the
  control per modality; hashed assets ship immutable (`vercel.json`,
  d19a800) and the service worker refreshes the shell with network-first
  navigations (both already build-gated in `gate:v1`). Five view-pose
  gates drive the lerp in node; two more freeze the lesson wiring.
- Phase S — package, to the trademark line. Everything in the packaging
  brief that could ship without a human, shipped and measured; the phase
  stops, as directed, at the [MP] trademark confirmation. **The share card
  renders the run's flow band**: one centred rule on the shot's lower
  edge, in the flow's own ice cyan, its length and brightness the flow
  level the run ended on (the Phase Q sample), with an idle floor so a
  zero-flow card still says which game it is. Verified by decoding a real
  card off the built game: the band pixel read (38, 87, 101) against a
  (3, 18, 20) frame — brighter, cyan, present. **Audits**: initial load
  8.27 MB against the 30 MB Playables ceiling (21.73 MB of headroom),
  largest file the music track at 6.73 MB; zero external network calls
  through boot, run and death. **Accessibility, verified on the final
  build by driving the real panel**: REDUCED FLASH and READABLE TYPE
  persist through the settings surface; all three colour-vision modes
  write the danger-accent override into the DOM; nine surfaces carry
  screen-reader labels (Health, the streak-to-heart widget, the reward
  bar with live level, sound, the wordmark, share, accessibility, shop,
  pause). **Icons and name**: every identity surface — repo, wordmark,
  manifest, storage namespace, share filenames — already says DICTION
  DASH, and the PWA gates hold the PNG install icons to the spoiler-safe
  red scan-bar identity; the wordmark has not changed since they were
  generated, so there was nothing to regenerate. Two share-card gates
  under `gate:corruption`. NOT done here, by design: the store listing
  (waits on the [MP] trademark result), and the 1.0 close-out (waits on
  that plus the Pass 3 decision — boards, or 1.0 without them).
- Phase L (L1–L3) — route grammar. Reinstated by the second look at the K
  stills: they had tested page-bars beside a flat road, not a direction,
  and the empty top half of every portrait frame was a geometry problem no
  compositor could touch. The track has its third axis back. **The engine**
  (`sim/terrain.js`): a seeded walk of authored segment types — straight,
  long-straight, climb, descent, bank-L/R, and the crest as a page-fold
  pair — with grade and roll ramped linearly over 26 m at each boundary and
  elevation in CLOSED FORM (the ramp is symmetric, so per-segment
  accumulation is exact at every boundary and the in-ramp correction is one
  quadratic; the gate proves the formula against brute-force integration to
  zero error). Elevation is hard-capped at ±16 m by sizing pitches to the
  remaining headroom; every run opens on 150 m of level teaching ground;
  the walk is a pure function of the seed, so the DAILY RUN lays one road.
  **The contract: geometry only.** Nothing in the speed model, the gates,
  the meter or the Redline reads elevation or roll — gradeMul stays 1 —
  and the proof is that the Phase 0 behaviour snapshot passed UNTOUCHED,
  hash for hash, on the routed track. Same reads, same hearts, same score,
  new world. **One surface function**: heightAt combines elevation, segment
  roll and the turn-lean (crossSlopeAt); the ribbon mesh samples it per
  vertex with analytic normals, the plates ground on it at the centreline,
  the gate line rolls into it, the stanchions stand on it and the contact
  shadows already read it — nothing can drift because nothing is
  hand-synced anymore (the old mesh-local BANK constant and word-gates'
  copy of it are gone). **The camera** was already surface-following (its
  height and look-at sample the terrain); L2 adds partial lean into a
  banked segment (TRACK_ROLL_SYMPATHY 0.35, lagged, REDUCED FLASH damps it
  with the other motion terms) — partial by design, since a full lean
  would re-level the road and erase the bank. **Measured, all of it**
  (`tools/route-gates.mjs`, in the gates chain, 2.4 s): the real rig and a
  real projection driven through five-seed runs. At 36 m/s — the speed the
  K manifest's 270×68 standard was actually measured at — every segment
  type holds the flat track's read-moment plate to within 4×2 px, above a
  220×55 hard floor; at the 62 m/s ceiling every type is PIXEL-IDENTICAL
  to flat (the instrument also surfaced that the shipped flat game itself
  measures ~184×46 at the ceiling — the speed-opens-the-lens trade predates
  this phase and is the calibrated design). FOV peaked at 93.6°, under the
  96 clamp. Plate screen rotation 0.14° worst (the billboard erases camera
  roll from the glyphs — that is what billboarding is for), skew 0.04%.
  The ARMED plate was never once occluded across 34,175 armed frames; the
  +2 lookahead plate IS hidden by a crest on 1,289 frames and revealed on
  a straight (flat track: hidden zero) — the L3 payoff, measured. Crowding
  of the armed plate by the next word: 28.6% vs the flat track's own
  27.5%. The ENDLESS walk escalates nothing yet and the DAILY composition
  is the seeded walk, not an authored list — that is L5, deliberately not
  built. Ghosts recorded on the flat era render under the new road for one
  day (playback is terrain-free by design); tomorrow's seed records on the
  route.
- Phase L HUD pass — one alarm colour, one instruction, pause-only chrome.
  Three reductions, all of them things the K stills made visible. **The
  hearts leave saturated red.** Their #d62d24 sat beside the Redline's
  #ff2a1f as a second alarm on every frame of every run — the one screen
  relationship the colour grammar exists to prevent. They are soft rose
  now (hue 315°), which the live gate holds ≥ 25° from EVERY reserved hue
  (it computes the hue from the stylesheet each run, so the check cannot
  rot); hearts still read as hearts by shape, in every colour-vision mode,
  so the per-mode repaint in the access override is gone too. **While the
  run is live, the only chrome is PAUSE.** The sound, settings and shop
  buttons — four rounded chrome circles sharing the frame with the word —
  hide during a live run and return the moment the game stops (pause,
  title, results); the pause menu already reaches settings and help, so
  nothing is lost, only deferred. Driven from the frame loop, one class.
  **One instruction at a time.** The coach line yields whenever the dash
  hint is up, so two teaching sentences never share the frame with the
  plate; every lesson still runs and still retires on its action. Four
  checks under gate:corruption.
- Phase K re-shoot — the concept stills, on geometry that can carry them.
  The four frames in `dev/stills/` are re-shot on the Phase L route with
  the page layer riding the surface (`heightAt` under every rule, column,
  stop, dash, bracket and drop cap — the page climbs the banks and folds
  over the crests, which the brief itself said a flat page never could).
  Same driver, same conventions: one DAILY seed (2026-09-02), one gate
  (the fifth, word `eys`), the plate ~37.6 m ahead, 36 m/s, 390×844 at
  2×; chain 0 / 50 / 150 and the Redline at 16 m and 9 m. This set
  happens to catch a banked descent, so the typeset page falls away down
  the right of the frame and the +1 plate reads far downhill — K1 and K3
  finally LOOK like different game states, which is the whole test. The
  HUD in frame is the reduced one (rose hearts, pause-only chrome). No
  `src/` change; the only repo edits are the dev page layer's surface
  sampling and a patient screenshot timeout for software rasterisation.
  **The look decision is reopened and waits on a human**: the first
  decision was made against stills that could not show the direction, and
  these can. Phase M and L4/L5 wait on the pick; the Broadcast toggle
  ships either way. STOPPED here, as directed.
- Phase M — the Editorial World, in production. The direction a human
  picked from the re-shot stills, promoted from the dev layer into the
  live game as one system in two halves. **The pure half**
  (`render/editorial-layout.js`): the band machine and the page layout as
  plain arithmetic. Five bands at the brief's chain thresholds
  (0/25/50/100/150, ids unnamed anywhere a player reads); the world
  REMEMBERS more than the chain — crossing a threshold sets a band, and a
  wrong read drops exactly ONE layer while the chain itself dies, so what
  you built mostly stands and one piece of architecture falls with every
  mistake, frame-accurate with the drain. Margin rules, greeked type,
  full stops, dashes, brackets and drop caps, densities monotone by band,
  every mark riding the routed surface. **The renderer half**
  (`render/editorial-world.js`): seven instanced meshes, bounded budgets,
  explicit construction from main.js — no wrapped render functions, no
  window hooks; the manuscript resets sparse each run and breathes with
  the flow factor exactly like the stanchions. **The Redline is an
  editorial correction now**: as the gap closes, red strikethrough bars
  land across the nearest greeked lines at the corruption curve's own
  intensity — the editor catching the manuscript — in the LIVE ACCESS
  danger colour, so every colour-vision mode keeps the Redline's alarm as
  its one hue; motionless by construction, so REDUCED FLASH has nothing
  to strip. **Gated** (`tools/editorial-gates.mjs`, in the chain, 1.6 s):
  the band machine driven pure (rises, single-layer drops, memory, floor);
  no glyph machinery in the page modules and none anywhere in the scene
  outside the plate module; the only colour literal is white (every tint
  is the art-direction band's own crest and ice — no hue is new); margins
  hold ≥ 9.4 m off the centreline at every band; and the brief's own
  acceptance test — camera→plate tested against EVERY page instance on
  EVERY armed frame of a 100-gate daily run at ALL FIVE bands, plus the
  correction bars at full intensity: 0 hits over 21,320 armed frames and
  500 gates. The camera is untouched, so route-gates' plate numbers stand
  unchanged. Verified live: the band rose to 4 at chain 150, an untouched
  run's missed real dropped it to 3, a forced wrong to 2, and 23
  correction bars struck the margins at gap 10. The verge stanchions stay
  for now — they are the flow pulse's marquee bulbs and share the frame
  with the margin rules; whether both survive visual review is a look
  call, not a build call.
- Phase L5+ — the phrase grammar, and the DAILY becomes a course. The
  level-design layer the game was missing: `sim/phrases.js` is an
  encounter director that COMPOSES what already exists. A phrase charts
  the SHAPE of a stretch — the real/fake pattern and the mutation family
  — and the seeded word generator fills it under the frozen calibration;
  spacing, tiers, scoring and every window are untouched (gated: the word
  walk is byte-identical with the chart on or off). The vocabulary:
  cadence, breather (all real — the chain rebuild), fakerun (three fakes
  then one plainly real word that punishes autopilot), alternation, trap
  (one family pinned for the whole stretch), mixed, and the closing exam
  that walks all four families pair by pair. **The DAILY RUN is one
  authored hundred-gate arrangement, a pure function of the gate index
  alone** — the same dramatic arc every day, every retry, every player,
  with only the vocabulary changing under it (this also FIXED a quiet
  defect: the retry salt used to reshuffle the daily's real/fake
  structure, so the course was never learnable even within one day). The
  transposition stretch is always 25–29, the vowel stretch always 53–57,
  the double-letter stretch 75–79, the exam always the last ten — the
  run is now learnable the way a chart or a course is. ENDLESS strings
  phrases in a seeded no-repeat walk that always opens on the teaching
  cadence. Seventeen phrase gates hold the contract; the balance stays
  at the coin's 45–48% fakes. **Regenerated deliberately, reviewed
  line by line**: the behaviour snapshot and the calibration goldens
  (this is a designed content change — the one thing the snapshot
  exists to flag). Every design verdict survived the chart: 85 %
  CLEARS the daily on every difficulty and 70 % dies redlined at gate
  25; compression L3 stays unprofitable for the mid reader; the DASH
  ladder still sizes to p90 reads-per-dash + 1. Three word-gate test
  scenarios were rebuilt chart-proof (the tapped-fake block now pins
  the gap and guards every walk on the phase — the old unguarded loop
  hung forever once the charted opening let a silent approach die at
  the first fake; the last-stand script answers wrongly instead of
  relying on silence failing; the surge check asserts the structural
  rule — hold the surge at 1, pass one fake, watch it die that frame —
  instead of a peak that depended on the coin's texture).
- Phase L4 — the advanced vocabulary, selectively. Four new route
  situations, each passing the one test that mattered ("does this produce
  a different READING situation?"), all as level markers the presentation
  reacts to — grade and roll stay zero, so nothing gameplay-side changes
  and no golden moved. **The drop**: the page vanishes — no rules, no
  type, no punctuation, no corrections — nothing in the world but the
  runner and the words. **The tunnel**: real arches every nine metres,
  crossbars twelve metres up, the periphery closing overhead. **The
  canyon**: the greeked type stands up — the same rows become walls of
  set text at reading height. **The narrows**: the margins pull in to
  half their distance and the rules double — the Redline's stretch.
  Corkscrew was considered and skipped with its reason recorded: the
  plate is billboarded, so a rolling world under a fixed reading plane is
  nausea with no new read. None of the four appears before 600 m — the
  run earns its spectacle — and the seeded walk deals all of them within
  a few kilometres. Five new checks under editorial-gates (a drop span
  provably draws zero instances; arch clearance held; canyon walls
  counted; the narrows floor asserted), the occlusion sweep now includes
  the arches, and the margin floor moved to the narrows' own value with
  ordinary spans still holding the full margin.
- Phase E2 — punctuation beats. Four discrete arrivals inside the
  continuous systems, no labels and no new controls, every visual half
  REDUCED FLASH-safe by construction. **The chain break**: a chain of 25+
  dying is an event — one hard fall in the mix sized to what stood, and
  the camera goes STILL for most of a second (pure reduction: the tremor
  is suppressed, nothing added, so reduced flash needs no special case);
  the world's layer falling was already frame-accurate with the drain.
  A small chain keeps the old quiet tick. **The band arrival**: crossing
  a world threshold lands one rising note and one 0.7 s swell of ink —
  the swell yields to REDUCED FLASH, the note stays, and it fires only on
  the way up. **The release**: a run that has been inside the Redline's
  scream range (< 12 m) and then opens real daylight (> 34 m) gets one
  rising breath — audiovisual catharsis, no words. **The dash climax**:
  the overdrive-off event now carries the rung the ladder died on
  (captured in the sim before the zeroing — a presentation payload, no
  golden moved), and a dash that climbed to rung 3+ ends on an endpoint
  hit, a camera punch and a speed-line burst sized to it. Six checks
  under gate:corruption.
- Phase E3 — the runner's states. Animation, not a mascot: the one object
  on every frame now carries its situation in its posture, every term a
  pure function of sim state and none of them ever writing one. **High
  flow is economy of motion**: past the flow curve's upper band the bob
  halves, the swing tightens and the cursor pulse steadies — mastery
  reads as ease, not flailing. **The dash drops the body**: pelvis down,
  swing tight, the chest driven near-horizontal — the speed-skater's
  start held for the whole spend. **Dread is a crouch**: the Redline
  close pulls the spine and pelvis in, on top of the frantic blink it
  always caused. **The mistake is a stumble**: one hard pitch forward
  that recovers exactly as the stagger drains, forward motion untouched
  (the sim owns it; the actor still never writes a player field —
  gated). The stride was already distance-true and speed-scaled; it
  stays. The ghost passes no style and strides exactly as it always
  has, so yesterday's replay is not retro-posed. Six checks under
  gate:v1.
- Phase E4 — the standout line. Every attempt gets a story, but only when
  it earned one. The run keeps five brilliance ledgers off the same event
  the score already rides (a per-read `score` field added to the correct
  event — presentation payload, no golden moved): the best ten-read
  scoring burst (consecutive — a wrong read of any kind breaks the
  window), the longest early-answer streak (the early half of the arm
  window), the highest DASH rung reached, the cleanest stretch, and the
  average decision time over enough answers to mean it. The results card
  shows AT MOST ONE, chosen by rarity in the pure `meta/standout.js` —
  the top dash rung beats everything, each ledger has a floor beneath
  which the feat is routine, and an ordinary run shows NOTHING, which is
  what keeps the line worth reading. Labels are functional words (DASH,
  EARLY, BEST 10, CLEAN, AVG READ) — the four-name cap stands. SCORE
  stays the public prestige metric; this is the footnote under it. Six
  checks under gate:corruption drive every branch of the picker in node.
- Debugging pass — the finish flow made whole. A live sweep, a 75-second
  endurance soak (heap flat, draw calls flat, frame p95 under budget, both
  advanced-segment situations met on screen with zero occlusion) and a
  driven finish exposed two real defects, both at the route's end. **The
  coast leaked words**: after the hundredth gate, gates kept arming and
  resolving — measured live, ten more gates, six "missed" reals and a
  dirtied recap in fifteen seconds of earned coast. The sim now treats the
  coast as WORDLESS once the endgame layer raises `escaped`: nothing arms,
  nothing scores, nothing punishes, and any gate the coast rolls past is
  re-dealt ahead so KEEP GOING can never resume into a word that was
  already lost. Headless tools never raise the flag, so every golden holds
  byte-for-byte. **END RUN threw the run away**: the finish choice
  recorded the run's DISTANCE into the score-best slot (a unit clobber of
  the board) and quit straight to the title — no count-up, no recap, no
  standout, no board write. The choice now hands the run to the one
  results pipeline (`finalizeRun`): full score (a finished route is not a
  failure), the beat-clock count-up, the learning recap, the standout, the
  best and the ghost in score units, written once. The card reads FINISH —
  the approved name — where a death reads RUN OVER, whether the route
  ended by choice or in overrun. The endgame layer records nothing itself
  any more, and the spent choice is latched so it can never re-arm over
  the results card. Two sim-driven checks under gate:words and four
  source-shaped checks under gate:corruption hold all of it.
- Phase N1 — the answer moment. Playtest: "I'm reading very far down the
  line but can't select soon enough." The lookahead plates let a word be
  read up to 140 m out, but a tap before the arm distance was silently
  swallowed — a decided answer had to be consciously re-timed, and the
  swallowed tap taught that input is unreliable. The sim now BUFFERS one
  pre-arm answer per gate: held for exactly that gate, latest input wins
  (the mind can change until the word arms), delivered on the first armed
  frame at the arm edge — paying exactly what a frame-perfect live tap
  always paid, with the window itself untouched (the arm distance, the
  spacing floor and both read-window floors all stand, gated). The plate
  acknowledges the hold with one bar in its bottom corner on the side the
  player pressed — right for REAL, left for FAKE, the same sides as the
  input zones, never touching the word — and a tiny dry panned tick sounds
  the acknowledgment without suggesting payment. Stronger tells in the
  same pass (playtest: "brighter lighting, SFX"): every correct read now
  typesets into the page — a 0.22 s snap of ink scaled by how early the
  answer landed (REDUCED FLASH skips it; the strike carries the tell
  there) — with a mechanical typeset strike layered under the melodic
  confirmation; a missed real borrows the drain's darkness, so the one
  weightless wrong read now has weight. Found and fixed in passing: the
  Redline's correction bars had drifted below update()'s return and never
  rendered live — a functional gate now drives the real renderer object.
  Seven buffer gates, two correction gates, six wiring checks.
- Phase V — landmarks, vibrance, material separation (playtest-directed).
  The verdict from the phone: the empty upper frame is dramatic negative
  space and STAYS empty — no sky architecture; instead the places that
  already exist got staged until they are unmistakable. The tunnel is a
  mass: stations every 6 m with heavier uprights and a second rail over
  the first, a repeating gate that fills the upper frame from inside.
  The canyon's walls rise past the frame midline as full uninterrupted
  slabs. The narrows' inner rule rises into a low continuous fence, so
  the squeeze is a wall you feel. Every landmark announces its entrance
  with two threshold pylons. The drop still draws NOTHING — the emptiness is
  its statement. The page's colour now TRAVELS: lerped between
  neighbouring mood-arc bands exactly as the sky is, so surviving deeper
  walks the world through the arc's whole palette — the vibrance asked
  for, from hues that already exist, no new literal (gated). Material
  separation in the same pass: page mass (rules, type) wears the arc's
  crest family end to end while punctuation sculpture keeps the cool ice
  accent and the track keeps its own lines — the road reads as a
  surface, the page as a world. The bell was recoloured: the old gold
  sat ONE DEGREE from the reserved streak-tier-3 hue, dressed as an earned
  cue — it is now chartreuse (78°), ≥25° clear of every
  reserved hue, with a brighter emissive so it pops off the navy; the
  reserved-hue check is now computed live for the bell exactly as for
  the hearts. The occlusion sweep re-proved the plate's sight line
  against the taller walls, denser arches, fences and pylons — zero
  hits. Seven new Phase V checks under gate:editorial, one under
  gate:corruption.
- Phase N3 — the runner's silhouette. The playtest verdict: everything
  else got sophisticated and the figure still read as an engineer's
  primitives. The mannequin of boxes is now one deliberate figure — a
  living letterform. Limbs are calligraphic strokes that taper almost to
  a point, with a small sphere at each joint so every limb reads as ONE
  continuous stroke of light; the torso is a nib, broad at the shoulders
  and drawn to a narrow waist; the pelvis a lens; and the head carries
  the single identity mark, a crest of light swept back off the crown —
  an apostrophe running. The silhouette you can draw from memory, with
  no clothing, face, rig or texture. Every pivot, length and returned
  part keeps its name and position, so the whole E3 posture set (economy,
  the dash drop, the dread crouch, the stumble) and the ghost pose
  byte-identically on the new body. Four checks under gate:v1 keep the
  box primitive from ever creeping back.
- Phase N4 — the bookends. The game's fantasy is abstract, so the opening
  presentation now works as hard as Temple Run's first five seconds:
  every run begins with a ~1.2 s authored beat that TEACHES the premise
  with no lore — darkness in which the first word typesets (the plate's
  glow bleeding through the near-opaque veil), the road revealing itself
  forward from under the runner to the horizon, and one slash of the
  Redline's own red arriving behind, in the live danger accent so every
  colour-vision mode keeps the arrival as its one hue. Presentation
  only: the sim runs underneath from the first frame, the veil never
  blocks input (a buffered answer lands straight through it, verified
  live), and the opening flat means the launch costs zero reading time;
  REDUCED FLASH gets one smooth fade. Three scheduled sounds carry the
  same beat. At the other end, the hundredth gate is now an ARRIVAL the
  moment it happens: one full rising breath bigger than the release, a
  swell of ink, and the camera going still — then the endgame's coast
  and choice follow on their own clock as before. Six checks under
  gate:v1; explicit integration throughout (startRun begins it, the
  frame loop drives it, quitToTitle clears it).
- Phase W — one tap is one act; the sweeper; the mirrored spread. Three
  playtest items. THE BUG: words were being auto-selected. Root cause —
  advance() can run several fixed sim steps in one render frame with the
  same input object, so a tap that answered the armed word on the first
  step was still true on the second, where the resolved gate had already
  advanced and the N1 buffer captured it as a pre-lock for the NEXT word,
  auto-answering it with the previous answer. The buffer now captures on
  the rising edge only, tracked inside the gate system, so one tap is
  exactly one act however many steps share the frame; a regression gate
  reproduces the multi-step frame directly. THE ROAD: a third seeded
  winding wave — the sweeper, 8 m over 700 m — layers macro S-curves
  under the two the road always had, deepening the lateral excursion
  about fifty percent (wave B gives back a little amplitude so the
  analytic worst-case curvature stays 0.49, under the 0.5 readability
  bound; measured peak 0.399, auto-follow drift 1.22 m over 60 s at the
  ceiling, both gated). A literal loop or corkscrew stays rejected on
  the record: it inverts the camera and destroys the read. Gameplay is
  untouched — nothing score-shaped reads the corridor, and the Phase 0
  behaviour snapshot passed byte-identical with the deeper winding. THE
  SPREAD: the greeked rows flanking the track are now a mirrored spread —
  each row's two sides share one width and one fate, pushed as an atomic
  pair and reflected across the corridor, so the page reads as composed
  facing pages while the manuscript's raggedness survives row to row.
  Occlusion swept clean again; the mirror is gated over three bands.
- Phase X — the answer's ownership, and the menu cleared. Mobile round
  two of "words select themselves" led to a design ruling, not just a
  fix. THE RULING: the scored rulebook stands — silence says fake, the
  commission stays strictly the worst mistake, both wrong reads cost a
  heart — but OWNERSHIP of an answer is now explicit everywhere. (1) A
  tap landing within 0.3 s of a resolution belonged to the word just
  answered: it is spent, never banked, so a double-tap or late reflex
  can never pre-lock the next word (the refractory, on the sim clock,
  gated). (2) A word the player never touched never LOOKS or SOUNDS
  selected: the correct event now says whether the player acted, and a
  fake that passes in silence keeps its mechanics — the chain link, the
  small late score, every ledger — but loses the celebration language.
  No gate melody, no typeset snap, no sparks, no green flash: a quiet
  page-settle tick and a dim unaccented fade. The bright right/wrong
  plates now mean one thing only: YOU did that. A missed real keeps its
  loud red truth — that one must teach. THE MENU: the date-seed line,
  and the metre/chain/read goal chips came off the title (the goals are
  judged at the run's end and shown on the results card where the
  numbers mean something); BEST EVER remains and now formats as the
  score it is. YOUR READING is renamed PROFILE, on the chip and the
  sheet, and the sheet is properly modal — a tap on or around it can no
  longer start a run underneath. The launch beat stretched from 1.25 s
  to 1.9 s (playtest: too short), audio re-timed to the longer reveal,
  REDUCED FLASH fade lengthened to match. Four new checks under
  gate:words.
- Visibility pass (playtest). THE BELLS: bigger (0.40 cone), a hotter
  emissive (1.5), and every bell now wears a soft additive halo — one
  extra instanced draw call, lighting-independent, so the pickup glows
  identically in the darkest band and at full noon. THE VERDICT: the
  right/wrong feedback got authority at every distance. The resolved
  plate fills with a translucent wash of its own semantic colour under
  the glyphs (word still solid on top — legibility first), its rim
  thickened and its glow deepened, and it lingers 0.85 s instead of
  0.65. And because the eye is already on the NEXT word at speed, the
  verdict now also arrives peripherally: one brief screen-edge wash in
  the semantic right/wrong pair — the same pair the colour-vision modes
  remap, so it survives every mode — for acted answers and both wrong
  reads, never for a passive pass (the ownership ruling holds), and
  REDUCED FLASH skips it entirely. Four checks under gate:v1.
- The arrival, promoted (playtest: "it could genuinely be a great opening
  visual transition"). The launch's single thin slash is now the full
  choreography of the Redline's arrival: the MAIN strike sweeps across
  with a white-hot core inside its red and a doubled glow, a red bloom
  breathes off the cut, and two echo corrections cross the page at
  staggered offsets and angles behind it — the editor's pen striking
  three times before the chase begins. The audio matches: the arrival
  tone leads and two shorter, higher echo strikes follow. Every stroke
  still wears the LIVE danger accent (colour-vision modes carry
  through), the veil still never blocks input, and REDUCED FLASH still
  replaces the whole staging with one smooth fade. One new check under
  gate:v1. The bells were confirmed good and stand as shipped.
- The arrival, art-directed (playtest + slash-VFX reference). The three
  near-parallel bars became a DYNAMIC cluster: five long strokes at five
  genuinely different angles (-12 to -52 degrees), sweeping in on
  staggered beats and crossing one another through a focal zone right of
  centre — the guideline stage of a hand-drawn slash cluster. The main
  stroke keeps its white-hot core and doubled glow; the bloom breathes
  off the crossing. And the arrival's audio came down to roughly half
  (playtest: way too loud) — the choreography reads, the mix rests. The
  gate now demands five strokes at five distinct angles.
- The arrival, full frame (playtest: "more lines, full screen — an FFX
  battle-intro vibe"). The cluster grew into a STORM: nine strokes
  covering the screen top to bottom (8% to 88%), angles from -8 to -58
  degrees, sweeping in on staggered beats from BOTH sides so the cuts
  genuinely cross — the run entered through a storm of corrections. Two
  hero cuts now: the main stroke's white-hot core answered by a second
  bright cut from the right; the bloom spans the whole frame. Same beat
  budget, same guardrails (live danger accent, input never blocked,
  REDUCED FLASH keeps its one smooth fade), and the audio stays at its
  turned-down level — the spectacle grew, the mix did not. The gate now
  demands eight-plus strokes at seven-plus angles cutting from both
  sides.
- The arrival, sequenced (playtest): menu, fade to black, the storm ON
  the black, transition into gameplay. The menu crossfades out above
  the veil while the veil closes to solid black beneath it (0.35 s);
  the nine cuts then cross the pure black from both sides (0.42–0.85),
  the bloom breathing among them — the storm finally plays against the
  stage it wanted; and from 1.0 the road draws the world in
  runner-to-horizon while the last cuts dissolve over it. The audio
  re-sequenced to match: the cut-to-black tick, the strikes on the
  black at their turned-down level, the rising breath under the reveal.
  Same total beat, same guardrails, gate unchanged and green.
- PD-1 — Guided Onboarding (Product Design pass 1). The teaching moved
  from a 9px line at the bottom of the screen to where a first-timer
  actually looks. Two surfaces now split the coach's job: TEACH — a
  centered, large instruction at 57% height, between the plate's
  reading zone and the runner, that stays up until the player performs
  the action it names — owns the two FUNDAMENTALS ("IS IT SPELLED
  RIGHT? TAP RIGHT", then "MISSPELLED? LET IT PASS — OR TAP LEFT TO
  CALL IT"); the quiet coach line keeps every later lesson (the dash,
  the bar, early value) and skips the rungs TEACH owns, so one
  instruction speaks at a time, everywhere — TEACH itself yields to the
  launch veil and the dash hint. Lessons still retire on demonstrated
  action, persisted, exactly as before. GUIDED TIPS ships as a
  persisted settings chip, default ON. The first-timer's ENDLESS run
  opens on the GUIDED chart: the same cadence shape the endless walk
  always opened on, but authored — jitter-free on every seed, its fakes
  pinned to transposition, the easiest family to see — and from gate
  six onward the guided run IS the endless run, verdict for verdict.
  The DAILY never sees it: the sim clamps any chart request to the
  authored course on a routed run, so the same-course-for-everyone
  promise holds for first-timers too (as directed). And the first
  launch practises progressive disclosure: the six-rule card condenses
  to the two verbs and one sentence — "Read well. Stay ahead. The run
  teaches the rest." — while the full sheet stays exactly as it was
  behind HOW TO PLAY. Four guided-chart checks under gate:phrase, five
  wiring checks under gate:v1; the behaviour snapshot passed untouched.
- PD-2 — the continuous journey (Product Design pass 2). The path from
  title to retry audited and tightened as ONE experience. THE RETRY CUT:
  the full 2.45 s arrival now belongs to the menu alone; a retry — the
  AGAIN button, the pause menu's restart, a finish-card rerun — gets a
  one-second cut in the same grammar (dip to black, ONE slash, reveal),
  with matched audio, because the twentieth AGAIN wants the track back,
  not the ceremony. Chosen from the phase the run started from; REDUCED
  FLASH gets a proportionally shorter fade. ONE MODAL RULE: no tap can
  start a run under ANY open sheet — settings, shop and profile now sit
  under a single guard instead of per-panel patches, and all four
  overlay sheets enter with the same soft motion. THE SCORECARD: the
  results stat bar's accuracy is now THIS run's — it had quietly shown
  the lifetime ledger's percentage under the run's own numbers, a
  mislabel a returning player would eventually catch; the lifetime
  numbers live in PROFILE where they belong. And a run that missed the
  best now names its gap — "12,480 TO BEST" in the place NEW BEST would
  celebrate — so the AGAIN tap always has a target. Six checks under
  gate:v1; verified live end to end (menu arrival, guarded sheet, NEW
  BEST card, gap card, quick retry).
- PD-3 — settings consolidation (Product Design pass 3). The one settings
  sheet now reads like one: three plain groups — GAME (guided tips, the
  BEST RUN ghost), VISUAL (look, flashing light, word type, colour
  vision), AUDIO (sound) — under a SETTINGS heading, scrolling instead
  of clipping on a short phone, with every sheet-owned chip persisting
  exactly as before. The ghost and the sound reach the sheet through
  hooks so their state stays where it lives (main and the audio system);
  flipping SOUND keeps the corner icon honest. HOW TO PLAY deliberately
  does NOT live in settings: learning the controls is never a settings
  hunt — it is now a first-class title action beside PROFILE, opening
  the full reference card, and keeps its pause-menu entry. Four checks
  under gate:v1; verified live (sections, both hook chips, the title
  card in help mode).

## 1.0-RC — release candidate (2026-09-03)

Every system the finishing brief and the product-design passes called for
is built, gated (~1,100 checks) and live. This RC entry closes the
chronological log; what follows it should be verdicts, not phases.

- **Gate repair**: the v1 release suite's route envelope had gone stale
  against Phase W's third winding wave (a hand-summed amplitude bound).
  The envelope is now DERIVED from every CURVE_AMP dial the tuning
  declares, plus the same measured curvature bound the TRACK gate holds —
  a future wave cannot silently invalidate it. Full chain re-run green.
- **First-minute audits, on the built game, real inputs**: a fresh
  profile driven title → essence card → TEACH → first correct → first
  fake passing quietly → first mistake costing exactly one heart → the
  DASH hint → RUN OVER → the settled card → the quick AGAIN cut; and a
  returning profile (all lessons demonstrated, GUIDED TIPS still on)
  showing zero redundant teaching, the full arrival only from the menu,
  and the quick cut on retry. Every beat captured to `dev/stills/rc/`.
- **Scoring comprehension**: the card already answers how the run went
  (score, best delta, run accuracy, avg read, the review, one standout);
  the one opaque cause was the CHAIN — the score's dominant multiplier,
  invisible unless it happened to be the standout. One line was added,
  only when a chain of 2+ stood: "BEST CHAIN n — unbroken reads multiply
  the score." Nothing else.
- **Device soak**: `dev/rc/device-soak.md` — the on-phone checklist
  (p95 frame time with a paste-back console snippet, 5-minute thermal,
  full DAILY to FINISH, RUN OVER, continue, END RUN, the retry loop,
  safe areas, landscape) against the production build. Michael runs it.

Held for humans, unchanged: the trademark result on DICTION DASH before
any store listing, and Pass 3 (boards + population word danger). No new
systems until the RC is played on-device.

## 1.0-RC2 — the first on-device verdicts, answered

The RC was played on a real phone. Four verdicts came back; all four are
in. Two were reversals of RC experiments — recorded here so they stay
reversed.

- **The how-to card**: the condensed first-open "essence" experiment made
  the fresh open WORSE. Reverted and deleted — the full six-rule sheet is
  the one card, on fresh open and behind HOW TO PLAY alike, and a gate now
  holds the condensed mode gone.
- **One tip at a time, actually**: the coach line could still co-show with
  the TEACH surface (a tip at the bottom AND the middle). The coach is now
  fully silent while TEACH is active; its advanced lessons resume when
  TEACH retires. Verified live: thirty samples across a guided run, zero
  co-shows.
- **The results card is five moments**: score → celebration → goals →
  misses → play again. The ~15 competing pieces are not deleted — the run
  shape, WORST STRETCH, the objectives queue, the stat bar, BEST CHAIN,
  BEATEN and the share row are intact behind one MORE STATS fold, closed
  on every new card. Today's goals became a ✓/○ checklist under one
  headline count; the bells and objective payouts merged into ONE ◆ total
  (in the card's own cyan — gold sits inside two reserved hue bands).
- **The giant 0 explains itself**: a zero-score run no longer shows the
  full distance TO BEST under the zero. It names the cause instead —
  "94 M · READS MAKE THE SCORE" — the one line a far-but-read-nothing
  first run needs.

The menu arrival was reported out of sequence; the full launch path was
diffed byte-identical to the approved build — the felt regression was the
condensed card and the doubled tips beside it, both fixed above.

## 1.0-RC3 — the arrival made airtight, and the world learns to wait

- **The arrival, actually fixed**: the felt "out of sequence" from the menu
  was a stacking bug, not a timing one — the veil sat at z-index 4, under
  the body-level touch chrome, so on a phone the FAKE / REAL / DASH
  buttons and the touch guide glowed over the fade and the storm. The
  veil now covers every piece of in-run chrome (input still never
  blocks); black means black, and the chrome emerges with the reveal.
  The timeline itself was diffed byte-identical to the approved build.
- **All tutorial text speaks from one place**: the coach line ("ANSWERING
  EARLY IS WORTH MORE", the bar lessons) left the bottom edge for the
  same mid-screen teach band the TEACH surface uses — below the plates,
  above the runner. The two never speak at once, so the band is never
  contested.
- **The study stop** (the lesson borrowed from the memory game's tutorial:
  stop, look, act): on the guided chart, the first
  gate of each verb now pins the run just short of the plate — inside
  the arm window, the pursuit pinned with it — and the world waits,
  without limit, for an active LEFT or RIGHT. No timer, no thrusting a
  first-timer into the word bank at pace. The answer resolves through
  the exact same step as every read, pacing survives untouched (speed is
  never modified, only position holds), and GUIDED TIPS switches the
  whole thing off live — the accessibility toggle it was asked to be.
  Never on the DAILY; plain ENDLESS never stops.

## 1.0-RC4 — the order, the sheets, and the Redline level

Three notes, each raised more than once. Each is now pinned by a gate so it
cannot come back.

- **The arrival, in the right order at last.** The previous two passes fixed
  real bugs (stacking, then layering) but never the ORDER, because the run
  was built at the moment the fade *started* — the menu was swapped out for
  gameplay, and the veil then faded in on top of it. What a player saw was
  gameplay → black → storm → gameplay. The world is now **built in the
  dark**: the fade plays over the menu (or the results card on a retry),
  and the run — the sim, the world, the HUD, the title going out — is
  assembled on the first solid-black frame, unseen. Verified frame by
  frame on the built game: menu → fade → black → storm → gameplay, with
  the run not even started until the black. REDUCED FLASH keeps its
  straight cut, and the scripted harness still starts synchronously.
- **The sheets are opaque.** SETTINGS and the SHOP sat at 82% over live
  gameplay, so the track read straight through the words. Both are solid
  now.
- **The Redline, turned down where it actually lives.** Earlier passes
  trimmed the arrival strikes and the tuning value, but the final-mix
  layer was *lifting* the roar ceiling (0.30 → 0.35) and re-writing the
  threat bus every single frame (0.94 + roar), which overwrote every
  other trim — which is why it kept coming back loud. The ceiling and the
  per-frame bus level are both cut at that layer (roar 0.20, bus 0.55),
  the base level agrees, and the strikes come down again. The pursuit
  still rises as it closes; it no longer sits on top of the mix.

## 1.0-RC5 — the run screen carries the run

A reduction pass. Five things came off or split apart; nothing new was added.

- **One score in the run.** BEST TODAY left the HUD for PROFILE and the
  results card. A second score over the word being read was competing with
  the only number that matters mid-run.
- **The wordmark stands alone.** The caption under the title is gone; the
  approved name now labels the chip that selects that mode, which is where
  a mode name belongs. Three legacy layers were each re-asserting that
  caption after the UI cleared it — which is why it had survived earlier
  removals — and all of them are now silent. A challenge still names its
  dare.
- **MUSIC and SFX are separate.** One SOUND switch could not answer "keep
  the game, lose the score", which is the commonest thing a player wants
  from a runner they play with their own music on. The score now rides its
  own bus; SFX OFF silences the one-shots and the continuous beds alike.
  Both are persisted and applied at launch.
- **The coach stops commentating.** "ANSWERING EARLY IS WORTH MORE" and
  "CLEAN READS CHARGE THE DASH" described the economy at a player who was
  busy reading a word. What remains is only teaching a player cannot
  proceed without — the two verbs, the dash when the charge is actually
  full, the bar for someone already chaining — each still retiring for
  good the moment its action is performed. The retired lessons' state went
  with them.
- **One tell per mechanic, one row of controls.** The bottom charge bar is
  hidden wherever the DASH button's own ring exists (a mouse-and-keyboard
  player has no ring, so there it stays). DASH moved to the centre of a
  single low row — FAKE, DASH, REAL — with the answer buttons lifted so
  all three centres align. The reward-bar readout moved out of the meter's
  label so it survives the meter's removal.

## 1.0-RC6 — the cabinet: the loop

Judged against one question: would this look and feel right on a large
vertical screen in an arcade? No new gameplay systems.

- **The DASH READY hint joins the teach band.** It was the third tutorial
  surface still pinned to the bottom edge after the coach moved, and RC5
  centred the DASH button on top of it — so it read as a caption on the
  button it was telling you to press. All three in-run surfaces now speak
  from the same 57% line, and the coach already yields to it.
- **BEGIN RUN starts the run.** A fresh profile used to meet a six-rule
  card on its first tap; a card between a player and the game is the wrong
  first beat for a cabinet. The teaching is already in the run — TEACH
  carries the fundamentals and the study stop waits for the first answer
  of each verb. The sheet is a REFERENCE now, opened when wanted, and the
  per-release "has this player seen it" flag went with the push.
- **Attract mode.** Ten quiet seconds on the title and the road starts
  running behind the wordmark: the player's own BEST RUN ghost replays its
  line with the HUD score climbing the way it climbed the night it was
  set. Any touch or key ends it and starts nothing by surprise. It is
  presentation over the existing pieces — no second sim, no second game —
  and it restores the resting pose it found. With no ghost on record (or
  one too short to be worth watching) the road simply runs empty.
- **The results card is the high-score moment.** Score, whether it beat
  the best, THE RUN, the standout, AGAIN / MENU. Today's goals, the
  objective queue and the ◆ takings moved to PROFILE, which is where a
  player goes between runs to see what they are chasing and what they have
  banked. The analysis stays one fold deeper.
- **One ⚙ and PROFILE.** The title carried three corner buttons and two
  chips; it now carries the wordmark, BEGIN RUN, the modes, PROFILE and a
  single gear. Sound, word type, HOW TO PLAY and the ◆ bank all live
  inside it.

`dev/shoot-rc-stills.mjs` is committed with this pass: the audit stills are
re-shot by a script rather than by whatever driver existed that day, and it
now fails loudly rather than filing a still that shows the wrong screen.

## 1.0-RC6.2 — the cabinet: the HUD as one instrument

The top-left corner was three separate things that had grown up beside each
other: the score, a row of hearts set in whatever `♥` the platform's symbol
font happened to draw, a second row of five diamonds counting the clean
streak, and the reward-bar marks. It is one instrument now.

- **The hearts are drawn.** One path, stroked and filled at a fixed 22px, so
  the piece of HUD that says whether you are alive has the same silhouette
  on every device instead of inheriting a different glyph from each one.
  The rose is unchanged and still clears every reserved hue by ≥ 25° — the
  gate that proves it now reads the shape's fill rather than a glyph's text
  colour, which is where the colour actually lives.
- **The streak is drawn inside the heart it wins.** The separate five-pip
  widget is deleted, not hidden. The NEXT empty heart fills from its base as
  the clean run climbs toward the reads that win one back, clipped to the
  heart's own outline, reading the same repair ladder the sim repairs from.
  A full row shows nothing extra at all. The screen-reader line the widget
  carried moved onto the hearts with it — the widget went, the information
  did not.
- **The bar marks sit with the DASH meter**, the other thing the player
  sets, and are invisible until a bar is actually set. Where the charge bar
  is hidden (touch, where the DASH ring is the tell) the marks stay: they
  are not the charge.

The four gates that protected the retired widget were retired with it rather
than repointed at a rewritten target; what they protected is now held by
five checks on the hearts themselves.

## 1.0-RC7 — the three stops

The run is the tutorial. A first-timer's guided ENDLESS opening now freezes
exactly three times — at the first real word, the first fake, and the first
full DASH charge — each once for a life, and the standing TEACH prompt that
used to hover through the opening is gone with them.

This is RC3's study stop promoted rather than a new system. That one pinned
the runner's POSITION a fixed distance short of the plate; this one pauses
the world outright at the arm edge, which needs no room in front of the
plate — so it also works for the dash, which has no plate at all — and never
touches `ARM_DISTANCE_M`.

- **A stop is a pause, not a slow-motion.** `Sim.step` returns before
  anything advances: measured over ten seconds of frames on a frozen stop,
  the clock, the runner, the pursuit and the step counter all moved by zero.
  The full chain — the Phase 0 behaviour snapshot and the calibration
  freeze included — is byte-identical.
- **The freeze is not priced.** An answer that releases a stop is worth what
  it was worth on the frozen frame: measured at 54.9 m out with a latency of
  0, whether the player answers instantly or stares for a minute. Both
  halves of the multiplier read the frozen frame, not the step that let the
  world go again.
- **Two control schemes, one tutorial.** Each stop renders for the modality
  in the player's hands: touch rings the on-screen control and says TAP;
  a keyboard names the key it actually binds (`→`, `←`, Space) and rings
  nothing, there being nothing on screen to ring. A gate drives all three
  stops under all three modalities and rejects any line naming a control
  from another one. Two honest findings came out of writing it: the gamepad
  layer binds confirm and the dash but **never reject**, so the pad's fake
  line names only the pass rather than inventing a button; and Space is an
  edge, not a hold, so the keyboard dash line says PRESS.
- **One line, one ring, nothing else.** The coach is silent through a stop
  and yields the three fundamentals while the stops teach them — switch
  GUIDED TIPS off and there are no stops, and the coach teaches them as it
  always did. REDUCED FLASH keeps the stop, the line and the ring, and drops
  the ring's pulse.
- Stops never touch the DAILY RUN, which stays byte-identical across
  players, and never fire on plain ENDLESS — proven with the stops forced
  on in both.

Two bugs the browser found and the gates now hold: the DASH READY hint fired
on the same full meter as the dash stop and had to stand down for it, and
marking a stop "shown" at its start was switching the whole system off
underneath the third stop while it was still on screen.

## 1.0-RC7.1 — the dash lets go, the lesson does not

- **The dash stop stops holding the world hostage.** The other two stops
  teach an answer that must be given to continue at all; the dash teaches a
  POWER, and freezing the game until someone finds a button they may not
  want is a worse lesson than letting them go. It now releases three ways:
  a real hold, five seconds, or the third input that is not a dash — a
  player pressing other things has read the line and is not doing it.
  Measured: 5.00 s on the clock, and released on the third press, counted
  as rising edges so a held button is one input rather than many.
- **The ring and the line outlive the freeze.** When the stop lets go
  without a dash the control stays ringed and the COACH picks up the line,
  so the teaching follows the player through the run instead of ending with
  the pause. The DASH READY hint stands down for both — they share the 57%
  band, and only one voice speaks on it.
- **The lesson retires only on a real hold.** It keys off `usedDash`, the
  flag an actual dash has always written, not off having been shown the
  stop — so a player who let it time out is offered it again next run. The
  two word stops are unchanged: those retire on being shown, because their
  correct answer can be to do nothing.
- **No chrome on the results card.** The gear is a title action; AGAIN and
  MENU are the only ways off that screen.

The stills driver got three fixes of its own, each a case of the record not
matching the game: it waits for the card to be genuinely VISIBLE (not merely
classed `on`, which filed a half-faded screen), it declines the priced
continue rather than timing out behind it, and it ends a run the way a
player does — calling a fake REAL — because assigning `hearts = 0` never
ends anything: the sim only kills through the obstacle ledger, and a clean
streak hands the heart straight back. It also no longer answers the word it
is waiting to be stopped on, which was releasing a stop in the same frame it
began and walking straight past it.

## 1.0-RC8.1 — one vocabulary

The controls are the same controls; the words for them were not. This pass
gives the game a single control vocabulary, in one pure module the gates can
drive, and moves the one HUD element that was drawn where nobody could see it.

- **The dash is a PRESS, and every line says so.** It has been one since the
  debugging pass — `Player._overdrive` fires on the rising edge and the dash
  then runs itself out on `DRAIN_RATE`, so a button touched for a frame and a
  button leaned on for three seconds buy the identical dash — and four
  surfaces still said HOLD. HOLD DASH, HOLD F, HOLD RT and the button's own
  aria name are gone: TAP DASH on touch, PRESS SPACE on a keyboard, RT on a
  pad. The header comment in `teach-copy.js` that asserted the touch button
  was held is rewritten, because that sentence is why HOLD kept coming back.
  The `usedDash` retire flag is untouched.
- **One phrase for the charged state.** `DASH READY · TAP DASH`, byte
  identical in the stop, the coach and the HUD hint — not by three edits that
  agree but by construction: all three call `dashReadyLine(modality)`, which
  is built from the one control token. The rising-edge flash used to say
  `DASH READY` and the teaching hold `DASH READY · HOLD F`, two strings for
  one state. "THE BAR IS FULL" is retired outright; it named nothing, and the
  bar it accidentally referred to is a different mechanic entirely.
- **The modality copy stops mixing.** The detection was always right — a
  connected pad wins, then touch, then the keyboard — and the strings were the
  bug. Touch names the buttons it draws (TAP REAL / TAP FAKE) and the keyboard
  names the arrows (→ / ←), on the HOW TO PLAY card and in the coach's
  fallback rungs alike, all of it read from `ui/teach-copy.js` so the card and
  the run cannot drift. Gated both ways: no touch line contains RIGHT or LEFT,
  no keyboard line contains REAL or FAKE — which is also why the real stop now
  reads SPELLED CORRECTLY, matching the card's own sentence.
- **The bar is taught, not secret.** The coach line survives and says what the
  hold buys: `HOLD THE REAL SIDE TO RAISE THE BAR · ANSWER FASTER, SCORE
  MORE`, still taught only at a four-link chain and still retired on the first
  real raise. It names the held SCREEN ZONE rather than the answer button, and
  ↑ rather than →, because that is what raises it: `_pollHolds` reads a press
  on the right zone that outlives the tap window, the REAL button answers on
  pointerdown and stops the event there, and ArrowRight has already fired its
  answer on the way down — reusing it would move when a keyboard answer is
  timed, which is a tuning change this pass does not make. The card carries
  the same rule as its seventh.
- **The level marks came out of the HUD column.** Riding with the DASH meter
  (RC6.2) put them at the bottom of a zone the touch build hides, so on a
  phone they sat behind a 76px button: a readout invisible on the device it
  was drawn for. They are their own row now — three marks, centred, 17px above
  the DASH button, lit per level, shown from the first raise. The HUD column
  carries nothing for it, and on touch the whole meter zone goes with it.
- **HOW TO PLAY, corrected.** Rule 4 is the moment rather than the economy
  ("when the ring is full to tear down the track"); rule 5 loses the "three
  times" figure, which `EARLY_MULT` left behind at 3.5; "Take your time early;
  you will not have it later" is gone; and the bar closes the card.

Two small pieces of typography came with it, because the new lines are longer
than the old ones. The teach band wraps inside a reading measure instead of
clipping off both edges of a 390px phone, and it may only break at the `·`:
each clause is set unbreakable, so a wrapped line is still two whole thoughts
rather than `SPELLED CORRECTLY · TAP / REAL`. The stills driver waits for the
band to finish fading in before it fires, having filed a half-transparent
frame of the fade as a picture of the stop.

Gated: the ban list (HOLD DASH, HOLD F, HOLD RT, THE BAR IS FULL, "three
times") over every player-facing string with comments stripped, the two
modality vocabularies, the charged phrase being one function, the bar naming a
control that actually raises it, and the marks being three, their own row, and
clear of the button. The three stop stills are re-shot on both viewports.

## 1.0-RC8.2 — the road

The route grammar (Phase L) laid the right road and joined it with a straight
line. A linear blend makes grade continuous but not smooth: its derivative
jumps at both ends of every ramp, which is a crease on the surface at the
start of every climb and at the fold of every crest. The joins are eased now.

- **Smoothstep, not a line.** `_ramped` blends grade and roll with `smooth01`
  over the same `TRANS_M` window, so both leave and reach each segment's value
  with zero derivative: slope and roll are C1 through every boundary and
  elevation is C2. Two properties of the old ramp are kept exactly, and they
  are why this costs nothing downstream — the ramp is still SYMMETRIC about
  the boundary (`S(u) + S(1−u) = 1`), so the per-segment accumulation
  `e1 = e0 + grade·len` is still exact at every boundary with no drift over a
  run, and elevation inside a ramp still has a closed form: the integral of a
  smoothstep, `T·(u³ − u⁴/2)` before the boundary and `T·(u³ − u⁴/2 − u + ½)`
  after it, both zero at their far edge. `heightAt` stays O(log segs), no
  numeric integration, and the closed-form-vs-integral gate holds at 2.8e-5
  over 5 km.
- **A minimum segment length.** `ROUTE.MIN_SEG_M = 60`, enforced in
  `_pushSeg` and nowhere else, so no vocabulary entry can forget it. Two
  things need it: a segment shorter than `TRANS_M` would have its two ramp
  windows OVERLAP, which no closed form covers and which reads as a step in
  the slope; and the crest — the only pair of opposing grades in the grammar
  that meets head-on — drew halves as short as 48 m, where the fold reads as a
  hump rather than a page turning. The apex-clearance guard now derives its
  own bound (`CREST_HALF_MAX`) instead of carrying a literal 66.
- **The numbers, before and after**, walked at 0.1 m over 5 km on three seeds:

      peak d(grade)/dm     peak d(roll)/dm     peak d²(grade)/dm²
      linear   7.308e-3    3.846e-3            6.353e-2   (a kink: unbounded)
      eased    1.096e-2    5.769e-3            1.672e-3   (smooth)

  The first column rises by exactly 1.5×, which is a smoothstep's peak
  gradient against a line's, and it is the price of the third column falling
  by thirty-eight: the sharpest join in the vocabulary (a crest's own apex,
  0.190 of grade) now turns over 26 m instead of hinging at two points. Both
  bounds are analytic — `1.5·Δg/T` and `6·Δg/T²` — so the new gate asserts
  them rather than a number someone chose.
- **The gate**, beside the lateral-curvature one in `tools/gates.mjs`: it
  walks 5 km on each of the ten seeds asserting the maximum slope change per
  metre (grade and roll), the bounded second derivative that says EASED rather
  than merely blended, and that no segment is shorter than `MIN_SEG_M`. It
  prints the elevation profile and its derivative every 250 m of the DAILY
  RUN's seed, so a change to the road shows up in a diff and not only in a
  bound.

Every plate legibility and occlusion gate was re-run on the new geometry and
holds: 227–231 px of read-moment plate on all six segment types against the
220 px floor, 183–185 px at the 62 m/s ceiling, plate rotation 0.14° against a
4.5° ceiling, FOV peak 93.6° inside the clamp, the ARMED plate never occluded
across 20,505 armed frames, and a crest still hides a lookahead plate on 1,176
frames — the L3 payoff survives the easing. The Phase 0 behaviour snapshot is
byte-identical, which is the proof that none of this reached the run: the
speed model, the gates and the Redline still never read the road.

## 1.0-RC8.3 — the rush

The ceiling stays at 64 and both reading floors — 1.15 s at cruise, 0.75 s at
the ceiling — do not move. Everything below is what is left once those are
fixed, and every dial that moved brought its table with it.

- **The floor, 16 → 21, and the gain 4.5 → 4.1 with it.** The two cannot be
  chosen apart: a read closes `SPEED_GAIN_MAX / (CEILING − FLOOR)` of the
  remaining headroom, so raising the floor steepens the whole curve, and the
  comfort window at cruise is what stops it. `npm run calibrate:speed` prints
  the new sweep, and it says something worth stating plainly — at the largest
  gain each floor allows, every floor produces the SAME cruise speed and the
  same ~9.8 % of headroom per read. The comfort window pins where cruise
  lands. **A higher floor buys the bottom of the run, not the top.**

      floor | max gain  headroom/read | cruise8  window | floor window | deficit vs pace 24/27/30
         16 |     4.71          9.81% |   47.81   1.15s |        3.44s |  8 / 11 / 14
         20 |     4.32          9.82% |   47.81   1.15s |        2.75s |  4 /  7 / 10
         21 |     4.22          9.81% |   47.81   1.15s |        2.62s |  3 /  6 /  9  <- shipped
         22 |     4.12          9.81% |   47.80   1.15s |        2.50s |  2 /  5 /  8

  Shipped at 4.1 rather than the 4.22 cap, for the same 10 ms of window margin
  the old tuning carried: cruise 47.40 m/s, window 1.16 s, 9.53 % of headroom
  per read against the old 9.38 %. 21 is the HIGHEST floor that works, and the
  thing that caps it is not arithmetic — at 22 a 55 % reader on EASY stops
  being run down by the Redline and dies to hearts instead, which would take
  the pursuit out of its own job on that difficulty. The LADDER instrument
  holds that verdict; the floor's own reading window (2.62 s, against the
  1.15 s comfort floor) and its clearance under the slowest pace are now
  gated together, because a recovery pace you cannot read at is not a
  recovery.
- **The dash is longer, and that is the lever.** `DRAIN_RATE` 34 → 28: a dash
  is 3.57 s against 2.94 s. `SPEED_MULT` stays at 1.40 and was never a
  candidate — the reading window is `ARM_DISTANCE_M / (speed × SPEED_MULT)`
  and ×1.4 already puts it at 0.86 s at the ceiling.
- **`OVERDRIVE_PUSH` is deleted, not retuned.** It and its tail were the
  retired director's, from when a dash reached the gap through a 2.5 s
  smoothed average. Phase 7 replaced that machine with one line — the gap is
  the clamped integral of (effSpeed − pace), and `tools/gates.mjs` asserts it
  step for step — and from that moment the two dials named a mechanic no code
  read. Going looking for the shove is how they were found; a dial that reads
  like a lever and moves nothing is worse than either value it could hold, so
  a new gate keeps them gone rather than merely unused. The shove is
  `SPEED_MULT` against the pace, and the longer dash is what extends it:

      speed  |  gap closing/opening plain  |  dashing  |  daylight one dash buys
        21   |          −6.0 m/s           |  +2.4 m/s |   25 m → 30 m
        27   |           0.0 m/s           | +10.8 m/s |   32 m → 39 m
        47.4 |          +20.4 m/s          | +39.4 m/s |   56 m → 68 m

  The row that matters is the first: at the floor a dash is the difference
  between a gap that is closing and one that is opening, and it now holds that
  for a fifth longer.
- **The lens, and where the clamp already was.** `FOV_BOOST` 16 → 22. At
  cruise and above the dash stack has been past `FOV_MAX` since before it
  moved, so the SURGE table gained a START row to show what raising it
  actually bought: a dash at the speed a run begins reads 95.1° of unclamped
  stack against 90.8°, and reaches the clamp where it used to fall 5° short.
  The early dash — the one a player takes when they are still slow — is the
  one that got wider.
- **A sixth rung.** A 3.57 s dash lands five reads at the 95 % reader's p90
  where a 2.94 s dash landed four, and the ladder is sized to p90 + 1:
  `DASH_CHAIN_MULT` gains 2.25× at the same 0.25 step, every rung below it
  unchanged. `CHAIN_HUES` is RE-SPACED rather than extended — continuing the
  22° walk would have put rung six at 83°, five degrees off the bell's own
  gold-green, so it is six steps of 18° across the same 195 → 105 span,
  keeping both endpoints and clearing every reserved hue by ≥ 25° and the bell
  by ≥ 27°. The chime's pentatonic cap and the comet tail's brightness cap now
  read the LADDER's length instead of a literal 4, so a rung the score pays
  for is a rung the ear and the eye are shown.
- **The speed cues, re-tuned to the curve they hang off.** Every cue is keyed
  to `speedN = (v − FLOOR) / (CEILING − FLOOR)`, so raising the floor
  re-tuned all of them at once — the lived band narrowed from 48 m/s to 43, so
  every cue moves 11.6 % more per m/s and reads lower at the same speed below
  the ceiling. The stanchion spacing, the wind-streak threshold and the etched
  ground's cell size were literals inside `speed-fantasy.js` and the surface
  shader — the one set of dials the feel lab could not reach was the set the
  player is actually looking at. They are `TUNING.CUES` now, `dev/feel-lab.js`
  gained `__CUES()` to print them, and `feel-presets.js` gained a CUES LOUD
  preset for the next person to argue with:

      speed | fov    boom  height  look   streak  posts/s  rungs/s
      before (floor 16)
         27 | 72.81  9.77   8.27   14.06  0.000   1.29     4.50
      47.17 | 81.64  8.42   6.92   17.84  0.208   2.25     7.86
         64 | 89.00  7.30   5.80   21.00  0.500   3.05    10.67
      after  (floor 21)
         27 | 71.13  10.03  8.53   13.34  0.000   1.50     5.40
       47.4 | 81.75  8.41   6.91   17.89  0.247   2.63     9.48
         64 | 90.40  7.10   5.60   21.60  0.550   3.56    12.80

  The camera at cruise is held to within a tenth of a degree and a centimetre
  of boom (`BACK_SPEED_GAIN` −0.16 → −0.17, `HEIGHT_SPEED_DROP` 3.2 → 3.4,
  `LOOK_SPEED_AHEAD` 9 → 9.6, `FOV_SPEED_GAIN` 1.05 → 1.12), which is exactly
  what the narrower band took out of it. The two FREQUENCY cues are
  deliberately louder — posts every 18 m instead of 21, a 5 m ground cell
  instead of 6 — because frequency is the channel that reads as speed rather
  than as intensity: 2.63 posts and 9.48 rungs a second at cruise against 2.25
  and 7.86. The wind streaks come in at 33.9 m/s instead of 35.2 and peak a
  little brighter. Read-moment plate legibility went UP, not down, as a side
  effect: the narrower band puts less lens on the shot at the 36 m/s standard
  speed, and the route gates measure 231×58 px against 227×57 before, on a
  220×55 floor.

`npm run feel`, before and after, on the shipped baseline:

      acc |  slow p10   mean   fast p90 | swing | dashing | window | dist
      before
      70% |     26.6   32.4      36.4   | 1.37x |     13% | 1.51s  |  2552m
      85% |     41.5   50.0      55.0   | 1.33x |     33% | 1.00s  |  8159m
      95% |     51.0   58.0      62.5   | 1.23x |     46% | 0.88s  |  9854m
      after
      70% |     26.7   32.7      37.6   | 1.41x |     15% | 1.46s  |  2551m
      85% |     41.9   50.3      55.5   | 1.33x |     37% | 0.99s  |  8334m
      95% |     51.4   58.2      62.6   | 1.22x |     53% | 0.88s  | 10118m

The column that must not move is `window`, and it does not: 0.88 s at 95 %
either way, because nothing here touched reading speed. What moved is time
spent dashing — 46 % to 53 % for a strong reader — and how far a run gets.

Both goldens regenerated with `npm run calibrate`; the behaviour snapshot moved
deliberately, which is what a tuning pass is. Every suite green.

## 1.0-RC9.1 — the review that teaches

`3 MISSED · REVIEW` opened a filed list: two headings, and under each a word
with its meaning. The headings were the panel narrating its own filing system,
and the pair a player most needs to see — the misspelling they fell for and the
truth beside it — sat as two whole words with no indication of where they
differed. This is the one screen in the game that teaches rather than scores,
and it is now one row per miss, read in a glance.

- **The letters that moved are marked, exactly.** Every fake this game shows is
  ONE edit from its source — the generator's four families are transpose,
  double, drop and vowel-substitute, and `makeFake` never composes two — so the
  difference is always a single contiguous span and finding it needs no
  edit-distance table: trim the common prefix, trim the common suffix, and
  what is left in the middle IS the edit. `src/words/spelling-diff.js` is that,
  in twenty lines and pure. Driven over the whole bank it produces 10,556 pairs
  that rebuild both spellings byte-exactly, every one with at least one marked
  letter, in exactly the four span shapes the four families make (`0→1` 2,882,
  `1→0` 3,607, `1→1` 1,162, `2→2` 2,905 — the census IS the proof that no fifth
  kind of edit is reaching players).
- **A mark is never put inside a correct spelling.** A dropped or doubled
  letter leaves one side of the pair with nothing to paint. On the
  MISSPELLING that gap is the lesson and gets drawn — a thin rule where the
  missing letter belongs. On the TRUE spelling it is drawn as nothing at all,
  deliberately: the player has to leave this panel with the right shape of the
  word, and `win-ter` teaches the wrong one. Gated.
- **The pair is the semantic wrong/right pair, and it survives colour vision.**
  `ui/access.js` already remapped that pair for the plate; it now publishes it
  to CSS as `--sem-wrong` / `--sem-right` on every palette, `off` included, so
  the stylesheet reads one source rather than keeping a default of its own.
  Deuteranopia and protanopia get orange against blue, tritanopia rose against
  teal. A review screen that teaches with red against green teaches nobody in
  the modes that palette exists for.
- **No headings.** A struck spelling IS the statement that this player tapped a
  fake; its absence is the statement that a real word went past. NOT A WORD and
  UNCAUGHT are gone, and the column of true spellings runs straight down the
  panel either way.
- **The retirement line rides its own word's row.** `BEAT YOU 3 TIMES · GONE`
  was a sentence under MORE STATS, three taps away, with none of the word's
  spelling, meaning or danger beside it. It is on that word's row now, in the
  right-read colour, because this panel is where the game talks about words. A
  clean run that retired one still reaches the panel — the card reads PERFECT
  RUN and offers `1 BEATEN · REVIEW`.
- **Nothing new was collected to do any of it.** The meaning is
  `words/definitions.js`, built by `build:definitions` from WordNet at build
  time; the three pips are `words/danger.js`, structural danger blended with
  this player's own ledger row; the retirement is `meta/nemesis.js`. The row
  file holds no table of its own, and the gate asserts that too.

The row's markup moved into `src/ui/review-row.js`, pure — four values in, one
string out — so the gate suite builds real rows over real bank words and checks
what a player would actually read, rather than pattern-matching a method it
cannot call. Eleven new checks in `word-gates`; the three older gates that
asserted the retired shape now point at the new one. Every suite green.

## 1.0-RC9.2 — the challenge loop

The deterministic core has been able to hand one player another player's exact
run since Phase 14, and the loop never closed, because sharing a run and daring
someone to beat it were two different buttons. SHARE sent the image and the
game's front page; LINK copied the dare. An image is a boast and a link is an
invitation, and the half a player skips is the one that brings anybody back.

- **One tap does both.** SHARE copies the challenge link AND hands the image to
  the share sheet with that link as its URL, so whichever way the message
  travels it arrives with the route attached. LINK is gone from the tray. The
  clipboard write is STARTED before the sheet opens and awaited after it —
  both want the same user gesture and the sheet is the one that expires first
  — so a dismissed sheet still leaves the link on the clipboard.
- **The link carries the bar.** `seed · mode · difficulty · salt · score` gains
  `bar`, the compression level the challenger played at, because two runs at
  different bars are not the same dare: the bar moves both the reward line and
  what counts as an early read. A challenge run STARTS on that level and is
  never locked to it — the hold that moves the bar works exactly as it always
  did, because a link is a coordinate, not a rule. The clamp reads
  `COMPRESSION_MULT.length` rather than a literal.
- **The dare is said once.** A challenge visit used to caption itself twice: a
  CHALLENGE label under the wordmark and a `BEAT 2790M` line under the chips —
  which between them said the word "challenge", said METRES for a figure that
  has been a score since Phase 25, and never said the one thing that makes a
  dare a dare. One line does all of it: `BEAT 141,082 · THIS ROUTE`, and it is
  styled as the caption of the screen rather than as the seed string it
  replaced. The hint under the wordmark is now empty on every screen there is.
- **The score to beat is on the HUD.** A second quiet figure under the metre
  caption — smaller than the caption so it never competes with the score it is
  measured against — and it turns the semantic right-read colour the instant it
  is passed. That flip is the whole reason for putting it on the HUD instead of
  on the card: a player chasing a number should not have to work out whether
  they have it yet. It appears on a challenge run with a goal and nowhere else,
  and it is gated that way.
- **A challenge run is still never board-eligible and still never sets a best.**
  Unchanged rule, unchanged code.

**The title's caption had three other owners, and one of them was a runtime
patch.** Chasing why the new dare line kept reverting found `rc97-endgame.js`
overriding `UI.prototype.setSeed` to re-assert the caption, `v1-finalize.js`
rewriting the line in its consolidation pass, and `render/endgame-sky.js`
writing it every frame of the ending — three files fighting over one element,
with the stalest copy winning. That is precisely the failure the one-file rule
in CLAUDE.md exists to prevent, so all three are removed and two gates hold the
line: the caption is written in exactly one file, and no file patches
`UI.prototype.setSeed` at runtime. `v1-share.js` also joined the retired-copy
scan, having carried `HOW FAR CAN YOU GO` for four phases after the line was
retired — no scan reached the one file that says the game's name to everyone
the player shares with.

Gated: a link round-trips a BYTE-IDENTICAL route — sixty gates driven from the
encoded coordinates and again from the decoded ones, every shown spelling, true
answer, tier, deception family and arm distance matching, with a changed seed
and a changed salt both proving the check measures the route rather than the
loop. `audit:network` still reads zero: the link is a URL, and building one
makes no request.

## 1.0-RC9.3 — the cabinet on wide screens

This is a vertical-screen game. Stretched across a landscape window the road
flattens toward the horizon, the plate shrinks to stay inside the frame, and
the reading standard — every number of which was measured at 390×844 — stops
describing what anyone is actually looking at. On any viewport wider than it
is tall the play area now keeps its portrait proportion and the rest of the
window becomes a bezel.

- **`#app` IS the stage.** Every overlay in the build is already positioned
  absolutely against it, so framing that one element frames all of them at
  once with no DOM surgery — and the translate that centres it makes `#app`
  the containing block for `position:fixed` descendants too, so the teach band
  and the touch buttons land inside the frame rather than across the window.
  The bezel is `<body>`; the only thing in it is the marquee, which is
  `aria-hidden`, `pointer-events:none`, and lit — a cabinet header, not a
  control. `--cab-aspect` is 0.4621, which is 390/844 to four places, and the
  gate checks it against the standard rather than trusting the number.
- **The camera is sized from the CANVAS, not the window.** That is the one
  code change the frame needed, and it is more correct in the portrait case
  too, where the two agree: the canvas is what the projection has to match and
  the window was only ever a proxy for it. The RC7.1 render-budget governor
  was sizing the drawing buffer to `window.innerWidth` on every DPR step —
  which would have re-stretched the buffer across the whole window and left
  the camera's aspect behind the first time the frame rate dipped. It resizes
  THROUGH `stage.resize()` now, and `resize()` applies `stage.dpr` instead of
  re-reading the device, so the governor's choice survives a resize.
- **Measured, not asserted.** The plate at the read moment, projected through
  the shipped rig: 39.20% × 4.53% of the frame at 390×844, 39.20% × 4.53%
  framed in 1280×800, and 39.20% × 4.53% in 1920×720. The same rectangle, to
  four figures, on all three.
- **The keyboard legend.** `← FAKE`, `↑ BAR`, `SPACE DASH`, `→ REAL`, standing
  where the touch buttons stand, in the order they stand in — a phone explains
  its controls by drawing them and a keyboard draws nothing. Each glyph dims
  for good once its control has been used, on the SAME persisted flags the
  coach retires its rungs on, so a player who already knows the game watches
  the legend disappear over their first run instead of being told anything.
  Off on touch (the buttons are the legend there) and off in portrait. It
  reads nothing from the sim and the gate checks that too.

Three things were found by looking at the framed screen and are fixed here
because the frame is what exposed them. The launch veil, the teach band and
the answer glow all hung off `<body>` rather than off the stage, so in a
cabinet they painted across the bezel and the marquee — they hang off `#app`
now, and the framed stage clips. The shell colour was a hard-coded slate grey
that only ever showed during a rubber-band overscroll; framed it IS the bezel
and surrounds the screen the whole time, so both read one `--bezel` token.
And every `vw` in the stylesheet meant "of the play area" — the two were the
same rectangle until now, so the widths simply became percentages (identical
in portrait, by definition) and the font sizes are restated in `cqw` against
the stage in the framed case only, leaving portrait untouched.

The teach band also learned that a line with only ONE clause has no separator
to break at, so holding it unbreakable only made it overflow — which the
cabinet's clipped stage then cut in half. Eight new checks in `route-gates`;
the portrait stills re-shot and unchanged.

## 1.0-RC9.4 — the DAILY explained, and a demo with something to say

Two screens were saying less than they knew. The DAILY RUN chip named a mode
and nothing anywhere said why a player would pick it over ENDLESS; the attract
loop ran a beautiful road and captioned it with nothing at all.

- **`100 WORDS · SAME FOR EVERYONE · ONCE A DAY`,** under the chip, the moment
  it is selected. Three facts, and they are the three that make the mode worth
  choosing: it is finite, it is comparable, and it is today's. The count comes
  from `MODES.RULES.standard.GATES` rather than a literal, so a route of
  another length cannot leave the copy lying. It retires the first time the
  player FINISHES a daily run — written where `metaDaily.recordRun` is, not
  where a run starts, because a run abandoned on the title has not taught
  anybody what the mode is — and it retires on the same write-once ledger and
  the same `learn()` call every other lesson in this game uses.
- **`DAILY · YOUR BEST 404,815 · DAY 4`**, under the wordmark, while the ghost
  runs — or `DAILY · NOT YET RUN` for a route this player has not touched. Two
  states and no third. A cabinet running its demo says what the game is
  offering; this says what today's route is worth to the person standing in
  front of it, which is the one thing an attract loop can say that a trailer
  cannot. Both figures already existed: the streak is the daily card's own,
  and the best is the score best for the DAILY variant.
- Reading that best needed one small piece of care worth naming. Bests are
  stored per variant, so the daily's best is not readable while the title is
  sitting on ENDLESS — `dailyBest()` borrows the DAILY variant for the length
  of the read and puts the player's back. It is the only new function in the
  pass.

Any touch and any key still end the loop, exactly as before; the caption is up
only while the demo is. Six new checks in `meta-gates`, including that the
retirement is wired to a finished run rather than a started one — the kind of
thing that is invisible in a screenshot and obvious in a diff.

## 1.0-RC9.5 — HARD with teeth

The calibration tables said it plainly and had been saying it for phases: pace
24/27/30 barely separates a competent reader, because pace only decides how
fast a COLLAPSED run is ended and a reader who is not collapsing never meets
it. Tiers make the words longer. Nothing made the READ harder. HARD now gets
the one lever that does — less road to read the word on.

- **`WINDOW_SCALE`, on the HARD profile only, at 0.88.** It scales the ARM
  WINDOW and never `ARM_DISTANCE_M`, which stays 55 and may not grow: the word
  is drawn identically, at the same size, over the same 55 m of legible
  approach on every difficulty. What changes is how much of that road still
  counts as an answer — 48.4 m on HARD. That is a rule of the difficulty, not
  a property of the plate, and the WINDOW table prints the plate column
  unchanged on every row to say so.
- **The two-tier standard travels with the scale.** HARD's floors are the
  shipped floors times the same number — 1.15 s becomes 1.01 s at cruise,
  0.75 s becomes 0.66 s at the ceiling — so the same standard is applied to
  the same curve at this profile's own window. Deriving them rather than
  declaring them is what stops a profile's difficulty and its legibility
  drifting apart: one number moves both, or neither moves.

      profile | scale  arm m | cruise  window  OD-win | ceil window | floors | plate m | standard
      easy    |     1     55 |   47.4    1.16    0.83 |        0.86 | 1.15 0.75 |    55 | holds
      normal  |     1     55 |   47.4    1.16    0.83 |        0.86 | 1.15 0.75 |    55 | holds
      hard    |  0.88   48.4 |   47.4    1.02    0.73 |        0.76 | 1.01 0.66 |    55 | holds

- **The ladder barely moved, and that is the finding, not a failure.** Its
  reader answers the instant a word arms, and a shorter window costs such a
  reader nothing at all. HARD at 85 % still clears the route (100 gates) and
  HARD at 70 % still does not (25 gates, redlined) — unchanged, as intended.
  So the pass added the instrument that CAN feel it: a reader with a reading
  TIME rather than a reading distance, driven over the daily route.

      read s | easy  slipped  score | normal slipped score | hard  slipped  score
      0.60   | CLEARS      0 197,548 | CLEARS      0 234,528 | CLEARS      0 211,870
      0.75   | CLEARS      0 149,455 | CLEARS      0 176,913 | CLEARS      6 130,595
      0.90   | CLEARS      8  90,849 | CLEARS      8 106,862 | CLEARS     16  79,434
      1.05   | CLEARS     18  59,266 | CLEARS     18  69,572 | CLEARS     23  60,728
      1.20   | CLEARS     23  48,598 | CLEARS     23  57,357 | CLEARS     28  55,117

  HARD costs 0/6/8/5/5 more slipped real words than NORMAL at those five
  reading speeds. EASY and NORMAL are identical to each other at every one of
  them, which is the point: the scale is HARD's alone, and the other two
  differ only by tiers and pace exactly as they always did. A reader inside
  HARD's own 0.66 s ceiling floor loses nothing — the window punishes
  hesitation, never a reader who is inside the standard.
- **Two smaller things had to travel with the window or the model would have
  lied.** The early-read multiplier normalises by the PROFILE's window, so
  answering at HARD's arm edge still pays `EARLY_MULT` — a shorter window is
  less time, not less reward. And the compression bar's thresholds are
  fractions of the window (their own tuning comment says so), so they scale
  too; otherwise HARD would have compounded a shorter window with a
  relatively higher bar and the two difficulty levers would have stopped
  being separable.

Isolation is checked through the real sim, not read off the table: EASY,
NORMAL and the DAILY all play the full 55 m, and the DAILY cannot inherit a
scaled window whatever chip is lit, because `BOARD_POLICY` pins it to NORMAL.
The behaviour snapshot moved on exactly one of its five scripts —
`endless/hard/answerTrue` — and `standard/normal`, `endless/normal`,
`endless/easy` and the repair probe are byte-identical.

**0.88 is PROVISIONAL.** It is the number these tables were generated from and
it is not a decision; the decision is a phone in a hand and it has not happened
yet. Every instrument here reprints from that one value, so changing it is one
edit and `npm run calibrate`.

## 1.0-RC9.6 — the notorious tier, which is not a tier

The bank was curated for READABILITY — words whose misspelling is plausible at
speed. What it had never been curated for is the other thing entirely: words
English speakers actually get wrong. `separate`. `definitely`. `occurrence`.
`rhythm`. `liaison`. There are a few hundred of them and everybody knows which.

- **420 words, tagged.** `src/words/notorious.js` holds the list; every one of
  them also lives in the tier its length and frequency put it in and is drawn
  by the ordinary walk like any other word. That distinction is the design: a
  sixth tier would have made these a PLACE the run visits; a tag makes them a
  PRESSURE the run applies, and leaves the difficulty curve, the no-repeat
  stride and the tier ramp exactly as they were. 103 of the 420 were new to
  the bank (5,381 words now); the rest were already there and are simply
  labelled.
- **The same QC, and the bank's own gates found what the curation missed.**
  Charset, 3–12 letters, deduped, past the family blocklist, present in the
  shipped English dictionary, and inside the regenerated one-edit collision
  guard (`build-guard`, 9,178 words). Thirteen candidates were dropped for
  exceeding the 12-letter plate cap — `accommodation`, `pronunciation`,
  `representative` and their kind — and four for being proper nouns in
  lowercase. And the existing "one spelling convention" gate rejected a first
  draft outright: it carried `manoeuvre`, `neighbour`, `licence`, `realise`,
  `judgement` and eight more British forms into an American bank. They are the
  American spellings now. That gate has been in the suite since Phase 11 and
  this is the first time it has had anything to say.
- **Where the tag lands**, over 100 gates of one seed:

      easy 5% · normal 8% · hard 58% · daily front 6% back 58%

  EASY carries no bias and never will — it meets the tag only at the
  BACKGROUND rate every untagged profile does, because these are bank words
  and a tag is a preference rather than a partition. HARD asks for them
  outright. The DAILY opens on ordinary vocabulary and tightens through its
  back half, which is a route that gets harder rather than a route that was
  always hard.
- **It substitutes and never reorders**, which is the rule the nemesis lane
  already lives by and for the same reason: the tier walk runs unconditionally
  and only the PRINTED word may differ. Measured rather than asserted — over a
  hundred HARD gates the walked word is identical with the preference on and
  off (100/100) while 50 printed words differ. The substitute comes from its
  own coprime walk over the tier's tagged sublist, so a run of preferred gates
  does not repeat a word either, and the fake is still `makeFake`'s decision
  with the gate's own deception family.
- **The nemesis lane weights the tag** without letting it outrank evidence:
  most-missed first, then the tagged word, then least recently seen. A word
  English speakers actually get wrong is worth more of that lane's scarce
  gates than one this player fumbled once — but a word they have missed nine
  times still wins.

Two properties fell out and both are worth having. The DAILY is byte-identical
across players with the tag in place — driven through `sim.start`, which
refuses a personal lane on a route, rather than through `makeGate`, which would
have proved nothing. And the Phase 0 behaviour snapshot is unchanged on all
five scripts: the tag changes WHICH word you read and never the shape of the
run, because real/fake, gate distance and deception family are all decided
before a word is chosen. Every calibrated table reproduces byte-for-byte.

## 1.0-RC9.7 — the second layer of music

Phase J retired the four-layer stem engine and was right to: it only ever
played synthesized placeholders, was muted the instant the real track went
live, and no stems were ever produced. What it retired WITH the engine was a
genuinely good idea — that the arrangement should thicken when someone is
reading brilliantly and thin out when they lose it. This re-opens exactly one
hook of that, and nothing else.

- **One layer, earned at the third editorial band.** It fades in while the
  reading chain holds 50 or more — `BAND_CHAINS[2]`, the band the world already
  calls *blooming* — and fades out when the chain breaks. Read through
  `bandFor` rather than off a raw threshold, so a chain hovering at the line
  cannot make it flicker.
- **Beat-aligned, and NOT per-beat.** Those are two different promises and the
  envelope makes both. An edge waits for the next beat the clock crosses, so
  the layer arrives musically rather than on whatever frame the fiftieth read
  landed on — two seconds of frames past the threshold with no beat move it not
  at all, and the next beat releases it. Between edges the gain is a straight
  seconds ramp: held at chain 90 it measures 1 to 1 over eight seconds, whatever
  the beats are doing. A level that pumped with the kick would be a per-beat
  event on the one bus that is never allowed one.
- **In slower than out.** 1.8 s to arrive and 0.9 s to leave — measured at
  1.57 s from full to silence on a broken chain, because arriving is a state
  being earned and leaving is a state being lost. A run ending drops it without
  waiting for a beat at all, and with no track playing the edges fire
  immediately: silence is not a reason to hold a layer down.
- **The same bus, so the same everything.** It routes to `audio.bus.music`, the
  one the score already rides, so MUSIC OFF, the drain's lowpass and every duck
  in the mix apply for free. No second music path and no dial of its own —
  which is precisely how the retired engine ended up with a `MUSIC_MAX` to keep
  in sync with a mix it had left.
- **It draws nothing.** Its gain is not read by the camera, the post chain, the
  palette or anything else on screen; `musicResponse` is untouched. The visual
  energy stays the run's and the score map's, and the layer has no vote. Gated
  as an absence, which is the only way that kind of promise can be kept.
  REDUCED FLASH governs what the screen does, and this layer's whole contract
  is that the screen does nothing about it.

**The mechanism ships working, not waiting.** With no `into-the-night.high.mp3`
present the game synthesizes a placeholder pad — three detuned triangles
through a dark lowpass, in the track's key, whose only amplitude is the
envelope's — so every one of the behaviours above is live and audible today.
The drop-in contract is written down beside the track in
`public/audio/music/README.md`: name the file, match the length, tempo and loop
point, keep it an OVERLAY rather than a mix, and put nothing rhythmic in its
own envelope. `src/audio/high-layer.js` probes for it at boot and prefers it
whenever it answers; nothing else changes. **[MP] supplies the layer; the
placeholder stands until then.**

The envelope itself is `src/music/high-layer.js` — pure, numbers in and a gain
out — so the fourteen new checks in `gate:music` drive the real thing headlessly
rather than inspecting a wrapper. `audit:network` still reads zero: the probe
for the real file is a same-origin HEAD that misses, which is the expected case
and is not an error.

## 1.0-RC9.8 — the best moment, as a clip

The standout line has always known the run's best stretch and has never been
able to show it. A results card that says CLEAN 41 is asking you to remember
something you were too busy to watch. This keeps the last few seconds of the
run rolling in a small buffer, freezes it at the instant the run's rarest feat
lands, and offers it back on the card as a short loop beside the still.

**The budget is the design.** A capture that costs frames changes the run it is
recording, so every part of this is a ceiling first and a feature second:

- **One canvas, allocated once.** A filmstrip of 24 cells at 144 px wide —
  `144 x 312 x 4 B x 24 = 4.11 MB` on a common phone, against a 6 MB ceiling
  the gate holds. The number is knowable BEFORE it is paid: `captureBudget()`
  is pure, takes one number (the canvas aspect) and is printed by
  `gate:corruption` and by the new audit on every viewport it visits.
- **One blit per captured frame, ten a second.** A `drawImage` into a small
  target, roughly a sixth of the frames the game draws. Nothing is read back
  into JS memory and no pixels are copied at all until a clip is exported —
  `getImageData` appears nowhere on the live path, and the gate keeps it that
  way.
- **It measures the device before it arms.** The first 90 frames of a run are a
  measurement; under 45 fps the buffer never allocates and the run is simply a
  run. A phone already dropping frames does not get a souvenir at the cost of
  the thing the souvenir is about.
- **Off entirely under REDUCED FLASH.** A short loop that plays itself is
  motion, and the player has said no to motion. Not dimmed, not paused — never
  allocated.

**Freezing copies nothing.** It records where the ring's head was, so a frozen
strip and a live one are the same pixels read in a different order; the ring
keeps running, and a rarer feat later in the run re-freezes over an earlier
one. That ordering is not a second opinion: `standoutRank` reads the same list
`pickStandout` reads, and the gate proves across twelve ledgers that the rank
is zero exactly when the line is null. **A run with no standout offers no clip
— no player, no placeholder, no button.**

**The card's furniture is burned in, not overlaid.** The flow band in its own
ice cyan and the DICTION DASH wordmark are drawn into every frame of the
export, so a clip that leaves the device leaves as a piece of this game rather
than as an anonymous few seconds of a road. The export re-renders at twice the
preview's size rather than recording the on-screen element, because the element
is a preview and the file is the artefact. WebM through MediaRecorder where the
device can record a canvas; a local GIF89a encoder beside it where it cannot —
a histogram over a 5-bit cube and the GIF variant of LZW, no dependency and no
upload. The encoder is DOM-free by construction (pixel arrays in, bytes out),
so the gate does not take its word for anything: it encodes three frames in
node and then DECODES them back through the format's own LZW, and the pixels
return inside the cube's own error — 4 of 255 on the worst channel. A file
that parses as a header and hands a viewer rubbish is the failure a byte count
cannot see.

**Nothing leaves the device.** Capture is a blit, encoding is local, and the
result is a Blob the player may choose to hand to a share sheet. The clip is
its own control — the canvas carries `role="button"`, so tapping the moving
thing saves it and the tray does not grow a fifth item. `audit:network` still
reads zero, and the new audit asserts zero external requests across capture,
freeze and export as well.

**`npm run audit:capture`** is the phone-matrix bench: four portrait viewports,
the same stretch played twice under each condition — the buffer off (which is
the shipped REDUCED FLASH path) and the buffer armed — interleaved, because a
run gets faster as it settles and a straight A-then-B would bill that to B. It
holds the p95 difference under `CAPTURE.COST_MS` (1.5 ms) and the absolute p95
inside the 20 ms RC budget. Both timing assertions sit behind the same 45 fps
floor the game itself arms behind: a host doing software rendering draws this
game in single digits, would never run a capture, and does not get to price
one — it says so in plain words rather than passing quietly. On this machine
the four
viewports report **not priced**; the budget, the refusal, the clip, the export
and the network promise are asserted there and everywhere. The passes are
mirrored OFF/ON/ON/OFF with a throwaway first pass, so nothing a cold frame
pays lands on one condition rather than the other — with that in place the two
conditions come back within a frame of each other at p50 on every viewport,
which is the shape a fair comparison has. **[MP] runs the
bench on a GPU host, and the two new soak items on a phone.**

## 1.0-RC9.9 — held breath, and the bar on DASH

Three playtest findings, and the third is a mechanic finally arriving where
anyone can find it.

**The runner runs on GROUND, not on the frame clock.** A teach stop freezes the
world outright — the clock, the pursuit, the player, the gate — which is the
right design and which also left the figure sprinting on the spot in front of
a stopped world. It read as a hang. The stride phase now integrates the SIM's
distance delta: no metres, no stride, so a frozen sim is a frozen figure for
free and the pose is a pure function of ground covered rather than of how the
browser is feeling. The ghost rides the same rule, from the same exported
function, so the two figures cannot fall out of step for reasons that have
nothing to do with either of them. Gated on the real thing: a guided run
driven into its first stop, then two hundred frozen steps of stride
integration, phase 1.7 in and phase 1.7 out — not close, equal.

**And the frozen frame breathes.** Five things are still true through a stop —
the stop's own line, the bar's three marks, the hearts, the score's glow, and
the ring on the control being pointed at — so they brighten and dim together
on the music's own two-bar phrase. That is 0.34 Hz at the score's 164 BPM,
half the 0.6 Hz ceiling: respiration, not animation. Light only; nothing
moves, and the gate refuses any transform under the breathing class. The ring
drops its own 1.1 s pulse for the duration, because one rhythm on screen is
the point. REDUCED FLASH never adds the class at all, and the rest value is
full brightness — held still means held LIT, since the alternative is dimming
a HUD the player is being asked to read. One writer: main.js sets a single
custom property and CSS spends it, so there is no per-element animation that
can drift out of phase with the other four.

**The bar moved onto the DASH.** It used to be a held press on the right SCREEN
HALF — a half whose only other meaning is "this word is spelled correctly" —
with the two verbs told apart by a stopwatch on the same pixel, plus an
ArrowUp on keyboards that shared nothing with it and nothing on a pad at all.
Nobody found it. Now:

- **A tap dashes ON RELEASE.** Under 520 ms and the press was a dash. The
  release is when it fires, because until the press has outlived the hold
  window the game cannot yet know which verb it is, and a dash spent on the
  press could not be taken back when the press turned out to be a bar.
- **A hold raises one level, and wraps.** Past 520 ms the press buys a level
  and can no longer dash however it ends. Past the top the bar returns to
  none — the only way to say "I am done betting" with a single control.
- **The same rule on every device**: the DASH button, Space, and the pad's RT,
  through one press/release machine, so they cannot disagree about what a
  press means. The right-zone hold and `lowerBar` are retired. ArrowUp stays
  bound as a keyboard alias — it is no longer the taught control, but it costs
  nothing, the cabinet's key legend still names it, and a player who learned it
  should not find it gone.
- **The copy, everywhere, from the one module**: HOLD DASH TO RAISE THE BAR ·
  ANSWER FASTER, SCORE MORE, with SPACE and RT by modality, and the HOW TO PLAY
  rule now says the two things a player would otherwise learn by accident — a
  held press never dashes, and past the top the bar returns to none. The coach
  offers the line ONLY while nothing is armed: it names the dash control, so a
  player who obeys it mid-word is holding instead of answering.

RC8.1 banned HOLD DASH and HOLD RT outright, because the dash was a press and
the copy kept saying otherwise. A held DASH means something real now, so those
two come off the ban list and a sharper gate replaces them: **no DASH
instruction may say HOLD**, in any modality, checked against the charged line
and all three stop lines. HOLD F stays banned — F is an unadvertised alias the
copy never names.

**And losing the bar is now something you see.** The reset on a wrong read was
always there; what was missing was anyone noticing it, because the marks
blinked out on the frame the level changed, in the middle of a drain that had
the eye elsewhere. They collapse down the drain's own curve now, in the live
ACCESS danger colour every other correction wears — one shared constant, so
the world's drain and the bar's collapse are literally the same beat rather
than two numbers that happen to match today.

**Dash timing did not move, and the gates prove it rather than assert it.** A
full charge still spends itself whole on DRAIN_RATE whatever the control does
afterwards: 3.583 s measured against METER_MAX/DRAIN_RATE = 3.571 s. A hold
was driven against an untouched control run on the same seed and every gate
resolved identically — 402 bar moves, and nothing else in the run knew the
difference. Every calibrated table reproduces byte-for-byte and the Phase 0
behaviour snapshot is unchanged on all five scripts. The Phase F tables are
re-driven and printed: L0 472,126 through L3 755,402 clearing the bar, and the
same collapse to 137,580 for a bar set and not cleared. What the bar PAYS is
exactly what it paid; only how you raise it has changed.

## 1.0-RC10.1 — the layer that patched the game at boot is gone

`v1-ship-polish.js` reassigned two prototypes at import time. It reached
`Input.prototype.update` to fold in the gamepad, `Audio.prototype.update` to
poll the controller's menu navigation, and `Audio.prototype.bell` to add two
partials — three unrelated systems behind one audio-shaped filename, loaded
through a side-effect import six levels down an audio chain. It is the exact
pattern CLAUDE.md forbids, and it had every symptom that rule was written
about: nothing named `input` led to the gamepad, nothing named `ui` led to the
menu navigation, and after RC9.9 it was the only thing on the planet reaching
into the dash machine from outside `input.js` — a place nobody would look when
the dash changed. `rc9-audio.js` even carried a comment claiming nothing
reached into a runtime-patched object any more, one line above the import that
did.

Three files you can find from the import graph now:

- **`src/input/gamepad.js`** — a READER. It polls the pad, decides what the
  buttons mean, and writes the same flags a thumb writes. Pointer and keyboard
  keep priority when they are actively in use, because a pad on a desk reports
  a steady zero and a zero that overwrites a live thumb is a stuck stick.
- **`src/ui/controller-nav.js`** — which surface is on top, which of its
  buttons has focus, and what A / B / START mean there. It reaches the game the
  way a player does: focusing and activating real buttons, dispatching the same
  keys a keyboard sends. Ticked from the frame loop, where a per-frame thing
  belongs — it used to ride the audio bridge purely because that ran once a
  frame, so a player pressing A on the results card went through the mixer.
- **The bell's own method.** The two bright upper partials are part of `bell()`
  now. The patch and the method each carried their own copy of the interval
  table, which is precisely the drift a wrapper invites; there is one table.

**And a whole system was deleted rather than moved.** The destruction-audio
path — a per-frame snapshot of nearby colliders, diffed to play breakage — could
never fire: `TREE_COUNT` and `ROCK_COUNT` are `[0, 0]` and `GATE_CHANCE` is 0,
so the snapshot is always empty. Its own comment admitted this and kept it
anyway "because it costs nothing". It cost a per-frame allocation and a
paragraph of reading. The gate that guarded its shape now guards the fact that
made it dead.

**RC9.9's one dash rule survived the move by going through a door.** The pad
calls `input.dashPress()` and `input.dashRelease()` — the same machine the
button and Space use — so RT taps to dash and holds to raise the bar with no
second implementation of that decision anywhere.

**One real bug found and fixed on the way, and it was mine.** Moving the pad
out of the wrapper meant it now runs AFTER `input.update()`, and `boostHeld`
was a field copied once a frame: the pad set the dash edge after the copy was
taken, and `consumeJump()` destroyed the edge before the sim ever read it. RT
did nothing. Shuffling the call order would have fixed the symptom and left the
trap; `boostHeld` is a GETTER over the edge now, so the order of its writers
cannot matter again. Measured before and after on a synthetic pad: A answering
a word went from 0 resolutions to 1, and a 400 ms RT tap from no dash to a
dash. Two further zeros chased in the same session turned out to be the probe's
fault, not the game's — a runner left unanswered misses real words, and every
missed real resets the bar the hold had just raised.

Verified on a synthetic pad through the real build: RT tap dashes on release
and not on press; a 1.2 s hold raises exactly one level with no dash and no
wrong read; A answers; START pauses and A activates the focused button; zero
console errors through the lot. All suites green, every calibrated table
reproduces, and the behaviour snapshot is unchanged — nothing here is sim.

## 1.0-RC10.2 — legibility is a dial, and it reaches the sentences

Word-plate legibility outranks every other visual and audio change in this
game, and until now it was a SWITCH. READABLE TYPE opened the plate's tracking
from 1px to 7px and added weight — one step, which serves the players it
happens to fit and nobody else — and it touched nothing outside the plate, so
a player who needed help reading the WORD got no help reading the sentence
explaining the word.

Two dials, three steps each, and step 0 at both is exactly what shipped: a
player who never opens settings sees no change at all.

- **WORD SPACING** — 1 / 7 / 12 px, with weight following. Tracking is the
  lever with the best evidence behind it and the one this game asks the most
  of: `rn` against `m` is a spacing problem before it is a shape problem, and
  every fake here is one edit.
- **WORD SIZE** — the plate's world height, x1 / x1.12 / x1.24. Nobody could
  reach this before at all. It scales the quad, not the canvas, so the same
  texture is simply read larger: nothing re-renders, no word re-flows, and it
  costs nothing per frame.

**The face is not a dial and never becomes one.** It is Atkinson Hyperlegible
Next at every step — bundled, drawn by the Braille Institute so I/l/1, O/0 and
rn/m cannot be confused. Adding a second "dyslexia font" option would offer a
worse face as a courtesy.

**Neither dial can move a reading floor, and that is gated twice.** How long a
word is on screen is `ARM_DISTANCE_M` over the run's speed; how big it looks is
these dials. The window measures 1.27 s at cruise and 0.86 s at the ceiling at
every step of both, and no file under `src/sim/` mentions either dial or
`TUNING.PLATE` — the sim cannot see them.

**The occlusion promise is re-proved at every step, not just the default.** A
larger plate is a larger thing for a crest to hide behind, so `route-gates`
takes a size multiplier now and walks the routed road three times. Zero
occluded frames out of 20,505 armed at each, and the worst segment's read
moment grows rather than shrinks — 230x58 px, 258x64, 285x71 at 36 m/s, with
screen rotation flat at 0.14 degrees throughout.

**Every word still fits.** Widening tracking pushes long words into the
shrink-to-fit floor sooner, and a word that reaches the 64 px floor and is
still too wide would render clipped — the one failure this whole constraint
exists to prevent. `dev/measure-plate-fit.mjs` renders all 10,747 plate strings
(every real word AND a one-edit fake for each, since a fake can be a character
longer than its word — the longest is 13) at every step through the real font:
worst fit 120 px, 104 px, 96 px, and **zero overflow at any step**. The gate
holds the inputs that measurement was taken at, so moving the character cap or
the tracking ceiling fails the build and sends you back to re-measure.

**And raising either dial relaxes the PROSE.** A player asking for a more
legible word is telling you something about the whole screen. The coach line,
the teach line, the HOW TO PLAY rules, the review rows and the results recap
switch to the same hyperlegible face and ease the display tracking that is fine
on a label and hostile in a sentence. Deliberately not a global face swap: the
cabinet, the marquee and the HUD are laid out to the display face's metrics,
and reading is not fixed by moving furniture.

**A profile saved before this lands exactly where it was.** READABLE TYPE meant
7 px tracking and no size change; it migrates to spacing 1, size 0, and the
stored preferences are not rewritten until the player changes something.
Verified through the real build: a legacy profile comes up with the treatment
on, a fresh one comes up with it off, and clicking WIDEST and LARGEST as a
player does persists both and switches the coach to Atkinson at 13 px, with no
console errors.

## 1.0-RC10.3 — the words you have actually learned

The nemesis ledger is the best idea in this game. A word you miss comes back
inside the same run, then across days on a widening schedule, and three clean
reads in a row retire it for good. It has always worked and it has always been
INVISIBLE: a player could beat forty words over a fortnight and find nothing
anywhere that had grown.

`retiredCount` was never the number to show, either. It only counts words you
got WRONG first, so the better you read the smaller it gets — a player who
rarely misses would be told they had mastered nothing. That is the opposite of
the truth, and it is the reason this needed its own ledger rather than a label
on an existing one.

**A word is LEARNED when you have read it correctly and are not currently owed
a repeat for it.** Missing it takes it back; beating it through the ledger's
three clean reads returns it. Two systems, one honest number, and it is
self-correcting — nothing has to remember why a word left.

The predicate is OUTSTANDING MISSES, not "the ledger has heard of it". The
first version asked whether the word had a history at all, which is true of
every word the ledger has ever seen — including one read right the first time.
That version counted nothing for a good reader, and the gate driving the two
real ledgers together found it before it shipped, which is what those gates are
for.

**Where it shows.**

- **The title** carries the one number — `412 WORDS LEARNED` — and says
  nothing at all until there is something to say. It refreshes on the way back
  from a run, because a run is the only thing that can move it.
- **PROFILE** carries what the number is made of, tier by tier, with a bar
  each. "412 of 10,556" is a fraction nobody can feel; "tier 1: 380 of 900" is
  a shelf filling up.
- **The results card** reports a run that actually taught something —
  `LEARNED +7` — and an ordinary run says nothing, exactly as the standout
  does. A word counts there the first time it is learned and never again, so
  the line is never the same word twice.

**It stores words, not positions.** A bit per word over the bank would be 1.3 kB
against roughly 25 kB for a realistic player's actual words — and it would be
keyed by position in a list this game appends to. RC9.6 put 103 new words into
the MIDDLE of four tiers; every such edit would shift indices under a stored
bitmap and silently rewrite what a player had earned. A word identifies itself,
the set is bounded by the bank, and no migration hazard exists to get wrong
later.

The order of the two hooks matters and is gated: a correct read marks AFTER the
nemesis ledger records, so the read that RETIRES a word is also the read that
learns it rather than leaving it a run behind. `meta/mastery.js` is pure and
adapter-backed, so all thirteen new checks drive the real ledger against the
real nemesis ledger headlessly rather than inspecting source. The run export
also carries the two RC10.2 legibility steps now: a verdict on a read time
wants to know how big the word was.

## 1.0-RC10.4 — the title paints in 0.7 s instead of 2.7

The size ceilings were never the problem. The build is 8.35 MB against a 30 MB
Playables limit, and 6.73 MB of that is the score — the JavaScript is 1.2 MB.
What was wrong was the only number a player feels, and nothing in the repo had
ever measured it: **time to first play**.

`npm run audit:load` measures it now, on a mid-tier phone profile — 12 Mbps,
70 ms RTT, 4x CPU slowdown, cold cache — and reports three moments and the
waterfall behind each. Before this pass:

```
paint         2687 ms
interactive   2722 ms   15 requests, 7152 kB
playable      2730 ms
```

**Two point seven seconds of blank screen, for a title screen that is
plain markup.** The title is written out in `index.html`, styled by the inline stylesheet,
and needs no JavaScript at all to be looked at. The reason it was not on screen is
boring and entirely fixable: a deferred module runs the moment the parser is
done, and evaluating this one means three.js, the renderer, the scene, the
audio graph and the word bank. On a throttled CPU that is one unbroken task,
and a browser cannot paint in the middle of a task. The player watched an empty
screen while the game built a world nobody had asked for yet.

`src/boot.js` is the entry point now and does exactly one thing: waits for a
frame to be presented, then imports the game. Two `requestAnimationFrame`s
rather than one, because the first only schedules against the frame currently
being assembled; a background tab never gets a frame at all, so that case falls
back to a timer. It is a doorway, not a loading scheme — the same modules load
in the same order, one paint later — and a gate holds it under fourteen lines
with nothing conditional on the device, so it cannot grow into one.

Two more things came off the critical path:

- **The score is staged, not fetched.** `preload = 'auto'` on a 6.7 MB file
  began pulling all of it the instant the element existed — during boot,
  against the bundle and the fonts, for a track that cannot sound until the
  player has made a gesture. It is `'none'` now and becomes `'auto'` at
  `play()`, the first moment anyone wants it. Streaming still means a run
  starts before the whole track has arrived; that was never what cost the load.
- **three.js has its own chunk.** It is roughly two thirds of the bundle and
  changes about once a year, while the game changes every commit. A returning
  player re-downloads the game and keeps the engine, and on a first visit the
  two arrive in parallel instead of one after the other inside a single file.

After:

```
paint          677 ms      (-2010 ms)
interactive    677 ms      8 requests, 79 kB   (-7073 kB)
playable      1087 ms      (-1643 ms)
```

The title arrives **four times sooner**, with 79 kB on the wire instead of
7.1 MB, and a run can start 1.6 seconds earlier despite the boot deliberately
waiting two frames. The audit's budgets are set just above the measured
numbers — 1200 ms and 2000 ms — so the fix cannot quietly rot.

The entry point moving is the riskiest thing here, so it was checked rather
than assumed: `reachability-gate` walks dynamic imports and still finds all 105
source files reachable, now from one entry instead of two, and `audit:network`
drives a full boot, run and death through the new entry with zero external
requests.

## 1.0-RC10.5 — the challenge is an opponent, not a number

A challenge link has always been coordinates: same seed, same rules, same
words, same bar, and a score to chase. A score is a poor opponent. What a
player actually wants to know, second by second, is whether they are AHEAD —
and that is a question only a second runner on the same road can answer. So
the link carries one.

**The recorded ghost does not fit, and does not need to.** `sim/ghost.js`
samples `[t, x, y, d, state]` at 10 Hz — about 4 kB for two minutes, which is
not a link anyone can send. It does not have to travel: the receiver already
has the road. This track is auto-followed, so x and y are FUNCTIONS of d, and
the only thing that is genuinely the challenger's is how far along they were at
each moment. The link carries SPEED, one byte every half second, and the runner
is rebuilt by integrating those speeds against the receiver's own terrain —
the same terrain, because the seed authored it.

That file's own header predicted this in Phase 2: *"swapping localStorage for a
fetch() is the only change networked ghosts need, because nothing downstream of
`load()` knows or cares where the array came from."* It was right about the
seam and wrong only about the fetch. There is no fetch. The link is the data,
`audit:network` still reads zero, and `GhostPlayer` is untouched.

- **100 seconds of running is 267 characters.** A full end-to-end challenge
  link with a rival in it measured 218 characters in the gate and 40 in the
  live test's short run. Distance survives the squeeze to within 0.1 %.
- **A long run truncates rather than breaking the link.** The cap is 180 s —
  360 bytes, 480 characters — and past it the rival simply stops being ahead of
  you, which is exactly what `GhostPlayer` already does at the end of any
  ghost: it yanks into the fog and goes.
- **The rival is the LAST key in the query**, deliberately. It is by far the
  longest, so a chat client that cuts the tail takes the opponent and leaves
  the road, the rules and the target intact.
- **A malformed rival is not a rival.** Wrong alphabet, over the cap, spaces —
  all parse to null, and the link still opens on the right road with the right
  score. A challenge without a rival is what a challenge was last week.

**Which ghost you get, and why.** A challenge rival beats the local best,
because the rival is the reason the link was opened; offering someone their own
Tuesday run in answer to a friend's dare would answer a question nobody asked.
BEST RUN off beats both, because a player who turned ghosts off has said
something about ghosts, not about whose. No new copy and no new label: the pale
runner is already this game's whole vocabulary for "someone else was here", and
the four-name cap is not worth spending on a word the picture already says.

**One gate found a real edge before it shipped**: the speed byte was scaled at
0.25 m/s a step, giving a 63.75 m/s top — just *under* the game's own 64 m/s
ceiling, so a runner at full speed would have been quietly clipped. It is 0.28
now (71.4 m/s, 14 cm of position per step), and it is a written-down literal
rather than a value derived from `TUNING.RUN.CEILING`: this is a wire format,
links live in other people's messages for as long as they keep them, and a dial
that moved would silently re-scale every rival already out in the world.

Fifteen new checks drive the encoder, the resampler, the rebuild and the link
in node — including every byte value through the hand-written base64url, since
`btoa` is DOM and `Buffer` is node and this file has to be both. Verified
through the real build across two browser profiles: a challenger plays, the
link carries the run, and a receiver **with no ghost of their own** opens it and
races a rival that reports `fromLink: true`, rebuilds to 457 m against the
challenger's 477 m, and advances alongside them down the road.
