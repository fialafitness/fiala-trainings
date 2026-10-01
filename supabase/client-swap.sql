-- Fiala Trainings — clients may swap an exercise for one of its listed alternatives. Paste into Supabase SQL Editor → Run. Safe to re-run.
create or replace function client_swap_exercise(p_training uuid, p_row text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb; v_new jsonb := '[]'::jsonb; v_found boolean := false; v_changed boolean := false; r jsonb; v_old text; v_alts jsonb; v_newalts jsonb;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_row is null then raise exception 'missing argument'; end if;
  if p_name is null or length(p_name) = 0 or length(p_name) > 120 then raise exception 'bad name'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  select coalesce(data -> 'rows', '[]'::jsonb) into v_rows from ft_trainings where id = p_training for update;
  for r in select * from jsonb_array_elements(v_rows) loop
    if r ->> 'id' = p_row then
      v_found := true;
      v_old := coalesce(r ->> 'name', '');
      v_alts := case when jsonb_typeof(r -> 'alts') = 'array' then r -> 'alts' else '[]'::jsonb end;
      if v_old <> p_name then                      -- already the current exercise = nothing to do
        if not (v_alts ? p_name) then raise exception 'not an alternative'; end if;
        select coalesce(jsonb_agg(case when e = to_jsonb(p_name) then to_jsonb(v_old) else e end), '[]'::jsonb) into v_newalts from jsonb_array_elements(v_alts) e;
        r := jsonb_set(jsonb_set(r, '{name}', to_jsonb(p_name)), '{alts}', v_newalts);
        v_changed := true;
      end if;
    end if;
    v_new := v_new || jsonb_build_array(r);
  end loop;
  if not v_found then raise exception 'row not found'; end if;
  if v_changed then update ft_trainings set data = jsonb_set(data, '{rows}', v_new) where id = p_training; end if;
end;
$$;
revoke execute on function client_swap_exercise(uuid, text, text) from public, anon;
grant execute on function client_swap_exercise(uuid, text, text) to authenticated;
select 'swap ready' as status;
