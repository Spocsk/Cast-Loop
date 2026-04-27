---
name: cast-loop-social-auth
description: Use when changing Cast Loop LinkedIn or Meta OAuth, social account variants, provider availability, pending account selection, token storage, or social account capabilities.
---

# Cast Loop Social Auth

Before editing, read:

- `AGENTS.md`
- `docs/agent-context/social-auth.md`
- `docs/agent-context/shared-contracts.md` if variants/callback statuses change

Workflow:

1. Keep provider variants explicit and capability-aware.
2. Validate provider + variant compatibility before starting OAuth.
3. Bind OAuth state and selection tokens to `organizationId`, `userId`, and expiry.
4. Encrypt provider tokens through `TokenCipherService`.
5. Upsert accounts without changing `connect_only` into `publishable`.
6. Preserve `selection_required` when multiple eligible accounts exist.

Never:

- Assume LinkedIn app page association means all posts target that page.
- Treat `meta_personal` as publishable.
- Store raw provider tokens.
- Complete selection for a different user or organization.

Validate:

```bash
npm run test --workspace @cast-loop/api -- linkedin-oauth.service.spec.ts
pnpm lint
```
