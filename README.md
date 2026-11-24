# Guitar Mastery Academy

A structured, interactive electric-guitar academy that runs in the browser: a 13-level curriculum (Level 0 to Level 12, 80 lessons), real tools (chromatic tuner, fretboard, scale and chord explorers, metronome), and five integrated practice modules:

| Module | Route | What it does |
|---|---|---|
| A. Fretboard Intelligence Trainer | `/fretboard-trainer` | Nine drill modes (note naming, find a note, all occurrences, octaves, intervals, degrees, chord tones, string navigation), adaptive stages, weak-spot weighting, per-string/fret/note analytics |
| B. Playing Analyzer | `/analyzer` | Records you over a click, detects note attacks and pitches on the device, reports measured timing and pitch with a confidence level; latency calibration; manual self-assessment fallback |
| C. Tab & Exercise Editor | `/tab-editor` | Structured tab editing (durations, techniques, repeats, 4–9 strings, any tuning), playback, library with save/duplicate/categorise, ASCII and JSON import/export |
| D. Jam Laboratory | `/jam`, `/improvisation` | Procedurally generated backing tracks (13 styles, 17 progressions plus custom numerals), live chord-scale analysis of the sounding chord, guided challenges |
| E. Practice Scheduler | `/practice` | 15/30/60/90/custom routines built from level, goals, measured weak spots and neglected skills; session runner with break reminders; analytics |

The interface has a dark (default) and a light theme, switchable from the sidebar, and a site search over pages, lessons and glossary terms.

All modules share one theory engine (`@gma/theory`), one student-state model (`@gma/learning`) and one data layer (`@gma/data`). An exercise written in the Tab Editor appears in Technique Lab, Practice Studio and the Analyzer; trainer, ear-training and practice results feed the scheduler and the dashboard recommendations.

Content is original teaching material. Its relationship to the four supplied method books is documented in [docs/01-book-analysis.md](docs/01-book-analysis.md); every lesson shows its source line, and supplementary material is labelled as such.

## Quick start

Requirements: Node 20+ (22 recommended).

```bash
npm install
npm run dev        # builds, watches and serves on http://localhost:5173
```

