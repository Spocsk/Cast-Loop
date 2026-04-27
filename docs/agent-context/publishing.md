# Publication Et Scheduler

## Flux

- Le scheduler Nest tourne chaque minute dans `PublishingService.handleScheduledPosts`.
- `PostsService.claimDuePosts(limit)` sélectionne les posts `scheduled` dus et les verrouille côté Postgres.
- `PublishingService.publishPost(postId)` récupère le payload de publication, télécharge le média si nécessaire, puis traite les cibles.
- `PostsService.recordPublishResult` persiste les résultats, les `publish_jobs`, les statuts de cibles et l'état final du post.

## États

Posts :

- `draft`
- `scheduled`
- `publishing`
- `published`
- `failed`
- `cancelled`

Cibles :

- `pending`
- `published`
- `notified`
- `failed`
- `cancelled`

## Capacités Sociales

- `publishable` : cible publiable automatiquement.
- `connect_only` : visible dans l'app, mais jamais publié automatiquement.
- Les cibles `connect_only` peuvent recevoir un rappel Telegram si `send_telegram_reminder=true`.
- Un rappel Telegram ne doit pas être traité comme une publication provider.

## Mock Et Live

- `SOCIAL_PUBLISH_MODE=mock` doit rester utilisable sans credentials sociaux réels.
- En mode mock, la publication retourne un résultat simulé.
- En mode live, LinkedIn est implémenté ; les autres providers doivent échouer explicitement si non supportés.

## Règles D'implémentation

- Préserver l'idempotence : une cible non `pending` ne doit pas être republiée.
- Ne pas publier automatiquement une cible `connect_only`.
- En cas d'échec média avant publication, marquer les cibles `pending` concernées en échec.
- Garder les résultats de publication auditables dans `publish_jobs` et `audit_logs` selon les patterns existants.

## Vérification

- Lancer les tests API existants si le changement touche `PostsService` ou `PublishingService`.
- Sinon lancer au minimum :

```bash
pnpm lint
```
