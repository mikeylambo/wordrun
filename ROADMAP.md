# DICTION DASH — roadmap

The backlog, in rough priority order. Shipped work moves to RELEASE.md;
this file only holds what is NOT built yet.

## Build next

1. **DESCENT/ski residue removal + GOLD/VIOLET color-grammar fix.** Two
   fast, low-risk corrections bundled because both are the kind of thing
   that reads badly fast if anyone outside the studio opens the build
   during a platform review. Retire the "HOW TO SKI" copy and its
   `descent:show-how` event; rename the remaining `__DESCENT_*` globals;
   replace `wind_alpine_bed` and any ski-named loops with page/ink-textured
   atmosphere. Same pass: the Phase 14 shop's GOLD (`0xffd75e`) and VIOLET
   (`0xb387ff`) skins collide with the streak-burst escalation colors
   (`0xffd977` / `0xb18cff`) that are supposed to be an exclusive "you're
   at peak flow" signal — a player wearing GOLD looks perpetually
   mid-streak. Shift both hues in `TUNING.js`; no architecture change, and
   red already got this protection via the Redline gate, gold and violet
   didn't.

2. **Make the dash the headline mechanic.** The mechanic already exists —
   the "GO" button is a hold-to-burn Overdrive burst — but `TUNING.js`
   carries its own comment admitting some players "never see a cliff or
   learn Overdrive exists." Rename GO to DASH everywhere player-facing
   (button, aria-labels, onboarding, HUD), make the charged-and-ready
   state read louder than the current conic-fill, land a signature
   camera/audio spike the instant it fires (FOV_BOOST already exists —
   pair it with a dash-specific sound and a speed-line burst instead of a
   reused effect), and give it its own dedicated teaching beat rather than
   one line among five in the rules card.

3. **Word bank growth — tier 3/4, not uniform.** The escalation cadence
   means NORMAL and HARD spend nearly all of a long run parked in tier 4
   (NORMAL caps there by 2,800 m, HARD by 1,500 m); a single full 30 km
   finish draws roughly 210 real words from tier 4's pool of 458 — about
   45% of the entire tier in one run. Two runs and a dedicated player has
   effectively seen all of it, which defeats the coprime-walk system built
   to prevent exactly that. Tier 2, by comparison (EASY's plateau tier),
   only gives up about 25% of its pool per full run — that's the healthier
   ratio to match. Grow tier 4 roughly 4× (458 → ~1,800–2,000) and tier 3
   about 1.5× (652 → ~1,000); tiers 0–1 are seen only in the first
   700–1,100 m of every run regardless of difficulty and don't need more.
   Net bank target: ~5,000–5,300 words, up from 3,073. Regenerate the
   fake-collision guard after this lands — `node tools/build-guard.mjs` —
   the current `guard.js` was built against the pre-growth bank and won't
   cover collisions from the new tier 3/4 words.

4. **PUBLISHED celebration + definitions on the recap.** The 30 km finish
   moment is currently two gray buttons — it deserves a payoff scene. And
   the recap can teach harder: "here's what the word you missed *means*"
   (definitions data for most of the curated bank exists in the studio's
   earlier word-game assets) completes the literacy loop, and nothing in
   the genre does it.

5. **Leaderboard.** Clone the daily-board pattern from the studio's
   earlier brain-training game (Supabase, daily seed, display names).
   **Blocked on a policy ruling first:** should daily goals and boards
   require NORMAL difficulty, or stay per-variant? Today goals can be
   cleared on EASY. The same ruling should decide whether continued runs
   (Phase 14's priced continue) are board-eligible — the shipped local
   rule is that they are not: a continue never sets BEST TODAY and never
   saves a ghost.

6. **120 fps / WebGPU showcase pass.** Real work, but it is
   courting-featuring work — it earns most after there is a public link
   worth featuring. Pairs with the input-parity and aggressive-caching
   notes from the platform-fit review.

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
