---
name: cast-loop-publishing-flow
description: Use when changing Cast Loop scheduled publishing, publish jobs, post target statuses, Telegram reminders, mock/live social publishing, or idempotent scheduler behavior.
---

# Cast Loop Publishing Flow

Before editing, read:

- `AGENTS.md`
- `docs/agent-context/publishing.md`
- `docs/agent-context/social-auth.md` if provider behavior changes

Workflow:

1. Preserve `claimDuePosts` row-locking semantics.
2. Treat only `pending` targets as processable.
3. Publish only `publishable` targets automatically.
4. Send Telegram reminders only for `connect_only` targets when enabled.
5. Record all target outcomes through existing post result persistence.
6. Keep `SOCIAL_PUBLISH_MODE=mock` usable without provider credentials.

Never:

- Republish a processed target.
- Publish a `connect_only` account automatically.
- Make live credentials mandatory for local/mock flows.
- Drop auditability of publish attempts.

Validate:

```bash
pnpm test
pnpm lint
```
