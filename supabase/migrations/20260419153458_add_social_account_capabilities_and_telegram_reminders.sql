do $$
begin
  if not exists (select 1 from pg_type where typname = 'social_account_type') then
    create type social_account_type as enum ('personal', 'page', 'business', 'creator');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_publish_capability') then
    create type social_publish_capability as enum ('publishable', 'connect_only');
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'post_target_status'::regtype
      and enumlabel = 'notified'
  ) then
    alter type post_target_status add value 'notified' after 'published';
  end if;
end $$;

alter table social_accounts
  add column if not exists account_type social_account_type,
  add column if not exists publish_capability social_publish_capability;

update social_accounts
set account_type = case
      when provider = 'instagram' then 'business'::social_account_type
      else 'page'::social_account_type
    end,
    publish_capability = 'publishable'::social_publish_capability
where account_type is null
   or publish_capability is null;

alter table social_accounts
  alter column account_type set not null,
  alter column publish_capability set not null;

alter table posts
  add column if not exists send_telegram_reminder boolean not null default false;
