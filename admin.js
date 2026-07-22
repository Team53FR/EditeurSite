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
        `<div>${echapper(u.login)}${estMoi ? ' <span class="moi">(vous)</span>' : ""}</div>` +
        `<div class="user-date">${echapper(formaterDateConnexion(u.derniereConnexion))}</div>` +
      `</div>` +
      `<span class="role-badge ${role}">${role === "admin" ? "Administrateur" : "Utilisateur"}</span>` +
      `<div class="user-actions"></div>`;

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

chargerUtilisateurs();
