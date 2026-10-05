// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerBibliotheque: "Ouverture de la bibliothèque…",
  creerLivre: "Création du livre…",
  supprimerLivre: "Suppression du livre…",
  enregistrerNom: "Enregistrement du pseudo…",
});
// ouvrirStatsLivre n'y figure pas : elle montre son propre voile dans la
// fenêtre (« Lecture du livre… »), et un voile de page par-dessus cacherait
// justement ce qu'on vient d'ouvrir.

// La bibliothèque ne descend QUE les métadonnées des livres : un titre, une
// vignette et un nombre de pages. Le texte (les double-pages) reste en base
// jusqu'à ce qu'on ouvre un livre dans l'éditeur — ouvrir la bibliothèque ne
// rapatrie donc plus tous les manuscrits d'un coup, comme le faisait le
// fichier JSON unique.
let bibliotheque = null;
let moiCentral = null;   // la ligne du compte (pseudo, rôle, tutoriels vus)

async function chargerBibliotheque() {
  const message = document.getElementById("message");
  if (!exigerConnexion()) return;

  try {
    bibliotheque = await chargerBibliothequeMeta();
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  // Le pseudo affiché vient du compte, pas d'une copie locale figée à la
  // dernière connexion.
  moiCentral = await rafraichirIdentiteCentrale();

  // Les séries ne sont qu'un classement : si leur lecture échoue, la
  // bibliothèque doit rester utilisable. On note l'incident et on continue.
  try {
    series = await chargerSeries();
  } catch (erreur) {
    series = [];
    message.textContent = "Séries indisponibles : " + erreur.message;
  }

  afficherSeries();
  afficherListeLivres();
  restaurerOngletBiblio();

  // Tutoriel de bienvenue au tout premier lancement (une seule fois).
  setTimeout(() => lancerTutorielBiblio(false), 500);
}

// Persiste « tutoriel vu » sur le compte, pour qu'il ne réapparaisse jamais,
// même sur un autre appareil.
async function marquerTutoVu(champ) {
  await marquerTutoVuDistant(champ);
  if (moiCentral) moiCentral[champ === "biblio" ? "tuto_biblio_vu" : "tuto_editeur_vu"] = true;
}

function lancerTutorielBiblio(forcer) {
  if (typeof lancerTutoriel !== "function") return;
  lancerTutoriel([
    { cible: null, titre: "Bienvenue 👋",
      texte: "Voici votre bibliothèque. Ce petit guide vous montre comment créer votre premier livre et où trouver les outils. Utilisez « Suivant »." },
    { cible: ".profil-in", titre: "Votre profil",
      texte: "Votre nom d'affichage et vos statistiques (nombre de livres et de pages). Le crayon ✎ permet de changer votre nom." },
    { cible: ".creer-livre", titre: "Créer un livre",
      texte: "Tout part d'ici : un titre, un format, et le bouton « Créer un livre »." },
    { cible: "#titreNouveauLivre", titre: "Le titre",
      texte: "Saisissez le titre de votre nouveau livre." },
    { cible: "#formatNouveauLivre", titre: "Le format",
      texte: "Choisissez la taille des pages (Roman, Grand roman, Poche, A4). Vous pourrez la changer plus tard dans l'éditeur." },
    { cible: "#listeLivres", titre: "Vos livres",
      texte: "Vos livres s'afficheront ici avec leur couverture. Cliquez sur l'un d'eux pour l'ouvrir dans l'éditeur, ou sur la petite ligne « format · pages » sous son titre pour voir ses statistiques : mots, chapitres, temps de lecture." },
    { cible: null, titre: "À vous de jouer ✍️",
      texte: "Créez votre premier livre, puis ouvrez-le : un second guide vous présentera tous les outils d'écriture. Bonne écriture !" }
  ], {
    forcer: forcer,
    dejaVu: tutoDejaVu(moiCentral, "biblio"),
    onTermine: () => marquerTutoVu("biblio")
  });
}

function echapper(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function nomAffiche() {
  const login = localStorage.getItem("team53_login") || "";
  const perso = (localStorage.getItem("team53_nom") || "").trim();
  return perso || login || "Auteur";
}

function initialesDe(nom) {
  const mots = (nom || "").trim().split(/\s+/).filter(Boolean);
  let ini;
  if (mots.length >= 2) ini = mots[0][0] + mots[1][0];
  else ini = (nom || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  return (ini || "?").toUpperCase();
}

function remplirProfil() {
  const nom = nomAffiche();

  const elAvatar = document.getElementById("avatarInitiales");
  const elNom = document.getElementById("profilNom");
  const elLivres = document.getElementById("statLivres");
  const elPages = document.getElementById("statPages");

  if (elAvatar) elAvatar.textContent = initialesDe(nom);
  if (elNom) elNom.textContent = nom;

  // Bouton de gestion des utilisateurs réservé aux admins
  const btnAdmin = document.getElementById("btnAdmin");
  if (btnAdmin) btnAdmin.style.display = estAdminCentral() ? "" : "none";

  // nbPages vient de la colonne du même nom : le texte des livres n'est pas
  // chargé ici, on ne peut donc plus compter les pages soi-même.
  const livres = (bibliotheque && bibliotheque.livres) || [];
  const totalPages = livres.reduce((n, l) => n + (l.nbPages || 0), 0);
  if (elLivres) elLivres.textContent = livres.length;
  if (elPages) elPages.textContent = totalPages;
}

// La couverture d'un livre en vignette : sa couleur, son titre, son auteur, et
// son image de fond s'il en a une.
//
// Écrite une fois pour trois usages — la grille des livres, les boutons de
// séries et les lignes de tomes — plutôt que recopiée : trois copies d'un
// même rendu finissent toujours par se contredire. `classe` ne règle que la
// TAILLE (voir .vignette-serie / .vignette-mini dans site.css) ; ce que fait
// un clic est l'affaire de l'appelant.
function creerCouvertureLivre(livre, classe) {
  const couv = livre.couverture || {};
  const afficherTitre = couv.afficherTitre !== false;
  const afficherAuteur = couv.afficherAuteur !== false && livre.auteur;

  const div = document.createElement("div");
  div.className = "livre-couv" + (classe ? " " + classe : "");
  div.style.background = couv.fond || "#1a1a2e";
  div.style.color = couv.texte || "#ffffff";
  div.innerHTML =
    (afficherTitre ? `<div class="c-titre" style="${styleTexteCouv(couv, 'titre')}">${echapper(livre.titre || "Sans titre")}</div>` : "") +
    (afficherAuteur ? `<div class="c-auteur" style="${styleTexteCouv(couv, 'auteur')}">${echapper(livre.auteur)}</div>` : "");

  // Si la couverture a une image de fond, on l'affiche par-dessus la couleur.
  // Sinon, on garde la couleur (ou le blanc) : rien à charger.
  if (couv.imageChemin) chargerImageCouvVignette(div, couv.imageChemin, livre.format, couv);
  return div;
}

function afficherListeLivres() {
  remplirProfil();

  const liste = document.getElementById("listeLivres");
  const compte = document.getElementById("compteLivres");
  if (compte) compte.textContent = bibliotheque.livres.length;
  liste.innerHTML = "";

  if (bibliotheque.livres.length === 0) {
    const vide = document.createElement("li");
    vide.className = "livres-vide";
    vide.innerHTML =
      '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#c9b98f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5C10.5 4.3 8.3 3.8 6 4c-1 .1-2 .3-3 .6v14c1-.3 2-.5 3-.6 2.3-.2 4.5.3 6 1.5 1.5-1.2 3.7-1.7 6-1.5 1 .1 2 .3 3 .6V4.6c-1-.3-2-.5-3-.6-2.3-.2-4.5.3-6 1.5Z"/><path d="M12 5.5v14"/></svg>' +
      "<div>Aucun livre pour l'instant.<br>Créez votre premier livre ci-dessous.</div>";
    liste.appendChild(vide);
    return;
  }

  bibliotheque.livres.forEach((livre) => {
    const nbPages = livre.nbPages || 0;
    const labelFormat = libelleFormatCourt(livre.format);

    const li = document.createElement("li");
    li.className = "livre-carte";

    const couvDiv = creerCouvertureLivre(livre);
    couvDiv.title = "Ouvrir « " + (livre.titre || "") + " »";
    couvDiv.onclick = () => ouvrirLivre(livre.id);
    li.appendChild(couvDiv);

    const meta = document.createElement("div");
    meta.className = "livre-meta";
    meta.innerHTML =
      `<span class="l-titre">${echapper(livre.titre || "Sans titre")}</span>` +
      `<span class="l-detail">${labelFormat} · ${nbPages} p.</span>`;
    meta.querySelector(".l-titre").onclick = () => ouvrirLivre(livre.id);
    li.appendChild(meta);

    // Le détail chiffré du livre : la ligne « format · pages » l'annonce déjà
    // en petit, autant en faire la porte d'entrée plutôt que d'ajouter un
    // bouton de plus sur une carte qui n'en a pas la place.
    const detail = meta.querySelector(".l-detail");
    detail.classList.add("cliquable-stats");
    detail.title = "Voir les statistiques de « " + (livre.titre || "") + " »";
    detail.setAttribute("role", "button");
    detail.setAttribute("tabindex", "0");
    detail.onclick = (e) => { e.stopPropagation(); ouvrirStatsLivre(livre.id); };
    detail.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirStatsLivre(livre.id); }
    };

    // Renommer : le titre ne se changeait que dans l'éditeur de couverture,
    // une fois le livre ouvert — autant dire nulle part.
    const btnRenommer = document.createElement("button");
    btnRenommer.className = "livre-renommer";
    btnRenommer.textContent = "✎";
    btnRenommer.title = "Renommer ce livre";
    btnRenommer.setAttribute("aria-label", "Renommer « " + (livre.titre || "") + " »");
    btnRenommer.onclick = (e) => { e.stopPropagation(); renommerLivre(livre.id); };
    li.appendChild(btnRenommer);

    // Les notes du livre : une page d'idées, privée (voir notes.js). L'icône est
    // un dessin et non un caractère : aucun des symboles unicode d'une page de
    // texte n'est assez net à 14 px à côté de ⧉ ✎ ✕.
    const btnNotes = document.createElement("button");
    btnNotes.className = "livre-notes";
    btnNotes.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>' +
      '<path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>';
    btnNotes.title = "Notes de ce livre";
    btnNotes.setAttribute("aria-label", "Notes de « " + (livre.titre || "") + " »");
    btnNotes.onclick = (e) => { e.stopPropagation(); ouvrirNotesLivre(livre.id, livre.titre, btnNotes); };
    li.appendChild(btnNotes);

    const btnDupliquer = document.createElement("button");
    btnDupliquer.className = "livre-dupliquer";
    btnDupliquer.textContent = "⧉";
    btnDupliquer.title = "Dupliquer ce livre";
    btnDupliquer.setAttribute("aria-label", "Dupliquer « " + (livre.titre || "") + " »");
    btnDupliquer.onclick = (e) => { e.stopPropagation(); dupliquerLivre(livre.id); };
    li.appendChild(btnDupliquer);

    const btnSuppr = document.createElement("button");
    btnSuppr.className = "livre-suppr";
    btnSuppr.textContent = "✕";
    btnSuppr.title = "Supprimer ce livre";
    btnSuppr.onclick = (e) => { e.stopPropagation(); supprimerLivre(livre.id); };
    li.appendChild(btnSuppr);

    liste.appendChild(li);
  });
}

// ----- Dupliquer un livre -----
//
// Le doublon est un livre neuf, indépendant : son texte, ses réglages et ses
// visuels sont à lui. Trois choses ne se recopient PAS, et c'est délibéré :
//
//   - la publication — un brouillon de travail n'a aucune raison de paraître
//     publié le jour de sa création ;
//   - le rattachement à une série — le doublon prendrait le numéro de tome de
//     l'original, et la série afficherait deux « Tome 3 » ;
//   - les images, qui sont COPIÉES et non partagées : supprimer un livre
//     supprime ses fichiers, et un chemin commun ferait disparaître la
//     couverture de l'autre.

// Le chemin d'un visuel du nouveau livre, à la convention du bucket :
// <compte>/<id du livre>_<face>.<extension> (voir script.js).
function cheminVisuelCopie(urlSource, nouvelId, face) {
  const source = cheminDepuisUrlStorage(urlSource) || String(urlSource || "");
  const ext = (source.split(".").pop() || "jpg").toLowerCase();
  return `${obtenirPrefixeImagesUtilisateur()}/${nouvelId}_${face}.${ext}`;
}

async function dupliquerLivre(id) {
  const message = document.getElementById("message");
  const meta = bibliotheque.livres.find((l) => l.id === id);
  if (!meta) return;

  if (!confirm("Dupliquer « " + (meta.titre || "Sans titre") + " » ?\n\n" +
      "Le doublon reprend le texte, la mise en page, les couvertures et les notes, " +
      "mais ne sera ni publié ni rattaché à une série.")) {
    return;
  }

  message.textContent = "Duplication en cours…";
  try {
    // La bibliothèque n'a que les métadonnées : il faut le texte pour le copier.
    const source = await chargerLivreComplet(id);
    const nouvelId = "l" + Date.now();

    const nouveau = {
      id: nouvelId,
      titre: (source.titre || "Sans titre") + " (copie)",
      auteur: source.auteur || "",
      format: source.format,
      espaceTitre: source.espaceTitre,
      gardesDebut: source.gardesDebut,
      gardesFin: source.gardesFin,
      couverture: source.couverture ? Object.assign({}, source.couverture) : undefined,
      quatrieme: source.quatrieme ? Object.assign({}, source.quatrieme) : undefined,
      tranche: source.tranche ? Object.assign({}, source.tranche) : undefined,
      pages: Array.isArray(source.pages) ? source.pages.map((p) => Object.assign({}, p)) : [],
      spreads: Array.isArray(source.spreads) ? source.spreads.slice() : [""],
      nbPages: source.nbPages || 0,
      publie: false,
      publieLe: null,
      serieId: null,
      tome: null
    };

    // Les visuels, un par un. Une copie qui échoue ne doit pas emporter la
    // duplication — on préfère un doublon sans image à pas de doublon du tout
    // — mais elle ne doit pas non plus passer sous silence : sans le dire, on
    // laisserait croire que la couverture a été reprise. Et surtout, jamais
    // de repli sur le chemin de l'original : supprimer un livre supprime ses
    // fichiers, et l'autre perdrait sa couverture.
    const manquantes = [];
    for (const face of ["couverture", "quatrieme", "tranche"]) {
      const data = nouveau[face];
      if (!data || !data.imageChemin) continue;
      try {
        data.imageChemin = await copierImageStorage(
          data.imageChemin, cheminVisuelCopie(data.imageChemin, nouvelId, face));
      } catch (e) {
        delete data.imageChemin;
        manquantes.push(face === "quatrieme" ? "4e de couverture" : face);
      }
    }

    // Les notes appartiennent au livre : le doublon les reprend, comme son texte.
    // Elles sont lues AVANT la création (rien ne dépend encore du nouveau livre)
    // mais écrites APRÈS : la règle de la base n'accepte des notes que sur un
    // livre qui existe et qui est à soi. Leur échec ne défait pas la duplication
    // — le livre existe, c'est le plus précieux —, mais il est dit.
    let notes = null, notesManquantes = false;
    try { notes = await chargerNotesLivre(id); } catch (e) { notesManquantes = true; }

    await creerLivreDistant(nouveau);
    if (notes && notes.contenu) {
      try { await enregistrerNotesLivre(nouvelId, notes.contenu, null); }
      catch (e) { notesManquantes = true; }
    }
    bibliotheque.livres.push(nouveau);
    afficherListeLivres();
    afficherSeries();

    const incidents = [];
    if (manquantes.length) incidents.push("sans " + manquantes.join(", ") + " (image non copiée)");
    if (notesManquantes) incidents.push("sans ses notes (non copiées)");
    message.textContent = incidents.length
      ? "Livre dupliqué, mais " + incidents.join(" et ") + "."
      : "Livre dupliqué : « " + nouveau.titre + " ».";
    setTimeout(() => {
      if (message.textContent.startsWith("Livre dupliqué")) message.textContent = "";
    }, 6000);
  } catch (erreur) {
    message.textContent = "Duplication impossible : " + erreur.message;
  }
}

// ----- Renommer un livre -----
//
// Le titre est aussi celui imprimé sur la couverture : c'est la même donnée,
// et la changer ici la change là-bas. On ne touche QUE le titre
// (mettreAJourLivre), jamais le manuscrit — la bibliothèque n'a pas le texte
// en mémoire, et l'enregistrement complet le refuserait justement.
async function renommerLivre(id) {
  const livre = bibliotheque.livres.find((l) => l.id === id);
  if (!livre) return;

  const saisi = prompt("Nouveau titre du livre :", livre.titre || "");
  if (saisi === null) return;                       // annulé
  const titre = saisi.trim();
  if (!titre || titre === livre.titre) return;      // vide ou inchangé : rien à faire

  const message = document.getElementById("message");
  try {
    // mettreAJourLivre pose l'horodatage lui-même : le lui passer serait
    // désormais refusé comme un champ inconnu.
    await mettreAJourLivre(id, { titre });
  } catch (e) {
    message.textContent = "Renommage impossible : " + e.message;
    return;
  }
  livre.titre = titre;
  afficherListeLivres();
  afficherSeries();
  message.textContent = "Livre renommé.";
  setTimeout(() => { if (message.textContent === "Livre renommé.") message.textContent = ""; }, 3000);
}

// =====================================================================
//  Séries : plusieurs tomes d'une même histoire
//
//  Une série RANGE des livres et porte le résumé d'ensemble ; elle ne les
//  contient pas. Chaque tome reste listé dans « Mes livres » et s'ouvre,
//  s'imprime et se publie exactement comme avant — supprimer une série ne
//  supprime donc aucun manuscrit.
// =====================================================================

let series = [];
let serieEnEdition = null;   // l'id de la série ouverte, ou null si c'est une création
let tomesEnEdition = [];     // les ids des livres, dans l'ordre choisi

function livreParId(id) {
  return bibliotheque.livres.find((l) => l.id === id) || null;
}

// Les tomes d'une série, dans l'ordre. `tome` fait foi ; à défaut (un livre
// rattaché sans numéro), on retombe sur l'ordre de création.
function tomesDeLaSerie(serieId) {
  return bibliotheque.livres
    .filter((l) => l.serieId === serieId)
    .sort((a, b) => {
      const ta = typeof a.tome === "number" ? a.tome : Infinity;
      const tb = typeof b.tome === "number" ? b.tome : Infinity;
      if (ta !== tb) return ta - tb;
      return String(a.dateCreation || "").localeCompare(String(b.dateCreation || ""));
    });
}

// ----- Les deux onglets -----
//
// Un résumé de série tient plusieurs paragraphes : empilés sous les livres,
// ils poussaient la grille hors de l'écran. L'onglet choisi est mémorisé sur
// l'appareil — on revient souvent d'un livre vers la liste, et retomber
// chaque fois sur l'autre onglet serait pénible.
const CLE_ONGLET_BIBLIO = "el_ongletBiblio";

function choisirOngletBiblio(nom) {
  const cible = nom === "series" ? "series" : "livres";
  try { localStorage.setItem(CLE_ONGLET_BIBLIO, cible); } catch (e) {}

  [["livres", "ongletLivres", "panneauLivres"], ["series", "ongletSeries", "panneauSeries"]]
    .forEach(([id, ongletId, panneauId]) => {
      const onglet = document.getElementById(ongletId);
      const panneau = document.getElementById(panneauId);
      const actif = id === cible;
      if (onglet) {
        onglet.classList.toggle("actif", actif);
        onglet.setAttribute("aria-selected", actif ? "true" : "false");
      }
      if (panneau) panneau.hidden = !actif;
    });
}

function restaurerOngletBiblio() {
  let choix = "livres";
  try { choix = localStorage.getItem(CLE_ONGLET_BIBLIO) || "livres"; } catch (e) {}
  // Retomber sur les livres si l'onglet mémorisé n'a plus rien à montrer :
  // arriver sur une page vide donne l'impression d'avoir tout perdu.
  if (choix === "series" && !series.length) choix = "livres";
  choisirOngletBiblio(choix);
}

// ----- La vue des séries : des boutons, puis le détail de celle qu'on ouvre -----
//
// L'onglet a deux vues. La LISTE montre chaque série sous forme de bouton —
// ses couvertures, son titre, le nombre de tomes — et le DÉTAIL, atteint d'un
// clic, porte ce qui n'a pas sa place dans un bouton : le résumé de l'histoire
// et les tomes dans l'ordre de lecture. Empilés sur la même page, le résumé de
// chaque série repoussait la suivante hors de l'écran.
//
// `serieOuverte` est l'id de la série dont on lit le détail, ou null pour la
// liste. Tout appelant qui change une série ou un livre se contente de rappeler
// afficherSeries() : la vue courante est conservée, et se corrige d'elle-même
// si la série affichée a disparu.
let serieOuverte = null;

const nbFr = (n) => Number(n || 0).toLocaleString("fr-FR");

function resumeTomes(tomes) {
  const pages = tomes.reduce((somme, l) => somme + (l.nbPages || 0), 0);
  return tomes.length + (tomes.length > 1 ? " tomes" : " tome") +
    (pages ? " · " + nbFr(pages) + " pages" : "");
}

function afficherSeries() {
  const compte = document.getElementById("compteSeries");
  if (compte) compte.textContent = series.length;

  // Une série supprimée ou introuvable ne se lit plus : retour à la liste.
  if (serieOuverte && !series.some((s) => s.id === serieOuverte)) serieOuverte = null;

  const vueListe = document.getElementById("vueListeSeries");
  const vueDetail = document.getElementById("vueDetailSerie");
  if (!vueListe || !vueDetail) return;
  vueListe.hidden = !!serieOuverte;
  vueDetail.hidden = !serieOuverte;

  if (serieOuverte) afficherDetailSerie(series.find((s) => s.id === serieOuverte), vueDetail);
  else afficherListeSeries();
}

function afficherListeSeries() {
  const liste = document.getElementById("listeSeries");
  if (!liste) return;
  liste.innerHTML = "";

  if (!series.length) {
    const vide = document.createElement("li");
    vide.className = "livres-vide";
    vide.innerHTML =
      "<div>Aucune série pour l'instant.<br>Une série regroupe les tomes d'une même " +
      "histoire et porte son résumé.<br>Vos livres, eux, restent listés dans « Mes livres ».</div>";
    liste.appendChild(vide);
    return;
  }

  series.forEach((serie) => {
    const tomes = tomesDeLaSerie(serie.id);

    const li = document.createElement("li");
    const bouton = document.createElement("div");
    bouton.className = "serie-bouton";
    bouton.setAttribute("role", "button");
    bouton.setAttribute("tabindex", "0");
    bouton.setAttribute("aria-label",
      "Ouvrir la série « " + (serie.titre || "sans titre") + " », " + resumeTomes(tomes));

    // Les couvertures : celle du premier tome en grand, celles des deux
    // suivants en petit à côté. Une série sans tome n'en montre aucune.
    const couvs = document.createElement("div");
    couvs.className = "serie-couvs";
    if (tomes.length) {
      couvs.appendChild(creerCouvertureLivre(tomes[0], "vignette-serie"));
      if (tomes.length > 1) {
        const minis = document.createElement("div");
        minis.className = "serie-minis";
        tomes.slice(1, 3).forEach((l) => minis.appendChild(creerCouvertureLivre(l, "vignette-mini")));
        couvs.appendChild(minis);
      }
    } else {
      const vide = document.createElement("div");
      vide.className = "serie-sans-couv";
      vide.textContent = "▭";
      couvs.appendChild(vide);
    }
    bouton.appendChild(couvs);

    const infos = document.createElement("div");
    infos.className = "serie-infos";
    infos.innerHTML =
      '<span class="serie-nom">' + echapper(serie.titre || "Série sans titre") + "</span>" +
      '<span class="serie-meta">' + resumeTomes(tomes) + "</span>" +
      (serie.resume ? '<span class="serie-extrait">' + echapper(serie.resume) + "</span>" : "");
    bouton.appendChild(infos);

    const fleche = document.createElement("span");
    fleche.className = "serie-fleche";
    fleche.setAttribute("aria-hidden", "true");
    fleche.textContent = "›";
    bouton.appendChild(fleche);

    const ouvrir = () => ouvrirDetailSerie(serie.id);
    bouton.onclick = ouvrir;
    bouton.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
    };

    li.appendChild(bouton);
    liste.appendChild(li);
  });
}

