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

Closed by the Phase K decision (2026-09-02): the look stays as shipped.
The Editorial World and its route grammar (Phases L and M) are not being
built; the stills and the decision live in `dev/stills/`. Phase N shipped
reshaped — the style lab's Broadcast treatment as an opt-in LOOK toggle
on the settings surface, never the default (see RELEASE.md).

## Pass 3 — competition — HELD until released by a human

- **Phase O — boards.** Supabase; DAILY (NORMAL only), ENDLESS per
  difficulty, PERFECT (longest clean chain). One network module, and
  `audit:network` learns to allow exactly its endpoints.
- **Phase P — population word danger** from board submissions, filling the
  open half of `words/danger.js`.

## Pass 4 — premium finish

- **Phase S remainder — [MP] the trademark, then 1.0.** Everything
  package-shaped that could ship without a human has (RELEASE.md): the
  share card carries the flow band, the Playables size and network audits
  are green, accessibility and the screen-reader labels are verified on
  the final build, and the icons already carry the final wordmark identity
  (gated in `gate:v1`). What remains needs Michael: the trademark result
  on DICTION DASH before any store listing (the Phase 12 rename path is
  the template if it changes), and the 1.0 close-out — which also waits
  on the Pass 3 decision (build the boards, or ship 1.0 without them).

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
