/**
 * What does the world actually PEAK at?
 *
 * Everything in this game that matters is a light, and a light that never
 * crosses 1.0 radiance can never roll to white through the tone map and can
 * never be more than a smudge in the bright pass. That is why turning bloom
 * strength up did nothing for a whole pass: the bloom had nothing to bite
 * on. A number here under 1.000 is a surface that will look painted on, no
 * matter what the post chain does.
 *
 * The coefficients are PARSED out of the source rather than mirrored here.
 * A mirror drifts, and a drifted mirror is exactly how this project has
 * twice been sent chasing a problem that had already moved.
 *
 *   node dev/measure-emissives.mjs
 */
import { readFileSync } from 'node:fs';
import { MOUNTAIN_BANDS } from '../src/render/art-direction.js';
import { INK } from '../src/render/editorial-layout.js';
import TUNING from '../src/TUNING.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const num = (src, re, label) => {
  const m = re.exec(src);
  if (!m) throw new Error(`could not parse ${label} — the source moved, fix this tool`);
  return Number(m[1]);
};

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toLin = (hex) => [16, 8, 0].map((s) => lin(((hex >> s) & 255) / 255));
const peak = (rgb, mul) => Math.max(...rgb.map((v) => v * mul));
const row = (name, v) => console.log(
  `    ${name.padEnd(12)} ${v.toFixed(3)}${v >= 1 ? '   <- rolls to white' : ''}`);

const FLOW_MAX = 1.75;                       // flow-curve.js GLOW_MAX
const ink = INK[INK.length - 1];

const fantasy = read('../src/render/speed-fantasy.js');
const pass = read('../src/render/material-pass.js');
const world = read('../src/render/editorial-world.js');

console.log(`peak linear radiance, at full flow (${FLOW_MAX}) and the brightest ink step\n`);

console.log('  THE RIBBON (additive emissive, material-pass shader)');
{
  const gridMul = num(pass, /p4GridCol \* p4Line \* ([\d.]+) \* uP9Flow/, 'grid');
  const railMul = num(pass, /p4RailCol \* p4Rail \* ([\d.]+) \* uP9Flow/, 'rail');
  const hot = num(pass, /uP4Hot = \{ value: ([\d.]+) \}/, 'hot core');
  const coreMul = num(pass, /\* uP4Hot \* uP9Flow \* uP9Flow \* ([\d.]+);/, 'core');
  row('grid', peak([0.30, 0.44, 0.52], gridMul * FLOW_MAX));
  row('rail', peak([0.52, 0.62, 0.86], railMul * FLOW_MAX));
  row('rail core', peak([0.70, 0.92, 1.0], hot * coreMul * FLOW_MAX * FLOW_MAX));
}

console.log('\n  SPEED FANTASY (additive)');
{
  const a = num(fantasy, /this\.mat\.opacity = ([\d.]+) \+ [\d.]+ \* factor;/, 'pylon base');
  const b = num(fantasy, /this\.mat\.opacity = [\d.]+ \+ ([\d.]+) \* factor;/, 'pylon gain');
  row('pylons', peak(toLin(0x8fe0ff), a + b * FLOW_MAX));
  row('streaks', peak(toLin(0xbfeaff), TUNING.CUES.STREAK_OPACITY));
  row('streaks (RF)', peak(toLin(0xbfeaff),
    TUNING.CUES.STREAK_OPACITY * TUNING.CUES.ACCESS_STREAK_SCALE));
}

console.log('\n  EDITORIAL WORLD (normal blend — colour x alpha is what composites)');
console.log('  the page the word plate sits on: rules and type are MEANT to stay under 1.0');
{
  const g = (re, l) => num(world, re, l);
  const specs = [
    ['rules', 'crest', g(/matRule\.color[^;]*multiplyScalar\(([\d.]+) \+/, 'rule a'),
      g(/matRule\.color[^;]*multiplyScalar\([\d.]+ \+ ([\d.]+)/, 'rule b'),
      g(/matRule\.opacity = ([\d.]+) \+/, 'rule oa'), g(/matRule\.opacity = [\d.]+ \+ ([\d.]+)/, 'rule ob')],
    ['type', 'crest', g(/matType\.color[^;]*multiplyScalar\(([\d.]+) \+/, 'type a'),
      g(/matType\.color[^;]*multiplyScalar\([\d.]+ \+ ([\d.]+)/, 'type b'),
      g(/matType\.opacity = ([\d.]+) \+/, 'type oa'), g(/matType\.opacity = [\d.]+ \+ ([\d.]+)/, 'type ob')],
    ['marks', 'ice', g(/matMark\.color[^;]*multiplyScalar\(([\d.]+) \+/, 'mark a'),
      g(/matMark\.color[^;]*multiplyScalar\([\d.]+ \+ ([\d.]+)/, 'mark b'),
      g(/matMark\.opacity = ([\d.]+) \+/, 'mark oa'), g(/matMark\.opacity = [\d.]+ \+ ([\d.]+)/, 'mark ob')],
  ];
  for (const b of MOUNTAIN_BANDS) {
    const col = { crest: toLin(b.crest), ice: toLin(b.ice) };
    const vals = specs.map(([name, which, ca, cb, oa, ob]) =>
      [name, peak(col[which], (ca + cb * ink) * (oa + ob * ink))]);
    vals.push(['drop caps', peak(col.ice,
      num(world, /matCap\.color[^;]*multiplyScalar\(([\d.]+)\)/, 'cap') *
      num(world, /matCap\.opacity = ([\d.]+);/, 'cap opacity'))]);
    const hot = vals.filter(([, v]) => v >= 1);
    const flag = vals.some(([n, v]) => v >= 1 && (n === 'rules' || n === 'type')) ? '  ***' : '';
    console.log(`    #${b.crest.toString(16)}/#${b.ice.toString(16)}  ` +
      vals.map(([n, v]) => `${n} ${v.toFixed(2)}`).join('  ') + flag);
  }
}
