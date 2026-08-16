// Panneau d'administration central (réservé aux comptes team53_role === "admin").
// Comptes stockés dans Web/utilisateurs.json :
//   [{ login, password, role: "admin"|"user", nomAffichage, acces: [siteId,...], derniereConnexion }]

let token = null;
let utilisateurs = [];
let shaUtilisateurs = null;
let sitesDisponibles = [];
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

async function chargerDonnees() {
  token = exigerAdminCentral();
  if (!token) return;

  const message = document.getElementById("message");
  try {
    sitesDisponibles = await chargerSites(token);
  } catch (e) {
    sitesDisponibles = DEFAULT_SITES;
  }
  construireCasesAcces([]);

  try {
    const { contenu, sha } = await lireFichierJSON("utilisateurs.json", token);
    utilisateurs = Array.isArray(contenu) ? contenu : [];
    shaUtilisateurs = sha;
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  afficherUtilisateurs();
}

function construireCasesAcces(accesActuels) {
  const zone = document.getElementById("casesAcces");
  zone.innerHTML = "";
  sitesDisponibles.forEach(site => {
    const label = document.createElement("label");
    label.className = "case-acces";
    const coche = accesActuels.includes(site.id) ? "checked" : "";
    label.innerHTML =
      `<input type="checkbox" value="${echapper(site.id)}" ${coche}>` +
      `<span>${echapper(site.icone || "")} ${echapper(site.nom)}</span>`;
    zone.appendChild(label);
  });
}

function accesCoches() {
  return Array.from(document.querySelectorAll("#casesAcces input:checked")).map(c => c.value);
}

function afficherUtilisateurs() {
  const liste = document.getElementById("listeUtilisateurs");
  const moi = localStorage.getItem("team53_login");
  liste.innerHTML = "";

  utilisateurs.forEach((u) => {
    const role = u.role === "admin" ? "admin" : "user";
    const estMoi = u.login === moi;
    const acces = Array.isArray(u.acces) ? u.acces : [];

    const li = document.createElement("li");
    li.className = "user-row" + (modeEditionLogin === u.login ? " en-edition" : "");

    const initiale = (u.login || "?").slice(0, 2).toUpperCase();
    const chips = acces.map(id => {
      const site = sitesDisponibles.find(s => s.id === id);
      return `<span class="chip-site">${echapper(site ? site.nom : id)}</span>`;
    }).join("") || `<span class="chip-site">Aucun accès</span>`;

    li.innerHTML =
      `<div class="user-ava">${echapper(initiale)}</div>` +
      `<div class="user-nom">` +
        `<div>${echapper(u.login)}` +
          (u.nomAffichage ? ` <span class="nom-affichage">(${echapper(u.nomAffichage)})</span>` : "") +
          (estMoi ? ' <span class="moi">(vous)</span>' : "") +
        `</div>` +
        `<div class="user-date">${echapper(formaterDateConnexion(u.derniereConnexion))}</div>` +
        `<div class="user-acces">${chips}</div>` +
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
  document.getElementById("champNom").value = u.nomAffichage || "";
  document.getElementById("champRole").value = u.role === "admin" ? "admin" : "user";
  construireCasesAcces(Array.isArray(u.acces) ? u.acces : []);
  document.getElementById("formTitre").textContent = "Modifier « " + u.login + " »";
  document.getElementById("formNote").textContent = "L'identifiant ne peut pas être changé.";
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
  document.getElementById("champNom").value = "";
  document.getElementById("champRole").value = "user";
  construireCasesAcces([]);
  document.getElementById("formTitre").textContent = "Ajouter un utilisateur";
  document.getElementById("formNote").textContent = "Le mot de passe est stocké tel quel dans Web/utilisateurs.json.";
  document.getElementById("btnEnregistrer").textContent = "Ajouter";
  document.getElementById("btnAnnuler").style.display = "none";
  document.getElementById("message").textContent = "";
  afficherUtilisateurs();
}

// Upsert silencieux dans EditeurLivre/users.json pour qu'un compte auquel on
// vient de donner accès à editeur-livre puisse aussi s'y connecter en direct
// (ce site vérifie que gh_login correspond à une entrée réelle de son propre
// users.json — voir README.md). N'écrit jamais dans les fichiers du site sauf
// pour ce seul besoin de synchronisation.
async function synchroniserEditeurLivre(loginCentral, passwordCentral, nomAffichage) {
  let liste = [];
  let sha = null;
  try {
    const r = await lireFichierJSONAbsolu("EditeurLivre/users.json", token);
    liste = Array.isArray(r.contenu) ? r.contenu : [];
    sha = r.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const existant = liste.find(u => u.login === loginCentral);
  if (existant) {
    existant.password = passwordCentral;
    if (nomAffichage) existant.nomAffichage = nomAffichage;
  } else {
    liste.push({ login: loginCentral, password: passwordCentral, role: "user", nomAffichage: nomAffichage || "" });
  }

  await ecrireFichierJSONAbsolu("EditeurLivre/users.json", liste, sha, token,
    `Synchronisation du compte ${loginCentral} depuis le portail central`);
}

async function enregistrerUtilisateur() {
  const message = document.getElementById("message");
  const moi = localStorage.getItem("team53_login");

  const login = document.getElementById("champLogin").value.trim();
  const password = document.getElementById("champPassword").value;
  const nomAffichage = document.getElementById("champNom").value.trim();
  const role = document.getElementById("champRole").value === "admin" ? "admin" : "user";
  const acces = accesCoches();

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
    u.nomAffichage = nomAffichage;
    u.role = role;
    u.acces = acces;
  } else {
    if (copie.some(x => x.login === login)) {
      message.textContent = `L'identifiant « ${login} » existe déjà.`;
      return;
    }
    copie.push({ login, password, nomAffichage, role, acces });
  }

  message.textContent = "Enregistrement...";
  const commit = modeEditionLogin ? `Modification de l'utilisateur ${modeEditionLogin}` : `Ajout de l'utilisateur ${login}`;
  try {
    shaUtilisateurs = await ecrireFichierJSON("utilisateurs.json", copie, shaUtilisateurs, token, commit);
    utilisateurs = copie;

    // Best-effort : ne doit jamais bloquer l'enregistrement du compte central.
    if (acces.includes("editeur-livre")) {
      try { await synchroniserEditeurLivre(login, password, nomAffichage); }
      catch (e) { /* ignoré : la synchro pourra être retentée en réenregistrant */ }
    }

    annulerEdition();
    message.textContent = "Enregistré avec succès.";
    setTimeout(() => { if (message.textContent === "Enregistré avec succès.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des comptes a été modifiée ailleurs. Rechargez la page avant de réessayer."
      : erreur.message;
  }
}

async function supprimerUtilisateur(login) {
  const moi = localStorage.getItem("team53_login");
  if (login === moi) return; // garde-fou : pas d'auto-suppression

  if (!confirm(`Supprimer le compte « ${login} » ? Cette action est irréversible.\n\n(Ses comptes propres à chaque site, s'ils existent, ne sont pas supprimés.)`)) return;

  const message = document.getElementById("message");
  const copie = utilisateurs.filter(u => u.login !== login);

  try {
    shaUtilisateurs = await ecrireFichierJSON("utilisateurs.json", copie, shaUtilisateurs, token, `Suppression de l'utilisateur ${login}`);
    utilisateurs = copie;
    if (modeEditionLogin === login) annulerEdition();
    else afficherUtilisateurs();
    message.textContent = "Compte supprimé.";
    setTimeout(() => { if (message.textContent === "Compte supprimé.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des comptes a été modifiée ailleurs. Rechargez la page avant de réessayer."
      : erreur.message;
  }
}

async function lancerImport() {
  const message = document.getElementById("messageImport");
  message.className = "message";
  message.textContent = "Import en cours...";
  try {
    const resultat = await importerComptesExistants(token);
    message.className = "message ok";
    message.textContent = `Import terminé : ${resultat.ajoutes} compte(s) créé(s), ${resultat.accesAjoutes} accès ajouté(s) (total ${resultat.total} compte(s)).`;
    await chargerDonnees();
  } catch (erreur) {
    message.className = "message";
    message.textContent = erreur.message;
  }
}

chargerDonnees();
