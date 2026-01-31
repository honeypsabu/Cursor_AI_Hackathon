-- Location polls: group members can create polls with 1+ location options, others vote (2 votes each)
create table if not exists public.location_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.match_groups(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  options jsonb not null default '[]'  -- array of location strings
);

create table if not exists public.location_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references public.location_polls(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  option_index int not null check (option_index >= 0),
  unique(poll_id, user_id, option_index)
);

-- Link messages to polls (for display in chat)
alter table public.group_chat_messages
add column if not exists poll_id uuid references public.location_polls(id) on delete set null;

create index if not exists location_polls_group_id on public.location_polls(group_id);
create index if not exists location_poll_votes_poll_id on public.location_poll_votes(poll_id);
create index if not exists group_chat_messages_poll_id on public.group_chat_messages(poll_id);

-- RLS
alter table public.location_polls enable row level security;
alter table public.location_poll_votes enable row level security;

-- Members can view/create polls in their groups
create policy "Members can view location polls"
  on public.location_polls for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Members can create location polls"
  on public.location_polls for insert
  with check (public.is_group_member(group_id, auth.uid()));

create policy "Members can update location polls (add options)"
  on public.location_polls for update
  using (public.is_group_member(group_id, auth.uid()));

-- Members can view/vote
create policy "Members can view location poll votes"
  on public.location_poll_votes for select
  using (exists (
    select 1 from public.location_polls p where p.id = poll_id and public.is_group_member(p.group_id, auth.uid())
  ));

create policy "Members can insert location poll votes"
  on public.location_poll_votes for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.location_polls p where p.id = poll_id and public.is_group_member(p.group_id, auth.uid())
  ));

create policy "Members can delete own votes"
  on public.location_poll_votes for delete
  using (auth.uid() = user_id);

-- RPC: Create poll and message, return poll id
create or replace function public.create_location_poll(
  p_group_id uuid,
  p_options text[]
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
  insert into public.location_polls (group_id, created_by, options)
  values (p_group_id, auth.uid(), to_jsonb(p_options))
  returning id into v_poll_id;
  insert into public.group_chat_messages (group_id, sender_id, content, poll_id)
  values (p_group_id, auth.uid(), 'Location poll', v_poll_id);
  return v_poll_id;
end;
$$;

-- RPC: Add options to poll (appends new options; poll UI updates in place)
create or replace function public.add_location_poll_options(
  p_poll_id uuid,
  p_new_options text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.location_polls where id = p_poll_id;
  if not public.is_group_member(v_group_id, auth.uid()) then
    raise exception 'Not a group member';
  end if;
  update public.location_polls
  set options = options || to_jsonb(p_new_options)
  where id = p_poll_id;
end;
$$;

-- RPC: Vote (add or remove). Enforces max 2 votes per user. Returns new vote count for option.
create or replace function public.toggle_location_poll_vote(
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
  v_exists boolean;
  v_vote_count int;
begin
  select group_id into v_group_id from public.location_polls where id = p_poll_id;
  if not public.is_group_member(v_group_id, auth.uid()) then
    raise exception 'Not a group member';
  end if;
  select exists (
    select 1 from public.location_poll_votes
    where poll_id = p_poll_id and user_id = auth.uid() and option_index = p_option_index
  ) into v_exists;
  if v_exists then
    delete from public.location_poll_votes
    where poll_id = p_poll_id and user_id = auth.uid() and option_index = p_option_index;
  else
    select count(*) into v_vote_count from public.location_poll_votes
    where poll_id = p_poll_id and user_id = auth.uid();
    if v_vote_count >= 2 then
      raise exception 'Maximum 2 votes per user';
    end if;
    insert into public.location_poll_votes (poll_id, user_id, option_index)
    values (p_poll_id, auth.uid(), p_option_index);
  end if;
end;
$$;

-- Extend get_group_messages to include poll_id
drop function if exists public.get_group_messages(uuid);
create or replace function public.get_group_messages(p_group_id uuid)
returns table (
  id uuid,
  content text,
  sender_id uuid,
  sender_name text,
  created_at timestamptz,
  poll_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.content,
    m.sender_id,
    p.full_name as sender_name,
    m.created_at,
    m.poll_id
  from public.group_chat_messages m
  join public.profiles p on p.id = m.sender_id
  where m.group_id = p_group_id
    and exists (select 1 from public.group_members gm where gm.group_id = m.group_id and gm.user_id = auth.uid())
  order by m.created_at asc;
$$;

-- RPC: Get poll with options, vote counts, and current user's votes
create or replace function public.get_location_poll(p_poll_id uuid)
returns table (
  option_index int,
  option_text text,
  vote_count bigint,
  user_voted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    (t.idx - 1)::int as option_index,
    t.elem as option_text,
    (select count(*) from public.location_poll_votes v
     where v.poll_id = p_poll_id and v.option_index = (t.idx - 1)::int) as vote_count,
    exists (select 1 from public.location_poll_votes v
            where v.poll_id = p_poll_id and v.user_id = auth.uid() and v.option_index = (t.idx - 1)::int) as user_voted
  from public.location_polls lp,
  lateral jsonb_array_elements_text(lp.options) with ordinality as t(elem, idx)
  where lp.id = p_poll_id
    and exists (select 1 from public.group_members gm
                join public.location_polls p on p.group_id = gm.group_id
                where p.id = p_poll_id and gm.user_id = auth.uid());
$$;

grant execute on function public.get_group_messages(uuid) to authenticated;
grant execute on function public.get_location_poll(uuid) to authenticated;
