-- Add interests column to profiles (array of selected interest ids)
alter table public.profiles
  add column if not exists interests text[] default '{}';
