revoke execute on function app_user_id() from public, anon, authenticated;
revoke execute on function is_platform_admin() from public, anon, authenticated;
revoke execute on function has_org_role(uuid, organization_role[]) from public, anon, authenticated;
revoke execute on function can_access_org(uuid) from public, anon, authenticated;
revoke execute on function can_access_storage_object(text) from public, anon, authenticated;
revoke execute on function rls_auto_enable() from public, anon, authenticated;

drop policy if exists organizations_owner_admin_write on organizations;
drop policy if exists organization_members_owner_admin_write on organization_members;
drop policy if exists social_accounts_owner_admin_write on social_accounts;
drop policy if exists media_assets_contributor_write on media_assets;
drop policy if exists posts_contributor_write on posts;
drop policy if exists post_targets_contributor_write on post_targets;

create policy organizations_owner_admin_insert on organizations
  for insert with check (is_platform_admin());

create policy organizations_owner_admin_update on organizations
  for update using (is_platform_admin() or has_org_role(id, array['owner','admin']::organization_role[]))
  with check (is_platform_admin() or has_org_role(id, array['owner','admin']::organization_role[]));

create policy organizations_owner_admin_delete on organizations
  for delete using (is_platform_admin() or has_org_role(id, array['owner']::organization_role[]));

create policy organization_members_owner_insert on organization_members
  for insert with check (is_platform_admin() or has_org_role(organization_id, array['owner']::organization_role[]));

create policy organization_members_owner_update on organization_members
  for update using (is_platform_admin() or has_org_role(organization_id, array['owner']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner']::organization_role[]));

create policy organization_members_owner_delete on organization_members
  for delete using (is_platform_admin() or has_org_role(organization_id, array['owner']::organization_role[]));

create policy social_accounts_owner_admin_insert on social_accounts
  for insert with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin']::organization_role[]));

create policy social_accounts_owner_admin_update on social_accounts
  for update using (is_platform_admin() or has_org_role(organization_id, array['owner','admin']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin']::organization_role[]));

create policy social_accounts_owner_admin_delete on social_accounts
  for delete using (is_platform_admin() or has_org_role(organization_id, array['owner','admin']::organization_role[]));

create policy media_assets_contributor_insert on media_assets
  for insert with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]));

create policy media_assets_contributor_update on media_assets
  for update using (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]));

create policy media_assets_contributor_delete on media_assets
  for delete using (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager']::organization_role[]));

create policy posts_contributor_insert on posts
  for insert with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]));

create policy posts_contributor_update on posts
  for update using (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]))
  with check (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager','editor']::organization_role[]));

create policy posts_contributor_delete on posts
  for delete using (is_platform_admin() or has_org_role(organization_id, array['owner','admin','manager']::organization_role[]));

create policy post_targets_contributor_insert on post_targets
  for insert with check (
    is_platform_admin()
    or exists (
      select 1 from posts p
      where p.id = post_targets.post_id
        and has_org_role(p.organization_id, array['owner','admin','manager','editor']::organization_role[])
    )
  );

create policy post_targets_contributor_update on post_targets
  for update using (
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

create policy post_targets_contributor_delete on post_targets
  for delete using (
    is_platform_admin()
    or exists (
      select 1 from posts p
      where p.id = post_targets.post_id
        and has_org_role(p.organization_id, array['owner','admin','manager']::organization_role[])
    )
  );
