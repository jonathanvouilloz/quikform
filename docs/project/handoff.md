# Reprise : quikform
Mise à jour : 2026-10-22

## Où on en est
Étape 1, plan `docs/plans/2026-10-22-etape-1-questionnaire-meaw.md` : tâches 1 à 9 faites sur la branche `step-1` (non fusionnée), chacune relue par un sous-agent neuf, puis revue finale de toute la branche et une vague de corrections relue. Reste la tâche 10 (questionnaire de Meaw et mise en ligne).

## Prochaine action
Tâche 10, sur `step-1`, quand Jon a fourni le jeton du bot et le `chatId` Telegram. En écrivant `deploy/quikform.service`, traiter d'abord les trois points reportés ci-dessous (Pièges connus).

## Vérifications
- `bun test` : 97 ok, 0 échec (relancé à la fin de session).
- `bunx tsc --noEmit` : aucune erreur.
- `bun run e2e` (Playwright 1.55.0, téléphone 390×844) : 3 ok, lancé par le dernier sous-agent, pas relancé ensuite.
- Exécutable compilé `dist/quikform serve` avec `examples/demo` : 36 à 47 Mo de RAM (limite 100 Mo).
- `dist/app.js` : 13 Ko compressé (limite 25 Ko).
- Non vérifié : vrai envoi Telegram, rendu sur un vrai téléphone, formulaire avec logo ou à une seule étape.

## État non commité
Rien hors ce handoff et les cases du plan (commit `docs:` de fin de session). Branche `step-1`.

## Bloquants et actions du propriétaire
- Tâche 10 : jeton du bot et `chatId` Telegram ; DNS `formulaire.wildcatmuaythai.com` (A `187.77.71.11`, AAAA `2a02:4780:79:fe7e::1`) ; accord pour recharger Caddy ; envoi du lien à Meaw.
- Licence : pas de fichier `LICENSE` alors que README et `package.json` disent MIT. Quelle ligne de copyright ?
- Logo : le plan interdit toute ressource externe, mais `brand.logoUrl` peut pointer vers une URL https externe. Servir le logo depuis le dossier du projet, ou accepter l'exception ?
- Polices système consignées dans `DESIGN.md` (choix du plan validé) : à confirmer.
- Fusion de `step-1` dans `master` : après la tâche 10.

## En production
Rien.

## Pièges connus
- À faire avec la tâche 10 : poser les gestionnaires SIGTERM/SIGINT avant la ligne « listening » (`src/cli/main.ts`, sinon sortie 143 au démarrage) ; mettre `busy_timeout` avant le pragma WAL (`src/store/db.ts`) ; `UMask=0077` dans le service (données personnelles dans `data.sqlite` et `.env`).
- Reportés, faible impact : un projet ajouté pendant que `serve` tourne n'affiche pas ses erreurs de chargement ; l'échec de purge d'un projet saute les suivants ce jour-là ; limite d'envois non groupée par préfixe IPv6.
- Le champ piège s'appelle `website` : cet identifiant de champ est réservé, comme `constructor` et les autres noms hérités.
- `X-Forwarded-For` : la dernière entrée est l'IP du client seulement s'il n'y a qu'un proxy (Caddy) devant.
- Modifier un fichier de formulaire sur place n'est pas vu par `serve` : passer par `quikform form put`.
- Le cloisonnement entre agents repose sur `--project` (même utilisateur Linux), risque accepté par Jon.
- Caddy n'écoute que sur les IP publiques (Tailscale tient le port 443 du tailnet) : voir `/etc/caddy/Caddyfile`.
