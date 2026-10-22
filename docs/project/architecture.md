# Architecture : quikform
Mise à jour : 2026-10-22

## En une phrase

Un seul processus Bun sert les formulaires de plusieurs projets ; les agents écrivent des fichiers de définition au format JSON, quikform les vérifie, les affiche avec ses propres composants et range chaque réponse dans la base SQLite du projet.

## Composants et frontières

```
répondant ──HTTPS──► Caddy ──(domaine du projet)──► quikform serve (127.0.0.1, un port)
                                                       │  lit   projects/<projet>/forms/*.json
                                                       │  écrit projects/<projet>/data.sqlite
                                                       └─► API Telegram (alerte par formulaire)

agent (Claude Code, Hermès) ──► quikform CLI ──► mêmes fichiers et même base, un projet à la fois
```

- **`quikform serve`** : le serveur web (Hono). Il choisit le projet d'après le domaine demandé, puis le formulaire d'après le chemin (`/<formulaire>`). Il rend la page en HTML côté serveur, valide l'envoi avec Zod, l'enregistre, puis alerte.
- **Script client** : il enrichit la page sans être indispensable (validation au fil de la saisie, étapes, conditions « afficher si », brouillon local). Sans JavaScript, le formulaire s'affiche sur une seule page et la validation se fait au serveur.
- **Composants de champs** : un composant par type de champ, écrit une fois et testé. C'est le seul code qui produit du HTML de formulaire.
- **`quikform` CLI** : la seule porte d'entrée des agents. Elle permet de créer et vérifier un formulaire, de le prévisualiser, de lister et d'exporter les réponses, et de créer un lien privé. Chaque commande porte sur un seul projet (`--project`).
- **Skill agent** : il explique à un agent le format des formulaires et les commandes. Il est livré avec quikform.

## Données

- **Définitions** : un fichier JSON par formulaire, dans le dossier du projet. Elles sont lisibles, versionnables avec git et validées par un schéma Zod. Ce schéma est aussi exporté en JSON Schema pour les agents et les éditeurs. Le format est en JSON, et non en TypeScript, pour qu'aucun code d'agent ne s'exécute.
- **Réponses** : dans `data.sqlite`, une base par projet. On y trouve les réponses, les liens privés et la file des alertes Telegram à renvoyer en cas d'échec. Une réponse garde la version du formulaire qui l'a produite.
- **Réglages du projet** : domaines, logo, couleur d'accent, langue par défaut, durée de conservation. Ils vivent dans `project.json`. Les secrets (jeton du bot Telegram) sont dans un fichier d'environnement à part, jamais dans une définition.
- **Données personnelles** : uniquement dans `data.sqlite`. Les réponses sont supprimées automatiquement après 12 mois (durée réglable par formulaire), par une tâche quotidienne du serveur. Supprimer le dossier d'un projet efface toutes ses données.

## Invariants

- Un agent ne publie jamais de HTML ni de script : seulement une définition, refusée si elle est invalide.
- Tout envoi est validé au serveur avec le schéma Zod tiré de la définition, quelle que soit la validation faite dans le navigateur.
- Le label d'un champ est toujours visible ; le texte d'exemple ne le remplace jamais.
- Les données d'un projet ne sont jamais écrites dans le dossier d'un autre.
- Un envoi enregistré n'est jamais perdu à cause de Telegram : l'alerte part après l'enregistrement et elle est retentée en cas d'échec.

## Environnements et déploiement

- **Local** : `bun run dev`, avec des projets d'exemple.
- **Production** : un exécutable unique (`bun build --compile`), lancé comme service systemd utilisateur, comme Inkmesh. Caddy reçoit chaque domaine de projet et le renvoie vers le port local ; le HTTPS est automatique.
- **Retour en arrière** : on relance l'exécutable précédent, que l'on garde à côté. Les définitions sont versionnées avec git.

## Sécurité

- **Surface publique** : l'affichage et l'envoi des formulaires, rien d'autre. Il n'y a pas d'interface d'administration web en v1.
- **Formulaires publics** : champ piège invisible, temps minimal de remplissage, limite d'envois par adresse IP.
- **Formulaires privés** : un jeton aléatoire par lien, stocké en base, révocable, avec une date d'expiration possible.
- **Cloisonnement entre agents** : en v1, il repose sur `--project` et sur la consigne donnée à chaque agent. Tous les agents tournent sous le même utilisateur Linux, et Jon a accepté ce risque. Une vraie séparation passerait par les droits des fichiers ou par une interface en ligne avec un jeton par projet ; c'est hors v1.
