-- Connection requests: user A sends request to user B
create table if not exists public.connection_requests (
  id uuid default gen_random_uuid() primary key,
  from_user_id uuid references public.profiles(id) on delete cascade not null,
  to_user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(from_user_id, to_user_id)
);

-- Connections: created when a request is accepted (user1_id < user2_id for uniqueness)
create table if not exists public.connections (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  meetup_date text,
  meetup_time text,
  meetup_place text,
  created_at timestamptz default now(),
  unique(user1_id, user2_id)
);

-- Add meetup columns if table already existed without them
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'connections' and column_name = 'meetup_date') then
    alter table public.connections add column meetup_date text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'connections' and column_name = 'meetup_time') then
    alter table public.connections add column meetup_time text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'connections' and column_name = 'meetup_place') then
    alter table public.connections add column meetup_place text;
  end if;
end $$;

-- Chat messages within a connection
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  connection_id uuid references public.connections(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_connection_requests_to on public.connection_requests(to_user_id, status);
create index if not exists idx_connection_requests_from on public.connection_requests(from_user_id);
create index if not exists idx_connections_users on public.connections(user1_id, user2_id);
create index if not exists idx_chat_messages_connection on public.chat_messages(connection_id);

-- RLS for connection_requests
alter table public.connection_requests enable row level security;

drop policy if exists "Users can view requests they sent or received" on public.connection_requests;
create policy "Users can view requests they sent or received"
  on public.connection_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Users can insert requests they send" on public.connection_requests;
create policy "Users can insert requests they send"
  on public.connection_requests for insert
  with check (auth.uid() = from_user_id);

drop policy if exists "Recipient can update (accept/reject) requests" on public.connection_requests;
create policy "Recipient can update (accept/reject) requests"
  on public.connection_requests for update
  using (auth.uid() = to_user_id);

-- RLS for connections
alter table public.connections enable row level security;

drop policy if exists "Users can view their connections" on public.connections;
create policy "Users can view their connections"
  on public.connections for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can insert connections (via trigger or app logic)" on public.connections;
create policy "Users can insert connections (via trigger or app logic)"
  on public.connections for insert
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can update their connections (meetup details)" on public.connections;
create policy "Users can update their connections (meetup details)"
  on public.connections for update
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- RLS for chat_messages
alter table public.chat_messages enable row level security;

drop policy if exists "Users can view messages in their connections" on public.chat_messages;
create policy "Users can view messages in their connections"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.connections c
      where c.id = connection_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "Users can insert messages in their connections" on public.chat_messages;
create policy "Users can insert messages in their connections"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.connections c
      where c.id = connection_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- Allow users to read profiles of people they're connected with (so chat shows names/avatars)
drop policy if exists "Users can view profiles of their connections" on public.profiles;
create policy "Users can view profiles of their connections"
  on public.profiles for select
  using (
    exists (
      select 1 from public.connections c
      where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
        and (c.user1_id = profiles.id or c.user2_id = profiles.id)
    )
  );

-- Enable realtime for chat messages (optional - run if using Supabase Realtime)
-- alter publication supabase_realtime add table chat_messages;
