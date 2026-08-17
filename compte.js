// Page « Mon compte » : chacun modifie son pseudo et son mot de passe, et
// consulte ses propres statistiques. Aucun droit d'administrateur requis —
// on ne touche qu'à sa propre entrée de Web/utilisateurs.json.

const token = exigerConnexionCentrale();
const monLogin = localStorage.getItem("team53_login");

let utilisateurs = [];
let shaUtilisateurs = null;
let moi = null;

if (token) chargerCompte();

async function chargerCompte() {
  document.getElementById("champLogin").value = monLogin || "";
  try {
    const r = await lireFichierJSON("utilisateurs.json", token);
    utilisateurs = Array.isArray(r.contenu) ? r.contenu : [];
    shaUtilisateurs = r.sha;
  } catch (e) {
    document.getElementById("messagePseudo").textContent = e.message;
    return;
  }
  moi = utilisateurs.find((u) => u.login === monLogin) || null;
  if (!moi) {
    document.getElementById("messagePseudo").textContent =
      "Compte introuvable dans la base. Reconnecte-toi.";
    return;
  }
  document.getElementById("champPseudo").value = moi.nomAffichage || "";
  afficherStats();
}

// Réécrit utilisateurs.json en ne modifiant QUE sa propre entrée : on relit
// la version distante juste avant, pour ne pas écraser les changements qu'un
// administrateur aurait faits entre-temps sur d'autres comptes.
async function enregistrerMonEntree(modifier, messageCommit) {
  const frais = await lireFichierJSON("utilisateurs.json", token);
  const liste = Array.isArray(frais.contenu) ? frais.contenu : [];
  const entree = liste.find((u) => u.login === monLogin);
  if (!entree) throw new Error("Compte introuvable dans la base.");
  modifier(entree);
  shaUtilisateurs = await ecrireFichierJSON("utilisateurs.json", liste, frais.sha, token, messageCommit);
  utilisateurs = liste;
  moi = entree;
  return entree;
}

// ----- Pseudo -----

async function enregistrerPseudo() {
  const champ = document.getElementById("champPseudo");
  const message = document.getElementById("messagePseudo");
  const bouton = document.getElementById("btnPseudo");
  const pseudo = champ.value.trim();

  message.className = "message";
  if (!pseudo) { message.textContent = "Le pseudo ne peut pas être vide."; return; }

  bouton.disabled = true;
  message.textContent = "Enregistrement...";
  try {
    const entree = await enregistrerMonEntree(
      (u) => { u.nomAffichage = pseudo; },
      `Changement de pseudo de ${monLogin}`);

    // Le pseudo s'affiche aussi sur les sites : on le leur reporte.
    const echecs = await synchroniserTousLesSites(monLogin, entree.password, pseudo, token);
    localStorage.setItem("team53_nom", pseudo);

    message.className = "message ok";
    message.textContent = echecs.length
      ? "Pseudo enregistré. Non reporté sur : " + echecs.join(", ") + "."
      : "Pseudo enregistré.";
  } catch (e) {
    message.textContent = e.message;
  } finally {
    bouton.disabled = false;
  }
}

// ----- Mot de passe -----

async function changerMotDePasse() {
  const ancien = document.getElementById("champAncien");
  const nouveau = document.getElementById("champNouveau");
  const confirmation = document.getElementById("champConfirmation");
  const message = document.getElementById("messageMotDePasse");
  const bouton = document.getElementById("btnMotDePasse");

  message.className = "message";
  if (!moi) { message.textContent = "Compte introuvable."; return; }
  if (ancien.value !== moi.password) { message.textContent = "Le mot de passe actuel est incorrect."; return; }
  if (!nouveau.value) { message.textContent = "Le nouveau mot de passe ne peut pas être vide."; return; }
  if (nouveau.value !== confirmation.value) { message.textContent = "Les deux nouveaux mots de passe diffèrent."; return; }
  if (nouveau.value === moi.password) { message.textContent = "Le nouveau mot de passe est identique à l'ancien."; return; }

  bouton.disabled = true;
  message.textContent = "Enregistrement...";
  try {
    const motDePasse = nouveau.value;
    await enregistrerMonEntree(
      (u) => { u.password = motDePasse; },
      `Changement de mot de passe de ${monLogin}`);

    // Chaque site garde sa propre copie : sans ce report, l'ancien mot de
    // passe continuerait d'y fonctionner et le nouveau y serait refusé.
    const echecs = await synchroniserTousLesSites(monLogin, motDePasse, moi.nomAffichage || "", token);

    ancien.value = nouveau.value = confirmation.value = "";
    message.className = "message ok";
    message.textContent = echecs.length
      ? "Mot de passe changé. Non reporté sur : " + echecs.join(", ") + " — réessaie plus tard."
      : "Mot de passe changé, sur le portail et sur tous les sites.";
  } catch (e) {
    message.textContent = e.message;
  } finally {
    bouton.disabled = false;
  }
}

