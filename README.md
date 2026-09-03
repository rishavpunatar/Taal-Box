# SurSaath

SurSaath is a static React + TypeScript practice tool for Indian classical riyaaz. It runs fully in the browser and combines:

- a warm tanpura drone with selectable tonic, seamlessly looped and retuned from a sampled source
- a playable taal box with sample-mapped tabla strokes, multiple taals, loop/style variants, and subtle cycle-end fills
- independent layer switches — practise with tanpura alone, tabla alone, or both
- live matra and vibhag tracking
- tempo controls for steady practice pacing
- local persistence for your last-used settings

## Install on Android

Download the latest signed APK from the [SurSaath releases page](https://github.com/rishavpunatar/Taal-Box/releases/latest) or use the [direct APK download](https://github.com/rishavpunatar/Taal-Box/releases/latest/download/SurSaath.apk).

On first install, Android may ask you to allow installs from the browser or file manager you used to open the APK. SurSaath then appears in the launcher as a regular app and works without a network connection.

## Stack

- React
- TypeScript
- Vite
- Tone.js
- Capacitor (native Android wrapper)
- GitHub Pages via GitHub Actions
- GitHub Releases via GitHub Actions

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

To build the Android APK locally (requires Java 21 and Android SDK 36):

```bash
npm run android:debug
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

Android release builds are handled by [android-release.yml](./.github/workflows/android-release.yml). Pushing a version tag such as `v1.0.0` builds a signed `SurSaath.apk`, attaches it to a GitHub Release, and updates the stable direct-download URL above. The signing key and passwords live only in encrypted GitHub Actions secrets.

## Project structure

- `src/data/taals.ts`: taal definitions, loop/style variants, and vibhag structure
- `src/lib/audioEngine.ts`: Tone.js scheduling, seamless tanpura loop playback, and sample-mapped tabla playback
- `src/lib/transitionFills.ts`: light cycle-end fill patterns that keep repeated loops from feeling static
- `src/lib/storage.ts`: local storage persistence
- `src/components/`: UI building blocks
- `public/audio/tabla-fs/`: peak-normalized tabla stroke samples used by the taal engine
- `public/audio/tanpura/`: bundled tanpura drone source and attribution

## Editing taals and loops

Add or adjust taals and loop variants in `src/data/taals.ts`.

Each taal can expose multiple loops through:

- `defaultLoopId`
- `loops[]`
- `loop.id`, `loop.label`, `loop.summary`, `loop.beats`, and optional `loop.dynamics` / `loop.suggestedTempo`

Each beat stores a display label plus one or more scheduled tabla strokes (with per-stroke offsets inside the matra and velocities), so swung addha, sitarkhani, tilwada, or ghazal-style loops can be represented without flattening everything to one bol per matra. A beat with no strokes is an avagraha rest, used by deepchandi and dhamar.

Loops marked `dynamics: 'authored'` play their stroke velocities exactly as written instead of receiving the engine's sam/khali emphasis curve. The `Dadra -> Ghazal` variant is transcribed stroke-for-stroke (timing and dynamics) from a live tabla recording and replays it through the sample bank, so it follows any tempo and stays clean at any pitch.

Cycle-end transition fills are kept in `src/lib/transitionFills.ts` so the steady loop data remains readable while the playback engine can still add occasional movement.

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

## Limitations

- The tanpura is one compact source recording, crossfade-looped and retuned across tonics, rather than a full multi-sampled tanpura library.
- Browser audio timing is solid for practice use, but it is not a replacement for dedicated hardware.
- Audio must be started by user interaction because browsers block autoplay.
- Some light-classical and ghazal-oriented loop variants are practical interpretations built from standard theka references rather than exact gharana-specific transcriptions.

## Audio asset attribution

The active tabla playback bank in `public/audio/tabla-fs/` comes from the Freesound pack `Tabla Strokes` by `ajaysm`, licensed under CC BY 4.0 (peak-normalized and converted to WAV for consistent playback). See `public/audio/tabla-fs/ATTRIBUTION.md`.

The active tanpura drone in `public/audio/tanpura/` comes from `Electronic Tanpura 9` by `sankalp` on Freesound, licensed under CC BY 4.0. See `public/audio/tanpura/ATTRIBUTION.md`.

## Good next improvements

- add per-loop swing and subdivision controls
- add user-selectable fill density or a "steady / active" accompaniment mode
- add pitch reference for male/female tonic ranges
- add multiple tanpura sample sets for different timbres and tonic ranges
- add lehra or tanpura fine-tuning options
