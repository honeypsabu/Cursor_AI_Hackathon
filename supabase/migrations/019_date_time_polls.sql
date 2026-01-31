-- Date/time polls: options are {date, period} where period is morning|afternoon|evening
create table if not exists public.date_time_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.match_groups(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  options jsonb not null default '[]'  -- array of {date: 'YYYY-MM-DD', period: 'morning'|'afternoon'|'evening'}
);

create table if not exists public.date_time_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references public.date_time_polls(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  option_index int not null check (option_index >= 0),
  unique(poll_id, user_id, option_index)
);

alter table public.group_chat_messages
add column if not exists date_time_poll_id uuid references public.date_time_polls(id) on delete set null;

create index if not exists date_time_polls_group_id on public.date_time_polls(group_id);
create index if not exists date_time_poll_votes_poll_id on public.date_time_poll_votes(poll_id);

alter table public.date_time_polls enable row level security;
alter table public.date_time_poll_votes enable row level security;

create policy "Members can view date_time polls" on public.date_time_polls for select
  using (public.is_group_member(group_id, auth.uid()));
create policy "Members can create date_time polls" on public.date_time_polls for insert
  with check (public.is_group_member(group_id, auth.uid()));
create policy "Members can update date_time polls" on public.date_time_polls for update
  using (public.is_group_member(group_id, auth.uid()));

create policy "Members can view date_time poll votes" on public.date_time_poll_votes for select
  using (exists (select 1 from public.date_time_polls p where p.id = poll_id and public.is_group_member(p.group_id, auth.uid())));
create policy "Members can insert date_time poll votes" on public.date_time_poll_votes for insert
  with check (auth.uid() = user_id and exists (select 1 from public.date_time_polls p where p.id = poll_id and public.is_group_member(p.group_id, auth.uid())));
create policy "Members can delete own date_time votes" on public.date_time_poll_votes for delete
  using (auth.uid() = user_id);

-- RPC: Create date/time poll. p_options is array of jsonb: [{"date":"2025-02-01","period":"morning"}, ...]
create or replace function public.create_date_time_poll(
  p_group_id uuid,
  p_options jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll_id uuid;
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'Not a group member';
  end if;
  insert into public.date_time_polls (group_id, created_by, options)
  values (p_group_id, auth.uid(), p_options)
  returning id into v_poll_id;
  insert into public.group_chat_messages (group_id, sender_id, content, date_time_poll_id)
  values (p_group_id, auth.uid(), 'Date & time poll', v_poll_id);
  return v_poll_id;
end;
$$;

create or replace function public.add_date_time_poll_options(
  p_poll_id uuid,
  p_new_options jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.date_time_polls where id = p_poll_id;
  if not public.is_group_member(v_group_id, auth.uid()) then
    raise exception 'Not a group member';
  end if;
  update public.date_time_polls
  set options = options || p_new_options
  where id = p_poll_id;
end;
$$;

create or replace function public.toggle_date_time_poll_vote(
  p_poll_id uuid,
  p_option_index int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_vote_count int;
begin
  select group_id into v_group_id from public.date_time_polls where id = p_poll_id;
  if not public.is_group_member(v_group_id, auth.uid()) then
    raise exception 'Not a group member';
  end if;
  if exists (select 1 from public.date_time_poll_votes where poll_id = p_poll_id and user_id = auth.uid() and option_index = p_option_index) then
    delete from public.date_time_poll_votes where poll_id = p_poll_id and user_id = auth.uid() and option_index = p_option_index;
  else
    select count(*) into v_vote_count from public.date_time_poll_votes where poll_id = p_poll_id and user_id = auth.uid();
    if v_vote_count >= 2 then
      raise exception 'Maximum 2 votes per user';
    end if;
    insert into public.date_time_poll_votes (poll_id, user_id, option_index) values (p_poll_id, auth.uid(), p_option_index);
  end if;
end;
$$;

-- RPC: Get date/time poll options with vote counts
create or replace function public.get_date_time_poll(p_poll_id uuid)
returns table (
  option_index int,
  option_date date,
  option_period text,
  vote_count bigint,
  user_voted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    (t.idx - 1)::int as option_index,
    (elem->>'date')::date as option_date,
    elem->>'period' as option_period,
    (select count(*) from public.date_time_poll_votes v where v.poll_id = p_poll_id and v.option_index = (t.idx - 1)::int) as vote_count,
    exists (select 1 from public.date_time_poll_votes v where v.poll_id = p_poll_id and v.user_id = auth.uid() and v.option_index = (t.idx - 1)::int) as user_voted
  from public.date_time_polls lp,
  lateral jsonb_array_elements(lp.options) with ordinality as t(elem, idx)
  where lp.id = p_poll_id
    and exists (select 1 from public.group_members gm join public.date_time_polls p on p.group_id = gm.group_id where p.id = p_poll_id and gm.user_id = auth.uid());
$$;

-- Extend get_group_messages to include date_time_poll_id
drop function if exists public.get_group_messages(uuid);
create or replace function public.get_group_messages(p_group_id uuid)
returns table (
  id uuid,
  content text,
  sender_id uuid,
  sender_name text,
  created_at timestamptz,
  poll_id uuid,
  date_time_poll_id uuid
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.content, m.sender_id, p.full_name as sender_name, m.created_at, m.poll_id, m.date_time_poll_id
  from public.group_chat_messages m
  join public.profiles p on p.id = m.sender_id
  where m.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = m.group_id and gm.user_id = auth.uid())
  order by m.created_at asc;
$$;

grant execute on function public.get_group_messages(uuid) to authenticated;

grant execute on function public.create_date_time_poll(uuid, jsonb) to authenticated;
grant execute on function public.add_date_time_poll_options(uuid, jsonb) to authenticated;
grant execute on function public.toggle_date_time_poll_vote(uuid, int) to authenticated;
grant execute on function public.get_date_time_poll(uuid) to authenticated;
