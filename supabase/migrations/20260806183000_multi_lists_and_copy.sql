-- Multi-list QoL: create/rename/delete lists + copy place across editable lists.
-- Enriches nc_get_my_lists with place/member counts for UI badges.

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
    select jsonb_agg(row_to_json(t)::jsonb order by t.sort_status, t."isDefault" desc, t."updatedAt" desc)
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
        (
          select count(*)::int
          from app_next_chapter_v1.place_list_members mm
          where mm.list_id = pl.id
            and mm.status = 'accepted'
        ) as "memberCount",
        (
          select count(*)::int
          from app_next_chapter_v1.places p
          where p.list_id = pl.id
        ) as "placeCount",
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

-- Create a new (non-default) list owned by the caller
create or replace function public.nc_create_list(p_name text default 'New list')
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_name), ''), 'New list');
  pl app_next_chapter_v1.place_lists;
  mid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Ensure default list exists first so new ones are clearly extra boards
  perform app_next_chapter_v1.ensure_default_place_list(uid);

  insert into app_next_chapter_v1.place_lists (name, created_by, is_default)
  values (v_name, uid, false)
  returning * into pl;

  insert into app_next_chapter_v1.place_list_members (
    list_id, user_id, role, status, invited_by
  ) values (
    pl.id, uid, 'owner', 'accepted', uid
  )
  returning id into mid;

  return jsonb_build_object(
    'id', pl.id,
    'name', pl.name,
    'createdBy', pl.created_by,
    'isDefault', pl.is_default,
    'createdAt', pl.created_at,
    'updatedAt', pl.updated_at,
    'role', 'owner',
    'status', 'accepted',
    'membershipId', mid,
    'memberCount', 1,
    'placeCount', 0
  );
end;
$$;

revoke all on function public.nc_create_list(text) from public;
grant execute on function public.nc_create_list(text) to authenticated;

-- Rename list (owner only)
create or replace function public.nc_rename_list(p_list_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
  pl app_next_chapter_v1.place_lists;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if v_name is null then
    raise exception 'name is required';
  end if;
  if not app_next_chapter_v1.is_list_owner(p_list_id) then
    raise exception 'not allowed';
  end if;

  update app_next_chapter_v1.place_lists
  set name = v_name, updated_at = now()
  where id = p_list_id
  returning * into pl;

  return jsonb_build_object(
    'id', pl.id,
    'name', pl.name,
    'isDefault', pl.is_default
  );
end;
$$;

revoke all on function public.nc_rename_list(uuid, text) from public;
grant execute on function public.nc_rename_list(uuid, text) to authenticated;

-- Delete a non-default list (owner only). Places in the list are removed.
create or replace function public.nc_delete_list(p_list_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  pl app_next_chapter_v1.place_lists;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into pl from app_next_chapter_v1.place_lists where id = p_list_id;
  if pl.id is null then
    return false;
  end if;
  if not app_next_chapter_v1.is_list_owner(p_list_id) then
    raise exception 'not allowed';
  end if;
  if pl.is_default then
    raise exception 'cannot delete your default list';
  end if;

  delete from app_next_chapter_v1.places where list_id = p_list_id;
  delete from app_next_chapter_v1.place_list_members where list_id = p_list_id;
  delete from app_next_chapter_v1.place_lists where id = p_list_id;
  return true;
end;
$$;

revoke all on function public.nc_delete_list(uuid) from public;
grant execute on function public.nc_delete_list(uuid) to authenticated;

-- Copy a place into another list the user can edit (new id; likes not copied).
create or replace function public.nc_copy_place(
  p_place_id uuid,
  p_target_list_id uuid
)
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

  select * into src from app_next_chapter_v1.places where id = p_place_id;
  if src.id is null then
    raise exception 'place not found';
  end if;

  -- Must be able to read source (member of its list or personal owner)
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
    title, url, location, notes, listing_kind, price, monthly_estimate,
    bedrooms, bathrooms, pets, pets_note, pro_tags, concern_tags, tags, images,
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
    src.price,
    src.monthly_estimate,
    src.bedrooms,
    src.bathrooms,
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

-- Optional bulk copy
create or replace function public.nc_copy_places(
  p_place_ids uuid[],
  p_target_list_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  copied int := 0;
  last_json jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_place_ids is null or cardinality(p_place_ids) = 0 then
    return jsonb_build_object('copied', 0, 'targetListId', p_target_list_id);
  end if;

  foreach pid in array p_place_ids
  loop
    begin
      last_json := public.nc_copy_place(pid, p_target_list_id);
      copied := copied + 1;
    exception when others then
      -- skip items that fail (e.g. already on target)
      null;
    end;
  end loop;

  return jsonb_build_object(
    'copied', copied,
    'targetListId', p_target_list_id
  );
end;
$$;

revoke all on function public.nc_copy_places(uuid[], uuid) from public;
grant execute on function public.nc_copy_places(uuid[], uuid) to authenticated;
