# Migrating the UI to Next.js

The application was built so that a move to Next.js (App Router) replaces only the thin browser shell. Everything that encodes musical knowledge, audio processing, learning logic and persistence lives in framework-independent packages and moves over unchanged.

## What moves as-is

| Code | Why it is portable |
|---|---|
| `packages/theory`, `packages/audio`, `packages/notation`, `packages/learning` | Pure TypeScript, no DOM, no React, deterministic given inputs. Safe on the server and in the browser. |
| `packages/data` | Storage behind `KeyValueStorage`; network through an injected `fetch`. Works in the browser, in Route Handlers and in Server Components. |
| `content/` | Typed data modules; can be imported by Server Components (and kept out of the client bundle) or served from the database. |
| `src/components/*`, `src/pages/*` | Ordinary React function components; they depend on four small modules listed below. |
| `supabase/` | Schema, RLS and seed are independent of the frontend. |

## What changes

| Current (static SPA) | Next.js replacement |
|---|---|
| `src/lib/router.tsx` (`navigate`, `useLocation`, `Link`, `matchPath`) | `next/navigation` (`useRouter().push`, `usePathname`, `useSearchParams`) and `next/link`. Keep the same exported names in a small adapter so pages need no edits: `useLocation()` returns `{ path: usePathname(), query: useSearchParams() }`. |
| `src/App.tsx` route table | One `app/<route>/page.tsx` per entry. Each file renders the existing page component, e.g. `app/tab-editor/page.tsx` → `'use client'; export default function Page() { return <TabEditorPage />; }` and `app/lessons/[id]/page.tsx` → `<LessonPage id={params.id} />`. |
| `src/components/Layout.tsx` + `ErrorBoundary` | `app/layout.tsx` (renders `<Layout>`) and `app/error.tsx`. |
| `__GMA_CONFIG__` injected by `scripts/build.mjs` | `process.env.NEXT_PUBLIC_GMA_SUPABASE_URL`, `NEXT_PUBLIC_GMA_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GMA_SITE_URL`; update `getConfig()` in `src/lib/core.ts` only. |
| `scripts/build.mjs` (esbuild + Tailwind compile) | `next build` with `@tailwindcss/postcss`; move `src/styles/app.css` to `app/globals.css` unchanged. |
| `vercel.json` headers and SPA rewrites | Headers move to `next.config.js` `headers()`; rewrites are no longer needed. |
| `tsconfig.json` paths | Keep the same `@gma/*`, `@content/*`, `@/*` aliases (Next.js honours `paths`). Alternatively turn `packages/*` into workspace packages and add them to `transpilePackages`. |

## Client vs server boundaries

- Anything using Web Audio, the microphone, `localStorage` or `window` must be a Client Component: the tuner, metronome, analyzer, jam room, tab editor playback, `src/lib/audio.ts`, `src/lib/store.ts` and the hooks. Mark page wrappers `'use client'` initially; that reproduces today's behaviour exactly.
- Good first candidates for Server Components once the move works: lesson pages and the lesson catalogue (content is static), the glossary, the theory reference tables. Render the article on the server and hydrate only the interactive blocks (fretboards, quizzes, playback).
- `AppStore` is a module singleton. In Next.js keep it client-only (import it only from client modules) so it is never shared between server requests.

## Auth and data with Next.js

The current client keeps the session in the storage adapter and calls Supabase directly from the browser, which remains valid in Next.js. To add server-side rendering of user data later:

1. Adopt `@supabase/ssr` for cookie-based sessions in middleware, Server Components and Route Handlers.
2. Implement a `KeyValueStorage`/session adapter backed by those cookies, or keep `SupabaseClient` for the browser and use `@supabase/ssr`'s server client for server reads. The table names, columns and RLS rules do not change.
3. Move email-link handling from `/account` (client fragment parsing) to a Route Handler using the PKCE code exchange if you switch the auth flow to PKCE.

## Suggested sequence

1. Create the Next.js app in the same repository; copy `app/globals.css` and configure Tailwind v4 via PostCSS.
2. Add the router adapter (`src/lib/router.tsx` re-implemented on `next/navigation`, same exports).
3. Generate `app/**/page.tsx` wrappers from the `ROUTES` table in `src/App.tsx`.
4. Replace `getConfig()` with `NEXT_PUBLIC_*` variables; move headers to `next.config.js`.
5. Run the existing test suites: unit tests are untouched; `scripts/e2e.mjs` works against `next start` by setting `E2E_BASE_URL`.
6. Incrementally convert static content pages to Server Components.

No changes are required in `packages/*`, `content/`, `supabase/` or the unit tests at any step.
