# AGENTS.md

Guide destiné aux agents IA (Claude Code, Cursor, Copilot, Codex, etc.) qui interviennent sur ce dépôt. Langue projet : **français**. Lisez aussi `docs/PLAN.md` pour le cadrage produit et `README.md` pour le démarrage.

## Vue produit

**Cast Loop** est une plateforme SaaS multi-tenant qui permet à une agence (ou un utilisateur seul) de programmer et publier des posts sur plusieurs réseaux sociaux pour le compte de plusieurs entreprises clientes.

Périmètre v1 :
- Réseaux supportés : **Facebook Pages**, **Instagram Business**, **LinkedIn Pages**.
- Contenu : **texte + une image** uniquement (pas de vidéo, pas de carousel, pas de comptes perso).
- Fonctions : brouillons, calendrier, programmation, publication automatique, historique.
- **Hors scope v1** : analytics, inbox/commentaires, workflow d'approbation, facturation self-serve.

## Stack

- **Monorepo pnpm** (workspaces `apps/*`, `packages/*`). Package manager figé : `pnpm@9.15.0`.
- **Frontend** `apps/web` : Next.js 15 (App Router), React 19, TypeScript.
- **Backend** `apps/api` : NestJS 10, API REST, préfixe global `/api/v1`.
- **Shared** `packages/shared` (`@cast-loop/shared`) : types et DTOs partagés, compilé via `tsc` vers `dist/`.
- **Supabase** : Postgres + Auth + Storage. Migrations SQL dans `supabase/migrations/`.
- **Déploiement cible** : web sur Vercel, API Node sur un service séparé.

## Commandes

Les scripts racine utilisent `npm run ... --workspace` — `pnpm` et `npm` fonctionnent tous les deux.

| But | Commande |
|---|---|
| Installer | `pnpm install` |
| Dev front | `pnpm dev:web` |
| Dev back | `pnpm dev:api` |
| Build complet (ordre : shared → api → web) | `pnpm build` |
| Lint (= `tsc --noEmit` sur chaque app) | `pnpm lint` |
| Tests API | `pnpm test` |
| Un seul test API | `npm run test --workspace @cast-loop/api -- path/to/file.spec.ts` ou `-t "nom du test"` |
| API compilée (canonique) | `npm run start --workspace @cast-loop/api` |

## Environnement

- Copier `.env.example` vers `.env` à la racine. `apps/api` remonte depuis `__dirname` jusqu'à trouver un `.env`, donc **un seul fichier racine** suffit pour les deux apps.
- Pour `DATABASE_URL`, utiliser la chaîne **Session pooler** Supabase (IPv4). La connexion directe `db.<ref>.supabase.co:5432` est IPv6-only et casse avec `EHOSTUNREACH`.
- Mode de publication **`mock` par défaut** : on développe sans brancher Meta/LinkedIn réels.

## Architecture

### Frontière d'accès aux données (règle dure)

**Le frontend ne lit jamais les tables applicatives Supabase directement.** Toute donnée métier transite par l'API Nest. Supabase côté web = Auth (login, session JWT) et éventuellement upload Storage via URL signée émise par l'API. Ne pas contourner ce contrat.

### Flux d'authentification

1. Le web authentifie l'utilisateur via Supabase Auth.
2. Le JWT est envoyé au backend Nest (header `Authorization`).
3. Nest valide le token contre Supabase et résout l'appartenance organisation (`organization_members`).
4. Toutes les routes métier sont filtrées par tenant.

### Modèle multi-tenant

- Entités : `users`, `organizations`, `organization_members`, `social_accounts`, `media_assets`, `posts`, `post_targets`, `publish_jobs`, `audit_logs`.
- Un utilisateur peut appartenir à plusieurs organisations.
- Rôles v1 : `owner`, `manager`, `editor`.
- Un post appartient à **une** organisation et peut cibler plusieurs `social_accounts` de cette même organisation via `post_targets`.

### Backend (`apps/api`)

- `src/main.ts` : bootstrap, préfixe `/api/v1`, CORS ouvert avec credentials, `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted` + `transform`).
- `src/app.module.ts` : `ConfigModule` global, `ScheduleModule.forRoot()`, puis les modules métier.
- Modules : `auth`, `organizations`, `social-accounts`, `media`, `posts`, `calendar`, `publishing`, `audit`.
- `src/database/` : `database.service.ts` (Postgres via `pg`) et `supabase-admin.service.ts` (service role Supabase).
- `src/common/` : `guards`, `interceptors`, `decorators`, `crypto`, `types` — transverses, à réutiliser plutôt qu'à dupliquer.

### Pipeline de publication

- États d'un post : `draft` → `scheduled` → `publishing` → `published` | `failed` | `cancelled`.
- `publish_jobs` journalise chaque tentative par cible réseau (`success`/`failed` + erreur).
- Un **scheduler Nest** tourne chaque minute, sélectionne les `scheduled` dus, **verrouille au niveau ligne en Postgres** pour éviter les doubles publications (pas de Redis/BullMQ en v1), publie, puis écrit dans `publish_jobs` et `audit_logs`.

### Media

- Upload via **URL signée émise par l'API** : `POST /media/upload-url` → le client upload directement vers Supabase Storage → l'asset est référencé dans `media_assets`.
- Validation v1 : MIME, taille max, dimensions minimales.

### Interfaces publiques prévues

```
POST   /auth/session/validate
GET|POST   /organizations
GET|POST   /organizations/:id/social-accounts
POST   /media/upload-url
GET|POST   /posts
POST   /posts/:id/schedule
POST   /posts/:id/publish-now
POST   /posts/:id/cancel
GET    /calendar?organizationId=...&from=...&to=...
```

## Conventions pour les agents

- **Langue** : code en anglais, UI et docs fonctionnelles en français.
- **Types partagés** : tout contrat API (DTO, enum d'état de post, rôles) va dans `packages/shared`. Ne pas dupliquer une forme côté web ou côté api.
- **Pas de lecture directe Supabase depuis le web.** Ajouter une route Nest si le besoin manque.
- **Tenant-safety** : toute nouvelle route API doit filtrer par `organizationId` et vérifier le membership. Pas d'endpoint qui expose des données cross-tenant.
- **Scheduler** : tout nouveau traitement asynchrone doit rester idempotent et compatible avec le verrouillage Postgres (pas d'hypothèse worker unique).
- **Migrations** : toute évolution de schéma = nouveau fichier SQL dans `supabase/migrations/`, pas de modification d'une migration existante.
- **Mode mock** : garder un chemin de code qui fonctionne sans credentials réseaux réels.
- **Tests** : Jest côté API (`apps/api`). Le front n'a pas de runner de tests configuré en v1 — ne pas en inventer un sans accord.
- **`pnpm build`** doit passer : l'ordre shared → api → web compte car `@cast-loop/shared` est consommé depuis `dist/`.
