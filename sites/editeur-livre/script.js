// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({});

// ===== Éditeur de livre — Supabase (remplace la BDD GitHub) =====
// Compte central maison, partagé avec le portail et les deux autres sites —
// voir ../../../supabase/schema-compte-central.sql. Chaque livre est rattaché
// à son auth.uid() (le jeton signé par connexion()/inscription()), avec RLS
// pour que personne ne lise le manuscrit d'un autre — sauf s'il l'a publié.
// Schéma complet : supabase/schema.sql dans ce dossier.
const SUPABASE_URL = "https://uxedmplaeuonhhpxqpse.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vtFaCnMEFpqYvzzoth9T_w_6XCA4JCt";

// Bucket Storage public de ce site (couvertures, 4e de couverture, tranche).
const BUCKET = "editeur-livre";

const ID_SITE = "editeur-livre";

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
  // texte brut plutôt que de se fier au code de statut.
  const texte = await reponse.text();
  return texte ? JSON.parse(texte) : null;
}

// ===== Session : une seule connexion pour tous les sites =====
//
// Le portail central mémorise sa session dans localStorage sous team53_*.
// Ce site vivant sur la même origine, il y a accès directement — plus de
// jeton GitHub propre au site à ressaisir.
function exigerConnexion() {
  const token = localStorage.getItem("team53_token");
  // Un token qui n'a pas la forme d'un JWT (trois segments séparés par des
  // points) vient d'une session corrompue ou d'avant la bascule vers
  // Supabase — l'envoyer tel quel à Supabase provoque une erreur cryptique
  // ("Expected 3 parts in JWT; got 1") au lieu d'un renvoi propre vers la
  // connexion. On le traite comme une absence de session.
  if (!token || token.split(".").length !== 3) {
    seDeconnecter();
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
  sessionStorage.removeItem("livre_id");
  window.location.replace("../../connexion.html");
}

// L'identifiant du compte (auth.uid() côté base) : les livres y sont
// rattachés, et c'est aussi le dossier des images dans le bucket.
function monIdentifiant() {
  return localStorage.getItem("team53_id");
}

function estAdminCentral() {
  return localStorage.getItem("team53_role") === "admin";
}

// Les images d'un compte sont rangées sous son identifiant — stable, et déjà
// le découpage employé par RLS. (L'ancien slug du login ne convenait plus :
// renommer un compte aurait déplacé ses fichiers.)
function obtenirPrefixeImagesUtilisateur() {
  return monIdentifiant();
}

// ===== Images (Storage) =====
// Les visuels vivent dans le bucket public "editeur-livre", rangés par
// compte : <user_id>/<id du livre>_<face>.<ext>. Les champs `imageChemin`
// portent l'URL publique COMPLÈTE, affichable directement dans un <img src> —
// sans jeton ni requête authentifiée, contrairement au dépôt GitHub privé
// d'avant, où il fallait télécharger les octets puis fabriquer une URL locale
// (et la refaire quand elle expirait).
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

// Envoie une image (data URL) dans le bucket et renvoie son URL publique.
// "x-upsert" écrase silencieusement un fichier déjà présent au même chemin
// (remplacement d'une couverture) — plus de sha à relire.
async function uploaderImageStorage(chemin, dataUrl) {
  const virgule = dataUrl.indexOf(",");
  if (virgule === -1) throw new Error("Format d'image invalide.");
  const octets = atob(dataUrl.slice(virgule + 1));
  const tampon = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);

  const reponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${chemin}`, {
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
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${chemin}`;
}

// `imageChemin` garde l'URL publique ; supprimer le fichier demande son
// CHEMIN dans le bucket. On le retrouve en retirant le préfixe public — et
// l'on refuse tout ce qui ne vient pas de notre bucket, pour qu'une valeur
// héritée (ancien chemin GitHub) ne parte pas en suppression hasardeuse.
function cheminDepuisUrlStorage(url) {
  const prefixe = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return (typeof url === "string" && url.startsWith(prefixe)) ? url.slice(prefixe.length) : null;
}

// Copie un visuel vers un autre chemin du même bucket, et renvoie l'URL
// publique de la copie (ou null s'il n'y avait rien à copier).
//
// Storage copie côté serveur : les octets ne repassent pas par le navigateur,
// ce qui compte pour une couverture de plusieurs mégaoctets.
//
// Pourquoi COPIER plutôt que partager le chemin : supprimer un livre supprime
// ses images (voir supprimerLivre). Deux livres qui pointeraient le même
// fichier, et effacer l'un ferait disparaître la couverture de l'autre.
async function copierImageStorage(urlOuCheminSource, cheminDest) {
  const source = cheminDepuisUrlStorage(urlOuCheminSource) || urlOuCheminSource;
  // Une image restée sur un serveur extérieur n'est pas à nous : on laisse
  // les deux livres pointer dessus, il n'y a rien à supprimer plus tard.
  if (!source || /^https?:\/\//i.test(source)) return urlOuCheminSource || null;

  const reponse = await fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ bucketId: BUCKET, sourceKey: source, destinationKey: cheminDest })
  });
  if (!reponse.ok) {
    throw new Error("Copie de l'image impossible (" + reponse.status + ").");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${cheminDest}`;
}

async function supprimerImageStorage(urlOuChemin) {
  const chemin = cheminDepuisUrlStorage(urlOuChemin) || urlOuChemin;
  if (!chemin || /^https?:\/\//i.test(chemin)) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${chemin}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${_jetonCourant()}`
    }
  });
  // Volontairement silencieux en cas d'échec : ne doit pas bloquer le reste du flux.
}

