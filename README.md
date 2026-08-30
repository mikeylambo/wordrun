# DICTION DASH — frame-based vertical slice

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

## The four names (a ceiling, not a starting point)

Exactly four invented names exist in the whole game, machine-enforced by
the gate suite: **the Redline** (the antagonist), **CROSSED OUT** (death),
**PUBLISHED** (the 30 km finish), and **TODAY'S DRAFT** (the daily seed).
There were five until Phase 20, when the Caret — a second pursuer that had
been unreachable since Phase 7 deleted the counter it armed from — was
removed rather than repaired. The mood arc underneath — twenty-one palette
bands with their own hues and blend math — is deliberately unnamed: plain
ids, no zone titles, no transition cards. The gates fail the build if a
retired stage name reappears anywhere or if a fifth name-shaped label
lands in player-facing copy. Words rush at
you; read them right or **the Redline** — a red editing-pen — closes in
behind you, eating the frame edge by edge until it crosses you out.

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

## Modes (Phase 10)

Two rule sets × three reading difficulties, chosen on the title and stored
per combination (an EASY best can never claim the STANDARD board; the
default combo keeps every pre-mode best and ghost):

- **ENDLESS** — the game as it grew up: five bells repair a heart.
- **STANDARD · 3 HITS** — the repair is off. Three tapped fakes, ever.
- **EASY / NORMAL / HARD** — reading difficulty (which tiers feed the
  gates and how fast they ramp) plus the Redline's pace (24 / 27 / 30).
  The speed curve itself never changes — one system, shared. HARD skips
  the warm-up tier; EASY caps at 7-letter words and a lazier pursuer.
  This is also the honest replacement for the frame's new-player grace,
  which the Phase 7 pure-differential rewrite had left as a dead knob:
  easing is a visible choice now, not a hidden fading curve.

## How it plays now (Phase 7)

- The track is **flat and winding** — Sonic-tradition S-curves authored into
  a seeded centerline. The runner auto-follows the line; the one thumb never
  steers, it only judges words.
- **Speed is your reading, on a diminishing-returns curve (Phase 8).** A
  correct read closes a fixed fraction of the headroom left below the
  ceiling — big gains when slow, vanishing gains up high — so the ceiling
  is an asymptote a sustained streak approaches (~24 clean reads to 90% at
  the shipped 64 m/s), never a wall ten reads slam into. A wrong read
  subtracts a flat `SPEED_LOSS` (worth MORE reads to win back the faster
  you are). Only tapping a fake costs a heart.
- **The Redline runs at one steady pace.** The gap is the clamped integral
  of your speed minus that pace — no hunt states, no pressure, no lunges.
  Read above pace and you pull away; sink below it and it gains at exactly
  the rate you're slow. `TUNING.RUN` is the whole difficulty surface.
- **The DASH** spends banked meter for real speed — which means real gap,
  at exactly the extra metres per second it buys. Clean reads charge it.
  Phase 16 made it legible: it is named DASH on every surface, its charged
  state is loud rather than dim, and firing it lands as one event across
  its own sound, a camera punch and a burst of speed lines. The teaching
  beat holds while the meter is charged and retires for good the first
  time it is used.

## What the measurements decided

- **Reading window is asserted, not hoped for — on a two-tier standard
  (Phase 8).** The window is `ARM_DISTANCE_M / speed`. The comfort floor
  (1.15 s) is gated at *cruise* — the speed eight clean reads reach, where
  the game is actually played — and a hard floor (0.75 s) is gated at the
  asymptotic ceiling itself. The ceiling value (shipped 64 m/s, up from
  40) is deliberately past the comfortable line and gets walked back by
  feel: `npm run calibrate:speed` prints the window table at candidate
  ceilings so the fun-vs-legible line is picked from play, not spec.
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
- **The color grammar is machine-enforced (Phase 9).** Every channel owns
  one meaning: red = the Redline alone; cyan→white heat = your speed;
  world SATURATION/brilliance = your chain (one pure curve,
  `src/render/flow-curve.js` — the reward-side mirror of the corruption
  curve), pulsing marquee-style near peak flow but bounded so the plate
  always wins the frame; and LOSS = darkness — a tapped fake drains
  light and treble from the world for a beat (no white crash-flash, no
  red spent on mistakes). The correct-read chime climbs a pentatonic
  ladder with the chain; losing the chain audibly resets it.
