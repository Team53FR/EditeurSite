// ===== A MODIFIER avec tes informations =====
const PROPRIETAIRE = "Team53FR";
const DEPOT_BDD = "BDD";
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
    const erreur = new Error("Impossible de lire le fichier (token invalide ou dépôt introuvable).");
    erreur.status = reponse.status;
    throw erreur;
  }

  const data = await reponse.json();

  if (!data.content) {
    throw new Error(
      `Le fichier "${nomFichier}" est trop volumineux pour être lu via l'API GitHub (limite ≈ 1 Mo). ` +
      `Les images de couverture intégrées en base64 font probablement dépasser cette limite : réduis leur taille ou supprime-les.`
    );
  }

  let contenuDecode;
  try {
    contenuDecode = decodeURIComponent(escape(atob(data.content)));
  } catch (e) {
    throw new Error(`Le contenu de "${nomFichier}" n'a pas pu être décodé (encodage invalide).`);
  }

  if (!contenuDecode.trim()) {
    throw new Error(`Le fichier "${nomFichier}" est vide.`);
  }

  try {
    return { contenu: JSON.parse(contenuDecode), sha: data.sha };
  } catch (e) {
    throw new Error(`Le fichier "${nomFichier}" contient un JSON invalide : ${e.message}`);
  }
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
      window.location.href = "bibliotheque.html";
    } else {
      message.textContent = "Identifiants incorrects.";
    }
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}