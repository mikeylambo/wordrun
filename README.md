# WORD RUN — frame-based vertical slice

**Source frame:** DESCENT (Three.js one-thumb portrait runner, v1.0.0, feature-frozen).
**Deltas:** the dodge-obstacle verb is swapped for a word-recognition verb
(Phases 1–3), the world and pursuer are re-presented as a neon manuscript
chased by an ambient editor (Phases 4–5), and Phase 7 replaces the ground
itself: a flat, winding, auto-followed track instead of the downhill, and
speed as a direct consequence of reading instead of a distance ramp — with
the Redline's gap reduced to a pure speed differential. Menus,
endless-prestige loop, hearts/bells, haptics, PWA and seeded runs remain
the source frame as-is.

You are a running figure of light sprinting down an unfinished draft — a
low-poly human of glow, arms pumping, stride lengthening as your reading
earns speed. It still pulses like a text caret: calm at distance, frantic
when the Redline closes, drawing an ink stroke down the page as it runs.

## The five names (a ceiling, not a starting point)

Exactly five invented names exist in the whole game, machine-enforced by
the gate suite: **the Redline** and **the Caret** (the antagonists),
**REDACTED** (death), **PUBLISHED** (the 30 km finish), and **TODAY'S
DRAFT** (the daily seed). The mood arc underneath — twenty-one palette
bands with their own hues and blend math — is deliberately unnamed: plain
ids, no zone titles, no transition cards. The gates fail the build if a
retired stage name reappears anywhere or if a sixth name-shaped label
lands in player-facing copy. Words rush at
you; read them right or **the Redline** — a red editing-pen — closes in
behind you, eating the frame edge by edge until you are REDACTED. Its rare
pale companion, **the Caret**, cuts across the track on its own authored
beats.

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
| fake word | tap | the DESCENT hit: a heart, stagger, speed loss, chain, half meter |
| real word | pass | a slip, not a crash: speed loss and the chain — **no heart** |

The asymmetry is the rulebook (and it is gated): hearts are only ever spent
by *acting* wrongly — tapping a fake. Letting a real word slip past just
slows you down, and slow is the Redline's department: sink under its pace
and the gap closes at exactly the rate you're slow. Game over is always one
of two legible stories — you tapped fakes until your hearts ran out, or you
read too slowly and the Redline ran you down. Speeding past a word you didn't
have time to read can cost you the run, but never a heart.

Spamming confirm buys nothing: the real/fake mix is a seeded coin, so
"always tap" fails half the gates.

## How it plays now (Phase 7)

- The track is **flat and winding** — Sonic-tradition S-curves authored into
  a seeded centerline. The runner auto-follows the line; the one thumb never
  steers, it only judges words.
- **Speed is your reading.** A correct read adds `SPEED_GAIN`, a wrong read
  subtracts `SPEED_LOSS` and costs a heart. Floor and ceiling bound it, and
  both bounds are gated against the reading-window legibility standard.
- **The Redline runs at one steady pace.** The gap is the clamped integral
  of your speed minus that pace — no hunt states, no pressure, no lunges.
  Read above pace and you pull away; sink below it and it gains at exactly
  the rate you're slow. `TUNING.RUN` is the whole difficulty surface.
- Overdrive still spends banked meter for real speed — which now means real
  gap, at exactly the extra metres per second it buys.

## What the measurements decided

- **Reading window is asserted, not hoped for.** The window is
  `ARM_DISTANCE_M / speed`. The gates fail the build if it drops below
  1.15 s at the shipped flat-out top speed, or below 0.9 s in Overdrive.
- **A good reader must not outrun legibility.** The speed ceiling (40 m/s)
  is set by the reading window, not by a pursuer: 55 m of arm distance at
  the ceiling is 1.38 s plain and ~1 s in Overdrive, both gated.
- **The danger reads without a pursuer model.** Phase 4 removed it
  and re-presents the same gap value as the Redline: a red-shot strike-mark
  at the pursuer's exact position (same side offset, same lunge tell, same
  kill framing), a track-wide noise front advancing behind it, a continuous
  screen veil, and a matching audio bed — all driven by ONE pure
  gap→intensity curve (`src/render/corruption-curve.js`). The gate suite
  replays the scripted wrong-read scenario and asserts the visible
  escalation tracks the gap closure step for step.
- **One wrong read must visibly matter.** The gate scripts a missed word at
  neutral pace and requires the gap to close ≥ 8 m within 2 s — reached now
  purely through the speed the miss cost, with the corruption escalating in
  step every sampled frame.
