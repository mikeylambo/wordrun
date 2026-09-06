/**
 * RC9.2 — sharing a run is ONE act.
 *
 * There were two buttons. SHARE sent the image and the game's front page;
 * LINK copied the dare. Between them they split what a player means by
 * "share this run" into halves, and the half that gets skipped is the one
 * that makes the loop close — an image is a boast, a link is an invitation.
 * SHARE now does both: it copies the challenge link AND hands the image to
 * the share sheet with that link as its URL, so whichever way the message
 * travels it arrives with the route attached.
 *
 * The coordinates come from main.js (`__DASH_CHALLENGE_LINK`), which is the
 * only file that knows the seed, salt and bar the run was actually played at.
 * The link is a URL and building it makes no request: `audit:network` still
 * measures zero at play time.
 *
 * The clipboard write is STARTED before the share sheet opens and awaited
 * after it. Both want the same user gesture, and the sheet is the one that
 * loses it first.
 */

const $ = (id) => document.getElementById(id);

function shotDataUrl() {
  const src = $('shot')?.src || '';
  return src.startsWith('data:image/') ? src : '';
}

/** The run's score — the headline figure the card is already showing. */
function score() {
  const dom = Number.parseInt(($('finalDist')?.textContent || '').replace(/[^0-9]/g, ''), 10);
  if (Number.isFinite(dom)) return dom;
  return Math.max(0, Math.floor(globalThis.__SIM?.score || 0));
}

const fileName = () => `dictiondash-${score()}.png`;

function challengeLink() {
  try {
    const link = globalThis.__DASH_CHALLENGE_LINK?.();
    if (typeof link === 'string' && link) return link;
  } catch { /* the game has not finished a run yet */ }
  return new URL('/', location.href).href;
}

async function shotFile() {
  const src = shotDataUrl();
  if (!src) return null;
  try {
    const blob = await (await fetch(src)).blob();
    return new File([blob], fileName(), { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
}

async function saveImage() {
  const src = shotDataUrl();
  if (!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = fileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function flash(button, word) {
  const old = button.dataset.label || button.textContent;
  button.dataset.label = old;
  button.textContent = word;
  setTimeout(() => { button.textContent = button.dataset.label || old; }, 1200);
}

async function shareRun(button) {
  const url = challengeLink();
  const title = `DICTION DASH — ${score().toLocaleString('en-US')}`;
  const text = `${title}. Same route, your turn.`;
  // Started, not awaited: the share sheet below needs the same gesture and
  // is the one that expires first.
  const copying = navigator.clipboard?.writeText(url)
    .then(() => true, () => false) ?? Promise.resolve(false);
  const file = await shotFile();

  let shared = false;
  try {
    if (navigator.share) {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, url, files: [file] });
      } else {
        await navigator.share({ title, text, url });
      }
      shared = true;
    }
  } catch (err) {
    // A dismissed sheet is not a failure — the link is already on the
    // clipboard, which is the half that always works.
    if (err?.name !== 'AbortError') shared = false;
  }

  const copied = await copying;
  if (shared) return;
  if (copied) { flash(button, 'LINK COPIED'); return; }
  // Last-resort fallback: selecting the URL is still more useful than failing.
  prompt('Copy your DICTION DASH challenge', `${text} ${url}`);
}

function installShareUi() {
  const tray = $('shotBtns');
  const save = $('saveShot');
  if (!tray || !save) return;

  // The original SAVE button used the native share sheet when file sharing was
  // available. Keep SAVE literal now that sharing has its own explicit action.
  save.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    saveImage();
  }, true);

  let share = $('shareRun');
  if (!share) {
    share = document.createElement('button');
    share.id = 'shareRun';
    share.className = 'btn';
    share.dataset.rc2Ui = '1';
    share.textContent = 'SHARE';
    share.setAttribute('aria-label', 'Share this run and copy its challenge link');
    tray.prepend(share);
  }
  share.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    shareRun(share);
  });

  const style = document.createElement('style');
  style.id = 'v1-share-style';
  style.textContent = `
    #shotBtns{display:flex;align-items:center;gap:6px}
    #shotBtns #shareRun,#shotBtns #saveShot{position:relative;min-width:auto;padding:8px 10px;font-size:8px;opacity:.78}
    #shotBtns #shareRun{opacity:1;background:transparent;border:0;color:rgba(232,244,251,.42)}
  `;
  document.head.appendChild(style);
}

installShareUi();

globalThis.__DASH_SHARE = {
  version: '1.0-rc',
  nativeShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  fileShare: typeof navigator !== 'undefined' && typeof navigator.canShare === 'function',
  noExtraRaf: true,
};
