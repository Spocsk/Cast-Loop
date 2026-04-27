# Mémoire Agent Cast Loop

Cette mémoire réduit la redécouverte du projet entre conversations. Elle ne remplace pas le code : si une information contredit l'implémentation actuelle, le code gagne et la fiche doit être corrigée.

## Lecture Par Tâche

| Tâche                                               | Fiche à lire          |
| --------------------------------------------------- | --------------------- |
| Route, service, DTO, guard ou test API              | `api.md`              |
| UI Next.js, appels API, upload ou état dashboard    | `web.md`              |
| Type partagé, enum, payload API                     | `shared-contracts.md` |
| Scheduler, publication, Telegram, mock/live         | `publishing.md`       |
| OAuth LinkedIn/Meta, variants, sélection de comptes | `social-auth.md`      |
| Décision durable à enregistrer                      | `decisions.md`        |

## Points D'entrée Code

- API : `apps/api/src/app.module.ts`, puis `apps/api/src/modules/<module>/`
- Web : `apps/web/src/app/page.tsx` et `apps/web/src/lib/api.ts`
- Shared : `packages/shared/src/types.ts`
- Migrations : `supabase/migrations/`
- Config env API : `apps/api/src/config/env.ts`

## Vérification Recommandée

- Changement API ciblé : test Jest du module concerné si disponible, puis `pnpm lint`.
- Changement shared : `npm run build --workspace @cast-loop/shared`, puis vérification API/web impactée.
- Changement web : `pnpm lint`; pas de runner front configuré en v1.
- Changement publishing/social auth : test ciblé si existant, sinon `pnpm test` ou `pnpm lint` selon le risque.
- Documentation seule : `pnpm format:check` si le changement touche des fichiers couverts par Prettier.

## Politique De Mise À Jour

Mettre à jour cette mémoire seulement si :

- une convention durable change ;
- un piège a causé une erreur réelle ;
- un workflow répétitif devient clair ;
- une décision architecture produit/API est prise.

Ne pas ajouter :

- des résumés de tâches ponctuelles ;
- des détails évidents dans le code ;
- des préférences vagues ;
- des informations susceptibles de changer souvent sans source claire.

## Skills Repo

Les skills sont versionnés sous `.codex/skills/`. S'ils ne sont pas auto-découverts par un environnement Codex donné, les ouvrir manuellement depuis `AGENTS.md`.
