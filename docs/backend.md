# Backend: Supabase setup and integration

The app works without a backend (local-only mode). With a dedicated Supabase project it gains real accounts (registration, login, password recovery, persistent sessions) and cross-device sync of all student data.

> Use a **dedicated** project for Guitar Mastery Academy. The migration creates tables, functions and triggers in `public` and a trigger on `auth.users`; do not apply it to a project shared with other applications.

## 1. Create and prepare the project

1. Create a new Supabase project (any region close to your students).
2. **Apply the schema.** Either:
   - SQL editor: run every file in `supabase/migrations/` in name order (`20261124000001_initial_schema.sql`, then `20261125000001_play_mode.sql`), then `supabase/seed.sql`; or
   - CLI: `supabase link --project-ref <ref>` then `supabase db push`, then run `supabase/seed.sql` (e.g. `psql "$DATABASE_URL" -f supabase/seed.sql`).
3. The seed loads the course structure (1 course, 13 levels, 27 modules, 80 lessons with their content, 238 quiz questions, 37 exercises, 17 backing-track presets, 17 achievements). It is regenerated from `content/` with `npx tsx scripts/gen-seed.ts`, so the database and the app always agree. The app itself reads content from the bundle; the seeded tables are the server-side copy for reporting, future CMS work and referential integrity of progress rows.

## 2. Authentication settings

In **Authentication → Providers → Email**: enable email sign-in. Decide whether to require email confirmation (recommended for production).

In **Authentication → URL configuration**:

| Setting | Value |
|---|---|
| Site URL | your production URL, e.g. `https://guitar-mastery.example.com` |
| Redirect URLs | `https://guitar-mastery.example.com/account`, `https://guitar-mastery.example.com/account?reset=1`, and the same for each preview domain (Vercel previews: `https://*-<team>.vercel.app/account*` if you use wildcard redirects) |

Email links land on `/account`, which processes the `#access_token=…` fragment, signs the user in, and for recovery links shows the "choose a new password" form.

Optional but recommended: configure a custom SMTP sender under **Authentication → Emails** (the built-in sender is rate-limited).

## 3. Environment variables

| Variable | Where | Value |
|---|---|---|
| `GMA_SUPABASE_URL` | Vercel project → Settings → Environment Variables (Preview + Production) | Project URL, `https://<ref>.supabase.co` |
| `GMA_SUPABASE_ANON_KEY` | same | **anon** (publishable) key |
| `GMA_SITE_URL` | same | the deployment's public URL |

These are public by design: the anon key only grants what Row Level Security allows. **Never** put the `service_role` key in these variables, in the repository or in any frontend code; `scripts/build.mjs` aborts if a value looks like a service-role key. The service role is only for running migrations and the seed from a trusted machine.

The values are compiled into the static bundle, so redeploy after changing them.

## 4. Schema overview

Content (read-only to clients, readable by `anon` and `authenticated`):

`courses`, `levels`, `modules`, `lessons`, `lesson_content`, `questions`, `exercises`, `backing_tracks`, `achievements`

User-owned (all with `user_id → auth.users(id) on delete cascade`, RLS on, owner-only policies):

| Table | Holds | Key |
|---|---|---|
| `profiles` | display name, start level, goals, daily minutes, tuning, strings, handedness, A4, note names | `id = auth.uid()` (created by trigger on sign-up) |
| `lesson_progress` | status, quiz/mastery bests, attempts, notes | `(user_id, lesson_id)` |
| `mastery_records` | append-only log written by trigger when a lesson becomes mastered | id |
| `quiz_attempts` | quiz, mastery and review scores, missed question ids | id |
| `srs_cards` | SM-2 state per lesson | `(user_id, lesson_id)` |
| `practice_sessions` | routines run, blocks, minutes | id |
| `exercise_records` | logged takes (manual, analyzer or play mode, with measurements and confidence) | id |
| `trainer_attempts`, `ear_attempts` | drill answers | id |
| `jam_sessions` | jams, challenges, reflections | id |
| `custom_tunings`, `saved_exercises`, `saved_items`, `practice_plans` | user-created content (soft delete via `deleted_at`) | id |
| `user_achievements` | unlocked achievements | `(user_id, achievement_id)` |

Every user table has `updated_at` (client logical time), `synced_at` (server time, set by trigger) and indexes on `(user_id, synced_at)` for incremental pulls. Constraints validate ranges (scores ≤ totals, bpm 20–400, ratings 1–5, statuses, string counts 4–9, MIDI ranges).

### Row Level Security

- Content tables: `select` for `anon, authenticated`; no write policies (writes only via service role).
- User tables: separate `select/insert/update/delete` policies, each `using ((select auth.uid()) = user_id)` (and `with check` for writes). The `(select auth.uid())` form is evaluated once per statement for performance.
- `gma_sync_guard()` trigger: sets `synced_at = now()` and rejects updates whose `updated_at` is older than the stored row (server-enforced last-write-wins).
- Security-definer functions pin `search_path = ''`.

These policies are exercised by `tests/db/rls-test.sql` (run with `scripts/test-db.sh` against a local PostgreSQL with a Supabase-compatible shim): cross-user reads/writes are blocked, anon can read content but no user data, stale writes are rejected, constraints hold, and every user table has RLS enabled.

## 5. Client integration

`packages/data/src/supabase.ts` is a dependency-free client built on `fetch`:

- Auth: `signUp` (with display name and email redirect), `signIn` (password grant), `signOut`, `requestPasswordReset`, `updatePassword`, `handleRedirect` (email-link fragments), automatic token refresh with single-flight protection, session persisted in the same storage adapter as local data.
- Data: `select(table, query)`, `upsert(table, rows, onConflict)`, `ping()`.

The sync engine (`packages/data/src/sync.ts`) pushes the outbox, pulls changes per collection since the last `synced_at` cursor, merges last-write-wins and keeps failed writes for retry. See [architecture.md](architecture.md#sync-protocol).

## 6. Verifying a new project

1. Deploy with the three variables set.
2. Settings → Account & sync: create an account. With confirmation enabled, follow the email link (it should land on `/account` and sign you in).
3. Press **Test connection** (reads `achievements` through the REST API with your token).
4. Complete a lesson, answer a few trainer questions, then open the app in another browser and sign in: the progress should appear after the first sync.
5. Use **Forgot password** to verify the recovery flow end to end.

## 7. Future backend work

- Server-side content editing (a CMS writing to the content tables, with the app fetching content at runtime instead of bundling it).
- Edge Functions for teacher/student sharing or class dashboards (would need additional, explicitly scoped RLS policies).
- Realtime subscriptions for instant multi-device updates (the current pull-on-focus/interval model is sufficient for one student on several devices).
