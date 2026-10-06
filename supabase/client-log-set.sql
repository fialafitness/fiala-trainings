-- Set-by-set logging for clients: weight AND reps per set, how many sets are done, and the row's done flag.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

create or replace function client_log_set(p_training uuid, p_row text, p_weights jsonb, p_reps jsonb, p_sets_done int, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_new jsonb := '[]'::jsonb;
  v_found boolean := false;
  r jsonb;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_row is null or p_weights is null or p_reps is null then raise exception 'missing argument'; end if;
  if jsonb_typeof(p_weights) <> 'array' or jsonb_array_length(p_weights) > 20 then raise exception 'bad weights'; end if;
  if jsonb_typeof(p_reps) <> 'array' or jsonb_array_length(p_reps) > 20 then raise exception 'bad reps'; end if;
  if exists (select 1 from jsonb_array_elements(p_weights) e
             where jsonb_typeof(e) not in ('string', 'number') or length(e #>> '{}') > 16) then
    raise exception 'bad weights';
  end if;
  if exists (select 1 from jsonb_array_elements(p_reps) e
             where jsonb_typeof(e) not in ('string', 'number') or length(e #>> '{}') > 16) then
    raise exception 'bad reps';
  end if;
  if p_sets_done is null or p_sets_done < 0 or p_sets_done > 20 then raise exception 'bad sets'; end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;

  select coalesce(data -> 'rows', '[]'::jsonb) into v_rows from ft_trainings where id = p_training for update;
  for r in select * from jsonb_array_elements(v_rows) loop
    if r ->> 'id' = p_row then
      r := jsonb_set(r, '{weights}', p_weights);
      r := jsonb_set(r, '{repsDone}', p_reps);
      r := jsonb_set(r, '{setsDone}', to_jsonb(p_sets_done));
      r := jsonb_set(r, '{done}', to_jsonb(coalesce(p_done, false)));
      v_found := true;
    end if;
    v_new := v_new || jsonb_build_array(r);
  end loop;
  if not v_found then raise exception 'row not found'; end if;
  update ft_trainings set data = jsonb_set(data, '{rows}', v_new) where id = p_training;
end;
$$;
revoke execute on function client_log_set(uuid, text, jsonb, jsonb, int, boolean) from public, anon;
grant execute on function client_log_set(uuid, text, jsonb, jsonb, int, boolean) to authenticated;

select 'client-log-set.sql applied' as result;
