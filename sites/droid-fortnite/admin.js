// Panneau de gestion Droid Fortnite (réservé aux admins du portail central —
// voir exigerAdminDroidFortnite() dans script.js).

const token = exigerAdminDroidFortnite();

let catalogue = [];
let shaCatalogue = null;
let paliers = [];
let shaPaliers = null;
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

// ===== Onglets (Droïdes / Ajouter / Paliers) =====
let ongletAdminActif = "droides";

function changerOngletAdmin(type) {
  ongletAdminActif = type;
  document.querySelectorAll(".onglet-type").forEach((b) => b.classList.toggle("actif", b.dataset.type === type));
  document.getElementById("zoneDroides").style.display = type === "droides" ? "" : "none";
  document.getElementById("zoneAjout").style.display = type === "ajout" ? "" : "none";
  document.getElementById("zonePaliers").style.display = type === "paliers" ? "" : "none";
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
    const [rCatalogue, rPaliers] = await Promise.all([
      chargerOuAmorcer("catalogue.json", CATALOGUE_INITIAL, token, "Amorçage du catalogue de droïdes"),
      chargerOuAmorcer("paliers.json", PALIERS_INITIAUX, token, "Amorçage de la liste des paliers")
    ]);
    catalogue = Array.isArray(rCatalogue.contenu) ? rCatalogue.contenu : [];
    shaCatalogue = rCatalogue.sha;
    const paliersCharges = normaliserPaliers(rPaliers.contenu);
    paliers = paliersCharges.length ? paliersCharges : PALIERS_INITIAUX;
    shaPaliers = rPaliers.sha;
  } catch (e) {
    message.textContent = e.message;
    return;
  }
  afficherDroides();
  afficherPaliers();
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
function construireGrillePrixRendement(d) {
  const grille = document.getElementById("grillePrixRendement");
  grille.innerHTML =
    '<div class="entete-paliers"><span>Palier</span><span>Prix</span><span>Rendement /s</span></div>';

  paliers.forEach((p) => {
    const ligne = document.createElement("div");
    ligne.className = "ligne-palier";
    const prix = d ? (valeurPalier(d.prix, p.nom) ?? "") : "";
    const rendement = d ? (valeurPalier(d.rendements, p.nom) ?? "") : "";
    ligne.innerHTML =
      `<span class="nom-palier">` +
        `<span class="pastille-palier" style="background:${p.couleur || "transparent"}"></span>` +
        echapper(p.nom) +
      `</span>` +
      `<input type="text" inputmode="decimal" data-palier="${echapper(p.nom)}" data-champ="prix" ` +
        `value="${echapper(prix)}" placeholder="—" aria-label="Prix au palier ${echapper(p.nom)}">` +
      `<input type="text" inputmode="decimal" data-palier="${echapper(p.nom)}" data-champ="rendement" ` +
        `value="${echapper(rendement)}" placeholder="—" aria-label="Rendement au palier ${echapper(p.nom)}">`;
    grille.appendChild(ligne);
  });
}

// Relit la grille : deux tables indexées par nom de palier, sans les cases
// laissées vides (inutile d'alourdir le catalogue de valeurs nulles).
function lireGrillePrixRendement() {
  const prix = {};
  const rendements = {};
  document.querySelectorAll("#grillePrixRendement input").forEach((input) => {
    const valeur = input.value.trim();
    if (!valeur) return;
    const cible = input.dataset.champ === "prix" ? prix : rendements;
    // Un nombre est stocké comme nombre ; le reste (« 15% » des Iconiques)
    // est conservé tel quel.
    const n = parseFloat(valeur.replace(",", "."));
    cible[input.dataset.palier] = (isFinite(n) && !/[^\d.,\s]/.test(valeur)) ? n : valeur;
  });
  return { prix, rendements };
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
