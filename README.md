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
├── mentions-legales.html      # \
├── confidentialite.html       #  | pages légales, communes aux 4 propriétés
├── cookies.html               #  | (voir « Pages légales » plus bas)
├── conditions-utilisation.html#  |
├── legal.css                  # /  leur mise en page
├── pied-legal.js           # pose les liens légaux en bas des autres pages
├── polices/                # EB Garamond + Orbitron servies par le site
│   ├── polices.css         # les @font-face
│   ├── *.woff2
│   └── LICENCE-*.txt       # SIL OFL 1.1, à conserver avec les fichiers
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
│   ├── droid-fortnite/   # site "Droid Fortnite" (suivi de Star Wars: Droid Tycoon)
│   │   ├── index.html
│   │   ├── supabase/schema.sql
│   │   └── ...
│   ├── recto-verso/      # site "Recto-verso" (image au recto, cartes à message au verso)
│   │   ├── index.html    # tout se passe dans le navigateur : pas de base, pas de compte requis
│   │   ├── style.css
│   │   └── app.js
│   └── worldmap/         # site "WorldMap" (cartes de mondes et de régions de fantasy)
│       ├── index.html    # galerie ; l'éditeur est editeur.html
│       ├── moteur.js     # rendu vectoriel, zoom infini ; cartes en IndexedDB, pas de compte
│       └── ...
└── README.md
```

Toutes les données (comptes + les 3 sites qui en ont) vivent dans un seul projet
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

## Pages légales

Quatre pages à la racine, communes au portail et aux quatre sites :
`mentions-legales.html`, `confidentialite.html`, `cookies.html` et
`conditions-utilisation.html`. Un seul texte à tenir à jour plutôt qu'un jeu
par site.

`pied-legal.js` pose les liens vers ces pages en bas de toutes les autres.
Il déduit le chemin de la racine de sa propre adresse (`document.currentScript`),
ce qui lui évite des `../../` codés en dur, et emporte son propre style : les
quatre sites n'ont aucune variable de couleur en commun, donc le pied
s'appuie sur `color: inherit` et une opacité pour s'accorder à chacun.

Pour ajouter le pied à une nouvelle page, une ligne avant `</body>` :

```html
<script src="../../pied-legal.js"></script>
```

Deux pages seulement ne l'appellent pas : `editeur.html` et `lecture.html`,
qui occupent toute la fenêtre et n'ont pas de bas de page où le poser. Les
quatre pages légales ne l'appellent pas non plus — elles portent déjà leurs
liens les unes vers les autres. Une page qui reçoit le script mais n'en veut
pas peut aussi porter `data-sans-pied` sur son `<body>`.

**Piège : `pied-legal.js` met le `<body>` en colonne flex** (classe `a-pied-legal`, pour coller le
pied en bas de page). Dans une colonne flex, un bloc qui a `margin: 0 auto` ne s'étire plus : il se
réduit à la largeur de son contenu, `max-width` ou pas. Tout bloc de page centré de cette façon
doit donc aussi porter `width: 100%`. Découvert quand la grille des droïdes est tombée à une seule
colonne étroite (`.contenu` mesurait 312 px sur un écran de 1900) ; la même cause rétrécissait
`.contenu` de Ma Bibliothèque, et la barre du haut, le titre et le contenu du portail et de « Mon
compte » (203 px au lieu de 992). Corrigé dans `style.css` (racine), `sites/ma-bibliotheque/style.css`,
`sites/droid-fortnite/style.css` et `sites/recto-verso/style.css`. L'éditeur de livre n'est pas
touché (sa classe `.contenu` avait déjà `width: 100%`). Une nouvelle page qui centre un bloc avec
des marges automatiques et charge ce script doit faire de même.

Trois points de fond, à garder en tête si le site change :

- **L'éditeur reste anonyme**, ce que la LCEN (art. 6, III, 2°) autorise pour
  un éditeur non professionnel **à la condition** que son identité ait été
  communiquée à l'hébergeur. Si cette condition cesse d'être remplie, les
  mentions légales doivent nommer l'éditeur.
- **Aucun cookie, aucun traceur** : d'où l'absence de bandeau de consentement.
  Ajouter une mesure d'audience ou un bouton de réseau social changerait cela
  et rendrait un bandeau obligatoire.
- **Aucun appel à un tiers hors action de l'utilisateur.** Les polices sont
  servies par le site (voir plus bas) ; les seuls appels extérieurs sont les
  catalogues de livres et de séries, déclenchés par une recherche, et le CDN
  du scanner de code-barres. Tous sont listés dans `confidentialite.html` :
  en ajouter un suppose de l'y déclarer.

## Polices

EB Garamond (les sites « papier », Recto-verso compris) et Orbitron (Droid Fortnite) sont
servies depuis `polices/` et non depuis Google Fonts. Charger une police
depuis `fonts.gstatic.com` envoie l'adresse IP du visiteur à Google à chaque
page, sans consentement possible : c'est un transfert de donnée personnelle
vers un tiers, et il a déjà valu des condamnations en Europe.

Les deux familles sont sous licence SIL Open Font License 1.1, qui autorise
cette redistribution ; les fichiers `LICENCE-*.txt` doivent rester à côté des
`.woff2`.

Une page qui a besoin d'une police ajoute, **avant** sa propre feuille de
style :

```html
<link rel="stylesheet" href="../../polices/polices.css">
```

Les fichiers sont dédoublonnés : ce sont des polices variables, une même
ressource sert donc plusieurs graisses. Les déclarations `@font-face`, elles,
restent découpées par graisse comme chez Google, pour un rendu identique.
Seuls les sous-ensembles `latin` et `latin-ext` sont repris.

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

## Sécurité : où passe vraiment la frontière

Le dépôt `Team53FR/EditeurSite` est **public**, et le resterait-il pas que cela
ne changerait rien : un site statique livre son code au navigateur de chaque
visiteur. La clé `sb_publishable_…` présente dans le JS est faite pour être
publique. **Rien de ce qui est envoyé au navigateur ne protège quoi que ce
soit.** La seule frontière est côté serveur : RLS, droits de colonne, et les
contrôles internes des fonctions `security definer`.

Ce que cela implique, concrètement :

- **Tout ce qui doit rester privé doit l'être par une policy**, jamais par
  l'interface. Une page qui « ne montre pas » un bouton ne protège rien.
- **Une fonction `security definer` est une porte dans le mur.** Elle doit soit
  vérifier `est_admin()` / `auth.uid()` dans son corps (c'est le cas de
  `admin_creer_compte`, `admin_definir_mot_de_passe`, `changer_mon_mot_de_passe`),
  soit n'être accordée à personne. Un `grant … to anon` sur une telle fonction
  est une décision de sécurité, pas un détail de confort.
- **Révoquer à `anon` ne suffit pas** : Postgres accorde `EXECUTE` à `PUBLIC`
  par défaut sur toute fonction. Il faut `revoke … from public` aussi.
- **`auth.uid()` vaut NULL pour un visiteur anonyme**, et `NULL` n'est pas
  `false`. Une condition du genre `auth.uid() = user_id or publie` laisse donc
  passer l'anonyme dès que `publie` est vrai : c'est exactement le défaut qui a
  rendu les livres publiés lisibles par tout Internet. Toute branche d'une
  policy qui ne compare pas `auth.uid()` doit porter son propre
  `auth.uid() is not null`.

Deux garde-fous posés après audit, à ne pas défaire sans le vouloir :

| Règle | Pourquoi |
|---|---|
| `inscription()` n'est accordée à personne | Les comptes se créent par `admin_creer_compte()`. Ouverte à `anon`, elle laissait n'importe qui s'ouvrir un compte — et, devenu « connecté », déposer des fichiers dans le Storage. |
| Un livre publié exige une session pour être lu | « Publié » veut dire lisible par les autres **comptes**, ce que promettent les conditions d'utilisation — pas par tout Internet. |

Points connus, non corrigés à ce jour : `connexion()` n'a **aucune limitation
de tentatives** (force brute possible), et les buckets Storage n'ont **ni
taille maximale ni type de fichier imposé**.

Après toute migration, relancer les analyseurs Supabase (`get_advisors`,
sécurité) : ils repèrent les tables sans RLS et les fonctions `definer`
exposées.

## Sauvegarde automatique

Le dépôt `Team53FR/BDD` reste utile comme **filet de sécurité**, même s'il
n'est plus lu par aucun site : un workflow GitHub Actions
(`.github/workflows/sauvegarde-supabase.yml`, dans ce dépôt BDD — pas dans
celui-ci) exporte **chaque dimanche** les 18 tables du projet Supabase en
JSON brut (`scripts/sauvegarder-supabase.mjs`), un fichier par table, sous un
dossier `Supabase/` à la racine du dépôt BDD — à côté des anciens dossiers
`Old/DroidFortnite`, `Old/EditeurLivre`, etc., conservés tels quels comme
dernière image du système précédent.

⚠ **La liste des tables exportées est écrite dans ce script**, dans le dépôt BDD :
une table créée après sa mise en place — `series` (séries de livres) et
`livre_notes` (notes de livre) — doit y être **ajoutée à la main**, faute de quoi
elle n'est pas sauvegardée. Les notes sont du texte qu'on ne retape pas : c'est
précisément ce que cette sauvegarde est censée protéger.

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

**Feuilles de garde** (`livres.gardes_debut` / `gardes_fin`) : des feuilles
blanches et **non foliotées**, au début et à la fin du livre — comme en ouvrant un
livre relié. Le bouton « ▭ Gardes » du sommaire les règle.

**Le réglage compte des FEUILLES, pas des pages** : une garde = un recto + un
verso, soit `PAGES_PAR_GARDE` = 2 pages (script.js). Une garde d'une seule page
n'existe pas sur le papier — l'autre face de la feuille est là de toute façon — et
elle faisait basculer tout le texte de côté. Les valeurs déjà enregistrées gardent
leur nombre mais changent de sens : un livre à « 1 garde » a désormais 2 pages
blanches, pas une (aucune migration : la colonne reste un entier de 0 à 20).
`nombreTotalGardes()` rend des **pages** (c'est ce que comptent le dos, les paliers
de marge et le décompte), `nombreFeuillesGarde()` des feuilles.

Tout tient dans une distinction que `feuilletsDuLivre()` (script.js) rend
explicite, et qu'il ne faut jamais confondre :

| | |
|---|---|
| `position` | le rang **physique** dans le livre. C'est lui, et lui seul, qui dit si la page est un recto (impair, à droite, reliure à gauche). |
| `numero` | le **folio imprimé**. Vide pour une garde ; le premier texte reste la page 1, quoi qu'on mette devant. |

Conséquence : **le texte reste du même côté**, la page 1 est toujours un recto.
Avec des gardes d'une page, une garde de plus au début le faisait basculer — la
fenêtre devait l'annoncer ; elle dit maintenant combien de pages blanches le
réglage ajoute (« 1 feuille (2 pages) avant le texte »).

Toute sortie du livre passe par `feuilletsDuLivre()` — aperçu, impression page
à page, livret, deux-pages-par-feuille, export KDP — et le calcul du dos
compte les gardes, qui sont du papier comme le reste. `creerPageTexteImpression`
et `creerPageKDP` reçoivent la position à part du folio : sans cela, une seule
garde mettait toutes les marges de reliure du mauvais côté.

**Le compteur de la barre latérale** annonce le total du livre relié sous la
forme « 409 pages (408 de texte + 1 de garde) » — `decomptePages()`, dans
`script.js`, la même formulation que le panneau d'export. Le détail montre
l'addition : l'ancien « dont 1 de garde » laissait croire que la garde était
déjà comprise dans les pages numérotées qu'on a sous les yeux.

Il a affiché un jour 410 pour un livre dont la dernière page était la 408 et qui
portait une garde. Le tableau `livre.pages` peut en effet garder une page de trop
quand une double-page de fin disparaît ; `sauvegarder()` le resynchronise (le test
`nbPages > nbSpreads * 2`) mais ne rappelait pas `majCompteurMots()` : l'étiquette
montrait l'état d'**avant** la resynchronisation, alors que la base recevait le
bon chiffre. Deux corrections : la sauvegarde rafraîchit le compteur avant l'envoi,
et `nombrePagesTexte()` régénère le tableau s'il dépasse 2 × le nombre de
doubles-pages. Seule cette borne **haute** est testée : la borne basse est violée
légitimement par une double-page finale encore vide, et la tester ici relancerait
la régénération complète à chaque frappe.

Le réglage est posé en mémoire et part avec la sauvegarde suivante, comme le
format ou l'interligne — surtout pas par `mettreAJourLivre()`, qui changerait
`maj_le` dans le dos de l'éditeur et ferait croire à la sauvegarde suivante que
le livre a été modifié ailleurs.

**Notes de livre** (table `livre_notes`, `notes.js` / `notes.css`) : des pages de
texte libre par livre, rangées en **onglets** (20 au plus), pour y poser les
idées — personnages, intrigues, pistes.
Deux entrées : la pastille de la carte, dans la bibliothèque, et le bouton
« 📝 Notes » du sommaire de l'éditeur, pour y revenir en cours d'écriture. Le
module construit sa propre fenêtre : la bibliothèque et l'éditeur n'ont pas les
mêmes feuilles de style, il emprunte leurs couleurs avec une valeur de repli.

**Pourquoi une table à part, et pas une colonne de `livres`.** La règle de lecture
de `livres` est « soi-même OU publié » : tout compte connecté lit la ligne
*entière* d'un livre publié. Une colonne `notes` aurait exposé les intrigues et
les spoilers de l'auteur à tous les autres comptes dès qu'il publie — le texte du
livre est fait pour être lu, ses notes non. `livre_notes` n'a aucune branche
« publié » : seul le propriétaire du livre y accède. Pour la même raison les notes
ne passent **jamais** par `versLigneLivre()` ni par l'enregistrement du livre :
elles s'enregistrent à part.

La clé primaire est l'identifiant du livre, d'où une règle d'insertion qui exige
que le livre soit à soi : sans elle, un compte pouvait poser des notes sur un livre
publié qu'il ne possède pas, et le vrai propriétaire ne pouvait plus créer les
siennes (la clé était prise). Vérifié en base : un autre compte ne lit, ne
modifie, ne supprime ni ne squatte rien, et un anonyme est refusé.

**L'enregistrement est automatique** (700 ms après la dernière frappe, et à la
fermeture) : une page d'idées s'écrit au fil de l'eau, et un bouton qu'on oublie
est une idée perdue. Il est conditionné par un numéro de **version** : deux
onglets ouverts sur les mêmes notes ne s'écrasent pas, le second à enregistrer
apprend qu'elles ont changé et choisit — recharger, ou garder sa version.
Le PATCH répond 200 même quand rien ne correspond ; c'est l'absence de ligne
renvoyée (`return=representation`) qui trahit le conflit. Trois garde-fous qui ont
chacun une raison :

- un seul envoi à la fois : une frappe pendant l'envoi partirait avec la *même*
  version et serait refusée comme un faux conflit ;
- la fenêtre refuse de se fermer tant qu'un enregistrement a échoué ou qu'un
  conflit est en attente (un test a trouvé le cas où `enregistrer()` renvoyait
  « succès » sur un conflit, et fermait en jetant le texte) ;
- ses touches ne remontent pas à la page : sans cela, Ctrl+Z dans les notes
  annulait le texte *du livre*, derrière la fenêtre.

La duplication d'un livre reprend ses notes (en version 1, comme une ligne neuve).
La suppression du livre les emporte (`on delete cascade`). Les pastilles de carte
n'apparaissaient qu'au survol — introuvables sur téléphone : elles restent visibles
là où il n'y a pas de survol (`@media (hover: none)`).

**Onglets et mise en forme.** Tout tient dans la colonne `contenu` (aucune
migration de base), sous la forme d'un JSON `{"v":2,"onglets":[{id,titre,texte}]}`.
Les notes d'avant les onglets sont du texte brut : on les lit comme un premier
onglet « Notes » (identifiant fixe, pour que deux ouvertures donnent le même
document), et le format ne change qu'à la première *modification* — ouvrir des
notes n'écrit jamais rien. Un JSON abîmé s'affiche comme du texte plutôt que de
disparaître.

Le gras et l'italique n'existent **que par Ctrl+B et Ctrl+I** (pas de barre
d'outils, c'était la demande). Le `texte` d'un onglet est du texte à balisage
minimal : des retours à la ligne, et seulement `<b>` et `<i>`, tout `< & >` du
texte étant échappé. La zone d'écriture est un `contenteditable`, donc **de
l'HTML potentiel**, et trois règles tiennent la porte :

- on n'écrit jamais ce texte avec `innerHTML` : `remplir()` construit la page
  nœud par nœud (`createTextNode`, `createElement`), si bien que même une ligne
  trafiquée à la main dans la base ne donne que du texte inerte ;
- ce qui est enregistré se relit dans la page (`lignesDepuisDOM`) et ne garde que
  les lignes, le gras et l'italique : tout autre balisage est écarté, quel que
  soit le navigateur (Chrome, Firefox et Safari ne fabriquent pas les mêmes
  `<div>`/`<br>` quand on appuie sur Entrée) ;
- on **colle du texte brut** seulement, le **dépôt** est refusé, et les mises en
  forme autres que gras/italique (Ctrl+U, menus du navigateur) sont bloquées :
  elles s'afficheraient, puis disparaîtraient à la réouverture.

La limite de la colonne (200 000 caractères) vaut pour **tous les onglets
ensemble** ; au-delà, l'envoi est refusé côté navigateur avec un message, et la
fenêtre reste ouverte. Échap pendant le renommage d'un onglet annule le nom, pas la
fenêtre. L'ordre des onglets est celui de leur création (pas de glisser-déposer).

**Dupliquer un livre** (bouton ⧉ de la carte) : le doublon est un livre neuf et
indépendant — texte, mise en page, réglages et visuels lui appartiennent. Trois
choses ne se recopient pas, et c'est délibéré :

- **la publication** — un brouillon de travail n'a pas à paraître publié le
  jour de sa création ;
- **le rattachement à une série** — le doublon prendrait le numéro de tome de
  l'original, et la série afficherait deux « Tome 3 » ;
- **les images**, qui sont COPIÉES dans Storage et jamais partagées.

Ce dernier point est le piège de la fonctionnalité : `supprimerLivre()` efface
les fichiers de Storage **par chemin**. Deux livres pointant le même visuel, et
supprimer l'un ferait disparaître la couverture de l'autre. D'où
`copierImageStorage()`, qui duplique côté serveur (`/storage/v1/object/copy`,
les octets ne repassent pas par le navigateur) vers le chemin du nouveau livre.
Si la copie échoue, le doublon repart **sans** l'image et le dit — jamais de
repli sur le chemin de l'original.

**Renommer un livre** : le titre ne se changeait que dans l'éditeur de
couverture, une fois le livre ouvert — autant dire nulle part. Le crayon ✎ de
chaque carte de la bibliothèque le fait désormais, par `mettreAJourLivre()` :
seul le titre part en base, jamais le manuscrit, que la bibliothèque n'a de
toute façon pas en mémoire (`enregistrerLivreDistant` le refuserait).

**Séries** (table `series` + colonnes `livres.serie_id` / `livres.tome`) :
plusieurs tomes d'une même histoire, avec le résumé d'ensemble et l'ordre de
lecture. Une série n'est qu'un **classement** — chaque tome reste listé dans
« Mes livres » et s'ouvre, s'imprime et se publie exactement comme avant.

La bibliothèque est en **deux onglets**, « Mes livres » et « Mes séries », qui
tiennent lieu de titres de section. Empilées, les deux listes ne tenaient pas :
un résumé de série fait plusieurs paragraphes et poussait la grille des livres
hors de l'écran. L'onglet choisi est mémorisé (`el_ongletBiblio`), mais un
onglet « séries » mémorisé alors qu'il n'y a plus aucune série renvoie aux
livres — arriver sur une page vide donne l'impression d'avoir tout perdu.

**L'onglet « Mes séries » a deux vues**, dans le même onglet. La **liste** montre
chaque série sous forme de bouton : la couverture du tome 1 en grand, celles des
tomes 2 et 3 en petit, le titre, « 3 tomes · 1 144 pages » et un extrait du
résumé. Un clic ouvre le **détail** : « ← Séries », le titre, le résumé (replié
au-delà de 280 caractères, avec « Lire la suite »), les actions — ajouter des
livres, modifier, supprimer — puis les tomes **dans l'ordre**, chacun avec sa
couverture, son format, ses pages et le résumé de sa propre 4ᵉ de couverture.
Un résumé de série fait plusieurs paragraphes : empilé dans la liste, il
repoussait la série suivante hors de l'écran.

`serieOuverte` (l'id de la série lue, ou `null` pour la liste) est le seul état.
Tout appelant qui change une série ou un livre rappelle `afficherSeries()` : la
vue courante est conservée, et retombe sur la liste si la série affichée a
disparu. Enregistrer la fenêtre d'édition **ouvre** la série concernée — créée
ou modifiée —, pour voir tout de suite ses tomes dans l'ordre choisi.

Le rang « Tome N » est celui de la position affichée, pas le numéro stocké : un
livre retiré de la série laisse un trou dans les numéros, que `enregistrerSerie`
referme à la sauvegarde suivante.

**Les vignettes de couverture** (`creerCouvertureLivre`, une seule fois pour la
grille, les boutons de séries et les lignes de tomes) calculaient leur échelle au
chargement de l'image, avec `clientWidth`. Dans un onglet **masqué**, il vaut 0 :
l'échelle tombait à 0 et la couverture restait invisible pour de bon, même une
fois l'onglet affiché. Sans conséquence tant que seule la grille — toujours
visible — portait des couvertures ; les séries vivent dans l'onglet qu'on ne
regarde pas au départ. Un `ResizeObserver` rejoue maintenant le calcul à chaque
changement de taille de la vignette, ce qui couvre le passage de masqué à
affiché, et au passage le redimensionnement de la fenêtre que la grille n'a
jamais suivi.

Deux conséquences voulues du modèle :

- La clé étrangère est en `on delete set null`, jamais `cascade` : supprimer
  une série ne doit pas emporter les manuscrits qu'elle rangeait. Les tomes
  redeviennent des livres sans série, et seul le résumé est perdu.
- Rien dans les règles de lecture des livres ne dépend de la série ; la table
  `series` est privée sans exception, sans équivalent de « publié ».

La numérotation des tomes est réécrite à chaque enregistrement, dans l'ordre
affiché : le rang dans la fenêtre fait foi, pas un numéro saisi à la main qu'il
faudrait tenir d'accord.

**`mettreAJourLivre()` refuse les champs qu'elle ne connaît pas.** Elle filtrait
déjà par une liste blanche (`CHAMPS_MODIFIABLES_LIVRE`), mais en JETANT
silencieusement le reste : la requête partait, réussissait, et n'écrivait rien.
C'est ainsi que le rattachement des tomes a paru fonctionner — l'écran suivait
l'état local — puis disparaissait au rechargement. Les clés attendues sont
celles de l'objet EN MÉMOIRE (`serieId`), pas les noms de colonnes
(`serie_id`) ; passer l'un pour l'autre lève désormais une erreur.

Leçon pour les tests : en remplaçant `mettreAJourLivre` elle-même, on ne
traverse jamais cette liste. Ce qui touche à la persistance se teste en
interceptant `requeteSupabase`, la vraie porte de sortie.

**Statistiques d'un livre** : dans la bibliothèque, la ligne « format · pages »
sous le titre d'une carte ouvre la fiche du livre — mots, pages, chapitres,
temps de lecture, signes, densité, longueur du plus long et du plus court
chapitre. Ces chiffres existaient déjà, mais dans la fiche qu'un ADMINISTRATEUR
ouvrait sur un autre compte (`utilisateurs.html`) ; cette page a disparu quand
la gestion des comptes est passée au portail central, et les statistiques sont
tombées avec elle sans que ce soit voulu. Elles sont revenues côté propriétaire
du livre, ce qui est leur place. Le CSS, lui, n'avait jamais été retiré : les
classes `.stats-*` de `site.css` servent telles quelles.

La bibliothèque ne descend que les métadonnées : ouvrir la fiche rapatrie le
livre entier (`chargerLivreComplet`), d'où le voile « Lecture du livre… ».
`compterMots()` vit dans `script.js` et non dans `editeur.js` précisément pour
que la fiche et le compteur du sommaire annoncent le même nombre.

**Écrire un chapitre d'un seul tenant** (`manuscrit.js`) : l'éditeur compose en
doubles-pages, ce qu'il faut pour voir tomber la mise en page — mais pour
écrire, la page gêne : on ajoute une phrase au début, tout se décale, le
curseur saute d'une page à l'autre. Le manuscrit ouvre donc un chapitre, un
seul, sur une feuille sans fin. À l'enregistrement, le chapitre reprend sa
place dans le texte continu et la pagination se refait d'un bloc.

Deux portes y mènent, et c'est voulu : le crayon `✎` de chaque ligne du
sommaire, pour le chapitre qu'on a sous les yeux, et **« 📖 Écrire un chapitre
entier »** dans le panneau Relecture, qui ouvre un sélecteur. La première est
rapide mais invisible tant qu'on ne survole pas la ligne ; la seconde porte son
nom en toutes lettres, là où l'on cherche ce qui travaille le livre entier.

Le sélecteur (`ouvrirChoixChapitreManuscrit`) tire sa liste de
`trancheChapitre()`, c'est-à-dire de la source même dont `ouvrirManuscrit()`
attend l'index : la refaire de son côté, c'était prendre le risque qu'un rang
désigne un autre chapitre. Les numéros de page viennent du sommaire, et ne sont
affichés que si les deux comptes concordent.

**Compter les mots** : `compterMots()` passe par `texteAvecRuptures()`, qui rend
aux `<br>` et aux fins de bloc l'espace qu'ils occupent à l'écran. Sans cela,
`textContent` recolle ce que les balises séparaient — « `<h2>Introduction</h2>`
`<p>Un monde` » donnait « IntroductionUn », un mot au lieu de deux. Comme le
livre sépare ses paragraphes par `<br><br>`, le compteur perdait un mot à chaque
changement de paragraphe : 2 611 sur Aeran'Kael, soit près de 4 %. Le
remplacement se fait sur le HTML avant l'analyse, et non sur le DOM ensuite —
ce compteur tourne à chaque frappe sur toutes les doubles-pages.

**Collage** : `fragmentDepuisPressePapiers()` (dans `script.js`, partagé par la
double-page et le manuscrit) ne retient du presse-papiers que l'italique, le
gras et le souligné — les trois emphases que la barre d'outils sait poser. Tout
le reste est jeté : police, taille, couleur, classes, attributs. Une taille en
pixels venue de Google Docs, figée dans le texte, survivrait à un changement de
format et le passage collé garderait seul l'ancienne typographie.

Le tri se fait sur `text/html`, avec repli sur `text/plain` quand la source n'en
propose pas. Trois pièges à ne pas réintroduire :

- **Le style en ligne prime sur la balise.** Google Docs enveloppe tout le
  presse-papiers dans un `<b style="font-weight:normal">` qui mettrait sinon le
  passage entier en gras.
- **Le contenu de `<style>` est ignoré**, sans quoi la feuille de style que Word
  glisse en tête du presse-papiers serait collée comme du texte.
- **Une frontière de bloc vaut DEUX retours, un `<br>` un seul.** Le livre
  sépare ses paragraphes par une ligne blanche (`<br><br>`) ; coller un chapitre
  de Wattpad, où chaque paragraphe est un `<p>`, rendait sinon un pavé compact
  dont tous les blancs avaient disparu. Les sauts sont mis en attente et posés
  devant le texte suivant, en prenant le plus grand des deux et non leur somme :
  une pile de `<div>` imbriqués ne produit donc toujours qu'un seul saut de
  paragraphe, et rien ne traîne en tête ni en queue du collage.

La double-page insère le fragment à la main (`range.insertNode`), le manuscrit
passe par `insertHTML` pour rester annulable par Ctrl+Z ; il nettoie ensuite le
`font-size` que le navigateur ajoute parfois de lui-même, en ne touchant qu'aux
éléments absents avant le collage.

**Le trou d'une page blanche** : `gererFlux()` ne savait que POUSSER le
trop-plein vers la double-page suivante. Rien ne RAPATRIAIT le texte quand une
double-page se creusait, et une page blanche restait alors en place pour de
bon — seule une repagination complète (aperçu, impression, changement de
format) la refermait.

Le cas qui le déclenche : un titre de chapitre porte `break-before: column`.
Précédé de la fin du chapitre d'avant, ce saut le renvoie en page droite et la
double-page est pleine. Que ce qui le précédait s'en aille, et le titre se
retrouve en tête : le saut n'a plus rien à franchir, il est ignoré, le titre
remonte en page gauche — **une page entière de capacité se libère d'un coup**,
sans le moindre débordement à signaler. Une suppression de texte produit le
même effet, en moins visible.

`compacterDepuis()` remonte donc ce que la suivante peut céder, en s'arrêtant à
la première double-page qui ne gagne rien. Deux précautions :

- **Un garde-fou d'abord** (`placeLibreDans`), qui ne relève que l'endroit où
  le texte s'arrête : cent fois moins cher qu'une partition, il évite de
  mesurer à chaque frappe. Il tolère une ligne — une page pleine s'arrête
  toujours un peu avant le bas, et sans cette marge toute page remplie serait
  déclarée creuse.
- **La zone d'édition n'est réécrite que si quelque chose a bougé.** Sinon la
  frappe ordinaire perdrait son annuler/rétablir natif à chaque caractère.
  C'est aussi pourquoi `compacterDepuis` repasse jusqu'à ce que plus rien ne
  bouge : une passe s'arrête à la première double-page qui ne gagne rien, et
  la remontée peut en vider une plus loin.

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

**Export KDP — les minimums d'Amazon ne sont pas des marges.** `KDP_MARGE_EXT_MM`
(6,4 mm) et `kdpMargeReliure()` sont les **planchers** qu'Amazon exige ; l'export
les appliquait tels quels, comme s'il s'agissait de marges de livre. Sur un
roman composé avec 18 mm en tête et 16 mm sur les côtés, le fichier sortait avec
6,4 mm en tête : bloc de texte **9,7 mm plus large et 11,6 mm plus haut** que ce
qui avait été composé. Le livre imprimé ne ressemblait plus à celui de l'écran.

`pagesEtMargeKDP()` part désormais des marges de l'auteur et ne les **relève**
que si elles passent sous le plancher — `Math.max`, jamais de remplacement.

Elle **décale** aussi le bloc vers l'extérieur, comme le fait l'export
imprimeur : `+ DELTA_RELIURE_MM` au petit fond, autant de retiré au grand. La
somme ne bouge pas, donc la largeur du bloc reste celle de l'écran, mais le
texte s'écarte du pli. Centrer la page serait une erreur : la reliure avale
quelques millimètres au petit fond, et un bloc centré paraît aspiré vers le
dos. Sur un livre très épais, le minimum de reliure de KDP (jusqu'à 22,3 mm)
reprend la main sur ce décalage.

**Le folio suit le bloc de texte, pas la page.** Il était centré sur la largeur
de la feuille (`.numero-impression { left: 0; right: 0 }`) alors que le texte,
lui, est décalé : sur un livre à 20 mm de reliure et 12 mm au grand fond, le
numéro tombait 4 mm à côté de l'axe du texte — à gauche sur un recto, à droite
sur un verso. `poserFolio()` lui donne les mêmes marges latérales que le texte,
du même côté ; il est appelé par les trois constructeurs de pages
(`creerPageTexteImpression`, `creerPageKDP`, `creerPagePro`), qui avaient tous le
défaut. Les règles d'impression vivent dans `@media print` : pour tester cette
géométrie à l'écran, on en recopie les équivalents dans la page de test.

Les trois cotes retenues (`interieure`, `exterieure`, `verticale`) circulent
jusqu'à `creerPageKDP()`, qui doit poser EXACTEMENT celles qui ont servi à la
mesure : sinon le texte ne tombe pas où la pagination l'a cru et le bas des
pages est rogné.

C'est le principe que suivait déjà l'export imprimeur — « la somme des deux
marges reste identique à l'éditeur pour que le bloc de texte garde exactement
la même largeur ». Seul l'export KDP y échappait.

**L'écran compose comme le fichier** : `.texte-livre` justifie avec césure, et
le mesureur porte cette classe — il pèse donc le texte tel qu'il sera imprimé.

Ce n'était pas le cas. L'écran composait au drapeau sans césure, et un garde-fou
était prévu : la classe `mesure-pro`, posée pendant la repagination. Mais elle
était appliquée à `#mesureCachee`, qui **n'a jamais servi à mesurer** — la
pagination passe par `#mesureSpread` (voir `mesureEl()`). Le garde-fou visait le
mauvais élément et n'a jamais agi.