The app runs fully in **local-only mode** with no configuration: progress is saved in the browser. To enable accounts and cross-device sync, see [Supabase](#accounts-and-sync-supabase).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Watch build + local server |
| `npm run build` | Production build into `dist/` (esbuild + Tailwind) |
| `npm run preview` | Serve `dist/` on port 4173 |
| `npm run typecheck` | TypeScript strict check of all packages and the app |
| `npm test` | Unit tests (64): theory, audio DSP, notation, data/sync, learning engine, content integrity |
| `npm run test:e2e` | Browser tests (21) in Chrome against `dist/`, including the tuner and analyzer on synthesised microphone audio |
| `scripts/test-db.sh` | Applies the migration + seed to a local PostgreSQL with a Supabase shim and runs RLS/constraint tests |
| `npm run check` | typecheck + unit + build + e2e |
| `npx tsx scripts/gen-seed.ts` / `gen-curriculum-doc.ts` | Regenerate the Supabase seed / curriculum overview from `content/` |

`node scripts/e2e.mjs tuner jam` runs only matching tests; `E2E_BASE_URL=https://… node scripts/e2e.mjs` runs them against a deployment.

## Project structure

```
packages/            framework-independent TypeScript (no React, no DOM)
  theory/            pitch, intervals, scales, chords, tunings, fretboard, CAGED/3NPS/Pillitiere patterns, harmony, voicings
  audio/             YIN pitch detection, tuner engine, onset detection & timing analysis, metronome scheduling, backing-track arranger
  notation/          structured tab model, validation, playback flattening, ASCII import/export
  learning/          student-state types, progress & mastery, SRS, trainer, ear training, scheduler, recommendations, jam challenges
  data/              local repository, Supabase REST/auth client (fetch only), local-first sync engine
content/             curriculum (levels, modules, 80 lessons), 37 exercises, 128-term glossary
src/                 React UI
  lib/               store, router, browser audio (Web Audio), hooks
  components/        UI kit, fretboard/chord/tab visualisations, charts
  pages/             one file per area; routes in src/App.tsx
supabase/            migration (schema, RLS, triggers) and generated content seed
tests/               unit tests and database tests
scripts/             build, serve, e2e, seed generator, db test runner
docs/                analysis, architecture, backend, migration, formats
```

## Configuration

Build-time environment variables (see `.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `GMA_SUPABASE_URL` | for accounts | `https://<project-ref>.supabase.co` |
| `GMA_SUPABASE_ANON_KEY` | for accounts | The **anon / publishable** key. The build refuses keys that look like a service-role key. |
| `GMA_SITE_URL` | recommended | Public URL used in auth email links, e.g. `https://gma.example.com` |

Values are embedded in the static bundle at build time, so set them in Vercel's project environment variables (Preview and Production separately) and redeploy after changing them.

## Accounts and sync (Supabase)

Short version (full guide in [docs/backend.md](docs/backend.md)):

1. Create a dedicated Supabase project.
2. Run `supabase/migrations/20261124000001_initial_schema.sql`, then `supabase/seed.sql`, in the SQL editor (or `supabase db push`).
3. In Authentication → URL configuration, set the Site URL and add `https://<your-domain>/account` (and the preview domain) to the redirect allow list.
4. Set `GMA_SUPABASE_URL` and `GMA_SUPABASE_ANON_KEY` and rebuild.

Guest progress is moved into the account on first sign-in. Sync is local-first: changes are saved on the device immediately and pushed in the background; conflicts resolve last-write-wins, enforced by a database trigger.

## Deployment (Vercel)

`vercel.json` configures a static build (`npm run build` → `dist/`), SPA rewrites, long-cache headers for hashed assets, a Content-Security-Policy that allows only the app's own scripts and Supabase connections, and `Permissions-Policy: microphone=(self)`.

```bash
vercel            # preview deployment
vercel --prod     # production (only after approval)
```

Current setup: the Vercel project `guitar-mastery-academy` (team SparkDrago) is **not yet linked to this repository**, because the Vercel GitHub app has no access to it. Previews are built from the `preview` branch. To enable automatic deployments, grant the Vercel GitHub app access to this repository (GitHub → Settings → Applications → Vercel → Repository access), then connect the repository in the Vercel project settings with `main` as the production branch. Pushes to other branches then create previews automatically.

## Browser support and the microphone

- The tuner and analyzer need `getUserMedia`, which browsers allow only on **HTTPS** (or `localhost`). Vercel serves HTTPS by default.
- Tested in Chrome (desktop and mobile emulation). Recent Firefox, Safari and Edge support every API used (Web Audio, AudioWorklet with a ScriptProcessor fallback).
- Audio is processed on the device; nothing is uploaded.
- iOS: audio starts only after a tap (the Start buttons satisfy this). If the tuner shows no signal, check Settings → Safari → Microphone.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Microphone access was blocked" | Allow the microphone for the site (lock icon in the address bar) and press Start again. |
| "Needs a secure connection" | Open the site over `https://` or `http://localhost`. |
| Tuner jumps between notes | Mute the other strings, pluck firmly once and let it ring; use manual string selection. |
| Analyzer says not enough attacks | Use a cleaner tone closer to the mic, mute open strings, or log a self-assessment instead. |
| No sound | Check the app volume in Settings and the device's silent switch. |
| Sync paused | Changes stay on the device and retry automatically; Settings → Account shows the error and a Test connection button. |

## Limitations

See [docs/limitations.md](docs/limitations.md) for an honest list (analyzer scope, synthesised instruments, browser storage, what was and was not tested).

## Documentation

- [docs/01-book-analysis.md](docs/01-book-analysis.md) — Phase 1 source analysis and source-to-curriculum map
- [docs/02-curriculum.md](docs/02-curriculum.md) — generated curriculum overview
- [docs/architecture.md](docs/architecture.md) — layers, data flow, audio pipeline, sync
- [docs/backend.md](docs/backend.md) — Supabase setup, schema, RLS, auth flows
- [docs/nextjs-migration.md](docs/nextjs-migration.md) — moving the UI to Next.js without rewriting the core
- [docs/tab-format.md](docs/tab-format.md) — native JSON tab format and ASCII rules
- [docs/limitations.md](docs/limitations.md) — known limitations
