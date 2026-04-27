# AGENTS.md

Guide destiné aux agents IA qui interviennent sur ce dépôt. Langue projet : **français**.

Lire aussi :

- `README.md` pour la mise en route humaine.
- `docs/PLAN.md` pour le cadrage initial.
- `docs/agent-context/README.md` pour la mémoire agent progressive.

## Vue Produit

**Cast Loop** est une plateforme SaaS multi-tenant pour agences, opérateurs solo et petites équipes. Elle permet de connecter des comptes sociaux, programmer des posts et publier pour plusieurs entreprises clientes.

Périmètre implémenté :

- Réseaux : **LinkedIn**, **Facebook**, **Instagram**
- Variants sociaux :
  - `linkedin_personal`
  - `linkedin_page`
  - `facebook_page`
  - `instagram_professional`
  - `meta_personal`
- Capacités :
  - `publishable` : cible valide pour publication automatique
  - `connect_only` : visible dans l'app mais jamais publié automatiquement
- Contenu v1 : **texte + une image**
- Fonctions : brouillons, calendrier, programmation, publication mock/live, historique, archivage/restauration, rappels Telegram pour les cibles `connect_only`

Hors scope actuel :

- analytics
- inbox / commentaires
- workflow d'approbation
- vidéo / carousel
- billing self-serve

## Stack

- Monorepo `pnpm` avec workspaces `apps/*`, `packages/*`
- Frontend `apps/web` : Next.js 15 App Router, React 19, TypeScript, CSS custom
- Backend `apps/api` : NestJS 10, API REST avec préfixe global `/api/v1`
- Shared `packages/shared` (`@cast-loop/shared`) : types et contrats partagés buildés vers `dist/`
- Supabase : Postgres, Auth, Storage
- Déploiement cible : web sur Vercel, API Node sur un service séparé

## Commandes

| But                    | Commande                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Installer              | `pnpm install`                                                                          |
| Dev front              | `pnpm dev:web`                                                                          |
| Dev back               | `pnpm dev:api`                                                                          |
| Build complet          | `pnpm build`                                                                            |
| Typecheck front + back | `pnpm typecheck`                                                                        |
| Lint source            | `pnpm lint`                                                                             |
| Format check           | `pnpm format:check`                                                                     |
| Tests API              | `pnpm test`                                                                             |
| Un seul test API       | `npm run test --workspace @cast-loop/api -- path/to/file.spec.ts` ou `-t "nom du test"` |
| API compilée           | `npm run start --workspace @cast-loop/api`                                              |

Important :

- `pnpm build` exécute l'ordre `shared -> api -> web`.
- `pnpm lint` lance ESLint.
- `pnpm typecheck` délègue aux scripts `lint` des workspaces API et web.
- Si `packages/shared` change, rebuild `@cast-loop/shared` avant de lancer l'API ou un build complet.

## Mémoire Agent

Avant une modification, lire la fiche spécialisée pertinente :

| Tâche                                   | Lire d'abord                             |
| --------------------------------------- | ---------------------------------------- |
| Route, service, DTO ou test API         | `docs/agent-context/api.md`              |
| UI Next.js, appels API web, upload      | `docs/agent-context/web.md`              |
| Types/API contracts partagés            | `docs/agent-context/shared-contracts.md` |
| Scheduler, publication, Telegram        | `docs/agent-context/publishing.md`       |
| OAuth LinkedIn/Meta, variants sociaux   | `docs/agent-context/social-auth.md`      |
| Décision durable ou convention nouvelle | `docs/agent-context/decisions.md`        |

Skills repo-localisés disponibles comme références de workflow :

- `.codex/skills/cast-loop-api-route/SKILL.md`
- `.codex/skills/cast-loop-web-feature/SKILL.md`
- `.codex/skills/cast-loop-shared-contract/SKILL.md`
- `.codex/skills/cast-loop-publishing-flow/SKILL.md`
- `.codex/skills/cast-loop-social-auth/SKILL.md`

Règle de vérité : si une fiche mémoire contredit le code actuel, **le code actuel gagne**. Corriger la mémoire dans la même tâche si la divergence est durable.

## Règles Non Négociables

- Code en anglais ; UI et docs fonctionnelles en français.
- Le frontend ne lit jamais les tables applicatives Supabase directement.
- Toute donnée métier transite par l'API Nest.
- Supabase côté web sert à Auth, session JWT et upload Storage via URL signée émise par l'API.
- Toute route métier API filtre par `organizationId` et vérifie le membership.
- Tout contrat API, enum ou payload partagé va dans `packages/shared`.
- Toute évolution de schéma passe par un nouveau fichier SQL dans `supabase/migrations/`.
- Les traitements async/scheduler doivent rester idempotents et compatibles avec le verrouillage Postgres.
- Garder un chemin `SOCIAL_PUBLISH_MODE=mock` utilisable sans credentials sociaux réels.
- Les comptes `connect_only` ne doivent jamais devenir des cibles de publication automatique.
- Les rappels Telegram complètent le flux pour `connect_only`; ils ne remplacent pas la publication automatique.

## Environnement

- Utiliser un fichier racine `.env`.
- Pour `DATABASE_URL`, utiliser la chaîne **Session pooler** Supabase IPv4. La connexion directe `db.<ref>.supabase.co:5432` est IPv6-only et peut casser avec `EHOSTUNREACH`.
- Générer `TOKEN_ENCRYPTION_KEY` avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Variables backend importantes :

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `TOKEN_ENCRYPTION_KEY`
- `APP_WEB_URL`
- `SOCIAL_PUBLISH_MODE`
- `LINKEDIN_MEMBER_CLIENT_ID`
- `LINKEDIN_MEMBER_CLIENT_SECRET`
- `LINKEDIN_MEMBER_REDIRECT_URI`
- `LINKEDIN_ORG_CLIENT_ID`
- `LINKEDIN_ORG_CLIENT_SECRET`
- `LINKEDIN_ORG_REDIRECT_URI`
- `LINKEDIN_API_VERSION`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_API_VERSION`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Variables web importantes :

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Architecture Courte

Auth :

1. Le web authentifie l'utilisateur via Supabase Auth.
2. Le JWT est envoyé à Nest dans `Authorization`.
3. Nest valide le token contre Supabase.
4. L'API résout les memberships (`organization_members`) et filtre toutes les routes métier par tenant.

Entités principales :

- `users`
- `organizations`
- `organization_members`
- `social_accounts`
- `media_assets`
- `posts`
- `post_targets`
- `publish_jobs`
- `audit_logs`

Modules API principaux :

- `auth`
- `organizations`
- `social-accounts`
- `media`
- `posts`
- `calendar`
- `publishing`
- `audit`

Routes publiques principales : voir `README.md`.
