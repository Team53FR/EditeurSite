// ===== A MODIFIER avec tes informations =====
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
// Dossier du dépôt qui contient les données de ce site (bibliotheques/,
// images/, publies.json). Les comptes, eux, sont centralisés ailleurs.
// Laisser "" pour revenir à la racine du dépôt.
const DOSSIER_BDD = "EditeurLivre";

// ===== Comptes centralisés =====
//
// Les comptes ne vivent plus dans le users.json de chaque site, mais dans un
// seul fichier — Web/utilisateurs.json — qui porte aussi la liste des sites
// auxquels chacun a accès. Un mot de passe changé l'est donc partout à la
// fois, et deux fichiers ne peuvent plus diverger en silence.
const CHEMIN_UTILISATEURS = "/Web/utilisateurs.json";
// Identifiants des sites du portail, dans l'ordre du tableau de bord. Sert à
// écrire une liste d'accès complète pour un compte qui n'en avait pas.
const SITES_CONNUS = ["editeur-livre", "ma-bibliotheque", "droid-fortnite"];
const ID_SITE = "editeur-livre";

// Un compte peut-il entrer ici ? Un administrateur du portail, oui, toujours.
// Sinon il faut que ce site figure dans ses accès. Une entrée sans champ
// « acces » date d'avant la centralisation : on la laisse passer plutôt que
// d'enfermer quelqu'un dehors, la liste étant ensuite gérée par le portail.
function aAccesAuSite(utilisateur) {
  if (!utilisateur) return false;
  if (utilisateur.role === "admin") return true;
  if (!Array.isArray(utilisateur.acces)) return true;
  return utilisateur.acces.includes(ID_SITE);
}

