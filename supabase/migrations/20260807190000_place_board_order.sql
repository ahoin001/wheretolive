-- Left-to-right rank on the tier board (+ batch reorder RPC)
-- Applied remotely via loveable Supabase MCP; kept for repo history.

alter table app_next_chapter_v1.places
  add column if not exists board_order integer not null default 0;

create index if not exists idx_next_chapter_places_list_tier_order
  on app_next_chapter_v1.places (list_id, tier, board_order);

with ranked as (
  select
    id,
    (row_number() over (
      partition by list_id, tier
      order by created_at asc, id asc
    ) - 1)::integer as ord
  from app_next_chapter_v1.places
)
update app_next_chapter_v1.places p
set board_order = ranked.ord
from ranked
where p.id = ranked.id;

-- See MCP apply_migration place_board_order for full nc_place_to_json,
-- nc_upsert_place, and nc_reorder_board_places definitions.
