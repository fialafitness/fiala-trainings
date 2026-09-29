-- Fiala Trainings — "done" checks for clients. Paste into Supabase SQL Editor → Run. Safe to re-run.
create or replace function client_set_done(p_training uuid, p_row text, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_new jsonb := '[]'::jsonb;
  v_found boolean := false;
  r jsonb;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_row is null or p_done is null then raise exception 'missing argument'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;

  select coalesce(data -> 'rows', '[]'::jsonb) into v_rows from ft_trainings where id = p_training for update;
  for r in select * from jsonb_array_elements(v_rows) loop
    if r ->> 'id' = p_row then r := jsonb_set(r, '{done}', to_jsonb(p_done)); v_found := true; end if;
    v_new := v_new || jsonb_build_array(r);
  end loop;
  if not v_found then raise exception 'row not found'; end if;
  update ft_trainings set data = jsonb_set(data, '{rows}', v_new) where id = p_training;
end;
$$;
revoke execute on function client_set_done(uuid, text, boolean) from public, anon;
grant execute on function client_set_done(uuid, text, boolean) to authenticated;
select 'done checks ready' as status;