function afficherDetailSerie(serie, conteneur) {
  const tomes = tomesDeLaSerie(serie.id);
  conteneur.innerHTML = "";

  const retour = document.createElement("button");
  retour.type = "button";
  retour.className = "serie-retour";
  retour.innerHTML = '<span aria-hidden="true">←</span> Séries';
  retour.onclick = fermerDetailSerie;
  conteneur.appendChild(retour);

  const titre = document.createElement("h3");
  titre.className = "serie-detail-titre";
  titre.textContent = serie.titre || "Série sans titre";
  conteneur.appendChild(titre);

  // Le résumé, replié au-delà de quelques lignes : il peut faire plusieurs
  // paragraphes, et pousserait les tomes — ce qu'on vient chercher — hors de
  // l'écran. Le bouton n'existe que si le texte est assez long pour être coupé.
  if (serie.resume) {
    const resume = document.createElement("p");
    resume.className = "serie-detail-resume";
    resume.textContent = serie.resume;
    conteneur.appendChild(resume);

    if (serie.resume.length > SEUIL_RESUME_REPLIE) {
      resume.classList.add("replie");
      const suite = document.createElement("button");
      suite.type = "button";
      suite.className = "serie-lire-suite";
      suite.textContent = "Lire la suite";
      suite.setAttribute("aria-expanded", "false");
      suite.onclick = () => {
        const replie = resume.classList.toggle("replie");
        suite.textContent = replie ? "Lire la suite" : "Réduire";
        suite.setAttribute("aria-expanded", replie ? "false" : "true");
      };
      conteneur.appendChild(suite);
    }
  }

  const meta = document.createElement("p");
  meta.className = "serie-detail-meta";
  meta.textContent = resumeTomes(tomes);
  conteneur.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "serie-detail-actions";
  [
    ["+ Ajouter des livres", "btn btn-primaire", () => ouvrirEditionSerie(serie.id, "ajout")],
    ["Modifier la série", "btn btn-fantome", () => ouvrirEditionSerie(serie.id)],
    ["Supprimer la série", "btn btn-danger", () => supprimerSerie(serie.id)]
  ].forEach(([libelle, classe, action]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = classe;
    b.textContent = libelle;
    b.onclick = action;
    actions.appendChild(b);
  });
  conteneur.appendChild(actions);

  const ol = document.createElement("ol");
  ol.className = "serie-detail-tomes";
  if (!tomes.length) {
    const vide = document.createElement("li");
    vide.className = "serie-vide";
    vide.textContent = "Aucun tome pour l'instant : ajoutez-en avec « Ajouter des livres ».";
    ol.appendChild(vide);
  }

  // L'ordre affiché fait foi : le rang, et non le numéro stocké, qui peut avoir
  // des trous si un livre a été retiré depuis (voir enregistrerSerie).
  tomes.forEach((livre, i) => {
    const li = document.createElement("li");
    const ligne = document.createElement("div");
    ligne.className = "serie-tome-rang";
    ligne.setAttribute("role", "button");
    ligne.setAttribute("tabindex", "0");
    ligne.setAttribute("aria-label", "Tome " + (i + 1) + " : ouvrir « " + (livre.titre || "Sans titre") + " »");

    const couv = creerCouvertureLivre(livre, "vignette-tome");
    ligne.appendChild(couv);

    const textes = document.createElement("div");
    textes.className = "tome-textes";
    const resumeLivre = livre.quatrieme && livre.quatrieme.resumeTexte
      ? String(livre.quatrieme.resumeTexte).trim() : "";
    textes.innerHTML =
      '<span class="tome-rang">Tome ' + (i + 1) + "</span>" +
      '<span class="tome-titre">' + echapper(livre.titre || "Sans titre") + "</span>" +
      '<span class="tome-detail">' + echapper(libelleFormatCourt(livre.format)) + " · " +
        nbFr(livre.nbPages || 0) + " pages" +
        (livre.publie ? " · publié" : "") + "</span>" +
      (resumeLivre ? '<span class="tome-resume">' + echapper(resumeLivre) + "</span>" : "");
    ligne.appendChild(textes);

    const ouvrir = () => ouvrirLivre(livre.id);
    ligne.onclick = ouvrir;
    ligne.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
    };
    li.appendChild(ligne);
    ol.appendChild(li);
  });
  conteneur.appendChild(ol);
}

