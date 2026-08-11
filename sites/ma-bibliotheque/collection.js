// ===== Ma Bibliothèque — logique de la collection =====
const token = exigerConnexion(); // redirige vers connexion.html si absent

let livres = [];
let shaLivres = null;
let livreEnEdition = null;      // id du livre en cours d'édition, ou null si ajout
let tomesPossedesEdition = [];  // tomes cochés dans le formulaire ouvert
let dataUrlImageEnMemoire = null; // nouvelle couverture choisie, en attente d'envoi
let imageSupprimee = false;
const cacheImages = new Map(); // chemin GitHub -> URL locale (blob:)

if (token) {
  chargerCollection();
}

// ===== Chargement =====
async function chargerCollection() {
  try {
    const { contenu, sha } = await lireFichierJSON("livres.json", token);
    livres = Array.isArray(contenu) ? contenu : (Array.isArray(contenu.livres) ? contenu.livres : []);
    shaLivres = sha;
  } catch (e) {
    if (e.status === 404) {
      livres = [];
      shaLivres = null;
    } else {
      document.getElementById("chargement").innerHTML =
        `<p style="color:var(--danger);text-align:center">${echapperHTML(e.message)}</p>`;
      return;
    }
  }
  document.getElementById("chargement").style.display = "none";
  afficherLivres();

  // Ne bloque pas l'affichage : tourne après coup, en silence.
  rafraichirTotauxTomesEnArrierePlan();
}

// ===== Mise à jour automatique du nombre de tomes des séries =====
// À l'arrivée sur la bibliothèque : recherche en ligne, pour CHAQUE livre
// (qu'il ait été ajouté par scan ou saisi à la main), si un total de tomes
// plus élevé est maintenant connu (utile pour les séries en cours, dont de
// nouveaux tomes sortent avec le temps — cf. Wikidata/AniList dans
// rechercherTotalTomesSerie). Ne diminue jamais un total existant, ne
// bloque jamais l'interface, et n'écrit sur GitHub qu'une seule fois à la
// fin, seulement si au moins un total a effectivement changé.
async function rafraichirTotauxTomesEnArrierePlan() {
  const aVerifier = livres.filter(l => l.titre);
  if (aVerifier.length === 0) return;

  const resultats = await Promise.all(aVerifier.map(l =>
    rechercherTotalTomesSerie(l.titre).catch(() => null)
  ));

  let modifie = false;
  resultats.forEach((resultat, i) => {
    const livre = aVerifier[i];
    const totalConnu = resultat && resultat.volumes;
    if (totalConnu && totalConnu > (livre.tomesTotal || 1)) {
      livre.tomesTotal = totalConnu;
      modifie = true;
    }
  });

  if (!modifie) return;

  try {
    await sauvegarderCollectionAvecRetry();
  } catch (e) {
    return; // on retentera au prochain chargement de la page
  }

  afficherLivres();
  afficherToast("Nombre de tomes mis à jour pour au moins une série.");
}

// ===== Affichage de la liste =====
function afficherLivres() {
  const recherche = (document.getElementById("champRecherche").value || "").trim().toLowerCase();
  const filtres = livres
    .filter(l => !recherche
      || (l.titre || "").toLowerCase().includes(recherche)
      || (l.auteur || "").toLowerCase().includes(recherche))
    .sort((a, b) => (a.titre || "").localeCompare(b.titre || "", "fr", { sensitivity: "base" }));

  const grille = document.getElementById("grilleLivres");
  const etatVide = document.getElementById("etatVide");

  if (filtres.length === 0) {
    grille.style.display = "none";
    grille.innerHTML = "";
    etatVide.style.display = "block";
    document.getElementById("etatVideTitre").textContent =
      livres.length === 0 ? "Aucun livre pour l'instant" : "Aucun résultat";
    etatVide.querySelector("p").textContent =
      livres.length === 0 ? "Touche le bouton + pour ajouter ton premier livre." : "Essaie un autre terme de recherche.";
    return;
  }

  etatVide.style.display = "none";
  grille.style.display = "grid";
  grille.innerHTML = filtres.map(carteLivreHTML).join("");

  filtres.forEach(l => { if (l.image) chargerImageCarte(l.id, l.image); });
}

