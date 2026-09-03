# 1.0-RC device soak — run on a real phone

**Build:** https://wordrun-woad.vercel.app (production, auto-deploys from the
default branch). Confirm the build first: open SETTINGS — the heading must
say SETTINGS with GAME / VISUAL / AUDIO groups (that is the RC).

Play in the phone's browser first; repeat anything that felt off after
installing to the home screen (PWA).

## Checklist — tick each, note anything that felt wrong

### Feel and correctness
- [ ] **Fresh-eyes opening** (or with GUIDED TIPS re-enabled): the essence
      card, the arrival, the two TEACH prompts — do they land in order,
      and does teaching stop once you have done each thing?
- [ ] **The answer moment**: rapid answering for a full minute — does any
      word EVER resolve you did not choose? (This is the sign-off on the
      preselect bug.)
- [ ] **Full DAILY to FINISH**: the hundredth gate arrival, the choice,
      END RUN → the results card counts up and says FINISH.
- [ ] **RUN OVER** the ordinary way, buy a **continue** once, and let one
      run end without buying — all three paths reach the card cleanly.
- [ ] **Retry loop**: ten AGAINs back to back — the quick cut every time,
      never the full ceremony; nothing accumulates (audio, overlays, lag).
- [ ] **Sheets are modal**: with settings/shop/profile open, tap around —
      nothing behind may react, and no run may start.

### Performance and device
- [ ] **Frame feel** at cruise and at DASH speed — any stutter, note where
      (opening, tunnel, canyon, the arrival, the card).
- [ ] **5-minute thermal**: one long ENDLESS sitting — does the phone heat
      and the frame rate sag near the end?
- [ ] **Stats export**: paste the snippet below into the browser console
      (or a bookmarklet) BEFORE a run, play ~60s, then send back the JSON
      it copies/prints.
- [ ] **Safe areas**: notch/home-bar devices — the HUD, buttons and the
      TEACH text clear of both.
- [ ] **Landscape**: rotate mid-run and on the title — intentional, not
      merely unbroken.
- [ ] **Audio mix**: arrival strikes, the typeset ticks, the wrong-read
      crash — levels relative to music, with and without headphones.

## Paste-back stats snippet

Paste in the console, tap BEGIN RUN, play about a minute; it then copies a
JSON blob to the clipboard (and prints it) — paste that back to Claude.

```js
(() => { const d = []; let last = performance.now(); const t0 = last;
const s = (now) => { d.push(now - last); last = now;
  if (now - t0 < 65000) requestAnimationFrame(s); else {
    d.splice(0, 120); d.sort((a, b) => a - b);
    const q = (p) => +d[Math.floor(d.length * p)].toFixed(1);
    const out = JSON.stringify({ frames: d.length, p50: q(0.5), p95: q(0.95),
      p99: q(0.99), worst: +d[d.length - 1].toFixed(1),
      ua: navigator.userAgent.slice(0, 60) });
    console.log(out); navigator.clipboard?.writeText(out); } };
requestAnimationFrame(s); console.log('sampling 65s — go'); })();
```

Targets: p95 ≤ 20 ms on a 60 Hz phone (≤ 10 ms at 120 Hz); p99 spikes are
fine if rare and not clustered at the arrival or the card.

## What NOT to file
Board/leaderboard wishes (Pass 3, held), new mechanics, art direction
changes — the RC question is only: *does what exists feel finished?*
