# DICTION DASH — roadmap

The backlog, in the order it gets built. Shipped work moves to RELEASE.md;
this file only holds what is NOT built yet. The plan is the finishing brief
(Passes 1–4 below); each phase removes its own line here when it lands.

## Pass 1 — lock the mastery game

- **Phase H — calibration verdicts.** Shipped: ceiling 64 (held against the
  gated two-tier standard), `EARLY_MULT` 3.5, compression as-is, surge as-is,
  `LOOKAHEAD_GATES` 3 (played and decided), all frozen by
  `tools/calibration-gates.mjs` (`npm run calibrate` to regenerate a table
  deliberately). Done. The design change it surfaced shipped as Phase H2:
  the DAILY RUN now repairs a heart on a clean streak.

## Pass 2 — make it look like nothing else

- **Phase L — route grammar.** Waits on the Phase K pick in `dev/stills/`:
  a human picks or redirects before anything below starts. (L1 → L5, each
  gated before the next): vertical centreline + surface-normal camera; per-segment banking; crest / page-fold;
  canyon, tunnel, corkscrew, negative-space drop, pursuit-narrows; authored
  DAILY composition + ENDLESS segment walk. Plate size ≥ 270×68 at 62 m/s on
  flat / bank / crest / descent; plate rotation and skew gated; FOV ≤ 96.
- **Phase M — the Editorial World.** Typographic primitives as page geometry
  (rules, margins, columns, folds, punctuation as sculpture — no readable
  background text, gated), five flow bands (chain 0 / 25 / 50 / 100 / 150+),
  a wrong read drops a band, the Redline as an editorial correction. Every
  environment hue ≥ 35° from the semantic set; the plate never occluded.
  The floating verge posts get rebuilt here as emissive edge geometry.
- **Phase N — Broadcast into production.** The bright-pass bleed promoted
  from the style lab into `material-pass.js` as the compositor under M;
  colour-grammar gate under banding; REDUCED FLASH controls the glow radius;
  one measured frame budget on the slowest device.

## Pass 3 — competition — HELD until released by a human

- **Phase O — boards.** Supabase; DAILY (NORMAL only), ENDLESS per
  difficulty, PERFECT (longest clean chain). One network module, and
  `audit:network` learns to allow exactly its endpoints.
- **Phase P — population word danger** from board submissions, filling the
  open half of `words/danger.js`.

## Pass 4 — premium finish

- **Phase Q — title, results, motion.** Title in the Editorial World; results
  with a grade-free stat bar and a score that counts up on the beat clock;
  no hard cuts between title → run → results.
- **Phase R — onboarding, performance, devices.** Left zone + compression
  hold join the action-gated lesson set; 120 Hz render interpolation
  measured on the device matrix; input parity and caching notes.
- **Phase S — package.** Trademark confirmation (human) before any store
  listing; share cards render the flow band; icons regenerated; PWA and
  Playables audits green; accessibility verified on the final build; 1.0
  entry in RELEASE.md and this file empty.

## Standing constraints

Nothing on this list may touch word-plate legibility (270×68 px at 62 m/s,
the 1.15 s / 0.75 s window floors, the 96° FOV clamp, `ARM_DISTANCE_M = 55`),
the **four-name cap** — the Redline, RUN OVER, FINISH, DAILY RUN — or the
gentle-failure design. `tools/corruption-gates.mjs` enforces the cap and
fails the build on a fifth name-shaped label or on any retired name
reappearing. General-audience framing is a hard platform-eligibility
requirement, machine-checked by `npm run gate:family`. Zero external network
calls at play time until Pass 3 lands, and then only through its own audited
module. Every number in TUNING.js has a table behind it: a calibrated dial
cannot move without `npm run calibrate` regenerating that table.
