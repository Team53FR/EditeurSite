// ----- Ces actions passent par le reseau : on le dit, et on empeche d'y toucher -----
// Voir attente.js. Les actions de FOND (sauvegarde differee, chargement d'une
// vignette, migration silencieuse) n'y figurent surtout pas : les voiler
// bloquerait la page pour un travail que l'on a justement choisi de rendre
// invisible.
envelopperAttente({
  chargerBibliotheque: "Ouverture de la bibliothèque…",
  creerLivre: "Création du livre…",
  supprimerLivre: "Suppression du livre…",
  enregistrerNom: "Enregistrement du pseudo…",
});
// ouvrirStatsLivre n'y figure pas : elle montre son propre voile dans la
// fenêtre (« Lecture du livre… »), et un voile de page par-dessus cacherait
// justement ce qu'on vient d'ouvrir.

// La bibliothèque ne descend QUE les métadonnées des livres : un titre, une
// vignette et un nombre de pages. Le texte (les double-pages) reste en base
// jusqu'à ce qu'on ouvre un livre dans l'éditeur — ouvrir la bibliothèque ne
// rapatrie donc plus tous les manuscrits d'un coup, comme le faisait le
// fichier JSON unique.
let bibliotheque = null;
let moiCentral = null;   // la ligne du compte (pseudo, rôle, tutoriels vus)

async function chargerBibliotheque() {
  const message = document.getElementById("message");
  if (!exigerConnexion()) return;

  try {
    bibliotheque = await chargerBibliothequeMeta();
  } catch (erreur) {
    message.textContent = erreur.message;
    return;
  }

  // Le pseudo affiché vient du compte, pas d'une copie locale figée à la
  // dernière connexion.
  moiCentral = await rafraichirIdentiteCentrale();

  // Les séries ne sont qu'un classement : si leur lecture échoue, la
  // bibliothèque doit rester utilisable. On note l'incident et on continue.
  try {
    series = await chargerSeries();
  } catch (erreur) {
    series = [];
    message.textContent = "Séries indisponibles : " + erreur.message;
  }

  afficherSeries();
  afficherListeLivres();
  restaurerOngletBiblio();

  // Tutoriel de bienvenue au tout premier lancement (une seule fois).
  setTimeout(() => lancerTutorielBiblio(false), 500);
}

// Persiste « tutoriel vu » sur le compte, pour qu'il ne réapparaisse jamais,
// même sur un autre appareil.
async function marquerTutoVu(champ) {
  await marquerTutoVuDistant(champ);
  if (moiCentral) moiCentral[champ === "biblio" ? "tuto_biblio_vu" : "tuto_editeur_vu"] = true;
}

function lancerTutorielBiblio(forcer) {
  if (typeof lancerTutoriel !== "function") return;
  lancerTutoriel([
    { cible: null, titre: "Bienvenue 👋",
      texte: "Voici votre bibliothèque. Ce petit guide vous montre comment créer votre premier livre et où trouver les outils. Utilisez « Suivant »." },
    { cible: ".profil-in", titre: "Votre profil",
      texte: "Votre nom d'affichage et vos statistiques (nombre de livres et de pages). Le crayon ✎ permet de changer votre nom." },
    { cible: ".creer-livre", titre: "Créer un livre",
      texte: "Tout part d'ici : un titre, un format, et le bouton « Créer un livre »." },
    { cible: "#titreNouveauLivre", titre: "Le titre",
      texte: "Saisissez le titre de votre nouveau livre." },
    { cible: "#formatNouveauLivre", titre: "Le format",
      texte: "Choisissez la taille des pages (Roman, Grand roman, Poche, A4). Vous pourrez la changer plus tard dans l'éditeur." },
    { cible: "#listeLivres", titre: "Vos livres",
      texte: "Vos livres s'afficheront ici avec leur couverture. Cliquez sur l'un d'eux pour l'ouvrir dans l'éditeur, ou sur la petite ligne « format · pages » sous son titre pour voir ses statistiques : mots, chapitres, temps de lecture." },
    { cible: null, titre: "À vous de jouer ✍️",
      texte: "Créez votre premier livre, puis ouvrez-le : un second guide vous présentera tous les outils d'écriture. Bonne écriture !" }
  ], {
    forcer: forcer,
    dejaVu: tutoDejaVu(moiCentral, "biblio"),
    onTermine: () => marquerTutoVu("biblio")
  });
}

function echapper(txt) {
  const d = document.createElement("div");
  d.textContent = txt == null ? "" : String(txt);
  return d.innerHTML;
}

function nomAffiche() {
  const login = localStorage.getItem("team53_login") || "";
  const perso = (localStorage.getItem("team53_nom") || "").trim();
  return perso || login || "Auteur";
}

