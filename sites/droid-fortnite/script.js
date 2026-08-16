// ===== Connexion à la base « BDD » sur GitHub =====
// Même dépôt BDD que les autres sites (Team53FR/BDD), dans son propre
// dossier, pour ne jamais toucher aux données des autres sites.
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
const DOSSIER_BDD = "DroidFortnite";
// ====================================================

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

// ===== Images (photos ajoutées par les comptes du site, pas des visuels du
// jeu — voir la note dans le formulaire d'ajout d'image) =====
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

// ===== Connexion (comptes multiples) =====
// Les identifiants vivent dans DroidFortnite/users.json sur le dépôt BDD :
//   [{ "login": "...", "password": "...", "nomAffichage": "..." }]
// Token + identité mémorisés sur l'appareil (localStorage), comme
// ma-bibliotheque : usage personnel/familial sur un appareil déjà protégé.
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
      localStorage.setItem("df_token", token);
      localStorage.setItem("df_login", utilisateur.login);
      window.location.href = "suivi.html";
    } else {
      message.textContent = "Identifiants incorrects.";
    }
  } catch (erreur) {
    if (erreur.status === 404) {
      message.textContent = "Aucun compte configuré : demande à un administrateur de t'accorder l'accès depuis le portail central.";
    } else {
      message.textContent = erreur.message;
    }
  }
}

function seDeconnecter() {
  localStorage.removeItem("df_token");
  localStorage.removeItem("df_login");
  window.location.href = "connexion.html";
}

function exigerConnexion() {
  const token = localStorage.getItem("df_token");
  const login = localStorage.getItem("df_login");
  if (!token || !login) {
    window.location.href = "connexion.html";
    return null;
  }
  return token;
}

function slugifierLogin(login) {
  return (login || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlever les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "_");
}

function cheminBibliothequeCourante() {
  const login = localStorage.getItem("df_login");
  return `bibliotheques/${slugifierLogin(login)}.json`;
}

// ===== Écriture avec fusion, pour les fichiers PARTAGÉS (catalogue.json,
// renaissance.json) =====
// Contrairement à un fichier personnel (un seul compte l'écrit jamais, donc
// « relire le sha puis réécrire le tableau local » est sûr), ces deux
// fichiers peuvent être modifiés par n'importe quel compte du site. Sur
// conflit (409), on relit le contenu DISTANT (pas juste son sha) et on
// fusionne : le tableau local (nos ajouts ET nos modifications) l'emporte
// pour chaque id qu'il contient, et on ne reprend du distant que les id
// qu'on ne connaît pas (ajoutés par quelqu'un d'autre entre-temps) — pour
// ne jamais perdre ni un ajout concurrent, ni notre propre modification.
async function sauvegarderAvecFusion(nomFichier, tableauLocal, sha, token, messageCommit) {
  try {
    return await ecrireFichierJSON(nomFichier, tableauLocal, sha, token, messageCommit);
  } catch (e) {
    if (!e.conflit) throw e;
    const frais = await lireFichierJSON(nomFichier, token);
    const distant = Array.isArray(frais.contenu) ? frais.contenu : [];
    const idsLocaux = new Set(tableauLocal.map(x => x.id));
    const fusion = distant.filter(x => !idsLocaux.has(x.id)).concat(tableauLocal);
    return await ecrireFichierJSON(nomFichier, fusion, frais.sha, token, messageCommit);
  }
}

// ===== Amorçage paresseux d'un fichier partagé =====
// Si le fichier n'existe pas encore (404), le crée avec les données de
// départ fournies. Je n'ai aucun moyen d'écrire directement dans le dépôt
// BDD moi-même (pas de token) : ce mécanisme, déclenché au premier chargement
// authentifié par un compte quelconque, est la seule façon de les amorcer.
//
// Deux chargements peuvent démarrer l'amorçage en même temps (rechargement
// de page pendant que la création précédente était encore en vol, deux
// onglets ouverts...) : le second à écrire reçoit alors un 409 (le fichier a
// été créé entre-temps par le premier). Dans ce cas précis, ce n'est pas une
// vraie erreur — on relit simplement ce que l'autre vient de créer.
async function chargerOuAmorcer(nomFichier, donneesInitiales, token, messageCommit) {
  try {
    const resultat = await lireFichierJSON(nomFichier, token);
    if (Array.isArray(resultat.contenu) && resultat.contenu.length === 0) {
      // Le fichier existe mais est vide (ex. laissé dans cet état par une
      // précédente tentative d'amorçage interrompue en cours de route) :
      // le repeupler avec les données de départ plutôt que de rester bloqué.
      const sha = await ecrireFichierJSON(nomFichier, donneesInitiales, resultat.sha, token, messageCommit);
      return { contenu: donneesInitiales, sha };
    }
    return resultat;
  } catch (e) {
    if (e.status !== 404) throw e;
    try {
      const sha = await ecrireFichierJSON(nomFichier, donneesInitiales, null, token, messageCommit);
      return { contenu: donneesInitiales, sha };
    } catch (e2) {
      if (e2.conflit) return await lireFichierJSON(nomFichier, token);
      throw e2;
    }
  }
}

