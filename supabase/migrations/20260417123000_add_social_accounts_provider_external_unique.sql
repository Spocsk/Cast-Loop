create unique index if not exists idx_social_accounts_provider_external_unique
  on social_accounts (organization_id, provider, external_account_id);
