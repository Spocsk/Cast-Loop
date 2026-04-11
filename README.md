# Cast Loop

Plateforme multi-tenant pour programmer et publier des posts sur plusieurs reseaux sociaux pour soi-meme et pour des entreprises clientes.

## Stack
- `apps/web`: Next.js App Router, React, TypeScript
- `apps/api`: NestJS, API REST, scheduler de publication
- `packages/shared`: types metier et contrats partages
- `Supabase`: Postgres, Auth, Storage

## Demarrage
1. Copier `.env.example` vers `.env.local` ou charger les memes variables dans ton environnement.
2. Installer les dependances avec `pnpm install`.
3. Lancer `pnpm dev:web` et `pnpm dev:api`.
4. Appliquer la migration SQL sur Supabase avec le contenu de `supabase/migrations/0001_init.sql`.

## Points clefs
- Auth front via Supabase, validation de session dans Nest.
- Isolation multi-tenant par organisation et membership.
- Scheduler backend qui traite les posts `scheduled` et journalise les tentatives.
- Mode de publication `mock` par defaut pour developper sans brancher les APIs sociales reelles.
