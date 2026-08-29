// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerTout: "Chargement du suivi…",
});

// ===== Droid Fortnite — logique de la page de suivi =====
const token = exigerConnexion(); // redirige vers connexion.html si absent

let catalogue = [];
let renaissance = [];
let fusions = [];
let paliers = PALIERS_INITIAUX; // remplacé par le contenu réel de paliers.json au chargement
// droidesPossedes : tableau de clés "<idDroide>::<palier>" — chaque droïde
// peut être possédé indépendamment à CHAQUE palier (Défaut, Or, Diamant...),
// comme dans le jeu (le compteur du jeu compte chaque palier séparément).
let perso = { droidesPossedes: [], renaissanceAtteinte: {}, rendement: null };
let superActif = 0;   // super renaissance affichée dans l'onglet Renaissance
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
  document.getElementById("zoneFusion").style.display = type === "fusion" ? "" : "none";
  if (type === "rendement") afficherRendement();
  if (type === "fusion") afficherFusion();
  // Le recadrage attend l'ouverture de l'onglet : tant qu'il est masqué, ses
  // paliers n'ont pas de position à l'écran.
  if (type === "renaissance") recadrerSurPalierCourant();
}

if (token) {
  // Le catalogue, les paliers et les renaissances se gèrent dans admin.html :
  // cette page ne fait que suivre la progression. Seul le lien vers le
  // gestionnaire est réservé aux admins du portail central.
  if (estAdminCentral()) document.getElementById("lienAdmin").style.display = "";
  chargerTout();
}

async function chargerTout() {
  try {
    const [rCatalogue, rRenaissance, rFusions, rPaliers, rUnites, rRaretes] = await Promise.all([
      chargerOuAmorcer("catalogue.json", CATALOGUE_INITIAL, token, "Amorçage du catalogue de droïdes"),
      chargerOuAmorcer("renaissance.json", RENAISSANCE_INITIALE, token, "Amorçage des paliers de renaissance"),
      chargerOuAmorcer("fusions.json", FUSIONS_INITIALES, token, "Amorçage des recettes de fusion"),
      chargerOuAmorcer("paliers.json", PALIERS_INITIAUX, token, "Amorçage de la liste des paliers"),
      chargerOuAmorcer("unites.json", UNITES_INITIALES, token, "Amorçage des unités de grandeur"),
      chargerOuAmorcer("raretes.json", RARETES_INITIALES, token, "Amorçage des couleurs de rareté"),
      chargerBibliothequePerso()
    ]);
    catalogue = Array.isArray(rCatalogue.contenu) ? rCatalogue.contenu : [];
    renaissance = Array.isArray(rRenaissance.contenu) ? rRenaissance.contenu : [];
    fusions = Array.isArray(rFusions.contenu) ? rFusions.contenu : [];
    const paliersCharges = normaliserPaliers(rPaliers.contenu);
    paliers = paliersCharges.length ? paliersCharges : PALIERS_INITIAUX;
    palierActif = paliers[0].nom;
    const unitesChargees = normaliserUnites(rUnites.contenu);
    unites = unitesChargees.length ? unitesChargees : UNITES_INITIALES;
    raretes = normaliserRaretes(rRaretes.contenu);
    appliquerCouleursRaretes();
    // Les deux listes déroulantes suivent la liste des raretés, qui peut
    // s'allonger depuis le panneau admin.
    remplirSelectRaretes(document.getElementById("filtreRarete"), "", "Toutes les raretés");
    remplirSelectRaretes(document.getElementById("champDroideRarete"), raretes[0] && raretes[0].nom);
  } catch (e) {
    document.getElementById("chargement").innerHTML =
      `<p style="color:var(--danger);text-align:center">${echapperHTML(e.message)}</p>`;
    return;
  }

  // Même ordre que le panneau admin : rangé par rareté (faible -> fort).
  catalogue = trierCatalogueParRarete(catalogue);
  construireOngletsPalier();
  document.getElementById("chargement").style.display = "none";
  document.getElementById("zoneDroidex").style.display = "";
  afficherDroidex();
  afficherRendement();
  construireOngletsSuper();
  afficherRenaissance();
}

// Onglet « Tous » : affiche chaque droïde à chacun de ses paliers, comme
// autant de cartes. La valeur ne peut pas être un nom de palier réel — on
// prend un caractère qu'un nom ne contiendra jamais.
const TOUS_PALIERS = "*";

