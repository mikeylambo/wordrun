/**
 * The share card — the frame the run ended on, scaled to 720 wide, with a
 * soft foot gradient and the run's flow band. Pure: canvas in, PNG data URL
 * out. (Extracted from main.js, which still decides WHEN to take it.)
 */

export function composeShareCard(srcCanvas, flowLevel) {
  const w = 720;
  const h = Math.round((srcCanvas.height / srcCanvas.width) * w);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  g.drawImage(srcCanvas, 0, 0, w, h);
  const grad = g.createLinearGradient(0, h * 0.62, 0, h);
  grad.addColorStop(0, 'rgba(10,14,19,0)');
  grad.addColorStop(1, 'rgba(10,14,19,0.24)');
  g.fillStyle = grad;
  g.fillRect(0, h * 0.62, w, h * 0.38);
  // Phase S: the share card renders the run's flow band — one centred rule
  // whose length and brightness are the flow level the run ended on, in the
  // flow's own ice cyan. Zero flow still draws the idle hairline: the card
  // always says which game it is, never nothing.
  const f = flowLevel;
  const bandH = Math.max(3, Math.round(h * 0.008));
  const bandW = Math.round(w * (0.22 + 0.7 * f));
  g.fillStyle = `rgba(103,216,255,${(0.34 + 0.58 * f).toFixed(3)})`;
  g.fillRect(Math.round((w - bandW) / 2), h - bandH * 3, bandW, bandH);
  return out.toDataURL('image/png');
}