// Conservée sous son nom d'origine : plusieurs écrans attendent une promesse
// d'URL affichable. L'URL publique EST déjà cela — il n'y a plus rien à aller
// chercher, le navigateur s'en charge avec son propre cache.
async function obtenirUrlImage(url) {
  if (!url) throw new Error("Image absente.");
  return url;
}

// ===== Livres =====
//
// La table `livres` porte une ligne par livre, `livre_spreads` une ligne par
// double-page. Les fonctions ci-dessous sont le SEUL endroit qui connaisse
// les noms de colonnes : le reste du code continue de manipuler la forme
// historique { id, titre, auteur, format, espaceTitre, couverture, ... }.

// Combien de pages ce livre fait-il ?
//
// Dans l'ordre : le cache écrit à la dernière sauvegarde ; à défaut les pages
// elles-mêmes si elles ont été chargées ; à défaut le nombre de double-pages,
// que la base sait compter. Une double-page vaut exactement DEUX pages
// (regenererToutesPages en pose une à gauche, une à droite) — au retrait près
// des pages vides de la fin, l'éditeur ayant déjà élagué les double-pages
// vides en enregistrant. L'estimation est donc juste à une page, et la
// prochaine sauvegarde écrit le compte exact.
function nombreDePages(r) {
  if (typeof r.nb_pages === "number") return r.nb_pages;
  if (Array.isArray(r.pages) && r.pages.length) return r.pages.length;
  const compte = r.livre_spreads;
  const n = Array.isArray(compte) ? (compte[0] && compte[0].count) : (compte && compte.count);
  return n ? n * 2 : 0;
}

function versLivreMemoire(r) {
  return {
    id: r.id,
    titre: r.titre || "",
    auteur: r.auteur || "",
    format: r.format || "149x210",
    espaceTitre: r.espace_titre == null ? undefined : Number(r.espace_titre),
    serieId: r.serie_id || null,
    tome: r.tome == null ? null : Number(r.tome),
    gardesDebut: Number(r.gardes_debut) || 0,
    gardesFin: Number(r.gardes_fin) || 0,
    publie: !!r.publie,
    publieLe: r.publie_le || null,
    couverture: r.couverture || undefined,
    quatrieme: r.quatrieme || undefined,
    tranche: r.tranche || undefined,
    // Cache de pagination (voir supabase/schema.sql) : présent tel qu'il a
    // été écrit à la dernière sauvegarde.
    pages: Array.isArray(r.pages) ? r.pages : [],
    nbPages: nombreDePages(r),
    dateCreation: r.cree_le,
    dateModif: r.maj_le
  };
}

function versLigneLivre(livre, horodatage) {
  const pages = Array.isArray(livre.pages) ? livre.pages : [];
  return {
    id: livre.id,
    user_id: monIdentifiant(),
    titre: livre.titre || "",
    auteur: livre.auteur || null,
    format: livre.format || "149x210",
    espace_titre: (typeof livre.espaceTitre === "number") ? livre.espaceTitre : null,
    // Écrites explicitement plutôt que laissées de côté : cette fonction ne
    // sert qu'à des livres chargés en entier (le garde-fou d'en dessous s'en
    // assure), donc le rattachement est toujours connu — et l'écrire noir sur
    // blanc évite de dépendre des colonnes que PostgREST choisit de toucher
    // dans la branche « ON CONFLICT UPDATE ».
    serie_id: livre.serieId || null,
    tome: (typeof livre.tome === "number") ? livre.tome : null,
    gardes_debut: Number(livre.gardesDebut) || 0,
    gardes_fin: Number(livre.gardesFin) || 0,
    publie: !!livre.publie,
    publie_le: livre.publieLe || null,
    couverture: livre.couverture || null,
    quatrieme: livre.quatrieme || null,
    tranche: livre.tranche || null,
    pages: pages,
    nb_pages: pages.length,
    cree_le: livre.dateCreation || horodatage,
    maj_le: horodatage
  };
}

// Les colonnes lourdes (pages, et le texte des spreads) ne descendent pas :
// la bibliothèque n'affiche qu'un titre, une vignette et un nombre de pages.
//
// `livre_spreads(count)` ne rapatrie pas les double-pages : la base les
// compte et ne renvoie que le nombre. Il sert de filet quand `nb_pages` est
// vide — un livre migré depuis l'ancienne base n'a pas encore son cache de
// pagination, et la bibliothèque affichait alors « 0 p. ».
const CHAMPS_LIVRE_META =
  "id,titre,auteur,format,espace_titre,publie,publie_le,couverture,quatrieme,tranche,nb_pages,cree_le,maj_le," +
  "serie_id,tome,gardes_debut,gardes_fin,livre_spreads(count)";

async function chargerBibliothequeMeta() {
  const lignes = await requeteSupabase(
    `livres?user_id=eq.${monIdentifiant()}&select=${CHAMPS_LIVRE_META}&order=cree_le`);
  return { livres: (lignes || []).map(versLivreMemoire) };
}

// ----- Séries : plusieurs tomes d'une même histoire -----
//
// Une série n'est qu'un CLASSEMENT. Elle range des livres et porte le résumé
// d'ensemble ; le tome, lui, reste un livre autonome qui s'ouvre, s'imprime
// et se publie sans elle. Supprimer une série ne supprime donc aucun livre
// (« on delete set null » côté base) : les tomes redeviennent des livres sans
// série.

