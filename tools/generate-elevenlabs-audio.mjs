import fs from 'node:fs/promises';
import path from 'node:path';
import { SFX_ASSETS } from './audio/elevenlabs-assets.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`${name}=`))?.split('=').slice(1).join('=');
const has = (name) => args.includes(name);

if (has('--list')) {
  for (const asset of SFX_ASSETS) {
    console.log(`${asset.id}\t${asset.duration}s\t${asset.loop ? 'loop' : 'one-shot'}\t${asset.prompt}`);
  }
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY. Keep it in your shell/secret manager; never commit it.');
  process.exit(1);
}

const only = new Set((flag('--only') || '').split(',').map((s) => s.trim()).filter(Boolean));
const variants = Math.max(1, Math.min(4, Number(flag('--variants') || 2)));
const outDir = path.resolve(flag('--out') || 'public/audio/elevenlabs');
const selected = only.size ? SFX_ASSETS.filter((a) => only.has(a.id)) : SFX_ASSETS;

if (!selected.length) {
  console.error('No matching assets. Run with --list to see valid ids.');
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  provider: 'ElevenLabs',
  model: 'eleven_text_to_sound_v2',
  files: {},
};

for (const asset of selected) {
  manifest.files[asset.id] = [];
  for (let i = 1; i <= variants; i++) {
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: asset.prompt,
        duration_seconds: asset.duration,
        prompt_influence: asset.influence,
        loop: asset.loop,
        model_id: 'eleven_text_to_sound_v2',
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${asset.id} v${i}: ElevenLabs ${response.status} ${detail}`);
    }

    const file = `${asset.id}-v${String(i).padStart(2, '0')}.mp3`;
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path.join(outDir, file), bytes);
    manifest.files[asset.id].push({
      file,
      bytes: bytes.byteLength,
      loop: asset.loop,
      duration: asset.duration,
      prompt: asset.prompt,
    });
    console.log(`generated ${file} (${Math.round(bytes.byteLength / 1024)} KB)`);

    // Be polite to the service and make logs easier to follow on large batches.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

await fs.writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);

console.log(`\nWrote ${path.join(outDir, 'manifest.json')}`);
console.log('Audition the variants and keep only approved files before release.');
