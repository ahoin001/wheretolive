-- Public API facades for place-list collaboration (avoids requiring custom schema in Data API).
-- Realtime publication for live shared board updates.

-- ---------------------------------------------------------------------------
-- Ensure schema is usable by PostgREST when/if added to exposed schemas
-- ---------------------------------------------------------------------------
grant usage on schema app_next_chapter_v1 to authenticated, service_role, anon;

-- Try to include spoke schema in API without wiping existing dashboard config.
-- Only set if role has no prior pgrst.db_schemas override from dashboard/other tools.
do $$
declare
  cfg text[];
  found boolean := false;
  entry text;
begin
  select rolconfig into cfg from pg_roles where rolname = 'authenticator';
  if cfg is not null then
    foreach entry in array cfg loop
      if entry like 'pgrst.db_schemas=%' then
        found := true;
        -- append app_next_chapter_v1 if missing
        if position('app_next_chapter_v1' in entry) = 0 then
          execute format(
            'alter role authenticator set pgrst.db_schemas = %L',
            replace(entry, 'pgrst.db_schemas=', '') || ', app_next_chapter_v1'
          );
        end if;
      end if;
    end loop;
  end if;

  if not found then
    -- Default Supabase exposure + spoke
    alter role authenticator set pgrst.db_schemas =
      'public, graphql_public, storage, app_next_chapter_v1';
  end if;

  notify pgrst, 'reload config';
exception when others then
  -- Non-fatal: public RPC facade below is the primary path
  raise notice 'Could not update pgrst.db_schemas: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table app_next_chapter_v1.places;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table app_next_chapter_v1.place_list_members;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers: map place row → jsonb (camelCase for app)
-- ---------------------------------------------------------------------------
create or replace function public.nc_place_to_json(p app_next_chapter_v1.places)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
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
    'favorite', p.favorite,
    'images', coalesce(to_jsonb(p.images), '[]'::jsonb),
    'tags', coalesce(to_jsonb(p.tags), '[]'::jsonb),
    'listId', p.list_id,
    'createdBy', p.created_by,
    'updatedBy', p.updated_by
  );
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap: default list + optional prefs row
-- ---------------------------------------------------------------------------
create or replace function public.nc_bootstrap_user()
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  list_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into app_next_chapter_v1.user_prefs (user_id)
  values (uid)
  on conflict (user_id) do nothing;

  list_id := app_next_chapter_v1.ensure_default_place_list(uid);

  return jsonb_build_object('defaultListId', list_id);
end;
$$;

