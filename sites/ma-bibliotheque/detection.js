// =====================================================================
//  Détection : retrouver un livre depuis son code-barres, une série
//  depuis son titre — avec le plus d'exactitude possible.
// =====================================================================
//
//  Ce fichier ne touche à aucune interface : il interroge, recoupe et
//  renvoie. collection.js s'occupe de l'affichage.
//
//  Le principe est le même des deux côtés : AUCUNE source n'est complète,
//  et aucune ne se trompe de la même façon que les autres. On les interroge
//  donc toutes en parallèle, on fusionne champ par champ selon qui est le
//  plus fiable POUR CE CHAMP, et l'on dit d'où vient ce qu'on affiche.
//
//  Constaté en interrogeant les API en direct, et non supposé :
//   — Google Books sans clé répond 429 en permanence : son quota anonyme est
//     mondial et saturé. Il reste appelé, mais en bonus, jamais en socle.
//   — La BnF trouve les éditions françaises que Open Library ignore, et
//     l'inverse est vrai aussi : leur union couvre bien plus que chacune.
//   — covers.openlibrary.org rend une image même quand la notice est
//     absente : c'est une source de couverture à part entière.
//   — openBD couvre les ISBN japonais (978-4…), que les autres ignorent.
//   — Wikidata par ISBN : zéro résultat. Écartée.

// ----- Le code-barres lui-même -----
//
// Ce qu'on lit au dos d'un livre n'est pas toujours ce qu'on croit. Un
// EAN-13 commençant par 978 ou 979 est un ISBN ; le petit code à cinq
// chiffres qui le suit parfois est le PRIX, et ne désigne aucun livre. Et
// les catalogues n'indexent pas tous la même forme : certains ne connaissent
// que l'ISBN-10 d'un livre publié avant 2007.

