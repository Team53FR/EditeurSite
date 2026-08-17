// ===== A MODIFIER avec tes informations =====
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
// Dossier du dépôt qui contient toute la base (users.json, bibliotheques/, images/).
// Laisser "" pour revenir à la racine du dépôt.
const DOSSIER_BDD = "EditeurLivre";
// =============================================

// ===== Session : une seule connexion pour tous les sites =====
//
// Le portail central mémorise sa session dans localStorage sous team53_*.
// Les sites vivant sur la même origine (GitHub Pages), ils y ont accès
// directement : inutile de se reconnecter en arrivant ici depuis un
// signet, ou après avoir fermé le navigateur.
//
// L'ordre est : session propre au site (gh_*) d'abord — elle peut être
// plus récente, par exemple si l'on s'est connecté ici directement —
// puis la session centrale, adoptée telle quelle.
//
// Le token n'est plus cantonné à l'onglet : il fallait le retaper à
// chaque fermeture du navigateur, ce qui était le principal irritant.
// Il vit donc sur l'appareil, comme sur les autres sites du portail.

const CLES_SESSION = ["gh_token", "gh_login", "gh_role", "gh_nom"];
const CLES_CENTRALES = { gh_token: "team53_token", gh_login: "team53_login",
                         gh_role: "team53_role", gh_nom: "team53_nom" };

// Recopie la session centrale sous les clés de ce site, si la nôtre manque.
function adopterSessionCentrale() {
  if (localStorage.getItem("gh_token")) return false;
  const tokenCentral = localStorage.getItem("team53_token");
  if (!tokenCentral) return false;
  for (const cle of CLES_SESSION) {
    const valeur = localStorage.getItem(CLES_CENTRALES[cle]);
    if (valeur !== null) localStorage.setItem(cle, valeur);
  }
  return true;
}

// Appelée au chargement de chaque page, avant toute vérification d'accès.
adopterSessionCentrale();

// Déconnexion : la session est commune, on la ferme donc partout, sans quoi
// la session centrale reprendrait la main au rechargement suivant.
function seDeconnecter() {
  for (const cle of CLES_SESSION) localStorage.removeItem(cle);
  for (const cle of Object.values(CLES_CENTRALES)) localStorage.removeItem(cle);
  localStorage.removeItem("team53_acces");
  sessionStorage.removeItem("livre_id");
  window.location.replace("../../connexion.html");
}

// Construit l'URL de l'API GitHub pour un chemin RELATIF à la base.
// Ex. "users.json" -> .../contents/EditeurLivre/users.json
// Ainsi le reste du code continue de manipuler des chemins courts
// ("users.json", "bibliotheques/x.json", "images/x/y.png").
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
    // Cas normal : fichier < 1 Mo, contenu encodé en base64 directement dans la réponse
    try {
      contenuDecode = decodeURIComponent(escape(atob(data.content)));
    } catch (e) {
      throw new Error(`Le contenu de "${nomFichier}" n'a pas pu être décodé (encodage invalide).`);
    }
  } else if (data.download_url) {
    // Fichier trop volumineux pour l'API Contents classique (> 1 Mo) :
    // on récupère le contenu brut via son URL directe, qui n'a pas cette limite.
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
    // 409 = le SHA fourni ne correspond plus à la version distante (modifié ailleurs).
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

  // On récupère les OCTETS bruts, authentifiés par le token dans l'en-tête.
  // (Le download_url de GitHub pour un dépôt privé est une URL signée à jeton
  //  temporaire qui expire : chargée dans un <img>, elle finit par échouer.)
  const reponse = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github.raw" }
  });

  if (reponse.ok) {
    const brut = await reponse.blob();
    const mime = mimeDepuisChemin(chemin);
    const blob = (brut.type && brut.type.startsWith("image/")) ? brut : new Blob([brut], { type: mime });
    return URL.createObjectURL(blob); // URL locale stable, sans expiration
  }

  // Repli : ancienne méthode (JSON + contenu base64 ou download_url)
  const reponseJson = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
  });
  if (!reponseJson.ok) throw new Error(`Impossible de charger l'image "${chemin}".`);
  const data = await reponseJson.json();
  if (data.content) return `data:${mimeDepuisChemin(chemin)};base64,${data.content.replace(/\n/g, "")}`;
  if (data.download_url) return data.download_url;
  throw new Error(`Image "${chemin}" introuvable.`);
}

function slugifierLogin(login) {
  return (login || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlever les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "_");
}

function obtenirNomFichierBibliotheque() {
  const login = localStorage.getItem("gh_login");
  if (!login) return null;
  return `bibliotheques/${slugifierLogin(login)}.json`;
}

function cheminBibliothequeDe(login) {
  return `bibliotheques/${slugifierLogin(login)}.json`;
}