function initialesDe(nom) {
  const mots = (nom || "").trim().split(/\s+/).filter(Boolean);
  let ini;
  if (mots.length >= 2) ini = mots[0][0] + mots[1][0];
  else ini = (nom || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  return (ini || "?").toUpperCase();
}

function remplirProfil() {
  const nom = nomAffiche();

  const elAvatar = document.getElementById("avatarInitiales");
  const elNom = document.getElementById("profilNom");
  const elLivres = document.getElementById("statLivres");
  const elPages = document.getElementById("statPages");

  if (elAvatar) elAvatar.textContent = initialesDe(nom);
  if (elNom) elNom.textContent = nom;

  // Bouton de gestion des utilisateurs réservé aux admins
  const btnAdmin = document.getElementById("btnAdmin");
  if (btnAdmin) btnAdmin.style.display = estAdminCentral() ? "" : "none";

  // nbPages vient de la colonne du même nom : le texte des livres n'est pas
  // chargé ici, on ne peut donc plus compter les pages soi-même.
  const livres = (bibliotheque && bibliotheque.livres) || [];
  const totalPages = livres.reduce((n, l) => n + (l.nbPages || 0), 0);
  if (elLivres) elLivres.textContent = livres.length;
  if (elPages) elPages.textContent = totalPages;
}

function afficherListeLivres() {
  remplirProfil();

  const liste = document.getElementById("listeLivres");
  const compte = document.getElementById("compteLivres");
  if (compte) compte.textContent = bibliotheque.livres.length;
  liste.innerHTML = "";

  if (bibliotheque.livres.length === 0) {
    const vide = document.createElement("li");
    vide.className = "livres-vide";
    vide.innerHTML =
      '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#c9b98f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5C10.5 4.3 8.3 3.8 6 4c-1 .1-2 .3-3 .6v14c1-.3 2-.5 3-.6 2.3-.2 4.5.3 6 1.5 1.5-1.2 3.7-1.7 6-1.5 1 .1 2 .3 3 .6V4.6c-1-.3-2-.5-3-.6-2.3-.2-4.5.3-6 1.5Z"/><path d="M12 5.5v14"/></svg>' +
      "<div>Aucun livre pour l'instant.<br>Créez votre premier livre ci-dessous.</div>";
    liste.appendChild(vide);
    return;
  }

  bibliotheque.livres.forEach((livre) => {
    const nbPages = livre.nbPages || 0;
    const labelFormat = libelleFormatCourt(livre.format);
    const couv = livre.couverture || {};
    const fond = couv.fond || "#1a1a2e";
    const couleurTexte = couv.texte || "#ffffff";
    const afficherTitre = couv.afficherTitre !== false;
    const afficherAuteur = couv.afficherAuteur !== false && livre.auteur;

    const li = document.createElement("li");
    li.className = "livre-carte";

    const couvDiv = document.createElement("div");
    couvDiv.className = "livre-couv";
    couvDiv.style.background = fond;
    couvDiv.style.color = couleurTexte;
    couvDiv.title = "Ouvrir « " + (livre.titre || "") + " »";
    couvDiv.innerHTML =
      (afficherTitre ? `<div class="c-titre" style="${styleTexteCouv(couv, 'titre')}">${echapper(livre.titre || "Sans titre")}</div>` : "") +
      (afficherAuteur ? `<div class="c-auteur" style="${styleTexteCouv(couv, 'auteur')}">${echapper(livre.auteur)}</div>` : "");
    couvDiv.onclick = () => ouvrirLivre(livre.id);
    li.appendChild(couvDiv);

    // Si la couverture a une image de fond, on l'affiche par-dessus la couleur.
    // Sinon, on garde la couleur (ou le blanc) : rien à charger.
    if (couv.imageChemin) chargerImageCouvVignette(couvDiv, couv.imageChemin, livre.format, couv);

    const meta = document.createElement("div");
    meta.className = "livre-meta";
    meta.innerHTML =
      `<span class="l-titre">${echapper(livre.titre || "Sans titre")}</span>` +
      `<span class="l-detail">${labelFormat} · ${nbPages} p.</span>`;
    meta.querySelector(".l-titre").onclick = () => ouvrirLivre(livre.id);
    li.appendChild(meta);

    // Le détail chiffré du livre : la ligne « format · pages » l'annonce déjà
    // en petit, autant en faire la porte d'entrée plutôt que d'ajouter un
    // bouton de plus sur une carte qui n'en a pas la place.
    const detail = meta.querySelector(".l-detail");
    detail.classList.add("cliquable-stats");
    detail.title = "Voir les statistiques de « " + (livre.titre || "") + " »";
    detail.setAttribute("role", "button");
    detail.setAttribute("tabindex", "0");
    detail.onclick = (e) => { e.stopPropagation(); ouvrirStatsLivre(livre.id); };
    detail.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirStatsLivre(livre.id); }
    };

    // Renommer : le titre ne se changeait que dans l'éditeur de couverture,
    // une fois le livre ouvert — autant dire nulle part.
    const btnRenommer = document.createElement("button");
    btnRenommer.className = "livre-renommer";
    btnRenommer.textContent = "✎";
    btnRenommer.title = "Renommer ce livre";
    btnRenommer.setAttribute("aria-label", "Renommer « " + (livre.titre || "") + " »");
    btnRenommer.onclick = (e) => { e.stopPropagation(); renommerLivre(livre.id); };
    li.appendChild(btnRenommer);

    const btnSuppr = document.createElement("button");
    btnSuppr.className = "livre-suppr";
    btnSuppr.textContent = "✕";
    btnSuppr.title = "Supprimer ce livre";
    btnSuppr.onclick = (e) => { e.stopPropagation(); supprimerLivre(livre.id); };
    li.appendChild(btnSuppr);

    liste.appendChild(li);
  });
}

