// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerLivre: ["Ouverture du livre…", "Le texte et la mise en pages sont récupérés."],
  sauvegarder: ["Enregistrement du livre…", "Ne fermez pas la page : l'écriture est en cours."],
  gererConflitSauvegarde: ["Résolution d'un conflit…", "Le livre a été modifié ailleurs : les deux versions sont comparées."],
  basculerPublication: ["Publication…", "La liste des livres publiés est mise à jour."],
});

// ----- Et celles-ci ne passent par rien du tout : elles calculent -----
// Recomposer quatre cents pages prend deux secondes pendant lesquelles la
// page se fige — plus rien ne répond, on croit avoir planté l'éditeur. Le
// voile de calcul (voir attente.js) s'affiche AVANT que le fil ne soit pris,
// ce que le voile ordinaire, posé par minuteur, ne saurait faire.
//
// Les actions qui posent une question avant de travailler ne sont pas ici :
// le voile s'afficherait derrière leur « confirm ». Elles appellent
// pendantAttenteLourde elles-mêmes, une fois la réponse obtenue.
envelopperAttenteLourde({
  changerFormat: ["Changement de format…", "Tout le texte est recomposé aux nouvelles dimensions."],
  appliquerInterligne: ["Nouvel interligne…", "Tout le texte est recomposé."],
  ouvrirApercu: ["Préparation de l'aperçu…", "Les pages sont recalculées au découpage exact."],
  fermerApercu: ["Retour à l'édition…"],
});

let bibliotheque = null;
// Date de modification du livre telle qu'on l'a lue en l'ouvrant. Elle tient
// le rôle qu'avait le sha GitHub : si elle a bougé au moment d'enregistrer,
// c'est que le livre a été modifié ailleurs, et l'on demande avant d'écraser.
let majLeConnu = null;

// La ligne du compte, pour savoir si le tutoriel de l'éditeur a déjà été vu.
let moiCentralEditeur = null;
let livreId = null;
let indexLivre = -1;
let indexSpread = 0;
let selectionSauvegardee = null;
let modeCouverture = null; // 'couverture' | 'quatrieme' | null
let hauteurTextePx = 0;    // hauteur utile d'une page de texte (px), pour la pagination continue
let echelleAffichage = 1;  // zoom d'affichage courant (transform: scale) du livre
let geomEdition = null;    // géométrie logique des colonnes de la zone d'édition
let sommaireReduite = false; // panneau de gauche replié ?

// Formats : dimensions en mm, marges en mm (haut/bas, gauche/droite)
const FORMATS = {
  "149x210": { larg: 149, haut: 210, margeV: 20, margeH: 20 },
  "155x235": { larg: 155, haut: 235, margeV: 22, margeH: 20 },
  "105x148": { larg: 105, haut: 148, margeV: 14, margeH: 14 },
  "210x297": { larg: 210, haut: 297, margeV: 25, margeH: 25 },
  // Formats imposés par Amazon KDP. Les marges affichées ici sont celles
  // d'un livre de taille moyenne ; l'export KDP (impression.js) recalcule la
  // marge de reliure exacte à partir du nombre de pages réel, comme l'exige
  // KDP — voir FORMATS_KDP là-bas pour la liste des tailles disponibles.
  "kdp5585": { larg: 139.7, haut: 215.9, margeV: 18, margeH: 16 },   // 13,97 × 21,59 cm (5,5 × 8,5 po)
  "kdp150210": { larg: 150, haut: 210, margeV: 20, margeH: 18 },     // 15,0 × 21,0 cm (comme les éditions Solo Leveling)
};

// 96 ppp : 1 mm ≈ 3,7795 px. Les pages ont une taille LOGIQUE fixe (dérivée
// des mm du format) ; on adapte ensuite l'affichage à la fenêtre par un zoom
// (transform: scale). Ainsi le texte garde toujours le bon rapport avec la
// page, quelle que soit la taille de la fenêtre, et la pagination ne bouge pas.
const PX_PAR_MM = 96 / 25.4;

// Hauteur de la bande réservée au numéro de page, en pixels logiques.
// Variable et non constante : l'export « fichier pour l'imprimeur » la
// remonte le temps de la génération, pour que le folio respecte le blanc
// tournant de 7 mm exigé par les imprimeurs (voir impression.js).
// Bande réservée au bas de la page : le numéro y tient, et le texte s'arrête
// AVANT. À 32 px, la bande était plus courte que le folio lui-même : la
// dernière ligne venait mourir dessus, à un demi-millimètre. 64 px laissent
// le folio à 6 mm du bord et un blanc de 4 mm au-dessus de lui.
let PIED_PAGE_PX = 64;

// Le livre courant compose selon SON format.
function typoDuLivre() {
  const livre = (typeof indexLivre === "number" && indexLivre !== -1) ? livreActuel() : null;
  return typoDuFormat(livre && livre.format);
}

function appliquerFormatPage(formatKey) {
  const f = resoudreFormat(FORMATS, formatKey, "149x210");
  appliquerTypoFormat(formatKey);

  // --- Dimensions LOGIQUES fixes (indépendantes de la fenêtre) ---
  const largPx   = Math.round(f.larg * PX_PAR_MM);
  const hautPx   = Math.round(f.haut * PX_PAR_MM);
  const margeVPx = Math.round(f.margeV * PX_PAR_MM);
  const margeHPx = Math.round(f.margeH * PX_PAR_MM);
  const numPageH = PIED_PAGE_PX; // zone du numéro de page (logique)
  const gapPages = 26;

  hauteurTextePx = hautPx - margeVPx - numPageH;

  document.querySelectorAll(".page-livre").forEach(el => {
    el.style.width      = largPx + "px";
    el.style.height     = hautPx + "px";
    el.style.padding    = margeVPx + "px " + margeHPx + "px 0";
    el.style.boxSizing  = "border-box";
    el.style.flexShrink = "0";
  });

  // Le manuscrit (manuscrit.js) emprunte la typographie de « .texte-livre »
  // mais pas sa géométrie : sa feuille est large et sans fin, c'est sa raison
  // d'être. Sans cette exception, la taille d'une page lui serait imposée ici
  // en style en ligne, et le chapitre s'y trouverait à nouveau enfermé.
  document.querySelectorAll(".texte-livre:not(.ms-texte)").forEach(el => {
    el.style.width  = (largPx - margeHPx * 2) + "px";
    el.style.height = (hautPx - margeVPx - numPageH) + "px";
  });

  // Panneau couverture (même taille logique qu'une page)
  const previewCouv = document.getElementById("previewCouv");
  if (previewCouv) {
    previewCouv.style.width  = largPx + "px";
    previewCouv.style.height = hautPx + "px";
  }
  const paneau = document.querySelector(".paneau-edition-couv");
  if (paneau) {
    paneau.style.width     = largPx + "px";
    paneau.style.height    = hautPx + "px";
    paneau.style.padding   = "16px 20px";
    paneau.style.boxSizing = "border-box";
    paneau.style.overflowY = "auto";
  }

  // Le mesureur de pagination est en taille logique (hors zoom)
  const mesure = document.getElementById("mesureCachee");
  if (mesure) {
    mesure.style.width  = (largPx - margeHPx * 2) + "px";
    mesure.style.height = (hautPx - margeVPx - numPageH) + "px";
  }

  // --- Zone d'édition : une seule zone en deux colonnes (= deux pages) ---
  // Mémorisée pour les mesures de colonnes (voir geometrieEdition()).
  geomEdition = {
    largPx, hautPx, margeVPx, margeHPx, numPageH, gapPages,
    largeurColonne: largPx - 2 * margeHPx,
    gouttiere: gapPages + 2 * margeHPx
  };

  const spreadEd = document.getElementById("spreadEdition");
  if (spreadEd) {
    const largeurSpread = 2 * largPx + gapPages;
    spreadEd.style.width  = largeurSpread + "px";
    spreadEd.style.height = hautPx + "px";

    const fg = document.getElementById("fondGauche");
    const fd = document.getElementById("fondDroite");
    if (fg) { fg.style.left = "0px";                     fg.style.width = largPx + "px"; fg.style.height = hautPx + "px"; }
    if (fd) { fd.style.left = (largPx + gapPages) + "px"; fd.style.width = largPx + "px"; fd.style.height = hautPx + "px"; }

    // La zone d'édition ET le mesureur caché partagent exactement la même
    // géométrie de colonnes (indispensable pour que les coupes soient justes).
    [document.getElementById("editeurSpread"), document.getElementById("mesureSpread")]
      .forEach(ed => {
        if (!ed) return;
        ed.style.width     = (largeurSpread - 2 * margeHPx) + "px";
        ed.style.height    = (hautPx - margeVPx - numPageH) + "px";
        // Gouttière = marge droite (page gauche) + gap central + marge gauche (page droite)
        ed.style.columnGap = geomEdition.gouttiere + "px";
        ed.style.padding   = "0";
        ed.style.boxSizing = "border-box";
      });

    const ed = document.getElementById("editeurSpread");
    if (ed) {
      ed.style.left = margeHPx + "px";
      ed.style.top  = margeVPx + "px";
    }

    const nG = document.getElementById("numeroGauche");
    const nD = document.getElementById("numeroDroite");
    if (nG) { nG.style.left = "0px";                     nG.style.width = largPx + "px"; nG.style.top = (hautPx - numPageH) + "px"; }
    if (nD) { nD.style.left = (largPx + gapPages) + "px"; nD.style.width = largPx + "px"; nD.style.top = (hautPx - numPageH) + "px"; }
  }

  // --- Zoom d'affichage pour tenir dans l'espace disponible ---
  const reduit = document.querySelector(".conteneur-livre")?.classList.contains("sommaire-reduite");
  const sommaireLarg = reduit ? 8 : 240; // sommaire + gap + marge (0 si replié)
  const margesH      = 32;
  const barresH      = 56 + 52 + 10 + 32 + 10; // outils + actions + gaps + message
  const margeV       = 32;

  const bookLargLogique = 2 * largPx + gapPages;
  const dispoW = window.innerWidth  - sommaireLarg - margesH;
  const dispoH = window.innerHeight - barresH - margeV;

  let echelle = Math.min(dispoW / bookLargLogique, dispoH / hautPx);
  if (!isFinite(echelle) || echelle <= 0) echelle = 1;
  echelle = Math.min(echelle, 1.6); // ne pas zoomer à l'excès sur grand écran
  echelleAffichage = echelle;

  document.querySelectorAll(".livre-ouvert").forEach(el => {
    el.style.transform = `scale(${echelle})`;
    el.style.transformOrigin = "center center";
    // Marges compensatrices : la mise en page réserve la taille RÉELLE (zoomée),
    // pour que le centrage et le défilement restent corrects.
    const dLarg = (bookLargLogique * (echelle - 1)) / 2;
    const dHaut = (hautPx * (echelle - 1)) / 2;
    el.style.margin = `${dHaut}px ${dLarg}px`;
  });
}

// Replier / déplier le panneau de gauche (comme la barre latérale de Claude)
function basculerSommaire() {
  sommaireReduite = !sommaireReduite;
  appliquerReductionSommaire();
  try { localStorage.setItem("sommaire_reduite", sommaireReduite ? "1" : "0"); } catch (e) {}
}

function appliquerReductionSommaire() {
  const conteneur = document.querySelector(".conteneur-livre");
  if (conteneur) conteneur.classList.toggle("sommaire-reduite", sommaireReduite);
  const btnOuvrir = document.getElementById("boutonOuvrirSommaire");
  if (btnOuvrir) btnOuvrir.style.display = sommaireReduite ? "flex" : "none";

  // Re-zoomer le livre pour occuper l'espace libéré (ou rendu)
  const format = (indexLivre !== -1 && livreActuel()) ? (livreActuel().format || "149x210") : "149x210";
  appliquerFormatPage(format);
  if (modeCouverture) repositionnerImageCouverture();
  if (modeApercu) afficherApercu();
}

async function chargerLivre() {
  const message = document.getElementById("message");

  livreId = sessionStorage.getItem("livre_id");

  if (!exigerConnexion() || !livreId) {
    window.location.href = "bibliotheque.html";
    return;
  }

  try {
    // Un seul livre descend ici, avec ses double-pages : l'éditeur n'en ouvre
    // jamais deux à la fois. `bibliotheque` garde sa forme d'origine pour que
    // le reste du fichier (livreActuel(), indexLivre…) n'ait rien à changer.
    const livreCharge = await chargerLivreComplet(livreId);
    bibliotheque = { livres: [livreCharge] };
    majLeConnu = livreCharge.dateModif || null;
    indexLivre = 0;

    // Sert au seul tutoriel : on ne bloque pas l'ouverture du livre pour ça.
    rafraichirIdentiteCentrale().then((moi) => { moiCentralEditeur = moi; });

    const livre = livreActuel();
    if (!livre.pages || livre.pages.length === 0) {
      livre.pages = [{ id: "p1", contenu: "" }];
      // Un livre migré depuis l'ancienne base n'a pas encore son cache de
      // pagination : il se refait à la première mesure, et la prochaine
      // sauvegarde l'enregistre.
      pagesObsoletes = true;
    }

    document.getElementById("titreLivre").textContent = livre.titre || "Mon livre";
    const formatCourant = livre.format || "149x210";

    // Restaurer l'état replié/déplié du panneau de gauche
    try { sommaireReduite = localStorage.getItem("sommaire_reduite") === "1"; } catch (e) {}
    const conteneur = document.querySelector(".conteneur-livre");
    if (conteneur) conteneur.classList.toggle("sommaire-reduite", sommaireReduite);
    const btnOuvrir = document.getElementById("boutonOuvrirSommaire");
    if (btnOuvrir) btnOuvrir.style.display = sommaireReduite ? "flex" : "none";

    // Espace au-dessus des titres de chapitre (curseur « Titre »)
    initEspaceTitre();

    appliquerFormatPage(formatCourant);
    const selFormat = document.getElementById("selectFormat");
    if (selFormat) selFormat.textContent = libelleFormat(formatCourant);
    window.addEventListener("resize", () => {
      // Lire le format courant du livre (il peut changer via le sélecteur)
      appliquerFormatPage(livreActuel().format || "149x210");
      if (modeCouverture) repositionnerImageCouverture();
      if (modeApercu) afficherApercu();
    });
    indexSpread = 0;

    document.execCommand("defaultParagraphSeparator", false, "p");

    // Zone d'édition UNIQUE : la sélection, l'annuler/rétablir et la
    // typographie sont gérés nativement par le navigateur.
    const zoneEd = document.getElementById("editeurSpread");
    zoneEd.addEventListener("blur", sauvegarderSelection);
    zoneEd.addEventListener("input", surSaisie);
    zoneEd.addEventListener("paste", gererCollage);
    // Reflet de l'état de la sélection dans la barre d'outils. « selectionchange »
    // est très bavard : on regroupe les rafraîchissements sur l'image suivante.
    let majPrevue = false;
    document.addEventListener("selectionchange", () => {
      if (majPrevue) return;
      majPrevue = true;
      requestAnimationFrame(() => { majPrevue = false; majEtatBarreOutils(); });
    });
    document.addEventListener("keydown", raccourcisClavier);
    window.addEventListener("beforeunload", (e) => {
      if (modifie) { e.preventDefault(); e.returnValue = ""; }
    });

    // Proposer de restaurer un éventuel brouillon local non enregistré
    verifierBrouillon();

    afficherSpread();
    afficherSommaire();
    majCompteurMots();
    majBoutonPublier();

    // Tutoriel des outils au tout premier passage dans l'éditeur (une seule fois).
    setTimeout(() => lancerTutorielEditeur(false), 600);
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

// Collage : on force le TEXTE BRUT (sans les polices/tailles/couleurs de la
// source, ex. Google Docs), pour que le texte collé prenne le style du livre.
// Les sauts de ligne deviennent des <br>, comme la touche Entrée. On insère des
// nœuds texte à la main (pas execCommand, qui ajoute des <span> de style).
function gererCollage(e) {
  e.preventDefault();
  const donnees = e.clipboardData || window.clipboardData;
  if (!donnees) return;

  let texte = donnees.getData("text/plain");
  if (texte == null || texte === "") return;
  texte = texte.replace(/\r\n?/g, "\n");

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents(); // remplacer la sélection éventuelle

  const frag = document.createDocumentFragment();
  const lignes = texte.split("\n");
  lignes.forEach((ligne, i) => {
    if (i > 0) frag.appendChild(document.createElement("br"));
    if (ligne) frag.appendChild(document.createTextNode(ligne));
  });

  const dernier = frag.lastChild;
  range.insertNode(frag);

  // Replacer le curseur après le texte collé
  if (dernier) {
    range.setStartAfter(dernier);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // insertNode ne déclenche pas 'input' : on enchaîne manuellement
  // (pagination continue, historique, brouillon, compteur, état modifié).
  surSaisie({ inputType: "insertFromPaste" });
}


// Raccourcis clavier globaux de l'éditeur (mode texte uniquement)
function raccourcisClavier(e) {
  if (modeApercu || modeCouverture) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  const touche = e.key.toLowerCase();
  if (touche === "z" && !e.shiftKey) { e.preventDefault(); annuler(); }
  else if ((touche === "z" && e.shiftKey) || touche === "y") { e.preventDefault(); retablir(); }
  else if (touche === "f") { e.preventDefault(); basculerRecherche(true); }
  else if (touche === "s") { e.preventDefault(); sauvegarder(); }
}

function livreActuel() {
  return bibliotheque.livres[indexLivre];
}

function formater(commande, valeur) {
  document.execCommand(commande, false, valeur || null);
  enregistrerHistorique();
  marquerModifie();
  majEtatBarreOutils();   // refléter aussitôt le nouvel état
}

// Style de paragraphe : Paragraphe / Titre / Sous-titre (#7)
function appliquerStyle(baliseKey) {
  restaurerSelection();
  const balise = baliseKey === "h2" ? "H2" : baliseKey === "h3" ? "H3" : "P";
  document.execCommand("formatBlock", false, balise);

  // Une taille posée à la main (font-size en ligne) survit au changement de
  // bloc et l'emporterait sur la taille du type : un titre resterait en 11 pt.
  // On la retire des blocs concernés pour que la taille du type s'applique
  // (20 pt pour un titre, 13 pt pour un sous-titre, 11 pt pour un paragraphe).
  nettoyerTaillesBlocsSelection();

  enregistrerHistorique();
  marquerModifie();
  majEtatBarreOutils();
}

// Retire les tailles en ligne dans les blocs touchés par la sélection.
function nettoyerTaillesBlocsSelection() {
  const ed = editeurEl();
  const sel = window.getSelection();
  if (!ed || !sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);

  const blocs = [...ed.querySelectorAll("p, h2, h3, li")].filter(b => range.intersectsNode(b));
  if (blocs.length === 0) return;

  blocs.forEach(bloc => {
    if (bloc.style && bloc.style.fontSize) {
      bloc.style.fontSize = "";
      if (!bloc.getAttribute("style")) bloc.removeAttribute("style");
    }
    bloc.querySelectorAll("[style]").forEach(el => {
      if (el.style.fontSize) {
        el.style.fontSize = "";
        if (!el.getAttribute("style")) el.removeAttribute("style");
      }
    });
    bloc.querySelectorAll("font[size]").forEach(f => f.removeAttribute("size"));
    // Déballer les <span> devenus vides de tout attribut
    bloc.querySelectorAll("span").forEach(sp => {
      if (sp.attributes.length === 0) {
        while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
        sp.remove();
      }
    });
  });
}

// Police de caractères de la sélection (#7)
function appliquerPolice(police) {
  restaurerSelection();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const fragment = range.extractContents();
  fragment.querySelectorAll("span[style]").forEach(el => {
    el.style.fontFamily = "";
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });
  const span = document.createElement("span");
  // Chaîne vide = police par défaut (Garamond héritée de .texte-livre)
  span.style.fontFamily = police || "";
  span.appendChild(fragment);
  range.insertNode(span);
  const nouvelRange = document.createRange();
  nouvelRange.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(nouvelRange);
  enregistrerHistorique();
  marquerModifie();
}


function sauvegarderSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    selectionSauvegardee = sel.getRangeAt(0).cloneRange();
  }
}

function restaurerSelection() {
  if (!selectionSauvegardee) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(selectionSauvegardee);
  return true;
}

function appliquerTaille(pt) {
  const val = parseInt(pt);
  if (!val || val < 6 || val > 72) return;

  restaurerSelection();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);

  // Extraire le contenu sélectionné
  const fragment = range.extractContents();

  // Supprimer les font-size existants dans la sélection pour éviter les conflits
  fragment.querySelectorAll("span[style]").forEach(el => {
    el.style.fontSize = "";
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });

  // Envelopper dans un span avec la nouvelle taille
  const span = document.createElement("span");
  span.style.fontSize = val + "pt";
  span.appendChild(fragment);

  range.insertNode(span);

  // Replacer la sélection sur le span inséré
  const nouvelRange = document.createRange();
  nouvelRange.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(nouvelRange);
  enregistrerHistorique();
  marquerModifie();
}


