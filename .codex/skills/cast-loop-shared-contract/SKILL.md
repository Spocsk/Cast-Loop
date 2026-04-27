---
name: cast-loop-shared-contract
description: Use when adding or changing Cast Loop shared API contracts, enums, payloads, result types, or package exports in packages/shared.
---

# Cast Loop Shared Contract

Before editing, read:

- `AGENTS.md`
- `docs/agent-context/shared-contracts.md`

Workflow:

1. Update `packages/shared/src/types.ts`.
2. Export public contracts through `packages/shared/src/index.ts` if needed.
3. Update API DTO/service/controller usage.
4. Update web API client/UI usage.
5. Rebuild shared because API/web consume `dist`.

Never:

- Put API/web shared payloads only in one workspace.
- Change enum values without checking SQL comparisons and existing data assumptions.
- Forget the shared rebuild.

Validate:

```bash
npm run build --workspace @cast-loop/shared
pnpm lint
```