// Au-delà, le résumé est replié derrière « Lire la suite ». En nombre de
// caractères plutôt qu'en mesurant le texte : la mesure exige que l'onglet soit
// affiché, ce qu'il n'est pas au moment où l'on construit la vue.
const SEUIL_RESUME_REPLIE = 280;

function ouvrirDetailSerie(id) {
  serieOuverte = id;
  afficherSeries();
  // Le détail remplace la liste : on revient en haut, et le focus suit, pour
  // que le clavier ne reste pas sur un bouton qui n'existe plus à l'écran.
  window.scrollTo(0, 0);
  const retour = document.querySelector("#vueDetailSerie .serie-retour");
  if (retour) retour.focus();
}

function fermerDetailSerie() {
  const id = serieOuverte;
  serieOuverte = null;
  afficherSeries();
  // On retombe sur le bouton de la série qu'on vient de quitter, pas en haut de
  // la liste : avec plusieurs séries, perdre sa place obligerait à la retrouver.
  const boutons = [...document.querySelectorAll("#listeSeries .serie-bouton")];
  const rang = series.findIndex((s) => s.id === id);
  if (boutons[rang]) boutons[rang].focus();
}

// ----- La fenêtre : créer ou modifier une série -----

// `cible` choisit où tombe le focus : « ajout » mène droit au menu d'ajout d'un
// livre, pour le bouton « Ajouter des livres » du détail — y arriver par le
// champ du titre obligerait à descendre jusqu'au menu pour faire ce qu'on
// vient de demander.
function ouvrirEditionSerie(id, cible) {
  const modal = document.getElementById("modalSerie");
  if (!modal) return;

  const serie = id ? series.find((s) => s.id === id) : null;
  serieEnEdition = serie ? serie.id : null;
  tomesEnEdition = serie ? tomesDeLaSerie(serie.id).map((l) => l.id) : [];

  document.getElementById("serieTitreFenetre").textContent =
    serie ? "Modifier la série" : "Nouvelle série";
  document.getElementById("serieTitre").value = serie ? serie.titre : "";
  document.getElementById("serieResume").value = serie ? serie.resume : "";
  document.getElementById("serieMessage").textContent = "";
  // Rien à supprimer tant que la série n'existe pas.
  document.getElementById("serieSupprimer").hidden = !serie;

  rendreTomesEnEdition();
  modal.style.display = "flex";

  const menu = document.getElementById("serieAjoutLivre");
  if (cible === "ajout" && menu && !menu.disabled) {
    menu.focus();
    menu.scrollIntoView({ block: "center" });
  } else {
    document.getElementById("serieTitre").focus();
  }
}

