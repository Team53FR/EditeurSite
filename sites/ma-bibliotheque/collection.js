// ===== Ma Bibliothèque — logique de la collection =====
const token = exigerConnexion(); // redirige vers connexion.html si absent

let livres = [];
let shaLivres = null;
let livreEnEdition = null;      // id du livre en cours d'édition, ou null si ajout
let tomesPossedesEdition = [];  // tomes cochés dans le formulaire ouvert
let dataUrlImageEnMemoire = null; // nouvelle couverture choisie, en attente d'envoi
let imageSupprimee = false;
const cacheImages = new Map(); // chemin GitHub -> URL locale (blob:)

if (token) {
  chargerCollection();
}

// ===== Chargement =====
async function chargerCollection() {
  try {
    const { contenu, sha } = await lireFichierJSON("livres.json", token);
    livres = Array.isArray(contenu) ? contenu : (Array.isArray(contenu.livres) ? contenu.livres : []);
    shaLivres = sha;
  } catch (e) {
    if (e.status === 404) {
      livres = [];
      shaLivres = null;
    } else {
      document.getElementById("chargement").innerHTML =
        `<p style="color:var(--danger);text-align:center">${echapperHTML(e.message)}</p>`;
      return;
    }
  }
  document.getElementById("chargement").style.display = "none";
  afficherLivres();
}

// ===== Affichage de la liste =====
function afficherLivres() {
  const recherche = (document.getElementById("champRecherche").value || "").trim().toLowerCase();
  const filtres = livres
    .filter(l => !recherche
      || (l.titre || "").toLowerCase().includes(recherche)
      || (l.auteur || "").toLowerCase().includes(recherche))
    .sort((a, b) => (a.titre || "").localeCompare(b.titre || "", "fr", { sensitivity: "base" }));

  const grille = document.getElementById("grilleLivres");
  const etatVide = document.getElementById("etatVide");

  if (filtres.length === 0) {
    grille.style.display = "none";
    grille.innerHTML = "";
    etatVide.style.display = "block";
    document.getElementById("etatVideTitre").textContent =
      livres.length === 0 ? "Aucun livre pour l'instant" : "Aucun résultat";
    etatVide.querySelector("p").textContent =
      livres.length === 0 ? "Touche le bouton + pour ajouter ton premier livre." : "Essaie un autre terme de recherche.";
    return;
  }

  etatVide.style.display = "none";
  grille.style.display = "grid";
  grille.innerHTML = filtres.map(carteLivreHTML).join("");

  filtres.forEach(l => { if (l.image) chargerImageCarte(l.id, l.image); });
}

function carteLivreHTML(l) {
  const total = Math.max(1, l.tomesTotal || 1);
  const possedes = Array.isArray(l.tomesPossedes) ? l.tomesPossedes.length : 0;
  const pourcentage = Math.min(100, Math.round((possedes / total) * 100));
  const complet = possedes >= total;
  return `
    <button class="carte-livre" onclick="ouvrirFormulaire('${l.id}')">
      <div class="couv-livre" id="couv-${l.id}">${iconePlaceholderCouverture()}</div>
      <div class="info-livre">
        <h3>${echapperHTML(l.titre || "Sans titre")}</h3>
        <p class="auteur">${echapperHTML(l.auteur || "")}</p>
        <div class="progression${complet ? ' badge-complet' : ''}">
          <div class="barre-progression"><span style="width:${pourcentage}%"></span></div>
          <small>${possedes}/${total}</small>
        </div>
      </div>
    </button>`;
}

function iconePlaceholderCouverture() {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
}

function echapperHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

async function chargerImageCarte(id, chemin) {
  try {
    const url = await obtenirUrlImageCache(chemin);
    const el = document.getElementById(`couv-${id}`);
    if (el) el.innerHTML = `<img src="${url}" alt="">`;
  } catch (e) { /* on garde le pictogramme par défaut */ }
}

async function obtenirUrlImageCache(chemin) {
  if (cacheImages.has(chemin)) return cacheImages.get(chemin);
  const url = await obtenirUrlImage(chemin, token);
  cacheImages.set(chemin, url);
  return url;
}

