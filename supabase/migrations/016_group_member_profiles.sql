-- RPC: Get group members with profile info (for participants list)
create or replace function public.get_group_member_profiles(p_group_id uuid)
returns table (user_id uuid, full_name text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select
    gm.user_id,
    p.full_name,
    p.avatar_url
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and (exists (
      select 1 from public.match_groups g where g.id = p_group_id and g.initiator_id = auth.uid()
    ) or exists (
      select 1 from public.group_members g2 where g2.group_id = p_group_id and g2.user_id = auth.uid()
    ))
  order by gm.joined_at asc;
$$;

grant execute on function public.get_group_member_profiles(uuid) to authenticated;
