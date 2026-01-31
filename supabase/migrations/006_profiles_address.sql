-- Add private address and location columns for map display (future)
alter table public.profiles
  add column if not exists address text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;
