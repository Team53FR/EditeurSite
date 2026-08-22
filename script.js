// ===== Portail central Team53FR — connexion à la base « BDD » sur GitHub =====
// Même dépôt BDD que les sites (Team53FR/BDD), dans son propre dossier "Web/"
// pour ne jamais toucher aux données des sites eux-mêmes.
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
const DOSSIER_BDD = "Web";

// Registre de secours si Web/sites.json n'existe pas encore sur le dépôt BDD
// (premier déploiement). Une fois Web/sites.json créé, il prend le dessus.
// Le champ "relais" décrit comment préremplir la session du site cible avant
// d'y naviguer : quel stockage (sessionStorage/localStorage) et sous quelles
// clés, pour ne JAMAIS avoir à modifier le code du site lui-même.
const DEFAULT_SITES = [
  {
    id: "editeur-livre",
    nom: "Éditeur de livre",
    description: "Créez, mettez en page et imprimez vos livres en ligne.",
    icone: "📖",
    pageArrivee: "sites/editeur-livre/bibliotheque.html",
    relais: {
      stockage: "localStorage",
      cles: { token: "gh_token", login: "gh_login", role: "gh_role", nom: "gh_nom" }
    }
  },
  {
    id: "ma-bibliotheque",
    nom: "Ma Bibliothèque",
    description: "Répertoriez les livres et séries que vous possédez, tome par tome.",
    icone: "📚",
    pageArrivee: "sites/ma-bibliotheque/collection.html",
    relais: {
      stockage: "localStorage",
      cles: { token: "mb_token", login: "mb_login" }
    }
  },
  {
    id: "droid-fortnite",
    nom: "Droid Fortnite",
    description: "Suis ta progression dans Star Wars: Droid Tycoon — droidex et paliers de renaissance.",
    icone: "🤖",
    pageArrivee: "sites/droid-fortnite/suivi.html",
    relais: {
      stockage: "localStorage",
      cles: { token: "df_token", login: "df_login" }
    }
  }
];
// ==============================================================

// ----- Construction des URLs de l'API GitHub Contents -----

// Chemin RELATIF au dossier Web/. Ex. "utilisateurs.json" -> .../contents/Web/utilisateurs.json
function urlContenuBDD(chemin) {
  const base = (DOSSIER_BDD || "").replace(/^\/+|\/+$/g, "");
  const prefixe = base ? base + "/" : "";
  return `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${prefixe}${chemin}`;
}

// Chemin ABSOLU depuis la racine du dépôt BDD (hors du dossier Web/), utilisé
// uniquement pour lire/écrire les fichiers des sites existants lors de la
// migration ou de la synchronisation d'un compte (ex. "EditeurLivre/users.json").
function urlContenuAbsolu(chemin) {
  return `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${chemin}`;
}

async function _lireFichierJSONParUrl(url, nomAffiche, token) {
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
      throw new Error(`Le contenu de "${nomAffiche}" n'a pas pu être décodé (encodage invalide).`);
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
        throw new Error(`Le fichier "${nomAffiche}" est trop volumineux et sa version brute n'a pas pu être récupérée.`);
      }
      contenuDecode = await reponseBrute.text();
    } else {
      throw new Error(`Le fichier "${nomAffiche}" est trop volumineux et sa version brute n'a pas pu être récupérée.`);
    }
  } else {
    throw new Error(`Le fichier "${nomAffiche}" est trop volumineux pour être lu (aucune URL brute disponible).`);
  }

  if (!contenuDecode.trim()) {
    throw new Error(`Le fichier "${nomAffiche}" est vide.`);
  }

  try {
    return { contenu: JSON.parse(contenuDecode), sha: data.sha };
  } catch (e) {
    throw new Error(`Le fichier "${nomAffiche}" contient un JSON invalide : ${e.message}`);
  }
}

