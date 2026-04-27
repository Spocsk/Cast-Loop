# API Nest

## Conventions

- API sous préfixe global `/api/v1`.
- `ValidationPipe` global avec `whitelist`, `forbidNonWhitelisted`, `transform`.
- Modules métier sous `apps/api/src/modules/`.
- Accès Postgres via `DatabaseService`; accès Supabase admin via `SupabaseAdminService`.
- Les DTO restent dans `apps/api/src/modules/<module>/dto/`.
- Les contrats partagés avec le web vont dans `packages/shared`, pas dans un type local du web.

## Tenant-Safety

- Toute route métier doit identifier une organisation par `organizationId` dans le body, la query ou le path.
- Le service doit appeler `OrganizationsService.assertMembership(organizationId, userId)` avant toute lecture ou mutation métier.
- Les requêtes SQL doivent filtrer par `organization_id` ou par une jointure qui garantit le tenant.
- Pour une ressource enfant, vérifier à la fois l'id ressource et l'organisation.

## Pattern De Route

- Le controller récupère l'utilisateur via les decorators/guards existants.
- Le controller reste mince : validation DTO + délégation service.
- Le service porte la logique métier, les transactions et l'audit.
- Les mutations significatives journalisent via `AuditService` quand le module le fait déjà.

## Tests

- Jest côté API uniquement.
- Préférer un test ciblé :

```bash
npm run test --workspace @cast-loop/api -- path/to/file.spec.ts
```

- Si le changement touche plusieurs modules ou un flux partagé, lancer :

```bash
pnpm test
pnpm lint
```

## Pièges

- Ne pas contourner `OrganizationsService.assertMembership`.
- Ne pas exposer de route métier sans `organizationId`.
- Ne pas ajouter de contrat API uniquement côté web si l'API le renvoie.
- Ne pas modifier le schéma sans nouvelle migration SQL.
