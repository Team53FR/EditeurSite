const NOM_FICHIER_BIBLIO = "bibliotheque.json";

let bibliotheque = null;
let shaBiblio = null;
let livreId = null;
let indexLivre = -1;
let indexActuel = 0;

async function chargerLivre() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  livreId = sessionStorage.getItem("livre_id");

  if (!token || !livreId) {
    window.location.href = "bibliotheque.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON(NOM_FICHIER_BIBLIO, token);
    bibliotheque = contenu;
    shaBiblio = sha;

    indexLivre = bibliotheque.livres.findIndex(l => l.id === livreId);
    if (indexLivre === -1) {
      message.textContent = "Livre introuvable.";
      return;
    }

    const livre = bibliotheque.livres[indexLivre];
    if (!livre.pages || livre.pages.length === 0) {
      livre.pages = [{ id: "p1", titre: "Page 1", contenu: "" }];
    }

    document.getElementById("titreLivre").textContent = livre.titre || "Mon livre";
    indexActuel = 0;
    afficherSommaire();
    afficherPage(indexActuel);
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function livreActuel() {
  return bibliotheque.livres[indexLivre];
}

function afficherSommaire() {
  const liste = document.getElementById("listePages");
  liste.innerHTML = "";

  livreActuel().pages.forEach((page, i) => {
    const li = document.createElement("li");
    li.className = i === indexActuel ? "actif" : "";

    const span = document.createElement("span");
    span.textContent = `Page ${i + 1}`;
    span.className = "libelle-page";
    span.onclick = () => allerAPage(i);

    const btnSupprimer = document.createElement("span");
    btnSupprimer.textContent = "×";
    btnSupprimer.className = "supprimer-page";
    btnSupprimer.onclick = (e) => { e.stopPropagation(); supprimerPage(i); };

    li.appendChild(span);
    li.appendChild(btnSupprimer);
    liste.appendChild(li);
  });
}

function afficherPage(i) {
  const page = livreActuel().pages[i];
  document.getElementById("zoneTexte").value = page.contenu || "";
  const total = livreActuel().pages.length;
  document.getElementById("numeroPage").textContent = `${i + 1}`;
}

function sauvegarderPageEnMemoire() {
  livreActuel().pages[indexActuel].contenu = document.getElementById("zoneTexte").value;
}

function allerAPage(i) {
  sauvegarderPageEnMemoire();
  indexActuel = i;
  afficherSommaire();
  afficherPage(indexActuel);
}

function pagePrecedente() {
  if (indexActuel > 0) allerAPage(indexActuel - 1);
}

function pageSuivante() {
  if (indexActuel < livreActuel().pages.length - 1) allerAPage(indexActuel + 1);
}

function nouvellePage() {
  sauvegarderPageEnMemoire();
  const pages = livreActuel().pages;
  const nouvelId = "p" + (pages.length + 1) + "_" + Date.now();
  pages.push({ id: nouvelId, titre: `Page ${pages.length + 1}`, contenu: "" });
  allerAPage(pages.length - 1);
}

function supprimerPage(i) {
  const pages = livreActuel().pages;
  if (pages.length <= 1) {
    document.getElementById("message").textContent = "Impossible de supprimer la dernière page.";
    return;
  }
  if (!confirm("Supprimer cette page ?")) return;

  pages.splice(i, 1);
  if (indexActuel >= pages.length) indexActuel = pages.length - 1;
  if (indexActuel === i && i > 0) indexActuel = i - 1;
  afficherSommaire();
  afficherPage(indexActuel);
}

async function sauvegarder() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  sauvegarderPageEnMemoire();

  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(bibliotheque, null, 2))));
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${NOM_FICHIER_BIBLIO}`;

  try {
    const reponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: "Mise à jour du livre",
        content: contenuEncode,
        sha: shaBiblio
      })
    });

    if (!reponse.ok) {
      throw new Error("Échec de la sauvegarde. Vérifie ton token.");
    }

    const data = await reponse.json();
    shaBiblio = data.content.sha;
    afficherSommaire();
    message.textContent = "Sauvegardé avec succès.";
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function retourBibliotheque() {
  sauvegarderPageEnMemoire();
  window.location.href = "bibliotheque.html";
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

chargerLivre();