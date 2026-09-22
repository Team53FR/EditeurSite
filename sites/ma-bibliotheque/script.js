// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({});

// ===== Ma Bibliothèque — Supabase (remplace la BDD GitHub) =====
// Compte central maison, partagé avec le portail et les deux autres sites —
// voir ../../../supabase/schema-compte-central.sql. La collection de chaque
// compte est rattachée à son auth.uid() (le jeton signé par connexion()/
// inscription()), avec RLS pour que personne ne puisse lire/modifier la
// collection d'un autre. Schéma complet : supabase/schema.sql dans ce dossier.
const SUPABASE_URL = "https://uxedmplaeuonhhpxqpse.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vtFaCnMEFpqYvzzoth9T_w_6XCA4JCt";

// Bucket Storage public de ce site (couvertures de livres, affiches de séries).
const BUCKET = "ma-bibliotheque";

// Optionnel : clé Google Books gratuite (sans elle, le scan de code-barres
// fonctionne quand même via Open Library et la BnF, mais Google Books limite
// alors les requêtes anonymes à un quota global PARTAGÉ par tous les sites
// qui l'utilisent sans clé — il peut donc tomber à zéro sans lien avec ton
// usage. Pour l'activer : console.cloud.google.com -> nouveau projet ->
// API "Books API" -> Identifiants -> Créer une clé API (gratuit, 1000
// requêtes/jour rien que pour toi). Tu peux ensuite la restreindre à ton
// domaine dans les paramètres de la clé.
const CLE_GOOGLE_BOOKS = "";
// La recherche de séries utilise TVMaze (api.tvmaze.com), gratuit et SANS
// clé ni inscription — rien à configurer ici. (Choisi à la place de TMDB,
// qui aurait demandé de fournir des informations de contact personnelles
// dans un formulaire d'inscription pour obtenir une clé.)

function _jetonCourant() {
  return localStorage.getItem("team53_token") || SUPABASE_ANON_KEY;
}

async function appelerFonctionSupabase(nom, params) {
  const reponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params || {})
  });
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const erreur = new Error((corps && corps.message) || "Une erreur est survenue.");
    erreur.status = reponse.status;
    throw erreur;
  }
  return corps;
}

async function requeteSupabase(chemin, options) {
  options = options || {};
  const reponse = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, Object.assign({}, options, {
    headers: Object.assign({
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`,
      "Content-Type": "application/json"
    }, options.headers || {})
  }));
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => null);
    const erreur = new Error((corps && corps.message) || "Une erreur est survenue.");
    erreur.status = reponse.status;
    throw erreur;
  }
  // "Prefer: return=minimal" répond avec un corps vide — mais pas toujours en
  // 204 (un POST le fait en 201 Created, corps vide aussi). On lit donc le
  // texte brut plutôt que de se fier au code de statut pour savoir s'il y a
  // du JSON à lire.
  const texte = await reponse.text();
  return texte ? JSON.parse(texte) : null;
}

// ===== Images (Storage) =====
// Les couvertures vivent dans le bucket public "ma-bibliotheque", rangées
// par compte : <user_id>/<id de l'entrée>.jpg. La colonne `image` porte
// l'URL publique COMPLÈTE, affichable directement dans un <img src> — sans
// jeton, sans requête d'authentification, contrairement au dépôt GitHub
// privé d'avant, où il fallait télécharger les octets puis fabriquer une URL
// locale (et les réparer quand elles expiraient).
function mimeDepuisChemin(chemin) {
  const ext = (chemin.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/jpeg";
}

function extraireExtensionDataUrl(dataUrl) {
  const correspondance = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
  if (!correspondance) return "jpg";
  let ext = correspondance[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  if (ext === "svg+xml") ext = "svg";
  return ext;
}

// Envoie une image (data URL) dans le bucket, à l'emplacement donné, et
// renvoie son URL publique. "x-upsert" écrase silencieusement un fichier
// déjà présent au même chemin (remplacement de couverture) — plus de sha à
// relire ni de réessai sur une réponse incohérente, l'API Storage n'a pas ce
// problème.
async function uploaderImageStorage(chemin, dataUrl) {
  const virgule = dataUrl.indexOf(",");
  if (virgule === -1) throw new Error("Format d'image invalide.");
  const octets = atob(dataUrl.slice(virgule + 1));
  const tampon = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);

  const reponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${chemin}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`,
      "Content-Type": mimeDepuisChemin(chemin),
      "x-upsert": "true"
    },
    body: tampon
  });
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => null);
    throw new Error(`Échec de l'envoi de l'image${corps && corps.message ? " (" + corps.message + ")" : ""}.`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${chemin}`;
}

// La colonne `image` garde l'URL publique ; supprimer le fichier demande son
// CHEMIN dans le bucket. On le retrouve en retirant le préfixe public — et
// l'on refuse tout ce qui ne vient pas de notre bucket, pour qu'une valeur
// héritée (ancien chemin GitHub, URL d'un autre domaine) ne parte pas en
// requête de suppression hasardeuse.
function cheminDepuisUrlStorage(url) {
  const prefixe = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return (typeof url === "string" && url.startsWith(prefixe)) ? url.slice(prefixe.length) : null;
}

async function supprimerImageStorage(urlOuChemin) {
  const chemin = cheminDepuisUrlStorage(urlOuChemin) || urlOuChemin;
  if (!chemin || /^https?:\/\//i.test(chemin)) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${chemin}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`
    }
  });
  // Volontairement silencieux en cas d'échec : ne doit pas bloquer le reste du flux.
}

// ===== Session : une seule connexion pour tous les sites =====
//
// Le portail central mémorise sa session dans localStorage sous team53_*.
// Ce site vivant sur la même origine, il y a accès directement — pas de
// jeton propre à Ma Bibliothèque à recopier : la même session sert partout.
function exigerConnexion() {
  const token = localStorage.getItem("team53_token");
  // Un token qui n'a pas la forme d'un JWT (trois segments séparés par des
  // points) vient d'une session corrompue ou d'avant la bascule vers
  // Supabase — l'envoyer tel quel à Supabase provoque une erreur cryptique
  // ("Expected 3 parts in JWT; got 1") au lieu d'un renvoi propre vers la
  // connexion. On le traite comme une absence de session.
  if (!token || token.split(".").length !== 3) {
    seDeconnecter();
    return null;
  }
  return token;
}

function seDeconnecter() {
  localStorage.removeItem("team53_token");
  localStorage.removeItem("team53_id");
  localStorage.removeItem("team53_login");
  localStorage.removeItem("team53_role");
  localStorage.removeItem("team53_nom");
  localStorage.removeItem("team53_acces");
  window.location.replace("../../connexion.html");
}

// L'identifiant du compte (auth.uid() côté base) : la table
// bibliotheque_items y est rattachée, RLS ne laissant chacun lire/écrire que
// ses propres lignes. Sert aussi de dossier d'images dans le bucket.
function monIdentifiant() {
  return localStorage.getItem("team53_id");
}

// Les images d'un compte sont rangées sous son identifiant — stable, et déjà
// le découpage employé par RLS. (L'ancien slug du login ne convenait plus :
// renommer un compte aurait déplacé ses fichiers.)
function obtenirPrefixeImagesUtilisateur() {
  return monIdentifiant();
}
