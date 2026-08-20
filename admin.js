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

    const bTransfert = document.createElement("button");
    bTransfert.className = "btn-mini";
    bTransfert.textContent = "Transférer";
    if (utilisateurs.length < 2) {
      bTransfert.disabled = true;
      bTransfert.title = "Il faut au moins un autre compte pour transférer des données";
      bTransfert.style.opacity = ".5";
      bTransfert.style.cursor = "not-allowed";
    } else {
      bTransfert.onclick = () => basculerFormulaireTransfert(u.login);
    }
    actions.appendChild(bTransfert);

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

    if (transfertOuvertPour === u.login) {
      liste.appendChild(construireFormulaireTransfert(u.login));
    }
  });
}

function construireFormulaireTransfert(loginSource) {
  const autres = utilisateurs.filter(x => x.login !== loginSource);
  const li = document.createElement("li");
  li.className = "bloc-carte";
  li.style.margin = "0";
  li.innerHTML =
    `<h2 style="font-size:0.95rem">Transférer les données de « ${echapper(loginSource)} »</h2>` +
    `<div class="champ">` +
      `<label for="transfertDest">Vers le compte</label>` +
      `<select id="transfertDest">` +
      autres.map(x => `<option value="${echapper(x.login)}">${echapper(x.login)}${x.nomAffichage ? " (" + echapper(x.nomAffichage) + ")" : ""}</option>`).join("") +
      `</select>` +
    `</div>` +
    `<div class="champ">` +
      `<label>Sites concernés</label>` +
      `<label class="case-acces"><input type="checkbox" id="transfertEditeurLivre"><span>📖 Éditeur de livre</span></label>` +
      `<label class="case-acces"><input type="checkbox" id="transfertMaBibliotheque"><span>📚 Ma Bibliothèque</span></label>` +
    `</div>` +
    `<div class="champ">` +
      `<label>Mode</label>` +
      `<label class="case-acces"><input type="radio" name="transfertMode" value="deplacer" checked><span>Déplacer (le compte source les perd)</span></label>` +
      `<label class="case-acces"><input type="radio" name="transfertMode" value="copier"><span>Copier (le compte source les garde aussi)</span></label>` +
    `</div>` +
    `<div style="display:flex; gap:0.7rem;">` +
      `<button class="btn btn-primaire" id="btnConfirmerTransfert">Confirmer le transfert</button>` +
      `<button class="btn btn-fantome" id="btnAnnulerTransfert">Annuler</button>` +
    `</div>` +
    `<p id="messageTransfert" class="message"></p>`;

  li.querySelector("#btnConfirmerTransfert").onclick = () => confirmerTransfert(loginSource);
  li.querySelector("#btnAnnulerTransfert").onclick = () => basculerFormulaireTransfert(loginSource);
  return li;
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

    // Rien à recopier ailleurs : les sites lisent ce fichier-ci. C'est tout
    // l'intérêt de la centralisation — un mot de passe changé l'est partout,
    // et deux fichiers ne peuvent plus diverger en silence.
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

  if (!confirm(`Supprimer le compte « ${login} » ? Cette action est irréversible.\n\nIl perd l'accès à tous les sites du portail. Ses données (bibliothèque, livres, droïdes) ne sont pas supprimées.`)) return;

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

// =====================================================================
//  Transfert de bibliothèque entre comptes
// =====================================================================
// Depuis la migration de Ma Bibliothèque (voir plus haut), les deux sites
// suivent le même pattern par compte (bibliotheques/<slug>.json +
// images/<slug>/...) — un seul mécanisme de transfert suffit pour les deux.
const CONFIG_TRANSFERT = {
  "editeur-livre": {
    dossier: "EditeurLivre",
    formeTableau: "objet", // { livres: [...] }
    champsImage: (livre) => ["couverture", "quatrieme"]
      .map(cle => ({ objet: livre[cle], champ: "imageChemin" }))
      .filter(x => x.objet && x.objet[x.champ])
  },
  "ma-bibliotheque": {
    dossier: "MaBibliotheque",
    formeTableau: "tableau", // [...]
    champsImage: (item) => (item && item.image) ? [{ objet: item, champ: "image" }] : []
  }
};

function listeDepuisContenu(contenu, forme) {
  return forme === "objet" ? (contenu && Array.isArray(contenu.livres) ? contenu.livres : []) : (Array.isArray(contenu) ? contenu : []);
}
function contenuDepuisListe(liste, forme) {
  return forme === "objet" ? { livres: liste } : liste;
}

// Transfère (déplace ou copie) TOUTE la bibliothèque d'un compte vers un
// autre, pour un site donné. Ajoute aux données déjà présentes chez le
// destinataire plutôt que de les écraser ; en cas de collision d'id, l'item
// transféré reçoit un nouvel id (rien n'est jamais perdu ni remplacé en
// silence).
async function transfererBibliotheque(siteId, loginSource, loginDest, mode) {
  const cfg = CONFIG_TRANSFERT[siteId];
  const slugSource = slugifierLoginPortail(loginSource);
  const slugDest = slugifierLoginPortail(loginDest);
  const cheminSource = `${cfg.dossier}/bibliotheques/${slugSource}.json`;
  const cheminDest = `${cfg.dossier}/bibliotheques/${slugDest}.json`;

  let source;
  try {
    source = await lireFichierJSONAbsolu(cheminSource, token);
  } catch (e) {
    if (e.status === 404) return { transferes: 0 };
    throw e;
  }

  let dest = null;
  try {
    dest = await lireFichierJSONAbsolu(cheminDest, token);
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const listeSource = listeDepuisContenu(source.contenu, cfg.formeTableau);
  const listeDest = dest ? listeDepuisContenu(dest.contenu, cfg.formeTableau) : [];
  const idsExistants = new Set(listeDest.map(x => x.id));

  for (const item of listeSource) {
    if (idsExistants.has(item.id)) item.id = item.id + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    idsExistants.add(item.id);

    for (const { objet, champ } of cfg.champsImage(item)) {
      const ancienChemin = `${cfg.dossier}/${objet[champ]}`;
      const nouveauCheminRelatif = `images/${slugDest}/${item.id}_${objet[champ].split("/").pop()}`;
      const nouveauChemin = `${cfg.dossier}/${nouveauCheminRelatif}`;
      try {
        const base64 = await telechargerImageBrute(ancienChemin, token);
        await uploaderImageAbsolu(nouveauChemin, base64, token, `Transfert vers ${loginDest}`);
        objet[champ] = nouveauCheminRelatif;
        if (mode === "deplacer") await supprimerFichierAbsolu(ancienChemin, token, `Transfert vers ${loginDest}`);
      } catch (e) {
        // Best-effort : l'item est quand même transféré, avec son ancienne image
        // si le déplacement de l'image a échoué (mieux qu'un item sans couverture).
      }
    }

    listeDest.push(item);
  }

  await ecrireFichierJSONAbsolu(cheminDest, contenuDepuisListe(listeDest, cfg.formeTableau),
    dest ? dest.sha : null, token, `Transfert de ${loginSource} vers ${loginDest}`);

  if (mode === "deplacer") {
    await supprimerFichierAbsolu(cheminSource, token, `Transfert de ${loginSource} vers ${loginDest}`);
  }

  return { transferes: listeSource.length };
}

let transfertOuvertPour = null; // login du compte source dont le formulaire de transfert est ouvert

function basculerFormulaireTransfert(login) {
  transfertOuvertPour = transfertOuvertPour === login ? null : login;
  afficherUtilisateurs();
}

async function confirmerTransfert(loginSource) {
  const loginDest = document.getElementById("transfertDest").value;
  const versEditeur = document.getElementById("transfertEditeurLivre").checked;
  const versMB = document.getElementById("transfertMaBibliotheque").checked;
  const mode = document.querySelector('input[name="transfertMode"]:checked').value;
  const message = document.getElementById("messageTransfert");

  if (!loginDest) { message.textContent = "Choisis un compte de destination."; return; }
  if (!versEditeur && !versMB) { message.textContent = "Choisis au moins un site."; return; }

  const verbe = mode === "deplacer" ? "Déplacer" : "Copier";
  const sites = [versEditeur && "Éditeur de livre", versMB && "Ma Bibliothèque"].filter(Boolean).join(" et ");
  if (!confirm(`${verbe} les données de « ${loginSource} » vers « ${loginDest} » pour : ${sites} ?` +
    (mode === "deplacer" ? "\n\nLe compte source n'aura plus ces données ensuite." : ""))) return;

  message.textContent = "Transfert en cours...";
  const resumes = [];
  try {
    if (versEditeur) {
      const r = await transfererBibliotheque("editeur-livre", loginSource, loginDest, mode);
      resumes.push(`Éditeur de livre : ${r.transferes} livre(s)`);
    }
    if (versMB) {
      const r = await transfererBibliotheque("ma-bibliotheque", loginSource, loginDest, mode);
      resumes.push(`Ma Bibliothèque : ${r.transferes} livre(s)/série(s)`);
    }
    message.className = "message ok";
    message.textContent = "Transfert terminé — " + resumes.join(" · ");
    transfertOuvertPour = null;
    afficherUtilisateurs();
  } catch (erreur) {
    message.className = "message";
    message.textContent = "Erreur pendant le transfert : " + erreur.message;
  }
}

async function lancerMigrationMaBibliotheque() {
  const message = document.getElementById("messageMigrationMB");
  message.className = "message";
  message.textContent = "Migration en cours (peut prendre un moment si beaucoup de couvertures)...";
  try {
    const resultat = await migrerMaBibliothequeVersMultiCompte(token);
    message.className = "message ok";
    if (resultat.dejaMigre) {
      message.textContent = "Déjà migré : rien à refaire.";
    } else if (resultat.rienAMigrer) {
      message.textContent = "Aucun compte Ma Bibliothèque trouvé (MaBibliotheque/compte.json absent) : rien à migrer.";
    } else {
      message.textContent = `Migration terminée pour « ${resultat.login} » : ${resultat.livres} livre(s)/série(s), ${resultat.imagesDeplacees} image(s) déplacée(s) vers un dossier séparé.`;
    }
  } catch (erreur) {
    message.className = "message";
    message.textContent = erreur.message;
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
