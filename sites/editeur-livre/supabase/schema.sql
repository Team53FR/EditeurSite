-- ============================================================================
-- Éditeur de livre — schéma Supabase (remplace la BDD GitHub de ce site)
-- ============================================================================
-- Reflète EXACTEMENT ce qui est appliqué sur le projet Supabase "SiteWeb"
-- (uxedmplaeuonhhpxqpse). Authentification : compte central partagé — voir
-- ../../../supabase/schema-compte-central.sql (à appliquer avant ce fichier,
-- `livres.user_id` y fait référence).
--
-- Ne stocke QUE `livre.spreads` (un blob HTML par double-page) : c'est la
-- vraie source de vérité du texte (voir editeur.js, "le texte est stocké EN
-- CONTINU par double-page"). `livre.pages` — le découpage page par page
-- utilisé par l'impression et la lecture — n'est qu'un cache dérivé,
-- régénéré côté client (regenererToutesPages()) : pas stocké ici, pour ne
-- pas garder deux fois le même texte à synchroniser.
--
-- `EditeurLivre/publies.json` disparaît : remplacé par les colonnes
-- publie/publie_le + une règle de lecture publique sur les livres publiés,
-- qui évite à publies.js/lecture.js d'avoir à lire le fichier complet d'un
-- autre compte pour vérifier s'il est publié.
-- ============================================================================

create table public.livres (
  id            text primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  titre         text not null,
  auteur        text,
  format        text not null,
  espace_titre  numeric,
  publie        boolean not null default false,
  publie_le     timestamptz,
  couverture    jsonb,   -- {fond, imageChemin, texte, afficherTitre, afficherAuteur, imgZoom, imgOffsetX/Y, imgBaseW/H, ...}
  quatrieme     jsonb,   -- même famille de champs + resumeTexte/resumeLargeur/resumeAlign/...
  tranche       jsonb,   -- {fond, texte, bandeau, pastille, sens, credits, ...}
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

alter table public.livres enable row level security;
alter table public.livre_spreads enable row level security;

-- Une seule politique de lecture (propriétaire OU publié) : deux politiques
-- permissives distinctes seraient chacune évaluée à chaque lecture, pour le
-- même effet.
create policy "livres : lecture (soi-même ou publié)" on public.livres
  for select using ((select auth.uid()) = user_id or publie);
create policy "livres : écriture (soi-même)" on public.livres
  for insert with check ((select auth.uid()) = user_id);
create policy "livres : modification (soi-même)" on public.livres
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "livres : suppression (soi-même)" on public.livres
  for delete using ((select auth.uid()) = user_id);

create policy "livre_spreads : lecture (soi-même ou publié)" on public.livre_spreads
  for select using (
    (select auth.uid()) = (select user_id from public.livres l where l.id = livre_id)
    or (select publie from public.livres l where l.id = livre_id)
  );
create policy "livre_spreads : écriture (soi-même)" on public.livre_spreads
  for insert with check ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id));
create policy "livre_spreads : modification (soi-même)" on public.livre_spreads
  for update using ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id))
  with check ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id));
create policy "livre_spreads : suppression (soi-même)" on public.livre_spreads
  for delete using ((select auth.uid()) = (select user_id from public.livres l where l.id = livre_id));
