-- Room for the Next Chapter spoke schema
-- Hub stays in public/auth; app resources live in app_next_chapter_v1.
-- Applied via loveable Supabase MCP (apply_migration: app_next_chapter_v1_create_core).

create schema if not exists app_next_chapter_v1;

create or replace function app_next_chapter_v1.set_updated_at()
returns trigger
language plpgsql
set search_path = app_next_chapter_v1, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists app_next_chapter_v1.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  version integer not null default 1 check (version > 0),
  household jsonb not null default '{}'::jsonb,
  home jsonb not null default '{}'::jsonb,
  move jsonb not null default '{}'::jsonb,
  priorities jsonb not null default '{}'::jsonb,
  conversation_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_next_chapter_scenarios_user_id
  on app_next_chapter_v1.scenarios(user_id);

drop trigger if exists trg_next_chapter_scenarios_updated_at on app_next_chapter_v1.scenarios;
create trigger trg_next_chapter_scenarios_updated_at
before update on app_next_chapter_v1.scenarios
for each row execute function app_next_chapter_v1.set_updated_at();

create table if not exists app_next_chapter_v1.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid references app_next_chapter_v1.scenarios(id) on delete set null,
  title text not null default '',
  url text not null default '',
  location text not null default '',
  notes text not null default '',
  listing_kind text not null default 'rent'
    check (listing_kind in ('rent', 'buy')),
  price numeric,
  monthly_estimate numeric,
  bedrooms numeric,
  bathrooms numeric,
  pets text not null default 'no'
    check (pets in ('yes', 'no', 'limited')),
  pets_note text not null default '',
  pro_tags text[] not null default '{}',
  concern_tags text[] not null default '{}',
  tags text[] not null default '{}',
  images text[] not null default '{}',
  tier text not null default 'maybe'
    check (tier in ('dream', 'strong', 'maybe', 'pass')),
  status text not null default 'none'
    check (status in ('none', 'visited', 'offer')),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_next_chapter_places_user_id
  on app_next_chapter_v1.places(user_id);
create index if not exists idx_next_chapter_places_scenario_id
  on app_next_chapter_v1.places(scenario_id);
create index if not exists idx_next_chapter_places_tier
  on app_next_chapter_v1.places(tier);
create index if not exists idx_next_chapter_places_favorite
  on app_next_chapter_v1.places(favorite) where favorite = true;
create index if not exists idx_next_chapter_places_tags
  on app_next_chapter_v1.places using gin(tags);

drop trigger if exists trg_next_chapter_places_updated_at on app_next_chapter_v1.places;
create trigger trg_next_chapter_places_updated_at
before update on app_next_chapter_v1.places
for each row execute function app_next_chapter_v1.set_updated_at();

create table if not exists app_next_chapter_v1.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data_version integer not null default 1 check (data_version > 0),
  active_step text not null default 'welcome',
  mode text not null default 'guide'
    check (mode in ('guide', 'places')),
  completed_steps text[] not null default '{}',
  active_scenario_id uuid references app_next_chapter_v1.scenarios(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_next_chapter_user_prefs_updated_at on app_next_chapter_v1.user_prefs;
create trigger trg_next_chapter_user_prefs_updated_at
before update on app_next_chapter_v1.user_prefs
for each row execute function app_next_chapter_v1.set_updated_at();
