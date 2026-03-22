create table if not exists public.users (
  user_id text primary key,
  title_hash text not null,
  title_salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  session_token text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  sentiment_score double precision,
  user_id text not null references public.users(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_entries_user_created_at
  on public.entries (user_id, created_at desc);

create index if not exists idx_sessions_user
  on public.sessions (user_id);