function construireOngletsPalier() {
  const zone = document.getElementById("ongletsPalier");
  zone.innerHTML = "";

  const ajouter = (valeur, libelle) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "onglet-palier" + (valeur === palierActif ? " actif" : "");
    bouton.dataset.palier = valeur;
    bouton.textContent = libelle;
    bouton.addEventListener("click", () => changerPalierActif(valeur));
    zone.appendChild(bouton);
  };

  ajouter(TOUS_PALIERS, "Tous");
  paliers.forEach((p) => ajouter(p.nom, p.nom));
}

function changerPalierActif(nom) {
  palierActif = nom;
  // Comparaison sur dataset et non sur le libellé : « Tous » n'est pas un
  // nom de palier.
  document.querySelectorAll(".onglet-palier").forEach((b) =>
    b.classList.toggle("actif", b.dataset.palier === nom));
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
      renaissanceAtteinte: progressionParSuper(contenu && contenu.renaissanceAtteinte),
      rendement: (contenu && contenu.rendement) || null
    };
    shaPerso = sha;
  } catch (e) {
    if (e.status !== 404) throw e;
    perso = { droidesPossedes: [], renaissanceAtteinte: {}, rendement: null };
    shaPerso = null;
  }
}

// ===== Enregistrement de la progression =====
//
// Chaque écriture est un COMMIT sur le dépôt BDD. Enregistrer à chaque clic
// faisait donc un commit par droïde coché : cocher un palier entier en
// produisait soixante-dix, et l'historique grossissait au point que GitHub
// peinait à l'afficher (« Cannot retrieve latest commit at this time »).
//
// Les modifications sont donc regroupées : on attend une courte pause, puis
// on écrit une seule fois. Cinquante clics d'affilée ne font plus qu'un
// commit.
const DELAI_SAUVEGARDE = 2000;

let sauvegardeProgrammee = null;   // minuteur en cours
let sauvegardeEnCours = null;      // écriture en vol
let modificationsEnAttente = false;

// Appelée à chaque changement : ne fait que programmer l'écriture.
function marquerProgressionModifiee() {
  modificationsEnAttente = true;
  clearTimeout(sauvegardeProgrammee);
  sauvegardeProgrammee = setTimeout(sauvegarderPerso, DELAI_SAUVEGARDE);
}

// Fichier personnel : un seul écrivain légitime (le compte lui-même), donc un
// simple retry (relire le sha, réécrire l'état local) suffit — pas besoin de
// la fusion utilisée pour les fichiers partagés.
async function sauvegarderPerso() {
  clearTimeout(sauvegardeProgrammee);
  if (!modificationsEnAttente) return;
  // Une écriture est déjà en vol : on la laisse finir, puis on repart pour
  // celle-ci — sans quoi deux PUT concurrents se disputeraient le même sha.
  if (sauvegardeEnCours) {
    await sauvegardeEnCours.catch(() => {});
    return sauvegarderPerso();
  }
  modificationsEnAttente = false;

  sauvegardeEnCours = (async () => {
    try {
      shaPerso = await ecrireFichierJSON(cheminBibliothequeCourante(), perso, shaPerso, token, "Mise à jour de la progression");
    } catch (e) {
      if (e.conflit) {
        const frais = await lireFichierJSON(cheminBibliothequeCourante(), token);
        shaPerso = await ecrireFichierJSON(cheminBibliothequeCourante(), perso, frais.sha, token, "Mise à jour de la progression");
      } else {
        // L'état local reste marqué modifié : la prochaine occasion réessaiera.
        modificationsEnAttente = true;
        afficherToast(e.message, true);
      }
    }
  })();

  try { await sauvegardeEnCours; } finally { sauvegardeEnCours = null; }
}

