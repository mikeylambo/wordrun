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

Phase L (L1–L3) is BUILT — route grammar: climbs, descents, banks and
crests as a seeded walk, gameplay byte-identical, every reading number
measured and gated (`tools/route-gates.mjs`; RELEASE.md). Phase N shipped
reshaped — the Broadcast treatment as an opt-in LOOK toggle. The K stills
were re-shot on the routed geometry with the page riding the surface,
because the first set tested bars beside a flat road and could not carry
the decision it was asked to carry.

The look pick landed (2026-09-02, from the re-shot stills): the
Editorial World. Phase M is BUILT — the page as production geometry,
five chain bands with single-layer loss, the Redline as an editorial
correction, all gated (`tools/editorial-gates.mjs`; RELEASE.md).

Phases L5+ (phrase grammar + the authored DAILY), L4 (drop, tunnel,
canyon, narrows), E2 (punctuation beats), E3 (the runner's states) and
E4 (the standout line) are ALL BUILT — see RELEASE.md. So are the
playtest-directed follow-ups: N1 (the answer buffer + stronger tells),
Phase V (landmark staging, travelling page colour, the bell's hue fixed
by the live reserved-hue check), N3 (the runner's letterform
silhouette) and N4 (the authored launch and the FINISH arrival).

What remains in this pass is EXPERIENTIAL TRUTH-TESTING, not systems:
real-phone playtests of the answer buffer's feel, the landmarks in
motion, the new silhouette at speed, and the launch beat — plus a
device soak before the release candidate. If a playtest still says
"it needs more", the location of that feeling (opening, mid-run,
high-flow, danger, DAILY finale, results) decides the next pass; no
new foundational system is currently planned.

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
