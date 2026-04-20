alter table users
  add column if not exists active_organization_id uuid references organizations(id) on delete set null;

with ranked_memberships as (
  select
    om.user_id,
    om.organization_id,
    row_number() over (
      partition by om.user_id
      order by o.name asc, om.organization_id asc
    ) as row_number
  from organization_members om
  inner join organizations o on o.id = om.organization_id
)
update users u
set active_organization_id = ranked.organization_id
from ranked_memberships ranked
where u.id = ranked.user_id
  and ranked.row_number = 1
  and u.active_organization_id is null;

create index if not exists idx_users_active_organization on users(active_organization_id);
