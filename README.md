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
├── supabase/
│   └── schema-compte-central.sql   # table users, connexion()/inscription()/est_admin()
├── sites/
│   ├── editeur-livre/    # site "Éditeur de livre en ligne" (ex-racine du dépôt)
│   │   ├── index.html
│   │   ├── supabase/schema.sql
│   │   └── ...
│   ├── ma-bibliotheque/  # site "Ma Bibliothèque" (répertorie les livres possédés)
│   │   ├── index.html
│   │   ├── supabase/schema.sql
│   │   └── ...
│   └── droid-fortnite/   # site "Droid Fortnite" (suivi de Star Wars: Droid Tycoon)
│       ├── index.html
│       ├── supabase/schema.sql
│       └── ...
└── README.md
```

Toutes les données (comptes + les 3 sites) vivent dans un seul projet
Supabase — voir « Stockage : Supabase » plus bas. Ces fichiers `.sql` ne sont
que la définition du schéma (tables, RLS, fonctions), rejouée manuellement
dans l'éditeur SQL de Supabase à chaque changement ; il n'y a pas de système
de migration automatisé pour l'instant.

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
   dans la constante `DEFAULT_SITES` du `script.js` racine (voir « Connexion
   centrale » ci-dessous) : `{ id, nom, description, icone, pageArrivee }`.
4. Pour qu'il reconnaisse la session sans redemander de mot de passe, copier
   dans son `script.js` les fonctions réseau (`requeteSupabase`,
   `appelerFonctionSupabase`) et de session (`exigerConnexion()`,
   `seDeconnecter()`) d'un site existant — tous les sites vivant sur la même
   origine, ils lisent directement les mêmes clés `team53_*` en
   `localStorage`, sans rien à recopier d'un site à l'autre.

## Hébergement

Servi via GitHub Pages depuis la racine du dépôt. Chaque site est donc
accessible sous `https://<utilisateur>.github.io/EditeurSite/sites/<nom-du-site>/`,
et le portail racine sous `https://<utilisateur>.github.io/EditeurSite/`.

## Stockage : Supabase

Ces sites n'ont pas de backend applicatif à eux, mais ils ne sont plus « sans
serveur » pour autant : toutes les données (comptes, catalogue Droid Fortnite,
livres, bibliothèques personnelles) vivent dans le projet **Supabase
`SiteWeb`** (`uxedmplaeuonhhpxqpse`) — Postgres + API REST auto-générée
(PostgREST) + Storage pour les images. Jusqu'en septembre 2026, cette même
donnée vivait dans des fichiers JSON écrits via l'API Contents du dépôt privé
`Team53FR/BDD` ; ce dépôt existe toujours, mais uniquement comme **sauvegarde
en lecture seule** (voir « Sauvegarde automatique » ci-dessous), plus jamais
comme base active.

**Authentification maison, pas Supabase Auth.** Les comptes vivent dans
`public.users` (`login`, `password_hash` en bcrypt, `role`, `nom_affichage`,
`acces: [siteId,...]`) — un choix délibéré pour garder le flux de connexion
identique à l'ancien (identifiant + mot de passe, jamais d'email demandé).
Les fonctions Postgres `connexion()`/`inscription()` vérifient le mot de
passe puis **signent elles-mêmes un vrai jeton JWT** (HMAC-SHA256, via
`pgcrypto`), lu ensuite par PostgREST pour appliquer les règles RLS comme si
c'était Supabase Auth qui l'avait émis — `auth.uid()` retourne le bon
identifiant sans que Supabase Auth soit jamais impliqué. Voir
`supabase/schema-compte-central.sql` à la racine du dépôt.

**Sécurité côté serveur, pas côté client.** Chaque table sensible a ses
règles RLS (`for all using (auth.uid() = user_id)` pour les données
personnelles, lecture publique + écriture admin pour les catalogues
partagés) : un utilisateur ne peut physiquement pas lire ou modifier les
données d'un autre, quoi que l'interface affiche. Les opérations qui ne
rentrent pas dans une simple règle RLS (vérifier un mot de passe, créer un
compte, promouvoir un admin) passent par des fonctions `security definer`
dédiées, elles-mêmes gardées par `est_admin()`/`auth.uid()` en interne.

