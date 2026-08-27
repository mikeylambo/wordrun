# DESCENT — vertical slice

SkiFree × Temple Run × SSX. Three.js, web-first, portrait, one thumb.

```bash
npm install
npm run dev      # http://localhost:5178
npm run gates    # verify all four phase gates, headless
```

---

## What's new in the design pass

Six changes, in order of how much they matter.

**1. Overdrive physically shoves the beast back.** Boost used to reach the beast
through six links of causation, four of them invisible: land trick → meter →
speed → a 2.5s *smoothed average* → desired gap → the gap creeps open at 9 m/s.
Spending felt like nothing. Now it pushes the gap directly — outside the
desired-gap system, outside the rate limit. Measured: **+27m in one second, 3.0×
what not spending does**, with the fur visibly peeling off the screen edges. It
still can't breach the 80m ceiling, so it's an escape, not a cruise control.

**2. The courage bonus is visible.** Tricks landed within 30m of the beast were
already worth up to double; nothing on screen ever said so, and the scripted
drivers were averaging a 1.2× multiplier because nobody chases what they can't
see. There's now a live red readout while you're in the air inside its range,
and a distinct sound when the bank lands.

**3. Clean landings chain.** Up to **3.80× at the eight-link cap**. Threading a
gate extends it too, so a technical tree pitch isn't an automatic chain-killer.
Any clip or flub zeroes it — and the loss gets its own red readout and sound,
because losing a fat chain is what makes someone restart immediately.

**4. The mountain has a shape.** The descent is a sequence of 300m pitches with
real character: *the groomer* (1.75 trees/chunk), *the trees* (12.00), *the
cliff band* (all the cliffs), *the moguls*. The same pitch never runs twice in a
row. On top of that the grade itself now modulates between **9.9° and 22.8°**,
and steepness drives speed — **28 m/s on the shallowest, 39.8 m/s on the
steepest**. So there are pitches you fly and pitches you dread. The height field
is the exact closed-form integral of the grade, so the slope you see and the
speed you get can never disagree.

**5. The beast has one move you can learn.** It winds up for 0.55s — audibly and
visibly, haunches down — then strikes hard, then has to recover. **22 lunges over
five sim-minutes, zero without a tell.** The ambient pursuit still obeys the
rate limit; the lunge is the one sanctioned exception.

**6. The first minute forgives.** A struggling player used to die at 423m over
and over and never see a cliff. The beast now starts lazy and wakes up over 42s,
with a floor that can't be spiralled through — **2.72× further on a first run** —
and the grace fades out entirely by a player's fourth run of the day.

Plus: the kill frame is **keepable**. It's captured at the peak of the whip,
stamped with the distance and seed, and saved or shared with one tap.

### Two things the measurements changed my mind about

- **The approach to a cliff is now reserved, not just the landing.** A driver
  that detoured to cliffs was taking 5.1 hits a run against a survivor's 1.9,
  and losing 1100m for its trouble — because leaving the clean line meant
  crossing the trees flanking it. A cliff you can see has to be a cliff you can
  reach, or the brave line is punished twice.
- **Grace needed a floor, not a bonus.** The desired gap is derived from your
  speed, and a struggling player is slow *because* they keep getting hit — so
  mistakes compound into a doom spiral that a flat bonus can't arrest. A hard
  floor that fades on a curve took a first run from 1.11× to 2.72×.

---

## The falsifiable question

> Does the loop "tricks earn boost, boost outruns a visible persistent beast"
> produce more "one more run" pull than pure survival?

Everything below exists to make that question answerable by a playtester rather
than by an argument. The two behaviours to watch for are **≥3 voluntary
restarts in a session** and **players deliberately taking air lines to bank
boost** rather than only dodging.

The build is deliberately shaped so that second behaviour is a *choice*: the
guaranteed-clean line through the mountain is a pure carving line, and cliffs
are placed beside it, never across it. Nothing pushes you into the air. If
players go there anyway, the loop works.

There is now a gate that puts a number on it. Two drivers with identical
execution, differing only in **nerve** — one spends boost the instant it has
any, keeping the beast at arm's length; the other hoards, lets it close, and
spends only to escape:

> **brave 4008m vs timid 2258m — 1.77×**

Courage pays. That is the thesis, measured, in `npm run gates`.

One honest caveat: a *perfect* corridor-follower still outruns both, because it
holds the reserved line to within a metre or two forever. That is a superhuman
control, not a strategy a human can adopt — which is exactly what playtesting is
for.

---

## Architecture: the sim knows nothing about the renderer

```
src/sim/      pure, deterministic, headless — no Three.js, no DOM, no clock
src/render/   consumes sim state, owns everything visual
src/audio/    procedural WebAudio, zero asset files
src/input/    pointer + keyboard -> the four axes the sim reads
tools/gates.mjs   drives src/sim directly in Node to verify the phase gates
```

`src/sim` runs at a fixed 60hz and is driven identically by the browser and by
the gate harness. That is the whole point: **every claim in the "Phase gates"
section below is checked by running the shipped simulation**, not by squinting
at the screen. `npm run gates` is the proof.

