-- Guitar Mastery Academy — initial schema
-- Target: a DEDICATED Supabase project (Postgres 15+). Do not run this against
-- a project shared with other applications.
--
-- Design
--  * Content tables (courses, levels, modules, lessons, lesson_content, questions,
--    exercises, backing_tracks, achievements) are world-readable and written only
--    by migrations/seed scripts (service role, never the browser).
--  * Every user-owned table has user_id → auth.users, row-level security, and
--    owner-only policies for select/insert/update/delete.
--  * Sync columns: updated_at = client logical time (last-write-wins),
--    synced_at = server time set by trigger (incremental pull cursor),
--    deleted_at = soft delete for user-editable collections.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────

-- Sets synced_at on every write and refuses to overwrite a row with an older
-- client version (server-enforced last-write-wins).
create or replace function public.gma_sync_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at is not null and old.updated_at is not null
     and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_at := now();
  return new;
end;
$$;

-- Keeps updated_at current on content tables.
create or replace function public.gma_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Content (public read-only)
-- ─────────────────────────────────────────────────────────────────────────

create table public.courses (
  id          text primary key,
  title       text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.levels (
  id          smallint primary key check (id between 0 and 20),
  course_id   text not null references public.courses(id) on delete cascade,
  title       text not null,
  summary     text not null,
  outcome     text not null,
  sort_order  smallint not null default 0
);
create index levels_course_idx on public.levels(course_id, sort_order);

create table public.modules (
  id          text primary key,
  level_id    smallint not null references public.levels(id) on delete cascade,
  title       text not null,
  summary     text not null,
  sort_order  smallint not null default 0
);
create index modules_level_idx on public.modules(level_id, sort_order);

create table public.lessons (
  id             text primary key,
  module_id      text not null references public.modules(id) on delete cascade,
  level_id       smallint not null references public.levels(id) on delete cascade,
  title          text not null,
  minutes        smallint not null check (minutes between 1 and 240),
  objectives     text[] not null default '{}',
  prerequisites  text[] not null default '{}',
  categories     text[] not null default '{}',
  sources        jsonb not null default '[]',
  mastery        jsonb not null default '{}',
  sort_order     integer not null default 0,
  published      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index lessons_level_idx on public.lessons(level_id, sort_order);
create index lessons_module_idx on public.lessons(module_id);
create trigger lessons_touch before update on public.lessons for each row execute function public.gma_touch_updated_at();

create table public.lesson_content (
  lesson_id   text primary key references public.lessons(id) on delete cascade,
  content     jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);
create trigger lesson_content_touch before update on public.lesson_content for each row execute function public.gma_touch_updated_at();

create table public.questions (
  id           text primary key,
  lesson_id    text not null references public.lessons(id) on delete cascade,
  prompt       text not null,
  options      jsonb not null check (jsonb_typeof(options) = 'array'),
  answer       smallint not null check (answer >= 0),
  explanation  text not null,
  sort_order   smallint not null default 0
);
create index questions_lesson_idx on public.questions(lesson_id, sort_order);

create table public.exercises (
  id              text primary key,
  name            text not null,
  technique       text not null,
  category        text not null,
  level           smallint not null check (level between 0 and 12),
  difficulty      smallint not null check (difficulty between 1 and 5),
  bpm_start       smallint not null check (bpm_start between 20 and 400),
  bpm_target      smallint not null check (bpm_target between 20 and 400),
  notes_per_beat  smallint not null check (notes_per_beat between 1 and 8),
  reps            smallint not null default 1,
  minutes         smallint not null default 5,
  score           jsonb not null,
  instructions    text[] not null default '{}',
  mistakes        text[] not null default '{}',
  mastery         text not null,
  easier          text,
  harder          text,
  analyzable      boolean not null default false,
  updated_at      timestamptz not null default now()
);
create index exercises_technique_idx on public.exercises(technique, level);
create index exercises_category_idx on public.exercises(category, level);

create table public.backing_tracks (
  id              text primary key,
  name            text not null,
  style_id        text not null,
  progression_id  text not null,
  mode            text not null check (mode in ('major', 'minor')),
  bars            jsonb not null,
  default_bpm     smallint not null check (default_bpm between 20 and 400),
  license         text not null default 'Original procedurally generated arrangement'
);

create table public.achievements (
  id           text primary key,
  title        text not null,
  description  text not null,
  icon         text not null default 'award'
);

-- ─────────────────────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default 'Guitarist' check (char_length(display_name) between 1 and 80),
  start_level    smallint not null default 0 check (start_level between 0 and 12),
  goals          text[] not null default '{}',
  daily_minutes  smallint not null default 30 check (daily_minutes between 5 and 600),
  onboarded      boolean not null default false,
  -- Instrument and UI preferences (tuning, string count, left-handed, A4, note names).
  preferences    jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  synced_at      timestamptz not null default now()
);
create index profiles_synced_idx on public.profiles(id, synced_at);

-- Create a profile row for every new auth user.
create or replace function public.gma_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Guitarist'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.gma_handle_new_user();

create table public.lesson_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     text not null references public.lessons(id) on delete cascade,
  status        text not null check (status in ('not_started', 'in_progress', 'completed', 'mastered')),
  started_at    timestamptz,
  completed_at  timestamptz,
  mastered_at   timestamptz,
  quiz_best     real not null default 0 check (quiz_best between 0 and 1),
  mastery_best  real not null default 0 check (mastery_best between 0 and 1),
  attempts      integer not null default 0 check (attempts >= 0),
  checked       text[] not null default '{}',
  notes         text check (char_length(notes) <= 5000),
  updated_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_synced_idx on public.lesson_progress(user_id, synced_at);
create index lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

-- Immutable log of mastery events, written by trigger (not by clients).
create table public.mastery_records (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    text not null references public.lessons(id) on delete cascade,
  mastered_at  timestamptz not null,
  evidence     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index mastery_records_user_idx on public.mastery_records(user_id, mastered_at desc);
create index mastery_records_lesson_idx on public.mastery_records(lesson_id);

create or replace function public.gma_log_mastery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'mastered' and (tg_op = 'INSERT' or old.status is distinct from 'mastered') then
    insert into public.mastery_records (user_id, lesson_id, mastered_at, evidence)
    values (new.user_id, new.lesson_id, coalesce(new.mastered_at, now()),
            jsonb_build_object('mastery_best', new.mastery_best, 'quiz_best', new.quiz_best, 'attempts', new.attempts));
  end if;
  return new;
end;
$$;

create table public.quiz_attempts (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  lesson_id     text not null references public.lessons(id) on delete cascade,
  kind          text not null check (kind in ('quiz', 'mastery', 'review')),
  score         smallint not null check (score >= 0),
  total         smallint not null check (total > 0),
  missed        text[] not null default '{}',
  attempted_at  timestamptz not null,
  updated_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now(),
  primary key (user_id, id),
  constraint quiz_attempts_score_le_total check (score <= total)
);
create index quiz_attempts_synced_idx on public.quiz_attempts(user_id, synced_at);
create index quiz_attempts_lesson_idx on public.quiz_attempts(lesson_id);

create table public.srs_cards (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  lesson_id      text not null references public.lessons(id) on delete cascade,
  ease           real not null default 2.5 check (ease >= 1.3),
  interval_days  integer not null default 0 check (interval_days >= 0),
  reps           integer not null default 0,
  lapses         integer not null default 0,
  due_at         timestamptz not null,
  last_grade     smallint check (last_grade between 0 and 5),
  updated_at     timestamptz not null default now(),
  synced_at      timestamptz not null default now(),
  primary key (user_id, id)
);
create index srs_cards_synced_idx on public.srs_cards(user_id, synced_at);
create index srs_cards_due_idx on public.srs_cards(user_id, due_at);
create index srs_cards_lesson_idx on public.srs_cards(lesson_id);

create table public.practice_sessions (
  user_id          uuid not null references auth.users(id) on delete cascade,
  id               text not null,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  planned_minutes  smallint not null check (planned_minutes between 0 and 600),
  actual_minutes   smallint not null check (actual_minutes between 0 and 1440),
  routine_name     text not null default '',
  blocks           jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  notes            text check (char_length(notes) <= 5000),
  updated_at       timestamptz not null default now(),
  synced_at        timestamptz not null default now(),
  primary key (user_id, id)
);
create index practice_sessions_synced_idx on public.practice_sessions(user_id, synced_at);
create index practice_sessions_started_idx on public.practice_sessions(user_id, started_at desc);

create table public.exercise_records (
  user_id      uuid not null references auth.users(id) on delete cascade,
  id           text not null,
  exercise_id  text not null,
  recorded_at  timestamptz not null,
  bpm          smallint not null check (bpm between 20 and 400),
  clean        boolean not null,
  rating       smallint check (rating between 1 and 5),
  source       text not null check (source in ('manual', 'analyzer')),
  analyzer     jsonb,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now(),
  primary key (user_id, id)
);
create index exercise_records_synced_idx on public.exercise_records(user_id, synced_at);
create index exercise_records_exercise_idx on public.exercise_records(user_id, exercise_id, recorded_at desc);

create table public.trainer_attempts (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  mode          text not null,
  tuning_id     text not null,
  string_index  smallint not null check (string_index between 0 and 8),
  fret          smallint not null check (fret between 0 and 30),
  pc            smallint not null check (pc between 0 and 11),
  interval      smallint check (interval between 0 and 24),
  correct       boolean not null,
  ms            integer not null check (ms >= 0),
  attempted_at  timestamptz not null,
  updated_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now(),
  primary key (user_id, id)
);
create index trainer_attempts_synced_idx on public.trainer_attempts(user_id, synced_at);
create index trainer_attempts_time_idx on public.trainer_attempts(user_id, attempted_at desc);

create table public.ear_attempts (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  kind          text not null,
  item          text not null,
  correct       boolean not null,
  attempted_at  timestamptz not null,
  updated_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now(),
  primary key (user_id, id)
);
create index ear_attempts_synced_idx on public.ear_attempts(user_id, synced_at);
create index ear_attempts_kind_idx on public.ear_attempts(user_id, kind, attempted_at desc);

create table public.jam_sessions (
  user_id              uuid not null references auth.users(id) on delete cascade,
  id                   text not null,
  played_at            timestamptz not null,
  minutes              smallint not null check (minutes between 0 and 1440),
  key                  text not null,
  mode                 text not null check (mode in ('major', 'minor')),
  progression_id       text not null,
  style_id             text not null,
  bpm                  smallint not null check (bpm between 20 and 400),
  challenge_id         text,
  challenge_completed  boolean not null default false,
  reflection           text check (char_length(reflection) <= 5000),
  updated_at           timestamptz not null default now(),
  synced_at            timestamptz not null default now(),
  primary key (user_id, id)
);
create index jam_sessions_synced_idx on public.jam_sessions(user_id, synced_at);

create table public.custom_tunings (
  user_id      uuid not null references auth.users(id) on delete cascade,
  id           text not null,
  name         text not null check (char_length(name) between 1 and 60),
  strings      smallint[] not null check (array_length(strings, 1) between 4 and 9),
  description  text,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default now(),
  primary key (user_id, id)
);
create index custom_tunings_synced_idx on public.custom_tunings(user_id, synced_at);

create table public.saved_exercises (
  user_id         uuid not null references auth.users(id) on delete cascade,
  id              text not null,
  title           text not null check (char_length(title) between 1 and 120),
  category        text not null,
  technique       text not null,
  difficulty      smallint not null check (difficulty between 1 and 5),
  target_bpm      smallint not null check (target_bpm between 20 and 400),
  notes_per_beat  smallint not null default 2 check (notes_per_beat between 1 and 8),
  description     text not null default '',
  tags            text[] not null default '{}',
  score           jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  synced_at       timestamptz not null default now(),
  primary key (user_id, id)
);
create index saved_exercises_synced_idx on public.saved_exercises(user_id, synced_at);

create table public.saved_items (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  kind        text not null check (kind in ('scale', 'chord')),
  root        text not null,
  type        text not null,
  tuning_id   text not null,
  label       text not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index saved_items_synced_idx on public.saved_items(user_id, synced_at);

-- Convenience views (respect RLS of the base table via security_invoker).
create view public.saved_scales with (security_invoker = true) as
  select user_id, id, root, type as scale_id, tuning_id, label, updated_at from public.saved_items where kind = 'scale' and deleted_at is null;
create view public.saved_chords with (security_invoker = true) as
  select user_id, id, root, type as chord_id, tuning_id, label, updated_at from public.saved_items where kind = 'chord' and deleted_at is null;

create table public.practice_plans (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  name        text not null check (char_length(name) between 1 and 80),
  blocks      jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index practice_plans_synced_idx on public.practice_plans(user_id, synced_at);

create table public.user_achievements (
  user_id         uuid not null references auth.users(id) on delete cascade,
  achievement_id  text not null references public.achievements(id) on delete cascade,
  unlocked_at     timestamptz not null,
  updated_at      timestamptz not null default now(),
  synced_at       timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create index user_achievements_synced_idx on public.user_achievements(user_id, synced_at);
create index user_achievements_achievement_idx on public.user_achievements(achievement_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Sync triggers
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'lesson_progress', 'quiz_attempts', 'srs_cards', 'practice_sessions', 'exercise_records',
    'trainer_attempts', 'ear_attempts', 'jam_sessions', 'custom_tunings', 'saved_exercises', 'saved_items',
    'practice_plans', 'user_achievements'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.gma_sync_guard()', t || '_sync_guard', t);
  end loop;
end $$;

create trigger lesson_progress_mastery_log
  after insert or update of status on public.lesson_progress
  for each row execute function public.gma_log_mastery();

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────────

-- Content: readable by everyone, writable by nobody through the API.
do $$
declare t text;
begin
  foreach t in array array['courses', 'levels', 'modules', 'lessons', 'lesson_content', 'questions', 'exercises', 'backing_tracks', 'achievements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- Profiles: the owner only (id = auth.uid()).
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete on public.profiles for delete to authenticated using ((select auth.uid()) = id);
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

-- Every other user-owned table: owner-only by user_id.
do $$
declare t text;
begin
  foreach t in array array[
    'lesson_progress', 'quiz_attempts', 'srs_cards', 'practice_sessions', 'exercise_records', 'trainer_attempts',
    'ear_attempts', 'jam_sessions', 'custom_tunings', 'saved_exercises', 'saved_items', 'practice_plans', 'user_achievements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Mastery log: owners can read their own events; only the trigger writes.
alter table public.mastery_records enable row level security;
create policy mastery_records_select on public.mastery_records for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.mastery_records from anon;
revoke insert, update, delete on public.mastery_records from authenticated;
grant select on public.mastery_records to authenticated;

grant select on public.saved_scales, public.saved_chords to authenticated;
revoke all on public.saved_scales, public.saved_chords from anon;

commit;