// Filets de sécurité : quitter la page ou masquer l'onglet écrit tout de
// suite ce qui attend, et l'on prévient si l'écriture n'a pas encore abouti.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) sauvegarderPerso();
});
window.addEventListener("pagehide", () => { sauvegarderPerso(); });
window.addEventListener("beforeunload", (e) => {
  if (modificationsEnAttente || sauvegardeEnCours) {
    e.preventDefault();
    e.returnValue = "";
  }
});

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
// Les combinaisons affichées : un couple droïde + palier par carte. Sur un
// palier donné il y en a une par droïde ; sur « Tous », une par palier où le
// droïde existe — c'est le couple qui porte la possession, le prix et le
// rendement.
function combinaisonsDroidex() {
  const nomsPaliers = palierActif === TOUS_PALIERS ? paliers.map((p) => p.nom) : [palierActif];
  const combos = [];
  nomsPaliers.forEach((nomPalier) => {
    const couleur = (paliers.find((p) => p.nom === nomPalier) || {}).couleur;
    catalogue.forEach((d) => {
      if (estDisponibleAuPalier(d, nomPalier)) combos.push({ droide: d, palier: nomPalier, couleur });
    });
  });
  return combos;
}

function afficherDroidex() {
  const recherche = (document.getElementById("champRecherche").value || "").trim().toLowerCase();
  const filtreClasse = document.getElementById("filtreClasse").value;
  const filtreRarete = document.getElementById("filtreRarete").value;
  const filtrePossede = document.getElementById("filtrePossede").value;

  const disponibles = combinaisonsDroidex();

  const filtres = disponibles.filter((c) => {
    const d = c.droide;
    if (recherche && !d.nom.toLowerCase().includes(recherche)) return false;
    if (filtreClasse && d.classe !== filtreClasse) return false;
    if (filtreRarete && d.rarete !== filtreRarete) return false;
    const possede = perso.droidesPossedes.includes(clePossession(d.id, c.palier));
    if (filtrePossede === "oui" && !possede) return false;
    if (filtrePossede === "non" && possede) return false;
    return true;
  });

  const grille = document.getElementById("grilleDroidex");
  const vide = document.getElementById("videDroidex");
  grille.innerHTML = "";
  vide.style.display = filtres.length ? "none" : "";

  filtres.forEach((c) => {
    const possede = perso.droidesPossedes.includes(clePossession(c.droide.id, c.palier));
    // Le contour prend la couleur du palier de LA CARTE : sur « Tous », elles
    // ne partagent pas le même.
    const carte = construireCarteDroide(c.droide, {
      possede, couleur: c.couleur, palier: c.palier
    });
    carte.setAttribute("role", "button");
    carte.setAttribute("aria-pressed", possede ? "true" : "false");
    // Sur « Tous », le palier n'est pas déductible de la carte : on l'étiquette.
    if (palierActif === TOUS_PALIERS) {
      carte.insertAdjacentHTML("beforeend",
        '<span class="etiquette-palier">' + echapperHTML(c.palier) + "</span>");
    }
    carte.addEventListener("click", () => basculerPossession(c.droide.id, c.palier));
    grille.appendChild(carte);
  });

  const total = disponibles.length;
  const possedes = disponibles.filter((c) =>
    perso.droidesPossedes.includes(clePossession(c.droide.id, c.palier))).length;
  const pct = total ? Math.round((possedes / total) * 100) : 0;
  document.getElementById("compteurDroidex").innerHTML =
    `<b>${possedes} / ${total}</b> ` +
    (palierActif === TOUS_PALIERS ? "tous paliers confondus" : `au palier ${echapperHTML(palierActif)}`) +
    `<div class="barre-progression"><span style="width:${pct}%"></span></div>`;
}

// Le palier est passé explicitement : sur l'onglet « Tous », palierActif ne
// désigne aucun palier réel.
function basculerPossession(idDroide, palier) {
  const cle = clePossession(idDroide, palier);
  const index = perso.droidesPossedes.indexOf(cle);
  if (index === -1) perso.droidesPossedes.push(cle);
  else perso.droidesPossedes.splice(index, 1);
  afficherDroidex();
  marquerProgressionModifiee();
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
  // Les Iconiques majorent le revenu total d'un pourcentage : on l'applique
  // à la somme des droïdes qui produisent des crédits.
  const effectif = credits * (1 + pourcentage / 100);
  return { credits, pourcentage, inconnus, effectif };
}

// Les rendements sont saisis et stockés par SECONDE, comme le jeu les
// affiche. À l'échelle d'une session, l'heure parle davantage : SEUL le
// rendement total la met en avant, en gardant la seconde à côté pour pouvoir
// recouper avec le jeu. Les sections et les cartes restent par seconde.
const SECONDES_PAR_HEURE = 3600;

