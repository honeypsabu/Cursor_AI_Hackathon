-- Run this in Supabase Dashboard → SQL Editor.
-- Matches any users who have a profile and filled in "What do you want to do" (status).
-- Groups users by similar activity (same keyword bucket as the app's matching logic),
-- creates one match group per bucket (2–5 people), and sends match_invites (notifications unchanged).

DO $$
DECLARE
  rec record;
  grp_id uuid;
  initiator_id uuid;
  member_ids uuid[];
  uid uuid;
  bucket_label text;
  activity_bucket text;
BEGIN
  FOR rec IN
    WITH
      -- All profiles with non-empty "What do you want to do"
      with_status AS (
        SELECT id, trim(status) AS status, lower(trim(status)) AS status_lower
        FROM public.profiles
        WHERE status IS NOT NULL AND trim(status) != ''
      ),
      -- Assign activity bucket (first matching keyword group, same logic as client matching.js)
      with_bucket AS (
        SELECT
          id,
          status,
          CASE
            WHEN status_lower ~ 'walk|stroll|wander|hike|hiking|trail|nature|outdoor|outside|fresh air|woods|forest|park|nature walk' THEN 'outdoor_walk'
            WHEN status_lower ~ 'run|jog' THEN 'running'
            WHEN status_lower ~ 'coffee|cafe|tea' THEN 'coffee'
            WHEN status_lower ~ 'drink|bar|beer|wine' THEN 'drinks'
            WHEN status_lower ~ 'eat|food|lunch|dinner|brunch' THEN 'food'
            WHEN status_lower ~ 'cook|baking|bake' THEN 'cooking'
            WHEN status_lower ~ 'read|book' THEN 'reading'
            WHEN status_lower ~ 'movie|film|cinema' THEN 'movies'
            WHEN status_lower ~ 'music|concert|gig' THEN 'music'
            WHEN status_lower ~ 'game|gaming|play' THEN 'gaming'
            WHEN status_lower ~ 'bike|cycling|cycle' THEN 'cycling'
            WHEN status_lower ~ 'swim|beach|pool' THEN 'swim'
            WHEN status_lower ~ 'yoga|gym|workout|exercise' THEN 'fitness'
            WHEN status_lower ~ 'travel|trip|explore' THEN 'travel'
            WHEN status_lower ~ 'art|museum|gallery|painting|workshop|craft|pottery|draw' THEN 'art'
            WHEN status_lower ~ 'chat|talk|hang|catch up' THEN 'chat'
            WHEN status_lower ~ 'study|focus' THEN 'study'
            WHEN status_lower ~ 'work' THEN 'work'
            WHEN status_lower ~ 'dog|pet|puppy' THEN 'pet'
            WHEN status_lower ~ 'dance|party' THEN 'dance'
            ELSE 'other'
          END AS activity_bucket
        FROM with_status
      ),
      -- Exclude users already invited to a group with this same activity bucket
      available AS (
        SELECT w.id, w.status, w.activity_bucket,
          row_number() OVER (PARTITION BY w.activity_bucket ORDER BY w.id) AS rn
        FROM with_bucket w
        WHERE NOT EXISTS (
          SELECT 1 FROM public.match_invites mi
          JOIN public.match_groups g ON g.id = mi.group_id
          WHERE mi.invited_user_id = w.id AND g.activity_summary = w.activity_bucket
        )
      ),
      -- Buckets that have at least 2 available users
      buckets_ready AS (
        SELECT activity_bucket, count(*) AS cnt
        FROM available
        GROUP BY activity_bucket
        HAVING count(*) >= 2
      ),
      -- Up to 5 users per bucket (initiator = first by id)
      group_members AS (
        SELECT a.id, a.status, a.activity_bucket, a.rn
        FROM available a
        JOIN buckets_ready b ON b.activity_bucket = a.activity_bucket
        WHERE a.rn <= 5
      )
    SELECT
      gm.activity_bucket,
      (SELECT array_agg(gm2.id ORDER BY gm2.id) FROM group_members gm2 WHERE gm2.activity_bucket = gm.activity_bucket) AS member_ids,
      (SELECT min(gm2.id) FROM group_members gm2 WHERE gm2.activity_bucket = gm.activity_bucket) AS initiator_id,
      (SELECT (array_agg(gm2.status ORDER BY gm2.id))[1] FROM group_members gm2 WHERE gm2.activity_bucket = gm.activity_bucket) AS first_status
    FROM group_members gm
    GROUP BY gm.activity_bucket
  LOOP
    activity_bucket := rec.activity_bucket;
    initiator_id := rec.initiator_id;
    member_ids := rec.member_ids;
    bucket_label := CASE activity_bucket
      WHEN 'outdoor_walk' THEN 'Hiking Group'
      WHEN 'art' THEN 'Art & Painting Group'
      WHEN 'running' THEN 'Running'
      WHEN 'coffee' THEN 'Coffee'
      WHEN 'drinks' THEN 'Drinks'
      WHEN 'food' THEN 'Food'
      WHEN 'cooking' THEN 'Cooking'
      WHEN 'reading' THEN 'Reading'
      WHEN 'movies' THEN 'Movies'
      WHEN 'music' THEN 'Music'
      WHEN 'gaming' THEN 'Gaming'
      WHEN 'cycling' THEN 'Cycling'
      WHEN 'swim' THEN 'Swim'
      WHEN 'fitness' THEN 'Fitness'
      WHEN 'travel' THEN 'Travel'
      WHEN 'chat' THEN 'Chat'
      WHEN 'study' THEN 'Study'
      WHEN 'work' THEN 'Work'
      WHEN 'pet' THEN 'Pet'
      WHEN 'dance' THEN 'Dance'
      ELSE 'Meetup'
    END;

    -- Create one match group for this bucket (initiator, name, activity_summary for dedupe)
    INSERT INTO public.match_groups (initiator_id, name, activity_summary)
    VALUES (initiator_id, bucket_label, activity_bucket)
    RETURNING id INTO grp_id;

    -- Invite everyone in the group (same as before – notifications unchanged)
    FOREACH uid IN ARRAY member_ids
    LOOP
      INSERT INTO public.match_invites (group_id, invited_user_id)
      VALUES (grp_id, uid)
      ON CONFLICT (group_id, invited_user_id) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Created group "%" (activity: %) with % invite(s).', bucket_label, activity_bucket, array_length(member_ids, 1);
  END LOOP;

  RAISE NOTICE 'Matching done. Users with "What do you want to do" filled are grouped by similar activity; check match_invites for notifications.';
END $$;
