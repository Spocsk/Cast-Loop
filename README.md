# Cast Loop

Plateforme multi-tenant pour programmer et publier des posts sur plusieurs reseaux sociaux, pour soi-meme et pour des entreprises clientes.

## Stack

- `apps/web` — Next.js 15 (App Router), React 19, TypeScript, CSS custom (pas de Tailwind).
- `apps/api` — NestJS 10, REST `/api/v1`, scheduler de publication (`@nestjs/schedule`).
- `packages/shared` — Types et contrats partages entre web et api.
- `supabase/` — Migrations Postgres (Auth, Storage, multi-tenant).

## Prerequis

- Node.js 20+
- pnpm 9.15+
- Un projet Supabase (Auth + Database + Storage bucket)

## Mise en route

1. **Cloner et installer**
   ```bash
   pnpm install
   ```

2. **Configurer l'environnement**
   ```bash
   cp .env.example .env.local
   ```
   Remplir les variables (voir `.env.example` pour le detail de chaque clef).
   Generer `TOKEN_ENCRYPTION_KEY` avec :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. **Appliquer le schema Supabase**
   Copier le contenu de `supabase/migrations/0001_init.sql` dans l'editeur SQL Supabase et executer.
   Creer le bucket Storage `cast-loop-media` (ou celui configure dans `SUPABASE_STORAGE_BUCKET`).

4. **Lancer en local**
   ```bash
   pnpm --filter @cast-loop/shared build   # necessaire une fois
   pnpm dev:api                            # http://localhost:4000
   pnpm dev:web                            # http://localhost:3000
   ```

## Scripts racine

| Commande                | Description                                        |
|-------------------------|----------------------------------------------------|
| `pnpm build`            | Build shared, puis api, puis web                   |
| `pnpm dev:api`          | Demarre l'API NestJS en watch mode                 |
| `pnpm dev:web`          | Demarre Next.js en dev                             |
| `pnpm typecheck`        | `tsc --noEmit` sur api + web                       |
| `pnpm lint`             | ESLint sur tout le code source                     |
| `pnpm format`           | Prettier write                                     |
| `pnpm format:check`     | Prettier verification (CI)                         |
| `pnpm test`             | Tests Jest sur l'API                               |

## Tips

- Pour `DATABASE_URL`, preferer la chaine **Session pooler** de Supabase pour un backend Node persistant sur un reseau IPv4. La connexion directe `db.<project-ref>.supabase.co:5432` repose sur IPv6 et peut lever `EHOSTUNREACH`.
- Mode de publication `SOCIAL_PUBLISH_MODE=mock` par defaut : simule les appels aux APIs sociales. Passer a `live` pour brancher les integrations reelles.
- Pour lancer l'API compilee : `pnpm --filter @cast-loop/api start`.

## Architecture en bref

- **Auth** : connexion Supabase cote web, validation du JWT par l'API (`/auth/session/validate`), session gardee en contexte React.
- **Multi-tenant** : chaque utilisateur appartient a une ou plusieurs organisations. Toutes les requetes API verifient le membership avant d'acceder a une ressource.
- **Scheduler** : cron NestJS qui selectionne les posts `scheduled` dont `scheduled_at <= now()`, verrouille en DB, publie via les adapters et ecrit `publish_jobs`.
- **Tokens OAuth sociaux** : chiffres avec `TOKEN_ENCRYPTION_KEY` avant stockage.

## CI

Une workflow GitHub Actions (`.github/workflows/ci.yml`) execute sur chaque PR : install, build shared, typecheck, lint, format check, test API, build final.