function texteParHeure(creditsParSeconde) {
  return formaterCredits(arrondirCredits(creditsParSeconde * SECONDES_PAR_HEURE)) + "/h";
}

// Total global : le pourcentage des Iconiques est APPLIQUÉ, et le détail du
// calcul reste affiché — sans quoi on ne saurait pas d'où sort le chiffre.
function texteTotal(t) {
  const morceaux = [];
  morceaux.push("<b>" + texteParHeure(t.effectif) + "</b>");
  morceaux.push('<span class="total-seconde">' +
    formaterCredits(arrondirCredits(t.effectif)) + "/s</span>");
  if (t.pourcentage) {
    morceaux.push('<span class="total-detail">' + formaterCredits(arrondirCredits(t.credits)) +
      "/s + " + (Math.round(t.pourcentage * 100) / 100) + " %</span>");
  }
  if (t.inconnus) {
    morceaux.push('<span class="total-inconnu">' + t.inconnus +
      " sans rendement renseigné</span>");
  }
  return morceaux.join(" ");
}

// Total d'une section : le pourcentage ne s'y applique pas — il porte sur le
// revenu TOTAL, pas sur celui de la classe. On indique donc ce que la section
// apporte, et à part ce qu'elle contribue en pourcentage.
function texteTotalSection(t) {
  const morceaux = [];
  // Par seconde ici, comme les cartes : seul le rendement TOTAL est mis en
  // avant à l'heure, l'échelle à laquelle on compare des escouades.
  morceaux.push("<b>" + formaterCredits(arrondirCredits(t.credits)) + "/s</b>");
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

// Une majoration donne vite des décimales sans intérêt (278399.99…) :
// on arrondit avant d'abréger.
function arrondirCredits(n) {
  if (!isFinite(n)) return 0;
  return Math.abs(n) >= 1000 ? Math.round(n) : Math.round(n * 100) / 100;
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
        '<span class="total-section">' + texteTotalSection(total) + "</span>" +
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
  marquerProgressionModifiee();
}

function viderSlot(classe, index) {
  const r = escouade();
  r.places[classe][index] = null;
  afficherRendement();
  marquerProgressionModifiee();
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
        const dejaPlaces = CLASSES_ESCOUADE
          .reduce((n, c) => n + (perso.rendement && perso.rendement.places[c] || [])
            .filter((x) => x === cle).length, 0);
        lignes.push({ droide: d, palier: p.nom, couleur: p.couleur, possede, cle, dejaPlaces });
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
      '<span class="choix-pastille" style="background:' + fondPalier(l.couleur) + '"></span>' +
      '<span class="choix-nom">' + echapperHTML(l.droide.nom) +
        '<small>' + echapperHTML(l.palier) + (l.possede ? " · possédé" : "") +
          (l.dejaPlaces ? " · déjà placé " + l.dejaPlaces + "×" : "") + "</small></span>" +
      '<span class="badge-rarete ' + classeRareteCss(l.droide.rarete) + '">' + echapperHTML(l.droide.rarete) + "</span>" +
      '<span class="choix-rendement">' + (rendement === null ? "—" : echapperHTML(rendement)) + "</span>";
    item.onclick = () => placerDansSlot(l.cle);
    liste.appendChild(item);
  });
}

function placerDansSlot(cle) {
  if (!slotEnCours) return;
  const r = escouade();
  // Un même droïde peut occuper plusieurs emplacements : on en possède
  // souvent plusieurs exemplaires, et rien n'empêche d'en aligner deux.
  r.places[slotEnCours.classe][slotEnCours.index] = cle;
  fermerChoixSlot();
  afficherRendement();
  marquerProgressionModifiee();
}

// ===== Onglet Renaissance =====

// ----- Garder ou vendre ? -----
//
// Une fois un palier fait, un droïde ne sert plus à rien s'il n'est demandé
// par aucun palier suivant : autant le vendre. Encore faut-il le savoir sans
// relire les trente-quatre paliers restants un par un.
//
// On raisonne sur le DROÏDE, pas sur le couple droïde+palier : un droïde
// redemandé plus loin à un palier supérieur se garde et s'améliore, il ne se
// rachète pas.
function besoinsUlterieurs() {
  const parDroide = new Map();   // id -> [{ niveau, palier }, …]
  renaissance.forEach((r) => {
    analyserElementsRenaissance(elementsPourSuper(r, superActif)).forEach((e) => {
      if (!e.droide) return;
      if (!parDroide.has(e.droide.id)) parDroide.set(e.droide.id, []);
      parDroide.get(e.droide.id).push({ niveau: r.niveau, palier: e.palier });
    });
  });
  parDroide.forEach((liste) => liste.sort((a, b) => a.niveau - b.niveau));
  return parDroide;
}