// ----- Statistiques -----

function compterMots(txt) {
  const t = (txt || "").replace(/<[^>]*>/g, " ").trim();
  return t ? t.split(/\s+/).length : 0;
}

function tempsRelatifCourt(iso) {
  if (!iso) return "jamais";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "jamais";
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return "il y a " + minutes + " min";
  const heures = Math.round(minutes / 60);
  if (heures < 24) return "il y a " + heures + " h";
  const jours = Math.round(heures / 24);
  if (jours < 31) return "il y a " + jours + " j";
  return d.toLocaleDateString("fr-FR");
}

// Une lecture par site, pour le seul compte courant : chaque site range la
// progression personnelle sous un nom de fichier dérivé du login.
async function lireDonneesSite(dossier, fichier) {
  try {
    const r = await lireFichierJSONAbsolu(dossier + "/" + fichier, token);
    return r.contenu;
  } catch (e) {
    return null;   // 404 = rien encore, ce n'est pas une erreur
  }
}

async function afficherStats() {
  const zone = document.getElementById("zoneStats");
  const acces = Array.isArray(moi.acces) ? moi.acces : [];
  const slug = slugifierLoginPortail(monLogin);

  const cartes = [];
  cartes.push(carteStat("Compte", [
    ["Rôle", moi.role === "admin" ? "Administrateur" : "Utilisateur"],
    ["Dernière connexion", tempsRelatifCourt(moi.derniereConnexion)],
    ["Sites accessibles", acces.length ? String(acces.length) : "aucun"]
  ]));

  const travaux = [];

  if (acces.includes("editeur-livre")) {
    travaux.push(lireDonneesSite("EditeurLivre", `bibliotheques/${slug}.json`).then((d) => {
      const livres = Array.isArray(d && d.livres) ? d.livres : (Array.isArray(d) ? d : []);
      let pages = 0, mots = 0, publies = 0;
      livres.forEach((l) => {
        pages += Array.isArray(l.pages) ? l.pages.length : 0;
        const contenu = (Array.isArray(l.spreads) && l.spreads.length)
          ? l.spreads.join(" ")
          : (Array.isArray(l.pages) ? l.pages.map((p) => (p && p.contenu) || "").join(" ") : "");
        mots += compterMots(contenu);
        if (l.publie) publies++;
      });
      return carteStat("📖 Éditeur de livre", [
        ["Livres", String(livres.length)],
        ["Pages", String(pages)],
        ["Mots écrits", mots.toLocaleString("fr-FR")],
        ["Publiés", String(publies)]
      ]);
    }));
  }

  if (acces.includes("ma-bibliotheque")) {
    travaux.push(lireDonneesSite("MaBibliotheque", `bibliotheques/${slug}.json`).then((d) => {
      const items = Array.isArray(d && d.livres) ? d.livres : (Array.isArray(d) ? d : []);
      const series = items.filter((x) => Array.isArray(x.saisons) || Array.isArray(x.tomes)).length;
      return carteStat("📚 Ma Bibliothèque", [
        ["Entrées", String(items.length)],
        ["Séries", String(series)]
      ]);
    }));
  }

  if (acces.includes("droid-fortnite")) {
    travaux.push(lireDonneesSite("DroidFortnite", `bibliotheques/${slug}.json`).then((d) => {
      const possedes = Array.isArray(d && d.droidesPossedes) ? d.droidesPossedes : [];
      const distincts = new Set(possedes.map((c) => String(c).split("::")[0])).size;
      const renaissances = Array.isArray(d && d.renaissanceAtteinte) ? d.renaissanceAtteinte.length : 0;
      const places = d && d.rendement && d.rendement.places
        ? Object.values(d.rendement.places).flat().filter(Boolean).length : 0;
      return carteStat("🤖 Droid Fortnite", [
        ["Droïdes distincts", String(distincts)],
        ["Dont améliorations", String(possedes.length)],
        ["Renaissances", String(renaissances)],
        ["Escouade", places + " placés"]
      ]);
    }));
  }

  const resultats = await Promise.all(travaux);
  zone.innerHTML = "";
  cartes.concat(resultats).forEach((html) => zone.insertAdjacentHTML("beforeend", html));
  if (!travaux.length) {
    zone.insertAdjacentHTML("beforeend",
      '<p class="sous-titre">Aucun site accessible : demande l\'accès à un administrateur.</p>');
  }
}

function carteStat(titre, lignes) {
  return '<div class="stat-groupe">' +
    "<h3>" + echapperCompte(titre) + "</h3>" +
    '<div class="stat-lignes">' +
      lignes.map(([cle, valeur]) =>
        '<div class="stat-ligne"><span>' + echapperCompte(cle) + "</span>" +
        "<strong>" + echapperCompte(valeur) + "</strong></div>").join("") +
    "</div></div>";
}

function echapperCompte(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}
