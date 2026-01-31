-- Allow initiators to delete their groups (for cleanup/testing)
drop policy if exists "Initiators can delete their groups" on public.match_groups;
create policy "Initiators can delete their groups"
  on public.match_groups for delete
  using (auth.uid() = initiator_id);

-- Allow cascade deletes for match_invites when group is deleted
drop policy if exists "Allow delete for group cascade" on public.match_invites;
create policy "Allow delete for group cascade"
  on public.match_invites for delete
  using (exists (select 1 from public.match_groups g where g.id = group_id and g.initiator_id = auth.uid()));

-- Allow cascade deletes for group_members when group is deleted
drop policy if exists "Allow delete for group cascade" on public.group_members;
create policy "Allow delete for group cascade"
  on public.group_members for delete
  using (exists (select 1 from public.match_groups g where g.id = group_id and g.initiator_id = auth.uid()));
