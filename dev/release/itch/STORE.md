# DICTION DASH — itch.io store copy

Paste-ready. Written to match the house style across ORBITAL COIL, SIGNAL,
LIVING LOOP and DESCENT: a one-line "X is a…" opener, two or three prose
paragraphs in second person with the proper nouns bolded, a "The result is…"
close, emoji-headed sections of `**Term:** explanation` bullets, a
`⚙️ Features & Depth` block, `🎮 Controls`, and a closing italic note.

Every number below was read out of the source, not from memory.

---

## Title

```
DICTION DASH
```

## Short description / tagline

```
An endless word runner where reading is your speed
```

---

## Full description

```
**DICTION DASH** is an endless word runner where your reading speed is your
actual speed.

Words rush at you down a neon manuscript. Some are real. Some are not. Call
it — **REAL** or **FAKE** — before it reaches you. Read it right and you
accelerate. Read it wrong and you bleed speed, and the **Redline** behind
you does not.

The Redline is not a monster. It is an editing pen, and it travels at a
steady, honest pace. It never speeds up to punish you and it never slows
down to save you, so every run you lose is a run you read too slowly.

The result is a game about reading under pressure — and about how much you
trust a word you only half recognise.

🏃 **Two Ways to Run**

- **Endless:** Run until the Redline takes you. Your accuracy sets your
  speed, and your speed sets how long you last.
- **Daily Run:** 100 words. The same hundred for everyone. New each day.
- **Three Difficulties:** Easy, Normal and Hard change the reading window
  you get, never the words themselves.

⚡ **Speed, Chain & Hearts**

- **Speed:** Gained on every correct read, lost on every wrong one. Nothing
  else moves it.
- **Chain:** Consecutive correct reads. The chain is the light — the track,
  the runner and the music all brighten with it, and dim when it breaks.
- **Hearts:** Three of them, and only tapping a **fake** costs one. Letting
  a real word slip past costs speed and your chain, but never a life.
- **The Way Back:** A heart returns for a clean reading streak, and the
  streak you need gets shorter the closer you are to the end. On your last
  heart, a handful of good reads is a genuine comeback.

🎯 **Risk You Choose**

- **Raise the Bar:** Four levels. Each one narrows the window you are paid
  for, up to a **1.60×** multiplier for answering early. Answering late
  costs money, never the run — no word is ever harder to read.
- **DASH:** Bank a full charge and spend it whole for a burst of speed. The
  one thing you hold and choose when to use.
- **Bells:** Collected on the line and spent in the shop on runner-light
  palettes.

📖 **The Words**

- **5,381 real words** across five difficulty tiers.
- **5,324 definitions**, so a word that beat you can be looked up after the
  run.
- **Plausible fakes:** near misses, real spellings bent by one letter, and
  words that feel right and are not.

⚙️ **Features & Depth**

- **Your Own Ghost:** Your best run comes back and runs the line beside you.
- **Records & Mastery:** Personal bests, words learned, per-run history and
  streaks, all saved locally.
- **Challenge Links:** Share a seed and hand somebody the exact run you just
  had.
- **Accessibility First:** REDUCED FLASH damps every pulse and glow while
  keeping all the colour that carries information, READABLE TYPE widens the
  word plate's tracking and size, colour-vision palettes cover the
  right/wrong and danger cues, and music and sound toggle separately.
- **Installable:** Add it to a home screen and it runs offline.
- **100% Respect for Your Time:** No accounts, no ads, no energy timers, no
  paid retries. Zero network calls while you play — your scores live in your
  own browser and go nowhere else.

🎮 **Controls**

Keyboard

- Call it: **←** for FAKE, **→** for REAL
- DASH: **Space**
- Raise the Bar: **↑**
- Fullscreen: **F**

Touch

- Three thumb-reachable buttons: FAKE, DASH, REAL
- The DASH ring around the centre button is your charge

Controller

- Supported, with fully navigable menus

> *Note: DICTION DASH shows you words and records how you read them. It
> makes no promise about growing your vocabulary.*
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

- [ ] `npm run gates && npm run gate:v1 && npm run smoke` green, then `npm run package:itch`
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

**Progress lives in the player's browser.** Best scores, the daily, learned
words and settings are in `localStorage`. Verified working in a cross-origin
iframe at a subpath — the shipping condition — but a browser set to block
third-party storage (Safari's tracking prevention, a hardened profile) can
still deny it. The game probes for storage and degrades to a session that
does not persist rather than breaking. If somebody reports "it forgot my
score", that is what happened.

### Claims deliberately NOT made

- **No leaderboards.** `src/meta/boards.js` ships with no endpoint
  configured — the board transport is a dynamic import that never loads in
  the shipped build. Scores are local. Do not add a leaderboard line to the
  page until that changes.
- **No vocabulary-improvement claim.** The closing note says so outright,
  matching SIGNAL's note about cognition. The game records how you read; it
  does not promise to change it.

---

## Assets in this folder

- `cover-630x500.png` — the cover image
- `screenshots/01-title.png` … `05-desktop.png`

Regenerate the cover with `node dev/make-itch-cover.mjs` after a build; it
reads the real inline wordmark out of `index.html` so the mark on the store
page cannot drift from the mark in the game.
