// Panneau de gestion Droid Fortnite (réservé aux admins du portail central —
// voir exigerAdminDroidFortnite() dans script.js).

const token = exigerAdminDroidFortnite();

let catalogue = [];
let shaCatalogue = null;
let paliers = [];
let shaPaliers = null;
let modeEditionId = null; // id du droïde en cours de modification, ou null (mode ajout)

function echapper(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
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
    paliers = (Array.isArray(rPaliers.contenu) && rPaliers.contenu.length) ? rPaliers.contenu : PALIERS_INITIAUX;
    shaPaliers = rPaliers.sha;
  } catch (e) {
    message.textContent = e.message;
    return;
  }
  afficherDroides();
  afficherPaliers();
}

// ===== Droïdes =====
function afficherDroides() {
  const liste = document.getElementById("listeDroides");
  liste.innerHTML = "";

  catalogue.slice().sort((a, b) => a.nom.localeCompare(b.nom)).forEach((d) => {
    const li = document.createElement("li");
    li.className = "ligne-item";
    li.innerHTML =
      `<div class="ligne-info">` +
        `<div class="ligne-titre">${echapper(d.nom)}</div>` +
        `<div class="ligne-sous">${echapper(d.classe)} · ${echapper(d.rarete)}</div>` +
      `</div>` +
      `<div class="ligne-actions"></div>`;

    const actions = li.querySelector(".ligne-actions");
    const bEdit = document.createElement("button");
    bEdit.className = "btn-mini";
    bEdit.textContent = "Modifier";
    bEdit.onclick = () => editerDroide(d.id);
    actions.appendChild(bEdit);

    const bDel = document.createElement("button");
    bDel.className = "btn-mini danger";
    bDel.textContent = "Supprimer";
    bDel.onclick = () => supprimerDroide(d.id);
    actions.appendChild(bDel);

    liste.appendChild(li);
  });
}

function editerDroide(id) {
  const d = catalogue.find((x) => x.id === id);
  if (!d) return;
  modeEditionId = id;
  document.getElementById("champNom").value = d.nom;
  document.getElementById("champClasse").value = d.classe;
  document.getElementById("champRarete").value = d.rarete;
  document.getElementById("titreFormDroide").textContent = "Modifier « " + d.nom + " »";
  document.getElementById("btnEnregistrerDroide").textContent = "Enregistrer les modifications";
  document.getElementById("btnAnnulerDroide").style.display = "";
  document.getElementById("messageDroideAdmin").textContent = "";
  document.getElementById("champNom").focus();
}

function annulerEditionDroide() {
  modeEditionId = null;
  document.getElementById("champNom").value = "";
  document.getElementById("champClasse").value = "Ouvrier";
  document.getElementById("champRarete").value = "Typique";
  document.getElementById("titreFormDroide").textContent = "Ajouter un droïde";
  document.getElementById("btnEnregistrerDroide").textContent = "Ajouter";
  document.getElementById("btnAnnulerDroide").style.display = "none";
  document.getElementById("messageDroideAdmin").textContent = "";
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

  let copie;
  if (modeEditionId) {
    copie = catalogue.map((x) => x.id === modeEditionId ? Object.assign({}, x, { nom, classe, rarete }) : x);
  } else {
    copie = catalogue.concat([{ id: genererId("d"), nom, classe, rarete }]);
  }

  message.textContent = "Enregistrement...";
  try {
    shaCatalogue = await sauvegarderAvecFusion("catalogue.json", copie, shaCatalogue, token,
      modeEditionId ? `Modification du droïde ${nom}` : `Ajout du droïde ${nom}`);
    catalogue = copie;
    annulerEditionDroide();
    afficherDroides();
    message.textContent = "Enregistré avec succès.";
    setTimeout(() => { if (message.textContent === "Enregistré avec succès.") message.textContent = ""; }, 2500);
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
    message.textContent = "Droïde supprimé.";
    setTimeout(() => { if (message.textContent === "Droïde supprimé.") message.textContent = ""; }, 2500);
  } catch (e) {
    message.textContent = e.message;
  }
}

// ===== Paliers de variante =====
function afficherPaliers() {
  const liste = document.getElementById("listePaliers");
  liste.innerHTML = "";

  paliers.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "ligne-item";
    li.innerHTML =
      `<div class="ligne-info"><div class="ligne-titre">${index + 1}. ${echapper(p)}</div></div>` +
      `<div class="ligne-actions"></div>`;

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

function ajouterPalier() {
  const champ = document.getElementById("champNouveauPalier");
  const nom = champ.value.trim();
  const message = document.getElementById("messagePaliers");
  if (!nom) { message.textContent = "Le nom du palier est obligatoire."; return; }
  if (paliers.includes(nom)) { message.textContent = "Ce palier existe déjà."; return; }
  champ.value = "";
  sauvegarderPaliers(paliers.concat([nom]), `Ajout du palier ${nom}`);
}

function deplacerPalier(index, direction) {
  const cible = index + direction;
  if (cible < 0 || cible >= paliers.length) return;
  const copie = paliers.slice();
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  sauvegarderPaliers(copie, `Réordonnancement des paliers`);
}

function supprimerPalier(index) {
  const nom = paliers[index];
  if (!confirm(`Supprimer le palier « ${nom}» ?\n\nLa progression déjà enregistrée pour ce palier n'est pas supprimée, juste rendue invisible (elle réapparaîtrait si un palier du même nom est recréé).`)) return;
  const copie = paliers.filter((_, i) => i !== index);
  sauvegarderPaliers(copie, `Suppression du palier ${nom}`);
}
