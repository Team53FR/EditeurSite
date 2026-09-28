// =====================================================================
//  Le manuscrit : écrire un chapitre d'un seul tenant
// =====================================================================
//
//  L'éditeur compose en doubles-pages, et c'est ce qu'il faut pour voir
//  tomber la mise en page. Mais pour ÉCRIRE, la page est une gêne : on
//  ajoute une phrase au début du chapitre, tout se décale, le curseur
//  saute d'une page à l'autre, et l'on passe son temps à suivre le texte
//  plutôt qu'à l'écrire.
//
//  Le manuscrit ouvre donc un chapitre — un seul — sur une feuille qui
//  n'a pas de fin : un traitement de texte ordinaire. Rien n'y est
//  paginé. À l'enregistrement, le chapitre reprend sa place dans le texte
//  continu du livre, et la pagination se refait d'un bloc.
//
//  On travaille sur le LIVRE RECOLLÉ (contenuCompletLivre), jamais sur
//  les pages : les pages sont un produit dérivé, elles se recalculent.
//  Le découpage en chapitres est celui du sommaire (tranchesChapitres),
//  ce qui garantit qu'un chapitre édité ici est exactement le chapitre
//  listé là.

// Enregistrer recolle le livre et le repagine d'un bloc : sur un gros
// manuscrit, deux secondes de fil bloqué. Le voile de calcul (attente.js) le
// dit. Il est posé ici et non dans editeur.js, qui se charge AVANT ce
// fichier : la fonction n'y existerait pas encore.
envelopperAttenteLourde({
  enregistrerManuscrit: ["Recomposition du livre…",
    "Le chapitre reprend sa place et la pagination se refait."]
});

// Chapitre en cours d'édition, ou null. `htmlOrigine` sert à savoir si
// quelque chose a bougé : sans lui, fermer demanderait confirmation même
// quand on n'a rien touché.
let manuscrit = null;

// Le texte du chapitre, tel qu'il est écrit dans le livre recollé.
function trancheChapitre(indexChapitre) {
  const { conteneur, tranches } = tranchesChapitres(contenuCompletLivre());
  // tranches[0] = ce qui précède le premier titre ; les chapitres suivent.
  const avecTitre = tranches.filter((t) => t.titre !== null);
  return { conteneur, avecTitre, cible: avecTitre[indexChapitre] || null };
}

function htmlDesNoeuds(noeuds) {
  const boite = document.createElement("div");
  noeuds.forEach((n) => boite.appendChild(n.cloneNode(true)));
  return boite.innerHTML;
}

// =====================================================================
//  Choisir le chapitre à ouvrir
//
//  Le crayon du sommaire mène déjà ici, mais encore faut-il savoir qu'il
//  existe : c'est un caractère large comme une lettre, sur une ligne qu'on
//  ne voit qu'en la survolant. La même porte est donc ouverte depuis le
//  panneau « Relecture », là où l'on va chercher ce qui travaille le livre
//  entier — et cette fois avec son nom écrit en toutes lettres.
//
//  Le dialogue montre aussi la taille de chaque chapitre : sur un livre de
//  trente titres, c'est souvent ce qui permet de reconnaître celui qu'on
//  cherche quand les titres se ressemblent.
// =====================================================================

function ouvrirChoixChapitreManuscrit() {
  if (modeApercu || modeCouverture || manuscrit) return;

  // Sans ce vidage, la frappe en cours ne serait pas encore dans le livre :
  // la liste compterait les mots d'une version périmée.
  flushSpread();

  // La MÊME liste que celle dont ouvrirManuscrit() attend l'index : elle en
  // vient, plutôt que d'être refaite de son côté, pour que le rang choisi
  // dans le dialogue désigne bien le chapitre ouvert ensuite.
  const { avecTitre } = trancheChapitre();

  if (!avecTitre.length) {
    alert("Aucun chapitre à ouvrir.\n\n" +
      "Ce livre n'a pas encore de titre de chapitre : ajoutez-en un avec « + Chapitre ».");
    return;
  }

  // Les numéros de page viennent du sommaire. Si les deux comptes divergent
  // — un titre coupé entre deux pages, par exemple —, on préfère n'afficher
  // aucun numéro plutôt qu'un numéro faux.
  const duSommaire = listerChapitres();
  const pages = duSommaire.length === avecTitre.length ? duSommaire : null;

  ouvrirDialogueChoixChapitre(avecTitre.map((t, i) => ({
    titre: t.titre,
    page: pages ? pages[i].page + 1 : null,
    // Même règle de comptage que le compteur du sommaire : sans quoi la
    // somme des chapitres ne tomberait pas sur le total du livre.
    mots: compterMots(htmlDesNoeuds(t.noeuds))
  })));
}

