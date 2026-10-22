-- Fiala Trainings — the subtitle the client sees under a long exercise name. Paste into Supabase SQL Editor → Run. Safe to re-run.
create table if not exists ft_exercise_subtitles (
  name_key text primary key,            -- exercise name, squashed (letters and digits only)
  subtitle text not null default '',    -- the ending of the name shown as the second line; '' = the whole name stays one line
  updated_at timestamptz not null default now()
);
alter table ft_exercise_subtitles enable row level security;
drop policy if exists subtitles_read on ft_exercise_subtitles;
create policy subtitles_read on ft_exercise_subtitles for select to authenticated using (true);   -- clients read them
drop policy if exists subtitles_trainer on ft_exercise_subtitles;
create policy subtitles_trainer on ft_exercise_subtitles for all to authenticated using (is_trainer()) with check (is_trainer());
select 'exercise subtitles ready' as status;
