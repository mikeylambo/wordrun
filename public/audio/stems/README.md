# Music stems — drop-in contract (Phase 12)

The reactive engine (`src/audio/stems.js`) looks here for four files, by
layer name, trying `.mp3` first then `.wav`:

    drums.mp3   locomotion — rides the speed curve floor→ceiling
    bass.mp3    foundation — always present, swells with speed
    lead.mp3    flow — wakes with the read chain, the melodic reward
    fx.mp3      peak — audible only when speed AND chain are both high

Rules for produced stems:

- Every file loops seamlessly as authored (the engine loops each layer
  independently and forever). Keep all four at the SAME tempo and a
  shared bar-length multiple so free-running layers stay musical.
- Mix each stem to full intended level; the engine owns all fading.
  The bus ceiling is `TUNING.AUDIO.MUSIC_MAX` — raise it when the real
  score lands (it sits low for the synthesized placeholders).
- Any file missing here falls back to a deterministic placeholder loop,
  so partial drops are fine during production.

No code changes are needed to ship real stems — replacing the files is
the whole integration.
