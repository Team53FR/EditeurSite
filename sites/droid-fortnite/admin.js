// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerDonnees: "Chargement des données…",
  enregistrerDroideAdmin: ["Enregistrement du droïde…", "Si vous avez choisi une icône, elle part aussi."],
  supprimerDroide: "Suppression du droïde…",
  sauvegarderPaliers: "Enregistrement des paliers…",
  sauvegarderUnites: "Enregistrement des unités…",
  sauvegarderRaretes: "Enregistrement des raretés…",
  sauvegarderRenaissanceAdmin: "Enregistrement des renaissances…",
  sauvegarderFusionAdmin: "Enregistrement des fusions…",
});

// Panneau de gestion Droid Fortnite (réservé aux admins du portail central —
// voir exigerAdminDroidFortnite() dans script.js).

const token = exigerAdminDroidFortnite();

let catalogue = [];
let shaCatalogue = null;
let paliers = [];
let shaPaliers = null;
let shaUnites = null;
let shaRaretes = null;
let renaissance = [];
let shaRenaissance = null;
let fusions = [];
let shaFusions = null;
let superEdite = 0;   // super renaissance dont on edite les droides
let modeEditionId = null; // id du droïde en cours de modification, ou null (mode ajout)
const cacheImages = new Map(); // chemin GitHub -> URL locale (blob:)

// État du formulaire pour l'icône, en attente d'enregistrement (pas encore
// envoyée tant qu'on ne valide pas le formulaire).
let dataUrlImageAdmin = null;
let imageSupprimeeAdmin = false;

