let bibliotheque = null;
let shaBiblio = null;
let nomFichierBiblio = null;

async function chargerBibliotheque() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  nomFichierBiblio = obtenirNomFichierBibliotheque();

  if (!token || !nomFichierBiblio) {
    window.location.href = "connexion.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON(nomFichierBiblio, token);
    bibliotheque = contenu;
    shaBiblio = sha;
  } catch (erreur) {
    if (erreur.status === 404) {
      // Le fichier n'existe pas encore : on part d'une bibliothèque vide
      bibliotheque = { livres: [] };
      shaBiblio = null;
    } else {
      message.textContent = erreur.message;
      return;
    }
  }

  if (!bibliotheque.livres) bibliotheque.livres = [];

  try {
    const modifie = await migrerImagesEmbarquees(token);
    if (modifie) {
      message.textContent = "Optimisation des images de couverture en cours...";
      shaBiblio = await ecrireFichierJSON(nomFichierBiblio, bibliotheque, shaBiblio, token, "Migration des images de couverture vers des fichiers séparés");
      message.textContent = "Images de couverture optimisées avec succès.";
    }
  } catch (erreur) {
    message.textContent = "Attention : optimisation des images incomplète — " + erreur.message;
  }

  afficherListeLivres();
}

async function migrerImagesEmbarquees(token) {
  let modifie = false;
  const prefixe = obtenirPrefixeImagesUtilisateur();
  for (const livre of bibliotheque.livres) {
    for (const cle of ["couverture", "quatrieme"]) {
      const data = livre[cle];
      if (data && typeof data.image === "string" && data.image.startsWith("data:")) {
        const extension = extraireExtensionDataUrl(data.image);
        const chemin = `${prefixe}/${livre.id}_${cle}.${extension}`;
        await uploaderImageBase64(chemin, data.image, token, `Migration de l'image ${chemin}`);
        data.imageChemin = chemin;
        delete data.image;
        modifie = true;
      }
    }
  }
  return modifie;
}

