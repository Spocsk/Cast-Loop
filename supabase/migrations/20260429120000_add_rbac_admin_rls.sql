create or replace function app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from users
  where auth_user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from users
    where auth_user_id = auth.uid()
      and platform_role = 'super_admin'
      and status = 'active'
  )
$$;

create or replace function has_org_role(org_id uuid, allowed_roles organization_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members om
    inner join users u on u.id = om.user_id
    inner join organizations o on o.id = om.organization_id
    where om.organization_id = org_id
      and u.auth_user_id = auth.uid()
      and u.status = 'active'
      and o.status = 'active'
      and om.role = any(allowed_roles)
  )
$$;

create or replace function can_access_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_platform_admin() or exists (
    select 1
    from organization_members om
    inner join users u on u.id = om.user_id
    inner join organizations o on o.id = om.organization_id
    where om.organization_id = org_id
      and u.auth_user_id = auth.uid()
      and u.status = 'active'
      and o.status = 'active'
  )
$$;

create or replace function can_access_storage_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  begin
    org_id := split_part(object_name, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return can_access_org(org_id);
end;
$$;

alter table users enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table social_accounts enable row level security;
alter table media_assets enable row level security;
alter table posts enable row level security;
alter table post_targets enable row level security;
alter table publish_jobs enable row level security;
alter table audit_logs enable row level security;

drop policy if exists users_select_self_or_admin on users;
create policy users_select_self_or_admin on users
  for select using (auth_user_id = auth.uid() or is_platform_admin());

drop policy if exists users_update_self_or_admin on users;
create policy users_update_self_or_admin on users
  for update using (auth_user_id = auth.uid() or is_platform_admin())
  with check (auth_user_id = auth.uid() or is_platform_admin());

drop policy if exists organizations_member_or_admin_select on organizations;
create policy organizations_member_or_admin_select on organizations
  for select using (can_access_org(id));

drop policy if exists organizations_owner_admin_write on organizations;
create policy organizations_owner_admin_write on organizations
  for all using (is_platform_admin() or has_org_role(id, array['owner','admin']::organization_role[]))
  with check (is_platform_admin() or has_org_role(id, array['owner','admin']::organization_role[]));

drop policy if exists organization_members_member_or_admin_select on organization_members;
create policy organization_members_member_or_admin_select on organization_members
  for select using (can_access_org(organization_id));

drop policy if exists organization_members_owner_admin_write on organization_members;
create policy organization_members_owner_admin_write on organization_members
  for all using (is_platform_admin() or has_org_role(organization_id, array['owner']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner']::organization_role[]));

drop policy if exists social_accounts_member_or_admin_select on social_accounts;
create policy social_accounts_member_or_admin_select on social_accounts
  for select using (can_access_org(organization_id));

drop policy if exists social_accounts_owner_admin_write on social_accounts;
create policy social_accounts_owner_admin_write on social_accounts
  for all using (is_platform_admin() or has_org_role(organization_id, array['owner','admin']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin']::organization_role[]));

drop policy if exists media_assets_member_or_admin_select on media_assets;
create policy media_assets_member_or_admin_select on media_assets
  for select using (can_access_org(organization_id));

drop policy if exists media_assets_contributor_write on media_assets;
create policy media_assets_contributor_write on media_assets
  for all using (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]));

drop policy if exists posts_member_or_admin_select on posts;
create policy posts_member_or_admin_select on posts
  for select using (can_access_org(organization_id));

drop policy if exists posts_contributor_write on posts;
create policy posts_contributor_write on posts
  for all using (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]));

drop policy if exists post_targets_member_or_admin_select on post_targets;
create policy post_targets_member_or_admin_select on post_targets
  for select using (
    is_platform_admin()
    or exists (select 1 from posts p where p.id = post_targets.post_id and can_access_org(p.organization_id))
  );

drop policy if exists post_targets_contributor_write on post_targets;
create policy post_targets_contributor_write on post_targets
  for all using (
    is_platform_admin()
    or exists (
      select 1 from posts p
      where p.id = post_targets.post_id
        and has_org_role(p.organization_id, array['owner','admin','manager','editor']::organization_role[])
    )
  )
  with check (
    is_platform_admin()
    or exists (
      select 1 from posts p
      where p.id = post_targets.post_id
        and has_org_role(p.organization_id, array['owner','admin','manager','editor']::organization_role[])
    )
  );

drop policy if exists publish_jobs_member_or_admin_select on publish_jobs;
create policy publish_jobs_member_or_admin_select on publish_jobs
  for select using (
    is_platform_admin()
    or exists (
      select 1
      from post_targets pt
      inner join posts p on p.id = pt.post_id
      where pt.id = publish_jobs.post_target_id
        and can_access_org(p.organization_id)
    )
  );

drop policy if exists audit_logs_member_or_admin_select on audit_logs;
create policy audit_logs_member_or_admin_select on audit_logs
  for select using (can_access_org(organization_id));

drop policy if exists audit_logs_owner_admin_insert on audit_logs;
create policy audit_logs_owner_admin_insert on audit_logs
  for insert with check (is_platform_admin() or can_access_org(organization_id));

drop policy if exists media_bucket_member_select on storage.objects;
create policy media_bucket_member_select on storage.objects
  for select using (bucket_id = 'cast-loop-media' and can_access_storage_object(name));

drop policy if exists media_bucket_member_insert on storage.objects;
create policy media_bucket_member_insert on storage.objects
  for insert with check (bucket_id = 'cast-loop-media' and can_access_storage_object(name));

drop policy if exists media_bucket_member_update on storage.objects;
create policy media_bucket_member_update on storage.objects
  for update using (bucket_id = 'cast-loop-media' and can_access_storage_object(name))
  with check (bucket_id = 'cast-loop-media' and can_access_storage_object(name));

drop policy if exists media_bucket_member_delete on storage.objects;
create policy media_bucket_member_delete on storage.objects
  for delete using (bucket_id = 'cast-loop-media' and can_access_storage_object(name));
