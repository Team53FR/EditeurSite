// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerDonnees: "Chargement des comptes…",
  enregistrerUtilisateur: "Enregistrement du compte…",
  supprimerUtilisateur: "Suppression du compte…",
});

// Panneau d'administration central (réservé aux comptes team53_role === "admin").
// Comptes dans public.users (Supabase) : id, login, role "admin"|"user",
// nom_affichage, acces: [siteId,...]. Le mot de passe n'est plus jamais
// lisible (haché) : à l'édition, le laisser vide pour ne pas le changer.
//
// Le transfert de bibliothèque entre comptes qui existait avec la BDD
// GitHub n'a pas été recréé ici (hors périmètre pour cette passe) —
// supprimer un compte efface maintenant automatiquement ses données
// personnelles (cascade en base), il n'y a plus de purge manuelle à faire.

let token = null;
let utilisateurs = [];
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
  sitesDisponibles = await chargerSites();
  construireCasesAcces([]);

  try {
    utilisateurs = await requeteSupabase(
      "users?select=id,login,role,nom_affichage,acces,derniere_connexion&order=login");
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  afficherUtilisateurs();
}

function construireCasesAcces(accesActuels) {
  // Les cases ne vivent que dans la fenêtre : au chargement de la page, elles
  // n'existent pas encore.
  const zone = document.getElementById("casesAcces");
  if (!zone) return;
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
          (u.nom_affichage ? ` <span class="nom-affichage">(${echapper(u.nom_affichage)})</span>` : "") +
          (estMoi ? ' <span class="moi">(vous)</span>' : "") +
        `</div>` +
        `<div class="user-date">${echapper(formaterDateConnexion(u.derniere_connexion))}</div>` +
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

// ===== La fiche d'un compte, en fenêtre =====

function ouvrirFenetreCompte(login) {
  fermerFenetreCompte();
  modeEditionLogin = login;

  const u = login ? utilisateurs.find((x) => x.login === login) : null;
  if (login && !u) return;
  const acces = u && Array.isArray(u.acces) ? u.acces : [];

  const fond = document.createElement("div");
  fond.id = "fenetreCompte";
  fond.className = "fenetre";
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerFenetreCompte(); });

  fond.innerHTML =
    '<div class="fenetre-carte" role="dialog" aria-modal="true" aria-label="' +
      (u ? "Modifier un compte" : "Ajouter un compte") + '">' +
      '<button class="fenetre-fermer" aria-label="Fermer">&#10005;</button>' +
      "<h2>" + (u ? "Modifier « " + echapper(u.login) + " »" : "Ajouter un compte") + "</h2>" +
      '<p class="sous-titre">' + (u
        ? "L'identifiant ne peut pas être changé : il sert de clé aux données personnelles de chaque site."
        : "Le compte sera créé avec les accès cochés.") + "</p>" +

      '<div class="champ">' +
        '<label for="champLogin">Identifiant</label>' +
        '<input type="text" id="champLogin" placeholder="identifiant" autocomplete="off"' +
          (u ? ' value="' + echapper(u.login) + '" disabled' : "") + ">" +
      "</div>" +
      '<div class="champ">' +
        '<label for="champPassword">' + (u ? "Nouveau mot de passe" : "Mot de passe") + "</label>" +
        '<input type="text" id="champPassword" placeholder="' +
          (u ? "laisser vide pour ne pas le changer" : "mot de passe") + '" autocomplete="off">' +
      "</div>" +
      '<div class="champ">' +
        '<label for="champNom">Pseudo (optionnel)</label>' +
        '<input type="text" id="champNom" placeholder="ex. Robin" autocomplete="off" value="' +
          (u ? echapper(u.nom_affichage || "") : "") + '">' +
      "</div>" +
      '<div class="champ">' +
        '<label for="champRole">Rôle</label>' +
        '<select id="champRole">' +
          '<option value="user">Utilisateur</option>' +
          '<option value="admin">Administrateur (gère les comptes)</option>' +
        "</select>" +
      "</div>" +
      '<div class="champ">' +
        "<label>Accès aux sites</label>" +
        '<div class="case-acces-sites" id="casesAcces"></div>' +
      "</div>" +

      '<p id="messageFenetre" class="message"></p>' +
      '<div class="fenetre-actions">' +
        '<button class="btn btn-fantome" id="btnAnnuler">Annuler</button>' +
        '<button class="btn btn-primaire" id="btnEnregistrer">' +
          (u ? "Enregistrer" : "Créer le compte") + "</button>" +
      "</div>" +
    "</div>";

  document.body.appendChild(fond);

  if (u) document.getElementById("champRole").value = u.role === "admin" ? "admin" : "user";
  construireCasesAcces(acces);

  fond.querySelector(".fenetre-fermer").onclick = fermerFenetreCompte;
  fond.querySelector("#btnAnnuler").onclick = fermerFenetreCompte;
  fond.querySelector("#btnEnregistrer").onclick = enregistrerUtilisateur;

  document.getElementById(u ? "champPassword" : "champLogin").focus();
  afficherUtilisateurs();
}