// ----- Affichage -----




// ----- Sauvegarde -----


// Résolution d'un conflit d'écriture (le livre a été modifié ailleurs) (#3)
async function gererConflitSauvegarde() {
  const message = document.getElementById("message");

  const ecraser = confirm(
    "Ce livre a été modifié depuis un autre onglet ou appareil.\n\n" +
    "OK = écraser la version distante avec la vôtre.\n" +
    "Annuler = recharger la version distante (vos modifications non enregistrées seront perdues)."
  );

  if (ecraser) {
    try {
      // Sans date connue, l'enregistrement ne compare plus rien : il écrase.
      majLeConnu = await enregistrerLivreDistant(livreActuel(), null);
      message.textContent = "Sauvegardé (version distante écrasée).";
      marquerSauvegarde();
      effacerBrouillon();
    } catch (erreur) {
      message.textContent = erreur.message;
    }
  } else {
    // On garde le brouillon local au cas où, mais on recharge la version distante
    modifie = false; // éviter l'avertissement beforeunload
    window.location.reload();
  }
}

function retourBibliotheque() {
  flushSpread();
  window.location.href = "bibliotheque.html";
}

// ----- Couverture -----

function ouvrirCouverture(mode) {
  if (modeApercu) {
    modeApercu = false;
    document.getElementById("vueApercu").style.display = "none";
    document.querySelector(".sommaire").style.display = "";
  }
  flushSpread();
  modeCouverture = mode;
  const livre = livreActuel();
  if (!livre.couverture) livre.couverture = { fond: "#1a1a2e", image: null, imageChemin: null, texte: "#ffffff", afficherTitre: true, afficherAuteur: true };
  if (!livre.quatrieme) livre.quatrieme = { fond: "#2a2a2a", image: null, imageChemin: null, texte: "#ffffff", contenu: "", afficherAuteur: true };

  const data = mode === "couverture" ? livre.couverture : livre.quatrieme;

  document.getElementById("titreModeCouv").textContent = mode === "couverture" ? "Couverture" : "4e de couverture";
  document.getElementById("champTitreCouv").value = mode === "couverture" ? (livre.titre || "") : "";
  document.getElementById("champAuteurCouv").value = livre.auteur || "";
  document.getElementById("couleurLibre").value = data.fond || "#1a1a2e";
  document.getElementById("couleurTexteLibre").value = data.texte || "#ffffff";
  synchroniserControlesCouv(data);

  // Masquer champ titre pour la 4e
  document.getElementById("champTitreCouv").closest("div")?.previousElementSibling;
  const labelTitre = document.querySelector(".champs-couverture .label-couv");
  const inputTitre = document.getElementById("champTitreCouv");
  if (mode === "quatrieme") {
    labelTitre.style.display = "none";
    inputTitre.style.display = "none";
  } else {
    labelTitre.style.display = "";
    inputTitre.style.display = "";
  }

  document.getElementById("vueEditeur").style.display = "none";
  document.getElementById("vueCouverture").style.display = "flex";
  document.getElementById("btnCouv").classList.toggle("actif", mode === "couverture");
  document.getElementById("btnQuatr").classList.toggle("actif", mode === "quatrieme");

  // Appliquer le bon format avant de positionner l'image, pour que le conteneur
  // ait déjà ses dimensions réelles (sinon l'image se positionne sur une taille nulle).
  appliquerFormatPage(livreActuel().format || "149x210");

  previewCouverture();
}

function fermerCouverture() {
  modeCouverture = null;
  document.getElementById("vueCouverture").style.display = "none";
  document.getElementById("vueEditeur").style.display = "flex";
  document.getElementById("btnCouv").classList.remove("actif");
  document.getElementById("btnQuatr").classList.remove("actif");
  appliquerFormatPage(livreActuel().format || "149x210");
}

let cacheImagesURL = {};
let requeteImageEnCours = 0;

function previewCouverture() {
  const livre = livreActuel();
  const mode = modeCouverture;
  const data = mode === "couverture" ? livre.couverture : livre.quatrieme;
  if (!data) return;

  if (data.imgZoom === undefined) data.imgZoom = 1;
  if (data.imgOffsetX === undefined) data.imgOffsetX = 0;
  if (data.imgOffsetY === undefined) data.imgOffsetY = 0;

  const fondDiv = document.getElementById("fondCouleurCouv");
  const img = document.getElementById("imageFondCouverture");
  const zoneZoom = document.getElementById("zoneZoomImage");
  const aide = document.getElementById("aideDeplacement");
  const slider = document.getElementById("sliderZoom");
  const valeurZoom = document.getElementById("valeurZoom");

  fondDiv.style.background = data.fond || "#1a1a2e";

  const cheminImage = data.imageChemin || null;

  if (cheminImage) {
    zoneZoom.style.display = "flex";
    aide.style.display = "block";
    slider.value = data.imgZoom;
    valeurZoom.textContent = Math.round(data.imgZoom * 100) + "%";

    if (cacheImagesURL[cheminImage]) {
      afficherImageCouverture(cacheImagesURL[cheminImage], cheminImage);
    } else {
      img.style.display = "none";
      const requeteId = ++requeteImageEnCours;
      obtenirUrlImage(cheminImage).then((urlImage) => {
        cacheImagesURL[cheminImage] = urlImage;
        if (requeteId === requeteImageEnCours) {
          previewCouverture();
        }
      }).catch((erreur) => {
        const messageCouv = document.getElementById("messageCouv");
        if (messageCouv) messageCouv.textContent = erreur.message;
      });
    }
  } else {
    img.style.display = "none";
    img.removeAttribute("src");
    zoneZoom.style.display = "none";
    aide.style.display = "none";
  }

  // Sauvegarder auteur dans le livre
  livre.auteur = document.getElementById("champAuteurCouv").value;
  if (mode === "couverture") {
    livre.titre = document.getElementById("champTitreCouv").value;
    document.getElementById("titreLivre").textContent = livre.titre || "Mon livre";
  }

  const couleurTexte = data.texte || "#ffffff";
  const afficherTitre = data.afficherTitre !== false;
  const afficherAuteur = data.afficherAuteur !== false;

  const toggleTitreInput = document.getElementById("toggleTitre");
  const toggleAuteurInput = document.getElementById("toggleAuteur");
  const ligneToggleTitre = document.getElementById("ligneToggleTitre");
  if (toggleTitreInput) toggleTitreInput.checked = afficherTitre;
  if (toggleAuteurInput) toggleAuteurInput.checked = afficherAuteur;
  if (ligneToggleTitre) ligneToggleTitre.style.display = mode === "couverture" ? "block" : "none";

  // La 4e de couverture n'affiche pas de titre : ses réglages (police, taille,
  // position) n'ont donc rien à y faire.
  const visibleTitre = mode === "couverture" ? "block" : "none";
  ["blocPoliceTitre", "blocPosTitre"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = visibleTitre;
  });
  // Inversement, le texte libre n'existe que sur la 4e.
  const blocResume = document.getElementById("blocResume");
  if (blocResume) blocResume.style.display = mode === "quatrieme" ? "block" : "none";

  const apercu = document.getElementById("previewCouverture");
  apercu.innerHTML = `
    ${mode === "couverture" && afficherTitre ? `<div class="apercu-titre" style="color:${couleurTexte};${styleTexteCouv(data, "titre")}">${livre.titre || "Titre"}</div>` : ""}
    ${afficherAuteur ? `<div class="apercu-auteur" style="color:${couleurTexte};${styleTexteCouv(data, "auteur")}">${livre.auteur || "Auteur"}</div>` : ""}
  `;

  // Le texte de 4e se pose sur la page elle-même, hors de la couche des
  // textes : c'est la seule façon que sa position soit celle qu'on a réglée.
  const page = document.getElementById("previewCouv");
  const ancienne = page.querySelector(".couche-resume");
  if (ancienne) ancienne.remove();
  if (mode === "quatrieme") {
    page.insertAdjacentHTML("beforeend", htmlResumeCouv(data, couleurTexte, "apercu-resume"));
  }
}

