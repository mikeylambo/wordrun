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
- Meta layer — the SLU shell's Layer-1 managers ported into `src/meta/`
  (stats ledger, deterministic daily goals, play streak) and wired to the
  run: goal chips and the streak on the title, and a learning recap on
  the results card that shows the true spelling behind every wrong read
  (fixing a latent bug where the true spelling was dropped exactly for
  fakes). New meta gate suite; all suites green.
