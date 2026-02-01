-- RPC to clear all groups, invites, and memberships for a user.
-- Runs as SECURITY DEFINER so it works from the app (RLS) and from Dashboard script (auth.uid() null).

-- Clear for a given user id (used by Dashboard script; grant to postgres/service_role only)
create or replace function public.clear_user_groups(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  -- 1) Groups you initiated (cascade deletes their invites and group_members)
  delete from public.match_groups where initiator_id = p_user_id;
  -- 2) Invites sent to you (groups you didn't initiate)
  delete from public.match_invites where invited_user_id = p_user_id;
  -- 3) Your memberships in any remaining groups
  delete from public.group_members where user_id = p_user_id;
end;
$$;

-- Clear for current user (used by app; grant to authenticated)
create or replace function public.clear_my_groups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.clear_user_groups(auth.uid());
end;
$$;

grant execute on function public.clear_user_groups(uuid) to service_role;
grant execute on function public.clear_user_groups(uuid) to postgres;  -- Dashboard SQL Editor
grant execute on function public.clear_my_groups() to authenticated;
