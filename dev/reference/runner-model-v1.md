# RUNNER MODEL v1 — the approved figure

**Status: approved target.** This is the brief the in-game runner is built to.
When the figure and this document disagree, this document is right and the
figure is behind.

The source is the `DICTION DASH — RUNNER MODEL v1.0` sheet: a five-view
turnaround (front, back, left, right, 3/4 back), five detail callouts, a
four-step light ladder, and a six-pose set. Drop the image in beside this
file as `runner-model-v1.png` so the sheet and its reading live together.

## What the sheet is, and is not

It is a **spec to translate**, not an asset to import. The panels labelled
`WIRE FRAME (TOPOLOGY REFERENCE)` and `PROCEDURAL GEOMETRY (MODULAR)` are
illustrations *of* topology; there is no mesh behind them. Nothing on the
sheet can be loaded.

That is not a limitation to work around — it is the right outcome. The
figure is built in code (`src/render/actors.js`) from tapered primitives on
a hand-made pivot rig, posed by trig off a distance-driven phase. Staying
procedural is what makes the tagline literal: **every seam on the body is a
real object the chain can light individually.** In an authored mesh, "a
brighter vocabulary, a brighter you" is a baked emissive map behind a mask.
Here it is the geometry itself.

If a GLB is ever commissioned, this sheet is exactly what a modeller needs.
It should not be commissioned to fix the look. See *The look was never the
modelling*, below.

## Silhouette

An athletic, faceless humanoid. Broad shoulder yoke, narrow waist, long
powerful legs, human sprint anatomy, a small smooth oval head. Never a
robot, never a costume, never a stick figure, never a letterform.

The proportions live in one exported block, `FIGURE`, and the gates assert
the **relationships**, not the numbers — tune freely, but the figure may not
slide back into a rod-limbed mannequin:

| relationship | why |
| --- | --- |
| `SHOULDER_SPAN / 2 > CHEST > WAIST` | the V is the character |
| `THIGH > CALF × 1.25` | thighs are the heaviest section |
| `UPPER_ARM > FOREARM × 1.25` | limbs are anatomy, not rods |
| `THIGH_LEN + SHIN_LEN ≥ HIP_Y × 0.94` | long legs |
| `HEAD × 2 < SHOULDER_SPAN × 0.55` | small, anonymous head |

**The test that decides it:** solid black, rim off, ~100 px tall. If he does
not read as a person, the silhouette is not finished.
`dev/shoot-runner-stills.mjs` shoots it as `R7-silhouette-test.png`.

## Surface language

Four surfaces, and the order matters:

1. **Mass** — a near-black navy body on a *normal* blend. Additive light
   cannot subtract, and a figure that is only ever brighter than its
   background has no silhouette at all.
2. **Rim** — the same geometry grown ~8% and drawn back-face-only, so the
   mass occludes all but a hairline around the edge. This is the surface
   `setPalette` tints; it is the player's cosmetic.
3. **Seams** — *not painted on*. On the sheet, every bright line on a limb
   is a **gap between two muscle masses**. So each bone is two plates with a
   real gap, the pelvis is two glute plates, and the shoulder and hip caps
   are plates of their own — and the rim that already outlines each mass
   draws the seam for free. A smooth rod with a highlight down it never
   reads as anatomy. Two plates and the dark between them always do.
4. **Core** — white-hot structural light, on the spine, across the yoke, at
   the hands, on the soles, and the chevron. Never tinted: the core is what
   guarantees the figure reads whatever cosmetic is equipped.

No red anywhere on the runner, at any brightness. That hue is the Redline's
alone and the build enforces it.

## The mark

The `∧` from the wordmark, worn on the sternum. In play he is seen from
behind, so it costs nothing there and pays in the attract loop, the arrival,
and every frame anyone captures to share — the places he is ever seen
front-on. The head carries no crest beyond a slim rear light accent: the
figure reads stronger for being anonymous.

## Light — the chain, and nothing else

Four steps on the sheet, driven by one number already computed for the world
(`flow`, 0.78 idle → 1.75 at the cap). No new meter, no new system.

| sheet | chain | reads as |
| --- | --- | --- |
| BASE | 0 | dark mass, hairline rim |
| BUILDING | mid | seams and edge light arriving |
| HIGH FLOW | 50+ | near-white luminous hero silhouette |
| DASH | burst | the above, plus the comet tail per chain rung |

The ignition is **eased**, so a broken chain lets the light *recede*. The
collapse metaphor in this game is the drain, never damage. The mass is also
capped short of the rim's colour: if it is allowed to reach it, the plate
seams vanish into one white blob at exactly the moment the player has earned
the best look at him.

## Poses

All six are pure functions of sim state, posed off a **distance-driven**
phase — never a clock. A frozen sim is a frozen figure for free.

| pose | driven by |
| --- | --- |
| RUN | `advanceStride` on metres covered; asymmetric hip drive, knee recovery whip, ankle push-off, spine counter-rotation |
| LEAP | `p.airborne` |
| LAND | a presentation-only timer started by the sim reporting ground |
| STAGGER | `p.staggerT` |
| DREAD | the Redline gap — crouch, and shoulders toward the ears |
| IDLE | `p.speed`, **never** the stride clock |

That last row is load-bearing. A teach stop freezes a sprinter mid-stride on
purpose (RC9.9) — a held breath, not a hang. IDLE reading speed rather than
stride is what keeps a *frozen* run from being mistaken for a *resting* one.

## What is deliberately not copied

The sheet is key art at ~1200 px with heavy bloom and depth of field. In
play the figure is 60–120 px on a phone. Do not chase:

- the small glowing anatomy panels inside each muscle — noise at game size;
- fingers — the hands are abstract endpoints and should stay that way;
- depth of field.

The target is the **iconic reduction** of the sheet, not the sheet.

## The look was never the modelling

A large share of the gap between the sheet and the shipped frame was
*rendering*, not geometry. The game had no bloom in its default look while
every piece of key art drawn from it did. `src/render/bright-pass.js` fixes
that, and it lifted the word plates, the track ribbon and the Redline as
much as it lifted the runner.

Reach for the renderer before reaching for a modeller.

## Where this lives

| thing | file |
| --- | --- |
| the figure, the rig, every pose | `src/render/actors.js` |
| bloom in the default look | `src/render/bright-pass.js` |
| cosmetic palettes | `TUNING.META.COSMETICS` → `PlayerActor.setPalette` |
| the state stills, and the silhouette test | `dev/shoot-runner-stills.mjs` |
| the plate-legibility measurement | `dev/shoot-bloom-compare.mjs` |
| what the build enforces | the N3/N5/N6 blocks in `tools/v1-polish-gates.mjs` |

Re-shoot `dev/stills/runner/` whenever the figure changes. `npm run gates`
and `npm run gate:v1` are the last thing that runs before the commit.
