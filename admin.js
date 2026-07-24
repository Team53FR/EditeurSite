// Gestion des utilisateurs (réservée aux administrateurs).
// Les comptes sont stockés dans users.json du dépôt BDD : [{ login, password, role }].

let utilisateurs = [];
let shaUsers = null;
let modeEditionLogin = null; // login en cours de modification, ou null (mode ajout)

function echapper(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function formaterDateConnexion(iso) {
  if (!iso) return "Jamais connecté";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Jamais connecté";
  return "Dernière connexion : " + d.toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("gh_login");
  sessionStorage.removeItem("gh_role");
  sessionStorage.removeItem("gh_nom");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

async function chargerUtilisateurs() {
  const token = sessionStorage.getItem("gh_token");
  const login = sessionStorage.getItem("gh_login");
  const message = document.getElementById("message");

  if (!token || !login) { window.location.href = "connexion.html"; return; }

  try {
    const { contenu, sha } = await lireFichierJSON("users.json", token);
    utilisateurs = Array.isArray(contenu) ? contenu : [];
    shaUsers = sha;
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  // Contrôle basé sur les données réelles : l'utilisateur courant doit être admin
  const moi = utilisateurs.find(u => u.login === login);
  if (!moi || moi.role !== "admin") {
    alert("Accès réservé aux administrateurs.");
    window.location.href = "bibliotheque.html";
    return;
  }

  afficherUtilisateurs();
}

function afficherUtilisateurs() {
  const liste = document.getElementById("listeUtilisateurs");
  const moi = sessionStorage.getItem("gh_login");
  liste.innerHTML = "";

  utilisateurs.forEach((u) => {
    const role = u.role === "admin" ? "admin" : "user";
    const estMoi = u.login === moi;

    const li = document.createElement("li");
    li.className = "user-row" + (modeEditionLogin === u.login ? " en-edition" : "");

    const initiale = (u.login || "?").slice(0, 2).toUpperCase();
    li.innerHTML =
      `<div class="user-ava">${echapper(initiale)}</div>` +
      `<div class="user-nom">` +
        `<div>${echapper(u.login)}` +
          (u.nomAffichage ? ` <span class="nom-affichage">(${echapper(u.nomAffichage)})</span>` : "") +
          (estMoi ? ' <span class="moi">(vous)</span>' : "") +
        `</div>` +
        `<div class="user-date">${echapper(formaterDateConnexion(u.derniereConnexion))}</div>` +
      `</div>` +
      `<span class="role-badge ${role}">${role === "admin" ? "Administrateur" : "Utilisateur"}</span>` +
      `<div class="user-actions"></div>`;

    // Clic sur l'avatar ou le nom : ouvrir la fiche statistiques
    const ouvrirFiche = () => ouvrirStatsUtilisateur(u.login);
    li.querySelector(".user-ava").addEventListener("click", ouvrirFiche);
    const zoneNom = li.querySelector(".user-nom");
    zoneNom.classList.add("cliquable-stats");
    zoneNom.title = "Voir les statistiques";
    zoneNom.addEventListener("click", ouvrirFiche);

    const actions = li.querySelector(".user-actions");

    const bEdit = document.createElement("button");
    bEdit.className = "btn-mini";
    bEdit.textContent = "Modifier";
    bEdit.onclick = () => editerUtilisateur(u.login);
    actions.appendChild(bEdit);

    const bDel = document.createElement("button");
    bDel.className = "btn-mini danger";
    bDel.textContent = "Supprimer";
    if (estMoi) {
      bDel.disabled = true;
      bDel.title = "Vous ne pouvez pas supprimer votre propre compte";
      bDel.style.opacity = ".5";
      bDel.style.cursor = "not-allowed";
    } else {
      bDel.onclick = () => supprimerUtilisateur(u.login);
    }
    actions.appendChild(bDel);

    liste.appendChild(li);
  });
}

function editerUtilisateur(login) {
  const u = utilisateurs.find(x => x.login === login);
  if (!u) return;

  modeEditionLogin = login;
  document.getElementById("champLogin").value = u.login;
  document.getElementById("champLogin").disabled = true; // le login est la clé : non modifiable
  document.getElementById("champPassword").value = u.password || "";
  document.getElementById("champRole").value = u.role === "admin" ? "admin" : "user";
  document.getElementById("formTitre").textContent = "Modifier « " + u.login + " »";
  document.getElementById("formNote").textContent = "L'identifiant ne peut pas être changé (il identifie la bibliothèque de l'utilisateur).";
  document.getElementById("btnEnregistrer").textContent = "Enregistrer les modifications";
  document.getElementById("btnAnnuler").style.display = "";
  document.getElementById("message").textContent = "";

  afficherUtilisateurs();
  document.getElementById("champPassword").focus();
}

function annulerEdition() {
  modeEditionLogin = null;
  document.getElementById("champLogin").value = "";
  document.getElementById("champLogin").disabled = false;
  document.getElementById("champPassword").value = "";
  document.getElementById("champRole").value = "user";
  document.getElementById("formTitre").textContent = "Ajouter un utilisateur";
  document.getElementById("formNote").textContent = "Le mot de passe est stocké tel quel dans users.json.";
  document.getElementById("btnEnregistrer").textContent = "Ajouter";
  document.getElementById("btnAnnuler").style.display = "none";
  document.getElementById("message").textContent = "";
  afficherUtilisateurs();
}

async function enregistrerUtilisateur() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const moi = sessionStorage.getItem("gh_login");

  const login = document.getElementById("champLogin").value.trim();
  const password = document.getElementById("champPassword").value;
  const role = document.getElementById("champRole").value === "admin" ? "admin" : "user";

  if (!login || !password) {
    message.textContent = "L'identifiant et le mot de passe sont obligatoires.";
    return;
  }

  const copie = JSON.parse(JSON.stringify(utilisateurs));

  if (modeEditionLogin) {
    const u = copie.find(x => x.login === modeEditionLogin);
    if (!u) { message.textContent = "Utilisateur introuvable."; return; }
    if (u.login === moi && role !== "admin") {
      message.textContent = "Vous ne pouvez pas retirer votre propre rôle administrateur.";
      return;
    }
    u.password = password;
    u.role = role;
  } else {
    if (copie.some(x => x.login === login)) {
      message.textContent = `L'identifiant « ${login} » existe déjà.`;
      return;
    }
    copie.push({ login, password, role });
  }

  const commit = modeEditionLogin ? `Modification de l'utilisateur ${modeEditionLogin}` : `Ajout de l'utilisateur ${login}`;
  try {
    shaUsers = await ecrireFichierJSON("users.json", copie, shaUsers, token, commit);
    utilisateurs = copie;
    annulerEdition();
    message.textContent = "Enregistré avec succès.";
    setTimeout(() => { if (message.textContent === "Enregistré avec succès.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des utilisateurs a été modifiée ailleurs. Rechargez la page avant de réessayer."
      : erreur.message;
  }
}

async function supprimerUtilisateur(login) {
  const moi = sessionStorage.getItem("gh_login");
  if (login === moi) return; // garde-fou : pas d'auto-suppression

  if (!confirm(`Supprimer l'utilisateur « ${login} » ? Cette action est irréversible.\n\n(Sa bibliothèque n'est pas supprimée.)`)) return;

  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const copie = utilisateurs.filter(u => u.login !== login);

  try {
    shaUsers = await ecrireFichierJSON("users.json", copie, shaUsers, token, `Suppression de l'utilisateur ${login}`);
    utilisateurs = copie;
    if (modeEditionLogin === login) annulerEdition();
    else afficherUtilisateurs();
    message.textContent = "Utilisateur supprimé.";
    setTimeout(() => { if (message.textContent === "Utilisateur supprimé.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des utilisateurs a été modifiée ailleurs. Rechargez la page avant de réessayer."
      : erreur.message;
  }
}

// =====================================================================
//  Fiche statistiques d'un utilisateur (modale)
// =====================================================================

function texteBrutHtml(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  return (d.textContent || "").replace(/ /g, " ").trim();
}

// Temps écoulé en langage naturel
function tempsRelatif(date) {
  const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return "il y a " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "il y a " + h + " h";
  const j = Math.floor(h / 24);
  if (j < 30) return "il y a " + j + " j";
  return "le " + date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function dateComplete(date) {
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Statut approché à partir de la DERNIÈRE CONNEXION (pas de présence temps réel).
function statutConnexion(iso) {
  if (!iso) return { classe: "hors", pastille: "hors", texte: "Jamais connecté", detail: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { classe: "hors", pastille: "hors", texte: "Jamais connecté", detail: "" };
  const minutes = (Date.now() - d.getTime()) / 60000;
  const recent = minutes < 10;
  return {
    classe: recent ? "en-ligne" : "hors",
    pastille: recent ? "en-ligne" : "hors",
    texte: recent ? "Connecté récemment" : "Hors ligne",
    detail: "Dernière connexion " + tempsRelatif(d) + " · " + dateComplete(d)
  };
}

// Statistiques d'un livre
function statsLivre(livre) {
  const contenu = (Array.isArray(livre.spreads) && livre.spreads.length)
    ? livre.spreads.join(" ")
    : (Array.isArray(livre.pages) ? livre.pages.map(p => (p && p.contenu) || "").join(" ") : "");

  const boite = document.createElement("div");
  boite.innerHTML = contenu;
  const txt = (boite.textContent || "").trim();
  const mots = txt ? txt.split(/\s+/).length : 0;
  let chapitres = 0;
  boite.querySelectorAll("h2").forEach(h => { if ((h.textContent || "").trim()) chapitres++; });

  const pages = (livre.pages && livre.pages.length)
    ? livre.pages.length
    : (Array.isArray(livre.spreads) ? livre.spreads.length * 2 : 0);

  let cree = null;
  const m = /^l(\d{12,})$/.exec(livre.id || "");
  if (m) { const t = Number(m[1]); if (!isNaN(t)) cree = new Date(t); }

  return { titre: livre.titre || "Sans titre", format: livre.format || "149x210", pages, mots, chapitres, cree };
}

const LABELS_FORMAT = { "149x210": "Roman", "155x235": "Grand roman", "105x148": "Poche", "210x297": "A4" };

async function ouvrirStatsUtilisateur(login) {
  const modal = document.getElementById("modalStats");
  const contenu = document.getElementById("statsContenu");
  modal.style.display = "flex";
  contenu.innerHTML = '<div class="stats-chargement">Chargement des statistiques…</div>';

  const u = utilisateurs.find(x => x.login === login) || { login };
  const token = sessionStorage.getItem("gh_token");

  let livres = [];
  let erreur = null;
  try {
    const chemin = `bibliotheques/${slugifierLogin(login)}.json`;
    const { contenu: biblio } = await lireFichierJSON(chemin, token);
    livres = Array.isArray(biblio && biblio.livres) ? biblio.livres : [];
  } catch (e) {
    if (e.status === 404) livres = []; // l'utilisateur n'a pas encore de bibliothèque
    else erreur = e.message;
  }

  // Si la modale a été fermée entre-temps, ne rien écrire
  if (modal.style.display === "none") return;
  contenu.innerHTML = rendreStats(u, livres, erreur);
}

function fermerStats(e) {
  if (e && e.type === "click" && e.currentTarget !== e.target && e.target.id !== "modalStats") {
    // clic à l'intérieur de la carte : ignorer
  }
  document.getElementById("modalStats").style.display = "none";
}

function tuile(valeur, libelle) {
  return `<div class="stat-tuile"><b>${valeur}</b><span>${libelle}</span></div>`;
}

function rendreStats(u, livres, erreur) {
  const role = u.role === "admin" ? "admin" : "user";
  const initiale = (u.login || "?").slice(0, 2).toUpperCase();
  const st = statutConnexion(u.derniereConnexion);

  const agg = livres.reduce((a, l) => {
    const s = statsLivre(l);
    a.pages += s.pages; a.mots += s.mots; a.chapitres += s.chapitres;
    a.formats[s.format] = (a.formats[s.format] || 0) + 1;
    if (s.cree) {
      if (!a.premier || s.cree < a.premier) a.premier = s.cree;
      if (!a.dernier || s.cree > a.dernier) a.dernier = s.cree;
    }
    a.details.push(s);
    return a;
  }, { pages: 0, mots: 0, chapitres: 0, formats: {}, premier: null, dernier: null, details: [] });

  // En-tête
  let html = `
    <div class="stats-entete">
      <div class="stats-ava">${echapper(initiale)}<span class="pastille ${st.pastille}"></span></div>
      <div>
        <div class="stats-nom">${echapper(u.login)}${u.nomAffichage ? ` <span class="nom-affichage">(${echapper(u.nomAffichage)})</span>` : ""}</div>
        <div class="stats-sous">
          <span class="role-badge ${role}">${role === "admin" ? "Administrateur" : "Utilisateur"}</span>
          <span class="statut-txt ${st.classe}">${st.texte}</span>
        </div>
      </div>
    </div>
    <div class="stats-detail-connexion">${st.detail || "Ce compte ne s'est jamais connecté."}</div>
  `;

  if (erreur) {
    html += `<div class="stats-erreur">Impossible de lire la bibliothèque : ${echapper(erreur)}</div>`;
    return html;
  }

  // Tuiles principales
  html += `<div class="stats-tuiles">
    ${tuile(livres.length, "livre" + (livres.length > 1 ? "s" : ""))}
    ${tuile(agg.pages, "page" + (agg.pages > 1 ? "s" : ""))}
    ${tuile(agg.mots.toLocaleString("fr-FR"), "mot" + (agg.mots > 1 ? "s" : ""))}
    ${tuile(agg.chapitres, "chapitre" + (agg.chapitres > 1 ? "s" : ""))}
  </div>`;

  // Dates d'activité (déduites de la création des livres)
  const lignesActivite = [];
  if (agg.dernier) lignesActivite.push(`Dernier livre créé ${tempsRelatif(agg.dernier)}`);
  if (agg.premier) lignesActivite.push(`Premier livre créé ${tempsRelatif(agg.premier)}`);
  if (lignesActivite.length) {
    html += `<div class="stats-bloc"><h4>Activité</h4><ul class="stats-liste-simple">` +
      lignesActivite.map(t => `<li>${t}</li>`).join("") + `</ul></div>`;
  }

  // Répartition par format
  const formats = Object.keys(agg.formats);
  if (formats.length) {
    html += `<div class="stats-bloc"><h4>Formats utilisés</h4><div class="stats-formats">` +
      formats.map(f => `<span class="chip-format">${LABELS_FORMAT[f] || f} · ${agg.formats[f]}</span>`).join("") +
      `</div></div>`;
  }

  // Liste des livres
  if (livres.length) {
    const details = agg.details.slice().sort((a, b) => (b.cree ? b.cree.getTime() : 0) - (a.cree ? a.cree.getTime() : 0));
    html += `<div class="stats-bloc"><h4>Livres</h4><table class="stats-table"><thead><tr>
      <th>Titre</th><th>Format</th><th>Pages</th><th>Mots</th><th>Créé</th></tr></thead><tbody>` +
      details.map(s => `<tr>
        <td>${echapper(s.titre)}</td>
        <td>${LABELS_FORMAT[s.format] || s.format}</td>
        <td>${s.pages}</td>
        <td>${s.mots.toLocaleString("fr-FR")}</td>
        <td>${s.cree ? s.cree.toLocaleDateString("fr-FR") : "—"}</td>
      </tr>`).join("") +
      `</tbody></table></div>`;
  } else {
    html += `<div class="stats-vide">Cet utilisateur n'a pas encore créé de livre.</div>`;
  }

  html += `<p class="stats-note">« Connecté récemment » est déduit de la dernière connexion (moins de 10 min), pas d'une présence en temps réel.</p>`;
  return html;
}

// Fermer la modale avec Échap
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const m = document.getElementById("modalStats");
    if (m && m.style.display !== "none") fermerStats();
  }
});

chargerUtilisateurs();