// ===== Données de départ (catalogue + renaissance) =====
// Sourcées du tracker communautaire open-source « Droidex »
// (github.com/erikpeik/droidex, src/data/droids.ts et rebirths.ts) — PAS des
// données officielles Epic Games. Volontairement modifiables dans l'outil
// (voir suivi.js) : ajoute/corrige librement, ces listes ne sont qu'un point
// de départ et le jeu évolue (ex. les paliers Galactique/Stellar observés en
// jeu ne sont pas encore dans ce tracker au moment de l'écriture).
const CATALOGUE_INITIAL = [
  { id: "mouse", nom: "Mouse", classe: "Ouvrier", rarete: "Typique" },
  { id: "pit", nom: "Pit", classe: "Ouvrier", rarete: "Typique" },
  { id: "gonk", nom: "Gonk", classe: "Ouvrier", rarete: "Typique" },
  { id: "cb", nom: "CB", classe: "Astromec", rarete: "Typique" },
  { id: "r3", nom: "R3", classe: "Astromec", rarete: "Typique" },
  { id: "r5", nom: "R5", classe: "Astromec", rarete: "Typique" },
  { id: "r8", nom: "R8", classe: "Astromec", rarete: "Typique" },
  { id: "imperial-probe", nom: "Imperial Probe", classe: "Combat", rarete: "Typique" },
  { id: "b1-battle", nom: "B1 Battle", classe: "Combat", rarete: "Typique" },
  { id: "drk-1-probe", nom: "DRK-1 Probe", classe: "Combat", rarete: "Typique" },
  { id: "id10", nom: "ID10", classe: "Combat", rarete: "Typique" },
  { id: "bdx-explorer", nom: "BDX Explorer", classe: "Ouvrier", rarete: "Rare" },
  { id: "arg", nom: "ARG", classe: "Ouvrier", rarete: "Rare" },
  { id: "senate-hovercam", nom: "Senate Hovercam", classe: "Ouvrier", rarete: "Rare" },
  { id: "bu-4d", nom: "BU-4D", classe: "Ouvrier", rarete: "Rare" },
  { id: "bal-core", nom: "Bal-Core", classe: "Ouvrier", rarete: "Rare" },
  { id: "roll-r", nom: "ROLL-R", classe: "Ouvrier", rarete: "Rare" },
  { id: "2bb", nom: "2BB", classe: "Astromec", rarete: "Rare" },
  { id: "a-lt", nom: "A-LT", classe: "Astromec", rarete: "Rare" },
  { id: "r4", nom: "R4", classe: "Astromec", rarete: "Rare" },
  { id: "r9", nom: "R9", classe: "Astromec", rarete: "Rare" },
  { id: "b1-security", nom: "B1 Security", classe: "Combat", rarete: "Rare" },
  { id: "nav-ex", nom: "NAV-EX", classe: "Combat", rarete: "Rare" },
  { id: "vect-arm", nom: "VECT-Arm", classe: "Combat", rarete: "Rare" },
  { id: "hov-r", nom: "HOV-R", classe: "Combat", rarete: "Rare" },
  { id: "groundmech", nom: "Groundmech", classe: "Ouvrier", rarete: "Épique" },
  { id: "lo", nom: "LO", classe: "Ouvrier", rarete: "Épique" },
  { id: "amp-walker", nom: "AMP Walker", classe: "Ouvrier", rarete: "Épique" },
  { id: "sen-tri", nom: "SEN-TRI", classe: "Ouvrier", rarete: "Épique" },
  { id: "opti-pod", nom: "Opti-Pod", classe: "Ouvrier", rarete: "Épique" },
  { id: "gunrunner", nom: "Gunrunner", classe: "Ouvrier", rarete: "Épique" },
  { id: "bb", nom: "BB", classe: "Astromec", rarete: "Épique" },
  { id: "r2", nom: "R2", classe: "Astromec", rarete: "Épique" },
  { id: "r6", nom: "R6", classe: "Astromec", rarete: "Épique" },
  { id: "trak-r", nom: "TRAK-R", classe: "Astromec", rarete: "Épique" },
  { id: "orb-walker", nom: "ORB-Walker", classe: "Astromec", rarete: "Épique" },
  { id: "util-tec", nom: "Util-Tec", classe: "Astromec", rarete: "Épique" },
  { id: "b1-heavy", nom: "B1 Heavy", classe: "Combat", rarete: "Épique" },
  { id: "b2-super", nom: "B2 Super", classe: "Combat", rarete: "Épique" },
  { id: "b2-heavy", nom: "B2 Heavy", classe: "Combat", rarete: "Épique" },
  { id: "strike-orb", nom: "Strike-Orb", classe: "Combat", rarete: "Épique" },
  { id: "haul-r", nom: "Haul-R", classe: "Combat", rarete: "Épique" },
  { id: "lng-shot", nom: "LNG-Shot", classe: "Combat", rarete: "Épique" },
  { id: "proto-roller", nom: "Proto-Roller", classe: "Ouvrier", rarete: "Légendaire" },
  { id: "mecha-droid", nom: "Mecha-Droid", classe: "Ouvrier", rarete: "Légendaire" },
  { id: "mono-walker", nom: "Mono-WLKR", classe: "Ouvrier", rarete: "Légendaire" },
  { id: "bb9", nom: "BB9", classe: "Astromec", rarete: "Légendaire" },
  { id: "r7", nom: "R7", classe: "Astromec", rarete: "Légendaire" },
  { id: "b2-rp", nom: "B2-RP", classe: "Combat", rarete: "Légendaire" },
  { id: "cyclo-grav", nom: "Cyclo-Grav", classe: "Combat", rarete: "Légendaire" },
  { id: "opti-strike", nom: "Opti-STRK", classe: "Combat", rarete: "Légendaire" },
  { id: "snow-mouse", nom: "Snow Mouse", classe: "Ouvrier", rarete: "Mythique" },
  { id: "ric", nom: "RIC", classe: "Ouvrier", rarete: "Mythique" },
  { id: "loadlifter", nom: "Loadlifter", classe: "Ouvrier", rarete: "Mythique" },
  { id: "lep", nom: "LEP", classe: "Ouvrier", rarete: "Mythique" },
  { id: "ric-1200", nom: "RIC-1200", classe: "Ouvrier", rarete: "Mythique" },
  { id: "drft-r", nom: "DRFT-R", classe: "Astromec", rarete: "Mythique" },
  { id: "cyclens", nom: "CYCLENS", classe: "Astromec", rarete: "Mythique" },
  { id: "mo-trak", nom: "MO-TRAK", classe: "Astromec", rarete: "Mythique" },
  { id: "tri-tek", nom: "TRI-TEK", classe: "Astromec", rarete: "Mythique" },
  { id: "ig", nom: "IG", classe: "Combat", rarete: "Mythique" },
  { id: "kx", nom: "KX", classe: "Combat", rarete: "Mythique" },
  { id: "bb8", nom: "BB-8", classe: "Astromec", rarete: "Iconique" },
  { id: "mister-bones", nom: "Mister Bones", classe: "Combat", rarete: "Iconique" },
  { id: "ig-11-marshal", nom: "IG-11 Marshal", classe: "Combat", rarete: "Iconique" },
  { id: "dj-r3x", nom: "DJ R-3X", classe: "Ouvrier", rarete: "Iconique" },
  { id: "cb-23", nom: "CB-23", classe: "Astromec", rarete: "Iconique" },
  { id: "r2-d2", nom: "R2-D2", classe: "Astromec", rarete: "Iconique" },
  { id: "c-3po", nom: "C-3PO", classe: "Ouvrier", rarete: "Iconique" }
];

