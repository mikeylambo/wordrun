# RC11 — THE RIBBON: three concept stills

**The decision is open. Pick or redirect from these three frames; nothing has
entered the renderer.** Everything below was shot with `dev/ribbon-lab.js`, a
dev-only layer armed by `?ribbon=1` and never bundled, and every number was
read back from the running page by `dev/shoot-ribbon-stills.mjs`.

Same road, gate, read moment, speed and frame as the Phase K set — the DAILY
route for 2026-09-02 pinned with `?draft=` (it hashes to the identical seed),
the fifth gate, the plate 38 m ahead, 36 m/s, 390×844 at 2×. The gradient's
phase is frozen at one value for all three, so **the only thing that changes
between the frames is the chain**.

Two deliberate differences from the K set, both worth knowing before you look:

- **The Phase K page layer is NOT armed.** The question here is the road.
  Arming both concepts would put two open decisions in one frame and neither
  could be answered from it.
- **The word is `eve`, not `eys`.** Same seed, same gate index — the word bank
  has grown from ~560 to 5,381 since the K shoot, so the fifth draw differs.

| still | chain | saturation | gain | what to look at |
|---|---|---|---|---|
| `R1-chain0-ribbon.png` | 0 | 0.18 | 0.22 | the road barely lit — saturation is on the flow curve, so a cold run is nearly monochrome |
| `R2-chain25-ribbon.png` | 25 | 0.59 | 0.46 | the ramp arrives; the far bend turns violet while the near road is teal |
| `R3-chain150-crest-ribbon.png` | 150 | 1.00 | 0.70 | the crest: the road is a light source, and the plate is the dark thing in the frame |

## The three questions, answered from the frames

**1. The road as a light source.** It works, and the measurement says how much:
the road's mean luminance goes **0.242 → 0.441 → 0.594** across the three
frames, against 0.042 for the shipped look. The runner and the rails take
their colour from the surface at their own distance. The lane lines are
streaming baseline rules, and read as fine hairlines rather than as ruled squares.

**2. The drop.** Present but not yet convincing — see *what does not work*.

**3. The plate.** It holds, and it holds BETTER as the road brightens, because
the relationship inverts: the plate stops being a pale slab on a dark road and
becomes the dark thing in a bright frame.

```
                     plate mean  road mean  plate:surface  ink:backing  plate:brightest road
  R1  chain 0           0.1795     0.2419        1.29          6.81            6.99
  R2  chain 25          0.1846     0.4410        2.17          6.92            6.99
  R3  chain 150         0.1893     0.5943        2.61          6.78            6.97
```

The plate's own ink-to-backing contrast is flat at ~6.8 across all three — the
surface never reaches through the 0.86 backing. Its projected size is
259.6–262.1 × 64.9–65.6 device px at this distance, within 1 % across the set,
so the surface costs the plate nothing dimensionally either.

**One caveat on that row, stated rather than buried:** 260×65 is the plate at
38 m and 36 m/s, which is the K set's framing, NOT the conditions the
legibility fence in `gate:route` measures (that fence is 270×68 at 62 m/s and
its own geometry, and it is still green — the lab is dev-only and cannot reach
it). These numbers say the surface does not cost the plate anything; they are
not a re-run of the fence.

## The hue gate, on every surface colour

The reserved fence turned out to have real teeth. `TUNING.META.RESERVED_HUES`
holds six hues at 25°, whose union is **two arcs: [325..70] through zero, and
[237..287]**. So the brief's "violet" cannot be 270 and its "gold" cannot be
48 — both sit inside a fence, and one of them is the Redline's own danger
accent. The ramp is therefore a walk over the LEGAL hue set only, and it
**steps** across the tier-2 arc rather than interpolating through it: no
parameter of the gradient is ever spent on a fenced hue.

```
  fence: 25° from 3° (Redline danger accent), 24° (protanopia), 28° (deuteranopia),
         45° (streak-burst tier 3), 262° (streak-burst tier 2), 350° (tritanopia)

  violet                        hue 295°  sat 0.72  val 0.78  clearance 33°  LEGAL
  (step over the tier-2 arc)    hue 237°  sat 0.78  val 0.80  clearance 25°  LEGAL
  blue                          hue 225°  sat 0.84  val 0.86  clearance 37°  LEGAL
  cyan                          hue 192°  sat 0.86  val 0.98  clearance 70°  LEGAL
  teal                          hue 168°  sat 0.74  val 0.90  clearance 94°  LEGAL
  gold                          hue  74°  sat 0.80  val 1.00  clearance 29°  LEGAL

  360 samples across the whole ramp: worst clearance 25° at hue 237° — ALL LEGAL
```

## What does not work, said plainly

Four things a pick should weigh against the frames:

- **The runner disappears into the road.** At R3 he is white on mint. The
  actor takes light from the surface, which was the brief, but at the crest
  that costs him his silhouette — the one thing in the frame that must never
  be lost. A dark rim, or an inverted actor above some surface luminance,
  would fix it, and neither is free.
- **The ramp is longer than the visible road.** The wave is 260 m and the road
  runs out at about 250, so you see one leg near and one leg far: it reads as
  "a green road with a violet bend" rather than as a gradient flowing along
  the length. A shorter wave (80–120 m) would put two or three legs in frame
  at once. This is one number and worth trying before deciding the palette is
  wrong.
- **The drop reads as confetti, not as a fall.** The page fragments are
  legible; the star field behind them is not, because a portrait frame with
  the road across its lower half leaves very little sky below the ribbon to
  see stars in. The idea may need the camera, not the field.
- **The painted band is still under the new rail.** The shader's
  `smoothstep(0.8, 0.97, abs(vP4Lane))` was not touched — that is a renderer
  change and it waits for this pick — so both the old band and RC11's rail
  geometry are in every frame. If the surface goes ahead, retiring the band is
  the first thing that should follow it.

## Reshoot

```
npm run build && node dev/shoot-ribbon-stills.mjs
```

`playwright-core` is deliberately not a repo dependency; `CHROME` overrides the
Chromium binary. The driver serves `dist/` through `vite preview`, steps the
sim headlessly until the fifth gate resolves, pins chain, speed and gap, runs
the live frame until the plate sits 38 m ahead, screenshots, and then measures
the plate by re-rendering into a render target and reading the pixels back —
the default context keeps no drawing buffer, and a claim about legibility that
cannot read a pixel is not a measurement.
