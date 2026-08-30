# Bundled typefaces

Both faces ship as latin-subset variable WOFF2 files served from this origin.
Nothing here is fetched from a font CDN at runtime — DICTION DASH makes zero
external network calls during play, and a webfont request would break that.

| File | Family | Axis | Role |
| --- | --- | --- | --- |
| `archivo-latin-var.woff2` | Archivo | `wght` 400–900 | Display and UI: the distance readout, buttons, micro-labels, the results card |
| `atkinson-next-latin-var.woff2` | Atkinson Hyperlegible Next | `wght` 400–800 | The word plates — the surface the whole game is read from |

Atkinson Hyperlegible Next is drawn by the Braille Institute specifically so
that characters cannot be confused with one another: `I`/`l`/`1`, `O`/`0`,
`rn`/`m`. DICTION DASH asks players to spot a single-letter difference under
time pressure, so glyph disambiguation is a mechanic, not a preference.

Both are licensed under the SIL Open Font License 1.1; the full texts are
`OFL-Archivo.txt` and `OFL-AtkinsonHyperlegibleNext.txt`.

Subsets were taken from the Google Fonts `latin` slice. To refresh, request
`https://fonts.googleapis.com/css2?family=...&display=block` with a modern
browser user agent and save the `/* latin */` `woff2` it points at.
