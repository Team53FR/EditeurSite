const NOM_FICHIER_BIBLIO = "bibliotheque.json";

let bibliotheque = null;
let shaBiblio = null;

async function chargerBibliotheque() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON(NOM_FICHIER_BIBLIO, token);
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
  afficherListeLivres();
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
    li.innerHTML = `<span class="titre-livre">${livre.titre}</span><span class="detail-livre">${labelFormat} · ${nomPages} page(s)</span>`;
    li.onclick = () => ouvrirLivre(livre.id);

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

  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(bibliotheque, null, 2))));
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${NOM_FICHIER_BIBLIO}`;

  const corps = {
    message: "Ajout d'un nouveau livre",
    content: contenuEncode
  };
  if (shaBiblio) corps.sha = shaBiblio;

  try {
    const reponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify(corps)
    });

    if (!reponse.ok) {
      throw new Error("Échec de la création du livre. Vérifie ton token.");
    }

    const data = await reponse.json();
    shaBiblio = data.content.sha;
    champTitre.value = "";
    afficherListeLivres();
    message.textContent = "Livre créé avec succès.";
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

chargerBibliotheque();