The renderer samples terrain through a batched fast path (`Terrain.sampleGrid`)
rather than per-vertex `heightAt()` calls. A gate asserts the two are
bit-identical across 30,000 samples — a visual heightfield that drifts from the
physics one is exactly the bug the single-source-of-truth design is meant to
prevent.

### Tuning

Every number lives in [`src/TUNING.js`](src/TUNING.js). There are no magic
numbers in the system files. The comments there record *why* each value is what
it is, including several that were wrong first.

### Queryable state

```js
window.__STATE()   // { seed, distance, speed, gap, boostMeter, boostSpent,
                   //   tricksLanded, tricksFlubbed, obstaclesHit }
window.__DEBUG()   // everything else: pose, phase, desired gap, mistake pressure…
window.__TICK(n)   // advance n whole rendered frames
window.__STEP(n, {carve, flip, jump, boostHeld})   // advance n sim steps
window.__INPUT.script = { carve: 0.4 }             // drive it like a thumb
```

`__TICK` exists because a browser only fires `requestAnimationFrame` when it
actually paints, so an automated harness cannot drive the real loop otherwise.

---

## Controls

|              | Mobile                        | Desktop                         |
| ------------ | ----------------------------- | ------------------------------- |
| Carve        | horizontal drag (analog)      | `A`/`D` or `←`/`→`, or mouse drag |
| Jump         | flick up                      | `Space`                         |
| Spin (air)   | horizontal drag               | `A`/`D`                         |
| Flip (air)   | vertical drag                 | `W`/`S`                         |
| **Overdrive**| **hold a second finger**      | **hold `F`** (or `Shift`)       |

Overdrive has no UI and no tutorial, per the brief. The only hint it exists is
the meter sliver thickening and picking up a glow once there is enough banked to
spend.

Releasing the drag re-centres you into a straight tuck. In the air, releasing is
how you stop rotating and line up the landing.

---

## Core systems

**Carving.** A straight tuck is fast; every degree of carve scrubs the target
speed along `SPEED_CARVE_MIN + (SPEED_TUCK − SPEED_CARVE_MIN)·cos(h)^TUCK_EXP`.
Deep powder past the ribbon edge bleeds speed and nudges you back — a soft wall,
never a kill.

**Air.** Takeoff is not a scripted trigger. Every step asks: *if gravity alone
acted on me, would I end up above the ground?* On a constant 17° slope the answer
is always no, so you stay glued. Over a mogul crest or off a cliff lip the ground
falls away faster than gravity can follow, and you fly. Moguls give ~0.3s, cliffs
~1.0–1.3s, and a jump off a cliff lip is the biggest air in the game.

**Landing quality.** Clean (aligned within `CLEAN_YAW`/`CLEAN_PITCH`) banks the
trick's fill and a small speed bonus. A flub costs the whole pending fill, half
the banked meter, a 0.4s stagger and 30% of your speed. Airs shorter than
`MIN_TRICK_TIME` are bumps — no reward, but no punishment either, so mogul
chatter never staggers you.

**Boost.** `fill = hangtime × (1 + turns·ROT_BONUS) × proximityMult × FILL_RATE`,
and it fills *only* from clean-landed air. Tricks landed within 30m of the beast
are worth up to 2×. Overdrive spends it: +40% top speed, turn radius widens, no
other penalty.

**The beast.** The gap is a directed value, not a physics chase — a simulated
pursuer either falls hopelessly behind a good player or instantly eats a bad one,
and neither is dread. It targets a gap derived from your average speed and how
recently you erred, rate-limited in both directions so it always reads as an
animal closing rather than a number snapping. It never exceeds 80m (the roar has
to stay audible) and never closes faster than 14 m/s. A slow global tightening
guarantees every run ends.

It closes over one shoulder rather than straight up your back, so it looms at the
edge of frame instead of eclipsing you, and only lines up for the kill.

---

## Phase gates

`npm run gates` — **69 assertions, all green**. Selected results:

**P1 — Slope + Carve**
- `__STATE()` and full debug state deterministic across two runs of one seed
- speed converges exactly to the closed-form carve curve (34.00 tuck / 21.42 full carve)
- player never falls through the heightfield (worst glue error 0.00e+0 over 3 sim-minutes)
- render heightfield bit-identical to the physics heightfield (30,380 samples)
- **clean line held 500m on 10/10 seeds with zero obstacle hits**
- a driver that has *never been told where the clean line is* averages 1.1 hits/500m

**P2 — Air + Tricks**
- cliff line banks **1.95×** the boost of a flat-line jump (18.2 vs 9.3)
- adding a 360 to the same launch takes it to 47.8 — rotation multiplies, as designed
- flub forfeits exactly 50% of the bank plus the whole pending fill, and staggers 0.40s
- mogul chatter produces zero phantom flubs over 1100m

**P3 — Beast + Boost Spend**
- gap closes **15.7m within 2.00s** of a single mistake
- proximity multiplier verified at 2.00× / 1.50× / 1.00×
- the same trick banks proportionally more under the beast (courage pays)
- Overdrive is exactly 1.40× top speed and drains a full meter in 2.95s
- every run ends in death — a flawless line still got caught at 3405m
- gap never closes faster than `CLOSE_RATE`, ever