function toggleAffichageTexte(champ, valeur) {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  if (!data) return;
  if (champ === "titre") data.afficherTitre = valeur;
  else if (champ === "auteur") data.afficherAuteur = valeur;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

// Affiche l'image en s'assurant qu'elle est bien chargée avant de la positionner
// (naturalWidth/naturalHeight ne sont disponibles qu'une fois l'image chargée).
// En cas d'échec (URL expirée, coupure réseau...), invalide le cache et retente
// automatiquement quelques fois avant d'abandonner avec un message clair.
let tentativesEchecImage = {};

function afficherImageCouverture(url, chemin) {
  const img = document.getElementById("imageFondCouverture");
  img.style.display = "block";

  if (img.src === url && img.complete && img.naturalWidth) {
    repositionnerImageCouverture();
    return;
  }

  img.onload = () => {
    tentativesEchecImage[chemin] = 0;
    const messageCouv = document.getElementById("messageCouv");
    if (messageCouv && messageCouv.textContent.startsWith("Erreur de chargement")) {
      messageCouv.textContent = "";
    }
    repositionnerImageCouverture();
  };

  img.onerror = () => {
    delete cacheImagesURL[chemin];
    const tentatives = (tentativesEchecImage[chemin] || 0) + 1;
    tentativesEchecImage[chemin] = tentatives;
    const messageCouv = document.getElementById("messageCouv");

    if (tentatives <= 3) {
      if (messageCouv) messageCouv.textContent = "Erreur de chargement de l'image, nouvelle tentative...";
      previewCouverture();
    } else {
      if (messageCouv) {
        messageCouv.textContent = "Impossible de charger l'image après plusieurs tentatives. Vérifie ta connexion, ou réimporte-la via \"Choisir un fichier\".";
      }
      img.style.display = "none";
    }
  };

  img.src = url;
}

// Calcule la taille "image entière visible" (comme object-fit: contain) puis
// applique le zoom et le déplacement choisis par-dessus, sans jamais perdre
// de pixels de l'image d'origine.
// Adapte zoom + décalage quand la taille de page change (ex. changement de
// format) pour que l'image occupe VISUELLEMENT la même place qu'avant :
// on mémorise la taille de page pour laquelle le cadrage a été réglé
// (imgBaseW/imgBaseH) et on préserve le taux de recouvrement le plus serré
// (une image qui couvrait toute la couverture continue de la couvrir) ainsi
// que le POINT de l'image affiché au centre de la couverture (une image
// centrée reste centrée ; un point choisi reste au centre du nouveau format).
function adapterCadrageImage(data, img, cw, ch) {
  if (!data || !cw || !ch || !img || !img.naturalWidth || !img.naturalHeight) return;

  const bw = data.imgBaseW, bh = data.imgBaseH;
  if (bw && bh && (bw !== cw || bh !== ch)) {
    const sOld = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
    const sNew = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    // taux de recouvrement de la dimension la moins couverte (0..1 = bandes, >=1 = couvre)
    const recOld = Math.min(img.naturalWidth * sOld / bw, img.naturalHeight * sOld / bh);
    const recNew = Math.min(img.naturalWidth * sNew / cw, img.naturalHeight * sNew / ch);

    const zOld = data.imgZoom || 1;
    let zNew = zOld;
    if (recOld > 0 && recNew > 0) {
      zNew = Math.max(0.3, Math.min(3, zOld * (recOld / recNew)));
      data.imgZoom = zNew;
    }

    // Le décalage suit l'échelle d'affichage TOTALE (contain × zoom) : ainsi le
    // point de l'image qui était au centre de la couverture y reste, centré
    // dans le nouveau format.
    const ratioEchelle = (sOld > 0 && zOld > 0) ? (sNew * zNew) / (sOld * zOld) : 1;
    if (typeof data.imgOffsetX === "number") data.imgOffsetX *= ratioEchelle;
    if (typeof data.imgOffsetY === "number") data.imgOffsetY *= ratioEchelle;
  }

  data.imgBaseW = cw;
  data.imgBaseH = ch;
}

function repositionnerImageCouverture() {
  const img = document.getElementById("imageFondCouverture");
  const conteneur = document.getElementById("previewCouv");
  if (!img.naturalWidth || !img.naturalHeight || !conteneur) return;

  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  if (!data) return;

  adapterCadrageImage(data, img, conteneur.clientWidth, conteneur.clientHeight);
  clampOffsetsCouv(data, conteneur.clientWidth, conteneur.clientHeight);

  const echelleBase = Math.min(
    conteneur.clientWidth / img.naturalWidth,
    conteneur.clientHeight / img.naturalHeight
  );
  const largeurAffichee = img.naturalWidth * echelleBase;
  const hauteurAffichee = img.naturalHeight * echelleBase;

  img.style.width = largeurAffichee + "px";
  img.style.height = hauteurAffichee + "px";

  const centreX = (conteneur.clientWidth - largeurAffichee) / 2;
  const centreY = (conteneur.clientHeight - hauteurAffichee) / 2;

  img.style.transform = `translate(${centreX + data.imgOffsetX}px, ${centreY + data.imgOffsetY}px) scale(${data.imgZoom})`;
  img.style.cursor = "grab";
}

function clampOffsetsCouv(data, largeurConteneur, hauteurConteneur) {
  // Limite large pour éviter de perdre complètement l'image hors du cadre,
  // sans forcer l'image à toujours recouvrir tout le conteneur.
  const limiteX = largeurConteneur * 1.2;
  const limiteY = hauteurConteneur * 1.2;
  data.imgOffsetX = Math.max(-limiteX, Math.min(limiteX, data.imgOffsetX || 0));
  data.imgOffsetY = Math.max(-limiteY, Math.min(limiteY, data.imgOffsetY || 0));
}

function setZoomImage(val) {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  if (!data || !data.imageChemin) return;
  data.imgZoom = Math.max(0.3, Math.min(3, parseFloat(val)));
  document.getElementById("valeurZoom").textContent = Math.round(data.imgZoom * 100) + "%";
  repositionnerImageCouverture();
  marquerModifie();
  planifierBrouillon();
}

// ----- Glisser-déposer de l'image de couverture -----

let glissementActif = false;
let glissementDepartX = 0;
let glissementDepartY = 0;
let glissementOffsetDepartX = 0;
let glissementOffsetDepartY = 0;

function initGlissementImageCouverture() {
  const img = document.getElementById("imageFondCouverture");
  if (!img) return;

  img.addEventListener("pointerdown", (e) => {
    const livre = livreActuel();
    const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
    if (!data || !data.imageChemin) return;

    glissementActif = true;
    glissementDepartX = e.clientX;
    glissementDepartY = e.clientY;
    glissementOffsetDepartX = data.imgOffsetX || 0;
    glissementOffsetDepartY = data.imgOffsetY || 0;
    img.classList.add("en-glissement");
    img.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  img.addEventListener("pointermove", (e) => {
    if (!glissementActif) return;
    const livre = livreActuel();
    const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
    if (!data) return;

    // Le livre est affiché avec un zoom : on ramène le déplacement écran en
    // coordonnées logiques pour que l'image suive exactement le curseur.
    const deltaX = (e.clientX - glissementDepartX) / (echelleAffichage || 1);
    const deltaY = (e.clientY - glissementDepartY) / (echelleAffichage || 1);
    data.imgOffsetX = glissementOffsetDepartX + deltaX;
    data.imgOffsetY = glissementOffsetDepartY + deltaY;

    repositionnerImageCouverture();
  });

  const finGlissement = (e) => {
    if (!glissementActif) return;
    glissementActif = false;
    img.classList.remove("en-glissement");
    if (e.pointerId !== undefined && img.hasPointerCapture(e.pointerId)) {
      img.releasePointerCapture(e.pointerId);
    }
    marquerModifie();
    planifierBrouillon();
  };
  img.addEventListener("pointerup", finGlissement);
  img.addEventListener("pointercancel", finGlissement);

  // Molette de la souris pour zoomer/dézoomer rapidement
  img.addEventListener("wheel", (e) => {
    const livre = livreActuel();
    const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
    if (!data || !data.imageChemin) return;
    e.preventDefault();
    const pas = e.deltaY < 0 ? 0.05 : -0.05;
    data.imgZoom = Math.max(0.3, Math.min(3, (data.imgZoom || 1) + pas));
    document.getElementById("sliderZoom").value = data.imgZoom;
    document.getElementById("valeurZoom").textContent = Math.round(data.imgZoom * 100) + "%";
    repositionnerImageCouverture();
    marquerModifie();
    planifierBrouillon();
  }, { passive: false });
}

function setCouleurFond(couleur) {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;

  if (data.imageChemin) {
    supprimerImageStorage(data.imageChemin).catch(() => {});
    delete cacheImagesURL[data.imageChemin];
  }

  data.fond = couleur;
  data.image = null;
  data.imageChemin = null;
  document.getElementById("couleurLibre").value = couleur;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

function setCouleurTexte(couleur) {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  data.texte = couleur;
  document.getElementById("couleurTexteLibre").value = couleur;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

function chargerImageFond(event) {
  const fichier = event.target.files[0];
  if (!fichier) return;

  const messageCouv = document.getElementById("messageCouv");
  const livre = livreActuel();
  const modeCourant = modeCouverture;
  const data = modeCourant === "couverture" ? livre.couverture : livre.quatrieme;
  const ancienChemin = data.imageChemin;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const extension = extraireExtensionDataUrl(dataUrl);

    // Le travail se fait dans la réponse du lecteur de fichier, pas dans
    // chargerImageFond : le voile se pose donc ici, et pas autour de l'appel.
    ouvrirAttente("Envoi de l'image…", "Une image de couverture peut peser lourd : le transfert prend quelques secondes.");
    messageCouv.textContent = "Envoi de l'image en cours...";
    try {
      // L'envoi renvoie l'URL publique : c'est elle qu'on range dans le livre.
      const chemin = await uploaderImageStorage(
        `${obtenirPrefixeImagesUtilisateur()}/${livre.id}_${modeCourant}.${extension}`, dataUrl);

      if (ancienChemin && ancienChemin !== chemin) {
        supprimerImageStorage(ancienChemin).catch(() => {});
        delete cacheImagesURL[ancienChemin];
      }

      data.imageChemin = chemin;
      data.image = null;
      data.imgZoom = 1;
      data.imgOffsetX = 0;
      data.imgOffsetY = 0;
      cacheImagesURL[chemin] = dataUrl; // aperçu immédiat sans refaire de requête
      messageCouv.textContent = "";
      previewCouverture();
      marquerModifie();
      planifierBrouillon();
    } catch (erreur) {
      messageCouv.textContent = erreur.message;
    } finally {
      fermerAttente();
    }
  };
  reader.readAsDataURL(fichier);
}

function supprimerImageFond() {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;

  if (data.imageChemin) {
    supprimerImageStorage(data.imageChemin).catch(() => {});
    delete cacheImagesURL[data.imageChemin];
  }

  data.image = null;
  data.imageChemin = null;
  data.imgZoom = 1;
  data.imgOffsetX = 0;
  data.imgOffsetY = 0;
  document.getElementById("inputImage").value = "";
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}


// ----- Mode aperçu -----

let modeApercu = false;
let indexApercu = 0; // 0 = couverture ; 1..nbSpreads = pages intérieures ; nbSpreads+1 = 4e de couverture

function nombreSpreadsApercu() {
  const pages = livreActuel().pages;
  return Math.max(1, Math.ceil(pages.length / 2));
}


function fermerApercu() {
  modeApercu = false;
  document.getElementById("vueApercu").style.display = "none";
  document.getElementById("vueEditeur").style.display = "flex";
  document.querySelector(".sommaire").style.display = "";
  appliquerFormatPage(livreActuel().format || "149x210");
  afficherSpread();
  afficherSommaire();
}

let animationEnCours = false;

function apercuSuivant() {
  if (animationEnCours) return;
  const derniere = nombreSpreadsApercu() + 1;
  if (indexApercu < derniere) animerTransition(1);
}

function apercuPrecedent() {
  if (animationEnCours) return;
  if (indexApercu > 0) animerTransition(-1);
}

// ----- Animation de tournage de page -----

// Type de vue à un index d'aperçu donné (couverture, intérieur, 4e de couv.)
function typeVueApercu(idx) {
  const derniere = nombreSpreadsApercu() + 1;
  if (idx <= 0) return "couverture";
  if (idx >= derniere) return "quatrieme";
  return "interieur";
}

// Pages gauche/droite (et leurs numéros) d'une double-page intérieure
function donneesInterieur(idx) {
  const pages = livreActuel().pages;
  const iGauche = (idx - 1) * 2;
  const iDroite = iGauche + 1;
  return {
    gauche: pages[iGauche] || null,
    droite: pages[iDroite] || null,
    numG: iGauche + 1,
    numD: pages[iDroite] ? iDroite + 1 : ""
  };
}

function animerTransition(direction) {
  animationEnCours = true;
  const from = indexApercu;
  const to = from + direction;
  // Toutes les transitions utilisent le même tournage réaliste (feuille à deux
  // faces, pivot sur la reliure) : la couverture est modélisée comme une page
  // du livre, avec une page de garde en vis-à-vis.
  animerFlip(direction, from, to);
}

// Page de garde (vis-à-vis d'une couverture) : occupe la place mais reste
// invisible, pour que la couverture apparaisse sur un côté comme un vrai livre.
function creerPageViergeApercu() {
  const div = document.createElement("div");
  div.className = "page-livre page-vierge-apercu";
  return div;
}

// Élément DOM d'un côté (gauche/droite) d'une vue de l'aperçu.
// Couverture = [garde | couverture] ; 4e de couv. = [4e | garde].
function pageCoteApercu(idx, cote) {
  const derniere = nombreSpreadsApercu() + 1;
  if (idx <= 0) {
    return cote === "droite" ? creerPageCouvertureApercu("couverture") : creerPageViergeApercu();
  }
  if (idx >= derniere) {
    return cote === "gauche" ? creerPageCouvertureApercu("quatrieme") : creerPageViergeApercu();
  }
  const d = donneesInterieur(idx);
  return cote === "gauche"
    ? creerPageTexteApercu(d.gauche, d.numG)
    : creerPageTexteApercu(d.droite, d.numD);
}

function positionnerPageAnim(pageEl, left) {
  pageEl.style.position = "absolute";
  pageEl.style.top = "0";
  pageEl.style.left = left + "px";
}

// Feuille qui pivote autour de la reliure : la face avant montre la page qui
// s'en va, la face arrière la nouvelle page ; en-dessous, la page révélée.
function animerFlip(direction, from, to) {
  const conteneur = document.getElementById("conteneurApercu");
  const livre = livreActuel();
  const f = resoudreFormat(FORMATS, livre.format || "149x210", "149x210");
  const largPx = Math.round(f.larg * PX_PAR_MM);
  const hautPx = Math.round(f.haut * PX_PAR_MM);
  const gap = 26;

  conteneur.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = (2 * largPx + gap) + "px";
  wrap.style.height = hautPx + "px";
  wrap.style.perspective = "1800px";
  conteneur.appendChild(wrap);

  // Pages de base (dessous) + faces de la feuille qui tourne. La couverture est
  // une page comme les autres (avec une page de garde en vis-à-vis).
  let baseG, baseD, faceAvant, faceArriere, transEnd;
  if (direction === 1) {
    baseG       = pageCoteApercu(from, "gauche"); // reste à gauche
    baseD       = pageCoteApercu(to, "droite");   // révélée à droite
    faceAvant   = pageCoteApercu(from, "droite"); // recto : page qui s'en va
    faceArriere = pageCoteApercu(to, "gauche");   // verso : nouvelle page gauche
    transEnd = "rotateY(-180deg)";
  } else {
    baseG       = pageCoteApercu(to, "gauche");   // révélée à gauche
    baseD       = pageCoteApercu(from, "droite"); // reste à droite
    faceAvant   = pageCoteApercu(from, "gauche");
    faceArriere = pageCoteApercu(to, "droite");
    transEnd = "rotateY(180deg)";
  }
  positionnerPageAnim(baseG, 0);
  positionnerPageAnim(baseD, largPx + gap);
  wrap.appendChild(baseG);
  wrap.appendChild(baseD);

  // --- Feuille qui tourne ---
  const leaf = document.createElement("div");
  leaf.className = "anim-leaf";
  leaf.style.position = "absolute";
  leaf.style.top = "0";
  leaf.style.width = largPx + "px";
  leaf.style.height = hautPx + "px";
  leaf.style.transformStyle = "preserve-3d";

  // Axe de rotation pile sur la reliure (milieu du creux entre les deux pages).
  if (direction === 1) {
    leaf.style.left = (largPx + gap) + "px";
    leaf.style.transformOrigin = (-gap / 2) + "px center";
  } else {
    leaf.style.left = "0px";
    leaf.style.transformOrigin = (largPx + gap / 2) + "px center";
  }
  faceAvant.classList.add("anim-leaf-face");
  faceArriere.classList.add("anim-leaf-face", "dos");

  // Ombre de pliure : dégradé plus sombre côté reliure, pour donner du relief.
  // Une ombre par face ; leur opacité culmine au milieu du tournage.
  const ombreAvant = document.createElement("div");
  ombreAvant.className = "anim-leaf-ombre";
  ombreAvant.style.background = direction === 1
    ? "linear-gradient(to left, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)"
    : "linear-gradient(to right, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)";
  faceAvant.appendChild(ombreAvant);
  const ombreArriere = document.createElement("div");
  ombreArriere.className = "anim-leaf-ombre";
  ombreArriere.style.background = direction === 1
    ? "linear-gradient(to right, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)"
    : "linear-gradient(to left, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)";
  faceArriere.appendChild(ombreArriere);

  leaf.appendChild(faceAvant);
  leaf.appendChild(faceArriere);
  wrap.appendChild(leaf);

  // Dimensionne toutes les .page-livre et applique le zoom d'affichage.
  appliquerFormatPage(livre.format || "149x210");

  const reglages = { duration: 750, easing: "cubic-bezier(.35,0,.25,1)" };
  const anim = leaf.animate(
    [{ transform: "rotateY(0deg)" }, { transform: transEnd }],
    reglages
  );
  [ombreAvant, ombreArriere].forEach(o =>
    o.animate([{ opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }], reglages)
  );
  const terminer = () => {
    indexApercu = to;
    afficherApercu();
    animationEnCours = false;
  };
  anim.onfinish = terminer;
  anim.oncancel = terminer;
}

function afficherApercu() {
  const livre = livreActuel();
  const conteneur = document.getElementById("conteneurApercu");
  const indicateur = document.getElementById("indicateurApercu");
  const btnPrec = document.getElementById("btnApercuPrec");
  const btnSuiv = document.getElementById("btnApercuSuiv");
  const nbSpreads = nombreSpreadsApercu();
  const derniere = nbSpreads + 1;

  conteneur.innerHTML = "";
  btnPrec.disabled = indexApercu === 0;
  btnSuiv.disabled = indexApercu === derniere;

  if (indexApercu === 0) {
    indicateur.textContent = "Couverture";
  } else if (indexApercu === derniere) {
    indicateur.textContent = "4e de couverture";
  } else {
    const iGauche = (indexApercu - 1) * 2;
    const iDroite = iGauche + 1;
    const pages = livre.pages;
    indicateur.textContent = pages[iDroite] ? `Pages ${iGauche + 1} - ${iDroite + 1}` : `Page ${iGauche + 1}`;
  }

  // Toujours deux pages : la couverture occupe un côté, une page de garde
  // l'autre — comme un vrai livre, pour un tournage réaliste et sans à-coup.
  conteneur.appendChild(pageCoteApercu(indexApercu, "gauche"));
  conteneur.appendChild(pageCoteApercu(indexApercu, "droite"));

  appliquerFormatPage(livre.format || "149x210");
}

function creerPageTexteApercu(page, numero) {
  const div = document.createElement("div");
  div.className = "page-livre";

  const texte = document.createElement("div");
  texte.className = "texte-livre";
  texte.innerHTML = page ? page.contenu : "";
  div.appendChild(texte);

  const num = document.createElement("div");
  num.className = "numero-page";
  num.textContent = numero;
  div.appendChild(num);

  return div;
}

function creerPageCouvertureApercu(mode) {
  const livre = livreActuel();
  const data = mode === "couverture" ? livre.couverture : livre.quatrieme;

  const page = document.createElement("div");
  page.className = "page-livre";
  page.style.position = "relative";
  page.style.overflow = "hidden";

  const fond = document.createElement("div");
  fond.style.position = "absolute";
  fond.style.inset = "0";
  fond.style.background = (data && data.fond) || "#1a1a2e";
  page.appendChild(fond);

  if (data && data.imageChemin) {
    const img = document.createElement("img");
    img.draggable = false;
    img.style.position = "absolute";
    img.style.top = "0";
    img.style.left = "0";
    img.style.userSelect = "none";
    page.appendChild(img);

    if (cacheImagesURL[data.imageChemin]) {
      positionnerImageApercu(img, data, cacheImagesURL[data.imageChemin], page, data.imageChemin);
    } else {
      obtenirUrlImage(data.imageChemin).then((url) => {
        cacheImagesURL[data.imageChemin] = url;
        positionnerImageApercu(img, data, url, page, data.imageChemin);
      }).catch(() => {});
    }
  }

  const couche = document.createElement("div");
  couche.className = "apercu-couverture";
  couche.style.pointerEvents = "none";
  const couleurTexte = (data && data.texte) || "#ffffff";
  const afficherTitre = !data || data.afficherTitre !== false;
  const afficherAuteur = !data || data.afficherAuteur !== false;
  couche.innerHTML = `
    ${mode === "couverture" && afficherTitre ? `<div class="apercu-titre" style="color:${couleurTexte};${styleTexteCouv(data, "titre")}">${livre.titre || "Titre"}</div>` : ""}
    ${afficherAuteur ? `<div class="apercu-auteur" style="color:${couleurTexte};${styleTexteCouv(data, "auteur")}">${livre.auteur || "Auteur"}</div>` : ""}
  `;
  page.appendChild(couche);
  if (mode === "quatrieme") {
    page.insertAdjacentHTML("beforeend", htmlResumeCouv(data, couleurTexte, "apercu-resume"));
  }

  return page;
}

function positionnerImageApercu(img, data, url, page, chemin, dejaRetente) {
  img.onload = () => {
    const largeurConteneur = page.clientWidth;
    const hauteurConteneur = page.clientHeight;
    if (!largeurConteneur || !hauteurConteneur) return;
    adapterCadrageImage(data, img, largeurConteneur, hauteurConteneur);
    const echelleBase = Math.min(largeurConteneur / img.naturalWidth, hauteurConteneur / img.naturalHeight);
    const zoom = data.imgZoom || 1;
    const largeurAffichee = img.naturalWidth * echelleBase;
    const hauteurAffichee = img.naturalHeight * echelleBase;
    const centreX = (largeurConteneur - largeurAffichee) / 2;
    const centreY = (hauteurConteneur - hauteurAffichee) / 2;
    img.style.width = largeurAffichee + "px";
    img.style.height = hauteurAffichee + "px";
    img.style.transform = `translate(${centreX + (data.imgOffsetX || 0)}px, ${centreY + (data.imgOffsetY || 0)}px) scale(${zoom})`;
  };
  img.onerror = () => {
    if (dejaRetente) return; // on ne retente qu'une fois pour éviter une boucle
    delete cacheImagesURL[chemin];
    obtenirUrlImage(chemin).then((nouvelleUrl) => {
      cacheImagesURL[chemin] = nouvelleUrl;
      positionnerImageApercu(img, data, nouvelleUrl, page, chemin, true);
    }).catch(() => {});
  };
  img.src = url;
}

document.addEventListener("keydown", (e) => {
  if (!modeApercu) return;
  if (e.key === "ArrowRight") apercuSuivant();
  else if (e.key === "ArrowLeft") apercuPrecedent();
  else if (e.key === "Escape") fermerApercu();
});

// =====================================================================
//  État de sauvegarde (#9) et protection contre la perte de travail (#2)
// =====================================================================

let modifie = false;

function marquerModifie() {
  modifie = true;
  majIndicateur();
}

function marquerSauvegarde() {
  modifie = false;
  majIndicateur();
}

function majIndicateur() {
  const el = document.getElementById("etatSauvegarde");
  if (!el) return;
  if (modifie) {
    el.textContent = "● Modifications non enregistrées";
    el.className = "etat-sauvegarde non-enregistre";
  } else {
    el.textContent = "✓ Enregistré";
    el.className = "etat-sauvegarde enregistre";
  }
}

// ----- Brouillon local (localStorage) -----

let timerBrouillon = null;

function cleBrouillon() {
  return `brouillon_${localStorage.getItem("team53_login")}_${livreId}`;
}

function planifierBrouillon() {
  clearTimeout(timerBrouillon);
  timerBrouillon = setTimeout(sauvegarderBrouillon, 1500);
}

function sauvegarderBrouillon() {
  if (indexLivre === -1) return;
  flushSpread();
  try {
    localStorage.setItem(cleBrouillon(), JSON.stringify({ t: Date.now(), livre: livreActuel() }));
  } catch (e) { /* quota dépassé ou stockage indisponible : on ignore */ }
}

function effacerBrouillon() {
  try { localStorage.removeItem(cleBrouillon()); } catch (e) {}
}

function verifierBrouillon() {
  let brut;
  try { brut = localStorage.getItem(cleBrouillon()); } catch (e) { return; }
  if (!brut) return;

  let data;
  try { data = JSON.parse(brut); } catch (e) { effacerBrouillon(); return; }
  if (!data || !data.livre) { effacerBrouillon(); return; }

  // Brouillon identique à la version distante : rien à restaurer
  if (JSON.stringify(data.livre) === JSON.stringify(livreActuel())) { effacerBrouillon(); return; }

  const date = new Date(data.t).toLocaleString("fr-FR");
  const restaurer = confirm(
    `Un brouillon non enregistré de ce livre a été trouvé (${date}).\n\n` +
    "OK = restaurer ce brouillon.\n" +
    "Annuler = ignorer et garder la dernière version enregistrée."
  );
  if (restaurer) {
    bibliotheque.livres[indexLivre] = data.livre;
    indexSpread = 0;
    marquerModifie();
  } else {
    effacerBrouillon();
  }
}

// =====================================================================
//  Historique annuler / rétablir par double-page (#4)
// =====================================================================

let historique = { undo: [], redo: [] };


// =====================================================================
//  Compteur de mots (#10)
// =====================================================================

let timerCompteur = null;

function planifierCompteurMots() {
  clearTimeout(timerCompteur);
  timerCompteur = setTimeout(majCompteurMots, 600);
}


// =====================================================================
//  Recherche et remplacement (#5)
// =====================================================================

let rechercheMatches = [];   // { page: index de page, offset: position dans le texte }
let rechercheCourante = -1;

function basculerRecherche(forcerOuverture) {
  const panneau = document.getElementById("panneauRecherche");
  if (!panneau) return;
  const ouvrir = forcerOuverture || panneau.style.display === "none";
  panneau.style.display = ouvrir ? "flex" : "none";
  if (ouvrir) {
    const champ = document.getElementById("champRecherche");
    champ.focus();
    champ.select();
    if (champ.value) lancerRecherche();
  } else {
    rechercheMatches = [];
    rechercheCourante = -1;
  }
}

// Texte brut d'une page (sans balises HTML)
function texteBrutPage(contenu) {
  const tmp = document.createElement("div");
  tmp.innerHTML = contenu || "";
  return tmp.textContent || "";
}

function lancerRecherche() {
  flushSpread();
  const requete = document.getElementById("champRecherche").value;
  rechercheMatches = [];
  rechercheCourante = -1;

  if (requete) {
    const req = requete.toLowerCase();
    const pages = livreActuel().pages;
    pages.forEach((p, iPage) => {
      const texte = texteBrutPage(p.contenu).toLowerCase();
      let pos = texte.indexOf(req);
      while (pos !== -1) {
        rechercheMatches.push({ page: iPage, offset: pos });
        pos = texte.indexOf(req, pos + Math.max(1, req.length));
      }
    });
  }

  majCompteurRecherche();
  if (rechercheMatches.length > 0) allerMatch(1);
}

function majCompteurRecherche() {
  const el = document.getElementById("compteurRecherche");
  if (!el) return;
  el.textContent = rechercheMatches.length === 0
    ? "0/0"
    : `${rechercheCourante + 1}/${rechercheMatches.length}`;
}

function allerMatch(direction) {
  // (Re)lancer si la requête a changé depuis le dernier calcul
  const requete = document.getElementById("champRecherche").value;
  if (requete && rechercheMatches.length === 0 && rechercheCourante === -1) {
    lancerRecherche();
    return;
  }
  if (rechercheMatches.length === 0) { majCompteurRecherche(); return; }

  rechercheCourante = (rechercheCourante + direction + rechercheMatches.length) % rechercheMatches.length;
  surlignerMatch(rechercheMatches[rechercheCourante]);
  majCompteurRecherche();
}

// Va chercher un passage du livre et le sélectionne : la recherche s'en sert
// pour ses résultats, la vérification des espaces pour ses signalements.
// `eclairer` ajoute un clignotement par-dessus : sur deux caractères au milieu
// d'une page pleine, la seule sélection se remarque à peine.
function surlignerPosition(page, offset, longueur, eclairer) {
  // Les offsets sont comptés sur les pages : elles doivent être à jour.
  assurerPagesAJour();

  // Naviguer vers la double-page contenant le résultat
  const spreadCible = page - (page % 2);
  if (spreadCible !== indexSpread) {
    flushSpread();
    indexSpread = spreadCible;
    afficherSpread();
    afficherSommaire();
  }

  // L'éditeur n'a qu'UNE zone de texte par double-page — deux colonnes CSS,
  // pas deux éléments. Les « pageGauche » / « pageDroite » d'autrefois ont
  // disparu avec la réécriture : les chercher rendait null, et le passage
  // n'était ni sélectionné ni montré (la recherche en souffrait aussi).
  //
  // Un offset de PAGE se rejoue donc sur le texte du SPREAD : tel quel pour
  // une page de gauche, décalé de toute la page de gauche pour celle de
  // droite — les deux pages étant la partition du même texte.
  const ed = editeurEl();
  if (!ed) return;

  const pages = livreActuel().pages;
  const decalage = (page % 2 === 1 && pages[page - 1])
    ? texteBrutPage(pages[page - 1].contenu).length
    : 0;

  const pos = positionDansElement(ed, decalage + offset, longueur);
  if (!pos) return;

  const range = document.createRange();
  range.setStart(pos.debutNoeud, pos.debutOffset);
  range.setEnd(pos.finNoeud, pos.finOffset);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  ed.focus();

  const rectParent = ed.getBoundingClientRect();
  const rectSel = range.getBoundingClientRect();
  if (rectSel.bottom > rectParent.bottom || rectSel.top < rectParent.top) {
    const noeudParent = pos.debutNoeud.parentElement;
    if (noeudParent && noeudParent.scrollIntoView) noeudParent.scrollIntoView({ block: "nearest" });
  }

  // Après le défilement seulement : mesuré avant, le passage serait repéré à
  // l'endroit qu'il occupait juste avant de bouger.
  if (eclairer) requestAnimationFrame(() => eclairerRange(range));
}

// ----- Montrer du doigt un passage, sans y toucher -----
//
// On ne peut PAS envelopper le passage dans un <mark> : le texte du livre
// serait modifié, la double-page marquée comme sale, et la balise finirait
// enregistrée avec le manuscrit. On superpose donc un calque, posé aux
// coordonnées de la sélection et retiré tout seul — le texte, lui, ne bouge
// jamais d'un octet.
function effacerEclats() {
  document.querySelectorAll(".eclat-passage").forEach((e) => e.remove());
}

function eclairerRange(range) {
  effacerEclats();

  // Un rectangle par ligne : le passage peut être coupé par un retour à la
  // ligne (le point en fin de ligne, la majuscule au début de la suivante).
  //
  // Largeur ET hauteur : un curseur replié a bien une hauteur de ligne, et
  // signalerait alors un passage large de rien du tout.
  const rectangles = () =>
    [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);

  const rects = rectangles();
  if (!rects.length) return;

  const calques = rects.map(() => {
    const el = document.createElement("div");
    el.className = "eclat-passage";
    document.body.appendChild(el);
    return el;
  });

  // Deux pixels de marge : sur deux caractères, un cadre au ras du texte se
  // confond avec le texte lui-même.
  const poser = (liste) => liste.forEach((r, i) => {
    const el = calques[i];
    if (!el) return;
    el.style.left = (r.left - 2) + "px";
    el.style.top = (r.top - 2) + "px";
    el.style.width = (r.width + 4) + "px";
    el.style.height = (r.height + 4) + "px";
  });
  poser(rects);

  let fini = false;
  const retirer = () => {
    if (fini) return;
    fini = true;
    calques.forEach((el) => el.remove());
    window.removeEventListener("scroll", suivre, true);
    window.removeEventListener("resize", suivre);
  };

  // Le calque est posé en coordonnées d'ÉCRAN : dès que la page bouge, il
  // faut le reposer, sinon il désigne un endroit que le texte a quitté.
  //
  // Une première version l'effaçait au moindre défilement. C'était une
  // mauvaise réponse : aller au passage fait justement défiler la page
  // (focus, scrollIntoView), si bien que le repère s'effaçait à l'instant où
  // il aurait dû se voir — et le moindre coup de molette le faisait
  // disparaître avant qu'on l'ait trouvé. On le suit, donc.
  let enAttente = false;
  const suivre = () => {
    if (fini || enAttente) return;
    enAttente = true;
    requestAnimationFrame(() => {
      enAttente = false;
      if (fini) return;
      const maj = rectangles();
      // Plus de rectangle, ou pas le même découpage : le texte a été réécrit
      // ou la page a changé. Le repère n'a plus rien à désigner.
      if (maj.length !== calques.length) { retirer(); return; }
      poser(maj);
    });
  };

  // En capture : un défilement ne remonte pas, et c'est la zone de texte qui
  // défile, pas la fenêtre.
  window.addEventListener("scroll", suivre, true);
  window.addEventListener("resize", suivre);
  setTimeout(retirer, 2600);
}

// Convertit un offset texte (+ longueur) en positions de nœuds pour un Range
function positionDansElement(el, offset, longueur) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let total = 0;
  let debutNoeud = null, debutOffset = 0, finNoeud = null, finOffset = 0;
  const fin = offset + longueur;

  while (walker.nextNode()) {
    const noeud = walker.currentNode;
    const len = noeud.textContent.length;
    if (debutNoeud === null && total + len > offset) {
      debutNoeud = noeud;
      debutOffset = offset - total;
    }
    if (debutNoeud !== null && total + len >= fin) {
      finNoeud = noeud;
      finOffset = fin - total;
      break;
    }
    total += len;
  }

  if (!debutNoeud || !finNoeud) return null;
  return { debutNoeud, debutOffset, finNoeud, finOffset };
}

function remplacerCourant() {
  if (rechercheCourante < 0 || rechercheCourante >= rechercheMatches.length) return;
  const remplacement = document.getElementById("champRemplacer").value;
  surlignerMatch(rechercheMatches[rechercheCourante]);

  const sel = window.getSelection();
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(remplacement));

  flushSpread();
  marquerModifie();
  planifierBrouillon();
  planifierCompteurMots();

  // Recalculer les positions et se placer sur le résultat suivant
  const indexPrecedent = rechercheCourante;
  lancerRechercheEnConservant(indexPrecedent);
}

// Relance la recherche puis se positionne près de l'ancien index
function lancerRechercheEnConservant(indexSouhaite) {
  const requete = document.getElementById("champRecherche").value;
  rechercheMatches = [];
  rechercheCourante = -1;
  if (requete) {
    const req = requete.toLowerCase();
    livreActuel().pages.forEach((p, iPage) => {
      const texte = texteBrutPage(p.contenu).toLowerCase();
      let pos = texte.indexOf(req);
      while (pos !== -1) {
        rechercheMatches.push({ page: iPage, offset: pos });
        pos = texte.indexOf(req, pos + Math.max(1, req.length));
      }
    });
  }
  if (rechercheMatches.length > 0) {
    rechercheCourante = Math.min(indexSouhaite, rechercheMatches.length - 1) - 1;
    allerMatch(1);
  } else {
    majCompteurRecherche();
  }
}

function remplacerTout() {
  const requete = document.getElementById("champRecherche").value;
  if (!requete) return;
  const remplacement = document.getElementById("champRemplacer").value;
  const message = document.getElementById("message");

  flushSpread();
  let total = 0;

  // On remplace dans les DOUBLES-PAGES (la source). Modifier livre.pages
  // (pages dérivées) serait sans effet : elles sont régénérées depuis les
  // doubles-pages à la première occasion.
  const spreads = spreadsLivre();
  for (let i = 0; i < spreads.length; i++) {
    const conteneur = document.createElement("div");
    conteneur.innerHTML = spreads[i] || "";
    const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
    const noeuds = [];
    while (walker.nextNode()) noeuds.push(walker.currentNode);
    noeuds.forEach(noeud => {
      const res = remplacerInsensible(noeud.textContent, requete, remplacement);
      if (res.compte > 0) { noeud.textContent = res.texte; total += res.compte; }
    });
    spreads[i] = conteneur.innerHTML;
  }

  // Le texte change de longueur : on redécoupe tout le livre.
  if (total > 0) repaginerTout();

  afficherSpread();
  afficherSommaire();
  majCompteurMots();

  if (total > 0) {
    marquerModifie();
    planifierBrouillon();
  }
  rechercheMatches = [];
  rechercheCourante = -1;
  majCompteurRecherche();
  message.textContent = total > 0
    ? `${total} remplacement${total > 1 ? "s" : ""} effectué${total > 1 ? "s" : ""}.`
    : "Aucune occurrence trouvée.";
  setTimeout(() => { if (message.textContent.includes("remplacement") || message.textContent.includes("occurrence")) message.textContent = ""; }, 3000);
}

// =====================================================================
//  Les outils de relecture, repliés sous un seul bouton
//
//  Ils balaient le livre entier et ne servent que de loin en loin : les
//  laisser en vrac dans le sommaire, c'était le remplir de boutons qu'on
//  regarde sans les lire. « + Chapitre » reste dehors — celui-là sert en
//  écrivant.
//
//  Replié plutôt que flottant : le sommaire défile, et une liste flottante
//  s'y ferait rogner dès qu'elle passerait le bas du panneau.
// =====================================================================

// L'état survit au rechargement : rouvrir le livre ne redéplie pas un panneau
// qu'on avait refermé, et ne referme pas celui qu'on laisse ouvert.
const CLE_OUTILS_OUVERTS = "editeur_outils_ouverts";

function outilsLivreOuverts() {
  try { return localStorage.getItem(CLE_OUTILS_OUVERTS) === "1"; } catch (e) { return false; }
}

function appliquerEtatOutilsLivre(ouvert) {
  const bouton = document.getElementById("btnOutilsLivre");
  const liste = document.getElementById("listeOutilsLivre");
  if (!bouton || !liste) return;
  liste.hidden = !ouvert;
  bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
  bouton.classList.toggle("ouvert", ouvert);
  try { localStorage.setItem(CLE_OUTILS_OUVERTS, ouvert ? "1" : "0"); } catch (e) {}
}

function basculerOutilsLivre() {
  const liste = document.getElementById("listeOutilsLivre");
  if (!liste) return;
  const ouvre = liste.hidden;
  appliquerEtatOutilsLivre(ouvre);
  if (ouvre) {
    const premier = liste.querySelector(".outil");
    if (premier) premier.focus();
  }
}

// Un outil ouvre sa propre fenêtre : le panneau n'a plus de raison de rester
// déplié derrière, et le retrouver ouvert au retour serait une surprise.
function lancerOutilLivre(outil) {
  appliquerEtatOutilsLivre(false);
  const bouton = document.getElementById("btnOutilsLivre");
  if (bouton) bouton.focus();
  outil();
}

// Échap referme, les flèches parcourent : un panneau qui ne se pilote qu'à la
// souris est un panneau dont on sort mal.
(function brancherOutilsLivre() {
  const liste = document.getElementById("listeOutilsLivre");
  const bouton = document.getElementById("btnOutilsLivre");
  if (!liste || !bouton) return;

  appliquerEtatOutilsLivre(outilsLivreOuverts());

  liste.addEventListener("keydown", (e) => {
    const outils = [...liste.querySelectorAll(".outil")];
    const i = outils.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      appliquerEtatOutilsLivre(false);
      bouton.focus();
    } else if (e.key === "ArrowDown" && i !== -1) {
      e.preventDefault();
      outils[(i + 1) % outils.length].focus();
    } else if (e.key === "ArrowUp" && i !== -1) {
      e.preventDefault();
      outils[(i - 1 + outils.length) % outils.length].focus();
    }
  });
})();

// =====================================================================
//  Espaces manquants après un point
//
//  « lui-même.Dégager le » au lieu de « lui-même. Dégager le ». La faute se
//  voit mal à l'écran — le point se perd entre deux lettres — et un livre
//  entier peut en porter des dizaines sans qu'on en remarque une seule.
//
//  Ce qu'on signale : une ponctuation de FIN DE PHRASE (. ! ?) immédiatement
//  suivie d'une MAJUSCULE. C'est ce couple qui ne s'écrit jamais collé en
//  français, et c'est lui qui rend le repérage sûr : chercher tous les points
//  suivis d'une lettre quelconque ramènerait « fichier.txt », « 3.14 » ou
//  « exemple.com » à chaque ligne, et la liste deviendrait inutilisable.
// =====================================================================

// La ponctuation qui ferme une phrase, collée à la majuscule suivante.
const COLLAGE_PONCTUATION = /[.!?](?=\p{Lu})/gu;

// « J.R.R. Tolkien », « U.S.A. », « M.Dupont » : un point qui suit une
// capitale ISOLÉE est une initiale, pas une fin de phrase. On les laisse
// tranquilles — écarter quelques vrais oublis coûte moins cher que de couper
// un sigle ou un nom propre en deux, ce qu'aucune relecture ne rattraperait.
function estInitiale(texte, i) {
  if (texte[i] !== ".") return false;           // ! et ? ne forment pas d'initiales
  const avant = texte[i - 1];
  if (!avant || !/\p{Lu}/u.test(avant)) return false;
  const avantAvant = texte[i - 2];
  // Capitale isolée : début du texte, ou précédée d'autre chose qu'une lettre
  // (l'espace de « J.R », ou le point de « J.R.R »).
  return !avantAvant || !/\p{L}/u.test(avantAvant);
}

// Position de chaque ponctuation collée, dans l'ordre du texte.
function trouverCollages(texte) {
  const positions = [];
  const balayeur = new RegExp(COLLAGE_PONCTUATION.source, "gu");
  let m;
  while ((m = balayeur.exec(texte)) !== null) {
    if (!estInitiale(texte, m.index)) positions.push(m.index);
  }
  return positions;
}

// Ce qu'on montre dans la liste : de quoi reconnaître le passage sans ouvrir
// la page. Coupé aux mots, pour ne pas trancher au milieu d'un mot.
function extraitCollage(texte, off) {
  const debutBrut = Math.max(0, off - 34);
  const finBrut = Math.min(texte.length, off + 1 + 34);
  let avant = texte.slice(debutBrut, off + 1);
  let apres = texte.slice(off + 1, finBrut);
  if (debutBrut > 0) avant = "…" + avant.replace(/^\S*\s/, "");
  if (finBrut < texte.length) apres = apres.replace(/\s\S*$/, "") + "…";
  return { avant, apres };
}

// Les éléments qui font un paragraphe à eux seuls. Leur contenu ne se
// prolonge pas dans le suivant : entre deux, il y a une rupture, pas un
// enchaînement de phrase.
const BLOCS_TEXTE = /^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|DIV|TD|TH|SECTION|ARTICLE|FIGCAPTION|PRE)$/;

