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
├── manifest.json / sw.js   # app installable (portée = tout le dépôt)
├── icone-192.png / icone-512.png
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
4. Pour qu'il n'exige pas une nouvelle saisie du token quand on l'ouvre
   directement, recopier `adopterSessionCentrale()` en tête de son `script.js`
   (voir « Connexion centrale »), et faire pointer sa déconnexion vers
   `../../connexion.html` après avoir effacé les clés `team53_*`.

## Hébergement

Servi via GitHub Pages depuis la racine du dépôt. Chaque site est donc
accessible sous `https://<utilisateur>.github.io/EditeurSite/sites/<nom-du-site>/`,
et le portail racine sous `https://<utilisateur>.github.io/EditeurSite/`.

## Stockage « BDD » sur GitHub

Ces sites n'ont pas de backend : ils lisent/écrivent directement, depuis le
navigateur, des fichiers JSON (et images) dans le dépôt privé **`Team53FR/BDD`**
via l'API Contents de GitHub, authentifiés par un token personnel saisi à la
connexion.

**Le token n'est saisi qu'une fois par appareil.** Il est mémorisé en
`localStorage` par tous les sites, et la session du portail est adoptée par
les sites qui n'en ont pas encore (voir « Connexion centrale »). Ouvrir un
site depuis un signet, ou rouvrir le navigateur, ne redemande donc rien.

> **Portée du token.** Le contenu de la BDD n'a rien de sensible, mais le
> token, lui, l'est : un PAT classique `ghp_…` avec le scope `repo` ouvre
> **tous** les dépôts privés du compte, et il est désormais stocké en clair
> sur chaque appareil utilisé. Préférer un **fine-grained token** limité au
> seul dépôt `BDD`, permission *Contents: Read and write* — ce qui fuiterait
> en cas d'appareil perdu se limite alors à ce dépôt.

Chaque site utilise son **propre dossier** dans ce dépôt BDD, pour ne jamais
mélanger ses données avec celles d'un autre site :

| Site              | Dossier dans `Team53FR/BDD` | Fichiers                                  |
|-------------------|------------------------------|--------------------------------------------|
| editeur-livre      | `EditeurLivre/`             | `users.json`, `bibliotheques/<login>.json`, `images/<login>/…` |
| ma-bibliotheque    | `MaBibliotheque/`           | `users.json`, `bibliotheques/<login>.json`, `images/<login>/…` |
| droid-fortnite     | `DroidFortnite/`            | `users.json`, `catalogue.json`, `renaissance.json`, `paliers.json`, `unites.json`, `raretes.json` (partagés), `bibliotheques/<login>.json` (personnel) |
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
   "relais": { "stockage": "localStorage",
               "cles": { "token": "clé_attendue_par_le_site", "...": "..." } } }]
