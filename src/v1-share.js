const $ = (id) => document.getElementById(id);

function shotDataUrl() {
  const src = $('shot')?.src || '';
  return src.startsWith('data:image/') ? src : '';
}

function distance() {
  const dom = Number.parseInt($('finalDist')?.textContent || '', 10);
  if (Number.isFinite(dom)) return dom;
  return Math.max(0, Math.floor(globalThis.__SIM?.distance || 0));
}

function shareText() {
  return `DICTION DASH — ${distance()}M. How far can you go?`;
}

async function shotFile() {
  const src = shotDataUrl();
  if (!src) return null;
  try {
    const blob = await (await fetch(src)).blob();
    return new File([blob], `dictiondash-${distance()}m.png`, { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
}

async function saveImage() {
  const src = shotDataUrl();
  if (!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = `dictiondash-${distance()}m.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function shareRun(button) {
  const title = `DICTION DASH — ${distance()}M`;
  const text = shareText();
  const url = new URL('/', location.href).href;
  const file = await shotFile();

  try {
    if (navigator.share) {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, url, files: [file] });
      } else {
        await navigator.share({ title, text, url });
      }
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    const old = button.textContent;
    button.textContent = 'COPIED';
    setTimeout(() => { button.textContent = old; }, 1100);
  } catch {
    // Last-resort fallback: selecting the URL is still more useful than failing.
    prompt('Copy your DICTION DASH run', `${text} ${url}`);
  }
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
    share.setAttribute('aria-label', 'Share this DICTION DASH run');
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