Ce qu'il en coûtait, précisément : la justification ne change pas où les lignes
se coupent — elle ne fait qu'étirer les espaces — mais la **césure**, si.
Mesuré sans césure puis rendu avec, le texte d'une page tenait en moins de
lignes que prévu : des pages finissant trop tôt, et un fichier plus long qu'il
n'aurait dû, ce qui gonfle à son tour le dos et le palier de marge de reliure.
Rien n'était rogné, mais rien ne tombait juste. `mesure-pro` a été retiré :
l'accord se fait maintenant à la source.

**L'espace entre les paragraphes** (menu « Paragraphes » à côté de l'interligne ;
colonne `livres.espace_paragraphe`, en em, bornée à 0–4, `null` = la valeur d'avant). Cinq
choix : collés (0), serrés (0,4), espacés (0,9), ligne vide (1,45 — l'aspect d'une ligne
vide), grand espace (2).

**Pourquoi une conversion.** Ce livre sépare ses paragraphes par « <br><br> » dans un
même `<p>`. La « ligne vide » n'est qu'une ligne comme les autres, et **aucune règle CSS
ne la règle** : essayé dans Chrome, `display`, `height`, `margin`, `line-height` et
`font-size` sur `br` n'ont aucun effet sur la mise en page. Pour régler l'espace il faut de
vrais paragraphes ; à la première utilisation, `convertirLignesVidesEnParagraphes` remplace
chaque suite de deux `<br>` (directement dans un `<p>`) par une frontière entre deux `<p>`,
dont l'espace est la marge du bas (`margin: 0 0 var(--espace-paragraphe, 6px)`, dans
style.css et impression.css). Règles : k > 2 `<br>` gardent k − 2 paragraphes vides (les
blancs voulus ne se perdent pas) ; un `<br>` isolé reste un retour à la ligne (vers,
réplique) ; chaque `<p>` reprend style et classe, `data-suite` seulement le premier ; un
`<br>` dans une mise en forme (`<i>a<br><br>b</i>`) n'est pas touché.

