# DICTION DASH — roadmap

The backlog, in rough priority order. Shipped work moves to RELEASE.md; this
file only holds what is NOT built yet.

## Build next

1. **Leaderboard** — promoted to top priority. For the platform's current #1
   running game (Speed Stars), the leaderboard is the stated retention engine,
   not cosmetics — "climb the global leaderboard" is the whole pitch. Clone the
   daily-board pattern from the studio's earlier brain-training game (Supabase,
   daily seed, display names). Still blocked on a policy ruling: should daily
   goals and boards require NORMAL difficulty, or stay per-variant? Today goals
   clear on EASY. The same ruling decides whether continued runs (Phase 14's
   priced continue) are board-eligible — the shipped local rule is that they
   are not: a continue never sets BEST TODAY and never saves a ghost. This
   ruling is now the single thing blocking the highest-leverage item on this
   list.

2. **120 fps / WebGPU showcase pass.** Real work, but it is courting-featuring
   work — it earns most after there is a public link worth featuring. Pairs
   with the input-parity and aggressive-caching notes from the platform-fit
   review.

3. **Cel-shading direction.** Four candidate treatments are built and shot
   (`dev/style-lab.js`, `?style=`): CEL, INK, BROADCAST, PRESS. Waiting on a
   direction call before any of it enters the production renderer, which also
   needs a colour-grammar gate under banding, a perf pass on the extra
   fullscreen pass, and a REDUCED FLASH interaction (the glow radius).

## Waiting on a human

- **Calibration verdicts** — everything is wired, each is a one-line change
  once decided: the speed ceiling (64 shipped; `npm run calibrate:speed`
  prints the decision table), the drain's bite, HARD's pace-30 fairness,
  peak-flow intensity with and without REDUCED FLASH. The stats export
  (Phase 21) is the path for getting real numbers off a player's device.
- **The DASH arming threshold.** `MIN_ACTIVATE` is 8 against a `METER_MAX`
  of 100, so the meter arms at 8% and is effectively always armed — the
  "DASH READY" moment is not a moment. Recommend ~30.
- **Trademark search result on "Diction Dash"** — repo rename and any store
  listing wait on it.
- **YouTube Playables application** — the build is audit-green
  (`npm run audit:size` / `audit:network`), nothing left to prepare on the
  repo side.
- **Real music stems** — the engine is live; drop four loops into
  `public/audio/stems/` (contract in that folder's README), then raise
  `TUNING.AUDIO.MUSIC_MAX` and balance against the SFX mix.

## Standing constraints

Nothing on this list may touch word-plate legibility, the **four-name cap**
— the Redline, RUN OVER, FINISH, DAILY RUN — or the gentle-failure
design. It was five until Phase 20, when the Caret was removed rather than
repaired; `tools/corruption-gates.mjs` enforces four and fails the build on a
fifth name-shaped label or on any retired name reappearing. General-audience
framing is a hard platform-eligibility requirement, machine-checked against
the bank and every reachable fake by `npm run gate:family`. Zero external
network calls at play time until the leaderboard lands (and then only behind
its own audit).
