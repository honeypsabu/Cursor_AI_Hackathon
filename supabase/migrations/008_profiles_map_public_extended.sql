-- Extend get_profiles_for_map to return age and other public profile fields for map markers and modal.
-- Must drop first: PostgreSQL does not allow changing a function's return type with create or replace.
drop function if exists public.get_profiles_for_map();

create or replace function public.get_profiles_for_map()
returns table (
  id uuid,
  location_lat double precision,
  location_lng double precision,
  status text,
  full_name text,
  age smallint,
  avatar_url text,
  gender text,
  languages text[],
  interests text[]
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
    p.full_name,
    p.age,
    p.avatar_url,
    p.gender,
    coalesce(p.languages, '{}') as languages,
    coalesce(p.interests, '{}') as interests
  from public.profiles p
  where p.location_lat is not null
    and p.location_lng is not null
    and auth.uid() is not null;
$$;

grant execute on function public.get_profiles_for_map() to authenticated;
grant execute on function public.get_profiles_for_map() to service_role;
