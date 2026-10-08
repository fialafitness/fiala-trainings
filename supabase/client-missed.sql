-- Missed workouts: the client can move a missed workout to today ("Do it today"), and a workout missed by
-- more than a week with nothing logged files itself under History as "Missed". A workout the client decided
-- about (undo, skip, do it today) carries missed=false, and is never filed by itself again.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

create or replace function client_move_training(p_training uuid, p_date text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'bad date'; end if;
  begin
    if to_char(p_date::date, 'YYYY-MM-DD') <> p_date then raise exception 'bad date'; end if;
  exception when others then raise exception 'bad date'; end;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  update ft_trainings set data = jsonb_set(data, '{date}', to_jsonb(p_date))
    where id = p_training and coalesce(data ->> 'completedAt', '') = '';
end;
$$;
revoke execute on function client_move_training(uuid, text) from public, anon;
grant execute on function client_move_training(uuid, text) to authenticated;

drop function if exists client_miss_training(uuid);
create or replace function client_miss_training(p_training uuid, p_missed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_missed is null then raise exception 'missing argument'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  if p_missed then
    -- filed by itself: out of the plan, marked as missed
    update ft_trainings set data = jsonb_set(jsonb_set(data, '{skippedAt}', to_jsonb(now())), '{missed}', 'true'::jsonb)
      where id = p_training and coalesce(data ->> 'completedAt', '') = '';
  else
    -- the client decided (undo, skip, do it today): remember that, so it is never filed by itself again
    update ft_trainings set data = jsonb_set(data, '{missed}', 'false'::jsonb) where id = p_training;
  end if;
end;
$$;
revoke execute on function client_miss_training(uuid, boolean) from public, anon;
grant execute on function client_miss_training(uuid, boolean) to authenticated;

select 'client-missed.sql applied' as result;
