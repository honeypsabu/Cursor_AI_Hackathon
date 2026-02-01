drop policy if exists "Invited users can delete their own invite" on public.match_invites;
create policy "Invited users can delete their own invite"
  on public.match_invites for delete
  using (auth.uid() = invited_user_id);

drop policy if exists "Users can delete their own membership" on public.group_members;
create policy "Users can delete their own membership"
  on public.group_members for delete
  using (auth.uid() = user_id);

create or replace function public.clear_user_groups(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then return; end if;
  delete from public.match_groups where initiator_id = p_user_id;
  delete from public.match_invites where invited_user_id = p_user_id;
  delete from public.group_members where user_id = p_user_id;
end;
$$;

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
grant execute on function public.clear_user_groups(uuid) to postgres;
grant execute on function public.clear_my_groups() to authenticated;

create or replace function public.get_invite_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(distinct (coalesce(trim(g.activity_summary), g.id::text)))::integer
  from public.match_invites mi
  join public.match_groups g on g.id = mi.group_id
  where mi.invited_user_id = auth.uid()
    and mi.status = 'pending'
    and mi.read_at is null;
$$;

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
