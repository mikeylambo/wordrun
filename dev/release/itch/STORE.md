# DICTION DASH — itch.io store copy

Everything below is paste-ready. Fields are named the way itch labels them;
if the wording has drifted, the intent is in the heading.

---

## Title

```
DICTION DASH
```

## Short description / tagline

Shown under the title on cards and in search. Keep it under ~140 characters.

```
An endless word runner where reading is your speed. Read fast, pick right, outrun the Redline.
```

---

## Full description

Paste as-is; itch's editor takes this markdown cleanly.

```
Words rush at you down a neon manuscript. Some are real. Some are not.

Call it — REAL or FAKE — before it reaches you.

Get it right and you run faster. Get it wrong and you bleed speed, and the
Redline behind you does not.

**The Redline is not a monster.** It is an editing pen. It travels at a
steady, honest pace and it never speeds up to punish you. It only ever
catches slow readers. Every run you lose is a run you read too slowly — and
that is the only thing this game asks you to get better at.

---

**One verb, two answers.**
REAL or FAKE. That is the whole control scheme. Everything else — your
speed, your chain, the light in the world — comes out of how well you read.

**A brighter vocabulary. A brighter you.**
Chain correct reads and the world lights up around you. Not a score
multiplier hidden in a menu: the track burns brighter, the runner burns
brighter, the music opens up. Break the chain and the light recedes.

**DASH.**
Bank a full charge and spend it whole for a burst of speed. It is the one
thing you can hold and choose when to use.

**DAILY RUN.**
100 words. The same hundred for everyone. New each day.

**Your own ghost.**
Your best run comes back and runs the line beside you.

**5,381 real words** across five difficulty tiers, 5,324 of them carrying a
definition you can look up after the run. The fakes are built to be
plausible — near misses, real spellings bent by one letter, words that feel
right and are not.

---

**Controls**

- Keyboard — ← FAKE · → REAL · SPACE to DASH · ↑ to raise the bar · F for fullscreen
- Touch — three buttons, thumb-reachable, portrait
- Gamepad supported

**Accessibility**

REDUCED FLASH damps every pulse and glow while keeping all of the colour
that carries information. READABLE TYPE widens the word plate's tracking and
size. Colour-vision palettes are available for the right/wrong and danger
cues. Music and sound effects toggle independently.

**Technical**

Runs in the browser. No install, no account, no network calls at play time —
your scores and progress live in your own browser and go nowhere else.
Built with three.js.

---

*This is a quiet first release. If you play it and something feels wrong —
a word you would dispute, a read you did not get time for — I would like to
hear about it.*
```

---

## Metadata

| Field | Value |
| --- | --- |
| Kind of project | HTML |
| Genre | Action |
| Release status | Released |
| Pricing | No payments (free) |
| Visibility | Draft while you set it up, then Public |

## Tags

itch caps you at 10. In priority order:

```
word-game, endless-runner, arcade, vocabulary, high-score, daily,
educational, html5, mobile-friendly, singleplayer
```

## Embed settings

Measured, not guessed — the build was loaded in a cross-origin iframe at a
subpath, which is how itch actually serves it.

| Setting | Value | Why |
| --- | --- | --- |
| Viewport dimensions | **640 × 900** | The canvas fills this exactly with no letterboxing. Other sizes letterbox cleanly to portrait, so this is a preference, not a requirement. |
| Fullscreen button | **On** | The single biggest legibility gain a desktop player can reach — the game says so in its own coach line. |
| Mobile friendly | **On**, orientation **portrait** | The touch build is the primary layout. |
| Automatically start on page load | **Off** | Audio needs a user gesture anyway, and the first tap is what starts the run. |

## Upload

`dictiondash-web.zip` — `index.html` is at the root of the zip, which is what
itch requires. Tick **"This file will be played in the browser"**.

---

## Launch checklist

Measured on the built bundle, not assumed.

- [ ] `npm run gates && npm run gate:v1 && npm run smoke` green, then `npm run build`
- [ ] Zip is `dist/` with **`index.html` at the root** (not `dist/index.html`)
- [ ] Upload, tick *"This file will be played in the browser"*, set 640 × 900
- [ ] Cover image and 4–5 screenshots
- [ ] Tags, genre, pricing, mobile-friendly + portrait
- [ ] Save as **Draft** and play the embed once from the draft page before
      going Public — the embed is the only place some of this can break
- [ ] Public. For a quiet release: no devlog, no community post, no
      announcement. The page simply exists.

### Two things that will look like bugs and are not

**A 404 for `audio/music/into-the-night.high.mp3` in the console.** That is
`src/audio/high-layer.js` doing a HEAD probe for an optional high-flow music
layer that is not shipped. It is designed to 404 and skip. Harmless.

**Progress lives in the player's browser.** The game stores best scores,
daily progress, learned words and settings in `localStorage`. Verified
working in a cross-origin iframe at a subpath — the shipping condition — but
a browser set to block third-party storage (Safari's tracking prevention, or
a hardened profile) can still deny it. The game probes for storage and
degrades to a session that simply does not persist, rather than breaking. If
somebody reports "it forgot my score", that is what happened.

## Assets in this folder

- `cover-630x500.png` — the cover image
- `screenshots/01-title.png` … `05-desktop.png`

Regenerate the cover with `node dev/make-itch-cover.mjs` after a build; it
reads the real inline wordmark out of `index.html` so the mark on the store
page cannot drift from the mark in the game.