function ouvrirDialogueChoixChapitre(lignes) {
  const ancien = document.getElementById("dialogueChoixChapitre");
  if (ancien) ancien.remove();

  let html = '<div class="modal-impression-carte ci-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>Écrire un chapitre entier</h3>" +
    '<p class="mi-intro">Le chapitre s&rsquo;ouvre d&rsquo;une seule coulée, sur une feuille ' +
    "sans fin : plus de pages à gérer, plus de curseur qui saute d&rsquo;une page à " +
    "l&rsquo;autre dès qu&rsquo;on ajoute une phrase au début. En enregistrant, le livre se " +
    "recompose et la pagination se refait.</p>" +
    '<div class="choix-chap-liste">';

  lignes.forEach((l, i) => {
    const detail = (l.page ? "p." + l.page + " &middot; " : "") +
      l.mots.toLocaleString("fr-FR") + " mot" + (l.mots > 1 ? "s" : "");
    html += '<button type="button" class="choix-chap" data-i="' + i + '">' +
      '<span class="choix-chap-titre">' + echapperTitre(l.titre) + "</span>" +
      '<span class="choix-chap-detail">' + detail + "</span>" +
    "</button>";
  });

  html += "</div>" +
    '<div class="ci-actions"><button class="ci-annuler">Annuler</button></div>' +
    "</div>";

  const fond = document.createElement("div");
  fond.id = "dialogueChoixChapitre";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  document.body.appendChild(fond);

  const choix = [...fond.querySelectorAll(".choix-chap")];

  const fermer = () => {
    document.removeEventListener("keydown", surTouche, true);
    fond.remove();
  };

  // Échap referme, les flèches parcourent : même conduite que le panneau
  // d'outils d'où l'on vient.
  const surTouche = (e) => {
    if (!document.getElementById("dialogueChoixChapitre")) return;
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation(); fermer(); return;
    }
    const i = choix.indexOf(document.activeElement);
    if (i === -1) return;
    if (e.key === "ArrowDown") {
      e.preventDefault(); choix[(i + 1) % choix.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); choix[(i - 1 + choix.length) % choix.length].focus();
    }
  };
  document.addEventListener("keydown", surTouche, true);

  fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
  fond.querySelector(".mi-fermer").onclick = fermer;
  fond.querySelector(".ci-annuler").onclick = fermer;

  choix.forEach((b, i) => {
    b.onclick = () => { fermer(); ouvrirManuscrit(i); };
  });

  if (choix[0]) choix[0].focus();
}