function echapper(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function nomAffiche() {
  const login = sessionStorage.getItem("gh_login") || "";
  const perso = bibliotheque && bibliotheque.nomAffichage ? String(bibliotheque.nomAffichage).trim() : "";
  return perso || login || "Auteur";
}

function initialesDe(nom) {
  const mots = (nom || "").trim().split(/\s+/).filter(Boolean);
  let ini;
  if (mots.length >= 2) ini = mots[0][0] + mots[1][0];
  else ini = (nom || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  return (ini || "?").toUpperCase();
}

function remplirProfil() {
  const nom = nomAffiche();

  const elAvatar = document.getElementById("avatarInitiales");
  const elNom = document.getElementById("profilNom");
  const elLivres = document.getElementById("statLivres");
  const elPages = document.getElementById("statPages");

  if (elAvatar) elAvatar.textContent = initialesDe(nom);
  if (elNom) elNom.textContent = nom;

  // Bouton de gestion des utilisateurs réservé aux admins
  const btnAdmin = document.getElementById("btnAdmin");
  if (btnAdmin) btnAdmin.style.display = (sessionStorage.getItem("gh_role") === "admin") ? "" : "none";

  const livres = (bibliotheque && bibliotheque.livres) || [];
  const totalPages = livres.reduce((n, l) => n + (l.pages ? l.pages.length : 0), 0);
  if (elLivres) elLivres.textContent = livres.length;
  if (elPages) elPages.textContent = totalPages;
}

function afficherListeLivres() {
  remplirProfil();

  const liste = document.getElementById("listeLivres");
  liste.innerHTML = "";

  if (bibliotheque.livres.length === 0) {
    const vide = document.createElement("li");
    vide.className = "livres-vide";
    vide.innerHTML =
      '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#c9b98f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5C10.5 4.3 8.3 3.8 6 4c-1 .1-2 .3-3 .6v14c1-.3 2-.5 3-.6 2.3-.2 4.5.3 6 1.5 1.5-1.2 3.7-1.7 6-1.5 1 .1 2 .3 3 .6V4.6c-1-.3-2-.5-3-.6-2.3-.2-4.5.3-6 1.5Z"/><path d="M12 5.5v14"/></svg>' +
      "<div>Aucun livre pour l'instant.<br>Créez votre premier livre ci-dessous.</div>";
    liste.appendChild(vide);
    return;
  }

  const labels = { "149x210": "14,9×21", "155x235": "15,5×23,5", "105x148": "Poche", "210x297": "A4" };

  bibliotheque.livres.forEach((livre) => {
    const nbPages = livre.pages ? livre.pages.length : 0;
    const labelFormat = labels[livre.format] || "14,9×21";
    const couv = livre.couverture || {};
    const fond = couv.fond || "#1a1a2e";
    const couleurTexte = couv.texte || "#ffffff";
    const afficherTitre = couv.afficherTitre !== false;
    const afficherAuteur = couv.afficherAuteur !== false && livre.auteur;

    const li = document.createElement("li");
    li.className = "livre-carte";

    const couvDiv = document.createElement("div");
    couvDiv.className = "livre-couv";
    couvDiv.style.background = fond;
    couvDiv.style.color = couleurTexte;
    couvDiv.title = "Ouvrir « " + (livre.titre || "") + " »";
    couvDiv.innerHTML =
      (afficherTitre ? `<div class="c-titre">${echapper(livre.titre || "Sans titre")}</div>` : "") +
      (afficherAuteur ? `<div class="c-auteur">${echapper(livre.auteur)}</div>` : "");
    couvDiv.onclick = () => ouvrirLivre(livre.id);
    li.appendChild(couvDiv);

    const meta = document.createElement("div");
    meta.className = "livre-meta";
    meta.innerHTML =
      `<span class="l-titre">${echapper(livre.titre || "Sans titre")}</span>` +
      `<span class="l-detail">${labelFormat} · ${nbPages} p.</span>`;
    meta.querySelector(".l-titre").onclick = () => ouvrirLivre(livre.id);
    li.appendChild(meta);

    const btnSuppr = document.createElement("button");
    btnSuppr.className = "livre-suppr";
    btnSuppr.textContent = "✕";
    btnSuppr.title = "Supprimer ce livre";
    btnSuppr.onclick = (e) => { e.stopPropagation(); supprimerLivre(livre.id); };
    li.appendChild(btnSuppr);

    liste.appendChild(li);
  });
}

function ouvrirLivre(id) {
  sessionStorage.setItem("livre_id", id);
  window.location.href = "editeur.html";
}

async function creerLivre() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const champTitre = document.getElementById("titreNouveauLivre");
  const titre = champTitre.value.trim();
  const format = document.getElementById("formatNouveauLivre").value;

  if (!titre) {
    message.textContent = "Merci de donner un titre au livre.";
    return;
  }

  const nouvelId = "l" + Date.now();
  bibliotheque.livres.push({
    id: nouvelId,
    titre: titre,
    format: format,
    pages: [{ id: "p1", titre: "Page 1", contenu: "" }]
  });

  try {
    shaBiblio = await ecrireFichierJSON(nomFichierBiblio, bibliotheque, shaBiblio, token, "Ajout d'un nouveau livre");
    champTitre.value = "";
    afficherListeLivres();
    message.textContent = "Livre créé avec succès.";
  } catch (erreur) {
    bibliotheque.livres.pop();
    message.textContent = erreur.message;
  }
}

async function supprimerLivre(id) {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const livre = bibliotheque.livres.find(l => l.id === id);
  if (!livre) return;
  if (!confirm(`Supprimer le livre « ${livre.titre} » ? Cette action est irréversible.`)) return;

  bibliotheque.livres = bibliotheque.livres.filter(l => l.id !== id);

  try {
    shaBiblio = await ecrireFichierJSON(nomFichierBiblio, bibliotheque, shaBiblio, token, "Suppression d'un livre");
    afficherListeLivres();
    message.textContent = "Livre supprimé.";

    // Nettoyage des images associées (n'empêche pas la suppression si ça échoue)
    for (const cle of ["couverture", "quatrieme"]) {
      const data = livre[cle];
      if (data && data.imageChemin) {
        supprimerFichierGithub(data.imageChemin, token, "Suppression de l'image d'un livre supprimé").catch(() => {});
      }
    }
  } catch (erreur) {
    message.textContent = erreur.message;
    bibliotheque.livres.push(livre);
  }
}

// ----- Nom d'affichage (libre-service, stocké dans la bibliothèque de l'utilisateur) -----

function modifierNom() {
  const edition = document.getElementById("editionNom");
  const champ = document.getElementById("champNom");
  if (!edition || !champ) return;
  champ.value = (bibliotheque && bibliotheque.nomAffichage) ? bibliotheque.nomAffichage : "";
  edition.style.display = "flex";
  const btn = document.getElementById("btnModifNom");
  if (btn) btn.style.display = "none";
  champ.focus();
  champ.select();
}

function annulerNom() {
  const edition = document.getElementById("editionNom");
  if (edition) edition.style.display = "none";
  const btn = document.getElementById("btnModifNom");
  if (btn) btn.style.display = "";
  const message = document.getElementById("message");
  if (message) message.textContent = "";
}

async function enregistrerNom() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const champ = document.getElementById("champNom");
  if (!champ) return;

  const nouveau = champ.value.trim();
  const ancien = bibliotheque.nomAffichage || "";
  if (nouveau === ancien) { annulerNom(); return; }

  // Un nom vide = revenir à l'identifiant
  if (nouveau) bibliotheque.nomAffichage = nouveau;
  else delete bibliotheque.nomAffichage;

  try {
    shaBiblio = await ecrireFichierJSON(nomFichierBiblio, bibliotheque, shaBiblio, token, "Mise à jour du nom d'affichage");
    annulerNom();
    remplirProfil();
    message.textContent = "Nom mis à jour.";
    setTimeout(() => { if (message.textContent === "Nom mis à jour.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    // Rétablir l'ancienne valeur en cas d'échec
    if (ancien) bibliotheque.nomAffichage = ancien;
    else delete bibliotheque.nomAffichage;
    message.textContent = erreur.message;
  }
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("gh_login");
  sessionStorage.removeItem("gh_role");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

chargerBibliotheque();