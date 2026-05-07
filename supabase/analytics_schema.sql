-- Supabase analytics schema for midnight-skills
-- Apply in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null,

  -- Pseudonymous visitor identifier generated client-side (not Supabase auth).
  anon_id uuid,

  -- Optional: if you later wire Supabase Auth, store `auth.uid()` here.
  user_id uuid,

  -- Optional: if you ask users for their GitHub username.
  github_username text,

  -- Skill identifier (e.g. "compact", "nft")
  skill_name text,

  -- Which page triggered the event (e.g. "/", "/skill.html")
  page_path text,

  -- Request metadata (avoid storing raw IP; use `ip_hash` only)
  referrer text,
  user_agent text,
  ip_hash text,

  meta jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_event_idx on public.analytics_events (event);
create index if not exists analytics_events_skill_name_idx on public.analytics_events (skill_name);
create index if not exists analytics_events_anon_id_idx on public.analytics_events (anon_id);
create index if not exists analytics_events_github_username_idx on public.analytics_events (github_username);

-- RLS: keep table private; only service-role inserts/reads via serverless functions.
alter table public.analytics_events enable row level security;

-- No policies by default.
-- Serverless functions should use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

create table if not exists public.analytics_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  anon_id uuid not null,
  github_username text not null,

  page_path text,
  referrer text
);

create unique index if not exists analytics_users_anon_id_uniq on public.analytics_users (anon_id);
create index if not exists analytics_users_github_username_idx on public.analytics_users (github_username);

alter table public.analytics_users enable row level security;