// Le droïde est-il posé dans l'escouade ? Le vendre y ferait un trou : on le
// signale, sans pour autant cacher qu'il ne sert plus aux renaissances.
function poseDansEscouade(idDroide) {
  const r = escouade();
  return CLASSES_ESCOUADE.some((c) => r.places[c].some((cle) => {
    const d = cle && droideDeCle(cle);
    return d && d.droide && d.droide.id === idDroide;
  }));
}

function marqueurUtilite(droide, niveauCourant, besoins) {
  const suite = (besoins.get(droide.id) || []).filter((b) => b.niveau > niveauCourant);
  if (suite.length) {
    return '<span class="element-utilite garder" title="' +
      echapperHTML("À garder : encore requis au palier " + suite[0].niveau +
                   " (" + suite[0].palier + ")") + '">🔒</span>';
  }
  if (poseDansEscouade(droide.id)) {
    return '<span class="element-utilite reserve" title="' +
      echapperHTML("Plus requis par les renaissances, mais posé dans ton rendement") +
      '">💰</span>';
  }
  return '<span class="element-utilite vendable" title="' +
    echapperHTML("Vendable : aucun palier suivant ne le demande") + '">💰</span>';
}

function construireElementsRenaissance(texte, niveauCourant, besoins) {
  const zone = document.createElement("div");
  zone.className = "elements-renaissance";
  const elements = analyserElementsRenaissance(texte);

  if (!elements.length) {
    zone.innerHTML = '<p class="renaissance-elements">Aucun droïde indiqué.</p>';
    return zone;
  }

  elements.forEach((e) => {
    if (!e.droide) {
      // Nom introuvable au catalogue : on garde le texte, visible et corrigeable.
      zone.insertAdjacentHTML("beforeend",
        '<span class="element-inconnu" title="Ce nom ne correspond à aucun droïde du catalogue">' +
        echapperHTML(e.texte) + "</span>");
      return;
    }
    const couleur = (paliers.find((p) => p.nom === e.palier) || {}).couleur;
    const enveloppe = document.createElement("div");
    enveloppe.className = "element-renaissance";
    enveloppe.title = e.droide.nom + " — " + e.palier;
    // On montre CE QU'IL FAUT, pas ce qu'on possède déjà : « possede » ne sert
    // donc qu'à afficher la carte en pleine lumière, et sa case à cocher est
    // masquée (voir style.css) puisqu'elle n'aurait rien à dire ici.
    enveloppe.appendChild(construireCarteDroide(e.droide, { possede: true, couleur, palier: e.palier }));
    enveloppe.insertAdjacentHTML("beforeend", marqueurUtilite(e.droide, niveauCourant, besoins));
    enveloppe.insertAdjacentHTML("beforeend",
      '<span class="element-palier">' + echapperHTML(e.palier) + "</span>");
    zone.appendChild(enveloppe);
  });
  return zone;
}

// Progression de la super renaissance affichée. Le tableau est créé à la
// volée : une super renaissance jamais entamée n'a pas d'entrée en base.
function atteintsSuper() {
  if (!perso.renaissanceAtteinte || typeof perso.renaissanceAtteinte !== "object" ||
      Array.isArray(perso.renaissanceAtteinte)) {
    perso.renaissanceAtteinte = progressionParSuper(perso.renaissanceAtteinte);
  }
  if (!Array.isArray(perso.renaissanceAtteinte[superActif])) {
    perso.renaissanceAtteinte[superActif] = [];
  }
  return perso.renaissanceAtteinte[superActif];
}

function construireOngletsSuper() {
  const zone = document.getElementById("ongletsSuper");
  const nb = nombreSuperRenaissances(renaissance);
  // Une seule super renaissance décrite : le sélecteur n'apprend rien.
  if (nb <= 1) { zone.innerHTML = ""; zone.style.display = "none"; return; }
  zone.style.display = "";
  zone.innerHTML = "";
  for (let n = 0; n < nb; n++) {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "onglet-palier" + (n === superActif ? " actif" : "");
    bouton.dataset.super = String(n);
    bouton.textContent = n === 0 ? "Avant super" : "Super " + n;
    bouton.addEventListener("click", () => changerSuperActif(n));
    zone.appendChild(bouton);
  }
}

