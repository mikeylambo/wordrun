/**
 * RC10.7 — boards, built dark.
 *
 * Everything a leaderboard needs on this side of the wire, and nothing that
 * reaches across it. There is no endpoint configured, so `enabled` is false,
 * no surface appears, and the game behaves exactly as it did yesterday. What
 * this file is for is that the DECISIONS are made and checkable now, in one
 * place, rather than being invented in a hurry the day a server exists.
 *
 * WHY DARK. Two reasons, both real:
 *
 *  - HARD's reading window is still provisional. A board freezes difficulty
 *    semantics permanently — scores recorded under a window that later moves
 *    are scores that can never be compared again — so no score may be written
 *    anywhere until that number is played on a phone and fixed.
 *  - Zero network at play time is a standing constraint, not a preference.
 *    The transport lives in its own file and is reached by DYNAMIC IMPORT from
 *    `open()` alone, so the module that could make a request is not even
 *    loaded during boot, a run, or the results card. `audit:network` measures
 *    that rather than trusting it.
 *
 * THE BOARD KEY IS THE POLICY, SERIALISED. `TUNING.META.BOARD_POLICY` already
 * decided the rules — the DAILY RUN records on NORMAL only, ENDLESS keeps a
 * board per difficulty, a continued run is never eligible — and this turns
 * them into one opaque string. Opaque on purpose: the server stores a `board`
 * column and never parses it, so a new board shape is a client change and not
 * a migration.
 *
 * Pure and transport-injected: no DOM, no fetch, no storage, no sim. The gates
 * drive every branch with a fake transport and never touch a network.
 */

import TUNING from '../TUNING.js';

const POLICY = TUNING.META.BOARD_POLICY;

/** Names are player-supplied text, so the rules about them live here. */
export const NAME = { MIN: 1, MAX: 12 };

/**
 * The board a run belongs to, or null when the run does not belong on one.
 *
 * `day` is the DAILY RUN's own date string, because a daily board is only
 * comparable within its day — every player read the same hundred words that
 * day and nobody else ever will.
 */
export function boardKeyFor({ mode, difficulty, continued = false, day = '' } = {}) {
  if (continued && !POLICY.CONTINUE_ELIGIBLE) return null;
  if (mode === 'standard') {
    if (difficulty !== POLICY.DAILY_DIFFICULTY) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return null;
    return `daily:${day}:${POLICY.DAILY_DIFFICULTY}`;
  }
  if (mode !== 'endless') return null;
  return POLICY.ENDLESS_PER_DIFFICULTY ? `endless:${difficulty}` : 'endless';
}

/**
 * Is this name usable? Trimmed, bounded, and printable — the server checks
 * the same thing against the family blocklist, because a leaderboard of
 * free text is the fastest way a general-audience game stops being one.
 * This is the client half: shape only, never a judgement about content.
 */
export function cleanName(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < NAME.MIN || s.length > NAME.MAX) return null;
  // Printable ASCII plus the common accented range; no control characters,
  // no direction marks, nothing that can rewrite the row it sits in.
  if (!/^[\x20-\x7EÀ-ɏ]+$/.test(s)) return null;
  return s;
}

/**
 * The payload a submission carries. Deliberately small and deliberately
 * NOT trusted: every number here is re-derived or bounds-checked server-side
 * (see db/schema.sql). It travels so the server can check it, not so the
 * server can believe it.
 */
export function submissionFor(run = {}) {
  const board = boardKeyFor(run);
  const name = cleanName(run.name);
  if (!board || !name) return null;
  const score = Math.floor(Number(run.score));
  if (!Number.isFinite(score) || score < 0) return null;
  return {
    board,
    name,
    score,
    // The evidence the server prices the score against. A run that claims a
    // score its own distance and gate count cannot support is refused there.
    seed: String(run.seedString || ''),
    distance: Math.max(0, Math.floor(Number(run.distance) || 0)),
    gates: Math.max(0, Math.floor(Number(run.gates) || 0)),
    seconds: Math.max(0, Math.round(Number(run.seconds) || 0)),
    build: String(run.build || ''),
  };
}

/**
 * The board client. Constructed with a transport or without one; without one
 * it is inert and every call is a no-op that answers "no board".
 *
 * The transport is never imported at module scope — see `open()`.
 */
export class Boards {
  /**
   * @param {{endpoint?:string, key?:string}} config unset means dark
   * @param {object} [transport] injected in tests; production loads its own
   */
  constructor(config = {}, transport = null) {
    this.config = config || {};
    this.transport = transport;
    this.error = null;
  }

  /** Is there a board at all? False everywhere until an endpoint is set. */
  get enabled() {
    return !!(this.transport || (this.config.endpoint && this.config.key));
  }

  /**
   * Load the transport, the first time a player actually asks for a board.
   *
   * The dynamic import is the whole point: the one module in this game that
   * can make a request is not part of the boot graph, so a run cannot reach
   * it however wrong anything else goes.
   */
  async open() {
    if (!this.enabled) return null;
    if (!this.transport) {
      const mod = await import('../net/board-transport.js');
      this.transport = new mod.BoardTransport(this.config);
    }
    return this.transport;
  }

  /** The top of a board, or null when there is no board. */
  async top(board, limit = 20) {
    const t = await this.open();
    if (!t || !board) return null;
    try {
      return await t.top(board, Math.max(1, Math.min(100, Math.floor(limit))));
    } catch (err) { this.error = String(err?.message || err); return null; }
  }

  /**
   * Submit a run. Returns null when there is no board, the run is ineligible,
   * or the write is refused — a board is a bonus and may never be able to
   * fail the game that fed it.
   */
  async submit(run) {
    const payload = submissionFor(run);
    if (!payload) return null;
    const t = await this.open();
    if (!t) return null;
    try {
      return await t.submit(payload);
    } catch (err) { this.error = String(err?.message || err); return null; }
  }
}

export default Boards;
