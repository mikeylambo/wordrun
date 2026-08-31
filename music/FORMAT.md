# Score map — format v1

A score map describes a piece of music. It never describes a game.

`kick on beat 96` belongs in a score map. `camera pulse on beat 96` does not —
that is one game's reading of a kick, and the moment it lands in this file the
file stops being portable. Each game keeps its own mapping from these names to
its own behaviour. The map is expensive to produce and never rewritten; a
mapping is cheap and rewritten per project.

## Shape

```jsonc
{
  "format": 1,
  "track": "into-the-night",
  "duration": 277.56,           // seconds of audio
  "grid": {
    "offset": 0.08,             // seconds; already folded into every time below
    "beats": [0.08, 0.444, ...],// seconds — the ONLY place seconds appear
    "loop": { "from": 0, "to": 744 }   // beats; bar-aligned, may be absent
  },
  "events": {                   // sparse, discrete: [beat, strength 0..1]
    "kick":  [[12, 1], [14, 0.8]],
    "snare": [...], "crash": [...], "clap": [...]
  },
  "curves": {                   // dense: one value per bar, 0..1
    "hat":    { "per": "bar", "v": [0, 0.4, 0.9, ...] },
    "energy": { "per": "bar", "v": [...] }
  },
  "sections": [                 // labelled spans, in beats
    { "from": 0, "to": 48, "tag": "intro", "layers": ["other"] }
  ]
}
```

## Why times are in beats

Everything outside `grid` is measured in beats, fractional. The grid is the sole
dictionary between beats and seconds.

This is not tidiness. A stem separator warped one of these tracks onto a
constant tempo and every wall-clock timestamp taken from it was wrong by up to a
third of a beat by the end, progressively, so no single offset could repair it —
while the musical positions were exact throughout. Musical position survives
re-timing, re-rendering and re-encoding. Seconds do not. Storing beats also makes
"every fourth bar" a subtraction rather than a search.

`grid.offset` is a measured constant, not a guess: average the master's
band-energy flux in a window around every transcribed hit and take the peak of
that average. Constrain the window to under half a beat or a hit will match its
neighbour and each instrument will report a different answer.

## Events versus curves

Sparse things are events; dense things are curves.

A kick is an event because something can fire on it. A hi-hat at four hits a
beat is a curve, because no visual will ever trigger on an individual one — what
a game wants from hats is *how busy they are*, which is a number per bar. The
test is whether a consumer would ever ask "when is the next one": if not, it is
a curve, and storing it as events wastes several KB describing something nobody
reads back.

`strength` is normalised within its own event type, not across the track, so
`kick` strength 1 is the loudest kick and says nothing about the snare.

## Sections and overlays

`sections` is the one block meant to be written by a person. A machine can find
where a layer enters and leaves; it cannot know that bar 96 is *the* drop.

A generator therefore writes `<track>.scoremap.json` and a human writes
`<track>.overlay.json`, which is merged over it at build time. **Regeneration
must never overwrite the overlay.** Anything else and the first re-run destroys
an afternoon of authoring, after which nobody trusts the pipeline.

Overlays may add or replace sections, rename event types, and drop events the
transcription hallucinated. They may not invent event times — that is a signal
the map itself is wrong and should be regenerated.

## Looping

`grid.loop` must be **bar-aligned**. A track that loops on a non-bar boundary
walks its visual phase a little further out of step on every lap until it is
plainly wrong — and a runner whose sessions are unbounded will loop many times.
This is a constraint on how the audio is cut, which no amount of runtime code
can repair afterwards.

Beats past `loop.to` wrap back to `loop.from`; the runtime does this, and
consumers see a continuously increasing beat number.

## What this format is not

It is not a rhythm-game chart. Charts need difficulty tiers, input windows, lane
assignment and per-note judgement, they are authored rather than extracted, and
folding them in here would double the format to serve a game nobody is building.
