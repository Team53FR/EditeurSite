// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerCompte: "Chargement de votre compte…",
  enregistrerPseudo: "Enregistrement du pseudo…",
  changerMotDePasse: "Changement du mot de passe…",
  afficherStats: "Lecture de vos statistiques…",
});

// Page « Mon compte » : chacun modifie son pseudo et son mot de passe, et
// consulte ses propres statistiques. Aucun droit d'administrateur requis —
// les règles RLS de public.users ne laissent de toute façon lire/modifier
// que sa propre ligne.

const token = exigerConnexionCentrale();
const monLogin = localStorage.getItem("team53_login");
const monId = localStorage.getItem("team53_id");

let moi = null;

if (token) chargerCompte();

async function chargerCompte() {
  document.getElementById("champLogin").value = monLogin || "";
  try {
    const lignes = await requeteSupabase(
      `users?id=eq.${monId}&select=login,role,nom_affichage,acces,derniere_connexion`);
    moi = lignes && lignes[0];
  } catch (e) {
    document.getElementById("messagePseudo").textContent = e.message;
    return;
  }
  if (!moi) {
    document.getElementById("messagePseudo").textContent =
      "Compte introuvable dans la base. Reconnecte-toi.";
    return;
  }
  document.getElementById("champPseudo").value = moi.nom_affichage || "";
  afficherStats();
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
    await appelerFonctionSupabase("definir_mon_nom_affichage", { nouveau_nom: pseudo });
    moi.nom_affichage = pseudo;
    localStorage.setItem("team53_nom", pseudo);

    message.className = "message ok";
    message.textContent = "Pseudo enregistré, sur le portail comme sur les sites.";
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
  if (!ancien.value) { message.textContent = "Indique ton mot de passe actuel."; return; }
  if (!nouveau.value) { message.textContent = "Le nouveau mot de passe ne peut pas être vide."; return; }
  if (nouveau.value !== confirmation.value) { message.textContent = "Les deux nouveaux mots de passe diffèrent."; return; }
  if (nouveau.value === ancien.value) { message.textContent = "Le nouveau mot de passe est identique à l'ancien."; return; }

  bouton.disabled = true;
  message.textContent = "Enregistrement...";
  try {
    await appelerFonctionSupabase("changer_mon_mot_de_passe", { p_ancien: ancien.value, p_nouveau: nouveau.value });
    ancien.value = nouveau.value = confirmation.value = "";
    message.className = "message ok";
    message.textContent = "Mot de passe changé.";
  } catch (e) {
    message.textContent = e.status === 401 || /incorrect/i.test(e.message)
      ? "Le mot de passe actuel est incorrect."
      : e.message;
  } finally {
    bouton.disabled = false;
  }
}

// ----- Statistiques -----

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

async function afficherStats() {
  const zone = document.getElementById("zoneStats");
  const acces = Array.isArray(moi.acces) ? moi.acces : [];

  const cartes = [];
  cartes.push(carteStat("Compte", [
    ["Rôle", moi.role === "admin" ? "Administrateur" : "Utilisateur"],
    ["Dernière connexion", tempsRelatifCourt(moi.derniere_connexion)],
    ["Sites accessibles", acces.length ? String(acces.length) : "aucun"]
  ]));

  const travaux = [];

  if (acces.includes("editeur-livre")) {
    travaux.push(requeteSupabase(`livres?user_id=eq.${monId}&select=id,publie`).then((livres) => {
      const publies = livres.filter((l) => l.publie).length;
      return requeteSupabase(`livre_spreads?select=livre_id&livre_id=in.(${livres.map((l) => `"${l.id}"`).join(",") || "\"\""})`)
        .then((spreads) => carteStat("📖 Éditeur de livre", [
          ["Livres", String(livres.length)],
          ["Doubles-pages", String(spreads.length)],
          ["Publiés", String(publies)]
        ]))
        .catch(() => carteStat("📖 Éditeur de livre", [["Livres", String(livres.length)], ["Publiés", String(publies)]]));
    }).catch(() => carteStat("📖 Éditeur de livre", [["Livres", "—"]])));
  }

  if (acces.includes("ma-bibliotheque")) {
    travaux.push(requeteSupabase(`bibliotheque_items?user_id=eq.${monId}&select=type`).then((items) => {
      const series = items.filter((x) => x.type === "serie").length;
      return carteStat("📚 Ma Bibliothèque", [
        ["Entrées", String(items.length)],
        ["Séries", String(series)]
      ]);
    }).catch(() => carteStat("📚 Ma Bibliothèque", [["Entrées", "—"]])));
  }

  if (acces.includes("droid-fortnite")) {
    travaux.push(Promise.all([
      requeteSupabase(`droides_possedes?user_id=eq.${monId}&select=droide_id`),
      requeteSupabase(`renaissance_atteinte?user_id=eq.${monId}&select=renaissance_id`),
      requeteSupabase(`escouade_places?user_id=eq.${monId}&select=position`)
    ]).then(([possedes, renaissances, places]) => {
      const distincts = new Set(possedes.map((c) => c.droide_id)).size;
      return carteStat("🤖 Droid Fortnite", [
        ["Droïdes distincts", String(distincts)],
        ["Dont améliorations", String(possedes.length)],
        ["Renaissances", String(renaissances.length)],
        ["Escouade", places.length + " placés"]
      ]);
    }).catch(() => carteStat("🤖 Droid Fortnite", [["Droïdes distincts", "—"]])));
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
