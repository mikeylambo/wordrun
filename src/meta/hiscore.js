/**
 * RC13.7 — the cabinet's high-score table, kept on this device.
 *
 * Ten rows per board, three initials per row, the way a coin-op has always
 * done it. The BOARD is the same policy string meta/boards.js serialises for
 * a future server (the DAILY RUN on NORMAL, per day; ENDLESS per difficulty;
 * a continued run never belongs on one), so the local table and any online
 * one can never disagree about which runs count.
 *
 * Pure: no DOM, no storage, no sim. Storage holds the rows; the gates drive
 * every function here in node.
 */

import { isBlocked } from '../words/family-blocklist.js';

export const TABLE_SIZE = 10;
export const INITIALS_LEN = 3;
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Three letters is short enough that the word list's blocklist misses the
// classics a cabinet has always refused. These are checked as well.
const BLOCKED_INITIALS = new Set([
  'ASS', 'FUK', 'FUC', 'FCK', 'FKU', 'SHT', 'CUM', 'COK', 'DIK', 'DIC', 'TIT',
  'SEX', 'XXX', 'KKK', 'NIG', 'NGR', 'FAG', 'GAY', 'JIZ', 'POO', 'PEE', 'WTF',
  'KYS', 'NAZ', 'HOE', 'VAG', 'PUS', 'CNT', 'KUN', 'SUK', 'SUC',
]);

/** Three capital letters a general audience can see, or null. */
export function cleanInitials(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length !== INITIALS_LEN) return null;
  if (BLOCKED_INITIALS.has(s) || isBlocked(s.toLowerCase())) return null;
  return s;
}

/** Rows, sanitised: highest first, at most TABLE_SIZE, every field checked. */
export function normalise(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({ i: cleanInitials(r?.i), s: Math.floor(Number(r?.s)), t: Math.floor(Number(r?.t) || 0) }))
    .filter((r) => r.i && Number.isFinite(r.s) && r.s > 0)
    .sort((a, b) => b.s - a.s || a.t - b.t)
    .slice(0, TABLE_SIZE);
}

/** The place (1-based) a score would take, or 0 when it makes no row. */
export function placeFor(rows, score) {
  const s = Math.floor(Number(score));
  if (!(s > 0)) return 0;
  const t = normalise(rows);
  // A tie goes BELOW the score already there: the earlier run keeps its row.
  const at = t.findIndex((r) => s > r.s);
  const place = at === -1 ? t.length + 1 : at + 1;
  return place <= TABLE_SIZE ? place : 0;
}

/** The table with this run written into it, and the place it took. */
export function insert(rows, { initials, score, time = 0 }) {
  const i = cleanInitials(initials);
  const place = placeFor(rows, score);
  if (!i || !place) return { rows: normalise(rows), place: 0 };
  const t = normalise(rows);
  t.splice(place - 1, 0, { i, s: Math.floor(score), t: Math.floor(time) });
  return { rows: t.slice(0, TABLE_SIZE), place };
}

/** Step one letter of the alphabet, wrapping — the ▲ / ▼ on each slot. */
export function stepLetter(ch, dir) {
  const k = ALPHABET.indexOf(String(ch).toUpperCase());
  const n = ALPHABET.length;
  return ALPHABET[(((k < 0 ? 0 : k) + Math.sign(dir)) % n + n) % n];
}
