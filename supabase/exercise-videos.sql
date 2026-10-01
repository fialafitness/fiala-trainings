-- Fiala Trainings — your own video links per exercise. Paste into Supabase SQL Editor → Run. Safe to re-run.
create table if not exists ft_exercise_videos (
  name_key text primary key,            -- exercise name, lowercased, hyphens as spaces
  url text not null,
  video_id text not null,
  updated_at timestamptz not null default now()
);
alter table ft_exercise_videos enable row level security;
drop policy if exists videos_read on ft_exercise_videos;
create policy videos_read on ft_exercise_videos for select to authenticated using (true);   -- clients may watch
drop policy if exists videos_trainer on ft_exercise_videos;
create policy videos_trainer on ft_exercise_videos for all to authenticated using (is_trainer()) with check (is_trainer());
select 'exercise videos ready' as status;