function echapper(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function iconePlaceholderDroideAdmin() {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
}

function declencherChoixImageAdmin(source) {
  document.getElementById(source === "camera" ? "champImageCameraAdmin" : "champImageGalerieAdmin").click();
}

async function imageChoisieAdmin(event) {
  const fichier = event.target.files[0];
  event.target.value = "";
  if (!fichier) return;
  try {
    const dataUrl = await comprimerImage(fichier);
    dataUrlImageAdmin = dataUrl;
    imageSupprimeeAdmin = false;
    document.getElementById("apercuDroideAdmin").innerHTML = `<img src="${dataUrl}" alt="">`;
    document.getElementById("boutonSupprimerImageAdmin").style.display = "block";
  } catch (e) {
    document.getElementById("messageDroideAdmin").textContent = "Impossible de charger cette image.";
  }
}

function retirerImageAdmin() {
  dataUrlImageAdmin = null;
  imageSupprimeeAdmin = true;
  document.getElementById("apercuDroideAdmin").innerHTML = iconePlaceholderDroideAdmin();
  document.getElementById("boutonSupprimerImageAdmin").style.display = "none";
}

// ===== Onglets (Droïdes / Ajouter / Paliers / Renaissance / Unités / Raretés) =====
let ongletAdminActif = "droides";

function changerOngletAdmin(type) {
  ongletAdminActif = type;
  document.querySelectorAll(".onglet-type").forEach((b) => b.classList.toggle("actif", b.dataset.type === type));
  document.getElementById("zoneDroides").style.display = type === "droides" ? "" : "none";
  document.getElementById("zoneAjout").style.display = type === "ajout" ? "" : "none";
  document.getElementById("zonePaliers").style.display = type === "paliers" ? "" : "none";
  document.getElementById("zoneRenaissance").style.display = type === "renaissance" ? "" : "none";
  if (type === "renaissance") preparerAjoutRenaissance();
  document.getElementById("zoneFusion").style.display = type === "fusion" ? "" : "none";
  if (type === "fusion") afficherFusionAdmin();
  document.getElementById("zoneUnites").style.display = type === "unites" ? "" : "none";
  document.getElementById("zoneRaretes").style.display = type === "raretes" ? "" : "none";
}

// Clic sur l'onglet « Ajouter » : repart toujours d'un formulaire vide (pour
// modifier un droïde existant, on passe par sa carte dans l'onglet Droïdes).
function ouvrirOngletAjout() {
  annulerEditionDroide();
  changerOngletAdmin("ajout");
}

if (token) {
  chargerDonnees();
}

async function chargerDonnees() {
  const message = document.getElementById("messageDroideAdmin");
  try {
    const [rCatalogue, rPaliers, rUnites, rRaretes, rRenaissance, rFusions] = await Promise.all([
      chargerOuAmorcer("catalogue.json", CATALOGUE_INITIAL, token, "Amorçage du catalogue de droïdes"),
      chargerOuAmorcer("paliers.json", PALIERS_INITIAUX, token, "Amorçage de la liste des paliers"),
      chargerOuAmorcer("unites.json", UNITES_INITIALES, token, "Amorçage des unités de grandeur"),
      chargerOuAmorcer("raretes.json", RARETES_INITIALES, token, "Amorçage des couleurs de rareté"),
      chargerOuAmorcer("renaissance.json", RENAISSANCE_INITIALE, token, "Amorçage des paliers de renaissance"),
      chargerOuAmorcer("fusions.json", FUSIONS_INITIALES, token, "Amorçage des recettes de fusion")
    ]);
    catalogue = Array.isArray(rCatalogue.contenu) ? rCatalogue.contenu : [];
    shaCatalogue = rCatalogue.sha;
    const paliersCharges = normaliserPaliers(rPaliers.contenu);
    paliers = paliersCharges.length ? paliersCharges : PALIERS_INITIAUX;
    shaPaliers = rPaliers.sha;
    const unitesChargees = normaliserUnites(rUnites.contenu);
    unites = unitesChargees.length ? unitesChargees : UNITES_INITIALES;
    shaUnites = rUnites.sha;
    raretes = normaliserRaretes(rRaretes.contenu);
    shaRaretes = rRaretes.sha;
    appliquerCouleursRaretes();
    renaissance = Array.isArray(rRenaissance.contenu) ? rRenaissance.contenu : [];
    shaRenaissance = rRenaissance.sha;
    fusions = Array.isArray(rFusions.contenu) ? rFusions.contenu : [];
    shaFusions = rFusions.sha;
  } catch (e) {
    message.textContent = e.message;
    return;
  }
  // Rangé par rareté dès le chargement : corrige d'emblée un catalogue où des
  // droïdes auraient été ajoutés en fin de liste (avant ce tri à l'ajout).
  catalogue = trierCatalogueParRarete(catalogue);
  remplirSelectRaretes(document.getElementById("champRarete"), raretes[0] && raretes[0].nom);
  afficherDroides();
  afficherPaliers();
  afficherUnites();
  afficherRaretes();
  document.getElementById("champUniteCredits").innerHTML = optionsUnite("", false);
  afficherRenaissanceAdmin();
  afficherFusionAdmin();
}

// ===== Droïdes =====
// Petites cartes (comme le Droidex de suivi.html) plutôt qu'une longue
// liste : avec ~70 droïdes, une liste verticale devient vite illisible.
// Dans l'ordre du catalogue, donc celui du jeu, donc celui du Droidex.
// Cliquer une carte l'ouvre en modification ; le bouton 🗑 dans le coin
// supprime directement (avec confirmation).
function afficherDroides() {
  const grille = document.getElementById("listeDroides");
  grille.innerHTML = "";

  // Ordre du catalogue, tel quel : c'est celui du jeu, donc celui que le
  // Droidex affiche. Retrier par rareté puis par nom donnait une grille qui
  // ne ressemblait à rien de ce qu'on voit en jouant.
  catalogue.forEach((d) => {
    // Le palier « Défaut » sert de référence en admin : c'est celui dont les
    // visuels existent toujours, quel que soit l'avancement d'un compte.
    const carte = construireCarteDroide(d, { admin: true, palier: "Défaut" });
    carte.title = "Modifier";

    carte.addEventListener("click", () => editerDroide(d.id));
    carte.querySelector(".droide-supprimer").addEventListener("click", (e) => {
      e.stopPropagation();
      supprimerDroide(d.id);
    });

    grille.appendChild(carte);
  });
}

// ===== Prix et rendement, une ligne par palier =====
// La grille est reconstruite à chaque ouverture du formulaire : elle suit
// donc automatiquement les paliers ajoutés, renommés ou réordonnés.
//
// Chaque montant se saisit en deux morceaux — un nombre et une unité — mais
// s'enregistre comme UN SEUL nombre en crédits. Saisir « 4K » d'une traite
// donnait une chaîne, que parseFloat lisait comme 4 : le total de l'escouade
// sous-comptait alors d'un facteur mille, en silence.
function optionsUnite(selection, avecPourcent) {
  let html = '<option value="">—</option>';
  unites.forEach((u) => {
    html += '<option value="' + echapper(u.symbole) + '"' +
      (u.symbole === selection ? " selected" : "") + ">" + echapper(u.symbole) + "</option>";
  });
  if (avecPourcent) {
    html += '<option value="' + UNITE_POURCENT + '"' +
      (selection === UNITE_POURCENT ? " selected" : "") + ">" + UNITE_POURCENT + "</option>";
  }
  return html;
}

// Une valeur stockée revient en { valeur, unite } : « 25% » garde son signe,
// un nombre est redécoupé selon la plus grande unité qui lui convient.
function decomposerPourFormulaire(brut) {
  if (brut === null || brut === undefined || brut === "") return { valeur: "", unite: "" };
  const texte = String(brut).trim();
  const pc = texte.match(/^([\d.,]+)\s*%$/);
  if (pc) return { valeur: pc[1].replace(",", "."), unite: UNITE_POURCENT };
  const n = typeof brut === "number" ? brut : parseFloat(texte.replace(",", "."));
  if (!isFinite(n)) return { valeur: texte, unite: "" };
  return decomposerValeur(n);
}

function construireGrillePrixRendement(d) {
  const grille = document.getElementById("grillePrixRendement");
  // La rareté qui compte est celle du formulaire, pas celle déjà enregistrée :
  // sans cela, basculer un droïde en Iconique ne reconstruisait pas la grille.
  const champRarete = document.getElementById("champRarete");
  const rarete = (champRarete && champRarete.value) || (d ? d.rarete : "");
  // Certaines raretés n'existent qu'au premier palier (les Iconiques, et
  // toute rareté marquée comme telle) : inutile de proposer les autres.
  const rarInfo = raretes.find((r) => r.nom === rarete);
  const iconique = !!(rarInfo && rarInfo.premierPalierSeulement);

  grille.innerHTML =
    '<div class="entete-paliers"><span>Palier</span><span>Prix</span><span>Rendement /s</span></div>';

  // Un Iconique n'existe qu'au premier palier : inutile de proposer les autres.
  const lignes = paliers.filter((p) => estDisponibleAuPalier({ rarete }, p.nom));

  lignes.forEach((p) => {
    const ligne = document.createElement("div");
    ligne.className = "ligne-palier";
    const prix = decomposerPourFormulaire(d ? valeurPalier(d.prix, p.nom) : null);
    // Les Iconiques rapportent un pourcentage du revenu total : c'est l'unité
    // qu'on leur propose d'emblée.
    const rdt = decomposerPourFormulaire(d ? valeurPalier(d.rendements, p.nom) : null);
    if (iconique && !rdt.unite) rdt.unite = UNITE_POURCENT;

    ligne.innerHTML =
      '<span class="nom-palier">' +
        '<span class="pastille-palier" style="background:' + fondPalier(p.couleur) + '"></span>' +
        echapper(p.nom) +
      "</span>" +
      '<span class="duo-valeur">' +
        '<input type="text" inputmode="decimal" data-palier="' + echapper(p.nom) + '" data-champ="prix" ' +
          'value="' + echapper(prix.valeur) + '" placeholder="—" aria-label="Prix au palier ' + echapper(p.nom) + '">' +
        '<select data-palier="' + echapper(p.nom) + '" data-unite="prix" aria-label="Unité du prix au palier ' + echapper(p.nom) + '">' +
          optionsUnite(prix.unite, false) +
        "</select>" +
      "</span>" +
      '<span class="duo-valeur">' +
        '<input type="text" inputmode="decimal" data-palier="' + echapper(p.nom) + '" data-champ="rendement" ' +
          'value="' + echapper(rdt.valeur) + '" placeholder="—" aria-label="Rendement au palier ' + echapper(p.nom) + '">' +
        '<select data-palier="' + echapper(p.nom) + '" data-unite="rendement" aria-label="Unité du rendement au palier ' + echapper(p.nom) + '">' +
          optionsUnite(rdt.unite, true) +
        "</select>" +
      "</span>";
    grille.appendChild(ligne);
  });

  const note = document.getElementById("noteIconique");
  if (note) note.style.display = iconique ? "" : "none";
}

// Relit la grille : deux tables indexées par nom de palier, sans les cases
// laissées vides (inutile d'alourdir le catalogue de valeurs nulles).
function lireGrillePrixRendement() {
  const prix = {};
  const rendements = {};
  document.querySelectorAll('#grillePrixRendement input[data-champ]').forEach((input) => {
    const palier = input.dataset.palier;
    const champ = input.dataset.champ;
    const select = document.querySelector(
      '#grillePrixRendement select[data-palier="' + CSS.escape(palier) + '"][data-unite="' + champ + '"]');
    const valeur = composerValeur(input.value, select ? select.value : "");
    if (valeur === null) return;
    (champ === "prix" ? prix : rendements)[palier] = valeur;
  });
  return { prix, rendements };
}

// Le droïde ouvert dans le formulaire, ou null en mode ajout. Sert à
// reconstruire la grille quand on change la rareté.
function droideEnEdition() {
  return modeEditionId ? (catalogue.find((x) => x.id === modeEditionId) || null) : null;
}

async function editerDroide(id) {
  const d = catalogue.find((x) => x.id === id);
  if (!d) return;
  modeEditionId = id;
  dataUrlImageAdmin = null;
  imageSupprimeeAdmin = false;

  document.getElementById("champNom").value = d.nom;
  document.getElementById("champClasse").value = d.classe;
  document.getElementById("champRarete").value = d.rarete;
  construireGrillePrixRendement(d);
  document.getElementById("titreFormDroide").textContent = "Modifier « " + d.nom + " »";
  document.getElementById("btnEnregistrerDroide").textContent = "Enregistrer les modifications";
  document.getElementById("btnAnnulerDroide").style.display = "";
  document.getElementById("messageDroideAdmin").textContent = "";

  const apercu = document.getElementById("apercuDroideAdmin");
  const boutonRetirer = document.getElementById("boutonSupprimerImageAdmin");
  apercu.innerHTML = iconePlaceholderDroideAdmin();
  boutonRetirer.style.display = d.image ? "block" : "none";
  if (d.image) {
    try {
      let url = cacheImages.get(d.image);
      if (!url) { url = await obtenirUrlImage(d.image, token); cacheImages.set(d.image, url); }
      if (modeEditionId === id) apercu.innerHTML = `<img src="${url}" alt="">`;
    } catch (e) { /* reste sur le placeholder */ }
  }

  changerOngletAdmin("ajout");
  document.getElementById("champNom").focus();
}

function annulerEditionDroide() {
  modeEditionId = null;
  dataUrlImageAdmin = null;
  imageSupprimeeAdmin = false;
  document.getElementById("champNom").value = "";
  document.getElementById("champClasse").value = "Ouvrier";
  document.getElementById("champRarete").value = "Typique";
  construireGrillePrixRendement(null);
  document.getElementById("apercuDroideAdmin").innerHTML = iconePlaceholderDroideAdmin();
  document.getElementById("boutonSupprimerImageAdmin").style.display = "none";
  document.getElementById("titreFormDroide").textContent = "Ajouter un droïde";
  document.getElementById("btnEnregistrerDroide").textContent = "Ajouter";
  document.getElementById("btnAnnulerDroide").style.display = "none";
  document.getElementById("messageDroideAdmin").textContent = "";
}

// Bouton « Annuler » du formulaire : abandonne l'édition et revient à la liste.
function annulerEtRevenir() {
  annulerEditionDroide();
  changerOngletAdmin("droides");
}

function genererId(prefixe) {
  return `${prefixe}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function enregistrerDroideAdmin() {
  const nom = document.getElementById("champNom").value.trim();
  const classe = document.getElementById("champClasse").value;
  const rarete = document.getElementById("champRarete").value;
  const message = document.getElementById("messageDroideAdmin");

  if (!nom) { message.textContent = "Le nom est obligatoire."; return; }

  const id = modeEditionId || genererId("d");
  const ancien = modeEditionId ? catalogue.find((x) => x.id === modeEditionId) : null;

  message.textContent = "Enregistrement...";
  try {
    let cheminImage = ancien ? ancien.image || null : null;
    if (dataUrlImageAdmin) {
      const chemin = `images/${id}.${extraireExtensionDataUrl(dataUrlImageAdmin)}`;
      await uploaderImageBase64(chemin, dataUrlImageAdmin, token, `Icône du droïde ${nom}`);
      if (ancien && ancien.image && ancien.image !== chemin) {
        supprimerFichierGithub(ancien.image, token, "Remplacement de l'icône").catch(() => {});
      }
      cacheImages.delete(chemin);
      cheminImage = chemin;
    } else if (imageSupprimeeAdmin) {
      if (ancien && ancien.image) supprimerFichierGithub(ancien.image, token, "Suppression de l'icône").catch(() => {});
      cheminImage = null;
    }

    const entree = { id, nom, classe, rarete };
    if (cheminImage) entree.image = cheminImage;
    const { prix, rendements } = lireGrillePrixRendement();
    if (Object.keys(prix).length) entree.prix = prix;
    if (Object.keys(rendements).length) entree.rendements = rendements;

    const copieBrute = modeEditionId
      ? catalogue.map((x) => x.id === modeEditionId ? entree : x)
      : catalogue.concat([entree]);
    // Ranger par rareté (faible -> fort) : un droïde ajouté rejoint son groupe
    // au lieu de tomber en fin de liste. Tri STABLE, sans clé secondaire, donc
    // l'ordre du jeu est conservé à l'intérieur d'une même rareté.
    const copie = trierCatalogueParRarete(copieBrute);

    shaCatalogue = await sauvegarderAvecFusion("catalogue.json", copie, shaCatalogue, token,
      modeEditionId ? `Modification du droïde ${nom}` : `Ajout du droïde ${nom}`);
    catalogue = copie;
    annulerEditionDroide();
    afficherDroides();
    changerOngletAdmin("droides");
  } catch (e) {
    message.textContent = e.message;
  }
}

async function supprimerDroide(id) {
  const d = catalogue.find((x) => x.id === id);
  if (!d) return;
  if (!confirm(`Supprimer le droïde « ${d.nom} » du catalogue ?\n\n(La progression déjà enregistrée par les comptes qui le possédaient n'est pas supprimée, juste rendue invisible.)`)) return;

  const message = document.getElementById("messageDroideAdmin");
  const copie = catalogue.filter((x) => x.id !== id);

  try {
    shaCatalogue = await sauvegarderAvecFusion("catalogue.json", copie, shaCatalogue, token, `Suppression du droïde ${d.nom}`);
    catalogue = copie;
    if (d.image) supprimerFichierGithub(d.image, token, "Suppression du droïde associé").catch(() => {});
    if (modeEditionId === id) annulerEditionDroide();
    afficherDroides();
  } catch (e) {
    message.textContent = e.message;
  }
}

// ===== Paliers de variante =====
// La couleur de chaque palier teinte le contour des cartes du Droidex quand
// cet onglet est actif (définie ici, pas par droïde).
function afficherPaliers() {
  const liste = document.getElementById("listePaliers");
  liste.innerHTML = "";

  paliers.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "ligne-item";
    li.innerHTML =
      `<div class="ligne-info">` +
        `<div class="ligne-titre">${index + 1}. ${echapper(p.nom)}</div>` +
        `<div class="apercu-palier" style="background:${fondPalier(p.couleur)}"></div>` +
      `</div>` +
      `<div class="couleurs-palier"></div>` +
      `<div class="ligne-actions"></div>`;

    // Un sélecteur par couleur : à partir de deux, le contour devient un
    // dégradé (c'est ainsi qu'« Arc-en-ciel » en porte plusieurs).
    const couleurs = couleursPalier(p.couleur);
    if (!couleurs.length) couleurs.push("#9ca3af");
    const zoneCouleurs = li.querySelector(".couleurs-palier");

    couleurs.forEach((c, iCouleur) => {
      const enveloppe = document.createElement("span");
      enveloppe.className = "couleur-stop";
      const champ = document.createElement("input");
      champ.type = "color";
      champ.value = c;
      champ.title = couleurs.length > 1 ? `Couleur ${iCouleur + 1} du dégradé` : "Couleur du contour";
      champ.addEventListener("change", () => {
        const suite = couleurs.slice();
        suite[iCouleur] = champ.value;
        changerCouleursPalier(index, suite);
      });
      enveloppe.appendChild(champ);

      if (couleurs.length > 1) {
        const retirer = document.createElement("button");
        retirer.className = "retirer-stop";
        retirer.textContent = "✕";
        retirer.title = "Retirer cette couleur";
        retirer.onclick = () => changerCouleursPalier(index, couleurs.filter((_, i) => i !== iCouleur));
        enveloppe.appendChild(retirer);
      }
      zoneCouleurs.appendChild(enveloppe);
    });

    const ajouter = document.createElement("button");
    ajouter.className = "btn-mini ajouter-stop";
    ajouter.textContent = "＋";
    ajouter.title = "Ajouter une couleur (dégradé)";
    ajouter.onclick = () => changerCouleursPalier(index, couleurs.concat([couleurs[couleurs.length - 1]]));
    zoneCouleurs.appendChild(ajouter);

    const actions = li.querySelector(".ligne-actions");

    const bHaut = document.createElement("button");
    bHaut.className = "btn-mini";
    bHaut.textContent = "↑";
    bHaut.title = "Monter";
    bHaut.disabled = index === 0;
    bHaut.onclick = () => deplacerPalier(index, -1);
    actions.appendChild(bHaut);

    const bBas = document.createElement("button");
    bBas.className = "btn-mini";
    bBas.textContent = "↓";
    bBas.title = "Descendre";
    bBas.disabled = index === paliers.length - 1;
    bBas.onclick = () => deplacerPalier(index, 1);
    actions.appendChild(bBas);

    const bDel = document.createElement("button");
    bDel.className = "btn-mini danger";
    bDel.textContent = "Supprimer";
    bDel.onclick = () => supprimerPalier(index);
    actions.appendChild(bDel);

    liste.appendChild(li);
  });
}

