-- Collaborative place lists: lists, members, membership RLS, profile discoverability + search.
-- Follow-on to owner-only places; scenarios stay private (user_id only).

-- ---------------------------------------------------------------------------
-- Profile discoverability (hub)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists searchable boolean not null default true;

-- ---------------------------------------------------------------------------
-- place_lists
-- ---------------------------------------------------------------------------
create table if not exists app_next_chapter_v1.place_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My places',
  created_by uuid not null references auth.users(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_next_chapter_place_lists_created_by
  on app_next_chapter_v1.place_lists (created_by);

drop trigger if exists trg_next_chapter_place_lists_updated_at on app_next_chapter_v1.place_lists;
create trigger trg_next_chapter_place_lists_updated_at
before update on app_next_chapter_v1.place_lists
for each row execute function app_next_chapter_v1.set_updated_at();

-- ---------------------------------------------------------------------------
-- place_list_members
-- ---------------------------------------------------------------------------
create table if not exists app_next_chapter_v1.place_list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references app_next_chapter_v1.place_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor'
    check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create index if not exists idx_next_chapter_list_members_user
  on app_next_chapter_v1.place_list_members (user_id, status);

create index if not exists idx_next_chapter_list_members_list
  on app_next_chapter_v1.place_list_members (list_id, status);

drop trigger if exists trg_next_chapter_list_members_updated_at on app_next_chapter_v1.place_list_members;
create trigger trg_next_chapter_list_members_updated_at
before update on app_next_chapter_v1.place_list_members
for each row execute function app_next_chapter_v1.set_updated_at();

-- ---------------------------------------------------------------------------
-- places: list membership + attribution
-- ---------------------------------------------------------------------------
alter table app_next_chapter_v1.places
  add column if not exists list_id uuid references app_next_chapter_v1.place_lists(id) on delete set null;

alter table app_next_chapter_v1.places
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table app_next_chapter_v1.places
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create index if not exists idx_next_chapter_places_list_id
  on app_next_chapter_v1.places (list_id);

create index if not exists idx_next_chapter_places_list_updated
  on app_next_chapter_v1.places (list_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer — avoid RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function app_next_chapter_v1.is_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app_next_chapter_v1, public
as $$
  select exists (
    select 1
    from app_next_chapter_v1.place_list_members m
    where m.list_id = p_list_id
      and m.user_id = auth.uid()
      and m.status = 'accepted'
  );
$$;

create or replace function app_next_chapter_v1.is_list_editor(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app_next_chapter_v1, public
as $$
  select exists (
    select 1
    from app_next_chapter_v1.place_list_members m
    where m.list_id = p_list_id
      and m.user_id = auth.uid()
      and m.status = 'accepted'
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function app_next_chapter_v1.is_list_owner(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app_next_chapter_v1, public
as $$
  select exists (
    select 1
    from app_next_chapter_v1.place_list_members m
    where m.list_id = p_list_id
      and m.user_id = auth.uid()
      and m.status = 'accepted'
      and m.role = 'owner'
  );
$$;

revoke all on function app_next_chapter_v1.is_list_member(uuid) from public;
revoke all on function app_next_chapter_v1.is_list_editor(uuid) from public;
revoke all on function app_next_chapter_v1.is_list_owner(uuid) from public;
grant execute on function app_next_chapter_v1.is_list_member(uuid) to authenticated;
grant execute on function app_next_chapter_v1.is_list_editor(uuid) to authenticated;
grant execute on function app_next_chapter_v1.is_list_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ensure default personal list + owner membership
-- ---------------------------------------------------------------------------
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
    values ('My places', p_user_id, true)
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

revoke all on function app_next_chapter_v1.ensure_default_place_list(uuid) from public;
grant execute on function app_next_chapter_v1.ensure_default_place_list(uuid) to authenticated;

-- Auto-create default list when prefs row is first inserted (post-login setup path)
create or replace function app_next_chapter_v1.trg_ensure_list_on_prefs()
returns trigger
language plpgsql
security definer
set search_path = app_next_chapter_v1, public
as $$
begin
  perform app_next_chapter_v1.ensure_default_place_list(new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_next_chapter_prefs_ensure_list on app_next_chapter_v1.user_prefs;
create trigger trg_next_chapter_prefs_ensure_list
after insert on app_next_chapter_v1.user_prefs
for each row execute function app_next_chapter_v1.trg_ensure_list_on_prefs();

-- ---------------------------------------------------------------------------
-- Grants + RLS for new tables
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on app_next_chapter_v1.place_lists to authenticated, service_role;
grant select, insert, update, delete on app_next_chapter_v1.place_list_members to authenticated, service_role;

alter table app_next_chapter_v1.place_lists enable row level security;
alter table app_next_chapter_v1.place_list_members enable row level security;
alter table app_next_chapter_v1.place_lists force row level security;
alter table app_next_chapter_v1.place_list_members force row level security;

-- Lists: members can read; creators / owners can manage metadata
drop policy if exists nc_place_lists_select on app_next_chapter_v1.place_lists;
create policy nc_place_lists_select
  on app_next_chapter_v1.place_lists
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or app_next_chapter_v1.is_list_member(id)
    or exists (
      select 1 from app_next_chapter_v1.place_list_members m
      where m.list_id = place_lists.id
        and m.user_id = auth.uid()
        and m.status = 'pending'
    )
  );

drop policy if exists nc_place_lists_insert on app_next_chapter_v1.place_lists;
create policy nc_place_lists_insert
  on app_next_chapter_v1.place_lists
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists nc_place_lists_update on app_next_chapter_v1.place_lists;
create policy nc_place_lists_update
  on app_next_chapter_v1.place_lists
  for update
  to authenticated
  using (app_next_chapter_v1.is_list_owner(id))
  with check (app_next_chapter_v1.is_list_owner(id));

drop policy if exists nc_place_lists_delete on app_next_chapter_v1.place_lists;
create policy nc_place_lists_delete
  on app_next_chapter_v1.place_lists
  for delete
  to authenticated
  using (app_next_chapter_v1.is_list_owner(id));

-- Members: see own memberships + rows for lists you can manage or already member of
drop policy if exists nc_list_members_select on app_next_chapter_v1.place_list_members;
create policy nc_list_members_select
  on app_next_chapter_v1.place_list_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or app_next_chapter_v1.is_list_member(list_id)
    or app_next_chapter_v1.is_list_owner(list_id)
  );

drop policy if exists nc_list_members_insert on app_next_chapter_v1.place_list_members;
create policy nc_list_members_insert
  on app_next_chapter_v1.place_list_members
  for insert
  to authenticated
  with check (
    -- Owner inviting someone
    (
      app_next_chapter_v1.is_list_owner(list_id)
      and invited_by = auth.uid()
      and user_id is distinct from auth.uid()
    )
    -- Or bootstrap self as owner on a list you created
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

drop policy if exists nc_list_members_update on app_next_chapter_v1.place_list_members;
create policy nc_list_members_update
  on app_next_chapter_v1.place_list_members
  for update
  to authenticated
  using (
    -- Invitee accepting/declining their invite
    user_id = auth.uid()
    or app_next_chapter_v1.is_list_owner(list_id)
  )
  with check (
    user_id = auth.uid()
    or app_next_chapter_v1.is_list_owner(list_id)
  );

drop policy if exists nc_list_members_delete on app_next_chapter_v1.place_list_members;
create policy nc_list_members_delete
  on app_next_chapter_v1.place_list_members
  for delete
  to authenticated
  using (
    -- Leave list
    user_id = auth.uid()
    or app_next_chapter_v1.is_list_owner(list_id)
  );

-- Replace owner-only places policy with member-aware access
drop policy if exists nc_places_crud_own on app_next_chapter_v1.places;

drop policy if exists nc_places_select on app_next_chapter_v1.places;
create policy nc_places_select
  on app_next_chapter_v1.places
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (list_id is not null and app_next_chapter_v1.is_list_member(list_id))
  );

drop policy if exists nc_places_insert on app_next_chapter_v1.places;
create policy nc_places_insert
  on app_next_chapter_v1.places
  for insert
  to authenticated
  with check (
    (
      list_id is not null
      and app_next_chapter_v1.is_list_editor(list_id)
    )
    or (
      list_id is null
      and user_id = auth.uid()
    )
  );

drop policy if exists nc_places_update on app_next_chapter_v1.places;
create policy nc_places_update
  on app_next_chapter_v1.places
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or (list_id is not null and app_next_chapter_v1.is_list_editor(list_id))
  )
  with check (
    user_id = auth.uid()
    or (list_id is not null and app_next_chapter_v1.is_list_editor(list_id))
  );

drop policy if exists nc_places_delete on app_next_chapter_v1.places;
create policy nc_places_delete
  on app_next_chapter_v1.places
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or (list_id is not null and app_next_chapter_v1.is_list_editor(list_id))
  );

-- ---------------------------------------------------------------------------
-- Privacy-safe user search for sharing (exact email OR prefix display name)
-- Only returns users who opted into discoverability in this project.
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles_for_share(p_query text, p_limit int default 8)
returns table (
  id uuid,
  display_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  q text := trim(coalesce(p_query, ''));
  lim int := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if length(q) < 2 then
    return;
  end if;

  return query
  select p.id, p.display_name, p.email
  from public.profiles p
  where p.id is distinct from auth.uid()
    and coalesce(p.searchable, true) = true
    and (
      -- Exact email match (case-insensitive)
      (position('@' in q) > 0 and lower(coalesce(p.email, '')) = lower(q))
      -- Prefix display name match (min 2 chars)
      or (
        p.display_name is not null
        and p.display_name <> ''
        and lower(p.display_name) like lower(q) || '%'
      )
    )
  order by
    case when lower(coalesce(p.email, '')) = lower(q) then 0 else 1 end,
    p.display_name nulls last
  limit lim;
end;
$$;

revoke all on function public.search_profiles_for_share(text, int) from public;
grant execute on function public.search_profiles_for_share(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Ensure default list for each existing user who already has prefs/places
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select distinct user_id from app_next_chapter_v1.user_prefs
    union
    select distinct user_id from app_next_chapter_v1.places
  loop
    perform app_next_chapter_v1.ensure_default_place_list(r.user_id);
  end loop;

  -- Attach orphan personal places to each user's default list
  update app_next_chapter_v1.places p
  set list_id = app_next_chapter_v1.ensure_default_place_list(p.user_id),
      created_by = coalesce(p.created_by, p.user_id),
      updated_by = coalesce(p.updated_by, p.user_id)
  where p.list_id is null;
end $$;
