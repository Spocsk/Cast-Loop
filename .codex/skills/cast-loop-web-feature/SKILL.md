---
name: cast-loop-web-feature
description: Use when adding or changing a Cast Loop Next.js web feature, dashboard UI, API client call, organization-scoped screen, or Supabase Auth/Storage interaction.
---

# Cast Loop Web Feature

Before editing, read:

- `AGENTS.md`
- `docs/agent-context/web.md`
- `docs/agent-context/shared-contracts.md` if adding/changing API shapes

Workflow:

1. Keep business data access through `apps/web/src/lib/api.ts`.
2. Send the Supabase access token in `Authorization`.
3. Pass the active `organizationId` for business operations.
4. Use `@cast-loop/shared` for API payload/result types.
5. Keep UI copy in French.
6. For uploads, request a signed URL from the API before using Supabase Storage.

Never:

- Read application tables directly from Supabase in the web app.
- Duplicate shared API contracts as local UI types.
- Add a business API call without auth handling.

Validate:

```bash
pnpm lint
```
