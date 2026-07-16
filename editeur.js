let shaActuel = null;

async function chargerNotes() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON("notes.json", token);
    document.getElementById("zoneTexte").value = contenu.contenu || "";
    shaActuel = sha;
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

async function sauvegarder() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const texte = document.getElementById("zoneTexte").value;

  const nouveauContenu = {
    contenu: texte,
    derniere_modif: new Date().toISOString()
  };

  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(nouveauContenu, null, 2))));

  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/notes.json`;

  try {
    const reponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: "Mise à jour des notes",
        content: contenuEncode,
        sha: shaActuel
      })
    });

    if (!reponse.ok) {
      throw new Error("Échec de la sauvegarde. Vérifie ton token.");
    }

    const data = await reponse.json();
    shaActuel = data.content.sha; // indispensable pour la prochaine sauvegarde
    message.textContent = "Sauvegardé avec succès.";
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  window.location.href = "index.html";
}

chargerNotes();
