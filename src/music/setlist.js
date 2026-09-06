/**
 * RC10.6 — which score is playing, and where its files live.
 *
 * One track was always going to be thin for a game meant to be played every
 * day: a ten-run sitting is forty minutes of the same loop. The machinery for
 * more than one has been half-present for a while — `tools/build-score-map.mjs`
 * has taken a slug since the day it was written — but three files hard-coded
 * the same name, so a second track could be BUILT and never PLAYED.
 *
 * This is the list, and the one rule for choosing from it. Everything else in
 * the music path (the clock, the map, the bus, the high layer) already works
 * per-track and needed no opinion about which one.
 *
 * ROTATION, NOT SHUFFLE. A shuffle repeats, and a repeat inside a sitting is
 * the exact complaint this exists to answer. The index advances once per
 * session and wraps, so consecutive sittings walk the list in order.
 *
 * PER SESSION, NOT PER RUN, and that is a deliberate stopping point rather
 * than an oversight. Swapping mid-session means tearing down and rebuilding
 * the media-element source on the live audio graph between runs, for a
 * variety a player is not asking for ten seconds after the last one ended.
 * The picker below takes an index and does not care where it comes from, so
 * per-run is a two-line change here if it ever earns its risk.
 *
 * Portable, like the rest of src/music/: no DOM, no audio graph, no game. It
 * answers two questions and holds one list.
 */

/**
 * The scores that ship. Adding one is this line plus the three files named by
 * `urlsFor` — nothing else in the game needs to know the name.
 *
 * `bpm` is documentation, not behaviour: the tempo the game actually uses
 * comes from the track's own score map. It is here so a list of one is
 * obviously a list rather than a special case.
 */
export const SETLIST = Object.freeze([
  Object.freeze({ id: 'into-the-night', bpm: 164 }),
]);

/** A track id is one path segment and nothing clever: letters, digits, dashes. */
export const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * The three files a track is made of. The high layer is optional — RC9.7's
 * contract is that the game probes for it and synthesizes a placeholder when
 * it is missing — so this names it whether or not it exists.
 */
export function urlsFor(id) {
  if (!ID_RE.test(String(id || ''))) return null;
  return {
    track: `./audio/music/${id}.mp3`,
    map: `./audio/music/${id}.scoremap.json`,
    high: `./audio/music/${id}.high.mp3`,
  };
}

/**
 * The track for a session. `index` is a counter that only ever goes up; the
 * wrap is done here so no caller has to know how long the list is.
 */
export function pickTrack(index = 0, list = SETLIST) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const n = Number.isFinite(index) ? Math.floor(index) : 0;
  return list[((n % list.length) + list.length) % list.length];
}

export default { SETLIST, pickTrack, urlsFor, ID_RE };
