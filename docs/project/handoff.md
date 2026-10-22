# Reprise : quikform
Mise à jour : 2026-10-22

## Où on en est
Cadrage terminé : `prd.md`, `architecture.md`, `decisions.md`, `PRODUCT.md`, brief visuel `design/references/refs.md` (Tally, Typeform). Plan de l'étape 1 écrit et validé par Jon : `docs/plans/2026-10-22-etape-1-questionnaire-meaw.md` (10 tâches, aucune commencée). Aucun code.

## Prochaine action
Exécuter le plan en `superpowers:subagent-driven-development` : un sous-agent par tâche, relu par un sous-agent neuf avant la tâche suivante, revue de toute la branche à la fin. Commencer par la tâche 1, sur une branche `step-1` (git initialisé, branche `master` actuelle).

## Vérifications
Aucune : pas de code. Versions relevées le 2026-10-22 : Bun 1.4.3 installé, Hono 4.13.13, Zod 4.6.7.

## État non commité
Rien. Branche `master`.

## Bloquants et actions du propriétaire
- Tâche 10 : Jon fournit le jeton du bot et le `chatId` Telegram pour l'alerte Wildcat, pose le DNS `formulaire.wildcatmuaythai.com` (A `187.77.71.11`, AAAA `2a02:4780:79:fe7e::1`), valide le rechargement de Caddy et envoie le lien à Meaw.

## Pièges connus
- `DESIGN.md` s'écrit à la fin du premier build (tâche 9), pas avant : règle impeccable.
- Le cloisonnement entre agents repose sur `--project` (même utilisateur Linux), risque accepté par Jon.
- Caddy n'écoute que sur les IP publiques (Tailscale tient le port 443 du tailnet) : voir `/etc/caddy/Caddyfile`.