function fermerEditionSerie() {
  const modal = document.getElementById("modalSerie");
  if (modal) modal.style.display = "none";
  serieEnEdition = null;
  tomesEnEdition = [];
}

// La liste des tomes choisis, et le menu des livres encore disponibles.
function rendreTomesEnEdition() {
  const ul = document.getElementById("serieTomes");
  const menu = document.getElementById("serieAjoutLivre");
  if (!ul || !menu) return;

  ul.innerHTML = "";
  tomesEnEdition.forEach((livreId, i) => {
    const livre = livreParId(livreId);
    const li = document.createElement("li");
    li.className = "serie-tome-ligne";

    const num = document.createElement("span");
    num.className = "serie-tome-num";
    num.textContent = "Tome " + (i + 1);
    li.appendChild(num);

    const nom = document.createElement("span");
    nom.className = "serie-tome-nom";
    nom.textContent = livre ? (livre.titre || "Sans titre") : "(livre introuvable)";
    li.appendChild(nom);

    const monter = document.createElement("button");
    monter.type = "button";
    monter.className = "btn-mini";
    monter.textContent = "↑";
    monter.title = "Monter d'un rang";
    monter.disabled = i === 0;
    monter.onclick = () => { deplacerTome(i, -1); };
    li.appendChild(monter);

    const descendre = document.createElement("button");
    descendre.type = "button";
    descendre.className = "btn-mini";
    descendre.textContent = "↓";
    descendre.title = "Descendre d'un rang";
    descendre.disabled = i === tomesEnEdition.length - 1;
    descendre.onclick = () => { deplacerTome(i, 1); };
    li.appendChild(descendre);

    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "btn-mini";
    retirer.textContent = "Retirer";
    retirer.title = "Retirer de la série (le livre n'est pas supprimé)";
    retirer.onclick = () => {
      tomesEnEdition.splice(i, 1);
      rendreTomesEnEdition();
    };
    li.appendChild(retirer);

    ul.appendChild(li);
  });

  if (!tomesEnEdition.length) {
    const vide = document.createElement("li");
    vide.className = "serie-vide";
    vide.textContent = "Aucun tome. Ajoutez-en un ci-dessous.";
    ul.appendChild(vide);
  }

  // Un livre ne peut appartenir qu'à une série : on ne propose donc que les
  // livres libres, plus ceux déjà rattachés à CELLE-CI (pour pouvoir les
  // retirer puis les remettre sans quitter la fenêtre).
  const dispo = bibliotheque.livres.filter((l) =>
    !tomesEnEdition.includes(l.id) && (!l.serieId || l.serieId === serieEnEdition));

  menu.innerHTML = "";
  if (!dispo.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Aucun livre disponible";
    menu.appendChild(opt);
    menu.disabled = true;
  } else {
    menu.disabled = false;
    dispo.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.titre || "Sans titre";
      menu.appendChild(opt);
    });
  }
}

