create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type organization_role as enum ('owner', 'manager', 'editor');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_provider') then
    create type social_provider as enum ('facebook', 'instagram', 'linkedin');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_account_status') then
    create type social_account_status as enum ('connected', 'expired', 'disconnected');
  end if;

  if not exists (select 1 from pg_type where typname = 'post_state') then
    create type post_state as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'post_target_status') then
    create type post_target_status as enum ('pending', 'published', 'failed', 'cancelled');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role organization_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider social_provider not null,
  display_name text not null,
  handle text not null,
  external_account_id text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  status social_account_status not null default 'disconnected',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  width integer,
  height integer,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  title text not null,
  content text not null,
  primary_media_asset_id uuid references media_assets(id) on delete set null,
  scheduled_at timestamptz,
  state post_state not null default 'draft',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  provider social_provider not null,
  status post_target_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists publish_jobs (
  id uuid primary key default gen_random_uuid(),
  post_target_id uuid not null references post_targets(id) on delete cascade,
  attempt_number integer not null default 1,
  status post_target_status not null,
  external_post_id text,
  error_message text,
  response_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_members_user on organization_members(user_id);
create index if not exists idx_social_accounts_organization on social_accounts(organization_id);
create index if not exists idx_posts_organization_state on posts(organization_id, state);
create index if not exists idx_posts_scheduled on posts(state, scheduled_at);
create index if not exists idx_post_targets_post on post_targets(post_id);
create index if not exists idx_audit_logs_organization on audit_logs(organization_id, created_at desc);