function ouvrirManuscrit(indexChapitre) {
  if (modeApercu || modeCouverture || manuscrit) return;

  // Sans ce vidage, la frappe en cours dans la double-page ne serait pas
  // encore dans le livre : on éditerait une version périmée du chapitre.
  flushSpread();

  const { cible } = trancheChapitre(indexChapitre);
  if (!cible) return;

  const htmlOrigine = htmlDesNoeuds(cible.noeuds);
  manuscrit = { index: indexChapitre, titreOrigine: cible.titre, htmlOrigine };

  const fond = document.createElement("div");
  fond.id = "manuscrit";
  fond.className = "manuscrit";
  fond.innerHTML =
    '<div class="ms-barre">' +
      '<div class="ms-titre">' +
        '<span class="ms-etiquette">Chapitre</span>' +
        '<strong id="msNomChapitre"></strong>' +
      "</div>" +
      '<div class="ms-outils">' +
        '<button type="button" data-cmd="undo" title="Annuler (Ctrl+Z)">&#8630;</button>' +
        '<button type="button" data-cmd="redo" title="Rétablir (Ctrl+Y)">&#8631;</button>' +
        '<span class="ms-separateur"></span>' +
        '<button type="button" data-cmd="bold" title="Gras"><b>G</b></button>' +
        '<button type="button" data-cmd="italic" title="Italique"><i>I</i></button>' +
        '<button type="button" data-cmd="underline" title="Souligné"><u>S</u></button>' +
        '<span class="ms-separateur"></span>' +
        '<button type="button" data-bloc="p" title="Paragraphe">¶</button>' +
        '<button type="button" data-bloc="h3" title="Sous-titre">S-t</button>' +
        '<button type="button" data-bloc="h2" title="Titre de chapitre">T</button>' +
        '<span class="ms-separateur"></span>' +
        '<button type="button" data-cmd="insertUnorderedList" title="Liste à puces">&#8226;</button>' +
        '<button type="button" data-cmd="insertOrderedList" title="Liste numérotée">1.</button>' +
      "</div>" +
      '<div class="ms-actions">' +
        '<span id="msMots" class="ms-mots"></span>' +
        '<button type="button" id="msAnnuler" class="secondaire petit">Fermer</button>' +
        '<button type="button" id="msEnregistrer" class="principal petit">Enregistrer le chapitre</button>' +
      "</div>" +
    "</div>" +
    '<p class="ms-aide">Le chapitre entier, d\'une seule coulée : aucune page à gérer. ' +
      "Les tailles sont celles du livre ; seule la largeur de la feuille change. " +
      "En enregistrant, le livre se recompose et la pagination se refait.</p>" +
    '<div class="ms-feuille">' +
      '<div class="ms-texte texte-livre" id="manuscritTexte" contenteditable="true" spellcheck="true"></div>' +
    "</div>";

  document.body.appendChild(fond);
  document.body.classList.add("manuscrit-ouvert");

  const zone = document.getElementById("manuscritTexte");
  zone.innerHTML = htmlOrigine;
  document.getElementById("msNomChapitre").textContent = cible.titre;

  fond.querySelectorAll(".ms-outils button").forEach((b) => {
    // mousedown : sans cela, cliquer un bouton retire le focus de la zone
    // et la sélection est perdue avant que la commande ne s'applique.
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.onclick = () => {
      zone.focus();
      if (b.dataset.bloc) {
        document.execCommand("formatBlock", false, b.dataset.bloc.toUpperCase());
        nettoyerTaillesManuscrit(zone);
      } else {
        document.execCommand(b.dataset.cmd, false, null);
      }
      majMotsManuscrit();
    };
  });

  document.getElementById("msAnnuler").onclick = () => fermerManuscrit();
  document.getElementById("msEnregistrer").onclick = enregistrerManuscrit;

  zone.addEventListener("input", majMotsManuscrit);
  zone.addEventListener("paste", collerDansManuscrit);
  document.addEventListener("keydown", raccourcisManuscrit, true);

  majMotsManuscrit();
  zone.focus();

  // Le curseur au début du texte plutôt qu'au début du titre : on vient
  // presque toujours pour écrire, pas pour renommer.
  const premierP = zone.querySelector("p");
  if (premierP) {
    const r = document.createRange();
    r.selectNodeContents(premierP);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

// Coller conserve les retours à la ligne et les emphases du texte (italique,
// gras, souligné), mais rien de l'habillage de la source — même tri que dans
// la double-page (fragmentDepuisPressePapiers, script.js). « insertHTML »
// plutôt qu'une insertion à la main : le collage reste annulable par Ctrl+Z,
// et les boutons Annuler/Rétablir de la barre s'appuient dessus.
function collerDansManuscrit(e) {
  const donnees = e.clipboardData || window.clipboardData;
  if (!donnees) return;
  const html = htmlDepuisPressePapiers(donnees);
  if (!html) return;
  e.preventDefault();

  // Selon le contexte, le navigateur habille parfois ce qu'il insère d'un
  // « font-size » repris de l'endroit où l'on colle. Figée dans le texte,
  // cette taille survivrait à un changement de format et le passage collé
  // garderait seul l'ancienne — le même mal que nettoyerTaillesManuscrit
  // corrige ailleurs. On relève donc ce qui est déjà stylé pour ne défaire
  // que ce que le collage vient d'ajouter.
  const zone = document.getElementById("manuscritTexte");
  const dejaStyles = zone ? new Set(zone.querySelectorAll("[style]")) : null;

  document.execCommand("insertHTML", false, html);

  if (zone) {
    zone.querySelectorAll("[style]").forEach((el) => {
      if (dejaStyles.has(el) || !el.style.fontSize) return;
      el.style.fontSize = "";
      if (!el.getAttribute("style")) el.removeAttribute("style");
    });
  }
  majMotsManuscrit();
}

// Une taille posée à la main l'emporterait sur celle du type : un titre
// resterait en 11 pt. Même nettoyage que dans la double-page.
function nettoyerTaillesManuscrit(zone) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  [...zone.querySelectorAll("p, h2, h3, li")]
    .filter((b) => range.intersectsNode(b))
    .forEach((bloc) => {
      if (bloc.style && bloc.style.fontSize) bloc.style.fontSize = "";
      bloc.querySelectorAll("[style]").forEach((el) => {
        if (el.style.fontSize) el.style.fontSize = "";
        if (!el.getAttribute("style")) el.removeAttribute("style");
      });
      if (!bloc.getAttribute("style")) bloc.removeAttribute("style");
    });
}

function raccourcisManuscrit(e) {
  if (!manuscrit) return;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    fermerManuscrit();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    e.stopPropagation();
    enregistrerManuscrit();
  }
}

function texteManuscritModifie() {
  const zone = document.getElementById("manuscritTexte");
  return !!zone && manuscrit && zone.innerHTML !== manuscrit.htmlOrigine;
}

function majMotsManuscrit() {
  const zone = document.getElementById("manuscritTexte");
  const compteur = document.getElementById("msMots");
  if (!zone || !compteur) return;
  const n = compterMots(zone);
  compteur.textContent = n + " mot" + (n > 1 ? "s" : "");
}