const RENAISSANCE_INITIALE = [
  { id: "niveau-1", niveau: 1, credits: 10000, elements: "CB (Défaut), Pit (Défaut), DRK-1 Probe (Défaut)" },
  { id: "niveau-2", niveau: 2, credits: 150000, elements: "BDX Explorer (Défaut), 2BB (Défaut), Bal-Core (Défaut)" },
  { id: "niveau-3", niveau: 3, credits: 975000, elements: "A-LT (Défaut), BU-4D (Défaut), R9 (Or)" },
  { id: "niveau-4", niveau: 4, credits: 2950000, elements: "ARG (Or), B1 Security (Or), Groundmech (Défaut)" },
  { id: "niveau-5", niveau: 5, credits: 5350000, elements: "BU-4D (Or), HOV-R (Or), R9 (Diamant)" },
  { id: "niveau-6", niveau: 6, credits: 9850000, elements: "Groundmech (Or), ARG (Diamant), A-LT (Diamant)" },
  { id: "niveau-7", niveau: 7, credits: 14500000, elements: "BB (Or), B1 Security (Diamant), BU-4D (Diamant)" },
  { id: "niveau-8", niveau: 8, credits: 36000000, elements: "Util-Tec (Or), LO (Or), HOV-R (Diamant)" },
  { id: "niveau-9", niveau: 9, credits: 89000000, elements: "Groundmech (Arc-en-ciel), R6 (Or), TRAK-R (Or)" },
  { id: "niveau-10", niveau: 10, credits: 220000000, elements: "LO (Arc-en-ciel), Haul-R (Arc-en-ciel), Strike-Orb (Or)" },
  { id: "niveau-11", niveau: 11, credits: 550000000, elements: "AMP Walker (Arc-en-ciel), B1 Heavy (Arc-en-ciel), BB9 (Défaut)" },
  { id: "niveau-12", niveau: 12, credits: 1360000000, elements: "Proto-Roller (Or), Mecha-Droid (Défaut), Mono-WLKR (Défaut)" },
  { id: "niveau-13", niveau: 13, credits: 3400000000, elements: "R7 (Défaut), Cyclo-Grav (Défaut), B2-RP (Défaut)" },
  { id: "niveau-14", niveau: 14, credits: 8450000000, elements: "Opti-STRK (Défaut), Mono-WLKR (Or), Mecha-Droid (Or)" },
  { id: "niveau-15", niveau: 15, credits: 21000000000, elements: "B2-RP (Or), BB9 (Or), R7 (Or)" },
  { id: "niveau-16", niveau: 16, credits: 52000000000, elements: "Opti-STRK (Or), Mono-WLKR (Diamant), Proto-Roller (Diamant)" },
  { id: "niveau-17", niveau: 17, credits: 130000000000, elements: "B2-RP (Diamant), Cyclo-Grav (Diamant), Mecha-Droid (Diamant)" },
  { id: "niveau-18", niveau: 18, credits: 325000000000, elements: "BB9 (Diamant), R7 (Diamant), Mono-WLKR (Arc-en-ciel)" },
  { id: "niveau-19", niveau: 19, credits: 810000000000, elements: "B2-RP (Arc-en-ciel), Cyclo-Grav (Arc-en-ciel), Proto-Roller (Arc-en-ciel)" },
  { id: "niveau-20", niveau: 20, credits: 2000000000000, elements: "R7 (Arc-en-ciel), Opti-STRK (Arc-en-ciel), Mecha-Droid (Arc-en-ciel)" },
  { id: "niveau-21", niveau: 21, credits: 3000000000000, elements: "BB (Beskar), ORB-Walker (Beskar), Groundmech (Beskar)" },
  { id: "niveau-22", niveau: 22, credits: 4500000000000, elements: "AMP Walker (Beskar), B1 Heavy (Beskar), Proto-Roller (Beskar)" },
  { id: "niveau-23", niveau: 23, credits: 6000000000000, elements: "Opti-STRK (Beskar), Mono-WLKR (Beskar), R7 (Beskar)" },
  { id: "niveau-24", niveau: 24, credits: 9000000000000, elements: "BB9 (Beskar), Cyclo-Grav (Beskar), MO-TRAK (Défaut)" },
  { id: "niveau-25", niveau: 25, credits: 13500000000000, elements: "B2-RP (Beskar), IG (Défaut), DRFT-R (Or)" },
  { id: "niveau-26", niveau: 26, credits: 21000000000000, elements: "CYCLENS (Or), Loadlifter (Diamant), RIC-1200 (Arc-en-ciel)" },
  { id: "niveau-27", niveau: 27, credits: 32000000000000, elements: "KX (Diamant), TRI-TEK (Arc-en-ciel), Snow Mouse (Beskar)" }
];

// Paliers d'amélioration possibles pour un droïde possédé, du plus faible au
// plus fort (confirmé par capture d'écran du jeu — au-delà de ce que le
// tracker communautaire connaît encore, qui s'arrête à Beskar).
const PALIERS_DROIDE = ["Défaut", "Or", "Diamant", "Arc-en-ciel", "Beskar", "Galactique", "Stellar"];