// Date de connexion : la globale, plus celle propre à ce site. Les deux
// coexistent — le portail montre la dernière visite tous sites confondus,
// chaque site la sienne — et l'ancien champ « derniereConnexion » des
// fichiers de site retrouve ainsi sa place.
function noterConnexion(utilisateur) {
  const maintenant = new Date().toISOString();
  utilisateur.derniereConnexion = maintenant;
  if (!utilisateur.connexions || typeof utilisateur.connexions !== "object") {
    utilisateur.connexions = {};
  }
  utilisateur.connexions[ID_SITE] = maintenant;
}
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
// Ex. "publies.json" -> .../contents/EditeurLivre/publies.json
// Ainsi le reste du code continue de manipuler des chemins courts
// ("publies.json", "bibliotheques/x.json", "images/x/y.png").
function urlContenuBDD(chemin) {
  // Un chemin commençant par « / » part de la RACINE du dépôt et ignore le
  // dossier du site : c'est ainsi qu'on atteint le fichier central des
  // comptes, qui n'appartient à aucun site en particulier.
  const depuisRacine = chemin.charAt(0) === "/";
  const base = depuisRacine ? "" : (DOSSIER_BDD || "").replace(/^\/+|\/+$/g, "");
  const prefixe = base ? base + "/" : "";
  const suite = depuisRacine ? chemin.slice(1) : chemin;
  return `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${prefixe}${suite}`;
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
  } else if (data.sha) {
    // Fichier trop volumineux pour l'API Contents (plus de 1 Mo) : son contenu
    // n'accompagne plus les métadonnées. On le lit alors par l'API des blobs,
    // en demandant le format brut — authentifiée, elle marche sur un dépôt
    // privé, là où l'URL de téléchargement directe se fait refuser.
    const reponseBlob = await fetch(
      `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/git/blobs/${data.sha}`,
      { headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github.raw" } });

    if (reponseBlob.ok) {
      contenuDecode = await reponseBlob.text();
    } else if (data.download_url) {
      // Dernier recours : l'URL directe, qui porte son propre jeton temporaire.
      const reponseBrute = await fetch(data.download_url);
      if (!reponseBrute.ok) {
        throw new Error(`Le fichier "${nomFichier}" est trop volumineux et sa version brute n'a pas pu être récupérée.`);
      }
      contenuDecode = await reponseBrute.text();
    } else {
      throw new Error(`Le fichier "${nomFichier}" est trop volumineux et sa version brute n'a pas pu être récupérée.`);
    }
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

// Primitives sur le dépôt entier, utilisées par la purge. Le préfixe « / »
// fait sortir du dossier du site (voir urlContenuBDD).
function lireFichierDepot(chemin, token) { return lireFichierJSON(chemin, token); }
function ecrireFichierDepot(chemin, contenu, sha, token, message) {
  return ecrireFichierJSON(chemin, contenu, sha, token, message);
}
async function supprimerFichierDepot(chemin, token, message) {
  const sha = await obtenirShaFichier(chemin, token);
  if (!sha) return false;
  await supprimerFichierGithub(chemin, token, message);
  return true;
}
async function listerDossierDepot(chemin, token) {
  const reponse = await fetch(urlContenuBDD(chemin), {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
  });
  if (reponse.status === 404) return [];
  if (!reponse.ok) { const e = new Error("Dossier illisible."); e.status = reponse.status; throw e; }
  const data = await reponse.json();
  return Array.isArray(data) ? data : [];
}

// ===== Purge des données d'un compte =====
//
// Supprimer un compte n'efface rien de ce qu'il possédait : ses fichiers sont
// rangés sous un nom dérivé de son login, et recréer le même identifiant les
// retrouve. C'est voulu — une suppression par erreur reste réparable.
//
// Quand on veut vraiment tout effacer, cette fonction s'en charge : les trois
// bibliothèques, les images de couverture, et les publications retirées de
// l'index commun. Best-effort fichier par fichier : ce qui résiste est nommé
// dans le compte rendu plutôt que d'interrompre le reste, sans quoi une image
// verrouillée laisserait la moitié du ménage en plan sans le dire.
//
// (Même code côté portail et côté éditeur : les deux pages qui suppriment un
// compte doivent effacer exactement la même chose.)

// Le nom de dossier d'un compte. On réutilise la fonction de slug déjà
// présente — celle du portail ou celle du site — plutôt que d'en écrire une
// troisième : une règle qui changerait d'un côté ferait chercher la purge au
// mauvais endroit, et elle effacerait alors les fichiers de personne.
function slugPurge(login) {
  if (typeof slugifierLoginPortail === "function") return slugifierLoginPortail(login);
  if (typeof slugifierLogin === "function") return slugifierLogin(login);
  return (login || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "_");
}

async function supprimerDonneesUtilisateur(login, token) {
  const slug = slugPurge(login);
  const rapport = { bibliotheques: 0, images: 0, publications: 0, echecs: [] };
  if (!slug) return rapport;

  const effacer = async (chemin, quoi) => {
    try {
      const supprime = await supprimerFichierDepot(chemin, token,
        `Suppression des données de ${login}`);
      if (supprime) rapport[quoi]++;
    } catch (e) {
      rapport.echecs.push(chemin);
    }
  };

  // 1) Une bibliothèque par site — le fichier personnel de chacun.
  await effacer(`/EditeurLivre/bibliotheques/${slug}.json`, "bibliotheques");
  await effacer(`/MaBibliotheque/bibliotheques/${slug}.json`, "bibliotheques");
  await effacer(`/DroidFortnite/bibliotheques/${slug}.json`, "bibliotheques");

  // 2) Les images, rangées dans un dossier par compte : on liste avant, le
  //    nombre de couvertures n'étant connu de personne.
  for (const dossier of [`/EditeurLivre/images/${slug}`, `/MaBibliotheque/images/${slug}`]) {
    let entrees = [];
    try {
      entrees = await listerDossierDepot(dossier, token);
    } catch (e) {
      rapport.echecs.push(dossier);
      continue;
    }
    for (const entree of entrees) {
      if (entree && entree.type === "file") await effacer("/" + entree.path, "images");
    }
  }

  // 3) L'index des livres publiés est commun : ses entrées survivraient à la
  //    suppression et resteraient lisibles par tout le monde.
  try {
    const { contenu, sha } = await lireFichierDepot("/EditeurLivre/publies.json", token);
    const liste = Array.isArray(contenu) ? contenu : [];
    const restantes = liste.filter((e) => e && e.proprietaire !== login);
    rapport.publications = liste.length - restantes.length;
    if (rapport.publications > 0) {
      await ecrireFichierDepot("/EditeurLivre/publies.json", restantes, sha, token,
        `Retrait des publications de ${login}`);
    }
  } catch (e) {
    // 404 : personne n'a jamais rien publié — rien à retirer.
    if (e.status !== 404) rapport.echecs.push("EditeurLivre/publies.json");
  }

  return rapport;
}

// Compte rendu lisible, pour la ligne de message du panneau.
function resumePurge(rapport) {
  const morceaux = [];
  if (rapport.bibliotheques) morceaux.push(rapport.bibliotheques + " bibliothèque(s)");
  if (rapport.images) morceaux.push(rapport.images + " image(s)");
  if (rapport.publications) morceaux.push(rapport.publications + " publication(s)");
  let texte = morceaux.length ? "Données supprimées : " + morceaux.join(", ") + "." : "Aucune donnée à supprimer.";
  if (rapport.echecs.length) {
    texte += " Non supprimé : " + rapport.echecs.join(", ") + ".";
  }
  return texte;
}

// Le pseudo et le rôle sont recopiés sur l'appareil à la connexion, pour ne
// pas relire le fichier des comptes à chaque page. Cette copie ne bouge plus
// ensuite : un pseudo changé depuis le portail — ou depuis un autre appareil —
// laissait l'ancien s'afficher ici indéfiniment.
//
// On la remet donc d'aplomb au chargement de la bibliothèque, sur le compte
// courant seulement. Best-effort : le fichier illisible ne doit pas empêcher
// d'ouvrir ses livres.
async function rafraichirIdentiteCentrale(token) {
  const login = localStorage.getItem("gh_login");
  if (!token || !login) return null;
  try {
    const { contenu } = await lireFichierJSON(CHEMIN_UTILISATEURS, token);
    const moi = (Array.isArray(contenu) ? contenu : []).find((u) => u.login === login);
    if (!moi) return null;

    const nom = moi.nomAffichage ? String(moi.nomAffichage) : "";
    const role = moi.role === "admin" ? "admin" : "user";
    localStorage.setItem("gh_nom", nom);
    localStorage.setItem("gh_role", role);
    // La session centrale porte les mêmes valeurs : la laisser en arrière
    // ferait réapparaître l'ancien pseudo au prochain passage par le portail.
    localStorage.setItem("team53_nom", nom);
    localStorage.setItem("team53_role", role);
    return moi;
  } catch (e) {
    return null;
  }
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
    const { contenu, sha } = await lireFichierJSON(CHEMIN_UTILISATEURS, token);
    const utilisateurs = Array.isArray(contenu) ? contenu : [];

    const utilisateur = utilisateurs.find(
      u => u.login === login && u.password === password
    );

    if (!utilisateur) {
      message.textContent = "Identifiants incorrects.";
      return;
    }
    if (!aAccesAuSite(utilisateur)) {
      message.textContent = "Ce compte n'a pas accès à ce site. Demandez l'accès à un administrateur depuis le portail central.";
      return;
    }

    // Le token reste UNIQUEMENT en mémoire de session (jamais écrit dans un fichier)
    localStorage.setItem("gh_token", token);
    localStorage.setItem("gh_login", login);
    localStorage.setItem("gh_role", utilisateur.role === "admin" ? "admin" : "user");
    localStorage.setItem("gh_nom", utilisateur.nomAffichage ? String(utilisateur.nomAffichage) : "");

    // Date de dernière connexion, par site, dans le fichier central
    // (best-effort : un échec d'écriture ne doit jamais bloquer l'entrée).
    try {
      noterConnexion(utilisateur);
      await ecrireFichierJSON(CHEMIN_UTILISATEURS, utilisateurs, sha, token,
        `Dernière connexion de ${login} sur ${ID_SITE}`);
    } catch (e) { /* on ignore : la connexion se poursuit */ }

    window.location.href = "bibliotheque.html";
  } catch (erreur) {
    if (erreur.status === 404) {
      message.textContent = "Aucun compte configuré : demandez à un administrateur de créer le vôtre depuis le portail central.";
    } else {
      message.textContent = erreur.message;
    }
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
// Le texte libre de la 4e de couverture (le « résumé »). Il obéit aux mêmes
// réglages que le titre et l'auteur — police, taille, position — plus une
// largeur, sans laquelle un paragraphe courrait d'un bord à l'autre.
//
// Rendu par l'éditeur, l'aperçu, la lecture et l'impression : une seule
// fonction, pour que les quatre montrent la même chose.
function htmlResumeCouv(data, couleurTexte, classe) {
  const texte = data && data.resumeTexte;
  if (!texte || !texte.trim()) return "";
  const largeur = typeof data.resumeLargeur === "number" ? data.resumeLargeur : 80;
  const align = data.resumeAlign || "left";
  const x = typeof data.resumeX === "number" ? data.resumeX : 0;
  const y = typeof data.resumeY === "number" ? data.resumeY : 0;
  const taille = typeof data.resumeTaille === "number" ? data.resumeTaille : 100;
  const police = data.resumePolice ? "font-family:" + data.resumePolice + ";" : "";

  // Le bloc se place sur la PAGE, pas dans le flux des textes de couverture :
  // sa position ne dépend donc plus de la hauteur des lignes ni des marges de
  // la couche, qui n'étaient pas les mêmes à l'écran et à l'impression — le
  // texte n'atterrissait pas où on l'avait posé.
  //
  // Tout est en pourcentage de la page, y compris le corps (cqw), pour que
  // l'aperçu et le tirage montrent exactement la même chose.
  return '<div class="couche-resume"><div class="' + classe + '" style="' +
    "color:" + couleurTexte + ";" + police +
    "left:calc(50% + " + x + "%);bottom:calc(8% + " + y + "%);" +
    "width:" + largeur + "%;text-align:" + align + ";" +
    "--mult-resume:" + (taille / 100) + ';">' +
    echapperHtmlCouv(texte) + "</div></div>";
}

function echapperHtmlCouv(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

// =====================================================================
//  Typographie par format
//
//  Un roman et un livre de poche ne se composent pas pareil : le poche est
//  deux fois plus petit, ses titres et son texte doivent suivre, sinon un
//  titre de 20 pt mange le tiers de la page.
//
//  Chaque format porte donc ses tailles. Elles pilotent des variables CSS
//  utilisées à la fois par la zone d'édition, le mesureur de pagination,
//  l'aperçu et l'impression — la moindre différence entre ces quatre-là
//  ferait déborder le texte hors des pages découpées.
//
//  Les formats sans réglage propre gardent ceux du roman, seules valeurs de
//  l'éditeur jusqu'ici : aucun livre existant ne bouge.
const TYPO_ROMAN = { titre: 20, sousTitre: 13, paragraphe: 11, espaceTitre: 65 };

const TYPO_PAR_FORMAT = {
  "149x210": TYPO_ROMAN,
  "105x148": { titre: 18, sousTitre: 10, paragraphe: 9, espaceTitre: 20 }
};

function typoDuFormat(formatKey) {
  return TYPO_PAR_FORMAT[formatKey] || TYPO_ROMAN;
}

function appliquerTypoFormat(formatKey) {
  const t = typoDuFormat(formatKey);
  const racine = document.documentElement.style;
  racine.setProperty("--taille-titre", t.titre + "pt");
  racine.setProperty("--taille-sous-titre", t.sousTitre + "pt");
  racine.setProperty("--taille-paragraphe", t.paragraphe + "pt");

  // Le bouton de remise à zéro annonce les tailles du format en cours.
  const bouton = document.querySelector('button[onclick*="reinitialiserTailles"]');
  if (bouton) {
    bouton.title = "Remettre tout le livre aux tailles par défaut de ce format " +
      "(titre " + t.titre + ", sous-titre " + t.sousTitre +
      ", paragraphe " + t.paragraphe + ")";
  }
}

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