// Éléments qui rompent la ligne sans porter de texte. Ils comptent autant
// qu'un changement de paragraphe : ce livre sépare justement ses paragraphes
// par « <br><br> » à l'intérieur d'un même <p>, si bien que le texte d'avant
// et celui d'après se suivent sans rien entre eux. Sans cette rupture, la fin
// d'un paragraphe (« …cris de guerre. ») toucherait le début du suivant
// (« Il y a plus d'un siècle… ») et formerait un faux « guerre.Il ».
const RUPTURES_TEXTE = /^(BR|HR)$/;

function blocParent(noeud, racine) {
  let el = noeud.parentElement;
  while (el && el !== racine && !BLOCS_TEXTE.test(el.tagName)) el = el.parentElement;
  return el || racine;
}

// Relève les collages d'un fragment, en offsets sur son texte entier.
//
// Deux précautions, et elles tirent en sens contraire :
//
//  - On examine le texte CONCATÉNÉ, pas chaque nœud isolément : une mise en
//    forme peut couper le passage en deux (« <em>lui-même.</em>Dégager »), et
//    le collage serait invisible de chaque côté pris à part.
//  - Mais on ne concatène QUE JUSQU'À LA PROCHAINE RUPTURE — changement de
//    bloc, ou simple <br>. Sans cela, la fin d'un paragraphe toucherait le
//    début du suivant : « …il partit. » suivi d'un « Le lendemain… »
//    formerait un faux « partit.Le », et l'outil signalerait chaque fin de
//    paragraphe du livre pour y coller une espace inutile.
//
// Les offsets rendus portent sur le texte complet du fragment (celui que rend
// textContent), pour que la liste et la correction désignent le même endroit.
function collagesDansFragment(conteneur) {
  const noeuds = [];
  const offsets = [];
  let global = 0;                 // offset dans le texte entier du fragment

  let texteCourant = "";          // texte accumulé depuis la dernière rupture
  let debutCourant = 0;           // son offset de départ
  let blocCourant = null;

  // Le texte accumulé forme un passage continu : on y cherche les collages,
  // puis on repart à zéro.
  const cloturer = () => {
    if (texteCourant) {
      trouverCollages(texteCourant).forEach((off) => offsets.push(debutCourant + off));
      texteCourant = "";
    }
  };

  // Éléments ET texte : les <br> n'apparaîtraient pas dans un parcours limité
  // aux nœuds de texte, et c'est précisément eux qu'il faut voir passer.
  const walker = document.createTreeWalker(conteneur,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const n = walker.currentNode;

    if (n.nodeType === 1) {
      if (RUPTURES_TEXTE.test(n.tagName) || BLOCS_TEXTE.test(n.tagName)) cloturer();
      continue;                   // une balise en elle-même ne porte pas de texte
    }

    // Changement de bloc sans balise de rupture rencontrée (sortie d'un <p>
    // vers du texte nu, par exemple).
    const bloc = blocParent(n, conteneur);
    if (bloc !== blocCourant) { cloturer(); blocCourant = bloc; }

    if (!texteCourant) debutCourant = global;
    texteCourant += n.textContent;
    noeuds.push(n);
    global += n.textContent.length;
  }
  cloturer();

  return { noeuds, offsets };
}

