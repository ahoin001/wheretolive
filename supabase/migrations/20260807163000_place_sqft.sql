-- Living area (sqft) for place form + min-size filters

alter table app_next_chapter_v1.places
  add column if not exists sqft numeric
    check (sqft is null or sqft > 0);

create index if not exists idx_next_chapter_places_sqft
  on app_next_chapter_v1.places (sqft)
  where sqft is not null;

create or replace function public.nc_place_to_json(p app_next_chapter_v1.places)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  liker_ids uuid[];
  liked_me boolean := false;
  my_liked_at timestamptz;
  reaction_summary jsonb;
begin
  select coalesce(array_agg(r.user_id order by r.updated_at desc), '{}'::uuid[])
  into liker_ids
  from app_next_chapter_v1.place_reactions r
  where r.place_id = p.id
    and r.liked = true;

  liked_me := uid is not null and uid = any (liker_ids);

  select r.updated_at
  into my_liked_at
  from app_next_chapter_v1.place_reactions r
  where r.place_id = p.id
    and r.user_id = uid
    and r.liked = true
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', r.user_id,
    'displayName', coalesce(nullif(pr.display_name, ''), nullif(pr.email, ''), 'Someone'),
    'likedAt', r.updated_at
  ) order by r.updated_at desc), '[]'::jsonb)
  into reaction_summary
  from app_next_chapter_v1.place_reactions r
  left join public.profiles pr on pr.id = r.user_id
  where r.place_id = p.id
    and r.liked = true;

  return jsonb_build_object(
    'id', p.id,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'title', p.title,
    'url', p.url,
    'listingKind', p.listing_kind,
    'homeType', p.home_type,
    'price', p.price,
    'monthlyEstimate', p.monthly_estimate,
    'location', p.location,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'sqft', p.sqft,
    'notes', p.notes,
    'pets', p.pets,
    'petsNote', p.pets_note,
    'proTags', coalesce(to_jsonb(p.pro_tags), '[]'::jsonb),
    'concernTags', coalesce(to_jsonb(p.concern_tags), '[]'::jsonb),
    'tier', p.tier,
    'status', p.status,
    'favorite', liked_me,
    'likedByMe', liked_me,
    'likedAt', my_liked_at,
    'likedByUserIds', to_jsonb(liker_ids),
    'likedBy', reaction_summary,
    'images', coalesce(to_jsonb(p.images), '[]'::jsonb),
    'tags', coalesce(to_jsonb(p.tags), '[]'::jsonb),
    'listId', p.list_id,
    'createdBy', p.created_by,
    'updatedBy', p.updated_by
  );
end;
$$;

