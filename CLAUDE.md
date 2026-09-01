# Working in this repo

DICTION DASH — a deterministic word-gate runner. `src/sim/` is the headless,
deterministic game (no renderer/DOM imports); `src/render/`, `src/ui/`,
`src/audio/` present it; `src/meta/` and `src/words/` are liftable, standalone
subsystems. Two entry points, both loaded by `index.html`: `src/main.js`
(the game) and `src/v1-mobile-ui.js` (touch UI).

## Definition of done — gates are re-run, not assumed

**The full `npm run gates` output is the LAST thing that runs before every
commit, after every file including docs, with nothing edited after it.** If a
gate is red, the commit does not happen until it is green. A pre-commit hook
enforces this; activate it once per clone:

```
git config core.hooksPath .githooks
```

`npm run gates` runs the whole suite (gameplay, words, corruption/naming,
meta, family-safety, music, reachability, and the Phase 0 behaviour snapshot).
Do not append to a doc "after the last gate run" — that is exactly how a red
banned-vocabulary gate once shipped.

## One file per system — no runtime patching

Each system lives in one file you can find from the import graph. Do NOT add
behaviour by monkey-patching a live object at runtime (wrapping `sim.step`,
replacing `stage.render`, polling `window.__SIM` from a `requestAnimationFrame`
boot). That pattern is what Phase 0 removed: it hid whole systems (hearts, the
bell HUD) in a file named like scaffolding, loaded through a single
easy-to-miss side-effect import, drifted out of sync with the code it claimed
to describe, and made every session re-discover which file was real. The
`reachability-gate` fails the build on any `src/` file no entry point can
reach — dead code gets deleted, live code gets an explicit import.

## Standing constraints (build-enforced)

- **Four-name cap** — the Redline, RUN OVER, FINISH, DAILY RUN. No fifth
  name-shaped player-facing label. `tools/corruption-gates.mjs` fails on a
  violation.
- **Word-plate legibility outranks every other visual/audio change.**
- **General-audience framing** — `npm run gate:family` stays green.
- **Zero external network calls at play time** — `npm run audit:network`.
- **`ARM_DISTANCE_M` may not grow**, and reserved hues (`TUNING.META.RESERVED_HUES`)
  are checked before any new colour is chosen, not after.
