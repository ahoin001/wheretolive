-- Allow marking places as taken (already leased / under contract / unavailable).
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'app_next_chapter_v1'
    and t.relname = 'places'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%';

  if conname is not null then
    execute format(
      'alter table app_next_chapter_v1.places drop constraint %I',
      conname
    );
  end if;
end $$;

alter table app_next_chapter_v1.places
  add constraint places_status_check
  check (status in ('none', 'visited', 'offer', 'taken'));
