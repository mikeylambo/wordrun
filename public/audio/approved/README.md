# DESCENT approved audio

This directory contains production-side organic audio layers selected from the ElevenLabs audition batches.

The procedural RC9 audio engine remains the authoritative fallback and timing layer. Generated files are additive, replaceable, and gain-trimmed through `manifest.json`.

Current policy:
- Keep procedural ski surface texture; playtest feedback likes its character, with a dedicated -2.9 dB trim applied in RC9.3.
- Use organic assets for mountain ambience, creature body, impacts, landings, and GO ignition.
- Creature positional timing remains driven by simulation state; long organic footstep bodies are throttled so they do not smear Hunt cadence.
- All current take choices are provisional and can be swapped after headphone audition without code changes.
