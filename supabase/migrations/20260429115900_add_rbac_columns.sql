do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_role') then
    create type platform_role as enum ('user', 'super_admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type user_status as enum ('active', 'disabled');
  end if;

  if not exists (select 1 from pg_type where typname = 'organization_status') then
    create type organization_status as enum ('active', 'disabled');
  end if;
end $$;

alter type organization_role add value if not exists 'admin';

alter table users
  add column if not exists platform_role platform_role not null default 'user',
  add column if not exists status user_status not null default 'active';

alter table organizations
  add column if not exists status organization_status not null default 'active';

update users
set platform_role = 'super_admin',
    status = 'active',
    updated_at = now()
where lower(email) = 'apps@dylan-cdo.fr'
   or auth_user_id = '94c90598-7d52-406a-b54b-ce8a731a15a7';

create index if not exists idx_users_platform_role on users(platform_role);
create index if not exists idx_users_status on users(status);
create index if not exists idx_organizations_status on organizations(status);
