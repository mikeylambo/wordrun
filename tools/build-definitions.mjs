/**
 * Generate src/words/definitions.js — a short definition for every word in
 * the bank, from WordNet 3.0.
 *
 * Why this exists: DICTION DASH teaches a player which spelling is real, and
 * then never says what the word means. The recap already names every wrong
 * read; a definition beside it completes the literacy loop, and nothing else
 * in the genre does it. It has to ship offline like everything else — zero
 * external network calls at play time is a hard requirement — so the glosses
 * are extracted here, at build time, and bundled.
 *
 * Build-time only. `wordnet-db` is a devDependency and never reaches the
 * client; what ships is a flat id->string map.
 *
 *   npm i && node tools/build-definitions.mjs
 *
 * WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
 * Its licence permits redistribution with that notice, which travels in the
 * generated file's header and in public/../WORDNET-LICENSE.txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { TIERS } from '../src/words/wordlist.js';
import { isBlocked } from '../src/words/family-blocklist.js';

const require = createRequire(import.meta.url);
const DICT = require('wordnet-db').path;
const POS = ['noun', 'verb', 'adj', 'adv'];
const MAX_LEN = 76;

// data.<pos> is byte-offset addressed, so it is read whole and sliced.
const data = {};
const index = {};
for (const p of POS) {
  data[p] = fs.readFileSync(path.join(DICT, `data.${p}`), 'latin1');
  index[p] = new Map();
  const lines = fs.readFileSync(path.join(DICT, `index.${p}`), 'latin1').split('\n');
  for (const line of lines) {
    if (!line || line.startsWith(' ')) continue;   // licence header
    const f = line.split(' ');
    const lemma = f[0];
    if (!/^[a-z]+$/.test(lemma)) continue;         // no phrases, no proper nouns
    const senseCnt = +f[2];
    const ptrCnt = +f[3];
    const tagsense = +f[5 + ptrCnt];
    const offsets = f.slice(6 + ptrCnt, 6 + ptrCnt + senseCnt);
    index[p].set(lemma, { tagsense, offsets });
  }
}

/** The gloss for one synset offset: everything after ' | ', examples cut. */
function gloss(pos, offset) {
  const start = +offset;
  const end = data[pos].indexOf('\n', start);
  if (end < 0) return null;
  const line = data[pos].slice(start, end);
  const bar = line.indexOf(' | ');
  if (bar < 0) return null;
  let g = line.slice(bar + 3).trim();
  // WordNet packs usage examples after a semicolon, in quotes. The
  // definition is the first clause; the rest is illustration a plate-sized
  // line has no room for.
  g = g.split(';')[0].trim();
  // Domain and grammar markers lead a lot of glosses — '(chemistry)',
  // '(usually followed by `to')' — and read as noise on a results card.
  // Stripped BEFORE the example cut below, because those markers quote
  // things too and cutting at their quote would leave a dangling bracket.
  let prev;
  do { prev = g; g = g.replace(/^\([^)]*\)\s*/, '').trim(); } while (g !== prev);
  // Every WordNet usage example is quoted, in any of four quote characters.
  // The first one that follows real text is where the definition ends.
  const q = g.search(/["`\u201c\u2018]/);
  if (q > 8) g = g.slice(0, q).trim();
  g = g.replace(/[:,]\s*$/, '').trim();
  g = g.replace(/\s+/g, ' ');
  if (!g) return null;
  if (g.length > MAX_LEN) {
    const cut = g.lastIndexOf(' ', MAX_LEN);
    g = `${g.slice(0, cut > 24 ? cut : MAX_LEN).replace(/[,;:]$/, '')}…`;
  }
  return g;
}

// WordNet stores base forms, so a bank full of plurals and past tenses looks
// like a bank full of unknown words. These are WordNet's own detachment rules
// plus the handful of irregulars the bank actually carries — the database
// ships without its exception lists, so the irregulars are named here.
const DETACH = {
  noun: [['ies', 'y'], ['ches', 'ch'], ['shes', 'sh'], ['ses', 's'], ['xes', 'x'],
    ['zes', 'z'], ['men', 'man'], ['es', ''], ['s', '']],
  verb: [['ies', 'y'], ['ing', 'e'], ['ing', ''], ['ied', 'y'], ['ed', 'e'],
    ['ed', ''], ['es', 'e'], ['es', ''], ['s', '']],
  adj: [['est', 'e'], ['est', ''], ['er', 'e'], ['er', '']],
  adv: [],
};
const IRREGULAR = {
  brought: 'bring', dug: 'dig', flew: 'fly', gave: 'give', got: 'get',
  grew: 'grow', hid: 'hide', knew: 'know', met: 'meet', ran: 'run',
  sank: 'sink', seen: 'see', slid: 'slide', spun: 'spin', swam: 'swim',
  told: 'tell', took: 'take', went: 'go', wore: 'wear', wove: 'weave',
};

/** Every base form worth trying for a word, most literal first. */
function basesFor(word, pos) {
  const out = [word];
  if (IRREGULAR[word]) out.push(IRREGULAR[word]);
  for (const [suffix, replacement] of DETACH[pos] || []) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      out.push(word.slice(0, -suffix.length) + replacement);
    }
  }
  // A doubled final consonant before -ed/-ing: occurred -> occur.
  const dd = /^(.*?)([bdfglmnprt])\2(ed|ing)$/.exec(word);
  if (dd) out.push(dd[1] + dd[2]);
  return [...new Set(out)];
}

