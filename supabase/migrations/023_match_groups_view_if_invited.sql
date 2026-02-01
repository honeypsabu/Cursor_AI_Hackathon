-- Allow users to view a group if they have any invite (pending or accepted).
-- Fixes: after accepting, "Go to group" / opening group chat was redirecting to profile
-- because RLS only allowed initiator or group_members; invited user might not be in
-- group_members yet (race) or initiator was never added to group_members.

-- Use SECURITY DEFINER to avoid infinite recursion (match_groups policy checks match_invites which references match_groups)
create or replace function public.has_group_invite(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.match_invites
    where group_id = p_group_id and invited_user_id = p_user_id
  );
$$;

drop policy if exists "Users can view groups they are invited to" on public.match_groups;
create policy "Users can view groups they are invited to"
  on public.match_groups for select
  using (public.has_group_invite(id, auth.uid()));
