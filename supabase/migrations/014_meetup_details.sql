-- Add meetup details columns to match_groups
ALTER TABLE public.match_groups
ADD COLUMN IF NOT EXISTS meetup_location text,
ADD COLUMN IF NOT EXISTS meetup_date date,
ADD COLUMN IF NOT EXISTS meetup_time time;

-- Allow group members or initiator to update meetup details
DROP POLICY IF EXISTS "Members can update meetup details" ON public.match_groups;
CREATE POLICY "Members can update meetup details" ON public.match_groups
  FOR UPDATE
  USING (initiator_id = auth.uid() OR is_group_member(id, auth.uid()))
  WITH CHECK (initiator_id = auth.uid() OR is_group_member(id, auth.uid()));