// Insère les espaces manquantes dans un fragment, et rend leur nombre.
function insererEspacesManquants(conteneur) {
  const { noeuds, offsets } = collagesDansFragment(conteneur);

  // De la fin vers le début : une espace insérée ne décale alors aucune des
  // positions qu'il reste à traiter.
  for (let k = offsets.length - 1; k >= 0; k--) {
    const cible = offsets[k] + 1;            // juste après la ponctuation
    let debut = 0;
    for (const noeud of noeuds) {
      const fin = debut + noeud.textContent.length;
      if (cible <= fin) {
        const dans = cible - debut;
        noeud.textContent = noeud.textContent.slice(0, dans) + " " + noeud.textContent.slice(dans);
        break;
      }
      debut = fin;
    }
  }
  return offsets.length;
}

// ----- La vue -----

function ouvrirVerificationEspaces() {
  if (modeApercu || modeCouverture) return;
  flushSpread();
  assurerPagesAJour();

  // Le relevé se fait sur les PAGES : c'est ce que l'auteur a sous les yeux,
  // et cela donne à chaque signalement son numéro de page et son passage.
  // Même fonction de relevé que la correction — sans quoi la liste montrerait
  // des passages que le bouton ne touche pas, ou l'inverse.
  const trouvailles = [];
  livreActuel().pages.forEach((p, iPage) => {
    const boite = document.createElement("div");
    boite.innerHTML = p.contenu || "";
    const texte = boite.textContent || "";
    collagesDansFragment(boite).offsets.forEach((off) => {
      trouvailles.push(Object.assign({ page: iPage, offset: off }, extraitCollage(texte, off)));
    });
  });

  ouvrirDialogueEspaces(trouvailles);
}

function fermerDialogueEspaces() {
  const d = document.getElementById("dialogueEspaces");
  if (d) d.remove();
}

function ouvrirDialogueEspaces(trouvailles) {
  fermerDialogueEspaces();

  const n = trouvailles.length;
  let html = '<div class="modal-impression-carte ci-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>Espaces après les points</h3>";

  if (!n) {
    html += '<p class="mi-intro">Aucun point collé au mot suivant : tout est en ordre.</p>' +
      '<div class="ci-actions"><button class="ci-annuler">Fermer</button></div></div>';
  } else {
    html += '<p class="mi-intro">' + n + " passage" + (n > 1 ? "s où une ponctuation est collée" : " où une ponctuation est collée") +
      " au mot suivant. Cliquez sur une ligne pour aller la corriger à la main, " +
      "ou ajoutez toutes les espaces d&rsquo;un coup.</p>" +
      '<div class="renom-outils">' +
        '<span class="renom-compte">Les initiales (J.R.R., U.S.A.) sont volontairement ignorées.</span>' +
      "</div>" +
      '<div class="renom-liste esp-liste">';

    trouvailles.forEach((t, i) => {
      html += '<button type="button" class="esp-ligne" data-i="' + i + '" ' +
        'title="Aller à ce passage">' +
        '<span class="renom-page">p.' + (t.page + 1) + "</span>" +
        '<span class="esp-extrait">' +
          '<span class="esp-avant">' + echapperTitre(t.avant) + "</span>" +
          '<span class="esp-trou" aria-label="espace manquante">&#9251;</span>' +
          '<span class="esp-apres">' + echapperTitre(t.apres) + "</span>" +
        "</span>" +
      "</button>";
    });

    html += "</div>" +
      '<div class="ci-actions">' +
        '<button class="ci-annuler">Fermer</button>' +
        '<button class="ci-generer">Ajouter les ' + n + " espaces</button>" +
      "</div>";
  }
  html += "</div>";

  const fond = document.createElement("div");
  fond.id = "dialogueEspaces";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerDialogueEspaces(); });
  document.body.appendChild(fond);

  fond.querySelector(".mi-fermer").onclick = fermerDialogueEspaces;
  fond.querySelector(".ci-annuler").onclick = fermerDialogueEspaces;

  fond.querySelectorAll(".esp-ligne").forEach((b) => {
    b.onclick = () => {
      const t = trouvailles[Number(b.dataset.i)];
      fermerDialogueEspaces();
      // La ponctuation ET la majuscule collée : on voit ce qui manque entre
      // les deux, et taper l'espace remplace directement la sélection.
      surlignerPosition(t.page, t.offset, 2, true);
    };
  });

  const bouton = fond.querySelector(".ci-generer");
  if (bouton) bouton.onclick = () => { fermerDialogueEspaces(); corrigerTousLesCollages(); };
}

// ----- La correction en bloc -----
//
// Elle travaille sur les DOUBLES-PAGES (la source), jamais sur les pages :
// celles-ci sont dérivées et seraient recalculées par-dessus, comme le fait
// déjà « Tout remplacer ».
function corrigerTousLesCollages() {
  flushSpread();

  const spreads = spreadsLivre();
  let total = 0;
  for (let i = 0; i < spreads.length; i++) {
    const conteneur = document.createElement("div");
    conteneur.innerHTML = spreads[i] || "";
    const n = insererEspacesManquants(conteneur);
    if (n > 0) { spreads[i] = conteneur.innerHTML; total += n; }
  }

  // Le texte s'allonge : le livre se redécoupe.
  if (total > 0) repaginerTout();

  afficherSpread();
  afficherSommaire();
  majCompteurMots();

  if (total > 0) {
    marquerModifie();
    planifierBrouillon();
  }

  const message = document.getElementById("message");
  if (message) {
    message.textContent = total > 0
      ? total + " espace" + (total > 1 ? "s ajoutées" : " ajoutée") + "."
      : "Aucun point collé au mot suivant.";
    const pose = message.textContent;
    setTimeout(() => { if (message.textContent === pose) message.textContent = ""; }, 3000);
  }
}

// Remplacement insensible à la casse dans une chaîne, avec comptage
function remplacerInsensible(texte, recherche, remplacement) {
  const rechercheBas = recherche.toLowerCase();
  const texteBas = texte.toLowerCase();
  let resultat = "";
  let compte = 0;
  let i = 0;
  while (i < texte.length) {
    if (texteBas.startsWith(rechercheBas, i)) {
      resultat += remplacement;
      i += recherche.length;
      compte++;
    } else {
      resultat += texte[i];
      i++;
    }
  }
  return { texte: resultat, compte };
}

// =====================================================================
//  Pagination continue : le texte déborde automatiquement d'une page
//  à la suivante, en cascade (comme un traitement de texte).
// =====================================================================

// Position du curseur exprimée en nombre de caractères depuis le début d'un élément
function offsetCaret(conteneur) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (r.startContainer !== conteneur && !conteneur.contains(r.startContainer)) return null;
  const avant = document.createRange();
  avant.selectNodeContents(conteneur);
  avant.setEnd(r.startContainer, r.startOffset);
  return avant.toString().length;
}

// Place le curseur à une position caractère donnée dans un élément
function placerCaretAOffset(conteneur, offset) {
  const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
  let total = 0, dernier = null, noeud;
  while ((noeud = walker.nextNode())) {
    dernier = noeud;
    const len = noeud.textContent.length;
    if (total + len >= offset) {
      const range = document.createRange();
      range.setStart(noeud, Math.max(0, Math.min(len, offset - total)));
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    total += len;
  }
  // Au-delà du texte : fin du contenu
  const range = document.createRange();
  if (dernier) range.setStart(dernier, dernier.textContent.length);
  else range.selectNodeContents(conteneur);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}


// Relancer la recherche quand on tape dans le champ (script chargé en fin de body :
// l'élément existe déjà, on branche directement)
(function brancherChampRecherche() {
  const champ = document.getElementById("champRecherche");
  if (champ) {
    champ.addEventListener("input", () => {
      rechercheCourante = -1;
      rechercheMatches = [];
      lancerRecherche();
    });
  }
})();

// =====================================================================
//  MOTEUR D'ÉDITION (v2) — zone unique à deux colonnes
//
//  Principe de sûreté : le texte est stocké EN CONTINU par double-page
//  (livre.spreads[]). On ne le coupe QU'aux frontières de double-page, et
//  cette coupe est une partition stricte (aucun texte perdu ni réordonné).
//  Le découpage page par page (livre.pages[]) est seulement DÉRIVÉ, en
//  lecture seule, pour le sommaire, l'aperçu et l'impression.
//
//  Ces définitions remplacent volontairement les versions précédentes.
// =====================================================================

let pagesObsoletes = true;
let timerFlux = null;

function editeurEl() { return document.getElementById("editeurSpread"); }
function mesureEl()  { return document.getElementById("mesureSpread"); }
function numSpread() { return Math.floor(indexSpread / 2); }

// ----- Modèle : doubles-pages continues -----

function spreadsLivre() {
  const livre = livreActuel();
  if (!Array.isArray(livre.spreads)) migrerVersSpreads(livre);
  return livre.spreads;
}

// Migration NON DESTRUCTIVE : livre.pages est conservé tel quel (secours).
// On reconstruit le texte continu en recollant les pages deux par deux.
function migrerVersSpreads(livre) {
  const pages = Array.isArray(livre.pages) ? livre.pages : [];
  const spreads = [];
  for (let i = 0; i < pages.length; i += 2) {
    const a = (pages[i] && pages[i].contenu) || "";
    const b = (pages[i + 1] && pages[i + 1].contenu) || "";
    spreads.push(fusionnerSuite(a, b));
  }
  if (spreads.length === 0) spreads.push("");
  livre.spreads = spreads;
}

function assurerSpread(i) {
  const spreads = spreadsLivre();
  while (spreads.length <= i) spreads.push("");
}

// ----- Découpe géométrique (toujours sur le mesureur caché, jamais sur
//       la zone d'édition : ni le curseur ni le zoom ne sont perturbés) -----

function seuilsColonnes(el) {
  const g = geomEdition;
  const gauche = el.getBoundingClientRect().left;
  return {
    col2: gauche + g.largeurColonne + g.gouttiere / 2,
    col3: gauche + 2 * g.largeurColonne + g.gouttiere * 1.5
  };
}

// Premier caractère (en ordre du document) situé au-delà d'un seuil horizontal.
function pointCoupe(el, seuilX) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const len = n.textContent.length;
    for (let i = 0; i < len; i++) {
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      const rect = r.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.left >= seuilX - 0.5) return { node: n, offset: i };
    }
  }
  return null;
}

function blocAncetre(node) {
  let b = node;
  while (b && b.nodeType === Node.TEXT_NODE) b = b.parentNode;
  while (b && !/^(P|H1|H2|H3|LI|BLOCKQUOTE|DIV)$/.test(b.tagName || "")) b = b.parentNode;
  return b;
}

// Le point est-il au tout début de son bloc ? (sinon, couper le bloc crée
// une suite : on la marque pour pouvoir la recoller sans faux paragraphe)
function estDebutDeBloc(node, offset) {
  const b = blocAncetre(node);
  if (!b) return true;
  const r = document.createRange();
  r.setStart(b, 0);
  r.setEnd(node, offset);
  return r.toString() === "";
}

function htmlEntre(el, a, b, marquerSuite) {
  const r = document.createRange();
  if (a) r.setStart(a.node, a.offset); else r.setStart(el, 0);
  if (b) r.setEnd(b.node, b.offset);   else r.setEnd(el, el.childNodes.length);
  const d = document.createElement("div");
  d.appendChild(r.cloneContents());
  if (marquerSuite && a && !estDebutDeBloc(a.node, a.offset) && d.firstElementChild) {
    d.firstElementChild.setAttribute("data-suite", "1");
  }
  return d.innerHTML;
}

// Recolle deux morceaux : si le 1er bloc de b est marqué « suite », il
// prolonge le dernier bloc de a (pas de faux saut de paragraphe).
function fusionnerSuite(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";
  const da = document.createElement("div"); da.innerHTML = a;
  const db = document.createElement("div"); db.innerHTML = b;
  const dernier = da.lastElementChild;
  const premier = db.firstElementChild;
  if (dernier && premier && premier.getAttribute("data-suite") === "1" && dernier.tagName === premier.tagName) {
    premier.removeAttribute("data-suite");
    while (premier.firstChild) dernier.appendChild(premier.firstChild);
    db.removeChild(premier);
    while (db.firstChild) da.appendChild(db.firstChild);
    return da.innerHTML;
  }
  if (premier && premier.getAttribute("data-suite")) premier.removeAttribute("data-suite");
  return da.innerHTML + db.innerHTML;
}

// Partition stricte d'un contenu : ce qui tient dans la double-page, et le reste.
function calculerPartition(html) {
  const mes = mesureEl();
  if (!mes || !geomEdition) return { garde: html || "", overflow: "" };
  mes.innerHTML = html || "";
  const p3 = pointCoupe(mes, seuilsColonnes(mes).col3);
  const res = {
    garde: htmlEntre(mes, null, p3, false),
    overflow: p3 ? htmlEntre(mes, p3, null, true) : ""
  };
  mes.innerHTML = "";
  return res;
}

// Découpe (lecture seule) d'une double-page en ses deux pages.
function calculerDeuxPages(html) {
  const mes = mesureEl();
  if (!mes || !geomEdition) return { gauche: html || "", droite: "" };
  mes.innerHTML = html || "";
  const p2 = pointCoupe(mes, seuilsColonnes(mes).col2);
  // La coupe entre les deux pages laisse souvent une coquille de titre vide
  // en fin de page gauche (le titre lui-même passant à droite). Elle est
  // invisible à l'écran mais coûte tout l'espace au-dessus des titres à
  // l'impression, où elle repousse le texte hors de la page.
  const res = {
    gauche: retirerTitresVides(htmlEntre(mes, null, p2, false)),
    droite: p2 ? retirerTitresVides(htmlEntre(mes, p2, null, true)) : ""
  };
  mes.innerHTML = "";
  return res;
}

// ----- pages[] dérivé (sommaire, aperçu, impression) -----

function regenererPagesSpread(s) {
  const livre = livreActuel();
  const spreads = spreadsLivre();
  if (s < 0 || s >= spreads.length) return;
  if (!Array.isArray(livre.pages)) livre.pages = [];
  const d = calculerDeuxPages(spreads[s]);

  // Écrire à un index au-delà de la fin laisserait des trous (éléments
  // indéfinis) dans le tableau : on le complète d'abord avec des pages vides.
  while (livre.pages.length < 2 * s) {
    livre.pages.push({ id: "p" + (livre.pages.length + 1), contenu: "" });
  }
  livre.pages[2 * s]     = { id: "p" + (2 * s + 1), contenu: d.gauche };
  livre.pages[2 * s + 1] = { id: "p" + (2 * s + 2), contenu: d.droite };

  // Sur la DERNIÈRE double-page, retirer les pages vides de fin — comme le
  // fait regenererToutesPages. Sans cela, le compteur annoncerait une page de
  // plus qu'il n'y en a réellement. (Les pages vides du milieu sont conservées :
  // elles maintiennent l'alignement page <-> double-page.)
  nettoyerPagesVidesFin();
}

// Retire les pages vides en fin de livre (au moins une page conservée).
// Régénérer une double-page écrit toujours DEUX pages : sans ce nettoyage,
// une page vide finale réapparaîtrait et le compteur annoncerait une page
// de trop.
function nettoyerPagesVidesFin() {
  const pages = livreActuel().pages;
  if (!Array.isArray(pages)) return;
  while (pages.length > 1) {
    const derniere = pages[pages.length - 1];
    if (derniere && texteBrutPage(derniere.contenu).trim()) break;
    pages.pop();
  }
}