async function chargerSeries() {
  const lignes = await requeteSupabase(
    `series?user_id=eq.${monIdentifiant()}&select=id,titre,resume,cree_le,maj_le&order=cree_le`);
  return (lignes || []).map((r) => ({
    id: r.id,
    titre: r.titre || "",
    resume: r.resume || "",
    dateCreation: r.cree_le,
    dateModif: r.maj_le
  }));
}

async function creerSerieDistante(titre, resume) {
  const id = "s" + Date.now();
  await requeteSupabase("series", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id,
      user_id: monIdentifiant(),
      titre: titre,
      resume: resume || null
    })
  });
  return id;
}

async function mettreAJourSerie(id, champs) {
  await requeteSupabase(`series?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(Object.assign({ maj_le: new Date().toISOString() }, champs))
  });
}

async function supprimerSerieDistante(id) {
  await requeteSupabase(`series?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Rattacher un livre à une série (ou l'en détacher avec serieId = null).
// Les clés sont celles de mettreAJourLivre — en camelCase, comme l'objet en
// mémoire — et non les noms de colonnes de la base.
async function definirSerieDuLivre(livreId, serieId, tome) {
  await mettreAJourLivre(livreId, {
    serieId: serieId || null,
    tome: serieId && typeof tome === "number" ? tome : null
  });
}

// Un livre entier : sa ligne, ses double-pages, son cache de pagination.
// `proprietaire` n'est pas passé : RLS décide seule si la lecture est permise
// (le sien, ou un livre publié).
async function chargerLivreComplet(id) {
  const [lignes, spreads] = await Promise.all([
    requeteSupabase(`livres?id=eq.${encodeURIComponent(id)}&select=*`),
    requeteSupabase(`livre_spreads?livre_id=eq.${encodeURIComponent(id)}&select=position,contenu&order=position`)
  ]);
  if (!lignes || !lignes.length) {
    const e = new Error("Livre introuvable.");
    e.status = 404;
    throw e;
  }
  const livre = versLivreMemoire(lignes[0]);
  livre.spreads = (spreads || []).map((s) => s.contenu || "");
  return livre;
}

// Aligne les double-pages sur l'état local : on réécrit celles qui existent,
// puis on efface celles qui dépassent.
//
// L'ordre compte. Écrire D'ABORD, effacer ensuite : l'inverse (tout effacer
// puis tout réinsérer) aurait laissé le manuscrit VIDE si la réinsertion
// échouait entre les deux. L'upsert par (livre_id, position) est idempotent,
// et la suppression ne vise que des positions dont on sait qu'elles n'existent
// plus.
async function remplacerSpreads(livreId, spreads) {
  const liste = Array.isArray(spreads) ? spreads : [];
  if (liste.length) {
    await requeteSupabase("livre_spreads", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(liste.map((contenu, position) => ({
        livre_id: livreId, position, contenu: contenu || ""
      })))
    });
  }
  await requeteSupabase(
    `livre_spreads?livre_id=eq.${encodeURIComponent(livreId)}&position=gte.${liste.length}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

// Enregistre un livre existant. `majLeConnu` est la date de modification lue
// au chargement : si elle a bougé entre-temps, c'est que le livre a été
// enregistré ailleurs (autre onglet, autre appareil) et l'on refuse d'écraser
// sans demander — c'est le conflit que gérait le sha GitHub.
async function enregistrerLivreDistant(livre, majLeConnu) {
  if (majLeConnu) {
    const actuel = await requeteSupabase(
      `livres?id=eq.${encodeURIComponent(livre.id)}&select=maj_le`);
    const distant = actuel && actuel[0] && actuel[0].maj_le;
    if (distant && distant !== majLeConnu) {
      const e = new Error("Ce livre a été modifié ailleurs.");
      e.conflit = true;
      throw e;
    }
  }

  // Garde-fou : cette fonction réécrit le manuscrit ENTIER. Appelée sur un
  // livre chargé en métadonnées seules (la bibliothèque n'en descend pas le
  // texte), `spreads` serait absent — et remplacerSpreads effacerait toutes
  // les double-pages sans rien à remettre. On refuse plutôt que d'effacer.
  // Pour modifier un livre sans toucher à son texte : mettreAJourLivre().
  if (!Array.isArray(livre.spreads)) {
    throw new Error("Enregistrement refusé : le texte du livre n'est pas chargé.");
  }

  const horodatage = new Date().toISOString();
  const lignes = await requeteSupabase("livres?select=maj_le", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([versLigneLivre(livre, horodatage)])
  });
  await remplacerSpreads(livre.id, livre.spreads);
  return (lignes && lignes[0] && lignes[0].maj_le) || horodatage;
}

// Modifie quelques champs d'un livre SANS toucher à son texte : la
// bibliothèque renomme, repose une couverture ou publie sans jamais avoir
// chargé les double-pages.
const CHAMPS_MODIFIABLES_LIVRE = {
  titre: "titre", auteur: "auteur", format: "format",
  espaceTitre: "espace_titre", couverture: "couverture",
  quatrieme: "quatrieme", tranche: "tranche",
  serieId: "serie_id", tome: "tome",
  gardesDebut: "gardes_debut", gardesFin: "gardes_fin"
};

async function mettreAJourLivre(id, champs) {
  const ligne = { maj_le: new Date().toISOString() };

  Object.keys(champs || {}).forEach((cle) => {
    // Un champ inconnu ne passe plus en silence.
    //
    // Cette liste ne filtrait pas seulement : elle JETAIT sans rien dire ce
    // qu'elle ne reconnaissait pas. La requête partait, réussissait, et
    // n'écrivait rien — c'est ainsi que les tomes d'une série ont paru
    // s'enregistrer (l'écran suivait l'état local) puis disparaissaient au
    // rechargement. Une faute de frappe coûtait le même silence.
    if (!CHAMPS_MODIFIABLES_LIVRE[cle]) {
      throw new Error("Champ de livre inconnu : « " + cle + " ». " +
        "Champs acceptés : " + Object.keys(CHAMPS_MODIFIABLES_LIVRE).join(", ") + ".");
    }
    ligne[CHAMPS_MODIFIABLES_LIVRE[cle]] = champs[cle] === undefined ? null : champs[cle];
  });
  await requeteSupabase(`livres?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(ligne)
  });
}

async function creerLivreDistant(livre) {
  const horodatage = new Date().toISOString();
  await requeteSupabase("livres", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([versLigneLivre(livre, horodatage)])
  });
  if (livre.spreads && livre.spreads.length) await remplacerSpreads(livre.id, livre.spreads);
}

