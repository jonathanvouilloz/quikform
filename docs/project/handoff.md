# Reprise : quikform
Mise à jour : 2026-10-22

## Où on en est
Étape 1, plan `docs/plans/2026-10-22-etape-1-questionnaire-meaw.md` : tâches 1 à 10 faites sur la branche `step-1` (non fusionnée), chacune relue par un sous-agent neuf. Le questionnaire de Meaw est en ligne. Reste : Jon envoie le lien à Meaw.

## Prochaine action
Jon envoie https://formulaire.wildcatmuaythai.com/meaw-pricing à Meaw. Puis fusionner `step-1` dans `master` (accord de Jon) ; ensuite, lire ses réponses (`quikform responses --project wildcat`) pour la base de connaissances de l'assistant Wildcat.

## Vérifications
- `bun test` : 102 ok, 0 échec (relancé à la fin de session).
- `bunx tsc --noEmit` : aucune erreur.
- `bun run e2e` (Playwright 1.55.0, téléphone 390×844) : 3 ok, lancé par le dernier sous-agent, pas relancé ensuite.
- Exécutable compilé `dist/quikform serve` avec `examples/demo` : 36 à 47 Mo de RAM (limite 100 Mo).
- `dist/app.js` : 13 Ko compressé (limite 25 Ko).
- Non vérifié : rendu sur un vrai téléphone, formulaire avec logo, à une seule étape ou en thaï.

## État non commité
Rien. Branche `step-1`.

## Bloquants et actions du propriétaire
- Envoyer le lien à Meaw ; dire si on fusionne `step-1` dans `master`.
- Logo Wildcat : celui du site ou un fichier de Jon (option A : copier le fichier dans le dossier du projet, puis `brand.logo` dans `project.json`).
- Question 13 : garder ou retirer le champ facultatif sur le certificat.

## En production
- Service utilisateur `quikform` (systemd, `~/.config/systemd/user/quikform.service`), binaire `~/.local/bin/quikform`, données `~/.local/share/quikform/projects/wildcat/` (jeton dans `.env`, 600), secret `~/.config/quikform/env` (600).
- Caddy : bloc `formulaire.wildcatmuaythai.com` ajouté (sauvegarde `/etc/caddy/Caddyfile.bak-quikform`). DNS A et AAAA chez Infomaniak.
- Vérifié le 2026-10-22 : HTTPS 200 sur `/meaw-pricing` ; envoi de test → une ligne en base et alerte marquée envoyée vers « Wildcat Team » ; réponse de test supprimée (base vide) ; 35 Mo de RAM.
- Mettre à jour : `bun run build`, `install -m 755 dist/quikform ~/.local/bin/quikform`, `systemctl --user restart quikform`.

## Reprises mineures (revues, non bloquantes)
- Validation : pas de contrôle min ≤ max ni du type de `showIf.equals` ; quelques règles du schéma sans test.
- Accessibilité et finition : état coché des pastilles seulement via `:has()` ; `aria-describedby` sur le `fieldset` ; « Retour » à droite de « Suivant » sur téléphone ; titre d'étape et label trop proches en taille ; raccourcis A, B, C non expliqués ; page de remerciement nue ; `scroll-padding-bottom` sans la zone sûre de l'iPhone.
- Client : bouton bloqué si le navigateur restaure la page depuis son cache (`pageshow`) ; pas de test bout en bout du chemin d'erreur 422 ni de « Retour ».
- Serveur : un domaine déclaré par deux projets va au premier sans avertissement ; une alerte perdue si `queueAlert` échoue après l'enregistrement.
- Tests : quelques remplacements de `console.error` sans `try/finally` ; tests de l'outbox sensibles au temps.

## Pièges connus
- Reportés, faible impact : limite d'envois non groupée par préfixe IPv6 ; la route du logo suit les liens symboliques ; un logo ajouté après `project.json` n'est vu qu'au prochain changement de `project.json`.
- Le champ piège s'appelle `website` : cet identifiant de champ est réservé, comme `constructor` et les autres noms hérités.
- `X-Forwarded-For` : la dernière entrée est l'IP du client seulement s'il n'y a qu'un proxy (Caddy) devant.
- Modifier un fichier de formulaire sur place n'est pas vu par `serve` : passer par `quikform form put`.
- Le cloisonnement entre agents repose sur `--project` (même utilisateur Linux), risque accepté par Jon.
- Caddy n'écoute que sur les IP publiques (Tailscale tient le port 443 du tailnet) : voir `/etc/caddy/Caddyfile`.
