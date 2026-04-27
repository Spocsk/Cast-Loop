# Contrats Partagés

## Source De Vérité

- Les types, enums et payloads partagés vivent dans `packages/shared/src/types.ts`.
- `packages/shared/src/index.ts` exporte l'API publique du package.
- API et web consomment `@cast-loop/shared` depuis `dist/`.

## Quand Modifier Shared

Modifier `packages/shared` quand :

- un payload API est reçu ou envoyé par le web ;
- un enum métier traverse API/web ;
- un résultat de route est consommé par plusieurs workspaces ;
- une structure doit rester synchronisée entre API et frontend.

Ne pas modifier `packages/shared` pour :

- un DTO strictement interne Nest ;
- un type d'état UI local ;
- une forme SQL intermédiaire.

## Workflow

1. Modifier `packages/shared/src/types.ts`.
2. Exporter depuis `packages/shared/src/index.ts` si nécessaire.
3. Adapter API et web.
4. Rebuild shared :

```bash
npm run build --workspace @cast-loop/shared
```

5. Lancer une vérification plus large si API/web sont touchés :

```bash
pnpm lint
```

## Pièges

- Ne pas oublier que l'API et le web lisent `dist/`.
- Ne pas créer une copie locale d'un contrat partagé côté web.
- Ne pas changer un enum partagé sans vérifier les migrations, les données existantes et les comparaisons SQL.