function chiffresSeuls(code) {
  return String(code || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function cleEan13(douzeChiffres) {
  let somme = 0;
  for (let i = 0; i < 12; i++) somme += Number(douzeChiffres[i]) * (i % 2 ? 3 : 1);
  return String((10 - (somme % 10)) % 10);
}

function ean13Valide(code) {
  return /^\d{13}$/.test(code) && cleEan13(code.slice(0, 12)) === code[12];
}

// ISBN-13 (978…) -> ISBN-10 : on retire le préfixe et l'on recalcule la clé,
// qui suit une tout autre règle (modulo 11, avec X pour 10).
function isbn13VersIsbn10(isbn13) {
  if (!/^978\d{10}$/.test(isbn13)) return null;
  const corps = isbn13.slice(3, 12);
  let somme = 0;
  for (let i = 0; i < 9; i++) somme += Number(corps[i]) * (10 - i);
  const reste = (11 - (somme % 11)) % 11;
  return corps + (reste === 10 ? "X" : String(reste));
}

function isbn10VersIsbn13(isbn10) {
  if (!/^\d{9}[\dX]$/.test(isbn10)) return null;
  const corps = "978" + isbn10.slice(0, 9);
  return corps + cleEan13(corps);
}

// Analyse un code scanné : ce qu'il est, et sous quelles formes l'interroger.
function analyserCodeBarres(brut) {
  const code = chiffresSeuls(brut);

  if (/^\d{5}$/.test(code)) {
    return { valide: false, raison: "prix",
      message: "Ce code à cinq chiffres est le PRIX imprimé à côté du code-barres, " +
               "pas la référence du livre. Scannez le grand code, celui qui commence par 978." };
  }
  if (/^\d{13}$/.test(code)) {
    if (!ean13Valide(code)) {
      return { valide: false, raison: "cle",
        message: "Ce code de treize chiffres a une clé de contrôle fausse : il a été mal lu. " +
                 "Reprenez la photo, plus nette et mieux éclairée." };
    }
    if (!/^97[89]/.test(code)) {
      return { valide: false, raison: "pas-un-livre",
        message: "Ce code-barres est valide mais ne commence pas par 978 ou 979 : ce n'est pas " +
                 "un ISBN. C'est sans doute un article, pas un livre." };
    }
    return { valide: true, isbn13: code, isbn10: isbn13VersIsbn10(code) };
  }
  if (/^\d{9}[\dX]$/.test(code)) {
    return { valide: true, isbn13: isbn10VersIsbn13(code), isbn10: code };
  }
  return { valide: false, raison: "forme",
    message: "Code non reconnu : un ISBN compte dix ou treize chiffres." };
}

// ----- Les sources, une par une -----
//
// Chacune rend la même forme — { titre, auteur, imageUrl, source } — ou null.
// Aucune ne lève : une source en panne ne doit jamais emporter les autres.

const REGEX_COLLECTION_BNF_D = /^Collection\s*:\s*(.+?)\s*;\s*(\d+)\s*$/i;

// La BnF colle au titre la « mention de responsabilité » — auteur,
// traducteur, illustrateur. Le séparateur canonique est « / », mais toutes
// les notices ne l'ont pas : celle de Harry Potter donne, guillemets
// compris, « "Harry Potter à l'école des sorciers (Nouv. présentation)
// Joanne Rowling ; traduit de l'anglais par Jean-François Ménard" ». Sans
// « / », l'ancien nettoyage rendait la phrase entière comme titre.
//
// On coupe donc dans cet ordre : au « / », sinon au « ; », sinon au nom de
// l'auteur lui-même — qu'on connaît par dc:creator, et qui ne peut pas
// appartenir au titre.
function titreBnFPropre(brut, auteurBrut) {
  let s = String(brut || "").trim().replace(/^"+|"+$/g, "").trim();
  if (!s) return "";

  const barre = s.indexOf(" / ");
  if (barre > 0) return s.slice(0, barre).trim();

  const pointVirgule = s.indexOf(" ; ");
  if (pointVirgule > 0) s = s.slice(0, pointVirgule).trim();

  // Le nom de famille, tel que la BnF l'écrit en tête de dc:creator.
  const nom = String(auteurBrut || "").split(",")[0].trim();
  if (nom.length >= 3) {
    const i = s.indexOf(nom);
    // « > 8 » : un titre qui COMMENCE par le nom de l'auteur existe
    // (« Rowling, une biographie ») — on ne coupe qu'au-delà.
    if (i > 8) s = s.slice(0, i).trim();
  }
  // Ce qui reste peut finir par un prénom orphelin : « … (Nouv. présentation)
  // Joanne » une fois « Rowling » retiré.
  return s.replace(/\s+[A-ZÉÈÀÂÎÔÛ][\p{L}'-]*$/u, "").trim() || s;
}

async function srcBnF(isbn) {
  // « bib.ean » d'abord, « bib.isbn » ensuite : les deux index existent et ne
  // contiennent pas exactement les mêmes notices.
  for (const index of ["bib.ean", "bib.isbn"]) {
    const url = "https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=" +
      encodeURIComponent(index + ' all "' + isbn + '"') +
      "&recordSchema=dublincore&maximumRecords=1";
    let doc;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      doc = new DOMParser().parseFromString(await r.text(), "application/xml");
    } catch (e) { continue; }

    const brutTitre = doc.getElementsByTagName("dc:title")[0];
    if (!brutTitre || !brutTitre.textContent) continue;

    const brutAuteur = doc.getElementsByTagName("dc:creator")[0];
    const titre = titreBnFPropre(brutTitre.textContent,
                                 brutAuteur ? brutAuteur.textContent : "");

    // La BnF range dans « Collection : <nom> ; <n> » DEUX choses très
    // différentes qu'elle ne distingue pas : une vraie série (« One Piece ;
    // 14 », dont le dc:title est le titre propre du tome) et une collection
    // d'éditeur (« Folio junior ; 100 », dont le dc:title est le vrai titre
    // du livre).
    //
    // L'ancien code réécrivait le titre dès qu'il voyait ce champ : « Le
    // Petit Prince » devenait « Folio junior, Tome 100 », et Harry Potter
    // « Folio junior, Tome 899 ». On ne remplace donc plus rien — la série
    // est rendue À CÔTÉ du titre, et c'est à l'appelant de décider.
    let serie = null, tome = null;
    for (const d of doc.getElementsByTagName("dc:description")) {
      const m = REGEX_COLLECTION_BNF_D.exec((d.textContent || "").trim());
      if (m) { serie = m[1].trim(); tome = Number(m[2]); break; }
    }

    return {
      titre,
      auteur: nettoyerAuteurBnF(brutAuteur ? brutAuteur.textContent : ""),
      imageUrl: null,
      serie, tome,
      source: "BnF"
    };
  }
  return null;
}

async function srcOpenLibrary(isbn) {
  try {
    const r = await fetch("https://openlibrary.org/api/books?bibkeys=ISBN:" +
      encodeURIComponent(isbn) + "&format=json&jscmd=data");
    if (!r.ok) return null;
    const d = await r.json();
    const item = d["ISBN:" + isbn];
    if (!item || !item.title) return null;
    return {
      titre: item.subtitle ? item.title + " " + item.subtitle : item.title,
      auteur: (item.authors || []).map((a) => a.name).join(", "),
      imageUrl: item.cover ? (item.cover.large || item.cover.medium || item.cover.small) : null,
      source: "Open Library"
    };
  } catch (e) { return null; }
}

async function srcGoogleBooks(isbn) {
  try {
    let url = "https://www.googleapis.com/books/v1/volumes?q=isbn:" + encodeURIComponent(isbn);
    if (typeof CLE_GOOGLE_BOOKS === "string" && CLE_GOOGLE_BOOKS) {
      url += "&key=" + encodeURIComponent(CLE_GOOGLE_BOOKS);
    }
    const r = await fetch(url);
    if (!r.ok) return null;   // 429 compris : silencieux, les autres prennent le relais
    const d = await r.json();
    const vi = d.items && d.items[0] && d.items[0].volumeInfo;
    if (!vi || !vi.title) return null;
    let image = vi.imageLinks && (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail);
    if (image) image = image.replace(/^http:/, "https:").replace(/&edge=curl/, "");
    return {
      titre: vi.subtitle ? vi.title + " " + vi.subtitle : vi.title,
      auteur: (vi.authors || []).join(", "),
      imageUrl: image || null,
      source: "Google Books"
    };
  } catch (e) { return null; }
}

// Les ISBN japonais (978-4…) : mangas et livres en VO, que ni la BnF ni Open
// Library ne connaissent.
async function srcOpenBD(isbn) {
  if (!/^9784/.test(isbn)) return null;
  try {
    const r = await fetch("https://api.openbd.jp/v1/get?isbn=" + encodeURIComponent(isbn));
    if (!r.ok) return null;
    const d = await r.json();
    const s = d && d[0] && d[0].summary;
    if (!s || !s.title) return null;
    return {
      titre: s.volume ? s.title + " " + s.volume : s.title,
      auteur: s.author || "",
      imageUrl: s.cover || null,
      source: "openBD"
    };
  } catch (e) { return null; }
}

// La couverture seule. Open Library la sert même quand elle n'a pas de
// notice — « default=false » pour obtenir un 404 franc plutôt qu'une image
// grise « pas de couverture », qu'on aurait affichée sans le savoir.
async function srcCouvertureOpenLibrary(isbn) {
  const url = "https://covers.openlibrary.org/b/isbn/" + encodeURIComponent(isbn) + "-L.jpg?default=false";
  try {
    const r = await fetch(url, { method: "GET" });
    return r.ok ? url : null;
  } catch (e) { return null; }
}

// ----- La fusion -----
//
// Champ par champ, et non source par source : la BnF donne le meilleur titre
// français mais jamais d'image, Google la meilleure image mais répond
// rarement. Prendre « la première source qui répond » gâcherait l'une ou
// l'autre.
function fusionnerLivre(resultats, couvertureSecours) {
  const vivants = resultats.filter(Boolean);
  if (!vivants.length) return null;

  const parSource = (nom) => vivants.find((r) => r.source === nom);
  const premier = (noms, champ) => {
    for (const n of noms) {
      const r = parSource(n);
      if (r && r[champ]) return r[champ];
    }
    return "";
  };

  // Le titre : la BnF pour les éditions françaises, openBD pour les
  // japonaises, Google et Open Library ensuite.
  const titre = premier(["BnF", "openBD", "Google Books", "Open Library"], "titre");
  const auteur = premier(["BnF", "openBD", "Google Books", "Open Library"], "auteur");
  const imageUrl = premier(["Google Books", "Open Library", "openBD"], "imageUrl") ||
                   couvertureSecours || null;

  // La série et son tome, quand la BnF les donne. On ne s'en sert PAS pour
  // fabriquer le titre — voir srcBnF — mais on les propose : pour un manga,
  // « One Piece, Tome 14 » est le libellé que l'auteur veut ; pour un roman
  // de poche, « Folio junior, Tome 100 » serait une sottise. Seul un humain
  // fait la différence d'un coup d'œil, alors on lui montre les deux.
  const avecSerie = vivants.find((r) => r.serie);
  const propositionSerie = avecSerie
    ? { libelle: avecSerie.serie + (avecSerie.tome ? ", Tome " + avecSerie.tome : ""),
        serie: avecSerie.serie, tome: avecSerie.tome }
    : null;

  return {
    titre, auteur, imageUrl,
    propositionSerie,
    sources: vivants.map((r) => r.source),
    // Deux sources indépendantes qui donnent le même titre, c'est une
    // vérification ; une seule, c'est une supposition.
    confiance: vivants.length >= 2 ? "confirme" : "unique"
  };
}

// ----- Le cache -----
//
// Un code scanné deux fois ne doit pas repartir sur le réseau : ni pour la
// patience, ni pour les quotas. Le cache est local et sans péremption — un
// ISBN ne désigne jamais un autre livre.
const CLE_CACHE_LIVRES = "mb_cache_isbn";

function cacheLivreLire(isbn) {
  try {
    const t = JSON.parse(localStorage.getItem(CLE_CACHE_LIVRES) || "{}");
    return t && t[isbn] ? t[isbn] : null;
  } catch (e) { return null; }
}

function cacheLivreEcrire(isbn, valeur) {
  try {
    const t = JSON.parse(localStorage.getItem(CLE_CACHE_LIVRES) || "{}");
    t[isbn] = valeur;
    localStorage.setItem(CLE_CACHE_LIVRES, JSON.stringify(t));
  } catch (e) {}
}

// ----- L'entrée publique, pour les livres -----
//
// Rend { titre, auteur, imageUrl, sources, confiance } ou un objet d'échec
// qui EXPLIQUE, plutôt qu'un null muet : « code illisible » et « livre
// inconnu des catalogues » appellent des gestes différents.
async function detecterLivre(codeBrut) {
  const analyse = analyserCodeBarres(codeBrut);
  if (!analyse.valide) {
    return { trouve: false, raison: analyse.raison, message: analyse.message };
  }

  const enCache = cacheLivreLire(analyse.isbn13);
  if (enCache) return Object.assign({ trouve: true, cache: true }, enCache);

  // Les deux formes de l'ISBN, car les catalogues n'indexent pas la même.
  const formes = [analyse.isbn13, analyse.isbn10].filter(Boolean);

  const travaux = [];
  formes.forEach((f) => {
    travaux.push(srcBnF(f).catch(() => null));
    travaux.push(srcOpenLibrary(f).catch(() => null));
    travaux.push(srcGoogleBooks(f).catch(() => null));
    travaux.push(srcOpenBD(f).catch(() => null));
  });
  const couverture = srcCouvertureOpenLibrary(analyse.isbn13).catch(() => null);

  const [resultats, couvertureSecours] = await Promise.all([
    Promise.all(travaux), couverture
  ]);

  const fusion = fusionnerLivre(resultats, couvertureSecours);
  if (!fusion) {
    return { trouve: false, raison: "inconnu", isbn13: analyse.isbn13,
      message: "Aucun catalogue ne connaît ce code (" + analyse.isbn13 + "). " +
               "Les catalogues ignorent beaucoup de tirages récents et de petits éditeurs — " +
               "cherchez par titre, l'ajout sera le même." };
  }

  cacheLivreEcrire(analyse.isbn13, fusion);
  return Object.assign({ trouve: true, isbn13: analyse.isbn13 }, fusion);
}

// =====================================================================
//  Séries
// =====================================================================
//
//  TVMaze et AniList ne se contredisent pas par erreur : ils ne découpent
//  pas la même chose. Pour « Attack on Titan », TVMaze annonce 4 saisons de
//  25/12/22/30 épisodes ; AniList, où chaque saison est une FICHE séparée
//  reliée par « suite de », en donne six : 25/12/12/10/16/12. Les deux sont
//  défendables — l'un suit la numérotation occidentale, l'autre les vagues
//  de diffusion japonaises.
//
//  Il n'existe donc pas de source « exacte » à choisir : c'est à l'auteur de
//  trancher. Le module apporte les deux lectures et dit si elles s'accordent.

function normaliserTitre(t) {
  return String(t || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

// Un score de ressemblance simple, pour classer les homonymes : l'égalité
// exacte d'abord, le préfixe ensuite, l'inclusion enfin. Sans lui, « One
// Piece » remonte l'adaptation Netflix de 2023 avant l'anime de 1999.
function scoreTitre(candidat, recherche) {
  const a = normaliserTitre(candidat), b = normaliserTitre(recherche);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b)) return 80 - Math.min(20, a.length - b.length);
  if (a.includes(b)) return 60;
  const motsB = b.split(" ");
  const communs = motsB.filter((m) => a.includes(m)).length;
  return Math.round(40 * communs / motsB.length);
}

async function srcTVMazeRecherche(titre) {
  try {
    const r = await fetch("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(titre));
    if (!r.ok) return [];
    const d = await r.json();
    return (d || []).map((x) => ({
      source: "TVMaze",
      id: x.show.id,
      titre: x.show.name,
      annee: (x.show.premiered || "").slice(0, 4),
      type: x.show.type || "",
      pays: (x.show.network && x.show.network.country && x.show.network.country.code) || "",
      imageUrl: x.show.image ? (x.show.image.medium || x.show.image.original) : null,
      pertinence: Math.round((x.score || 0) * 10)
    }));
  } catch (e) { return []; }
}

const REQUETE_ANILIST = `query($s:String){ Page(perPage:10){ media(search:$s, type:ANIME, sort:SEARCH_MATCH){
  id title{romaji english} episodes format seasonYear coverImage{large}
  relations{ edges{ relationType node{ id title{romaji english} episodes format seasonYear } } } } } }`;

async function srcAniListRecherche(titre) {
  try {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: REQUETE_ANILIST, variables: { s: titre } })
    });
    if (!r.ok) return [];
    const d = await r.json();
    const media = (d && d.data && d.data.Page && d.data.Page.media) || [];
    // Les films, OAV et spéciaux ne sont pas des séries à saisons : on les
    // écarte pour ne pas noyer la liste.
    return media.filter((m) => m.format === "TV" || m.format === "TV_SHORT" || m.format === "ONA")
      .map((m) => ({
        source: "AniList",
        id: m.id,
        titre: m.title.english || m.title.romaji,
        annee: m.seasonYear ? String(m.seasonYear) : "",
        type: "Animation",
        imageUrl: m.coverImage ? m.coverImage.large : null,
        episodes: m.episodes,
        relations: m.relations && m.relations.edges ? m.relations.edges : [],
        pertinence: 0
      }));
  } catch (e) { return []; }
}