- **Courage still pays.** Boost fill from correct reads is multiplied by the
  frame's proximity multiplier — reading well with the Redline in range banks
  more, exactly as clean landings did.

## The meta layer (SLU shell port)

`src/meta/` ports the SLU Web Shell's Layer-1 managers into this codebase's
zero-dependency house style, wired to the run and machine-gated
(`tools/meta-gates.mjs`):

- **StatsManager** (shell `game/StatsManager.ts` contract): a lifetime
  ledger over a pluggable storage adapter — runs, metres, reads, accuracy,
  best chain — surfaced as one line on the results card. The adapter seam
  is the shell's: tools inject memory, a networked save swaps in later.
- **DailyManager** (shell Quest/Challenge design, adapted): three DAILY
  GOALS derived deterministically from the day's seed — no authoring
  backlog, same card for everyone — plus a consecutive-day play streak.
  Goals completed by any run stick for the day; the title shows the card
  and the streak; a missed calendar day resets it.
- **The learning recap** (the genre's gentle-failure lesson): the sim keeps
  a capped ledger of this run's wrong reads, and the results card teaches
  each one — a tapped fake shows its true spelling struck against the
  misspelling; a slipped real word is named, not scolded. Porting this
  surfaced a real bug: the gate's `answer` field was `null` exactly for
  fakes, so the "here's the real spelling" feedback had never fired.

Shell systems deliberately NOT ported: renderer adapters, screen/focus
managers, save-slot architecture (the frame already ships equivalents),
and the genre modules with no verb here (garage, waves, inventory,
dialogue, multiplayer). The shell remains the starting frame for the NEXT
game; this port lifts its meta design, not its runtime.

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

## What was replaced vs the frame

- Phase 7 replaced the terrain system (flat winding track, no colliders, no
  grade, no authored ski-resort set pieces) and the pursuit computation
  (pure speed differential; the hunt/pressure director is deleted, not
  tuned down). The presentation layers above both were already decoupled
  and run unchanged.
- Jump and steering are retired as player verbs; every tap-ish gesture
  funnels into the confirm edge. Second-finger GO needs a 250 ms hold so a
  quick tap answers the word instead of burning boost.

## Gate status (this build)

- Core frame gates (track / speed / pursuit / ghosts / loop): **28 / 0**
- Word module + verb gates: **31 / 0**
- Redline presentation + identity + naming-cap + vibrancy gates: **27 / 0**
- V1 release / polish / PWA: **25 / 0, 48 / 0, 14 / 0**

## Acceptance gates from the brief

- [x] Word readable at target base speed — asserted at top speed, not tutorial speed
- [x] Validity checker: zero false negatives on the shipped list
- [x] Perf parity — word verb costs ~2 µs/step (frame budget gate)
- [x] Speed ramp + endless-prestige loop structurally identical minus the verb
- [x] Corruption escalation tracks the scripted gap closure (Phase 4 gate,
  re-proven on the Phase 7 differential source with its code untouched)
- [x] Speed deltas and heart costs are deterministic and unit-gated; floor
  and ceiling both hold against the legibility standard
- [x] Gap equals the clamped integral of (speed − pace), step for step —
  and the pursuit source is gated free of hunt/pressure machinery
- [x] Track curves traverse under the one-input scheme (auto-follow drift
  gated < 3 m at ceiling speed; no steering input exists)
- [x] Old vocabulary from earlier phases banned in player-facing text (gated)
- [x] Five-name ceiling machine-enforced: retired stage names banned
  everywhere; the band table carries no label but the finish's PUBLISHED;
  the transition announcer refuses unnamed bands
- [x] Red belongs to the Redline alone — world palette, payoff bursts and the
  cursor are gated red-free; the plate keeps its solid-glyph-core treatment
- [x] Max-intensity spot-check: a 10-streak burst firing with the Redline at
  13 m and its tell burning — the red bar still dominates, the burst stays
  cyan/violet/gold, the plate core stays solid (screenshot-verified)
- [ ] Near-100% recognition **in human playtest** — needs thumbs on glass
- [ ] Danger legibility **in human playtest** — at a glance mid-run, can you
  tell it is closing without reading a meter? Needs eyes, same caveat as
  word recognition above. (The machine half — escalation continuous, visible
  from mid-pressure, never blanks the screen — is gated.)

## Open polish

- EndgameSky (the 12 km+ celestial finish) still runs its alpine light
  narrative over the dark page; it reads as abstract lights and the 30 km
  finish machinery depends on it, so it stayed. Worth its own retheme pass
  later.