```

**Relais d'identifiants** : au clic sur une carte du tableau de bord, le
portail préremplit directement les clés de stockage que le site cible lit
déjà lui-même (selon `relais`), puis navigue vers `pageArrivee`. Le site ne
voit pas la différence entre un relais et sa propre page de connexion.

**Adoption de la session centrale** : le relais ne joue que si l'on passe par
le tableau de bord. Chaque site appelle donc aussi `adopterSessionCentrale()`
au chargement (en tête de son `script.js`) : si sa propre session manque mais
que `team53_token` existe, il la recopie sous ses propres clés. Ouvrir un site
depuis un signet, ou après avoir fermé le navigateur, ne redemande donc plus
rien. La session propre au site garde la priorité — elle peut être plus
récente, si l'on s'est connecté directement sur ce site.

**Déconnexion** : elle ferme la session **partout** (clés du site + clés
`team53_*`) et renvoie vers `connexion.html` du portail. Sans cela, la session
centrale serait ré-adoptée au rechargement suivant et la déconnexion n'aurait
aucun effet.

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

## Mon compte

`compte.html` — accessible depuis le tableau de bord, sans droit particulier :
chacun y change son **pseudo** et son **mot de passe**, et consulte ses
**statistiques** (rôle, dernière connexion, puis un bloc par site : livres,
pages et mots écrits ; entrées de la bibliothèque ; droïdes possédés et
escouade).

Deux précautions :

- L'écriture **relit `Web/utilisateurs.json` juste avant d'écrire** et ne
  modifie que sa propre entrée, pour ne pas écraser ce qu'un administrateur
  aurait changé sur d'autres comptes entre-temps.
- Un changement de mot de passe ou de pseudo est **reporté sur les trois
  sites** (`synchroniserTousLesSites()` dans `script.js`, déplacé là depuis
  `admin.js` pour être partagé). Sans ce report, l'ancien mot de passe
  continuerait de fonctionner sur les sites et le nouveau y serait refusé.
  Le report est best-effort : un site indisponible est nommé dans le message
  plutôt que de faire échouer l'ensemble.

L'identifiant de connexion, lui, ne se change pas : il sert de clé aux
fichiers personnels de chaque site (`bibliotheques/<slug>.json`).

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

## Éditeur de livre

**Modèle de texte** : la source de vérité est `livre.spreads[]` — une entrée
par double-page, le texte continu tel qu'il est saisi. `livre.pages[]` en est
**dérivé** (`calculerDeuxPages()` découpe chaque double-page en deux) et sert
au sommaire, à l'aperçu, à l'impression et à `lecture.js`. Ne jamais écrire
dans `pages[]` en pensant modifier le livre : `remplacerTout()` l'a fait une
fois, et la fonction « Remplacer tout » n'avait aucun effet visible.

La session (`gh_token`, `gh_login`, `gh_role`, `gh_nom`) vit en `localStorage`
comme sur les autres sites. Seul `livre_id` — quel livre est ouvert — reste en
`sessionStorage` : c'est l'état d'un onglet, pas une session, et le déplacer
ferait que deux onglets sur deux livres différents se marcheraient dessus.

Le découpage passe par un élément de mesure caché (`#mesureCachee`) dimensionné
comme une page réelle. `repaginerTout()` recolle tout le livre puis le redécoupe
— coûteux (~1,7 s pour 143 pages), donc réservé aux moments qui l'exigent ;
la frappe courante passe par `gererFlux()`, qui ne recoupe que la double-page
touchée et cascade tant qu'il y a débordement.

**Impression** : le bouton imprimante ouvre un panneau de catégories (livret à
agrafer, page à page, fichier pour l'imprimeur), chacune avec un bouton « ? »
dépliant un mode d'emploi. Deux guides publics complètent le sujet —
`montage.html` (relier soi-même : livret agrafé, dos collé, cahiers cousus,
anneaux) et `imprimeur.html` (préparer les fichiers pour un imprimeur
professionnel).

**Export « fichier pour l'imprimeur »** : produit deux PDF conformes aux
critères géométriques d'un cahier des charges d'imprimerie — l'intérieur en
pages simples, la couverture ouverte à plat (4ᵉ + dos + 1ʳᵉ). Fond perdu de
5 mm, traits de coupe et de pli décalés de 5 mm en filet de 0,25 pt, pages
centrées dans la zone de support, marges paires/impaires symétriques pour le
registre, blanc tournant de 8 mm folio compris.

Ce dernier point a une conséquence : le folio habituel est à 6 mm du bord, sous
le minimum exigé. Le remonter oblige à repaginer, d'où `PIED_PAGE_PX` (variable
et non constante, dans `editeur.js`) que `avecPaginationImprimeur()` relève le
temps de l'export. Celui-ci repagine **une seule fois**, prend un instantané du
contenu des pages, rend au livre sa pagination d'écran, puis construit le
fichier depuis l'instantané — le fichier compte donc quelques pages de plus que
l'aperçu, ce que le panneau de contrôle annonce.

Pendant cette passe, le mesureur reçoit la classe `mesure-pro` : il compose
alors comme le PDF (justifié, avec césure) au lieu du drapeau sans césure du
mode écran. Sans cet accord, les lignes ne tombent pas au même endroit et le
bas des pages est silencieusement rogné par l'`overflow: hidden`.

**Ce qu'un navigateur ne sait pas faire** : convertir en CMJN, produire du
PDF/X-1a, appliquer un profil de sortie. Le panneau de contrôle affiché avant
génération le dit explicitement, plutôt que de laisser croire que le fichier
part tel quel chez l'imprimeur.

