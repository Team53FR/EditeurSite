// ===== Galerie des livres publiés (lecture seule, utilisateurs connectés) =====

let listePubliesData = [];

async function chargerPublies() {
  const token = localStorage.getItem("gh_token");
  const message = document.getElementById("message");

  if (!token || !localStorage.getItem("gh_login")) {
    window.location.href = "connexion.html";
    return;
  }

  try {
    const { contenu } = await lireIndexPublies(token);
    listePubliesData = Array.isArray(contenu) ? contenu : [];
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  // Plus récents d'abord
  listePubliesData.sort((a, b) => String(b.publieLe || "").localeCompare(String(a.publieLe || "")));
  afficherPublies();
}

function echapperP(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function afficherPublies() {
  const liste = document.getElementById("listePublies");
  const stat = document.getElementById("statPublies");
  if (stat) stat.textContent = listePubliesData.length;
  liste.innerHTML = "";

  if (listePubliesData.length === 0) {
    const vide = document.createElement("li");
    vide.className = "livres-vide";
    vide.innerHTML =
      '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#c9b98f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5C10.5 4.3 8.3 3.8 6 4c-1 .1-2 .3-3 .6v14c1-.3 2-.5 3-.6 2.3-.2 4.5.3 6 1.5 1.5-1.2 3.7-1.7 6-1.5 1 .1 2 .3 3 .6V4.6c-1-.3-2-.5-3-.6-2.3-.2-4.5.3-6 1.5Z"/><path d="M12 5.5v14"/></svg>' +
      "<div>Aucun livre publié pour l'instant.</div>";
    liste.appendChild(vide);
    return;
  }

  const labels = { "149x210": "14,9×21", "155x235": "15,5×23,5", "105x148": "Poche", "210x297": "A4" };

  listePubliesData.forEach((entree) => {
    const couv = entree.couverture || {};
    const fond = couv.fond || "#1a1a2e";
    const couleurTexte = couv.texte || "#ffffff";
    const afficherTitre = couv.afficherTitre !== false;
    const afficherAuteur = couv.afficherAuteur !== false && entree.auteur;
    const labelFormat = labels[entree.format] || "14,9×21";

    const li = document.createElement("li");
    li.className = "livre-carte";

    const couvDiv = document.createElement("div");
    couvDiv.className = "livre-couv";
    couvDiv.style.background = fond;
    couvDiv.style.color = couleurTexte;
    couvDiv.title = "Lire « " + (entree.titre || "") + " »";
    couvDiv.innerHTML =
      (afficherTitre ? `<div class="c-titre" style="${styleTexteCouv(couv, 'titre')}">${echapperP(entree.titre || "Sans titre")}</div>` : "") +
      (afficherAuteur ? `<div class="c-auteur" style="${styleTexteCouv(couv, 'auteur')}">${echapperP(entree.auteur)}</div>` : "");
    couvDiv.onclick = () => lireLivre(entree);
    li.appendChild(couvDiv);

    // Image de fond de couverture (si présente) — simple remplissage.
    if (couv.imageChemin) chargerImageFondVignette(couvDiv, couv.imageChemin);

    const meta = document.createElement("div");
    meta.className = "livre-meta";
    meta.innerHTML =
      `<span class="l-titre">${echapperP(entree.titre || "Sans titre")}</span>` +
      `<span class="l-detail">${labelFormat}</span>`;
    meta.querySelector(".l-titre").onclick = () => lireLivre(entree);
    li.appendChild(meta);

    const auteur = document.createElement("div");
    auteur.className = "l-detail";
    auteur.style.padding = "0 2px 2px";
    auteur.textContent = entree.auteur ? "par " + entree.auteur : "";
    li.appendChild(auteur);

    liste.appendChild(li);
  });
}

let cacheImagesPub = {};
async function chargerImageFondVignette(couvDiv, chemin) {
  const token = localStorage.getItem("gh_token");
  if (!token) return;
  try {
    if (!cacheImagesPub[chemin]) cacheImagesPub[chemin] = await obtenirUrlImage(chemin, token);
    couvDiv.style.backgroundImage = `url("${cacheImagesPub[chemin]}")`;
    couvDiv.style.backgroundSize = "cover";
    couvDiv.style.backgroundPosition = "center";
  } catch (e) {
    delete cacheImagesPub[chemin];
  }
}

function lireLivre(entree) {
  const params = new URLSearchParams({ u: entree.proprietaire, id: entree.id });
  window.location.href = "lecture.html?" + params.toString();
}


chargerPublies();