async function sauvegarderPaliers(copie, messageCommit) {
  const message = document.getElementById("messagePaliers");
  message.textContent = "Enregistrement...";
  try {
    shaPaliers = await sauvegarderAvecRetry("paliers.json", copie, shaPaliers, token, messageCommit);
    paliers = copie;
    afficherPaliers();
    message.textContent = "";
  } catch (e) {
    message.textContent = e.message;
  }
}

// Une seule couleur est stockée comme chaîne, plusieurs comme tableau :
// c'est ce que normaliserPaliers() et fondPalier() attendent.
function changerCouleursPalier(index, couleurs) {
  const nettoyees = couleurs.filter(Boolean);
  const copie = paliers.slice();
  copie[index] = Object.assign({}, copie[index], {
    couleur: nettoyees.length > 1 ? nettoyees : (nettoyees[0] || null)
  });
  sauvegarderPaliers(copie, `Couleurs du palier ${copie[index].nom}`);
}

function ajouterPalier() {
  const champNom = document.getElementById("champNouveauPalier");
  const champCouleur = document.getElementById("champCouleurNouveauPalier");
  const nom = champNom.value.trim();
  const message = document.getElementById("messagePaliers");
  if (!nom) { message.textContent = "Le nom du palier est obligatoire."; return; }
  if (paliers.some((p) => p.nom === nom)) { message.textContent = "Ce palier existe déjà."; return; }
  champNom.value = "";
  sauvegarderPaliers(paliers.concat([{ nom, couleur: champCouleur.value }]), `Ajout du palier ${nom}`);
}

