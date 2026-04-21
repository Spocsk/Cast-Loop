# Cast Loop

![Cast Loop Screenshot](docs/assets/readme-cover.png)

Cast Loop is a multi-tenant SaaS platform for social media scheduling and publishing for agencies, solo operators, and small teams. The product lets users connect multiple social accounts, manage several client companies, and run publishing workflows from a single cockpit.

## Overview

This repository currently implements:

- Social connections: LinkedIn, Facebook, Instagram
- Supported variants:
  - `linkedin_personal`
  - `linkedin_page`
  - `facebook_page`
  - `instagram_professional`
  - `meta_personal`
- Product capabilities:
  - drafts
  - editorial calendar
  - scheduling
  - mock or live publishing
  - history
  - archive / restore
  - Telegram reminders for `connect_only` accounts
- v1 content format: text + one image

Currently out of scope:

- analytics
- inbox / comments
- approval workflow
- video / carousel
- self-serve billing

## Product Screenshot

The screenshot above shows the current publishing cockpit in the web app.

## Stack

- `apps/web`: Next.js 15, App Router, React 19, TypeScript, custom CSS
- `apps/api`: NestJS 10, versioned REST API under `/api/v1`
- `packages/shared`: shared types and contracts built to `dist/`
- `supabase/`: Postgres, Auth, Storage, and SQL migrations
- Target deployment: web on Vercel, Node API on a separate service

## Architecture

Core project rules:

- The frontend never reads application Supabase tables directly
- Authentication happens through Supabase on the web side, then JWT validation on the Nest API side
- Every business route must be filtered by organization and membership
- The Nest scheduler processes scheduled posts every minute with Postgres row locking
- `connect_only` accounts remain visible but must never become valid automatic publishing targets

Main business entities:

- `users`
- `organizations`
- `organization_members`
- `social_accounts`
- `media_assets`
- `posts`
- `post_targets`
- `publish_jobs`
- `audit_logs`

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the environment

The project uses a root `.env` file.

```bash
cp .env.example .env
```

Important variables:

- Backend:
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET`
  - `TOKEN_ENCRYPTION_KEY`
  - `APP_WEB_URL`
  - `SOCIAL_PUBLISH_MODE`
- Frontend:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Generate `TOKEN_ENCRYPTION_KEY` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Important:

- For `DATABASE_URL`, use the Supabase Session pooler connection string over IPv4
- The direct connection `db.<ref>.supabase.co:5432` is IPv6-only and may fail with `EHOSTUNREACH`
- `SOCIAL_PUBLISH_MODE=mock` is the recommended default for local development

### 3. Apply migrations

Any schema change must go through a new SQL file in `supabase/migrations/`.

Existing migrations:

- `0001_init.sql`
- `20260417100000_add_posts_archived_at.sql`
- `20260417123000_add_social_accounts_provider_external_unique.sql`
- `20260419153458_add_social_account_capabilities_and_telegram_reminders.sql`

Also configure the Storage bucket defined in `SUPABASE_STORAGE_BUCKET`.

### 4. Run locally

```bash
pnpm dev:api
pnpm dev:web
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`

If you change `packages/shared`, rebuild it before restarting the API or running the full build:

```bash
npm run build --workspace @cast-loop/shared
```

## Useful Scripts

| Command | Description |
|---|---|
| `pnpm install` | Installs all monorepo dependencies |
| `pnpm dev:web` | Starts the Next.js frontend |
| `pnpm dev:api` | Starts the NestJS API in watch mode |
| `pnpm build` | Builds `shared`, then `api`, then `web` |
| `pnpm typecheck` | Runs `tsc --noEmit` on `api` and `web` through workspace scripts |
| `pnpm lint` | Runs ESLint on source code |
| `pnpm test` | Runs the API Jest test suite |
| `npm run test --workspace @cast-loop/api -- path/to/file.spec.ts` | Runs a targeted API test |
| `npm run start --workspace @cast-loop/api` | Starts the compiled API |

## Publishing Pipeline

Post states:

- `draft`
- `scheduled`
- `publishing`
- `published`
- `failed`
- `cancelled`

Target statuses:

- `pending`
- `published`
- `notified`
- `failed`
- `cancelled`

The scheduler:

- selects due `scheduled` posts
- locks rows in the database
- publishes `publishable` targets
- sends a Telegram reminder for `connect_only` targets when requested
- logs execution in `publish_jobs` and `audit_logs`

## Current Public Interfaces

```text
POST   /auth/session/validate

GET    /organizations
POST   /organizations

GET    /organizations/:id/social-accounts
POST   /organizations/:id/social-accounts
GET    /organizations/:id/social-accounts/providers
POST   /organizations/:id/social-accounts/:provider/start
GET    /organizations/:id/social-accounts/pending-selection
POST   /organizations/:id/social-accounts/pending-selection/complete
DELETE /organizations/:id/social-accounts/:accountId

GET    /social-auth/linkedin/callback
GET    /social-auth/meta/callback

GET    /media
GET    /media/:id/view-url
POST   /media/upload-url

GET    /posts
POST   /posts
PATCH  /posts/:id
POST   /posts/:id/schedule
POST   /posts/:id/publish-now
POST   /posts/:id/cancel
POST   /posts/:id/archive
POST   /posts/:id/restore
DELETE /posts/:id

GET    /calendar?organizationId=...&from=...&to=...
```

## References

- Initial scope: [`docs/PLAN.md`](docs/PLAN.md)
- Agent instructions: [`AGENTS.md`](AGENTS.md)
