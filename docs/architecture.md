# Architecture

## Goals that shaped it

1. **The core must outlive the UI framework.** Music theory, audio DSP, notation, the learning engine and persistence are plain TypeScript packages with no React or DOM dependency, so a move to Next.js (or a native app) reuses them unchanged.
2. **Local-first, backend-optional.** The app is fully usable with no server. Supabase adds accounts and cross-device sync behind an interface; nothing in the UI talks to the database directly.
3. **Measured, never invented.** Audio features (tuner, analyzer) report only what was measured, with confidence; when measurement is unreliable the UI says so and offers a manual alternative.
4. **One source of musical truth.** Every scale, chord, numeral, fretboard mark, quiz generator, jam analysis and trainer answer comes from `@gma/theory`.

## Layers

```
┌──────────────────────────── src/ (React UI, browser only) ────────────────────────────┐
│ pages/*  components/*  lib/router  lib/hooks  lib/audio (Web Audio)  lib/store         │
└───────────────┬──────────────────────────────┬──────────────────────────────┬─────────┘
                │ pure functions                │ state + persistence          │ DSP
┌───────────────▼───────────┐  ┌────────────────▼──────────────┐  ┌────────────▼─────────┐
│ @gma/learning             │  │ @gma/data                     │  │ @gma/audio           │
│ types, progress, mastery, │  │ LocalRepository (KV storage)  │  │ YIN, TunerEngine,    │
│ SRS, trainer, ear, jam,   │  │ SupabaseClient (fetch)        │  │ onsets, timing,      │
│ scheduler, recommend      │  │ SyncEngine (outbox, LWW)      │  │ metronome, arranger  │
└───────────────┬───────────┘  └────────────────┬──────────────┘  └──────────────────────┘
                │                               │
┌───────────────▼───────────┐  ┌────────────────▼──────────────┐
│ @gma/theory  @gma/notation│  │ content/ (lessons, exercises, │
│                           │  │ glossary: typed data)         │
└───────────────────────────┘  └───────────────────────────────┘
```

Path aliases (`tsconfig.json`): `@gma/*` → `packages/*/src`, `@content/*` → `content/*`, `@/*` → `src/*`. esbuild resolves the same aliases.

## Packages

| Package | Key exports | Notes |
|---|---|---|
| `@gma/theory` | `parseNote`, `buildScale`, `buildChord`, `TUNINGS` (39 presets), `midiAt`, `markTones`, `threeNpsPatterns`, `fivePositionPatterns`, `cagedPositions`, `buildPillitierePattern`, `diatonicChords`, `numeralToChord`, `chordScales`, `findVoicings`, `reverseChordLookup` | Notes are spelled (letter + accidental), so key signatures and modes spell correctly. Tunings are per-string MIDI numbers, 4–9 strings. |
| `@gma/audio` | `yin`, `TunerEngine`, `detectOnsets`, `analyseTimingGrid`, `checkPitches`, `timingFeedback`, `scheduleUntil`, `arrange`, `JAM_STYLES`, `chroma`, `matchChroma` | Operates on `Float32Array`s; no Web Audio. Unit-tested on synthesised signals. |
| `@gma/importer` | `runImport`, `openPsarc`, `registerArchiveHandler`, `classify`, `groupSongs`, `lzmaDecode`, `md5` | DOM-free; runs in the import worker and under Node in tests. See [importer.md](importer.md). |
| `@gma/notation` | `TabScore`, `validateScore`, `toPlayback`, `toAscii`, `parseAscii`, `PlaySong`, `songFromTabScore`, `songFromRocksmithXml`, `songFromGpif`, `parseXml`, ZIP reader | Native JSON model; see [tab-format.md](tab-format.md). |
| `@gma/learning` | `StudentState`, `checkMastery`, `reviewCard`, `generateQuestion`, `generateEarQuestion`, `buildRoutine`, `dailyRecommendations`, `buildChallenge`, `buildAssessment`, `PlayScorer`, `SessionFollower` | Pure functions of state + content + `now`. |
| `@gma/data` | `LocalRepository`, `SupabaseClient`, `SyncEngine`, `COLLECTIONS` | Storage via a `KeyValueStorage` interface (localStorage in the browser, memory in tests, anything else later). |