// Les double-pages partent avec le livre (on delete cascade), les images non :
// Storage ne sait rien des lignes qui les référencent.
async function supprimerLivreDistant(id) {
  await requeteSupabase(`livres?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE", headers: { Prefer: "return=minimal" }
  });
}

// ===== Livres publiés =====
//
// `EditeurLivre/publies.json` a disparu : la publication est une colonne du
// livre, et la politique de lecture laisse passer les livres publiés quel
// qu'en soit l'auteur. Plus d'index commun à tenir d'accord avec les livres
// eux-mêmes — ni de fichier où un livre supprimé restait inscrit.
async function listerLivresPublies() {
  const lignes = await requeteSupabase(
    `livres?publie=is.true&select=${CHAMPS_LIVRE_META},user_id&order=publie_le.desc`);
  return (lignes || []).map((r) => Object.assign(versLivreMemoire(r), { proprietaire: r.user_id }));
}

async function definirPublication(id, publie) {
  await requeteSupabase(`livres?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ publie: !!publie, publie_le: publie ? new Date().toISOString() : null })
  });
}

// ===== Identité et tutoriels =====
//
// Le pseudo et le rôle sont recopiés sur l'appareil à la connexion, pour ne
// pas relire le compte à chaque page. Cette copie ne bougeait plus ensuite :
// un pseudo changé depuis le portail laissait l'ancien s'afficher ici
// indéfiniment. On la remet d'aplomb au chargement de la bibliothèque.
// Best-effort : un compte illisible ne doit pas empêcher d'ouvrir ses livres.
async function rafraichirIdentiteCentrale() {
  const id = monIdentifiant();
  if (!id) return null;
  try {
    const lignes = await requeteSupabase(
      `users?id=eq.${id}&select=login,role,nom_affichage,acces,tuto_biblio_vu,tuto_editeur_vu`);
    const moi = lignes && lignes[0];
    if (!moi) return null;
    localStorage.setItem("team53_nom", moi.nom_affichage || "");
    localStorage.setItem("team53_role", moi.role === "admin" ? "admin" : "user");
    localStorage.setItem("team53_acces", JSON.stringify(Array.isArray(moi.acces) ? moi.acces : []));
    return moi;
  } catch (e) {
    return null;
  }
}

async function definirNomAffichage(nom) {
  await appelerFonctionSupabase("definir_mon_nom_affichage", { nouveau_nom: nom });
  localStorage.setItem("team53_nom", nom || "");
}

// ----- « Tutoriel déjà vu » -----
// Source de vérité : le compte (donc valable sur tous ses appareils). Un
// repli local sert de filet quand l'écriture distante échoue, pour que le
// tutoriel ne réapparaisse pas indéfiniment sur cet appareil.
function cleTutoLocale(champ) {
  return `tuto_${champ}_${localStorage.getItem("team53_login") || ""}`;
}

function tutoDejaVu(moi, champ) {
  const colonne = champ === "biblio" ? "tuto_biblio_vu" : "tuto_editeur_vu";
  if (moi && moi[colonne]) return true;
  try { return localStorage.getItem(cleTutoLocale(champ)) === "1"; } catch (e) { return false; }
}

