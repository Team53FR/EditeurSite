-- ============================================================================
-- Droid Fortnite — schéma Supabase (remplace la BDD GitHub de ce site)
-- ============================================================================
-- Reflète EXACTEMENT ce qui est appliqué sur le projet Supabase "SiteWeb"
-- (uxedmplaeuonhhpxqpse). Ce fichier ne fait QUE créer les tables,
-- contraintes, index et règles de sécurité (RLS) : aucune donnée de
-- catalogue dedans. Les vraies données (92 droïdes, prix, rendements...)
-- vivent encore sur GitHub et seront importées par un script à part.
--
-- Authentification : compte CENTRAL maison, partagé avec le portail et les
-- deux autres sites (editeur-livre, ma-bibliotheque) — PAS Supabase Auth,
-- voir ../../../supabase/schema-compte-central.sql pour la table `users`,
-- connexion()/inscription() et est_admin(), utilisés ici tels quels. La
-- progression de chaque joueur est rattachée à son auth.uid() (qui lit le
-- jeton signé par connexion()/inscription(), pas une session Supabase
-- Auth), avec RLS pour que personne ne puisse lire/modifier la progression
-- d'un autre.
-- ============================================================================


-- ===== Taxonomies partagées (paliers, unités, raretés, types) =====
-- Lecture publique (y compris visiteurs non connectés du Droidex), écriture
-- réservée aux admins.

-- "ordre" n'est PAS unique : seul l'ordre RELATIF compte (tri stable côté
-- client, voir trierCatalogueParRarete/afficherFusionAdmin) — une valeur
-- dupliquée ne casse rien, et ça évite d'avoir à échanger deux rangs en deux
-- temps pour reordonner (un lot INSERT...ON CONFLICT ne peut pas poser
-- temporairement deux lignes sur la même valeur unique).
create table public.paliers (
  nom      text primary key,
  couleur  text[],   -- une seule couleur, ou plusieurs pour un dégradé (Arc-en-ciel)
  ordre    integer not null
);

create table public.unites (
  symbole  text primary key,
  facteur  numeric not null check (facteur > 0)
);

create table public.raretes (
  nom                       text primary key,
  fond                      text not null,
  texte                     text not null,
  premier_palier_seulement  boolean not null default false,
  ordre                     integer not null
);

