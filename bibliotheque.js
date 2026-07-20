let bibliotheque = null;
let shaBiblio = null;
let nomFichierBiblio = null;

async function chargerBibliotheque() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  nomFichierBiblio = obtenirNomFichierBibliotheque();

  if (!token || !nomFichierBiblio) {
    window.location.href = "index.html";
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

function afficherListeLivres() {
  const liste = document.getElementById("listeLivres");
  liste.innerHTML = "";

  if (bibliotheque.livres.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Aucun livre pour l'instant. Crée ton premier livre ci-dessous.";
    li.className = "vide";
    liste.appendChild(li);
    return;
  }

  bibliotheque.livres.forEach((livre) => {
    const li = document.createElement("li");

    const nomPages = livre.pages ? livre.pages.length : 0;
    const labels = { "149x210": "14,9×21 cm", "155x235": "15,5×23,5 cm", "105x148": "Poche", "210x297": "A4" };
    const labelFormat = labels[livre.format] || "14,9×21 cm";

    const infos = document.createElement("span");
    infos.innerHTML = `<span class="titre-livre">${livre.titre}</span><span class="detail-livre">${labelFormat} · ${nomPages} page(s)</span>`;
    infos.style.flex = "1";
    infos.onclick = () => ouvrirLivre(livre.id);
    li.appendChild(infos);

    const btnSuppr = document.createElement("button");
    btnSuppr.textContent = "✕";
    btnSuppr.className = "secondaire petit danger";
    btnSuppr.title = "Supprimer ce livre";
    btnSuppr.style.marginTop = "0";
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

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("gh_login");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

chargerBibliotheque();