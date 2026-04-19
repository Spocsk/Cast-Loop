# AGENTS.md

Guide destiné aux agents IA (Claude Code, Cursor, Copilot, Codex, etc.) qui interviennent sur ce dépôt. Langue projet : **français**. Lire aussi `README.md` pour le démarrage et `docs/PLAN.md` pour le cadrage initial.

## Vue produit

**Cast Loop** est une plateforme SaaS multi-tenant qui permet à une agence, un opérateur solo ou une petite équipe de connecter des comptes sociaux, programmer des posts et publier pour le compte de plusieurs entreprises clientes.

Périmètre actuellement implémenté dans le repo :
- Réseaux gérés : **LinkedIn**, **Facebook**, **Instagram**
- Variants de connexion sociaux :
  - `linkedin_personal`
  - `linkedin_page`
  - `facebook_page`
  - `instagram_professional`
  - `meta_personal`
- Capacités produit :
  - comptes `publishable` : sélectionnables pour la publication automatique
  - comptes `connect_only` : visibles dans l'app mais non publiables automatiquement
- Contenu v1 : **texte + une image**
- Fonctions principales : brouillons, calendrier, programmation, publication mock/live, historique, archivage/restauration, rappels Telegram pour les cibles `connect_only`

Hors scope actuel :
- analytics
- inbox / commentaires
- workflow d’approbation
- vidéo / carousel
- billing self-serve

## Stack

- **Monorepo pnpm** avec workspaces `apps/*`, `packages/*`
- **Frontend** `apps/web` : Next.js 15 (App Router), React 19, TypeScript, CSS custom
- **Backend** `apps/api` : NestJS 10, API REST avec préfixe global `/api/v1`
- **Shared** `packages/shared` (`@cast-loop/shared`) : types et contrats partagés, buildés vers `dist/`
- **Supabase** : Postgres + Auth + Storage
- **Déploiement cible** : web sur Vercel, API Node sur un service séparé

## Commandes

Les scripts racine utilisent `npm run ... --workspace`; `pnpm` et `npm` fonctionnent tous les deux.

| But | Commande |
|---|---|
| Installer | `pnpm install` |
| Dev front | `pnpm dev:web` |
| Dev back | `pnpm dev:api` |
| Build complet | `pnpm build` |
| Typecheck front + back | `pnpm typecheck` |
| Lint source | `pnpm lint` |
| Tests API | `pnpm test` |
| Un seul test API | `npm run test --workspace @cast-loop/api -- path/to/file.spec.ts` ou `-t "nom du test"` |
| API compilée | `npm run start --workspace @cast-loop/api` |

Important :
- `pnpm build` exécute bien l’ordre `shared -> api -> web`
- `pnpm lint` à la racine lance **ESLint**, pas `tsc --noEmit`

## Environnement

- Utiliser un **fichier racine `.env`**. L’API remonte depuis `__dirname` jusqu’à trouver ce fichier ; Next.js lit aussi les variables de la racine.
- Pour `DATABASE_URL`, utiliser la chaîne **Session pooler** Supabase (IPv4). La connexion directe `db.<ref>.supabase.co:5432` est IPv6-only et casse avec `EHOSTUNREACH`.
- Générer `TOKEN_ENCRYPTION_KEY` avec :
  - `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Mode de publication **`SOCIAL_PUBLISH_MODE=mock`** par défaut :
  - les connexions OAuth peuvent être réelles
  - la publication provider peut rester simulée

Variables importantes côté backend :
- socle :
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET`
  - `TOKEN_ENCRYPTION_KEY`
  - `APP_WEB_URL`
  - `SOCIAL_PUBLISH_MODE`
- LinkedIn :
  - `LINKEDIN_MEMBER_CLIENT_ID`
  - `LINKEDIN_MEMBER_CLIENT_SECRET`
  - `LINKEDIN_MEMBER_REDIRECT_URI`
  - `LINKEDIN_ORG_CLIENT_ID`
  - `LINKEDIN_ORG_CLIENT_SECRET`
  - `LINKEDIN_ORG_REDIRECT_URI`
  - `LINKEDIN_API_VERSION`
- Meta :
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `META_REDIRECT_URI`
  - `META_API_VERSION`
