# Team53FR — Sites

Ce dépôt regroupe plusieurs sites statiques distincts, chacun dans son propre
sous-dossier de `sites/`.

## Structure

```
EditeurSite/
├── index.html             # accueil : bouton de connexion (ou redirection si déjà connecté)
├── connexion.html          # connexion centrale (un seul compte pour tous les sites)
├── tableau-de-bord.html    # liste les sites accessibles au compte connecté
├── admin-comptes.html      # gestion des comptes centraux (réservé aux admins)
├── script.js / admin.js / style.css   # logique + style du portail central
├── sites/
│   ├── editeur-livre/    # site "Éditeur de livre en ligne" (ex-racine du dépôt)
│   │   ├── index.html
│   │   └── ...
│   ├── ma-bibliotheque/  # site "Ma Bibliothèque" (répertorie les livres possédés)
│   │   ├── index.html
│   │   └── ...
│   └── droid-fortnite/   # site "Droid Fortnite" (suivi de Star Wars: Droid Tycoon)
│       ├── index.html
│       └── ...
└── README.md
```

Chaque site sous `sites/<nom-du-site>/` est autonome : ses fichiers HTML/CSS/JS
ne se référencent qu'entre eux avec des chemins relatifs, sans dépendre d'un
chemin absolu. Cela permet de le déplacer, le dupliquer ou le déployer
indépendamment sans rien casser.

## Ajouter un nouveau site

1. Créer un dossier `sites/<nom-du-site>/` avec son propre `index.html` et ses
   assets.
2. Ne jamais utiliser de chemins absolus (`/style.css`, `/script.js`, …) dans
   le site : rester en relatif (`style.css`, `./script.js`, `../autre/`)
   pour que le site reste indépendant de son emplacement.
3. Pour qu'il apparaisse dans le tableau de bord central, ajouter une entrée
   dans `Web/sites.json` (voir « Connexion centrale » ci-dessous). Si le site
   se contente de vérifier la présence d'un token (comme `ma-bibliotheque`),
   c'est une pure modification de données, sans toucher au code du portail.

## Hébergement

Servi via GitHub Pages depuis la racine du dépôt. Chaque site est donc
accessible sous `https://<utilisateur>.github.io/EditeurSite/sites/<nom-du-site>/`,
et le portail racine sous `https://<utilisateur>.github.io/EditeurSite/`.

## Stockage « BDD » sur GitHub

