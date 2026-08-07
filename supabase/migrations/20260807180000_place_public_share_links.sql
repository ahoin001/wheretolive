-- Public share snapshots for places (guest-readable by unguessable token).
-- Does NOT open live places RLS to anon.
-- Applied remotely via loveable Supabase MCP; kept here for repo history.

create table if not exists app_next_chapter_v1.place_share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  kind text not null check (kind in ('place', 'collection')),
  title text,
  payload jsonb not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0
);

create index if not exists place_share_links_created_by_idx
  on app_next_chapter_v1.place_share_links (created_by, created_at desc);

create index if not exists place_share_links_token_idx
  on app_next_chapter_v1.place_share_links (token)
  where revoked_at is null;

alter table app_next_chapter_v1.place_share_links enable row level security;

drop policy if exists place_share_links_owner_select on app_next_chapter_v1.place_share_links;
create policy place_share_links_owner_select
  on app_next_chapter_v1.place_share_links
  for select to authenticated
  using (created_by = auth.uid());

drop policy if exists place_share_links_owner_update on app_next_chapter_v1.place_share_links;
create policy place_share_links_owner_update
  on app_next_chapter_v1.place_share_links
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

grant select, update on app_next_chapter_v1.place_share_links to authenticated;

create or replace function public.nc_sanitize_shared_place(p jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'id', coalesce(nullif(p->>'id', ''), 'shared'),
      'title', coalesce(p->>'title', ''),
      'url', coalesce(p->>'url', ''),
      'listingKind', case when p->>'listingKind' = 'buy' then 'buy' else 'rent' end,
      'homeType', case
        when p->>'homeType' in ('apartment','condo','single_family','townhome')
          then p->>'homeType'
        else null
      end,
      'price', case when jsonb_typeof(p->'price') = 'number' then p->'price' else 'null'::jsonb end,
      'monthlyEstimate', case when jsonb_typeof(p->'monthlyEstimate') = 'number' then p->'monthlyEstimate' else 'null'::jsonb end,
      'street', coalesce(p->>'street', ''),
      'city', coalesce(p->>'city', ''),
      'state', coalesce(p->>'state', ''),
      'zip', coalesce(p->>'zip', ''),
      'location', coalesce(p->>'location', ''),
      'bedrooms', case when jsonb_typeof(p->'bedrooms') = 'number' then p->'bedrooms' else 'null'::jsonb end,
      'bathrooms', case when jsonb_typeof(p->'bathrooms') = 'number' then p->'bathrooms' else 'null'::jsonb end,
      'sqft', case when jsonb_typeof(p->'sqft') = 'number' then p->'sqft' else 'null'::jsonb end,
      'pets', case
        when p->>'pets' in ('yes','limited','no') then p->>'pets'
        else 'no'
      end,
      'petsNote', coalesce(p->>'petsNote', ''),
      'proTags', coalesce(p->'proTags', '[]'::jsonb),
      'concernTags', coalesce(p->'concernTags', '[]'::jsonb),
      'tier', case
        when p->>'tier' in ('dream','strong','maybe','pass') then p->>'tier'
        else 'maybe'
      end,
      'images', coalesce(p->'images', '[]'::jsonb)
    )
  );
$$;

revoke all on function public.nc_sanitize_shared_place(jsonb) from public;
grant execute on function public.nc_sanitize_shared_place(jsonb) to authenticated, service_role;

create or replace function public.nc_create_place_share(
  p_kind text,
  p_title text,
  p_places jsonb,
  p_expires_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  v_kind text;
  places_in jsonb;
  places_out jsonb := '[]'::jsonb;
  item jsonb;
  tok text;
  expires timestamptz := null;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  v_kind := lower(coalesce(p_kind, 'place'));
  if v_kind not in ('place', 'collection') then
    raise exception 'Invalid kind';
  end if;

  if jsonb_typeof(p_places) <> 'array' then
    raise exception 'places must be an array';
  end if;

  places_in := p_places;
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

  tok := translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');
  tok := rtrim(tok, '=');

  if p_expires_days is not null and p_expires_days > 0 then
    expires := now() + make_interval(days => least(p_expires_days, 365));
  end if;

  insert into app_next_chapter_v1.place_share_links (
    token, kind, title, payload, created_by, expires_at
  ) values (
    tok,
    v_kind,
    nullif(trim(coalesce(p_title, '')), ''),
    jsonb_build_object(
      'version', 1,
      'kind', v_kind,
      'title', nullif(trim(coalesce(p_title, '')), ''),
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

revoke all on function public.nc_create_place_share(text, text, jsonb, integer) from public;
grant execute on function public.nc_create_place_share(text, text, jsonb, integer) to authenticated;

create or replace function public.nc_get_public_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  row app_next_chapter_v1.place_share_links%rowtype;
  tok text := trim(coalesce(p_token, ''));
begin
  if tok = '' or length(tok) < 16 then
    return null;
  end if;

  select * into row
  from app_next_chapter_v1.place_share_links
  where token = tok
  limit 1;

  if not found then
    return null;
  end if;

  if row.revoked_at is not null then
    return null;
  end if;

  if row.expires_at is not null and row.expires_at < now() then
    return null;
  end if;

  update app_next_chapter_v1.place_share_links
  set view_count = view_count + 1
  where id = row.id;

  return jsonb_build_object(
    'token', row.token,
    'kind', row.kind,
    'title', row.title,
    'createdAt', row.created_at,
    'expiresAt', row.expires_at,
    'payload', row.payload
  );
end;
$$;

revoke all on function public.nc_get_public_share(text) from public;
grant execute on function public.nc_get_public_share(text) to anon, authenticated;

create or replace function public.nc_revoke_place_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  updated int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update app_next_chapter_v1.place_share_links
  set revoked_at = now()
  where token = trim(coalesce(p_token, ''))
    and created_by = uid
    and revoked_at is null;

  get diagnostics updated = row_count;
  return jsonb_build_object('revoked', updated > 0);
end;
$$;

revoke all on function public.nc_revoke_place_share(text) from public;
grant execute on function public.nc_revoke_place_share(text) to authenticated;
