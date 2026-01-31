-- Fix: "infinite recursion in policy for relation group_members"
-- The policy checked group_members from within group_members. Use a SECURITY DEFINER function
-- so the check runs without triggering RLS (no recursion).

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id);
$$;

drop policy if exists "Members can view group members" on public.group_members;
create policy "Members can view group members"
  on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));