revoke all on function public.nc_bootstrap_user() from public;
grant execute on function public.nc_bootstrap_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Lists for current user (accepted + pending invites)
-- ---------------------------------------------------------------------------
create or replace function public.nc_get_my_lists()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.sort_status, t."updatedAt" desc)
    from (
      select
        pl.id,
        pl.name,
        pl.created_by as "createdBy",
        pl.is_default as "isDefault",
        pl.created_at as "createdAt",
        pl.updated_at as "updatedAt",
        m.role,
        m.status,
        m.id as "membershipId",
        case when m.status = 'pending' then 0 else 1 end as sort_status
      from app_next_chapter_v1.place_list_members m
      join app_next_chapter_v1.place_lists pl on pl.id = m.list_id
      where m.user_id = uid
        and m.status in ('pending', 'accepted')
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.nc_get_my_lists() from public;
grant execute on function public.nc_get_my_lists() to authenticated;

-- ---------------------------------------------------------------------------
-- Places for a list (accepted member only; pending cannot read content)
-- ---------------------------------------------------------------------------
create or replace function public.nc_get_list_places(p_list_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not app_next_chapter_v1.is_list_member(p_list_id) then
    raise exception 'not a member of this list';
  end if;

  return coalesce((
    select jsonb_agg(public.nc_place_to_json(p) order by p.updated_at desc)
    from app_next_chapter_v1.places p
    where p.list_id = p_list_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.nc_get_list_places(uuid) from public;
grant execute on function public.nc_get_list_places(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Upsert place (editor)
-- ---------------------------------------------------------------------------
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
    coalesce((p_place->>'favorite')::boolean, false),
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
    favorite = excluded.favorite,
    updated_at = now()
  where
    app_next_chapter_v1.is_list_editor(app_next_chapter_v1.places.list_id)
    or app_next_chapter_v1.places.user_id = uid
  returning * into row;

  if row.id is null then
    raise exception 'upsert failed or not allowed';
  end if;

  return public.nc_place_to_json(row);
end;
$$;

revoke all on function public.nc_upsert_place(jsonb) from public;
grant execute on function public.nc_upsert_place(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete place
-- ---------------------------------------------------------------------------
create or replace function public.nc_delete_place(p_place_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  v_list uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select list_id into v_list from app_next_chapter_v1.places where id = p_place_id;
  if v_list is null then
    delete from app_next_chapter_v1.places
    where id = p_place_id and user_id = uid;
    return found;
  end if;

  if not app_next_chapter_v1.is_list_editor(v_list) then
    raise exception 'not allowed to delete from this list';
  end if;

  delete from app_next_chapter_v1.places where id = p_place_id;
  return found;
end;
$$;

revoke all on function public.nc_delete_place(uuid) from public;
grant execute on function public.nc_delete_place(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Members of a list
-- ---------------------------------------------------------------------------
create or replace function public.nc_get_list_members(p_list_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not (
    app_next_chapter_v1.is_list_member(p_list_id)
    or app_next_chapter_v1.is_list_owner(p_list_id)
    or exists (
      select 1 from app_next_chapter_v1.place_list_members m
      where m.list_id = p_list_id and m.user_id = uid and m.status = 'pending'
    )
  ) then
    raise exception 'not allowed';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'listId', m.list_id,
      'userId', m.user_id,
      'role', m.role,
      'status', m.status,
      'invitedBy', m.invited_by,
      'displayName', p.display_name,
      'email', p.email,
      'createdAt', m.created_at
    ) order by
      case m.role when 'owner' then 0 when 'editor' then 1 else 2 end,
      m.created_at
    )
    from app_next_chapter_v1.place_list_members m
    left join public.profiles p on p.id = m.user_id
    where m.list_id = p_list_id
      and m.status in ('pending', 'accepted')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.nc_get_list_members(uuid) from public;
grant execute on function public.nc_get_list_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite user to list as editor
-- ---------------------------------------------------------------------------
create or replace function public.nc_invite_to_list(p_list_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  m app_next_chapter_v1.place_list_members;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_user_id = uid then
    raise exception 'cannot invite yourself';
  end if;

  if not app_next_chapter_v1.is_list_owner(p_list_id) then
    -- Also allow accepted editors to invite (shared household; treat editors as equal writers)
    if not app_next_chapter_v1.is_list_editor(p_list_id) then
      raise exception 'not allowed to invite';
    end if;
  end if;

  insert into app_next_chapter_v1.place_list_members (
    list_id, user_id, role, status, invited_by
  ) values (
    p_list_id, p_user_id, 'editor', 'pending', uid
  )
  on conflict (list_id, user_id) do update set
    status = case
      when place_list_members.status = 'accepted' then 'accepted'
      else 'pending'
    end,
    role = case
      when place_list_members.role = 'owner' then 'owner'
      else 'editor'
    end,
    invited_by = uid,
    updated_at = now()
  returning * into m;

  return jsonb_build_object(
    'id', m.id,
    'listId', m.list_id,
    'userId', m.user_id,
    'role', m.role,
    'status', m.status
  );
end;
$$;

revoke all on function public.nc_invite_to_list(uuid, uuid) from public;
grant execute on function public.nc_invite_to_list(uuid, uuid) to authenticated;

-- Editors inviting needs insert policy still blocked for non-owners.
-- Update member insert policy to allow editors to invite as well.
drop policy if exists nc_list_members_insert on app_next_chapter_v1.place_list_members;
create policy nc_list_members_insert
  on app_next_chapter_v1.place_list_members
  for insert
  to authenticated
  with check (
    (
      app_next_chapter_v1.is_list_editor(list_id)
      and invited_by = auth.uid()
      and user_id is distinct from auth.uid()
      and role in ('editor', 'viewer')
      and status = 'pending'
    )
    or (
      user_id = auth.uid()
      and role = 'owner'
      and status = 'accepted'
      and exists (
        select 1 from app_next_chapter_v1.place_lists pl
        where pl.id = list_id
          and pl.created_by = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Accept / decline invite
-- ---------------------------------------------------------------------------
create or replace function public.nc_respond_invite(p_membership_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  m app_next_chapter_v1.place_list_members;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into m
  from app_next_chapter_v1.place_list_members
  where id = p_membership_id
    and user_id = uid
    and status = 'pending';

  if m.id is null then
    raise exception 'invite not found';
  end if;

  if p_accept then
    update app_next_chapter_v1.place_list_members
    set status = 'accepted', updated_at = now()
    where id = p_membership_id
    returning * into m;
  else
    update app_next_chapter_v1.place_list_members
    set status = 'declined', updated_at = now()
    where id = p_membership_id
    returning * into m;
  end if;

  return jsonb_build_object(
    'id', m.id,
    'listId', m.list_id,
    'status', m.status
  );
end;
$$;

revoke all on function public.nc_respond_invite(uuid, boolean) from public;
grant execute on function public.nc_respond_invite(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Remove member or leave list
-- ---------------------------------------------------------------------------
create or replace function public.nc_remove_member(p_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  m app_next_chapter_v1.place_list_members;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into m from app_next_chapter_v1.place_list_members where id = p_membership_id;
  if m.id is null then
    return false;
  end if;

  if m.role = 'owner' and m.user_id = uid then
    raise exception 'owners cannot leave; transfer ownership or delete the list';
  end if;

  if m.user_id <> uid and not app_next_chapter_v1.is_list_owner(m.list_id) then
    raise exception 'not allowed';
  end if;

  delete from app_next_chapter_v1.place_list_members where id = p_membership_id;
  return true;
end;
$$;

revoke all on function public.nc_remove_member(uuid) from public;
grant execute on function public.nc_remove_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Share selected places: create new shared list from subset, or use full list
-- ---------------------------------------------------------------------------
create or replace function public.nc_share_places(
  p_place_ids uuid[],
  p_invite_user_id uuid,
  p_list_name text default 'Shared places'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  default_list uuid;
  target_list uuid;
  place_count int;
  all_on_default boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_invite_user_id is null or p_invite_user_id = uid then
    raise exception 'invalid invitee';
  end if;

  default_list := app_next_chapter_v1.ensure_default_place_list(uid);

  if p_place_ids is null or cardinality(p_place_ids) = 0 then
    -- Share the full default list
    target_list := default_list;
  else
    select count(*) into place_count
    from app_next_chapter_v1.places p
    where p.id = any(p_place_ids)
      and (
        p.user_id = uid
        or (p.list_id is not null and app_next_chapter_v1.is_list_editor(p.list_id))
      );

    if place_count = 0 then
      raise exception 'no accessible places selected';
    end if;

    select
      count(*) = place_count
      and count(*) = (
        select count(*) from app_next_chapter_v1.places x
        where x.list_id = default_list
      )
    into all_on_default
    from app_next_chapter_v1.places p
    where p.id = any(p_place_ids)
      and p.list_id = default_list;

    if all_on_default then
      target_list := default_list;
    else
      -- New shared board with selected places (moved)
      insert into app_next_chapter_v1.place_lists (name, created_by, is_default)
      values (coalesce(nullif(trim(p_list_name), ''), 'Shared places'), uid, false)
      returning id into target_list;

      insert into app_next_chapter_v1.place_list_members (list_id, user_id, role, status, invited_by)
      values (target_list, uid, 'owner', 'accepted', uid);

      update app_next_chapter_v1.places
      set list_id = target_list,
          updated_by = uid,
          updated_at = now()
      where id = any(p_place_ids)
        and (
          user_id = uid
          or (list_id is not null and app_next_chapter_v1.is_list_editor(list_id))
        );
    end if;
  end if;

  perform public.nc_invite_to_list(target_list, p_invite_user_id);

  return jsonb_build_object(
    'listId', target_list,
    'invitedUserId', p_invite_user_id
  );
end;
$$;

revoke all on function public.nc_share_places(uuid[], uuid, text) from public;
grant execute on function public.nc_share_places(uuid[], uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Migrate local places into default cloud list (upsert by id)
-- ---------------------------------------------------------------------------
create or replace function public.nc_migrate_local_places(p_places jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  list_id uuid;
  elem jsonb;
  count_done int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  list_id := app_next_chapter_v1.ensure_default_place_list(uid);

  if p_places is null or jsonb_typeof(p_places) <> 'array' then
    return jsonb_build_object('listId', list_id, 'migrated', 0);
  end if;

  for elem in select * from jsonb_array_elements(p_places)
  loop
    perform public.nc_upsert_place(elem || jsonb_build_object('listId', list_id));
    count_done := count_done + 1;
  end loop;

  return jsonb_build_object('listId', list_id, 'migrated', count_done);
end;
$$;

revoke all on function public.nc_migrate_local_places(jsonb) from public;
grant execute on function public.nc_migrate_local_places(jsonb) to authenticated;

-- Grant usage on type for function return helper
grant execute on function public.nc_place_to_json(app_next_chapter_v1.places) to authenticated;
