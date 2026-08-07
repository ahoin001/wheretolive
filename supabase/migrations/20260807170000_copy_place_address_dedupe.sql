-- Prevent copying a place into a list that already has the same location text.
-- Client also does smarter structured-address matching; this is a safety net.

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
  src_loc text;
  existing_id uuid;
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

  src_loc := lower(regexp_replace(trim(coalesce(src.location, '')), '\s+', ' ', 'g'));
  if src_loc <> '' then
    select p.id into existing_id
    from app_next_chapter_v1.places p
    where p.list_id = p_target_list_id
      and lower(regexp_replace(trim(coalesce(p.location, '')), '\s+', ' ', 'g')) = src_loc
    limit 1;

    if existing_id is not null then
      raise exception 'already in this list';
    end if;
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