// Les deux listes réunies, débarrassées des doublons évidents et classées
// par ressemblance au titre cherché puis par ancienneté — l'œuvre d'origine
// passe ainsi devant son remake.
async function detecterSeries(titre) {
  const [tv, ani] = await Promise.all([
    srcTVMazeRecherche(titre), srcAniListRecherche(titre)
  ]);

  const tous = tv.concat(ani).map((c) => Object.assign({}, c, {
    score: scoreTitre(c.titre, titre) + Math.min(20, c.pertinence)
  }));

  // Doublon : même titre normalisé ET même année. On garde les deux sources
  // dans la fiche, pour pouvoir les comparer ensuite.
  const parCle = new Map();
  tous.forEach((c) => {
    const cle = normaliserTitre(c.titre) + "|" + c.annee;
    const dejaLa = parCle.get(cle);
    if (!dejaLa) { parCle.set(cle, Object.assign({ autres: [] }, c)); return; }
    dejaLa.autres.push(c);
    if (c.score > dejaLa.score) {
      const garde = dejaLa.autres;
      parCle.set(cle, Object.assign({ autres: garde }, c));
    }
  });

  return Array.from(parCle.values())
    .sort((a, b) => (b.score - a.score) || (Number(a.annee || 9999) - Number(b.annee || 9999)))
    .slice(0, 10);
}