function carteLivreHTML(l) {
  const total = Math.max(1, l.tomesTotal || 1);
  const possedes = Array.isArray(l.tomesPossedes) ? l.tomesPossedes.length : 0;
  const pourcentage = Math.min(100, Math.round((possedes / total) * 100));
  const complet = possedes >= total;
  return `
    <button class="carte-livre" onclick="ouvrirFormulaire('${l.id}')">
      <div class="couv-livre" id="couv-${l.id}">${iconePlaceholderCouverture()}</div>
      <div class="info-livre">
        <h3>${echapperHTML(l.titre || "Sans titre")}</h3>
        <p class="auteur">${echapperHTML(l.auteur || "")}</p>
        <div class="progression${complet ? ' badge-complet' : ''}">
          <div class="barre-progression"><span style="width:${pourcentage}%"></span></div>
          <small>${possedes}/${total}</small>
        </div>
      </div>
    </button>`;
}

function iconePlaceholderCouverture() {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
}

function echapperHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

async function chargerImageCarte(id, chemin) {
  try {
    const url = await obtenirUrlImageCache(chemin);
    const el = document.getElementById(`couv-${id}`);
    if (el) el.innerHTML = `<img src="${url}" alt="">`;
  } catch (e) { /* on garde le pictogramme par défaut */ }
}

async function obtenirUrlImageCache(chemin) {
  if (cacheImages.has(chemin)) return cacheImages.get(chemin);
  const url = await obtenirUrlImage(chemin, token);
  cacheImages.set(chemin, url);
  return url;
}

// ===== Menu « Ajouter un livre » =====
function ouvrirMenuAjout() {
  document.getElementById("voileMenuAjout").classList.add("ouvert");
}
function fermerMenuAjout() {
  document.getElementById("voileMenuAjout").classList.remove("ouvert");
}
function ouvrirFormulaireManuel() {
  fermerMenuAjout();
  ouvrirFormulaire();
}

// ===== Scan de code-barres =====
// Bibliothèque de lecture de code-barres chargée à la demande seulement
// (pas de poids supplémentaire pour qui n'utilise jamais le scan).
function chargerScriptScanner() {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger le lecteur de code-barres (vérifie ta connexion)."));
    document.head.appendChild(script);
  });
}

let instanceScanner = null;
let verrouTraitementScan = false;

async function demarrerScan() {
  fermerMenuAjout();
  verrouTraitementScan = false;

  const overlay = document.getElementById("scannerOverlay");
  const statut = document.getElementById("scannerStatut");
  overlay.style.display = "flex";
  statut.textContent = "Chargement du lecteur...";

  try {
    await chargerScriptScanner();
  } catch (e) {
    overlay.style.display = "none";
    afficherToast(e.message, true);
    return;
  }

  statut.textContent = "Vise le code-barres du livre";

  try {
    instanceScanner = new Html5Qrcode("lecteurVideo", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A
      ]
    });
    await instanceScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      (codeDecode) => traiterCodeScanne(codeDecode),
      () => { /* pas de code détecté sur cette frame : normal, on ignore */ }
    );
  } catch (e) {
    overlay.style.display = "none";
    afficherToast("Impossible d'accéder à la caméra. Vérifie les autorisations.", true);
  }
}

async function arreterScan() {
  document.getElementById("scannerOverlay").style.display = "none";
  if (instanceScanner) {
    const s = instanceScanner;
    instanceScanner = null;
    try { await s.stop(); s.clear(); } catch (e) { /* déjà arrêté */ }
  }
}

// ===== Recherche d'un livre à partir de son code-barres (ISBN/EAN) =====
// Trois sources interrogées EN PARALLÈLE (pas l'une après l'autre, pour ne
// pas cumuler les délais) puis combinées :
//  - BnF (Bibliothèque nationale de France) : très fiable pour le texte
//    (titre/auteur) des livres publiés en France, aucune limite de quota,
//    mais ne fournit jamais de couverture.
//  - Google Books : bonnes couvertures quand disponible, mais quota anonyme
//    PARTAGÉ mondialement (peut échouer sans rapport avec ton usage — voir
//    CLE_GOOGLE_BOOKS dans script.js pour le rendre fiable).
//  - Open Library : complément, couvertures parfois disponibles aussi.
async function rechercherLivreParCodeBarres(code) {
  const [bnf, google, openLib] = await Promise.all([
    rechercherBnF(code).catch(() => null),
    rechercherGoogleBooks(code).catch(() => null),
    rechercherOpenLibrary(code).catch(() => null)
  ]);

  // Texte : la BnF est la référence pour les éditions françaises ; sinon on
  // prend ce qu'on a.
  const source = bnf || google || openLib;
  if (!source) return null;

  const imageUrl = (google && google.imageUrl) || (openLib && openLib.imageUrl) || null;

  return { titre: source.titre, auteur: source.auteur, imageUrl };
}