// ----- Renommer un livre -----
//
// Le titre est aussi celui imprimé sur la couverture : c'est la même donnée,
// et la changer ici la change là-bas. On ne touche QUE le titre
// (mettreAJourLivre), jamais le manuscrit — la bibliothèque n'a pas le texte
// en mémoire, et l'enregistrement complet le refuserait justement.
async function renommerLivre(id) {
  const livre = bibliotheque.livres.find((l) => l.id === id);
  if (!livre) return;

  const saisi = prompt("Nouveau titre du livre :", livre.titre || "");
  if (saisi === null) return;                       // annulé
  const titre = saisi.trim();
  if (!titre || titre === livre.titre) return;      // vide ou inchangé : rien à faire

  const message = document.getElementById("message");
  try {
    // mettreAJourLivre pose l'horodatage lui-même : le lui passer serait
    // désormais refusé comme un champ inconnu.
    await mettreAJourLivre(id, { titre });
  } catch (e) {
    message.textContent = "Renommage impossible : " + e.message;
    return;
  }
  livre.titre = titre;
  afficherListeLivres();
  afficherSeries();
  message.textContent = "Livre renommé.";
  setTimeout(() => { if (message.textContent === "Livre renommé.") message.textContent = ""; }, 3000);
}

// =====================================================================
//  Séries : plusieurs tomes d'une même histoire
//
//  Une série RANGE des livres et porte le résumé d'ensemble ; elle ne les
//  contient pas. Chaque tome reste listé dans « Mes livres » et s'ouvre,
//  s'imprime et se publie exactement comme avant — supprimer une série ne
//  supprime donc aucun manuscrit.
// =====================================================================

let series = [];
let serieEnEdition = null;   // l'id de la série ouverte, ou null si c'est une création
let tomesEnEdition = [];     // les ids des livres, dans l'ordre choisi

function livreParId(id) {
  return bibliotheque.livres.find((l) => l.id === id) || null;
}

// Les tomes d'une série, dans l'ordre. `tome` fait foi ; à défaut (un livre
// rattaché sans numéro), on retombe sur l'ordre de création.
function tomesDeLaSerie(serieId) {
  return bibliotheque.livres
    .filter((l) => l.serieId === serieId)
    .sort((a, b) => {
      const ta = typeof a.tome === "number" ? a.tome : Infinity;
      const tb = typeof b.tome === "number" ? b.tome : Infinity;
      if (ta !== tb) return ta - tb;
      return String(a.dateCreation || "").localeCompare(String(b.dateCreation || ""));
    });
}

// ----- Les deux onglets -----
//
// Un résumé de série tient plusieurs paragraphes : empilés sous les livres,
// ils poussaient la grille hors de l'écran. L'onglet choisi est mémorisé sur
// l'appareil — on revient souvent d'un livre vers la liste, et retomber
// chaque fois sur l'autre onglet serait pénible.
const CLE_ONGLET_BIBLIO = "el_ongletBiblio";

function choisirOngletBiblio(nom) {
  const cible = nom === "series" ? "series" : "livres";
  try { localStorage.setItem(CLE_ONGLET_BIBLIO, cible); } catch (e) {}

  [["livres", "ongletLivres", "panneauLivres"], ["series", "ongletSeries", "panneauSeries"]]
    .forEach(([id, ongletId, panneauId]) => {
      const onglet = document.getElementById(ongletId);
      const panneau = document.getElementById(panneauId);
      const actif = id === cible;
      if (onglet) {
        onglet.classList.toggle("actif", actif);
        onglet.setAttribute("aria-selected", actif ? "true" : "false");
      }
      if (panneau) panneau.hidden = !actif;
    });
}

function restaurerOngletBiblio() {
  let choix = "livres";
  try { choix = localStorage.getItem(CLE_ONGLET_BIBLIO) || "livres"; } catch (e) {}
  // Retomber sur les livres si l'onglet mémorisé n'a plus rien à montrer :
  // arriver sur une page vide donne l'impression d'avoir tout perdu.
  if (choix === "series" && !series.length) choix = "livres";
  choisirOngletBiblio(choix);
}

