-- Fiala Trainings — clients can finish (and un-finish) their own workout. Paste into Supabase SQL Editor → Run. Safe to re-run.
-- p_at: when the phone says it was finished (a workout done offline on Monday and uploaded on Wednesday is Monday's); null = now; never later than now (a phone clock set ahead).
-- p_zone (v315): the phone's time zone when it was finished ("Europe/Paris"). It is kept as completedZone = { zone, at }, stamped with the very time written
-- as completedAt, so every device files the workout under the day it was where it was done (a Tuesday workout done at 8 am in Paris stays Tuesday's in
-- Los Angeles), and a stamp left from another finish is never read. Anything that is not shaped as a time zone's name is left out.
drop function if exists client_finish_training(uuid, boolean);
drop function if exists client_finish_training(uuid, boolean, timestamptz);
create or replace function client_finish_training(p_training uuid, p_finished boolean, p_at timestamptz default null, p_zone text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz := coalesce(least(p_at, now()), now());
  v_zone text := case when p_zone ~ '^[A-Za-z][A-Za-z0-9_+/-]{1,63}$' then p_zone end;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_finished is null then raise exception 'missing argument'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  update ft_trainings
    set data = case when p_finished then jsonb_set(jsonb_set(jsonb_set((data - 'skippedAt' - 'skipReason' - 'completedZone'), '{completedAt}', to_jsonb(v_at)), '{completedBy}', '"client"'::jsonb), '{missed}', 'false'::jsonb) || (case when v_zone is not null then jsonb_build_object('completedZone', jsonb_build_object('zone', v_zone, 'at', v_at)) when data -> 'completedZone' -> 'at' = to_jsonb(v_at) then jsonb_build_object('completedZone', data -> 'completedZone') else '{}'::jsonb end) else data - 'completedAt' - 'completedBy' - 'completedZone' end   -- finished beats skipped and missed   -- completedBy: the coach's list can tell a client's own finish from one the coach logged   -- completedZone: only the zone sent with this finish, stamped with its own time; a resend of this same finish with no zone (a v314 page taking over the queue) keeps the stamp it already has
    where id = p_training;
end;
$$;
revoke execute on function client_finish_training(uuid, boolean, timestamptz, text) from public, anon;
grant execute on function client_finish_training(uuid, boolean, timestamptz, text) to authenticated;
select 'finish ready' as status;