async function rechercherGoogleBooks(code) {
  let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}`;
  if (CLE_GOOGLE_BOOKS) url += `&key=${encodeURIComponent(CLE_GOOGLE_BOOKS)}`;
  const r = await fetch(url);
  if (!r.ok) return null; // inclut le 429 de quota, silencieux : les autres sources prennent le relais
  const data = await r.json();
  const vi = data.items && data.items[0] && data.items[0].volumeInfo;
  if (!vi || !vi.title) return null;
  let imageUrl = vi.imageLinks && (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail);
  if (imageUrl) imageUrl = imageUrl.replace(/^http:/, "https:").replace(/&edge=curl/, "");
  return {
    titre: vi.subtitle ? `${vi.title} ${vi.subtitle}` : vi.title,
    auteur: (vi.authors || []).join(", "),
    imageUrl: imageUrl || null
  };
}

async function rechercherOpenLibrary(code) {
  const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(code)}&format=json&jscmd=data`);
  if (!r.ok) return null;
  const data = await r.json();
  const item = data[`ISBN:${code}`];
  if (!item || !item.title) return null;
  return {
    titre: item.title,
    auteur: (item.authors || []).map(a => a.name).join(", "),
    imageUrl: item.cover ? (item.cover.large || item.cover.medium || item.cover.small) : null
  };
}

// Pour les mangas/BD en série, la BnF ne met PAS le numéro de tome dans le
// titre (qui est souvent le titre propre du tome, ex. "L'instinct") mais
// dans un champ séparé au format "Collection : <série> ; <numéro>". Repéré
// en testant le tome 14 de One Piece (titre BnF "L'instinct", sans aucune
// mention de tome). Quand ce champ existe, on reconstruit un titre
// "<série>, Tome <numéro>" pour que extraireNumeroTome() (partagé avec les
// autres sources) le détecte normalement.
const REGEX_COLLECTION_BNF = /^Collection\s*:\s*(.+?)\s*;\s*(\d+)\s*$/i;

