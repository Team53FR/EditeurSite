-- ============================================================================
-- Compte central maison — partagé par le portail + les 3 sites
-- (editeur-livre, ma-bibliotheque, droid-fortnite)
-- ============================================================================
-- Reflète EXACTEMENT ce qui est appliqué sur le projet Supabase "SiteWeb"
-- (uxedmplaeuonhhpxqpse). Remplace entièrement Web/utilisateurs.json.
--
-- PAS Supabase Auth : une table `users` gérée entièrement par nous (mot de
-- passe haché avec pgcrypto), avec deux fonctions `inscription()`/
-- `connexion()` qui vérifient le mot de passe et SIGNENT NOUS-MÊMES un vrai
-- jeton JWT (voir plus bas) — ce jeton porte les mêmes informations
-- (sub/role) que Supabase Auth y aurait mises, donc auth.uid() et TOUTES
-- les règles RLS déjà écrites pour les autres tables du projet fonctionnent
-- sans aucune modification.
--
-- Signature du jeton : ce projet utilise le nouveau système de clés
-- Supabase ("JWT Signing Keys"), qui accepte plusieurs clés à la fois et a
-- besoin de savoir laquelle utiliser via l'en-tête "kid" du jeton — chose
-- que l'extension pgjwt ne permet pas de personnaliser. On signe donc à la
-- main avec pgcrypto (hmac + base64url), en indiquant explicitement le kid
-- de la clé HS256 (Shared Secret) active du projet.
--
-- Le secret de signature vit dans Supabase Vault (jamais en clair dans le
-- code ni dans ce dépôt) : voir vault.decrypted_secrets, nom
-- "project_jwt_secret_v4". Il a été importé côté Supabase (JWT Keys > JWT
-- Signing Keys > Create Standby Key > Import an existing secret, encodé en
-- base64) — d'où le decode(..., 'base64') avant de l'utiliser comme clé
-- HMAC : c'est la vraie clé, pas la chaîne base64 elle-même.
--
-- Si la clé de signature est un jour retournée (Rotate keys sur une
-- nouvelle clé), il faut mettre à jour v_kid ET le secret en Vault dans
-- connexion() ci-dessous.
-- ============================================================================

create extension if not exists pgcrypto schema extensions;

-- ===== Table users =====
create table public.users (
  id                  uuid primary key default gen_random_uuid(),
  login               text not null unique,
  password_hash       text not null,
  role                text not null default 'user' check (role in ('user', 'admin')),
  nom_affichage       text,
  acces               text[] not null default '{}',
  cree_le             timestamptz not null default now(),
  derniere_connexion  timestamptz,
  -- Onboarding propre à l'éditeur de livre (tutoBiblioVu/tutoEditeurVu du
  -- JSON) : reste à false pour un compte qui n'a pas accès à ce site, sans
  -- que ça pose de problème (le tutoriel ne s'affiche que là-bas).
  tuto_biblio_vu      boolean not null default false,
  tuto_editeur_vu     boolean not null default false
);
alter table public.users enable row level security;

-- password_hash n'est JAMAIS exposé via l'API, quelle que soit la policy RLS.
revoke select on public.users from anon, authenticated;
grant select (id, login, role, nom_affichage, acces, cree_le, derniere_connexion, tuto_biblio_vu, tuto_editeur_vu) on public.users to anon, authenticated;

create policy "users : lecture de soi-même ou admin" on public.users
  for select using ((select auth.uid()) = id or (select public.est_admin()));
create policy "users : écriture admin" on public.users
  for update using ((select public.est_admin())) with check ((select public.est_admin()));

-- Promouvoir un compte admin, ou lui donner accès à un site
-- (à lancer soi-même dans le SQL Editor, une fois le compte inscrit) :
--   update public.users set role = 'admin' where login = '<login>';
--   update public.users set acces = array['editeur-livre','ma-bibliotheque','droid-fortnite'] where login = '<login>';

-- security definer pour lire users sans reboucler dans ses propres RLS
-- (sinon récursion). Reste exécutable par anon/authenticated : les
-- politiques "écriture admin" de TOUTES les tables du projet l'appellent
-- sous l'identité de l'appelant, et un appel direct ne renvoie que le
-- statut admin de l'appelant lui-même — pas de fuite d'info sur un autre
-- compte.
create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;
revoke execute on function public.est_admin() from public, anon;
grant execute on function public.est_admin() to anon, authenticated;

