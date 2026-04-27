# Social Auth

## Variants Supportés

- `linkedin_personal` : profil membre LinkedIn, `publishable`.
- `linkedin_page` : page LinkedIn, `publishable`.
- `facebook_page` : page Facebook, `publishable`.
- `instagram_professional` : compte Instagram pro, `publishable`.
- `meta_personal` : profil Facebook informatif, `connect_only`.

## Backend

- Entrée principale : `SocialAccountsService`.
- Callbacks OAuth :
  - `/social-auth/linkedin/callback`
  - `/social-auth/meta/callback`
- Disponibilités exposées par provider + variant via `listProviderAvailability`.
- Les tokens sont chiffrés avec `TokenCipherService`.
- Les connexions sont upsertées par provider, organisation et identifiant externe.

## Sélection OAuth

- Si le provider remonte plusieurs comptes/pages éligibles, le callback retourne `selection_required`.
- Le web récupère les options avec `pending-selection`.
- Le web finalise avec `pending-selection/complete`.
- Les tokens de sélection sont temporaires et doivent rester liés à `organizationId` et `userId`.

## Règles Produit

- Une app LinkedIn Developer associée à une page ne force pas toutes les publications vers cette page.
- `linkedin_personal` cible le profil membre.
- `linkedin_page` cible une page LinkedIn connectée.
- Un compte `connect_only` reste visible mais non publiable automatiquement.

## Vérification

- Pour LinkedIn, lancer le test ciblé si la logique OAuth change :

```bash
npm run test --workspace @cast-loop/api -- linkedin-oauth.service.spec.ts
```

- Pour tout changement transversal :

```bash
pnpm lint
```
