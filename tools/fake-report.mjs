/**
 * npm run report:fakes -- <export.json> [more.json …]
 *
 * Aggregates the `fakes` section of any number of STATS exports (the blob the
 * results card's STATS button copies; see src/meta/fake-tally.js) into the
 * two questions a fake bank is tuned on:
 *
 *   - Which MUTATION FAMILY is too easy or too hard? (tap rate per family)
 *   - Which printed fakes fool almost everyone (unfair — a trivia question
 *     that costs a heart) and which fool no one (a wasted gate)?
 *
 * An export file may hold one blob or a JSON array of them, so a playtest
 * round can be pasted into one file. Nothing here touches the network.
 */

import fs from 'node:fs';

export function aggregateFakes(exports) {
  const families = {};
  const words = {};
  let players = 0;
  for (const ex of exports) {
    const f = ex?.fakes;
    if (!f) continue;
    players++;
    for (const [name, v] of Object.entries(f.families || {})) {
      const t = families[name] || (families[name] = { shown: 0, tapped: 0 });
      t.shown += v.shown || 0;
      t.tapped += v.tapped || 0;
    }
    for (const line of [...(f.fooling || []), ...(f.ignored || [])]) {
      const m = /^(.+)>(.+):([^:]+):(\d+)\/(\d+)$/.exec(line);
      if (!m) continue;
      const [, fake, answer, family, tapped, shown] = m;
      const w = words[fake] || (words[fake] = { answer, family, shown: 0, tapped: 0, players: 0 });
      w.shown += +shown;
      w.tapped += +tapped;
      w.players++;
    }
  }
  return { players, families, words };
}

/** Fakes that fool at least `unfair` of the time, or never, with enough evidence. */
export function verdicts({ words }, { minShown = 4, unfair = 0.6 } = {}) {
  const rows = Object.entries(words).filter(([, w]) => w.shown >= minShown);
  const rate = (w) => w.tapped / w.shown;
  return {
    unfair: rows.filter(([, w]) => rate(w) >= unfair).sort((a, b) => rate(b[1]) - rate(a[1])),
    wasted: rows.filter(([, w]) => w.tapped === 0).sort((a, b) => b[1].shown - a[1].shown),
  };
}

function main(files) {
  if (!files.length) {
    console.log('usage: npm run report:fakes -- <export.json> [more.json …]');
    process.exit(2);
  }
  const exports = files.flatMap((f) => {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(data) ? data : [data];
  });
  const agg = aggregateFakes(exports);
  const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
  console.log(`\nFAKES — ${agg.players} export(s)\n`);
  console.log('family      shown  tapped  tap rate');
  for (const [name, v] of Object.entries(agg.families).sort((a, b) => b[1].tapped / b[1].shown - a[1].tapped / a[1].shown)) {
    console.log(`${name.padEnd(10)} ${String(v.shown).padStart(6)} ${String(v.tapped).padStart(7)}  ${pct(v.tapped, v.shown).padStart(8)}`);
  }
  const { unfair, wasted } = verdicts(agg);
  const row = ([fake, w]) => `  ${fake.padEnd(14)} (${w.answer}, ${w.family})  ${w.tapped}/${w.shown}  ${pct(w.tapped, w.shown)}`;
  console.log(`\nfool almost everyone (≥60%, shown ≥4) — candidates to retire or move up a tier:`);
  console.log(unfair.length ? unfair.map(row).join('\n') : '  none');
  console.log(`\nfool no one (0 taps, shown ≥4) — candidates for a harder bend:`);
  console.log(wasted.length ? wasted.slice(0, 25).map(row).join('\n') : '  none');
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
