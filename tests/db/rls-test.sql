-- Behavioural tests for the schema: RLS isolation, content read access,
-- last-write-wins guard, profile auto-creation and the mastery log.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

insert into public.courses (id, title) values ('gma', 'Guitar Mastery Academy');
insert into public.levels (id, course_id, title, summary, outcome) values (0, 'gma', 'Orientation', 's', 'o');
insert into public.modules (id, level_id, title, summary) values ('m0', 0, 'Module', 's');
insert into public.lessons (id, module_id, level_id, title, minutes) values ('l0-test', 'm0', 0, 'Test lesson', 10);
insert into public.achievements (id, title, description) values ('first-lesson', 'First steps', 'd');

-- Two users; profiles must be created by the trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"display_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com', '{}');
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles auto-created';
  assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice', 'display name copied';
  assert (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'Guitarist', 'default display name';
end $$;

-- ── As Alice ──
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.lesson_progress (user_id, lesson_id, status, updated_at) values ('11111111-1111-1111-1111-111111111111', 'l0-test', 'in_progress', '2026-01-01T10:00:00Z');
insert into public.trainer_attempts (user_id, id, mode, tuning_id, string_index, fret, pc, correct, ms, attempted_at) values
  ('11111111-1111-1111-1111-111111111111', 't1', 'note-id', 'e-standard', 0, 5, 9, true, 1200, now());
insert into public.custom_tunings (user_id, id, name, strings) values ('11111111-1111-1111-1111-111111111111', 'c1', 'My 7', '{35,40,45,50,55,59,64}');
do $$ begin
  assert (select count(*) from public.lesson_progress) = 1, 'Alice sees her progress';
  assert (select count(*) from public.profiles) = 1, 'Alice sees only her profile';
  assert (select count(*) from public.lessons) = 1, 'content readable';
end $$;

-- Alice cannot write rows for Bob.
do $$ begin
  begin
    insert into public.lesson_progress (user_id, lesson_id, status) values ('22222222-2222-2222-2222-222222222222', 'l0-test', 'completed');
    raise exception 'RLS failed: cross-user insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Alice cannot modify content.
do $$ begin
  begin
    update public.lessons set title = 'hacked';
    raise exception 'content update allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Last-write-wins: an older client version must not overwrite a newer one.
update public.lesson_progress set status = 'completed', updated_at = '2026-01-01T12:00:00Z' where lesson_id = 'l0-test';
update public.lesson_progress set status = 'not_started', updated_at = '2026-01-01T11:00:00Z' where lesson_id = 'l0-test';
do $$ begin
  assert (select status from public.lesson_progress where lesson_id = 'l0-test') = 'completed', 'stale write ignored';
end $$;

-- Upsert path used by the app (PostgREST merge-duplicates = ON CONFLICT DO UPDATE).
insert into public.lesson_progress (user_id, lesson_id, status, updated_at, mastery_best) values
  ('11111111-1111-1111-1111-111111111111', 'l0-test', 'mastered', '2026-01-02T09:00:00Z', 0.9)
  on conflict (user_id, lesson_id) do update set status = excluded.status, updated_at = excluded.updated_at, mastery_best = excluded.mastery_best;
do $$ begin
  assert (select status from public.lesson_progress where lesson_id = 'l0-test') = 'mastered', 'upsert applied';
  assert (select count(*) from public.mastery_records) = 1, 'mastery event logged and visible to owner';
end $$;

-- Alice cannot forge mastery records.
do $$ begin
  begin
    insert into public.mastery_records (user_id, lesson_id, mastered_at) values ('11111111-1111-1111-1111-111111111111', 'l0-test', now());
    raise exception 'mastery forgery allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── As Bob ──
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.lesson_progress) = 0, 'Bob cannot see Alice progress';
  assert (select count(*) from public.trainer_attempts) = 0, 'Bob cannot see Alice attempts';
  assert (select count(*) from public.custom_tunings) = 0, 'Bob cannot see Alice tunings';
  assert (select count(*) from public.mastery_records) = 0, 'Bob cannot see Alice mastery';
end $$;
update public.lesson_progress set status = 'not_started';
delete from public.custom_tunings;
reset role;
do $$ begin
  assert (select status from public.lesson_progress where user_id = '11111111-1111-1111-1111-111111111111') = 'mastered', 'Bob could not update Alice row';
  assert (select count(*) from public.custom_tunings) = 1, 'Bob could not delete Alice row';
end $$;

-- ── As anon ──
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.lessons) = 1, 'anon reads content';
end $$;
do $$ begin
  begin
    perform count(*) from public.lesson_progress;
    raise exception 'anon could read progress';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Constraint checks.
do $$ begin
  begin
    insert into public.custom_tunings (user_id, id, name, strings) values ('11111111-1111-1111-1111-111111111111', 'bad', 'Too few', '{40,45}');
    raise exception 'string-count check failed';
  exception when check_violation then null;
  end;
  begin
    insert into public.quiz_attempts (user_id, id, lesson_id, kind, score, total, attempted_at) values ('11111111-1111-1111-1111-111111111111', 'q', 'l0-test', 'quiz', 5, 3, now());
    raise exception 'score<=total check failed';
  exception when check_violation then null;
  end;
end $$;

-- Every public table has RLS enabled.
do $$ begin
  assert (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) = 0, 'RLS enabled everywhere';
end $$;

select 'ALL DATABASE TESTS PASSED' as result;