- **Bells are ambient reward, and they gate-provably get collected (Phase
  8).** The audit found strings still laid in the source frame's straight
  coordinates — functionally uncollectible against the ±15.5 m winding
  line. They now ride the travel line with a bounded weave (every bell
  gated inside the pickup window), and each one drips boost meter, counts
  the five-bell heart repair, and banks ◆ — the bare-number spendable
  balance (deliberately unnamed; sinks come later).

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

### Challenge links (Phase 14)

Because everything flows from the seed, a run compresses to a URL:
`?draft=<seed>&mode=…&diff=…&salt=…&goal=…` pins the track, the rules,
the exact word lane and the distance to beat. The death card's CHALLENGE
LINK button copies the run you just finished; whoever opens it gets a
CHALLENGE title, locked rule chips, the same gauntlet on every attempt,
and a TARGET verdict on their card. Pure module (`src/meta/challenge.js`),
no server, no network call — the link IS the data. Challenge visits keep
their own seed-scoped bests and ghosts; daily goals and the streak stay
on the real calendar day.

### The ◆ economy (Phase 14)

Bells feed the balance; two sinks finally spend it:

- **The priced continue** — death first offers a short window to buy the
  run back (hearts refilled, the Redline pushed out to its starting gap),
  cost doubling with each continue in the same run. A continued run keeps
  its distance, bells and goal credit but **never sets BEST TODAY and
  never saves a ghost** — the boards stay unassisted, which matters once
  a run can be a challenge someone else must chase.
- **Runner-light palettes** — the ◆ button on the title opens the shop:
  five palettes tinting the halo, ground pool, comet tail and track trail
  (the core stays white so the figure always reads). Cosmetic only, and
  the rule is now explicit: a skin may never wear a colour the game uses
  to MEAN something. `TUNING.META.RESERVED_HUES` lists every semantic hue
  — the danger accent in each colour-vision mode, both earned
  streak-burst escalation tiers — and the gate suite fails any palette
  within 25° of one. Phase 15 moved three skins that broke it.

## The word-list module (reusable piece)

`src/words/wordlist.js` is a standalone service — zero runtime dependencies,
no runner imports — built to be lifted into the next word game unchanged.
Every word is hand-curated — Phase 13 grew the bank 563 → ~3,070 by
authoring, not harvesting (a catalog import was tried in Phase 9 and
deliberately removed; every addition since is picked for the
reading-at-speed verb and dictionary-validated before shipping).
Phase 17's intake ran four filters past that: a plain inflection of a word
already in the bank is not a new word to read and is dropped; so is a
non-primary spelling variant, because a spelling game cannot be casually
bilingual; and so is anything in the wrong register — a gate must ask
"is that spelled right?", never "have you met this word?":

- 5 difficulty tiers (339 / 787 / 837 / 1,300 / 2,022), from short
  high-frequency up to the classic trap spellings. Phase 17 grew the top
  two deliberately unevenly: measuring a full 30 km run showed NORMAL and
  HARD parked in tier 4 for nearly the whole distance, eating **48% and
  50% of that tier every single run** — two runs and a dedicated player
  had seen all of it, which defeats the no-repeat walk built to prevent
  exactly that. Tier 4 is now 2,022 words and a full run takes 11% of it;
  tiers 0–1 are behind you inside the first kilometre whatever difficulty
  you pick, so they were left alone. The gate suite now holds the ratio,
  not a raw word count.
- An EXTENDED fake-guard (guard data, never playable): the *complete*
  one-edit collision set — every string the fake generator's mutation
  classes can produce from any bank word that is also a real English
  word (~9,000, computed against a 275k-word dictionary by
  `node tools/build-guard.mjs`; rerun after any bank change). A fake
  can therefore never land on a real word the bank doesn't ship
  ('gray' -> 'grey', 'sage' -> 'sago' class, closed and gated).
- **No repeats**: each tier is drawn as a seeded coprime walk through the
  whole pool, so a word cannot recur until the entire tier has been seen
  (940–2,200 words — longer than any run's stay in a tier). Gated.
- **Fresh words each attempt**: the daily seed still authors the track,
  the bells and the real/fake coin — the shared racing line — but the
  word lane is salted by the attempt number, so run two of TODAY'S DRAFT
  reads new vocabulary on the same road. Salt 0 is the identity (gated).
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
