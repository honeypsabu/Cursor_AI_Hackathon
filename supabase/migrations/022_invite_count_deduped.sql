-- Make invite count match the Notifications list (one per activity, deduped).
-- Previously count(*) returned every invite row; list dedupes by group_activity/group_id, so badge showed 2 when list showed 1.
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
