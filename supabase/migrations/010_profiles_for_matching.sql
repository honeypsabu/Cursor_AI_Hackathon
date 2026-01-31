-- Return profiles for matching based on activities/interests (no location required).
-- So we can match "walk in nature" with "hiking" even if someone hasn't set their address.
create or replace function public.get_profiles_for_matching()
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
  where auth.uid() is not null
    and p.id != auth.uid()
    and (
      (p.status is not null and trim(p.status) != '')
      or cardinality(coalesce(p.interests, '{}')) > 0
    );
$$;

grant execute on function public.get_profiles_for_matching() to authenticated;
grant execute on function public.get_profiles_for_matching() to service_role;
