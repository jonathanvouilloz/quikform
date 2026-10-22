# PRD : quikform
Mise à jour : 2026-10-22

## Problème

Récolter des réponses structurées est pénible : aujourd'hui, les réponses arrivent sur WhatsApp et sont recopiées à la main pour l'agent. Les outils de formulaires auto-hébergés existants (Formbricks, OpnForm, HeyForm) demandent 2 à 4 Go de RAM, plusieurs bases et un éditeur visuel, parce qu'ils sont construits comme des services en ligne. Ici, c'est l'agent qui écrit les formulaires : on n'a besoin que de l'affichage, de la validation et du stockage.

## Utilisateurs

- **L'opérateur** (un développeur qui héberge quikform) et **son agent IA** (Claude Code, Hermès) : l'agent crée les formulaires à partir d'une phrase et lit les réponses. Sur un serveur, en ligne de commande.
- **Les répondants** : prospects ou clients (formulaires publics) et personnes invitées (lien privé). Surtout sur téléphone, souvent une seule fois, sans compte.

Vocabulaire : projet, formulaire, champ, étape, réponse.

## Tâches principales

1. **Remplir et envoyer un formulaire** : répondant, à chaque usage, téléphone d'abord. Chemin le plus court. Survit à un rechargement ou un onglet fermé : oui (brouillon gardé dans le navigateur jusqu'à l'envoi).
2. **Créer ou modifier un formulaire à partir d'une phrase** : n'importe quel agent IA autorisé sur le projet (Claude Code, Hermès…), chaque semaine. « Fais-moi un formulaire pour le projet X avec ça, ça et ça » donne un formulaire en ligne, vérifié, sans autre intervention humaine. Personne ne construit de formulaire à la main.
3. **Être prévenu d'une réponse** : opérateur, à chaque envoi, par un message Telegram choisi par formulaire.
4. **Lire les réponses d'un projet** : agent ou opérateur, chaque semaine, directement dans la base du projet ou par la ligne de commande.
5. **Ajouter un projet et son domaine** : opérateur, rare.
6. **Installer quikform** : opérateur, une fois.

## Résultat attendu

- Une phrase suffit pour qu'un formulaire soit en ligne en moins de 5 minutes.
- Un répondant sur téléphone remplit un formulaire de 10 champs sans erreur bloquante ni retour en arrière forcé.
- Le service tourne avec moins de 100 Mo de RAM, sans Docker ni serveur de base de données.
- Une installation par un développeur prend moins de 15 minutes, en suivant le README.
- Premier usage réel : le questionnaire tarifs et services de Meaw (Wildcat).

## Périmètre

Par ordre de priorité :

1. **Un fichier par formulaire**, dont le format est lui-même validé : champs, textes, étapes, réglages.
2. **Les types de champs de Tally** : texte court, texte long, email, téléphone, nombre, date, choix unique, choix multiple, liste déroulante, oui ou non, échelle ou note, lien, case de consentement. Pour chacun : obligatoire ou non, limites, format attendu, texte d'aide. Logique simple « afficher si ».
3. **Validation Zod**, le même schéma dans le navigateur et sur le serveur, avec des messages d'erreur clairs à côté du champ concerné.
4. **Affichage** : une page pour un formulaire court, des étapes avec barre de progression pour un long. Label toujours visible, jamais remplacé par le texte grisé du champ. Clavier adapté au type de champ sur téléphone. Accessible (WCAG AA).
5. **Marque blanche** : thème clair, neutre et minimaliste ; le logo et une couleur d'accent par projet ; aucune mention « propulsé par ».
6. **Une base SQLite par projet.** Un agent autorisé sur un projet y crée, modifie et lit les formulaires et les réponses, sans accès aux autres projets.
7. **Liens publics et liens privés** (avec jeton). Anti-spam sur les formulaires publics : champ piège invisible et limite d'envois.
8. **Alerte Telegram** à chaque envoi, vers le groupe ou le sujet choisi pour chaque formulaire.
9. **Kit pour les agents** : une ligne de commande (créer, vérifier, prévisualiser, lister et exporter les réponses) et un skill qui explique à un agent comment s'en servir.
10. **Plusieurs domaines** : chaque projet sur son propre domaine (`formulaire.<domaine>`), derrière le serveur web existant.
11. **Textes de l'interface** en français, anglais, allemand et thaï ; la langue est fixée par formulaire.
12. **Open source sous licence MIT** : README d'installation, exemple de formulaire.

## Hors périmètre

- Service hébergé par nous (pas de SaaS) : chacun héberge sur son domaine.
- Éditeur visuel, comptes et équipes, statistiques.
- Paiements, fichiers joints, envoi d'emails (v1).

## Contraintes

- Serveur partagé : 8 Go de RAM, 2 processeurs, 19 Go de disque libres. Le serveur web Caddy est déjà en place et gère le HTTPS.
- Données personnelles (nLPD, RGPD) : une mention de confidentialité par formulaire, seulement les champs nécessaires ; réponses supprimées automatiquement après 12 mois par défaut, durée modifiable par formulaire.
- Le format d'un formulaire doit rester stable : changer la bibliothèque d'affichage ne doit pas obliger à réécrire les formulaires.

## Questions ouvertes

Aucune à ce stade.