## Droid Fortnite (suivi de Star Wars: Droid Tycoon)

**Thème visuel « HUD de space opera »**, inspiré des couleurs réellement
visibles dans le jeu (capture d'écran fournie par l'utilisateur) plutôt
qu'une palette générique :
- **Or** (`--primaire`) comme le logo « DROÏDEX » du jeu — boutons, onglets
  actifs, titres.
- **Cyan** (`--secondaire`, nouveau) comme les libellés de rareté du jeu —
  utilisé sur les badges Typique/Rare.
- **Orange** (`--accent`) comme les barres de progression du jeu.
- Fond quasi noir avec un léger champ d'étoiles en CSS pur
  (`radial-gradient`, thème sombre uniquement).
- Police d'affichage **Orbitron** (Google Fonts, libre — même mécanisme de
  `<link>` que la police EB Garamond déjà utilisée par editeur-livre) pour
  les titres, `--police-titre` dans `style.css`.
- Coins coupés façon panneau futuriste (`clip-path` polygon, variable
  `--coin-hud`) sur les cartes de droïde, les paliers de renaissance et les
  blocs admin, plus des lueurs (`box-shadow`) sur les boutons/onglets actifs
  et une légère pulsation sur le bouton flottant.
- `--sur-primaire` (nouvelle variable) garde un texte lisible sur les
  boutons dorés dans les deux thèmes (texte sombre quand l'or est clair en
  thème sombre, texte clair quand l'or est plus foncé en thème clair).

Aucun logo, police ou visuel officiel Star Wars/Epic Games utilisé — une
ambiance générique (couleurs, forme, étoiles en CSS, police libre), même
principe que pour les données et les images : pas de contenu sous droit
d'auteur.

**Piège rencontré** : le champ d'étoiles (`background-image`) posé sur `body`
en thème sombre était écrasé par la règle `body { background: var(--fond); }`
plus bas dans le fichier — le raccourci `background` réinitialise aussi
`background-image` à `none`, même si lui ne définit qu'une couleur. Remplacé
par `background-color: var(--fond)` pour ne cibler que la couleur.

Suivi personnel de progression pour ce mode de jeu Fortnite : un « droidex »
(catalogue des droïdes, organisé en onglets par palier d'amélioration —
Défaut/Or/Diamant/Arc-en-ciel/Beskar/Galactique/Stellar — chaque droïde
pouvant être possédé **indépendamment à chaque palier**, comme dans le jeu,
pas juste à un seul palier « actuel ») et une liste des paliers de
« renaissance » (crédits + droïdes requis pour chaque niveau).

L'onglet **Tous**, en tête des paliers, affiche chaque droïde à chacun de ses
paliers — une carte par couple, avec son étiquette de palier et la couleur de
contour correspondante. Le Droidex raisonne donc sur des couples
(`combinaisonsDroidex()`) et non sur des droïdes : `basculerPossession()` reçoit
le palier en paramètre, puisque `palierActif` vaut alors une sentinelle
(`TOUS_PALIERS`) qui ne désigne aucun palier réel.

La progression personnelle stocke donc des clés composites
`"<idDroide>::<palier>"` dans `droidesPossedes` (un tableau, une clé par
combinaison droïde+palier réellement possédée) plutôt qu'un simple palier
par droïde. Exception : les droïdes de rareté **Iconique** (événementiels,
ex. BB-8, R2-D2, C-3PO) n'existent qu'au palier Défaut dans le jeu — ils sont
automatiquement masqués des autres onglets de palier (`estDisponibleAuPalier()`
dans `suivi.js`).

**Carte de droïde** : vignette au format portrait sur panneau sombre, reprenant
la présentation du tracker communautaire *Droidex* — nom en médaillon en haut à
gauche, case à cocher en face, classe et rareté en pied, contour teinté par le
palier, ligne de balayage au survol. Le panneau reste sombre dans les deux
thèmes du site : c'est un écran, pas un élément d'interface.

`construireCarteDroide()` (dans `script.js`) est **partagé** par le Droidex et
le panneau admin, qui n'affichent qu'une variante l'un de l'autre (case à
cocher vs corbeille). Un droïde non possédé n'estompe pas la carte entière mais
seulement son contenu : baisser l'opacité du tout délavait la vignette vers le
fond de page et rendait le nom illisible en thème clair.

**Visuel**, choisi dans cet ordre par `appliquerVisuelDroide()` :

1. la **photo perso** ajoutée au droïde depuis `admin.html`, stockée dans
   `DroidFortnite/images/<id>.<ext>` (même mécanisme que les couvertures de
   ma-bibliotheque : compression côté client, upload via l'API Contents) ;
2. une **source d'images externe**, si `BASE_IMAGES_EXTERNES` est renseignée
   dans `script.js` — l'URL est alors `{base}/droids/{NOM}_{PALIER}.webp`,
   `slugImageDroide()` mettant le nom en majuscules et les espaces en tirets
   bas (« DRK-1 Probe » → `DRK-1_PROBE`). La correspondance des paliers vers
   les suffixes est dans `PALIERS_IMAGE_EXTERNE` ;
3. sinon la **teinte générée** à partir du nom (`couleurDroide()` dans
   `script.js`, un hash → teinte HSL) et l'icône de classe.

Le chargement **réessaie** deux fois avant de renoncer : sur l'onglet « Tous »,
une centaine de vignettes partent d'un coup et quelques requêtes échouent sous
cette rafale, sans que le fichier soit en cause. Abandonner au premier échec
laissait ces droïdes sur leur teinte générée jusqu'au rechargement complet de
la page — des images « disparues » qui existaient pourtant. Les réessais sont
espacés et légèrement décalés, et abandonnés si la carte a été remplacée
entre-temps (changement d'onglet, filtre).

`BASE_IMAGES_EXTERNES` est **vide par défaut, et c'est délibéré** : la
renseigner ferait charger les visuels depuis un site tiers qui n'a rien
demandé (son trafic, ses fichiers, des extractions du jeu). Le mécanisme et la
correspondance des noms sont prêts et vérifiés ; la décision revient à
l'utilisateur. Le nom du droïde sert de clé, pas son identifiant : les tirets
de l'identifiant confondent espaces et vrais traits d'union
(`drk-1-probe` ne dit pas lequel est lequel).

**Prix et rendement, par palier** : le rendement d'un droïde monte à chaque
amélioration, il a donc autant de valeurs que de paliers. Deux tables indexées
par **nom de palier**, comme l'est déjà la possession :

```json
{ "id": "mouse", "prix": { "Défaut": 950, "Or": 4000 },
                 "rendements": { "Défaut": 2, "Or": 4 } }
```

Le formulaire admin affiche une ligne par palier et se reconstruit à chaque
ouverture : il suit donc les paliers ajoutés ou réordonnés sans rien à changer.
Les cases vides ne sont pas enregistrées. Les cartes affichent le prix (ambre)
et le rendement (émeraude) du palier affiché, et la ligne disparaît entièrement
tant qu'aucune valeur n'est connue.

**Chaque montant se saisit en deux morceaux — un nombre et une unité — mais
s'enregistre comme un seul nombre en crédits.** C'est la correction d'un bug
silencieux : saisir « 4K » d'une traite donnait une chaîne, et `parseFloat("4K")`
vaut **4**. Le total de l'escouade sous-comptait donc d'un facteur mille sans
rien signaler. Un seul nombre canonique en base, l'unité n'étant qu'une
commodité de saisie, redéduite à l'ouverture du formulaire
(`decomposerValeur()` / `composerValeur()` dans `script.js`).

La liste des unités vit dans **`DroidFortnite/unites.json`** (K, M, B, T au
départ) et s'édite depuis l'onglet **Unités** du panneau admin, pour le jour où
les montants du jeu dépasseront le billion. Supprimer une unité ne perd aucune
donnée : les montants sont en crédits, seule leur présentation change.
`formaterCredits()` s'appuie sur cette liste — d'où « 1.2 B » et non plus
« 1.2 Md ».

**Les droïdes Iconiques ne fonctionnent pas comme les autres** : ils n'existent
qu'au premier palier et leur rendement est un **pourcentage du revenu total**,
pas des crédits par seconde. Le formulaire ne leur propose donc qu'une seule
ligne, avec l'unité `%` sélectionnée d'office ; la valeur est alors stockée
telle quelle (« 25% »). Le `%` n'est jamais proposé pour un prix, ni ajoutable
dans `unites.json` : ce n'est pas un facteur, c'est une autre nature de valeur.

> À noter : la rareté d'un droïde **ne change pas** d'un palier à l'autre
> (vérifié sur les 379 entrées du tracker communautaire : Mouse reste Common
> partout). Seul le rendement varie — d'où l'indexation par palier et non par
> rareté.

**Données partagées** : `DroidFortnite/catalogue.json` et
`DroidFortnite/renaissance.json` sont communs à tous les comptes du site
(contrairement à `bibliotheques/<login>.json`, personnel). Elles se gèrent
**uniquement depuis `admin.html`** : `suivi.html` ne fait que suivre la
progression, et n'a plus de bouton d'ajout. Ces deux fichiers sont amorcés
automatiquement (créés avec des données de départ) au premier chargement
authentifié si absents — je ne peux pas les créer moi-même directement dans
`Team53FR/BDD` (pas de token).

**Provenance des données de départ** : sourcées du tracker communautaire
*Droidex* (droidex.web.app, github.com/erikpeik/droidex) — **pas des données
officielles Epic Games**, potentiellement incomplètes ou datées, le jeu étant
mis à jour régulièrement. À corriger/compléter librement dans l'outil. Ce
tracker couvrait 69 droïdes de base × 6 paliers (Défaut → Galactique) à la
dernière vérification ; le palier **Stellar**, confirmé en jeu, n'y figurait
pas encore — un droïde à ce palier retombe donc sur la teinte générée si la
source d'images externe est utilisée.

**Super renaissance : les mêmes paliers, d'autres droïdes.** À chaque super
renaissance, les paliers de renaissance réclament des droïdes différents ;
niveaux et crédits, eux, ne bougent pas. Le champ `elements` est donc une table
indexée par numéro de super renaissance :

```json
{ "id": "niveau-1", "niveau": 1, "credits": 10000,
  "elements": { "0": "CB (Défaut), Pit (Défaut)", "1": "Mouse (Or), Gonk (Diamant)" } }
```

L'ancienne forme — une simple chaîne — vaut pour la super renaissance 0 : les
données déjà saisies restent valables sans migration
(`elementsParSuper()` dans `script.js`). La progression personnelle suit la
même dimension (`renaissanceAtteinte` devient une table par super
renaissance) : atteindre le palier 5 avant une super renaissance ne doit pas
le laisser coché après, puisqu'on recommence — là encore, un simple tableau
est relu comme la progression de la super renaissance 0.

Le sélecteur de super renaissance n'apparaît dans le suivi que si les données
en décrivent plus d'une. Côté gestionnaire, il sert à choisir celle qu'on
modifie, et un bouton ajoute la suivante en reprenant les droïdes de la
précédente — on n'ajuste ensuite que ce qui diffère.

**Renaissance : les droïdes requis en visuel.** Le champ `elements` d'un palier
de renaissance est du texte libre, saisi à la main
(« CB (Défaut), Pit (Or), … »). `analyserElementsRenaissance()` le relit pour
retrouver les droïdes du catalogue et afficher leurs cartes, avec la couleur du
palier demandé. Les cartes y sont montrées telles quelles, sans marquer ce
qu'on possède déjà : ce qui compte est **ce qu'il faut**, et la case à cocher
d'une carte n'aurait donc rien à dire ici — elle est masquée. Ce qui ne se laisse pas
reconnaître (nom absent du catalogue) reste affiché comme étiquette texte
plutôt que de disparaître de la liste ; un palier omis ou inconnu retombe sur
le premier.

**Écriture de la progression — regroupée, jamais à chaque clic.** Chaque
écriture est un *commit* sur le dépôt BDD. Enregistrer à chaque changement
faisait un commit par droïde coché : cocher un palier entier en produisait
soixante-dix, et l'historique grossissait au point que l'interface de GitHub
finissait par afficher « Cannot retrieve latest commit at this time ».

`marquerProgressionModifiee()` ne fait donc que programmer l'écriture, qui a
lieu après deux secondes sans nouveau changement — cinquante clics d'affilée ne
font plus qu'un commit. Trois filets : masquer l'onglet ou quitter la page
écrit tout de suite ce qui attend, `beforeunload` prévient si l'écriture n'a
pas abouti, et deux écritures ne peuvent pas partir en même temps (elles se
disputeraient le même sha).

À noter : `ma-bibliotheque` n'a jamais eu ce défaut — y cocher un tome ou un
épisode ne modifie que l'état local, l'écriture n'ayant lieu qu'à la validation
du formulaire.

**Écriture des fichiers partagés — fusion, pas simple retry** : comme
plusieurs comptes peuvent ajouter une entrée à `catalogue.json`/
`renaissance.json`, `sauvegarderAvecFusion()` (dans `sites/droid-fortnite/script.js`)
gère différemment un conflit d'écriture (409) que le pattern habituel :
au lieu de relire seulement le sha distant et réécrire l'état local (sûr
uniquement quand un seul compte écrit jamais un fichier donné, comme
`bibliotheques/<login>.json`), elle relit le **contenu** distant et y
fusionne les entrées locales absentes (par `id`), pour ne jamais perdre
silencieusement l'ajout fait par quelqu'un d'autre entre-temps.

**Raretés** : `DroidFortnite/raretes.json` porte la liste complète, éditable
depuis l'onglet **Raretés** du panneau admin — ajout, suppression,
réordonnancement et couleurs (fond + texte).

- **L'ordre fait le tri** : du plus faible au plus fort, il sert au classement
  du catalogue (`ordreRarete()`, qui a remplacé la constante `ORDRE_RARETE`) et
  à l'ordre des listes déroulantes, remplies au chargement
  (`remplirSelectRaretes()`) plutôt qu'écrites en dur dans le HTML.
- **Pas de renommage**, comme pour les paliers et pour la même raison : chaque
  droïde stocke le *nom* de sa rareté. Supprimer une rareté encore portée est
  possible mais averti, avec le nombre de droïdes concernés ; ils la gardent,
  simplement sans couleur et en dernier au tri (`ordreRarete()` renvoie alors
  un rang au-delà de la liste, plutôt que -1 qui les aurait remontés en tête).
- **`premierPalierSeulement`** est une propriété de la rareté, pas un test sur
  le nom « Iconique » : une rareté ajoutée plus tard peut recevoir le même
  comportement (bouton ⭑) sans toucher au code.
- Les couleurs sont injectées dans un `<style>` au chargement
  (`appliquerCouleursRaretes()`) plutôt qu'appliquées badge par badge : elles
  valent ainsi partout — cartes, panneau admin, feuille de choix de l'escouade,
  où les badges n'avaient d'ailleurs aucune couleur avant. La feuille de style
  ne doit donc plus porter de règle `.badge-rarete.<rareté>`, qui l'emporterait
  en spécificité.

**Un palier peut porter plusieurs couleurs.** `couleur` est soit une chaîne,
soit un tableau ; à partir de deux, le contour des cartes devient un dégradé —
c'est ainsi qu'« Arc-en-ciel » en est un vrai. Une bordure CSS ne pouvant pas
être un dégradé, et `border-image` ignorant `border-radius` (coins carrés),
`appliquerContourPalier()` superpose deux fonds : l'intérieur opaque rogné sur
la boîte de padding, le dégradé rogné sur la boîte de bordure. Les coins
restent ronds.

**Panneau admin (`admin.html`)**, réservé aux admins du portail central : pas
de rôle propre à Droid Fortnite, `estAdminCentral()`/`exigerAdminDroidFortnite()`
dans `script.js` lisent directement `team53_role` en `localStorage` (même
origine que le portail, aucun changement du relais nécessaire). Le bouton
flottant d'ajout et le lien ⚙ vers `admin.html` sont masqués pour les
comptes non-admin dans `suivi.html`.

Organisé en **six onglets** (même pattern `.onglet-type` que Droidex/
Renaissance de `suivi.html`) :
- **Droïdes** : catalogue en petites cartes (même `construireCarteDroide()`
  que le Droidex — une liste verticale devient vite illisible avec ~70
  entrées), **dans l'ordre du catalogue**, qui est celui du jeu et donc celui
  du Droidex. Le retrier par rareté puis par nom donnait une grille sans
  rapport avec ce qu'on voit en jouant. L'ordre des raretés ne sert donc plus
  qu'à celui des listes déroulantes. Une carte cliquée bascule sur l'onglet Ajouter
  avec le formulaire pré-rempli (`editerDroide()`) ; le bouton 🗑 dans son
  coin supprime directement (confirmation, `stopPropagation()` pour ne pas
  aussi ouvrir la modification).
- **Ajouter** : formulaire nom/classe/rareté, icône (photo perso, compression
  via `comprimerImage()` dans `script.js`, partagée avec `suivi.js` — toujours
  pas de visuel officiel du jeu) et **grille prix/rendement par palier**.
  Cliquer l'onglet directement repart d'un formulaire vide
  (`ouvrirOngletAjout()`) ; Enregistrer ou Annuler ramène à l'onglet Droïdes.
- **Renaissance** : un palier par ligne — niveau, crédits (valeur + unité) et
  droïdes requis. Les modifications s'enregistrent au changement de champ.
  C'est ici qu'on ajoute un niveau, le bouton flottant de `suivi.html` ayant
  été retiré. Les droïdes requis se choisissent dans deux listes (droïde puis
  palier, celui-ci limité aux paliers où le droïde existe) et s'affichent en
  pastilles retirables : les saisir à la main rendait une faute de frappe
  invisible, le droïde devenant introuvable et perdant son visuel. Le format
  **enregistré** ne change pas (« CB (Défaut), Pit (Or) ») — les données déjà
  saisies restent valables, et un nom qui ne correspond à rien est conservé en
  pastille marquée plutôt que jeté.
- **Paliers** : liste ordonnée avec ↑/↓/Supprimer **et un sélecteur de
  couleur par palier** (`<input type="color">`, change immédiatement à
  l'enregistrement).

**La couleur du contour d'une carte de droïde est celle du palier actif**
(pas une couleur propre à chaque droïde) : dans `suivi.js`,
`afficherDroidex()` cherche la couleur de `palierActif` dans `paliers` et
l'applique en style inline à toutes les cartes affichées. `DroidFortnite/paliers.json`
est donc passé d'un tableau de chaînes à un tableau d'objets
`{ nom, couleur }` — `normaliserPaliers()` dans `script.js` reconnaît et
convertit à la volée l'ancienne forme (tableau de chaînes) pour ne rien
casser si le fichier existait déjà avant ce changement. Pas de renommage
possible (seulement ajout/suppression/réordonnancement) : renommer
casserait silencieusement les clés `"<idDroide>::<ancienNom>"` déjà
enregistrées dans les progressions personnelles.

`comprimerImage()` préserve la transparence de la source : elle exporte en
PNG si l'image redimensionnée contient un pixel non totalement opaque,
sinon en JPEG (plus léger) — un fond transparent (icône détourée) n'est
donc pas aplati en noir comme avec un export JPEG systématique.

## Favicon

Sans `<link rel="icon">`, un navigateur réclame `/favicon.ico` **à la racine du
domaine** — donc `team53fr.github.io/favicon.ico`, qui n'appartient pas à ce
dépôt (les pages, elles, vivent sous `/EditeurSite/`). D'où un 404 sur chaque
page. Chaque page déclare donc son icône, et chaque site a la sienne dans son
propre dossier :

| Site | Icône |
|------|-------|
| portail | boussole blanche sur indigo |
| editeur-livre | livre ouvert sur terracotta |
| droid-fortnite | tête de droïde sur bleu nuit |
| ma-bibliotheque | la sienne, antérieure |

Toutes sont générées par script plutôt que dessinées à la main — voir
l'historique Git si elles doivent être refaites.

## App installable (PWA)

Un site web ne peut pas livrer un fichier d'app (`.apk` / `.ipa`) : cela
demanderait un build natif et une signature. Il peut en revanche
**s'installer** — le téléphone crée une icône sur l'écran d'accueil et l'app
s'ouvre en plein écran, sans barre d'adresse. C'est le même site, juste rendu
installable. Ne fonctionne qu'en HTTPS (GitHub Pages), pas en ouvrant le
fichier en local.

**Le portail** (`manifest.json` + `sw.js` + `icone-192/512.png` à la racine)
est installable sous le nom **« Site Guide »**, avec une portée à la racine :
**une seule icône couvre les trois sites**, qui vivent sur la même origine.
Le nom vient du manifeste (`name`/`short_name`) et, sur iOS, du meta
`apple-mobile-web-app-title` présent sur chaque page du portail. Le tableau de
bord affiche un encart au-dessus de la liste des sites :

- Sur Android, il retient l'événement `beforeinstallprompt` du navigateur
  (`preventDefault()`) pour déclencher l'installation depuis son propre
  bouton, plutôt que de laisser le navigateur choisir son moment.
- Sur iPhone, Safari n'expose rien de tel : l'encart y explique le geste
  (*Partager* → *Sur l'écran d'accueil*) et masque le bouton.
- Il disparaît une fois l'app installée (`appinstalled`, ou `display-mode:
  standalone` au chargement) ; la croix le masque définitivement
  (`team53_encart_app` en `localStorage`).

**ma-bibliotheque** garde en plus son propre `manifest.json`/`sw.js`, et reste
donc installable séparément — utile pour n'avoir que ce site sur l'écran
d'accueil.

**Stratégie de cache : « réseau d'abord »**, dans les deux service workers, et
pour une raison apprise à ses dépens : en « cache d'abord », la coquille ne se
rafraîchit QUE lorsque le fichier `sw.js` change d'octets. Une page modifiée
restait donc périmée indéfiniment sur les appareils ayant déjà installé l'app
— une fonctionnalité pourtant retirée du code restait visible. Ces sites ont
de toute façon besoin du réseau en permanence (API GitHub) : autant s'en
servir pour rester à jour, et ne retomber sur le cache qu'hors connexion.

**Jamais de données en cache** : tout appel vers un autre domaine
(`api.github.com` en tête) n'est pas intercepté du tout. Un livre servi depuis
un cache périmé pourrait être réécrit par-dessus la version fraîche et perdre
du texte.

Le service worker racine ne précharge que la coquille du portail ; les pages
des sites se mettent en cache **à la visite**. Y lister les quarante fichiers
du dépôt les aurait fait rouiller au premier renommage. Conséquence : il faut
avoir visité un site **une fois en ligne** pour qu'il s'ouvre hors connexion.

Les icônes sont générées par script (boussole blanche sur fond indigo) plutôt
que dessinées à la main — voir l'historique Git si elles doivent être refaites.

**Renommer ou changer l'icône** oblige à incrémenter `CACHE_NOM` dans `sw.js` :
sans ce renommage, l'ancien manifeste et l'ancienne icône continueraient d'être
servis depuis le cache déjà installé sur les appareils. Et sur le téléphone,
le nom et l'icône affichés sous l'app ne se rafraîchissent souvent qu'après
l'avoir désinstallée puis réinstallée.

**Pages de connexion et bouton « retour »** : chaque `connexion.html` (portail
et sites) commence par une garde qui renvoie vers la page d'arrivée si une
session existe déjà. Toutes les redirections de garde et de déconnexion
utilisent `location.replace()` et non `location.href` : pousser une entrée
d'historique ferait que « retour », dans l'app installée, promène l'utilisateur
à travers des pages de connexion qu'il a déjà traversées — c'était le cas avant
correction.

> **Non vérifiable dans l'environnement de développement** : le navigateur
> intégré refuse toute inscription de service worker (le `sw.js` de
> ma-bibliotheque, en production, échoue exactement pareil). Le manifeste, les
> icônes et la logique du bouton sont testés ; le comportement du service
> worker ne l'est qu'une fois déployé.