function fermerManuscrit(sansDemander) {
  if (!manuscrit) return;
  if (!sansDemander && texteManuscritModifie() &&
      !confirm("Fermer sans enregistrer ?\n\nLes modifications du chapitre seront perdues.")) {
    return;
  }
  document.removeEventListener("keydown", raccourcisManuscrit, true);
  const fond = document.getElementById("manuscrit");
  if (fond) fond.remove();
  document.body.classList.remove("manuscrit-ouvert");
  manuscrit = null;
}

// Un chapitre commence toujours par son titre, et un titre commence
// toujours une page : c'est l'invariant sur lequel reposent le sommaire et
// la pagination. On le rétablit ici plutôt que de l'imposer pendant la
// frappe, où il rendrait le début du chapitre pénible à corriger.
function normaliserChapitre(html, titreSecours) {
  const d = document.createElement("div");
  d.innerHTML = html || "";

  d.querySelectorAll("h2").forEach((h) => {
    if (!(h.textContent || "").trim() && !h.querySelector("img")) { h.remove(); return; }
    h.classList.add("chapitre");
    h.style.breakBefore = "column";
  });

  // Les blancs de tête : sans ce nettoyage, une ligne vide laissée au-dessus
  // du titre ferait croire que le titre a disparu, et l'on en ajouterait un
  // second.
  while (d.firstChild && noeudVide(d.firstChild)) d.removeChild(d.firstChild);

  const premier = d.firstElementChild;
  if (!premier || premier.tagName !== "H2") {
    const h = document.createElement("h2");
    h.className = "chapitre";
    h.style.breakBefore = "column";
    h.textContent = titreSecours || "Chapitre";
    d.insertBefore(h, d.firstChild);
  }

  return d.innerHTML;
}

function noeudVide(n) {
  if (n.nodeType === 3) return !(n.nodeValue || "").trim();
  if (n.nodeType !== 1) return true;
  if (n.querySelector && n.querySelector("img")) return false;
  return !(n.textContent || "").trim();
}

function enregistrerManuscrit() {
  if (!manuscrit) return;
  const zone = document.getElementById("manuscritTexte");
  if (!zone) return;

  const nouveau = normaliserChapitre(zone.innerHTML, manuscrit.titreOrigine);

  // On relit le livre maintenant : la tranche repérée à l'ouverture porte des
  // nœuds d'un ancien découpage, qui n'appartiennent plus à rien.
  const { conteneur, avecTitre } = trancheChapitre(manuscrit.index);
  let cible = avecTitre[manuscrit.index];
  if (cible && cible.titre !== manuscrit.titreOrigine) {
    // Filet de sécurité : si l'ordre des chapitres a bougé, on retrouve le
    // chapitre par son titre — à condition qu'il soit sans ambiguïté.
    const homonymes = avecTitre.filter((t) => t.titre === manuscrit.titreOrigine);
    if (homonymes.length === 1) cible = homonymes[0];
  }
  if (!cible) {
    alert("Ce chapitre est introuvable dans le livre : il a peut-être été supprimé.");
    return;
  }

  const dernier = cible.noeuds[cible.noeuds.length - 1];
  const apres = dernier ? dernier.nextSibling : null;
  cible.noeuds.forEach((n) => { if (n.parentNode === conteneur) conteneur.removeChild(n); });

  const frag = document.createElement("div");
  frag.innerHTML = nouveau;
  while (frag.firstChild) conteneur.insertBefore(frag.firstChild, apres);

  const titreFinal = titreDuChapitre(nouveau) || manuscrit.titreOrigine;

  const livre = livreActuel();
  livre.spreads = [conteneur.innerHTML || ""];
  indexSpread = 0;
  repaginerTout();

  const spreads = spreadsLivre();
  if (numSpread() >= spreads.length) indexSpread = Math.max(0, (spreads.length - 1) * 2);

  const indexEdite = manuscrit.index;
  fermerManuscrit(true);

  // Se poser sur la première page du chapitre : on voit tout de suite ce que
  // la recomposition a donné.
  const chapitres = listerChapitres();
  const parTitre = chapitres.find((c) => c.titre === titreFinal);
  const repere = parTitre || chapitres[indexEdite];
  if (repere) allerAPage(repere.page);
  else afficherSpread();

  afficherSommaire();
  majCompteurMots();
  marquerModifie();
  planifierBrouillon();

  const message = document.getElementById("message");
  if (message) {
    message.textContent = "Chapitre « " + titreFinal + " » mis à jour ; la mise en pages a suivi.";
    setTimeout(() => {
      if (message.textContent.indexOf("mis à jour") !== -1) message.textContent = "";
    }, 4000);
  }
}

function titreDuChapitre(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  const h = d.querySelector("h2");
  return h ? (h.textContent || "").trim() : "";
}
