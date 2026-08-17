// Panneau de gestion Droid Fortnite (réservé aux admins du portail central —
// voir exigerAdminDroidFortnite() dans script.js).

const token = exigerAdminDroidFortnite();

let catalogue = [];
let shaCatalogue = null;
let paliers = [];
let shaPaliers = null;
let shaUnites = null;
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

// ===== Onglets (Droïdes / Ajouter / Paliers / Unités) =====
let ongletAdminActif = "droides";

function changerOngletAdmin(type) {
  ongletAdminActif = type;
  document.querySelectorAll(".onglet-type").forEach((b) => b.classList.toggle("actif", b.dataset.type === type));
  document.getElementById("zoneDroides").style.display = type === "droides" ? "" : "none";
  document.getElementById("zoneAjout").style.display = type === "ajout" ? "" : "none";
  document.getElementById("zonePaliers").style.display = type === "paliers" ? "" : "none";
  document.getElementById("zoneUnites").style.display = type === "unites" ? "" : "none";
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
    const [rCatalogue, rPaliers, rUnites] = await Promise.all([
      chargerOuAmorcer("catalogue.json", CATALOGUE_INITIAL, token, "Amorçage du catalogue de droïdes"),
      chargerOuAmorcer("paliers.json", PALIERS_INITIAUX, token, "Amorçage de la liste des paliers"),
      chargerOuAmorcer("unites.json", UNITES_INITIALES, token, "Amorçage des unités de grandeur")
    ]);
    catalogue = Array.isArray(rCatalogue.contenu) ? rCatalogue.contenu : [];
    shaCatalogue = rCatalogue.sha;
    const paliersCharges = normaliserPaliers(rPaliers.contenu);
    paliers = paliersCharges.length ? paliersCharges : PALIERS_INITIAUX;
    shaPaliers = rPaliers.sha;
    const unitesChargees = normaliserUnites(rUnites.contenu);
    unites = unitesChargees.length ? unitesChargees : UNITES_INITIALES;
    shaUnites = rUnites.sha;
  } catch (e) {
    message.textContent = e.message;
    return;
  }
  afficherDroides();
  afficherPaliers();
  afficherUnites();
}

// ===== Droïdes =====
// Petites cartes (comme le Droidex de suivi.html) plutôt qu'une longue
// liste : avec ~70 droïdes, une liste verticale devient vite illisible.
// Triées par rareté (Typique en premier), puis par nom. Cliquer une carte
// l'ouvre en modification ; le bouton 🗑 dans le coin supprime directement
// (avec confirmation).
function afficherDroides() {
  const grille = document.getElementById("listeDroides");
  grille.innerHTML = "";

  catalogue.slice().sort((a, b) => {
    const diff = ORDRE_RARETE.indexOf(a.rarete) - ORDRE_RARETE.indexOf(b.rarete);
    return diff !== 0 ? diff : a.nom.localeCompare(b.nom);
  }).forEach((d) => {
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
  const iconique = rarete === "Iconique";

  grille.innerHTML =
    '<div class="entete-paliers"><span>Palier</span><span>Prix</span><span>Rendement /s</span></div>';

  // Un Iconique n'existe qu'au premier palier : inutile de proposer les autres.
  const lignes = paliers.filter((p) => !iconique || estDisponibleAuPalier({ rarete: "Iconique" }, p.nom));

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
        '<span class="pastille-palier" style="background:' + (p.couleur || "transparent") + '"></span>' +
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

    const copie = modeEditionId
      ? catalogue.map((x) => x.id === modeEditionId ? entree : x)
      : catalogue.concat([entree]);

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
      `<div class="ligne-info"><div class="ligne-titre">${index + 1}. ${echapper(p.nom)}</div></div>` +
      `<input type="color" class="palier-couleur" value="${echapper(p.couleur || "#9ca3af")}" title="Couleur du contour">` +
      `<div class="ligne-actions"></div>`;

    li.querySelector(".palier-couleur").addEventListener("change", (e) => changerCouleurPalier(index, e.target.value));

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

function changerCouleurPalier(index, couleur) {
  const copie = paliers.slice();
  copie[index] = Object.assign({}, copie[index], { couleur });
  sauvegarderPaliers(copie, `Couleur du palier ${copie[index].nom}`);
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