function regenererToutesPages() {
  const livre = livreActuel();
  const spreads = spreadsLivre();
  const pages = [];
  spreads.forEach((html, s) => {
    const d = calculerDeuxPages(html);
    pages.push({ id: "p" + (2 * s + 1), contenu: d.gauche });
    pages.push({ id: "p" + (2 * s + 2), contenu: d.droite });
  });
  // Retirer les pages vides en fin de livre (en gardant au moins une page)
  while (pages.length > 1 && !texteBrutPage(pages[pages.length - 1].contenu).trim()) pages.pop();
  livre.pages = pages.length ? pages : [{ id: "p1", contenu: "" }];
  pagesObsoletes = false;
}

function assurerPagesAJour() {
  if (pagesObsoletes) regenererToutesPages();
}

// ----- Affichage / enregistrement de la double-page courante -----

function afficherSpread() {
  const ed = editeurEl();
  if (!ed) return;
  const s = numSpread();
  assurerSpread(s);
  const spreads = spreadsLivre();
  ed.innerHTML = spreads[s] || "";
  const nG = document.getElementById("numeroGauche");
  const nD = document.getElementById("numeroDroite");
  if (nG) nG.textContent = indexSpread + 1;
  if (nD) nD.textContent = indexSpread + 2;
  majBoutonsNavigation();
}

// Grise « Précédent » sur la première double-page et « Suivant » sur la dernière,
// pour bien montrer qu'on ne peut pas aller au-delà (et ne pas créer de page vide).
function majBoutonsNavigation() {
  const spreads = spreadsLivre();
  const btnPrec = document.querySelector('button[onclick="pagePrecedente()"]');
  const btnSuiv = document.querySelector('button[onclick="pageSuivante()"]');
  if (btnPrec) btnPrec.disabled = numSpread() <= 0;
  if (btnSuiv) btnSuiv.disabled = numSpread() >= spreads.length - 1;
}

function flushSpread() {
  const ed = editeurEl();
  if (!ed || indexLivre === -1) return;
  const s = numSpread();
  assurerSpread(s);
  const spreads = spreadsLivre();

  // On ENREGISTRE simplement l'état courant de la zone d'édition.
  //
  // Surtout, on ne reporte PAS ici le débordement sur la double-page suivante :
  // flushSpread ne rafraîchit pas la zone d'édition, qui continuerait donc
  // d'afficher le texte complet. Le gererFlux suivant repartirait de ce contenu
  // et reporterait une SECONDE fois le même débordement — le texte se
  // retrouvait dupliqué (reproduit en collant deux fois un chapitre).
  //
  // La découpe est le rôle de gererFlux, qui, lui, réaffiche la double-page et
  // suit le curseur. Les opérations qui exigent un découpage exact
  // (sauvegarde, aperçu, impression, changement de format) repaginent déjà.
  spreads[s] = ed.innerHTML;
  regenererPagesSpread(s);
  // Les pages des doubles-pages modifiées viennent d'être régénérées ci-dessus :
  // inutile d'invalider tout le livre, ce qui forcerait un recalcul complet
  // (~130 ms sur 60 pages) à chaque changement de page ou collage.
}

// ----- Saisie : auto-flow du débordement (le texte continue tout seul) -----

function surSaisie() {
  marquerModifie();
  planifierBrouillon();
  planifierCompteurMots();
  clearTimeout(timerFlux);
  timerFlux = setTimeout(gererFlux, 350);
}

function gererFlux() {
  const ed = editeurEl();
  if (!ed || indexLivre === -1) return;
  const s = numSpread();
  assurerSpread(s);
  const spreads = spreadsLivre();

  // Pas de débordement : on enregistre sans rien réécrire — l'annuler/rétablir
  // natif et la position du curseur sont donc intacts.
  if (ed.scrollWidth <= ed.clientWidth + 2) {
    spreads[s] = ed.innerHTML;
    // Seule cette double-page a changé : on régénère SES pages uniquement.
    // (Marquer tout le livre obsolète forcerait un recalcul complet à chaque
    //  frappe — ~190 ms sur un livre de 60 pages, d'où les ralentissements.)
    regenererPagesSpread(s);
    afficherSommaire();
    return;
  }

  // Débordement : coupe propre, report sur la double-page suivante.
  const offset = offsetCaret(ed);
  const part = calculerPartition(ed.innerHTML);
  // La coupe peut laisser un titre vide en fin de page : on l'enlève.
  // (Uniquement sur la partie qui reste derrière — jamais là où est le curseur.)
  spreads[s] = retirerTitresVides(part.garde);
  assurerSpread(s + 1);
  spreads[s + 1] = fusionnerSuite(part.overflow, spreads[s + 1] || "");
  pagesObsoletes = true;

  // Le report peut à son tour déborder (collage de plusieurs pages d'un coup) :
  // on poursuit la cascade jusqu'à ce que tout tienne. Sans cela, les
  // doubles-pages suivantes resteraient trop pleines et les pages dérivées
  // (sommaire, compteur, impression) seraient fausses.
  let k = s + 1, securite = 0;
  while (k < spreads.length && securite < 2000) {
    securite++;
    const suite = calculerPartition(spreads[k]);
    if (!suite.overflow || texteBrutPage(suite.overflow).trim() === "") break;
    spreads[k] = retirerTitresVides(suite.garde);
    assurerSpread(k + 1);
    spreads[k + 1] = fusionnerSuite(suite.overflow, spreads[k + 1] || "");
    k++;
  }

  const longueurGarde = texteBrutPage(part.garde).length;
  if (offset !== null && offset > longueurGarde) {
    // Le curseur est dans le texte reporté : on suit sur la double-page suivante.
    indexSpread += 2;
    afficherSpread();
    afficherSommaire();
    const cible = editeurEl();
    cible.focus();
    placerCaretAOffset(cible, offset - longueurGarde);
  } else {
    afficherSpread();
    afficherSommaire();
    if (offset !== null) {
      const cible = editeurEl();
      cible.focus();
      placerCaretAOffset(cible, offset);
    }
  }
}

// ----- Historique : désormais NATIF -----
// Les anciennes fonctions d'historique maison sont neutralisées (elles lisaient
// des éléments qui n'existent plus). enregistrerHistorique() est conservée comme
// point d'accroche : les fonctions de formatage l'appellent déjà, on s'en sert
// pour planifier l'enregistrement du texte.

function enregistrerHistorique() {
  clearTimeout(timerFlux);
  timerFlux = setTimeout(gererFlux, 350);
}

// ----- Annuler / rétablir : natifs -----

function annuler() {
  if (modeApercu || modeCouverture) return;
  const ed = editeurEl();
  if (ed) ed.focus();
  document.execCommand("undo");
  surSaisie();
}

function retablir() {
  if (modeApercu || modeCouverture) return;
  const ed = editeurEl();
  if (ed) ed.focus();
  document.execCommand("redo");
  surSaisie();
}

// ----- Interligne : s'applique dans la zone unique -----

function appliquerInterligne(valeur) {
  restaurerSelection();
  const conteneur = editeurEl();
  if (!conteneur) return;
  const sel = window.getSelection();
  let cibles = [];
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    conteneur.querySelectorAll("p, h2, h3, li").forEach(bloc => {
      if (range.intersectsNode(bloc)) cibles.push(bloc);
    });
  }
  if (cibles.length === 0) cibles = [conteneur];
  cibles.forEach(bloc => { bloc.style.lineHeight = valeur; });
  marquerModifie();

  // L'interligne change la hauteur occupée par le texte : il faut re-répartir
  // TOUT le livre. Un simple gererFlux() ne traiterait que le débordement de la
  // double-page courante — en réduisant l'interligne, le texte des pages
  // suivantes ne remonterait pas et la page resterait à moitié vide.
  flushSpread();
  repaginerTout();

  const spreads = spreadsLivre();
  if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);

  afficherSpread();
  afficherSommaire();
  majCompteurMots();
  planifierBrouillon();
}

// ----- Navigation -----

function allerAPage(i) {
  flushSpread();
  indexSpread = i - (i % 2);
  afficherSpread();
  afficherSommaire();
}

function pagePrecedente() {
  flushSpread();
  if (indexSpread - 2 >= 0) {
    indexSpread -= 2;
    afficherSpread();
    afficherSommaire();
  }
}

function pageSuivante() {
  flushSpread();
  // Ne crée PAS de nouvelle page : on ne fait qu'avancer si une double-page
  // suivante existe déjà. (Les pages naissent uniquement du débordement du texte.)
  const spreads = spreadsLivre();
  if (numSpread() + 1 < spreads.length) {
    indexSpread += 2;
    afficherSpread();
    afficherSommaire();
  }
}

// ----- Sommaire : liste des CHAPITRES -----
// Un chapitre = un titre (h2) dans le texte continu. On les retrouve dans les
// pages dérivées, ce qui donne directement le numéro de page de chacun.

function listerChapitres() {
  assurerPagesAJour();
  const pages = livreActuel().pages || [];
  const chapitres = [];
  const boite = document.createElement("div");
  pages.forEach((page, i) => {
    boite.innerHTML = (page && page.contenu) || "";
    boite.querySelectorAll("h2").forEach(h => {
      const titre = (h.textContent || "").trim();
      // Un titre vide = fragment laissé par la coupe entre deux pages : on l'ignore.
      if (!titre) return;
      chapitres.push({ titre, page: i });
    });
  });
  return chapitres;
}

function afficherSommaire() {
  const liste = document.getElementById("listePages");
  if (!liste) return;
  liste.innerHTML = "";

  const chapitres = listerChapitres();

  if (chapitres.length === 0) {
    const li = document.createElement("li");
    li.className = "sommaire-vide";
    li.textContent = "Aucun chapitre pour l'instant.";
    liste.appendChild(li);
    return;
  }

  chapitres.forEach((ch, i) => {
    const li = document.createElement("li");
    li.className = (ch.page === indexSpread || ch.page === indexSpread + 1) ? "actif" : "";

    const libelle = document.createElement("span");
    libelle.className = "libelle-page";
    libelle.textContent = ch.titre;
    libelle.title = ch.titre;
    libelle.onclick = () => allerAPage(ch.page);
    li.appendChild(libelle);

    const num = document.createElement("span");
    num.className = "num-chapitre";
    num.textContent = "p." + (ch.page + 1);
    li.appendChild(num);

    // Ouvrir le chapitre d'un seul tenant, sans pages à gérer (manuscrit.js).
    const editer = document.createElement("button");
    editer.className = "editer-chapitre";
    editer.textContent = "✎";
    editer.title = "Écrire ce chapitre d'un seul tenant, sans pagination";
    editer.setAttribute("aria-label", "Écrire le chapitre " + ch.titre);
    editer.onclick = (e) => { e.stopPropagation(); ouvrirManuscrit(i); };
    li.appendChild(editer);

    const suppr = document.createElement("button");
    suppr.className = "supprimer-chapitre";
    suppr.textContent = "✕";
    suppr.title = "Supprimer ce chapitre et tout son contenu";
    suppr.setAttribute("aria-label", "Supprimer le chapitre " + ch.titre);
    suppr.onclick = (e) => { e.stopPropagation(); supprimerChapitre(i); };
    li.appendChild(suppr);

    liste.appendChild(li);
  });
}

// ----- Suppression d'un chapitre entier -----
// Supprime le titre ET tout son contenu, jusqu'au chapitre suivant (exclu).
// On travaille sur le livre recollé, puis on redécoupe : la pagination reste
// juste et aucun autre chapitre n'est touché.

function contenuCompletLivre() {
  let tout = "";
  for (const sp of spreadsLivre()) tout = fusionnerSuite(tout, sp);
  return tout;
}

// Découpe le contenu complet en tranches : une par chapitre, plus l'éventuel
// texte d'avant-propos (avant le premier titre).
function tranchesChapitres(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  const tranches = [];
  let courante = { titre: null, noeuds: [] };
  [...d.childNodes].forEach(n => {
    const estTitre = n.nodeType === 1 && n.tagName === "H2" && (n.textContent || "").trim();
    if (estTitre) {
      tranches.push(courante);
      courante = { titre: (n.textContent || "").trim(), noeuds: [n] };
    } else {
      courante.noeuds.push(n);
    }
  });
  tranches.push(courante);
  return { conteneur: d, tranches };
}

function supprimerChapitre(indexChapitre) {
  if (indexChapitre < 0 || modeApercu || modeCouverture) return;

  const { conteneur, tranches } = tranchesChapitres(contenuCompletLivre());
  // tranches[0] = texte avant le premier chapitre ; les chapitres suivent.
  const avecTitre = tranches.filter(t => t.titre !== null);
  const cible = avecTitre[indexChapitre];
  if (!cible) return;

  // Compter ce qui va disparaître, pour une confirmation honnête.
  const boite = document.createElement("div");
  cible.noeuds.forEach(n => boite.appendChild(n.cloneNode(true)));
  const texte = (boite.textContent || "").trim();
  const mots = texte ? texte.split(/\s+/).length : 0;

  if (!confirm(
      "Supprimer le chapitre « " + cible.titre + " » ?\n\n" +
      "Son titre et tout son contenu seront supprimés (" + mots + " mot" + (mots > 1 ? "s" : "") + ").\n" +
      "Cette action ne peut pas être annulée avec Ctrl+Z.")) {
    return;
  }

  // Comme pour la remise aux tailles du format : le voile vient après la
  // question, sans quoi il s'afficherait derrière elle.
  pendantAttenteLourde("Suppression du chapitre…", () => {
    cible.noeuds.forEach(n => { if (n.parentNode === conteneur) conteneur.removeChild(n); });

    const livre = livreActuel();
    livre.spreads = [conteneur.innerHTML || ""];
    indexSpread = 0;
    repaginerTout();

    const spreads = spreadsLivre();
    if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);

    afficherSpread();
    afficherSommaire();
    majCompteurMots();
    marquerModifie();
    planifierBrouillon();

    const message = document.getElementById("message");
    if (message) {
      message.textContent = "Chapitre « " + cible.titre + " » supprimé.";
      setTimeout(() => {
        if (message.textContent.indexOf("supprimé") !== -1) message.textContent = "";
      }, 3000);
    }
  }, "Le livre est recomposé sans lui.");
}

// ===== Casse des titres de chapitre =====
//
// « Chapitre 1 - Fin de l'Ère d'Harmonie » : la seconde moitié d'un titre est
// souvent saisie en capitales de titre, à l'anglaise. En français, seule la
// première lettre et les noms propres en portent.
//
// Deviner ce qui est un nom propre est impossible dans l'absolu : le livre
// lui-même sert de dictionnaire. Un mot capitalisé AU MILIEU d'une phrase du
// texte courant ne peut guère être qu'un nom propre — c'est ainsi que
// « Harmonie » ou « Sylvandar » sont reconnus, tandis que « Ère » ne l'est
// pas. La proposition reste modifiable avant d'être appliquée : l'éditeur
// propose, l'auteur décide.

