-- ============================================================================
-- Ma Bibliothèque — schéma Supabase (remplace la BDD GitHub de ce site)
-- ============================================================================
-- Reflète EXACTEMENT ce qui est appliqué sur le projet Supabase "SiteWeb"
-- (uxedmplaeuonhhpxqpse). Authentification : compte central partagé — voir
-- ../../../supabase/schema-compte-central.sql (à appliquer avant ce fichier,
-- `bibliotheque_items.user_id` y fait référence).
--
-- Un seul type de ligne (livre ou série), comme dans le JSON actuel :
-- `type` discrimine, les champs propres aux séries (`saisons`) restent
-- vides pour un livre et inversement. `MaBibliotheque/compte.json` et le
-- `MaBibliotheque/livres.json` racine sont des fichiers morts (confirmés
-- sans aucune référence dans le code) : volontairement absents d'ici.
-- ============================================================================

create table public.bibliotheque_items (
  id                   text primary key,
  user_id              uuid not null references public.users(id) on delete cascade,
  type                 text not null default 'livre' check (type in ('livre', 'serie')),
  titre                text not null,
  auteur_ou_createur   text,
  image                text,
  tomes_total          integer,
  tomes_possedes       integer[],
  saisons              jsonb,   -- [{numero, episodesTotal, episodesVus:[...]}], uniquement pour type='serie'
  cree_le              timestamptz not null default now(),
  maj_le               timestamptz not null default now()
);
create index bibliotheque_items_user_id_idx on public.bibliotheque_items(user_id);

alter table public.bibliotheque_items enable row level security;
create policy "bibliotheque_items : soi-même" on public.bibliotheque_items
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
