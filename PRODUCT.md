# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Bun + Hono, HTML rendu serveur, petit script client écrit à la main, Zod, `bun:sqlite`, distribué en un seul exécutable. Détail et options écartées : `docs/project/decisions.md`.

## Users

- **Répondants** : prospects, clients ou personnes invitées d'un projet (salle de Muay Thai, barbershop, commerce local). Surtout sur téléphone, sans compte, souvent une seule fois. Leur tâche : remplir et envoyer le formulaire le plus vite possible, sans erreur bloquante.
- **Opérateur et agents IA** : un développeur héberge quikform ; des agents (Claude Code, Hermès) écrivent, modifient et lisent les formulaires et les réponses en ligne de commande. Aucun humain ne construit de formulaire à la main.

Périmètre, tâches et résultats attendus : `docs/project/prd.md`.

## Product Purpose

Des formulaires sans friction, écrits par des agents IA à partir d'une phrase, hébergés par chacun sur son propre domaine, avec les réponses rangées dans une base par projet que les agents interrogent directement.

## Positioning

L'agent décrit le formulaire, quikform l'affiche. Il n'y a pas d'éditeur visuel, de compte ni de service hébergé : un seul exécutable léger (moins de 100 Mo de RAM) et des composants de champs écrits une fois. Chaque formulaire hérite ainsi du même confort et des mêmes validations.

## Operating Context

- Ouvert depuis un lien reçu par WhatsApp, Telegram, email ou un site : souvent sur téléphone, parfois avec une connexion faible.
- Une alerte Telegram part à chaque envoi ; les agents lisent ensuite les réponses dans `data.sqlite`.
- Langue fixée par formulaire. Textes d'interface en français, anglais, allemand et thaï. En français et en allemand, vouvoiement par défaut, tutoiement réglable par formulaire.

## Capabilities and Constraints

- Un formulaire court tient sur une page ; un long se découpe en étapes thématiques avec une barre de progression.
- Le formulaire fonctionne sans JavaScript ; le script ajoute la validation en direct, les étapes, les conditions et le brouillon local.
- Marque blanche : logo et couleur d'accent par projet, aucune mention « propulsé par », aucun traceur ni bannière de cookies.
- Pas de fichiers joints ni de paiement en v1.
- Données personnelles : mention de confidentialité par formulaire, suppression automatique après 12 mois par défaut.

## Brand Commitments

- Neutre par principe : l'interface doit se fondre dans la marque de n'importe quel projet, d'une salle de sport à une boulangerie. Le style de quikform ne doit jamais prendre le dessus sur la marque qui l'utilise.
- Références visuelles imposées par Jon : Tally et Typeform (`design/references/refs.md`).
- Le label d'un champ est toujours visible ; le texte d'exemple ne le remplace jamais.

## Evidence on Hand

Aucun formulaire en production. Premier usage réel prévu : le questionnaire tarifs et services pour Wildcat Muay Thai. Aucun chiffre d'usage ni témoignage n'existe : n'en inventer aucun.

## Product Principles

1. Zéro friction pour le répondant : chaque champ, chaque message d'erreur et chaque étape justifie sa présence.
2. Le serveur a toujours le dernier mot : tout envoi est validé au serveur, et rien n'est perdu.
3. Les agents décrivent, ils n'écrivent jamais de code d'interface.
4. La légèreté est une fonctionnalité : un exécutable, un fichier par formulaire, une base par projet.

## Accessibility & Inclusion

WCAG 2.2 AA. Champs utilisables entièrement au clavier et au lecteur d'écran, erreurs annoncées et reliées à leur champ, cibles tactiles d'au moins 44 px, respect de `prefers-reduced-motion`. Les écritures non latines (thaï, chinois) s'affichent correctement.