function changerSuperActif(n) {
  superActif = n;
  paliersDeplies = new Set();
  document.querySelectorAll("#ongletsSuper .onglet-palier").forEach((b) =>
    b.classList.toggle("actif", Number(b.dataset.super) === n));
  afficherRenaissance({ recadrer: true });
}

// Paliers repliés à la main, en plus de ceux qui le sont d'office parce
// qu'ils sont validés. Réinitialisé à chaque changement de super renaissance.
let paliersDeplies = new Set();

// Trente-cinq paliers déroulés en entier, c'est un écran de défilement rien
// que pour retrouver où l'on en est. Un palier validé se replie donc sur son
// en-tête ; on peut le rouvrir d'un clic pour revoir ce qu'il demandait.
function estReplie(r, atteint) {
  return atteint && !paliersDeplies.has(r.id);
}

function afficherRenaissance(options) {
  const tries = renaissance.slice().sort((a, b) => a.niveau - b.niveau);
  const liste = document.getElementById("listeRenaissance");
  liste.innerHTML = "";
  const besoins = besoinsUlterieurs();

  tries.forEach((r) => {
    const atteint = atteintsSuper().includes(r.id);
    const replie = estReplie(r, atteint);
    const item = document.createElement("div");
    item.className = "item-renaissance" + (atteint ? " atteint" : "") + (replie ? " replie" : "");
    item.innerHTML =
      `<div class="renaissance-entete">` +
        `<div class="renaissance-niveau">${r.niveau}</div>` +
        `<div class="renaissance-titre">` +
          `<strong>Palier ${r.niveau}</strong>` +
          `<small>${formaterCredits(r.credits)} crédits</small>` +
        `</div>` +
        (atteint
          ? `<button type="button" class="renaissance-plier" aria-expanded="${replie ? "false" : "true"}" ` +
            `title="${replie ? "Revoir les droïdes requis" : "Replier ce palier"}">▾</button>`
          : "") +
        `<input type="checkbox" class="renaissance-case" ${atteint ? "checked" : ""}>` +
      `</div>`;

    if (!replie) {
      item.appendChild(construireElementsRenaissance(
        elementsPourSuper(r, superActif), r.niveau, besoins));
    }
    item.querySelector(".renaissance-case").addEventListener("change", () => basculerAtteint(r.id));

    const plier = item.querySelector(".renaissance-plier");
    if (plier) {
      plier.addEventListener("click", () => {
        if (paliersDeplies.has(r.id)) paliersDeplies.delete(r.id);
        else paliersDeplies.add(r.id);
        afficherRenaissance();
      });
    }
    liste.appendChild(item);
  });

  if (options && options.recadrer) recadrerSurPalierCourant();

  const total = renaissance.length;
  const atteints = atteintsSuper().length;
  const pct = total ? Math.round((atteints / total) * 100) : 0;
  document.getElementById("compteurRenaissance").innerHTML =
    `<b>${atteints} / ${total}</b>` +
    `<div class="barre-progression"><span style="width:${pct}%"></span></div>` +
    `<button type="button" class="btn-decocher" ${atteints ? "" : "disabled"}` +
    ` title="Décocher tous les paliers de cette super renaissance">Tout décocher</button>`;
  const decocher = document.querySelector("#compteurRenaissance .btn-decocher");
  if (decocher) decocher.addEventListener("click", toutDecocherRenaissance);
}