**Deux appels génériques**, copiés à l'identique dans le `script.js` de
chaque site : `requeteSupabase(chemin, options)` pour lire/écrire une table
via `/rest/v1/...`, `appelerFonctionSupabase(nom, params)` pour appeler une
fonction Postgres via `/rest/v1/rpc/...`. Le jeton de la session en cours (ou
la clé publique si personne n'est connecté) part systématiquement en
`Authorization: Bearer` — RLS décide du reste.

**Images** : trois buckets Storage publics en lecture (`droid-fortnite`,
`editeur-livre`, `ma-bibliotheque`), écriture réservée au propriétaire du
chemin (`(storage.foldername(name))[1] = auth.uid()::text` pour les sites à
compte, admin uniquement pour le catalogue Droid Fortnite). Chaque ligne de
table stocke directement l'URL publique — plus besoin de la reconstruire ni
de la mettre en cache côté client, contrairement à l'ancienne API Contents.

Schéma par site (tables, RLS, index) :

| Site              | Fichier de schéma                          | Tables principales |
|-------------------|---------------------------------------------|---------------------|
| portail central    | `supabase/schema-compte-central.sql`        | `users` (tous les comptes, partagée par les 4 propriétés) |
| editeur-livre      | `sites/editeur-livre/supabase/schema.sql`   | `livres`, `livre_spreads` |
| ma-bibliotheque    | `sites/ma-bibliotheque/supabase/schema.sql` | `bibliotheque_items` |
| droid-fortnite     | `sites/droid-fortnite/supabase/schema.sql`  | `droides`, `droide_paliers`, `paliers`, `unites`, `raretes`, `classes`, `fusions`, `fusion_ingredients`, `renaissance_niveaux` (partagées) ; `progression`, `droides_possedes`, `renaissance_atteinte`, `escouade_slots`, `escouade_places` (personnelles) |

Les trois sites suivent le **même modèle par compte** pour leurs données
personnelles : chaque table personnelle porte une colonne `user_id`
(= `auth.uid()`, dérivé du jeton), et RLS ne laisse jamais un compte voir ou
modifier les lignes d'un autre. Droid Fortnite s'en écarte comme avant : le
catalogue (`droides`, `paliers`, `raretes`, `classes`, `fusions`,
`renaissance_niveaux`...) est **partagé**, identique pour tout le monde et
géré uniquement depuis `admin.html` — seule la progression personnelle
(`progression`, `droides_possedes`, `renaissance_atteinte`,
`escouade_slots`/`escouade_places`) est propre à chaque compte. Voir
« Droid Fortnite » ci-dessous.

Pour qu'un site fonctionne, il suffit qu'un compte de `users` porte son
identifiant dans sa colonne `acces` — ce que fait le panneau admin du
portail (`admin-comptes.html`). Aucune ligne à créer dans une table du site :
supprimer un compte purge automatiquement ses données personnelles sur les
trois sites, via des clés étrangères `on delete cascade` — plus besoin d'un
outil de purge manuel comme du temps des fichiers JSON.

## Sauvegarde automatique

Le dépôt `Team53FR/BDD` reste utile comme **filet de sécurité**, même s'il
n'est plus lu par aucun site : un workflow GitHub Actions
(`.github/workflows/sauvegarde-supabase.yml`, dans ce dépôt BDD — pas dans
celui-ci) exporte **chaque dimanche** les 18 tables du projet Supabase en
JSON brut (`scripts/sauvegarder-supabase.mjs`), un fichier par table, sous un
dossier `Supabase/` à la racine du dépôt BDD — à côté des anciens dossiers
`Old/DroidFortnite`, `Old/EditeurLivre`, etc., conservés tels quels comme
dernière image du système précédent.

Le script utilise la clé **`service_role`** (secret GitHub Actions
`SUPABASE_SERVICE_ROLE_KEY` sur le dépôt BDD, jamais exposée côté client) pour
contourner RLS et tout exporter, y compris les données personnelles de chaque
compte — c'est le but d'une sauvegarde complète. Le workflow ne commit que
s'il y a un vrai changement, et se relance aussi à la main depuis l'onglet
Actions de GitHub (`workflow_dispatch`) pour un instantané à la demande. C'est
un export **à sens unique** : rien ne relit jamais ce dépôt pour écrire vers
Supabase, ce n'est pas une double-écriture.

## Connexion centrale

Un seul compte (racine du dépôt : `index.html` / `connexion.html` /
`tableau-de-bord.html` / `admin-comptes.html`) donne accès, depuis un tableau
de bord unique, à tous les sites que l'administrateur a autorisés — plus
besoin de se reconnecter séparément à chaque site.

Les comptes centraux vivent dans la table `public.users` (Supabase) :
`login`, `password_hash` (bcrypt), `role` (`admin`/`user`), `nom_affichage`,
`acces` (tableau des identifiants de site, ex. `["editeur-livre",
"droid-fortnite"]`), plus `derniere_connexion`, `tuto_biblio_vu` et
`tuto_editeur_vu`. `acces` décide de ce qu'on voit sur le tableau de bord
**et**, via RLS, de ce à quoi on peut réellement lire/écrire : ce n'est plus
une simple vérification côté client à contourner, c'est la base de données
elle-même qui refuse.

Le registre des sites affichables est une constante `DEFAULT_SITES` dans le
`script.js` racine (`{ id, nom, description, icone, pageArrivee }` par site) —
`Web/sites.json` n'a jamais eu besoin d'exister, ce repli est donc devenu la
seule source.

**Session partagée, sans rien à recopier.** Les 4 propriétés vivent sur la
même origine GitHub Pages : une connexion pose `team53_token` (le JWT signé
par `connexion()`), `team53_id`, `team53_login`, `team53_role`, `team53_nom`
et `team53_acces` dans `localStorage`, que chaque site relit directement.
L'ancien « relais d'identifiants » (le portail préremplissait les clés
propres à chaque site avant d'y naviguer, du temps où chaque site avait son
propre token GitHub) a disparu avec les tokens propres à chaque site : il n'y
a plus qu'une seule session à lire, `relayerVersSite()` se contente donc de
vérifier `acces` avant de naviguer vers `pageArrivee`.

**Fraîcheur de la session** : le rôle, le pseudo et la liste des accès sont
recopiés sur l'appareil à la connexion, pour ne pas relire le compte à chaque
page. Le tableau de bord les **relit à chaque ouverture**
(`rafraichirSessionCentrale()`), sans quoi un accès accordé à l'instant
n'apparaîtrait qu'à la connexion suivante. Un compte disparu de la table
ferme la session ; une lecture qui échoue laisse la copie en place, plutôt
que de priver quelqu'un de son tableau de bord pour une coupure réseau.

**Déconnexion** : elle efface toutes les clés `team53_*` et renvoie vers
`connexion.html` du portail — comme il n'y a plus qu'une session unique
(là où chaque site avait autrefois la sienne), il n'y a plus rien d'autre à
fermer.

**Création des comptes** : plus d'amorçage automatique au premier lancement
(la table `users` existe déjà, créée par la migration). Un compte se crée
soit par auto-inscription (`inscription()`, fonction Postgres qui hache le
mot de passe et connecte aussitôt), soit depuis le panneau admin
(`admin_creer_compte()`), qui peut fixer le rôle et les accès dès la
création.

**Un seul mot de passe, partout.** Le changer depuis « Mon compte »
(`changer_mon_mot_de_passe()`) vaut immédiatement sur les 4 propriétés : il
n'y a plus de copie à synchroniser, ni de risque que deux fichiers divergent
— il n'y a qu'une ligne, dans une seule table.

Révoquer un accès dans le panneau admin retire la carte du tableau de bord
**et** ferme la connexion directe au site : la prochaine requête vers une
table de ce site se heurte à RLS, il n'y a plus de mot de passe ailleurs pour
contourner. La vérification n'est donc plus seulement côté client — RLS la
fait respecter même si l'interface était trafiquée.

## Mon compte

`compte.html` — accessible depuis le tableau de bord, sans droit particulier :
chacun y change son **pseudo** et son **mot de passe**, et consulte ses
**statistiques** (rôle, dernière connexion, puis un bloc par site : livres,
pages et mots écrits ; entrées de la bibliothèque ; droïdes possédés et
escouade).

Deux précautions, devenues plus simples qu'à l'époque des fichiers JSON :

- L'écriture ne touche **que sa propre ligne** (`update ... where id =
  auth.uid()`, imposé par RLS) : impossible d'écraser ce qu'un administrateur
  aurait changé sur un autre compte entre-temps, puisque la requête ne peut
  physiquement pas viser une autre ligne.
- Un changement de mot de passe ou de pseudo vaut **immédiatement partout** :
  les 4 propriétés lisent la même table.

L'identifiant de connexion, lui, ne se change pas : il sert de clé aux
données personnelles de chaque site (`user_id` dans `progression`, `livres`,
`bibliotheque_items`...).

### Supprimer un compte

Supprimer un compte (`admin.js` racine, un simple `DELETE users?id=eq...`)
purge **automatiquement** tout ce qu'il possédait sur les trois sites — livres,
bibliothèque, progression Droid Fortnite — via des clés étrangères `on delete
cascade` posées sur chaque table personnelle. Contrairement à l'époque des
fichiers JSON, il n'y a plus de seconde question ni d'outil de purge séparé à
maintenir : la base de données garantit elle-même qu'aucune donnée orpheline
ne survit à son propriétaire. C'est donc, à l'inverse d'avant, **irréversible
dès la confirmation** — le message d'avertissement du panneau admin le dit
explicitement.

## Fonctionnalités non reprises dans la bascule Supabase

Deux outils existaient du temps des fichiers JSON et n'ont **pas** été
reconstruits lors du passage à Supabase, par choix explicite (hors périmètre
de cette passe, pas un oubli) :

- **Le transfert de bibliothèque entre comptes** (`transfererBibliotheque()`,
  `CONFIG_TRANSFERT` dans l'ancien `admin.js` racine) — réaffecter toute la
  bibliothèque d'un compte à un autre, utile par exemple si un compte est
  remplacé par un autre. La suppression en cascade (voir « Supprimer un
  compte ») couvre le cas qui motivait surtout cet outil — purger proprement
  les données d'un compte abandonné — mais pas le vrai transfert d'un compte
  vers un autre. À reconstruire plus tard si le besoin revient, avec une vraie
  requête `UPDATE ... SET user_id = ...` par table plutôt que l'ancien
  mécanisme fichier par fichier.
- **L'import en masse des anciens `users.json`** vers le compte central, et le
  passage de **Ma Bibliothèque** d'un compte unique partagé à un compte par
  personne — deux migrations à usage unique, dont le travail est déjà fait et
  qui n'ont donc plus de raison d'exister. Leur code reste dans l'historique
  Git si un dépôt neuf en avait besoin.

## Éditeur de livre

**Modèle de texte** : la source de vérité est `livre.spreads[]` — une entrée
par double-page, le texte continu tel qu'il est saisi. `livre.pages[]` en est
**dérivé** (`calculerDeuxPages()` découpe chaque double-page en deux) et sert
au sommaire, à l'aperçu, à l'impression et à `lecture.js`. Ne jamais écrire
dans `pages[]` en pensant modifier le livre : `remplacerTout()` l'a fait une
fois, et la fonction « Remplacer tout » n'avait aucun effet visible.

La session (`team53_token`, `team53_login`, `team53_role`, `team53_nom`...)
vit en `localStorage`, partagée avec le portail et les deux autres sites (voir
« Connexion centrale »). Seul `livre_id` — quel livre est ouvert — reste en
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

1. la **photo perso** ajoutée au droïde depuis `admin.html`, compressée côté
   client puis envoyée dans le bucket Storage public `droid-fortnite`
   (`images/<id>.<ext>`, voir « Stockage : Supabase ») — la ligne du droïde
   stocke directement l'URL publique renvoyée, affichable telle quelle ;
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

La liste des unités vit dans la table **`unites`** (K, M, B, T au départ) et
s'édite depuis l'onglet **Unités** du panneau admin, pour le jour où
les montants du jeu dépasseront le billion. Supprimer une unité ne perd aucune
donnée : les montants sont en crédits, seule leur présentation change.
`formaterCredits()` s'appuie sur cette liste — d'où « 1.2 B » et non plus
« 1.2 Md ».

**Les droïdes Iconiques ne fonctionnent pas comme les autres** : ils n'existent
qu'au premier palier et leur rendement est un **pourcentage du revenu total**,
pas des crédits par seconde. Le formulaire ne leur propose donc qu'une seule
ligne, avec l'unité `%` sélectionnée d'office ; la valeur est alors stockée
telle quelle (« 25% »). Le `%` n'est jamais proposé pour un prix, ni ajoutable
dans la table `unites` : ce n'est pas un facteur, c'est une autre nature de valeur.

Ce pourcentage est **appliqué** au rendement total de l'escouade :
`effectif = crédits × (1 + %/100)`. Ce total, et lui seul, est mis en avant
**par heure** — l'échelle à laquelle on compare des escouades — avec la valeur
par seconde à côté pour recouper avec le jeu. Les sections et les cartes
restent par seconde, comme le jeu les affiche et comme on les saisit. Le détail du calcul reste affiché sous le
résultat (« 185.6 K/s + 50 % ») — sans quoi on ne saurait pas d'où sort le
chiffre. Il ne majore que le **total**, jamais le sous-total d'une classe :
il porte sur le revenu global, pas sur celui d'une section, qui indique donc
seulement ce qu'elle apporte et ce qu'elle contribue en pourcentage.

> À noter : la rareté d'un droïde **ne change pas** d'un palier à l'autre
> (vérifié sur les 379 entrées du tracker communautaire : Mouse reste Common
> partout). Seul le rendement varie — d'où l'indexation par palier et non par
> rareté.

**Données partagées** : les tables `droides`/`droide_paliers` et
`renaissance_niveaux` sont communes à tous les comptes du site (contrairement
aux tables personnelles, filtrées par `user_id`). Elles se gèrent
**uniquement depuis `admin.html`** : `suivi.html` ne fait que suivre la
progression, et n'a plus de bouton d'ajout. Le vrai catalogue (92 droïdes,
590 lignes de paliers, 35 niveaux de renaissance...) a été importé une fois
pour toutes lors de la migration vers Supabase ; les constantes
`CATALOGUE_INITIAL`/`RENAISSANCE_INITIALE` de `script.js` ne servent plus
qu'à amorcer un catalogue vide sur un déploiement neuf, plus à « réparer »
des tables déjà peuplées.

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

**Écriture de la progression — regroupée, jamais à chaque clic.** Un héritage
de l'époque des commits GitHub (enregistrer à chaque changement en produisait
un par droïde coché, et l'historique grossissait au point que GitHub finissait
par afficher « Cannot retrieve latest commit at this time ») gardé tel quel
avec Supabase, où il reste une bonne pratique pour éviter une rafale de
requêtes réseau. `marquerProgressionModifiee()` ne fait que programmer
l'écriture, qui a lieu après deux secondes sans nouveau changement (voir
`persisterPerso()`/`sauvegarderPerso()` dans `suivi.js`) — cinquante clics
d'affilée ne font plus qu'un aller-retour. Trois filets : masquer l'onglet ou
quitter la page écrit tout de suite ce qui attend, `beforeunload` prévient si
l'écriture n'a pas abouti, et deux écritures ne peuvent pas partir en même
temps (la seconde attend que la première finisse).

Chaque table personnelle (`droides_possedes`, `renaissance_atteinte`,
`escouade_slots`, `escouade_places`) est **remplacée en entier** à chaque
sauvegarde : toutes les lignes du compte sont retirées puis l'état local
courant est réinséré — le même principe que l'ancien « relire le sha,
réécrire le fichier entier », transposé aux tables normalisées. Sûr ici
puisque RLS garantit qu'un seul compte écrit jamais ces lignes.

À noter : `ma-bibliotheque` n'a jamais eu ce défaut — y cocher un tome ou un
épisode ne modifie que l'état local, l'écriture n'ayant lieu qu'à la validation
du formulaire.

**Écriture des tables partagées — tout le tableau, pas ligne par ligne** : le
panneau admin retraite le tableau JS **entier** à chaque modification (upsert
de toutes ses lignes, puis suppression de celles qui ont disparu —
`remplacerTableEntiere()` dans `admin.js`), exactement comme
`catalogue.json`/`renaissance.json` étaient réécrits en entier avant. Une
différence avec l'ancien `sauvegarderAvecFusion()` : celui-ci relisait le
contenu distant et y fusionnait les entrées locales absentes par `id`, pour ne
jamais perdre l'ajout d'un autre admin survenu entre-temps ; la version
Supabase ne fait plus cette fusion — la dernière sauvegarde gagne sur le
tableau entier. Sans conséquence en pratique (les admins n'éditent jamais le
catalogue à deux en même temps), mais à garder en tête si ça devait changer.
Une ligne encore utilisée ailleurs (une rareté portée par des droïdes, par
exemple) refuse sa suppression — RLS et les clés étrangères font respecter
cette contrainte côté serveur, avec un message d'erreur repris tel quel dans
l'interface plutôt que de laisser passer silencieusement une donnée orpheline.

**Onglet Renaissance — recherche « puis-je le vendre ? »** (`verifierVenteDroide()`
dans `suivi.js`) : un champ cherche un droïde par son nom (sans avoir à le
retrouver dans la liste des paliers) et répond par la même pastille 🔒/💰 que
sur chaque élément affiché — sauf que la question posée est différente.
`marqueurUtilite()` (existant, posé sur un élément précis) compare aux
niveaux plus loin que celui affiché ; `besoinsRestants()` (nouveau) ignore le
niveau affiché et ne compte comme un besoin que les paliers PAS ENCORE
cochés de la super renaissance actuelle, à n'importe lequel de leurs niveaux
— la question qu'on se pose en tenant un droïde en main, loin de la liste.
Se rafraîchit avec le reste de l'onglet (changement de super renaissance,
case cochée/décochée) puisqu'appelé à la fin d'`afficherRenaissance()`.

**Raretés** : la table `raretes` porte la liste complète, éditable depuis
l'onglet **Raretés** du panneau admin — ajout, suppression, réordonnancement
et couleurs (fond + texte).

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

**Types de droïde** : la table `classes` (`nom`, `icone`, `image`, amorcée
avec Ouvrier/Astromec/Combat) porte la liste, éditable depuis l'onglet
**Types** du panneau admin — ajout, icône (un emoji) et suppression. Comme
`raretes`/`unites`, la variable `classes` est déclarée une seule fois dans
`script.js` (pas dans chaque page) et réassignée après chargement : le reste
du code partagé (`iconeClasse()`, les `<select>` remplis par
`remplirSelectClasses()`) la lit directement, sans qu'on la lui passe. Pas de
réordonnancement (l'ordre n'a aucun effet côté jeu, contrairement aux
raretés/paliers) ; au moins un type doit toujours rester, et supprimer un
type encore porté par des droïdes avertit plutôt que de bloquer (ils le
gardent, simplement sans icône propre — même logique que la suppression
d'une rareté encore utilisée).

Un type ajouté ici obtient aussitôt sa propre section d'escouade dans
l'onglet **Rendement** : `CLASSES_ESCOUADE` (dans `suivi.js`) suit désormais
`classes.map((c) => c.nom)` au lieu d'une liste figée, et `escouade()`
initialise déjà n'importe quelle classe absente de la progression stockée
(mêmes emplacements par défaut) — rien à migrer.

**Un palier peut porter plusieurs couleurs.** `couleur` est soit une chaîne,
soit un tableau ; à partir de deux, le contour des cartes devient un dégradé —
c'est ainsi qu'« Arc-en-ciel » en est un vrai. Une bordure CSS ne pouvant pas
être un dégradé, et `border-image` ignorant `border-radius` (coins carrés),
`appliquerContourPalier()` superpose deux fonds : l'intérieur opaque rogné sur
la boîte de padding, le dégradé rogné sur la boîte de bordure. Les coins
restent ronds.

**Le gestionnaire sur mobile.** Ses grilles à colonnes (prix/rendement par
palier, paliers de renaissance) sont pensées pour un écran large : en dessous
de 620 px, la colonne de saisie tombait à une vingtaine de pixels — un champ
où l'on ne voyait pas ce qu'on tapait. Elles s'empilent donc, chaque valeur
précédée de son intitulé puisque les en-têtes de colonnes sont masqués. Et la
barre d'onglets défile horizontalement au lieu de s'étirer : à six onglets,
`flex: 1` les comprimait jusqu'à pousser toute la page hors de l'écran.

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
l'applique en style inline à toutes les cartes affichées. La table `paliers`
porte `{ nom, couleur, ordre }` — `couleur` est un `text[]` Postgres (une
seule couleur, ou plusieurs pour un dégradé) — et `normaliserPaliers()` dans
`script.js` reconnaît encore l'ancienne forme (simple tableau de chaînes,
héritée des fichiers JSON) pour ne rien casser sur d'anciennes données. Pas de
renommage possible (seulement ajout/suppression/réordonnancement) : renommer
casserait silencieusement les lignes `(droide_id, palier)` déjà enregistrées
dans les progressions personnelles. `ordre` n'est volontairement **pas**
unique en base (contrairement à une première version du schéma) : seul
l'ordre relatif compte, une contrainte d'unicité obligeait sinon à échanger
deux rangs en deux temps pour réordonner.

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
de toute façon besoin du réseau en permanence (Supabase) : autant s'en servir
pour rester à jour, et ne retomber sur le cache qu'hors connexion.

**Jamais de données en cache** : tout appel vers un autre domaine (Supabase en
tête) n'est pas intercepté du tout. Un livre servi depuis un cache périmé
pourrait être réécrit par-dessus la version fraîche et perdre du texte.

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
