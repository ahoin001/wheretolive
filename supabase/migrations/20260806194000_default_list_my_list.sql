-- Default personal board is "My List" for every new user.

alter table app_next_chapter_v1.place_lists
  alter column name set default 'My List';

create or replace function app_next_chapter_v1.ensure_default_place_list(p_user_id uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = app_next_chapter_v1, public
as $$
declare
  v_list_id uuid;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  select pl.id into v_list_id
  from app_next_chapter_v1.place_lists pl
  where pl.created_by = p_user_id
    and pl.is_default = true
  order by pl.created_at asc
  limit 1;

  if v_list_id is null then
    insert into app_next_chapter_v1.place_lists (name, created_by, is_default)
    values ('My List', p_user_id, true)
    returning id into v_list_id;

    insert into app_next_chapter_v1.place_list_members (list_id, user_id, role, status, invited_by)
    values (v_list_id, p_user_id, 'owner', 'accepted', p_user_id)
    on conflict (list_id, user_id) do update
      set role = 'owner',
          status = 'accepted',
          updated_at = now();
  else
    insert into app_next_chapter_v1.place_list_members (list_id, user_id, role, status, invited_by)
    values (v_list_id, p_user_id, 'owner', 'accepted', p_user_id)
    on conflict (list_id, user_id) do nothing;
  end if;

  return v_list_id;
end;
$$;

-- Align existing default boards still on the old stock name
update app_next_chapter_v1.place_lists
set name = 'My List',
    updated_at = now()
where is_default = true
  and name in ('My places', 'My Places');
