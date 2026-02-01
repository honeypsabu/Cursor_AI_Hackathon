-- Match groups: created when matching finds 1-5 people with similar "what they want to do"
create table if not exists public.match_groups (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  activity_summary text,
  created_at timestamptz default now()
);

-- Match invites: who was invited, must accept before joining group
create table if not exists public.match_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.match_groups(id) on delete cascade not null,
  invited_user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  read_at timestamptz,
  created_at timestamptz default now(),
  unique (group_id, invited_user_id)
);

-- Group members: initiator + users who accepted. These users are in the group chat.
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.match_groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique (group_id, user_id)
);

-- Group chat messages
create table if not exists public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.match_groups(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists match_groups_initiator_id on public.match_groups(initiator_id);
create index if not exists match_invites_invited_user_id on public.match_invites(invited_user_id);
create index if not exists match_invites_group_id on public.match_invites(group_id);
create index if not exists group_members_group_id on public.group_members(group_id);
create index if not exists group_members_user_id on public.group_members(user_id);
create index if not exists group_chat_messages_group_id on public.group_chat_messages(group_id);

-- RLS
alter table public.match_groups enable row level security;
alter table public.match_invites enable row level security;
alter table public.group_members enable row level security;
alter table public.group_chat_messages enable row level security;

drop policy if exists "Users can view groups they initiated" on public.match_groups;
create policy "Users can view groups they initiated"
  on public.match_groups for select
  using (auth.uid() = initiator_id);

drop policy if exists "Users can view groups they are member of" on public.match_groups;
create policy "Users can view groups they are member of"
  on public.match_groups for select
  using (exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid()));

drop policy if exists "Users can insert own groups" on public.match_groups;
create policy "Users can insert own groups"
  on public.match_groups for insert
  with check (auth.uid() = initiator_id);

drop policy if exists "Users can view invites sent to them" on public.match_invites;
create policy "Users can view invites sent to them"
  on public.match_invites for select
  using (auth.uid() = invited_user_id);

drop policy if exists "Initiators can view invites in their groups" on public.match_invites;
create policy "Initiators can view invites in their groups"
  on public.match_invites for select
  using (exists (select 1 from public.match_groups g where g.id = group_id and g.initiator_id = auth.uid()));

drop policy if exists "Initiators can insert invites to their groups" on public.match_invites;
create policy "Initiators can insert invites to their groups"
  on public.match_invites for insert
  with check (exists (select 1 from public.match_groups g where g.id = group_id and g.initiator_id = auth.uid()));

drop policy if exists "Invited users can update their invite" on public.match_invites;
create policy "Invited users can update their invite"
  on public.match_invites for update
  using (auth.uid() = invited_user_id)
  with check (auth.uid() = invited_user_id);

drop policy if exists "Members can view group members" on public.group_members;
create policy "Members can view group members"
  on public.group_members for select
  using (exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid()));

drop policy if exists "Initiators can insert group members" on public.group_members;
create policy "Initiators can insert group members"
  on public.group_members for insert
  with check (exists (select 1 from public.match_groups g where g.id = group_id and g.initiator_id = auth.uid()));

drop policy if exists "Invited users can add themselves when accepting" on public.group_members;
create policy "Invited users can add themselves when accepting"
  on public.group_members for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.match_invites mi where mi.group_id = group_id and mi.invited_user_id = auth.uid())
  );

drop policy if exists "Members can view chat messages" on public.group_chat_messages;
create policy "Members can view chat messages"
  on public.group_chat_messages for select
  using (exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid()));

drop policy if exists "Members can insert chat messages" on public.group_chat_messages;
create policy "Members can insert chat messages"
  on public.group_chat_messages for insert
  with check (auth.uid() = sender_id and exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid()));

-- RPC: Get unread invite count
create or replace function public.get_invite_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.match_invites mi
  where mi.invited_user_id = auth.uid()
    and mi.status = 'pending'
    and mi.read_at is null;
$$;

-- RPC: Get invites for current user with group and initiator info
create or replace function public.get_my_invites()
returns table (
  id uuid,
  status text,
  read_at timestamptz,
  created_at timestamptz,
  group_id uuid,
  group_name text,
  group_activity text,
  initiator_id uuid,
  initiator_name text,
  initiator_avatar text
)
language sql
security definer
set search_path = public
as $$
  select
    mi.id,
    mi.status,
    mi.read_at,
    mi.created_at,
    g.id as group_id,
    g.name as group_name,
    g.activity_summary as group_activity,
    g.initiator_id,
    p.full_name as initiator_name,
    p.avatar_url as initiator_avatar
  from public.match_invites mi
  join public.match_groups g on g.id = mi.group_id
  join public.profiles p on p.id = g.initiator_id
  where mi.invited_user_id = auth.uid()
  order by mi.created_at desc;
$$;

grant execute on function public.get_invite_count() to authenticated;
grant execute on function public.get_my_invites() to authenticated;

-- RPC: Get groups current user is a member of
create or replace function public.get_my_groups()
returns table (
  group_id uuid,
  group_name text,
  group_activity text,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    g.id as group_id,
    g.name as group_name,
    g.activity_summary as group_activity,
    (select count(*) from public.group_members gm where gm.group_id = g.id) as member_count
  from public.group_members gm
  join public.match_groups g on g.id = gm.group_id
  where gm.user_id = auth.uid()
  order by gm.joined_at desc;
$$;

grant execute on function public.get_my_groups() to authenticated;

-- RPC: Get group chat messages with sender name (create only if not exists, so later migrations can extend return type)
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' and p.proname = 'get_group_messages'
  ) then
    create function public.get_group_messages(p_group_id uuid)
    returns table (
      id uuid,
      content text,
      sender_id uuid,
      sender_name text,
      created_at timestamptz
    )
    language sql
    security definer
    set search_path = public
    as $fn$
      select
        m.id,
        m.content,
        m.sender_id,
        p.full_name as sender_name,
        m.created_at
      from public.group_chat_messages m
      join public.profiles p on p.id = m.sender_id
      where m.group_id = p_group_id
        and exists (select 1 from public.group_members gm where gm.group_id = m.group_id and gm.user_id = auth.uid())
      order by m.created_at asc;
    $fn$;
  end if;
end $$;

grant execute on function public.get_group_messages(uuid) to authenticated;
