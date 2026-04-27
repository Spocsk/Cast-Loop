# Web Next.js

## Conventions

- App Router sous `apps/web/src/app/`.
- Client API centralisé dans `apps/web/src/lib/api.ts`.
- Variables publiques validées dans `apps/web/src/lib/env.ts`.
- UI et textes produit en français.
- CSS custom dans `apps/web/src/app/globals.css`.

## Frontière Supabase

- Le web utilise Supabase pour Auth et session JWT.
- Le web ne lit jamais les tables applicatives Supabase directement.
- Les uploads passent par URL signée demandée à l'API (`POST /media/upload-url`), puis upload Storage côté client.
- Les données métier viennent de l'API Nest avec `Authorization: Bearer <token>`.

## Ajout D'une Fonction Web

- Ajouter ou réutiliser une fonction dans `apps/web/src/lib/api.ts`.
- Utiliser les types de `@cast-loop/shared` pour les payloads et résultats partagés.
- Garder les erreurs API centralisées via `apiRequest`.
- Préserver le filtrage par organisation active dans les appels métier.

## Vérification

- Pas de runner de tests front configuré en v1.
- Lancer au minimum :

```bash
pnpm lint
```

- Pour un changement visuel important, lancer le front et vérifier dans le navigateur :

```bash
pnpm dev:web
```

## Pièges

- Ne pas importer le client Supabase pour lire des tables métier.
- Ne pas dupliquer des types API côté web si `packages/shared` doit les porter.
- Ne pas envoyer une requête métier sans JWT ni organisation active quand l'API l'exige.