// ----- Le détail : deux lectures, et leur accord -----

async function saisonsTVMaze(id) {
  try {
    // « /seasons » plutôt que le comptage des épisodes : c'est la
    // numérotation officielle de la fiche, et elle porte le nombre annoncé.
    const [saisons, episodes] = await Promise.all([
      fetch("https://api.tvmaze.com/shows/" + id + "/seasons").then((r) => (r.ok ? r.json() : [])),
      fetch("https://api.tvmaze.com/shows/" + id + "/episodes").then((r) => (r.ok ? r.json() : []))
    ]);
    // Le compte réel des épisodes prime sur le champ annoncé, souvent nul
    // pour les saisons en cours.
    const reels = new Map();
    (episodes || []).forEach((e) => reels.set(e.season, (reels.get(e.season) || 0) + 1));

    const liste = (saisons || []).map((s) => ({
      numero: s.number,
      episodesTotal: reels.get(s.number) || s.episodeOrder || 0
    })).filter((s) => s.episodesTotal > 0);

    if (liste.length) return liste;

    // Aucune saison déclarée : on retombe sur le regroupement des épisodes,
    // renuméroté — certains animes classent par ANNÉE de diffusion.
    return Array.from(reels.entries()).sort((a, b) => a[0] - b[0])
      .map(([, n], i) => ({ numero: i + 1, episodesTotal: n }));
  } catch (e) { return []; }
}

