const NOM_FICHIER_BIBLIO = "bibliotheque.json";

let bibliotheque = null;
let shaBiblio = null;
let livreId = null;
let indexLivre = -1;
let indexSpread = 0;
let coteActif = "gauche";
let selectionSauvegardee = null;
let modeCouverture = null; // 'couverture' | 'quatrieme' | null

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

  if (!token || !livreId) {
    window.location.href = "bibliotheque.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON(NOM_FICHIER_BIBLIO, token);
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
    });
    indexSpread = 0;

    document.execCommand("defaultParagraphSeparator", false, "p");

    const pageGauche = document.getElementById("pageGauche");
    const pageDroite = document.getElementById("pageDroite");

    pageGauche.addEventListener("keydown", (e) => { intercepterEntree(e); bloquerSiPlein(e, pageGauche); });
    pageDroite.addEventListener("keydown", (e) => { intercepterEntree(e); bloquerSiPlein(e, pageDroite); });
    pageGauche.addEventListener("focus", () => { coteActif = "gauche"; });
    pageDroite.addEventListener("focus", () => { coteActif = "droite"; });
    pageGauche.addEventListener("blur", sauvegarderSelection);
    pageDroite.addEventListener("blur", sauvegarderSelection);
    document.addEventListener("selectionchange", lireTailleCourrante);

    afficherSpread();
    afficherSommaire();
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function livreActuel() {
  return bibliotheque.livres[indexLivre];
}

function formater(commande, valeur) {
  document.execCommand(commande, false, valeur || null);
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
}

// ----- Blocage en fin de page -----

function afficherPagePleine() {
  document.getElementById("message").textContent = "Page pleine — utilisez Suivant → pour continuer sur la page suivante.";
  setTimeout(() => { document.getElementById("message").textContent = ""; }, 3000);
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

function bloquerSiPlein(e, conteneur) {
  // Touches qui ne rajoutent pas de contenu : on laisse toujours passer
  const touchesAutorisees = [
    "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "Home", "End", "PageUp", "PageDown", "Tab", "Escape",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"
  ];
  if (touchesAutorisees.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;

  // Laisser le navigateur insérer le caractère, puis vérifier et annuler si ça déborde
  const snapshotHTML = conteneur.innerHTML;

  // Sauvegarde position curseur en offset texte absolu (résiste au innerHTML=)
  const sel = window.getSelection();
  let offsetSauvegarde = null;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (conteneur.contains(r.startContainer)) {
      function compterOffset(noeudCible, offsetCible) {
        let total = 0;
        const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode === noeudCible) return total + offsetCible;
          total += walker.currentNode.textContent.length;
        }
        return total;
      }
      offsetSauvegarde = compterOffset(r.startContainer, r.startOffset);
    }
  }

  requestAnimationFrame(() => {
    if (conteneur.scrollHeight > conteneur.clientHeight + 2) {
      // Rollback
      conteneur.innerHTML = snapshotHTML;
      // Restaurer le curseur via offset texte
      if (offsetSauvegarde !== null) {
        let total = 0;
        const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const len = walker.currentNode.textContent.length;
          if (total + len >= offsetSauvegarde) {
            const range = document.createRange();
            range.setStart(walker.currentNode, offsetSauvegarde - total);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            break;
          }
          total += len;
        }
      }
      afficherPagePleine();
    }
  });
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
}

function afficherSommaire() {
  const pages = livreActuel().pages;
  const liste = document.getElementById("listePages");
  liste.innerHTML = "";

  pages.forEach((page, i) => {
    const li = document.createElement("li");
    li.className = (i === indexSpread || i === indexSpread + 1) ? "actif" : "";

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

    liste.appendChild(li);
  });
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

  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(bibliotheque, null, 2))));
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${NOM_FICHIER_BIBLIO}`;

  try {
    const reponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: "Mise à jour du livre",
        content: contenuEncode,
        sha: shaBiblio
      })
    });

    if (!reponse.ok) {
      throw new Error("Échec de la sauvegarde. Vérifie ton token.");
    }

    const data = await reponse.json();
    shaBiblio = data.content.sha;
    message.textContent = "Sauvegardé avec succès.";
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function retourBibliotheque() {
  flushSpread();
  window.location.href = "bibliotheque.html";
}

// ----- Couverture -----

function ouvrirCouverture(mode) {
  flushSpread();
  modeCouverture = mode;
  const livre = livreActuel();
  if (!livre.couverture) livre.couverture = { fond: "#1a1a2e", image: null, imageChemin: null, texte: "#ffffff" };
  if (!livre.quatrieme) livre.quatrieme = { fond: "#2a2a2a", image: null, imageChemin: null, texte: "#ffffff", contenu: "" };

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

  previewCouverture();

  document.getElementById("vueEditeur").style.display = "none";
  document.getElementById("vueCouverture").style.display = "flex";
  document.getElementById("btnCouv").classList.toggle("actif", mode === "couverture");
  document.getElementById("btnQuatr").classList.toggle("actif", mode === "quatrieme");

  // Appliquer le bon format
  appliquerFormatPage(livreActuel().format || "149x210");
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
      afficherImageCouverture(cacheImagesURL[cheminImage]);
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
  const apercu = document.getElementById("previewCouverture");
  apercu.innerHTML = `
    ${mode === "couverture" ? `<div class="apercu-titre" style="color:${couleurTexte}">${livre.titre || "Titre"}</div>` : ""}
    <div class="apercu-auteur" style="color:${couleurTexte}">${livre.auteur || "Auteur"}</div>
  `;
}

// Affiche l'image en s'assurant qu'elle est bien chargée avant de la positionner
// (naturalWidth/naturalHeight ne sont disponibles qu'une fois l'image chargée).
function afficherImageCouverture(url) {
  const img = document.getElementById("imageFondCouverture");
  img.style.display = "block";
  if (img.src === url && img.complete && img.naturalWidth) {
    repositionnerImageCouverture();
  } else {
    img.onload = () => repositionnerImageCouverture();
    img.src = url;
  }
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
}

function setCouleurTexte(couleur) {
  const livre = livreActuel();
  const data = modeCouverture === "couverture" ? livre.couverture : livre.quatrieme;
  data.texte = couleur;
  document.getElementById("couleurTexteLibre").value = couleur;
  previewCouverture();
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
    const chemin = `images/${livre.id}_${modeCourant}.${extension}`;

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
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

chargerLivre();
initGlissementImageCouverture();