async function marquerTutoVuDistant(champ) {
  // Repli immédiat : même si le réseau échoue, plus de tutoriel en boucle ici.
  try { localStorage.setItem(cleTutoLocale(champ), "1"); } catch (e) {}
  try {
    await appelerFonctionSupabase("marquer_tuto_vu", { p_champ: champ });
    return true;
  } catch (e) {
    return false;  // le repli local a déjà fait son office
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

// =====================================================================
//  Format personnalisé (KDP) — encodé dans sa propre clé
//
//  Les formats fixes sont des clés arbitraires ("149x210", "kdp5585"...),
//  résolues par une table dans le fichier qui en a besoin. Un format tapé à
//  la main par l'auteur (onglet KDP du panneau, voir plus bas) n'a pas sa
//  place dans ces tables figées — plutôt que d'ajouter une colonne à part
//  rien que pour lui, ses millimètres sont encodés directement dans sa clé :
//  "kdpc-<largeur>x<hauteur>". Un livre existant garde ainsi un simple champ
//  `format` texte, quel que soit le format choisi.
// =====================================================================

function dimensionsFormatPersonnalise(formatKey) {
  const m = /^kdpc-([\d.]+)x([\d.]+)$/.exec(formatKey || "");
  return m ? { larg: parseFloat(m[1]), haut: parseFloat(m[2]) } : null;
}

function formatPersonnaliseDepuisCm(largCm, hautCm) {
  const arrondirMm = (cm) => Math.round(cm * 100) / 10; // cm -> mm, 1 décimale
  return "kdpc-" + arrondirMm(largCm) + "x" + arrondirMm(hautCm);
}

// Résout un format vers ses dimensions (et marges d'écran, si la table en
// porte), qu'il s'agisse d'une clé fixe de la table `table` (FORMATS /
// FORMATS_VIGNETTE / FORMATS_KDP, selon le fichier appelant) ou d'un format
// personnalisé. Un seul point de résolution, partagé par tout le site : sans
// lui, chaque lecture de format ailleurs dans le code aurait dû réapprendre
// à reconnaître un format personnalisé.
function resoudreFormat(table, formatKey, repli) {
  const perso = dimensionsFormatPersonnalise(formatKey);
  if (perso) {
    const gabarit = table[repli] || {};
    return Object.assign({}, gabarit, {
      larg: perso.larg, haut: perso.haut,
      // Marges d'écran par défaut, proportionnelles à la page — un format
      // personnalisé n'a pas de marges "connues" comme les formats fixes.
      margeV: Math.round(perso.haut * 0.095),
      margeH: Math.round(perso.larg * 0.12)
    });
  }
  return table[formatKey] || table[repli];
}

// =====================================================================
//  Panneau de choix du format du livre
//
//  Remplace l'ancien <select> par un panneau à onglets — un onglet par
//  famille de formats (Standard, Amazon KDP...). ONGLETS_FORMAT est la seule
//  chose à toucher pour ajouter un choix ou, plus tard, un onglet entier
//  (typographie, marges...) : le reste du panneau (rendu, clic, fermeture)
//  ne connaît que cette liste, jamais un format en particulier.
// =====================================================================

const ONGLETS_FORMAT = [
  {
    id: "standard",
    nom: "Standard",
    choix: [
      { format: "149x210", nom: "Roman", dims: "14,9 × 21,0 cm" },
      { format: "155x235", nom: "Grand roman", dims: "15,5 × 23,5 cm" },
      { format: "105x148", nom: "Poche", dims: "10,5 × 14,8 cm" },
      { format: "210x297", nom: "A4", dims: "21,0 × 29,7 cm" }
    ]
  },
  {
    id: "kdp",
    nom: "Amazon KDP",
    choix: [
      { format: "kdp5585", nom: "Amazon KDP", dims: "13,97 × 21,59 cm" },
      { format: "kdp150210", nom: "Amazon KDP", dims: "15,0 × 21,0 cm" }
    ],
    // Cet onglet propose en plus une taille saisie à la main — voir
    // rendreContenuOngletFormat().
    personnalise: true
  }
];

// Le format par défaut de tout nouveau livre, et le repli si une clé
// inconnue se présentait (livre corrompu, format retiré...).
const FORMAT_PAR_DEFAUT = "149x210";

function libelleFormat(formatKey) {
  for (const onglet of ONGLETS_FORMAT) {
    const c = onglet.choix.find((c) => c.format === formatKey);
    if (c) return c.nom + " — " + c.dims;
  }
  const perso = dimensionsFormatPersonnalise(formatKey);
  if (perso) return "KDP personnalisé — " + formaterMmEnCm(perso.larg) + " × " + formaterMmEnCm(perso.haut) + " cm";
  return libelleFormat(FORMAT_PAR_DEFAUT);
}

function formaterMmEnCm(mm) {
  return (mm / 10).toFixed(1).replace(".", ",");
}

// Version compacte de libelleFormat(), pour les listes où la place manque
// (carte d'un livre dans la bibliothèque, page "Livres publiés"...).
const LIBELLES_COURTS_FORMAT = {
  "149x210": "14,9×21",
  "155x235": "15,5×23,5",
  "105x148": "Poche",
  "210x297": "A4",
  "kdp5585": "KDP 13,97×21,59",
  "kdp150210": "KDP 15×21"
};
function libelleFormatCourt(formatKey) {
  if (LIBELLES_COURTS_FORMAT[formatKey]) return LIBELLES_COURTS_FORMAT[formatKey];
  const perso = dimensionsFormatPersonnalise(formatKey);
  if (perso) return "KDP " + formaterMmEnCm(perso.larg) + "×" + formaterMmEnCm(perso.haut);
  return LIBELLES_COURTS_FORMAT[FORMAT_PAR_DEFAUT];
}

let ongletFormatActif = "standard";

// `formatActuel` présélectionne l'onglet et la carte correspondants ;
// `onChoisir(formatKey)` est appelé une fois un format validé (le panneau
// s'est déjà fermé à ce moment-là).
function ouvrirPanneauFormat(formatActuel, onChoisir) {
  fermerPanneauFormat();

  const persoActuel = dimensionsFormatPersonnalise(formatActuel);
  const ongletDuFormat = ONGLETS_FORMAT.find((o) =>
    o.choix.some((c) => c.format === formatActuel) || (persoActuel && o.personnalise));
  ongletFormatActif = (ongletDuFormat && ongletDuFormat.id) || "standard";

  const fond = document.createElement("div");
  fond.id = "panneauFormat";
  fond.className = "modal-impression";
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerPanneauFormat(); });
  document.body.appendChild(fond);

  fond.innerHTML =
    '<div class="modal-impression-carte pf-carte" role="dialog" aria-modal="true" aria-label="Choisir le format du livre">' +
      '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
      "<h3>Format du livre</h3>" +
      '<p class="mi-intro">La taille des pages — vous pourrez en changer à tout moment, tout le texte se recompose automatiquement.</p>' +
      '<div class="pf-onglets" role="tablist">' +
        ONGLETS_FORMAT.map((o) =>
          '<button type="button" class="pf-onglet" role="tab" data-onglet="' + o.id + '">' + o.nom + "</button>"
        ).join("") +
      "</div>" +
      '<div class="pf-contenu"></div>' +
    "</div>";

  fond.querySelector(".mi-fermer").onclick = fermerPanneauFormat;

  const appliquer = (formatKey) => {
    fermerPanneauFormat();
    onChoisir(formatKey);
  };

  fond.querySelectorAll(".pf-onglet").forEach((b) => {
    b.onclick = () => {
      ongletFormatActif = b.dataset.onglet;
      rendreContenuOngletFormat(fond, formatActuel, appliquer);
    };
  });

  rendreContenuOngletFormat(fond, formatActuel, appliquer);
}

