// ===== Droid Fortnite — logique de la page de suivi =====
const token = exigerConnexion(); // redirige vers connexion.html si absent

let catalogue = [];
let shaCatalogue = null;
let renaissance = [];
let shaRenaissance = null;
let perso = { droidesPossedes: {}, renaissanceAtteinte: [] };
let shaPerso = null;

let ongletActif = "droidex";

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

  document.getElementById("chargement").style.display = "none";
  document.getElementById("zoneDroidex").style.display = "";
  afficherDroidex();
  afficherRenaissance();
}

async function chargerBibliothequePerso() {
  try {
    const { contenu, sha } = await lireFichierJSON(cheminBibliothequeCourante(), token);
    perso = {
      droidesPossedes: (contenu && typeof contenu.droidesPossedes === "object" && contenu.droidesPossedes) || {},
      renaissanceAtteinte: (contenu && Array.isArray(contenu.renaissanceAtteinte)) ? contenu.renaissanceAtteinte : []
    };
    shaPerso = sha;
  } catch (e) {
    if (e.status !== 404) throw e;
    perso = { droidesPossedes: {}, renaissanceAtteinte: [] };
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

  const filtres = catalogue.filter((d) => {
    if (recherche && !d.nom.toLowerCase().includes(recherche)) return false;
    if (filtreClasse && d.classe !== filtreClasse) return false;
    if (filtreRarete && d.rarete !== filtreRarete) return false;
    const possede = !!perso.droidesPossedes[d.id];
    if (filtrePossede === "oui" && !possede) return false;
    if (filtrePossede === "non" && possede) return false;
    return true;
  });

  const grille = document.getElementById("grilleDroidex");
  const vide = document.getElementById("videDroidex");
  grille.innerHTML = "";
  vide.style.display = filtres.length ? "none" : "";

  filtres.forEach((d) => {
    const palierActuel = perso.droidesPossedes[d.id] || "";
    const carte = document.createElement("div");
    carte.className = "carte-droide" + (palierActuel ? " possede" : "");
    carte.innerHTML =
      `<div class="droide-entete">` +
        `<div class="droide-icone">${iconeClasse(d.classe)}</div>` +
        `<div class="droide-nom">${echapperHTML(d.nom)}</div>` +
      `</div>` +
      `<span class="badge-rarete ${classeRareteCss(d.rarete)}">${echapperHTML(d.rarete)}</span>` +
      `<select class="select-palier"></select>`;

    const select = carte.querySelector(".select-palier");
    const optionVide = document.createElement("option");
    optionVide.value = "";
    optionVide.textContent = "Non possédé";
    select.appendChild(optionVide);
    PALIERS_DROIDE.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (p === palierActuel) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => changerPalier(d.id, select.value));

    grille.appendChild(carte);
  });

  const total = catalogue.length;
  const possedes = catalogue.filter((d) => !!perso.droidesPossedes[d.id]).length;
  const pct = total ? Math.round((possedes / total) * 100) : 0;
  document.getElementById("compteurDroidex").innerHTML =
    `<b>${possedes} / ${total}</b>` +
    `<div class="barre-progression"><span style="width:${pct}%"></span></div>`;
}

function changerPalier(idDroide, palier) {
  if (palier) {
    perso.droidesPossedes[idDroide] = palier;
  } else {
    delete perso.droidesPossedes[idDroide];
  }
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