function afficherSeries() {
  const liste = document.getElementById("listeSeries");
  const compte = document.getElementById("compteSeries");
  if (compte) compte.textContent = series.length;
  if (!liste) return;

  liste.innerHTML = "";

  if (!series.length) {
    const vide = document.createElement("li");
    vide.className = "livres-vide";
    vide.innerHTML =
      "<div>Aucune série pour l'instant.<br>Une série regroupe les tomes d'une même " +
      "histoire et porte son résumé.<br>Vos livres, eux, restent listés dans « Mes livres ».</div>";
    liste.appendChild(vide);
    return;
  }
  series.forEach((serie) => {
    const tomes = tomesDeLaSerie(serie.id);

    const li = document.createElement("li");
    li.className = "serie-carte";

    const entete = document.createElement("div");
    entete.className = "serie-entete";
    entete.innerHTML =
      '<span class="serie-nom">' + echapper(serie.titre || "Série sans titre") + "</span>" +
      '<span class="serie-compte">' + tomes.length +
        (tomes.length > 1 ? " tomes" : " tome") + "</span>";
    li.appendChild(entete);

    if (serie.resume) {
      const resume = document.createElement("p");
      resume.className = "serie-resume-texte";
      resume.textContent = serie.resume;
      li.appendChild(resume);
    }

    const ol = document.createElement("ol");
    ol.className = "serie-liste-tomes";
    if (!tomes.length) {
      const vide = document.createElement("li");
      vide.className = "serie-vide";
      vide.textContent = "Aucun tome pour l'instant.";
      ol.appendChild(vide);
    } else {
      tomes.forEach((l) => {
        const item = document.createElement("li");
        const lien = document.createElement("button");
        lien.type = "button";
        lien.className = "serie-tome-lien";
        lien.textContent = l.titre || "Sans titre";
        lien.title = "Ouvrir « " + (l.titre || "") + " »";
        lien.onclick = () => ouvrirLivre(l.id);
        item.appendChild(lien);
        const pages = document.createElement("span");
        pages.className = "serie-tome-pages";
        pages.textContent = (l.nbPages || 0) + " p.";
        item.appendChild(pages);
        ol.appendChild(item);
      });
    }
    li.appendChild(ol);

    const modifier = document.createElement("button");
    modifier.type = "button";
    modifier.className = "btn-mini serie-modifier";
    modifier.textContent = "Modifier";
    modifier.onclick = () => ouvrirEditionSerie(serie.id);
    li.appendChild(modifier);

    liste.appendChild(li);
  });
}

// ----- La fenêtre : créer ou modifier une série -----

function ouvrirEditionSerie(id) {
  const modal = document.getElementById("modalSerie");
  if (!modal) return;

  const serie = id ? series.find((s) => s.id === id) : null;
  serieEnEdition = serie ? serie.id : null;
  tomesEnEdition = serie ? tomesDeLaSerie(serie.id).map((l) => l.id) : [];

  document.getElementById("serieTitreFenetre").textContent =
    serie ? "Modifier la série" : "Nouvelle série";
  document.getElementById("serieTitre").value = serie ? serie.titre : "";
  document.getElementById("serieResume").value = serie ? serie.resume : "";
  document.getElementById("serieMessage").textContent = "";
  // Rien à supprimer tant que la série n'existe pas.
  document.getElementById("serieSupprimer").hidden = !serie;

  rendreTomesEnEdition();
  modal.style.display = "flex";
  document.getElementById("serieTitre").focus();
}

function fermerEditionSerie() {
  const modal = document.getElementById("modalSerie");
  if (modal) modal.style.display = "none";
  serieEnEdition = null;
  tomesEnEdition = [];
}

// La liste des tomes choisis, et le menu des livres encore disponibles.
function rendreTomesEnEdition() {
  const ul = document.getElementById("serieTomes");
  const menu = document.getElementById("serieAjoutLivre");
  if (!ul || !menu) return;

  ul.innerHTML = "";
  tomesEnEdition.forEach((livreId, i) => {
    const livre = livreParId(livreId);
    const li = document.createElement("li");
    li.className = "serie-tome-ligne";

    const num = document.createElement("span");
    num.className = "serie-tome-num";
    num.textContent = "Tome " + (i + 1);
    li.appendChild(num);

    const nom = document.createElement("span");
    nom.className = "serie-tome-nom";
    nom.textContent = livre ? (livre.titre || "Sans titre") : "(livre introuvable)";
    li.appendChild(nom);

    const monter = document.createElement("button");
    monter.type = "button";
    monter.className = "btn-mini";
    monter.textContent = "↑";
    monter.title = "Monter d'un rang";
    monter.disabled = i === 0;
    monter.onclick = () => { deplacerTome(i, -1); };
    li.appendChild(monter);

    const descendre = document.createElement("button");
    descendre.type = "button";
    descendre.className = "btn-mini";
    descendre.textContent = "↓";
    descendre.title = "Descendre d'un rang";
    descendre.disabled = i === tomesEnEdition.length - 1;
    descendre.onclick = () => { deplacerTome(i, 1); };
    li.appendChild(descendre);

    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "btn-mini";
    retirer.textContent = "Retirer";
    retirer.title = "Retirer de la série (le livre n'est pas supprimé)";
    retirer.onclick = () => {
      tomesEnEdition.splice(i, 1);
      rendreTomesEnEdition();
    };
    li.appendChild(retirer);

    ul.appendChild(li);
  });

  if (!tomesEnEdition.length) {
    const vide = document.createElement("li");
    vide.className = "serie-vide";
    vide.textContent = "Aucun tome. Ajoutez-en un ci-dessous.";
    ul.appendChild(vide);
  }

  // Un livre ne peut appartenir qu'à une série : on ne propose donc que les
  // livres libres, plus ceux déjà rattachés à CELLE-CI (pour pouvoir les
  // retirer puis les remettre sans quitter la fenêtre).
  const dispo = bibliotheque.livres.filter((l) =>
    !tomesEnEdition.includes(l.id) && (!l.serieId || l.serieId === serieEnEdition));

  menu.innerHTML = "";
  if (!dispo.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Aucun livre disponible";
    menu.appendChild(opt);
    menu.disabled = true;
  } else {
    menu.disabled = false;
    dispo.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.titre || "Sans titre";
      menu.appendChild(opt);
    });
  }
}

