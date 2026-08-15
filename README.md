# Team53FR — Sites

Ce dépôt regroupe plusieurs sites statiques distincts, chacun dans son propre
sous-dossier de `sites/`.

## Structure

```
EditeurSite/
├── index.html            # portail racine, liste les sites disponibles
├── sites/
│   ├── editeur-livre/    # site "Éditeur de livre en ligne" (ex-racine du dépôt)
│   │   ├── index.html
│   │   └── ...
│   └── ma-bibliotheque/  # site "Ma Bibliothèque" (répertorie les livres possédés)
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
2. Ajouter une carte de lien vers ce site dans le portail racine
   ([index.html](index.html)).
3. Ne jamais utiliser de chemins absolus (`/style.css`, `/script.js`, …) dans
   le site : rester en relatif (`style.css`, `./script.js`, `../autre/`)
   pour que le site reste indépendant de son emplacement.

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
| ma-bibliotheque    | `MaBibliotheque/`           | `compte.json`, `livres.json`, `images/…`  |

Pour qu'un site fonctionne, son (ou ses) fichier(s) de compte doivent exister
dans son dossier BDD. Pour **ma-bibliotheque**, créer
`MaBibliotheque/compte.json` dans `Team53FR/BDD` :

```json
{ "login": "ton_identifiant", "password": "ton_mot_de_passe" }
```

À l'ajout d'un nouveau site suivant ce modèle : choisir un nouveau nom de
dossier BDD (constante `DOSSIER_BDD` en haut du `script.js` du site) et ne
jamais réutiliser celui d'un site existant.

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