function deplacerPalier(index, direction) {
  const cible = index + direction;
  if (cible < 0 || cible >= paliers.length) return;
  const copie = paliers.slice();
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  sauvegarderPaliers(copie, `Réordonnancement des paliers`);
}

function supprimerPalier(index) {
  const nom = paliers[index].nom;
  if (!confirm(`Supprimer le palier « ${nom} » ?\n\nLa progression déjà enregistrée pour ce palier n'est pas supprimée, juste rendue invisible (elle réapparaîtrait si un palier du même nom est recréé).`)) return;
  const copie = paliers.filter((_, i) => i !== index);
  sauvegarderPaliers(copie, `Suppression du palier ${nom}`);
}

// ===== Unités de grandeur =====
// Partagées (unites.json), éditables par un admin : les montants du jeu
// grimpent, la liste doit pouvoir suivre sans toucher au code.

function afficherUnites() {
  const liste = document.getElementById("listeUnites");
  liste.innerHTML = "";

  unites.forEach((u, index) => {
    const li = document.createElement("li");
    li.className = "ligne-item";
    li.innerHTML =
      '<div class="ligne-info">' +
        '<div class="ligne-titre">' + echapper(u.symbole) + "</div>" +
        '<div class="ligne-sous">' + u.facteur.toLocaleString("fr-FR") + " crédits</div>" +
      "</div>" +
      '<div class="ligne-actions"></div>';

    const b = document.createElement("button");
    b.className = "btn-mini danger";
    b.textContent = "✕";
    b.title = "Supprimer";
    b.onclick = () => supprimerUnite(index);
    li.querySelector(".ligne-actions").appendChild(b);
    liste.appendChild(li);
  });

  if (!unites.length) {
    liste.innerHTML = '<li class="ligne-item"><div class="ligne-info">' +
      '<div class="ligne-sous">Aucune unité : les montants se saisissent en crédits.</div></div></li>';
  }
}

async function sauvegarderUnites(nouvelles, messageCommit) {
  const message = document.getElementById("messageUnites");
  message.className = "message";
  message.textContent = "Enregistrement...";
  try {
    shaUnites = await sauvegarderAvecRetry("unites.json", nouvelles, shaUnites, token, messageCommit);
    unites = nouvelles;
    afficherUnites();
    // La grille du formulaire propose ces unités : elle doit suivre.
    if (document.getElementById("grillePrixRendement")) construireGrillePrixRendement(droideEnEdition());
    message.className = "message ok";
    message.textContent = "Enregistré.";
  } catch (e) {
    message.textContent = e.message;
  }
}

function ajouterUnite() {
  const champSymbole = document.getElementById("champNouvelleUnite");
  const champFacteur = document.getElementById("champFacteurUnite");
  const message = document.getElementById("messageUnites");
  message.className = "message";

  const symbole = champSymbole.value.trim();
  const facteur = Number(String(champFacteur.value).trim().replace(/[\s_]/g, ""));

  if (!symbole) { message.textContent = "Le symbole est obligatoire."; return; }
  if (symbole === UNITE_POURCENT) { message.textContent = "Le pourcentage est déjà proposé, il n'a pas à être ajouté ici."; return; }
  if (unites.some((u) => u.symbole.toLowerCase() === symbole.toLowerCase())) {
    message.textContent = "Cette unité existe déjà."; return;
  }
  if (!isFinite(facteur) || facteur <= 1) {
    message.textContent = "Indique combien de crédits vaut cette unité (plus de 1)."; return;
  }

  champSymbole.value = "";
  champFacteur.value = "";
  sauvegarderUnites(normaliserUnites(unites.concat([{ symbole, facteur }])),
    "Ajout de l'unité " + symbole);
}

function supprimerUnite(index) {
  const u = unites[index];
  if (!u) return;
  // Les montants sont stockés en crédits : retirer une unité ne perd aucune
  // donnée, elle change seulement la façon dont ils s'affichent.
  if (!confirm("Supprimer l'unité « " + u.symbole + " » ?\n\n" +
      "Les montants déjà saisis ne changent pas : ils sont enregistrés en crédits.")) return;
  sauvegarderUnites(unites.filter((_, i) => i !== index), "Suppression de l'unité " + u.symbole);
}

// ===== Couleurs des raretés =====
// Partagées (raretes.json). Leur ORDRE est celui du plus faible au plus fort :
// il sert au tri du catalogue et à l'ordre des filtres. Ajout, suppression et
// réordonnancement sont possibles ; le renommage ne l'est pas, car chaque
// droïde stocke le NOM de sa rareté (même raison que pour les paliers).