// ===== Formulaire d'ajout / édition =====
function ouvrirFormulaire(id) {
  livreEnEdition = id || null;
  dataUrlImageEnMemoire = null;
  imageSupprimee = false;

  const apercu = document.getElementById("apercuCouverture");
  const boutonSupprimerImage = document.getElementById("boutonSupprimerImage");
  const zoneSuppression = document.getElementById("zoneSuppression");

  if (id) {
    const l = livres.find(x => x.id === id);
    if (!l) return;
    document.getElementById("titreFormulaire").textContent = "Modifier le livre";
    document.getElementById("champTitre").value = l.titre || "";
    document.getElementById("champAuteur").value = l.auteur || "";
    document.getElementById("champTotalTomes").value = Math.max(1, l.tomesTotal || 1);
    tomesPossedesEdition = Array.isArray(l.tomesPossedes) ? [...l.tomesPossedes] : [];
    zoneSuppression.style.display = "block";
    apercu.innerHTML = iconePlaceholderCouverture();

    if (l.image) {
      boutonSupprimerImage.style.display = "block";
      obtenirUrlImageCache(l.image).then(url => {
        if (livreEnEdition === id) apercu.innerHTML = `<img src="${url}" alt="">`;
      }).catch(() => {});
    } else {
      boutonSupprimerImage.style.display = "none";
    }
  } else {
    document.getElementById("titreFormulaire").textContent = "Ajouter un livre";
    document.getElementById("champTitre").value = "";
    document.getElementById("champAuteur").value = "";
    document.getElementById("champTotalTomes").value = 1;
    tomesPossedesEdition = [];
    zoneSuppression.style.display = "none";
    boutonSupprimerImage.style.display = "none";
    apercu.innerHTML = iconePlaceholderCouverture();
  }

  regenererGrilleTomes();
  document.getElementById("voileFormulaire").classList.add("ouvert");
  document.getElementById("champTitre").focus({ preventScroll: true });
}

function fermerFormulaire() {
  document.getElementById("voileFormulaire").classList.remove("ouvert");
  livreEnEdition = null;
}

// ===== Tomes =====
function changerTotalTomes(delta) {
  const champ = document.getElementById("champTotalTomes");
  let val = (parseInt(champ.value, 10) || 1) + delta;
  if (val < 1) val = 1;
  if (val > 999) val = 999;
  champ.value = val;
  regenererGrilleTomes();
}

function regenererGrilleTomes() {
  let total = parseInt(document.getElementById("champTotalTomes").value, 10);
  if (!Number.isFinite(total) || total < 1) total = 1;
  if (total > 999) total = 999;
  document.getElementById("champTotalTomes").value = total;

  tomesPossedesEdition = tomesPossedesEdition.filter(n => n <= total);

  let html = "";
  for (let i = 1; i <= total; i++) {
    const possede = tomesPossedesEdition.includes(i);
    html += `<button type="button" class="case-tome${possede ? ' possede' : ''}" onclick="basculerTome(${i})">${i}</button>`;
  }
  document.getElementById("grilleTomes").innerHTML = html;
}

function basculerTome(n) {
  const idx = tomesPossedesEdition.indexOf(n);
  if (idx === -1) tomesPossedesEdition.push(n); else tomesPossedesEdition.splice(idx, 1);
  regenererGrilleTomes();
}

function cocherTousLesTomes(etat) {
  const total = parseInt(document.getElementById("champTotalTomes").value, 10) || 1;
  tomesPossedesEdition = etat ? Array.from({ length: total }, (_, i) => i + 1) : [];
  regenererGrilleTomes();
}

// ===== Couverture =====
function declencherChoixImage(source) {
  document.getElementById(source === "camera" ? "champImageCamera" : "champImageGalerie").click();
}

async function imageChoisie(event) {
  const fichier = event.target.files[0];
  event.target.value = ""; // permet de reprendre exactement la même photo ensuite
  if (!fichier) return;
  try {
    const dataUrl = await comprimerImage(fichier);
    dataUrlImageEnMemoire = dataUrl;
    imageSupprimee = false;
    document.getElementById("apercuCouverture").innerHTML = `<img src="${dataUrl}" alt="">`;
    document.getElementById("boutonSupprimerImage").style.display = "block";
  } catch (e) {
    afficherToast("Impossible de charger cette image.", true);
  }
}

function retirerImage() {
  dataUrlImageEnMemoire = null;
  imageSupprimee = true;
  document.getElementById("apercuCouverture").innerHTML = iconePlaceholderCouverture();
  document.getElementById("boutonSupprimerImage").style.display = "none";
}

