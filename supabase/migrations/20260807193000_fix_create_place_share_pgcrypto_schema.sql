-- gen_random_bytes lives in extensions on Supabase; SECURITY DEFINER
-- search_path was public + app schema only, so token generation failed.

create or replace function public.nc_create_place_share(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1, extensions
as $$
declare
  uid uuid := auth.uid();
  v_kind text;
  places_in jsonb;
  places_out jsonb := '[]'::jsonb;
  item jsonb;
  tok text;
  expires timestamptz := null;
  expires_days integer;
  new_id uuid;
  v_title text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be an object';
  end if;

  v_kind := lower(coalesce(p_payload->>'kind', 'place'));
  if v_kind not in ('place', 'collection') then
    raise exception 'Invalid kind';
  end if;

  v_title := nullif(trim(coalesce(p_payload->>'title', '')), '');
  places_in := p_payload->'places';

  if jsonb_typeof(places_in) <> 'array' then
    raise exception 'places must be an array';
  end if;

  if jsonb_array_length(places_in) < 1 then
    raise exception 'At least one place is required';
  end if;
  if jsonb_array_length(places_in) > 40 then
    raise exception 'Too many places (max 40)';
  end if;

  if v_kind = 'place' and jsonb_array_length(places_in) <> 1 then
    v_kind := 'collection';
  end if;

  for item in select * from jsonb_array_elements(places_in)
  loop
    places_out := places_out || jsonb_build_array(public.nc_sanitize_shared_place(item));
  end loop;

  tok := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
  tok := rtrim(tok, '=');

  begin
    expires_days := nullif(p_payload->>'expiresDays', '')::integer;
  exception when others then
    expires_days := null;
  end;

  if expires_days is not null and expires_days > 0 then
    expires := now() + make_interval(days => least(expires_days, 365));
  end if;

  insert into app_next_chapter_v1.place_share_links (
    token, kind, title, payload, created_by, expires_at
  ) values (
    tok,
    v_kind,
    v_title,
    jsonb_build_object(
      'version', 1,
      'kind', v_kind,
      'title', v_title,
      'places', places_out
    ),
    uid,
    expires
  )
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'token', tok,
    'kind', v_kind,
    'path', '/s/' || tok
  );
end;
$$;

grant execute on function public.nc_create_place_share(jsonb) to authenticated;
grant execute on function public.nc_create_place_share(jsonb) to service_role;

notify pgrst, 'reload schema';