function fermerFenetreCompte() {
  const f = document.getElementById("fenetreCompte");
  if (f) f.remove();
  modeEditionLogin = null;
  afficherUtilisateurs();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerFenetreCompte();
});

function editerUtilisateur(login) {
  ouvrirFenetreCompte(login);
}

async function enregistrerUtilisateur() {
  const message = document.getElementById("messageFenetre") || document.getElementById("message");
  const moi = localStorage.getItem("team53_login");

  const login = document.getElementById("champLogin").value.trim();
  const password = document.getElementById("champPassword").value;
  const nomAffichage = document.getElementById("champNom").value.trim();
  const role = document.getElementById("champRole").value === "admin" ? "admin" : "user";
  const acces = accesCoches();

  if (!login) { message.textContent = "L'identifiant est obligatoire."; return; }
  if (!modeEditionLogin && !password) { message.textContent = "Le mot de passe est obligatoire pour un nouveau compte."; return; }
  if (modeEditionLogin === moi && role !== "admin") {
    message.textContent = "Vous ne pouvez pas retirer votre propre rôle administrateur.";
    return;
  }

  message.textContent = "Enregistrement...";
  try {
    if (modeEditionLogin) {
      await requeteSupabase(`users?login=eq.${encodeURIComponent(modeEditionLogin)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ nom_affichage: nomAffichage || null, role, acces })
      });
      if (password) {
        await appelerFonctionSupabase("admin_definir_mot_de_passe", { p_login: modeEditionLogin, p_nouveau_mdp: password });
      }
    } else {
      await appelerFonctionSupabase("admin_creer_compte", {
        p_login: login, p_mot_de_passe: password, p_nom_affichage: nomAffichage || null,
        p_role: role, p_acces: acces
      });
    }

    utilisateurs = await requeteSupabase(
      "users?select=id,login,role,nom_affichage,acces,derniere_connexion&order=login");

    fermerFenetreCompte();
    const messageListe = document.getElementById("message");
    if (messageListe) {
      messageListe.textContent = "Enregistré avec succès.";
      setTimeout(() => {
        if (messageListe.textContent === "Enregistré avec succès.") messageListe.textContent = "";
      }, 2500);
    }
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

async function supprimerUtilisateur(login) {
  const moi = localStorage.getItem("team53_login");
  if (login === moi) return; // garde-fou : pas d'auto-suppression

  if (!confirm(`Supprimer le compte « ${login} » ? Cette action est irréversible.\n\nIl perd l'accès à tous les sites du portail, et toutes ses données personnelles (bibliothèque, livres, progression Droid Fortnite) sont effacées avec lui.`)) return;

  const message = document.getElementById("message");
  try {
    await requeteSupabase(`users?login=eq.${encodeURIComponent(login)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    utilisateurs = utilisateurs.filter((u) => u.login !== login);
    if (modeEditionLogin === login) fermerFenetreCompte();
    else afficherUtilisateurs();
    message.textContent = "Compte et données supprimés.";
    setTimeout(() => { if (message.textContent === "Compte et données supprimés.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

chargerDonnees();