-- Permet à un compte connecté de changer SON pseudonyme affiché, sans
-- jamais pouvoir toucher à son rôle ni à ses accès.
create or replace function public.definir_mon_nom_affichage(nouveau_nom text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users set nom_affichage = nouveau_nom where id = auth.uid();
$$;
revoke execute on function public.definir_mon_nom_affichage(text) from public, anon;
grant execute on function public.definir_mon_nom_affichage(text) to authenticated;

-- Pour que la page (une fois réécrite) puisse marquer le tutoriel comme vu
-- sans passer par un admin — même principe.
create or replace function public.marquer_tuto_vu(p_champ text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_champ = 'biblio' then
    update public.users set tuto_biblio_vu = true where id = auth.uid();
  elsif p_champ = 'editeur' then
    update public.users set tuto_editeur_vu = true where id = auth.uid();
  else
    raise exception 'Champ inconnu : %', p_champ;
  end if;
end;
$$;
revoke execute on function public.marquer_tuto_vu(text) from public, anon;
grant execute on function public.marquer_tuto_vu(text) to authenticated;

-- ===== Signature JWT maison (remplace pgjwt, qui ne gère pas "kid") =====
create or replace function public.base64url(data bytea)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(replace(encode(data, 'base64'), E'\n', ''), '+/', '-_'),
    '=+$', ''
  );
$$;

-- ===== Connexion / inscription =====
create or replace function public.inscription(p_login text, p_mot_de_passe text, p_nom_affichage text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.users where login = p_login) then
    raise exception 'Ce login existe déjà' using errcode = '23505';
  end if;
  insert into public.users (login, password_hash, nom_affichage)
  values (p_login, crypt(p_mot_de_passe, gen_salt('bf')), p_nom_affichage);

  return public.connexion(p_login, p_mot_de_passe);
end;
$$;

create or replace function public.connexion(p_login text, p_mot_de_passe text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.users;
  v_secret_b64 text;
  v_secret_bytes bytea;
  -- Key ID de la clé HS256 (Shared Secret) actuellement CURRENT sur le
  -- projet (JWT Keys > JWT Signing Keys). À mettre à jour si elle tourne.
  v_kid text := 'ad97cfc6-670b-408e-9529-faf9bfb77cd3';
  v_header text;
  v_payload text;
  v_signing_input text;
  v_signature text;
  v_jeton text;
begin
  select * into u from public.users where login = p_login;
  if u.id is null or u.password_hash <> crypt(p_mot_de_passe, u.password_hash) then
    raise exception 'Identifiants invalides' using errcode = '28P01';
  end if;

  select decrypted_secret into v_secret_b64 from vault.decrypted_secrets where name = 'project_jwt_secret_v4';
  if v_secret_b64 is null then
    raise exception 'Secret JWT non configuré dans Vault (project_jwt_secret_v4)';
  end if;
  v_secret_bytes := decode(v_secret_b64, 'base64');

  v_header := public.base64url(convert_to(
    jsonb_build_object('alg', 'HS256', 'typ', 'JWT', 'kid', v_kid)::text, 'utf8'));
  v_payload := public.base64url(convert_to(
    jsonb_build_object(
      'sub', u.id::text,
      'role', 'authenticated',
      'login', u.login,
      'iat', extract(epoch from now())::int,
      'exp', extract(epoch from now() + interval '90 days')::int
    )::text, 'utf8'));
  v_signing_input := v_header || '.' || v_payload;
  v_signature := public.base64url(hmac(convert_to(v_signing_input, 'utf8'), v_secret_bytes, 'sha256'));
  v_jeton := v_signing_input || '.' || v_signature;

  return jsonb_build_object(
    'jeton', v_jeton,
    'utilisateur', jsonb_build_object(
      'id', u.id, 'login', u.login, 'role', u.role,
      'nom_affichage', u.nom_affichage, 'acces', u.acces
    )
  );
end;
$$;

revoke execute on function public.inscription(text, text, text) from public, authenticated;
grant execute on function public.inscription(text, text, text) to anon;
revoke execute on function public.connexion(text, text) from public, authenticated;
grant execute on function public.connexion(text, text) to anon;
