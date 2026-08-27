/** Canonical places inside today's otherwise procedural mountain. */
export const LANDMARKS = [
  { id: 'house', name: 'STARTING HOUSE', d: 170, kind: 'house', stunt: false, window: 0, push: 0 },
  { id: 'needles', name: 'THE NEEDLES', d: 690, kind: 'needles', stunt: true, window: 72, push: 11 },
  { id: 'big-drop', name: 'BIG DROP', d: 1240, kind: 'drop', stunt: true, window: 78, push: 12 },
  { id: 'halfpipe', name: 'HALFPIPE', d: 1810, kind: 'halfpipe', behavior: 'ride-walls', stunt: true, window: 82, push: 13 },
  { id: 'bridge', name: 'THE BRIDGE', d: 2380, kind: 'bridge', behavior: 'big-air', stunt: true, window: 74, push: 12 },
  { id: 'throat', name: 'THE THROAT', d: 3020, kind: 'throat', behavior: 'fast-chute', stunt: true, window: 90, push: 15 },

  { id: 'teeth', name: 'THE TEETH', d: 3880, kind: 'teeth', stunt: true, window: 92, push: 14 },
  { id: 'sky-ramp', name: 'SKY RAMP', d: 4680, kind: 'ramp', behavior: 'big-air', stunt: true, window: 105, push: 17 },
  { id: 'tunnel', name: 'THE TUNNEL', d: 5580, kind: 'tunnel', stunt: true, window: 90, push: 15 },
  { id: 'dead-lift', name: 'DEAD LIFT', d: 6480, kind: 'lift', behavior: 'silhouette-field', stunt: false, window: 0, push: 0 },
  { id: 'ribcage', name: 'RIBCAGE', d: 7480, kind: 'ribcage', stunt: true, window: 110, push: 18 },
  { id: 'white-gate', name: 'WHITE GATE', d: 8620, kind: 'whitegate', stunt: true, window: 96, push: 16 },
  { id: 'wall', name: 'THE WALL', d: 9760, kind: 'wall', stunt: true, window: 110, push: 18 },
  { id: 'shards', name: 'BLACK GLASS', d: 11020, kind: 'shards', behavior: 'ice', stunt: true, window: 105, push: 18 },
  { id: 'last-lift', name: 'LAST LIFT', d: 12420, kind: 'lastlift', stunt: false, window: 0, push: 0 },
  { id: 'afterlight', name: 'AFTERLIGHT', d: 14100, kind: 'afterlight', stunt: true, window: 120, push: 20 },

  // Expert-run geography. Same primitive vocabulary, stranger arrangements.
  { id: 'bell-tower', name: 'BELL TOWER', d: 15880, kind: 'belltower', stunt: true, window: 125, push: 20 },
  { id: 'mouth', name: 'THE MOUTH', d: 17760, kind: 'mouth', stunt: true, window: 130, push: 21 },
  { id: 'sunken-lodge', name: 'SUNKEN LODGE', d: 19740, kind: 'sunkenlodge', stunt: false, window: 0, push: 0 },
  { id: 'moonshot', name: 'MOONSHOT', d: 21820, kind: 'moonshot', behavior: 'big-air', stunt: true, window: 145, push: 23 },
];

export const DISTANCE_MARKERS = [5000, 10000, 15000, 20000, 25000, 30000];

export function stuntLandmarkAt(distance) {
  for (const l of LANDMARKS) {
    if (!l.stunt) continue;
    if (Math.abs(distance - l.d) <= l.window) return l;
  }
  return null;
}

export function nextLandmark(distance) {
  for (const l of LANDMARKS) if (l.d > distance) return l;
  return null;
}

export default LANDMARKS;