// Amène le premier palier non validé sous les yeux. Replier ceux du dessus
// fait remonter tout ce qui suit : sans cela, on se retrouve à regarder un
// palier au hasard, plus bas dans la liste.
function recadrerSurPalierCourant() {
  const courant = document.querySelector(".item-renaissance:not(.atteint)");
  if (!courant) return;
  courant.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Une super renaissance remet la progression à zéro : décocher trente-cinq
// paliers un par un serait absurde. Le bouton ne touche QUE la super
// renaissance affichée — les autres gardent la leur.
function toutDecocherRenaissance() {
  const liste = atteintsSuper();
  if (!liste.length) return;
  const message = liste.length === 1
    ? "Décocher le palier validé de cette super renaissance ?"
    : "Décocher les " + liste.length + " paliers validés de cette super renaissance ?";
  if (!window.confirm(message)) return;
  liste.length = 0;
  paliersDeplies = new Set();
  afficherRenaissance({ recadrer: true });
  marquerProgressionModifiee();
}

function basculerAtteint(idRenaissance) {
  const liste = atteintsSuper();
  const index = liste.indexOf(idRenaissance);
  if (index === -1) {
    liste.push(idRenaissance);
    // Un palier qu'on rouvre puis qu'on valide n'a plus de raison de rester
    // déplié : il se replie comme les autres.
    paliersDeplies.delete(idRenaissance);
  } else {
    liste.splice(index, 1);
  }
  afficherRenaissance({ recadrer: true });
  marquerProgressionModifiee();
}

// ===== Onglet Fusion =====
// Lecture seule : on montre les recettes (résultat + ingrédients), groupées
// par rareté du résultat. C'est de la référence, pas de la progression.
function afficherFusion() {
  const liste = document.getElementById("listeFusion");
  const vide = document.getElementById("videFusion");
  liste.innerHTML = "";
  const recettes = Array.isArray(fusions) ? fusions : [];
  vide.style.display = recettes.length ? "none" : "";
  if (!recettes.length) return;

  // Groupées par rareté, dans l'ordre des raretés (faible -> fort). Une rareté
  // absente du fichier des raretés est reléguée en fin, sous son propre nom.
  const ordre = raretes.map((r) => r.nom);
  const groupes = new Map();
  recettes.forEach((f) => {
    const cle = f.rarete || "—";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(f);
  });
  const clesTriees = [...groupes.keys()].sort((a, b) => {
    const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  clesTriees.forEach((rarete) => {
    const section = document.createElement("section");
    section.className = "section-fusion";
    section.innerHTML =
      '<h3 class="titre-fusion">' +
        '<span class="badge-rarete ' + classeRareteCss(rarete) + '">' + echapperHTML(rarete) + "</span>" +
        ' <span class="titre-fusion-suffixe">— fusions</span>' +
      "</h3>";
    const zone = document.createElement("div");
    zone.className = "grille-recettes";
    groupes.get(rarete).forEach((f) => zone.appendChild(construireRecetteFusion(f)));
    section.appendChild(zone);
    liste.appendChild(section);
  });
}

function construireRecetteFusion(f) {
  const recette = document.createElement("div");
  recette.className = "recette-fusion";

  // Le résultat porte les champs d'un droïde : on réutilise la carte du Droidex.
  const resultat = document.createElement("div");
  resultat.className = "recette-resultat";
  resultat.appendChild(construireCarteDroide(f, { possede: true, palier: paliers[0] && paliers[0].nom }));
  recette.appendChild(resultat);

  const egale = document.createElement("div");
  egale.className = "recette-egale";
  egale.setAttribute("aria-label", "obtenu avec");
  egale.textContent = "=";
  recette.appendChild(egale);

  const ingredients = document.createElement("div");
  ingredients.className = "recette-ingredients";
  const liste = normaliserIngredients(f.ingredients);
  if (!liste.length) {
    ingredients.innerHTML = '<p class="renaissance-elements">Aucun ingrédient indiqué.</p>';
  } else {
    liste.forEach((ing) => ingredients.appendChild(construireIngredientFusion(ing)));
  }
  recette.appendChild(ingredients);
  return recette;
}

function construireIngredientFusion(ing) {
  const enveloppe = document.createElement("div");
  enveloppe.className = "ingredient-fusion";
  const droide = droideParNom(ing.nom);
  if (droide) {
    enveloppe.appendChild(construireCarteDroide(droide, { possede: true, palier: paliers[0] && paliers[0].nom }));
  } else {
    const inconnu = document.createElement("div");
    inconnu.className = "element-inconnu";
    inconnu.textContent = ing.nom;
    inconnu.title = "Ce nom ne correspond à aucun droïde du catalogue";
    enveloppe.appendChild(inconnu);
  }
  if (ing.quantite > 1) {
    const q = document.createElement("span");
    q.className = "badge-quantite";
    q.textContent = "×" + ing.quantite;
    enveloppe.appendChild(q);
  }
  return enveloppe;
}