function fermerPanneauFormat() {
  const f = document.getElementById("panneauFormat");
  if (f) f.remove();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerPanneauFormat();
});

function rendreContenuOngletFormat(fond, formatActuel, appliquer) {
  fond.querySelectorAll(".pf-onglet").forEach((b) =>
    b.classList.toggle("actif", b.dataset.onglet === ongletFormatActif));

  const onglet = ONGLETS_FORMAT.find((o) => o.id === ongletFormatActif) || ONGLETS_FORMAT[0];
  const zone = fond.querySelector(".pf-contenu");

  let html = '<div class="pf-choix">' +
    onglet.choix.map((c) =>
      '<button type="button" class="pf-carte-choix' + (c.format === formatActuel ? " actif" : "") + '" data-format="' + c.format + '">' +
        '<span class="pf-choix-nom">' + c.nom + "</span>" +
        '<span class="pf-choix-dims">' + c.dims + "</span>" +
      "</button>"
    ).join("") +
  "</div>";

  if (onglet.personnalise) {
    const persoActuel = dimensionsFormatPersonnalise(formatActuel);
    html +=
      '<div class="pf-perso">' +
        "<h4>Taille personnalisée</h4>" +
        '<p class="pf-perso-aide">En centimètres. Vérifiez que cette taille figure bien dans le catalogue KDP avant d\'envoyer votre fichier à Amazon.</p>' +
        '<div class="pf-perso-champs">' +
          '<label>Largeur <input type="number" id="pfLarg" min="0" step="0.1" inputmode="decimal" value="' +
            (persoActuel ? formaterMmEnCm(persoActuel.larg).replace(",", ".") : "") + '"> cm</label>' +
          '<label>Hauteur <input type="number" id="pfHaut" min="0" step="0.1" inputmode="decimal" value="' +
            (persoActuel ? formaterMmEnCm(persoActuel.haut).replace(",", ".") : "") + '"> cm</label>' +
        "</div>" +
        '<p class="pf-perso-message message"></p>' +
        '<button type="button" class="pf-valider" id="pfValider">Valider ce format</button>' +
      "</div>";
  }

  zone.innerHTML = html;

  zone.querySelectorAll(".pf-carte-choix").forEach((b) => {
    b.onclick = () => appliquer(b.dataset.format);
  });

  const btnValider = zone.querySelector("#pfValider");
  if (btnValider) {
    btnValider.onclick = () => {
      const largCm = parseFloat(zone.querySelector("#pfLarg").value);
      const hautCm = parseFloat(zone.querySelector("#pfHaut").value);
      const message = zone.querySelector(".pf-perso-message");
      if (!isFinite(largCm) || !isFinite(hautCm) || largCm <= 0 || hautCm <= 0) {
        message.textContent = "Indiquez une largeur et une hauteur en centimètres.";
        return;
      }
      appliquer(formatPersonnaliseDepuisCm(largCm, hautCm));
    };
  }
}

// ----- Les feuillets du livre, gardes comprises -----
//
// Une page de garde est un vrai feuillet : elle occupe une place dans le
// livre relié, elle épaissit le dos, et elle décide de quel côté tombe la
// suivante. Mais elle ne porte pas de numéro — dans un livre imprimé, les
// gardes ne sont jamais foliotées.
//
// D'où deux notions qu'il ne faut surtout pas confondre :
//
//   `position` — le rang PHYSIQUE dans le livre (1, 2, 3…). C'est lui, et
//                lui seul, qui dit si la page est un recto (impair, à
//                droite, reliure à gauche) ou un verso. Ajouter UNE garde au
//                début fait donc basculer tout le livre de l'autre côté.
//   `numero`   — le folio IMPRIMÉ. Vide pour une garde ; la première page
//                écrite reste la page 1, quoi qu'on mette devant.
//
// Toute sortie du livre — aperçu, impression page à page, livret, export
// KDP, calcul du dos — passe par ici, pour que les gardes n'existent pas à
// moitié.
const MAX_GARDES = 20;

function nombreGardes(valeur) {
  const n = Math.round(Number(valeur) || 0);
  return Math.max(0, Math.min(MAX_GARDES, n));
}

function feuilletsDuLivre(livre) {
  const pages = (livre && livre.pages) || [];
  const debut = nombreGardes(livre && livre.gardesDebut);
  const fin = nombreGardes(livre && livre.gardesFin);

  const feuillets = [];
  for (let i = 0; i < debut; i++) feuillets.push({ page: null, numero: "", garde: true });
  pages.forEach((page, i) => feuillets.push({ page, numero: i + 1, garde: false }));
  for (let i = 0; i < fin; i++) feuillets.push({ page: null, numero: "", garde: true });

  feuillets.forEach((f, i) => { f.position = i + 1; });
  return feuillets;
}