// Redimensionne côté client avant envoi : les photos prises au téléphone
// peuvent peser plusieurs Mo, on les ramène à une taille raisonnable en JPEG.
function comprimerImage(fichier, maxDim = 900, quality = 0.82) {
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

// ===== Enregistrement =====
function genererIdLivre() {
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function sauvegarderCollectionAvecRetry() {
  try {
    shaLivres = await ecrireFichierJSON("livres.json", livres, shaLivres, token, "Mise à jour de la collection");
  } catch (e) {
    if (e.conflit) {
      // Le fichier distant a bougé entre-temps (autre appareil) : on relit son
      // SHA à jour et on retente l'écriture avec notre version locale.
      const frais = await lireFichierJSON("livres.json", token);
      shaLivres = await ecrireFichierJSON("livres.json", livres, frais.sha, token, "Mise à jour de la collection");
    } else {
      throw e;
    }
  }
}

async function enregistrerLivre() {
  const titre = document.getElementById("champTitre").value.trim();
  if (!titre) { afficherToast("Le titre est obligatoire.", true); return; }

  const total = Math.max(1, parseInt(document.getElementById("champTotalTomes").value, 10) || 1);
  const auteur = document.getElementById("champAuteur").value.trim();
  const possedes = tomesPossedesEdition.filter(n => n >= 1 && n <= total).sort((a, b) => a - b);

  const bouton = document.getElementById("boutonEnregistrer");
  bouton.disabled = true;
  bouton.textContent = "Enregistrement...";

  const estNouveau = !livreEnEdition;
  const id = livreEnEdition || genererIdLivre();
  const livreExistant = estNouveau ? null : livres.find(l => l.id === id);
  const ancienChemin = livreExistant ? livreExistant.image : null;
  let cheminImage = ancienChemin || null;

  try {
    if (dataUrlImageEnMemoire) {
      cheminImage = `images/${id}.jpg`;
      await uploaderImageBase64(cheminImage, dataUrlImageEnMemoire, token, `Couverture — ${titre}`);
    } else if (imageSupprimee) {
      cheminImage = null;
    }

    const donnees = {
      id,
      titre,
      auteur,
      tomesTotal: total,
      tomesPossedes: possedes,
      image: cheminImage,
      dateAjout: livreExistant ? livreExistant.dateAjout : new Date().toISOString(),
      dateModif: new Date().toISOString()
    };

    if (estNouveau) {
      livres.push(donnees);
    } else {
      livres[livres.findIndex(l => l.id === id)] = donnees;
    }

    await sauvegarderCollectionAvecRetry();

    // Nettoyage de l'ancienne couverture si elle a été remplacée ou retirée
    // (après coup, sans bloquer : la collection est déjà à jour côté utilisateur).
    if (ancienChemin && ancienChemin !== cheminImage) {
      supprimerFichierGithub(ancienChemin, token, "Remplacement de la couverture").catch(() => {});
      cacheImages.delete(ancienChemin);
    }
    if (cheminImage) cacheImages.delete(cheminImage); // forcer le rechargement de la nouvelle couverture

    fermerFormulaire();
    afficherLivres();
    afficherToast(estNouveau ? "Livre ajouté." : "Livre mis à jour.");
  } catch (e) {
    afficherToast(e.message || "Échec de l'enregistrement.", true);
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Enregistrer";
  }
}

async function supprimerLivreCourant() {
  if (!livreEnEdition) return;
  if (!confirm("Supprimer définitivement ce livre ?")) return;

  const bouton = document.getElementById("boutonEnregistrer");
  bouton.disabled = true;

  try {
    const livre = livres.find(l => l.id === livreEnEdition);
    livres = livres.filter(l => l.id !== livreEnEdition);
    await sauvegarderCollectionAvecRetry();

    if (livre && livre.image) {
      supprimerFichierGithub(livre.image, token, "Suppression d'un livre").catch(() => {});
      cacheImages.delete(livre.image);
    }

    fermerFormulaire();
    afficherLivres();
    afficherToast("Livre supprimé.");
  } catch (e) {
    afficherToast(e.message || "Échec de la suppression.", true);
  } finally {
    bouton.disabled = false;
  }
}

// ===== Toast =====
let minuteurToast = null;
function afficherToast(message, estErreur) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("erreur", !!estErreur);
  toast.classList.add("visible");
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => toast.classList.remove("visible"), 3200);
}
