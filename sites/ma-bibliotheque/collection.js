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
//
// Limité à une fois par jour (au lieu de systématiquement à chaque
// ouverture) : signalé comme cause de lenteur — avec ne serait-ce qu'une
// vingtaine de livres, ça fait 2 requêtes (Wikidata + AniList) par livre,
// en concurrence avec le chargement des couvertures. Le nombre de tomes
// d'une série ne change de toute façon pas plus d'une fois toutes les
// quelques semaines, une vérification quotidienne suffit largement.
const DELAI_RAFRAICHISSEMENT_TOMES_MS = 20 * 60 * 60 * 1000; // ~20h
async function rafraichirTotauxTomesEnArrierePlan() {
  try {
    const dernier = parseInt(localStorage.getItem("mb_dernierRafraichissementTomes") || "0", 10);
    if (Date.now() - dernier < DELAI_RAFRAICHISSEMENT_TOMES_MS) return;
  } catch (e) { /* localStorage indisponible : on rafraîchit sans throttle */ }

  const aVerifier = livres.filter(l => l.titre);
  if (aVerifier.length === 0) return;

  try { localStorage.setItem("mb_dernierRafraichissementTomes", String(Date.now())); } catch (e) {}

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

  configurerChargementParesseuxImages(filtres);
}

// Ne charge la couverture (appel réseau authentifié vers l'API GitHub) que
// des livres visibles à l'écran, pas de toute la bibliothèque d'un coup —
// signalé comme cause de lenteur sur une bibliothèque avec pas mal de
// livres. Le reste se charge au fil du défilement.
let observateurImages = null;
function configurerChargementParesseuxImages(filtres) {
  if (observateurImages) observateurImages.disconnect();

  const parId = new Map(filtres.map(l => [l.id, l]));
  observateurImages = new IntersectionObserver((entrees) => {
    entrees.forEach((entree) => {
      if (!entree.isIntersecting) return;
      observateurImages.unobserve(entree.target);
      const livre = parId.get(entree.target.dataset.livreId);
      if (livre && livre.image) chargerImageCarte(livre.id, livre.image);
    });
  }, { rootMargin: "400px" }); // charge un peu avant d'arriver à l'écran, pas de "pop" visible

  filtres.forEach((l) => {
    if (!l.image) return;
    const el = document.getElementById(`couv-${l.id}`);
    if (!el) return;
    el.dataset.livreId = l.id;
    observateurImages.observe(el);
  });
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

// ===== Scan de code-barres (à partir d'une photo, pas en direct) =====
// Une seule photo à prendre — plus besoin de tenir le téléphone immobile en
// visant le code-barres en direct. Bibliothèque de lecture chargée à la
// demande seulement (pas de poids supplémentaire pour qui n'utilise jamais
// le scan).
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

// Élément technique requis par la bibliothèque pour le décodage de fichier
// (jamais affiché : on ne montre pas l'image, seul le résultat nous importe).
function obtenirElementScannerCache() {
  let el = document.getElementById("lecteurPhotoCodeBarre");
  if (!el) {
    el = document.createElement("div");
    el.id = "lecteurPhotoCodeBarre";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el;
}

function declencherPhotoCodeBarre() {
  fermerMenuAjout();
  document.getElementById("champPhotoCodeBarre").click();
}

async function traiterPhotoCodeBarre(event) {
  const fichier = event.target.files[0];
  event.target.value = "";
  if (!fichier) return;

  afficherToast("Lecture du code-barres…");

  try {
    await chargerScriptScanner();
    const instance = new Html5Qrcode(obtenirElementScannerCache().id, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A
      ]
    });
    const code = await instance.scanFile(fichier, false);
    try { instance.clear(); } catch (e) {}
    traiterCodeScanne(code);
  } catch (e) {
    afficherToast("Code-barres illisible sur cette photo. Réessaie avec plus de lumière et de netteté, ou utilise la recherche par titre.", true);
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
// et renvoie le titre « nu » de la série à côté. \b avant les mots-clés (pas
// avant "#", un symbole n'a pas cette notion) pour ne pas couper au milieu
// d'un mot : sans ça, "Fahrenheit 451" était lu comme le "t" de "T." suivi
// de 451, donnant baseTitre="Fahrenhei" — un vrai bug, pas juste un cas
// théorique.
function extraireNumeroTome(titre) {
  if (!titre) return { baseTitre: titre, tome: null };
  const t = titre.trim();

  const regexMotCle = /^(.*?)[,:\-–]?\s*(?:\b(?:tome|t\.?|vol\.?|volume)|#)\s*0*(\d{1,4})\b.*$/i;
  let m = regexMotCle.exec(t);
  if (m && m[1].trim()) {
    return { baseTitre: m[1].replace(/[.,:\-–]\s*$/, "").trim(), tome: parseInt(m[2], 10) };
  }

  // Repli : point ou virgule suivi directement du numéro, sans mot-clé, en
  // toute fin de titre (ex. "One Piece. 56" — convention BnF pour certains
  // tomes, vue en pratique). La ponctuation explicite rend ce motif sûr sans
  // garde-fou supplémentaire : contrairement à un simple espace, un titre
  // qui se termine légitimement par un nombre n'est normalement pas suivi
  // d'un point ou d'une virgule juste avant ("Fahrenheit 451", pas
  // "Fahrenheit. 451").
  const regexPonctuation = /^(.+?)[.,]\s*0*(\d{1,4})$/;
  m = regexPonctuation.exec(t);
  if (m && m[1].trim()) {
    return { baseTitre: m[1].trim(), tome: parseInt(m[2], 10) };
  }

  return { baseTitre: t, tome: null };
}

// Repli pour les résultats de recherche qui donnent juste "Titre N" sans
// mot-clé (ex. "ONE PIECE 2" chez Open Library, au lieu de "One Piece,
// Tome 2") : extraireNumeroTome() seul ne détecte rien, créant un doublon
// "ONE PIECE 2" à côté de la série "One Piece" existante au lieu d'y
// ajouter le tome 2 — bug reproduit et corrigé ici. On ne traite le nombre
// final comme un tome que si le titre sans ce nombre correspond à une
// série DÉJÀ dans la bibliothèque : ça élimine le risque de couper à tort
// un titre qui se termine légitimement par un nombre (ex. "Fahrenheit
// 451", jamais dans la bibliothèque sous le nom "Fahrenheit").
function extraireNumeroTomeAvecRepliBibliotheque(titreBrut) {
  const direct = extraireNumeroTome(titreBrut);
  if (direct.tome) return direct;

  const m = /^(.+?)\s+0*(\d{1,3})$/.exec((titreBrut || "").trim());
  if (!m) return direct;
  const candidatBase = m[1].trim();
  if (trouverLivreParTitre(candidatBase)) {
    return { baseTitre: candidatBase, tome: parseInt(m[2], 10) };
  }
  return direct;
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
  let info = null;
  try { info = await rechercherLivreParCodeBarres(code); } catch (e) { /* on continue sans info */ }

  if (!info) {
    afficherToast(`Aucune information trouvée pour le code ${code}. Remplis les infos manuellement.`, true);
    ouvrirFormulaire();
    return;
  }

  await appliquerLivreTrouve(info);
}

// ===== Recherche d'un livre par titre (texte tapé) =====
// Trois sources interrogées en parallèle. Sert à la fois pour la recherche
// manuelle par titre ET, en repli automatique, pour compléter les infos
// manquantes (surtout la couverture) après un scan de code-barres réussi
// mais incomplet (ex. la BnF donne le texte mais jamais d'image).
async function rechercherGoogleBooksParTitre(titre, limite) {
  let url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(titre)}&maxResults=${limite}`;
  if (CLE_GOOGLE_BOOKS) url += `&key=${encodeURIComponent(CLE_GOOGLE_BOOKS)}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.items || []).map(item => {
    const vi = item.volumeInfo || {};
    let imageUrl = vi.imageLinks && (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail);
    if (imageUrl) imageUrl = imageUrl.replace(/^http:/, "https:").replace(/&edge=curl/, "");
    return {
      titre: vi.subtitle ? `${vi.title} ${vi.subtitle}` : (vi.title || titre),
      auteur: (vi.authors || []).join(", "),
      imageUrl: imageUrl || null,
      source: "Google Books"
    };
  });
}

async function rechercherOpenLibraryParTitre(titre, limite) {
  const r = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(titre)}&limit=${limite}`);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.docs || []).slice(0, limite).map(doc => ({
    titre: doc.title || titre,
    auteur: (doc.author_name || []).join(", "),
    imageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    source: "Open Library"
  }));
}

// La BnF couvre très bien les publications françaises récentes/confidentielles
// (webtoons, petits éditeurs, auto-édition...) que Google Books et Open
// Library ratent souvent (vérifié sur « Là où les étoiles filantes tombent »,
// un webtoon Kotoon : 0 résultat sur les deux autres sources, plusieurs
// tomes trouvés sur la BnF). On ne garde que les notices "texte imprimé"
// (la BnF catalogue aussi films, musique, jeux... sous le même titre).
async function rechercherBnFParTitre(titre, limite) {
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.title+all+%22${encodeURIComponent(titre)}%22&recordSchema=dublincore&maximumRecords=${limite * 3}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const texte = await r.text();
  const doc = new DOMParser().parseFromString(texte, "application/xml");
  const records = Array.from(doc.getElementsByTagName("srw:record"));
  const resultats = [];

  for (const rec of records) {
    const type = Array.from(rec.getElementsByTagName("dc:type")).map(t => t.textContent).join(" ");
    if (!/texte imprimé|printed text/i.test(type)) continue;

    const titreBrut = rec.getElementsByTagName("dc:title")[0] ? rec.getElementsByTagName("dc:title")[0].textContent : "";
    const auteurBrut = rec.getElementsByTagName("dc:creator")[0] ? rec.getElementsByTagName("dc:creator")[0].textContent : "";
    if (!titreBrut) continue;

    let titreFinal = nettoyerTitreBnF(titreBrut);
    const descriptions = Array.from(rec.getElementsByTagName("dc:description"));
    for (const d of descriptions) {
      const m = REGEX_COLLECTION_BNF.exec((d.textContent || "").trim());
      if (m) { titreFinal = `${m[1].trim()}, Tome ${m[2]}`; break; }
    }

    resultats.push({ titre: titreFinal, auteur: nettoyerAuteurBnF(auteurBrut), imageUrl: null, source: "BnF" });
    if (resultats.length >= limite) break;
  }
  return resultats;
}

// Entrelace les résultats des trois sources pour varier dès le début de
// liste, plutôt que d'afficher toute une source avant l'autre.
async function rechercherLivresParTitre(titreBrut, limite = 5) {
  // On enlève un éventuel numéro de tome tapé par l'utilisateur : Open
  // Library en particulier ne matche presque rien avec "Titre Tome N" mais
  // très bien avec le titre seul (vérifié : "One Piece Tome 14" -> 0
  // résultat, "One Piece" -> des centaines, tomes inclus dans les titres).
  const { baseTitre } = extraireNumeroTome(titreBrut);
  const titre = (baseTitre || titreBrut || "").trim();
  if (!titre) return [];

  const [google, openLib, bnf] = await Promise.all([
    rechercherGoogleBooksParTitre(titre, limite).catch(() => []),
    rechercherOpenLibraryParTitre(titre, limite).catch(() => []),
    rechercherBnFParTitre(titre, limite).catch(() => [])
  ]);

  const resultats = [];
  const max = Math.max(google.length, openLib.length, bnf.length);
  for (let i = 0; i < max && resultats.length < limite; i++) {
    if (google[i]) resultats.push(google[i]);
    if (openLib[i] && resultats.length < limite) resultats.push(openLib[i]);
    if (bnf[i] && resultats.length < limite) resultats.push(bnf[i]);
  }
  return resultats;
}

// Applique un livre trouvé (par scan OU par recherche de titre) au
// formulaire : fusionne dans une série existante ou pré-remplit une
// nouvelle fiche. Toujours ouvert pour vérification avant enregistrement —
// rien n'est jamais sauvegardé automatiquement.
async function appliquerLivreTrouve(info) {
  const { baseTitre, tome } = extraireNumeroTomeAvecRepliBibliotheque(info.titre);
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
  // Toujours pas de couverture (ex. la BnF a donné le titre mais jamais
  // d'image) : recherche complémentaire par titre pour combler ce qui
  // manque, plutôt que de laisser une fiche sans aucune couverture alors
  // qu'une autre édition du même livre en a une quelque part.
  if (!couvertureFinale) {
    try {
      const complements = await rechercherLivresParTitre(titreCible, 3);
      const avecImage = complements.find(c => c.imageUrl);
      if (avecImage) couvertureFinale = await recupererImageExterneEnDataUrl(avecImage.imageUrl).catch(() => null);
    } catch (e) { /* tant pis, la couverture restera à ajouter à la main */ }
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

// ===== Recherche par titre (feuille dédiée) =====
let resultatsRechercheCourants = [];
let dernierTitreRecherche = "";

function ouvrirRechercheTitre() {
  fermerMenuAjout();
  document.getElementById("champRechercheTitre").value = "";
  document.getElementById("resultatsRecherche").innerHTML = "";
  resultatsRechercheCourants = [];
  dernierTitreRecherche = "";
  document.getElementById("voileRechercheTitre").classList.add("ouvert");
  document.getElementById("champRechercheTitre").focus({ preventScroll: true });
}

function fermerRechercheTitre() {
  document.getElementById("voileRechercheTitre").classList.remove("ouvert");
}

async function lancerRechercheTitre() {
  const saisie = document.getElementById("champRechercheTitre").value.trim();
  if (!saisie) { afficherToast("Tape un titre.", true); return; }

  // Titre "nu" (sans numéro de tome) : sert de nom de série pour l'option
  // « toute la série » ci-dessous, qu'on tape "One Piece" ou "One Piece
  // Tome 14".
  const { baseTitre } = extraireNumeroTome(saisie);
  dernierTitreRecherche = (baseTitre || saisie).trim();

  const zone = document.getElementById("resultatsRecherche");
  zone.innerHTML = `<div class="chargement"><span class="spin"></span> Recherche en cours…</div>`;

  let resultats = [];
  try { resultats = await rechercherLivresParTitre(saisie, 6); } catch (e) { /* zone vide gérée ci-dessous */ }

  resultatsRechercheCourants = resultats;

  // Deux façons d'ajouter, à choisir : un tome précis (fusionné dans la
  // série existante si elle y est déjà) ou la série entière d'un coup (les
  // tomes possédés se cochent alors à la main dans le formulaire).
  const carteSerie = `
    <button type="button" class="resultat-recherche resultat-serie" onclick="ajouterSerieComplete()">
      <div class="resultat-couv">📚</div>
      <div class="resultat-info">
        <strong>Toute la série « ${echapperHTML(dernierTitreRecherche)} »</strong>
        <small>Tu coches ensuite toi-même les tomes possédés</small>
      </div>
    </button>`;

  if (resultats.length === 0) {
    zone.innerHTML = carteSerie + `<p class="aide-champ">Aucun tome précis trouvé pour ce titre. Vérifie l'orthographe, ajoute la série entière ci-dessus, ou ajoute le livre manuellement.</p>`;
    return;
  }

  zone.innerHTML = carteSerie + resultats.map((r, i) => `
    <button type="button" class="resultat-recherche" onclick="choisirResultatRecherche(${i})">
      <div class="resultat-couv">${r.imageUrl ? `<img src="${echapperHTML(r.imageUrl)}" alt="">` : iconePlaceholderCouverture()}</div>
      <div class="resultat-info">
        <strong>${echapperHTML(r.titre)}</strong>
        <small>${echapperHTML(r.auteur || "Auteur inconnu")} — ${echapperHTML(r.source)}</small>
      </div>
    </button>`).join("");
}

