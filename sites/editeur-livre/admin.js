// Gestion des utilisateurs (réservée aux administrateurs).
//
// Les comptes sont centralisés dans Web/utilisateurs.json : cette page ne
// montre donc que ceux qui ont accès à l'éditeur, et n'écrit que dans le
// fichier central, en préservant les champs qu'elle n'affiche pas (accès aux
// autres sites, dates de connexion…).
//
// Deux gestes, volontairement distincts depuis que le fichier est commun :
// « Retirer l'accès » ferme le seul éditeur, « Supprimer » efface le compte
// du portail et de tous les sites. Le second demande une confirmation qui
// nomme ce qu'on perd — sur un fichier partagé, les deux ne peuvent pas
// porter le même bouton.

let tousLesComptes = [];   // le fichier central en entier
let utilisateurs = [];     // ceux qui ont accès à l'éditeur
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


async function chargerUtilisateurs() {
  const token = localStorage.getItem("gh_token");
  const login = localStorage.getItem("gh_login");
  const message = document.getElementById("message");

  if (!token || !login) { window.location.replace("connexion.html"); return; }

  try {
    const { contenu, sha } = await lireFichierJSON(CHEMIN_UTILISATEURS, token);
    tousLesComptes = Array.isArray(contenu) ? contenu : [];
    utilisateurs = tousLesComptes.filter(aAccesAuSite);
    shaUsers = sha;
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  // Contrôle basé sur les données réelles : l'utilisateur courant doit être admin
  const moi = tousLesComptes.find(u => u.login === login);
  if (!moi || moi.role !== "admin") {
    alert("Accès réservé aux administrateurs.");
    window.location.href = "bibliotheque.html";
    return;
  }

  afficherUtilisateurs();
}

function desactiver(bouton, raison) {
  bouton.disabled = true;
  bouton.title = raison;
  bouton.style.opacity = ".5";
  bouton.style.cursor = "not-allowed";
}

function afficherUtilisateurs() {
  const liste = document.getElementById("listeUtilisateurs");
  const moi = localStorage.getItem("gh_login");
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

    // Deux gestes bien distincts, parce que le fichier des comptes est commun
    // à tout le portail : lui fermer l'éditeur, ou effacer son compte partout.
    const bAcces = document.createElement("button");
    bAcces.className = "btn-mini";
    bAcces.textContent = "Retirer l'accès";
    if (estMoi) {
      desactiver(bAcces, "Vous ne pouvez pas vous retirer l'accès");
    } else if (role === "admin") {
      // Un administrateur entre partout par son rôle : lui retirer cet accès
      // ne changerait rien, et le bouton mentirait.
      desactiver(bAcces, "Un administrateur a accès à tous les sites. Changez son rôle, ou supprimez son compte.");
    } else {
      bAcces.onclick = () => retirerAcces(u.login);
    }
    actions.appendChild(bAcces);

    const bDel = document.createElement("button");
    bDel.className = "btn-mini danger";
    bDel.textContent = "Supprimer";
    if (estMoi) {
      desactiver(bDel, "Vous ne pouvez pas supprimer votre propre compte");
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
  document.getElementById("formNote").textContent = "Le compte est créé dans le fichier central du portail, avec accès à l'éditeur.";
  document.getElementById("btnEnregistrer").textContent = "Ajouter";
  document.getElementById("btnAnnuler").style.display = "none";
  document.getElementById("message").textContent = "";
  afficherUtilisateurs();
}

async function enregistrerUtilisateur() {
  const token = localStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const moi = localStorage.getItem("gh_login");

  const login = document.getElementById("champLogin").value.trim();
  const password = document.getElementById("champPassword").value;
  const role = document.getElementById("champRole").value === "admin" ? "admin" : "user";

  if (!login || !password) {
    message.textContent = "L'identifiant et le mot de passe sont obligatoires.";
    return;
  }

  // On travaille sur le fichier central AU COMPLET : les comptes des autres
  // sites doivent se retrouver intacts dans ce qu'on réécrit.
  const copie = JSON.parse(JSON.stringify(tousLesComptes));

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
    const existant = copie.find(x => x.login === login);
    if (existant) {
      // Le compte existe ailleurs dans le portail : on lui ouvre l'éditeur
      // plutôt que de refuser un identifiant qui n'est pas un doublon.
      if (!Array.isArray(existant.acces)) existant.acces = [];
      if (existant.acces.includes(ID_SITE)) {
        message.textContent = `L'identifiant « ${login} » existe déjà.`;
        return;
      }
      existant.acces.push(ID_SITE);
      existant.password = password;
      existant.role = role;
    } else {
      copie.push({ login, password, role, nomAffichage: "", acces: [ID_SITE] });
    }
  }

  const commit = modeEditionLogin ? `Modification de l'utilisateur ${modeEditionLogin}` : `Ajout de l'utilisateur ${login}`;
  try {
    shaUsers = await ecrireFichierJSON(CHEMIN_UTILISATEURS, copie, shaUsers, token, commit);
    tousLesComptes = copie;
    utilisateurs = copie.filter(aAccesAuSite);
    annulerEdition();
    message.textContent = "Enregistré avec succès.";
    setTimeout(() => { if (message.textContent === "Enregistré avec succès.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des utilisateurs a été modifiée ailleurs. Rechargez la page avant de réessayer."
      : erreur.message;
  }
}

async function retirerAcces(login) {
  const moi = localStorage.getItem("gh_login");
  if (login === moi) return; // garde-fou : pas d'auto-retrait

  if (!confirm(`Retirer à « ${login} » l'accès à l'éditeur de livre ?\n\n` +
    "Son compte, sa bibliothèque et ses accès aux autres sites sont conservés. " +
    "La suppression complète d'un compte se fait depuis le portail central.")) return;

  const token = localStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const copie = JSON.parse(JSON.stringify(tousLesComptes));
  const u = copie.find(x => x.login === login);
  if (!u) { message.textContent = "Utilisateur introuvable."; return; }
  // Une entrée sans liste d'accès date d'avant la centralisation : elle vaut
  // « accès à tout ». Pour lui en retirer un, il faut d'abord l'écrire.
  if (!Array.isArray(u.acces)) u.acces = SITES_CONNUS.slice();
  u.acces = u.acces.filter(id => id !== ID_SITE);

  try {
    shaUsers = await ecrireFichierJSON(CHEMIN_UTILISATEURS, copie, shaUsers, token,
      `Retrait de l'accès ${ID_SITE} pour ${login}`);
    tousLesComptes = copie;
    utilisateurs = copie.filter(aAccesAuSite);
    if (modeEditionLogin === login) annulerEdition();
    else afficherUtilisateurs();
    message.textContent = "Accès retiré.";
    setTimeout(() => { if (message.textContent === "Accès retiré.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des utilisateurs a été modifiée ailleurs. Rechargez la page avant de réessayer."
      : erreur.message;
  }
}

// Suppression franche du compte, dans le fichier central : la personne perd
// le portail et tous les sites, pas seulement l'éditeur. Ses données restent
// (bibliothèque, livres, droïdes) : rien n'est effacé du dépôt, seul le
// compte disparaît.
async function supprimerUtilisateur(login) {
  const moi = localStorage.getItem("gh_login");
  if (login === moi) return; // garde-fou : pas d'auto-suppression

  if (!confirm(`Supprimer le compte « ${login} » ?\n\nIl perdra l'accès au portail ET à tous les sites, pas seulement à l'éditeur. ` +
    `Une seconde question proposera ensuite d'effacer aussi ses données.\n\nPour lui fermer le seul éditeur, utilisez « Retirer l'accès ».`)) return;

  const token = localStorage.getItem("gh_token");
  const message = document.getElementById("message");
  const copie = tousLesComptes.filter(u => u.login !== login);

  try {
    shaUsers = await ecrireFichierJSON(CHEMIN_UTILISATEURS, copie, shaUsers, token,
      `Suppression du compte ${login}`);
    tousLesComptes = copie;
    utilisateurs = copie.filter(aAccesAuSite);
    if (modeEditionLogin === login) annulerEdition();
    else afficherUtilisateurs();
    message.textContent = "Compte supprimé.";

    // Seconde question, posée après coup et jamais cochée d'avance : effacer
    // ses données est irréversible et ne se répare pas en recréant le compte.
    if (confirm(`Supprimer aussi TOUT ce que « ${login} » possédait ?\n\nSes livres, sa bibliothèque, ses images et sa progression Droid Fortnite ` +
      `seront effacés du dépôt, et ses livres publiés retirés de la liste commune.\n\nSans cela, ces fichiers restent en place : recréer le même identifiant les retrouve.`)) {
      message.textContent = "Suppression des données...";
      const rapport = await supprimerDonneesUtilisateur(login, token);
      message.textContent = "Compte supprimé. " + resumePurge(rapport);
      return;
    }
    setTimeout(() => { if (message.textContent === "Compte supprimé.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.conflit
      ? "La liste des comptes a été modifiée ailleurs. Rechargez la page avant de réessayer."
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

// Statut approché à partir de la DERNIÈRE CONNEXION (pas de présence temps réel),
// SAUF pour le compte qui consulte la page : il est forcément connecté.
function statutConnexion(iso, estMoi) {
  const valide = iso && !isNaN(new Date(iso).getTime());
  const base = valide ? "Dernière connexion " + tempsRelatif(new Date(iso)) + " · " + dateComplete(new Date(iso)) : "";

  if (estMoi) {
    return {
      classe: "en-ligne", pastille: "en-ligne", texte: "En ligne",
      detail: "Vous êtes connecté en ce moment." + (base ? " " + base : "")
    };
  }
  if (!valide) return { classe: "hors", pastille: "hors", texte: "Jamais connecté", detail: "" };

  const recent = (Date.now() - new Date(iso).getTime()) / 60000 < 10;
  return {
    classe: recent ? "en-ligne" : "hors",
    pastille: recent ? "en-ligne" : "hors",
    texte: recent ? "Connecté récemment" : "Hors ligne",
    detail: base
  };
}

function compterMots(txt) {
  const t = (txt || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// Longueur (en mots) de chaque chapitre : chaque titre h2 non vide démarre
// un nouveau chapitre.
function longueursChapitres(html) {
  const boite = document.createElement("div");
  boite.innerHTML = html || "";
  const longueurs = [];
  let courant = null; // reste null tant qu'aucun titre de chapitre n'a été vu
  boite.childNodes.forEach(n => {
    if (n.nodeType === 1 && n.tagName === "H2" && (n.textContent || "").trim()) {
      if (courant !== null) longueurs.push(courant);
      courant = 0;
    }
    if (courant !== null) courant += compterMots(n.textContent || "");
  });
  if (courant !== null) longueurs.push(courant);
  return longueurs.filter(x => x > 0);
}

// Temps de lecture estimé (~200 mots/min)
function tempsLecture(mots) {
  const min = Math.round(mots / 200);
  if (min < 1) return "moins d'1 min";
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60), m = min % 60;
  return h + " h" + (m ? " " + m : "");
}

// Statistiques d'un livre
function statsLivre(livre) {
  const contenu = (Array.isArray(livre.spreads) && livre.spreads.length)
    ? livre.spreads.join(" ")
    : (Array.isArray(livre.pages) ? livre.pages.map(p => (p && p.contenu) || "").join(" ") : "");

  const boite = document.createElement("div");
  boite.innerHTML = contenu;
  const txt = (boite.textContent || "").trim();
  const mots = compterMots(txt);
  let chapitres = 0;
  boite.querySelectorAll("h2").forEach(h => { if ((h.textContent || "").trim()) chapitres++; });

  const longueurs = longueursChapitres(contenu);
  const chapMax = longueurs.length ? Math.max.apply(null, longueurs) : 0;

  const pages = (livre.pages && livre.pages.length)
    ? livre.pages.length
    : (Array.isArray(livre.spreads) ? livre.spreads.length * 2 : 0);

  let cree = null;
  const m = /^l(\d{12,})$/.exec(livre.id || "");
  if (m) { const t = Number(m[1]); if (!isNaN(t)) cree = new Date(t); }

  const couv = livre.couverture || {};
  const quatr = livre.quatrieme || {};

  return {
    titre: livre.titre || "Sans titre",
    format: livre.format || "149x210",
    pages, mots, chapitres, cree,
    signes: txt.length,
    chapMax,
    aImageCouv: !!couv.imageChemin,
    aQuatrImage: !!quatr.imageChemin,
    aAuteur: !!(livre.auteur && String(livre.auteur).trim())
  };
}

const LABELS_FORMAT = { "149x210": "Roman", "155x235": "Grand roman", "105x148": "Poche", "210x297": "A4" };

async function ouvrirStatsUtilisateur(login) {
  const modal = document.getElementById("modalStats");
  const contenu = document.getElementById("statsContenu");
  modal.style.display = "flex";
  contenu.innerHTML = '<div class="stats-chargement">Chargement des statistiques…</div>';

  const u = utilisateurs.find(x => x.login === login) || { login };
  const token = localStorage.getItem("gh_token");

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

// Détail (mêmes stats que le résumé, mais pour UN livre)
function resumeLivreHtml(s) {
  const lignes = [
    ["Temps de lecture", "≈ " + tempsLecture(s.mots)],
    ["Signes (espaces compris)", s.signes.toLocaleString("fr-FR")],
    ["Chapitres", String(s.chapitres)]
  ];
  if (s.chapMax) lignes.push(["Chapitre le plus long", s.chapMax.toLocaleString("fr-FR") + " mots"]);
  if (s.pages) lignes.push(["Densité", Math.round(s.mots / s.pages).toLocaleString("fr-FR") + " mots/page"]);
  lignes.push(["Couverture illustrée", s.aImageCouv ? "Oui" : "Non"]);
  lignes.push(["4e de couv. illustrée", s.aQuatrImage ? "Oui" : "Non"]);
  lignes.push(["Auteur renseigné", s.aAuteur ? "Oui" : "Non"]);
  return `<dl class="stats-resume livre-resume">` +
    lignes.map(([k, v]) => `<div><dt>${echapper(k)}</dt><dd>${echapper(String(v))}</dd></div>`).join("") +
    `</dl>`;
}

function basculerDetailLivre(tr) {
  const detail = tr.nextElementSibling;
  if (!detail || !detail.classList.contains("livre-detail")) return;
  const ouvert = !detail.hidden;
  detail.hidden = ouvert;
  tr.classList.toggle("ouvert", !ouvert);
}

function rendreStats(u, livres, erreur) {
  const role = u.role === "admin" ? "admin" : "user";
  const initiale = (u.login || "?").slice(0, 2).toUpperCase();
  const estMoi = u.login === localStorage.getItem("gh_login");
  const st = statutConnexion(u.derniereConnexion, estMoi);

  const agg = livres.reduce((a, l) => {
    const s = statsLivre(l);
    a.pages += s.pages; a.mots += s.mots; a.chapitres += s.chapitres;
    a.signes += s.signes;
    if (s.mots > 0) a.avecContenu++;
    if (s.aImageCouv) a.avecImageCouv++;
    if (s.aQuatrImage) a.avecQuatrImage++;
    if (s.aAuteur) a.avecAuteur++;
    if (s.chapMax > a.chapMax) { a.chapMax = s.chapMax; a.chapMaxLivre = s.titre; }
    a.formats[s.format] = (a.formats[s.format] || 0) + 1;
    if (s.cree) {
      if (!a.premier || s.cree < a.premier) a.premier = s.cree;
      if (!a.dernier || s.cree > a.dernier) a.dernier = s.cree;
    }
    a.details.push(s);
    return a;
  }, { pages: 0, mots: 0, chapitres: 0, signes: 0, avecContenu: 0, avecImageCouv: 0,
       avecQuatrImage: 0, avecAuteur: 0, chapMax: 0, chapMaxLivre: "",
       formats: {}, premier: null, dernier: null, details: [] });

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

  // Résumé (uniquement s'il y a au moins un livre)
  if (livres.length) {
    const brouillons = livres.length - agg.avecContenu;
    const resume = [
      ["Temps de lecture estimé", "≈ " + tempsLecture(agg.mots)],
      ["Signes (espaces compris)", agg.signes.toLocaleString("fr-FR")],
      ["Moyenne par livre", Math.round(agg.mots / livres.length).toLocaleString("fr-FR") + " mots"],
      ["Livres aboutis", agg.avecContenu + " / " + livres.length + (brouillons ? " · " + brouillons + " brouillon" + (brouillons > 1 ? "s" : "") : "")],
      ["Couvertures illustrées", agg.avecImageCouv + " / " + livres.length],
      ["Auteur renseigné", agg.avecAuteur + " / " + livres.length]
    ];
    if (agg.chapMax) {
      resume.push(["Chapitre le plus long", agg.chapMax.toLocaleString("fr-FR") + " mots" + (agg.chapMaxLivre ? " · " + agg.chapMaxLivre : "")]);
    }
    html += `<div class="stats-bloc"><h4>Résumé</h4><dl class="stats-resume">` +
      resume.map(([k, v]) => `<div><dt>${echapper(k)}</dt><dd>${echapper(String(v))}</dd></div>`).join("") +
      `</dl></div>`;
  }

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

  // Liste des livres : chaque ligne se déplie pour montrer ses stats détaillées
  if (livres.length) {
    const details = agg.details.slice().sort((a, b) => (b.cree ? b.cree.getTime() : 0) - (a.cree ? a.cree.getTime() : 0));
    html += `<div class="stats-bloc"><h4>Livres <span class="h4-aide">— cliquez une ligne pour le détail</span></h4>` +
      `<table class="stats-table"><thead><tr>
        <th>Titre</th><th>Format</th><th>Pages</th><th>Mots</th><th>Créé</th></tr></thead><tbody>` +
      details.map(s => `<tr class="livre-row" onclick="basculerDetailLivre(this)">
        <td><span class="chevron">&#9656;</span>${echapper(s.titre)}</td>
        <td>${LABELS_FORMAT[s.format] || s.format}</td>
        <td>${s.pages}</td>
        <td>${s.mots.toLocaleString("fr-FR")}</td>
        <td>${s.cree ? s.cree.toLocaleDateString("fr-FR") : "—"}</td>
      </tr>
      <tr class="livre-detail" hidden><td colspan="5">${resumeLivreHtml(s)}</td></tr>`).join("") +
      `</tbody></table></div>`;
  } else {
    html += `<div class="stats-vide">Cet utilisateur n'a pas encore créé de livre.</div>`;
  }

  html += `<p class="stats-note">« En ligne » n'est en temps réel que pour le compte que vous utilisez. Pour les autres, « Connecté récemment » est déduit de la dernière connexion (moins de 10 min).</p>`;
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
