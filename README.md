# SurSaath

SurSaath is a static React + TypeScript practice tool for Indian classical riyaaz. It runs fully in the browser and combines:

- a warm tanpura-style drone with selectable tonic
- a playable taal box with sample-mapped tabla strokes, multiple taals, loop/style variants, and subtle cycle-end fills
- live matra and vibhag tracking
- tempo controls with tap-loop capture for user-played overlay patterns
- local persistence for your last-used settings

## Stack

- React
- TypeScript
- Vite
- Tone.js
- GitHub Pages via GitHub Actions

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite base path is configured for this repository's GitHub Pages project URL:

`https://rishavpunatar.github.io/Taal-Box/`

## Deployment

Deployment is handled by [deploy.yml](./.github/workflows/deploy.yml).

On every push to `main`, GitHub Actions:

1. installs dependencies with `npm ci`
2. builds the static site with `npm run build`
3. uploads `dist/`
4. deploys the artifact to GitHub Pages

If GitHub Pages is not already configured for the repository, set:

- `Settings -> Pages -> Source -> GitHub Actions`

## Project structure

- `src/data/taals.ts`: taal definitions, loop/style variants, vibhag structure, and presets
- `src/lib/audioEngine.ts`: Tone.js scheduling, tanpura synthesis, and sample-mapped tabla playback
- `src/lib/tapLoop.ts`: tap-loop capture, inference, and overlay pattern formatting
- `src/lib/transitionFills.ts`: light cycle-end fill patterns that keep repeated loops from feeling static
- `src/lib/storage.ts`: local storage persistence
- `src/components/`: UI building blocks
- `public/audio/tabla/`: derived tabla one-shots used by the taal engine

## Editing taals and presets

Add or adjust taals, loop variants, and practice presets in `src/data/taals.ts`.

Each taal can expose multiple loops through:

- `defaultLoopId`
- `loops[]`
- `loop.id`, `loop.label`, `loop.summary`, and `loop.beats`

Each beat stores a display label plus one or more scheduled tabla strokes, so swung addha, sitarkhani, tilwada, or ghazal-style loops can be represented without flattening everything to one bol per matra.

Cycle-end transition fills are kept in `src/lib/transitionFills.ts` so the steady loop data remains readable while the playback engine can still add occasional movement.

The same file also contains the quick presets:

- `Teentaal - Medium`
- `Dadra - Ghazal`
- `Keharwa - Fast`
- `Addha - Thumri`
- `Deepchandi - Ghazal`

Current shipped taals:

- Teentaal
- Ektaal
- Rupak
- Jhaptal
- Dadra
- Keharwa
- Tilwada
- Jhoomra
- Deepchandi
- Dhamar
- Chautaal
- Ada Chautaal
- Tevra
- Addha
- Pancham Savari
- Bhajani
- Punjabi / Sitarkhani

To regenerate the shipped tabla clips from the source recording:

```bash
python3 scripts/extract_tabla_samples.py
```

## Limitations

- The tanpura is synthesized in-browser, while the tabla layer uses a compact derived sample set rather than a full multi-velocity studio library.
- Browser audio timing is solid for practice use, but it is not a replacement for dedicated hardware.
- Audio must be started by user interaction because browsers block autoplay.
- Some light-classical and ghazal-oriented loop variants are practical interpretations built from standard theka references rather than exact gharana-specific transcriptions.

## Audio asset attribution

The tabla one-shots in `public/audio/tabla/` are derived from the Wikimedia Commons file `Tabla drums demo.oga` by `tabladrumsonline`, licensed under CC BY-SA 3.0. See `public/audio/tabla/ATTRIBUTION.md`.

## Good next improvements

- add per-loop swing and subdivision controls
- add user-selectable fill density or a "steady / active" accompaniment mode
- add pitch reference for male/female tonic ranges
- add sample-based tabla and tanpura sound sets
- add lehra or tanpura fine-tuning options