function deplacerTome(i, sens) {
  const j = i + sens;
  if (j < 0 || j >= tomesEnEdition.length) return;
  const tmp = tomesEnEdition[i];
  tomesEnEdition[i] = tomesEnEdition[j];
  tomesEnEdition[j] = tmp;
  rendreTomesEnEdition();
}

function ajouterTomeAlaSerie() {
  const menu = document.getElementById("serieAjoutLivre");
  if (!menu || !menu.value) return;
  tomesEnEdition.push(menu.value);
  rendreTomesEnEdition();
}

async function enregistrerSerie() {
  const message = document.getElementById("serieMessage");
  const titre = document.getElementById("serieTitre").value.trim();
  const resume = document.getElementById("serieResume").value.trim();

  if (!titre) {
    message.textContent = "Donnez un titre à la série.";
    document.getElementById("serieTitre").focus();
    return;
  }

  // Hors du try : l'identifiant sert aussi APRÈS l'enregistrement, pour ouvrir
  // la série qu'on vient de créer.
  let id = serieEnEdition;
  try {
    if (id) {
      await mettreAJourSerie(id, { titre, resume: resume || null });
      const s = series.find((x) => x.id === id);
      if (s) { s.titre = titre; s.resume = resume; }
    } else {
      id = await creerSerieDistante(titre, resume);
      series.push({ id, titre, resume, dateCreation: new Date().toISOString() });
    }

    // Les livres qui étaient dans la série et n'y sont plus : on les détache.
    const avant = tomesDeLaSerie(id).map((l) => l.id);
    const retires = avant.filter((livreId) => !tomesEnEdition.includes(livreId));

    for (const livreId of retires) {
      await definirSerieDuLivre(livreId, null);
      const l = livreParId(livreId);
      if (l) { l.serieId = null; l.tome = null; }
    }
    // Puis on (re)numérote ceux qui restent, dans l'ordre affiché.
    for (let i = 0; i < tomesEnEdition.length; i++) {
      const livreId = tomesEnEdition[i];
      await definirSerieDuLivre(livreId, id, i + 1);
      const l = livreParId(livreId);
      if (l) { l.serieId = id; l.tome = i + 1; }
    }
  } catch (e) {
    message.textContent = "Enregistrement impossible : " + e.message;
    return;
  }

  // On a modifié ou créé une série : on l'ouvre, pour voir ce que l'on vient de
  // faire — ses tomes dans l'ordre choisi — plutôt que de ramener à la liste.
  // Cela vaut aussi quand on partait de l'onglet des livres.
  fermerEditionSerie();
  serieOuverte = id;
  afficherSeries();
  afficherListeLivres();
  choisirOngletBiblio("series");
}