function deplacerTome(i, sens) {
  const j = i + sens;
  if (j < 0 || j >= tomesEnEdition.length) return;
  const tmp = tomesEnEdition[i];
  tomesEnEdition[i] = tomesEnEdition[j];
  tomesEnEdition[j] = tmp;
  rendreTomesEnEdition();
}

function ajouterTomeAlaSerie() {
  const menu = document.getElementById("serieAjoutLivre");
  if (!menu || !menu.value) return;
  tomesEnEdition.push(menu.value);
  rendreTomesEnEdition();
}

async function enregistrerSerie() {
  const message = document.getElementById("serieMessage");
  const titre = document.getElementById("serieTitre").value.trim();
  const resume = document.getElementById("serieResume").value.trim();

  if (!titre) {
    message.textContent = "Donnez un titre à la série.";
    document.getElementById("serieTitre").focus();
    return;
  }

  try {
    let id = serieEnEdition;
    if (id) {
      await mettreAJourSerie(id, { titre, resume: resume || null });
      const s = series.find((x) => x.id === id);
      if (s) { s.titre = titre; s.resume = resume; }
    } else {
      id = await creerSerieDistante(titre, resume);
      series.push({ id, titre, resume, dateCreation: new Date().toISOString() });
    }

    // Les livres qui étaient dans la série et n'y sont plus : on les détache.
    const avant = tomesDeLaSerie(id).map((l) => l.id);
    const retires = avant.filter((livreId) => !tomesEnEdition.includes(livreId));

    for (const livreId of retires) {
      await definirSerieDuLivre(livreId, null);
      const l = livreParId(livreId);
      if (l) { l.serieId = null; l.tome = null; }
    }
    // Puis on (re)numérote ceux qui restent, dans l'ordre affiché.
    for (let i = 0; i < tomesEnEdition.length; i++) {
      const livreId = tomesEnEdition[i];
      await definirSerieDuLivre(livreId, id, i + 1);
      const l = livreParId(livreId);
      if (l) { l.serieId = id; l.tome = i + 1; }
    }
  } catch (e) {
    message.textContent = "Enregistrement impossible : " + e.message;
    return;
  }

  fermerEditionSerie();
  afficherSeries();
  afficherListeLivres();
  // On vient de créer ou de modifier une série : autant la montrer, même si
  // l'on partait de l'onglet des livres.
  choisirOngletBiblio("series");
}

async function supprimerSerieCourante() {
  if (!serieEnEdition) return;
  const serie = series.find((s) => s.id === serieEnEdition);
  const nb = tomesDeLaSerie(serieEnEdition).length;

  if (!confirm("Supprimer la série « " + (serie ? serie.titre : "") + " » ?\n\n" +
      (nb ? "Ses " + nb + " tome(s) ne seront PAS supprimés : ils redeviennent des livres sans série.\n"
          : "") +
      "Le résumé de l'histoire, lui, sera perdu.")) {
    return;
  }

  const message = document.getElementById("serieMessage");
  try {
    await supprimerSerieDistante(serieEnEdition);
  } catch (e) {
    message.textContent = "Suppression impossible : " + e.message;
    return;
  }

  // La base a mis serie_id à NULL toute seule (« on delete set null ») :
  // on aligne l'état local sur elle plutôt que de recharger la page.
  bibliotheque.livres.forEach((l) => {
    if (l.serieId === serieEnEdition) { l.serieId = null; l.tome = null; }
  });
  series = series.filter((s) => s.id !== serieEnEdition);

  fermerEditionSerie();
  afficherSeries();
  afficherListeLivres();
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modalSerie");
  if (e.key === "Escape" && modal && modal.style.display !== "none") fermerEditionSerie();
});

