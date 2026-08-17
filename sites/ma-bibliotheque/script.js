// ===== Connexion à la base « BDD » sur GitHub =====
// Même dépôt BDD que l'Éditeur de livre (Team53FR/BDD), mais dans son propre
// dossier, pour ne jamais toucher aux données de l'autre site.
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
const DOSSIER_BDD = "MaBibliotheque";
// Optionnel : clé Google Books gratuite (sans elle, le scan de code-barres
// fonctionne quand même via Open Library et la BnF, mais Google Books limite
// alors les requêtes anonymes à un quota global PARTAGÉ par tous les sites
// qui l'utilisent sans clé — il peut donc tomber à zéro sans lien avec ton
// usage. Pour l'activer : console.cloud.google.com -> nouveau projet ->
// API "Books API" -> Identifiants -> Créer une clé API (gratuit, 1000
// requêtes/jour rien que pour toi). Tu peux ensuite la restreindre à ton
// domaine GitHub Pages dans les paramètres de la clé.
const CLE_GOOGLE_BOOKS = "";
// La recherche de séries utilise TVMaze (api.tvmaze.com), gratuit et SANS
// clé ni inscription — rien à configurer ici. (Choisi à la place de TMDB,
// qui aurait demandé de fournir des informations de contact personnelles
// dans un formulaire d'inscription pour obtenir une clé.)
// ====================================================

// Construit l'URL de l'API GitHub pour un chemin RELATIF au dossier de la base.
// Ex. "livres.json" -> .../contents/MaBibliotheque/livres.json
function urlContenuBDD(chemin) {
  const base = (DOSSIER_BDD || "").replace(/^\/+|\/+$/g, "");
  const prefixe = base ? base + "/" : "";
  return `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${prefixe}${chemin}`;
}

async function lireFichierJSON(nomFichier, token) {
  const url = urlContenuBDD(nomFichier);
  const reponse = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    }
  });

  if (!reponse.ok) {
    const erreur = new Error("Impossible de lire le fichier (token invalide ou dépôt introuvable).");
    erreur.status = reponse.status;
    throw erreur;
  }

  const data = await reponse.json();
  let contenuDecode;

  if (data.content) {
    try {
      contenuDecode = decodeURIComponent(escape(atob(data.content)));
    } catch (e) {
      throw new Error(`Le contenu de "${nomFichier}" n'a pas pu être décodé (encodage invalide).`);
    }
  } else if (data.download_url) {
    const reponseBrute = await fetch(data.download_url);
    if (!reponseBrute.ok) {
      throw new Error(`Le fichier "${nomFichier}" est trop volumineux et sa version brute n'a pas pu être récupérée.`);
    }
    contenuDecode = await reponseBrute.text();
  } else {
    throw new Error(`Le fichier "${nomFichier}" est trop volumineux pour être lu (aucune URL brute disponible).`);
  }

  if (!contenuDecode.trim()) {
    throw new Error(`Le fichier "${nomFichier}" est vide.`);
  }

  try {
    return { contenu: JSON.parse(contenuDecode), sha: data.sha };
  } catch (e) {
    throw new Error(`Le fichier "${nomFichier}" contient un JSON invalide : ${e.message}`);
  }
}

async function ecrireFichierJSON(nomFichier, contenu, sha, token, messageCommit) {
  const url = urlContenuBDD(nomFichier);
  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(contenu, null, 2))));

  const corps = { message: messageCommit || `Mise à jour de ${nomFichier}`, content: contenuEncode };
  if (sha) corps.sha = sha;

  const reponse = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify(corps)
  });

  if (!reponse.ok) {
    let details = "";
    try { const err = await reponse.json(); if (err.message) details = ` (${err.message})`; } catch (e) {}
    const erreur = new Error(`Échec de l'écriture de "${nomFichier}"${details}.`);
    erreur.status = reponse.status;
    // 409 = le SHA fourni ne correspond plus à la version distante (modifiée ailleurs).
    if (reponse.status === 409) erreur.conflit = true;
    throw erreur;
  }

  const data = await reponse.json();
  return data.content.sha;
}

async function obtenirShaFichier(chemin, token) {
  const url = urlContenuBDD(chemin);
  const reponse = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
  });
  if (reponse.status === 404) return null;
  if (!reponse.ok) throw new Error(`Impossible de vérifier l'existence de "${chemin}".`);
  const data = await reponse.json();
  return data.sha;
}

function extraireExtensionDataUrl(dataUrl) {
  const correspondance = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
  if (!correspondance) return "jpg";
  let ext = correspondance[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  if (ext === "svg+xml") ext = "svg";
  return ext;
}

async function uploaderImageBase64(chemin, dataUrl, token, messageCommit) {
  const virgule = dataUrl.indexOf(",");
  if (virgule === -1) throw new Error("Format d'image invalide.");
  const contenuBase64 = dataUrl.slice(virgule + 1);

  const shaExistant = await obtenirShaFichier(chemin, token);

  const url = urlContenuBDD(chemin);
  const corps = { message: messageCommit || `Ajout de l'image ${chemin}`, content: contenuBase64 };
  if (shaExistant) corps.sha = shaExistant;

  const reponse = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify(corps)
  });

  if (!reponse.ok) {
    let details = "";
    try { const err = await reponse.json(); if (err.message) details = ` (${err.message})`; } catch (e) {}
    throw new Error(`Échec de l'envoi de l'image${details}.`);
  }

  return chemin;
}