**P4 — Loop + Ghosts**
- ghost replays deterministically (3000 poses matched)
- ghost playback does not perturb the live sim by a single float
- ghost re-skis the recorded line to within 0.29m
- fog-yank fires at the death point and fades to zero
- restart is 36ms measured in-browser, including the terrain flush (budget: 2000ms)
- sim step costs 0.1µs; chunk rebuild 1.25ms against a 16.67ms frame budget

Browser-measured render cost at 375×812 @ DPR 2, ghost live: **median 2.8ms per
frame, 34 draw calls, ~25k triangles.**

Terrain streaming is the only real hitch risk, and it is now bounded twice over.
Caching the palette as linear `THREE.Color` objects instead of calling
`setHex()` four times per vertex took a chunk rebuild from **18ms to 1.1ms**
(under colour management `setHex` runs a `pow()` per channel, ~6000 times a
chunk). On top of that, a rebuild is now **split across five frames** — median
slice **0.1ms**, p95 **1.3ms** — so no single frame ever pays for a whole chunk
regardless of how slow the device is.

---

## Difficulty baseline (measured, for comparison against real playtests)

Twelve seeds per row, scripted drivers holding the reserved line with increasing
lateral sloppiness. Median distance and run length:

| driver                  | before the pass | with grace |
| ----------------------- | --------------- | ---------- |
| expert — holds the line | 3877m / 120s    | 3875m      |
| good — drifts ±3m       | 799m / 29s      | **1830m**  |
| average — drifts ±7m    | 623m / 23s      | **1104m**  |
| sloppy — drifts ±12m    | 414m / 17s      | **1017m**  |

Grace lifts the bottom of the curve without touching the top — an expert is
past it before it matters. A struggling player now gets roughly 40 seconds
instead of 17, which is the difference between never seeing a cliff and
learning the game.

The curve is still steep, and that is a direct consequence of the brief's own
gate: *"gap responds visibly within 2s of a mistake."* A response you can see in
two seconds is necessarily an expensive one.

If playtesting says it is still too punishing, the lever is
`BEAST.MISTAKE_GAP_COST` (22m of desired gap per mistake). Note that
`MISTAKE_PRESSURE_CAP` is *not* a useful lever — `desired` already floors at
zero, so capping the stack changes almost nothing.

---

## Deviations from the brief, and why

Three, all deliberate and all cheap to reverse.

**1. Ghost format is `[t, x, y, d, state]`, not `[t, x, z, state]`.**
Height is recorded too. Without it a ghost that hucked a cliff replays as a
silhouette snaking along the ground through the best moment of the run — and air
is the entire SSX layer we are trying to prove. Costs one extra int per sample
(~9.6KB for a 1272m run). The post-slice networked-ghost path is unaffected:
swap `Storage.loadGhost` for a `fetch` and nothing downstream changes, because
`GhostPlayer` never learns where the array came from.

**2. `FLUB_METER_LOSS` defaults to 0.5, not 1.0.**
"Forfeit banked boost" reads two ways: lose this trick's fill, or lose the whole
meter. The implementation does the first outright and takes half the stored bank
on top. Full forfeit at 34 m/s reads as punitive enough to suppress air lines
entirely, which would poison the exact question the slice is asking. Set it to
`1.0` in `TUNING.js` for the strict reading — it is one constant.

**3. Ice patches are painted into the terrain vertex colours, not instanced meshes.**
A flat decal cannot follow a heightfield without either z-fighting or its own
geometry, and at 34 m/s a colour change reads faster than a surface change. The
sim treats ice exactly as specified (no steering); only the presentation differs.

---

## Notable bugs found by the gates

Worth recording, because all three were invisible on screen and fatal underneath.

- **`vy` was zeroed on landing and at reset**, so the ballistic launch test fired
  immediately and the player was airborne **881 of 900 steps** on flat ground.
  Fixed by deriving ground velocity from the exact per-step ground delta.
- **Terrain generation produced genuinely impassable walls** on ~20% of seeds —
  an unwinnable 40u fence no skill could thread. Fixed with a reserved corridor,
  now asserted geometrically per seed.
- **`DESIRED_FLOOR` (4m) sat above `KILL_GAP` (2.5m)**, so the beast converged on
  a gap it could never close. A "flawless" run survived 22km and the game had no
  ending. Caught by the "every run ends in death" gate.
- **The render heightfield silently drifted 10.1m from the physics one** the
  moment the grade started modulating, because the batched sampler still used
  the old flat base. Caught immediately by the gate that exists for exactly
  this, which is the entire argument for having written it.
- **Terrain shading was measured against a flat reference line** after the grade
  became variable, so whole pitches would have rendered as shadow or blowout.

---

## Don't-build list — honoured

No biomes, no meta progression, no currency or shop, no Supabase or networked
leaderboards, no GIF export, no character customisation, no menus beyond title
and death, no tilt controls, one beast with one kill animation, and no named
tricks or trick UI text — rotation and hangtime maths only.