function afficherRaretes() {
  const liste = document.getElementById("listeRaretes");
  liste.innerHTML = "";

  raretes.forEach((r, index) => {
    // Une rareté encore portée par des droïdes ne doit pas disparaître sans
    // qu'on le sache : ils se retrouveraient avec une rareté inconnue.
    const utilisee = catalogue.filter((d) => d.rarete === r.nom).length;

    const li = document.createElement("li");
    li.className = "ligne-item";
    li.innerHTML =
      '<div class="ligne-info">' +
        '<span class="badge-rarete ' + classeRareteCss(r.nom) + ' apercu-rarete">' +
          echapper(r.nom) +
        "</span>" +
        '<div class="ligne-sous">' + (utilisee ? utilisee + " droïde(s)" : "aucun droïde") +
          (r.premierPalierSeulement ? " · premier palier seulement" : "") + "</div>" +
      "</div>" +
      '<div class="ligne-actions">' +
        '<label class="couleur-libelle">Fond<input type="color" class="rarete-fond" value="' + echapper(r.fond) + '"></label>' +
        '<label class="couleur-libelle">Texte<input type="color" class="rarete-texte" value="' + echapper(r.texte) + '"></label>' +
      "</div>";

    const badge = li.querySelector(".apercu-rarete");
    const fond = li.querySelector(".rarete-fond");
    const texte = li.querySelector(".rarete-texte");
    // Aperçu pendant qu'on fait glisser ; on n'enregistre qu'au relâchement.
    const apercu = () => { badge.style.background = fond.value; badge.style.color = texte.value; };
    fond.oninput = apercu;
    texte.oninput = apercu;
    fond.onchange = () => changerCouleurRarete(index, { fond: fond.value });
    texte.onchange = () => changerCouleurRarete(index, { texte: texte.value });

    const actions = li.querySelector(".ligne-actions");

    const bHaut = document.createElement("button");
    bHaut.className = "btn-mini";
    bHaut.textContent = "↑";
    bHaut.title = "Rareté plus faible";
    bHaut.disabled = index === 0;
    bHaut.onclick = () => deplacerRarete(index, -1);
    actions.appendChild(bHaut);

    const bBas = document.createElement("button");
    bBas.className = "btn-mini";
    bBas.textContent = "↓";
    bBas.title = "Rareté plus forte";
    bBas.disabled = index === raretes.length - 1;
    bBas.onclick = () => deplacerRarete(index, 1);
    actions.appendChild(bBas);

    const bPalier = document.createElement("button");
    bPalier.className = "btn-mini" + (r.premierPalierSeulement ? " actif" : "");
    bPalier.textContent = "⭑";
    bPalier.title = r.premierPalierSeulement
      ? "N'existe qu'au premier palier — cliquer pour permettre les améliorations"
      : "Marquer comme n'existant qu'au premier palier (comme les Iconiques)";
    bPalier.onclick = () => changerCouleurRarete(index, { premierPalierSeulement: !r.premierPalierSeulement });
    actions.appendChild(bPalier);

    const bSuppr = document.createElement("button");
    bSuppr.className = "btn-mini danger";
    bSuppr.textContent = "✕";
    bSuppr.title = utilisee ? "Supprimer (des droïdes la portent)" : "Supprimer";
    bSuppr.onclick = () => supprimerRarete(index, utilisee);
    actions.appendChild(bSuppr);

    liste.appendChild(li);
  });
}

function deplacerRarete(index, delta) {
  const cible = index + delta;
  if (cible < 0 || cible >= raretes.length) return;
  const copie = raretes.slice();
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  sauvegarderRaretes(copie, "Réordonnancement des raretés");
}

function ajouterRarete() {
  const champ = document.getElementById("champNouvelleRarete");
  const message = document.getElementById("messageRaretes");
  message.className = "message";

  const nom = champ.value.trim();
  if (!nom) { message.textContent = "Le nom est obligatoire."; return; }
  if (raretes.some((r) => r.nom.toLowerCase() === nom.toLowerCase())) {
    message.textContent = "Cette rareté existe déjà."; return;
  }
  champ.value = "";
  // Ajoutée en fin de liste, donc comme la plus forte : c'est le cas courant.
  sauvegarderRaretes(
    raretes.concat([{ nom, fond: "#334155", texte: "#e2e8f0", premierPalierSeulement: false }]),
    "Ajout de la rareté " + nom);
}

function supprimerRarete(index, utilisee) {
  const r = raretes[index];
  if (!r) return;
  if (raretes.length <= 1) {
    document.getElementById("messageRaretes").textContent = "Il faut au moins une rareté.";
    return;
  }
  const avertissement = utilisee
    ? "\n\n" + utilisee + " droïde(s) portent cette rareté. Ils la garderont, mais elle " +
      "n'aura plus de couleur et passera en dernier dans le tri. Modifie-les d'abord si tu " +
      "veux éviter cela."
    : "";
  if (!confirm("Supprimer la rareté « " + r.nom + " » ?" + avertissement)) return;
  sauvegarderRaretes(raretes.filter((_, i) => i !== index), "Suppression de la rareté " + r.nom);
}

function changerCouleurRarete(index, modif) {
  const copie = raretes.map((r, i) => (i === index ? Object.assign({}, r, modif) : r));
  sauvegarderRaretes(copie, "Couleur de la rareté " + raretes[index].nom);
}

async function sauvegarderRaretes(nouvelles, messageCommit) {
  const message = document.getElementById("messageRaretes");
  message.className = "message";
  message.textContent = "Enregistrement...";
  try {
    shaRaretes = await sauvegarderAvecRetry("raretes.json", nouvelles, shaRaretes, token, messageCommit);
    raretes = nouvelles;
    appliquerCouleursRaretes();
    afficherRaretes();
    remplirSelectRaretes(document.getElementById("champRarete"));
    afficherDroides();          // tri et badges suivent
    message.className = "message ok";
    message.textContent = "Enregistré.";
  } catch (e) {
    message.textContent = e.message;
  }
}

// ===== Droïdes requis : des emplacements, comme dans l'escouade =====
//
// Un palier de renaissance demande trois droïdes. Deux listes déroulantes et
// un bouton « + » par ligne donnaient un empilement illisible dès qu'on avait
// vingt paliers à l'écran. On affiche donc trois EMPLACEMENTS : on clique une
// case, on choisit le droïde puis son palier dans une feuille, et c'est tout.
//
// Le format ENREGISTRÉ ne change pas (« CB (Défaut), Pit (Or) »).

const EMPLACEMENTS_RENAISSANCE = 3;

// Palier de renaissance et rang de l'emplacement en cours de remplissage.
let slotRenaissanceEnCours = null;

// Paliers où un droïde existe réellement (un Iconique n'a que le premier).
function paliersPourDroide(droide) {
  return paliers.filter((p) => estDisponibleAuPalier(droide, p.nom));
}

function serialiserElements(elements) {
  return elements.map((e) => e.texte).join(", ");
}

// Les éléments d'un palier, complétés à trois cases vides. Un palier qui en
// contiendrait davantage garde les siens : on n'efface rien au prétexte que
// le jeu n'en demande que trois.
function emplacementsDe(texteElements) {
  const elements = analyserElementsRenaissance(texteElements).map((e) => ({
    texte: e.droide ? e.droide.nom + " (" + e.palier + ")" : e.texte,
    droide: e.droide,
    palier: e.palier
  }));
  while (elements.length < EMPLACEMENTS_RENAISSANCE) elements.push(null);
  return elements;
}

function construireEmplacementsDroides(texteElements, surChangement) {
  const zone = document.createElement("div");
  zone.className = "emplacements-droides";
  let elements = emplacementsDe(texteElements);

  const enregistrer = () => surChangement(serialiserElements(elements.filter(Boolean)));

  const rendre = () => {
    zone.innerHTML = "";
    elements.forEach((e, index) => {
      const case_ = document.createElement("button");
      case_.type = "button";
      case_.className = "case-droide" + (e ? (e.droide ? " remplie" : " remplie inconnue") : " vide");

      if (!e) {
        case_.innerHTML = '<span class="case-plus">+</span>';
        case_.title = "Choisir un droïde";
      } else {
        // Le palier se lit au CONTOUR : un « Arc-en-ciel » en aplat de fond
        // rendait le nom du droïde illisible.
        appliquerContourPalier(case_, (paliers.find((p) => p.nom === e.palier) || {}).couleur);
        case_.innerHTML =
          '<span class="case-nom">' + echapper(e.droide ? e.droide.nom : e.texte) + "</span>" +
          '<span class="case-palier">' + echapper(e.droide ? e.palier : "à corriger") + "</span>";
        case_.title = e.droide
          ? "Remplacer " + e.droide.nom + " (" + e.palier + ")"
          : "Ce nom ne correspond à aucun droïde du catalogue";
      }

      case_.onclick = () => ouvrirChoixDroideRenaissance(elements, index, () => { rendre(); enregistrer(); });

      if (e) {
        const vider = document.createElement("span");
        vider.className = "case-vider";
        vider.textContent = "✕";
        vider.title = "Vider l'emplacement";
        vider.onclick = (ev) => {
          ev.stopPropagation();
          // Les cases suivantes remontent : trois emplacements, pas de trous.
          elements.splice(index, 1);
          while (elements.length < EMPLACEMENTS_RENAISSANCE) elements.push(null);
          rendre();
          enregistrer();
        };
        case_.appendChild(vider);
      }
      zone.appendChild(case_);
    });
  };

  rendre();
  return zone;
}

