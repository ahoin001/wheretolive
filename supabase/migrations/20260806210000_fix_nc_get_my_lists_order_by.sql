-- Fix nc_get_my_lists: ORDER BY used t.updated_at but the select alias is "updatedAt".
-- That made every signed-in list load fail, so the app fell back to empty local places.

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