function echapperTitre(txt) {
  return String(txt == null ? "" : txt)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Tirets et deux-points qui séparent le numéro du titre proprement dit.
const SEPARATEURS_TITRE = /\s[-–—:]\s/;

// Un « mot » au sens de la casse : lettres accentuées, apostrophes exclues
// (« l'Ère » compte pour deux mots, et c'est bien « Ère » qu'on examine).
const MOT_TITRE = /[\p{L}][\p{L}\p{M}-]*/gu;

// Fin de phrase : le mot qui suit porte une majuscule sans être un nom propre.
const FIN_DE_PHRASE = /[.!?…:;»"]\s*$|^\s*$/;

// Noms propres du livre : tout mot capitalisé qui n'ouvre pas une phrase.
function nomsPropresDuLivre() {
  const boite = document.createElement("div");
  boite.innerHTML = contenuCompletLivre();
  // Les titres sont justement ce qu'on cherche à corriger : ils ne peuvent pas
  // servir de référence.
  boite.querySelectorAll("h2").forEach((h) => h.remove());
  const texte = boite.textContent || "";

  const noms = new Set();
  let m;
  const balayeur = new RegExp(MOT_TITRE.source, "gu");
  while ((m = balayeur.exec(texte)) !== null) {
    const mot = m[0];
    const avant = texte.slice(Math.max(0, m.index - 40), m.index);
    const premierDePhrase = FIN_DE_PHRASE.test(avant);
    if (!premierDePhrase && mot[0] !== mot[0].toLowerCase()) {
      noms.add(mot.toLowerCase());
    }
  }
  return noms;
}

// La proposition pour un titre. Le texte avant le séparateur n'est pas touché
// (« Chapitre 1 » garde sa majuscule), pas plus que le premier mot d'après.
function titreEnCasseFrancaise(titre, noms) {
  const sep = titre.match(SEPARATEURS_TITRE);
  const debut = sep ? sep.index + sep[0].length : 0;
  // Sans séparateur, il n'y a rien à corriger : le titre est déjà « le titre ».
  if (!sep) return titre;

  let premier = true;
  const suite = titre.slice(debut).replace(new RegExp(MOT_TITRE.source, "gu"), (mot) => {
    if (premier) { premier = false; return mot; }
    if (mot[0] === mot[0].toLowerCase()) return mot;          // déjà en minuscule
    if (noms.has(mot.toLowerCase())) return mot;              // nom propre du livre
    if (mot === mot.toUpperCase() && mot.length > 1) return mot; // sigle (ADN, IA…)
    return mot[0].toLowerCase() + mot.slice(1);
  });
  return titre.slice(0, debut) + suite;
}

// Réécrit un titre SANS toucher à son balisage : on ne change que la casse,
// donc les longueurs concordent et chaque nœud de texte reçoit sa tranche.
// Remplacer textContent perdrait les italiques ou les petites capitales.
function reecrireCasse(h2, nouveauTexte) {
  if ((h2.textContent || "").length !== nouveauTexte.length) {
    h2.textContent = nouveauTexte;   // sécurité : mieux vaut le texte juste
    return;
  }
  let position = 0;
  const parcours = document.createTreeWalker(h2, NodeFilter.SHOW_TEXT);
  let noeud;
  while ((noeud = parcours.nextNode())) {
    const n = noeud.nodeValue.length;
    noeud.nodeValue = nouveauTexte.substr(position, n);
    position += n;
  }
}

// ===== Renommer les chapitres =====
//
// Renommer un chapitre se faisait dans le texte, page par page : il fallait
// retrouver le titre dans la mise en pages, cliquer dedans, corriger, puis
// recommencer trente-quatre fois. Le sommaire connaît pourtant déjà tous les
// titres — autant les présenter ensemble et les laisser corriger à la file.
//
// Un titre porte parfois des italiques ou des petites capitales : on ne
// remplace donc pas son contenu, on réécrit ses nœuds de texte (voir
// reecrireCasse), qui préserve le balisage tant que la longueur concorde.
//
// La correction de casse d'autrefois n'a pas disparu : elle est devenue un
// bouton de ce dialogue, qui REMPLIT les champs au lieu d'appliquer d'office.
// L'éditeur propose toujours, l'auteur décide toujours — mais dans la même
// fenêtre que le reste.

function ouvrirRenommageChapitres() {
  if (modeApercu || modeCouverture) return;
  flushSpread();

  const conteneur = document.createElement("div");
  conteneur.innerHTML = contenuCompletLivre();
  const titres = [...conteneur.querySelectorAll("h2")]
    .filter((h) => (h.textContent || "").trim());

  if (!titres.length) {
    alert("Aucun chapitre à renommer : ce livre n'a pas encore de titre.");
    return;
  }

  // Le numéro de page vient du sommaire. Si les deux comptes divergent — un
  // titre coupé entre deux pages, par exemple — on préfère n'afficher aucun
  // numéro plutôt qu'un numéro faux.
  const duSommaire = listerChapitres();
  const pages = duSommaire.length === titres.length ? duSommaire : null;

  const lignes = titres.map((h, i) => ({
    h2: h,
    avant: h.textContent,
    page: pages ? pages[i].page + 1 : null
  }));

  ouvrirDialogueRenommage(lignes, conteneur);
}

function ouvrirDialogueRenommage(lignes, conteneur) {
  const ancien = document.getElementById("dialogueRenommage");
  if (ancien) ancien.remove();

  let html = '<div class="modal-impression-carte ci-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>Renommer les chapitres</h3>" +
    '<p class="mi-intro">Tous les titres du livre, dans l&rsquo;ordre. Corrigez ceux ' +
    "que vous voulez et laissez les autres tels quels : seuls les titres modifiés " +
    "seront réécrits. <b>Entrée</b> passe au suivant, <b>Ctrl+Entrée</b> enregistre.</p>" +
    '<div class="renom-outils">' +
      '<button type="button" class="renom-casse" ' +
        'title="Proposer la casse française : les majuscules superflues après le tiret sont retirées, les noms propres du livre conservés">' +
        "Aa Casse française</button>" +
      '<button type="button" class="renom-annuler-tout" title="Remettre tous les titres tels qu&rsquo;ils sont dans le livre">Tout remettre</button>' +
      '<span class="renom-compte"></span>' +
    "</div>" +
    '<div class="renom-liste">';

  lignes.forEach((l, i) => {
    html += '<div class="renom-ligne" data-i="' + i + '">' +
      '<span class="renom-page">' + (l.page ? "p." + l.page : "&mdash;") + "</span>" +
      '<input type="text" class="renom-champ" data-i="' + i + '" value="' + echapperTitre(l.avant) + '">' +
      '<p class="renom-avant"></p>' +
    "</div>";
  });

  html += "</div>" +
    '<div class="ci-actions">' +
      '<button class="ci-annuler">Annuler</button>' +
      '<button class="ci-generer" disabled>Aucun changement</button>' +
    "</div></div>";

  const fond = document.createElement("div");
  fond.id = "dialogueRenommage";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  document.body.appendChild(fond);

  const champs = [...fond.querySelectorAll(".renom-champ")];
  const bouton = fond.querySelector(".ci-generer");

  // Ce qui a changé, et ce que cela va coûter : le bouton ne ment jamais sur
  // le nombre de titres qu'il va réécrire.
  const modifies = () => champs.filter((c, i) => c.value !== lignes[i].avant && c.value.trim());

  const rafraichir = () => {
    champs.forEach((c, i) => {
      const change = c.value !== lignes[i].avant;
      const ligne = c.closest(".renom-ligne");
      ligne.classList.toggle("modifiee", change && !!c.value.trim());
      ligne.classList.toggle("vide", !c.value.trim());
      // L'ancien titre ne s'affiche que s'il diffère : sinon il ne dirait
      // rien que le champ ne dise déjà, et la liste doublerait de hauteur.
      const avant = ligne.querySelector(".renom-avant");
      avant.textContent = change ? lignes[i].avant : "";
      avant.style.display = change ? "" : "none";
    });
    const n = modifies().length;
    const vides = champs.filter((c) => !c.value.trim()).length;
    bouton.disabled = n === 0;
    bouton.textContent = n === 0 ? "Aucun changement"
      : "Renommer " + n + " chapitre" + (n > 1 ? "s" : "");
    fond.querySelector(".renom-compte").textContent = vides
      ? vides + " titre" + (vides > 1 ? "s vides seront ignorés." : " vide sera ignoré.")
      : "";
  };

  champs.forEach((c, i) => {
    c.addEventListener("input", rafraichir);
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); appliquer(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const suivant = champs[i + 1];
        if (suivant) { suivant.focus(); suivant.select(); }
        else appliquer();
      }
    });
  });

  fond.querySelector(".renom-casse").onclick = () => {
    const noms = nomsPropresDuLivre();
    champs.forEach((c) => { c.value = titreEnCasseFrancaise(c.value, noms); });
    rafraichir();
  };
  fond.querySelector(".renom-annuler-tout").onclick = () => {
    champs.forEach((c, i) => { c.value = lignes[i].avant; });
    rafraichir();
  };

  const fermer = () => {
    if (modifies().length &&
        !confirm("Fermer sans renommer ?\n\nLes titres saisis seront perdus.")) return;
    document.removeEventListener("keydown", surEchap, true);
    fond.remove();
  };
  const surEchap = (e) => {
    if (e.key === "Escape" && document.getElementById("dialogueRenommage")) {
      e.preventDefault(); e.stopPropagation(); fermer();
    }
  };
  document.addEventListener("keydown", surEchap, true);

  fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
  fond.querySelector(".mi-fermer").onclick = fermer;
  fond.querySelector(".ci-annuler").onclick = fermer;

  function appliquer() {
    let n = 0;
    champs.forEach((c, i) => {
      const valeur = c.value;
      // Un champ vidé n'efface pas le chapitre : il serait bien trop facile de
      // perdre un titre d'un coup de touche. On le laisse tel quel.
      if (!valeur.trim() || valeur === lignes[i].avant) return;
      reecrireCasse(lignes[i].h2, valeur);
      n++;
    });
    document.removeEventListener("keydown", surEchap, true);
    fond.remove();
    if (n) {
      appliquerContenuComplet(conteneur.innerHTML, n,
        n + " chapitre" + (n > 1 ? "s renommés" : " renommé") + ".");
    }
  }
  bouton.onclick = appliquer;

  rafraichir();
  if (champs[0]) { champs[0].focus(); champs[0].select(); }
}

// Repose le livre entier après une retouche globale, comme le fait la
// suppression d'un chapitre : on réécrit le texte continu, puis on repagine.
// `texteMessage` : ce qui s'affiche en bas quand l'appelant sait mieux dire
// ce qu'il vient de faire (« 12 chapitres renommés » plutôt que « corrigés »).
function appliquerContenuComplet(html, nbTitres, texteMessage) {
  const livre = livreActuel();
  livre.spreads = [html || ""];
  indexSpread = 0;
  repaginerTout();

  const spreads = spreadsLivre();
  if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);

  afficherSpread();
  afficherSommaire();
  majCompteurMots();
  marquerModifie();
  planifierBrouillon();

  const message = document.getElementById("message");
  if (message) {
    const texte = texteMessage ||
      (nbTitres + " titre" + (nbTitres > 1 ? "s corrigés" : " corrigé") + ".");
    message.textContent = texte;
    // On n'efface que SON message : entre-temps, une sauvegarde ou une erreur
    // a pu écrire ici, et la faire disparaître serait pire que la laisser.
    setTimeout(() => {
      if (message.textContent === texte) message.textContent = "";
    }, 3000);
  }
}

// Ajoute un chapitre : un titre qui DÉMARRE SUR UNE NOUVELLE PAGE
// (saut de colonne forcé — une colonne = une page dans cette mise en page).
function ajouterChapitre() {
  if (modeApercu || modeCouverture) return;

  flushSpread();

  // Se placer sur la dernière double-page, à la toute fin du texte
  const spreads = spreadsLivre();
  indexSpread = Math.max(0, spreads.length - 1) * 2;
  afficherSpread();

  const ed = editeurEl();
  if (!ed) return;
  ed.focus();

  const range = document.createRange();
  range.selectNodeContents(ed);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // insertHTML : opération unique, donc annulable nativement (Ctrl+Z)
  document.execCommand(
    "insertHTML", false,
    '<h2 class="chapitre" style="break-before:column;">Nouveau chapitre</h2><p><br></p>'
  );

  marquerModifie();

  // gererFlux enregistre, découpe si ça déborde, re-rend la double-page ET suit
  // le curseur : on arrive déjà sur la page du nouveau chapitre.
  gererFlux();

  // Sélectionner le titre pour pouvoir le renommer immédiatement
  selectionnerDernierTitre();
  afficherSommaire();
}

// Sélectionne le dernier titre de chapitre non vide de la double-page affichée
function selectionnerDernierTitre() {
  const ed = editeurEl();
  if (!ed) return;
  const titres = [...ed.querySelectorAll("h2")].filter(h => (h.textContent || "").trim());
  const cible = titres[titres.length - 1];
  if (!cible) return;
  ed.focus();
  const r = document.createRange();
  r.selectNodeContents(cible);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  sauvegarderSelection();
}

// ----- Changement de format : on re-paginate tout le texte continu -----

function changerFormat(nouveauFormat) {
  if (!FORMATS[nouveauFormat] && !dimensionsFormatPersonnalise(nouveauFormat)) return;
  const livre = livreActuel();
  const ancienFormat = livre.format || "149x210";
  if (ancienFormat === nouveauFormat) return;

  flushSpread();

  // Les décalages de l'image de couverture sont en pixels relatifs à la taille
  // de page : on les met à l'échelle pour conserver le même cadrage.
  const fA = resoudreFormat(FORMATS, ancienFormat, "149x210");
  const fN = resoudreFormat(FORMATS, nouveauFormat, "149x210");
  const ratioX = fN.larg / fA.larg, ratioY = fN.haut / fA.haut;
  ["couverture", "quatrieme"].forEach(cle => {
    const d = livre[cle];
    if (!d) return;
    if (typeof d.imgOffsetX === "number") d.imgOffsetX *= ratioX;
    if (typeof d.imgOffsetY === "number") d.imgOffsetY *= ratioY;
  });

  livre.format = nouveauFormat;
  appliquerFormatPage(nouveauFormat); // met à jour la géométrie des colonnes
  initEspaceTitre();
  repaginerTout();

  const spreads = spreadsLivre();
  if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);
  afficherSpread();
  afficherSommaire();
  majCompteurMots();
  marquerModifie();
  planifierBrouillon();

  const sel = document.getElementById("selectFormat");
  if (sel) sel.textContent = libelleFormat(nouveauFormat);
}

function ouvrirChoixFormatEditeur() {
  const livre = livreActuel();
  ouvrirPanneauFormat(livre.format || "149x210", (formatKey) => changerFormat(formatKey));
}

// Retire les titres SANS TEXTE : coquilles laissées par la coupe des pages
// (un titre à saut de page laisse une balise vide en fin de page précédente).
// Invisibles dans le sommaire mais elles s'accumulent à chaque repagination et
// redeviennent des chapitres fantômes quand le texte se recompose autour.
function retirerTitresVides(html) {
  if (!html || html.indexOf("<h") === -1) return html;
  const d = document.createElement("div");
  d.innerHTML = html;
  let retire = false;
  d.querySelectorAll("h2, h3").forEach(h => {
    if (!(h.textContent || "").trim() && !h.querySelector("img")) { h.remove(); retire = true; }
  });
  return retire ? d.innerHTML : html;
}

// Recolle tout le livre puis le redécoupe en doubles-pages pour la géométrie
// courante. La recomposition est une partition stricte : aucun texte perdu.
function repaginerTout() {
  const livre = livreActuel();
  const spreads = spreadsLivre();
  let tout = "";
  for (const s of spreads) tout = fusionnerSuite(tout, s);
  tout = retirerTitresVides(tout);   // pas de coquilles reportées d'un découpage à l'autre

  const nouveaux = [];
  let reste = tout;
  let securite = 0;
  while (texteBrutPage(reste).trim() !== "" && securite < 5000) {
    securite++;
    const part = calculerPartition(reste);
    // Chaque coupe peut laisser un titre vide en fin de page : on nettoie
    // le morceau produit, sinon les coquilles se multiplient à chaque
    // repagination (et redeviennent des chapitres fantômes).
    nouveaux.push(retirerTitresVides(part.garde));
    reste = part.overflow || "";
    if (texteBrutPage(reste).trim() === "") break;
  }
  livre.spreads = nouveaux.length ? nouveaux : [""];
  pagesObsoletes = true;
  regenererToutesPages();

  // La zone d'édition affiche encore l'ANCIEN découpage : si on la laissait
  // telle quelle, le prochain flushSpread() réécrirait ce contenu périmé
  // dans le modèle et dupliquerait du texte. On la recale donc tout de suite.
  if (numSpread() >= livre.spreads.length) {
    indexSpread = Math.max(0, (livre.spreads.length - 1) * 2);
  }
  afficherSpread();
}

// ----- Compteur de mots (sur le texte continu) -----

function majCompteurMots() {
  if (indexLivre === -1) return;
  flushSpread();

  // On compte sur les doubles-pages (source), sans passer par assurerPagesAJour :
  // régénérer toutes les pages dérivées juste pour un compteur coûtait ~180 ms
  // sur un livre de 60 pages, à chaque frappe.
  let mots = 0;
  const tmp = document.createElement("div");
  spreadsLivre().forEach(html => {
    tmp.innerHTML = html || "";
    const txt = (tmp.textContent || "").trim();
    if (txt) mots += txt.split(/\s+/).length;
  });

  const nbPages = (livreActuel().pages || []).length;
  const el = document.getElementById("compteurMots");
  if (el) el.textContent = `${mots} mot${mots > 1 ? "s" : ""} · ${nbPages} page${nbPages > 1 ? "s" : ""}`;
}

// ----- Recherche : positionner dans la zone unique -----

// Le calcul d'offset et la navigation vivent dans surlignerPosition — une
// seule fois. Ils y étaient recopiés à l'identique, et deux copies d'une même
// arithmétique finissent toujours par diverger : c'est ainsi que la
// vérification des espaces a longtemps visé des « pageGauche » / « pageDroite »
// qui n'existent plus depuis la réécriture de l'éditeur.
function surlignerMatch(match) {
  const longueur = document.getElementById("champRecherche").value.length;
  if (!longueur) return;
  surlignerPosition(match.page, match.offset, longueur);
}

// ----- Sauvegarde : on régénère les pages dérivées avant d'écrire -----

async function sauvegarder() {
  const message = document.getElementById("message");

  // Seule la double-page en cours d'édition peut déborder (flushSpread ne
  // découpe pas). gererFlux la découpe et poursuit la cascade si besoin :
  // coût constant, au lieu de recoller et redécouper tout le livre
  // (~1,8 s sur 30 000 mots). Les opérations qui touchent TOUT le livre
  // (format, interligne, tailles) repaginent déjà de leur côté.
  gererFlux();

  // Les pages dérivées sont régénérées au fil des modifications : on ne
  // recalcule tout que si nécessaire. Garde de cohérence (coût nul) : la
  // sauvegarde est irréversible, on ne veut jamais y envoyer des pages
  // désynchronisées des doubles-pages.
  const nbSpreads = spreadsLivre().length;
  const nbPages = (livreActuel().pages || []).length;
  if (nbPages > nbSpreads * 2 || nbPages < nbSpreads * 2 - 1) {
    pagesObsoletes = true;
  }
  assurerPagesAJour();

  // Retirer les doubles-pages vides en fin de livre (au moins une)
  const spreads = spreadsLivre();
  while (spreads.length > 1 && !texteBrutPage(spreads[spreads.length - 1]).trim()) spreads.pop();
  if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);
  afficherSpread();
  afficherSommaire();

  try {
    majLeConnu = await enregistrerLivreDistant(livreActuel(), majLeConnu);
    message.textContent = "Sauvegardé avec succès.";
    marquerSauvegarde();
    effacerBrouillon();
  } catch (erreur) {
    if (erreur.conflit) { gererConflitSauvegarde(); return; }
    message.textContent = erreur.message;
  }
}

// ----- Aperçu : s'assurer que les pages dérivées sont à jour -----

function ouvrirApercu() {
  flushSpread();
  repaginerTout();   // découpage exact avant de feuilleter
  modeApercu = true;
  animationEnCours = false;
  indexApercu = 0;

  document.getElementById("vueEditeur").style.display = "none";
  document.getElementById("vueCouverture").style.display = "none";
  document.getElementById("vueApercu").style.display = "flex";
  document.querySelector(".sommaire").style.display = "none";

  afficherApercu();
}

// =====================================================================
//  Espace au-dessus des titres de chapitre (curseur « Titre »)
//
//  Pilote la variable CSS --espace-titre, utilisée par « .texte-livre h2 ».
//  Elle s'applique donc partout à la fois : zone d'édition, mesureur de
//  pagination, aperçu et impression.
// =====================================================================

let timerEspaceTitre = null;

function appliquerEspaceTitre(px) {
  document.documentElement.style.setProperty("--espace-titre", px + "px");
}

function initEspaceTitre() {
  const livre = livreActuel();
  let px = livre && typeof livre.espaceTitre === "number"
    ? livre.espaceTitre
    : typoDuFormat(livre && livre.format).espaceTitre;
  px = Math.max(0, Math.min(160, px));
  appliquerEspaceTitre(px);
  const slider = document.getElementById("sliderEspaceTitre");
  if (slider) slider.value = px;
  const valeur = document.getElementById("valeurEspaceTitre");
  if (valeur) valeur.textContent = px;
}