// ----- Feuille de choix : le droïde, puis son palier -----

function ouvrirChoixDroideRenaissance(elements, index, surChoix) {
  slotRenaissanceEnCours = { elements, index, surChoix, droide: null };
  document.getElementById("rechercheDroideRenaissance").value = "";
  afficherEtapeDroide();
  document.getElementById("voileDroideRenaissance").classList.add("ouvert");
}

function fermerChoixDroideRenaissance() {
  document.getElementById("voileDroideRenaissance").classList.remove("ouvert");
  slotRenaissanceEnCours = null;
}

// Étape 1 : quel droïde.
function afficherEtapeDroide() {
  if (!slotRenaissanceEnCours) return;
  slotRenaissanceEnCours.droide = null;
  document.getElementById("titreChoixDroideRenaissance").textContent = "Choisir un droïde";
  document.getElementById("rechercheDroideRenaissance").parentElement.style.display = "";

  const recherche = (document.getElementById("rechercheDroideRenaissance").value || "")
    .trim().toLowerCase();
  const liste = document.getElementById("listeChoixDroideRenaissance");
  liste.innerHTML = "";

  // Ordre du catalogue, donc celui du jeu — comme partout ailleurs.
  catalogue
    .filter((d) => !recherche || d.nom.toLowerCase().includes(recherche))
    .forEach((d) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "choix-droide";
      item.innerHTML =
        '<span class="choix-nom">' + echapper(d.nom) + "<small>" + echapper(d.classe) + "</small></span>" +
        '<span class="badge-rarete ' + classeRareteCss(d.rarete) + '">' + echapper(d.rarete) + "</span>";
      item.onclick = () => afficherEtapePalier(d);
      liste.appendChild(item);
    });

  if (!liste.children.length) {
    liste.innerHTML = '<p class="sous-titre">Aucun droïde ne correspond.</p>';
  }
}

// Étape 2 : à quel palier. Seuls ceux où le droïde existe sont proposés.
function afficherEtapePalier(droide) {
  if (!slotRenaissanceEnCours) return;
  slotRenaissanceEnCours.droide = droide;
  document.getElementById("titreChoixDroideRenaissance").textContent = droide.nom + " — quel palier ?";
  document.getElementById("rechercheDroideRenaissance").parentElement.style.display = "none";

  const liste = document.getElementById("listeChoixDroideRenaissance");
  liste.innerHTML = "";

  const retour = document.createElement("button");
  retour.type = "button";
  retour.className = "choix-droide retour-choix";
  retour.innerHTML = '<span class="choix-nom">← Changer de droïde</span>';
  retour.onclick = () => afficherEtapeDroide();
  liste.appendChild(retour);

  paliersPourDroide(droide).forEach((p) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "choix-droide";
    item.innerHTML =
      '<span class="choix-pastille" style="background:' + fondPalier(p.couleur) + '"></span>' +
      '<span class="choix-nom">' + echapper(p.nom) + "</span>";
    item.onclick = () => {
      const { elements, index, surChoix } = slotRenaissanceEnCours;
      // Remplir une case vide alors qu'une précédente l'est aussi laisserait
      // un trou, que l'enregistrement comblerait : la carte sauterait d'une
      // case au rechargement. On la pose donc directement au bon rang.
      const rang = elements[index] ? index
        : Math.min(index, elements.findIndex((e) => !e));
      elements[rang] = { texte: droide.nom + " (" + p.nom + ")", droide, palier: p.nom };
      fermerChoixDroideRenaissance();
      surChoix();
    };
    liste.appendChild(item);
  });
}

// ===== Paliers de renaissance =====
// Partagés (renaissance.json), gérés ici et non plus depuis la page de suivi :
// c'est du catalogue, pas de la progression personnelle.

// Sélecteur de super renaissance : on édite les droïdes d'une super
// renaissance à la fois, les niveaux et les coûts étant communs à toutes.
function construireSelecteurSuper() {
  const zone = document.getElementById("selecteurSuper");
  if (!zone) return;
  const nb = nombreSuperRenaissances(renaissance);
  zone.innerHTML = "";

  for (let n = 0; n < nb; n++) {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "onglet-palier" + (n === superEdite ? " actif" : "");
    bouton.textContent = n === 0 ? "Avant super" : "Super " + n;
    bouton.onclick = () => { superEdite = n; afficherRenaissanceAdmin(); };
    zone.appendChild(bouton);
  }

  const ajouter = document.createElement("button");
  ajouter.type = "button";
  ajouter.className = "onglet-palier ajouter-super";
  ajouter.textContent = "＋ Super " + nb;
  ajouter.title = "Ajouter une super renaissance, en reprenant les droïdes de la précédente";
  ajouter.onclick = () => ajouterSuperRenaissance(nb);
  zone.appendChild(ajouter);
}

// La nouvelle super renaissance reprend les droïdes de la précédente : on
// n'ajuste ensuite que ce qui diffère, plutôt que de tout ressaisir.
function ajouterSuperRenaissance(n) {
  if (!confirm("Ajouter la super renaissance " + n + " ?\n\n" +
      "Elle reprend les droïdes de la précédente, à ajuster ensuite palier par palier.")) return;
  const copie = renaissance.map((r) => {
    const table = elementsParSuper(r);
    return Object.assign({}, r, { elements: Object.assign({}, table, { [n]: table[n - 1] || "" }) });
  });
  superEdite = n;
  sauvegarderRenaissanceAdmin(copie, "Ajout de la super renaissance " + n);
}

function afficherRenaissanceAdmin() {
  const zone = document.getElementById("listeRenaissanceAdmin");
  zone.innerHTML = "";
  construireSelecteurSuper();

  const tries = renaissance.slice().sort((a, b) => a.niveau - b.niveau);
  if (!tries.length) {
    zone.innerHTML = '<p class="sous-titre">Aucun palier pour le moment.</p>';
    return;
  }

  tries.forEach((r) => {
    const credits = decomposerPourFormulaire(r.credits);
    const ligne = document.createElement("div");
    ligne.className = "ligne-renaissance";
    ligne.innerHTML =
      '<div class="entete-palier-renaissance">' +
        '<span class="etiquette-niveau">Palier</span>' +
        '<input type="number" class="r-niveau" min="1" value="' + echapper(r.niveau) + '" aria-label="Niveau">' +
        '<span class="duo-valeur">' +
          '<input type="text" class="r-credits" inputmode="decimal" value="' + echapper(credits.valeur) + '" aria-label="Crédits requis">' +
          '<select class="r-unite" aria-label="Unité des crédits">' + optionsUnite(credits.unite, false) + "</select>" +
        "</span>" +
        '<button type="button" class="btn-mini danger" title="Supprimer ce palier">✕</button>' +
      "</div>" +
      '<div class="cellule-droides"></div>';

    // Les droïdes requis viennent des emplacements ; le reste des champs
    // de la ligne est lu tel quel.
    let elementsCourants = elementsPourSuper(r, superEdite);
    const enregistrer = () => {
      const copie = renaissance.map((x) => (x.id === r.id ? {
        id: r.id,
        niveau: Number(ligne.querySelector(".r-niveau").value) || r.niveau,
        credits: composerValeur(ligne.querySelector(".r-credits").value,
                                ligne.querySelector(".r-unite").value) ?? 0,
        // Seuls les droïdes changent d'une super renaissance à l'autre :
        // on ne réécrit que l'entrée de celle qu'on édite.
        elements: Object.assign(elementsParSuper(x), { [superEdite]: elementsCourants })
      } : x));
      sauvegarderRenaissanceAdmin(copie, "Modification du palier de renaissance " + r.niveau);
    };
    ligne.querySelectorAll(".r-niveau, .r-credits, .r-unite")
      .forEach((c) => c.addEventListener("change", enregistrer));

    ligne.querySelector(".cellule-droides").appendChild(
      construireEmplacementsDroides(elementsPourSuper(r, superEdite),
        (texte) => { elementsCourants = texte; enregistrer(); }));

    ligne.querySelector(".btn-mini.danger").onclick = () => supprimerRenaissanceAdmin(r.id, r.niveau);
    zone.appendChild(ligne);
  });
}