async function choisirResultatRecherche(index) {
  const choisi = resultatsRechercheCourants[index];
  if (!choisi) return;
  fermerRechercheTitre();
  afficherToast("Récupération des informations…");
  await appliquerLivreTrouve(choisi);
}

// Ajoute (ou rouvre) la série entière sans viser un tome précis : total de
// tomes pré-rempli si connu (Wikidata/AniList), mais AUCUN tome coché —
// c'est à l'utilisateur de cocher ensuite ce qu'il possède déjà.
async function ajouterSerieComplete() {
  const titreCible = dernierTitreRecherche;
  if (!titreCible) return;

  const existant = trouverLivreParTitre(titreCible);
  if (existant) {
    fermerRechercheTitre();
    ouvrirFormulaire(existant.id);
    afficherToast(`« ${existant.titre} » est déjà dans ta bibliothèque — coche les tomes que tu possèdes.`);
    return;
  }

  fermerRechercheTitre();
  afficherToast("Récupération des informations de la série…");

  // Auteur/couverture : on prend le meilleur résultat déjà en main (pas de
  // nouvelle recherche), quitte à n'avoir ni l'un ni l'autre.
  const candidat = resultatsRechercheCourants.find(r => r.imageUrl) || resultatsRechercheCourants[0] || null;
  let dataUrlCouverture = null;
  if (candidat && candidat.imageUrl) {
    dataUrlCouverture = await recupererImageExterneEnDataUrl(candidat.imageUrl).catch(() => null);
  }

  let totalConnu = null;
  try { totalConnu = (await rechercherTotalTomesSerie(titreCible)).volumes; } catch (e) { /* laissé à 1, éditable */ }

  ouvrirFormulaire();
  document.getElementById("champTitre").value = titreCible;
  document.getElementById("champAuteur").value = (candidat && candidat.auteur) || "";
  document.getElementById("champTotalTomes").value = Math.max(1, totalConnu || 1);
  tomesPossedesEdition = []; // rien de coché : choix manuel
  regenererGrilleTomes();
  if (dataUrlCouverture) {
    dataUrlImageEnMemoire = dataUrlCouverture;
    imageSupprimee = false;
    document.getElementById("apercuCouverture").innerHTML = `<img src="${dataUrlCouverture}" alt="">`;
    document.getElementById("boutonSupprimerImage").style.display = "block";
  }
  const messageTotal = totalConnu ? `${totalConnu} tomes trouvés` : "coche les tomes que tu possèdes";
  afficherToast(`« ${titreCible} » : ${messageTotal}.`);
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
