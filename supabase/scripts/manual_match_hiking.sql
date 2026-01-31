-- Run this in Supabase Dashboard → SQL Editor to create a Hiking Group
-- and send invites to you and Honey Sabu.
--
-- 1. Replace 'YOUR_EMAIL@example.com' with your email address
-- 2. Run the script

DO $$
DECLARE
  your_id uuid;
  honey_id uuid;
  grp_id uuid;
BEGIN
  -- Find your profile by email (REPLACE WITH YOUR EMAIL)
  SELECT id INTO your_id FROM public.profiles
  WHERE email = 'YOUR_EMAIL@example.com'
  LIMIT 1;

  -- Find Honey Sabu (tries various name patterns)
  SELECT id INTO honey_id FROM public.profiles
  WHERE lower(full_name) LIKE '%honey%sabu%'
     OR lower(full_name) LIKE '%honeysabu%'
     OR lower(full_name) = 'honey sabu'
  LIMIT 1;

  IF your_id IS NULL THEN
    RAISE EXCEPTION 'Could not find your profile. Replace YOUR_EMAIL@example.com with your actual email in the script.';
  END IF;
  IF honey_id IS NULL THEN
    RAISE EXCEPTION 'Could not find Honey Sabu. Check that a user with that name exists in profiles.';
  END IF;

  -- Create Hiking Group (you as initiator)
  INSERT INTO public.match_groups (initiator_id, name, activity_summary)
  VALUES (your_id, 'Hiking Group', 'A walk in nature')
  RETURNING id INTO grp_id;

  -- Invite both you and Honey Sabu – both get a notification
  INSERT INTO public.match_invites (group_id, invited_user_id)
  VALUES (grp_id, your_id), (grp_id, honey_id);

  RAISE NOTICE 'Created Hiking Group and sent invites to you and Honey Sabu.';
END $$;
