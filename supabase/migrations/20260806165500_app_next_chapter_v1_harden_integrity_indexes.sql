-- Harden Room for the Next Chapter for ownership integrity + scalable list queries
-- Applied via loveable Supabase MCP (apply_migration: app_next_chapter_v1_harden_integrity_indexes).

-- Non-negative money / size fields
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'places_price_nonneg'
  ) then
    alter table app_next_chapter_v1.places
      add constraint places_price_nonneg check (price is null or price >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'places_monthly_estimate_nonneg'
  ) then
    alter table app_next_chapter_v1.places
      add constraint places_monthly_estimate_nonneg check (monthly_estimate is null or monthly_estimate >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'places_bedrooms_nonneg'
  ) then
    alter table app_next_chapter_v1.places
      add constraint places_bedrooms_nonneg check (bedrooms is null or bedrooms >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'places_bathrooms_nonneg'
  ) then
    alter table app_next_chapter_v1.places
      add constraint places_bathrooms_nonneg check (bathrooms is null or bathrooms >= 0);
  end if;
end $$;

-- Prevent cross-user scenario attachment on places / prefs
create or replace function app_next_chapter_v1.enforce_same_owner_scenario()
returns trigger
language plpgsql
set search_path = app_next_chapter_v1, public
as $$
declare
  owner uuid;
begin
  if new.scenario_id is not null then
    select s.user_id into owner
    from app_next_chapter_v1.scenarios s
    where s.id = new.scenario_id;

    if owner is null then
      raise exception 'scenario % does not exist', new.scenario_id;
    end if;

    if owner is distinct from new.user_id then
      raise exception 'scenario % does not belong to user %', new.scenario_id, new.user_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function app_next_chapter_v1.enforce_prefs_same_owner_scenario()
returns trigger
language plpgsql
set search_path = app_next_chapter_v1, public
as $$
declare
  owner uuid;
begin
  if new.active_scenario_id is not null then
    select s.user_id into owner
    from app_next_chapter_v1.scenarios s
    where s.id = new.active_scenario_id;

    if owner is null then
      raise exception 'scenario % does not exist', new.active_scenario_id;
    end if;

    if owner is distinct from new.user_id then
      raise exception 'scenario % does not belong to user %', new.active_scenario_id, new.user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_next_chapter_places_same_owner on app_next_chapter_v1.places;
create trigger trg_next_chapter_places_same_owner
before insert or update of scenario_id, user_id on app_next_chapter_v1.places
for each row execute function app_next_chapter_v1.enforce_same_owner_scenario();

drop trigger if exists trg_next_chapter_prefs_same_owner on app_next_chapter_v1.user_prefs;
create trigger trg_next_chapter_prefs_same_owner
before insert or update of active_scenario_id, user_id on app_next_chapter_v1.user_prefs
for each row execute function app_next_chapter_v1.enforce_prefs_same_owner_scenario();

-- Composite / GIN indexes for owner-scoped lists and tag filters
create index if not exists idx_next_chapter_places_user_updated
  on app_next_chapter_v1.places (user_id, updated_at desc);

create index if not exists idx_next_chapter_places_user_tier
  on app_next_chapter_v1.places (user_id, tier);

create index if not exists idx_next_chapter_places_user_status
  on app_next_chapter_v1.places (user_id, status);

create index if not exists idx_next_chapter_places_user_listing_kind
  on app_next_chapter_v1.places (user_id, listing_kind);

create index if not exists idx_next_chapter_places_pro_tags
  on app_next_chapter_v1.places using gin (pro_tags);

create index if not exists idx_next_chapter_places_concern_tags
  on app_next_chapter_v1.places using gin (concern_tags);

create index if not exists idx_next_chapter_scenarios_user_updated
  on app_next_chapter_v1.scenarios (user_id, updated_at desc);

-- Auto-enroll existing hub profiles into this spoke (idempotent)
insert into public.memberships (user_id, project_id, role)
select p.id, pr.id, 'member'
from public.profiles p
cross join public.projects pr
where pr.slug = 'next-chapter'
on conflict (user_id, project_id) do nothing;