// Le bouton de la fenêtre d'édition : supprime la série qu'elle affiche.
function supprimerSerieCourante() {
  return supprimerSerie(serieEnEdition);
}

// `id` est passé explicitement : cette fonction sert à la fenêtre d'édition ET
// au détail d'une série, et seule la première a une série « en édition ».
async function supprimerSerie(id) {
  if (!id) return;
  const serie = series.find((s) => s.id === id);
  const nb = tomesDeLaSerie(id).length;

  if (!confirm("Supprimer la série « " + (serie ? serie.titre : "") + " » ?\n\n" +
      (nb ? "Ses " + nb + " tome(s) ne seront PAS supprimés : ils redeviennent des livres sans série.\n"
          : "") +
      "Le résumé de l'histoire, lui, sera perdu.")) {
    return;
  }

  // L'erreur s'affiche là où l'on est : dans la fenêtre si elle est ouverte,
  // sinon sous la page.
  const fenetreOuverte = document.getElementById("modalSerie").style.display !== "none";
  const message = document.getElementById(fenetreOuverte ? "serieMessage" : "message");
  try {
    await supprimerSerieDistante(id);
  } catch (e) {
    message.textContent = "Suppression impossible : " + e.message;
    return;
  }

  // La base a mis serie_id à NULL toute seule (« on delete set null ») :
  // on aligne l'état local sur elle plutôt que de recharger la page.
  bibliotheque.livres.forEach((l) => {
    if (l.serieId === id) { l.serieId = null; l.tome = null; }
  });
  series = series.filter((s) => s.id !== id);

  fermerEditionSerie();
  // La série supprimée ne peut plus être affichée : retour à la liste.
  if (serieOuverte === id) serieOuverte = null;
  afficherSeries();
  afficherListeLivres();
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modalSerie");
  if (e.key === "Escape" && modal && modal.style.display !== "none") fermerEditionSerie();
});

// =====================================================================
//  Statistiques d'un livre
//
//  Ces chiffres existaient déjà, mais dans la fiche qu'un ADMINISTRATEUR
//  ouvrait sur un autre compte (l'ancien utilisateurs.html). Cette page a
//  disparu quand la gestion des comptes est passée au portail central, et
//  les statistiques sont tombées avec elle — sans que ce soit voulu : c'est
//  l'auteur du livre, pas l'administrateur, qui a le plus de raisons de
//  savoir où en est son manuscrit. Elles reviennent donc ici, sur la carte
//  du livre, pour son propriétaire.
// =====================================================================

// Temps de lecture estimé, sur la base de 200 mots par minute.
function tempsLecture(mots) {
  const min = Math.round(mots / 200);
  if (min < 1) return "moins d'1 min";
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60), m = min % 60;
  return h + " h" + (m ? " " + m : "");
}

// Longueur de chaque chapitre, en mots. Ce qui précède le premier titre
// (avant-propos, dédicace) n'en est pas un et n'est pas compté.
function longueursChapitres(html) {
  const boite = document.createElement("div");
  boite.innerHTML = html || "";
  const longueurs = [];
  let courant = null;
  boite.childNodes.forEach((n) => {
    if (n.nodeType === 1 && n.tagName === "H2" && (n.textContent || "").trim()) {
      if (courant !== null) longueurs.push(courant);
      courant = 0;
    }
    if (courant === null) return;
    courant += compterMots(n.nodeType === 1 ? n : (n.textContent || ""));
  });
  if (courant !== null) longueurs.push(courant);
  return longueurs.filter((x) => x > 0);
}

