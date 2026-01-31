-- Return public map data for all users with location (generalized for privacy).
-- Only exposes: id, generalized lat/lng, status, full_name for map display.
create or replace function public.get_profiles_for_map()
returns table (
  id uuid,
  location_lat double precision,
  location_lng double precision,
  status text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    round(p.location_lat::numeric, 2)::double precision as location_lat,
    round(p.location_lng::numeric, 2)::double precision as location_lng,
    p.status,
    p.full_name
  from public.profiles p
  where p.location_lat is not null
    and p.location_lng is not null
    and auth.uid() is not null;
$$;

grant execute on function public.get_profiles_for_map() to authenticated;
grant execute on function public.get_profiles_for_map() to service_role;