// ----- Compter les mots d'un passage -----
//
// Le texte d'un passage tel qu'on le LIT, et non tel que textContent le rend.
//
// textContent recolle ce que les balises séparaient : « <h2>Introduction</h2>
// <p>Un monde » devient « IntroductionUn monde », et le livre entier, dont les
// paragraphes sont séparés par « <br><br> », perdait ainsi un mot à chaque
// changement de paragraphe. On rend donc aux ruptures l'espace qu'elles
// occupent à l'écran.
//
// Le remplacement se fait sur le HTML, avant l'analyse, et non sur le DOM
// ensuite : ce compteur tourne à chaque frappe sur toutes les doubles-pages
// de l'éditeur, et insérer un nœud après chaque <br> d'un livre de trois
// cents pages s'y verrait. Une balise citée dans un attribut fausserait le
// compte d'un mot — pour un compteur, c'est sans conséquence.
//
// Ici et non dans editeur.js : la bibliothèque s'en sert aussi pour les
// statistiques d'un livre, et deux copies d'une même règle finiraient par
// diverger — le sommaire n'annoncerait plus le même nombre que la fiche.
const RUPTURES_MOTS = /<(?:br|hr)\b[^>]*>|<\/(?:p|div|li|h[1-6]|blockquote|pre|tr|td|th|figcaption)\s*>/gi;

function texteAvecRuptures(source) {
  const html = typeof source === "string" ? (source || "")
    : (source && source.innerHTML) || "";
  const boite = document.createElement("div");
  boite.innerHTML = html.replace(RUPTURES_MOTS, " ");
  return boite.textContent || "";
}

function compterMots(source) {
  const texte = texteAvecRuptures(source).trim();
  return texte ? texte.split(/\s+/).length : 0;
}

// ----- Collage : garder l'emphase, laisser l'habillage de la source -----
//
// Coller depuis Word, Google Docs ou une page web apporte tout l'habillage
// d'origine : polices, tailles en pixels, couleurs, interlignes, classes.
// Posé tel quel dans une page, ce texte cesserait de suivre la typographie
// du livre et ressortirait à l'impression — c'est pourquoi le collage a
// longtemps été ramené au texte brut.
//
// Mais l'italique d'un titre d'œuvre, d'un mot étranger ou d'une pensée
// n'est pas de l'habillage : il fait partie du texte, et le retaper à la
// main après chaque import est un travail perdu. On garde donc exactement
// les trois emphases que la barre d'outils sait elle-même poser — italique,
// gras, souligné — et on jette tout le reste, attributs compris.

// Balises qui passent à la ligne ; le reste du contenu est rendu en ligne.
const BLOCS_COLLAGE =
  /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DIV|DL|DT|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/;

// Balises dont le contenu n'est pas du texte lisible. Sans cela, la feuille
// de style que Word glisse en tête du presse-papiers serait collée telle
// quelle, sous forme de plusieurs pages de règles CSS.
const IGNORES_COLLAGE = /^(HEAD|LINK|META|NOSCRIPT|SCRIPT|STYLE|TITLE)$/;

// Emphase portée par un élément, à partir de celle héritée de ses parents.
//
// Le style en ligne l'emporte sur la balise, et il le faut : Google Docs
// enveloppe TOUT le presse-papiers dans un « <b style="font-weight:normal"> »,
// qui mettrait sinon le passage entier en gras.
function emphaseElement(el, herite) {
  let { ital, gras, soul } = herite;

  const nom = el.nodeName;
  if (nom === "I" || nom === "EM" || nom === "CITE" || nom === "VAR") ital = true;
  if (nom === "B" || nom === "STRONG") gras = true;
  if (nom === "U" || nom === "INS") soul = true;

  const style = el.style || {};

  const fonte = (style.fontStyle || "").toLowerCase();
  if (fonte === "italic" || fonte === "oblique") ital = true;
  else if (fonte === "normal") ital = false;

  // « bold » / « bolder » / un nombre : au-delà de 600, on considère que
  // l'auteur a voulu du gras, comme le fait le navigateur lui-même.
  const graisse = (style.fontWeight || "").toLowerCase();
  if (graisse) {
    const n = parseInt(graisse, 10);
    if (graisse === "bold" || graisse === "bolder" || n >= 600) gras = true;
    else if (graisse === "normal" || graisse === "lighter" || n > 0) gras = false;
  }

  const trait = (style.textDecorationLine || style.textDecoration || "").toLowerCase();
  if (trait.includes("underline")) soul = true;
  else if (trait.includes("none")) soul = false;

  return { ital, gras, soul };
}

// Un changement de paragraphe vaut DEUX retours, pas un : le livre sépare
// ses paragraphes par une ligne blanche (« <br><br> » à l'intérieur d'un
// même <p>, voir RUPTURES_TEXTE dans editeur.js). Coller un chapitre de
// Wattpad, où chaque paragraphe est un <p>, donnait sinon un texte compact
// dont tous les blancs avaient disparu.
const SAUT_PARAGRAPHE = 2;

// Garde-fou : un document mal formé peut empiler les blocs vides, et la
// page collée commencerait par vingt lignes blanches.
const SAUT_MAX = 4;

