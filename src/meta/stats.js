/**
 * StatsManager — ported from the SLU Web Shell's Layer-1 StatsManager
 * (src/game/StatsManager.ts) into WORD RUN's zero-dependency house style.
 *
 * Same contract, adapted: a flat key/value stat store over a pluggable
 * storage adapter — get / set / increment / snapshot — made synchronous
 * because the only adapter here is localStorage and the frame's Storage
 * module is already synchronous-defensive. The adapter seam is the point:
 * tools inject a memory adapter and assert against it, and a future
 * networked save swaps the adapter without touching call sites.
 *
 * No sim imports, no render imports — this is meta-layer state, like the
 * word list it can be lifted into the next game whole.
 */

/** localStorage adapter, namespaced and defensive like storage/storage.js. */
export function localStorageAdapter(ns = 'wordrun.v1.meta') {
  return {
    get(key) {
      try {
        const raw = localStorage.getItem(`${ns}.${key}`);
        return raw == null ? null : JSON.parse(raw);
      } catch { return null; }
    },
    set(key, value) {
      try {
        localStorage.setItem(`${ns}.${key}`, JSON.stringify(value));
        return true;
      } catch { return false; }
    },
  };
}

/** In-memory adapter for tools/tests — the shell's StorageAdapter seam. */
export function memoryAdapter(seedData = {}) {
  const db = { ...seedData };
  return {
    get: (key) => (key in db ? JSON.parse(JSON.stringify(db[key])) : null),
    set: (key, value) => { db[key] = JSON.parse(JSON.stringify(value)); return true; },
    _db: db,
  };
}

export class StatsManager {
  constructor(adapter, key = 'stats') {
    this.adapter = adapter;
    this.key = key;
    this.stats = adapter?.get(key) ?? {};
    if (typeof this.stats !== 'object' || this.stats === null) this.stats = {};
  }

  get(key, fallback = 0) {
    return this.stats[key] ?? fallback;
  }

  set(key, value) {
    this.stats[key] = value;
    this._persist();
    return value;
  }

  /** Keep the larger of the stored and offered value (bests). */
  max(key, value) {
    const next = Math.max(Number(this.stats[key] ?? 0), value);
    this.stats[key] = next;
    this._persist();
    return next;
  }

  increment(key, amount = 1) {
    const next = Number(this.stats[key] ?? 0) + amount;
    this.stats[key] = next;
    this._persist();
    return next;
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.stats));
  }

  _persist() {
    this.adapter?.set(this.key, this.stats);
  }
}

export default StatsManager;
