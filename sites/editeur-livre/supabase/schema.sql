-- ============================================================================
-- Éditeur de livre — schéma Supabase (remplace la BDD GitHub de ce site)
-- ============================================================================
-- Reflète EXACTEMENT ce qui est appliqué sur le projet Supabase "SiteWeb"
-- (uxedmplaeuonhhpxqpse). Authentification : compte central partagé — voir
-- ../../../supabase/schema-compte-central.sql (à appliquer avant ce fichier,
-- `livres.user_id` y fait référence).
--
-- `livre_spreads` (un blob HTML par double-page) est la SOURCE DE VÉRITÉ du
-- texte (voir editeur.js, "le texte est stocké EN CONTINU par double-page") :
-- c'est elle, et elle seule, que l'éditeur relit et réécrit.
--
-- `livres.pages` est le découpage page par page. On avait d'abord choisi de
-- ne pas le stocker — deux copies du même texte à tenir d'accord — en
-- comptant sur regenererToutesPages() pour le refaire côté client. Mais ce
-- calcul est une MESURE TYPOGRAPHIQUE : il pèse le texte dans une page réelle
-- et n'existe que dans l'éditeur. La lecture et l'impression, elles, lisent
-- `pages` sans pouvoir le reconstruire.
--
-- `pages` est donc conservé, mais comme CACHE en lecture seule : l'éditeur le
-- réécrit à chaque sauvegarde à partir des spreads, personne d'autre n'y
-- touche. En cas de désaccord, ce sont les spreads qui ont raison.
--
-- `EditeurLivre/publies.json` disparaît : remplacé par les colonnes
-- publie/publie_le + une règle de lecture publique sur les livres publiés,
-- qui évite à publies.js/lecture.js d'avoir à lire le fichier complet d'un
-- autre compte pour vérifier s'il est publié.
-- ============================================================================

-- Une série regroupe plusieurs tomes d'une même histoire et porte le résumé
-- d'ensemble. Ce n'est qu'un CLASSEMENT : un tome reste un livre autonome,
-- qui s'ouvre, s'imprime et se publie sans elle. Rien dans les règles de
-- lecture des livres ne dépend de la série.
create table public.series (
  id       text primary key,
  user_id  uuid not null references public.users(id) on delete cascade,
  titre    text not null,
  resume   text,
  cree_le  timestamptz not null default now(),
  maj_le   timestamptz not null default now()
);
create index series_user_id_idx on public.series(user_id);

create table public.livres (
  id            text primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  titre         text not null,
  auteur        text,
  format        text not null,
  espace_titre  numeric,
  -- « on delete set null » et NON « cascade » : supprimer une série ne doit
  -- jamais emporter les manuscrits qu'elle rangeait. Les tomes redeviennent
  -- des livres sans série.
  serie_id      text references public.series(id) on delete set null,
  tome          integer,
  -- Pages de garde : feuillets BLANCS et NON FOLIOTÉS au début et à la fin.
  -- Elles ne décalent pas la pagination (le premier texte reste la page 1)
  -- mais ce sont de vraies feuilles : elles s'impriment, elles épaississent
  -- le dos, et chacune fait basculer de côté tout ce qui la suit. Bornées :
  -- au-delà d'une vingtaine ce n'est plus une garde, et une valeur aberrante
  -- fausserait le calcul du dos.
  gardes_debut  integer not null default 0 check (gardes_debut between 0 and 20),
  gardes_fin    integer not null default 0 check (gardes_fin   between 0 and 20),
  publie        boolean not null default false,
  publie_le     timestamptz,
  couverture    jsonb,   -- {fond, imageChemin, texte, afficherTitre, afficherAuteur, imgZoom, imgOffsetX/Y, imgBaseW/H, ...}
  quatrieme     jsonb,   -- même famille de champs + resumeTexte/resumeLargeur/resumeAlign/...
  tranche       jsonb,   -- {fond, texte, bandeau, pastille, sens, credits, ...}
  -- Cache dérivé des spreads (voir l'en-tête) : [{id, contenu}, ...].
  pages         jsonb,
  -- Même calcul, gardé à part pour que la bibliothèque compte les pages d'une
  -- dizaine de livres sans rapatrier tout leur texte.
  nb_pages      integer,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);
create index livres_user_id_idx on public.livres(user_id);
-- Pour la galerie publique (remplace publies.json) : ne liste que les publiés.
create index livres_publie_idx on public.livres(publie) where publie;

create table public.livre_spreads (
  livre_id  text not null references public.livres(id) on delete cascade,
  position  integer not null check (position >= 0),
  contenu   text not null,
  primary key (livre_id, position)
);

create index livres_serie_idx on public.livres(serie_id) where serie_id is not null;

alter table public.livres enable row level security;
alter table public.livre_spreads enable row level security;
alter table public.series enable row level security;

-- Une série est privée sans exception : contrairement aux livres, elle n'a
-- pas d'équivalent de « publié ».
create policy "series : lecture (soi-même)" on public.series
  for select using ((select auth.uid()) = user_id);
create policy "series : écriture (soi-même)" on public.series
  for insert with check ((select auth.uid()) = user_id);
create policy "series : modification (soi-même)" on public.series
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "series : suppression (soi-même)" on public.series
  for delete using ((select auth.uid()) = user_id);

-- Droits explicites, dans les deux sens.
--
-- À partir du 30/10/2026, Supabase n'accorde PLUS automatiquement de droits
-- sur les nouvelles tables du schéma public : sans le grant, la table serait
-- invisible de l'API malgré ses policies. Avant cette date, il accorde au
-- contraire TOUT à « anon » — d'où le revoke. Une série ne se lit ni ne
-- s'écrit sans compte, et un droit qu'on n'a pas ne peut pas être ouvert par
-- mégarde dans une policy future.
grant select, insert, update, delete on public.series to authenticated;
revoke all on public.series from anon;

-- Une seule politique de lecture (propriétaire OU publié) : deux politiques
-- permissives distinctes seraient chacune évaluée à chaque lecture, pour le
-- même effet.
--
-- « publié » veut dire lisible par les autres COMPTES, pas par tout Internet.
-- D'où le « auth.uid() is not null » : sans lui, un visiteur anonyme échouait
-- bien sur le premier terme, mais le second suffisait à lui ouvrir le livre
-- — avec la seule clé publishable, qui est dans le JS servi à tout le monde.
-- publies.html et lecture.html exigent de toute façon une session, la
-- condition ne retire donc rien à l'usage normal.
create policy "livres : lecture (soi-même ou publié)" on public.livres
  for select using (
    (select auth.uid()) = user_id
    or (publie and (select auth.uid()) is not null)
  );
create policy "livres : écriture (soi-même)" on public.livres
  for insert with check ((select auth.uid()) = user_id);
create policy "livres : modification (soi-même)" on public.livres
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "livres : suppression (soi-même)" on public.livres
  for delete using ((select auth.uid()) = user_id);

-- Même règle que pour `livres` : le texte suit l'accès à sa fiche, et un
-- livre publié se lit avec un compte, pas sans.
create policy "livre_spreads : lecture (soi-même ou publié)" on public.livre_spreads
  for select using (
    (select auth.uid()) = (select user_id from public.livres l where l.id = livre_id)
    or (
      (select publie from public.livres l where l.id = livre_id)
      and (select auth.uid()) is not null
    )
  );
create policy "livre_spreads : écriture (soi-même)" on public.livre_spreads
  for insert with check ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id));
