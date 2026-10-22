# quikform : instructions

## Lire avant de travailler
1. `docs/project/handoff.md` (état courant).
2. Selon la tâche : `docs/project/prd.md`, `docs/project/architecture.md`, `PRODUCT.md`, `DESIGN.md` (écrit à la fin du premier build), plan en cours dans `docs/plans/`.

La conversation et les décisions récentes du propriétaire priment sur les documents.

## Objectif
Des formulaires sans friction, écrits par des agents IA à partir d'une phrase, auto-hébergés sur le domaine de chaque projet, réponses dans une base SQLite par projet. Open source, licence MIT. Un seul exécutable, moins de 100 Mo de RAM.

## Stack et commandes
Bun + Hono, HTML rendu serveur, script client écrit à la main, Zod 4, `bun:sqlite`, `bun build --compile` (voir `docs/project/decisions.md`).
Commandes : `bun test` (construit d'abord `dist/app.js`, compile aussi le binaire une fois), `bunx tsc --noEmit` (après un premier build), `bun run build` (client puis exécutable `dist/quikform`), `bun run build:client`, `bun run e2e` (Playwright, téléphone 390×844).
CLI (`QUIKFORM_HOME` requis, `QUIKFORM_SECRET` de 32 caractères au moins pour `serve`) : `quikform serve [--port 8787]`, `check <fichier>`, `form put --project <slug> <fichier>`, `responses --project <slug> [--form <id>] [--limit 50] [--json]`, `project init <slug> --domain <hôte>`. `serve` écoute sur 127.0.0.1 seulement, recharge les projets toutes les 10 s et purge selon `retentionMonths` toutes les 24 h.

## Conventions
- Code, noms, messages de commit et README en anglais (projet open source). Documents de cadrage en français.
- Un agent ne produit jamais de HTML ni de script pour un formulaire : il écrit une définition JSON, validée par le schéma (`quikform` CLI).
- Tout envoi est validé au serveur ; le label d'un champ est toujours visible.

Specs dans `docs/project/`, plans dans `docs/plans/` (un par étape). Jamais `docs/superpowers/` : les skills superpowers (brainstorming, writing-plans) écrivent leurs specs et plans à ces deux emplacements.

## Interdits et garde-fous
- Demandent l'accord de Jon : DNS, configuration Caddy, mise en production, publication du dépôt ou du paquet, envoi réel vers un groupe Telegram client, suppression de réponses.
- Secrets (jetons de bot Telegram) : fichiers d'environnement par projet, hors git, jamais dans une définition de formulaire.
- Ne jamais abaisser la barre pour passer au vert. Dans le diff, ces cinq gestes demandent l'accord du propriétaire : un seuil baissé ou un contrôle retiré ; un test désactivé, supprimé ou vidé de ses assertions ; un `ignore` ou `disable` ajouté (linter, typage, couverture, scanner de sécurité) ; un travail inachevé déguisé (stub, `catch` vide, `TODO` à la place du code) ; une exception ajoutée à une règle.
- Resserrer en silence, relâcher à voix haute : durcir un contrôle ne demande rien ; l'assouplir s'annonce, avec la raison.
- Ne jamais écraser un plan qui a encore des cases ouvertes : même travail, le mettre à jour ; autre travail, s'arrêter et demander.

## Cycle
`resume-project` → travail → vérifications → `wrap-session`.

- Choix de stack ou nouvelle surface : `choose-stack`, décision dans `decisions.md`.
- Design : `design-references` (références dans `design/references/refs.md`, puis contrôle du rendu), puis `/impeccable`, qui tient `DESIGN.md`. Direction épinglée par le brief (Tally, Typeform) : pas de tirage de direction. Animations : CSS seulement.
- Revue d'interface : `review-ui`. Revue de code : `/code-review` ; `ponytail-review` à la place avant de fusionner une branche importante ; sécurité (entrée publique, données personnelles) : `security-and-hardening` et `/security-review`.
