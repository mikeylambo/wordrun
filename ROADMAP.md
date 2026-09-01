# DICTION DASH — roadmap

The backlog, in rough priority order. Shipped work moves to RELEASE.md; this
file only holds what is NOT built yet.

## Build next

1. **Leaderboard** — promoted to top priority. For the platform's current #1
   running game (Speed Stars), the leaderboard is the stated retention engine,
   not cosmetics — "climb the global leaderboard" is the whole pitch. Clone the
   daily-board pattern from the studio's earlier brain-training game (Supabase,
   daily seed, display names). Policy ruling now settled: boards are
   per-difficulty-variant (separate EASY / NORMAL / HARD); daily goals clear on
   any difficulty; continued runs stay board-ineligible, matching the shipped
   local rule (a continue never sets BEST TODAY and never saves a ghost). What
   remains is the build itself, behind its own network audit.

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
- **Trademark search result on "Diction Dash"** — repo rename and any store
  listing wait on it.
- **YouTube Playables application** — the build is audit-green
  (`npm run audit:size` / `audit:network`), nothing left to prepare on the
  repo side.
- **Real music stems** — the engine is live; drop four loops into
  `public/audio/stems/` (contract in that folder's README), then raise
  `TUNING.AUDIO.MUSIC_MAX` and balance against the SFX mix.

## Filed for the visual pass (deliberately last)

Confirmed direction: **broadcast** — the bright-pass bleed treatment, reachable
now at `?dev=1`. It is the extreme-contrast reading the reference calls for and
it gets there without touching hue grammar or the word plates. Held until the
gameplay systems are settled.

- **The verge posts float.** They are placed along the ribbon edge but meet
  nothing — no footing, no shadow contact, no run of rail between them, so at
  speed they read as a row of loose marks rather than as structure. Options, in
  rising cost: a contact shadow and a short base where each post meets the
  surface; a thin rail threaded through them so they become one object; or
  replacing them entirely with emissive edge geometry that belongs to the
  ribbon. The third is the one that suits the confirmed treatment.
- **Route shape.** The ribbon winds, but gently and on one plane. The reference
  the direction is drawn from banks, climbs, falls and inverts, and its route
  is the memorable thing about it. This is a terrain-generation change rather
  than a material one, it interacts with the camera rig and with plate
  legibility on a bank, and it wants its own brief. Not a palette job.

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
