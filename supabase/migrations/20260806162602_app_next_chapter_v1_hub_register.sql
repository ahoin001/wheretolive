-- Register Room for the Next Chapter in hub catalog
-- Applied via loveable Supabase MCP (apply_migration: app_next_chapter_v1_hub_register).

insert into public.projects (name, slug, schema_name)
select
  'Room for the Next Chapter',
  'next-chapter',
  'app_next_chapter_v1'
where not exists (
  select 1 from public.projects
  where slug = 'next-chapter'
     or schema_name = 'app_next_chapter_v1'
);