function statsLivre(livre) {
  const contenu = Array.isArray(livre.spreads) ? livre.spreads.join(" ") : "";

  const boite = document.createElement("div");
  boite.innerHTML = contenu;

  let chapitres = 0;
  boite.querySelectorAll("h2").forEach((h) => {
    if ((h.textContent || "").trim()) chapitres++;
  });

  const longueurs = longueursChapitres(contenu);
  const mots = compterMots(contenu);
  // versLivreMemoire a déjà fait le calcul ; nombreDePages(), lui, attend une
  // LIGNE de base et rendrait 0 sur l'objet en mémoire.
  const pages = livre.nbPages
    || (Array.isArray(livre.pages) ? livre.pages.length : 0)
    || (Array.isArray(livre.spreads) ? livre.spreads.length * 2 : 0);
  const couv = livre.couverture || {};
  const quatr = livre.quatrieme || {};

  return {
    mots,
    pages,
    chapitres,
    signes: texteAvecRuptures(contenu).trim().length,
    chapMax: longueurs.length ? Math.max.apply(null, longueurs) : 0,
    chapMin: longueurs.length ? Math.min.apply(null, longueurs) : 0,
    chapMoyen: longueurs.length
      ? Math.round(longueurs.reduce((a, b) => a + b, 0) / longueurs.length) : 0,
    aImageCouv: !!couv.imageChemin,
    aQuatrImage: !!quatr.imageChemin,
    aAuteur: !!(livre.auteur && String(livre.auteur).trim()),
    publie: !!livre.publie
  };
}

function tuileStat(valeur, libelle) {
  return '<div class="stat-tuile"><b>' + valeur + "</b><span>" + libelle + "</span></div>";
}

function rendreStatsLivre(livre, s) {
  const nb = (n) => n.toLocaleString("fr-FR");

  const lignes = [
    ["Temps de lecture", "≈ " + tempsLecture(s.mots)],
    ["Signes (espaces compris)", nb(s.signes)],
    ["Format", libelleFormat(livre.format)]
  ];
  if (s.pages) lignes.push(["Densité", nb(Math.round(s.mots / s.pages)) + " mots/page"]);
  if (s.chapitres) {
    lignes.push(["Chapitre le plus long", nb(s.chapMax) + " mots"]);
    lignes.push(["Chapitre le plus court", nb(s.chapMin) + " mots"]);
    lignes.push(["Chapitre moyen", nb(s.chapMoyen) + " mots"]);
  }
  lignes.push(["Auteur renseigné", s.aAuteur ? "Oui" : "Non"]);
  lignes.push(["Couverture illustrée", s.aImageCouv ? "Oui" : "Non"]);
  lignes.push(["4ᵉ de couverture illustrée", s.aQuatrImage ? "Oui" : "Non"]);
  lignes.push(["Publié", s.publie ? "Oui" : "Non"]);

  return '<div class="stats-entete">' +
      '<div><div class="stats-nom">' + echapper(livre.titre || "Sans titre") + "</div>" +
      (s.aAuteur ? '<div class="stats-sous">' + echapper(livre.auteur) + "</div>" : "") +
      "</div></div>" +
    '<div class="stats-tuiles">' +
      tuileStat(nb(s.mots), "mots") +
      tuileStat(nb(s.pages), s.pages > 1 ? "pages" : "page") +
      tuileStat(nb(s.chapitres), s.chapitres > 1 ? "chapitres" : "chapitre") +
      tuileStat(tempsLecture(s.mots), "de lecture") +
    "</div>" +
    '<div class="stats-bloc"><h4>Détail</h4><dl class="stats-resume">' +
      lignes.map(([k, v]) =>
        "<div><dt>" + echapper(k) + "</dt><dd>" + echapper(String(v)) + "</dd></div>").join("") +
    "</dl></div>" +
    '<p class="stats-note">Le nombre de pages est celui du découpage actuel : ' +
    "il change avec le format, l'interligne et l'espace au-dessus des titres.</p>";
}

async function ouvrirStatsLivre(id) {
  const modal = document.getElementById("modalStats");
  const contenu = document.getElementById("statsContenu");
  if (!modal || !contenu) return;

  modal.style.display = "flex";
  contenu.innerHTML = '<div class="stats-chargement">Lecture du livre…</div>';

  // La bibliothèque ne descend que les métadonnées : le texte doit être
  // rapatrié pour être compté.
  let livre;
  try {
    livre = await chargerLivreComplet(id);
  } catch (e) {
    // La fenêtre a pu être refermée entre-temps : ne rien écrire dedans.
    if (modal.style.display === "none") return;
    contenu.innerHTML = '<div class="stats-erreur">Impossible de lire ce livre : ' +
      echapper(e.message) + "</div>";
    return;
  }

  if (modal.style.display === "none") return;
  contenu.innerHTML = rendreStatsLivre(livre, statsLivre(livre));
}

function fermerStatsLivre() {
  const modal = document.getElementById("modalStats");
  if (modal) modal.style.display = "none";
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modalStats");
  if (e.key === "Escape" && modal && modal.style.display !== "none") fermerStatsLivre();
});

// Dimensions (mm) des formats, pour recalculer la taille de page de l'éditeur
// à laquelle les décalages (imgOffsetX/Y) ont été enregistrés.
const FORMATS_VIGNETTE = {
  "149x210": { larg: 149, haut: 210 },
  "155x235": { larg: 155, haut: 235 },
  "105x148": { larg: 105, haut: 148 },
  "210x297": { larg: 210, haut: 297 },
  "kdp5585": { larg: 139.7, haut: 215.9 },
  "kdp150210": { larg: 150, haut: 210 },
};

// Reproduit le calcul de taille de page de l'éditeur (appliquerFormatPage),
// car les décalages de l'image sont exprimés en pixels relatifs à cette taille.
function dimensionsPageReference(formatKey) {
  const f = resoudreFormat(FORMATS_VIGNETTE, formatKey, "149x210");
  const ratio = f.haut / f.larg;
  const sommaireLarg = 240, margesH = 32, barresH = 56 + 52 + 10 + 32 + 10, gapPages = 26, margeV = 32;
  const dispoW = window.innerWidth - sommaireLarg - margesH;
  const dispoH = window.innerHeight - barresH - margeV;
  let largPx = Math.floor((dispoW - gapPages) / 2);
  let hautPx = Math.round(largPx * ratio);
  if (hautPx > dispoH) { hautPx = dispoH; largPx = Math.round(hautPx / ratio); }
  return { largPx, hautPx };
}