create policy "livre_spreads : modification (soi-même)" on public.livre_spreads
  for update using ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id))
  with check ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id));
create policy "livre_spreads : suppression (soi-même)" on public.livre_spreads
  for delete using ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id));


-- ============================================================================
-- Notes de livre : des pages d'idées rangées en onglets, par livre, PRIVÉES
-- ============================================================================
-- Table SÉPARÉE de `livres`, et ce n'est pas un détail d'organisation. La règle
-- de lecture de `livres` est « soi-même OU publié » : tout compte connecté lit la
-- ligne ENTIÈRE d'un livre publié. Une colonne `notes` y exposerait les
-- intrigues et les spoilers de l'auteur à tous les autres comptes dès qu'il
-- publie — alors que le texte du livre, lui, est fait pour être lu. Ici, aucune
-- branche « publié » : seule la personne qui possède le livre voit ses notes.
create table public.livre_notes (
  livre_id  text primary key references public.livres(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  -- Les onglets et leur texte, en JSON {"v":2,"onglets":[…]} (voir notes.js) ;
  -- les notes d'avant les onglets sont du texte brut, lu comme un premier onglet.
  -- La limite vaut pour TOUS les onglets ensemble.
  contenu   text not null default '' check (char_length(contenu) <= 200000),
  -- Compteur de révisions, pour l'enregistrement concurrent : deux onglets
  -- ouverts sur les mêmes notes ne s'écrasent pas en silence, le second à
  -- enregistrer apprend que les notes ont changé (voir enregistrerNotesLivre
  -- dans script.js). Un horodatage ne ferait pas l'affaire — comparé à la
  -- microseconde, il se perd en route côté navigateur.
  version   integer not null default 0,
  maj_le    timestamptz not null default now()
);
create index livre_notes_user_id_idx on public.livre_notes(user_id);

alter table public.livre_notes enable row level security;

create policy "livre_notes : lecture (soi-même)" on public.livre_notes
  for select using ((select auth.uid()) = user_id);

-- La clé primaire est l'identifiant du livre : sans la deuxième condition, un
-- compte pourrait poser des notes sur un livre PUBLIÉ qu'il ne possède pas (il
-- peut le lire), et le vrai propriétaire ne pourrait plus jamais créer les
-- siennes — la clé serait prise.
create policy "livre_notes : écriture (soi-même, sur son livre)" on public.livre_notes
  for insert with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.livres l where l.id = livre_id and l.user_id = (select auth.uid()))
  );

create policy "livre_notes : modification (soi-même)" on public.livre_notes
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "livre_notes : suppression (soi-même)" on public.livre_notes
  for delete using ((select auth.uid()) = user_id);

-- Droits explicites, dans les deux sens : accordés à « authenticated », retirés à
-- « anon » à qui Supabase donne encore tout par défaut avant le 30/10/2026.
grant select, insert, update, delete on public.livre_notes to authenticated;
revoke all on public.livre_notes from anon;
