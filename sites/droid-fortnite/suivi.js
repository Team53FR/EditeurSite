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
let perso = { droidesPossedes: [], renaissanceAtteinte: [], rendement: null };
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
function changerOnglet(type) {
  ongletActif = type;
  document.querySelectorAll(".onglet-type").forEach((b) => b.classList.toggle("actif", b.dataset.type === type));
  document.getElementById("zoneDroidexFiltres").style.display = type === "droidex" ? "" : "none";
  document.getElementById("zoneDroidex").style.display = type === "droidex" ? "" : "none";
  document.getElementById("zoneRendement").style.display = type === "rendement" ? "" : "none";
  document.getElementById("zoneRenaissance").style.display = type === "renaissance" ? "" : "none";
  // Le bouton flottant n'a rien à ajouter dans l'escouade : les emplacements
  // se règlent section par section, avec les boutons − / +.
  document.getElementById("boutonAjouter").style.display =
    (type === "rendement" || !estAdminCentral()) ? "none" : "";
  document.getElementById("boutonAjouter").title = type === "droidex" ? "Ajouter un droïde" : "Ajouter un palier";
  if (type === "rendement") afficherRendement();
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
      chargerOuAmorcer("unites.json", UNITES_INITIALES, token, "Amorçage des unités de grandeur"),
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
  afficherRendement();
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
      renaissanceAtteinte: (contenu && Array.isArray(contenu.renaissanceAtteinte)) ? contenu.renaissanceAtteinte : [],
      rendement: (contenu && contenu.rendement) || null
    };
    shaPerso = sha;
  } catch (e) {
    if (e.status !== 404) throw e;
    perso = { droidesPossedes: [], renaissanceAtteinte: [], rendement: null };
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

// ===== Onglet Rendement : l'escouade =====
//
// Trois sections, une par classe, chacune avec un nombre d'emplacements qui
// grandit à mesure qu'on en débloque dans le jeu. Un emplacement contient
// une clé « <idDroide>::<palier> » — la même forme que la possession, car le
// rendement dépend du palier autant que du droïde.
//
// Tout est PERSONNEL (bibliotheques/<login>.json) : le nombre d'emplacements
// est une progression, propre à chaque compte, et chacun peut donc l'ajuster
// sans passer par un administrateur.

const CLASSES_ESCOUADE = ["Ouvrier", "Astromec", "Combat"];
const SLOTS_PAR_DEFAUT = 3;
const SLOTS_MAX = 30;

// Section et index de l'emplacement en cours de remplissage.
let slotEnCours = null;

function escouade() {
  if (!perso.rendement || typeof perso.rendement !== "object") {
    perso.rendement = { slots: {}, places: {} };
  }
  const r = perso.rendement;
  if (!r.slots || typeof r.slots !== "object") r.slots = {};
  if (!r.places || typeof r.places !== "object") r.places = {};
  CLASSES_ESCOUADE.forEach((c) => {
    if (typeof r.slots[c] !== "number" || r.slots[c] < 0) r.slots[c] = SLOTS_PAR_DEFAUT;
    if (!Array.isArray(r.places[c])) r.places[c] = [];
    // Le tableau des places suit toujours le nombre d'emplacements.
    r.places[c].length = r.slots[c];
    for (let i = 0; i < r.places[c].length; i++) {
      if (r.places[c][i] === undefined) r.places[c][i] = null;
    }
  });
  return r;
}

// « mouse::Or » -> { id: "mouse", palier: "Or" }. Le nom d'un palier peut
// contenir des tirets ou des espaces, jamais « :: » : on coupe au premier.
function decouperCle(cle) {
  if (typeof cle !== "string") return null;
  const i = cle.indexOf("::");
  if (i === -1) return null;
  return { id: cle.slice(0, i), palier: cle.slice(i + 2) };
}

function droideDeCle(cle) {
  const d = decouperCle(cle);
  if (!d) return null;
  const droide = catalogue.find((x) => x.id === d.id);
  return droide ? { droide, palier: d.palier } : null;
}

// Somme des rendements placés. Les droïdes Iconiques rapportent un
// pourcentage du revenu total (« 15% ») et non des crédits par seconde :
// impossible de les additionner aux autres, on les compte à part plutôt que
// de les ignorer en silence ou d'inventer une formule.
function totalEscouade(cles) {
  let credits = 0;
  let pourcentage = 0;
  let inconnus = 0;
  cles.forEach((cle) => {
    const p = droideDeCle(cle);
    if (!p) return;
    const brut = valeurPalier(p.droide.rendements, p.palier);
    if (brut === null) { inconnus++; return; }
    const texte = String(brut).trim();
    const pc = texte.match(/^([\d.,]+)\s*%$/);
    if (pc) { pourcentage += parseFloat(pc[1].replace(",", ".")) || 0; return; }
    const n = parseFloat(texte.replace(",", "."));
    if (isFinite(n)) credits += n; else inconnus++;
  });
  return { credits, pourcentage, inconnus };
}

function texteTotal(t) {
  const morceaux = [];
  morceaux.push("<b>" + formaterCredits(t.credits) + "/s</b>");
  if (t.pourcentage) {
    morceaux.push('<span class="total-bonus">+ ' +
      (Math.round(t.pourcentage * 100) / 100) + " % du revenu total</span>");
  }
  if (t.inconnus) {
    morceaux.push('<span class="total-inconnu">' + t.inconnus +
      " sans rendement renseigné</span>");
  }
  return morceaux.join(" ");
}

function afficherRendement() {
  const r = escouade();
  const zone = document.getElementById("sectionsRendement");
  zone.innerHTML = "";

  CLASSES_ESCOUADE.forEach((classe) => {
    const places = r.places[classe];
    const total = totalEscouade(places.filter(Boolean));

    const section = document.createElement("section");
    section.className = "section-escouade";
    section.innerHTML =
      '<div class="entete-escouade">' +
        '<h3>' + iconeClasse(classe) + " " + echapperHTML(classe) + "</h3>" +
        '<span class="total-section">' + texteTotal(total) + "</span>" +
        '<div class="reglage-slots">' +
          '<button type="button" class="btn-slot" data-classe="' + echapperHTML(classe) + '" data-delta="-1"' +
            (r.slots[classe] <= 0 ? " disabled" : "") + ' aria-label="Retirer un emplacement">−</button>' +
          '<span class="nb-slots">' + places.filter(Boolean).length + " / " + r.slots[classe] + "</span>" +
          '<button type="button" class="btn-slot" data-classe="' + echapperHTML(classe) + '" data-delta="1"' +
            (r.slots[classe] >= SLOTS_MAX ? " disabled" : "") + ' aria-label="Ajouter un emplacement">+</button>' +
        "</div>" +
      "</div>" +
      '<div class="grille-slots"></div>';

    const grille = section.querySelector(".grille-slots");
    places.forEach((cle, index) => {
      grille.appendChild(construireSlot(classe, index, cle));
    });
    if (!places.length) {
      const vide = document.createElement("p");
      vide.className = "aucun-slot";
      vide.textContent = "Aucun emplacement — utilise + pour en ajouter.";
      section.appendChild(vide);
    }

    section.querySelectorAll(".btn-slot").forEach((b) => {
      b.onclick = () => changerNombreSlots(b.dataset.classe, Number(b.dataset.delta));
    });
    zone.appendChild(section);
  });

  const global = totalEscouade(
    CLASSES_ESCOUADE.flatMap((c) => r.places[c]).filter(Boolean)
  );
  const nbPlaces = CLASSES_ESCOUADE.reduce((n, c) => n + r.places[c].filter(Boolean).length, 0);
  const nbSlots = CLASSES_ESCOUADE.reduce((n, c) => n + r.slots[c], 0);
  document.getElementById("compteurRendement").innerHTML =
    "Rendement total : " + texteTotal(global) +
    '<span class="compteur-detail">' + nbPlaces + " / " + nbSlots + " emplacements occupés</span>";
}

function construireSlot(classe, index, cle) {
  const place = cle ? droideDeCle(cle) : null;

  const slot = document.createElement("div");
  slot.className = "slot" + (place ? " rempli" : " vide");
  slot.setAttribute("role", "button");
  slot.tabIndex = 0;

  if (!place) {
    slot.innerHTML = '<span class="slot-plus">+</span><span class="slot-libelle">Vide</span>';
    slot.title = "Placer un droïde";
    slot.onclick = () => ouvrirChoixSlot(classe, index);
    slot.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); slot.onclick(); } };
    return slot;
  }

  const rendement = formaterRendement(place.droide, place.palier);
  const couleur = (paliers.find((p) => p.nom === place.palier) || {}).couleur;
  const carte = construireCarteDroide(place.droide, {
    possede: true, palier: place.palier, couleur
  });
  slot.appendChild(carte);
  slot.insertAdjacentHTML("beforeend",
    '<div class="slot-pied">' +
      '<span class="slot-palier">' + echapperHTML(place.palier) + "</span>" +
      '<span class="slot-rendement">' + (rendement === null ? "—" : echapperHTML(rendement)) + "</span>" +
    "</div>" +
    '<button type="button" class="slot-retirer" title="Retirer">✕</button>');

  slot.querySelector(".slot-retirer").onclick = (e) => {
    e.stopPropagation();
    viderSlot(classe, index);
  };
  slot.onclick = () => ouvrirChoixSlot(classe, index);
  slot.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); slot.onclick(); } };
  return slot;
}

