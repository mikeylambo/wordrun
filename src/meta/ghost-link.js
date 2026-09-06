/**
 * RC10.5 — the rival's run, small enough to travel in a link.
 *
 * A challenge has always been coordinates: same seed, same rules, same words,
 * and a number to chase. A number is a poor opponent. What a player actually
 * wants to know is whether they are AHEAD, and that is a question only a
 * second runner on the same road can answer — so the link carries one.
 *
 * THE RECORDED GHOST DOES NOT FIT AND DOES NOT NEED TO. `sim/ghost.js` samples
 * [t, x, y, d, state] at 10 Hz — about 4 kB for two minutes, which is not a
 * link anyone can send. It does not have to travel, because the receiver
 * already has the road: this track is auto-followed, so x and y are FUNCTIONS
 * of d, and the only thing that is genuinely the rival's is how far along they
 * were at each moment. The link carries SPEED, one byte every half second, and
 * the ghost is rebuilt against the receiver's own terrain.
 *
 *   180 s at 2 Hz = 360 bytes = 480 base64 characters.
 *
 * That is a link that survives being pasted into a message. A longer run is
 * truncated rather than dropped: the rival simply stops being ahead of you at
 * three minutes, which is exactly what `GhostPlayer` already does at the end
 * of any ghost — it yanks into the fog and goes.
 *
 * WHAT IS LOST, deliberately: air, stagger and the dash flag. Those are pose,
 * they cost a byte each per sample, and a rival three seconds up the road is
 * read as a position rather than a posture. The height comes from the terrain,
 * which is the same terrain that put them there.
 *
 * Pure: bytes in, bytes out, and the one place it needs to know where a
 * distance sits in the world takes a callback rather than importing terrain.
 * No DOM, no sim, no storage — the gates drive every branch in node.
 */

import TUNING from '../TUNING.js';

/** Samples per second in a link. Two is smooth: the runner is interpolated. */
export const LINK_HZ = 2;
/**
 * Metres per second per byte step: 255 * 0.28 = 71.4, clear of the 64 m/s
 * ceiling with room above it. A LITERAL, deliberately, and not derived from
 * TUNING.RUN.CEILING — this is a wire format. Links live in other people's
 * messages for as long as they care to keep them, and a dial that moved would
 * silently re-scale every rival already out in the world. The resolution it
 * costs is 0.28 m/s, which is 14 cm of position over the half second between
 * samples, against a runner the size of a person.
 */
export const LINK_SPEED_STEP = 0.28;
/** The cap. Past this the rival has simply gone. */
export const LINK_MAX_SECONDS = 180;
export const LINK_MAX_SAMPLES = LINK_HZ * LINK_MAX_SECONDS;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = (() => {
  const m = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) m[ALPHABET.charCodeAt(i)] = i;
  return m;
})();

/**
 * base64url, written out rather than reached for: `btoa` is DOM, `Buffer` is
 * node, and this file has to run in both and be driven by a gate in neither.
 * No padding — a link is not a MIME body.
 */
export function encodeBytes(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const has2 = b !== undefined, has3 = c !== undefined;
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | (has2 ? b >> 4 : 0)];
    if (!has2) break;
    out += ALPHABET[((b & 15) << 2) | (has3 ? c >> 6 : 0)];
    if (!has3) break;
    out += ALPHABET[c & 63];
  }
  return out;
}

/** The inverse. Returns null for anything that is not this alphabet. */
export function decodeBytes(str) {
  const s = String(str || '');
  if (!s) return new Uint8Array(0);
  const out = [];
  let acc = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = s.charCodeAt(i) < 128 ? LOOKUP[s.charCodeAt(i)] : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  return new Uint8Array(out);
}

/**
 * A recorded run, as link-sized speeds.
 *
 * @param {number[]} samples the recorder's flat [t,x,y,d,state] quintuples
 * @returns {Uint8Array} one speed byte per 1/LINK_HZ second
 */
export function trackFromSamples(samples) {
  const STRIDE = 5;
  const n = Array.isArray(samples) ? Math.floor(samples.length / STRIDE) : 0;
  if (n < 2) return new Uint8Array(0);
  const step = 1 / LINK_HZ;
  const endT = samples[(n - 1) * STRIDE] / 100;
  const count = Math.min(LINK_MAX_SAMPLES, Math.floor(endT / step));
  const bytes = new Uint8Array(Math.max(0, count));
  // Walk the samples once, reading distance at each half-second boundary and
  // storing the speed that carried the runner across it.
  let i = 0, prevD = samples[3] / 10;
  for (let k = 0; k < count; k++) {
    const want = (k + 1) * step * 100;
    while (i < n - 1 && samples[(i + 1) * STRIDE] <= want) i++;
    const d = samples[i * STRIDE + 3] / 10;
    const v = Math.max(0, (d - prevD) / step);
    bytes[k] = Math.max(0, Math.min(255, Math.round(v / LINK_SPEED_STEP)));
    prevD = d;
  }
  return bytes;
}

/**
 * Rebuild a ghost the local `GhostPlayer` can load, by integrating the speeds
 * against the receiver's own road.
 *
 * @param {Uint8Array} bytes
 * @param {(d:number)=>{x:number,y:number}} place where a distance sits
 * @param {number} startD the distance a run begins at, so the two agree
 */
export function expandTrack(bytes, place, startD = 0) {
  if (!bytes || bytes.length < 2) return null;
  const step = 1 / LINK_HZ;
  const s = [];
  let d = startD;
  for (let k = 0; k <= bytes.length; k++) {
    const at = place(d) || { x: 0, y: 0 };
    s.push(Math.round(k * step * 100), Math.round(at.x * 10), Math.round(at.y * 10),
      Math.round(d * 10), 0);
    if (k < bytes.length) d += bytes[k] * LINK_SPEED_STEP * step;
  }
  return { v: 1, seed: 0, distance: Math.round(d), hz: LINK_HZ, s, fromLink: true };
}

/** How far the rival got, in metres — for the copy, without expanding it. */
export function trackDistance(bytes, startD = 0) {
  if (!bytes?.length) return 0;
  let d = startD;
  for (let k = 0; k < bytes.length; k++) d += bytes[k] * LINK_SPEED_STEP / LINK_HZ;
  return Math.round(d);
}

/** The dials this file is built on, for the gates and the audit. */
export const GHOST_LINK = {
  LINK_HZ, LINK_SPEED_STEP, LINK_MAX_SECONDS, LINK_MAX_SAMPLES,
  MAX_CHARS: Math.ceil((LINK_MAX_SAMPLES * 4) / 3),
  CEILING: TUNING.RUN.CEILING,
};

export default { trackFromSamples, expandTrack, encodeBytes, decodeBytes };
