alter table posts
add column if not exists archived_at timestamptz;

create index if not exists idx_posts_organization_archived_at
on posts (organization_id, archived_at);
