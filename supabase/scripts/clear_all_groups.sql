-- Run this in Supabase Dashboard → SQL Editor to clear all groups and invites
-- Replace 'YOUR_EMAIL@example.com' with your email

DO $$
DECLARE
  user_id_var uuid;
BEGIN
  -- Find your user ID by email
  SELECT id INTO user_id_var FROM public.profiles
  WHERE email = 'YOUR_EMAIL@example.com'
  LIMIT 1;

  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'User not found. Replace YOUR_EMAIL@example.com with your actual email.';
  END IF;

  -- Delete all groups you initiated (cascades to invites and members)
  DELETE FROM public.match_groups WHERE initiator_id = user_id_var;
  
  -- Delete any remaining invites sent to you
  DELETE FROM public.match_invites WHERE invited_user_id = user_id_var;
  
  -- Delete any group memberships
  DELETE FROM public.group_members WHERE user_id = user_id_var;

  RAISE NOTICE 'Cleared all groups, invites, and memberships for user %', user_id_var;
END $$;
