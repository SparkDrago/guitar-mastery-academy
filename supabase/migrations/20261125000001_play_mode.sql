-- Play mode: exercise takes scored on the note highway are stored as
-- exercise_records with source 'play' and their measurements in `play`.
begin;
alter table public.exercise_records drop constraint if exists exercise_records_source_check;
alter table public.exercise_records add constraint exercise_records_source_check check (source in ('manual', 'analyzer', 'play'));
alter table public.exercise_records add column if not exists play jsonb;
alter table public.exercise_records add constraint exercise_records_play_shape check (play is null or (jsonb_typeof(play) = 'object' and (play ? 'accuracy')));
commit;
