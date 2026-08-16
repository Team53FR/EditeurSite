// ===== Droid Fortnite — logique de la page de suivi =====
const token = exigerConnexion(); // redirige vers connexion.html si absent

let catalogue = [];
let shaCatalogue = null;
let renaissance = [];
let shaRenaissance = null;
// droidesPossedes : tableau de clés "<idDroide>::<palier>" — chaque droïde
// peut être possédé indépendamment à CHAQUE palier (Défaut, Or, Diamant...),
// comme dans le jeu (le compteur du jeu compte chaque palier séparément).
let perso = { droidesPossedes: [], renaissanceAtteinte: [] };
let shaPerso = null;

let ongletActif = "droidex";
let palierActif = PALIERS_DROIDE[0];
const cacheImages = new Map(); // chemin GitHub -> URL locale (blob:)

function clePossession(idDroide, palier) {
  return idDroide + "::" + palier;
}

// Les droïdes Iconiques (BB-8, R2-D2, C-3PO...) n'existent qu'au palier
// Défaut dans le jeu — pas d'amélioration possible pour eux.
function estDisponibleAuPalier(d, palier) {
  return d.rarete !== "Iconique" || palier === "Défaut";
}

function changerOnglet(type) {
  ongletActif = type;
  document.querySelectorAll(".onglet-type").forEach((b) => b.classList.toggle("actif", b.dataset.type === type));
  document.getElementById("zoneDroidexFiltres").style.display = type === "droidex" ? "" : "none";
  document.getElementById("zoneDroidex").style.display = type === "droidex" ? "" : "none";
  document.getElementById("zoneRenaissance").style.display = type === "renaissance" ? "" : "none";
  document.getElementById("boutonAjouter").title = type === "droidex" ? "Ajouter un droïde" : "Ajouter un palier";
}

if (token) {
  chargerTout();
}

async function chargerTout() {
  try {
    const [rCatalogue, rRenaissance, rPerso] = await Promise.all([
      chargerOuAmorcer("catalogue.json", CATALOGUE_INITIAL, token, "Amorçage du catalogue de droïdes"),
      chargerOuAmorcer("renaissance.json", RENAISSANCE_INITIALE, token, "Amorçage des paliers de renaissance"),
      chargerBibliothequePerso()
    ]);
    catalogue = Array.isArray(rCatalogue.contenu) ? rCatalogue.contenu : [];
    shaCatalogue = rCatalogue.sha;
    renaissance = Array.isArray(rRenaissance.contenu) ? rRenaissance.contenu : [];
    shaRenaissance = rRenaissance.sha;
  } catch (e) {
    document.getElementById("chargement").innerHTML =
      `<p style="color:var(--danger);text-align:center">${echapperHTML(e.message)}</p>`;
    return;
  }

  construireOngletsPalier();
  document.getElementById("chargement").style.display = "none";
  document.getElementById("zoneDroidex").style.display = "";
  afficherDroidex();
  afficherRenaissance();
}

function construireOngletsPalier() {
  const zone = document.getElementById("ongletsPalier");
  zone.innerHTML = "";
  PALIERS_DROIDE.forEach((p) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "onglet-palier" + (p === palierActif ? " actif" : "");
    bouton.textContent = p;
    bouton.addEventListener("click", () => changerPalierActif(p));
    zone.appendChild(bouton);
  });
}

function changerPalierActif(p) {
  palierActif = p;
  document.querySelectorAll(".onglet-palier").forEach((b) => b.classList.toggle("actif", b.textContent === p));
  afficherDroidex();
}

async function chargerBibliothequePerso() {
  try {
    const { contenu, sha } = await lireFichierJSON(cheminBibliothequeCourante(), token);
    let droidesPossedes = [];
    if (Array.isArray(contenu && contenu.droidesPossedes)) {
      droidesPossedes = contenu.droidesPossedes;
    } else if (contenu && contenu.droidesPossedes && typeof contenu.droidesPossedes === "object") {
      // Ancienne forme (un seul palier par droïde, avant l'introduction des
      // onglets de palier) : on reprend le palier déjà enregistré comme seul
      // palier possédé pour ce droïde, rien n'est perdu.
      droidesPossedes = Object.entries(contenu.droidesPossedes).map(([id, palier]) => clePossession(id, palier));
    }
    perso = {
      droidesPossedes,
      renaissanceAtteinte: (contenu && Array.isArray(contenu.renaissanceAtteinte)) ? contenu.renaissanceAtteinte : []
    };
    shaPerso = sha;
  } catch (e) {
    if (e.status !== 404) throw e;
    perso = { droidesPossedes: [], renaissanceAtteinte: [] };
    shaPerso = null;
  }
}

