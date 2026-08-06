-- Owner-only RLS; no anon table grants (sensitive household/finance data).
-- Applied via loveable Supabase MCP (apply_migration: app_next_chapter_v1_rls).

grant usage on schema app_next_chapter_v1 to authenticated, service_role;

grant select, insert, update, delete on all tables in schema app_next_chapter_v1 to authenticated, service_role;
grant usage, select on all sequences in schema app_next_chapter_v1 to authenticated, service_role;

alter default privileges in schema app_next_chapter_v1
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges in schema app_next_chapter_v1
  grant usage, select on sequences to authenticated, service_role;

revoke all on all tables in schema app_next_chapter_v1 from anon;
revoke all on all sequences in schema app_next_chapter_v1 from anon;
revoke usage on schema app_next_chapter_v1 from anon;

alter table app_next_chapter_v1.scenarios enable row level security;
alter table app_next_chapter_v1.places enable row level security;
alter table app_next_chapter_v1.user_prefs enable row level security;

alter table app_next_chapter_v1.scenarios force row level security;
alter table app_next_chapter_v1.places force row level security;
alter table app_next_chapter_v1.user_prefs force row level security;

drop policy if exists nc_scenarios_crud_own on app_next_chapter_v1.scenarios;
create policy nc_scenarios_crud_own
  on app_next_chapter_v1.scenarios
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists nc_places_crud_own on app_next_chapter_v1.places;
create policy nc_places_crud_own
  on app_next_chapter_v1.places
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists nc_user_prefs_crud_own on app_next_chapter_v1.user_prefs;
create policy nc_user_prefs_crud_own
  on app_next_chapter_v1.user_prefs
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
