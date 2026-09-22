// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  seConnecter: ["Connexion…", "Votre identifiant est vérifié."],
});

// ===== Portail central Team53FR — Supabase (remplace la BDD GitHub) =====
// Compte central maison (table public.users, PAS Supabase Auth) : voir
// supabase/schema-compte-central.sql à la racine du dépôt. connexion() et
// inscription() vérifient le mot de passe et renvoient un vrai jeton signé,
// que tous les appels ci-dessous utilisent ensuite comme Authorization
// Bearer — les règles RLS savent alors exactement qui appelle.
const SUPABASE_URL = "https://uxedmplaeuonhhpxqpse.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vtFaCnMEFpqYvzzoth9T_w_6XCA4JCt";

// Registre des sites du portail. Le champ "relais" d'autrefois (recopier le
// jeton sous un nom différent par site) a disparu avec les jetons GitHub
// propres à chaque site : tous les sites partagent maintenant la même
// session Supabase (même origine, même localStorage), il n'y a plus rien à
// recopier — juste à vérifier l'accès avant de naviguer.
const DEFAULT_SITES = [
  {
    id: "editeur-livre",
    nom: "Éditeur de livre",
    description: "Créez, mettez en page et imprimez vos livres en ligne.",
    icone: "📖",
    pageArrivee: "sites/editeur-livre/bibliotheque.html"
  },
  {
    id: "ma-bibliotheque",
    nom: "Ma Bibliothèque",
    description: "Répertoriez les livres et séries que vous possédez, tome par tome.",
    icone: "📚",
    pageArrivee: "sites/ma-bibliotheque/collection.html"
  },
  {
    id: "droid-fortnite",
    nom: "Droid Fortnite",
    description: "Suis ta progression dans Star Wars: Droid Tycoon — droidex et paliers de renaissance.",
    icone: "🤖",
    pageArrivee: "sites/droid-fortnite/suivi.html"
  }
];

// ----- Appels réseau vers Supabase -----
//
// Deux formes : appelerFonctionSupabase() pour les fonctions PostgreSQL
// (connexion, inscription, est_admin...), requeteSupabase() pour lire/
// écrire directement une table via l'API REST auto-générée (PostgREST),
// soumise aux règles RLS. Le jeton de la session en cours (ou la clé
// publique si personne n'est connecté) part systématiquement en
// Authorization : c'est lui qui détermine, côté serveur, ce que
// l'appelant a le droit de voir ou modifier — jamais un simple indicateur
// côté client comme l'était team53_role.
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
  if (reponse.status === 204) return null;
  return reponse.json();
}

// Registre des sites : Web/sites.json n'a jamais été créé (toujours resté
// sur ce repli), inutile de garder la lecture réseau correspondante.
async function chargerSites() {
  return DEFAULT_SITES;
}

// ===== Connexion centrale =====
// Comptes dans public.users (Supabase) : login, mot de passe haché,
// role "admin"|"user", nom_affichage, acces: [siteId,...].
// Session mémorisée en localStorage (persiste jusqu'à déconnexion
// manuelle ou expiration du jeton, ~90 jours).
async function seConnecter() {
  const login = document.getElementById("login").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  if (!login || !password) {
    message.textContent = "Merci de remplir tous les champs.";
    return;
  }

  message.textContent = "Vérification en cours...";

  let resultat;
  try {
    resultat = await appelerFonctionSupabase("connexion", { p_login: login, p_mot_de_passe: password });
  } catch (erreur) {
    message.textContent = "Identifiants incorrects.";
    return;
  }

  ouvrirSessionCentrale(resultat.utilisateur, resultat.jeton);

  // Best-effort : ne doit jamais empêcher la connexion en cas d'échec.
  try { await appelerFonctionSupabase("enregistrer_connexion", {}); } catch (e) { /* ignoré */ }

  window.location.href = "tableau-de-bord.html";
}

function ouvrirSessionCentrale(utilisateur, jeton) {
  localStorage.setItem("team53_token", jeton);
  localStorage.setItem("team53_id", utilisateur.id);
  localStorage.setItem("team53_login", utilisateur.login);
  localStorage.setItem("team53_role", utilisateur.role === "admin" ? "admin" : "user");
  localStorage.setItem("team53_nom", utilisateur.nom_affichage ? String(utilisateur.nom_affichage) : "");
  localStorage.setItem("team53_acces", JSON.stringify(Array.isArray(utilisateur.acces) ? utilisateur.acces : []));
}

// Remet la session d'aplomb à partir de la table users.
//
// Le rôle, le pseudo et la liste des accès sont recopiés sur l'appareil à la
// connexion, pour ne pas relire le compte à chaque page. Mais cette copie ne
// bougeait plus ensuite : un accès accordé par un administrateur n'apparaissait
// qu'à la connexion suivante, et l'intéressé ne comprenait pas pourquoi son
// nouveau site restait invisible.
//
// Renvoie « false » si le compte a disparu (supprimé) — la session ne vaut
// alors plus rien. Une lecture qui échoue, elle, laisse la copie en place :
// mieux vaut un tableau de bord un peu daté que pas de tableau de bord.
async function rafraichirSessionCentrale(token) {
  const id = localStorage.getItem("team53_id");
  if (!token || !id) return true;
  let lignes;
  try {
    lignes = await requeteSupabase(`users?id=eq.${id}&select=login,role,nom_affichage,acces,tuto_biblio_vu,tuto_editeur_vu`);
  } catch (e) {
    return true;
  }
  const moi = lignes && lignes[0];
  if (!moi) return false;
  localStorage.setItem("team53_login", moi.login);
  localStorage.setItem("team53_role", moi.role === "admin" ? "admin" : "user");
  localStorage.setItem("team53_nom", moi.nom_affichage || "");
  localStorage.setItem("team53_acces", JSON.stringify(Array.isArray(moi.acces) ? moi.acces : []));
  return true;
}

function seDeconnecter() {
  localStorage.removeItem("team53_token");
  localStorage.removeItem("team53_id");
  localStorage.removeItem("team53_login");
  localStorage.removeItem("team53_role");
  localStorage.removeItem("team53_nom");
  localStorage.removeItem("team53_acces");
  window.location.replace("connexion.html");
}

// Redirige vers la connexion si aucune session centrale n'est mémorisée.
function exigerConnexionCentrale() {
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

// Redirige vers le tableau de bord si le compte connecté n'est pas admin central.
function exigerAdminCentral() {
  const token = exigerConnexionCentrale();
  if (!token) return null;
  if (localStorage.getItem("team53_role") !== "admin") {
    alert("Accès réservé aux administrateurs.");
    window.location.href = "tableau-de-bord.html";
    return null;
  }
  return token;
}

// ===== Accès à un site =====
// Plus de relais d'identifiants à préremplir : tous les sites lisent
// directement la même session team53_* (même origine). Il ne reste qu'à
// vérifier l'autorisation avant de naviguer.
function relayerVersSite(site) {
  const acces = JSON.parse(localStorage.getItem("team53_acces") || "[]");
  if (!acces.includes(site.id)) {
    alert("Accès non autorisé à ce site.");
    return;
  }
  window.location.href = site.pageArrivee;
}