// =====================================================================
//  Statistiques d'un livre
//
//  Ces chiffres existaient déjà, mais dans la fiche qu'un ADMINISTRATEUR
//  ouvrait sur un autre compte (l'ancien utilisateurs.html). Cette page a
//  disparu quand la gestion des comptes est passée au portail central, et
//  les statistiques sont tombées avec elle — sans que ce soit voulu : c'est
//  l'auteur du livre, pas l'administrateur, qui a le plus de raisons de
//  savoir où en est son manuscrit. Elles reviennent donc ici, sur la carte
//  du livre, pour son propriétaire.
// =====================================================================

// Temps de lecture estimé, sur la base de 200 mots par minute.
function tempsLecture(mots) {
  const min = Math.round(mots / 200);
  if (min < 1) return "moins d'1 min";
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60), m = min % 60;
  return h + " h" + (m ? " " + m : "");
}

// Longueur de chaque chapitre, en mots. Ce qui précède le premier titre
// (avant-propos, dédicace) n'en est pas un et n'est pas compté.
function longueursChapitres(html) {
  const boite = document.createElement("div");
  boite.innerHTML = html || "";
  const longueurs = [];
  let courant = null;
  boite.childNodes.forEach((n) => {
    if (n.nodeType === 1 && n.tagName === "H2" && (n.textContent || "").trim()) {
      if (courant !== null) longueurs.push(courant);
      courant = 0;
    }
    if (courant === null) return;
    courant += compterMots(n.nodeType === 1 ? n : (n.textContent || ""));
  });
  if (courant !== null) longueurs.push(courant);
  return longueurs.filter((x) => x > 0);
}

function statsLivre(livre) {
  const contenu = Array.isArray(livre.spreads) ? livre.spreads.join(" ") : "";

  const boite = document.createElement("div");
  boite.innerHTML = contenu;

  let chapitres = 0;
  boite.querySelectorAll("h2").forEach((h) => {
    if ((h.textContent || "").trim()) chapitres++;
  });

  const longueurs = longueursChapitres(contenu);
  const mots = compterMots(contenu);
  // versLivreMemoire a déjà fait le calcul ; nombreDePages(), lui, attend une
  // LIGNE de base et rendrait 0 sur l'objet en mémoire.
  const pages = livre.nbPages
    || (Array.isArray(livre.pages) ? livre.pages.length : 0)
    || (Array.isArray(livre.spreads) ? livre.spreads.length * 2 : 0);
  const couv = livre.couverture || {};
  const quatr = livre.quatrieme || {};

  return {
    mots,
    pages,
    chapitres,
    signes: texteAvecRuptures(contenu).trim().length,
    chapMax: longueurs.length ? Math.max.apply(null, longueurs) : 0,
    chapMin: longueurs.length ? Math.min.apply(null, longueurs) : 0,
    chapMoyen: longueurs.length
      ? Math.round(longueurs.reduce((a, b) => a + b, 0) / longueurs.length) : 0,
    aImageCouv: !!couv.imageChemin,
    aQuatrImage: !!quatr.imageChemin,
    aAuteur: !!(livre.auteur && String(livre.auteur).trim()),
    publie: !!livre.publie
  };
}

function tuileStat(valeur, libelle) {
  return '<div class="stat-tuile"><b>' + valeur + "</b><span>" + libelle + "</span></div>";
}

function rendreStatsLivre(livre, s) {
  const nb = (n) => n.toLocaleString("fr-FR");

  const lignes = [
    ["Temps de lecture", "≈ " + tempsLecture(s.mots)],
    ["Signes (espaces compris)", nb(s.signes)],
    ["Format", libelleFormat(livre.format)]
  ];
  if (s.pages) lignes.push(["Densité", nb(Math.round(s.mots / s.pages)) + " mots/page"]);
  if (s.chapitres) {
    lignes.push(["Chapitre le plus long", nb(s.chapMax) + " mots"]);
    lignes.push(["Chapitre le plus court", nb(s.chapMin) + " mots"]);
    lignes.push(["Chapitre moyen", nb(s.chapMoyen) + " mots"]);
  }
  lignes.push(["Auteur renseigné", s.aAuteur ? "Oui" : "Non"]);
  lignes.push(["Couverture illustrée", s.aImageCouv ? "Oui" : "Non"]);
  lignes.push(["4ᵉ de couverture illustrée", s.aQuatrImage ? "Oui" : "Non"]);
  lignes.push(["Publié", s.publie ? "Oui" : "Non"]);

  return '<div class="stats-entete">' +
      '<div><div class="stats-nom">' + echapper(livre.titre || "Sans titre") + "</div>" +
      (s.aAuteur ? '<div class="stats-sous">' + echapper(livre.auteur) + "</div>" : "") +
      "</div></div>" +
    '<div class="stats-tuiles">' +
      tuileStat(nb(s.mots), "mots") +
      tuileStat(nb(s.pages), s.pages > 1 ? "pages" : "page") +
      tuileStat(nb(s.chapitres), s.chapitres > 1 ? "chapitres" : "chapitre") +
      tuileStat(tempsLecture(s.mots), "de lecture") +
    "</div>" +
    '<div class="stats-bloc"><h4>Détail</h4><dl class="stats-resume">' +
      lignes.map(([k, v]) =>
        "<div><dt>" + echapper(k) + "</dt><dd>" + echapper(String(v)) + "</dd></div>").join("") +
    "</dl></div>" +
    '<p class="stats-note">Le nombre de pages est celui du découpage actuel : ' +
    "il change avec le format, l'interligne et l'espace au-dessus des titres.</p>";
}