Ces sites n'ont pas de backend : ils lisent/écrivent directement, depuis le
navigateur, des fichiers JSON (et images) dans le dépôt privé **`Team53FR/BDD`**
via l'API Contents de GitHub, authentifiés par un token personnel saisi à la
connexion. Persistance du token selon le site : `editeur-livre` le garde
uniquement en `sessionStorage` (jamais persisté, à retaper à chaque
ouverture) ; `ma-bibliotheque`, à usage personnel sur un seul appareil, le
mémorise en `localStorage` (persiste jusqu'à déconnexion manuelle).

Chaque site utilise son **propre dossier** dans ce dépôt BDD, pour ne jamais
mélanger ses données avec celles d'un autre site :

| Site              | Dossier dans `Team53FR/BDD` | Fichiers                                  |
|-------------------|------------------------------|--------------------------------------------|
| editeur-livre      | `EditeurLivre/`             | `users.json`, `bibliotheques/<login>.json`, `images/<login>/…` |
| ma-bibliotheque    | `MaBibliotheque/`           | `users.json`, `bibliotheques/<login>.json`, `images/<login>/…` |
| droid-fortnite     | `DroidFortnite/`            | `users.json`, `catalogue.json`, `renaissance.json` (partagés), `bibliotheques/<login>.json` (personnel) |
| portail central    | `Web/`                      | `utilisateurs.json`, `sites.json`         |

Les trois sites suivent donc le **même modèle par compte** pour leurs données
personnelles : chaque personne a sa propre bibliothèque (et, pour
editeur-livre/ma-bibliotheque, ses propres images), retrouvées via un
identifiant « slug » dérivé de son login (`slugifierLogin()`, dupliqué à
l'identique dans chaque `script.js` de site — voir « Connexion centrale »
pour la version côté portail). Droid Fortnite s'en écarte légèrement :
`catalogue.json` (liste des droïdes) et `renaissance.json` (paliers de
renaissance) sont des données **partagées**, identiques pour tout le monde —
seule la progression personnelle (`bibliotheques/<login>.json` : droïdes
possédés + palier, renaissances atteintes) est propre à chaque compte. Voir
« Droid Fortnite » ci-dessous.

Pour qu'un site fonctionne, son fichier de comptes doit exister dans son
dossier BDD. Pour **ma-bibliotheque**, créer `MaBibliotheque/users.json`
dans `Team53FR/BDD` :

```json
[{ "login": "ton_identifiant", "password": "ton_mot_de_passe", "nomAffichage": "" }]
```

(Historique : avant la migration multi-compte, ma-bibliotheque n'avait qu'un
`compte.json` unique et une collection `livres.json` partagée par tout le
monde — voir « Migration de Ma Bibliothèque » ci-dessous si ces fichiers
existent encore dans ton dépôt.)

À l'ajout d'un nouveau site suivant ce modèle : choisir un nouveau nom de
dossier BDD (constante `DOSSIER_BDD` en haut du `script.js` du site) et ne
jamais réutiliser celui d'un site existant.

## Connexion centrale

Un seul compte (racine du dépôt : `index.html` / `connexion.html` /
`tableau-de-bord.html` / `admin-comptes.html`) donne accès, depuis un tableau
de bord unique, à tous les sites que l'administrateur a autorisés — plus
besoin de se reconnecter séparément à chaque site.

Les comptes centraux vivent dans `Web/utilisateurs.json` :

```json
[{ "login": "...", "password": "...", "role": "admin", "nomAffichage": "...",
   "acces": ["editeur-livre", "ma-bibliotheque"], "derniereConnexion": "..." }]
```

Le registre des sites affichables vit dans `Web/sites.json` (repli automatique
sur une constante `DEFAULT_SITES` dans `script.js` tant que ce fichier
n'existe pas) :

```json
[{ "id": "mon-site", "nom": "Mon site", "description": "...", "icone": "🌐",
   "pageArrivee": "sites/mon-site/apres-connexion.html",
   "relais": { "stockage": "sessionStorage" | "localStorage",
               "cles": { "token": "clé_attendue_par_le_site", "...": "..." } } }]
```

**Relais d'identifiants** : au clic sur une carte du tableau de bord, le
portail préremplit directement les clés `sessionStorage`/`localStorage` que le
site cible lit déjà lui-même (selon `relais`), puis navigue vers
`pageArrivee`. Le site n'est jamais modifié — il ne voit pas la différence
entre un relais et sa propre page de connexion.

**Premier lancement** : `Web/utilisateurs.json` n'existe pas encore, donc
`seConnecter()` du portail traite un 404 comme une première installation et
crée automatiquement un compte administrateur fondateur à partir de ce qui
vient d'être saisi. Ensuite, le bouton « Importer les comptes existants » du
panneau admin fusionne les comptes déjà présents dans
`EditeurLivre/users.json` et `MaBibliotheque/users.json` (sans jamais créer
de doublon, relançable autant de fois que nécessaire).

**Sites « identité-dépendants »** : les deux sites vérifient que le login
relayé correspond à une entrée réelle de leur propre fichier de comptes
(`EditeurLivre/users.json` / `MaBibliotheque/users.json`), puisque chacun a
sa bibliothèque propre. Pour rester cohérent sans jamais modifier le code de
ces sites, le panneau admin central fait un *upsert* silencieux dans le
fichier de comptes du site concerné (`synchroniserEditeurLivre()` /
`synchroniserMaBibliotheque()` dans `admin.js` racine, même logique dupliquée
pour chaque site) chaque fois qu'un compte central se voit accorder l'accès à
ce site. Un futur site purement « token », sans notion d'identité, s'ajoute
en pure donnée (`Web/sites.json`) ; un futur site « identité » demandera une
petite synchro dédiée du même genre.

Révoquer un accès dans le panneau admin retire la carte du tableau de bord
mais **ne bloque pas** une connexion directe sur le site concerné (son propre
mot de passe existe toujours dans son propre fichier BDD) — cohérent avec le
fait qu'aucun site de ce dépôt n'a d'autorisation côté serveur, puisqu'il n'y
a pas de serveur.

## Migration de Ma Bibliothèque (compte unique → comptes séparés)

Ma Bibliothèque a été créée avec un seul compte partagé
(`MaBibliotheque/compte.json` + une collection unique `livres.json`). Le
bouton « Migrer Ma Bibliothèque vers des comptes séparés » du panneau admin
(`migrerMaBibliothequeVersMultiCompte()` dans `script.js` racine) fait passer
ce site au même modèle par compte qu'editeur-livre :

1. Lit l'ancien `compte.json`, en déduit le login et son « slug ».
2. Recopie chaque image de couverture référencée dans `livres.json` vers
   `images/<slug>/…` (l'API Contents de GitHub n'a pas de copie serveur : il
   faut télécharger puis ré-uploader chaque fichier).
3. Écrit la collection dans `bibliotheques/<slug>.json` et crée/complète
   `MaBibliotheque/users.json`.

Ne supprime **jamais** `compte.json`/`livres.json`/les anciennes images — ils
restent en place, orphelins mais inoffensifs, à supprimer à la main une fois
vérifié que tout fonctionne. Sans danger à relancer : la vérification se fait
sur l'existence de `bibliotheques/<slug>.json` pour ce compte précis (pas
juste "`users.json` existe"), pour rester correct même si un second compte a
été créé côté portail avant que ce bouton n'ait été cliqué.

## Transfert de données entre comptes

Le panneau admin propose un bouton « Transférer » sur chaque compte
(`transfererBibliotheque()` dans `admin.js` racine), pour réaffecter toute la
bibliothèque d'un compte à un autre — utile par exemple si un compte est
remplacé par un autre. Fonctionne pour `editeur-livre`, `ma-bibliotheque`, ou
les deux à la fois (un seul mécanisme générique, `CONFIG_TRANSFERT`, décrit
la forme des données propre à chaque site) :

- **Mode** choisi à chaque transfert : « Déplacer » (le compte source perd
  ses données) ou « Copier » (les deux comptes les ont ensuite).
- **Conflit** : si le compte destination a déjà des données, celles du compte
  source sont **ajoutées** aux siennes plutôt que de les écraser — en cas de
  collision d'identifiant, l'élément transféré reçoit un nouvel id.
- **Images** : téléchargées depuis l'ancien chemin puis ré-uploadées sous le
  nouveau (même contrainte API que la migration ci-dessus).

Chaque écriture reste un commit sur le dépôt privé `Team53FR/BDD` : même en
cas d'erreur, l'historique Git permet de revenir en arrière.

**Non couvert par ce bouton** : `droid-fortnite`, dont la donnée personnelle
(`{ droidesPossedes: ["<id>::<palier>", ...], renaissanceAtteinte: [...] }`)
est un ensemble de clés composites, pas des objets avec un `.id` comme le
suppose `CONFIG_TRANSFERT`. Pourrait être ajouté plus tard avec une
sémantique dédiée si besoin.

## Droid Fortnite (suivi de Star Wars: Droid Tycoon)

Suivi personnel de progression pour ce mode de jeu Fortnite : un « droidex »
(catalogue des droïdes, organisé en onglets par palier d'amélioration —
Défaut/Or/Diamant/Arc-en-ciel/Beskar/Galactique/Stellar — chaque droïde
pouvant être possédé **indépendamment à chaque palier**, comme dans le jeu,
pas juste à un seul palier « actuel ») et une liste des paliers de
« renaissance » (crédits + droïdes requis pour chaque niveau).

La progression personnelle stocke donc des clés composites
`"<idDroide>::<palier>"` dans `droidesPossedes` (un tableau, une clé par
combinaison droïde+palier réellement possédée) plutôt qu'un simple palier
par droïde.

**Données partagées, éditables dans l'outil** : `DroidFortnite/catalogue.json`
et `DroidFortnite/renaissance.json` sont communs à tous les comptes du site
(contrairement à `bibliotheques/<login>.json`, personnel). N'importe quel
compte peut ajouter un droïde ou un palier manquant depuis `suivi.html` — pas
de notion d'administrateur propre à ce site. Ces deux fichiers sont amorcés
automatiquement (créés avec des données de départ) au premier chargement
authentifié si absents — je ne peux pas les créer moi-même directement dans
`Team53FR/BDD` (pas de token).

**Provenance des données de départ** : sourcées du tracker communautaire
open-source *Droidex* (github.com/erikpeik/droidex) — **pas des données
officielles Epic Games**, potentiellement incomplètes ou datées (le jeu est
mis à jour régulièrement ; par exemple les paliers Galactique/Stellar,
confirmés en jeu, n'étaient pas encore dans ce tracker au moment de
l'écriture). À corriger/compléter librement dans l'outil.

**Écriture des fichiers partagés — fusion, pas simple retry** : comme
plusieurs comptes peuvent ajouter une entrée à `catalogue.json`/
`renaissance.json`, `sauvegarderAvecFusion()` (dans `sites/droid-fortnite/script.js`)
gère différemment un conflit d'écriture (409) que le pattern habituel :
au lieu de relire seulement le sha distant et réécrire l'état local (sûr
uniquement quand un seul compte écrit jamais un fichier donné, comme
`bibliotheques/<login>.json`), elle relit le **contenu** distant et y
fusionne les entrées locales absentes (par `id`), pour ne jamais perdre
silencieusement l'ajout fait par quelqu'un d'autre entre-temps.

## App installable (PWA)

**ma-bibliotheque** est installable comme une app sur téléphone (icône sur
l'écran d'accueil, plein écran sans barre d'adresse), via `manifest.json` +
`sw.js` (service worker qui met en cache uniquement la coquille de l'appli —
jamais les données, toujours lues en direct). Aucune réécriture native :
c'est le même site, juste rendu installable. Ne fonctionne qu'une fois servi
en HTTPS (GitHub Pages) — pas en ouvrant le fichier en local.

Pour rendre un autre site du dépôt installable de la même façon : dupliquer
`manifest.json` (adapter `name`/`theme_color`/icônes) et `sw.js` (adapter
`CACHE_NOM` et `FICHIERS_COQUILLE`) dans son dossier, puis ajouter les
balises `<link rel="manifest">` et le script d'enregistrement du service
worker dans le `<head>` de chaque page HTML du site.