async function supprimerFichierGithub(chemin, token, messageCommit) {
  const sha = await obtenirShaFichier(chemin, token);
  if (!sha) return;
  const url = urlContenuBDD(chemin);
  await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify({ message: messageCommit || `Suppression de ${chemin}`, sha })
  });
  // Volontairement silencieux en cas d'échec : ne doit pas bloquer le reste du flux
}

function mimeDepuisChemin(chemin) {
  const ext = (chemin.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/jpeg";
}

async function obtenirUrlImage(chemin, token) {
  const url = urlContenuBDD(chemin);

  // Octets bruts, authentifiés par le token (le download_url d'un dépôt privé
  // est une URL signée temporaire qui finit par expirer dans un <img>).
  const reponse = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github.raw" }
  });

  if (reponse.ok) {
    const brut = await reponse.blob();
    const mime = mimeDepuisChemin(chemin);
    const blob = (brut.type && brut.type.startsWith("image/")) ? brut : new Blob([brut], { type: mime });
    return URL.createObjectURL(blob); // URL locale stable, sans expiration
  }

  const reponseJson = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
  });
  if (!reponseJson.ok) throw new Error(`Impossible de charger l'image "${chemin}".`);
  const data = await reponseJson.json();
  if (data.content) return `data:${mimeDepuisChemin(chemin)};base64,${data.content.replace(/\n/g, "")}`;
  if (data.download_url) return data.download_url;
  throw new Error(`Image "${chemin}" introuvable.`);
}

// ===== Comptes (un par personne, chacun avec sa propre collection) =====
// Les identifiants vivent dans MaBibliotheque/users.json sur le dépôt BDD :
//   [{ "login": "...", "password": "...", "nomAffichage": "..." }]
// (Anciennement un compte unique dans compte.json — voir migrerMaBibliothequeVersMultiCompte()
// côté portail central pour la bascule vers ce fichier.)
// Le token GitHub et l'identifiant sont mémorisés sur l'appareil (localStorage)
// pour éviter de les retaper à chaque ouverture — usage personnel sur un
// téléphone déjà protégé par son propre verrouillage. Contrepartie assumée :
// quiconque déverrouille le téléphone a accès à la bibliothèque tant qu'on ne
// s'est pas déconnecté manuellement (bouton dédié, cf. seDeconnecter()).
async function seConnecter() {
  const login = document.getElementById("login").value.trim();
  const password = document.getElementById("password").value;
  const token = document.getElementById("token").value.trim();
  const message = document.getElementById("message");

  if (!login || !password || !token) {
    message.textContent = "Merci de remplir tous les champs.";
    return;
  }

  message.textContent = "Vérification en cours...";

  try {
    const { contenu } = await lireFichierJSON("users.json", token);
    const utilisateurs = Array.isArray(contenu) ? contenu : [];
    const utilisateur = utilisateurs.find(u => u.login === login && u.password === password);

    if (utilisateur) {
      localStorage.setItem("mb_token", token);
      localStorage.setItem("mb_login", utilisateur.login);
      window.location.href = "collection.html";
    } else {
      message.textContent = "Identifiants incorrects.";
    }
  } catch (erreur) {
    if (erreur.status === 404) {
      message.textContent = "Aucun compte configuré : crée MaBibliotheque/users.json dans le dépôt BDD.";
    } else {
      message.textContent = erreur.message;
    }
  }
}

// ===== Session : une seule connexion pour tous les sites =====
//
// Le portail central mémorise sa session dans localStorage sous team53_*.
// Ce site vivant sur la même origine (GitHub Pages), il y a accès
// directement : inutile de se reconnecter en arrivant ici depuis un
// signet, ou après avoir fermé le navigateur.
//
// La session propre au site passe d'abord — elle peut être plus récente,
// si l'on s'est connecté ici directement — puis la session centrale.

const CLES_SESSION = ["mb_token", "mb_login"];
const CLES_CENTRALES = { mb_token: "team53_token",
                         mb_login: "team53_login" };

// Recopie la session centrale sous les clés de ce site, si la nôtre manque.
function adopterSessionCentrale() {
  if (localStorage.getItem("mb_token")) return false;
  if (!localStorage.getItem("team53_token")) return false;
  for (const cle of CLES_SESSION) {
    const valeur = localStorage.getItem(CLES_CENTRALES[cle]);
    if (valeur !== null) localStorage.setItem(cle, valeur);
  }
  return true;
}

adopterSessionCentrale();

// La session est commune à tous les sites du portail : on la ferme donc
// partout, sans quoi la session centrale reprendrait la main au
// rechargement suivant.
function seDeconnecter() {
  for (const cle of CLES_SESSION) localStorage.removeItem(cle);
  for (const cle of Object.values(CLES_CENTRALES)) localStorage.removeItem(cle);
  localStorage.removeItem("team53_role");
  localStorage.removeItem("team53_nom");
  localStorage.removeItem("team53_acces");
  window.location.href = "../../connexion.html";
}

// Redirige vers la connexion si aucune session mémorisée (token + identité).
// À appeler en haut des pages protégées.
function exigerConnexion() {
  const token = localStorage.getItem("mb_token");
  const login = localStorage.getItem("mb_login");
  if (!token || !login) {
    window.location.href = "connexion.html";
    return null;
  }
  return token;
}

// ===== Chemins propres à chaque compte =====
function slugifierLogin(login) {
  return (login || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlever les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "_");
}

function cheminBibliothequeCourante() {
  const login = localStorage.getItem("mb_login");
  return `bibliotheques/${slugifierLogin(login)}.json`;
}

function obtenirPrefixeImagesUtilisateur() {
  const login = localStorage.getItem("mb_login");
  return `images/${slugifierLogin(login)}`;
}