async function _ecrireFichierJSONParUrl(url, contenu, sha, token, messageCommit) {
  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(contenu, null, 2))));
  const corps = { message: messageCommit || "Mise à jour", content: contenuEncode };
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
    const erreur = new Error(`Échec de l'écriture${details}.`);
    erreur.status = reponse.status;
    if (reponse.status === 409) erreur.conflit = true;
    throw erreur;
  }

  const data = await reponse.json();
  return data.content.sha;
}

async function _obtenirShaParUrl(url, token) {
  const reponse = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
  });
  if (reponse.status === 404) return null;
  if (!reponse.ok) throw new Error("Impossible de vérifier l'existence du fichier.");
  const data = await reponse.json();
  return data.sha;
}

// --- Variantes relatives au dossier Web/ ---
function lireFichierJSON(nomFichier, token) {
  return _lireFichierJSONParUrl(urlContenuBDD(nomFichier), nomFichier, token);
}
function ecrireFichierJSON(nomFichier, contenu, sha, token, messageCommit) {
  return _ecrireFichierJSONParUrl(urlContenuBDD(nomFichier), contenu, sha, token, messageCommit);
}
function obtenirShaFichier(nomFichier, token) {
  return _obtenirShaParUrl(urlContenuBDD(nomFichier), token);
}

// --- Variantes absolues (chemin complet depuis la racine du dépôt BDD),
//     utilisées uniquement pour la migration / synchronisation avec les
//     fichiers propres à chaque site existant. ---
function lireFichierJSONAbsolu(chemin, token) {
  return _lireFichierJSONParUrl(urlContenuAbsolu(chemin), chemin, token);
}
function ecrireFichierJSONAbsolu(chemin, contenu, sha, token, messageCommit) {
  return _ecrireFichierJSONParUrl(urlContenuAbsolu(chemin), contenu, sha, token, messageCommit);
}
function obtenirShaFichierAbsolu(chemin, token) {
  return _obtenirShaParUrl(urlContenuAbsolu(chemin), token);
}

// Normalise un login en nom de fichier — même algorithme que
// slugifierLogin() dans sites/editeur-livre/script.js et
// sites/ma-bibliotheque/script.js (à garder identique pour que les chemins
// calculés ici correspondent exactement à ceux que chaque site recalcule
// lui-même côté client).
function slugifierLoginPortail(login) {
  return (login || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlever les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "_");
}

function _arrayBufferVersBase64(buffer) {
  let binaire = "";
  const octets = new Uint8Array(buffer);
  const taille = 0x8000; // éviter un appel apply() avec un tableau trop grand
  for (let i = 0; i < octets.length; i += taille) {
    binaire += String.fromCharCode.apply(null, octets.subarray(i, i + taille));
  }
  return btoa(binaire);
}

// Télécharge les octets bruts d'un fichier (image) à un chemin ABSOLU et les
// renvoie encodés en base64, prêts pour uploaderImageAbsolu().
async function telechargerImageBrute(chemin, token) {
  const reponse = await fetch(urlContenuAbsolu(chemin), {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github.raw" }
  });
  if (!reponse.ok) {
    const erreur = new Error(`Impossible de télécharger l'image "${chemin}".`);
    erreur.status = reponse.status;
    throw erreur;
  }
  return _arrayBufferVersBase64(await reponse.arrayBuffer());
}

async function uploaderImageAbsolu(chemin, contenuBase64, token, messageCommit) {
  const shaExistant = await obtenirShaFichierAbsolu(chemin, token);
  const corps = { message: messageCommit || `Ajout de l'image ${chemin}`, content: contenuBase64 };
  if (shaExistant) corps.sha = shaExistant;

  const reponse = await fetch(urlContenuAbsolu(chemin), {
    method: "PUT",
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" },
    body: JSON.stringify(corps)
  });

  if (!reponse.ok) {
    let details = "";
    try { const err = await reponse.json(); if (err.message) details = ` (${err.message})`; } catch (e) {}
    throw new Error(`Échec de l'envoi de l'image${details}.`);
  }
  return chemin;
}

