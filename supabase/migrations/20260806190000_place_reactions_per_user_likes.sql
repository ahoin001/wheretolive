-- Per-user place likes (reactions) for collaborative + personal lists.
-- favorite column on places remains for legacy; UI prefers place_reactions.

-- ---------------------------------------------------------------------------
-- place_reactions
-- ---------------------------------------------------------------------------
create table if not exists app_next_chapter_v1.place_reactions (
  place_id uuid not null references app_next_chapter_v1.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  liked boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create index if not exists idx_next_chapter_place_reactions_user
  on app_next_chapter_v1.place_reactions (user_id)
  where liked = true;

create index if not exists idx_next_chapter_place_reactions_place
  on app_next_chapter_v1.place_reactions (place_id)
  where liked = true;

alter table app_next_chapter_v1.place_reactions enable row level security;

drop policy if exists nc_place_reactions_select on app_next_chapter_v1.place_reactions;
create policy nc_place_reactions_select
  on app_next_chapter_v1.place_reactions
  for select
  to authenticated
  using (
    exists (
      select 1
      from app_next_chapter_v1.places p
      where p.id = place_id
        and (
          app_next_chapter_v1.is_list_member(p.list_id)
          or p.user_id = auth.uid()
        )
    )
  );

drop policy if exists nc_place_reactions_insert on app_next_chapter_v1.place_reactions;
create policy nc_place_reactions_insert
  on app_next_chapter_v1.place_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from app_next_chapter_v1.places p
      where p.id = place_id
        and (
          app_next_chapter_v1.is_list_member(p.list_id)
          or p.user_id = auth.uid()
        )
    )
  );

drop policy if exists nc_place_reactions_update on app_next_chapter_v1.place_reactions;
create policy nc_place_reactions_update
  on app_next_chapter_v1.place_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists nc_place_reactions_delete on app_next_chapter_v1.place_reactions;
create policy nc_place_reactions_delete
  on app_next_chapter_v1.place_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Realtime (best-effort)
do $$
begin
  alter publication supabase_realtime add table app_next_chapter_v1.place_reactions;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill: legacy places.favorite → reaction for creator
-- ---------------------------------------------------------------------------
insert into app_next_chapter_v1.place_reactions (place_id, user_id, liked, updated_at)
select
  p.id,
  coalesce(p.created_by, p.user_id),
  true,
  now()
from app_next_chapter_v1.places p
where p.favorite = true
  and coalesce(p.created_by, p.user_id) is not null
on conflict (place_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Place JSON includes personal + list reaction summary
-- ---------------------------------------------------------------------------
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
  reaction_summary jsonb;
begin
  select coalesce(array_agg(r.user_id order by r.updated_at), '{}'::uuid[])
  into liker_ids
  from app_next_chapter_v1.place_reactions r
  where r.place_id = p.id
    and r.liked = true;

  liked_me := uid is not null and uid = any (liker_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', r.user_id,
    'displayName', coalesce(nullif(pr.display_name, ''), nullif(pr.email, ''), 'Someone')
  ) order by r.updated_at), '[]'::jsonb)
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
    'price', p.price,
    'monthlyEstimate', p.monthly_estimate,
    'location', p.location,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'notes', p.notes,
    'pets', p.pets,
    'petsNote', p.pets_note,
    'proTags', coalesce(to_jsonb(p.pro_tags), '[]'::jsonb),
    'concernTags', coalesce(to_jsonb(p.concern_tags), '[]'::jsonb),
    'tier', p.tier,
    'status', p.status,
    'favorite', liked_me,
    'likedByMe', liked_me,
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

-- ---------------------------------------------------------------------------
-- Toggle like for current user (any accepted list member)
-- ---------------------------------------------------------------------------
create or replace function public.nc_set_place_like(p_place_id uuid, p_liked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  v_list uuid;
  row app_next_chapter_v1.places;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into row from app_next_chapter_v1.places where id = p_place_id;
  if row.id is null then
    raise exception 'place not found';
  end if;

  v_list := row.list_id;
  if v_list is not null then
    if not app_next_chapter_v1.is_list_member(v_list) then
      raise exception 'not a member of this list';
    end if;
  elsif row.user_id is distinct from uid then
    raise exception 'not allowed';
  end if;

  if p_liked then
    insert into app_next_chapter_v1.place_reactions (place_id, user_id, liked, updated_at)
    values (p_place_id, uid, true, now())
    on conflict (place_id, user_id) do update set
      liked = true,
      updated_at = now();
  else
    delete from app_next_chapter_v1.place_reactions
    where place_id = p_place_id
      and user_id = uid;
  end if;

  -- Keep legacy favorite in sync for solo boards (creator's like only as soft hint)
  -- Do not overwrite for shared multi-member semantics; column is unused by app UI now.
  select * into row from app_next_chapter_v1.places where id = p_place_id;
  return public.nc_place_to_json(row);
end;
$$;

revoke all on function public.nc_set_place_like(uuid, boolean) from public;
grant execute on function public.nc_set_place_like(uuid, boolean) to authenticated;

-- Upsert should not stomp personal reactions via favorite field for other members.
-- Map favorite on write as a like for the current user after upsert.
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

  insert into app_next_chapter_v1.places (
    id, user_id, list_id, created_by, updated_by,
    title, url, location, notes, listing_kind, price, monthly_estimate,
    bedrooms, bathrooms, pets, pets_note, pro_tags, concern_tags, tags, images,
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
    nullif(p_place->>'price', '')::numeric,
    nullif(p_place->>'monthlyEstimate', '')::numeric,
    nullif(p_place->>'bedrooms', '')::numeric,
    nullif(p_place->>'bathrooms', '')::numeric,
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
    price = excluded.price,
    monthly_estimate = excluded.monthly_estimate,
    bedrooms = excluded.bedrooms,
    bathrooms = excluded.bathrooms,
    pets = excluded.pets,
    pets_note = excluded.pets_note,
    pro_tags = excluded.pro_tags,
    concern_tags = excluded.concern_tags,
    tags = excluded.tags,
    images = excluded.images,
    tier = excluded.tier,
    status = excluded.status,
    -- do not let one editor overwrite personal board favorite for others
    updated_at = now()
  where
    app_next_chapter_v1.is_list_editor(app_next_chapter_v1.places.list_id)
    or app_next_chapter_v1.places.user_id = uid
  returning * into row;

  if row.id is null then
    raise exception 'upsert failed or not allowed';
  end if;

  -- Sync caller's personal like from preferred fields when provided
  if p_place ? 'likedByMe' or p_place ? 'favorite' then
    perform public.nc_set_place_like(row.id, want_like);
    select * into row from app_next_chapter_v1.places where id = row.id;
  end if;

  return public.nc_place_to_json(row);
end;
$$;

revoke all on function public.nc_upsert_place(jsonb) from public;
grant execute on function public.nc_upsert_place(jsonb) to authenticated;

grant execute on function public.nc_place_to_json(app_next_chapter_v1.places) to authenticated;