async function ouvrirStatsLivre(id) {
  const modal = document.getElementById("modalStats");
  const contenu = document.getElementById("statsContenu");
  if (!modal || !contenu) return;

  modal.style.display = "flex";
  contenu.innerHTML = '<div class="stats-chargement">Lecture du livre…</div>';

  // La bibliothèque ne descend que les métadonnées : le texte doit être
  // rapatrié pour être compté.
  let livre;
  try {
    livre = await chargerLivreComplet(id);
  } catch (e) {
    // La fenêtre a pu être refermée entre-temps : ne rien écrire dedans.
    if (modal.style.display === "none") return;
    contenu.innerHTML = '<div class="stats-erreur">Impossible de lire ce livre : ' +
      echapper(e.message) + "</div>";
    return;
  }

  if (modal.style.display === "none") return;
  contenu.innerHTML = rendreStatsLivre(livre, statsLivre(livre));
}

function fermerStatsLivre() {
  const modal = document.getElementById("modalStats");
  if (modal) modal.style.display = "none";
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modalStats");
  if (e.key === "Escape" && modal && modal.style.display !== "none") fermerStatsLivre();
});

// Dimensions (mm) des formats, pour recalculer la taille de page de l'éditeur
// à laquelle les décalages (imgOffsetX/Y) ont été enregistrés.
const FORMATS_VIGNETTE = {
  "149x210": { larg: 149, haut: 210 },
  "155x235": { larg: 155, haut: 235 },
  "105x148": { larg: 105, haut: 148 },
  "210x297": { larg: 210, haut: 297 },
  "kdp5585": { larg: 139.7, haut: 215.9 },
  "kdp150210": { larg: 150, haut: 210 },
};

// Reproduit le calcul de taille de page de l'éditeur (appliquerFormatPage),
// car les décalages de l'image sont exprimés en pixels relatifs à cette taille.
function dimensionsPageReference(formatKey) {
  const f = resoudreFormat(FORMATS_VIGNETTE, formatKey, "149x210");
  const ratio = f.haut / f.larg;
  const sommaireLarg = 240, margesH = 32, barresH = 56 + 52 + 10 + 32 + 10, gapPages = 26, margeV = 32;
  const dispoW = window.innerWidth - sommaireLarg - margesH;
  const dispoH = window.innerHeight - barresH - margeV;
  let largPx = Math.floor((dispoW - gapPages) / 2);
  let hautPx = Math.round(largPx * ratio);
  if (hautPx > dispoH) { hautPx = dispoH; largPx = Math.round(hautPx / ratio); }
  return { largPx, hautPx };
}

// Affiche l'image de couverture exactement comme dans l'éditeur : image entière
// (comme object-fit: contain), avec le zoom et le décalage choisis, le tout
// mis à l'échelle pour tenir dans la vignette.
async function chargerImageCouvVignette(couvDiv, url, formatKey, data) {
  // `imageChemin` porte désormais l'URL publique : plus rien à aller
  // chercher, le navigateur charge l'image lui-même (et la met en cache).
  if (!url) return;

  const ref = dimensionsPageReference(formatKey);
  couvDiv.style.position = "relative";

  // Conteneur à la taille de référence de l'éditeur, réduit dans la vignette.
  const wrap = document.createElement("div");
  wrap.style.position = "absolute";
  wrap.style.top = "0";
  wrap.style.left = "0";
  wrap.style.width = ref.largPx + "px";
  wrap.style.height = ref.hautPx + "px";
  wrap.style.transformOrigin = "top left";
  wrap.style.zIndex = "0"; // derrière le titre/auteur, devant la couleur de fond

  const img = document.createElement("img");
  img.draggable = false;
  img.style.position = "absolute";
  img.style.top = "0";
  img.style.left = "0";
  img.onload = () => {
    const echelleBase = Math.min(ref.largPx / img.naturalWidth, ref.hautPx / img.naturalHeight);
    const largeurAffichee = img.naturalWidth * echelleBase;
    const hauteurAffichee = img.naturalHeight * echelleBase;
    const centreX = (ref.largPx - largeurAffichee) / 2;
    const centreY = (ref.hautPx - hauteurAffichee) / 2;
    const zoom = data.imgZoom || 1;
    img.style.width = largeurAffichee + "px";
    img.style.height = hauteurAffichee + "px";
    img.style.transform =
      `translate(${centreX + (data.imgOffsetX || 0)}px, ${centreY + (data.imgOffsetY || 0)}px) scale(${zoom})`;
    // Réduire l'ensemble à la largeur réelle de la vignette.
    wrap.style.transform = `scale(${couvDiv.clientWidth / ref.largPx})`;
  };
  img.src = url;

  wrap.appendChild(img);
  couvDiv.insertBefore(wrap, couvDiv.firstChild);

  // S'assurer que le titre/auteur restent au-dessus de l'image.
  couvDiv.querySelectorAll(".c-titre, .c-auteur").forEach(el => {
    el.style.position = "relative";
    el.style.zIndex = "1";
  });
}