// Fichier personnel : un seul écrivain légitime (le compte lui-même), donc un
// simple retry (relire le sha, réécrire l'état local) suffit — pas besoin de
// la fusion utilisée pour les fichiers partagés.
async function sauvegarderPerso() {
  try {
    shaPerso = await ecrireFichierJSON(cheminBibliothequeCourante(), perso, shaPerso, token, "Mise à jour de la progression");
  } catch (e) {
    if (e.conflit) {
      const frais = await lireFichierJSON(cheminBibliothequeCourante(), token);
      shaPerso = await ecrireFichierJSON(cheminBibliothequeCourante(), perso, frais.sha, token, "Mise à jour de la progression");
    } else {
      afficherToast(e.message, true);
    }
  }
}

function echapperHTML(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function classeRareteCss(rarete) {
  return (rarete || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function iconeClasse(classe) {
  if (classe === "Astromec") return "📡";
  if (classe === "Combat") return "⚔️";
  return "🔧";
}

function formaterCredits(n) {
  if (n >= 1e12) return (Math.round((n / 1e12) * 100) / 100) + " T";
  if (n >= 1e9) return (Math.round((n / 1e9) * 100) / 100) + " Md";
  if (n >= 1e6) return (Math.round((n / 1e6) * 100) / 100) + " M";
  if (n >= 1e3) return Math.round(n / 1e3) + " k";
  return String(n);
}

let toastTimeout = null;
function afficherToast(texte, erreur) {
  const toast = document.getElementById("toast");
  toast.textContent = texte;
  toast.className = "toast visible" + (erreur ? " erreur" : "");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.className = "toast"; }, 3000);
}

// ===== Onglet Droidex =====
function afficherDroidex() {
  const recherche = (document.getElementById("champRecherche").value || "").trim().toLowerCase();
  const filtreClasse = document.getElementById("filtreClasse").value;
  const filtreRarete = document.getElementById("filtreRarete").value;
  const filtrePossede = document.getElementById("filtrePossede").value;

  const disponibles = catalogue.filter((d) => estDisponibleAuPalier(d, palierActif));

  const filtres = disponibles.filter((d) => {
    if (recherche && !d.nom.toLowerCase().includes(recherche)) return false;
    if (filtreClasse && d.classe !== filtreClasse) return false;
    if (filtreRarete && d.rarete !== filtreRarete) return false;
    const possede = perso.droidesPossedes.includes(clePossession(d.id, palierActif));
    if (filtrePossede === "oui" && !possede) return false;
    if (filtrePossede === "non" && possede) return false;
    return true;
  });

  const grille = document.getElementById("grilleDroidex");
  const vide = document.getElementById("videDroidex");
  grille.innerHTML = "";
  vide.style.display = filtres.length ? "none" : "";

  filtres.forEach((d) => {
    const possede = perso.droidesPossedes.includes(clePossession(d.id, palierActif));
    const carte = document.createElement("div");
    carte.className = "carte-droide" + (possede ? " possede" : "");
    carte.setAttribute("role", "button");
    carte.setAttribute("aria-pressed", possede ? "true" : "false");
    carte.innerHTML =
      `<div class="droide-entete">` +
        `<div class="droide-icone" id="icone-${d.id}">${iconeClasse(d.classe)}</div>` +
        `<div class="droide-nom">${echapperHTML(d.nom)}</div>` +
        `<button type="button" class="droide-modifier" title="Modifier">✎</button>` +
        `<span class="droide-case">✓</span>` +
      `</div>` +
      `<span class="badge-rarete ${classeRareteCss(d.rarete)}">${echapperHTML(d.rarete)}</span>`;

    carte.addEventListener("click", () => basculerPossession(d.id));
    carte.querySelector(".droide-modifier").addEventListener("click", (e) => {
      e.stopPropagation();
      ouvrirModifierDroide(d.id);
    });

    if (d.image) chargerImageDroide(carte.querySelector(`#icone-${CSS.escape(d.id)}`), d.image);

    grille.appendChild(carte);
  });

  const total = disponibles.length;
  const possedes = disponibles.filter((d) => perso.droidesPossedes.includes(clePossession(d.id, palierActif))).length;
  const pct = total ? Math.round((possedes / total) * 100) : 0;
  document.getElementById("compteurDroidex").innerHTML =
    `<b>${possedes} / ${total}</b> au palier ${echapperHTML(palierActif)}` +
    `<div class="barre-progression"><span style="width:${pct}%"></span></div>`;
}

async function chargerImageDroide(element, chemin) {
  if (!element) return;
  try {
    let url = cacheImages.get(chemin);
    if (!url) {
      url = await obtenirUrlImage(chemin, token);
      cacheImages.set(chemin, url);
    }
    element.innerHTML = `<img src="${url}" alt="">`;
  } catch (e) {
    // Reste sur l'icône de classe si l'image ne charge pas — pas bloquant.
  }
}

function basculerPossession(idDroide) {
  const cle = clePossession(idDroide, palierActif);
  const index = perso.droidesPossedes.indexOf(cle);
  if (index === -1) perso.droidesPossedes.push(cle);
  else perso.droidesPossedes.splice(index, 1);
  afficherDroidex();
  sauvegarderPerso();
}

function ouvrirAjoutDroide() {
  document.getElementById("champDroideNom").value = "";
  document.getElementById("champDroideClasse").value = "Ouvrier";
  document.getElementById("champDroideRarete").value = "Typique";
  document.getElementById("messageDroide").textContent = "";
  document.getElementById("voileDroide").classList.add("ouvert");
  document.getElementById("champDroideNom").focus();
}
function fermerAjoutDroide() {
  document.getElementById("voileDroide").classList.remove("ouvert");
}

function genererId(prefixe) {
  return `${prefixe}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function enregistrerDroide() {
  const nom = document.getElementById("champDroideNom").value.trim();
  const classe = document.getElementById("champDroideClasse").value;
  const rarete = document.getElementById("champDroideRarete").value;
  const message = document.getElementById("messageDroide");

  if (!nom) { message.textContent = "Le nom est obligatoire."; return; }

  const nouveau = { id: genererId("d"), nom, classe, rarete };
  const copie = catalogue.concat([nouveau]);

  message.textContent = "Ajout en cours...";
  try {
    shaCatalogue = await sauvegarderAvecFusion("catalogue.json", copie, shaCatalogue, token, `Ajout du droïde ${nom}`);
    catalogue = copie;
    fermerAjoutDroide();
    afficherDroidex();
    afficherToast("Droïde ajouté.");
  } catch (e) {
    message.textContent = e.message;
  }
}

// ===== Modifier un droïde (photo perso) =====
let droideEnEdition = null;
let dataUrlImageEnMemoireDroide = null;
let imageSupprimeeDroide = false;

function iconePlaceholderDroide() {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
}

async function ouvrirModifierDroide(id) {
  const d = catalogue.find((x) => x.id === id);
  if (!d) return;
  droideEnEdition = id;
  dataUrlImageEnMemoireDroide = null;
  imageSupprimeeDroide = false;

  document.getElementById("titreModifDroide").textContent = "Modifier « " + d.nom + " »";
  document.getElementById("messageModifDroide").textContent = "";
  const apercu = document.getElementById("apercuModifDroide");
  const boutonRetirer = document.getElementById("boutonSupprimerImageDroide");
  apercu.innerHTML = iconePlaceholderDroide();
  boutonRetirer.style.display = d.image ? "block" : "none";
  document.getElementById("voileModifDroide").classList.add("ouvert");

  if (d.image) {
    try {
      let url = cacheImages.get(d.image);
      if (!url) { url = await obtenirUrlImage(d.image, token); cacheImages.set(d.image, url); }
      if (droideEnEdition === id) apercu.innerHTML = `<img src="${url}" alt="">`;
    } catch (e) { /* reste sur le placeholder */ }
  }
}

function fermerModifierDroide() {
  document.getElementById("voileModifDroide").classList.remove("ouvert");
  droideEnEdition = null;
}

function declencherChoixImageDroide(source) {
  document.getElementById(source === "camera" ? "champImageCameraDroide" : "champImageGalerieDroide").click();
}

async function imageChoisieDroide(event) {
  const fichier = event.target.files[0];
  event.target.value = "";
  if (!fichier) return;
  try {
    const dataUrl = await comprimerImage(fichier);
    dataUrlImageEnMemoireDroide = dataUrl;
    imageSupprimeeDroide = false;
    document.getElementById("apercuModifDroide").innerHTML = `<img src="${dataUrl}" alt="">`;
    document.getElementById("boutonSupprimerImageDroide").style.display = "block";
  } catch (e) {
    afficherToast("Impossible de charger cette image.", true);
  }
}

function retirerImageDroide() {
  dataUrlImageEnMemoireDroide = null;
  imageSupprimeeDroide = true;
  document.getElementById("apercuModifDroide").innerHTML = iconePlaceholderDroide();
  document.getElementById("boutonSupprimerImageDroide").style.display = "none";
}

// Redimensionne côté client avant envoi (identique à sites/ma-bibliotheque/collection.js).
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
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

async function enregistrerModifDroide() {
  const id = droideEnEdition;
  const d = catalogue.find((x) => x.id === id);
  const message = document.getElementById("messageModifDroide");
  if (!d) return;

  message.textContent = "Enregistrement...";
  try {
    let nouveauChemin = d.image || null;

    if (dataUrlImageEnMemoireDroide) {
      const chemin = `images/${id}.${extraireExtensionDataUrl(dataUrlImageEnMemoireDroide)}`;
      await uploaderImageBase64(chemin, dataUrlImageEnMemoireDroide, token, `Photo du droïde ${d.nom}`);
      if (d.image && d.image !== chemin) supprimerFichierGithub(d.image, token, "Remplacement de la photo").catch(() => {});
      cacheImages.delete(chemin);
      nouveauChemin = chemin;
    } else if (imageSupprimeeDroide) {
      if (d.image) supprimerFichierGithub(d.image, token, "Suppression de la photo").catch(() => {});
      nouveauChemin = null;
    }

    const copie = catalogue.map((x) => {
      if (x.id !== id) return x;
      const maj = Object.assign({}, x);
      if (nouveauChemin) maj.image = nouveauChemin;
      else delete maj.image;
      return maj;
    });

    shaCatalogue = await sauvegarderAvecFusion("catalogue.json", copie, shaCatalogue, token, `Modification du droïde ${d.nom}`);
    catalogue = copie;
    fermerModifierDroide();
    afficherDroidex();
    afficherToast("Droïde mis à jour.");
  } catch (e) {
    message.textContent = e.message;
  }
}

// ===== Onglet Renaissance =====
function afficherRenaissance() {
  const tries = renaissance.slice().sort((a, b) => a.niveau - b.niveau);
  const liste = document.getElementById("listeRenaissance");
  liste.innerHTML = "";

  tries.forEach((r) => {
    const atteint = perso.renaissanceAtteinte.includes(r.id);
    const item = document.createElement("div");
    item.className = "item-renaissance" + (atteint ? " atteint" : "");
    item.innerHTML =
      `<div class="renaissance-entete">` +
        `<div class="renaissance-niveau">${r.niveau}</div>` +
        `<div class="renaissance-titre">` +
          `<strong>Palier ${r.niveau}</strong>` +
          `<small>${formaterCredits(r.credits)} crédits</small>` +
        `</div>` +
        `<input type="checkbox" class="renaissance-case" ${atteint ? "checked" : ""}>` +
      `</div>` +
      `<p class="renaissance-elements">${echapperHTML(r.elements || "")}</p>`;

    item.querySelector(".renaissance-case").addEventListener("change", () => basculerAtteint(r.id));
    liste.appendChild(item);
  });

  const total = renaissance.length;
  const atteints = perso.renaissanceAtteinte.length;
  const pct = total ? Math.round((atteints / total) * 100) : 0;
  document.getElementById("compteurRenaissance").innerHTML =
    `<b>${atteints} / ${total}</b>` +
    `<div class="barre-progression"><span style="width:${pct}%"></span></div>`;
}

function basculerAtteint(idRenaissance) {
  const index = perso.renaissanceAtteinte.indexOf(idRenaissance);
  if (index === -1) perso.renaissanceAtteinte.push(idRenaissance);
  else perso.renaissanceAtteinte.splice(index, 1);
  afficherRenaissance();
  sauvegarderPerso();
}

function ouvrirAjoutRenaissance() {
  const prochainNiveau = renaissance.reduce((max, r) => Math.max(max, r.niveau), 0) + 1;
  document.getElementById("champNiveau").value = prochainNiveau;
  document.getElementById("champCredits").value = "";
  document.getElementById("champElements").value = "";
  document.getElementById("messageRenaissance").textContent = "";
  document.getElementById("voileRenaissance").classList.add("ouvert");
  document.getElementById("champCredits").focus();
}
function fermerAjoutRenaissance() {
  document.getElementById("voileRenaissance").classList.remove("ouvert");
}

async function enregistrerRenaissance() {
  const niveau = Number(document.getElementById("champNiveau").value);
  const credits = Number(document.getElementById("champCredits").value);
  const elements = document.getElementById("champElements").value.trim();
  const message = document.getElementById("messageRenaissance");

  if (!niveau || !credits) { message.textContent = "Le niveau et les crédits requis sont obligatoires."; return; }

  const nouveau = { id: genererId("r"), niveau, credits, elements };
  const copie = renaissance.concat([nouveau]);

  message.textContent = "Ajout en cours...";
  try {
    shaRenaissance = await sauvegarderAvecFusion("renaissance.json", copie, shaRenaissance, token, `Ajout du palier de renaissance ${niveau}`);
    renaissance = copie;
    fermerAjoutRenaissance();
    afficherRenaissance();
    afficherToast("Palier ajouté.");
  } catch (e) {
    message.textContent = e.message;
  }
}

// ===== Bouton flottant : ouvre le bon formulaire selon l'onglet actif =====
function ouvrirAjout() {
  if (ongletActif === "droidex") ouvrirAjoutDroide();
  else ouvrirAjoutRenaissance();
}
