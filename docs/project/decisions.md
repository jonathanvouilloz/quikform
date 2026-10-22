# Décisions

Journal en ajout seul, 3 à 5 lignes par décision.

## 2026-10-22 — Stack : Bun + Hono + SQLite intégré + Zod, un seul exécutable
Choix : Bun, Hono, `bun:sqlite`, Zod 4 (version allégée côté navigateur), HTML rendu par le serveur et un petit script client écrit à la main ; distribution par `bun build --compile`.
Écartés : SvelteKit sur Node (plus de RAM et de pièces que nécessaire), Go (pas de Zod, deux langages), Cloudflare Workers + D1 (la base n'est plus un fichier lisible par l'agent).
Critère : l'efficacité pour le besoin, pas la familiarité (consigne de Jon).
À rouvrir si : Bun pose un problème de stabilité en production, ou si l'affichage dynamique dépasse ce qu'un script écrit à la main tient proprement.

## 2026-10-22 — Base : un fichier SQLite par projet
SQL est le langage que tous les agents savent interroger ; un fichier par projet se sauvegarde et s'efface d'un geste. LMDB, RocksDB (clé-valeur sans SQL) et DuckDB (analytique) sont écartés : le volume est de quelques réponses par semaine.

## 2026-10-22 — Les agents décrivent, les composants affichent
Une bibliothèque de composants de champs est écrite une fois, testée et accessible. Un agent n'écrit jamais de HTML ni de script : il écrit un fichier de définition (types de champs, textes, règles), que quikform vérifie puis affiche avec ces composants.
Pourquoi : le même confort et la même validation sur tous les formulaires, et aucun code arbitraire publié par un agent.

## 2026-10-22 — Formulaires longs : une étape = un groupe de questions liées
Choix de Jon : des étapes thématiques (« Vos coordonnées », « Votre séjour ») avec une barre de progression, plutôt qu'une question par écran façon Typeform, trop lente pour un formulaire de 15 questions ou plus. Brief visuel validé : `design/references/refs.md`.