function ouvrirLivre(id) {
  sessionStorage.setItem("livre_id", id);
  window.location.href = "editeur.html";
}

// Format retenu pour le prochain livre créé — le panneau (voir
// ouvrirChoixFormatCreation) n'a rien à lire depuis le DOM, contrairement à
// l'ancien <select>.
let formatChoisiCreation = FORMAT_PAR_DEFAUT;

function ouvrirChoixFormatCreation() {
  ouvrirPanneauFormat(formatChoisiCreation, (formatKey) => {
    formatChoisiCreation = formatKey;
    document.getElementById("formatNouveauLivre").textContent = libelleFormat(formatKey);
  });
}

async function creerLivre() {
  const message = document.getElementById("message");
  const champTitre = document.getElementById("titreNouveauLivre");
  const titre = champTitre.value.trim();
  const format = formatChoisiCreation;

  if (!titre) {
    message.textContent = "Merci de donner un titre au livre.";
    return;
  }

  const nouvelId = "l" + Date.now();
  // Un livre neuf naît avec une double-page vide : c'est elle, et non les
  // « pages », qui porte le texte (voir supabase/schema.sql).
  const nouveau = {
    id: nouvelId,
    titre: titre,
    format: format,
    spreads: [""],
    pages: [{ id: "p1", contenu: "" }],
    nbPages: 1
  };
  bibliotheque.livres.push(nouveau);

  try {
    await creerLivreDistant(nouveau);
    champTitre.value = "";
    afficherListeLivres();
    message.textContent = "Livre créé avec succès.";
  } catch (erreur) {
    bibliotheque.livres.pop();
    message.textContent = erreur.message;
  }
}

async function supprimerLivre(id) {
  const message = document.getElementById("message");
  const livre = bibliotheque.livres.find(l => l.id === id);
  if (!livre) return;
  if (!confirm(`Supprimer le livre « ${livre.titre} » ? Cette action est irréversible.`)) return;

  bibliotheque.livres = bibliotheque.livres.filter(l => l.id !== id);

  try {
    // Les double-pages partent avec le livre (on delete cascade) ; les images,
    // elles, vivent dans Storage, qui ignore tout des lignes qui s'y réfèrent.
    await supprimerLivreDistant(id);
    afficherListeLivres();
    message.textContent = "Livre supprimé.";

    // Nettoyage des images associées (n'empêche pas la suppression si ça échoue)
    for (const cle of ["couverture", "quatrieme", "tranche"]) {
      const data = livre[cle];
      if (data && data.imageChemin) {
        supprimerImageStorage(data.imageChemin).catch(() => {});
      }
    }
  } catch (erreur) {
    message.textContent = erreur.message;
    bibliotheque.livres.push(livre);
  }
}

// ----- Nom d'affichage (libre-service, sur le compte central) -----

function modifierNom() {
  const edition = document.getElementById("editionNom");
  const champ = document.getElementById("champNom");
  if (!edition || !champ) return;
  champ.value = localStorage.getItem("team53_nom") || "";
  edition.style.display = "flex";
  const btn = document.getElementById("btnModifNom");
  if (btn) btn.style.display = "none";
  champ.focus();
  champ.select();
}

function annulerNom() {
  const edition = document.getElementById("editionNom");
  if (edition) edition.style.display = "none";
  const btn = document.getElementById("btnModifNom");
  if (btn) btn.style.display = "";
  const message = document.getElementById("message");
  if (message) message.textContent = "";
}

async function enregistrerNom() {
  const message = document.getElementById("message");
  const champ = document.getElementById("champNom");
  if (!champ) return;

  const nouveau = champ.value.trim();
  const ancien = localStorage.getItem("team53_nom") || "";
  if (nouveau === ancien) { annulerNom(); return; }

  try {
    // Le pseudo vit sur le compte central : le changer ici le change pour le
    // portail et pour tous les sites, comme le fait « Mon compte ». La
    // fonction definir_mon_nom_affichage() ne touche QUE sa propre ligne —
    // impossible d'écraser au passage le rôle ou les accès, ni le compte d'un
    // autre, ce dont le fichier JSON partagé n'offrait aucune garantie.
    await definirNomAffichage(nouveau);
    annulerNom();
    remplirProfil();
    message.textContent = "Nom mis à jour.";
    setTimeout(() => { if (message.textContent === "Nom mis à jour.") message.textContent = ""; }, 2500);
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}


chargerBibliotheque();
