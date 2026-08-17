// ===== Droid Fortnite — logique de la page de suivi =====
const token = exigerConnexion(); // redirige vers connexion.html si absent

let catalogue = [];
let shaCatalogue = null;
let renaissance = [];
let shaRenaissance = null;
let paliers = PALIERS_INITIAUX; // remplacé par le contenu réel de paliers.json au chargement
// droidesPossedes : tableau de clés "<idDroide>::<palier>" — chaque droïde
// peut être possédé indépendamment à CHAQUE palier (Défaut, Or, Diamant...),
// comme dans le jeu (le compteur du jeu compte chaque palier séparément).
let perso = { droidesPossedes: [], renaissanceAtteinte: [] };
let shaPerso = null;

let ongletActif = "droidex";
let palierActif = PALIERS_INITIAUX[0].nom;
const cacheImages = new Map(); // chemin GitHub -> URL locale (blob:)

function clePossession(idDroide, palier) {
  return idDroide + "::" + palier;
}

// Les droïdes Iconiques (BB-8, R2-D2, C-3PO...) n'existent qu'au premier
// palier (Défaut) dans le jeu — pas d'amélioration possible pour eux. On
// compare au premier élément du tableau CHARGÉ, pas à la chaîne "Défaut" en
// dur, pour rester correct même si la liste de paliers a été modifiée.
function estDisponibleAuPalier(d, palierNom) {
  const premier = paliers[0] && paliers[0].nom;
  return d.rarete !== "Iconique" || palierNom === premier;
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
  // Lien vers le panneau admin et bouton d'ajout : réservés aux admins du
  // portail central (voir estAdminCentral() dans script.js).
  if (estAdminCentral()) {
    document.getElementById("lienAdmin").style.display = "";
  } else {
    document.getElementById("boutonAjouter").style.display = "none";
  }
  chargerTout();
}

async function chargerTout() {
  try {
    const [rCatalogue, rRenaissance, rPaliers, rPerso] = await Promise.all([
      chargerOuAmorcer("catalogue.json", CATALOGUE_INITIAL, token, "Amorçage du catalogue de droïdes"),
      chargerOuAmorcer("renaissance.json", RENAISSANCE_INITIALE, token, "Amorçage des paliers de renaissance"),
      chargerOuAmorcer("paliers.json", PALIERS_INITIAUX, token, "Amorçage de la liste des paliers"),
      chargerBibliothequePerso()
    ]);
    catalogue = Array.isArray(rCatalogue.contenu) ? rCatalogue.contenu : [];
    shaCatalogue = rCatalogue.sha;
    renaissance = Array.isArray(rRenaissance.contenu) ? rRenaissance.contenu : [];
    shaRenaissance = rRenaissance.sha;
    const paliersCharges = normaliserPaliers(rPaliers.contenu);
    paliers = paliersCharges.length ? paliersCharges : PALIERS_INITIAUX;
    palierActif = paliers[0].nom;
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
  paliers.forEach((p) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "onglet-palier" + (p.nom === palierActif ? " actif" : "");
    bouton.textContent = p.nom;
    bouton.addEventListener("click", () => changerPalierActif(p.nom));
    zone.appendChild(bouton);
  });
}

function changerPalierActif(nom) {
  palierActif = nom;
  document.querySelectorAll(".onglet-palier").forEach((b) => b.classList.toggle("actif", b.textContent === nom));
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

  // Le contour des cartes prend la couleur du PALIER actif (définie dans le
  // gestionnaire), pas une couleur propre à chaque droïde.
  const palierObjActif = paliers.find((p) => p.nom === palierActif);
  const couleurPalierActif = palierObjActif && palierObjActif.couleur;

  filtres.forEach((d) => {
    const possede = perso.droidesPossedes.includes(clePossession(d.id, palierActif));
    const carte = construireCarteDroide(d, {
      possede,
      couleur: couleurPalierActif,
      palier: palierActif
    });
    carte.setAttribute("role", "button");
    carte.setAttribute("aria-pressed", possede ? "true" : "false");
    carte.addEventListener("click", () => basculerPossession(d.id));
    grille.appendChild(carte);
  });

  const total = disponibles.length;
  const possedes = disponibles.filter((d) => perso.droidesPossedes.includes(clePossession(d.id, palierActif))).length;
  const pct = total ? Math.round((possedes / total) * 100) : 0;
  document.getElementById("compteurDroidex").innerHTML =
    `<b>${possedes} / ${total}</b> au palier ${echapperHTML(palierActif)}` +
    `<div class="barre-progression"><span style="width:${pct}%"></span></div>`;
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
