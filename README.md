# Paris MotoGP

Site de pronostics MotoGP entre amis : sprint, course, pari chute, classement, historique et notifications.

**Site** : https://lucieppx.github.io/MotoGPpronostic/

## Fonctionnalités

- Inscription et connexion par email (un pseudo réservé à chaque compte).
- Pronostics du podium et du pari chute, pour le sprint et la course.
- Pronostics verrouillés automatiquement au départ de chaque session.
- Classement général, top 3, prochaine course et courses passées (avec flèches).
- Historique des courses : podiums, points par joueur, pronostics détaillés.
- Notifications sur téléphone et PC : rappels, résumé du lundi, résultats disponibles.
- Page admin réservée aux comptes autorisés : publication des résultats et envoi de messages.

## Structure du projet

```
index.html                  page du jeu
admin.html                  page d'administration
style.css                   styles
fond.jpg                    image de fond
config.js                   pilotes et calendrier (données partagées)
firebase-messaging-sw.js    service worker des notifications (doit rester à la racine)

js/
  coeur/        etat.js (état partagé), firebase-init.js, utils.js, script.js (point d'entrée)
  auth/         auth.js (inscription, connexion), auth-ui.js (écran de connexion)
  jeu/          pilotes.js, glisser.js, pronostics.js, courses.js, timer.js
  resultats/    resultats.js, score.js, classement.js, paddock.js
  notifications/  prefs.js, notifications.js
  admin/        admin.js

scripts/
  calendrier.json               horaires des courses (en heure de Paris)
  envoyer_notification.py       envoi des notifications (exécuté par GitHub Actions)
  initialiser_calendrier.py     enregistre le calendrier dans la base

.github/workflows/
  notifications.yml             envoi des notifications
  initialiser-calendrier.yml    initialisation du calendrier
```

### Rôle des fichiers principaux

- **`etat.js`** : l'état partagé entre les modules (pseudo, pronostics, résultats, glisser-déposer). Les modules lisent et écrivent `etat.xxx`.
- **`script.js`** : le point d'entrée. Il démarre le jeu après la connexion et appelle les autres modules.
- **`pronostics.js`** : validation, modification et affichage de tes pronostics.
- **`glisser.js`** : placement des pilotes sur le podium (glisser-déposer ou clic).
- **`pilotes.js`** : liste des pilotes, recherche, pilotes déjà placés.
- **`courses.js`** : prochaine course et règle de verrouillage.
- **`timer.js`** : compte à rebours.
- **`resultats.js`** : résultats officiels, courses passées, noms des pilotes.
- **`classement.js`** : classement général et gestion des fenêtres.

## Base de données (Firebase Realtime Database)

| Nœud | Contenu |
|---|---|
| `pseudos/{pseudo}` | identifiant (uid) du compte qui a réservé le pseudo |
| `utilisateurs/{uid}` | pseudo associé au compte |
| `pronostics/{pseudo}/{course}/{sprint\|race}` | pronostics d'un joueur |
| `resultats/{course}/{sprint\|race}` | résultats officiels |
| `scores/{pseudo}` | score général |
| `scores_details/{pseudo}/{course}/{sprint\|race}` | points détaillés |
| `calendrier/{course}` | horaires utilisés pour le verrouillage |
| `tokens/{pseudo}/{jeton}` | appareils abonnés aux notifications |
| `preferences/{pseudo}` | choix de notifications de chaque joueur |
| `notifications/{id}` | messages en attente d'envoi |
| `admins/{uid}` | comptes administrateurs |
| `rappels`, `rappels_course`, `resumes` | rappels déjà envoyés (évite les doublons) |

Les règles de sécurité vérifient l'identité de chaque écriture : un joueur ne modifie que ses propres pronostics, avant le départ de la session.

## Mise en place

### Prérequis

- Un projet Firebase avec Authentication (email/mot de passe) et Realtime Database.
- Un dépôt GitHub avec GitHub Pages activé.
- VS Code avec l'extension Live Server pour tester en local.

### Secrets GitHub

Dans **Settings > Secrets and variables > Actions**, ajoute :

- `FIREBASE_SERVICE_ACCOUNT` : contenu du fichier JSON du compte de service Firebase.

Le jeton GitHub utilisé par le bouton d'envoi de la page admin est stocké dans la base, sous `config_admin/github_token`, lisible uniquement par les administrateurs. Il doit avoir la permission **Actions (lecture et écriture)** sur ce dépôt.

### Initialisation

1. Lance le workflow **Initialiser le calendrier** (onglet Actions), manuellement.
2. Crée ton compte admin sur le site, puis ajoute `admins/{ton uid}: true` dans la base.

## Commandes utiles

```bash
# Tester en local : clic droit sur index.html > Open with Live Server

# Envoyer les notifications à la main
cd scripts
FIREBASE_SERVICE_ACCOUNT="$(cat ../notification_ignore/cle-compte-service.json)" python envoyer_notification.py

# Réinitialiser le calendrier dans la base (après une modification de calendrier.json)
FIREBASE_SERVICE_ACCOUNT="$(cat notification_ignore/cle-compte-service.json)" python scripts/initialiser_calendrier.py
```

## Mise à jour des horaires

Une modification d'horaire se fait en deux endroits, pour rester cohérents :

1. `config.js` (affichage du site) et `scripts/calendrier.json` (verrouillage et rappels), sur les mêmes valeurs.
2. Relancer le workflow **Initialiser le calendrier**, pour mettre la base à jour.

## Sécurité

- Les clés et jetons ne doivent jamais être committés. Le dossier `notification_ignore/` est ignoré par Git.
- Le compte de service Firebase donne un accès complet au projet : ne le partage pas.
- Le jeton GitHub expire après un an : pense à le renouveler dans la base.