function setEspaceTitre(valeur) {
  const px = Math.max(0, Math.min(160, parseInt(valeur, 10) || 0));
  const livre = livreActuel();
  if (livre) livre.espaceTitre = px;

  // Retour visuel immédiat pendant le glissement du curseur.
  appliquerEspaceTitre(px);
  const etiquette = document.getElementById("valeurEspaceTitre");
  if (etiquette) etiquette.textContent = px;
  marquerModifie();

  // L'espace change la hauteur occupée : on re-répartit le texte, mais
  // seulement une fois le curseur relâché (sinon on repaginerait à chaque pixel).
  clearTimeout(timerEspaceTitre);
  timerEspaceTitre = setTimeout(() => {
    flushSpread();
    repaginerTout();
    const spreads = spreadsLivre();
    if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);
    afficherSpread();
    afficherSommaire();
    majCompteurMots();
    planifierBrouillon();
  }, 350);
}

// =====================================================================
//  Réglages du texte des couvertures (police, taille, position)
//
//  Les valeurs sont stockées avec les mêmes clés que styleTexteCouv()
//  (script.js) : <cle>Police, <cle>Taille, <cle>X, <cle>Y — ce qui garantit
//  un rendu identique dans l'éditeur, la bibliothèque et à l'impression.
// =====================================================================

function donneesCouvCourante() {
  if (indexLivre === -1 || !modeCouverture) return null;
  const livre = livreActuel();
  return modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
}

function setPoliceTexteCouv(cle, valeur) {
  const data = donneesCouvCourante();
  if (!data) return;
  data[cle + "Police"] = valeur || "";
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

// « titre » -> « Titre » : les identifiants des contrôles suivent la clé,
// ce qui évite une table de correspondance à rallonger à chaque élément.
function suffixeCouv(cle) {
  return cle.charAt(0).toUpperCase() + cle.slice(1);
}

function setTailleTexteCouv(cle, valeur) {
  const data = donneesCouvCourante();
  if (!data) return;
  const v = Math.max(50, Math.min(250, parseInt(valeur, 10) || 100));
  data[cle + "Taille"] = v;
  const etiquette = document.getElementById("valTaille" + suffixeCouv(cle));
  if (etiquette) etiquette.textContent = v;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

// Le texte libre de la 4e de couverture, et sa largeur de colonne.
function setTexteResumeCouv(valeur) {
  const data = donneesCouvCourante();
  if (!data) return;
  data.resumeTexte = valeur;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

function setLargeurResumeCouv(valeur) {
  const data = donneesCouvCourante();
  if (!data) return;
  const v = Math.max(20, Math.min(100, parseInt(valeur, 10) || 80));
  data.resumeLargeur = v;
  const etiquette = document.getElementById("valLargeurResume");
  if (etiquette) etiquette.textContent = v;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

function setAlignResumeCouv(valeur) {
  const data = donneesCouvCourante();
  if (!data) return;
  data.resumeAlign = valeur;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

function setPositionTexteCouv(cle, axe, valeur) {
  const data = donneesCouvCourante();
  if (!data) return;
  const A = (axe === "Y") ? "Y" : "X";
  const brut = parseInt(valeur, 10) || 0;
  const v = (A === "X") ? Math.max(-50, Math.min(50, brut)) : Math.max(0, Math.min(100, brut));
  data[cle + A] = v;
  const etiquette = document.getElementById("valPos" + suffixeCouv(cle) + A);
  if (etiquette) etiquette.textContent = v;
  previewCouverture();
  marquerModifie();
  planifierBrouillon();
}

// Recale les contrôles du panneau sur les valeurs enregistrées.
function synchroniserControlesCouv(data) {
  if (!data) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  ["titre", "auteur", "resume"].forEach(cle => {
    const suffixe = suffixeCouv(cle);
    const taille = typeof data[cle + "Taille"] === "number" ? data[cle + "Taille"] : 100;
    const x = typeof data[cle + "X"] === "number" ? data[cle + "X"] : 0;
    const y = typeof data[cle + "Y"] === "number" ? data[cle + "Y"] : 0;
    set("police" + suffixe, data[cle + "Police"] || "");
    set("taillePos" + suffixe, taille);   txt("valTaille" + suffixe, taille);
    set("pos" + suffixe + "X", x);        txt("valPos" + suffixe + "X", x);
    set("pos" + suffixe + "Y", y);        txt("valPos" + suffixe + "Y", y);
  });

  const largeur = typeof data.resumeLargeur === "number" ? data.resumeLargeur : 80;
  set("texteResume", data.resumeTexte || "");
  set("largeurResume", largeur);  txt("valLargeurResume", largeur);
  set("alignResume", data.resumeAlign || "left");
}

// Persiste « tutoriel éditeur vu » sur le compte, pour qu'il ne réapparaisse
// jamais, même sur un autre appareil.
async function marquerTutoEditeurVu() {
  await marquerTutoVuDistant("editeur");
}

// =====================================================================
//  Publication d'un livre (lecture seule pour les autres utilisateurs)
//
//  `livre.publie` est une colonne du livre, et la règle de lecture de la
//  table laisse passer les livres publiés quel qu'en soit l'auteur. L'ancien
//  index central publies.json a disparu avec elle : il n'y a plus deux
//  endroits à tenir d'accord, ni de risque qu'un livre supprimé reste inscrit
//  dans la galerie.
// =====================================================================

function majBoutonPublier() {
  const btn = document.getElementById("btnPublier");
  if (!btn || indexLivre === -1) return;
  const publie = !!livreActuel().publie;
  // Bouton-icône : on ne touche PAS au contenu (ce serait écraser le SVG),
  // seulement l'état visuel et le libellé accessible.
  const libelle = publie ? "Publié — cliquer pour dépublier" : "Publier";
  btn.title = libelle;
  btn.setAttribute("aria-label", libelle);
  btn.classList.toggle("actif", publie);
}

async function basculerPublication() {
  if (indexLivre === -1) return;
  const livre = livreActuel();
  const message = document.getElementById("message");
  const btn = document.getElementById("btnPublier");
  const publier = !livre.publie;

  if (publier && !confirm(
      "Publier « " + (livre.titre || "ce livre") + " » ?\n\n" +
      "Les autres utilisateurs connectés pourront le LIRE (sans le modifier). " +
      "Vous pourrez le dépublier à tout moment.")) {
    return;
  }

  if (btn) btn.disabled = true;
  if (message) message.textContent = publier ? "Publication en cours..." : "Dépublication en cours...";

  try {
    // Le drapeau part avec le livre, en une seule écriture. On régénère
    // TOUTES les pages dérivées d'abord : ce sont elles que le lecteur
    // affichera, il ne sait pas les recalculer (voir supabase/schema.sql).
    flushSpread();
    regenererToutesPages();
    livre.publie = publier;
    livre.publieLe = publier ? new Date().toISOString() : null;
    majLeConnu = await enregistrerLivreDistant(livre, majLeConnu);
    marquerSauvegarde();
    effacerBrouillon();

    if (message) message.textContent = publier
      ? "Livre publié : les autres pourront le lire."
      : "Livre dépublié.";
  } catch (erreur) {
    // Revenir sur le drapeau en cas d'échec, pour rester cohérent.
    livre.publie = !publier;
    if (message) message.textContent = "Échec : " + erreur.message;
  } finally {
    if (btn) btn.disabled = false;
    majBoutonPublier();
  }
}

function lancerTutorielEditeur(forcer) {
  if (typeof lancerTutoriel !== "function") return;
  lancerTutoriel([
    // 1 — La zone d'écriture (le livre en double-page)
    { cible: "#spreadEdition", titre: "1. La zone d'écriture",
      texte: "C'est ici que vous écrivez. Votre livre s'affiche en double-page, comme un vrai livre ouvert. Le texte est continu : dès qu'une page est pleine, la suite passe automatiquement sur la page suivante — vous n'avez jamais à gérer les coupures. La sélection, le copier-coller et l'annuler (Ctrl+Z) fonctionnent comme dans Word ou Google Docs." },

    // 2 — La barre d'outils
    { cible: ".barre-outils", titre: "2. La barre d'outils",
      texte: "Tous les outils de mise en forme. De gauche à droite : ↶ ↷ annuler / rétablir (Ctrl+Z, Ctrl+Y) · G I S pour gras, italique, souligné · les alignements, dont « justifié » qui aligne le texte des deux côtés comme dans un roman imprimé · les listes à puces ou numérotées · le style de paragraphe (Titre, Sous-titre) · la police · l'interligne · la taille en points · le curseur « Titre » qui règle l'espace laissé au-dessus des titres de chapitre · et la loupe pour rechercher et remplacer dans tout le livre (Ctrl+F). Astuce : sélectionnez d'abord votre texte, puis cliquez." },

    // 3 — Navigation et sauvegarde
    { cible: ".barre-actions", titre: "3. Naviguer & sauvegarder",
      texte: "« Précédent » et « Suivant » tournent les doubles-pages de votre livre. Au centre, « Sauvegarder » (ou Ctrl+S) enregistre votre travail en ligne — pensez-y régulièrement, et surtout avant de quitter la page." },

    // 4 — Les couvertures
    { cible: ".sommaire-couvertures", titre: "4. Les couvertures",
      texte: "Composez votre 1re de couverture et votre 4e de couverture : couleur ou image de fond, titre et nom d'auteur, avec des réglages de police, de taille et de position du texte pour un rendu soigné." },

    // 5 — Le format du livre
    { cible: "#selectFormat", titre: "5. Le format du livre",
      texte: "Choisissez la taille physique de votre livre (Roman, Grand roman, Poche, A4). Vous pouvez en changer à tout moment : tout le texte se re-répartit automatiquement sur les pages, sans jamais rien perdre." },

    // 6 — Mode aperçu
    { cible: 'button[onclick="ouvrirApercu()"]', titre: "6. Mode aperçu",
      texte: "Feuilletez votre livre comme en vrai, avec une animation de pages qui se tournent — couverture et 4e de couverture comprises. Idéal pour juger du rendu final avant d'imprimer." },

    // 7 — Imprimer / PDF
    { cible: 'button[onclick="exporterLivret()"]', titre: "7. Imprimer / PDF",
      texte: "Exportez en PDF ou imprimez au vrai format physique, en « livret à agrafer » : il ne reste plus qu'à plier la pile en deux et à agrafer au centre pour obtenir votre livre papier." },

    // 8 — Le sommaire (pages et chapitres)
    { cible: "#listePages", titre: "8. Le sommaire",
      texte: "La liste de toutes vos pages et de vos chapitres. Cliquez sur une entrée pour sauter directement à cet endroit du livre — pratique pour se déplacer vite dans un long manuscrit." },

    // 9 — Ajouter un chapitre
    { cible: ".btn-chapitre", titre: "9. Ajouter un chapitre",
      texte: "« + Chapitre » démarre un nouveau chapitre sur une nouvelle page, avec son titre. Le chapitre apparaît ensuite dans le sommaire pour y accéder en un clic." },

    // 10 — Retour à la bibliothèque
    { cible: 'button[onclick="retourBibliotheque()"]', titre: "10. Retour à la bibliothèque",
      texte: "Revenez à votre bibliothèque pour ouvrir un autre livre ou en créer un nouveau. Pensez à sauvegarder avant de quitter cette page." }
  ], {
    forcer: forcer,
    dejaVu: tutoDejaVu(moiCentralEditeur, "editeur"),
    onTermine: () => marquerTutoEditeurVu()
  });
}

// ----- Réinitialiser les tailles de texte de TOUT le livre -----
// Retire les tailles de police posées à la main (spans/font avec font-size),
// sans toucher au reste (gras, italique, police, couleur) : chaque élément
// retrouve ainsi sa taille par défaut selon son type — titre (h2), sous-titre
// (h3) ou paragraphe — définie en CSS.

function nettoyerTaillesHtml(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";

  d.querySelectorAll("[style]").forEach(el => {
    if (el.style && el.style.fontSize) {
      el.style.fontSize = "";
      if (!el.getAttribute("style")) el.removeAttribute("style");
    }
  });
  d.querySelectorAll("font[size]").forEach(f => f.removeAttribute("size"));

  // Déballer les <span> devenus sans aucun attribut (issus d'anciennes tailles)
  d.querySelectorAll("span").forEach(sp => {
    if (sp.attributes.length === 0) {
      while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
      sp.remove();
    }
  });

  return d.innerHTML;
}

function reinitialiserTailles() {
  if (indexLivre === -1 || modeApercu || modeCouverture) return;

  // Les valeurs annoncées sont celles du FORMAT du livre : remettre un poche
  // aux tailles d'un roman n'aurait aucun sens.
  const t = typoDuLivre();
  if (!confirm(
      "Remettre tout le texte du livre aux tailles par défaut de ce format ?\n\n" +
      "Titre " + t.titre + " · sous-titre " + t.sousTitre + " · paragraphe " + t.paragraphe +
      ", et l'espace au-dessus des titres à " + t.espaceTitre + ".\n\n" +
      "Les tailles de police que vous avez réglées à la main seront perdues.")) return;

  // Le voile ne se pose qu'ICI, après la question : posé avant, il se serait
  // affiché derrière le « confirm ».
  pendantAttenteLourde("Remise aux tailles du format…",
    () => {
      flushSpread();

      // L'espace au-dessus des titres fait partie de la mise en page du
      // format : il revient lui aussi à sa valeur.
      livreActuel().espaceTitre = t.espaceTitre;
      initEspaceTitre();

      const spreads = spreadsLivre();
      for (let i = 0; i < spreads.length; i++) spreads[i] = nettoyerTaillesHtml(spreads[i]);

      // Les tailles changent : on repagine tout le texte continu.
      repaginerTout();

      const n = spreadsLivre();
      if (numSpread() >= n.length) indexSpread = Math.max(0, (n.length - 1) * 2);

      afficherSpread();
      afficherSommaire();
      majCompteurMots();
      marquerModifie();
      planifierBrouillon();

      const message = document.getElementById("message");
      if (message) {
        message.textContent = "Tailles remises aux valeurs du format sur tout le livre.";
        setTimeout(() => { if (message.textContent.startsWith("Tailles remises")) message.textContent = ""; }, 2500);
      }
    },
    "Tout le texte est recomposé.");
}

// =====================================================================
//  Reflet de l'état de la sélection dans la barre d'outils
//
//  Met en évidence les effets actifs (gras, italique, alignement, listes) et
//  recale les listes déroulantes (style, police, interligne) et la taille sur
//  ce qui est réellement appliqué au curseur ou à la sélection.
//  Purement indicatif : on ne modifie jamais le texte ici, et changer la
//  valeur d'un <select> par script ne déclenche pas son onchange — l'édition
//  reste donc entièrement disponible.
// =====================================================================

// Bouton de la barre d'outils portant un onclick donné
function boutonOutil(fragmentOnclick) {
  return document.querySelector('.barre-outils button[onclick*="' + fragmentOnclick + '"]');
}

function marquerBouton(fragmentOnclick, actif) {
  const b = boutonOutil(fragmentOnclick);
  if (b) b.classList.toggle("actif", !!actif);
}

// Normalise une pile de polices pour pouvoir la comparer aux options du select
function normaliserPolice(v) {
  return (v || "").toLowerCase().replace(/["']/g, "").replace(/\s+/g, "");
}

function majEtatBarreOutils() {
  if (modeApercu || modeCouverture) return;
  const ed = editeurEl();
  if (!ed) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  if (!ed.contains(sel.anchorNode)) return;  // curseur hors de la zone d'écriture

  // --- Effets à bascule ---
  try {
    marquerBouton("'bold'", document.queryCommandState("bold"));
    marquerBouton("'italic'", document.queryCommandState("italic"));
    marquerBouton("'underline'", document.queryCommandState("underline"));
    marquerBouton("insertUnorderedList", document.queryCommandState("insertUnorderedList"));
    marquerBouton("insertOrderedList", document.queryCommandState("insertOrderedList"));
    marquerBouton("justifyLeft", document.queryCommandState("justifyLeft"));
    marquerBouton("justifyCenter", document.queryCommandState("justifyCenter"));
    marquerBouton("justifyRight", document.queryCommandState("justifyRight"));
    marquerBouton("justifyFull", document.queryCommandState("justifyFull"));
  } catch (e) { /* queryCommandState est déprécié : on ignore s'il échoue */ }

  // Élément porteur des styles au point d'insertion
  let noeud = sel.anchorNode;
  if (noeud && noeud.nodeType === Node.TEXT_NODE) noeud = noeud.parentElement;
  if (!noeud) return;
  const style = window.getComputedStyle(noeud);

  // --- Style de paragraphe (Titre / Sous-titre / Paragraphe) ---
  let bloc = noeud;
  while (bloc && bloc !== ed && !/^(H2|H3|P|LI|DIV)$/.test(bloc.tagName)) bloc = bloc.parentElement;
  const selStyle = document.getElementById("selectStyle");
  if (selStyle && bloc && bloc !== ed) {
    const t = bloc.tagName;
    selStyle.value = (t === "H2" || t === "H3") ? t.toLowerCase() : "p";
  }

  // --- Police ---
  const selPolice = document.getElementById("selectPolice");
  if (selPolice) {
    const courante = normaliserPolice(style.fontFamily);
    const trouvee = [...selPolice.options].find(o => normaliserPolice(o.value) === courante);
    if (trouvee) selPolice.value = trouvee.value;
  }

  // --- Interligne (rapport ligne / taille de police) ---
  const selInter = document.getElementById("selectInterligne");
  if (selInter) {
    const taillePx = parseFloat(style.fontSize) || 0;
    const lignePx = parseFloat(style.lineHeight);
    if (taillePx && !isNaN(lignePx)) {
      const ratio = lignePx / taillePx;
      let meilleure = null, ecartMin = Infinity;
      [...selInter.options].forEach(o => {
        const ecart = Math.abs(parseFloat(o.value) - ratio);
        if (ecart < ecartMin) { ecartMin = ecart; meilleure = o.value; }
      });
      if (meilleure !== null && ecartMin < 0.2) selInter.value = meilleure;
    }
  }

  // --- Taille (en points) ---
  const input = document.getElementById("inputTaille");
  if (input && document.activeElement !== input) {
    const pt = Math.round(parseFloat(style.fontSize) / (96 / 72));
    if (pt) input.value = pt;
  }
}

chargerLivre();
initGlissementImageCouverture();
