# DICTION DASH — handoff (2026-10-09)

Branch: `claude/game-improvement-ideas-udtonm` (pushed). Read `CLAUDE.md` first:
gates are re-run, not assumed (`git config core.hooksPath .githooks`, then
`npm run gates` must be the last thing before every commit; also run
`npm run gate:v1`). Browser smoke: `npm run build && PLAYWRIGHT_CORE=<path> CHROME=/opt/pw-browsers/chromium npm run smoke`
(playwright-core is not a repo dep — `npm i playwright-core` in a scratch dir).

## Shipped this session (RC13.4 → RC14.4)
- **Arcade in-run:** rolling score + pops, PERFECT hit-stop, 3·2·1·GO on the
  launch storm, plate stamp (right) / shatter (wrong, holds the true spelling
  0.5 s first), domed touch buttons, lamp hearts, DAILY progress strip,
  press tell (edge light bar on the pressed side).
- **Cabinet:** results tally (READS/PERFECT/CHAIN) + rank letter S/A/B/C,
  initials + local top-10 (meta/hiscore.js, board-policy keys), attract cycle
  (HIGH SCORES / HOW TO PLAY / PRESS START), CONTINUE? 9·8·7 count, coin-op
  chip sounds (synthesized).
- **Progression:** 19 medals (meta/medals.js) + PROFILE wall; earned runner
  lights WHITE-HOT (RANK S) / CHROME (7-day streak); cyan streak flame.
  Fixed: runner lights now tint the 3D body.
- **Runner glow tiers:** BASE / BUILDING (chain 10) / HIGH FLOW (50) / DASH,
  explicit steps + aura sprite (TUNING.JUDGE.GLOW_TIERS).
- **City:** curtain-wall tower shader, sky dome with horizon haze, searchlight
  beams (render/skyline.js). Bloom pass was built then REMOVED (bad on iPhone).
- **Wet road:** grazing sheen in the road shader (render/material-pass.js,
  TUNING.WET.SHEEN). The neon streaks were cut after the iPhone look — they
  obscured the real reflection (below).
- **Bells cut.** ◆ = 1 per correct read + chain-milestone bonus (meta/currency.js).
- **Playtest 10/8 fixes:** ×N residue, title music on first gesture, attract
  runner on road, taglines/caption/side art removed, one type system (3
  weights, 4 tracking steps — gated), tabbed SETTINGS.
- **Tech:** definitions chunk lazy (main 781→471 kB), vite 7, 0 audit vulns,
  main.js fold into `src/app/` (dev-hooks, continue-offer, run-ledger,
  sim-events, run-rewards, input-routing). Gates read `tools/lib/app-source.mjs`.

- **Wet mirror (RC14.5):** the mockup's look in-engine — render/road-reflection.js.
  Scene drawn once to screen, frame copied, one pass mirrors the skyline onto
  the road (stretched, blurred, highlight knee, screen blend). Road writes its
  mask into alpha (material-pass.js, `WET_MASK`); plate boxes are zeroed and
  never sampled; off under BROADCAST; governor drops it first; REDUCED FLASH
  stills the ripple. Gated in v1-polish-gates. Dial: TUNING.WET.REFLECT 0.55,
  REFLECT_STRETCH 0.4, REFLECT_SPREAD 0.06. `window.__STAGE` added (dev hook).

- **CITY STREETS (RC14.7):** render/street.js — gappy lit-facade blocks
  3.5–10 m off the rails (one instanced draw, windows in-shader), dark wet
  pavement either side (faint share of the wet mirror), street lamps + light
  pools every 14 m (they take over the pylons' speed cue). Under it the
  editorial page drops its flat void marks but keeps canyon walls, tunnel
  arches, narrows fence, brackets and the Redline bars. Settings → VISUAL →
  STREETS ON/OFF (persisted, default ON; OFF = the old void). Dials: STREET
  in street.js. Gated in v1-polish-gates.

- **RC14.8 — street pass 2 + prototypes:** lamps sparing (one per 46 m,
  alternating kerbs). Leftover "floating dashes" were the dataworld line-art
  pass outlining the street pavement + skyline (it also darkened the
  pavement) — groups now opt out via `userData.dataworldSkip`. Runner's solid
  trails (ground line + comet tail) replaced by a particle WAKE (actors.js,
  160-spark pool, fogged, denser with speed/rung/DASH). PROTOTYPES in
  render/screen-fx.js, one pass over the finished frame: SPEED BLUR (radial,
  edges only, >55% speed + DASH) and HORIZON LIGHT (swell at every 25-chain,
  DASH start, each km). Both plate-guarded, REDUCED FLASH halved, own
  switches in Settings → VISUAL (default ON while being judged). Shared
  helpers `screenHorizon` / `plateGuards` live in road-reflection.js.

- **RC14.9 — playtest fixes:** 'arp' (and ~40 modern words ENABLE lacks)
  added to MODERN_GUARD in wordlist.js so they can never be shown as fakes.
  Wet mirror now RECOVERS after the governor drops it (it used to stay off
  for the session — e.g. after the app returned from background). Held
  answer lights the whole plate inset rule (the half-width bar on the
  pressed side read as the line being cut in half). Title REMATCH line
  removed. BROADCAST look and the LOOK/STANDARD row deleted. PROFILE tidied:
  BEST / BANK stat tiles, 4-across medal coins, compact goals.

## Open / next
0. **Judge the prototypes on device** — SPEED BLUR / HORIZON LIGHT: keep,
   tune (SCREEN_FX in screen-fx.js) or cut. Owner idea: a city → void
   progression (streets thinning into the void with distance, maybe a
   settings loop); the late-run whiteout (endgame-sky.js `lateWeather`,
   21–23 km) and false dawn are still in.
0b. **CITY STREETS on device** — compare ON/OFF; check fps, the plate against
   far facades on straights, and tunnels/canyons (buildings step aside).
1. **Wet road on a real iPhone** — tune `TUNING.WET.REFLECT/STRETCH` with
   `SHEEN`. Neon streaks CUT (10/9: they hid the reflection). Headless only shows the opening bend, where the towers sit
   left of the road, so the mirror reads subtly there; judge it on device,
   on a straight with towers ahead. Also confirm fps (governor may drop it).
2. **Speed blur at screen edges** and **horizon light at moments in a run**
   — owner wants to see them live (prototype; never touch the word plate).
3. Distant second skyline — rejected ("looks cheap").
4. Skyline identity beyond "generic" (typographic city / item 26 mockup).
5. Revisit list from the roadmap: 5 (arcade key caps), 13 (km call-outs),
   26 (world changes with distance — needs mockup), 17 (announcer — owner VOs).
6. Phase 5: 34 leaderboards (needs a post-run network carve-out from the
   zero-network rule) + trademark search; 35 store assets (from attract loop).
7. Real-phone perf check (headless swiftshader ≈ 11 fps, not representative).

## Constraints to remember
Four-name cap (the Redline, RUN OVER, FINISH, DAILY RUN); plate legibility
outranks every visual change; reserved hues (no gold/violet/orange/red for
new colours — TUNING.META.RESERVED_HUES); zero network at play time; no
runtime patching (reachability gate); REDUCED FLASH paths for any new motion.