// AniList : on remonte au premier maillon puis on suit les « suites ».
async function saisonsAniList(idDepart) {
  const vus = new Set();
  const fiche = async (id) => {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query($id:Int){ Media(id:$id, type:ANIME){ id title{romaji english} episodes format seasonYear
                 relations{ edges{ relationType node{ id format } } } } }`,
        variables: { id }
      })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.data ? d.data.Media : null;
  };
  const suivant = (m, type) => {
    const e = (m.relations.edges || []).find(
      (x) => x.relationType === type && (x.node.format === "TV" || x.node.format === "ONA"));
    return e ? e.node.id : null;
  };

  try {
    // Remonter jusqu'au premier
    let courant = await fiche(idDepart);
    if (!courant) return [];
    let garde = 0;
    while (garde++ < 20) {
      const p = suivant(courant, "PREQUEL");
      if (!p || vus.has(p)) break;
      vus.add(p);
      const suiteM = await fiche(p);
      if (!suiteM) break;
      courant = suiteM;
    }
    // Puis redescendre
    const chaine = [];
    vus.clear();
    garde = 0;
    while (courant && garde++ < 30) {
      if (vus.has(courant.id)) break;
      vus.add(courant.id);
      chaine.push({
        numero: chaine.length + 1,
        episodesTotal: courant.episodes || 0,
        titre: courant.title.english || courant.title.romaji,
        annee: courant.seasonYear
      });
      const s = suivant(courant, "SEQUEL");
      courant = s ? await fiche(s) : null;
    }
    return chaine.filter((s) => s.episodesTotal > 0);
  } catch (e) { return []; }
}

// Les deux lectures d'une même série, et leur verdict. C'est ce qui remplace
// la confiance aveugle en une seule source.
async function detaillerSerie(candidat) {
  const lectures = [];

  if (candidat.source === "TVMaze" || (candidat.autres || []).some((a) => a.source === "TVMaze")) {
    const id = candidat.source === "TVMaze" ? candidat.id
      : candidat.autres.find((a) => a.source === "TVMaze").id;
    const s = await saisonsTVMaze(id);
    if (s.length) lectures.push({ source: "TVMaze", saisons: s });
  }
  if (candidat.source === "AniList" || (candidat.autres || []).some((a) => a.source === "AniList")) {
    const id = candidat.source === "AniList" ? candidat.id
      : candidat.autres.find((a) => a.source === "AniList").id;
    const s = await saisonsAniList(id);
    if (s.length) lectures.push({ source: "AniList", saisons: s });
  }

  if (!lectures.length) return { titre: candidat.titre, lectures: [], accord: "aucune" };

  const signature = (l) => l.saisons.map((s) => s.episodesTotal).join("-");
  const accord = lectures.length < 2 ? "source-unique"
    : (signature(lectures[0]) === signature(lectures[1]) ? "identiques" : "divergentes");

  return {
    titre: candidat.titre,
    imageUrl: candidat.imageUrl,
    annee: candidat.annee,
    lectures,
    accord
  };
}
