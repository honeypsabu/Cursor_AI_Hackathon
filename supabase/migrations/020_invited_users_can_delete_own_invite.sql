-- Allow invited users to delete their own invite (so "Clear all" works from the app).
-- Previously only initiators could delete match_invites rows (cascade); invited users
-- could not remove invites sent to them.
create policy "Invited users can delete their own invite"
  on public.match_invites for delete
  using (auth.uid() = invited_user_id);

-- Allow users to delete their own group membership (leave group) for full "Clear all".
create policy "Users can delete their own membership"
  on public.group_members for delete
  using (auth.uid() = user_id);
