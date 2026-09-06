/**
 * RC10.7 — the one file in this game that can make a request.
 *
 * It is here, alone, in a directory of its own, so that "does this game talk
 * to anything?" is answered by looking at one place. Nothing imports it at
 * module scope: `meta/boards.js` reaches it by DYNAMIC IMPORT from `open()`,
 * which is called when a player asks to see a board and at no other time.
 * Boot does not load it, a run does not load it, and the results card does not
 * load it — which is what keeps `audit:network` reading zero through the only
 * path that matters.
 *
 * It is also deliberately thin. Two calls, both against PostgREST's own shape,
 * because the alternative is a client library in the bundle for two requests:
 *
 *   top(board, limit)   GET  a rows-only view, ordered, capped
 *   submit(payload)     POST a validating function, never a table
 *
 * THE CLIENT NEVER INSERTS. The anon key ships inside the bundle and is public
 * by construction, so the table grants no write to anyone: the only way a row
 * appears is through `submit_score`, which re-derives what it can and refuses
 * what it cannot (db/schema.sql). Anything this file sends is a claim, not a
 * fact, and it is written to be read that way.
 *
 * Dark until configured. `meta/boards.js` will not construct this without an
 * endpoint and a key, and nothing in the shipped build sets either.
 */

const TIMEOUT_MS = 6000;

/** Fetch with a deadline, so a board that never answers cannot hang a menu. */
async function withTimeout(url, init = {}) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl?.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class BoardTransport {
  /**
   * @param {{endpoint:string, key:string}} config PostgREST base URL and the
   *   publishable anon key. Both are public by design; neither grants a write.
   */
  constructor({ endpoint, key } = {}) {
    this.endpoint = String(endpoint || '').replace(/\/+$/, '');
    this.key = String(key || '');
    if (!this.endpoint || !this.key) throw new Error('board transport needs an endpoint and a key');
  }

  get _headers() {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /** The top of one board, newest-first among ties. */
  async top(board, limit = 20) {
    const q = new URLSearchParams({
      board: `eq.${board}`,
      select: 'name,score,created_at',
      order: 'score.desc,created_at.asc',
      limit: String(limit),
    });
    const res = await withTimeout(`${this.endpoint}/scores?${q}`, { headers: this._headers });
    if (!res.ok) throw new Error(`board read ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * Offer a run to a board. The function decides; this only carries.
   * A refusal is a normal outcome and is returned rather than thrown at the
   * caller as a failure of the game.
   */
  async submit(payload) {
    const res = await withTimeout(`${this.endpoint}/rpc/submit_score`, {
      method: 'POST',
      headers: this._headers,
      body: JSON.stringify({ p: payload }),
    });
    if (!res.ok) throw new Error(`board write ${res.status}`);
    return res.json();
  }
}

export default BoardTransport;