function changerNombreSlots(classe, delta) {
  const r = escouade();
  const cible = Math.min(SLOTS_MAX, Math.max(0, r.slots[classe] + delta));
  // Réduire le nombre d'emplacements perdrait le droïde du dernier : on
  // prévient plutôt que de le retirer en silence.
  if (cible < r.slots[classe]) {
    const occupant = droideDeCle(r.places[classe][cible]);
    if (occupant && !confirm("Le dernier emplacement contient « " + occupant.droide.nom +
        " ». Le retirer quand même ?")) return;
  }
  r.slots[classe] = cible;
  escouade();               // recale le tableau des places
  afficherRendement();
  sauvegarderPerso();
}

function viderSlot(classe, index) {
  const r = escouade();
  r.places[classe][index] = null;
  afficherRendement();
  sauvegarderPerso();
}

// ----- Choix du droïde à placer -----

function ouvrirChoixSlot(classe, index) {
  slotEnCours = { classe, index };
  document.getElementById("titreChoixSlot").textContent = "Emplacement " + (index + 1) + " — " + classe;
  document.getElementById("rechercheSlot").value = "";
  document.getElementById("slotSeulementPossedes").checked = true;
  afficherChoixSlot();
  document.getElementById("voileSlot").classList.add("ouvert");
}

