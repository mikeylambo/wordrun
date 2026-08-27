# WORD RUN — frame-based vertical slice

**Source frame:** DESCENT (Three.js one-thumb portrait runner, v1.0.0, feature-frozen).
**Deltas:** the dodge-obstacle verb is swapped for a word-recognition verb
(Phases 1–3), and the alpine world + physical pursuer are re-presented as a
neon data-stream chased by an ambient corruption (Phase 4). Everything
underneath — menus, endless-prestige loop, speed ramp, chase director,
hearts/bells, haptics, PWA, seeded runs — is the source frame as-is.

You run a glowing track through a dark stream. Words rush at you; read them
right or the corruption behind you closes in, static eating the frame edge
by edge until the signal dies.

```bash
npm install
npm run dev              # http://localhost:5178
npm run gates            # core frame + word-verb + corruption gates, headless
npm run gate:words       # the word module + verb suite alone
npm run gate:corruption  # the pressure-presentation suite alone
npm run gate:v1          # release/polish/PWA gates
```

---

## The falsifiable question

> Can a word-recognition verb (spot/select the correct word before it reaches
> you) sustain the same moment-to-moment tension and pace that DESCENT's
> obstacle-dodge verb does — at runner speed, one thumb, portrait?

The slice answers it with the cheapest honest presentation: **single-word
confirm**. One word rushes at you on a billboarded plate. Tap anywhere (or the
REAL button, or SPACE) to declare "that spelling is real". Let it pass to
declare it fake.

| read | action | outcome |
| --- | --- | --- |
| real word | tap | clean gate — speed bonus, chain link, boost fill |
| fake word | pass | clean gate — a right read is a right read |
| fake word | tap | the DESCENT hit: integrity heart, stagger, speed, chain, pursuit pressure |
| real word | pass | same hit — no pick is a pick |

Spamming confirm buys nothing: the real/fake mix is a seeded coin, so
"always tap" fails half the gates.

## What the measurements decided

- **Reading window is asserted, not hoped for.** The window is
  `ARM_DISTANCE_M / speed`. The gates fail the build if it drops below
  1.15 s at the shipped flat-out top speed, or below 0.9 s in Overdrive.
- **A good reader must not outrun the game.** DESCENT capped slalom speed
  bonuses at 40 m/s, but its trees kept real speed far lower; the v1 hunt is
  a physical race at 31–38 m/s, so a 40 m/s word bonus made a clean reader
  untouchable forever. Word bonuses cap at **37 m/s** — below peak pursuit.
- **The danger reads without a creature.** Phase 4 removed the pursuer model
  and re-presents the same gap value as ambient corruption: a red-shot
  static tear at the pursuer's exact position (same side offset, same lunge
  tell, same kill framing), a track-wide static field advancing behind it,
  a continuous screen veil, and a static audio bed — all driven by ONE pure
  gap→intensity curve (`src/render/corruption-curve.js`). The gate suite
  replays the scripted wrong-read scenario and asserts the visible
  escalation tracks the gap closure step for step.
- **One wrong read must visibly matter.** Wrong reads are rarer than
  DESCENT's obstacle clips, so each carries `WRONG_PRESSURE` (2.0) — above
  the chase director's hunt-provoke threshold. The gate scripts an actual
  wrong read during a stalk and requires the gap to close ≥ 8 m within 2 s.
- **Courage still pays.** Boost fill from correct reads is multiplied by the
  frame's beast-proximity multiplier, exactly as clean landings were.

## The word-list module (reusable piece)

`src/words/wordlist.js` is a standalone service — zero imports, no Barsmith,
no runner dependencies — built to be lifted into the word-tile game later:

- 5 difficulty tiers, ~560 words, mean length rising 3.0 → 9.1.
- `isValidWord()` with **zero false negatives** on the shipped list (gated).
- `makeFake()` builds one-edit misspellings (swap/double/drop/vowel) that are
  guaranteed to never be a shipped word *or* a common English word (a guard
  list absorbs accidents like "two"→"tow"), so a correct read is never
  punished by generator luck.
- Fully deterministic: every choice flows through a caller-supplied rng.

Words and fakes derive from the run seed through the terrain's own
`mixSeed`/`mulberry32` lanes — a seed's word gauntlet is as replayable as its
mountain, so DESCENT's ghost/daily-seed architecture carries into a future
daily-challenge mode unchanged.

## Centralized tuning

Everything about the verb lives in `TUNING.WORDS` (spawn spacing + per-1000 m
ramp with a floor, arm distance, tier curve, rewards, penalty weights,
legibility floor). The speed ramp itself is untouched DESCENT config: gates
are spaced in metres, so the shipped speed curve *is* the reading-difficulty
ramp — one system, shared.

## What was retuned vs the frame

- Random dodge features (trees, rocks, ice, moguls, cliffs, slalom gates)
  are zeroed in tuning. Authored landmarks and rc6 stunt beats stay.
- Jump is retired as a player verb; every tap-ish gesture funnels into the
  confirm edge. Second-finger GO needs a 250 ms hold so a quick tap answers
  the word instead of burning boost.
- Two inherited v1 drifts (Overdrive shove magnitudes, "nerve pays" economy)
  ship failing in DESCENT v1.0.0 itself; the suite guards them at shipped
  baselines and marks them KNOWN DRIFT. Making nerve genuinely pay again is
  the open economy question for the next pass.

## Gate status (this build)

- Core frame gates: **69 / 0**
- Word module + verb gates: **31 / 0**
- Corruption presentation gates: **14 / 0**
- V1 release / polish / PWA: **39 / 0, 48 / 0, 14 / 0**

## Acceptance gates from the brief

- [x] Word readable at target base speed — asserted at top speed, not tutorial speed
- [x] Validity checker: zero false negatives on the shipped list
- [x] Perf parity — word verb costs ~2 µs/step (frame budget gate)
- [x] Speed ramp + endless-prestige loop structurally identical minus the verb
- [x] Corruption escalation tracks the scripted gap closure (Phase 4 gate)
- [x] No beast/creature language in player-facing text (gated)
- [ ] Near-100% recognition **in human playtest** — needs thumbs on glass
- [ ] Danger legibility **in human playtest** — at a glance mid-run, can you
  tell it is closing without reading a meter? Needs eyes, same caveat as
  word recognition above. (The machine half — escalation continuous, visible
  from mid-pressure, never blanks the screen — is gated.)

## Phase 4 open polish

- EndgameSky (the 12 km+ celestial finish) still runs its alpine light
  narrative over the dark stream; it reads as abstract void lights and the
  30 km finish machinery depends on it, so it stayed. Worth its own retheme
  pass later.
