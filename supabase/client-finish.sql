-- Fiala Trainings — clients can finish (and un-finish) their own workout. Paste into Supabase SQL Editor → Run. Safe to re-run.
create or replace function client_finish_training(p_training uuid, p_finished boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_finished is null then raise exception 'missing argument'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  update ft_trainings
    set data = case when p_finished then jsonb_set(jsonb_set(jsonb_set((data - 'skippedAt' - 'skipReason'), '{completedAt}', to_jsonb(now())), '{completedBy}', '"client"'::jsonb), '{missed}', 'false'::jsonb) else data - 'completedAt' - 'completedBy' end   -- finished beats skipped and missed   -- completedBy: the coach's list can tell a client's own finish from one the coach logged
    where id = p_training;
end;
$$;
revoke execute on function client_finish_training(uuid, boolean) from public, anon;
grant execute on function client_finish_training(uuid, boolean) to authenticated;
select 'finish ready' as status;