// Affiche l'image de couverture exactement comme dans l'éditeur : image entière
// (comme object-fit: contain), avec le zoom et le décalage choisis, le tout
// mis à l'échelle pour tenir dans la vignette.
async function chargerImageCouvVignette(couvDiv, url, formatKey, data) {
  // `imageChemin` porte désormais l'URL publique : plus rien à aller
  // chercher, le navigateur charge l'image lui-même (et la met en cache).
  if (!url) return;

  const ref = dimensionsPageReference(formatKey);
  couvDiv.style.position = "relative";

  // Conteneur à la taille de référence de l'éditeur, réduit dans la vignette.
  const wrap = document.createElement("div");
  wrap.style.position = "absolute";
  wrap.style.top = "0";
  wrap.style.left = "0";
  wrap.style.width = ref.largPx + "px";
  wrap.style.height = ref.hautPx + "px";
  wrap.style.transformOrigin = "top left";
  wrap.style.zIndex = "0"; // derrière le titre/auteur, devant la couleur de fond

  const img = document.createElement("img");
  img.draggable = false;
  img.style.position = "absolute";
  img.style.top = "0";
  img.style.left = "0";
  img.onload = () => {
    const echelleBase = Math.min(ref.largPx / img.naturalWidth, ref.hautPx / img.naturalHeight);
    const largeurAffichee = img.naturalWidth * echelleBase;
    const hauteurAffichee = img.naturalHeight * echelleBase;
    const centreX = (ref.largPx - largeurAffichee) / 2;
    const centreY = (ref.hautPx - hauteurAffichee) / 2;
    const zoom = data.imgZoom || 1;
    img.style.width = largeurAffichee + "px";
    img.style.height = hauteurAffichee + "px";
    img.style.transform =
      `translate(${centreX + (data.imgOffsetX || 0)}px, ${centreY + (data.imgOffsetY || 0)}px) scale(${zoom})`;
    ajusterEchelle();
  };

  // Réduire l'ensemble à la largeur réelle de la vignette.
  //
  // Ce calcul se faisait une seule fois, au chargement de l'image, avec
  // clientWidth. Dans un onglet MASQUÉ, clientWidth vaut 0 : l'échelle tombait
  // à 0 et la couverture devenait invisible pour de bon, même une fois
  // l'onglet affiché. Le cas était sans conséquence tant que seule la grille
  // des livres (toujours visible) portait des couvertures ; les séries, elles,
  // vivent dans l'onglet qu'on ne regarde pas au départ.
  //
  // Un ResizeObserver rejoue donc le calcul à chaque changement de taille de la
  // vignette : il couvre le passage de masqué à affiché, et au passage le
  // redimensionnement de la fenêtre, que la grille n'a jamais suivi.
  const ajusterEchelle = () => {
    const largeur = couvDiv.clientWidth;
    if (largeur > 0) wrap.style.transform = `scale(${largeur / ref.largPx})`;
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(ajusterEchelle).observe(couvDiv);
  img.src = url;

  wrap.appendChild(img);
  couvDiv.insertBefore(wrap, couvDiv.firstChild);

  // S'assurer que le titre/auteur restent au-dessus de l'image.
  couvDiv.querySelectorAll(".c-titre, .c-auteur").forEach(el => {
    el.style.position = "relative";
    el.style.zIndex = "1";
  });
}

function ouvrirLivre(id) {
  sessionStorage.setItem("livre_id", id);
  window.location.href = "editeur.html";
}

// Format retenu pour le prochain livre créé — le panneau (voir
// ouvrirChoixFormatCreation) n'a rien à lire depuis le DOM, contrairement à
// l'ancien <select>.
let formatChoisiCreation = FORMAT_PAR_DEFAUT;

function ouvrirChoixFormatCreation() {
  ouvrirPanneauFormat(formatChoisiCreation, (formatKey) => {
    formatChoisiCreation = formatKey;
    document.getElementById("formatNouveauLivre").textContent = libelleFormat(formatKey);
  });
}

async function creerLivre() {
  const message = document.getElementById("message");
  const champTitre = document.getElementById("titreNouveauLivre");
  const titre = champTitre.value.trim();
  const format = formatChoisiCreation;

  if (!titre) {
    message.textContent = "Merci de donner un titre au livre.";
    return;
  }

  const nouvelId = "l" + Date.now();
  // Un livre neuf naît avec une double-page vide : c'est elle, et non les
  // « pages », qui porte le texte (voir supabase/schema.sql).
  const nouveau = {
    id: nouvelId,
    titre: titre,
    format: format,
    spreads: [""],
    pages: [{ id: "p1", contenu: "" }],
    nbPages: 1
  };
  bibliotheque.livres.push(nouveau);

  try {
    await creerLivreDistant(nouveau);
    champTitre.value = "";
    afficherListeLivres();
    message.textContent = "Livre créé avec succès.";
  } catch (erreur) {
    bibliotheque.livres.pop();
    message.textContent = erreur.message;
  }
}

async function supprimerLivre(id) {
  const message = document.getElementById("message");
  const livre = bibliotheque.livres.find(l => l.id === id);
  if (!livre) return;
  if (!confirm(`Supprimer le livre « ${livre.titre} » ? Cette action est irréversible.`)) return;

  bibliotheque.livres = bibliotheque.livres.filter(l => l.id !== id);

  try {
    // Les double-pages partent avec le livre (on delete cascade) ; les images,
    // elles, vivent dans Storage, qui ignore tout des lignes qui s'y réfèrent.
    await supprimerLivreDistant(id);
    afficherListeLivres();
    message.textContent = "Livre supprimé.";

    // Nettoyage des images associées (n'empêche pas la suppression si ça échoue)
    for (const cle of ["couverture", "quatrieme", "tranche"]) {
      const data = livre[cle];
      if (data && data.imageChemin) {
        supprimerImageStorage(data.imageChemin).catch(() => {});
      }
    }
  } catch (erreur) {
    message.textContent = erreur.message;
    bibliotheque.livres.push(livre);
  }
}

// ----- Nom d'affichage (libre-service, sur le compte central) -----

function modifierNom() {
  const edition = document.getElementById("editionNom");
  const champ = document.getElementById("champNom");
  if (!edition || !champ) return;
  champ.value = localStorage.getItem("team53_nom") || "";
  edition.style.display = "flex";
  const btn = document.getElementById("btnModifNom");
  if (btn) btn.style.display = "none";
  champ.focus();
  champ.select();
}

function annulerNom() {
  const edition = document.getElementById("editionNom");
  if (edition) edition.style.display = "none";
  const btn = document.getElementById("btnModifNom");
  if (btn) btn.style.display = "";
  const message = document.getElementById("message");
  if (message) message.textContent = "";
}

async function enregistrerNom() {
  const message = document.getElementById("message");
  const champ = document.getElementById("champNom");
  if (!champ) return;

  const nouveau = champ.value.trim();
  const ancien = localStorage.getItem("team53_nom") || "";
  if (nouveau === ancien) { annulerNom(); return; }

  try {
    // Le pseudo vit sur le compte central : le changer ici le change pour le
    // portail et pour tous les sites, comme le fait « Mon compte ». La
    // fonction definir_mon_nom_affichage() ne touche QUE sa propre ligne —
    // impossible d'écraser au passage le rôle ou les accès, ni le compte d'un
    // autre, ce dont le fichier JSON partagé n'offrait aucune garantie.
    await definirNomAffichage(nouveau);
    annulerNom();
    remplirProfil();
    message.textContent = "Nom mis à jour.";
    setTimeout(() => { if (message.textContent === "Nom mis à jour.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}


chargerBibliotheque();
