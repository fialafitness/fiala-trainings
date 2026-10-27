-- Fiala Trainings — clients can skip (and un-skip) their own workout, with a reason. Paste into Supabase SQL Editor → Run. Safe to re-run.
drop function if exists client_skip_training(uuid, boolean);
create or replace function client_skip_training(p_training uuid, p_skipped boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_skipped is null then raise exception 'missing argument'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  update ft_trainings
    set data = case when p_skipped and coalesce(data ->> 'completedAt', '') <> '' then data   -- a finished workout cannot be skipped
      when p_skipped
      then (case when coalesce(p_reason, '') <> '' then jsonb_set(jsonb_set(data, '{skippedAt}', to_jsonb(now())), '{skipReason}', to_jsonb(left(p_reason, 40))) else jsonb_set(data, '{skippedAt}', to_jsonb(now())) - 'skipReason' end)
      else data - 'skippedAt' - 'skipReason' end
    where id = p_training;
end;
$$;
revoke execute on function client_skip_training(uuid, boolean, text) from public, anon;
grant execute on function client_skip_training(uuid, boolean, text) to authenticated;
select 'skip ready' as status;