const bank = TIERS.flat();
const out = {};
let blockedSkips = 0;
const missing = [];

for (const w of bank) {
  // Pick the part of speech the word is most often used as: WordNet's
  // tagsense count is how many of its senses appear in the tagged corpus,
  // which is the closest thing here to "how people actually use it".
  const candidates = [];
  for (const p of POS) {
    for (const base of basesFor(w, p)) {
      const e = index[p].get(base);
      // `depth` keeps the literal lookup ahead of any morphological guess,
      // so 'saw' the noun never loses to 'see' the verb.
      if (e) { candidates.push({ p, e, depth: base === w ? 0 : 1 }); break; }
    }
  }
  candidates.sort((a, b) => (a.depth - b.depth) ||
    (b.e.tagsense - a.e.tagsense) || (POS.indexOf(a.p) - POS.indexOf(b.p)));
  if (!candidates.length) { missing.push(w); continue; }

  let chosen = null;
  outer:
  for (const { p, e } of candidates) {
    for (const off of e.offsets) {
      const g = gloss(p, off);
      if (!g) continue;
      // A definition is player-facing copy and clears the same bar the words
      // do. A blocked gloss falls through to the next sense rather than
      // dropping the word.
      if (isBlocked(g) || g.split(/[^a-z]+/).some((t) => t && isBlocked(t))) {
        blockedSkips++;
        continue;
      }
      chosen = g;
      break outer;
    }
  }
  if (chosen) out[w] = chosen; else missing.push(w);
}

const keys = Object.keys(out).sort();
const body = keys.map((k) => ` ${JSON.stringify(k)}:${JSON.stringify(out[k])}`).join(',\n');

fs.writeFileSync(new URL('../src/words/definitions.js', import.meta.url), `/**
 * GENERATED — do not edit. Regenerate with: node tools/build-definitions.mjs
 *
 * A short definition for every word in the bank, so the results card can say
 * what a missed word means instead of only that it was missed. Bundled, not
 * fetched: zero external network calls at play time is a hard requirement.
 *
 * Glosses are WordNet's first clause for the word's most-used sense, with
 * usage examples and domain markers cut and a ${MAX_LEN}-character cap. Every one
 * has been through the family blocklist, same as the words themselves.
 *
 * WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
 * Redistributed under its licence; full text in WORDNET-LICENSE.txt.
 */

export const DEFINITIONS = {
${body},
};

/** The definition for a word, or null when the bank has none. */
export function defineWord(word) {
  return DEFINITIONS[String(word || '').toLowerCase()] ?? null;
}

export default DEFINITIONS;
`);

const bytes = fs.statSync(new URL('../src/words/definitions.js', import.meta.url)).size;
console.log(`definitions.js written — ${keys.length}/${bank.length} words `
  + `(${(keys.length / bank.length * 100).toFixed(1)}% coverage), ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  ${blockedSkips} senses skipped by the family blocklist`);
if (missing.length) console.log(`  no gloss for ${missing.length}: ${missing.slice(0, 12).join(', ')}`);
