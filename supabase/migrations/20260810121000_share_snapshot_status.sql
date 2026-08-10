-- Include place status (esp. taken) on guest share snapshots.
create or replace function public.nc_sanitize_shared_place(p jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'id', coalesce(nullif(p->>'id', ''), 'shared'),
      'title', coalesce(p->>'title', ''),
      'url', coalesce(p->>'url', ''),
      'listingKind', case when p->>'listingKind' = 'buy' then 'buy' else 'rent' end,
      'homeType', case
        when p->>'homeType' in ('apartment','condo','single_family','townhome')
          then p->>'homeType'
        else null
      end,
      'price', case when jsonb_typeof(p->'price') = 'number' then p->'price' else 'null'::jsonb end,
      'monthlyEstimate', case when jsonb_typeof(p->'monthlyEstimate') = 'number' then p->'monthlyEstimate' else 'null'::jsonb end,
      'street', coalesce(p->>'street', ''),
      'city', coalesce(p->>'city', ''),
      'state', coalesce(p->>'state', ''),
      'zip', coalesce(p->>'zip', ''),
      'location', coalesce(p->>'location', ''),
      'bedrooms', case when jsonb_typeof(p->'bedrooms') = 'number' then p->'bedrooms' else 'null'::jsonb end,
      'bathrooms', case when jsonb_typeof(p->'bathrooms') = 'number' then p->'bathrooms' else 'null'::jsonb end,
      'sqft', case when jsonb_typeof(p->'sqft') = 'number' then p->'sqft' else 'null'::jsonb end,
      'pets', case
        when p->>'pets' in ('yes','limited','no') then p->>'pets'
        else 'no'
      end,
      'petsNote', coalesce(p->>'petsNote', ''),
      'proTags', coalesce(p->'proTags', '[]'::jsonb),
      'concernTags', coalesce(p->'concernTags', '[]'::jsonb),
      'tier', case
        when p->>'tier' in ('dream','strong','maybe','pass') then p->>'tier'
        else 'maybe'
      end,
      'status', case
        when p->>'status' in ('visited','offer','taken') then p->>'status'
        else 'none'
      end,
      'images', coalesce(p->'images', '[]'::jsonb)
    )
  );
$$;

revoke all on function public.nc_sanitize_shared_place(jsonb) from public;
grant execute on function public.nc_sanitize_shared_place(jsonb) to authenticated, service_role;
