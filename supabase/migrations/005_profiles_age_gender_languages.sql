-- Add Age, Gender, Languages to profiles
alter table public.profiles
  add column if not exists age smallint,
  add column if not exists gender text,
  add column if not exists languages text[] default '{}';