// Fichier partagé, modifiable par n'importe quel admin : on fusionne plutôt
// que d'écraser, comme pour le catalogue.
async function sauvegarderRenaissanceAdmin(nouvelle, messageCommit) {
  const message = document.getElementById("messageRenaissanceAdmin");
  message.className = "message";
  message.textContent = "Enregistrement...";
  try {
    shaRenaissance = await sauvegarderAvecFusion("renaissance.json", nouvelle, shaRenaissance, token, messageCommit);
    renaissance = nouvelle;
    afficherRenaissanceAdmin();
    message.className = "message ok";
    message.textContent = "Enregistré.";
  } catch (e) {
    message.textContent = e.message;
  }
}

function ajouterRenaissanceAdmin() {
  const champNiveau = document.getElementById("champNouveauNiveau");
  const champCredits = document.getElementById("champNouveauxCredits");
  const champUnite = document.getElementById("champUniteCredits");
  const message = document.getElementById("messageRenaissanceAdmin");
  message.className = "message";

  const niveau = Number(champNiveau.value);
  const credits = composerValeur(champCredits.value, champUnite.value);

  if (!niveau || niveau < 1) { message.textContent = "Le niveau est obligatoire."; return; }
  if (renaissance.some((r) => r.niveau === niveau)) {
    message.textContent = "Le niveau " + niveau + " existe déjà."; return;
  }
  if (credits === null) { message.textContent = "Les crédits requis sont obligatoires."; return; }

  // Créé sans droïdes : ils se choisissent ensuite sur la ligne, dans les
  // listes déroulantes — c'est là qu'on évite les fautes de frappe.
  const nouveau = { id: genererId("r"), niveau, credits, elements: "" };
  champNiveau.value = "";
  champCredits.value = "";
  sauvegarderRenaissanceAdmin(renaissance.concat([nouveau]), "Ajout du palier de renaissance " + niveau);
}

function supprimerRenaissanceAdmin(id, niveau) {
  if (!confirm("Supprimer le palier de renaissance " + niveau + " ?\n\n" +
      "La progression déjà enregistrée par les comptes qui l'avaient atteint n'est pas " +
      "supprimée, juste rendue invisible.")) return;
  sauvegarderRenaissanceAdmin(renaissance.filter((r) => r.id !== id),
    "Suppression du palier de renaissance " + niveau);
}

// Propose le niveau suivant, comme le faisait le formulaire de la page de suivi.
function preparerAjoutRenaissance() {
  const champ = document.getElementById("champNouveauNiveau");
  if (champ && !champ.value) {
    champ.value = renaissance.reduce((max, r) => Math.max(max, r.niveau), 0) + 1;
  }
}

// ===== Fusions =====
// Partagées (fusions.json), même schéma que les renaissances : des
// emplacements où l'on choisit un droïde, mais ici avec une QUANTITÉ plutôt
// qu'un palier. Le résultat (nom, type, rareté) est un droïde spécial qui
// n'existe pas dans le catalogue : ses champs vivent dans la recette elle-même.

const EMPLACEMENTS_FUSION = 3;

// Emplacement (droïde + quantité) en cours de remplissage.
let slotFusionEnCours = null;

function ingredientsDe(recette) {
  const liste = normaliserIngredients(recette && recette.ingredients).map((i) => ({
    nom: i.nom, quantite: i.quantite, droide: droideParNom(i.nom)
  }));
  while (liste.length < EMPLACEMENTS_FUSION) liste.push(null);
  return liste;
}

function serialiserIngredients(elements) {
  return elements.filter(Boolean).map((e) => ({
    nom: e.nom, quantite: Math.max(1, Math.round(e.quantite) || 1)
  }));
}

function construireEmplacementsIngredients(recette, surChangement) {
  const zone = document.createElement("div");
  zone.className = "emplacements-droides";
  let elements = ingredientsDe(recette);

  const enregistrer = () => surChangement(serialiserIngredients(elements));

  const rendre = () => {
    zone.innerHTML = "";
    elements.forEach((e, index) => {
      const case_ = document.createElement("button");
      case_.type = "button";
      case_.className = "case-droide" + (e ? (e.droide ? " remplie" : " remplie inconnue") : " vide");

      if (!e) {
        case_.innerHTML = '<span class="case-plus">+</span>';
        case_.title = "Choisir un droïde";
      } else {
        case_.innerHTML =
          '<span class="case-nom">' + echapper(e.droide ? e.droide.nom : e.nom) + "</span>" +
          '<span class="case-palier">×' + e.quantite + (e.droide ? "" : " · à corriger") + "</span>";
        case_.title = e.droide
          ? "Modifier " + e.droide.nom + " (×" + e.quantite + ")"
          : "Ce nom ne correspond à aucun droïde du catalogue";
      }

      case_.onclick = () => ouvrirChoixDroideFusion(elements, index, () => { rendre(); enregistrer(); });

      if (e) {
        const vider = document.createElement("span");
        vider.className = "case-vider";
        vider.textContent = "✕";
        vider.title = "Vider l'emplacement";
        vider.onclick = (ev) => {
          ev.stopPropagation();
          elements.splice(index, 1);
          while (elements.length < EMPLACEMENTS_FUSION) elements.push(null);
          rendre();
          enregistrer();
        };
        case_.appendChild(vider);
      }
      zone.appendChild(case_);
    });
  };

  rendre();
  return zone;
}

// ----- Feuille de choix : le droïde, puis sa quantité -----

function ouvrirChoixDroideFusion(elements, index, surChoix) {
  slotFusionEnCours = { mode: "ingredient", elements, index, surChoix, droide: null };
  document.getElementById("rechercheDroideFusion").value = "";
  afficherEtapeDroideFusion();
  document.getElementById("voileDroideFusion").classList.add("ouvert");
}

// Choix du droïde RÉSULTAT (un droïde du catalogue) : pas d'étape de quantité.
function ouvrirChoixResultatFusion(surChoix) {
  slotFusionEnCours = { mode: "resultat", surChoix };
  document.getElementById("rechercheDroideFusion").value = "";
  afficherEtapeDroideFusion();
  document.getElementById("voileDroideFusion").classList.add("ouvert");
}

function fermerChoixDroideFusion() {
  document.getElementById("voileDroideFusion").classList.remove("ouvert");
  slotFusionEnCours = null;
}

