-- PostgREST returns 404 when nc_create_place_share is overloaded
-- (jsonb payload vs legacy multi-arg). Keep the single payload form the app uses.

drop function if exists public.nc_create_place_share(text, text, jsonb, integer);

grant execute on function public.nc_create_place_share(jsonb) to authenticated;
grant execute on function public.nc_create_place_share(jsonb) to service_role;

notify pgrst, 'reload schema';