// Découpe le HTML du presse-papiers en une suite de passages
// { texte, ital, gras, soul } et de sauts { saut: nombre de retours }.
function morceauxCollage(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const morceaux = [];
  const dernier = () => morceaux[morceaux.length - 1];

  // Les sauts sont mis EN ATTENTE et posés seulement devant le texte
  // suivant. C'est ce qui permet de distinguer les deux sortes de rupture
  // sans compter les balises : un <br> ajoute un retour, une frontière de
  // bloc en exige deux, et une pile de <div> imbriqués n'en produit toujours
  // que deux puisqu'on prend le plus grand des deux et non leur somme. Ce
  // qui reste en attente à la fin n'est jamais posé : pas de lignes vides
  // en queue de collage.
  let attente = 0;
  const finDeBloc = () => { attente = Math.max(attente, SAUT_PARAGRAPHE); };
  const retourSimple = () => { attente += 1; };

  const poserAttente = () => {
    if (attente && morceaux.length) {
      morceaux.push({ saut: Math.min(attente, SAUT_MAX) });
    }
    attente = 0;                    // en tête de collage, on le jette
  };

  // Deux passages voisins de même emphase forment un seul morceau : sans
  // cela, une phrase découpée en vingt <span> par la source donnerait vingt
  // balises imbriquées pour rien.
  const ajouterTexte = (texte, e) => {
    poserAttente();
    const d = dernier();
    if (d && !d.saut && d.ital === e.ital && d.gras === e.gras && d.soul === e.soul) {
      d.texte += texte;
      return;
    }
    morceaux.push({ texte, ital: e.ital, gras: e.gras, soul: e.soul });
  };

  (function parcourir(noeud, herite) {
    for (const enfant of noeud.childNodes) {
      if (enfant.nodeType === 3) {
        // Les retours à la ligne de l'indentation du HTML ne sont pas du
        // texte : le navigateur les rend comme une espace unique.
        const texte = enfant.nodeValue.replace(/[\t\n\r ]+/g, " ");
        if (!texte) continue;

        if (!texte.trim()) {
          // Espace entre deux balises : elle ne compte que si elle sépare
          // vraiment deux passages d'une même ligne — jamais au bord d'un
          // saut, où elle ouvrirait la ligne suivante par un blanc.
          const d = dernier();
          if (!attente && d && !d.saut && !/ $/.test(d.texte)) ajouterTexte(" ", herite);
          continue;
        }
        ajouterTexte(texte, herite);
        continue;
      }
      if (enfant.nodeType !== 1) continue;      // commentaires, etc.

      const nom = enfant.nodeName;
      if (IGNORES_COLLAGE.test(nom)) continue;
      if (nom === "BR") { retourSimple(); continue; }

      const bloc = BLOCS_COLLAGE.test(nom);
      if (bloc) finDeBloc();
      parcourir(enfant, emphaseElement(enfant, herite));
      if (bloc) finDeBloc();
    }
  })(doc.body, { ital: false, gras: false, soul: false });

  return morceaux;
}

// Les mêmes morceaux, à partir d'un texte sans mise en forme : là, chaque
// retour est déjà écrit, il n'y a qu'à les compter.
function morceauxTexteBrut(texte) {
  const morceaux = [];
  let attente = 0;
  texte.replace(/\r\n?/g, "\n").split("\n").forEach((ligne, i) => {
    if (i > 0) attente += 1;
    if (!ligne) return;
    if (attente && morceaux.length) morceaux.push({ saut: Math.min(attente, SAUT_MAX) });
    attente = 0;
    morceaux.push({ texte: ligne, ital: false, gras: false, soul: false });
  });
  return morceaux;
}

function envelopperEmphase(balise, noeud) {
  const el = document.createElement(balise);
  el.appendChild(noeud);
  return el;
}

// Reconstruit le passage collé : du texte, des <br> pour les lignes, et les
// seules balises d'emphase — sans le moindre attribut, donc sans aucun style
// rapporté de la source.
function fragmentCollage(morceaux) {
  const frag = document.createDocumentFragment();
  morceaux.forEach((m) => {
    if (m.saut) {
      for (let i = 0; i < m.saut; i++) frag.appendChild(document.createElement("br"));
      return;
    }
    let noeud = document.createTextNode(m.texte);
    if (m.soul) noeud = envelopperEmphase("u", noeud);
    if (m.gras) noeud = envelopperEmphase("strong", noeud);
    if (m.ital) noeud = envelopperEmphase("em", noeud);
    frag.appendChild(noeud);
  });
  return frag;
}

// Ce qu'il faut insérer pour un collage, ou null s'il n'y a rien à coller.
// Le presse-papiers porte presque toujours les deux formats : on préfère le
// HTML, qui seul connaît les italiques, et on retombe sur le texte brut
// quand la source n'en propose pas (un éditeur de texte simple, par exemple).
function fragmentDepuisPressePapiers(donnees) {
  const html = donnees.getData("text/html");
  if (html && html.trim()) {
    const morceaux = morceauxCollage(html);
    if (morceaux.length) return fragmentCollage(morceaux);
  }
  const texte = donnees.getData("text/plain");
  if (!texte) return null;
  const morceaux = morceauxTexteBrut(texte);
  return morceaux.length ? fragmentCollage(morceaux) : null;
}

// Même contenu, rendu en HTML : pour les zones qui insèrent par
// « insertHTML » afin de rester annulables par Ctrl+Z.
function htmlDepuisPressePapiers(donnees) {
  const frag = fragmentDepuisPressePapiers(donnees);
  if (!frag) return null;
  const boite = document.createElement("div");
  boite.appendChild(frag);
  return boite.innerHTML;
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
