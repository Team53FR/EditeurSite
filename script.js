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
  } else if (data.download_url) {
    const reponseBrute = await fetch(data.download_url);
    if (!reponseBrute.ok) {
      throw new Error(`Le fichier "${nomAffiche}" est trop volumineux et sa version brute n'a pas pu être récupérée.`);
    }
    contenuDecode = await reponseBrute.text();
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

// ===== Synchronisation d'un compte vers les sites =====
// Chaque site garde son propre fichier de comptes : un changement de mot de
// passe ou de pseudo doit y être reporté, sinon le compte central et le site
// divergent silencieusement. Utilisé par le panneau admin comme par la page
// « Mon compte ».

async function synchroniserEditeurLivre(loginCentral, passwordCentral, nomAffichage, token) {
  let liste = [];
  let sha = null;
  try {
    const r = await lireFichierJSONAbsolu("EditeurLivre/users.json", token);
    liste = Array.isArray(r.contenu) ? r.contenu : [];
    sha = r.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const existant = liste.find(u => u.login === loginCentral);
  if (existant) {
    existant.password = passwordCentral;
    if (nomAffichage) existant.nomAffichage = nomAffichage;
  } else {
    liste.push({ login: loginCentral, password: passwordCentral, role: "user", nomAffichage: nomAffichage || "" });
  }

  await ecrireFichierJSONAbsolu("EditeurLivre/users.json", liste, sha, token,
    `Synchronisation du compte ${loginCentral} depuis le portail central`);
}

// Même principe que synchroniserEditeurLivre(), pour Ma Bibliothèque (qui est
// maintenant, elle aussi, un site à comptes séparés — voir
// migrerMaBibliothequeVersMultiCompte()). Pas de champ "role" ici : ce site
// n'a pas de notion d'administrateur propre.
async function synchroniserMaBibliotheque(loginCentral, passwordCentral, nomAffichage, token) {
  let liste = [];
  let sha = null;
  try {
    const r = await lireFichierJSONAbsolu("MaBibliotheque/users.json", token);
    liste = Array.isArray(r.contenu) ? r.contenu : [];
    sha = r.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const existant = liste.find(u => u.login === loginCentral);
  if (existant) {
    existant.password = passwordCentral;
    if (nomAffichage) existant.nomAffichage = nomAffichage;
  } else {
    liste.push({ login: loginCentral, password: passwordCentral, nomAffichage: nomAffichage || "" });
  }

  await ecrireFichierJSONAbsolu("MaBibliotheque/users.json", liste, sha, token,
    `Synchronisation du compte ${loginCentral} depuis le portail central`);
}

// Même principe, pour Droid Fortnite (également à comptes séparés dès sa
// création). Pas de champ "role" ici non plus.
async function synchroniserDroidFortnite(loginCentral, passwordCentral, nomAffichage, token) {
  let liste = [];
  let sha = null;
  try {
    const r = await lireFichierJSONAbsolu("DroidFortnite/users.json", token);
    liste = Array.isArray(r.contenu) ? r.contenu : [];
    sha = r.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const existant = liste.find(u => u.login === loginCentral);
  if (existant) {
    existant.password = passwordCentral;
    if (nomAffichage) existant.nomAffichage = nomAffichage;
  } else {
    liste.push({ login: loginCentral, password: passwordCentral, nomAffichage: nomAffichage || "" });
  }

  await ecrireFichierJSONAbsolu("DroidFortnite/users.json", liste, sha, token,
    `Synchronisation du compte ${loginCentral} depuis le portail central`);
}

// Reporte le compte sur les trois sites. Best-effort site par site : qu'un
// fichier soit indisponible ne doit pas empêcher les autres d'être à jour.
async function synchroniserTousLesSites(login, password, nomAffichage, token) {
  const taches = [
    ["editeur-livre", synchroniserEditeurLivre],
    ["ma-bibliotheque", synchroniserMaBibliotheque],
    ["droid-fortnite", synchroniserDroidFortnite]
  ];
  const echecs = [];
  for (const [nom, fn] of taches) {
    try { await fn(login, password, nomAffichage, token); }
    catch (e) { echecs.push(nom); }
  }
  return echecs;
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

// ===== Migration des comptes existants =====
// Fusionne EditeurLivre/users.json et MaBibliotheque/users.json dans
// Web/utilisateurs.json. Ré-exécutable sans jamais créer de doublon ni
// écraser un compte central déjà présent : les comptes déjà migrés ne sont
// que complétés (union des accès), jamais recréés.
// Note : MaBibliotheque/users.json n'existe que si
// migrerMaBibliothequeVersMultiCompte() a déjà tourné (voir plus bas) —
// avant ça, ce site n'a qu'un compte.json unique, non repris ici.
async function importerComptesExistants(token) {
  let utilisateurs = [];
  let sha = null;
  try {
    const resultat = await lireFichierJSON("utilisateurs.json", token);
    utilisateurs = Array.isArray(resultat.contenu) ? resultat.contenu : [];
    sha = resultat.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const normaliser = s => (s || "").trim().toLowerCase();
  const index = new Map(utilisateurs.map(u => [normaliser(u.login), u]));
  let ajoutes = 0, accesAjoutes = 0;

  function fusionner(login, password, nomAffichage, siteId) {
    const cle = normaliser(login);
    if (!cle) return;
    let central = index.get(cle);
    if (!central) {
      central = { login, password, role: "user", nomAffichage: nomAffichage || "", acces: [] };
      index.set(cle, central);
      utilisateurs.push(central);
      ajoutes++;
    }
    if (!Array.isArray(central.acces)) central.acces = [];
    if (!central.acces.includes(siteId)) {
      central.acces.push(siteId);
      accesAjoutes++;
    }
  }

  try {
    const { contenu } = await lireFichierJSONAbsolu("EditeurLivre/users.json", token);
    (Array.isArray(contenu) ? contenu : []).forEach(u =>
      fusionner(u.login, u.password, u.nomAffichage, "editeur-livre"));
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  try {
    const { contenu } = await lireFichierJSONAbsolu("MaBibliotheque/users.json", token);
    (Array.isArray(contenu) ? contenu : []).forEach(u =>
      fusionner(u.login, u.password, u.nomAffichage, "ma-bibliotheque"));
  } catch (e) {
    // 404 : soit rien n'a encore été migré (voir migrerMaBibliothequeVersMultiCompte),
    // soit le site n'a pas encore de compte du tout — dans les deux cas, rien à fusionner.
    if (e.status !== 404) throw e;
  }

  await ecrireFichierJSON("utilisateurs.json", utilisateurs, sha, token,
    "Import des comptes existants (editeur-livre, ma-bibliotheque)");

  return { ajoutes, accesAjoutes, total: utilisateurs.length };
}

// ===== Migration structurelle de Ma Bibliothèque vers un compte par personne =====
// Avant : MaBibliotheque/compte.json (un seul compte) + livres.json (une
// seule collection partagée) + images/<id>.jpg (chemin plat).
// Après : MaBibliotheque/users.json (comptes multiples) +
// bibliotheques/<slug>.json (une collection par compte) +
// images/<slug>/<id>.jpg — même pattern qu'editeur-livre. Ne supprime jamais
// les anciens fichiers, qui restent en place par sécurité une fois la
// migration faite.
//
// Idempotence : on vérifie l'existence de bibliotheques/<slug>.json pour LE
// COMPTE DE compte.json précisément (pas juste "users.json existe") — sinon,
// si un admin donne accès à Ma Bibliothèque à un second compte central AVANT
// d'avoir cliqué ce bouton, synchroniserMaBibliotheque() aura déjà créé
// users.json avec ce second compte, et ce bouton se croirait "déjà fait" en
// laissant la vraie collection historique orpheline dans l'ancien
// livres.json. On fusionne donc dans users.json plutôt que de l'écraser.
async function migrerMaBibliothequeVersMultiCompte(token) {
  let compte;
  try {
    const r = await lireFichierJSONAbsolu("MaBibliotheque/compte.json", token);
    compte = r.contenu;
  } catch (e) {
    if (e.status === 404) return { rienAMigrer: true };
    throw e;
  }
  if (!compte || !compte.login) return { rienAMigrer: true };

  const slug = slugifierLoginPortail(compte.login);

  const dejaMigre = await obtenirShaFichierAbsolu(`MaBibliotheque/bibliotheques/${slug}.json`, token);
  if (dejaMigre) return { dejaMigre: true };

  let livres = [];
  try {
    const r = await lireFichierJSONAbsolu("MaBibliotheque/livres.json", token);
    livres = Array.isArray(r.contenu) ? r.contenu : [];
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  let imagesDeplacees = 0;
  for (const item of livres) {
    if (item && item.image) {
      const ancienChemin = "MaBibliotheque/" + item.image;
      const nouveauCheminRelatif = `images/${slug}/${item.image.split("/").pop()}`;
      try {
        const base64 = await telechargerImageBrute(ancienChemin, token);
        await uploaderImageAbsolu("MaBibliotheque/" + nouveauCheminRelatif, base64, token,
          `Migration de l'image de ${compte.login} vers un compte séparé`);
        item.image = nouveauCheminRelatif;
        imagesDeplacees++;
      } catch (e) {
        // Best-effort : une image en échec ne doit pas bloquer toute la migration ;
        // l'item garde son ancien chemin (toujours valide, rien n'est supprimé).
      }
    }
  }

  await ecrireFichierJSONAbsolu(`MaBibliotheque/bibliotheques/${slug}.json`, livres, null, token,
    `Bibliothèque séparée pour ${compte.login}`);

  // Fusion dans users.json (jamais d'écrasement : un autre compte a pu y être
  // ajouté entre-temps par synchroniserMaBibliotheque()).
  let utilisateursMB = [];
  let shaUsersMB = null;
  try {
    const r = await lireFichierJSONAbsolu("MaBibliotheque/users.json", token);
    utilisateursMB = Array.isArray(r.contenu) ? r.contenu : [];
    shaUsersMB = r.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (!utilisateursMB.some(u => u.login === compte.login)) {
    utilisateursMB.push({ login: compte.login, password: compte.password, nomAffichage: "" });
  }
  await ecrireFichierJSONAbsolu("MaBibliotheque/users.json", utilisateursMB, shaUsersMB, token,
    "Passage de Ma Bibliothèque à des comptes séparés");

  return { migre: true, login: compte.login, livres: livres.length, imagesDeplacees };
}
