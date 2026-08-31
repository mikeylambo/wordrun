# Music timing data

Derived, at build time, from a stem separation of the candidate track. Nothing
here is loaded by the game yet, and none of it is in `dist/` — the size audit
walks `dist` only, so these files cost the Playables budget nothing.

## Why the map comes from MIDI and not from the stem audio

The separator offers "Fixed tempo" and "Follow tempo changes". Fixed tempo does
not mean *leave the timing alone* — it time-warps the material onto one constant
grid, and it is the setting that alters the audio. It rendered the four stems at
a flat 164.00 BPM.

That was measurable. Fitting a beat grid to each rendered stem returns exactly
164.00 BPM with an identical first beat at 0.030 s for drums, bass and other,
against 164.06 BPM at 0.335 s for the master — the fingerprint of material laid
onto a synthetic grid. Cross-correlating the stems against the master shows the
error growing with time: about +0.08 s for the first minute, reaching +0.26 s by
the end. A third of a beat, and progressive, so no single offset repairs it.

The MIDI transcription escaped this. It carries a full tempo map — 692 changes,
spanning 160.00 to 169.01 BPM — which reconstructs the original recording's
timeline. Integrating note ticks through that map lands every hit a *constant*
0.08 s ahead of the master's audio onsets, with no drift across the whole track.
A constant is trivially corrected; drift is not. So the MIDI is the timing
source and the rendered stem audio is used only for section-level loudness.

## Verifying the offset

The 0.08 s constant is measured rather than assumed. Average the master's
band-energy flux in a window around every transcribed hit; the peak of that
average is the systematic lag. Constrain the window to ±0.14 s, because half a
beat here is 0.183 s and a wider window lets a hit match its neighbour — an
unconstrained search returns three mutually inconsistent answers, one per drum.
Constrained, the three agree: kick +0.080 s, snare +0.040 s, crash +0.020 s,
each peaking 5x to 17x above its own baseline.

Re-measure this if the track or the transcription is ever replaced.

## Files

- `into-the-night.beatmap.json` — 748 beats, and every transcribed kick, snare,
  hat, clap and crash, in master time. Regenerate with
  `node tools/build-beatmap.mjs <midi-dir>`.
- `into-the-night.arrangement.json` — per-second loudness of each separated stem,
  in 5 dB steps below that stem's own 95th percentile. Section-level only. This
  one needs the stem audio to regenerate, which does not live in the repository.

The arrangement is what the separation was actually worth. The beat grid was
already recoverable from the master alone; where each layer enters and leaves
was not. The bass falls silent twice, and the drums thin out under it once —
those are the structural moments, and they are the difference between visuals
that feel written and visuals that feel like a metronome.
