# The score, and the layer that rides on top of it

Two files ship here today and a third is a drop-in.

| file | what it is |
| --- | --- |
| `into-the-night.mp3` | the score. Streamed, looping, on the music bus. |
| `into-the-night.scoremap.json` | its analysis — beats, sections, event lanes. Built by `npm run build:scoremap`; the format is documented in `music/FORMAT.md`. |
| `into-the-night.high.mp3` | **the high-flow layer. Not shipped yet.** |

## The high-flow layer (RC9.7)

A second layer that fades in while the player holds a reading chain of 50 or
more — the third editorial band, the one the world calls *blooming* — and fades
out when the chain breaks. Until the real file exists the game synthesizes a
placeholder pad so the mechanism is live, gated and audible; dropping the file
in replaces the pad and nothing else changes.

**The contract, in full:**

- **Name it `into-the-night.high.mp3`** and put it in this directory. Nothing
  needs to be registered, imported or configured: `src/audio/high-layer.js`
  probes for it at boot and prefers it whenever it answers.
- **Same length, same tempo, same loop point as the track.** It plays as its
  own looping element beside the score rather than mixed into it, so the two
  stay in phase only if they are the same shape. 164 BPM, and it loops where
  the score map says the score loops.
- **It is an OVERLAY, not a mix.** Whatever is already in the track must not be
  in this file — it is added on top at full level, so a duplicated kick will
  read as a doubled kick.
- **Mixed to sit under the score.** It arrives at unity through the same music
  bus, so print it at the level you want to hear it at when the pad is at its
  loudest.
- **Nothing rhythmic in its envelope.** The game fades it in over 1.8 s and out
  over 0.9 s, starting on a beat; anything that pumps per beat belongs in the
  file's own performance, not in a level the game is moving.

**What the game does with it, and what it will never do:** it routes to
`audio.bus.music`, so MUSIC OFF, the drain's lowpass and every duck in the mix
already apply. It draws nothing. Its gain is not read by the camera, the post
chain, the palette or anything else on screen — the visual energy is the run's
and the score map's, and this layer is not allowed a vote. That is checked by
`npm run gate:music`.
