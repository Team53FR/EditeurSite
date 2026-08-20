// ===== Connexion à la base « BDD » sur GitHub =====
// Même dépôt BDD que les autres sites (Team53FR/BDD), dans son propre
// dossier, pour ne jamais toucher aux données des autres sites.
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
const DOSSIER_BDD = "DroidFortnite";

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
const ID_SITE = "droid-fortnite";

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
// ====================================================

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

// Redimensionne côté client avant envoi (identique à sites/ma-bibliotheque/collection.js),
// en préservant la transparence si la source en a (ex. icône PNG détourée) :
// le JPEG n'a pas de canal alpha, l'exporter systématiquement en JPEG
// aplatirait tout fond transparent en noir. On ne détecte le format qu'une
// fois l'image redimensionnée, sur les pixels réellement utilisés.
// Partagé entre suivi.js (photo perso sur une carte) et admin.js (icône lors
// de l'ajout/modification d'un droïde).
function comprimerImage(fichier, maxDim = 700, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let transparent = false;
        const pixels = ctx.getImageData(0, 0, width, height).data;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 255) { transparent = true; break; }
        }

        resolve(transparent ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

// ===== Visuels des droïdes (partagés entre suivi.js et admin.js) =====
function classeRareteCss(rarete) {
  return (rarete || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function iconeClasse(classe) {
  if (classe === "Astromec") return "\u{1F4E1}";
  if (classe === "Combat") return "\u2694\uFE0F";
  return "\u{1F527}";
}

// Visuel généré (pas une image du jeu, dont je n'ai pas le droit de
// distribuer les visuels officiels) : une teinte dérivée du nom du droïde,
// pour que chaque carte reste distincte visuellement même sans photo perso.
function couleurDroide(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 50%)`;
}


// ===== Unités de grandeur (K, M, B, T…) =====
//
// Les montants du jeu grimpent vite : on saisit « 4 » + « K » plutôt que
// « 4000 », et surtout plutôt que « 4K » — cette chaîne était stockée telle
// quelle et parseFloat("4K") vaut 4, si bien que le total de l'escouade
// sous-comptait d'un facteur mille sans rien signaler.
//
// La valeur enregistrée est donc TOUJOURS un nombre en crédits : l'unité
// n'est qu'une commodité de saisie et d'affichage, redéduite à l'ouverture
// du formulaire. Un seul nombre canonique, et tous les calculs restent justes.
//
// Liste éditable depuis le panneau admin (DroidFortnite/unites.json), pour
// le jour où le jeu dépassera le billion.
const UNITES_INITIALES = [
  { symbole: "K", facteur: 1e3 },
  { symbole: "M", facteur: 1e6 },
  { symbole: "B", facteur: 1e9 },
  { symbole: "T", facteur: 1e12 }
];

// Symbole réservé au rendement des Iconiques, qui rapportent un pourcentage
// du revenu total et non des crédits par seconde. Jamais dans unites.json :
// ce n'est pas un facteur, c'est une autre nature de valeur.
const UNITE_POURCENT = "%";

let unites = UNITES_INITIALES;

function normaliserUnites(brutes) {
  return (Array.isArray(brutes) ? brutes : [])
    .map((u) => (typeof u === "string"
      ? { symbole: u, facteur: NaN }
      : { symbole: String(u && u.symbole || "").trim(), facteur: Number(u && u.facteur) }))
    .filter((u) => u.symbole && isFinite(u.facteur) && u.facteur > 0)
    .sort((a, b) => a.facteur - b.facteur);
}

// Nombre -> { valeur, unite } avec la plus grande unité qui laisse |valeur| >= 1.
function decomposerValeur(n) {
  if (typeof n !== "number" || !isFinite(n)) return { valeur: "", unite: "" };
  if (n === 0) return { valeur: 0, unite: "" };
  let choisie = { symbole: "", facteur: 1 };
  unites.forEach((u) => { if (Math.abs(n) >= u.facteur) choisie = u; });
  const valeur = n / choisie.facteur;
  // 2 décimales suffisent, et on ne garde pas les zéros inutiles.
  return { valeur: Math.round(valeur * 100) / 100, unite: choisie.symbole };
}

// { valeur, unite } -> nombre en crédits, ou « 25% » pour un pourcentage.
// Retourne null si rien n'a été saisi.
function composerValeur(valeurBrute, symbole) {
  const texte = String(valeurBrute == null ? "" : valeurBrute).trim();
  if (!texte) return null;
  const n = parseFloat(texte.replace(",", "."));
  if (!isFinite(n)) return null;
  if (symbole === UNITE_POURCENT) return (Math.round(n * 100) / 100) + UNITE_POURCENT;
  const u = unites.find((x) => x.symbole === symbole);
  return u ? n * u.facteur : n;
}

// Abrège un montant selon les unités connues : 7200 -> « 7.2 K ».
// Partagé par le Droidex, le panneau admin et la liste des renaissances.
function formaterCredits(n) {
  if (typeof n !== "number" || !isFinite(n)) return String(n);
  const d = decomposerValeur(n);
  return d.unite ? d.valeur + " " + d.unite : String(d.valeur);
}

// Les droïdes Iconiques n'existent qu'au premier palier dans le jeu.
// Partagé : le Droidex les masque ailleurs, le formulaire admin n'y propose
// pas de prix ni de rendement.
function estDisponibleAuPalier(d, palierNom) {
  const rarete = raretes.find((r) => r.nom === (d && d.rarete));
  if (!rarete || !rarete.premierPalierSeulement) return true;
  const premier = paliers[0] && paliers[0].nom;
  return palierNom === premier;
}

// ===== Prix et rendement, palier par palier =====
//
// Le rendement d'un droïde monte à chaque amélioration : un même droïde a
// donc autant de valeurs que de paliers. Les deux tables sont indexées par
// NOM de palier, comme l'est déjà la possession (voir clePossession) — ce
// qui les garde cohérentes si un palier est ajouté ou réordonné.
//
//   { id: "mouse", ..., prix: { "Défaut": 950, "Or": 4000 },
//                       rendements: { "Défaut": 2, "Or": 4 } }
//
// Les valeurs sont conservées telles qu'elles ont été saisies : la plupart
// sont des nombres, mais les droïdes Iconiques rapportent un pourcentage du
// revenu total (« 15% »), que formaterRendement laisse passer tel quel.

function valeurPalier(table, palier) {
  if (!table || typeof table !== "object") return null;
  const v = table[palier];
  return (v === undefined || v === null || v === "") ? null : v;
}

// Formate un montant : nombre -> abrégé (k, M, Md), texte -> inchangé.
function formaterValeurSaisie(v) {
  if (v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  const brut = String(v).trim();
  // « 15% » ou toute autre notation libre : on n'y touche pas.
  if (!isFinite(n) || /[^\d.,\s]/.test(brut)) return brut;
  return formaterCredits(n);
}

function formaterPrix(d, palier) {
  return formaterValeurSaisie(valeurPalier(d.prix, palier));
}

function formaterRendement(d, palier) {
  const f = formaterValeurSaisie(valeurPalier(d.rendements, palier));
  return f === null ? null : f + "/s";
}

// ===== Couleurs des raretés =====
//
// Éditables depuis le panneau admin (DroidFortnite/raretes.json) plutôt que
// figées dans la feuille de style. Chaque rareté a un fond et une couleur de
// texte : c'est le couple qui doit rester lisible, pas le fond seul.
//
// Les règles sont injectées dans un <style> plutôt qu'appliquées badge par
// badge : elles valent ainsi partout où un badge apparaît — cartes du
// Droidex, panneau admin, feuille de choix de l'escouade — sans que chaque
// endroit ait à y penser.
const RARETES_INITIALES = [
  { nom: "Typique",    fond: "#123540", texte: "#7dd3e0" },
  { nom: "Rare",       fond: "#0e3a44", texte: "#22d3ee" },
  { nom: "Épique",     fond: "#4c1d95", texte: "#ddd6fe" },
  { nom: "Légendaire", fond: "#78350f", texte: "#fde68a" },
  { nom: "Mythique",   fond: "#831843", texte: "#fbcfe8" },
  // « premierPalierSeulement » remplace le test sur le nom : dans le jeu, les
  // Iconiques ne s'améliorent pas. Une rareté ajoutée plus tard peut se voir
  // attribuer le même comportement sans toucher au code.
  { nom: "Iconique",   fond: "#065f46", texte: "#a7f3d0", premierPalierSeulement: true }
];

let raretes = RARETES_INITIALES;

// La liste stockée fait foi : son ORDRE est celui du plus faible au plus
// fort, et sert de tri partout. Une entrée incomplète est complétée par la
// rareté de départ du même nom, ou par des couleurs neutres.
function normaliserRaretes(brutes) {
  const liste = (Array.isArray(brutes) ? brutes : [])
    .map((r) => (typeof r === "string" ? { nom: r } : r))
    .filter((r) => r && String(r.nom || "").trim());
  if (!liste.length) return RARETES_INITIALES.slice();
  return liste.map((r) => {
    const nom = String(r.nom).trim();
    const defaut = RARETES_INITIALES.find((d) => d.nom === nom) || {};
    return {
      nom,
      fond: r.fond || defaut.fond || "#334155",
      texte: r.texte || defaut.texte || "#e2e8f0",
      premierPalierSeulement: r.premierPalierSeulement !== undefined
        ? !!r.premierPalierSeulement
        : !!defaut.premierPalierSeulement
    };
  });
}

// Remplit un <select> avec les raretés connues, en gardant la valeur
// choisie si elle existe encore.
function remplirSelectRaretes(select, valeur, libelleVide) {
  if (!select) return;
  const choisi = valeur !== undefined ? valeur : select.value;
  select.innerHTML =
    (libelleVide ? '<option value="">' + libelleVide + "</option>" : "") +
    raretes.map((r) => '<option value="' + r.nom.replace(/"/g, "&quot;") + '">' +
      r.nom + "</option>").join("");
  if (choisi && raretes.some((r) => r.nom === choisi)) select.value = choisi;
}

function appliquerCouleursRaretes() {
  let style = document.getElementById("stylesRaretes");
  if (!style) {
    style = document.createElement("style");
    style.id = "stylesRaretes";
    document.head.appendChild(style);
  }
  style.textContent = raretes.map((r) =>
    ".badge-rarete." + classeRareteCss(r.nom) +
    " { background: " + r.fond + "; color: " + r.texte + "; }"
  ).join("\n");
}

// ===== Couleur d'un palier : une teinte, ou plusieurs =====
//
// « Arc-en-ciel » n'est pas une couleur : c'est une suite de couleurs. Un
// palier accepte donc soit une chaîne (cas courant), soit un tableau de
// chaînes, auquel cas son contour devient un dégradé.
function couleursPalier(couleur) {
  if (Array.isArray(couleur)) return couleur.filter(Boolean);
  return couleur ? [couleur] : [];
}

// Valeur CSS de fond : une couleur pleine, ou un dégradé.
function fondPalier(couleur) {
  const c = couleursPalier(couleur);
  if (!c.length) return "transparent";
  if (c.length === 1) return c[0];
  return "linear-gradient(135deg, " + c.join(", ") + ")";
}

// Contour d'une carte. Une bordure CSS ne peut pas être un dégradé, et
// border-image ignore border-radius (coins carrés). On superpose donc deux
// fonds : l'intérieur opaque rogné sur la boîte de padding, le dégradé rogné
// sur la boîte de bordure — ce qui donne un contour dégradé aux coins ronds.
function appliquerContourPalier(el, couleur) {
  const c = couleursPalier(couleur);
  el.classList.remove("contour-degrade");
  el.style.backgroundImage = "";
  if (!c.length) return;
  if (c.length === 1) { el.style.borderColor = c[0]; return; }
  el.classList.add("contour-degrade");
  el.style.borderColor = "transparent";
  el.style.backgroundImage =
    "linear-gradient(var(--fond-carte-droide), var(--fond-carte-droide)), " +
    "linear-gradient(135deg, " + c.join(", ") + ")";
}

// ===== Super renaissance =====
//
// À chaque super renaissance, les paliers de renaissance demandent des
// droïdes différents — les niveaux et leurs coûts, eux, ne bougent pas.
// Le champ « elements » devient donc une table indexée par numéro de super
// renaissance : { "0": "CB (Défaut), …", "1": "…" }.
//
// L'ancienne forme (une simple chaîne) vaut pour la super renaissance 0 :
// les données déjà saisies restent valables sans migration.

function elementsParSuper(r) {
  const brut = r && r.elements;
  if (typeof brut === "string") return { 0: brut };
  if (brut && typeof brut === "object") {
    const table = {};
    Object.keys(brut).forEach((cle) => {
      const n = Number(cle);
      if (Number.isInteger(n) && n >= 0) table[n] = String(brut[cle] || "");
    });
    return table;
  }
  return {};
}

function elementsPourSuper(r, superN) {
  return elementsParSuper(r)[Number(superN) || 0] || "";
}

// Combien de super renaissances la donnée décrit-elle ? Au moins une (la 0),
// et une de plus dès qu'un palier en mentionne une plus haute.
function nombreSuperRenaissances(liste) {
  let maxi = 0;
  (Array.isArray(liste) ? liste : []).forEach((r) => {
    Object.keys(elementsParSuper(r)).forEach((n) => { maxi = Math.max(maxi, Number(n)); });
  });
  return maxi + 1;
}

// La progression suit la même dimension : atteindre le palier 5 avant une
// super renaissance ne doit pas le laisser coché après, puisqu'on recommence.
// Ancienne forme (un simple tableau) = progression de la super renaissance 0.
function progressionParSuper(brut) {
  if (Array.isArray(brut)) return { 0: brut.slice() };
  if (brut && typeof brut === "object") {
    const table = {};
    Object.keys(brut).forEach((cle) => {
      const n = Number(cle);
      if (Number.isInteger(n) && n >= 0 && Array.isArray(brut[cle])) table[n] = brut[cle].slice();
    });
    return table;
  }
  return {};
}

// Le champ « elements » d'une renaissance est du texte libre, saisi à la
// main : « CB (Défaut), Pit (Défaut), DRK-1 Probe (Or) ». On le relit pour
// retrouver les droïdes du catalogue et montrer leurs visuels plutôt qu'une
// ligne de texte. Ce qui ne se laisse pas reconnaître reste affiché tel quel :
// mieux vaut une étiquette texte qu'un élément disparu de la liste.
function analyserElementsRenaissance(texte) {
  return String(texte || "")
    .split(",")
    .map((morceau) => morceau.trim())
    .filter(Boolean)
    .map((morceau) => {
      const m = morceau.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      const nom = (m ? m[1] : morceau).trim();
      const palier = m ? m[2].trim() : "";
      const droide = catalogue.find((d) =>
        d.nom.toLowerCase() === nom.toLowerCase());
      // Palier absent ou inconnu : on retombe sur le premier, le seul dont on
      // soit certain qu'il existe.
      const palierConnu = paliers.some((p) => p.nom === palier);
      const palierFinal = palierConnu ? palier : (paliers[0] && paliers[0].nom);
      return { texte: morceau, droide, palier: palierFinal, palierPrecise: palierConnu };
    });
}

// ===== Carte de droïde : visuel commun au Droidex et au panneau admin =====
//
// Reprend la présentation du tracker communautaire Droidex : vignette
// sombre au format portrait, le nom en médaillon en haut à gauche, la
// classe et la rareté en pied, un contour teinté par le palier, et la
// carte estompée tant que le droïde n'est pas possédé.

// Correspondance entre les paliers d'ici et les suffixes de fichier
// employés par Droidex (dont les images sont nommées NOM_PALIER.webp).
const PALIERS_IMAGE_EXTERNE = {
  "Défaut": "DEFAULT",
  "Or": "GOLD",
  "Diamant": "DIAMOND",
  "Arc-en-ciel": "RAINBOW",
  "Beskar": "BESKAR",
  "Galactique": "GALACTIC"
};

// Source d'images externe, vide par défaut — et c'est volontaire.
//
// Renseignée (par exemple "https://droidex.web.app"), chaque carte va
// chercher son visuel à l'adresse {base}/droids/{NOM}_{PALIER}.webp, ce qui
// habille les 379 droïdes d'un coup. Mais ces visuels sont hébergés par un
// autre site, qui n'a rien demandé : le trafic est à sa charge, il peut
// renommer ou bloquer ses fichiers du jour au lendemain, et ce sont des
// extractions des visuels du jeu (c'est précisément pour cela que les cartes
// se contentaient jusqu'ici d'une teinte générée — voir couleurDroide).
//
// À laisser vide, donc, sauf décision explicite. Les images ajoutées droïde
// par droïde depuis le panneau admin restent prioritaires dans tous les cas.
let BASE_IMAGES_EXTERNES = "";

// Droidex nomme ses fichiers d'après le NOM du droïde, en majuscules et les
// espaces remplacés par des tirets bas : « DRK-1 Probe » -> DRK-1_PROBE.
// (L'identifiant ne conviendrait pas : ses tirets confondent les espaces et
// les vrais traits d'union — drk-1-probe ne dit pas lequel est lequel.)
function slugImageDroide(nom) {
  return (nom || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function urlImageExterne(nom, palier) {
  if (!BASE_IMAGES_EXTERNES) return null;
  const suffixe = PALIERS_IMAGE_EXTERNE[palier];
  if (!suffixe) return null;   // palier inconnu de cette source
  return BASE_IMAGES_EXTERNES.replace(/\/+$/, "") +
    "/droids/" + encodeURIComponent(slugImageDroide(nom) + "_" + suffixe + ".webp");
}

function echapperTexte(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

// Construit la carte d'un droïde.
//   options.possede    : carte en pleine lumière plutôt qu'estompée
//   options.couleur    : couleur du contour (celle du palier actif)
//   options.palier     : palier affiché, pour retrouver l'image externe
//   options.admin      : affiche la corbeille au lieu de la case à cocher
function construireCarteDroide(d, options) {
  const o = options || {};
  const carte = document.createElement("div");
  carte.className = "carte-droide" + (o.possede ? " possede" : "") + (o.admin ? " admin" : "");
  appliquerContourPalier(carte, o.couleur);

  carte.innerHTML =
    `<div class="dx-nom">${echapperTexte(d.nom)}</div>` +
    (o.admin
      ? `<button type="button" class="dx-action droide-supprimer" title="Supprimer">🗑</button>`
      : `<span class="dx-case" aria-hidden="true">✓</span>`) +
    `<div class="dx-visuel">` +
      `<span class="dx-scan"></span>` +
      `<span class="dx-vide" style="--teinte:${couleurDroide(d.id)}">${iconeClasse(d.classe)}</span>` +
    `</div>` +
    `<div class="dx-bas">` +
      `<div class="dx-pied">` +
        `<span class="dx-classe" title="${echapperTexte(d.classe)}">${iconeClasse(d.classe)}</span>` +
        `<span class="badge-rarete ${classeRareteCss(d.rarete)}">${echapperTexte(d.rarete)}</span>` +
      `</div>` +
      ligneChiffresHtml(d, o.palier) +
    `</div>`;

  appliquerVisuelDroide(carte.querySelector(".dx-visuel"), d, o.palier);
  return carte;
}

// Prix et rendement du palier affiché, en pied de carte. La ligne
// disparaît entièrement tant qu'aucune des deux valeurs n'est renseignée,
// pour ne pas afficher des tirets sur tout un catalogue encore vide.
function ligneChiffresHtml(d, palier) {
  const prix = formaterPrix(d, palier);
  const rendement = formaterRendement(d, palier);
  if (prix === null && rendement === null) return "";
  return `<div class="dx-chiffres">` +
    `<span class="dx-prix">${prix === null ? "" : echapperTexte(prix)}</span>` +
    `<span class="dx-rendement">${rendement === null ? "" : echapperTexte(rendement)}</span>` +
  `</div>`;
}

// Choisit le visuel de la carte, dans l'ordre :
//   1. l'image ajoutée pour ce droïde depuis le panneau admin ;
//   2. l'image de la source externe, si elle est configurée ;
//   3. la teinte générée et l'icône de classe, déjà en place dans le HTML.
async function appliquerVisuelDroide(zone, d, palier) {
  if (!zone) return;

  // Une centaine de vignettes se chargent d'un coup sur l'onglet « Tous » :
  // sous cette rafale, quelques requêtes échouent sans que le fichier soit
  // en cause. Abandonner au premier échec laissait ces droïdes sur leur
  // teinte générée jusqu'au rechargement complet de la page — d'où des
  // images « disparues » qui existaient pourtant bien. On réessaie donc,
  // en espaçant, avant de renoncer.
  // Nombre de REESSAIS après la tentative initiale : 2 réessais = 3 essais.
  const REESSAIS_IMAGE = 2;

  const poser = (url, reessaisRestants) => {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      img.remove();
      // La carte a pu être remplacée entre-temps (changement d'onglet,
      // filtre) : inutile de réessayer dans un élément détaché.
      if (reessaisRestants > 0 && zone.isConnected) {
        // Délai croissant et légèrement aléatoire, pour ne pas relancer
        // toutes les images manquantes au même instant.
        const attente = (REESSAIS_IMAGE - reessaisRestants + 1) * 400 + Math.random() * 400;
        setTimeout(() => poser(url, reessaisRestants - 1), attente);
      }
    };
    img.onload = () => { const v = zone.querySelector(".dx-vide"); if (v) v.style.display = "none"; };
    img.src = url;
    zone.appendChild(img);
  };

  if (d.image) {
    try {
      let url = cacheImages.get(d.image);
      if (!url) {
        url = await obtenirUrlImage(d.image, token);
        cacheImages.set(d.image, url);
      }
      poser(url, REESSAIS_IMAGE);
      return;
    } catch (e) {
      // On continue vers la source externe puis la teinte générée.
    }
  }

  const externe = urlImageExterne(d.nom, palier);
  if (externe) poser(externe, REESSAIS_IMAGE);
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

const CLES_SESSION = ["df_token", "df_login"];
const CLES_CENTRALES = { df_token: "team53_token",
                         df_login: "team53_login" };

// Recopie la session centrale sous les clés de ce site, si la nôtre manque.
function adopterSessionCentrale() {
  if (localStorage.getItem("df_token")) return false;
  if (!localStorage.getItem("team53_token")) return false;
  for (const cle of CLES_SESSION) {
    const valeur = localStorage.getItem(CLES_CENTRALES[cle]);
    if (valeur !== null) localStorage.setItem(cle, valeur);
  }
  return true;
}

adopterSessionCentrale();

// ===== Connexion (comptes multiples) =====
// Les identifiants vivent dans le fichier central Web/utilisateurs.json, avec
// la liste des sites auxquels chaque compte a accès (voir aAccesAuSite).
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
    const { contenu, sha } = await lireFichierJSON(CHEMIN_UTILISATEURS, token);
    const utilisateurs = Array.isArray(contenu) ? contenu : [];
    const utilisateur = utilisateurs.find(u => u.login === login && u.password === password);

    if (!utilisateur) {
      message.textContent = "Identifiants incorrects.";
      return;
    }
    if (!aAccesAuSite(utilisateur)) {
      message.textContent = "Ce compte n'a pas accès à ce site. Demandez l'accès à un administrateur depuis le portail central.";
      return;
    }

    localStorage.setItem("df_token", token);
    localStorage.setItem("df_login", utilisateur.login);

    try {
      noterConnexion(utilisateur);
      await ecrireFichierJSON(CHEMIN_UTILISATEURS, utilisateurs, sha, token,
        `Dernière connexion de ${login} sur ${ID_SITE}`);
    } catch (e) { /* la connexion se poursuit */ }

    window.location.href = "suivi.html";
  } catch (erreur) {
    if (erreur.status === 404) {
      message.textContent = "Aucun compte configuré : demandez à un administrateur de créer le vôtre depuis le portail central.";
    } else {
      message.textContent = erreur.message;
    }
  }
}

// La session est commune à tous les sites du portail : on la ferme donc
// partout, sans quoi la session centrale reprendrait la main au
// rechargement suivant.
function seDeconnecter() {
  for (const cle of CLES_SESSION) localStorage.removeItem(cle);
  for (const cle of Object.values(CLES_CENTRALES)) localStorage.removeItem(cle);
  localStorage.removeItem("team53_role");
  localStorage.removeItem("team53_nom");
  localStorage.removeItem("team53_acces");
  window.location.replace("../../connexion.html");
}

function exigerConnexion() {
  const token = localStorage.getItem("df_token");
  const login = localStorage.getItem("df_login");
  if (!token || !login) {
    window.location.replace("connexion.html");
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

// ===== Admin (réutilise le rôle du portail central) =====
// sites/droid-fortnite/* et le portail central partagent la même origine
// GitHub Pages, donc le même localStorage : team53_role posé par
// ouvrirSessionCentrale() (script.js racine) est directement lisible ici,
// sans rien ajouter au relais. Pas de rôle propre à Droid Fortnite : « admin »
// = admin du portail central. Si ce compte n'est jamais passé par le portail
// sur cet appareil, team53_role est absent -> traité comme non-admin
// (échec sûr, cohérent avec le reste de l'app qui n'a aucune vraie
// autorisation côté serveur de toute façon).
function estAdminCentral() {
  return localStorage.getItem("team53_role") === "admin";
}

function exigerAdminDroidFortnite() {
  const token = exigerConnexion();
  if (!token) return null;
  if (!estAdminCentral()) {
    alert("Accès réservé aux administrateurs du portail.");
    window.location.href = "suivi.html";
    return null;
  }
  return token;
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

// ===== Écriture simple (relire le sha, réécrire), pour un fichier partagé
// mais admin-only comme paliers.json =====
// Contrairement à catalogue.json/renaissance.json (modifiables par n'importe
// quel compte, donc sujets à une vraie collision), paliers.json n'est édité
// que par un admin, rarement, en général seul — un simple retry suffit, pas
// besoin de la fusion (et ce tableau de chaînes n'a de toute façon pas
// d'id sur lequel fusionner).
async function sauvegarderAvecRetry(nomFichier, contenu, sha, token, messageCommit) {
  try {
    return await ecrireFichierJSON(nomFichier, contenu, sha, token, messageCommit);
  } catch (e) {
    if (!e.conflit) throw e;
    const frais = await lireFichierJSON(nomFichier, token);
    return await ecrireFichierJSON(nomFichier, contenu, frais.sha, token, messageCommit);
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
// tracker communautaire connaît encore, qui s'arrête à Beskar). Donnée de
// départ uniquement : la vraie liste vit dans DroidFortnite/paliers.json
// (partagée, éditable depuis admin.html — ajout/suppression/réordonnancement,
// avec une couleur par palier qui teinte le contour des cartes du Droidex).
const PALIERS_INITIAUX = [
  { nom: "Défaut", couleur: "#9ca3af" },
  { nom: "Or", couleur: "#eab308" },
  { nom: "Diamant", couleur: "#38bdf8" },
  // Plusieurs couleurs : le contour devient un dégradé (voir fondPalier).
  { nom: "Arc-en-ciel", couleur: ["#f43f5e", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"] },
  { nom: "Beskar", couleur: "#94a3b8" },
  { nom: "Galactique", couleur: "#4f46e5" },
  { nom: "Stellar", couleur: "#f97316" }
];

// Ordre d'affichage des raretés, du plus faible au plus fort (utilisé pour
// trier la liste des droïdes dans le panneau admin).
// L'ordre des raretés vient de raretes.json : il donne l'ordre des listes
// déroulantes (du plus faible au plus fort). Les grilles, elles, suivent
// l'ordre du catalogue — celui du jeu.

// paliers.json pouvait exister sous l'ancienne forme (tableau de chaînes,
// avant l'ajout d'une couleur par palier) : on la reconnaît et la convertit
// à la volée, sans rien casser pour qui l'a déjà utilisée.
function normaliserPaliers(bruts) {
  return (Array.isArray(bruts) ? bruts : []).map((p) => {
    if (typeof p === "string") return { nom: p, couleur: null };
    // couleur peut être une chaîne (une teinte) ou un tableau (un dégradé).
    const couleurs = couleursPalier(p && p.couleur);
    return { nom: p.nom, couleur: couleurs.length > 1 ? couleurs : (couleurs[0] || null) };
  });
}
