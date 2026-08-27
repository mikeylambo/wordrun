# DESCENT RC9 audio generation

The shipped game must never call ElevenLabs directly. Sound generation is an offline development step.

## 1. Create a restricted ElevenLabs API key

Give it only the Sound Effects permission and set a credit limit appropriate for the batch you intend to generate.

## 2. Keep the key outside the repository

```bash
export ELEVENLABS_API_KEY='...'
```

Do not place the key in `src/`, `public/`, client-side Vite environment variables, screenshots, issues, or commits.

## 3. Inspect the planned library

```bash
npm run audio:list
```

## 4. Generate candidates

The default creates two variants of every planned sound into `public/audio/elevenlabs/`:

```bash
npm run audio:generate
```

Generate only selected sounds:

```bash
npm run audio:generate -- --only=beast_main_distant,frost_beast_charge --variants=3
```

The script writes `manifest.json` beside the generated MP3 files. Audition candidates and keep only approved takes before wiring them into the release mix.

## Mix philosophy

Procedural Web Audio remains authoritative for timing-critical information: carving response, GO state, bell pitch, positional threat, Hunt pulse and UI feedback. Generated assets supply organic texture and hero Foley. This keeps the game responsive while allowing high-fidelity recorded-style material where synthesis is weakest.