## State and persistence

- `StudentState` is a set of independent collections (profile, lessons, quiz attempts, SRS cards, sessions, exercise records, trainer/ear attempts, jams, custom tunings, exercises, saved items, routines, achievements).
- `AppStore` (`src/lib/store.ts`) owns the current state for the current owner (`guest` or a user id) and exposes `update/upsert/append/remove`. Every mutation:
  1. is saved locally (`LocalRepository.saveCollection`),
  2. is queued in the sync outbox when signed in,
  3. re-evaluates achievements,
  4. notifies React through `useSyncExternalStore`.
- The `COLLECTIONS` registry defines, per collection, its id, timestamp, row mapping (`toRow`/`fromRow`), table and conflict columns. Adding a collection means one registry entry and one table.

### Sync protocol

```
mutation ──► local save ──► outbox (collection, id)
                              │  (debounced 2.5 s, on focus, on 'online')
                              ▼
              push: upsert rows (on_conflict) ── tombstones for deletions
              pull: select rows where synced_at > cursor (per collection)
              merge: last-write-wins by client updated_at
              cursor := max(synced_at seen)
```

- `synced_at` is set by a trigger (server clock) so pull cursors never miss rows written by other devices.
- The same trigger rejects an update whose `updated_at` is older than the stored row, so a stale device cannot overwrite newer data even if it bypasses the client.
- Failed pushes stay in the outbox; the UI shows "sync paused" and retries.
- On first sign-in on a device that has guest data and an empty account copy, the guest state is moved into the account and marked dirty.

## Audio pipeline

| Feature | Input | Processing | Output |
|---|---|---|---|
| Tuner | `getUserMedia` (echo cancellation, noise suppression and AGC disabled) → `AnalyserNode` | Decimation for low strings, YIN with parabolic interpolation, median smoothing and hysteresis in `TunerEngine`, string matching against the active tuning | Note, Hz, cents, closest string, in-tune status |
| Analyzer | `AudioWorklet` recorder (ScriptProcessor fallback), scheduled click track | Spectral-flux onsets → matched to the expected grid from the score (`analyseTimingGrid`), latency compensation, YIN per matched note for single-note lines | Timing metrics, drift, consistency, pitch accuracy, confidence, evidence-backed feedback |
| Play mode | `AnalyserNode` (8192), HTMLAudio for the player's recording or synthesised guide tones | YIN on the newest 2048 samples (single notes), chroma on 8192 (chords), latency compensation, `PlayScorer` timing windows | Hit/miss per note and chord, streak, multiplier, per-section accuracy |
| Chord Finder (listen) | `AnalyserNode` (8192) | Peak-picked chroma, smoothed | Active pitch classes → `reverseChordLookup` |
| Session mode | `AnalyserNode` | Level envelope → attack detection → `SessionFollower` intensity; YIN for note feedback | Arranger density 1–3, "band waits" when silent |
| Metronome / backing | `AudioContext` clock | Look-ahead scheduler (25–40 ms timer, ~100–200 ms horizon) | Sample-accurate clicks and synthesised drums, bass and chords |

All instruments are synthesised (no samples to license or download).

## UI

- Router: History-API router (`src/lib/router.tsx`) with `matchPath`; routes in `src/App.tsx` map one-to-one onto future Next.js `app/` routes.
- Each page is wrapped in an error boundary keyed by path.
- Styling: Tailwind v4 with design tokens in `src/styles/app.css` (`ink`, `accent`, `ok`, `warn`, `bad`, `cyan` scales); components in `src/components/ui.tsx`.
- Charts: hand-written SVG (`src/components/charts.tsx`) with hover tooltips and text alternatives.
- Accessibility: semantic headings, labelled controls, `aria-live` for tuner/trainer feedback, keyboard support in the trainer and tab editor, visible focus, colour never the only signal (labels and icons accompany status colours).

## Build

`scripts/build.mjs` bundles `src/main.tsx` with esbuild (ES2022, minified, hashed filenames), compiles Tailwind through its `compile()` API (scanning `src/` for class names), writes `dist/index.html`, and embeds the public configuration (`__GMA_CONFIG__`). It refuses to embed a key that looks like a Supabase service-role key.