create table public.classes (
  nom     text primary key,
  icone   text not null,
  image   text,               -- chemin/URL du PNG transparent, optionnel (repli sur l'icône)
  ordre   integer not null
);


-- ===== Catalogue =====

create table public.droides (
  id       text primary key,
  nom      text not null unique,
  classe   text not null references public.classes(nom),
  rarete   text not null references public.raretes(nom),
  image    text,              -- photo perso ajoutée depuis l'admin, optionnelle
  ordre    integer not null
);
create index droides_classe_idx on public.droides(classe);
create index droides_rarete_idx on public.droides(rarete);

-- Une ligne par droïde x palier : prix, rendement, vente, temps de
-- fabrication et bonus de compagnon, comme les tables `prix{}`/`rendements{}`
-- /... indexées par palier dans le JSON actuel.
create table public.droide_paliers (
  droide_id              text not null references public.droides(id) on delete cascade,
  palier                 text not null references public.paliers(nom),
  prix                   numeric,               -- en crédits
  vente                  numeric,               -- en crédits
  rendement              numeric,               -- crédits / seconde
  rendement_pourcentage  numeric,               -- Iconiques : % du revenu total, exclusif avec `rendement`
  temps_fabrication      text,                  -- texte libre ("0:00:33"), pas un montant
  bonus                  text,                  -- texte libre du bonus de compagnon
  primary key (droide_id, palier),
  check (rendement is null or rendement_pourcentage is null)
);
create index droide_paliers_palier_idx on public.droide_paliers(palier);


-- ===== Fusions =====

create table public.fusions (
  id      text primary key,
  nom     text not null,
  classe  text not null references public.classes(nom),
  rarete  text not null references public.raretes(nom),
  image   text,
  ordre   integer not null
);
create index fusions_classe_idx on public.fusions(classe);
create index fusions_rarete_idx on public.fusions(rarete);

create table public.fusion_ingredients (
  fusion_id   text not null references public.fusions(id) on delete cascade,
  droide_nom  text not null references public.droides(nom),
  quantite    integer not null check (quantite > 0),
  primary key (fusion_id, droide_nom)
);
create index fusion_ingredients_droide_nom_idx on public.fusion_ingredients(droide_nom);


-- ===== Paliers de renaissance =====

create table public.renaissance_niveaux (
  id        text primary key,
  niveau    integer not null unique,
  credits   numeric not null check (credits >= 0),
  -- Texte libre ("CB (Défaut), Pit (Défaut)...") OU objet {"0": "...", "1": "...", ...}
  -- indexé par numéro de super renaissance (voir elementsParSuper() côté site) —
  -- jsonb pour accepter les deux formes sans les confondre au chargement.
  elements  jsonb
);


-- ===== Progression personnelle (RLS : chacun ne touche qu'à ses lignes) =====

create table public.progression (
  user_id                  uuid primary key references public.users(id) on delete cascade,
  super_renaissances       integer not null default 0 check (super_renaissances >= 0),
  multiplicateur_rendement numeric not null default 1 check (multiplicateur_rendement > 0),
  maj_le                   timestamptz not null default now()
);

-- Remplace perso.droidesPossedes (clés "id::palier").
create table public.droides_possedes (
  user_id    uuid not null references public.users(id) on delete cascade,
  droide_id  text not null references public.droides(id) on delete cascade,
  palier     text not null references public.paliers(nom),
  primary key (user_id, droide_id, palier)
);
create index droides_possedes_droide_id_idx on public.droides_possedes(droide_id);
create index droides_possedes_palier_idx on public.droides_possedes(palier);

-- Remplace perso.renaissanceAtteinte[superRenaissance] = [id, id, ...].
create table public.renaissance_atteinte (
  user_id            uuid not null references public.users(id) on delete cascade,
  super_renaissance  integer not null check (super_renaissance >= 0),
  renaissance_id     text not null references public.renaissance_niveaux(id) on delete cascade,
  primary key (user_id, super_renaissance, renaissance_id)
);
create index renaissance_atteinte_renaissance_id_idx on public.renaissance_atteinte(renaissance_id);

-- Remplace perso.rendement.slots[classe] = nombre d'emplacements.
create table public.escouade_slots (
  user_id   uuid not null references public.users(id) on delete cascade,
  classe    text not null references public.classes(nom),
  nb_slots  integer not null default 3 check (nb_slots between 0 and 30),
  primary key (user_id, classe)
);
create index escouade_slots_classe_idx on public.escouade_slots(classe);

-- Remplace perso.rendement.places[classe][i] = clé du droïde placé (ou null).
create table public.escouade_places (
  user_id    uuid not null references public.users(id) on delete cascade,
  classe     text not null references public.classes(nom),
  position   integer not null check (position >= 0),
  droide_id  text references public.droides(id) on delete cascade,
  palier     text references public.paliers(nom),
  primary key (user_id, classe, position)
);
create index escouade_places_classe_idx on public.escouade_places(classe);
create index escouade_places_droide_id_idx on public.escouade_places(droide_id);
create index escouade_places_palier_idx on public.escouade_places(palier);


-- ============================================================================
-- Sécurité (Row Level Security)
-- ============================================================================

alter table public.paliers              enable row level security;
alter table public.unites               enable row level security;
alter table public.raretes              enable row level security;
alter table public.classes              enable row level security;
alter table public.droides              enable row level security;
alter table public.droide_paliers       enable row level security;
alter table public.fusions              enable row level security;
alter table public.fusion_ingredients   enable row level security;
alter table public.renaissance_niveaux  enable row level security;
alter table public.progression          enable row level security;
alter table public.droides_possedes     enable row level security;
alter table public.renaissance_atteinte enable row level security;
alter table public.escouade_slots       enable row level security;
alter table public.escouade_places      enable row level security;

-- ----- Taxonomies + catalogue : lecture publique, écriture admin -----
-- (select public.est_admin()) plutôt que public.est_admin() : évalué une
-- seule fois par requête, pas une fois par ligne (recommandation Supabase).
-- Trois politiques (insert/update/delete) plutôt qu'une seule "for all" :
-- "for" n'accepte pas de liste de commandes, et ça évite un chevauchement
-- avec la politique de lecture publique sur SELECT.
create policy "lecture publique" on public.paliers for select using (true);
create policy "écriture admin (insert)" on public.paliers for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.paliers for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.paliers for delete using ((select public.est_admin()));

create policy "lecture publique" on public.unites for select using (true);
create policy "écriture admin (insert)" on public.unites for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.unites for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.unites for delete using ((select public.est_admin()));

create policy "lecture publique" on public.raretes for select using (true);
create policy "écriture admin (insert)" on public.raretes for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.raretes for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.raretes for delete using ((select public.est_admin()));

create policy "lecture publique" on public.classes for select using (true);
create policy "écriture admin (insert)" on public.classes for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.classes for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.classes for delete using ((select public.est_admin()));

create policy "lecture publique" on public.droides for select using (true);
create policy "écriture admin (insert)" on public.droides for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.droides for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.droides for delete using ((select public.est_admin()));

create policy "lecture publique" on public.droide_paliers for select using (true);
create policy "écriture admin (insert)" on public.droide_paliers for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.droide_paliers for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.droide_paliers for delete using ((select public.est_admin()));

create policy "lecture publique" on public.fusions for select using (true);
create policy "écriture admin (insert)" on public.fusions for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.fusions for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.fusions for delete using ((select public.est_admin()));

create policy "lecture publique" on public.fusion_ingredients for select using (true);
create policy "écriture admin (insert)" on public.fusion_ingredients for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.fusion_ingredients for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.fusion_ingredients for delete using ((select public.est_admin()));

create policy "lecture publique" on public.renaissance_niveaux for select using (true);
create policy "écriture admin (insert)" on public.renaissance_niveaux for insert with check ((select public.est_admin()));
create policy "écriture admin (update)" on public.renaissance_niveaux for update using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "écriture admin (delete)" on public.renaissance_niveaux for delete using ((select public.est_admin()));

-- ----- Progression personnelle : chacun ne touche qu'à ses propres lignes -----
create policy "progression : soi-même" on public.progression
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "droides_possedes : soi-même" on public.droides_possedes
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "renaissance_atteinte : soi-même" on public.renaissance_atteinte
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "escouade_slots : soi-même" on public.escouade_slots
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "escouade_places : soi-même" on public.escouade_places
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