create or replace function public.nc_upsert_place(p_place jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  v_list uuid;
  v_id uuid;
  row app_next_chapter_v1.places;
  want_like boolean;
  v_home_type text;
  v_sqft numeric;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  v_list := (p_place->>'listId')::uuid;
  if v_list is null then
    v_list := app_next_chapter_v1.ensure_default_place_list(uid);
  end if;

  if not app_next_chapter_v1.is_list_editor(v_list) then
    raise exception 'not allowed to edit this list';
  end if;

  v_id := coalesce((p_place->>'id')::uuid, gen_random_uuid());
  want_like := coalesce(
    (p_place->>'likedByMe')::boolean,
    (p_place->>'favorite')::boolean,
    false
  );

  v_home_type := nullif(p_place->>'homeType', '');
  if v_home_type is not null
     and v_home_type not in ('apartment', 'condo', 'single_family', 'townhome') then
    v_home_type := null;
  end if;

  v_sqft := nullif(p_place->>'sqft', '')::numeric;
  if v_sqft is not null and v_sqft <= 0 then
    v_sqft := null;
  end if;

  insert into app_next_chapter_v1.places (
    id, user_id, list_id, created_by, updated_by,
    title, url, location, notes, listing_kind, home_type, price, monthly_estimate,
    bedrooms, bathrooms, sqft, pets, pets_note, pro_tags, concern_tags, tags, images,
    tier, status, favorite, created_at, updated_at
  ) values (
    v_id,
    uid,
    v_list,
    uid,
    uid,
    coalesce(p_place->>'title', ''),
    coalesce(p_place->>'url', ''),
    coalesce(p_place->>'location', ''),
    coalesce(p_place->>'notes', ''),
    coalesce(p_place->>'listingKind', 'rent'),
    v_home_type,
    nullif(p_place->>'price', '')::numeric,
    nullif(p_place->>'monthlyEstimate', '')::numeric,
    nullif(p_place->>'bedrooms', '')::numeric,
    nullif(p_place->>'bathrooms', '')::numeric,
    v_sqft,
    coalesce(p_place->>'pets', 'no'),
    coalesce(p_place->>'petsNote', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_place->'proTags', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_place->'concernTags', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_place->'tags', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_place->'images', '[]'::jsonb))), '{}'),
    coalesce(p_place->>'tier', 'maybe'),
    coalesce(p_place->>'status', 'none'),
    want_like,
    coalesce((p_place->>'createdAt')::timestamptz, now()),
    now()
  )
  on conflict (id) do update set
    list_id = excluded.list_id,
    updated_by = uid,
    title = excluded.title,
    url = excluded.url,
    location = excluded.location,
    notes = excluded.notes,
    listing_kind = excluded.listing_kind,
    home_type = excluded.home_type,
    price = excluded.price,
    monthly_estimate = excluded.monthly_estimate,
    bedrooms = excluded.bedrooms,
    bathrooms = excluded.bathrooms,
    sqft = excluded.sqft,
    pets = excluded.pets,
    pets_note = excluded.pets_note,
    pro_tags = excluded.pro_tags,
    concern_tags = excluded.concern_tags,
    tags = excluded.tags,
    images = excluded.images,
    tier = excluded.tier,
    status = excluded.status,
    updated_at = now()
  where
    app_next_chapter_v1.is_list_editor(app_next_chapter_v1.places.list_id)
    or app_next_chapter_v1.places.user_id = uid
  returning * into row;

  if row.id is null then
    raise exception 'upsert failed or not allowed';
  end if;

  if p_place ? 'likedByMe' or p_place ? 'favorite' then
    perform public.nc_set_place_like(row.id, want_like);
    select * into row from app_next_chapter_v1.places where id = row.id;
  end if;

  return public.nc_place_to_json(row);
end;
$$;

revoke all on function public.nc_upsert_place(jsonb) from public;
grant execute on function public.nc_upsert_place(jsonb) to authenticated;

create or replace function public.nc_copy_place(p_place_id uuid, p_target_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  src app_next_chapter_v1.places;
  dest app_next_chapter_v1.places;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into src
  from app_next_chapter_v1.places
  where id = p_place_id;

  if src.id is null then
    raise exception 'place not found';
  end if;

  if src.list_id is not null then
    if not app_next_chapter_v1.is_list_member(src.list_id) then
      raise exception 'not allowed to read this place';
    end if;
  elsif src.user_id is distinct from uid then
    raise exception 'not allowed to read this place';
  end if;

  if not app_next_chapter_v1.is_list_editor(p_target_list_id) then
    raise exception 'not allowed to edit the target list';
  end if;

  if src.list_id is not distinct from p_target_list_id then
    raise exception 'place is already on that list';
  end if;

  insert into app_next_chapter_v1.places (
    id, user_id, list_id, created_by, updated_by,
    title, url, location, notes, listing_kind, home_type, price, monthly_estimate,
    bedrooms, bathrooms, sqft, pets, pets_note, pro_tags, concern_tags, tags, images,
    tier, status, favorite, created_at, updated_at
  ) values (
    gen_random_uuid(),
    uid,
    p_target_list_id,
    uid,
    uid,
    src.title,
    src.url,
    src.location,
    src.notes,
    src.listing_kind,
    src.home_type,
    src.price,
    src.monthly_estimate,
    src.bedrooms,
    src.bathrooms,
    src.sqft,
    src.pets,
    src.pets_note,
    src.pro_tags,
    src.concern_tags,
    src.tags,
    src.images,
    src.tier,
    src.status,
    false,
    now(),
    now()
  )
  returning * into dest;

  return public.nc_place_to_json(dest);
end;
$$;

revoke all on function public.nc_copy_place(uuid, uuid) from public;
grant execute on function public.nc_copy_place(uuid, uuid) to authenticated;

grant execute on function public.nc_place_to_json(app_next_chapter_v1.places) to authenticated;
