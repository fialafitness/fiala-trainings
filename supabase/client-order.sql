-- "Start this exercise": a client puts an exercise ahead of the ones she has not done yet (the machine was taken).
-- Only the numbers (labels) of the numbered rows change — "1", "2a", "2b" … — nothing else about the workout.
-- Run once in the Supabase SQL Editor. Until it is run, the new order stays on the phone and is sent later.
create or replace function client_order_rows(p_training uuid, p_labels jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb; v_new jsonb := '[]'::jsonb; v_changed boolean := false; r jsonb; v_label text;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_labels is null or jsonb_typeof(p_labels) <> 'object' then raise exception 'missing argument'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  select coalesce(data -> 'rows', '[]'::jsonb) into v_rows from ft_trainings where id = p_training for update;
  for r in select * from jsonb_array_elements(v_rows) loop
    v_label := p_labels ->> (r ->> 'id');
    if v_label is not null then
      if v_label !~ '^[0-9]{1,3}[a-z]?$' then raise exception 'bad label'; end if;   -- an exercise number, with a superset letter at most
      if coalesce(r ->> 'label', '') <> v_label then r := jsonb_set(r, '{label}', to_jsonb(v_label)); v_changed := true; end if;
    end if;
    v_new := v_new || jsonb_build_array(r);
  end loop;
  if v_changed then update ft_trainings set data = jsonb_set(data, '{rows}', v_new) where id = p_training; end if;
end;
$$;
revoke execute on function client_order_rows(uuid, jsonb) from public, anon;
grant execute on function client_order_rows(uuid, jsonb) to authenticated;
select 'order ready' as status;
