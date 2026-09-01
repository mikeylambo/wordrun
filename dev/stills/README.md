# Phase K — concept stills

Four frames of the real game with the dev-only page layer armed
(`dev/style-lab.js`, `?dev=1&stills=1`). Same seed (the DAILY RUN for
2026-09-01), same gate (the fifth, word `all`, real), same read moment (plate
37.8 m ahead), same speed (36 m/s), same portrait frame (390×844 at 2×). The
only things that change between frames are the chain and the Redline's gap.
Every number below was read back from the running page by
`dev/shoot-stills.mjs` and written to `manifest.json`; nothing is asserted.

| still | chain | band | gap | what to look at |
|---|---|---|---|---|
| `K1-chain0-sparse-manuscript.png` | 0 | sparse | 48 m | one hairline rule a side, a fifth of the lines set, ragged |
| `K2-chain50-blooming.png` | 50 | blooming | 48 m | two rules, half the lines, full stops and dashes arrive |
| `K3-chain150-typeset-redline-close.png` | 150 | typeset | 16 m | three rules, two justified columns, brackets, drop caps; the rig tilts back for the Redline |
| `K3b-chain150-typeset-redline-9m.png` | 150 | typeset | 9 m | measured, not asked for: inside the scream range the correction blocks cross the plate |

The page is bars, never glyphs: every "line of type" is a box, so the
background is unreadable by construction and the plate stays the only text
in the world. Bands are the finishing brief's five (chain 0 / 25 / 50 / 100 /
150+), a concept scale, not the shipped flow curve (which peaks at 8 links).
Colours come from the art-direction band under the runner (crest and ice), so
no hue is new and nothing is red.

## Reshoot

```
npm run build
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node dev/shoot-stills.mjs
```

`playwright-core` is deliberately not a repo dependency; `CHROME` overrides
the Chromium binary. The driver serves `dist/` through `vite preview`, steps
the sim headlessly with every read answered right until the fifth gate is
resolved, pins chain, speed and gap, runs the live frame until the plate sits
38 m ahead, and screenshots.

## Read from the frames

- The page lives in the far field. Portrait at this FOV hides the margins
  beside the runner (the frame is 7 m wide at 20 m out), so a flat page only
  enters the shot 30 m ahead. If the Editorial World goes ahead, the page
  has to climb the banks, not only lie on them — a Phase L/M question.
- The plate wins every frame, including at 16 m. At 9 m it does not: the
  shipped correction blocks cross it (K3b). That is today's Redline, not the
  page — worth deciding before "the Redline as an editorial correction".
- Rules, stops and brackets read at a glance; the floating dashes read as
  short bars, and the ink sits close to the track's cyan. A distinct paper
  ink would separate page from route.
