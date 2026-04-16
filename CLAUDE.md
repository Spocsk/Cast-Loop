# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager: `pnpm` (workspaces). Scripts are wired as `npm run <x> --workspace @cast-loop/<pkg>` so both `pnpm` and `npm` work.

- Install: `pnpm install`
- Dev (two terminals): `pnpm dev:web` and `pnpm dev:api`
- Build all (shared → api → web, in order): `pnpm build`
- Lint (runs `tsc --noEmit` for each app): `pnpm lint`
- Run API tests: `pnpm test` (aliases `jest --runInBand` in `apps/api`)
- Run a single API test: `npm run test --workspace @cast-loop/api -- path/to/file.spec.ts` (or `-t "test name"`)
- Run compiled API: `npm run start --workspace @cast-loop/api` (canonical — see README)
- DB migration: apply `supabase/migrations/0001_init.sql` on the Supabase project.

Env: copy `.env.example` to `.env` at the repo root. `apps/api` walks up from `__dirname` to find the nearest `.env`, so a single root-level file feeds both apps. For `DATABASE_URL`, prefer Supabase's **Session pooler** string (IPv4) — the direct `db.<ref>.supabase.co:5432` host is IPv6-only and can fail with `EHOSTUNREACH`.

## Architecture

Monorepo with three workspaces:
- `apps/web` — Next.js 15 App Router (React 19, TS). Dashboard under `src/app/(dashboard)/` with routes: `calendar`, `posts`, `media`, `companies`, `social-accounts`, `settings`. Auth and session providers live in `src/components/providers/`.
- `apps/api` — NestJS 10 REST API, global prefix `/api/v1` (see `apps/api/src/main.ts`). Modules: `auth`, `organizations`, `social-accounts`, `media`, `posts`, `calendar`, `publishing`, `audit`. Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`. `ScheduleModule` is enabled at the root.
- `packages/shared` — `@cast-loop/shared` types and DTOs consumed by both apps. Built to `dist/` via `tsc`; must be built before `api`/`web` (the root `build` script handles ordering).

Data & auth flow:
- Supabase provides Postgres, Auth, and Storage. The **web** app authenticates users with Supabase Auth; the resulting JWT is sent to Nest, which validates it against Supabase. **The frontend does not read application tables directly** — Nest is the only business layer.
- Multi-tenant model: `organizations` + `organization_members` (roles `owner`/`manager`/`editor`). A post belongs to one organization and can target multiple `social_accounts` of that org via `post_targets`.
- Database access in Nest goes through `src/database/` (`database.service.ts` for Postgres via `pg`, `supabase-admin.service.ts` for Supabase admin operations). Cross-cutting code (guards, interceptors, decorators, crypto) lives under `src/common/`.

Publishing pipeline:
- Post states: `draft`, `scheduled`, `publishing`, `published`, `failed`, `cancelled`. Per-network attempts are recorded in `publish_jobs`.
- A Nest scheduler (in `modules/publishing/`) runs each minute, selects `scheduled` posts due for publication with row-level locking (Postgres-based, no Redis/BullMQ), publishes, then writes `success`/`failed` to `publish_jobs` and `audit_logs`.
- A **mock** publishing mode is the default for local dev so you don't need live Meta/LinkedIn credentials.

Media:
- Images are uploaded to Supabase Storage via **signed upload URLs issued by the API** (`POST /media/upload-url`), then referenced in `media_assets`. Validation is on MIME, size, and minimum dimensions.

v1 scope boundaries (per `docs/PLAN.md`): Facebook Pages, Instagram Business, LinkedIn Pages; text + single image only (no video, no carousel, no personal accounts); no analytics, inbox, approval workflow, or self-serve billing. Default UI language is French.
