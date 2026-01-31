-- RPC: Get invite stats for a group (invited count, accepted count)
-- Only group members or initiator can call this
create or replace function public.get_group_invite_stats(p_group_id uuid)
returns table (invited_count bigint, accepted_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.match_invites mi where mi.group_id = p_group_id) as invited_count,
    (select count(*) from public.match_invites mi where mi.group_id = p_group_id and mi.status = 'accepted') as accepted_count
  where exists (
    select 1 from public.match_groups g where g.id = p_group_id and g.initiator_id = auth.uid()
  ) or exists (
    select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

grant execute on function public.get_group_invite_stats(uuid) to authenticated;