function fermerChoixSlot() {
  document.getElementById("voileSlot").classList.remove("ouvert");
  slotEnCours = null;
}

// Une ligne par combinaison droïde + palier réellement proposable : c'est le
// couple qui détermine le rendement, pas le droïde seul.
function combinaisonsProposables(classe, seulementPossedes) {
  const lignes = [];
  catalogue
    .filter((d) => d.classe === classe)
    .forEach((d) => {
      paliers.forEach((p) => {
        if (!estDisponibleAuPalier(d, p.nom)) return;
        const cle = clePossession(d.id, p.nom);
        const possede = perso.droidesPossedes.includes(cle);
        if (seulementPossedes && !possede) return;
        lignes.push({ droide: d, palier: p.nom, couleur: p.couleur, possede, cle });
      });
    });
  // Le plus rentable d'abord : c'est ce qu'on cherche à placer.
  lignes.sort((a, b) => {
    const ra = totalEscouade([a.cle]).credits;
    const rb = totalEscouade([b.cle]).credits;
    if (rb !== ra) return rb - ra;
    return a.droide.nom.localeCompare(b.droide.nom);
  });
  return lignes;
}

function afficherChoixSlot() {
  if (!slotEnCours) return;
  const recherche = (document.getElementById("rechercheSlot").value || "").trim().toLowerCase();
  const seulement = document.getElementById("slotSeulementPossedes").checked;
  const lignes = combinaisonsProposables(slotEnCours.classe, seulement)
    .filter((l) => !recherche || l.droide.nom.toLowerCase().includes(recherche));

  const liste = document.getElementById("listeChoixSlot");
  document.getElementById("videChoixSlot").style.display = lignes.length ? "none" : "";
  liste.innerHTML = "";

  lignes.forEach((l) => {
    const rendement = formaterRendement(l.droide, l.palier);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "choix-droide";
    item.innerHTML =
      '<span class="choix-pastille" style="background:' + (l.couleur || "transparent") + '"></span>' +
      '<span class="choix-nom">' + echapperHTML(l.droide.nom) +
        '<small>' + echapperHTML(l.palier) + (l.possede ? " · possédé" : "") + "</small></span>" +
      '<span class="badge-rarete ' + classeRareteCss(l.droide.rarete) + '">' + echapperHTML(l.droide.rarete) + "</span>" +
      '<span class="choix-rendement">' + (rendement === null ? "—" : echapperHTML(rendement)) + "</span>";
    item.onclick = () => placerDansSlot(l.cle);
    liste.appendChild(item);
  });
}

function placerDansSlot(cle) {
  if (!slotEnCours) return;
  const r = escouade();
  // Un même droïde-palier ne peut occuper deux emplacements à la fois.
  CLASSES_ESCOUADE.forEach((c) => {
    r.places[c] = r.places[c].map((x) => (x === cle ? null : x));
  });
  r.places[slotEnCours.classe][slotEnCours.index] = cle;
  fermerChoixSlot();
  afficherRendement();
  sauvegarderPerso();
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