async function supprimerFichierAbsolu(chemin, token, messageCommit) {
  const sha = await obtenirShaFichierAbsolu(chemin, token);
  if (!sha) return;
  await fetch(urlContenuAbsolu(chemin), {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" },
    body: JSON.stringify({ message: messageCommit || `Suppression de ${chemin}`, sha })
  });
  // Volontairement silencieux en cas d'échec : ne doit pas bloquer le reste du flux.
}

// ===== Registre des sites (Web/sites.json, avec repli sur DEFAULT_SITES) =====
async function chargerSites(token) {
  try {
    const { contenu } = await lireFichierJSON("sites.json", token);
    if (Array.isArray(contenu) && contenu.length) return contenu;
  } catch (e) { /* 404 ou absent : on retombe sur DEFAULT_SITES */ }
  return DEFAULT_SITES;
}

// Primitives sur le dépôt entier, utilisées par la purge. Le portail travaille
// déjà en chemins absolus : ce ne sont que des noms communs aux deux copies.
function lireFichierDepot(chemin, token) { return lireFichierJSONAbsolu(chemin.replace(/^\//, ""), token); }
function ecrireFichierDepot(chemin, contenu, sha, token, message) {
  return ecrireFichierJSONAbsolu(chemin.replace(/^\//, ""), contenu, sha, token, message);
}
async function supprimerFichierDepot(chemin, token, message) {
  const propre = chemin.replace(/^\//, "");
  const sha = await obtenirShaFichierAbsolu(propre, token);
  if (!sha) return false;
  await supprimerFichierAbsolu(propre, token, message);
  return true;
}
async function listerDossierDepot(chemin, token) {
  const reponse = await fetch(urlContenuAbsolu(chemin.replace(/^\//, "")), {
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

// ===== Connexion centrale =====
// Les comptes centraux vivent dans Web/utilisateurs.json sur le dépôt BDD :
//   [{ login, password, role: "admin"|"user", nomAffichage, acces: [siteId,...], derniereConnexion }]
// Session mémorisée en localStorage (persiste jusqu'à déconnexion manuelle),
// comme ma-bibliotheque.
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

  let utilisateurs, sha;
  try {
    const resultat = await lireFichierJSON("utilisateurs.json", token);
    utilisateurs = Array.isArray(resultat.contenu) ? resultat.contenu : [];
    sha = resultat.sha;
  } catch (erreur) {
    if (erreur.status === 404) {
      // Premier lancement : personne ne peut encore se connecter puisque
      // Web/utilisateurs.json n'existe pas. On amorce le système en créant un
      // compte fondateur admin à partir de ce qui vient d'être saisi.
      try {
        const sites = await chargerSites(token);
        const fondateur = {
          login, password, role: "admin",
          nomAffichage: login,
          acces: sites.map(s => s.id),
          derniereConnexion: new Date().toISOString()
        };
        await ecrireFichierJSON("utilisateurs.json", [fondateur], null, token,
          `Création du compte fondateur ${login}`);
        ouvrirSessionCentrale(fondateur, token);
        window.location.href = "tableau-de-bord.html";
      } catch (e2) {
        message.textContent = "Impossible de créer le premier compte : " + e2.message;
      }
      return;
    }
    message.textContent = erreur.message;
    return;
  }

  const utilisateur = utilisateurs.find(u => u.login === login && u.password === password);
  if (!utilisateur) {
    message.textContent = "Identifiants incorrects.";
    return;
  }

  ouvrirSessionCentrale(utilisateur, token);

  // Best-effort : ne doit jamais empêcher la connexion en cas d'échec d'écriture.
  try {
    utilisateur.derniereConnexion = new Date().toISOString();
    await ecrireFichierJSON("utilisateurs.json", utilisateurs, sha, token, `Dernière connexion de ${login}`);
  } catch (e) { /* ignoré */ }

  window.location.href = "tableau-de-bord.html";
}

function ouvrirSessionCentrale(utilisateur, token) {
  localStorage.setItem("team53_token", token);
  localStorage.setItem("team53_login", utilisateur.login);
  localStorage.setItem("team53_role", utilisateur.role === "admin" ? "admin" : "user");
  localStorage.setItem("team53_nom", utilisateur.nomAffichage ? String(utilisateur.nomAffichage) : "");
  localStorage.setItem("team53_acces", JSON.stringify(Array.isArray(utilisateur.acces) ? utilisateur.acces : []));
}

// La synchronisation d'un compte vers chaque site a disparu avec la
// centralisation : les sites lisent maintenant Web/utilisateurs.json
// directement, il n'y a plus de copie à tenir à jour.

// Remet la session d'aplomb à partir du fichier des comptes.
//
// Le rôle, le pseudo et la liste des accès sont recopiés sur l'appareil à la
// connexion, pour ne pas relire les comptes à chaque page. Mais cette copie ne
// bougeait plus ensuite : un accès accordé par un administrateur n'apparaissait
// qu'à la connexion suivante, et l'intéressé ne comprenait pas pourquoi son
// nouveau site restait invisible.
//
// Renvoie « false » si le compte a disparu du fichier — la session ne vaut
// alors plus rien. Une lecture qui échoue, elle, laisse la copie en place :
// mieux vaut un tableau de bord un peu daté que pas de tableau de bord.
async function rafraichirSessionCentrale(token) {
  const login = localStorage.getItem("team53_login");
  if (!token || !login) return true;
  let utilisateurs;
  try {
    const { contenu } = await lireFichierJSON("utilisateurs.json", token);
    utilisateurs = Array.isArray(contenu) ? contenu : [];
  } catch (e) {
    return true;
  }
  const moi = utilisateurs.find((u) => u.login === login);
  if (!moi) return false;
  ouvrirSessionCentrale(moi, token);
  return true;
}

function seDeconnecter() {
  localStorage.removeItem("team53_token");
  localStorage.removeItem("team53_login");
  localStorage.removeItem("team53_role");
  localStorage.removeItem("team53_nom");
  localStorage.removeItem("team53_acces");
  window.location.replace("connexion.html");
}

// Redirige vers la connexion si aucune session centrale n'est mémorisée.
function exigerConnexionCentrale() {
  const token = localStorage.getItem("team53_token");
  if (!token) {
    window.location.replace("connexion.html");
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

// ===== Relais d'identifiants vers un site =====
// Préremplit les clés de stockage que le site cible lit déjà lui-même (sans
// aucune modification de son propre code), puis y navigue directement.
function relayerVersSite(site) {
  const acces = JSON.parse(localStorage.getItem("team53_acces") || "[]");
  if (!acces.includes(site.id)) {
    alert("Accès non autorisé à ce site.");
    return;
  }

  const valeurs = {
    token: localStorage.getItem("team53_token"),
    login: localStorage.getItem("team53_login"),
    role: localStorage.getItem("team53_role"),
    nom: localStorage.getItem("team53_nom")
  };

  const cible = site.relais.stockage === "sessionStorage" ? sessionStorage : localStorage;
  Object.entries(site.relais.cles).forEach(([cle, nomCleCible]) => {
    if (valeurs[cle] != null) cible.setItem(nomCleCible, valeurs[cle]);
  });

  window.location.href = site.pageArrivee;
}

// Les deux migrations d'autrefois — import des users.json des sites, passage
// de Ma Bibliothèque à un compte par personne — ont été jouées et retirées.
// Elles ne servaient qu'une fois, et un bouton qui ne peut plus rien faire
// n'est qu'un piège de plus dans un panneau d'administration. Leur code reste
// dans l'historique si un jour un dépôt neuf en avait besoin.