**Garde-fous.** Une confirmation annonce la conversion et le nombre de lignes vides ; un
refus ne change rien (le menu revient à sa place). Le texte avant et après est comparé
(espaces ramenées à une) : au moindre écart, rien n'est appliqué. Le réglage suivant n'a
plus de confirmation : le livre est déjà fait de paragraphes. Il se recompose comme
l'interligne (`repaginerTout`).

**Un livre réel mélange les structures** (retour : « parfois c'est parfait, de temps en temps
trop d'espace »). La première version ne traitait que « <br><br> » directement dans un
`<p>`. Essayées une à une, **sept structures sur neuf** donnaient un écart non uniforme :

| structure | écart mesuré (réglage 0,9 em) | cause |
|---|---|---|
| `<br><br>` dans un `<span>` / `<i>` | lignes vides non converties | `<br>` pas enfants directs du `<p>` |
| `<br>` en fin de mise en forme (`<i>a<br></i><br>`) | idem | idem |
| `<div>` / `<div><br></div>` | aucun espace du tout | la marge ne vaut que pour les `<p>` |
| `<p><br></p>` (Entrée deux fois) | **3,25 em** | une ligne entière + deux marges |
| trois `<br>` | 3,25 em | une ligne vide gardée en plus |
| mélange des précédents | écarts inégaux | tout cela à la fois |

Le cas le plus courant est le paragraphe vide : en tapant Entrée deux fois dans l'éditeur,
on obtient `<p>…</p><p><br></p><p>…</p>`, dont l'écart était 0,9 + une ligne + 0,9.
`convertirLignesVidesEnParagraphes` normalise donc tout : le texte nu de la racine entre dans un
`<p>` ; les `<div>` deviennent des `<p>` ; les suites de `<br>` sont coupées **où qu'elles
soient** (par `Range.extractContents`, qui referme et rouvre les mises en forme) ; le
premier paragraphe vide de chaque suite disparaît (c'est la frontière). Les lignes vides
en plus de la première sont des blancs voulus (pause, changement de scène) : elles sont
gardées en `<p class="ligne-vide">`, dont la hauteur est **exactement l'espace réglé** —
elles suivent le réglage au lieu de peser une ligne de texte. Mesuré : 0,9 / 1,8 / 0,9.
Vérifié sur 60 livres tirés au hasard (674 conversions) : texte identique, plus aucun double
`<br>`, aucun `<div>`, et une seconde passe ne change plus rien. Piège rencontré : la
garde « texte identique » comparait des espaces ramenées à une ; une espace entre deux `<br>`
disparaissait avec le `<br>`, la garde refusait donc une conversion juste. Elle compare
maintenant sans aucun blanc. Autre piège : un second lancement d'un script de modification
réinsérait deux fois la règle CSS — à ne pas faire avec un script qui n'est pas idempotent.

**Plafond : un seul blanc voulu par pause** (retour : « j'ai changé en serrés puis de nouveau
en espacés et j'ai des trous »). Un paragraphe vide pèse une ligne ENTIÈRE plus deux marges :
`1,45 + 2 × espace` em. Une suite de n paragraphes vides — laissée par la première version de la
conversion, ou par Entrée tapé plusieurs fois — faisait donc un trou de n fois cela, et d'autant
plus grand qu'on augmentait l'espace (mesuré à 0,9 em : 3,25 em par paragraphe vide). Le
premier paragraphe vide d'une suite est la frontière entre deux paragraphes ; il en reste au
plus **un blanc voulu** (`p.ligne-vide`, hauteur = l'espace réglé) ; les autres disparaissent.
Même plafond pour les suites de `<br>` (3 ou 6 donnent le même blanc) et pour des
`ligne-vide` déjà posés qui se suivent. Résultat mesuré à 0,9 : un blanc voulu = 1,8 em
d'écart, quel que soit le nombre de lignes vides d'origine. C'est une perte voulue
d'information — « combien de lignes vides » — au profit de « une pause » ; une pause plus
large se règle avec « Grand espace ». La bascule serrés → espacés → serrés ne change plus la
structure du livre (comparée octet pour octet), et une seconde normalisation ne trouve rien.

Le réglage est proposé à chaque changement de valeur : si le livre contient encore l'une de
ces structures (un livre déjà converti par la première version, par exemple), la
confirmation revient et le normalise ; sinon, aucune confirmation.

**Pourquoi par livre et pas dans chaque paragraphe.** Le réglage est une variable CSS
posée sur `<html>` : un paragraphe écrit plus tard le suit tout seul, l'aperçu et
l'impression composent pareil, et la lecture (`lecture.js`) la pose aussi. Il a fallu une
colonne (migration `livres_espace_paragraphe`, appliquée avant ce code : un ajout facultatif
ne gêne pas la version déjà en ligne). Mesuré à l'écran : l'espace entre deux paragraphes
vaut exactement la valeur choisie, en em de la taille du texte (attention en test : les
rectangles sont à l'échelle du zoom, `echelleAffichage`).

**Le blanc sous le sous-titre** (curseur « Sous-titre » de la barre d'outils, à côté de « Titre » ;
0 à 80 px, par pas de 2). C'est l'espace entre le sous-titre — ou le titre, quand il n'y a pas de
sous-titre — et le premier paragraphe. Variable CSS `--espace-sous-titre` posée sur `<html>`,
comme les autres réglages d'espace, et colonne `espace_sous_titre` (migration
`livres_espace_sous_titre`, appliquée avant le code). Sans réglage, rien ne change : 8 px sous un
titre, 6 px sous un sous-titre, et le curseur affiche 6.

La règle est posée sur la **marge du titre** (`h2:has(+ p)`, `h3:has(+ p)`) et non sur celle du
paragraphe : deux marges verticales voisines se confondent en la plus grande, donc on n'aurait
pas pu descendre sous la valeur par défaut. Un titre suivi d'un sous-titre garde son écart
(8 px) : ce n'est pas lui que règle le curseur. Même règle dans `style.css` et `impression.css`,
et `lecture.js` pose la variable. Au relâchement du curseur (350 ms), le livre est recomposé,
car l'espace change la hauteur occupée. Le bouton de remise à zéro des tailles le réinitialise
aussi. Nécessite `:has()` (navigateurs récents). Mesuré à l'écran : l'écart vaut exactement la
valeur choisie, de 0 à 80, pour un titre seul comme pour un sous-titre.

**L'éditeur sur petit écran** (sous 900 px : `requeteCompacte` dans editeur.js, bloc
« Petits écrans » de style.css — le seuil est écrit aux deux endroits). Deux défauts
de fond, un seul remède :

- `editeur.html` n'avait **pas de balise `viewport`** : un téléphone composait la page
  à 980 px puis la réduisait, d'où un panneau et un livre minuscules côte à côte ;
- le zoom du livre se calculait avec des tailles **écrites en dur** (« la barre d'outils
  fait 56 px »). Dès qu'elle passait sur deux lignes, le livre se croyait plus petit
  qu'il n'était et débordait : boutons du bas coupés. `espaceDisponibleLivre()`
  **mesure** maintenant la zone et ce qui l'entoure.

Sur petit écran : le panneau de gauche devient un **tiroir** (☰ dans une barre du
haut qui reprend le titre et l'état d'enregistrement ; il se referme au choix d'un
chapitre ou d'un bouton, par Échap ou en touchant le fond), la barre d'outils tient
sur **une ligne qui défile**, et le livre se lit **page par page** : une page tient
en largeur, l'autre se fait défiler, avec deux boutons « Page 1 / Page 2 » pour y
aller d'un geste. Si les deux pages tiennent à une échelle lisible (≥ 0,6 :
`ECHELLE_MIN_DEUX_PAGES`, soit une tablette en portrait) on garde la double-page. La
couverture et son panneau de réglages se **superposent** ; seul l'aperçu est réduit,
le panneau garde sa taille réelle (réduit, ses champs auraient des lettres de 8 px).

Choses à savoir : chaque `.livre-ouvert` reçoit à l'initialisation une zone de
défilement `.defile-livre`, en `display: contents` sur grand écran — absente de la
mise en page, donc sans risque pour le bureau. Le tiroir se masque par `transform`
et `visibility`, jamais par `display` (l'aperçu et `.sommaire-reduite` masquent le
panneau en ligne : `!important` l'emporte). Le bouton « accueil » du portail passe en
haut à droite et se cache derrière une fenêtre ouverte, dans le même coin que sa
croix. L'aperçu (feuilletage) reste à deux pages ajustées à la largeur : sur un
téléphone c'est une vignette, à lire en pinçant.

**Le panneau de gauche ne se coupe plus.** Sur un écran peu haut — un portable, ou
n'importe quel écran zoomé à 150 % — le bas du panneau sortait de l'écran : compteur
rogné, bouton « Bibliothèque » invisible (il était tout en bas). Le bouton est
maintenant **en haut** du panneau (et du tiroir, sur mobile) ; les espaces entre
blocs sont resserrés (plus de séparateur entre le format et les outils) et se
resserrent encore sous 760 px de haut ; le pied (compteur, état d'enregistrement)
est `position: sticky` en bas du panneau ; et si le contenu dépasse malgré tout, le
panneau **défile** au lieu de couper (`overflow-y: auto`, il était `hidden`). Vérifié à
580 px de haut : tout tient, sans défilement.

**Hauteur de l'écran sur mobile.** `100dvh` devrait suffire, mais sur certains
navigateurs (ou dans une application qui s'étend sous la barre de navigation) il compte
la zone cachée : le bas de la page, boutons compris, se retrouvait hors de l'écran.
`majHauteurEcran()` mesure `window.innerHeight` dans `--hauteur-ecran`, et la mise en
page prend `min(100dvh, var(--hauteur-ecran))` — le plus petit des deux, donc jamais
plus haut que l'écran visible. Le zoom par pincement n'est pas suivi (la page
rétrécirait sous les doigts). Non vérifié sur un vrai téléphone : le navigateur de
test n'envoie pas toujours `resize` quand on change la taille émulée.

**L'aperçu feuillette comme un livre** : à l'ouverture de la couverture, l'**intérieur
de la couverture** est à gauche et la **page 1 à droite** ; les pages se regardent
ensuite par paires (2-3), (4-5)… — jamais (1-2), qui n'existe pas sur un livre
relié (une page de droite est toujours un recto, impair). `donneesInterieur()`
prend donc le feuillet de droite à `2 × (n − 1)` et celui de gauche juste avant
(rien à la première double-page : c'est le revers de la couverture). Quand le
nombre de pages est pair, la dernière double-page montre l'intérieur de la 4e à
droite. `nombreSpreadsApercu()` vaut donc `⌊pages / 2⌋ + 1`. La lecture
(`lecture.js`) applique la même règle, sans les gardes.

**Menus déroulants des fenêtres de réglage** (`habillerSelect`, impression.js). La liste
ouverte d'un `<select>` est dessinée par le système (fond blanc, bleu de sélection) et
ne s'habille pas en CSS. Dans les fenêtres `.modal-impression` (tranche, couverture,
KDP), on la remplace par un bouton et une liste aux couleurs du site — un
`MutationObserver` sur le `<body>` les habille à mesure qu'elles apparaissent. Le
`<select>` d'origine **reste dans la page, masqué** : c'est lui qui porte la valeur
et émet `input`/`change`, donc rien de ce qui le lit ou l'écoute n'a changé. Les
propriétés `value` et `selectedIndex` sont surchargées sur l'instance pour que le
bouton suive une valeur posée par le code ; la liste se reconstruit à chaque
ouverture, donc des options ajoutées après coup y figurent. Les menus de la barre
d'outils ne sont pas concernés (ils ont déjà leur style).

**Pas de mot coupé d'une page à l'autre** (`eviterMotsCoupes`, editeur.js). La
césure automatique coupe un mot en fin de ligne, ce qui est voulu dans un texte
justifié ; mais à la dernière ligne d'une page, « disposit- » en bas et « ion » en
haut obligent le lecteur à tourner la page pour finir le mot. `hyphenate-limit-last`,
qui y répondrait en CSS, n'existe presque nulle part.

Quand une frontière de page tombe **au milieu d'un mot** (le caractère d'avant et
celui d'après sont tous deux des lettres : la seule façon d'y arriver est la
césure), le mot est enveloppé d'un `<span class="sans-cesure">` (`hyphens: none`,
style.css). Il ne peut plus se couper et c'est le **navigateur** qui le replace en
entier sur la page suivante : l'écran, l'aperçu et le fichier imprimé restent donc
d'accord, au lieu de recevoir chacun sa coupe « corrigée » à la main. Les balises
sont retirées puis reposées à chaque composition (`calculerPartition`,
`calculerDeuxPages`, `decouperEnDoublesPages`) : un mot qui n'est plus en bout de
page redevient coupable à la ligne. Elles ne changent pas le texte, seulement son
habillage, et les balises vides que laisse une coupe tombant pile au bord d'un mot
ne sont pas stockées.

**Dans la zone d'édition elle-même** (retour : « l'of- | frir. » entre les deux pages d'une
même double-page). Trois défauts, trouvés en reproduisant la capture :

- **la frappe**. Taper déplace les lignes : un mot tombe à cheval sur les deux pages, et
  rien ne le protégeait avant la prochaine navigation. Mesuré avec l'ancien code : 10
  coupes apparues en tapant, 8 restaient. `gererFlux` regarde maintenant la frontière
  (`frontiereAProteger`, un simple relevé de position) et, s'il y en a une, réaffiche la
  double-page **en suivant le curseur** — comme la remontée de texte. La double-page ne
  se réaffiche, et l'annuler/rétablir natif ne se perd, que si une coupe est réellement
  là ; une fois protégé le mot est « déjà » protégé, donc pas de boucle. Le mot reste
  coupé pendant 350 ms, le temps que la frappe s'arrête. Après : 7 apparues, 7 corrigées,
  curseur jamais déplacé ;
- **l'élément mesuré**. La protection d'affichage se posait sur une COPIE cachée (le
  mesureur), qui peut composer autrement que ce qu'on voit. Elle se pose sur la zone
  visible. Comme elle est zoomée (`transform: scale`), `seuilFrontiere` met désormais le
  seuil à l'échelle de l'élément (`rect.width / offsetWidth`) ;
- **les polices**. EB Garamond se charge en `font-display: swap` : le texte est d'abord
  composé dans une police de remplacement. Toute la pagination est une mesure, donc
  mesurée avant le chargement elle l'était avec d'autres largeurs de lettres, et ne
  correspondait plus à ce qu'on voyait ensuite. `attendrePolicesDuLivre` attend les trois
  variantes avant la première mesure, avec un filet de 2 s pour ne jamais bloquer
  l'ouverture. (Hypothèse plausible plutôt que prouvée : je n'ai pas pu reproduire un
  chargement lent.)

**Guillemets restés seuls.** Même mécanisme pour un « » » en tête de page (séparé de
sa phrase) ou un « « » en pied de page (séparé de ce qu'il ouvre). Le texte les sépare
du mot voisin par une espace ordinaire, que le navigateur prend pour un endroit où
couper ; l'espace insécable, elle, ne se coupe pas. `groupeALaCoupe()` rend alors le
groupe « mot + espace + signe » (ou « signe + espace + mot »), enveloppé de la même
balise — dont la règle CSS porte maintenant aussi `white-space: nowrap`, sans quoi un
groupe se couperait à son espace. Seuls « » » et « « » sont concernés : « ? ! : ; »
ne se détachent jamais du mot qui les précède, même après une espace (UAX 14, LB13).
Mesuré dans Chrome 152 : un « » » en fin de texte reste seul sur sa ligne pour environ
15 % des largeurs de colonne avec une espace ordinaire, jamais avec une espace
insécable. Le texte, lui, n'est jamais modifié.

**Le cas de « là. » ».** Un guillemet fermant suit très souvent un point, et la première
version cherchait, avant l'espace, un MOT (des lettres seules) : « là. » n'en était pas
un, et le guillemet restait seul en tête de page — c'est la coupe que l'outil signalait
encore. Le groupe est maintenant « tout ce qui précède l'espace, jusqu'à l'espace
d'avant » (point compris), et symétriquement « le mot entier, apostrophe comprise »
après un guillemet ouvrant. Reproduit dans l'ancien code (6 cas sur 6 subsistaient), 0
dans le nouveau.

**Option « Rendre les espaces insécables »** (fenêtre de l'outil, proposée quand une
coupe de ce genre subsiste). Remplace, dans tout le livre, l'espace ordinaire devant
« » » et après « « » par une espace insécable — la règle typographique française, et
la seule solution qui ne dépend pas de la mise en page. C'est un VRAI changement du
texte (un caractère invisible, stocké `&nbsp;`), donc une option qu'on choisit, jamais
quelque chose que la recomposition fait d'elle-même. `rendreInsecablesLesGuillemets`
travaille nœud de texte par nœud de texte, sans toucher au balisage, et traite aussi
une espace séparée de son guillemet par une mise en forme (« mot<i> »</i> »,
« « <i>mot</i> »). Idempotente. Les `? ! : ;` n'en ont pas besoin : ils ne se détachent
jamais du mot qui les précède. Piège à éviter dans un test : `flushSpread()` réécrit la
double-page affichée dans le modèle ; si le livre a été changé sans réafficher
l'éditeur, il écrase le nouveau texte par l'ancien.

Les ruptures `<br>` comptent pour une coupure dans ce repérage : ce livre sépare ses
paragraphes par « <br><br> » à l'intérieur d'un même `<p>`, et sans cela la dernière
lettre d'un paragraphe et la première du suivant auraient semblé former un mot.

**L'outil « ✂ Coupes de page »** (menu « Relecture » du panneau) travaille en **deux
temps, et le premier ne change rien**.

1. `ouvrirCorrectionCoupes` → `analyserCoupes` : il MONTRE où le livre est coupé —
   page, extrait (« systém | atique »), cause — sans rien recomposer, sans toucher au
   texte, sans enregistrer de balise, sans marquer le livre modifié. Boutons : « Ne rien
   changer » / « Corriger les N coupes ». S'il n'y a rien, il le dit et n'offre rien.
2. `corrigerLesCoupes` (seulement si l'on clique) : recompose tout le livre, pose les
   protections, puis relit les pages (`coupesDansPages`, indépendant de la mise en page)
   et affiche le bilan. Le livre est alors marqué modifié : les balises sont enregistrées.

C'est ce qu'a demandé l'auteur : voir avant de décider. La première version recomposait
d'emblée et n'expliquait qu'après.

**Garde-fou.** `corrigerLesCoupes` compare le texte du livre avant et après (`texteExactDuLivre` :
espaces et ruptures `<br>` comprises, sans le balisage). S'il diffère d'un seul
caractère, les double-pages sont remises EXACTEMENT comme elles étaient et la fenêtre
« Correction annulée » le dit. Une recomposition ne doit toucher qu'à la mise en page.
(Né d'un retour : après une coupe de page, « Espaces après les points » retrouvait des
points collés déjà corrigés. Je n'ai pas pu le reproduire — 24 livres de structures et
de ponctuations variées sortent de la correction avec un texte strictement identique —
le garde-fou est donc là pour que, si cela existe, ce soit visible et sans dégât.)

**Ce que l'analyse compte.** Elle mesure COMME L'ÉCRAN ET LE FICHIER : au milieu d'une
double-page la protection est posée à l'affichage et à l'impression, donc une coupe y est
déjà évitée ; restent les coupes ENTRE deux double-pages, que la coupe enregistrée fixe.
Une version intermédiaire lisait aussi le milieu des double-pages « tel
qu'enregistré » et annonçait, après correction, des coupes que le livre n'avait pas.

**Le menu « Relecture » est une fenêtre flottante** (`placerListeOutils`), plus une liste
qui se déplie dans le panneau : dépliée sur place, elle repoussait les chapitres hors
de l'écran, et un filet ou un fond teinté n'y changeait rien — c'était un problème de
place, pas d'habillage. En `position: fixed`, elle ne déplace rien (vérifié : la
liste des chapitres reste au pixel près) et n'est pas rognée par le défilement du
panneau. Grand écran : à droite du panneau, à hauteur du bouton. Petit écran : sous le
bouton, dans le tiroir, et elle défile si elle est trop haute plutôt que de remonter
recouvrir le bouton qui l'a ouverte. Elle se referme d'un clic à côté, d'Échap, d'un
défilement du panneau ; un redimensionnement la **replace** (la fermer ferait
disparaître le menu sous le doigt quand la barre d'adresse mobile se replie). Les
outils sont rangés en deux groupes — « Écrire » et « Vérifier le texte » — chacun avec
une icône, un titre et une explication. Piège : le tiroir mobile glisse pendant 0,2 s ;
ouvert aussitôt, le bouton n'est pas encore à sa place, d'où un second placement à
260 ms — **posé à l'ouverture seulement**. Il était d'abord dans `placerListeOutils`
elle-même, qui se rappelait donc toutes les 260 ms, indéfiniment (28 replacements en
1,5 s mesurés) ; et chaque placement vidait `maxHeight` pour mesurer la liste, ce qui la
déployait en entier et ramenait son défilement à zéro : sur mobile, le menu
« remontait tout seul » pendant qu'on le faisait défiler. La hauteur naturelle se lit
maintenant sur `scrollHeight`, le défilement est conservé, et `overscroll-behavior:
contain` empêche le geste de se transmettre au panneau derrière.

**L'outil « Passages en italique »** (`ouvrirPassagesItalique`). Relève chaque passage
en italique des **paragraphes** — les titres et sous-titres sont exclus : ils sont en
italique (ou en gras) par leur mise en page, pas par une emphase de l'auteur. Un
nœud de texte est en italique si la balise la plus proche qui parle d'italique est
`<i>`, `<em>` ou `font-style: italic` (un `<span style="font-style:normal">` à
l'intérieur d'un `<i>` n'en est donc pas) et qu'aucun ancêtre n'est un `<h1>`–`<h6>`.
Les morceaux qui se touchent, ou que seul du blanc sépare, ne font qu'un passage ; un
passage coupé par du gras reste d'un seul tenant. Le relevé est en offsets sur le
texte des pages, comme l'outil des espaces : `surlignerPosition` y sait aller, page de
gauche comme page de droite (vérifié : la sélection est exactement le passage). La
fenêtre donne le numéro de page, le passage en italique dans son contexte, le
décompte (passages et mots) et un **filtre** sans accents ni majuscules.

Points à connaître :

- les frontières se traitent **dans l'ordre, une à une** : protéger un mot décale
  tout ce qui le suit, donc la frontière d'après doit se relire sur la mise en page
  à jour. C'est ce qui rend la repagination complète environ deux fois plus longue
  (de l'ordre de 250 ms contre 110 ms pour 46 doubles-pages) ;
- la zone d'édition n'est **jamais mesurée** (elle est sous le zoom) : l'affichage
  d'une double-page passe par `avecMotsProteges()`, qui compose sur le mesureur et
  ne donne à la zone que du HTML déjà prêt — le curseur et l'annuler/rétablir natif
  ne sont pas touchés ;
- **pendant la frappe**, un mot peut rester coupé au milieu de la double-page jusqu'à
  la prochaine recomposition (changement de page, débordement, aperçu) : modifier le
  DOM sous le curseur à chaque frappe casserait l'annuler/rétablir. Le fichier
  imprimé, lui, est toujours recomposé ;
- un mot plus long qu'une ligne, ou portant un trait d'union conditionnel saisi à la
  main, peut se couper malgré la balise ; on ne boucle pas dessus (3 essais).

**La tranche : le numéro de tome** (`tranche.pastilleForme`, `pastilleChiffres`,
`construireDosLivre`). Trois apparences — une **bande** de couleur sur toute la
largeur du dos (ce que la pastille a toujours été, donc le défaut : un livre
existant ne change pas d'aspect), un **rond** de couleur, ou le **numéro seul** sur
le fond du dos — et des chiffres **arabes ou romains**. Seul un nombre entier de 1 à
399 se convertit (« 2 » → « II ») ; « Hors-série » reste tel quel. Le rond a la
taille du chiffre sans jamais dépasser la largeur du dos. Pour le numéro seul, le
panneau reprend la couleur du texte du dos : celle du chiffre était choisie pour se
lire sur un aplat. Un bouton « Reprendre le tome N » recopie le tome de la série.
Tout est dans le JSON `tranche` : aucune migration.

**Ce qu'un navigateur ne sait pas faire** : convertir en CMJN, produire du
PDF/X-1a, appliquer un profil de sortie. Le panneau de contrôle affiché avant
génération le dit explicitement, plutôt que de laisser croire que le fichier
part tel quel chez l'imprimeur.

### Passe de test complète (octobre 2026)

L'éditeur a été éprouvé sur un vrai roman (« Aeran'Kael : L'Héritage Brisé », 370 pages, 59 chapitres),
chargé dans l'éditeur réel avec un faux Supabase en mémoire (enregistrement et relecture vérifiés), par
plusieurs centaines de manipulations : frappe, suppressions, collages, chapitres, recherche, formats,
gardes, curseurs, outils, aperçu, tous les modes d'impression, mobile. Ce qui en est sorti :

- **Coquilles vides et phrases coupées.** Une coupe de page tombant pile entre deux paragraphes laissait
  une copie VIDE du paragraphe au bord du morceau (`htmlEntre`). Elles s'accumulaient (+90 à chaque
  recomposition), décalaient la coupe d'une ligne (« trous » en bas de page) et, en fin de double-page,
  recevaient au recollage la suite du paragraphe coupé : la phrase se retrouvait en deux paragraphes (21
  dans ce livre). `htmlEntre` ne les produit plus, `repaginerTout` retire les anciennes
  (`retirerCoquillesVides`), `fusionnerSuite` verse la suite dans le dernier bloc qui a du contenu.
  L'outil **Relecture → Phrases coupées en deux** retrouve et recolle ce que l'ancien code a laissé
  (signe : premier morceau finissant par l'espace de fin de ligne, sans ponctuation, second commençant
  par une minuscule). La passe de rattrapage de `decouperEnDoublesPages` mesure chaque morceau avec le
  suivant, comme la remontée à la frappe : plus de trou qu'une frappe viendrait combler.
- **Une seule marque « suite », sur le premier bloc** (`nettoyerMarquesSuite`) : le navigateur la recopiait
  sur chaque paragraphe créé par Entrée en haut d'une page, et l'Entrée devenait un retour à la ligne.
- **Annuler / rétablir à l'échelle du livre.** L'annulation du navigateur se perdait dès que la double-page
  était réaffichée (texte remonté ou descendu, changement de page) : Ctrl+Z ne faisait plus rien. Un
  historique (`noterEtat`, `annuler`, `retablir`) note l'état du livre après chaque modification
  terminée (via `planifierBrouillon`), avec la position du curseur avant et après ; il couvre aussi le
  format et les espaces. Les tableaux sont recopiés, pas les chaînes. Ctrl+Z dans un autre champ
  (recherche, notes) ne touche plus au livre ; l'annulation du menu contextuel passe par là aussi.
- **Bords de page au clavier** (`gererToucheBordDePage`) : Retour arrière en haut de page, Suppr en bas
  agissent sur le texte des deux double-pages (`effacerAuBord`) ; Page suivante / précédente et les
  flèches changent de page. Aussi par `beforeinput` : les claviers de téléphone n'envoient pas la touche.
- **Recoller sans perdre l'espace** (`recollerSansPerdreEspace`) : en recollant deux paragraphes, le
  navigateur effaçait l'espace de fin du premier (« la ¶ regarder » → « laregarder »).
- **Texte caché** : une double-page qui ne tient pas sur l'appareil (autre navigateur, autre césure) fait
  descendre son trop-plein à l'affichage. Le mesureur coupe désormais les mots trop longs comme l'écran
  (`overflow-wrap: break-word`, que le navigateur donnait d'office à la seule zone éditable), et un mot
  plus long qu'une ligne n'est plus protégé contre la coupe (il débordait de sa colonne).
- **Enregistrement** : une PHOTO du livre au clic (`photoLivre`) — une frappe pendant l'envoi laissait le
  serveur incohérent et était déclarée enregistrée ; un enregistrement à la fois (deux Ctrl+S
  rapprochés posaient une fausse question de conflit) ; le curseur reste en place ; le brouillon n'est
  plus recréé après une sauvegarde et ne garde plus les pages dérivées (moitié moins lourd).
- **Images de couverture** : choisir une couleur de fond, « Supprimer l'image » ou en envoyer une autre
  effaçait aussitôt le fichier du stockage, avant tout enregistrement. Elles sont mises de côté
  (`oublierImage`) et effacées après un enregistrement qui ne s'en sert plus ; chaque envoi a un nom
  unique (`nomImageUnique`), l'adresse réécrite restant une heure en cache.
- **Impression en pages simples** (mode par défaut) : plantait sur une variable `pages` disparue.
  **Espaces insécables** (fenêtre des coupes) : fonctions restaurées, le bouton n'appelait plus rien.
- Divers : interligne sans sélection appliqué au livre (il se posait sur la zone d'édition), style
  « Titre » = nouvelle page, collage et dépôt en vrais paragraphes (dépôt nettoyé comme le collage),
  voile sur les recompositions longues, panneau resserré sur les écrans peu hauts, aperçu avec délai de
  secours, retour à la bibliothèque qui propose d'enregistrer.

Reste tel quel : Entrée au milieu d'un titre de chapitre le coupe en deux chapitres (Ctrl+Z le défait) ;
deux trous d'une ligne sur 186 double-pages, dus aux veuves et orphelines d'un paragraphe à cheval.

### Tarification (`sites/editeur-livre/tarifs.html`)

Page publique, accessible par l'onglet « Tarification » de la navigation (accueil, « Monter son livre »,
« Faire imprimer ») et par le pied de l'accueil. Dans cette navigation, les liens sont de simples
liens texte (sans cadre ni emoji : quatre pilules d'affilée alourdissaient la barre au point de toucher
le titre) ; seul « Se connecter » / « Mes livres » reste un bouton, et la page courante est soulignée
(`aria-current="page"`). Les liens ont besoin d'environ 920 px : sous 940 px, la barre ne garde que le
bouton (classe `nav-liens` des pages publiques), d'où le second accès par le pied de l'accueil. **C'est une vitrine : aucun abonnement n'existe encore.** Les
boutons payants sont désactivés (« Bientôt disponible ») et un encadré le dit en tête de page.
Rien dans le code n'impose les limites annoncées (nombre de livres, livres publiés, fichier pour
l'imprimeur) : il n'y a ni colonne de formule, ni règle côté base, ni paiement.

Formules envisagées (TTC) : **Découverte** 0 € (2 livres, écriture, couvertures, aperçu, export
imprimable) ; **Auteur** 4 €/mois ou 40 €/an (10 livres, fichier pour l'imprimeur, séries, notes,
3 livres publiés) ; **Atelier** 8 €/mois ou 80 €/an (livres et publications illimités, stockage
d'images étendu, réponse prioritaire). L'annuel vaut dix mois. Repères de marché relevés à l'écriture
(sources secondaires, à revérifier) : Reedsy Studio gratuit, Scrivener environ 50 à 60 € une fois,
Atticus 147 $ une fois, options d'écriture payantes de 5 à 8 $ par mois.

**On ne vend que ce qui existe.** Le fichier pour l'imprimeur ajoute le fond perdu, les repères de
coupe et le blanc tournant ; la conversion CMJN et PDF/X-1a n'existe pas (voir « Faire imprimer »),
et la page le dit dans sa FAQ plutôt que de le promettre.

**Avant d'ouvrir de vrais abonnements** (voir `conditions-utilisation.html`, qui dit « projet personnel,
gratuit et sans activité commerciale », et `mentions-legales.html`) : une activité payante n'est plus
celle d'un éditeur non professionnel, donc l'anonymat de l'éditeur ne tient plus ; il faut un statut
d'entreprise, des conditions de vente, la mention de TVA, le droit de rétractation (contenu
numérique), le médiateur de la consommation et la déclaration du prestataire de paiement dans
`confidentialite.html`. La bascule mensuel/annuel ne fait que changer du texte affiché.

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

## Recto-verso (image au recto, cartes à message au verso)

Un site **sans serveur** : `sites/recto-verso/` (`index.html`, `style.css`, `app.js`). L'image est
lue par `FileReader` et ne quitte jamais le navigateur ; rien n'est gardé sur le site (ni
base, ni `localStorage`). Il n'ajoute donc aucun appel tiers ni aucun cookie : seule la page
de confidentialité mentionne qu'il ne conserve rien. Il est inscrit au portail
(`DEFAULT_SITES`, `ALLURE_SITES`), donc **l'accès « recto-verso » se coche dans la gestion des
comptes** pour qu'il apparaisse dans le tableau de bord ; la page elle-même s'ouvre sans
connexion, puisqu'elle ne touche à aucune donnée.

**Ce que fait la page.** Format A3 / A4 / A5, portrait ou paysage. Recto : une image, placée
en « Remplir » (elle couvre la feuille, rognée) ou « Entière » (avec des bandes de couleur), puis
**taille de 10 à 400 %**, **rotation de -180° à 180°** (curseur, ou quarts de tour ↺ / ↻ ; « Réinitialiser »
remet tout) et cadrage en la glissant. « Remplir » et « Entière » ne donnent que la taille de départ,
calculée **avec la rotation** : à 100 %, « Remplir » couvre exactement la feuille à n'importe quel
angle (il faut que le rectangle tourné contienne la feuille : demi-largeur ≥ (L·|cos| + H·|sin|) / 2,
et de même pour la hauteur) et « Entière » montre l'image tournée en entier. Au-delà, rien n'est
imposé : si la taille, l'angle ou la position laissent un bord découvert, un message le dit et le
**fond** (« Fond (bandes visibles) ») apparaît ; seul le centre de l'image est retenu sur la toile,
pour qu'on ne la perde pas. La rotation est un `transform: rotate()` autour du centre de l'image,
identique sur chaque feuille. La résolution effective est affichée (ppp), avec un avertissement sous 150.
Verso : une grille de colonnes × lignes (modèles 2×2 à 4×6, jusqu'à 12 × 12) qui occupe toute la
feuille, une marge réglable, un trait de découpe gris clair (`#cfcfcf`, 0,25 mm) entre
toutes les cartes et autour de la grille. Chaque carte est un champ de texte libre (police,
taille, couleur, fond du verso) ; **un texte trop long rapetisse seul, jusqu'à 5 pt**, et la
carte est cerclée de rouge à l'écran s'il ne tient toujours pas. « Remplir avec une liste »
répartit un message par ligne sur les cartes, dans l'ordre de lecture. « Retourner la feuille »
fait pivoter la feuille (rotation 3D autour de l'axe vertical) du recto au verso.

**Deux feuilles collées.** « 2 côte à côte » ou « 2 empilées » : une seule image s'étend sur la
« toile » (les deux feuilles bout à bout, 420 × 297 mm en A4 côte à côte) et chaque feuille n'en
montre que sa part, pour que l'image se prolonge de l'une à l'autre une fois collées. Chaque feuille
porte sa propre copie de l'`<img>`, décalée de sa position sur la toile (elles partagent une même
adresse `blob:`, l'image n'est décodée qu'une fois) : c'est ce qui permet d'imprimer les feuilles
séparément. La taille, la rotation, le glissement et la résolution (ppp) se calculent sur la toile ; un trait
pointillé marque l'endroit du collage, à l'écran seulement. Chaque feuille a **son propre verso** :
mêmes réglages de grille, textes indépendants (`textes` et `textes2` dans le projet) ; « Remplir avec
une liste » remplit la feuille 1 puis la feuille 2. Comme une vraie feuille retournée, deux feuilles
côte à côte changent de place au verso (la feuille 1, à gauche au recto, est à droite au verso) ;
empilées, elles gardent leur ordre. Les étiquettes « Feuille 1 / 2 » aident à s'y retrouver.

**Taille de l'affichage.** La feuille est ajustée à l'écran (« Ajusté ») : toute la largeur laissée
par le panneau, et la hauteur de la fenêtre moins la barre du dessus ; la zone reste collée en haut
quand on défile. Les boutons **− / Ajusté / +** l'agrandissent par pas de 25 %, jusqu'à 400 %, dans
une fenêtre qui défile (le point au centre est conservé). C'est un réglage d'écran : il ne change
rien à la feuille imprimée et n'est pas enregistré dans le projet. Sur grand écran, le titre est
rangé au-dessus du panneau (dans la grille de `.atelier`) pour que la feuille ait toute la
hauteur ; sur petit écran il reste en tête de page. Les textes d'aide sont dans le panneau, pas
sous la feuille, pour ne pas lui prendre de place.

**Les télécharger séparément.** « Sortie » propose « Les deux feuilles », « Feuille 1 seulement »
ou « Feuille 2 seulement » ; on imprime en « Enregistrer au format PDF » une feuille après l'autre
pour obtenir deux fichiers. Les pages sortent dans l'ordre d'une impression recto-verso :
**recto 1, verso 1, recto 2, verso 2**.

**Tout est en millimètres.** La feuille est dessinée à sa taille réelle (`--W`, `--H`, et `--CW`,
`--CH` pour la toile) puis réduite à l'écran par un `scale`. `#stylePage` reçoit la règle
`@page { size: … }` d'**une** feuille (une règle `@page` ne lit pas de variable CSS). À l'impression
(`imprimer()`, et `beforeprint` pour Ctrl+P), `app.js` pose dans `#zoneImpression` une **copie** de
chaque face, dans l'ordre ci-dessus, en simples blocs l'un après l'autre ; tout le reste de la page
disparaît. Une copie plutôt qu'un réordonnancement par CSS (`order` en flex ou en grille) : les
sauts de page dans ces mises en page varient selon les navigateurs, des blocs ordinaires non.
Chaque face commence une page (`break-before: page`, ignoré pour la toute première) et la dernière
n'est suivie d'aucun saut. Chaque face perd 0,3 mm de hauteur : une boîte exactement aussi haute
que la page déborde parfois d'un arrondi et ajoute une page blanche (l'image est posée depuis le
haut, elle ne bouge pas : seul son dernier 0,3 mm est coupé). Avant d'ouvrir la boîte d'impression,
le bouton attend le décodage des images copiées.

**Le verso est dessiné tel qu'on le voit en retournant la feuille** (comme une page qu'on
tourne) : la carte en haut à gauche du verso est donc derrière la partie en haut à droite du
recto. C'est ce que fait une impression recto-verso « reliure bord long » en portrait, « bord
court » en paysage ; le texte d'aide sous la feuille le rappelle.

**Enregistrer le projet** écrit un fichier `recto-verso.json` (réglages, textes et image en
`data:`) sur l'ordinateur ; **Ouvrir** le relit. À l'ouverture tout est revalidé : version,
nombres bornés, couleurs en `#rrggbb`, image uniquement `data:image/…`, textes tronqués — un
fichier piégé ne peut pas injecter de CSS ni d'adresse.

**Vérifié dans le navigateur de l'appli** (mesures en mm à l'écran) : tailles A3/A4/A5 et
paysage ; carte de 70 × 59,4 mm en 3 × 5 sur A4 ; grille sur toute la feuille ; traits gris clair ;
image qui couvre la feuille, zoom, glissement borné ; texte long rétréci ; liste répartie ;
aller-retour du projet ; mise en page d'impression simulée (les règles `@media print`
appliquées à l'écran : des faces de 210 × 297 mm, à la suite, sans rotation). Pour les deux
feuilles : continuité exacte de l'image (décalage de 210 mm côte à côte, 297 mm empilées, avec
zoom et glissement), feuille 1 à droite au verso, textes séparés, répartition d'une liste, ordre
recto 1 / verso 1 / recto 2 / verso 2 et choix d'une seule feuille, projets d'avant les deux
feuilles toujours lisibles. Taille et rotation : « Remplir » couvre les quatre coins à dix angles
(0°, 1°, 30°, 45°, 89°, 90°, 137°, -75°, ±180°), « Entière » reste entière, la taille de 10 à 400 %
avec avertissement quand l'image ne couvre plus, les quarts de tour, la réinitialisation ; sur deux
feuilles et sous rotation, centres décalés d'exactement 210 mm et raccord couvert ; la rotation
voyage jusqu'aux copies d'impression et dans le projet enregistré (valeurs hors limites bornées,
projet d'avant la rotation lisible). **Non vérifié** :
une vraie impression papier, la boîte d'impression du navigateur (page blanche en trop,
sens du retournement de la feuille selon l'imprimante) et un téléphone réel.

## WorldMap (cartes de fantasy)

`sites/worldmap/` — un éditeur de cartes de mondes et de régions. Comme Recto-verso, tout se
passe dans le navigateur : **pas de compte requis, rien n'est envoyé nulle part**. Les cartes
vivent dans IndexedDB (`stockage.js` : un magasin `cartes` pour les cartes entières, un magasin
`meta` pour la galerie, afin de ne pas relire des cartes complètes rien que pour les lister).
Sauvegarde automatique 1,5 s après la dernière modification ; export PNG (2 048 à 8 192 px) et
fichier `.worldmap.json` (réimportable depuis la galerie).

| Fichier | Rôle |
|---|---|
| `index.html` / `galerie.js` | Galerie « Mes cartes » (tuiles à vignette), création (taille, style, mer vide ou monde aléatoire), import/export, duplication |
| `editeur.html` / `editeur.js` | Éditeur : vue, outils, historique, panneaux, enregistrement, export |
| `moteur.js` | Rendu (`Moteur.dessiner`), matériaux, décors, tampons, thèmes, types de lieux, ornements. Fonction pure : même rendu pour l'écran, les vignettes et les exports |
| `generateur.js` | Monde aléatoire (bruit fractal), produit de vrais traits de pinceau |
| `stockage.js` | IndexedDB |

**Le zoom « infini » tient au vectoriel.** Une carte n'est pas une image : ce sont des objets en
unités du monde (des **km**) — traits de pinceau, tracés, noms, lieux — redessinés à chaque
image. Le pinceau se règle en **pixels écran** : zoomer avant de peindre donne un trait plus fin
dans le monde, d'où le détail à volonté. Le niveau de zoom est plafonné à ×15.

**« Niveau » = zoom relatif à la vue d'ensemble** (`Moteur.zoomAjuste`) : 1 = la carte entière,
10 = dix fois plus près. Il ne dépend ni de la taille de l'écran ni de celle de la carte, si bien
que les lieux visibles à la vue d'ensemble le sont aussi sur un téléphone ou dans un export. Chaque
type de lieu a son niveau d'apparition (capitale : toujours ; ville : ×0,6 ; village : ×2,5…),
réglable lieu par lieu.

**Terre et eau.** Les matériaux « terre » colorent ; « Eau » (et la gomme) **creuse** la terre déjà
peinte, sur une couche à part. De là le trait de côte et le halo d'eau peu profonde, obtenus avec
des ombres portées de la silhouette de la couche. Les décors (arbres, montagnes, collines, dunes…)
ne sont plus attachés aux coups de pinceau : ils naissent du terrain, à l'échelle de ce que l'on
regarde (voir « Décors qui s'adaptent au zoom »).

**Thèmes** (`Moteur.THEMES`) : Atlas, Parchemin et Illustré. Illustré va vers le rendu des cartes de
fantasy peintes : la « mer » est le papier (taches accrochées au monde, bords sombres), le bleu ne
vit qu'autour des côtes (ombre portée de la silhouette, deux passes), une falaise décalée vers le bas
donne du relief à la terre, et un cadre à double filet orne les coins. Les décors ont été enrichis
(arbres feuillus à trois verts, montagnes hachurées). Les lieux y sont de petits **dessins** au
lieu de pictogrammes (`iconeIllustree` : château, ville, village, forteresse, port avec bateau,
ruines, donjon, temple, tour, mine), chacun dans une boîte de 100 × 100 mise à l'échelle ;
`Moteur.tailleIcone(lieu, theme)` et `Moteur.iconeAuto` choisissent pictogramme ou dessin selon le
thème (`lieuxIllustres`), et l'éditeur s'en sert pour la sélection, le curseur et la palette.

**Rivières qui serpentent.** Le tracé posé ne donne que le cours général : `serpenter()` (moteur.js)
le lisse (Catmull-Rom, qui passe par les points posés) puis y ajoute des méandres — deux ondes de
longueurs voisines, la longueur d'onde valant une quinzaine de largeurs de rivière, le décalage
s'éteignant aux deux bouts pour que source et embouchure restent où l'on a cliqué. Déterministe
(graine = identifiant) et mis en cache par rivière (`WeakMap`). Champs de la ligne : `meandre`
(0 à 1, 0 = droite) et `delta` (la rivière passe de 35 % à 125 % de sa largeur, tracée par
tronçons, contours d'abord pour éviter les raccords). `Moteur.pointsAffiches(ligne)` donne le tracé
tel qu'il est dessiné : c'est lui, et non les points de contrôle, que l'éditeur utilise pour cliquer
une rivière. Les rivières sans ces champs (cartes d'avant) restent droites.

**Terrain** : « Volcan » (aiguilles d'obsidienne, fissures de lave, cailloux sombres), massifs de
montagnes (un grand pic entre deux petits), forêts en canopée plus dense. Le monde aléatoire
normalise l'altitude sur le sommet de la carte (sinon les cimes recouvraient presque tout ou rien),
pose un volcan sur un massif et fait **descendre des rivières** de la montagne à la mer en suivant
la pente (voisin le plus bas encore inexploré, rejet des tracés qui tournent en rond).

**Murailles, navires, côtes.** Le tracé « Muraille » dessine une ombre au sol, un contour, la
pierre, des créneaux en tirets sur le faîte, puis des tours à toit conique aux deux bouts et tous
les neuf largeurs (`tracerMuraille`, qui réutilise `tourPierre` des lieux illustrés ; trop petites
à l'écran, tours et créneaux disparaissent). « Navire » est un type de lieu (dessin : coque,
deux voiles, fanion, sillage d'écume). Les **vagues** du thème Illustré (`th.vagues`) sont des
filets à distance fixe en pixels de la côte : la silhouette de la terre est élargie (copies
décalées dans 12 directions) puis amputée de la même silhouette moins épaisse, il reste un
anneau, teinté ; travaillé à demi-résolution. Les disques d'un **nuage** (monde généré) sont
tracés comme des polygones irréguliers (rayon de 78 à 112 %, graine du trait) : les côtes
gagnent des anses et des caps au lieu d'une suite de cercles. Le monde aléatoire pose aussi
quelques îlots et des navires en pleine mer (loin du cadre, des côtes et les uns des autres).

**Décors peints.** Arbres, conifères, palmiers, acacias, arbres morts ou d'automne, pics, rochers,
parcelles de champs, blocs de glace, roseaux et herbes sont peints **une seule
fois** dans de petits canvas (`peintArbre`, `peintMontagne`…) : dégradés, ombre au sol, touches de
lumière, pas de contour de dessin animé. Une forêt (`masse: true`) se lit comme une masse : au cœur, un fond uni de la couleur du feuillage (le sprite `canopee`, vu du dessus ; sinon le sol de la forêt), et seule la lisière porte des arbres, qui en dessinent le contour (`calculerTuile`) ; un tracé (route, chemin, rue de maisons, rivière, muraille, falaise — `CLAIRIERES`) dégage la végétation : arbres et massifs s'en écartent d'environ une demi-taille (`distTrace` ; une muraille compte la largeur de ses tours), et les bords de ce couloir se comportent comme une lisière (sondes de `fractionDedans`), si bien qu'on voit le tracé à travers une forêt; les éboulis (`masse: "eboulis"` : aiguilles et basalte du volcan, rocaille, glace) suivent la même règle sans disque de fond — leur fond uni est le sol du terrain, la lisière étant plus large pour les petits rochers ; au cœur les rochers restent, très atténués; un massif (montagnes, cimes : `masse: "relief"`) est UNE seule forme vue du dessus : l'union de grands disques (`canopee`, contour d'abord, côté extérieur seulement, puis remplissage uni) avec quelques sommets isolés au milieu — les styles de profil gardent leurs montagnes (entrées `cl`); le cerne n'est tracé que sur le bord extérieur de la masse : on peint d'abord la silhouette cernée de chaque arbre de lisière (`prof` 5), puis le fond uni, puis les remplissages (`prof` 4), si bien que seul le contour de l'ensemble reste visible : pleins à moins d'une taille et demie du bord, puis, vers l'intérieur, sans cerne ni ombre, de la couleur du fond et réduits à des arcs en tirets (`prof` 1 et 2, variante +100 dans `arbreDessus`), jusqu'à se confondre avec le fond uni ; au cœur, quelques arcs en tirets seulement. Un bosquet, trop petit pour avoir un cœur, garde tous ses arbres. On les colle ensuite par milliers (`colle`), avec cinq
définitions (64 à 1 024 px) choisies d'après le zoom (`ZPX`). Seules les terres volcaniques restent
en vectoriel.

**Décors qui s'adaptent au zoom (`semerDecors`).** Un décor n'appartient plus à un coup de pinceau
(sa taille suivait celle du pinceau : une forêt peinte sur le continent devenait trois arbres géants
et flous une fois qu'on zoomait, et une plaine restait vide). Il naît du **terrain**, là où l'on
regarde. Le monde est découpé en cases de plus en plus fines (`pointCase` : chaque niveau coupe les
cases du précédent en quatre) et chaque case porte **un** emplacement. Quand une case est coupée,
l'emplacement qu'elle contenait reste où il était — la sous-case où il tombe en hérite — et les
trois autres en reçoivent un nouveau. D'où trois propriétés : les décors ont une taille en **pixels
écran** (un arbre fait une trentaine de pixels de ×1 à ×3 000) ; en zoomant, ceux qui sont visibles
ne bougent pas et de nouveaux **poussent** entre eux, d'abord minuscules — rien n'apparaît ni ne
disparaît d'un coup ; et le nombre de décors dépend de la taille de l'écran, pas de celle du monde.
Rien n'est enregistré : tout vient d'un hachage de la case. Le terrain sous chaque emplacement est lu
dans le masque ; un décor ne pousse que si ses quatre voisins disent le même terrain (il se tient à
l'intérieur de son biome, loin de l'eau et des routes). La table `DECORS` donne, par terrain, l'écart
(`C`), la part d'emplacements occupés (`p`) et le ou les décors (une savane mêle acacias et herbes
sèches). **Transitions** : `fondreTransitions` recopie la couche de terre floutée par-dessus
elle-même en « source-atop » — les couleurs se mélangent aux frontières, la côte reste nette.
**Texture du sol** (`textureSol`) : des marbrures accrochées au monde, à deux échelles fondues l'une
dans l'autre, pour qu'un aplat ait du grain à toutes les distances.

**Masque des matériaux.** Canal rouge : le terrain (rang du matériau × 10) ; canal bleu : les
réglages de décor du trait (densité × 3 + taille) ; transparent : l'eau — mer, gomme, mais aussi lacs
et rivières, creusés un peu plus larges que le dessin ; canal vert : les routes et leurs abords,
AJOUTÉES en « lighter » sans rien effacer (sous une route, l'eau reste de l'eau). Résolution : moitié
de l'écran, une lecture de pixels par image.

**Routes et ponts.** « Route » (terre battue : bas-côtés sombres, chaussée, milieu usé, ornières) et
« Sentier » (pointillé) ondulent légèrement d'elles-mêmes (`forceMeandres`). Un **pont** est la route
elle-même au-dessus de l'eau : `dessinerPonts` suit la route, repère au masque les tronçons sur l'eau
(mer, lac, rivière), réunit ceux que sépare moins de trois largeurs de terre (une rivière qui serpente
ne donne qu'un pont), les prolonge un peu sur les rives, et trace le tablier le long de ce tronçon —
courbe comprise (`pontLe` : garde-corps, planches en pointillé perpendiculaire, poteaux).

**Cohérence (voies, lacs).** Le masque des matériaux déborde de l'écran d'un cinquième de
chaque côté, et `materiauEn` distingue « eau » (null) de « inconnu » (undefined, hors masque) : la
confusion faisait naître des ponts au bord de l'écran. Les voies sont tracées ensemble, couche par
couche (`tracerVoies` : bas-côtés, chaussées, milieux, ornières), si bien qu'un embranchement se fond
dans la route qu'il rejoint ; dans l'éditeur, un point posé près d'une voie (ou d'une rivière pour
une rivière) s'y **accroche** (`accrocher`, anneau doré sous le curseur). Les **lacs** sont peints
dans la couche de terre en « source-atop » : ils n'existent que sur la terre (jamais sur la mer ni
le trait de côte) et passent sous les arbres de la rive.

**Eaux douces.** Lacs et rivières **creusent la terre** comme la mer (`creuserEaux`) : la côte, le halo
et la falaise les bordent d'eux-mêmes, et là où une rivière ou un lac touche la mer il n'y a plus de
frontière. Pour les thèmes dont la mer est du papier (Illustré, Parchemin), `eauxDouces` peint leur eau
SOUS la terre (visible seulement dans le creux) ; le thème Atlas n'en a pas besoin. Une seule forme
de rivière (`traceRiviereEau`) sert au creusement, à l'eau douce et au masque.

**Rien n'est ajouté tout seul.** Les biomes ne posent plus ni chemins, ni cabanes, ni grottes : le
système de « détails qui apparaissent en zoomant » (`preparerDetails`, `poiCase`, `cheminDe`) a été
retiré, avec `terrainEn` qui ne servait qu'à lui. Un terrain ne produit que ses décors naturels
(arbres, pics, rochers…). Tout le reste se pose à la main : les anciens petits lieux sont devenus des
**types de lieux** ordinaires (cabane, campement, ferme, menhirs, grotte, vestiges, oasis, pilotis)
et les chemins se tracent avec l'outil Tracés (sentier).

**Lacs** : contours fermés (`carte.lacs`), dessinés à main levée avec l'outil Lacs (K), puis déplaçables,
remodelables (sommets, double-clic pour en ajouter) et redimensionnables. Rive de sable, eau en
dégradé, ombre intérieure, rides.

**Interface** : thème « atelier du cartographe » en CSS pur (bois à fibres, parchemin au bruit SVG
intégré, filets d'or, sceaux de cire, boutons de laiton), icônes d'outils en SVG.

**Clic droit sur un lieu** : menu *Renommer / Éditer la ville / Supprimer* (`ouvrirMenu`). « Éditer la
ville » crée au premier appel la **carte du lieu** (`carteDuLieu` : une plaine à l'échelle du lieu,
de 0,3 à 4 km selon le type, même style que la carte mère ; le trait de fond porte `sansDecor` pour
ne pas semer des touffes géantes) et la relie : `lieu.carteId` côté mère, `carte.parent = { carteId,
lieuId, nom }` côté fille, d'où le bouton « ↑ Carte mère » dans la barre. Les appels suivants
rouvrent la carte ; si elle a été supprimée, elle est recréée. La carte courante est enregistrée
avant de changer de page (`allerVers`).

**Outils** : après avoir posé un lieu ou un nom, on revient à l'outil Sélection (sinon le fantôme de
l'icône restait collé au curseur) ; Échap quitte aussi l'outil. Le cercle de sélection d'un lieu, ou
le cadre d'un nom, n'est plus dessiné quand l'objet est masqué par le zoom.

**Fluidité.** L'éditeur calcule le rendu complet dans une image de travail plus grande que l'écran
(marge de 15 % de chaque côté) et la recopie à l'écran. Pendant un geste (déplacement, molette,
pincement), il ne recalcule rien : il recopie cette même image décalée et mise à l'échelle — moins
d'une milliseconde, et c'est la vraie carte, pas un brouillon simplifié qui changerait d'aspect. Le
rendu complet (environ 75 ms) suit 140 ms après le dernier geste. Le mode `rapide` du moteur n'est
plus utilisé par l'éditeur.

**Eau douce du style Illustré** : peinte à part puis gardée seulement dans le contour de la terre
d'avant le creusement (une rivière tracée jusqu'à la mer n'y déborde plus en pointe). La mer de ce
style est un bleu-gris de vieille carte au large et un bleu franc le long des côtes, le même que les
rivières. Les chemins entre deux petits lieux ont un coude qui dépend de la paire, pas du sens : deux
lieux qui se choisissent l'un l'autre n'ont qu'un seul chemin.

Textes et icônes sont dessinés en pixels écran, après le reste : nets à toute échelle, et sans les
problèmes de très petites polices des canvas.

**Ajouté au portail** (`DEFAULT_SITES`, id `worldmap`). Comme Recto-verso, il ne lit pas la session
et ne touche pas Supabase ; l'entrée du tableau de bord reste soumise à `acces` comme les autres.

**Atelier complet.** Ce que l'éditeur sait faire de plus :

- **Terrains** (B) — 21 matériaux rangés par famille (plaines, forêts, reliefs, terres arides, eaux
  et froid), chacun avec un aperçu de son décor. Réglages du pinceau, enregistrés dans le trait :
  `dens` (décors : aucun, rares, normal, dense), `ech` (petits, normaux, grands) et `rug` (bord lisse
  → découpé : le contour devient une suite de polygones irréguliers, `formeRugueuse`, mise en cache
  par trait — de quoi dessiner des côtes à anses et à caps ; la gomme l'a aussi).
- **Décors** (D) — les mêmes dessins, posés **un par un** (`carte.tampons` : `{ type, v, x, y, s }`) :
  clic pour en poser un, glisser pour en semer. Un tampon appartient au monde (il grandit quand on
  s'approche) jusqu'à une taille d'écran plafonnée (`Moteur.tailleTampon`), et les décors du terrain
  lui laissent la place.
- **Tracés** (L) — en plus des rivières, routes, sentiers, murailles et frontières : **route pavée**
  (joints de pavés, ponts), **falaise** (hachures du côté droit du tracé, « Inverser le sens »),
  **route maritime** (pointillé), et **territoire** (une frontière refermée, `ferme`, au fond
  coloré, `fond`). Glisser trace à main levée ; la sinuosité des voies se règle.
- **Noms** (T) — styles Relief et Lieu-dit, **courbure** (`courbe` : les lettres sont posées une à
  une le long d'un arc), espacement des lettres, opacité, taille au curseur.
- **Lieux** (P) — 32 types en cinq catégories (cités, ouvrages, mystères, nature, repères), plus
  **votre propre image** (réduite à 256 px, gardée dans `carte.images` en data-URL — une adresse
  distante est refusée). Par lieu : sous-titre, taille, couleur (toits et bannière, ou repère),
  miroir, nom affiché ou non, position (auto, bas, haut, gauche, droite), style, taille et couleur
  du nom, niveau d'apparition (« Dès ce zoom »), notes privées, carte détaillée. À l'écran : fondu à
  l'apparition, lieux du sud devant ceux du nord, et **noms qui ne se recouvrent pas** — le plus
  important d'abord, les autres cherchent une place libre autour de leur icône, sinon attendent
  que l'on zoome.
- **Ornements** (`carte.ornements`, réglés dans « Carte… ») : rose des vents, échelle graphique,
  cartouche de titre — à la mesure de la carte, donc présents dans l'image exportée.
- **Autour** : minicarte (M) cliquable, index des lieux avec recherche (un clic y mène), clic droit
  sur tout objet (dupliquer, supprimer…), Ctrl+D, historique par lots (une traînée de décors
  s'annule d'un coup), raccourcis actifs même quand un curseur a le focus.
- **Export** : la carte entière ou la vue actuelle ; symboles « comme à l'écran » (l'image est
  dessinée comme sur un écran de 2 048 px puis agrandie : plus nette, pas plus chargée) ou « fins ».

**Style Enluminé** (`THEMES.enlumine`) — le rendu « carte peinte » : la mer est le parchemin et le
bleu ne tient qu'en une large bande le long des rivages (`glowMin`, trois passes) ; la terre est un
plateau (falaise épaisse tracée par pas, `falaisePx`, et ombre des rivages : la silhouette de l'eau
projetée sur la terre, `ombreCote`) ; les terrains ont des couleurs plus denses (`couleurs`, lues par
`tracerTrait`) ; les décors sont un peu plus grands (`echDecors`) et **cernés d'encre** — le sprite
est assombri puis sa silhouette, décalée dans huit directions, est glissée dessous (`encreDecors`,
mis en cache à part) ; le cadre gagne volutes et fleurons (`orneRiche`).

**Terres volcaniques.** `fissuresLave` trace un réseau de fissures rougeoyantes sur le terrain
« Volcan » : chaque emplacement des cases emboîtées est relié à celui de la case qui le contient au
niveau au-dessus, d'où un réseau en arbre (grosses coulées, ramifications de plus en plus fines) qui
reste en place quand on zoome, s'épaissit doucement et se ramifie en fondu. Le décor du terrain est
un bouquet d'aiguilles d'obsidienne (`peintAiguilles`, aussi en tampon) mêlé de roches sombres.
**Montagnes** : plus massives (96 px) et à facettes claires et sombres. **Forêts** : trois essences
mêlées. Le monde aléatoire sème aussi des plaques de **champs** dans les basses plaines.

**Voies sous les arbres.** Routes et sentiers ne sont plus tracés par-dessus la carte : ils sont
peints DANS la couche de terre (`tracerVoies` en « source-atop », jamais sur l'eau), après les champs
et la lave et avant les décors. Les arbres qui les bordent passent donc devant, et le couloir dégagé
dans le masque est réduit au pied de la voie (seuls les grands décors s'en écartent davantage).
Texture refaite : talus en ombre douce, bord net, chaussée, milieu usé, cailloux sur les bords,
ornières. **Ponts** (`pontLe`) : ombre sur l'eau, parapets de pierre, tablier de la couleur de la voie,
dalles en travers, piles rondes ; en bois à planches pour un sentier.

**Champs** (`dessinerChamps`) : un damier de parcelles — quadrillage déformé, une culture et des
sillons par case, des haies entre elles — au lieu de parcelles isolées. Hiérarchique comme les
décors : une parcelle qui se divise transmet sa couleur à ses filles, qui prennent peu à peu la leur ;
les nouveaux coins et les nouvelles haies apparaissent en fondu. **Montagnes** : deux tailles mêlées,
écart et marge réduits — une crête étroite porte sa rangée de sommets dès la vue d'ensemble.
**Zoom** plafonné à ×15 (`NIVEAU_MAX`).

**Décors fixés dans le monde (remplace « qui poussent en zoomant »).** Comme sur une carte
imprimée : même nombre de décors, aux mêmes places, de la même taille en km à tous les zooms — zoomer
les agrandit, rien n'apparaît ni ne disparaît. Le niveau de cases d'un terrain (`niveauDecor`) ne
dépend plus de la vue mais de la carte (`zoomBase` : la carte tenant dans 1 400 px), de son **échelle
des décors** (`carte.finesse`, 0 à 2, réglée dans « Carte… », 1 par défaut) et de la **finesse du
trait** (`fin`, 0 à 4, dans le canal vert du masque) : chaque cran divise la taille par deux. Au
pinceau, « Auto » la tire du zoom au moment de peindre — peindre de près donne des décors fins — ou
on la fixe (×1 à ×16). La taille d'un décor est proportionnelle à sa case. Seule entorse, pour la
lisibilité et la vitesse : des décors qui feraient moins de quelques pixels sont dessinés un sur
quatre, deux fois plus grands, aux mêmes endroits. Champs et fissures de lave sont fixés de même ; les
tampons n'ont plus de taille plafonnée à l'écran.

**Affiner les décors** (outil Terrains, groupe « Détail ») : un pinceau qui ne change pas le terrain,
seulement la finesse de ses décors — pour détailler après coup une région peinte à l'échelle du
continent. Les zones sont dans `carte.finesses` (`{ taille, pts, fin }`) et ont leur propre petit
masque (`masque.fin`), lu seulement quand la vue en contient ; là où il y en a une, sa finesse
remplace celle du trait. « Retirer les zones affinées » les enlève toutes (annulable).

**Gomme à décors** (Terrains → Détail) : une zone de `carte.finesses` peut porter `dens` au lieu de
`fin` (0 : plus aucun décor ; 1 : quelques-uns) — canal vert du masque des zones. Pour ouvrir une
clairière ou dégager un col sans repeindre le terrain. **Bâtiments** : maisons à colombages, fenêtres,
cheminées et rangs de tuiles ; murs à assises de pierre (`assises`) ; porte à herse (`porte`) ; la
capitale gagne un second rang de tours et des bannières, la ville devient une ville close (enceinte,
église, trois rangs de toits), le village un hameau de cinq maisons.

**Sélection multiple** (`E.multi`). Maj + clic ajoute ou retire un objet, Maj + glisser dans le vide
trace un cadre (`objetsDans` : ce qui y tombe entièrement), Ctrl+A prend tout. Glisser l'un des objets
les déplace tous ; « Plus petits / Plus grands », Dupliquer (Ctrl+D) et Supprimer s'appliquent au
groupe. Chaque opération est un seul pas d'historique (un « lot » ; les suppressions y sont triées par
rang pour que « Annuler » remette chaque objet à sa place).

**Calques** (`carte.calques`, bloc « Calques » du panneau). Sept familles — décors du terrain, décors
posés, tracés, lacs, noms, lieux, ornements — chacune avec un œil (masquer) et, pour les objets, un
cadenas (verrouiller : plus sélectionnable, donc plus déplaçable par erreur). Un calque masqué n'est
dessiné ni à l'écran ni dans l'export : `Moteur.dessiner` reçoit `cacher` et travaille sur une copie
de la carte aux collections vidées, si bien que masque, ponts et creusement suivent d'eux-mêmes.

**Villes qui s'étalent.** Deux terrains « Bâti » : **Ville (quartiers)** — maisons serrées aux toits
de teintes variées, grandes bâtisses, clochers (`peintMaisonVille`, qui réutilise `maison` et
`tourPierre`) — et **Faubourg** (maisons éparses, arbres, parcelles). Ce sont des terrains comme les
autres : finesse, densité, gomme à décors s'y appliquent, et une route tracée à travers ouvre une rue
(les maisons s'en écartent). Maison, bâtisse et église existent aussi en tampons.

**Rivières plus naturelles.** `traceRiviereEau` dessine un ruban continu (deux rives décalées du
tracé) au lieu de tronçons à paliers : un filet à la source, une largeur qui croît sans à-coups
jusqu'à l'embouchure arrondie, des biefs larges et des passages resserrés. `serpenter` module
l'amplitude des méandres par une onde lente : amples par endroits, presque droits ailleurs.

**Noms qui suivent un tracé.** Un nom peut porter `ligne` (identifiant d'un tracé), `pos` (fraction
de sa longueur) et `ecart` (décalage latéral, en hauteurs de texte) : il s'écrit lettre à lettre le
long du tracé dessiné, méandres compris, et jamais la tête en bas (`cheminEtiquette`, `pointChemin`).
Outil Noms : case « Le long d'un tracé », puis clic sur une rivière ou une route ; un nom existant
s'attache au tracé le plus proche ou s'en détache. Glisser le nom le fait coulisser
(`positionSurLigne`) ; si le tracé change, le nom suit ; si le tracé disparaît, il redevient droit.

**Plan des villes (`semerVille`).** Les terrains « Ville » et « Faubourg » ne sèment plus leurs
maisons au hasard (un tas sans logique) : ils ont un plan. Un quadrillage déformé — le même que celui
des champs, `coinChamp` — découpe la ville en **îlots** ; leurs côtés sont des **rues** (`peindreRues`,
dans la terre, sous les routes de l'auteur), et les maisons s'alignent en rang le long de chaque rue,
en retrait, vers l'intérieur de l'îlot. Le cœur de l'îlot est une cour : un arbre, une grande bâtisse,
parfois l'église. Le faubourg a le même plan en plus lâche (trois emplacements par côté, près de la
moitié laissés libres, jardins et parcelles au milieu). Chaque maison vérifie son propre pied dans le
masque : en lisière, les rangs s'arrêtent où le terrain s'arrête, et une route tracée à travers écarte
les maisons. Finesse, densité, taille des décors et gomme à décors s'appliquent comme ailleurs.

**Style Plan (vue du dessus)** (`THEMES.plan`, drapeau `dessus`) — un plan de village dessiné : terre
verte à plat, eau turquoise avec liseré de sable (`rive`) et lignes de rivage, chemins clairs (`voie`),
champs bruns en retrait les uns des autres (`cultures`), pas de touffes d'herbe (`sansDecor`). Les
décors qui ont un dessin vu d'en haut l'utilisent (`PEINTRES_DESSUS` : arbres en touffes cernées
d'encre avec ombre portée, rochers) ; les autres gardent leur dessin de profil. Les maisons sont des
toits vus du dessus, **orientés**, dessinés en vectoriel (`maisonDessus`).

**Village prêt à l'emploi.** Au départ d'une nouvelle carte, « Village (vue du dessus) » crée un plan de
900 m sur 450 m en style Plan (`Generateur.village`) : une côte à droite avec trois pontons, de grands
champs à gauche (`champsPx` du thème : parcelles de ~75 px, séparées par des bandes d'herbe), des bosquets
posés à des endroits prévus, une place ronde avec son arbre, des ruelles courbes qui en rayonnent, bordées
de maisons (`maisons`), un demi-anneau de maisons autour de la place et des chemins de liaison. Ce sont des
objets ordinaires (terrains, tracés, tampons) : tout se déplace ensuite à la main. L'échelle des décors est
fixée pour un village (`zbFixe`). Un bosquet garde tous ses arbres ; le cœur d'une grande forêt est un fond uni.

**Maisons : à la main ou le long d'une ligne.** Tracé « Rue bordée de maisons » (`maisons`, une voie
comme les autres : ponts, accroche) : `maisonsDesRues` range les maisons de part et d'autre du fil de
la rue (ou d'un seul côté, `cote`), tournées vers elle, pignon sur rue le plus souvent ; longueur
(`maison`, en km : 18 m par défaut, réglable de 4 à 40 m) et espacement (`espace`) réglables, et déplacer un point de la rue déplace ses maisons. Deux maisons ne se recouvrent jamais : le test est exact (rectangles orientés, `maisonsSeChevauchent`). Dans les villes générées, `purgerMaisons` écarte toute maison qui toucherait une rue ou une autre maison. « Figer les décors de la vue » convertit aussi les rues d'une ville en tracés de route (`chainerRues` : une route qui se prolonge d'un carrefour à l'autre devient une seule ligne, dont les points se déplacent ; les côtés communs à deux îlots ne sont comptés qu'une fois, et les tracés figés ne sont pas lissés — `lisse: false`, désormais respecté pour la route ; les carrefours d'une ville sont moins déplacés (`VILLE_GIGUE`, 0,4), ce qui réduit les pointes très aiguës) ; la zone figée passe à « Aucun », donc la ville automatique ne s'affiche plus en double. L'échelle graphique affiche les mètres sous le kilomètre. À
la main : les tampons Maison, Bâtisse et Église, avec une orientation (`a`, en degrés). Les arbres du
terrain s'écartent des unes comme des autres. Dans les autres styles, ces maisons sont dessinées de
profil.

**Murailles et portes automatiques.** `portesMuraille` cherche où chaque voie (route, route pavée,
sentier, rue bordée de maisons) coupe la muraille (intersection de segments, sur les tracés
affichés, méandres compris). À chaque franchissement le mur s'interrompt (`sousChemin` entre les
portes) et une porte prend la place : une tour de garde de chaque côté de l'ouverture, large de
2,4 largeurs de voie. Une seule porte par franchissement ; les tours d'angle et d'intervalle (écart
`ecartTours`, en largeurs de mur) ne sont jamais posées dans une porte. `portes: false` les
supprime. Dans le style Plan, le mur est une bande de pierre vue du dessus (ombre, cerne, chemin
de ronde clair, deux rangées de créneaux) et les tours sont rondes, à toit conique (`tourDessus`) —
carrées pour les gardes de porte ; dans les autres styles, les tours de profil de toujours, plus
grosses aux portes, et une arche entre elles.

**Style Plan : ce qui complète la vue du dessus.**
- **Carrefours sans chevauchement** : `maisonsDesRues` propose d'abord toutes les maisons de toutes les
  rues, quelle que soit la vue (leur place ne dépend pas de ce qu'on regarde), puis écarte celles qui
  mordraient sur une voie — la leur dans un virage, une autre à un carrefour —, sur une place ou sur
  une maison déjà posée (grille de voisinage).
- **Place** (tampon `place`, ronde ou carrée selon la variante) : disque de terre battue, pavage en
  pointillé, fontaine au centre. Peinte avant tout le reste (`FONDS`) ; les décors semés dont le dessin
  la recouvre sont retirés, et les rues bordées de maisons la contournent.
- **Ponton** (tracé `ponton`, `tracerPonton`) : planches, rives de bois, pieux de chaque côté, ombre sur
  l'eau ; on le trace de la berge vers le large.
- **Reliefs vus du dessus** (`PEINTRES_DESSUS`) : montagnes et cimes en facettes éclairées du nord-ouest
  (calotte blanche pour les cimes), collines à courbes de niveau, dunes à rides, roches sombres.
- **Lieux vus du dessus** (`iconeDessus`, `ICONES_DESSUS`) : village, ville et capitale enceintes de
  murs et de tours, fort, tour, port avec son ponton et son bateau, temple en croix, ruines, cabane,
  ferme, auberge, moulin, phare, puits, menhirs, donjon, grotte, mine, navire, campement. Les autres
  types gardent leur dessin de profil.

**Gizmo : déplacer, tourner, redimensionner tout élément.** Autour de la sélection (un objet ou un
groupe) : un cadre pointillé, quatre poignées d'angle pour agrandir ou réduire (autour du centre), une
poignée ronde au-dessus pour tourner (Maj : par 15°) ; glisser l'objet — ou l'intérieur du cadre —
le déplace, y compris un tracé entier. Le cadre suit l'objet (orienté pour un décor, un lieu ou un
nom, aligné aux axes pour un tracé, un lac ou un groupe). Au début du geste on garde une copie de
chaque objet (`debuterGizmo`) et chaque mouvement repart de cette copie (`appliquerGizmo` : échelle,
rotation autour du pivot, translation) : rien ne dérive, et l'annulation est exacte, en un seul pas
d'historique. Données : `a` (degrés) sur les décors posés et les lieux — le dessin est tourné autour
de son centre, le nom d'un lieu reste droit ; `taille`/`maison` des tracés suivent l'échelle ; un nom
attaché à un tracé ne fait que changer de taille. Panneau : curseur « Rotation » pour les décors et
les lieux ; l'échelle d'un lieu va jusqu'à ×6.

**Figer les décors automatiques.** Outil Décors → « Figer les décors de la vue » : `Moteur.figerDecors`
rejoue la génération des décors du terrain pour la vue et les rend en tampons ordinaires, que l'on
règle un par un avec le gizmo. La zone est retirée de la génération automatique par une zone
rectangulaire de `carte.finesses` (`rect`, `dens: 0`), pour qu'ils ne s'affichent pas en double ; le
tout est un seul pas d'historique, refusé au-delà de 6 000 décors (on zoome davantage). Pour une carte
entièrement à la main : masquer le calque « Décors du terrain ».

**Décors automatiques : aucun ne bouge ni ne disparaît en zoomant (refonte).** Avant, l'existence d'un
décor était lue dans une image du terrain calculée à l'échelle de l'écran, et les décors trop petits
étaient regroupés ou supprimés : des arbres apparaissaient, disparaissaient ou changeaient de place
en zoomant. Désormais :
- **Le terrain est interrogé en unités du monde** (`sonde`, `contexteZone`) : lacs et rivières
  creusent, le trait le plus récent qui couvre le point donne le terrain, les zones « Affiner / Gomme à
  décors » règlent finesse et densité (`zoneEn`), la distance aux voies se mesure sur la largeur de
  la carte (`distVoie`), l'écart à la lisière du biome se fait par quatre sondes à une distance
  proportionnelle à la taille du décor. Aucune étape ne dépend du zoom.
- **Chaque décor est décidé une fois** et gardé par tuile de 24 × 24 cases (`CACHE_DECORS`,
  `calculerTuile`). `synchroniserDecors` compare à chaque rendu les objets qui comptent (traits, lacs,
  rivières, voies, zones) à ce qu'ils étaient et n'invalide que les tuiles touchées : peindre,
  annuler ou déplacer un lac ne recalcule que ce qu'il faut.
- **Plus de regroupement** : la vue choisit seulement les décors qu'elle montre. Un décor de moins
  d'un pixel est invisible (pas supprimé : il grandit avec le zoom). Le même seuil vaut pour les
  maisons, les décors posés et les rues de maisons.
- Le plan des villes, les champs et les fissures de lave interrogent eux aussi le terrain du monde.
Vérifié : sur une zone de 36 × 22 km (3 terrains, une route, un lac), les 41 mêmes décors, aux mêmes
places et de la même taille, de ×0,5 à ×30.

**Positions absolues des décors automatiques.** Un décor automatique est défini par des coordonnées du
monde seules : grilles emboîtées ancrées en (0, 0), hachage de la case, terrain interrogé en unités du
monde. Ni le zoom, ni la taille de la fenêtre, ni la définition de l'export n'y entrent. Reste
l'échelle de référence des décors, qui dépendait de la taille de la carte : elle est maintenant
**figée dans la carte** (`carte.zbFixe`, posée à l'ouverture ou à la création, `Moteur.fixerEchelleDecors`).
Agrandir ou rétrécir la carte ne déplace donc plus aucun décor ; seul le réglage « Échelle des décors »
la recalcule — et redistribue alors tous les décors, ce que l'éditeur annonce. Vérifié : 79 décors
identiques (0 différence) après quatre changements de taille de la carte ; sans l'échelle figée, les
79 étaient redistribués.
Ce qui peut encore changer la place d'un décor, volontairement : repeindre le terrain autour
(le terrain voisin change), peindre ou effacer une zone « Affiner / Gomme à décors », régler la
finesse d'un coup de pinceau. Le thème, lui, ne change que la taille et l'aspect, jamais la place.

**Style Plan : tout est vu du dessus.** Décors (`PEINTRES_DESSUS`) : arbres, conifères, palmiers, acacias,
arbres morts (branches rayonnantes), montagnes et cimes en facettes, collines à courbes de niveau,
dunes, rochers et roches sombres, cratère de volcan (anneaux, lave au centre), blocs de glace,
marais (eau trouble et touffes de roseaux), parcelles de champ posées à la main, herbes. Lieux
(`ICONES_DESSUS`) : les 28 types, y compris pilotis, vestiges, portail, cimetière, bataille, oasis,
arbre ancien et épave. Les maisons, bâtisses et églises sont des toits orientés, la place est à plat.
Seuls les repères (point, croix, étoile, drapeau) et les images importées gardent leur dessin propre.

**Vitesse : zoom et déplacement quasi instantanés.** Trois changements.
- **Brouillon puis image nette** (éditeur) : pendant un geste, l'image déjà calculée est étirée
  (instantané) ; 30 ms après le dernier geste, un *brouillon* à demi-résolution la remplace
  (50 à 140 ms) ; l'image nette arrive 320 ms après (`rendre`, `demanderImage`, `rendreComplet(brouillon)`,
  deux canvas de travail `cv` / `cvB` et deux jeux de couches). Après une modification (pinceau,
  curseur…), même séquence avec 250 ms.
- **Halos des côtes en basse résolution** (`halo`) : un flou de 90 px sur toute l'image était de loin
  le poste le plus coûteux (703 ms sur 839 à ×4). Un flou est une basse fréquence : calculé sur une
  image 4 fois plus petite (16 fois moins de pixels) et étiré, il ne se distingue pas de l'original ;
  les halos de même couleur s'additionnent sur la petite image, étirée une seule fois.
- **Plus de masque des matériaux** : le terrain était repeint en petit à chaque rendu pour deux usages
  (décors, ponts) qui interrogent maintenant le monde (`sonde`) ; il a disparu. Les eaux douces,
  les contours (huit passes → quatre) et la falaise (moins de pas) coûtent moins cher.
Mesuré (environnement de test sans carte graphique, vue de 1 430 × 870, monde de 6 000 km) : rendu net à
×4 de 839 à 150 ms ; à haute densité de pixels (×2) il reste de l'ordre de la seconde, mais le brouillon
s'affiche en ~140 ms.

**Boussole et échelle graphique** : plus ajoutées par défaut à une nouvelle carte (`ornements`). Sur une
carte existante : calque « Ornements » (œil) pour les masquer, ou « Carte… » → rose des vents « Aucune »
et case « Échelle graphique » décochée.

Les cartes d'avant s'ouvrent telles quelles : seuls leurs décors changent (ils viennent maintenant
du terrain) et leurs petits lieux automatiques ont disparu.

**Pistes** : courbes de niveau, calques, texte suivant un tracé quelconque, mode « région » détaillé
à partir d'un détail de la grande carte, synchronisation avec un compte (Supabase) pour retrouver
ses cartes d'un appareil à l'autre.

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
