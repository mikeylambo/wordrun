# DICTION DASH — roadmap

The backlog, in rough priority order. Shipped work moves to RELEASE.md;
this file only holds what is NOT built yet.

## Build next

1. **PUBLISHED celebration + definitions on the recap.** The 30 km finish
   moment is currently two gray buttons — it deserves a payoff scene. And
   the recap can teach harder: "here's what the word you missed *means*"
   (definitions data for most of the curated bank exists in the studio's
   earlier word-game assets) completes the literacy loop, and nothing in
   the genre does it.

2. **Leaderboard.** Clone the daily-board pattern from the studio's
   earlier brain-training game (Supabase, daily seed, display names).
   **Blocked on a policy ruling first:** should daily goals and boards
   require NORMAL difficulty, or stay per-variant? Today goals can be
   cleared on EASY. The same ruling should decide whether continued runs
   (Phase 14's priced continue) are board-eligible — the shipped local
   rule is that they are not: a continue never sets BEST TODAY and never
   saves a ghost.

3. **120 fps / WebGPU showcase pass.** Real work, but it is
   courting-featuring work — it earns most after there is a public link
   worth featuring. Pairs with the input-parity and aggressive-caching
   notes from the platform-fit review.

## Noted in passing, not yet scheduled

- **The Caret cannot appear.** One of the five approved names — the rare
  pale second pursuer the README describes cutting across the track — is
  structurally unreachable. It arms off `beast.hunts`, the Redline's hunt
  counter, and Phase 7's pure-differential rewrite deleted the hunt state
  machine: `hunts` is initialised to 0 and never incremented, so the arming
  check returns on its first line, every run. Five full 30 km runs
  (106,775 sim steps) produced zero appearances. Two honest options, and
  it is a design call: re-arm it on something that still exists (distance
  beats, or the gap crossing a threshold), or retire it and drop to four
  names. Until then the README promises a character the game cannot show.

## Waiting on a human

- **Calibration verdicts** — everything is wired, each is a one-line
  change once decided: the speed ceiling (64 shipped;
  `npm run calibrate:speed` prints the decision table), the drain's bite,
  HARD's pace-30 fairness, peak-flow intensity with and without REDUCED
  FLASH.
- **Trademark search result on "Diction Dash"** — repo rename and any
  store listing wait on it.
- **YouTube Playables application** — the build is audit-green
  (`npm run audit:size` / `audit:network`), nothing left to prepare on the
  repo side.
- **Real music stems** — the engine is live; drop four loops into
  `public/audio/stems/` (contract in that folder's README), then raise
  `TUNING.AUDIO.MUSIC_MAX` and balance against the SFX mix.

## Standing constraints

Nothing on this list may touch word-plate legibility, the five-name cap,
or the gentle-failure design. General-audience framing is a hard
platform-eligibility requirement. Zero external network calls at play time
until the leaderboard lands (and then only behind its own audit).
