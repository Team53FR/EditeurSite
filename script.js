// ===== A MODIFIER avec tes informations =====
const PROPRIETAIRE = "TON_USER_GITHUB";
const DEPOT_BDD = "mon-site-bdd";
// =============================================

async function lireFichierJSON(nomFichier, token) {
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${nomFichier}`;
  const reponse = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    }
  });

  if (!reponse.ok) {
    throw new Error("Impossible de lire le fichier (token invalide ou dépôt introuvable).");
  }

  const data = await reponse.json();
  const contenuDecode = decodeURIComponent(escape(atob(data.content)));
  return { contenu: JSON.parse(contenuDecode), sha: data.sha };
}

async function seConnecter() {
  const login = document.getElementById("login").value.trim();
  const password = document.getElementById("password").value;
  const token = document.getElementById("token").value.trim();
  const message = document.getElementById("message");

  if (!login || !password || !token) {
    message.textContent = "Merci de remplir tous les champs.";
    return;
  }

  message.textContent = "Vérification en cours...";

  try {
    const { contenu: utilisateurs } = await lireFichierJSON("users.json", token);

    const utilisateurValide = utilisateurs.some(
      u => u.login === login && u.password === password
    );

    if (utilisateurValide) {
      // Le token reste UNIQUEMENT en mémoire de session (jamais écrit dans un fichier)
      sessionStorage.setItem("gh_token", token);
      window.location.href = "editeur.html";
    } else {
      message.textContent = "Identifiants incorrects.";
    }
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}
