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

## 2026-10-22 — Exécution du plan par sous-agents, relecture à chaque tâche
Choix de Jon : `superpowers:subagent-driven-development`, une tâche par sous-agent, relue par un autre sous-agent avant la suivante, code propre de bout en bout. Écarté : exécution directe dans une seule session (moins chère, mais sans relecture indépendante avant la fin).
À rouvrir si : le coût par tâche devient disproportionné pour des tâches triviales.

## 2026-10-22 — Arbitrages pendant l'exécution de l'étape 1
Pris pendant l'exécution par sous-agents, sans Jon ; à relire.
- Couleur de marque servie par `/_qf/brand.css`, pas en style en ligne : la politique de sécurité du contenu (CSP) reste `default-src 'self'` sans exception. Écarté : nonce ou `unsafe-inline`.
- Durée de conservation par projet (`retentionMonths` dans `project.json`), alors que l'architecture la dit « par formulaire ». À rouvrir si un projet a besoin de deux durées.
- `serve` recharge un projet quand `forms/`, `project.json` ou `.env` changent (contrôle toutes les 10 s) : un agent publie sans redémarrer le serveur.
- Mention de confidentialité placée avant le bouton d'envoi (le plan disait « sous ») : lue avant d'envoyer et visible au-dessus de la barre collée en bas sur téléphone.
- Le navigateur retient un envoi fait moins de 3 s après le chargement, et le brouillon ne s'efface que sur la page de remerciement : aucune réponse perdue en silence. La limite de 3 s du serveur reste inchangée.
- Alertes Telegram : une seule vidange de la file à la fois par base, pour ne jamais envoyer une alerte en double. Une alerte peut attendre jusqu'à 30 s.

## 2026-10-22 — Accords de Jon pour la tâche 10
Jon autorise le rechargement de Caddy pour ajouter `formulaire.wildcatmuaythai.com` (`caddy validate` d'abord). Licence MIT, copyright « quikform contributors ».
Logo : option A, le fichier du logo est copié dans le dossier du projet et servi par quikform (remplace `brand.logoUrl` externe), pour tenir « aucune ressource externe ». Polices système : proposées, en attente de confirmation.
Telegram : alerte vers le groupe « Wildcat Team » (chatId `-5438163454`, bot `@wildcatmuay_bot`) ; Jon autorise une alerte de test à la tâche 10. DNS : posé par Jon.

## 2026-10-22 — Police : Plus Jakarta Sans, hébergée par quikform
Choix de Jon parmi Geist, Inter et Plus Jakarta Sans : une police par défaut nette et lisible. Le fichier est servi par quikform lui-même (aucune ressource externe), avec repli sur la police système, en particulier pour le thaï, que la police ne couvre pas. Écartées : les polices système seules, Geist, Inter.

## 2026-10-23 — Logo et page de présentation
Logo : piste « Radio q » choisie par Jon parmi trois (kit dans `design/logo/`). Il n'apparaît jamais sur les formulaires, qui restent en marque blanche (confirmé par Jon).
Page de présentation : HTML et CSS statiques dans `site/` (anglais à la racine, français dans `site/fr/`), publiés par GitHub Pages ; aucun outil de génération de site. Références validées par Jon : `design/references/landing/refs.md`. Écarté : la servir depuis le VPS via Caddy (un DNS et une configuration de plus).
