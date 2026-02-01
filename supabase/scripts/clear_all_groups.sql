-- Run this in Supabase Dashboard → SQL Editor to clear all groups and invites.
-- Replace 'YOUR_EMAIL@example.com' with your email.
-- Uses clear_user_groups() RPC (SECURITY DEFINER) so it works even when auth.uid() is null.

DO $$
DECLARE
  user_id_var uuid;
BEGIN
  SELECT id INTO user_id_var FROM public.profiles
  WHERE email = 'YOUR_EMAIL@example.com'
  LIMIT 1;

  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'User not found. Replace YOUR_EMAIL@example.com with your actual email.';
  END IF;

  PERFORM public.clear_user_groups(user_id_var);

  RAISE NOTICE 'Cleared all groups, invites, and memberships for user %', user_id_var;
END $$;
