-- Champ Test Series: run once in Supabase Dashboard > SQL Editor > New query.
-- Safe to run again: it only creates what is missing.

create table if not exists public.users (
  id            text primary key,
  username      text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Usernames are unique ignoring case ("Ravi" and "ravi" are the same login).
create unique index if not exists users_username_lower on public.users (lower(username));

create table if not exists public.progress (
  user_id    text primary key references public.users (id) on delete cascade,
  data       jsonb not null,
  -- Bumped on every save; a save only succeeds if nobody else saved in between.
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

-- RLS on with no policies: the public (publishable) key can read nothing.
-- The app's server uses the secret key, which bypasses RLS.
alter table public.users    enable row level security;
alter table public.progress enable row level security;