function afficherEtapeDroideFusion() {
  if (!slotFusionEnCours) return;
  slotFusionEnCours.droide = null;
  document.getElementById("titreChoixDroideFusion").textContent = "Choisir un droïde";
  document.getElementById("rechercheFusionEnveloppe").style.display = "";

  const recherche = (document.getElementById("rechercheDroideFusion").value || "").trim().toLowerCase();
  const liste = document.getElementById("listeChoixDroideFusion");
  liste.innerHTML = "";

  catalogue
    .filter((d) => !recherche || d.nom.toLowerCase().includes(recherche))
    .forEach((d) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "choix-droide";
      item.innerHTML =
        '<span class="choix-nom">' + echapper(d.nom) + "<small>" + echapper(d.classe) + "</small></span>" +
        '<span class="badge-rarete ' + classeRareteCss(d.rarete) + '">' + echapper(d.rarete) + "</span>";
      item.onclick = () => {
        // Pour le résultat : on prend le droïde directement (pas de quantité).
        if (slotFusionEnCours && slotFusionEnCours.mode === "resultat") {
          const cb = slotFusionEnCours.surChoix;
          fermerChoixDroideFusion();
          cb(d);
        } else {
          afficherEtapeQuantiteFusion(d);
        }
      };
      liste.appendChild(item);
    });

  if (!liste.children.length) {
    liste.innerHTML = '<p class="sous-titre">Aucun droïde ne correspond.</p>';
  }
}

function afficherEtapeQuantiteFusion(droide) {
  if (!slotFusionEnCours) return;
  slotFusionEnCours.droide = droide;
  document.getElementById("titreChoixDroideFusion").textContent = droide.nom + " — quelle quantité ?";
  document.getElementById("rechercheFusionEnveloppe").style.display = "none";

  const liste = document.getElementById("listeChoixDroideFusion");
  liste.innerHTML = "";

  const retour = document.createElement("button");
  retour.type = "button";
  retour.className = "choix-droide retour-choix";
  retour.innerHTML = '<span class="choix-nom">← Changer de droïde</span>';
  retour.onclick = () => afficherEtapeDroideFusion();
  liste.appendChild(retour);

  [1, 2, 3].forEach((q) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "choix-droide";
    item.innerHTML = '<span class="choix-nom">×' + q +
      " <small>" + (q === 1 ? "un exemplaire" : q + " exemplaires") + "</small></span>";
    item.onclick = () => {
      const { elements, index, surChoix } = slotFusionEnCours;
      // Remplir au bon rang pour ne pas laisser de trou (comme la renaissance).
      const premierVide = elements.findIndex((e) => !e);
      const rang = elements[index] ? index
        : (premierVide === -1 ? index : Math.min(index, premierVide));
      elements[rang] = { nom: droide.nom, quantite: q, droide };
      fermerChoixDroideFusion();
      surChoix();
    };
    liste.appendChild(item);
  });
}

// Le résultat d'une recette : un droïde du catalogue, présenté comme une case
// cliquable qu'on remplace d'un clic (ouvre la feuille de choix, sans quantité).
function construireSlotResultat(f, surChangement) {
  const slot = document.createElement("button");
  slot.type = "button";
  const droide = droideResultatFusion(f);
  const nom = nomResultatFusion(f);
  slot.className = "case-droide resultat-fusion" + (droide ? " remplie" : " vide");
  if (droide) {
    appliquerContourPalier(slot, (raretes.find((r) => r.nom === droide.rarete) || {}).fond);
    slot.innerHTML =
      '<span class="case-nom">' + echapper(droide.nom) + "</span>" +
      '<span class="badge-rarete ' + classeRareteCss(droide.rarete) + '">' + echapper(droide.rarete) + "</span>";
    slot.title = "Changer le droïde résultat (" + droide.nom + ")";
  } else if (nom) {
    slot.className = "case-droide resultat-fusion remplie inconnue";
    slot.innerHTML =
      '<span class="case-nom">' + echapper(nom) + "</span>" +
      '<span class="case-palier">hors catalogue — cliquer pour relier</span>';
    slot.title = "« " + nom + " » n'est pas dans le catalogue. Ajoute-le dans l'onglet Droïdes, puis relie-le ici.";
  } else {
    slot.innerHTML = '<span class="case-plus">+</span><span class="case-nom">Choisir le résultat</span>';
    slot.title = "Choisir le droïde résultat";
  }
  slot.onclick = () => ouvrirChoixResultatFusion((droide) => surChangement(droide));
  return slot;
}

function afficherFusionAdmin() {
  const zone = document.getElementById("listeFusionAdmin");
  if (!zone) return;
  zone.innerHTML = "";

  if (!fusions.length) {
    zone.innerHTML = '<p class="sous-titre">Aucune recette pour le moment.</p>';
    return;
  }

  // Groupées par rareté du résultat (ordre des raretés), puis par nom.
  const tri = fusions.slice().sort((a, b) => {
    const na = rangRarete(rareteResultatFusion(a)), nb = rangRarete(rareteResultatFusion(b));
    if (na !== nb) return na - nb;
    return nomResultatFusion(a).localeCompare(nomResultatFusion(b));
  });

  tri.forEach((f) => {
    let ingredientsCourants = normaliserIngredients(f.ingredients);
    let resultatCourant = nomResultatFusion(f);
    const enregistrer = () => {
      const entree = { id: f.id, resultat: resultatCourant, ingredients: ingredientsCourants };
      const copie = fusions.map((x) => (x.id === f.id ? entree : x));
      sauvegarderFusionAdmin(copie, "Modification de la fusion " + (resultatCourant || f.id));
    };

    const ligne = document.createElement("div");
    ligne.className = "ligne-fusion";

    const entete = document.createElement("div");
    entete.className = "entete-fusion";
    entete.appendChild(construireSlotResultat(f, (droide) => { resultatCourant = droide.nom; enregistrer(); }));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-mini danger";
    del.title = "Supprimer cette recette";
    del.textContent = "✕";
    del.onclick = () => supprimerFusionAdmin(f.id, nomResultatFusion(f));
    entete.appendChild(del);
    ligne.appendChild(entete);

    const cellule = document.createElement("div");
    cellule.className = "cellule-droides";
    cellule.appendChild(construireEmplacementsIngredients(f, (ing) => { ingredientsCourants = ing; enregistrer(); }));
    ligne.appendChild(cellule);

    zone.appendChild(ligne);
  });
}

async function sauvegarderFusionAdmin(nouvelle, messageCommit) {
  const message = document.getElementById("messageFusionAdmin");
  message.className = "message";
  message.textContent = "Enregistrement...";
  try {
    shaFusions = await sauvegarderAvecFusion("fusions.json", nouvelle, shaFusions, token, messageCommit);
    fusions = nouvelle;
    afficherFusionAdmin();
    message.className = "message ok";
    message.textContent = "Enregistré.";
  } catch (e) {
    message.textContent = e.message;
  }
}

// Nouvelle recette : on choisit d'abord le droïde résultat dans le catalogue,
// puis les ingrédients se posent dans les emplacements de la ligne créée.
function nouvelleFusionAdmin() {
  ouvrirChoixResultatFusion((droide) => {
    const nouvelle = { id: genererId("fus"), resultat: droide.nom, ingredients: [] };
    sauvegarderFusionAdmin(fusions.concat([nouvelle]), "Ajout de la fusion " + droide.nom);
  });
}

function supprimerFusionAdmin(id, nom) {
  if (!confirm("Supprimer la recette de fusion « " + (nom || "") + " » ?")) return;
  sauvegarderFusionAdmin(fusions.filter((f) => f.id !== id),
    "Suppression de la fusion " + (nom || id));
}
