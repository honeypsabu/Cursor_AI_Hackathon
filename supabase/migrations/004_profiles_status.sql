-- Add "How are you doing?" status (short sentence, max 100 chars in app)
alter table public.profiles
  add column if not exists status text;
