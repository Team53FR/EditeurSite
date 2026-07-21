// ===== A MODIFIER avec tes informations =====
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
// =============================================

async function lireFichierJSON(nomFichier, token) {
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${nomFichier}`;
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
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${nomFichier}`;
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
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${chemin}`;
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

  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${chemin}`;
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
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${chemin}`;
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
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${chemin}`;

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
  const login = sessionStorage.getItem("gh_login");
  if (!login) return null;
  return `bibliotheques/${slugifierLogin(login)}.json`;
}

function obtenirPrefixeImagesUtilisateur() {
  const login = sessionStorage.getItem("gh_login");
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
    const { contenu: utilisateurs } = await lireFichierJSON("users.json", token);

    const utilisateurValide = utilisateurs.some(
      u => u.login === login && u.password === password
    );

    if (utilisateurValide) {
      // Le token reste UNIQUEMENT en mémoire de session (jamais écrit dans un fichier)
      sessionStorage.setItem("gh_token", token);
      sessionStorage.setItem("gh_login", login);
      window.location.href = "bibliotheque.html";
    } else {
      message.textContent = "Identifiants incorrects.";
    }
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}