async function rechercherBnF(code) {
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.ean+all+%22${encodeURIComponent(code)}%22&recordSchema=dublincore&maximumRecords=1`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const texte = await r.text();
  const doc = new DOMParser().parseFromString(texte, "application/xml");
  const titreBrut = doc.getElementsByTagName("dc:title")[0] ? doc.getElementsByTagName("dc:title")[0].textContent : "";
  const auteurBrut = doc.getElementsByTagName("dc:creator")[0] ? doc.getElementsByTagName("dc:creator")[0].textContent : "";
  if (!titreBrut) return null;

  let titre = nettoyerTitreBnF(titreBrut);
  const descriptions = Array.from(doc.getElementsByTagName("dc:description"));
  for (const d of descriptions) {
    const m = REGEX_COLLECTION_BNF.exec((d.textContent || "").trim());
    if (m) { titre = `${m[1].trim()}, Tome ${m[2]}`; break; }
  }

  return { titre, auteur: nettoyerAuteurBnF(auteurBrut), imageUrl: null };
}

// « Le petit prince / Antoine de Saint-Exupéry ; avec des aquarelles... »
// -> « Le petit prince » (la BnF fait suivre le titre de mentions d'auteur
// après un « / », qu'on retire pour ne garder que le titre).
function nettoyerTitreBnF(brut) {
  if (!brut) return "";
  const idx = brut.indexOf(" / ");
  return (idx === -1 ? brut : brut.slice(0, idx)).trim();
}

// « Saint-Exupéry, Antoine de (1900-1944). Auteur du texte » -> « Antoine de
// Saint-Exupéry » (la BnF utilise la notice d'autorité : "Nom, Prénom
// (dates). Rôle" ; on retire le rôle et les dates, puis on réordonne).
function nettoyerAuteurBnF(brut) {
  if (!brut) return "";
  let s = brut.replace(/\.\s*[^,()]+$/, "").trim();
  s = s.replace(/\s*\([^)]*\)/g, "").trim();
  const virgule = s.indexOf(",");
  if (virgule !== -1) {
    const nom = s.slice(0, virgule).trim();
    const prenom = s.slice(virgule + 1).trim();
    if (prenom) s = `${prenom} ${nom}`;
  }
  return s;
}

// Détecte un numéro de tome dans un titre ("Tome 12", "T.12", "Vol. 12", "#12", …)
// et renvoie le titre « nu » de la série à côté.
function extraireNumeroTome(titre) {
  if (!titre) return { baseTitre: titre, tome: null };
  const regex = /^(.*?)[,:\-–]?\s*(?:tome|t\.?|vol\.?|volume|#)\s*0*(\d{1,4})\b.*$/i;
  const m = regex.exec(titre.trim());
  if (m && m[1].trim()) {
    return { baseTitre: m[1].replace(/[,:\-–]\s*$/, "").trim(), tome: parseInt(m[2], 10) };
  }
  return { baseTitre: titre.trim(), tome: null };
}

function normaliserTitre(s) {
  // Décompose les accents (NFD) puis retire les marques diacritiques
  // combinées (plage Unicode 0x0300–0x036F), sans dépendre d'un échappement
  // regex \uXXXX pour éviter toute ambiguïté d'encodage.
  let sansAccents = "";
  for (const car of (s || "").normalize("NFD")) {
    const code = car.codePointAt(0);
    if (code >= 0x0300 && code <= 0x036f) continue;
    sansAccents += car;
  }
  return sansAccents.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function trouverLivreParTitre(titre) {
  const cible = normaliserTitre(titre);
  if (!cible) return null;
  return livres.find(l => normaliserTitre(l.titre) === cible) || null;
}

// Récupère une image distante et la fait passer par le même pipeline de
// compression que les photos prises sur le téléphone.
async function recupererImageExterneEnDataUrl(url) {
  const reponse = await fetch(url, { mode: "cors" });
  if (!reponse.ok) throw new Error("Image distante inaccessible.");
  const blob = await reponse.blob();
  return comprimerImage(blob);
}

// Nombre total de tomes d'une série manga + couverture de secours, combiné
// depuis deux sources gratuites interrogées en parallèle :
//  - AniList : fiable seulement pour les séries TERMINÉES (son champ
//    "volumes" ne connaît pas de total pour une série encore en cours,
//    ex. One Piece — reste alors null, ce n'est pas une erreur).
//  - Wikidata : propriété P2635 ("nombre de parties de cette œuvre"),
//    entretenue par la communauté même pour les séries en cours (One
//    Piece -> 111, à jour). Complète justement le trou laissé par AniList.
// On garde le plus grand des deux nombres trouvés.
async function rechercherAniList(nomSerie) {
  if (!nomSerie) return null;
  const requete = `query($s:String){ Page(page:1, perPage:1) { media(search:$s, type:MANGA, sort:POPULARITY_DESC) { volumes status coverImage { large } } } }`;
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query: requete, variables: { s: nomSerie } })
  });
  if (!r.ok) return null;
  const data = await r.json();
  const media = data.data && data.data.Page && data.data.Page.media && data.data.Page.media[0];
  if (!media) return null;
  return { volumes: media.volumes || null, imageUrl: (media.coverImage && media.coverImage.large) || null };
}

function echapperChaineSparql(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Q21198342 = « manga series » sur Wikidata : on restreint la recherche à ce
// type (et ses sous-types) pour ne pas confondre avec l'anime, un jeu vidéo
// ou tout autre item homonyme du même univers (une franchise comme One
// Piece a des dizaines d'items Wikidata distincts portant le même nom).
async function rechercherWikidataTomes(nomSerie) {
  if (!nomSerie) return null;
  const nom = echapperChaineSparql(nomSerie);
  const sparql = `SELECT ?value WHERE {
    VALUES ?label { "${nom}"@en "${nom}"@fr }
    ?item rdfs:label ?label.
    ?item wdt:P31 ?type.
    ?type wdt:P279* wd:Q21198342.
    ?item wdt:P2635 ?value.
  } LIMIT 1`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql));
  if (!r.ok) return null;
  const data = await r.json();
  const valeur = data.results.bindings[0] && data.results.bindings[0].value.value;
  if (!valeur) return null;
  const n = parseInt(valeur, 10);
  return Number.isFinite(n) ? n : null;
}

async function rechercherTotalTomesSerie(nomSerie) {
  const [wikidata, aniList] = await Promise.all([
    rechercherWikidataTomes(nomSerie).catch(() => null),
    rechercherAniList(nomSerie).catch(() => null)
  ]);
  const volumes = Math.max(wikidata || 0, (aniList && aniList.volumes) || 0) || null;
  const imageUrl = (aniList && aniList.imageUrl) || null;
  return { volumes, imageUrl };
}

async function traiterCodeScanne(code) {
  if (verrouTraitementScan) return; // le callback peut être rappelé plusieurs fois pour le même code
  verrouTraitementScan = true;

  const statut = document.getElementById("scannerStatut");
  if (statut) statut.textContent = `Code ${code} détecté, recherche des informations…`;

  let info = null;
  try { info = await rechercherLivreParCodeBarres(code); } catch (e) { /* on continue sans info */ }

  await arreterScan();

  if (!info) {
    afficherToast(`Aucune information trouvée pour le code ${code}. Remplis les infos manuellement.`, true);
    ouvrirFormulaire();
    return;
  }

  const { baseTitre, tome } = extraireNumeroTome(info.titre);
  const titreCible = baseTitre || info.titre;
  const existant = trouverLivreParTitre(titreCible);

  // Couverture et nombre total de tomes connu : en parallèle, et seulement
  // si un numéro de tome a été détecté (donc probablement une série).
  const [dataUrlCouverture, infoSerie] = await Promise.all([
    info.imageUrl ? recupererImageExterneEnDataUrl(info.imageUrl).catch(() => null) : Promise.resolve(null),
    tome ? rechercherTotalTomesSerie(titreCible).catch(() => null) : Promise.resolve(null)
  ]);

  let couvertureFinale = dataUrlCouverture;
  if (!couvertureFinale && infoSerie && infoSerie.imageUrl) {
    couvertureFinale = await recupererImageExterneEnDataUrl(infoSerie.imageUrl).catch(() => null);
  }
  const totalConnu = infoSerie && infoSerie.volumes ? infoSerie.volumes : null;

  if (existant) {
    ouvrirFormulaire(existant.id);
    const champTotal = document.getElementById("champTotalTomes");
    let total = parseInt(champTotal.value, 10) || 1;
    if (tome && tome > total) total = tome;
    if (totalConnu && totalConnu > total) total = totalConnu;
    champTotal.value = total;
    if (tome && !tomesPossedesEdition.includes(tome)) tomesPossedesEdition.push(tome);
    regenererGrilleTomes();
    if (couvertureFinale && !existant.image) {
      dataUrlImageEnMemoire = couvertureFinale;
      imageSupprimee = false;
      document.getElementById("apercuCouverture").innerHTML = `<img src="${couvertureFinale}" alt="">`;
      document.getElementById("boutonSupprimerImage").style.display = "block";
    }
    afficherToast(tome
      ? `Tome ${tome} détecté pour « ${existant.titre} ». Vérifie et enregistre.`
      : `« ${existant.titre} » retrouvé. Vérifie et enregistre.`);
  } else {
    ouvrirFormulaire();
    document.getElementById("champTitre").value = titreCible;
    document.getElementById("champAuteur").value = info.auteur || "";
    const totalInitial = Math.max(tome || 1, totalConnu || 0);
    document.getElementById("champTotalTomes").value = totalInitial;
    tomesPossedesEdition = tome ? [tome] : [1];
    regenererGrilleTomes();
    if (couvertureFinale) {
      dataUrlImageEnMemoire = couvertureFinale;
      imageSupprimee = false;
      document.getElementById("apercuCouverture").innerHTML = `<img src="${couvertureFinale}" alt="">`;
      document.getElementById("boutonSupprimerImage").style.display = "block";
    }
    const messageTotal = totalConnu ? ` (${totalConnu} tomes au total connus)` : "";
    afficherToast(`« ${titreCible} » trouvé${messageTotal}. Vérifie et enregistre.`);
  }
}

// ===== Formulaire d'ajout / édition =====
function ouvrirFormulaire(id) {
  livreEnEdition = id || null;
  dataUrlImageEnMemoire = null;
  imageSupprimee = false;

  const apercu = document.getElementById("apercuCouverture");
  const boutonSupprimerImage = document.getElementById("boutonSupprimerImage");
  const zoneSuppression = document.getElementById("zoneSuppression");

  if (id) {
    const l = livres.find(x => x.id === id);
    if (!l) return;
    document.getElementById("titreFormulaire").textContent = "Modifier le livre";
    document.getElementById("champTitre").value = l.titre || "";
    document.getElementById("champAuteur").value = l.auteur || "";
    document.getElementById("champTotalTomes").value = Math.max(1, l.tomesTotal || 1);
    tomesPossedesEdition = Array.isArray(l.tomesPossedes) ? [...l.tomesPossedes] : [];
    zoneSuppression.style.display = "block";
    apercu.innerHTML = iconePlaceholderCouverture();

    if (l.image) {
      boutonSupprimerImage.style.display = "block";
      obtenirUrlImageCache(l.image).then(url => {
        if (livreEnEdition === id) apercu.innerHTML = `<img src="${url}" alt="">`;
      }).catch(() => {});
    } else {
      boutonSupprimerImage.style.display = "none";
    }
  } else {
    document.getElementById("titreFormulaire").textContent = "Ajouter un livre";
    document.getElementById("champTitre").value = "";
    document.getElementById("champAuteur").value = "";
    document.getElementById("champTotalTomes").value = 1;
    tomesPossedesEdition = [];
    zoneSuppression.style.display = "none";
    boutonSupprimerImage.style.display = "none";
    apercu.innerHTML = iconePlaceholderCouverture();
  }

  regenererGrilleTomes();
  document.getElementById("voileFormulaire").classList.add("ouvert");
  document.getElementById("champTitre").focus({ preventScroll: true });
}

function fermerFormulaire() {
  document.getElementById("voileFormulaire").classList.remove("ouvert");
  livreEnEdition = null;
}

// ===== Tomes =====
function changerTotalTomes(delta) {
  const champ = document.getElementById("champTotalTomes");
  let val = (parseInt(champ.value, 10) || 1) + delta;
  if (val < 1) val = 1;
  if (val > 999) val = 999;
  champ.value = val;
  regenererGrilleTomes();
}

function regenererGrilleTomes() {
  let total = parseInt(document.getElementById("champTotalTomes").value, 10);
  if (!Number.isFinite(total) || total < 1) total = 1;
  if (total > 999) total = 999;
  document.getElementById("champTotalTomes").value = total;

  tomesPossedesEdition = tomesPossedesEdition.filter(n => n <= total);

  let html = "";
  for (let i = 1; i <= total; i++) {
    const possede = tomesPossedesEdition.includes(i);
    html += `<button type="button" class="case-tome${possede ? ' possede' : ''}" onclick="basculerTome(${i})">${i}</button>`;
  }
  document.getElementById("grilleTomes").innerHTML = html;
}

function basculerTome(n) {
  const idx = tomesPossedesEdition.indexOf(n);
  if (idx === -1) tomesPossedesEdition.push(n); else tomesPossedesEdition.splice(idx, 1);
  regenererGrilleTomes();
}

function cocherTousLesTomes(etat) {
  const total = parseInt(document.getElementById("champTotalTomes").value, 10) || 1;
  tomesPossedesEdition = etat ? Array.from({ length: total }, (_, i) => i + 1) : [];
  regenererGrilleTomes();
}

// ===== Couverture =====
function declencherChoixImage(source) {
  document.getElementById(source === "camera" ? "champImageCamera" : "champImageGalerie").click();
}

async function imageChoisie(event) {
  const fichier = event.target.files[0];
  event.target.value = ""; // permet de reprendre exactement la même photo ensuite
  if (!fichier) return;
  try {
    const dataUrl = await comprimerImage(fichier);
    dataUrlImageEnMemoire = dataUrl;
    imageSupprimee = false;
    document.getElementById("apercuCouverture").innerHTML = `<img src="${dataUrl}" alt="">`;
    document.getElementById("boutonSupprimerImage").style.display = "block";
  } catch (e) {
    afficherToast("Impossible de charger cette image.", true);
  }
}

function retirerImage() {
  dataUrlImageEnMemoire = null;
  imageSupprimee = true;
  document.getElementById("apercuCouverture").innerHTML = iconePlaceholderCouverture();
  document.getElementById("boutonSupprimerImage").style.display = "none";
}

// Redimensionne côté client avant envoi : les photos prises au téléphone
// peuvent peser plusieurs Mo, on les ramène à une taille raisonnable en JPEG.
function comprimerImage(fichier, maxDim = 900, quality = 0.82) {
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
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

// ===== Enregistrement =====
function genererIdLivre() {
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function sauvegarderCollectionAvecRetry() {
  try {
    shaLivres = await ecrireFichierJSON("livres.json", livres, shaLivres, token, "Mise à jour de la collection");
  } catch (e) {
    if (e.conflit) {
      // Le fichier distant a bougé entre-temps (autre appareil) : on relit son
      // SHA à jour et on retente l'écriture avec notre version locale.
      const frais = await lireFichierJSON("livres.json", token);
      shaLivres = await ecrireFichierJSON("livres.json", livres, frais.sha, token, "Mise à jour de la collection");
    } else {
      throw e;
    }
  }
}

async function enregistrerLivre() {
  const titre = document.getElementById("champTitre").value.trim();
  if (!titre) { afficherToast("Le titre est obligatoire.", true); return; }

  const total = Math.max(1, parseInt(document.getElementById("champTotalTomes").value, 10) || 1);
  const auteur = document.getElementById("champAuteur").value.trim();
  const possedes = tomesPossedesEdition.filter(n => n >= 1 && n <= total).sort((a, b) => a - b);

  const bouton = document.getElementById("boutonEnregistrer");
  bouton.disabled = true;
  bouton.textContent = "Enregistrement...";

  const estNouveau = !livreEnEdition;
  const id = livreEnEdition || genererIdLivre();
  const livreExistant = estNouveau ? null : livres.find(l => l.id === id);
  const ancienChemin = livreExistant ? livreExistant.image : null;
  let cheminImage = ancienChemin || null;

  try {
    if (dataUrlImageEnMemoire) {
      cheminImage = `images/${id}.jpg`;
      await uploaderImageBase64(cheminImage, dataUrlImageEnMemoire, token, `Couverture — ${titre}`);
    } else if (imageSupprimee) {
      cheminImage = null;
    }

    const donnees = {
      id,
      titre,
      auteur,
      tomesTotal: total,
      tomesPossedes: possedes,
      image: cheminImage,
      dateAjout: livreExistant ? livreExistant.dateAjout : new Date().toISOString(),
      dateModif: new Date().toISOString()
    };

    if (estNouveau) {
      livres.push(donnees);
    } else {
      livres[livres.findIndex(l => l.id === id)] = donnees;
    }

    await sauvegarderCollectionAvecRetry();

    // Nettoyage de l'ancienne couverture si elle a été remplacée ou retirée
    // (après coup, sans bloquer : la collection est déjà à jour côté utilisateur).
    if (ancienChemin && ancienChemin !== cheminImage) {
      supprimerFichierGithub(ancienChemin, token, "Remplacement de la couverture").catch(() => {});
      cacheImages.delete(ancienChemin);
    }
    if (cheminImage) cacheImages.delete(cheminImage); // forcer le rechargement de la nouvelle couverture

    fermerFormulaire();
    afficherLivres();
    afficherToast(estNouveau ? "Livre ajouté." : "Livre mis à jour.");
  } catch (e) {
    afficherToast(e.message || "Échec de l'enregistrement.", true);
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Enregistrer";
  }
}

async function supprimerLivreCourant() {
  if (!livreEnEdition) return;
  if (!confirm("Supprimer définitivement ce livre ?")) return;

  const bouton = document.getElementById("boutonEnregistrer");
  bouton.disabled = true;

  try {
    const livre = livres.find(l => l.id === livreEnEdition);
    livres = livres.filter(l => l.id !== livreEnEdition);
    await sauvegarderCollectionAvecRetry();

    if (livre && livre.image) {
      supprimerFichierGithub(livre.image, token, "Suppression d'un livre").catch(() => {});
      cacheImages.delete(livre.image);
    }

    fermerFormulaire();
    afficherLivres();
    afficherToast("Livre supprimé.");
  } catch (e) {
    afficherToast(e.message || "Échec de la suppression.", true);
  } finally {
    bouton.disabled = false;
  }
}

// ===== Toast =====
let minuteurToast = null;
function afficherToast(message, estErreur) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("erreur", !!estErreur);
  toast.classList.add("visible");
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => toast.classList.remove("visible"), 3200);
}
