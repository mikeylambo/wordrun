/**
 * How often each kind of fake fools this player — the data a fair fake bank
 * is tuned from.
 *
 * A fake nobody ever taps is a wasted gate: it reads as obviously wrong and
 * tests nothing. A fake that fools nearly everyone stops being a reading test
 * and becomes a trivia question the game punishes with a heart. Both are
 * invisible without numbers, and the build has no telemetry by design — so
 * this ledger keeps them locally, by mutation family and by printed fake,
 * and rides along in the STATS export a playtester pastes back.
 * `npm run report:fakes` aggregates any number of those exports.
 *
 * Only FAKES are counted. "Tapped" means the player called it real (the
 * heart-costing mistake); "shown" is every fake that resolved, tapped or not.
 * Bounded: the per-word table keeps the CAP most-shown fakes.
 */

import { MUTATION_FAMILIES } from '../words/wordlist.js';

const CAP = 240;
const familyName = (f) => MUTATION_FAMILIES[f] ?? (f == null ? 'unknown' : String(f));

export class FakeTally {
  constructor(adapter, key = 'fakeTally') {
    this.adapter = adapter;
    this.key = key;
    const raw = adapter?.get?.(key);
    this.families = raw && typeof raw.families === 'object' ? raw.families : {};
    this.words = raw && typeof raw.words === 'object' ? raw.words : {};
  }

  /** One resolved fake. `fake` is the printed spelling, `answer` the word it bent. */
  record({ family, fake, answer, tapped }) {
    if (!fake) return;
    const name = familyName(family);
    const f = this.families[name] || (this.families[name] = { shown: 0, tapped: 0 });
    f.shown++;
    if (tapped) f.tapped++;
    const w = this.words[fake] || (this.words[fake] = { answer, family: name, shown: 0, tapped: 0 });
    w.shown++;
    if (tapped) w.tapped++;
    const ids = Object.keys(this.words);
    if (ids.length > CAP) {
      ids.sort((a, b) => this.words[a].shown - this.words[b].shown);
      for (const id of ids.slice(0, ids.length - CAP)) delete this.words[id];
    }
    this.adapter?.set?.(this.key, { families: this.families, words: this.words });
  }

  /**
   * The export's view: every family, plus the fakes worth a look at BOTH
   * ends — the ones that fool this player most, and the ones seen most often
   * without ever fooling them. Words are compact one-line strings,
   * `fake>answer:family:tapped/shown`, so a pasted export stays readable.
   */
  snapshot({ each = 15 } = {}) {
    const all = Object.entries(this.words).filter(([, w]) => w.shown >= 2);
    const line = ([fake, w]) => `${fake}>${w.answer}:${w.family}:${w.tapped}/${w.shown}`;
    const fooling = all.filter(([, w]) => w.tapped > 0)
      .sort((a, b) => b[1].tapped / b[1].shown - a[1].tapped / a[1].shown || b[1].shown - a[1].shown)
      .slice(0, each).map(line);
    const ignored = all.filter(([, w]) => w.tapped === 0)
      .sort((a, b) => b[1].shown - a[1].shown)
      .slice(0, each).map(line);
    return { families: JSON.parse(JSON.stringify(this.families)), fooling, ignored };
  }
}

export const FAKE_TALLY = { CAP };
