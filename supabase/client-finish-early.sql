-- "Finish early": the client can say why an exercise was finished before all its sets were done.
-- The reason lands on the exercise row (earlyReason) so the trainer sees it on the finished card.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

create or replace function client_finish_early(p_training uuid, p_row text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_new jsonb := '[]'::jsonb;
  v_found boolean := false;
  r jsonb;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_row is null then raise exception 'missing argument'; end if;
  if p_reason is not null and length(p_reason) > 40 then raise exception 'bad reason'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;

  select coalesce(data -> 'rows', '[]'::jsonb) into v_rows from ft_trainings where id = p_training for update;
  for r in select * from jsonb_array_elements(v_rows) loop
    if r ->> 'id' = p_row then
      if p_reason is null or p_reason = '' then r := r - 'earlyReason';
      else r := jsonb_set(r, '{earlyReason}', to_jsonb(p_reason)); end if;
      v_found := true;
    end if;
    v_new := v_new || jsonb_build_array(r);
  end loop;
  if not v_found then raise exception 'row not found'; end if;
  update ft_trainings set data = jsonb_set(data, '{rows}', v_new) where id = p_training;
end;
$$;
revoke execute on function client_finish_early(uuid, text, text) from public, anon;
grant execute on function client_finish_early(uuid, text, text) to authenticated;

select 'client-finish-early.sql applied' as result;
