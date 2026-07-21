let bibliotheque = null;
let shaBiblio = null;
let nomFichierBiblio = null;
let livreId = null;
let indexLivre = -1;
let indexSpread = 0;
let coteActif = "gauche";
let selectionSauvegardee = null;
let modeCouverture = null; // 'couverture' | 'quatrieme' | null
let hauteurTextePx = 0;    // hauteur utile d'une page de texte (px), pour la pagination continue

// Formats : dimensions en mm, marges en mm (haut/bas, gauche/droite)
const FORMATS = {
  "149x210": { larg: 149, haut: 210, margeV: 20, margeH: 20 },
  "155x235": { larg: 155, haut: 235, margeV: 22, margeH: 20 },
  "105x148": { larg: 105, haut: 148, margeV: 14, margeH: 14 },
  "210x297": { larg: 210, haut: 297, margeV: 25, margeH: 25 },
};

function appliquerFormatPage(formatKey) {
  const f = FORMATS[formatKey] || FORMATS["149x210"];
  const ratio = f.haut / f.larg; // ratio hauteur/largeur du format

  // Espace disponible (fenêtre - sommaire - paddings - barre outils - barre actions)
  const sommaireLarg = 240; // sommaire 200px + gap 20px + marge 20px
  const margesH      = 32;  // padding conteneur gauche+droite
  const barresH      = 56 + 52 + 10 + 32 + 10; // barre outils + barre actions + gaps + message
  const gapPages     = 26;
  const margeV       = 32;  // padding conteneur haut+bas

  const dispoW = window.innerWidth  - sommaireLarg - margesH;
  const dispoH = window.innerHeight - barresH - margeV;

  // Largeur d'une page = moitié de l'espace horizontal (deux pages côte à côte)
  let largPx = Math.floor((dispoW - gapPages) / 2);
  let hautPx = Math.round(largPx * ratio);

  // Si ça dépasse en hauteur, on recalcule depuis la hauteur
  if (hautPx > dispoH) {
    hautPx = dispoH;
    largPx = Math.round(hautPx / ratio);
  }

  // Marges internes proportionnelles au format réel (en mm)
  const MM = largPx / f.larg;
  const margeVPx = Math.round(f.margeV * MM);
  const margeHPx = Math.round(f.margeH * MM);
  const numPageH = 32; // 6px padding-top + ~16px texte + 10px padding-bottom

  document.querySelectorAll(".page-livre").forEach(el => {
    el.style.width     = largPx + "px";
    el.style.height    = hautPx + "px";
    el.style.padding   = margeVPx + "px " + margeHPx + "px 0";
    el.style.boxSizing = "border-box";
    el.style.flexShrink = "0";
  });

  hauteurTextePx = hautPx - margeVPx - numPageH;

  document.querySelectorAll(".texte-livre").forEach(el => {
    el.style.width  = (largPx - margeHPx * 2) + "px";
    el.style.height = (hautPx - margeVPx - numPageH) + "px";
  });

  // Supprimer tout transform (on adapte directement la taille)
  document.querySelectorAll(".zone-livre").forEach(el => el.style.transform = "");

  // Adapter aussi le panneau couverture (même largeur/hauteur que page-livre)
  const previewCouv = document.getElementById("previewCouv");
  if (previewCouv) {
    previewCouv.style.width  = largPx + "px";
    previewCouv.style.height = hautPx + "px";
  }
  const paneau = document.querySelector(".paneau-edition-couv");
  if (paneau) {
    paneau.style.width  = largPx + "px";
    paneau.style.height = hautPx + "px";
    paneau.style.padding = "16px 20px";
    paneau.style.boxSizing = "border-box";
    paneau.style.overflowY = "auto";
  }

  // Mettre à jour le mesureCachee
  const mesure = document.getElementById("mesureCachee");
  if (mesure) {
    mesure.style.width  = (largPx - margeHPx * 2) + "px";
    mesure.style.height = (hautPx - margeVPx - numPageH) + "px";
  }
}

