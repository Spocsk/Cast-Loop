# Cast Loop v1

## Resume
Construire une v1 agence multi-tenant pour gerer des comptes sociaux de plusieurs entreprises, avec usage personnel inclus dans le meme produit.

Stack verrouillee:
- Frontend `Next.js App Router` en React/TypeScript
- Backend `NestJS` en API REST separee
- `Supabase` pour Postgres, Auth et Storage
- Deploiement cible: frontend sur `Vercel`, backend Node sur un service separe
- Perimetre v1: Facebook Pages, Instagram Business, LinkedIn Pages; posts `texte + image`; brouillons, calendrier, programmation et publication automatique

## Ordre d'execution
1. Creer un fichier markdown de cadrage, par defaut `docs/PLAN.md`, qui reprend ce plan valide.
2. Initialiser le monorepo `pnpm` avec `apps/web`, `apps/api` et `packages/shared`.
3. Scaffold du frontend `Next.js` et du backend `NestJS`, puis configuration commune TypeScript, lint et variables d'environnement.
4. Mettre en place `Supabase` pour Postgres, Auth et Storage.
5. Implementer le socle metier multi-tenant, puis les connexions sociales, puis la programmation/publication.
6. Ajouter les tests critiques et la documentation de demarrage.

## Changements d'implementation
- Structure du repo:
  - Monorepo `pnpm`
  - `apps/web` pour le frontend
  - `apps/api` pour le backend
  - `packages/shared` pour les types, DTOs et contrats communs
  - `docs/PLAN.md` comme reference produit/architecture
- Frontend:
  - Dashboard authentifie avec App Router, layout prive, pages `Calendrier`, `Posts`, `Medias`, `Entreprises`, `Comptes sociaux`, `Parametres`
  - Auth via `Supabase Auth` cote web; la session JWT est envoyee au backend Nest, qui la valide contre Supabase
  - UI orientee agence avec selecteur d'entreprise actif et vues filtrees par tenant
- Backend:
  - Modules `auth`, `organizations`, `members`, `social-accounts`, `media`, `posts`, `publishing`, `audit`
  - API REST versionnee `/api/v1`
  - Le backend reste la seule couche metier; le frontend ne lit pas directement les tables applicatives Supabase
  - Scheduler Nest execute chaque minute pour recuperer les posts `scheduled`, verrouiller les lignes a traiter, publier, puis journaliser `success` ou `failed`
- Donnees et multi-tenant:
  - Entites minimales: `users`, `organizations`, `organization_members`, `social_accounts`, `media_assets`, `posts`, `post_targets`, `publish_jobs`, `audit_logs`
  - Un utilisateur peut appartenir a plusieurs entreprises
  - Roles v1: `owner`, `manager`, `editor`
  - Un post appartient a une entreprise et peut cibler un ou plusieurs comptes sociaux de cette entreprise
- Reseaux sociaux:
  - Connexion OAuth geree par le backend pour Meta et LinkedIn
  - Support v1 limite aux comptes professionnels/pages
  - Stockage des access tokens chiffre en base, avec expiration et statut de connexion
  - Publication v1: texte, image principale, date/heure planifiee, adaptation legere des contraintes par reseau
- Media:
  - Upload des images dans `Supabase Storage`
  - Le backend emet des URLs signees d'upload et reference ensuite l'asset dans `media_assets`
  - Validation v1 sur type MIME, taille max, dimensions minimales
- Etats fonctionnels du post:
  - `draft`, `scheduled`, `publishing`, `published`, `failed`, `cancelled`
  - Historique de publication par cible reseau dans `publish_jobs`

## Interfaces publiques a prevoir
- `POST /auth/session/validate`
- `GET|POST /organizations`
- `GET|POST /organizations/:id/social-accounts`
- `POST /media/upload-url`
- `GET|POST /posts`
- `POST /posts/:id/schedule`
- `POST /posts/:id/publish-now`
- `POST /posts/:id/cancel`
- `GET /calendar?organizationId=...&from=...&to=...`

## Cas de test
- Authentification: connexion Supabase, validation JWT cote Nest, refus d'acces hors tenant
- Multi-tenant: un membre d'une entreprise ne voit ni posts ni comptes sociaux d'une autre entreprise
- Reseaux: connexion OAuth reussie, token expire detecte, compte deconnecte bloquant la programmation
- Posts:
  - creation d'un brouillon texte+image
  - programmation future sur un seul compte
  - programmation multi-cibles sur plusieurs comptes de la meme entreprise
  - annulation avant execution
- Scheduler:
  - un post planifie passe en `publishing`, puis `published`
  - un echec API reseau cree un `publish_job failed` et remonte l'erreur UI
  - deux workers ne publient pas le meme post en double
- Media: upload image valide, rejet format/taille invalide
- E2E principal: creation entreprise -> invitation membre -> connexion compte social -> creation post -> programmation -> execution -> historique visible

## Hypotheses et choix par defaut
- Pas d'analytics, pas d'inbox/commentaires, pas de workflow d'approbation en v1
- Pas de video, pas de carousel, pas de comptes personnels
- Pas de facturation SaaS autonome en v1; onboarding gere par l'admin principal
- Scheduler base sur Postgres + verrouillage applicatif, sans Redis/BullMQ en v1
- Permissions limitees a `owner/manager/editor`
- Langue initiale de l'interface: francais
