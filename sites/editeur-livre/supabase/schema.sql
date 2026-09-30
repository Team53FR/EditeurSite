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
