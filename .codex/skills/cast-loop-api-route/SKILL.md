---
name: cast-loop-api-route
description: Use when adding or changing a Cast Loop NestJS API route, controller, DTO, service method, guard usage, tenant-safe query, or API Jest test.
---

# Cast Loop API Route

Before editing, read:

- `AGENTS.md`
- `docs/agent-context/api.md`
- `docs/agent-context/shared-contracts.md` if the route payload crosses API/web

Workflow:

1. Locate the owning module under `apps/api/src/modules/`.
2. Keep controllers thin: auth/current user extraction, DTO validation, service call.
3. Enforce tenant safety in the service with `OrganizationsService.assertMembership`.
4. Filter SQL by `organization_id` or by a tenant-safe join.
5. Put shared request/response contracts in `packages/shared` when consumed by web.
6. Add or update Jest tests for risky service behavior.

Never:

- Add a business route without `organizationId`.
- Read or write cross-tenant data.
- Change schema without a new SQL migration.
- Bypass the existing `DatabaseService`/`SupabaseAdminService` patterns.

Validate with the narrowest useful command:

```bash
npm run test --workspace @cast-loop/api -- path/to/file.spec.ts
pnpm lint
```
