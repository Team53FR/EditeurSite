// ===== Lecteur de livre publié (lecture seule) =====
// Reprend l'expérience du « mode aperçu » de l'éditeur (double-page + tournage
// de page), mais en lecture seule et de façon autonome. Utilise directement
// livre.pages (déjà présent dans un livre publié).

const FORMATS = {
  "149x210": { larg: 149, haut: 210, margeV: 20, margeH: 20 },
  "155x235": { larg: 155, haut: 235, margeV: 22, margeH: 20 },
  "105x148": { larg: 105, haut: 148, margeV: 14, margeH: 14 },
  "210x297": { larg: 210, haut: 297, margeV: 25, margeH: 25 },
};
const PX_PAR_MM = 96 / 25.4;

let livre = null;
let indexApercu = 0;
let animationEnCours = false;
let cacheImagesURL = {};

// ---------- Chargement du livre publié ----------

async function chargerLecture() {
  const token = localStorage.getItem("gh_token");
  const message = document.getElementById("message");

  if (!token || !localStorage.getItem("gh_login")) {
    // Lecture réservée aux utilisateurs connectés.
    const params = location.search;
    window.location.replace("connexion.html");
    return;
  }

  const q = new URLSearchParams(location.search);
  const proprietaire = q.get("u");
  const id = q.get("id");
  if (!proprietaire || !id) {
    message.textContent = "Livre introuvable (lien invalide).";
    return;
  }

  try {
    const { contenu } = await lireFichierJSON(cheminBibliothequeDe(proprietaire), token);
    const trouve = (contenu.livres || []).find(l => l.id === id);
    if (!trouve) { message.textContent = "Ce livre n'existe plus."; return; }
    if (!trouve.publie) { message.textContent = "Ce livre n'est pas (ou plus) publié."; return; }
    livre = trouve;
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  document.getElementById("lectureTitre").textContent = livre.titre || "Lecture";
  document.title = (livre.titre || "Lecture") + " — Lecture";
  if (!livre.pages || livre.pages.length === 0) livre.pages = [{ id: "p1", contenu: "" }];

  indexApercu = 0;
  window.addEventListener("resize", () => { if (!animationEnCours) afficherApercu(); });
  afficherApercu();
}

// ---------- Dimensionnement (comme l'éditeur, adapté au lecteur) ----------

function appliquerFormatPage(formatKey) {
  const f = FORMATS[formatKey] || FORMATS["149x210"];
  const largPx = Math.round(f.larg * PX_PAR_MM);
  const hautPx = Math.round(f.haut * PX_PAR_MM);
  const margeVPx = Math.round(f.margeV * PX_PAR_MM);
  const margeHPx = Math.round(f.margeH * PX_PAR_MM);
  const numPageH = 32;
  const gap = 26;

  document.querySelectorAll(".page-livre").forEach(el => {
    el.style.width = largPx + "px";
    el.style.height = hautPx + "px";
    el.style.padding = margeVPx + "px " + margeHPx + "px 0";
    el.style.boxSizing = "border-box";
    el.style.flexShrink = "0";
  });
  document.querySelectorAll(".texte-livre").forEach(el => {
    el.style.width = (largPx - margeHPx * 2) + "px";
    el.style.height = (hautPx - margeVPx - numPageH) + "px";
  });

  const bookLarg = 2 * largPx + gap;
  const dispoW = window.innerWidth - 2 * 56 - 40;   // 2 boutons nav + marges
  const dispoH = window.innerHeight - 150;          // en-tête + indicateur + marges
  let echelle = Math.min(dispoW / bookLarg, dispoH / hautPx);
  if (!isFinite(echelle) || echelle <= 0) echelle = 1;
  echelle = Math.min(echelle, 1.5);

  document.querySelectorAll(".livre-ouvert").forEach(el => {
    el.style.transform = `scale(${echelle})`;
    el.style.transformOrigin = "center center";
    const dLarg = (bookLarg * (echelle - 1)) / 2;
    const dHaut = (hautPx * (echelle - 1)) / 2;
    el.style.margin = `${dHaut}px ${dLarg}px`;
  });
}

// ---------- Vues (couverture / intérieur / 4e) ----------

function nombreSpreadsApercu() {
  return Math.max(1, Math.ceil(livre.pages.length / 2));
}

function typeVueApercu(idx) {
  const derniere = nombreSpreadsApercu() + 1;
  if (idx <= 0) return "couverture";
  if (idx >= derniere) return "quatrieme";
  return "interieur";
}

function donneesInterieur(idx) {
  const pages = livre.pages;
  const iGauche = (idx - 1) * 2;
  const iDroite = iGauche + 1;
  return {
    gauche: pages[iGauche] || null,
    droite: pages[iDroite] || null,
    numG: iGauche + 1,
    numD: pages[iDroite] ? iDroite + 1 : ""
  };
}

function creerPageViergeApercu() {
  const div = document.createElement("div");
  div.className = "page-livre page-vierge-apercu";
  return div;
}

function pageCoteApercu(idx, cote) {
  const derniere = nombreSpreadsApercu() + 1;
  if (idx <= 0) return cote === "droite" ? creerPageCouvertureApercu("couverture") : creerPageViergeApercu();
  if (idx >= derniere) return cote === "gauche" ? creerPageCouvertureApercu("quatrieme") : creerPageViergeApercu();
  const d = donneesInterieur(idx);
  return cote === "gauche" ? creerPageTexteApercu(d.gauche, d.numG) : creerPageTexteApercu(d.droite, d.numD);
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
    page.appendChild(img);
    const token = localStorage.getItem("gh_token");
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
    ${mode === "couverture" && afficherTitre ? `<div class="apercu-titre" style="color:${couleurTexte};${styleTexteCouv(data, "titre")}">${livre.titre || "Titre"}</div>` : ""}
    ${afficherAuteur ? `<div class="apercu-auteur" style="color:${couleurTexte};${styleTexteCouv(data, "auteur")}">${livre.auteur || "Auteur"}</div>` : ""}
  `;
  page.appendChild(couche);
  return page;
}

function positionnerImageApercu(img, data, url, page, chemin, dejaRetente) {
  img.onload = () => {
    const cw = page.clientWidth, ch = page.clientHeight;
    if (!cw || !ch) return;
    const echelleBase = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const zoom = data.imgZoom || 1;
    const la = img.naturalWidth * echelleBase, ha = img.naturalHeight * echelleBase;
    const cx = (cw - la) / 2, cy = (ch - ha) / 2;
    img.style.width = la + "px";
    img.style.height = ha + "px";
    img.style.transform = `translate(${cx + (data.imgOffsetX || 0)}px, ${cy + (data.imgOffsetY || 0)}px) scale(${zoom})`;
  };
  img.onerror = () => {
    if (dejaRetente) return;
    delete cacheImagesURL[chemin];
    const token = localStorage.getItem("gh_token");
    obtenirUrlImage(chemin, token).then((u) => { cacheImagesURL[chemin] = u; positionnerImageApercu(img, data, u, page, chemin, true); }).catch(() => {});
  };
  img.src = url;
}

function afficherApercu() {
  const conteneur = document.getElementById("conteneurApercu");
  const indicateur = document.getElementById("indicateurApercu");
  const btnPrec = document.getElementById("btnApercuPrec");
  const btnSuiv = document.getElementById("btnApercuSuiv");
  const derniere = nombreSpreadsApercu() + 1;

  conteneur.innerHTML = "";
  btnPrec.disabled = indexApercu === 0;
  btnSuiv.disabled = indexApercu === derniere;

  if (indexApercu === 0) indicateur.textContent = "Couverture";
  else if (indexApercu === derniere) indicateur.textContent = "4e de couverture";
  else {
    const iG = (indexApercu - 1) * 2, iD = iG + 1;
    indicateur.textContent = livre.pages[iD] ? `Pages ${iG + 1} - ${iD + 1}` : `Page ${iG + 1}`;
  }

  conteneur.appendChild(pageCoteApercu(indexApercu, "gauche"));
  conteneur.appendChild(pageCoteApercu(indexApercu, "droite"));
  appliquerFormatPage(livre.format || "149x210");
}

// ---------- Navigation + tournage de page ----------

function apercuSuivant() {
  if (animationEnCours) return;
  if (indexApercu < nombreSpreadsApercu() + 1) animerTransition(1);
}
function apercuPrecedent() {
  if (animationEnCours) return;
  if (indexApercu > 0) animerTransition(-1);
}

function animerTransition(direction) {
  animationEnCours = true;
  animerFlip(direction, indexApercu, indexApercu + direction);
}

function positionnerPageAnim(pageEl, left) {
  pageEl.style.position = "absolute";
  pageEl.style.top = "0";
  pageEl.style.left = left + "px";
}

function animerFlip(direction, from, to) {
  const conteneur = document.getElementById("conteneurApercu");
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];
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

  let baseG, baseD, faceAvant, faceArriere, transEnd;
  if (direction === 1) {
    baseG = pageCoteApercu(from, "gauche");
    baseD = pageCoteApercu(to, "droite");
    faceAvant = pageCoteApercu(from, "droite");
    faceArriere = pageCoteApercu(to, "gauche");
    transEnd = "rotateY(-180deg)";
  } else {
    baseG = pageCoteApercu(to, "gauche");
    baseD = pageCoteApercu(from, "droite");
    faceAvant = pageCoteApercu(from, "gauche");
    faceArriere = pageCoteApercu(to, "droite");
    transEnd = "rotateY(180deg)";
  }
  positionnerPageAnim(baseG, 0);
  positionnerPageAnim(baseD, largPx + gap);
  wrap.appendChild(baseG);
  wrap.appendChild(baseD);

  const leaf = document.createElement("div");
  leaf.className = "anim-leaf";
  leaf.style.position = "absolute";
  leaf.style.top = "0";
  leaf.style.width = largPx + "px";
  leaf.style.height = hautPx + "px";
  leaf.style.transformStyle = "preserve-3d";
  if (direction === 1) {
    leaf.style.left = (largPx + gap) + "px";
    leaf.style.transformOrigin = (-gap / 2) + "px center";
  } else {
    leaf.style.left = "0px";
    leaf.style.transformOrigin = (largPx + gap / 2) + "px center";
  }
  faceAvant.classList.add("anim-leaf-face");
  faceArriere.classList.add("anim-leaf-face", "dos");

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

  appliquerFormatPage(livre.format || "149x210");

  const reglages = { duration: 750, easing: "cubic-bezier(.35,0,.25,1)" };
  const anim = leaf.animate([{ transform: "rotateY(0deg)" }, { transform: transEnd }], reglages);
  [ombreAvant, ombreArriere].forEach(o => o.animate([{ opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }], reglages));
  const terminer = () => { indexApercu = to; afficherApercu(); animationEnCours = false; };
  anim.onfinish = terminer;
  anim.oncancel = terminer;
}

// ---------- Protection anti-copie « facile » + navigation clavier ----------

["contextmenu", "copy", "cut", "selectstart", "dragstart"].forEach(ev =>
  document.addEventListener(ev, (e) => e.preventDefault())
);
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") apercuSuivant();
  else if (e.key === "ArrowLeft") apercuPrecedent();
});

chargerLecture();
