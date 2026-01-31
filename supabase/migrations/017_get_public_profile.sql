-- RPC: Get public profile of a user (for group members to view each other)
-- Only succeeds if caller shares a group with the user, or is the user
create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  status text,
  interests text[],
  age smallint,
  gender text,
  languages text[]
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.status,
    coalesce(p.interests, '{}'),
    p.age,
    p.gender,
    coalesce(p.languages, '{}')
  from public.profiles p
  where p.id = p_user_id
    and (auth.uid() = p_user_id
      or exists (
        select 1 from public.group_members g1
        join public.group_members g2 on g2.group_id = g1.group_id
        where g1.user_id = auth.uid() and g2.user_id = p_user_id
      ));
$$;

grant execute on function public.get_public_profile(uuid) to authenticated;