async function chargerLivre() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  livreId = sessionStorage.getItem("livre_id");
  nomFichierBiblio = obtenirNomFichierBibliotheque();

  if (!token || !livreId || !nomFichierBiblio) {
    window.location.href = "bibliotheque.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON(nomFichierBiblio, token);
    bibliotheque = contenu;
    shaBiblio = sha;

    indexLivre = bibliotheque.livres.findIndex(l => l.id === livreId);
    if (indexLivre === -1) {
      message.textContent = "Livre introuvable.";
      return;
    }

    const livre = livreActuel();
    if (!livre.pages || livre.pages.length === 0) {
      livre.pages = [{ id: "p1", contenu: "" }];
    }

    document.getElementById("titreLivre").textContent = livre.titre || "Mon livre";
    const formatCourant = livre.format || "149x210";
    appliquerFormatPage(formatCourant);
    window.addEventListener("resize", () => {
      appliquerFormatPage(formatCourant);
      if (modeCouverture) repositionnerImageCouverture();
      if (modeApercu) afficherApercu();
    });
    indexSpread = 0;

    document.execCommand("defaultParagraphSeparator", false, "p");

    const pageGauche = document.getElementById("pageGauche");
    const pageDroite = document.getElementById("pageDroite");

    pageGauche.addEventListener("keydown", (e) => { intercepterEntree(e); });
    pageDroite.addEventListener("keydown", (e) => { intercepterEntree(e); });
    pageGauche.addEventListener("focus", () => { coteActif = "gauche"; });
    pageDroite.addEventListener("focus", () => { coteActif = "droite"; });
    pageGauche.addEventListener("blur", sauvegarderSelection);
    pageDroite.addEventListener("blur", sauvegarderSelection);
    pageGauche.addEventListener("input", surSaisie);
    pageDroite.addEventListener("input", surSaisie);
    document.addEventListener("selectionchange", lireTailleCourrante);
    document.addEventListener("keydown", raccourcisClavier);
    window.addEventListener("beforeunload", (e) => {
      if (modifie) { e.preventDefault(); e.returnValue = ""; }
    });

    // Proposer de restaurer un éventuel brouillon local non enregistré
    verifierBrouillon();

    afficherSpread();
    afficherSommaire();
    majCompteurMots();
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

// Saisie dans une page : pagination continue, historique, brouillon, compteur, état modifié
function surSaisie(e) {
  const actif = coteActif === "droite"
    ? document.getElementById("pageDroite")
    : document.getElementById("pageGauche");

  const deborde = actif && actif.scrollHeight > actif.clientHeight + 1;
  const suppression = e && e.inputType && e.inputType.indexOf("delete") !== -1;

  let doitReflow = deborde;
  if (!doitReflow && suppression && actif) {
    // Suppression : si la page a de la place et qu'il reste du texte après, on récupère (remonte)
    const placeDispo = actif.scrollHeight <= actif.clientHeight - 2;
    if (placeDispo && contenuSuivantNonVide()) doitReflow = true;
  }

  if (doitReflow) reflowEtCurseur();

  planifierHistorique();
  planifierBrouillon();
  planifierCompteurMots();
  marquerModifie();
}

// Y a-t-il du texte sur une page située après la page en cours d'édition ?
function contenuSuivantNonVide() {
  const pages = livreActuel().pages;
  const idxActive = coteActif === "droite" ? indexSpread + 1 : indexSpread;
  for (let k = idxActive + 1; k < pages.length; k++) {
    if (texteBrutPage(pages[k].contenu).trim() !== "") return true;
  }
  return false;
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
}

// Style de paragraphe : Paragraphe / Titre / Sous-titre (#7)
function appliquerStyle(baliseKey) {
  restaurerSelection();
  const balise = baliseKey === "h2" ? "H2" : baliseKey === "h3" ? "H3" : "P";
  document.execCommand("formatBlock", false, balise);
  enregistrerHistorique();
  marquerModifie();
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

// Interligne appliqué aux paragraphes touchés par la sélection (#7)
function appliquerInterligne(valeur) {
  restaurerSelection();
  const conteneur = coteActif === "droite"
    ? document.getElementById("pageDroite")
    : document.getElementById("pageGauche");
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

function lireTailleCourrante() {
  const input = document.getElementById("inputTaille");
  // Ne pas écraser l'input si l'utilisateur est en train de le modifier
  if (input && document.activeElement === input) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  let noeud = sel.anchorNode;
  if (noeud && noeud.nodeType === Node.TEXT_NODE) noeud = noeud.parentElement;
  while (noeud) {
    const fs = window.getComputedStyle(noeud).fontSize;
    if (fs) {
      const pt = Math.round(parseFloat(fs) / 1.333);
      if (input) input.value = pt;
      return;
    }
    noeud = noeud.parentElement;
  }
}

function intercepterEntree(e) {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  document.execCommand("insertLineBreak");
}

// ----- Affichage -----

function assurerPageExiste(i) {
  const pages = livreActuel().pages;
  while (pages.length <= i) {
    pages.push({ id: "p" + (pages.length + 1) + "_" + Date.now(), contenu: "" });
  }
}

function flushSpread() {
  assurerPageExiste(indexSpread);
  assurerPageExiste(indexSpread + 1);
  livreActuel().pages[indexSpread].contenu = document.getElementById("pageGauche").innerHTML;
  livreActuel().pages[indexSpread + 1].contenu = document.getElementById("pageDroite").innerHTML;
}

function afficherSpread() {
  assurerPageExiste(indexSpread);
  const pages = livreActuel().pages;
  document.getElementById("pageGauche").innerHTML = pages[indexSpread] ? pages[indexSpread].contenu : "";
  document.getElementById("pageDroite").innerHTML = pages[indexSpread + 1] ? pages[indexSpread + 1].contenu : "";
  document.getElementById("numeroGauche").textContent = indexSpread + 1;
  document.getElementById("numeroDroite").textContent = pages[indexSpread + 1] ? indexSpread + 2 : "";
  // L'historique annuler/rétablir est propre à chaque double-page affichée
  reinitialiserHistorique();
}

function afficherSommaire() {
  const pages = livreActuel().pages;
  const liste = document.getElementById("listePages");
  liste.innerHTML = "";

  pages.forEach((page, i) => {
    const li = document.createElement("li");
    li.className = (i === indexSpread || i === indexSpread + 1) ? "actif" : "";
    li.draggable = true;
    li.dataset.index = i;

    const poignee = document.createElement("span");
    poignee.className = "poignee-page";
    poignee.textContent = "⠿";
    poignee.title = "Glisser pour réorganiser";
    li.appendChild(poignee);

    const libelle = document.createElement("span");
    libelle.textContent = "Page " + (i + 1);
    libelle.className = "libelle-page";
    libelle.onclick = () => allerAPage(i);
    li.appendChild(libelle);

    if (pages.length > 1) {
      const btnSuppr = document.createElement("span");
      btnSuppr.textContent = "✕";
      btnSuppr.className = "supprimer-page";
      btnSuppr.title = "Supprimer cette page";
      btnSuppr.onclick = (e) => { e.stopPropagation(); supprimerPage(i); };
      li.appendChild(btnSuppr);
    }

    li.addEventListener("dragstart", (e) => {
      indexPageGlissee = i;
      li.classList.add("en-deplacement");
      e.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("en-deplacement");
      liste.querySelectorAll("li").forEach(el => el.classList.remove("glisse-dessus"));
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      li.classList.add("glisse-dessus");
    });
    li.addEventListener("dragleave", () => li.classList.remove("glisse-dessus"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("glisse-dessus");
      deplacerPage(indexPageGlissee, i);
    });

    liste.appendChild(li);
  });
}

// Réorganisation des pages par glisser-déposer (#10)
let indexPageGlissee = null;

function deplacerPage(depuis, vers) {
  if (depuis === null || depuis === vers) return;
  flushSpread();
  const pages = livreActuel().pages;
  if (depuis < 0 || depuis >= pages.length || vers < 0 || vers >= pages.length) return;
  const [page] = pages.splice(depuis, 1);
  pages.splice(vers, 0, page);
  // Se recaler sur la double-page contenant la page déplacée
  indexSpread = vers - (vers % 2);
  afficherSpread();
  afficherSommaire();
  marquerModifie();
  planifierBrouillon();
}

function supprimerPage(i) {
  const pages = livreActuel().pages;
  if (pages.length <= 1) return;
  if (!confirm(`Supprimer la page ${i + 1} ? Cette action est irréversible.`)) return;

  flushSpread();
  pages.splice(i, 1);

  // Recalculer indexSpread sur une paire valide
  if (indexSpread >= pages.length) {
    indexSpread = Math.max(0, pages.length - 1 - ((pages.length - 1) % 2));
  } else if (i <= indexSpread && indexSpread > 0) {
    indexSpread = Math.max(0, indexSpread - 1 - ((indexSpread - 1) % 2));
  }
  // Toujours commencer sur un index pair
  indexSpread = indexSpread - (indexSpread % 2);

  afficherSpread();
  afficherSommaire();
  marquerModifie();
  planifierBrouillon();
}

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
  // Créer la nouvelle page si besoin
  assurerPageExiste(indexSpread + 2);
  indexSpread += 2;
  afficherSpread();
  afficherSommaire();
}

// ----- Sauvegarde -----

async function sauvegarder() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  flushSpread();

  // Nettoyer les pages vides en fin de livre (sauf la première)
  const pages = livreActuel().pages;
  while (pages.length > 1 && !pages[pages.length - 1].contenu.replace(/<[^>]+>/g, "").trim()) {
    pages.pop();
  }
  if (indexSpread >= pages.length) {
    indexSpread = Math.max(0, pages.length - 1 - ((pages.length - 1) % 2));
  }
  afficherSpread();
  afficherSommaire();

  try {
    shaBiblio = await ecrireFichierJSON(nomFichierBiblio, bibliotheque, shaBiblio, token, "Mise à jour du livre");
    message.textContent = "Sauvegardé avec succès.";
    marquerSauvegarde();
    effacerBrouillon();
  } catch (erreur) {
    if (erreur.conflit) { gererConflitSauvegarde(); return; }
    message.textContent = erreur.message;
  }
}

// Résolution d'un conflit d'écriture GitHub (le livre a été modifié ailleurs) (#3)
async function gererConflitSauvegarde() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  const ecraser = confirm(
    "Ce livre a été modifié depuis un autre onglet ou appareil.\n\n" +
    "OK = écraser la version distante avec la vôtre.\n" +
    "Annuler = recharger la version distante (vos modifications non enregistrées seront perdues)."
  );

  if (ecraser) {
    try {
      // Récupérer le SHA à jour puis réécrire par-dessus
      const { sha } = await lireFichierJSON(nomFichierBiblio, token);
      shaBiblio = sha;
      shaBiblio = await ecrireFichierJSON(
        nomFichierBiblio, bibliotheque, shaBiblio, token,
        "Mise à jour du livre (résolution de conflit)"
      );
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
      const token = sessionStorage.getItem("gh_token");
      const requeteId = ++requeteImageEnCours;
      obtenirUrlImage(cheminImage, token).then((urlImage) => {
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

  const apercu = document.getElementById("previewCouverture");
  apercu.innerHTML = `
    ${mode === "couverture" && afficherTitre ? `<div class="apercu-titre" style="color:${couleurTexte}">${livre.titre || "Titre"}</div>` : ""}
    ${afficherAuteur ? `<div class="apercu-auteur" style="color:${couleurTexte}">${livre.auteur || "Auteur"}</div>` : ""}
  `;
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
function repositionnerImageCouverture() {
  const img = document.getElementById("imageFondCouverture");
  const conteneur = document.getElementById("previewCouv");
  if (!img.naturalWidth || !img.naturalHeight || !conteneur) return;

  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  if (!data) return;

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

    const deltaX = e.clientX - glissementDepartX;
    const deltaY = e.clientY - glissementDepartY;
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
  const token = sessionStorage.getItem("gh_token");

  if (data.imageChemin) {
    supprimerFichierGithub(data.imageChemin, token, "Suppression de l'image de couverture (couleur choisie)").catch(() => {});
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

  const token = sessionStorage.getItem("gh_token");
  const messageCouv = document.getElementById("messageCouv");
  const livre = livreActuel();
  const modeCourant = modeCouverture;
  const data = modeCourant === "couverture" ? livre.couverture : livre.quatrieme;
  const ancienChemin = data.imageChemin;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const extension = extraireExtensionDataUrl(dataUrl);
    const chemin = `${obtenirPrefixeImagesUtilisateur()}/${livre.id}_${modeCourant}.${extension}`;

    messageCouv.textContent = "Envoi de l'image en cours...";
    try {
      await uploaderImageBase64(chemin, dataUrl, token, `Image de couverture — ${livre.titre || livre.id}`);

      if (ancienChemin && ancienChemin !== chemin) {
        supprimerFichierGithub(ancienChemin, token, "Remplacement de l'image de couverture").catch(() => {});
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
    }
  };
  reader.readAsDataURL(fichier);
}

function supprimerImageFond() {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  const token = sessionStorage.getItem("gh_token");

  if (data.imageChemin) {
    supprimerFichierGithub(data.imageChemin, token, "Suppression de l'image de couverture").catch(() => {});
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

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("gh_login");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

// ----- Mode aperçu -----

let modeApercu = false;
let indexApercu = 0; // 0 = couverture ; 1..nbSpreads = pages intérieures ; nbSpreads+1 = 4e de couverture

function nombreSpreadsApercu() {
  const pages = livreActuel().pages;
  return Math.max(1, Math.ceil(pages.length / 2));
}

function ouvrirApercu() {
  flushSpread();
  modeApercu = true;
  indexApercu = 0;

  document.getElementById("vueEditeur").style.display = "none";
  document.getElementById("vueCouverture").style.display = "none";
  document.getElementById("vueApercu").style.display = "flex";
  document.querySelector(".sommaire").style.display = "none";

  afficherApercu();
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

function apercuSuivant() {
  const derniere = nombreSpreadsApercu() + 1;
  if (indexApercu < derniere) {
    indexApercu++;
    afficherApercu();
  }
}

function apercuPrecedent() {
  if (indexApercu > 0) {
    indexApercu--;
    afficherApercu();
  }
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
    conteneur.appendChild(creerPageCouvertureApercu("couverture"));
  } else if (indexApercu === derniere) {
    indicateur.textContent = "4e de couverture";
    conteneur.appendChild(creerPageCouvertureApercu("quatrieme"));
  } else {
    const iGauche = (indexApercu - 1) * 2;
    const iDroite = iGauche + 1;
    const pages = livre.pages;

    indicateur.textContent = pages[iDroite] ? `Pages ${iGauche + 1} - ${iDroite + 1}` : `Page ${iGauche + 1}`;

    conteneur.appendChild(creerPageTexteApercu(pages[iGauche], iGauche + 1));
    conteneur.appendChild(creerPageTexteApercu(pages[iDroite], pages[iDroite] ? iDroite + 1 : ""));
  }

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

    const token = sessionStorage.getItem("gh_token");
    if (cacheImagesURL[data.imageChemin]) {
      positionnerImageApercu(img, data, cacheImagesURL[data.imageChemin], page, data.imageChemin);
    } else {
      obtenirUrlImage(data.imageChemin, token).then((url) => {
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
    ${mode === "couverture" && afficherTitre ? `<div class="apercu-titre" style="color:${couleurTexte}">${livre.titre || "Titre"}</div>` : ""}
    ${afficherAuteur ? `<div class="apercu-auteur" style="color:${couleurTexte}">${livre.auteur || "Auteur"}</div>` : ""}
  `;
  page.appendChild(couche);

  return page;
}

function positionnerImageApercu(img, data, url, page, chemin, dejaRetente) {
  img.onload = () => {
    const largeurConteneur = page.clientWidth;
    const hauteurConteneur = page.clientHeight;
    if (!largeurConteneur || !hauteurConteneur) return;
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
    const token = sessionStorage.getItem("gh_token");
    obtenirUrlImage(chemin, token).then((nouvelleUrl) => {
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
  return `brouillon_${sessionStorage.getItem("gh_login")}_${livreId}`;
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
let dernierSnapshot = { g: "", d: "" };
let timerHisto = null;

function snapshotActuel() {
  return {
    g: document.getElementById("pageGauche").innerHTML,
    d: document.getElementById("pageDroite").innerHTML
  };
}

function reinitialiserHistorique() {
  historique = { undo: [], redo: [] };
  dernierSnapshot = snapshotActuel();
  if (timerHisto) { clearTimeout(timerHisto); timerHisto = null; }
}

function planifierHistorique() {
  clearTimeout(timerHisto);
  timerHisto = setTimeout(() => { timerHisto = null; enregistrerHistorique(); }, 500);
}

function enregistrerHistorique() {
  const actuel = snapshotActuel();
  if (actuel.g === dernierSnapshot.g && actuel.d === dernierSnapshot.d) return;
  historique.undo.push(dernierSnapshot);
  if (historique.undo.length > 100) historique.undo.shift();
  historique.redo = [];
  dernierSnapshot = actuel;
}

function flushHistorique() {
  if (timerHisto) { clearTimeout(timerHisto); timerHisto = null; }
  enregistrerHistorique();
}

function annuler() {
  if (modeApercu || modeCouverture) return;
  flushHistorique();
  if (historique.undo.length === 0) return;
  historique.redo.push(dernierSnapshot);
  const precedent = historique.undo.pop();
  restaurerSnapshot(precedent);
  dernierSnapshot = precedent;
  marquerModifie();
  planifierBrouillon();
  planifierCompteurMots();
}

function retablir() {
  if (modeApercu || modeCouverture) return;
  if (historique.redo.length === 0) return;
  historique.undo.push(dernierSnapshot);
  const suivant = historique.redo.pop();
  restaurerSnapshot(suivant);
  dernierSnapshot = suivant;
  marquerModifie();
  planifierBrouillon();
  planifierCompteurMots();
}

function restaurerSnapshot(etat) {
  const pageGauche = document.getElementById("pageGauche");
  const pageDroite = document.getElementById("pageDroite");
  pageGauche.innerHTML = etat.g;
  pageDroite.innerHTML = etat.d;
  // Replacer le curseur en fin de la page active
  const cible = coteActif === "droite" ? pageDroite : pageGauche;
  cible.focus();
  const range = document.createRange();
  range.selectNodeContents(cible);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// =====================================================================
//  Compteur de mots (#10)
// =====================================================================

let timerCompteur = null;

function planifierCompteurMots() {
  clearTimeout(timerCompteur);
  timerCompteur = setTimeout(majCompteurMots, 600);
}

function majCompteurMots() {
  if (indexLivre === -1) return;
  flushSpread();
  const pages = livreActuel().pages;
  let mots = 0;
  const tmp = document.createElement("div");
  pages.forEach(p => {
    tmp.innerHTML = p.contenu || "";
    const txt = (tmp.textContent || "").trim();
    if (txt) mots += txt.split(/\s+/).length;
  });
  const el = document.getElementById("compteurMots");
  if (el) el.textContent = `${mots} mot${mots > 1 ? "s" : ""} · ${pages.length} page${pages.length > 1 ? "s" : ""}`;
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

function surlignerMatch(match) {
  const longueur = document.getElementById("champRecherche").value.length;
  if (!longueur) return;

  // Naviguer vers la double-page contenant le résultat
  const spreadCible = match.page - (match.page % 2);
  if (spreadCible !== indexSpread) {
    flushSpread();
    indexSpread = spreadCible;
    afficherSpread();
    afficherSommaire();
  }

  const pageEl = (match.page % 2 === 0)
    ? document.getElementById("pageGauche")
    : document.getElementById("pageDroite");

  const pos = positionDansElement(pageEl, match.offset, longueur);
  if (!pos) return;

  const range = document.createRange();
  range.setStart(pos.debutNoeud, pos.debutOffset);
  range.setEnd(pos.finNoeud, pos.finOffset);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  pageEl.focus();
  coteActif = (match.page % 2 === 0) ? "gauche" : "droite";

  const rectParent = pageEl.getBoundingClientRect();
  const rectSel = range.getBoundingClientRect();
  if (rectSel.bottom > rectParent.bottom || rectSel.top < rectParent.top) {
    const noeudParent = pos.debutNoeud.parentElement;
    if (noeudParent && noeudParent.scrollIntoView) noeudParent.scrollIntoView({ block: "nearest" });
  }
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
  const pages = livreActuel().pages;

  pages.forEach(p => {
    const conteneur = document.createElement("div");
    conteneur.innerHTML = p.contenu || "";
    const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
    const noeuds = [];
    while (walker.nextNode()) noeuds.push(walker.currentNode);
    noeuds.forEach(noeud => {
      const res = remplacerInsensible(noeud.textContent, requete, remplacement);
      if (res.compte > 0) { noeud.textContent = res.texte; total += res.compte; }
    });
    p.contenu = conteneur.innerHTML;
  });

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

// Scinde un contenu HTML pour qu'il tienne dans la hauteur d'une page.
// Renvoie { garde, deborde } : ce qui tient, et le reste (mots entiers).
function mesurerScinder(html) {
  const mes = document.getElementById("mesureCachee");
  if (!mes || !hauteurTextePx) return { garde: html, deborde: "" };

  mes.style.height = "auto";
  mes.innerHTML = html || "";

  if (mes.scrollHeight <= hauteurTextePx + 1) {
    mes.innerHTML = "";
    return { garde: html, deborde: "" };
  }

  const limiteY = mes.getBoundingClientRect().top + hauteurTextePx;
  const coupure = trouverCoupure(mes, limiteY);

  if (!coupure) { mes.innerHTML = ""; return { garde: html, deborde: "" }; }

  const range = document.createRange();
  range.setStart(coupure.node, coupure.offset);
  range.setEnd(mes, mes.childNodes.length);
  const frag = range.extractContents();

  const boite = document.createElement("div");
  boite.appendChild(frag);

  // Ajustement fin : la coupure au mot peut laisser la boîte de ligne dépasser
  // de quelques pixels. On retire les derniers mots restants jusqu'à ce que ça
  // tienne vraiment, en les renvoyant en tête du débordement.
  let securite = 0;
  while (mes.scrollHeight > hauteurTextePx + 1 && securite < 50) {
    securite++;
    const mot = retirerDernierMot(mes);
    if (mot === null) break;
    prependMot(boite, mot);
  }

  const deborde = boite.innerHTML;
  const garde = mes.innerHTML;
  mes.innerHTML = "";
  return { garde, deborde };
}

// Retire et renvoie le dernier mot du dernier nœud texte d'un conteneur
function retirerDernierMot(conteneur) {
  const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
  let dernier = null, n;
  while ((n = walker.nextNode())) dernier = n;
  if (!dernier) return null;

  const t = dernier.textContent.replace(/\s+$/, "");
  const m = /(\s*)(\S+)$/.exec(t);
  if (!m) return null;
  dernier.textContent = t.slice(0, m.index);
  return m[2];
}

// Insère un mot en tête du premier bloc d'un conteneur
function prependMot(conteneur, mot) {
  let cible = conteneur.firstElementChild;
  if (!cible) {
    cible = document.createElement("p");
    conteneur.appendChild(cible);
  }
  const tn = document.createTextNode(mot + " ");
  if (cible.firstChild) cible.insertBefore(tn, cible.firstChild);
  else cible.appendChild(tn);
}

// Trouve la position (noeud texte, offset) du premier mot qui déborde la hauteur
function trouverCoupure(conteneur, limiteY) {
  const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
  let nbMots = 0, noeud;
  while ((noeud = walker.nextNode())) {
    const texte = noeud.textContent;
    const regex = /\S+/g;
    let m;
    while ((m = regex.exec(texte))) {
      const debut = m.index;
      const r = document.createRange();
      r.setStart(noeud, debut);
      r.setEnd(noeud, debut + m[0].length);
      const rect = r.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > limiteY + 1) {
        if (nbMots === 0) return null; // même le 1er mot déborde : on ne peut rien couper
        return { node: noeud, offset: debut };
      }
      nbMots++;
    }
  }
  return null;
}

// Concatène deux contenus HTML comme un flux continu, en fusionnant les blocs
// de bordure de même nature (ex. deux <p> => un seul paragraphe qui continue).
function fusionnerHTML(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";

  const da = document.createElement("div"); da.innerHTML = a;
  const db = document.createElement("div"); db.innerHTML = b;

  const dernier = da.lastElementChild;
  const premier = db.firstElementChild;
  const fusionnable = ["P", "H2", "H3", "DIV", "UL", "OL", "BLOCKQUOTE"];

  if (dernier && premier && dernier.tagName === premier.tagName && fusionnable.includes(dernier.tagName)) {
    // Éviter de coller deux mots pour les blocs de texte (pas pour les listes)
    if (["P", "H2", "H3", "DIV", "BLOCKQUOTE"].includes(dernier.tagName)) {
      const finTexte = dernier.textContent;
      const debutTexte = premier.textContent;
      if (finTexte && debutTexte && /\w$/.test(finTexte) && /^\w/.test(debutTexte)) {
        dernier.appendChild(document.createTextNode(" "));
      }
    }
    while (premier.firstChild) dernier.appendChild(premier.firstChild);
    db.removeChild(premier);
    while (db.firstChild) da.appendChild(db.firstChild);
    return da.innerHTML;
  }
  return a + b;
}

// Recompose la pagination à partir de la page iDebut : chaque page est remplie
// au maximum, le surplus part sur la suivante, en cascade.
function normaliserPagination(iDebut) {
  const pages = livreActuel().pages;
  let i = Math.max(0, iDebut);
  let securite = 0;

  while (i < pages.length && securite < 2000) {
    securite++;
    const contenuI = pages[i].contenu || "";
    const contenuSuiv = (i + 1 < pages.length) ? (pages[i + 1].contenu || "") : "";
    const combine = fusionnerHTML(contenuI, contenuSuiv);

    const { garde, deborde } = mesurerScinder(combine);

    pages[i].contenu = garde;
    const resteNonVide = deborde && deborde.trim() !== "";

    if (resteNonVide) {
      assurerPageExiste(i + 1);
      pages[i + 1].contenu = deborde;
    } else if (i + 1 < pages.length) {
      pages[i + 1].contenu = "";
    }

    // Stabilité : rien n'a bougé sur cette paire. On ne s'arrête que si la page
    // suivante ne déborde pas elle-même (sinon la cascade doit continuer).
    if (garde === contenuI && (deborde || "") === contenuSuiv) {
      if (i + 1 >= pages.length) break;
      const suiv = mesurerScinder(pages[i + 1].contenu);
      if (!suiv.deborde || suiv.deborde.trim() === "") break;
    }

    i++;
  }

  // Supprimer les pages vides en fin de livre (garder au moins une page)
  while (pages.length > 1 && !texteBrutPage(pages[pages.length - 1].contenu).trim()) {
    pages.pop();
  }
}

// Applique la pagination continue puis replace le curseur au bon endroit
function reflowEtCurseur() {
  const pages = livreActuel().pages;
  const cote = coteActif;
  const idxActive = cote === "droite" ? indexSpread + 1 : indexSpread;
  const actif = cote === "droite"
    ? document.getElementById("pageDroite")
    : document.getElementById("pageGauche");

  // Offset absolu du curseur (depuis le début du livre), invariant par le reflow
  const local = actif ? offsetCaret(actif) : null;
  flushSpread();

  let absOffset = null;
  if (local !== null) {
    absOffset = 0;
    for (let k = 0; k < idxActive; k++) absOffset += texteBrutPage(pages[k].contenu).length;
    absOffset += local;
  }

  normaliserPagination(indexSpread);

  if (absOffset === null) {
    afficherSpread();
    afficherSommaire();
    majCompteurMots();
    return;
  }

  // Retrouver la page + offset local correspondant à l'offset absolu
  let acc = 0, cible = 0, localCible = 0;
  for (let k = 0; k < pages.length; k++) {
    const len = texteBrutPage(pages[k].contenu).length;
    if (absOffset <= acc + len) { cible = k; localCible = absOffset - acc; break; }
    acc += len; cible = k; localCible = len;
  }

  indexSpread = cible - (cible % 2);
  afficherSpread();
  afficherSommaire();

  const cibleEl = (cible % 2 === 0)
    ? document.getElementById("pageGauche")
    : document.getElementById("pageDroite");
  cibleEl.focus();
  coteActif = (cible % 2 === 0) ? "gauche" : "droite";
  placerCaretAOffset(cibleEl, localCible);

  majCompteurMots();
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

chargerLivre();
initGlissementImageCouverture();