// ===== Mémorisation « tutoriel déjà vu » =====
// Source de vérité : le JSON de l'utilisateur (donc valable sur tous ses
// appareils). Un repli local sert de filet quand l'écriture distante échoue
// (réseau coupé, token en lecture seule…), pour que le tutoriel ne
// réapparaisse pas indéfiniment sur cet appareil.

function cleTutoLocale(champ) {
  return `tuto_${champ}_${localStorage.getItem("gh_login") || ""}`;
}

function tutoDejaVu(bib, champ) {
  if (bib && bib[champ]) return true;
  try { return localStorage.getItem(cleTutoLocale(champ)) === "1"; } catch (e) { return false; }
}

// Enregistre le drapeau dans le JSON de l'utilisateur. En cas de conflit de
// version (le fichier a changé entre-temps), on relit le SHA et on retente.
// Renvoie le nouveau SHA, ou null si l'écriture distante a échoué.
async function marquerTutoVuDistant(bib, champ, nomFichier, sha, token) {
  // Repli immédiat : même si le réseau échoue, plus de tutoriel en boucle ici.
  try { localStorage.setItem(cleTutoLocale(champ), "1"); } catch (e) {}

  if (!bib || bib[champ]) return sha;
  bib[champ] = true;

  try {
    return await ecrireFichierJSON(nomFichier, bib, sha, token, "Tutoriel vu");
  } catch (erreur) {
    if (erreur && erreur.conflit) {
      // Le fichier distant a bougé : on repart de la version à jour.
      try {
        const frais = await lireFichierJSON(nomFichier, token);
        frais.contenu[champ] = true;
        return await ecrireFichierJSON(nomFichier, frais.contenu, frais.sha, token, "Tutoriel vu");
      } catch (e2) { /* on abandonne : le repli local a déjà fait son office */ }
    }
    return null;
  }
}

// Index central des livres publiés (lisible par tout utilisateur connecté).
// Renvoie { contenu: [...], sha } ; liste vide si le fichier n'existe pas encore.
async function lireIndexPublies(token) {
  try {
    return await lireFichierJSON("publies.json", token);
  } catch (e) {
    if (e.status === 404) return { contenu: [], sha: null };
    throw e;
  }
}

function obtenirPrefixeImagesUtilisateur() {
  const login = localStorage.getItem("gh_login");
  return `images/${slugifierLogin(login)}`;
}

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
    const { contenu: utilisateurs, sha } = await lireFichierJSON("users.json", token);

    const utilisateur = utilisateurs.find(
      u => u.login === login && u.password === password
    );

    if (utilisateur) {
      // Le token reste UNIQUEMENT en mémoire de session (jamais écrit dans un fichier)
      localStorage.setItem("gh_token", token);
      localStorage.setItem("gh_login", login);
      localStorage.setItem("gh_role", utilisateur.role === "admin" ? "admin" : "user");
      localStorage.setItem("gh_nom", utilisateur.nomAffichage ? String(utilisateur.nomAffichage) : "");

      // Enregistrer la date de dernière connexion dans users.json (best-effort :
      // ne doit jamais empêcher la connexion en cas d'échec d'écriture).
      try {
        utilisateur.derniereConnexion = new Date().toISOString();
        await ecrireFichierJSON("users.json", utilisateurs, sha, token, `Dernière connexion de ${login}`);
      } catch (e) { /* on ignore : la connexion se poursuit */ }

      window.location.href = "bibliotheque.html";
    } else {
      message.textContent = "Identifiants incorrects.";
    }
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

// ===== Mise en forme du titre / de l'auteur sur une couverture =====
// Partagé par l'éditeur, l'aperçu, l'impression ET la vignette de la
// bibliothèque, pour que les quatre rendus ne divergent jamais.
//
//  - position : en % de la PAGE (donc conservée si le format change)
//      X : -50 (gauche) .. 0 .. 50 (droite)   Y : 0 (bas) .. 100 (haut)
//  - police   : pile de polices CSS
//  - taille   : en % (100 = taille par défaut). Exposée comme MULTIPLICATEUR
//      CSS, car chaque contexte a sa propre taille de base (page, vignette,
//      impression) : le réglage s'y adapte au lieu d'être figé en pixels.
function styleTexteCouv(data, cle) {
  if (!data) return "";
  let css = "";

  const x = typeof data[cle + "X"] === "number" ? data[cle + "X"] : 0;
  const y = typeof data[cle + "Y"] === "number" ? data[cle + "Y"] : 0;
  if (x || y) css += `position:relative;left:${x}%;bottom:${y}%;`;

  const police = data[cle + "Police"];
  if (police) css += `font-family:${police};`;

  const taille = data[cle + "Taille"];
  if (typeof taille === "number" && taille !== 100) {
    css += `--mult-${cle}:${taille / 100};`;
  }
  return css;
}
