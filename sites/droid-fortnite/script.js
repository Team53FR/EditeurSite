// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({});

// ===== Droid Fortnite — Supabase (remplace la BDD GitHub) =====
// Compte central maison, partagé avec le portail et les deux autres sites —
// voir ../../../supabase/schema-compte-central.sql. La progression de
// chaque joueur est rattachée à son auth.uid() (le jeton signé par
// connexion()/inscription()), avec RLS pour que personne ne puisse lire/
// modifier la progression d'un autre. Schéma complet : supabase/schema.sql
// dans ce dossier.
const SUPABASE_URL = "https://uxedmplaeuonhhpxqpse.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vtFaCnMEFpqYvzzoth9T_w_6XCA4JCt";

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
// Les visuels du catalogue (droïdes, types) sont dans le bucket public
// "droid-fortnite" : chaque ligne (droides.image, classes.image) porte déjà
// l'URL publique complète, affichable directement dans un <img src>, sans
// jeton ni requête d'authentification — contrairement au dépôt GitHub privé
// d'avant, plus besoin de télécharger puis de fabriquer une URL locale.
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

// Envoie une image (data URL) dans le bucket "droid-fortnite", à l'emplacement
// donné, et renvoie son URL publique. "x-upsert" écrase silencieusement un
// fichier déjà présent au même chemin (remplacement d'image) — plus besoin de
// gérer un sha ni de réessayer sur une réponse incohérente, l'API Storage n'a
// pas ce problème.
async function uploaderImageStorage(chemin, dataUrl) {
  const virgule = dataUrl.indexOf(",");
  if (virgule === -1) throw new Error("Format d'image invalide.");
  const octets = atob(dataUrl.slice(virgule + 1));
  const tampon = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);

  const reponse = await fetch(`${SUPABASE_URL}/storage/v1/object/droid-fortnite/${chemin}`, {
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
  return `${SUPABASE_URL}/storage/v1/object/public/droid-fortnite/${chemin}`;
}

async function supprimerImageStorage(chemin) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/droid-fortnite/${chemin}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`
    }
  });
  // Volontairement silencieux en cas d'échec : ne doit pas bloquer le reste du flux.
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
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// La liste des classes (types de droide) est chargee depuis la table
// classes (partagee, editable dans l'onglet Types du panneau admin) : on
// cherche l'icone associee dans la variable globale "classes" (comme
// raretes/unites ci-dessous), avec un repli generique si le type est inconnu.
function iconeClasse(classe) {
  const liste = (classes && classes.length) ? classes : CLASSES_INITIALES;
  const trouve = liste.find((c) => c.nom === classe);
  return (trouve && trouve.icone) || "\u{1F916}";
}

// Le rendu d'un type, partout où il s'affiche : son image si elle en a une
// (URL publique directe, voir plus haut), son icône (emoji) sinon.
function classeVisuelHtml(nomClasse) {
  const liste = (classes && classes.length) ? classes : CLASSES_INITIALES;
  const trouve = liste.find((c) => c.nom === nomClasse);
  if (trouve && trouve.image) return `<img class="classe-glyphe" src="${trouve.image}" alt="">`;
  return echapperTexte(iconeClasse(nomClasse));
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
// Liste éditable depuis le panneau admin (table unites), pour le jour où le
// jeu dépassera le billion.
const UNITES_INITIALES = [
  { symbole: "K", facteur: 1e3 },
  { symbole: "M", facteur: 1e6 },
  { symbole: "B", facteur: 1e9 },
  { symbole: "T", facteur: 1e12 }
];

// Symbole réservé au rendement des Iconiques, qui rapportent un pourcentage
// du revenu total et non des crédits par seconde. Jamais dans la table
// unites : ce n'est pas un facteur, c'est une autre nature de valeur.
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

// ===== Vente et temps de fabrication, mêmes principes =====
//
// Le prix de vente se saisit et se totalise comme le prix d'achat (mêmes
// unités K/M/Md) : il vit donc dans une table `vente`, indexée par palier,
// au même titre que `prix` et `rendements`.
//
// Le temps de fabrication n'est PAS un montant : « 0:00:33 » ne se
// multiplie ni ne s'additionne comme un nombre de crédits. Il se saisit et
// s'affiche donc tel quel, en texte libre, dans une table `tempsFabrication`
// — même faille (indexée par palier), pas d'unité à composer/décomposer.
function formaterVente(d, palier) {
  return formaterValeurSaisie(valeurPalier(d.vente, palier));
}

function formaterTempsFabrication(d, palier) {
  const v = valeurPalier(d.tempsFabrication, palier);
  return v === null ? null : String(v).trim() || null;
}

// Le bonus de compagnon grandit lui aussi avec le palier (ex. Mouse : 20 %
// de vitesse de fabrication au palier Défaut, 140 % au palier Stellar) :
// texte libre par palier, comme le temps de fabrication.
function formaterBonus(d, palier) {
  const v = valeurPalier(d.bonus, palier);
  return v === null ? null : String(v).trim() || null;
}

// ===== Couleurs des raretés =====
//
// Éditables depuis le panneau admin (table raretes) plutôt que figées dans
// la feuille de style. Chaque rareté a un fond et une couleur de texte :
// c'est le couple qui doit rester lisible, pas le fond seul.
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
      // Un vrai bouton, pas une décoration : sur le Droidex, il bascule la
      // possession sans ouvrir le panneau de détail (voir afficherDroidex).
      // Les autres écrans (renaissance, fusion) le masquent en CSS — il reste
      // alors inerte, comme avant.
      : `<button type="button" class="dx-case" aria-label="Marquer comme possédé">✓</button>`) +
    `<div class="dx-visuel">` +
      `<span class="dx-scan"></span>` +
      `<span class="dx-vide" style="--teinte:${couleurDroide(d.id)}">${classeVisuelHtml(d.classe)}</span>` +
    `</div>` +
    `<div class="dx-bas">` +
      `<div class="dx-pied">` +
        `<span class="dx-classe" title="${echapperTexte(d.classe)}">${classeVisuelHtml(d.classe)}</span>` +
        `<span class="badge-rarete ${classeRareteCss(d.rarete)}">${echapperTexte(d.rarete)}</span>` +
      `</div>` +
      ligneChiffresHtml(d, o.palier) +
    `</div>`;

  // Repère « droïde de fusion » : petit médaillon distinct, pour reconnaître
  // d'un coup d'œil les droïdes obtenus en combinant trois autres.
  if (estDroideFusion(d.nom)) {
    const marque = document.createElement("span");
    marque.className = "dx-fusion";
    marque.innerHTML = '<span class="dx-fusion-ico">\u{1F9EC}</span><span class="dx-fusion-txt">FUSION</span>';
    marque.title = "Droïde de fusion";
    carte.appendChild(marque);
  }

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
//   1. l'image ajoutée pour ce droïde depuis le panneau admin (URL publique
//      directe, déjà résolue sur la ligne du droïde) ;
//   2. l'image de la source externe, si elle est configurée ;
//   3. la teinte générée et l'icône de classe, déjà en place dans le HTML.
function appliquerVisuelDroide(zone, d, palier) {
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
    poser(d.image, REESSAIS_IMAGE);
    return;
  }

  const externe = urlImageExterne(d.nom, palier);
  if (externe) poser(externe, REESSAIS_IMAGE);
}

// ===== Session : une seule connexion pour tous les sites =====
//
// Le portail central mémorise sa session dans localStorage sous team53_*.
// Ce site vivant sur la même origine (GitHub Pages), il y a accès
// directement — pas de jeton propre à Droid Fortnite à part, pas de relais
// à recopier : la même session Supabase sert partout.
function exigerConnexion() {
  const token = localStorage.getItem("team53_token");
  if (!token) {
    window.location.replace("../../connexion.html");
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

// ===== Admin (réutilise le rôle du portail central) =====
// Pas de rôle propre à Droid Fortnite : « admin » = admin du portail
// central, déjà dans team53_role (même origine, même localStorage).
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

// ===== Chargement du catalogue partagé =====
//
// Reconstruit exactement les mêmes formes en mémoire qu'avant (un objet par
// droïde avec prix/rendements/vente/tempsFabrication/bonus indexés par nom
// de palier) à partir des tables normalisées — pour que tout le reste du
// code (affichage, filtres, escouade, renaissance...) n'ait rien à changer.
// "ordre" est repris dans l'objet en mémoire (invisible du reste du code,
// qui l'ignore) uniquement pour que l'admin puisse le renvoyer tel quel à
// la moindre modification — Postgres exige une valeur pour une colonne
// "not null" même sur la branche UPDATE d'un upsert ON CONFLICT.
async function chargerCatalogueSupabase() {
  const [droidesRows, paliersDroideRows] = await Promise.all([
    requeteSupabase("droides?select=id,nom,classe,rarete,image,ordre&order=ordre"),
    requeteSupabase("droide_paliers?select=*")
  ]);
  const parDroide = new Map();
  paliersDroideRows.forEach((r) => {
    if (!parDroide.has(r.droide_id)) parDroide.set(r.droide_id, []);
    parDroide.get(r.droide_id).push(r);
  });
  return droidesRows.map((d) => {
    const lignes = parDroide.get(d.id) || [];
    const prix = {}, rendements = {}, vente = {}, tempsFabrication = {}, bonus = {};
    lignes.forEach((r) => {
      if (r.prix !== null) prix[r.palier] = Number(r.prix);
      if (r.rendement !== null) rendements[r.palier] = Number(r.rendement);
      else if (r.rendement_pourcentage !== null) rendements[r.palier] = String(r.rendement_pourcentage) + "%";
      if (r.vente !== null) vente[r.palier] = Number(r.vente);
      if (r.temps_fabrication !== null) tempsFabrication[r.palier] = r.temps_fabrication;
      if (r.bonus !== null) bonus[r.palier] = r.bonus;
    });
    return { id: d.id, nom: d.nom, classe: d.classe, rarete: d.rarete, image: d.image, ordre: d.ordre,
      prix, rendements, vente, tempsFabrication, bonus };
  });
}

async function chargerClassesSupabase() {
  const lignes = await requeteSupabase("classes?select=nom,icone,image,ordre&order=ordre");
  return lignes.map((c) => (c.image ? c : { nom: c.nom, icone: c.icone, ordre: c.ordre }));
}

async function chargerPaliersSupabase() {
  return requeteSupabase("paliers?select=nom,couleur&order=ordre");
}

async function chargerRaretesSupabase() {
  const lignes = await requeteSupabase("raretes?select=nom,fond,texte,premier_palier_seulement&order=ordre");
  return lignes.map((r) => ({
    nom: r.nom, fond: r.fond, texte: r.texte, premierPalierSeulement: r.premier_palier_seulement
  }));
}

async function chargerUnitesSupabase() {
  return requeteSupabase("unites?select=symbole,facteur");
}

async function chargerFusionsSupabase() {
  const [fusionsRows, ingredientsRows] = await Promise.all([
    requeteSupabase("fusions?select=id,nom,classe,rarete,image,ordre&order=ordre"),
    requeteSupabase("fusion_ingredients?select=*")
  ]);
  const parFusion = new Map();
  ingredientsRows.forEach((i) => {
    if (!parFusion.has(i.fusion_id)) parFusion.set(i.fusion_id, []);
    parFusion.get(i.fusion_id).push({ nom: i.droide_nom, quantite: i.quantite });
  });
  return fusionsRows.map((f) => ({
    id: f.id, resultat: f.nom, classe: f.classe, rarete: f.rarete, image: f.image, ordre: f.ordre,
    ingredients: parFusion.get(f.id) || []
  }));
}

async function chargerRenaissanceSupabase() {
  return requeteSupabase("renaissance_niveaux?select=id,niveau,credits,elements&order=niveau");
}

// ===== Données de départ (catalogue + renaissance) =====
// Sourcées du tracker communautaire open-source « Droidex »
// (github.com/erikpeik/droidex, src/data/droids.ts et rebirths.ts) — PAS des
// données officielles Epic Games. Ne servent plus qu'à amorcer un nouveau
// catalogue vide depuis le panneau admin ; les vraies données vivent dans
// Supabase (voir chargerCatalogueSupabase() ci-dessus).
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
  { id: "id10", nom: "ID10", classe: "Combat", rarete: "Typique" }
];

const RENAISSANCE_INITIALE = [
  { id: "niveau-1", niveau: 1, credits: 10000, elements: "CB (Défaut), Pit (Défaut), DRK-1 Probe (Défaut)" }
];

// Paliers d'amélioration possibles pour un droïde possédé, du plus faible au
// plus fort. Donnée de départ uniquement : la vraie liste vit dans la table
// paliers (partagée, éditable depuis admin.html — ajout/suppression/
// réordonnancement, avec une couleur par palier qui teinte le contour des
// cartes du Droidex).
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

// Types de droïde (Ouvrier/Astromec/Combat...) : point de départ pour
// l'amorçage de la table classes (partagée, éditable dans l'onglet « Types »
// du panneau admin — ex. ajouter « Espion » si le jeu introduit une nouvelle
// classe). Chaque type porte son icône (un émoji), affichée sur les cartes
// tant qu'aucune image ne lui est ajoutée.
const CLASSES_INITIALES = [
  { nom: "Ouvrier", icone: "\u{1F527}" },
  { nom: "Astromec", icone: "\u{1F4E1}" },
  { nom: "Combat", icone: "⚔️" }
];

// Variable globale, comme raretes/unites : réassignée par suivi.js/admin.js
// une fois la table classes chargée, lue telle quelle par iconeClasse() ci-dessus
// et par le reste du code partagé (filtres, escouade...).
let classes = CLASSES_INITIALES;

// Une entrée incomplète reçoit l'icône de départ du même nom, ou un repli
// générique — même logique que normaliserRaretes().
function normaliserClasses(brutes) {
  const liste = (Array.isArray(brutes) ? brutes : [])
    .filter((c) => c && String(c.nom || "").trim());
  if (!liste.length) return CLASSES_INITIALES.slice();
  return liste.map((c) => {
    const nom = String(c.nom).trim();
    const defaut = CLASSES_INITIALES.find((d) => d.nom === nom) || {};
    const entree = { nom, icone: c.icone || defaut.icone || "\u{1F916}" };
    if (c.image) entree.image = String(c.image).trim();
    return entree;
  });
}

// Remplit un <select> avec les classes connues, en gardant la valeur choisie
// si elle existe encore — même convention que remplirSelectRaretes().
function remplirSelectClasses(select, valeur, libelleVide) {
  if (!select) return;
  const choisi = valeur !== undefined ? valeur : select.value;
  select.innerHTML =
    (libelleVide ? '<option value="">' + libelleVide + "</option>" : "") +
    classes.map((c) => '<option value="' + c.nom.replace(/"/g, "&quot;") + '">' +
      c.icone + " " + c.nom + "</option>").join("");
  if (choisi && classes.some((c) => c.nom === choisi)) select.value = choisi;
}

// Reconnaît l'ancienne forme (tableau de chaînes, avant l'ajout d'une
// couleur par palier) et la convertit à la volée.
function normaliserPaliers(bruts) {
  return (Array.isArray(bruts) ? bruts : []).map((p) => {
    if (typeof p === "string") return { nom: p, couleur: null };
    // couleur peut être une chaîne (une teinte) ou un tableau (un dégradé).
    const couleurs = couleursPalier(p && p.couleur);
    return { nom: p.nom, couleur: couleurs.length > 1 ? couleurs : (couleurs[0] || null) };
  });
}

// ===== Fusions =====
//
// Une recette de fusion combine trois droïdes (avec quantités) pour obtenir
// un droïde SPÉCIAL — un résultat qui n'existe pas dans le catalogue normal.
// La recette porte donc elle-même les champs d'un droïde (nom, classe,
// rareté, image facultative), ce qui permet de réutiliser la carte du Droidex
// pour l'afficher, plus la liste de ses ingrédients.
//
//   { id, nom: "WHL-EX", classe: "Ouvrier", rarete: "Rare",
//     ingredients: [ { nom: "Mouse", quantite: 2 }, { nom: "ARG", quantite: 1 } ] }
//
// Partagé (table fusions), éditable depuis admin.html comme le reste.
const FUSIONS_INITIALES = [];

// Rang d'une rareté : sa position dans la liste des raretés (du plus faible au
// plus fort). Une rareté inconnue passe en dernier. Partagé (tri du catalogue).
function rangRarete(nom) {
  const i = raretes.findIndex((r) => r.nom === nom);
  return i === -1 ? raretes.length : i;
}

// Tri STABLE du catalogue par rareté (faible -> fort). Aucune clé secondaire
// (surtout pas le nom) : l'ordre du jeu, saisi à la main, est ainsi conservé au
// sein d'une même rareté — c'est ce que le tri « par rareté puis par nom »
// cassait. Un droïde ajouté rejoint donc son groupe de rareté au lieu de tomber
// en fin de liste.
function trierCatalogueParRarete(liste) {
  return (Array.isArray(liste) ? liste.slice() : [])
    .sort((a, b) => rangRarete(a.rarete) - rangRarete(b.rarete));
}

// Retrouve un droïde du catalogue par son NOM (les ingrédients ET le résultat
// d'une fusion référencent les droïdes par nom, comme le champ « elements » des
// renaissances).
function droideParNom(nom) {
  const cible = String(nom || "").trim().toLowerCase();
  return catalogue.find((d) => d.nom.toLowerCase() === cible) || null;
}

// ----- Résultat d'une fusion : un droïde DU CATALOGUE -----
// La recette référence le résultat par son nom (champ « resultat »). On tolère
// l'ancienne forme, où le résultat était décrit à part dans la recette
// (nom/classe/rarete) : ces champs servent alors de repli si le droïde n'est
// pas (encore) dans le catalogue.
function nomResultatFusion(f) {
  return (f && (f.resultat || f.nom)) || "";
}
function droideResultatFusion(f) {
  return droideParNom(nomResultatFusion(f));
}
function rareteResultatFusion(f) {
  const d = droideResultatFusion(f);
  if (d) return d.rarete;
  return (f && f.rarete) || "";
}

// Un droïde du catalogue est-il le RÉSULTAT d'une fusion ? Sert à l'étiqueter
// et à le filtrer dans le Droidex. S'appuie sur la liste des fusions chargée
// par la page ; tolère son absence (pages qui ne la chargent pas).
function estDroideFusion(nom) {
  const liste = (typeof fusions !== "undefined" && Array.isArray(fusions)) ? fusions : [];
  const cible = String(nom || "").trim().toLowerCase();
  if (!cible) return false;
  return liste.some((f) => nomResultatFusion(f).toLowerCase() === cible);
}

function normaliserIngredients(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : [])
    .map((i) => ({
      nom: String(i && i.nom || "").trim(),
      quantite: Math.max(1, Math.round(Number(i && i.quantite) || 1))
    }))
    .filter((i) => i.nom);
}

// Nombre total de droïdes consommés (somme des quantités) — le jeu en demande
// trois, on l'affiche pour repérer une recette incomplète d'un coup d'œil.
function totalDroidesFusion(f) {
  return normaliserIngredients(f && f.ingredients).reduce((n, i) => n + i.quantite, 0);
}