- Telegram :
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`

Variables importantes côté web :
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Architecture

### Frontière d’accès aux données

**Le frontend ne lit jamais les tables applicatives Supabase directement.**  
Toute donnée métier transite par l’API Nest. Supabase côté web = Auth, session JWT et upload Storage via URL signée émise par l’API.

### Flux d’authentification

1. Le web authentifie l’utilisateur via Supabase Auth.
2. Le JWT est envoyé au backend Nest dans `Authorization`.
3. Nest valide le token contre Supabase.
4. L’API résout l’appartenance organisation (`organization_members`) et filtre toutes les routes métier par tenant.

### Modèle multi-tenant

- Entités principales :
  - `users`
  - `organizations`
  - `organization_members`
  - `social_accounts`
  - `media_assets`
  - `posts`
  - `post_targets`
  - `publish_jobs`
  - `audit_logs`
- Un utilisateur peut appartenir à plusieurs organisations
- Rôles v1 : `owner`, `manager`, `editor`
- Un post appartient à **une** organisation et cible plusieurs `social_accounts` de cette même organisation via `post_targets`

### Backend (`apps/api`)

- `src/main.ts` :
  - préfixe `/api/v1`
  - CORS ouvert avec credentials
  - `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- `src/app.module.ts` :
  - `ConfigModule` global
  - `ScheduleModule.forRoot()`
  - modules métier
- Modules métier :
  - `auth`
  - `organizations`
  - `social-accounts`
  - `media`
  - `posts`
  - `calendar`
  - `publishing`
  - `audit`
- `src/database/` :
  - `database.service.ts` pour Postgres (`pg`)
  - `supabase-admin.service.ts` pour Supabase service role
- `src/common/` :
  - guards, decorators, crypto, types transverses

### Pipeline de publication

- États de post :
  - `draft`
  - `scheduled`
  - `publishing`
  - `published`
  - `failed`
  - `cancelled`
- Statuts de cible :
  - `pending`
  - `published`
  - `notified`
  - `failed`
  - `cancelled`
- Le scheduler Nest tourne chaque minute :
  - sélectionne les posts `scheduled` dus
  - verrouille au niveau ligne en Postgres
  - publie les cibles `publishable`
  - envoie un rappel Telegram pour les cibles `connect_only` si `send_telegram_reminder=true`
  - journalise dans `publish_jobs` et `audit_logs`

### Social accounts

- `social_accounts` distingue :
  - `provider`
  - `account_type` : `personal`, `page`, `business`, `creator`
  - `publish_capability` : `publishable`, `connect_only`
  - `status` : `connected`, `expired`, `disconnected`
- Le backend expose les disponibilités de connexion par **provider + variant**
- Les callbacks OAuth sont dédiés :
  - LinkedIn : `/social-auth/linkedin/callback`
  - Meta : `/social-auth/meta/callback`
- Si un provider remonte plusieurs comptes/pages éligibles, l’API retourne un état `selection_required` et le web finalise la sélection ensuite

### Media

- Upload via **URL signée émise par l’API** :
  - `POST /media/upload-url`
  - le client upload ensuite vers Supabase Storage
  - l’asset est référencé dans `media_assets`
- L’API expose aussi une URL signée de lecture :
  - `GET /media/:id/view-url`

## Interfaces publiques actuelles

Routes principales exposées par l’API :

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

## Migrations

Toute évolution de schéma doit passer par un **nouveau fichier SQL** dans `supabase/migrations/`.

Migrations déjà présentes :
- `0001_init.sql`
- `20260417100000_add_posts_archived_at.sql`
- `20260417123000_add_social_accounts_provider_external_unique.sql`
- `20260419153458_add_social_account_capabilities_and_telegram_reminders.sql`

## Conventions pour les agents

- **Langue** : code en anglais, UI et docs fonctionnelles en français
- **Types partagés** : tout contrat API, enum et payload partagé va dans `packages/shared`
- **Pas de lecture directe Supabase depuis le web**
- **Tenant-safety** : toute nouvelle route API doit filtrer par `organizationId` et vérifier le membership
- **Scheduler** : tout traitement asynchrone doit rester idempotent et compatible avec le verrouillage Postgres
- **Mode mock** : garder un chemin de code utilisable sans credentials sociaux réels
- **Tests** :
  - Jest côté API
  - pas de runner de tests front configuré en v1
- **Build** :
  - `@cast-loop/shared` est consommé depuis `dist/`
  - si tu modifies `packages/shared`, il faut rebuild avant de lancer l’API ou le build complet

## Points d’attention produit

- Le fait qu’une app LinkedIn Developer soit associée à une page LinkedIn ne veut **pas** dire que tous les posts iront sur cette page :
  - `linkedin_personal` cible le profil membre
  - `linkedin_page` cible une page LinkedIn connectée
- Les comptes `connect_only` restent visibles dans l’app mais ne doivent **jamais** devenir des cibles valides de publication automatique
- Les rappels Telegram ne remplacent pas la publication automatique ; ils complètent le flux pour les comptes non publiables
