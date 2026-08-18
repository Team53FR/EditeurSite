// =====================================================================
//  Panneau de choix du mode d'impression
//  Ouvert par le bouton imprimante : l'utilisateur choisit explicitement
//  la reliure (livret agrafé / page à page) et le type d'imprimante.
// =====================================================================

// Mode d'emploi détaillé, déplié par le bouton « ? » de chaque catégorie.
const AIDE_IMPRESSION = {
  livret: {
    titre: "Le livret à agrafer, comment ça marche",
    principe: "Chaque feuille reçoit DEUX pages côte à côte, et porte quatre pages une fois " +
              "imprimée des deux côtés. Les pages ne sont pas imprimées dans l'ordre : elles " +
              "sont réparties pour retomber dans le bon ordre une fois la pile pliée. C'est " +
              "pour cela que la première feuille montre la fin du livre à gauche. " +
              "Seul le texte est imprimé : la couverture se sort à part.",
    etapes: [
      "Imprimez en recto-verso. Si votre imprimante ne le fait pas seule, choisissez « En deux fois » : les rectos sortent d'abord, puis vous remettez la pile dans le bac pour les versos.",
      "Ne changez surtout pas l'ordre des feuilles en les récupérant.",
      "Pliez toute la pile en deux d'un seul geste, bien au milieu.",
      "Agrafez sur le pli, avec deux agrafes réparties (une agrafeuse à long bras aide beaucoup ; sinon, agrafez à plat puis pliez).",
      "Facultatif : égalisez le bord extérieur au massicot, les feuilles intérieures dépassant toujours un peu."
    ],
    bon: ["Rapide, sans colle ni matériel particulier.", "Les pages tombent dans l'ordre toutes seules.", "Idéal pour une nouvelle, un carnet, un tirage d'essai."],
    limites: ["La couverture n'est pas comprise : imprimez-la avec « Couverture seule », dans la catégorie du dos collé.",
              "Le nombre de pages est complété à un multiple de 4 (des pages blanches sont ajoutées si besoin).",
              "Au-delà d'une quarantaine de pages, le pli gonfle et les pages centrales ressortent nettement.",
              "Le dos est agrafé, pas plat : le livre ne tient pas debout comme un roman."],
    reglages: "Dans la fenêtre d'impression : format paysage, échelle 100 % (surtout pas « ajuster à la page »), et recto-verso « retourner sur les bords courts »."
  },
  doscolle: {
    titre: "Le dos collé, comment ça marche",
    principe: "Seul le texte sort ici : la couverture s'imprime à part, avec « Couverture seule ». " +
              "Les feuilles sont encollées sur la tranche, comme un vrai roman de poche. Deux façons " +
              "de les imprimer : UNE PAGE par feuille, dans l'ordre de lecture, rien à découper ; ou DEUX " +
              "PAGES par feuille, à couper au milieu — moitié moins de papier. Dans ce second cas les " +
              "pages ne sont pas côte à côte dans l'ordre : la colonne de gauche porte la première moitié " +
              "du livre, celle de droite la seconde, pour qu'après la coupe chaque tas reste continu et " +
              "que l'un se pose sous l'autre.",
    etapes: [
      "Imprimez en recto-verso, dans l'ordre. Si votre imprimante ne le fait pas seule, choisissez « En deux fois ».",
      "Deux pages par feuille : coupez toute la pile sur le trait du milieu, puis posez le tas de DROITE sous celui de GAUCHE. Ne mélangez pas les deux moitiés.",
      "Massicotez les feuilles sur les traits de coupe imprimés dans la marge : la page retrouve alors son format exact.",
      "Empilez les feuilles dans l'ordre, puis tapotez la pile sur une table pour aligner parfaitement le bord de reliure.",
      "Serrez la pile entre deux planchettes, en laissant dépasser 2 à 3 mm du bord à encoller.",
      "Encollez la tranche (colle vinylique blanche, ou colle thermofusible), en croisant les passages. Laissez sécher sous presse au moins une heure.",
      "Imprimez la couverture avec « Couverture seule » : 4e de couverture, dos et 1re viennent sur une seule feuille, les traits de pli marquant la tranche.",
      "Collez la couverture par-dessus, puis marquez les deux plis du dos avec un plioir."
    ],
    bon: ["Aucune limite de pages : c'est le procédé des vrais livres.", "Dos plat, le livre tient debout sur une étagère.",
          "Rendu le plus proche d'un ouvrage édité.", "Deux pages par feuille : deux fois moins de papier et d'encre."],
    limites: ["La couverture à plat est plus large qu'une A4 : il faut du A3, ou une impression chez un copiste.",
              "Demande de la colle, une presse improvisée et du temps de séchage.",
              "Le collage doit être régulier, sous peine de pages qui se détachent.",
              "Une marge intérieure est réservée à la reliure : ne réduisez pas les marges."],
    reglages: "Les pages et la couverture sont posées sur un format de papier réel, à leur taille exacte, " +
              "avec des traits de coupe dans la marge pour savoir où massicoter : " +
              "choisissez la même feuille dans la fenêtre d'impression, marges « aucune », échelle 100 % " +
              "(surtout pas « ajuster à la page »), et recto-verso « retourner sur les bords longs » — " +
              "à deux pages par feuille, c'est ce réglage qui garde la moitié gauche à gauche au verso."
  },
  imprimeur: {
    titre: "Le fichier pour un imprimeur professionnel",
    principe: "Un imprimeur ne réimprime pas votre livre : il traite le fichier que vous lui " +
              "envoyez. Celui-ci doit donc respecter des règles précises de géométrie — format " +
              "de support, fond perdu, repères de coupe, blanc tournant, registre. Ces deux " +
              "exports produisent des pages simples (jamais des doubles pages) au format exact, " +
              "avec 5 mm de fond perdu et des traits de coupe décalés de 5 mm.",
    etapes: [
      "Générez le fichier « Intérieur » : il contient uniquement les pages de texte, numérotées, sans la couverture.",
      "Générez le fichier « Couverture à plat » : 4e de couverture, dos et 1re de couverture réunis en une seule planche, avec les repères de pli du dos.",
      "Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF », échelle 100 %, et surtout PAS « ajuster à la page ».",
      "Renommez les fichiers sans accent ni caractère spécial, en reprenant le nom proposé par le contrôle avant envoi (int_MonTitre, cv_MonTitre).",
      "Faites convertir les PDF à la norme PDF/X-1a et en CMJN : un navigateur ne sait pas le faire. Le service PAO de l'imprimeur s'en charge, souvent gratuitement.",
      "Fournissez un BAT : les pages intérieures imprimées au recto uniquement, sans réduction ni agrandissement et sans correction manuscrite, plus un BAT couleur de la couverture."
    ],
    bon: ["Format de support, fond perdu et repères de coupe exacts.",
          "Pages simples, toutes au même format et à la même orientation.",
          "Registre garanti : les marges paires et impaires sont symétriques.",
          "Blanc tournant d'au moins 7 mm, folio compris."],
    limites: ["Un navigateur exporte en RVB et en PDF 1.4 : la conversion CMJN / PDF/X-1a reste à faire.",
              "Les images gardent leur résolution d'origine : vérifiez qu'elles font bien 300 ppp.",
              "Les 5 mm de fond perdu de la couverture sont remplis par la couleur de fond, pas par la photo.",
              "L'épaisseur du dos dépend du papier : faites-la confirmer par l'imprimeur."],
    reglages: "Dans la fenêtre d'impression : échelle 100 %, aucune marge, ni en-tête ni pied de page du navigateur, " +
              "et « Enregistrer au format PDF » comme destination."
  }
};

const MODES_IMPRESSION = [
  {
    categorie: "Livret à agrafer", aideCle: "livret",
    aide: "Le texte seul, deux pages par feuille. On plie la pile en deux et on agrafe au centre.",
    choix: [
      { libelle: "Recto-verso automatique", detail: "Votre imprimante retourne les feuilles toute seule.",
        action: "exporterLivret", mode: "auto" },
      { libelle: "En deux fois", detail: "Sans recto-verso : les rectos d'abord, puis les versos.",
        action: "exporterLivret", mode: "passes" }
    ]
  },
  {
    categorie: "Page à page (dos collé)", aideCle: "doscolle",
    aide: "À relier ou à faire relier. Une page par feuille, ou deux à couper au milieu.",
    choix: [
      { libelle: "Une page par feuille", detail: "Le texte seul, recto-verso automatique. Rien à découper.",
        action: "exporterImpression", mode: "auto" },
      { libelle: "Une page — en deux fois", detail: "Sans recto-verso : les rectos d'abord, puis les versos.",
        action: "exporterImpression", mode: "passes" },
      { libelle: "Deux pages par feuille", detail: "Le texte seul, à couper au milieu : moitié de papier.",
        action: "exporterDeuxPages", mode: "auto" },
      { libelle: "Deux pages — en deux fois", detail: "Sans recto-verso : les rectos d'abord, puis les versos.",
        action: "exporterDeuxPages", mode: "passes" },
      { libelle: "Couverture seule", detail: "4e de couverture, dos et 1re sur une seule feuille, avec les plis.",
        action: "exporterCouvertureSeule", mode: "" }
    ]
  },
  {
    categorie: "Fichier pour l'imprimeur", aideCle: "imprimeur",
    aide: "Deux PDF conformes à un cahier des charges d'imprimeur : fond perdu, repères de coupe, pages simples.",
    choix: [
      { libelle: "Intérieur", detail: "Les pages de texte seules, en pages simples numérotées.",
        action: "exporterImprimeur", mode: "interieur" },
      { libelle: "Couverture à plat", detail: "4e de couverture, dos et 1re réunis, avec repères de pli.",
        action: "exporterImprimeur", mode: "couverture" }
    ]
  }
];

// Construit le mode d'emploi dépliable d'une catégorie.
function construireAideHtml(aide, index) {
  if (!aide) return "";
  const liste = (titre, items, classe) =>
    '<div class="mi-detail-bloc"><h5 class="' + (classe || "") + '">' + titre + "</h5><ul>" +
    items.map(x => "<li>" + x + "</li>").join("") + "</ul></div>";

  return '<div class="mi-detail" data-aide="' + index + '">' +
    "<h5>" + aide.titre + "</h5>" +
    "<p>" + aide.principe + "</p>" +
    '<div class="mi-detail-bloc"><h5>Assemblage, pas à pas</h5><ol>' +
      aide.etapes.map(e => "<li>" + e + "</li>").join("") +
    "</ol></div>" +
    '<div class="mi-detail-colonnes">' +
      liste("Ce que ça apporte", aide.bon, "vert") +
      liste("À savoir", aide.limites, "orange") +
    "</div>" +
    '<p class="mi-reglages"><strong>Réglages d\'impression :</strong> ' + aide.reglages + "</p>" +
  "</div>";
}

function ouvrirPanneauImpression() {
  fermerPanneauImpression();

  const fond = document.createElement("div");
  fond.id = "panneauImpression";
  fond.className = "modal-impression";
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerPanneauImpression(); });

  let html = '<div class="modal-impression-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>Imprimer votre livre</h3>" +
    '<p class="mi-intro">Choisissez la reliure, puis le type de votre imprimante. ' +
    "Pour obtenir un PDF, sélectionnez « Enregistrer au format PDF » dans la fenêtre d'impression. " +
    '<a href="montage.html" target="_blank" rel="noopener">Guide complet du montage</a>.</p>';

  MODES_IMPRESSION.forEach((cat, i) => {
    html += '<div class="mi-categorie">' +
      '<div class="mi-titre-ligne">' +
        "<h4>" + cat.categorie + "</h4>" +
        '<button class="mi-aide-btn" data-aide="' + i + '" title="Comment ça marche et comment assembler" ' +
          'aria-label="Aide sur ' + cat.categorie + '">?</button>' +
      "</div>" +
      '<p class="mi-aide">' + cat.aide + "</p>" +
      construireAideHtml(AIDE_IMPRESSION[cat.aideCle], i) +
      '<div class="mi-choix">';
    cat.choix.forEach((c, j) => {
      html += '<button class="mi-bouton" data-cat="' + i + '" data-choix="' + j + '">' +
        "<span>" + c.libelle + "</span>" +
        '<small>' + c.detail + "</small>" +
      "</button>";
    });
    html += "</div></div>";
  });

  html += "</div>";
  fond.innerHTML = html;
  document.body.appendChild(fond);

  fond.querySelector(".mi-fermer").onclick = fermerPanneauImpression;

  // Boutons « ? » : déplient le mode d'emploi de leur catégorie
  fond.querySelectorAll(".mi-aide-btn").forEach(btn => {
    btn.onclick = () => {
      const bloc = fond.querySelector('.mi-detail[data-aide="' + btn.dataset.aide + '"]');
      if (!bloc) return;
      const ouvert = bloc.classList.toggle("ouvert");
      btn.classList.toggle("actif", ouvert);
      btn.setAttribute("aria-expanded", ouvert ? "true" : "false");
    };
  });
  fond.querySelectorAll(".mi-bouton").forEach(btn => {
    btn.onclick = () => {
      const c = MODES_IMPRESSION[+btn.dataset.cat].choix[+btn.dataset.choix];
      fermerPanneauImpression();
      // Laisser la fenêtre se fermer avant d'ouvrir celle du navigateur
      setTimeout(() => { window[c.action](c.mode); }, 50);
    };
  });
}

function fermerPanneauImpression() {
  const p = document.getElementById("panneauImpression");
  if (p) p.remove();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerPanneauImpression();
});

// ----- Export impression (PDF / imprimante au format réel) -----
//
// Construit une version du livre aux dimensions physiques exactes (en mm),
// pensée pour une impression recto-verso type roman :
//  - marge intérieure (reliure) plus large que la marge extérieure,
//    en gardant la même largeur de bloc de texte que l'éditeur ;
//  - texte justifié avec césure française ;
//  - couverture au recto de la première feuille, 4e de couverture
//    au verso de la dernière, pages blanches intercalées pour que
//    l'intérieur tombe juste en recto-verso.

const MM_EN_PX = 96 / 25.4; // conversion CSS : 1mm = 96/25.4 px
const DELTA_RELIURE_MM = 4; // ajouté côté reliure, retiré côté extérieur
// Zone réservée au numéro de page. DOIT correspondre au « numPageH » de
// l'éditeur (32 px logiques), sinon la hauteur utile diffère de celle qui a
// servi à découper les pages et le texte se retrouve coupé à l'impression.
// On retire une petite tolérance (2 mm) pour absorber les écarts d'arrondi
// mm/px entre le rendu écran et le rendu imprimé ; le numéro de page reste
// à sa place (il est positionné à 6 mm du bas, indépendamment).
const TOLERANCE_MM = 2;
const PIED_PAGE_MM = 32 * 25.4 / 96 - TOLERANCE_MM; // ≈ 6,47 mm

// ----- Poser le travail sur une VRAIE feuille -----
//
// Un navigateur ne demande pas au pilote d'imprimante de respecter la taille
// déclarée par @page : si elle ne correspond pas au papier chargé, il met le
// tout à l'échelle du papier. Deux exports de tailles différentes — les pages
// (173 × 234 mm) et la couverture à plat (322 × 234 mm) — ressortent alors à
// deux échelles différentes sur la même A4, et la couverture ne tombe plus
// autour des pages.
//
// La parade est de ne plus jamais déclarer autre chose qu'un format de papier
// réel : le travail est CENTRÉ dessus, à sa taille exacte, et la mise à
// l'échelle du navigateur n'a plus rien à faire.
const PAPIERS = [
  { cle: "a4p", nom: "A4 portrait",  larg: 210, haut: 297 },
  { cle: "a4l", nom: "A4 paysage",   larg: 297, haut: 210 },
  { cle: "a3p", nom: "A3 portrait",  larg: 297, haut: 420 },
  { cle: "a3l", nom: "A3 paysage",   larg: 420, haut: 297 }
];

function papierParCle(cle) {
  return PAPIERS.find((p) => p.cle === cle) || null;
}

// Le plus petit papier où le travail entre sans être réduit — et, à taille de
// feuille égale, celui qui laisse le plus de blanc sur son côté le plus juste.
//
// L'orientation compte : une imposition de poche (210 × 148 mm) entre dans une
// A4 portrait, mais bord à bord en largeur — impossible d'y poser un repère de
// coupe. La même A4 en paysage lui laisse 43 mm de chaque côté et 31 en haut
// et en bas, donc de vrais traits aux quatre angles. Même feuille, même
// imprimante, juste tournée.
//
// La tolérance sert au livret de roman : deux pages font 298 mm pour une A4
// paysage de 297. Refuser ce millimètre l'enverrait sur de l'A3 alors qu'il
// tient sur une A4 depuis toujours.
function papierMinimal(largMm, hautMm, toleranceMm) {
  const t = toleranceMm || 0;
  const possibles = PAPIERS.filter((p) => p.larg + t >= largMm && p.haut + t >= hautMm);
  if (!possibles.length) return null;

  const aire = (p) => p.larg * p.haut;
  const pluspetite = Math.min(...possibles.map(aire));
  // La plus petite marge décide : c'est elle qui manque quand il n'y a pas la
  // place d'imprimer un trait.
  const margeMini = (p) => Math.min(p.larg - largMm, p.haut - hautMm);
  return possibles
    .filter((p) => aire(p) === pluspetite)
    .sort((a, b) => margeMini(b) - margeMini(a))[0];
}

// Enveloppe un élément dans une feuille de papier, où il est centré.
// L'enveloppe porte le saut de page ; l'élément garde sa taille exacte.
//
// Le blanc autour n'est pas perdu : il reçoit les traits de coupe, sans quoi
// il faut deviner au réglet où s'arrête la page une fois imprimée.
function poserSurPapier(element, papier, largMm, hautMm) {
  const feuille = document.createElement("div");
  feuille.className = "feuille-papier";
  feuille.style.width  = papier.larg + "mm";
  feuille.style.height = papier.haut + "mm";
  feuille.appendChild(element);
  if (largMm && hautMm) ajouterTraitsDecoupe(feuille, largMm, hautMm, papier);
  return feuille;
}

// Traits de coupe aux quatre angles de la zone imprimée. Ils se posent dans
// la marge, jamais sur la page — un trait qui la traverse se retrouverait sur
// le livre fini. Chaque côté n'est tracé que si sa marge en laisse la place ;
// une marge étroite raccourcit le trait plutôt que de le supprimer.
const ECART_TRAIT_MM = 2;      // blanc laissé entre la page et le trait
const LONGUEUR_TRAIT_MM = 5;   // longueur visée

function ajouterTraitsDecoupe(feuille, largMm, hautMm, papier) {
  const margeX = (papier.larg - largMm) / 2;
  const margeY = (papier.haut - hautMm) / 2;

  // Longueur réellement traçable de chaque côté, écart compris.
  const longX = Math.min(LONGUEUR_TRAIT_MM, margeX - ECART_TRAIT_MM);
  const longY = Math.min(LONGUEUR_TRAIT_MM, margeY - ECART_TRAIT_MM);
  if (longX < 1 && longY < 1) return;   // la page occupe toute la feuille

  // Un bord sans marge — le livret de poche est aussi large que sa feuille —
  // placerait le repère à l'extrême bord, là où aucune imprimante ne dépose
  // d'encre. On le rentre alors de quelques millimètres : il ne désigne plus
  // le bord de la page, seulement la hauteur (ou la largeur) où couper.
  const RENTRE_MM = 4;
  const cadrerX = (x) => Math.min(Math.max(x, RENTRE_MM), papier.larg - RENTRE_MM);
  const cadrerY = (y) => Math.min(Math.max(y, RENTRE_MM), papier.haut - RENTRE_MM);

  const trait = (classe, gauche, haut, largeur, hauteur) => {
    const t = document.createElement("div");
    t.className = "trait-coupe " + classe;
    t.style.left = gauche + "mm";
    t.style.top = haut + "mm";
    if (largeur) t.style.width = largeur + "mm";
    if (hauteur) t.style.height = hauteur + "mm";
    feuille.appendChild(t);
  };

  const x0 = margeX, x1 = margeX + largMm;
  const y0 = margeY, y1 = margeY + hautMm;

  // Traits horizontaux : ils prolongent les bords haut et bas, à gauche et à
  // droite de la page.
  if (longX >= 1) {
    [cadrerY(y0), cadrerY(y1)].forEach((y) => {
      trait("trait-h", x0 - ECART_TRAIT_MM - longX, y, longX, 0);
      trait("trait-h", x1 + ECART_TRAIT_MM, y, longX, 0);
    });
  }
  // Traits verticaux : idem pour les bords gauche et droit.
  if (longY >= 1) {
    [cadrerX(x0), cadrerX(x1)].forEach((x) => {
      trait("trait-v", x, y0 - ECART_TRAIT_MM - longY, 0, longY);
      trait("trait-v", x, y1 + ECART_TRAIT_MM, 0, longY);
    });
  }
}

function reglerPagePapier(stylePage, papier) {
  stylePage.textContent = "@page { size: " + papier.larg + "mm " + papier.haut + "mm; margin: 0; }";
}

function exporterImpression(modeRectoVerso) {
  flushSpread();
  repaginerTout(); // découpage exact avant impression (flushSpread ne découpe pas)
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];

  // Taille physique de la feuille (le PDF sortira exactement à ce format)
  let stylePage = document.getElementById("stylePageImpression");
  if (!stylePage) {
    stylePage = document.createElement("style");
    stylePage.id = "stylePageImpression";
    document.head.appendChild(stylePage);
  }
  // Le papier est choisi pour contenir le format du livre sans réduction ;
  // à défaut (format plus grand qu'une A3), on garde la taille exacte et
  // l'impression sera mise à l'échelle comme avant.
  const papier = papierMinimal(f.larg, f.haut);
  if (papier) reglerPagePapier(stylePage, papier);
  else stylePage.textContent = `@page { size: ${f.larg}mm ${f.haut}mm; margin: 0; }`;

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  // Chaque page part sur sa feuille : le recto-verso en deux passes compte
  // les enfants directs de la zone, il faut donc un enfant par page.
  const ajouterPage = (el) =>
    zone.appendChild(papier ? poserSurPapier(el, papier, f.larg, f.haut) : el);

  // La somme des deux marges reste identique à l'éditeur pour que le bloc
  // de texte garde exactement la même largeur (pas de re-débordement).
  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);

  const promessesImages = [];

  // Le texte seul. Les couvertures s'impriment à part — sur un autre papier,
  // souvent chez un copiste — et « Couverture seule » les sort ouvertes à
  // plat : les intercaler ici gâchait deux feuilles et forçait à les extraire
  // de la pile avant l'encollage.
  const pages = livre.pages || [];
  pages.forEach((page, i) => {
    ajouterPage(creerPageTexteImpression(page, i + 1, f, margeInt, margeExt));
  });

  // Un nombre impair laisserait le dernier verso à imprimer dans le vide :
  // la feuille blanche ferme la pile proprement.
  if (pages.length % 2 === 1) ajouterPage(creerPageBlancheImpression(f));

  const message = document.getElementById("message");
  if (message) message.textContent = "Préparation de l'impression...";

  Promise.all(promessesImages).finally(() => {
    if (message) message.textContent = "";
    lancerImpression(modeRectoVerso);
  });
}

// ----- Export livret à agrafer (imposition à cheval) -----
//
// Deux pages côte à côte par face de feuille (A4 paysage pour un livre A5),
// dans l'ordre d'imposition : on imprime recto-verso, on plie la pile en
// deux, on agrafe au pli, et toutes les pages tombent dans le bon ordre.

function exporterLivret(modeRectoVerso) {
  flushSpread();
  repaginerTout(); // découpage exact avant impression (flushSpread ne découpe pas)
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];

  let stylePage = document.getElementById("stylePageImpression");
  if (!stylePage) {
    stylePage = document.createElement("style");
    stylePage.id = "stylePageImpression";
    document.head.appendChild(stylePage);
  }
  // Une imposition de poche fait 210 × 148 mm : posée sur une A4, elle laisse
  // 74 mm de blanc en haut et en bas, qu'il faudra massicoter. Comme les
  // autres exports, elle se pose donc sur un papier réel, à sa taille exacte,
  // avec ses traits de coupe dans la marge.
  const largFeuille = f.larg * 2;
  const papier = papierMinimal(largFeuille, f.haut, 2);
  if (papier) reglerPagePapier(stylePage, papier);
  else stylePage.textContent = `@page { size: ${largFeuille}mm ${f.haut}mm; margin: 0; }`;

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  // Une face de feuille par enfant direct : l'impression en deux passes
  // compte les enfants de la zone pour séparer rectos et versos.
  const ajouterFace = (el) =>
    zone.appendChild(papier ? poserSurPapier(el, papier, largFeuille, f.haut) : el);

  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);
  const promessesImages = [];

  // Suite logique du livret : chaque entrée = une demi-feuille.
  // Position 1 = couverture, position 2 = son verso blanc, puis le texte,
  // des blanches de complément (total multiple de 4), et la 4e en dernier.
  const suite = [];
  (livre.pages || []).forEach((page, i) => suite.push({ type: "texte", page, numero: i + 1 }));
  // Un cahier plié se compte par quatre : on complète par des blanches, qui
  // se retrouvent à la fin du livret.
  while (suite.length % 4 !== 0) suite.push({ type: "blanche" });

  const total = suite.length;

  // Imposition : feuille k, recto = [dernière-2k | 2k+1], verso = [2k+2 | dernière-2k-1]
  for (let k = 0; k < total / 4; k++) {
    ajouterFace(creerFaceLivret(suite[total - 2 * k - 1], suite[2 * k], f, margeInt, margeExt));
    ajouterFace(creerFaceLivret(suite[2 * k + 1], suite[total - 2 * k - 2], f, margeInt, margeExt));
  }

  const message = document.getElementById("message");
  if (message) message.textContent = "Préparation de l'impression...";

  Promise.all(promessesImages).finally(() => {
    if (message) message.textContent = "";
    lancerImpression(modeRectoVerso);
  });
}

// ----- Recto-verso : automatique ou en deux passes -----
// Les faces ont été ajoutées en alternance (recto, verso, recto, verso…) :
// les enfants IMPAIRS de #zoneImpression sont donc les rectos et les PAIRS les
// versos. Pour une imprimante sans duplex, on imprime les rectos, puis les
// versos une fois la pile remise dans le bac.

function lancerImpression(mode) {
  // mode "passes" : imprimante SANS recto-verso automatique — on imprime
  // d'abord les rectos, puis les versos une fois la pile remise dans le bac.
  if (mode === "passes") {
    definirPasseLivret("recto");
    window.print();
    afficherPanneauVersos();
    return;
  }
  definirPasseLivret(null);
  window.print();
}

function definirPasseLivret(passe) {
  const zone = document.getElementById("zoneImpression");
  if (!zone) return;
  zone.classList.remove("passe-recto", "passe-verso");
  if (passe) zone.classList.add("passe-" + passe);
}

// Panneau guidant la seconde passe (les versos).
function afficherPanneauVersos() {
  const ancien = document.getElementById("panneauVersos");
  if (ancien) ancien.remove();

  const panneau = document.createElement("div");
  panneau.id = "panneauVersos";
  panneau.className = "panneau-versos";
  panneau.innerHTML =
    "<h3>Étape 2 : les versos</h3>" +
    "<p>Reprenez la pile imprimée et remettez-la dans le bac <strong>sans en changer l'ordre</strong>. " +
    "Le sens de rechargement dépend de l'imprimante : au moindre doute, faites l'essai sur une seule feuille.</p>" +
    '<div class="panneau-versos-actions">' +
      '<button class="pv-annuler">Annuler</button>' +
      '<button class="pv-imprimer">Imprimer les versos</button>' +
    "</div>";
  document.body.appendChild(panneau);

  panneau.querySelector(".pv-annuler").onclick = () => {
    definirPasseLivret(null);
    panneau.remove();
  };
  panneau.querySelector(".pv-imprimer").onclick = () => {
    definirPasseLivret("verso");
    window.print();
    definirPasseLivret(null);
    panneau.remove();
  };
}

function creerFaceLivret(demiGauche, demiDroite, f, margeInt, margeExt) {
  const feuille = document.createElement("div");
  feuille.className = "feuille-impression";
  feuille.style.width = (f.larg * 2) + "mm";
  feuille.style.height = f.haut + "mm";
  feuille.appendChild(creerDemiPageLivret(demiGauche, f, margeInt, margeExt));
  feuille.appendChild(creerDemiPageLivret(demiDroite, f, margeInt, margeExt));
  return feuille;
}

// Une demi-feuille : une page de texte, ou une blanche de complément. Les
// couvertures ne passent plus par ici — elles ont leur propre export.
function creerDemiPageLivret(demi, f, margeInt, margeExt) {
  if (!demi || demi.type === "blanche") return creerPageBlancheImpression(f);
  return creerPageTexteImpression(demi.page, demi.numero, f, margeInt, margeExt);
}

function creerPageBlancheImpression(f) {
  const div = document.createElement("div");
  div.className = "page-impression";
  div.style.width = f.larg + "mm";
  div.style.height = f.haut + "mm";
  return div;
}

function creerPageTexteImpression(page, numero, f, margeInt, margeExt) {
  const recto = numero % 2 === 1;
  const div = document.createElement("div");
  div.className = "page-impression";
  div.style.width = f.larg + "mm";
  div.style.height = f.haut + "mm";
  div.style.paddingTop = f.margeV + "mm";
  div.style.paddingLeft = (recto ? margeInt : margeExt) + "mm";
  div.style.paddingRight = (recto ? margeExt : margeInt) + "mm";

  const texte = document.createElement("div");
  texte.className = "texte-impression";
  texte.style.height = (f.haut - f.margeV - PIED_PAGE_MM) + "mm";
  texte.innerHTML = page ? page.contenu : "";
  div.appendChild(texte);

  const num = document.createElement("div");
  num.className = "numero-impression";
  num.textContent = numero;
  div.appendChild(num);

  return div;
}

function creerCouvertureImpression(livre, mode, f, promessesImages) {
  const data = mode === "couverture" ? livre.couverture : livre.quatrieme;

  const div = document.createElement("div");
  div.className = "page-impression couverture-impression";
  div.style.width = f.larg + "mm";
  div.style.height = f.haut + "mm";
  div.style.background = (data && data.fond) || "#1a1a2e";

  if (data && data.imageChemin) {
    const img = document.createElement("img");
    img.className = "image-couverture-impression";
    div.appendChild(img);

    const promesse = new Promise((resoudre) => {
      const secours = setTimeout(resoudre, 8000);
      img.onload = () => {
        clearTimeout(secours);
        positionnerImageImpression(img, data, f);
        resoudre();
      };
      img.onerror = () => { clearTimeout(secours); img.remove(); resoudre(); };

      if (cacheImagesURL[data.imageChemin]) {
        img.src = cacheImagesURL[data.imageChemin];
      } else {
        const token = localStorage.getItem("gh_token");
        obtenirUrlImage(data.imageChemin, token).then((url) => {
          cacheImagesURL[data.imageChemin] = url;
          img.src = url;
        }).catch(() => { clearTimeout(secours); img.remove(); resoudre(); });
      }
    });
    promessesImages.push(promesse);
  }

  const couche = document.createElement("div");
  couche.className = "textes-couverture-impression";
  const couleurTexte = (data && data.texte) || "#ffffff";
  const afficherTitre = !data || data.afficherTitre !== false;
  const afficherAuteur = !data || data.afficherAuteur !== false;
  couche.innerHTML = `
    ${mode === "couverture" && afficherTitre ? `<div class="titre-impression" style="color:${couleurTexte};${styleTexteCouv(data,'titre')}">${livre.titre || ""}</div>` : ""}
    ${afficherAuteur ? `<div class="auteur-impression" style="color:${couleurTexte};${styleTexteCouv(data,'auteur')}">${livre.auteur || ""}</div>` : ""}
  `;
  div.appendChild(couche);
  if (mode === "quatrieme") {
    div.insertAdjacentHTML("beforeend", htmlResumeCouv(data, couleurTexte, "resume-impression"));
  }

  return div;
}

// Reproduit le cadrage choisi dans l'éditeur (contain + zoom + déplacement),
// en convertissant les offsets écran (px à la taille d'édition) vers la
// taille physique de la page imprimée.
function positionnerImageImpression(img, data, f) {
  if (!img.naturalWidth || !img.naturalHeight) return;

  const largPage = f.larg * MM_EN_PX;
  const hautPage = f.haut * MM_EN_PX;

  const echelleBase = Math.min(largPage / img.naturalWidth, hautPage / img.naturalHeight);
  const largAffichee = img.naturalWidth * echelleBase;
  const hautAffichee = img.naturalHeight * echelleBase;
  const centreX = (largPage - largAffichee) / 2;
  const centreY = (hautPage - hautAffichee) / 2;

  const pageEcran = [...document.querySelectorAll(".page-livre")].find(el => el.clientWidth > 0);
  const facteur = pageEcran ? largPage / pageEcran.clientWidth : 1;

  const offsetX = (data.imgOffsetX || 0) * facteur;
  const offsetY = (data.imgOffsetY || 0) * facteur;
  const zoom = data.imgZoom || 1;

  img.style.width = largAffichee + "px";
  img.style.height = hautAffichee + "px";
  img.style.transform = `translate(${centreX + offsetX}px, ${centreY + offsetY}px) scale(${zoom})`;
}

// =====================================================================
//  Export « fichier pour l'imprimeur »
//
//  Produit un PDF conforme aux critères géométriques que les imprimeurs
//  demandent dans leur cahier des charges :
//   - pages simples, jamais en planches (sauf la couverture, qui doit au
//     contraire être fournie ouverte à plat) ;
//   - toutes les pages au même format et à la même orientation, centrées
//     dans la zone de support ;
//   - fond perdu de 5 mm ;
//   - traits de coupe (et de pli pour la couverture) décalés de 5 mm ;
//   - blanc tournant d'au moins 7 mm par rapport au format rogné, folio
//     compris — c'est ce dernier point qui impose de repaginer, le pied
//     de page habituel étant trop bas ;
//   - registre parfait entre pages paires et impaires (marges symétriques) ;
//   - filets d'au moins 0,25 pt.
//
//  Ce qu'un navigateur ne sait PAS faire, et qui reste à la charge de
//  l'utilisateur : la conversion en CMJN, la norme PDF/X-1a, le profil de
//  sortie ISO Coated v2 300 %. Le panneau de contrôle le dit explicitement
//  plutôt que de laisser croire que le fichier est prêt à imprimer.
// =====================================================================

const FOND_PERDU_MM       = 5;   // fond perdu exigé
const DECALAGE_REPERE_MM  = 5;   // décalage des traits de coupe
const LONGUEUR_REPERE_MM  = 6;   // longueur des traits de coupe
const BLANC_TOURNANT_MM   = 7;   // blanc tournant minimum, folio compris
const FILET_REPERE_PT     = 0.25;

// Marge technique autour du format rogné : fond perdu + repères + 1 mm de garde.
const MARGE_TECHNIQUE_MM = DECALAGE_REPERE_MM + LONGUEUR_REPERE_MM + 1; // 12 mm

// Pied de page de l'export imprimeur, en pixels logiques (voir PIED_PAGE_PX
// dans editeur.js). 48 px ≈ 12,7 mm : le folio tient à 7,5 mm du bord rogné
// sans que la dernière ligne de texte vienne le chevaucher.
const PIED_PRO_PX  = 56;
const PIED_PRO_MM  = PIED_PRO_PX * 25.4 / 96;      // ≈ 14,8 mm
const FOLIO_PRO_MM = 8;                            // > BLANC_TOURNANT_MM
// Le texte rendu à l'impression occupe quelques pixels de plus que dans le
// mesureur de pagination (justification et césure automatique, absentes du
// mesureur). L'export normal absorbe déjà cet écart par une tolérance ; on
// garde le même principe ici, en dimensionnant le pied pour que la tolérance
// ne fasse jamais descendre le texte sur la bande du folio :
//   bas du texte  = 210 - 20 - 177,2 = 12,8 mm du bord rogné
//   haut du folio = 8 + 3,5          = 11,5 mm du bord rogné
const TOLERANCE_PRO_MM = 2;

// Épaisseur d'une feuille : grammage × main / 1000 (en mm).
// La « main » (ou bouffant) dépend du papier ; 1,2 correspond à un offset
// courant. Seul l'imprimeur peut donner la valeur exacte de son papier.
const GRAMMAGE_DEFAUT = 90;
const MAIN_DEFAUT = 1.2;

function epaisseurDosMm(nbPages, grammage, main) {
  return (nbPages / 2) * grammage * main / 1000;
}

// Nom de fichier accepté : A-Z, a-z, 0-9 et _ uniquement, précédé de
// l'abréviation du type de fichier (int = intérieur, cv = couverture).
function nomFichierConforme(prefixe, titre) {
  const base = (titre || "livre")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // retire les accents
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return prefixe + "_" + (base || "livre");
}

// Repagine le livre avec le pied de page de l'export imprimeur, exécute le
// travail demandé, puis remet la pagination d'origine dans tous les cas.
function avecPaginationImprimeur(livre, travail) {
  const piedInitial = PIED_PAGE_PX;
  // Le mesureur compose en drapeau et sans césure, alors que le fichier
  // imprimeur est justifié avec césure : sans cet accord, les lignes ne
  // tombent pas au même endroit et le bas des pages est rogné à l'impression.
  const mesure = document.getElementById("mesureCachee");
  try {
    if (mesure) mesure.classList.add("mesure-pro");
    PIED_PAGE_PX = PIED_PRO_PX;
    appliquerFormatPage(livre.format || "149x210");
    repaginerTout();
    return travail();
  } finally {
    if (mesure) mesure.classList.remove("mesure-pro");
    PIED_PAGE_PX = piedInitial;
    appliquerFormatPage(livre.format || "149x210");
    repaginerTout();
  }
}

// ----- Deux pages par feuille, à couper au milieu -----
//
// Même reliure que « page à page », mais deux pages côte à côte : on coupe la
// pile en deux d'un coup de massicot, on pose la moitié droite sous la moitié
// gauche, et le livre est dans l'ordre.
//
// C'est ce qui rend l'imposition indispensable. Poser bêtement 1 et 2 côte à
// côte donnerait, après la coupe, deux tas où les pages sautent de deux en
// deux. La colonne de gauche porte donc la PREMIÈRE moitié du livre, celle de
// droite la SECONDE : chaque tas reste continu, et l'un se pose sous l'autre.
//
// Le recto-verso doit retourner sur les GRANDS bords : c'est ce qui garde la
// moitié gauche à gauche au verso. Sur les petits bords, le livre sortirait
// mélangé.

function exporterDeuxPages(modeRectoVerso) {
  flushSpread();
  repaginerTout();
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];

  let stylePage = document.getElementById("stylePageImpression");
  if (!stylePage) {
    stylePage = document.createElement("style");
    stylePage.id = "stylePageImpression";
    document.head.appendChild(stylePage);
  }

  const largFeuille = f.larg * 2;
  const papier = papierMinimal(largFeuille, f.haut, 2);
  if (papier) reglerPagePapier(stylePage, papier);
  else stylePage.textContent = "@page { size: " + largFeuille + "mm " + f.haut + "mm; margin: 0; }";

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);
  const promessesImages = [];

  // Les faces, dans l'ordre de lecture — le texte seul, les couvertures
  // s'imprimant à part.
  const suite = [];
  (livre.pages || []).forEach((page, i) => suite.push({ type: "texte", page, numero: i + 1 }));
  // Une feuille porte quatre faces : le compte doit tomber juste, sinon la
  // coupe décale tout le second tas.
  while (suite.length % 4 !== 0) suite.push({ type: "blanche" });

  const moitie = suite.length / 2;

  for (let k = 0; k < suite.length / 4; k++) {
    const recto = creerFaceLivret(suite[2 * k], suite[moitie + 2 * k], f, margeInt, margeExt);
    const verso = creerFaceLivret(suite[2 * k + 1], suite[moitie + 2 * k + 1], f, margeInt, margeExt);
    [recto, verso].forEach((face) => {
      ajouterTraitMilieu(face, f.larg, f.haut);
      zone.appendChild(papier ? poserSurPapier(face, papier, largFeuille, f.haut) : face);
    });
  }

  const message = document.getElementById("message");
  if (message) message.textContent = "Préparation de l'impression...";

  Promise.all(promessesImages).finally(() => {
    if (message) message.textContent = "";
    lancerImpression(modeRectoVerso);
  });
}

// La ligne de coupe entre les deux pages. Elle tombe dans la marge intérieure
// des deux pages, jamais dans le texte, et disparaît avec le coup de massicot.
function ajouterTraitMilieu(face, largPageMm, hautMm) {
  const trait = document.createElement("div");
  trait.className = "trait-milieu";
  trait.style.left = largPageMm + "mm";
  trait.style.height = hautMm + "mm";
  face.appendChild(trait);
}

// ----- Couverture seule (reliure maison) -----
//
// Le dos collé se fabrique en deux temps : les pages d'un côté, la couverture
// de l'autre. Elle doit sortir OUVERTE À PLAT — 4e de couverture, dos, 1re —
// pour qu'une fois pliée sur les deux traits, la tranche tombe au milieu.
//
// C'est la planche de l'export imprimeur, sans le contrôle avant envoi qui
// n'a pas lieu d'être ici : on ne demande que l'épaisseur du dos.

function exporterCouvertureSeule() {
  flushSpread();
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];
  // Le nombre de pages à l'écran suffit à estimer le dos : inutile de relancer
  // la pagination imprimeur, qui coûte plusieurs secondes sur un gros livre et
  // ne changerait l'épaisseur que d'une fraction de millimètre.
  const nbPages = (livre.pages || []).length;
  ouvrirDialogueCouvertureSeule(livre, f, nbPages);
}

function ouvrirDialogueCouvertureSeule(livre, f, nbPages) {
  const ancien = document.getElementById("dialogueCouverture");
  if (ancien) ancien.remove();

  const dos = epaisseurDosMm(nbPages, GRAMMAGE_DEFAUT, MAIN_DEFAUT);
  const largSupport = (larg) => 2 * f.larg + larg + 2 * MARGE_TECHNIQUE_MM;
  const hautSupport = f.haut + 2 * MARGE_TECHNIQUE_MM;

  let html = '<div class="modal-impression-carte ci-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>Imprimer la couverture</h3>" +
    '<p class="mi-intro">Une seule feuille, ouverte à plat : 4e de couverture, dos, ' +
      "1re de couverture. Deux traits marquent les plis du dos, quatre autres les coupes.</p>";

  html += '<div class="ci-resume">' +
    "<div><span>Format du livre</span><strong>" + f.larg + " × " + f.haut + " mm</strong></div>" +
    '<div><span>Planche à plat</span><strong class="dc-support">' +
      largSupport(dos).toFixed(0) + " × " + hautSupport + " mm</strong></div>" +
  "</div>";

  html += '<div class="ci-dos">' +
    "<h4>Papier chargé dans l'imprimante</h4>" +
    '<div class="ci-champs">' +
      '<label>Feuille <select id="dcPapier">' +
        PAPIERS.map((pa) => '<option value="' + pa.cle + '">' + pa.nom +
          " (" + pa.larg + " × " + pa.haut + " mm)</option>").join("") +
        '<option value="exact">Taille exacte de la planche (pour un PDF)</option>' +
      "</select></label>" +
    "</div>" +
    '<p class="ci-note">La planche est centrée sur cette feuille, à sa taille réelle. ' +
      "C'est ce qui garantit que la couverture tombe autour des pages : sans papier " +
      "déclaré, le navigateur met le travail à l'échelle de la feuille et chaque " +
      "export sort à une échelle différente.</p>" +
  "</div>";

  html += '<div class="ci-dos">' +
    "<h4>Épaisseur du dos</h4>" +
    '<div class="ci-champs">' +
      '<label>Grammage <input type="number" id="dcGrammage" value="' + GRAMMAGE_DEFAUT + '" min="50" max="200" step="5"> g/m²</label>' +
      '<label>Main <input type="number" id="dcMain" value="' + MAIN_DEFAUT + '" min="0.8" max="2.5" step="0.05"></label>' +
      '<label>Dos <input type="number" id="dcDos" value="' + dos.toFixed(1) + '" min="0" max="60" step="0.1"> mm</label>' +
    "</div>" +
    '<p class="ci-note">Calculé pour ' + nbPages + " pages sur du papier ordinaire. " +
      "Mesurez la tranche de votre pile une fois imprimée et reportez la valeur ici : " +
      "c'est elle qui place les plis.<br>" +
      "<strong>Livret à agrafer :</strong> mettez 0. Le cahier n'a pas de dos plat — la " +
      "couverture se plie en deux et s'agrafe avec les pages.</p>" +
  "</div>";

  html += '<p class="ci-note dc-papier"></p>';

  html += '<p class="ci-reglages"><strong>Dans la fenêtre d&rsquo;impression :</strong> échelle 100 % ' +
    "(jamais « ajuster à la page »), marges « aucune », et décochez les en-têtes et pieds de page " +
    "du navigateur. Sans quoi les plis ne tomberaient plus au bon endroit.</p>";

  html += '<div class="ci-actions">' +
    '<button class="ci-annuler">Annuler</button>' +
    '<button class="ci-generer">Imprimer la couverture</button>' +
  "</div></div>";

  const fond = document.createElement("div");
  fond.id = "dialogueCouverture";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  fond.addEventListener("click", (e) => { if (e.target === fond) fond.remove(); });
  document.body.appendChild(fond);

  const champDos = fond.querySelector("#dcDos");

  // La feuille à plat dépasse presque toujours l'A4 : mieux vaut le dire ici
  // que devant une couverture tronquée.
  const selPapier = fond.querySelector("#dcPapier");

  const majSupport = () => {
    const d = parseFloat(champDos.value);
    const dosMm = (isFinite(d) && d >= 0) ? d : dos;
    const l = largSupport(dosMm);
    fond.querySelector(".dc-support").textContent = l.toFixed(0) + " × " + hautSupport + " mm";

    const papier = papierParCle(selPapier.value);
    const note = fond.querySelector(".dc-papier");
    if (!papier) {
      note.textContent = "Taille exacte : à réserver au PDF. Sur une imprimante, le pilote " +
        "ramènera la planche au format du papier chargé, et la couverture ne fera plus la " +
        "bonne taille.";
      note.classList.add("dc-alerte");
    } else if (papier.larg < l || papier.haut < hautSupport) {
      note.textContent = "La planche (" + l.toFixed(0) + " × " + hautSupport +
        " mm) ne tient pas sur cette feuille : elle sera rognée. Prenez du " +
        (papierMinimal(l, hautSupport) || { nom: "plus grand" }).nom + ".";
      note.classList.add("dc-alerte");
    } else {
      note.textContent = "La planche tient sur cette feuille, à sa taille réelle.";
      note.classList.remove("dc-alerte");
    }
  };
  selPapier.onchange = majSupport;

  const recalculer = () => {
    const g = parseFloat(fond.querySelector("#dcGrammage").value) || GRAMMAGE_DEFAUT;
    const m = parseFloat(fond.querySelector("#dcMain").value) || MAIN_DEFAUT;
    champDos.value = epaisseurDosMm(nbPages, g, m).toFixed(1);
    majSupport();
  };
  fond.querySelector("#dcGrammage").oninput = recalculer;
  fond.querySelector("#dcMain").oninput = recalculer;
  champDos.oninput = majSupport;
  const parDefaut = papierMinimal(largSupport(dos), hautSupport);
  if (parDefaut) selPapier.value = parDefaut.cle;
  majSupport();

  fond.querySelector(".mi-fermer").onclick = () => fond.remove();
  fond.querySelector(".ci-annuler").onclick = () => fond.remove();
  fond.querySelector(".ci-generer").onclick = () => {
    const saisi = parseFloat(champDos.value);
    const dosMm = (isFinite(saisi) && saisi >= 0) ? saisi : dos;
    fond.remove();
    // Aucune page intérieure à fournir : la planche de couverture n'en utilise pas.
    const papier = papierParCle(selPapier.value);
    setTimeout(() => genererFichierImprimeur("couverture", dosMm, livre, f, [], papier), 50);
  };
}

// ----- Panneau de contrôle avant génération -----

function exporterImprimeur(cible) {
  flushSpread();
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];
  const pagesEcran = (livre.pages || []).length;

  // Une seule repagination : on en garde un INSTANTANÉ du contenu des pages,
  // et le livre retrouve aussitôt sa pagination d'écran. Le fichier est
  // ensuite construit à partir de cet instantané, sans plus y toucher —
  // repaginer deux fois de plus coûterait plusieurs secondes sur un gros livre.
  const message = document.getElementById("message");
  if (message) message.textContent = "Calcul de la pagination imprimeur...";
  const pagesPro = avecPaginationImprimeur(livre,
    () => (livre.pages || []).map(p => (p && p.contenu) || ""));
  if (message) message.textContent = "";

  ouvrirControleImprimeur(cible, livre, f, pagesEcran, pagesPro);
}

function ouvrirControleImprimeur(cible, livre, f, pagesEcran, pagesPro) {
  const nbPagesPro = pagesPro.length;
  fermerPanneauImpression();
  const ancien = document.getElementById("controleImprimeur");
  if (ancien) ancien.remove();

  const couverture = cible === "couverture";
  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);
  const blancTournant = Math.min(margeExt, f.margeV, FOLIO_PRO_MM);
  const dos = epaisseurDosMm(nbPagesPro, GRAMMAGE_DEFAUT, MAIN_DEFAUT);

  const conformes = [
    "Pages simples, jamais en planches" + (couverture ? " — sauf la couverture, fournie ouverte à plat comme demandé" : ""),
    "Toutes les pages au même format (" + f.larg + " × " + f.haut + " mm) et à la même orientation",
    "Pages centrées dans la zone de support",
    "Fond perdu de " + FOND_PERDU_MM + " mm sur les quatre bords",
    "Traits de coupe" + (couverture ? " et de pli" : "") + " décalés de " + DECALAGE_REPERE_MM + " mm, en filet de " + FILET_REPERE_PT + " pt",
    "Blanc tournant de " + blancTournant.toFixed(1).replace(".", ",") + " mm, folio compris (minimum exigé : " + BLANC_TOURNANT_MM + " mm)",
    "Registre assuré : marges paires et impaires symétriques (" + margeInt + " mm au petit fond, " + margeExt + " mm au grand fond)",
    "Fichier sans protection"
  ];

  const restants = [
    "<strong>Conversion en CMJN et à la norme PDF/X-1a</strong> : un navigateur exporte en RVB, en PDF 1.4. C'est la seule étape que cet éditeur ne peut pas faire.",
    "<strong>Profil de sortie ISO Coated v2 300 %</strong> à appliquer lors de cette conversion.",
    "<strong>Résolution des images</strong> : 300 ppp pour les photos, 600 à 1 200 ppp pour les dessins au trait.",
    "<strong>BAT</strong> : les pages intérieures imprimées au recto uniquement, sans réduction ni agrandissement et sans correction manuscrite, plus un BAT couleur de la couverture."
  ];
  if (couverture) {
    restants.push("<strong>Fond perdu de la couverture</strong> : les 5 mm débordants sont remplis par la couleur de fond, pas par la photo.");
    restants.push("<strong>Épaisseur du dos</strong> : à faire confirmer par l'imprimeur, elle dépend du papier choisi.");
  }

  const nom = nomFichierConforme(couverture ? "cv" : "int", livre.titre);
  const largSupport = couverture
    ? (2 * f.larg + dos + 2 * MARGE_TECHNIQUE_MM).toFixed(1).replace(".", ",")
    : String(f.larg + 2 * MARGE_TECHNIQUE_MM);

  let html = '<div class="modal-impression-carte ci-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>Contrôle avant envoi</h3>" +
    '<p class="mi-intro">' + (couverture
      ? "Couverture ouverte à plat : 4e de couverture, dos et 1re réunis en une seule planche."
      : "Pages intérieures seules, en pages simples numérotées.") +
    ' <a href="imprimeur.html" target="_blank" rel="noopener">Guide du fichier imprimeur</a>.</p>';

  html += '<div class="ci-resume">' +
    "<div><span>Format rogné</span><strong>" + f.larg + " × " + f.haut + " mm</strong></div>" +
    "<div><span>Support à générer</span><strong>" + largSupport +
      " × " + (f.haut + 2 * MARGE_TECHNIQUE_MM) + " mm</strong></div>" +
    "<div><span>Pages du fichier</span><strong>" + (couverture ? "1 planche" : nbPagesPro + " pages") + "</strong></div>" +
    '<div><span>Nom à donner</span><strong class="ci-nom">' + nom + ".pdf</strong></div>" +
  "</div>";

  if (!couverture && nbPagesPro !== pagesEcran) {
    html += '<p class="ci-note">Le fichier compte ' + nbPagesPro + " pages, contre " + pagesEcran +
      " à l'écran : le folio est remonté pour respecter le blanc tournant de 7 mm, ce qui réduit " +
      "légèrement la hauteur de texte. Votre livre à l'écran n'est pas modifié.</p>";
  }
  if (!couverture && nbPagesPro % 4 !== 0) {
    html += '<p class="ci-note">' + nbPagesPro + " n'est pas un multiple de 4 : la plupart des reliures " +
      "en demandent un. L'imprimeur ajoutera des pages blanches, ou vous pouvez en prévoir " +
      (4 - (nbPagesPro % 4)) + " vous-même.</p>";
  }

  if (couverture) {
    html += '<div class="ci-dos">' +
      "<h4>Épaisseur du dos</h4>" +
      '<div class="ci-champs">' +
        '<label>Grammage <input type="number" id="ciGrammage" value="' + GRAMMAGE_DEFAUT + '" min="50" max="200" step="5"> g/m²</label>' +
        '<label>Main <input type="number" id="ciMain" value="' + MAIN_DEFAUT + '" min="0.8" max="2.5" step="0.05"></label>' +
        '<label>Dos <input type="number" id="ciDos" value="' + dos.toFixed(1) + '" min="0" max="60" step="0.1"> mm</label>' +
      "</div>" +
      '<p class="ci-note">Calculé pour ' + nbPagesPro + " pages. Modifiez le dos directement si votre imprimeur vous donne sa valeur.</p>" +
    "</div>";
  }

  html += '<div class="ci-listes">' +
    '<div class="ci-bloc ci-ok"><h4>Conforme automatiquement</h4><ul>' +
      conformes.map(x => "<li>" + x + "</li>").join("") +
    "</ul></div>" +
    '<div class="ci-bloc ci-reste"><h4>À faire de votre côté</h4><ul>' +
      restants.map(x => "<li>" + x + "</li>").join("") +
    "</ul></div>" +
  "</div>";

  html += '<p class="ci-reglages"><strong>Dans la fenêtre d\'impression :</strong> destination ' +
    "« Enregistrer au format PDF », échelle 100 % (jamais « ajuster à la page »), marges « aucune », " +
    "et décochez les en-têtes et pieds de page du navigateur.</p>";

  html += '<div class="ci-actions">' +
    '<button class="ci-annuler">Annuler</button>' +
    '<button class="ci-generer">Générer le PDF</button>' +
  "</div></div>";

  const fond = document.createElement("div");
  fond.id = "controleImprimeur";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  fond.addEventListener("click", (e) => { if (e.target === fond) fond.remove(); });
  document.body.appendChild(fond);

  fond.querySelector(".mi-fermer").onclick = () => fond.remove();
  fond.querySelector(".ci-annuler").onclick = () => fond.remove();

  // Recalcul du dos quand le grammage ou la main changent
  const champDos = fond.querySelector("#ciDos");
  if (champDos) {
    const recalculer = () => {
      const g = parseFloat(fond.querySelector("#ciGrammage").value) || GRAMMAGE_DEFAUT;
      const m = parseFloat(fond.querySelector("#ciMain").value) || MAIN_DEFAUT;
      champDos.value = epaisseurDosMm(nbPagesPro, g, m).toFixed(1);
    };
    fond.querySelector("#ciGrammage").oninput = recalculer;
    fond.querySelector("#ciMain").oninput = recalculer;
  }

  fond.querySelector(".ci-generer").onclick = () => {
    // Un champ vidé ou mal saisi ne doit pas produire une couverture sans dos :
    // on retombe alors sur la valeur calculée.
    let dosMm = 0;
    if (champDos) {
      const saisi = parseFloat(champDos.value);
      dosMm = (isFinite(saisi) && saisi >= 0) ? saisi : dos;
    }
    fond.remove();
    setTimeout(() => genererFichierImprimeur(cible, dosMm, livre, f, pagesPro), 50);
  };
}

// ----- Génération du fichier -----

function genererFichierImprimeur(cible, dosMm, livre, f, pagesPro, papier) {
  const message = document.getElementById("message");
  if (message) message.textContent = "Préparation du fichier imprimeur...";

  const promessesImages = [];

  const construire = () => {
    let zone = document.getElementById("zoneImpression");
    if (zone) zone.remove();
    zone = document.createElement("div");
    zone.id = "zoneImpression";
    zone.classList.add("zone-pro");
    document.body.appendChild(zone);

    let stylePage = document.getElementById("stylePageImpression");
    if (!stylePage) {
      stylePage = document.createElement("style");
      stylePage.id = "stylePageImpression";
      document.head.appendChild(stylePage);
    }

    if (cible === "couverture") {
      const largSupport = 2 * f.larg + dosMm + 2 * MARGE_TECHNIQUE_MM;
      const hautSupport = f.haut + 2 * MARGE_TECHNIQUE_MM;
      const planche = creerCouverturePlat(livre, f, dosMm, promessesImages);
      // Sur une imprimante, la planche est centrée sur une feuille réelle pour
      // sortir à sa taille exacte. Pour l'imprimeur, c'est le support lui-même
      // qui doit faire cette taille : pas d'enveloppe.
      if (papier) {
        reglerPagePapier(stylePage, papier);
        // La planche porte déjà ses propres repères de coupe et de pli : ce
        // sont ses bords rognés qui comptent, pas ceux du support.
        zone.appendChild(poserSurPapier(planche, papier, largSupport, hautSupport));
      } else {
        stylePage.textContent = "@page { size: " + largSupport + "mm " + hautSupport + "mm; margin: 0; }";
        zone.appendChild(planche);
      }
      return;
    }

    stylePage.textContent = "@page { size: " + (f.larg + 2 * MARGE_TECHNIQUE_MM) + "mm " +
      (f.haut + 2 * MARGE_TECHNIQUE_MM) + "mm; margin: 0; }";

    const margeInt = f.margeH + DELTA_RELIURE_MM;
    const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);
    pagesPro.forEach((contenu, i) => {
      zone.appendChild(creerPagePro(contenu, i + 1, f, margeInt, margeExt));
    });
  };

  // Construction à partir de l'instantané : la pagination du livre à l'écran
  // n'est pas touchée, et aucune repagination n'est relancée ici.
  construire();

  Promise.all(promessesImages).finally(() => {
    if (message) message.textContent = "";
    definirPasseLivret(null);
    window.print();
  });
}

// Feuille = format rogné + marge technique (fond perdu + repères).
function creerFeuillePro(largTrim, hautTrim) {
  const feuille = document.createElement("div");
  feuille.className = "feuille-pro";
  feuille.style.width  = (largTrim + 2 * MARGE_TECHNIQUE_MM) + "mm";
  feuille.style.height = (hautTrim + 2 * MARGE_TECHNIQUE_MM) + "mm";
  return feuille;
}

// Zone rognée, centrée dans la zone de support.
function creerZoneRognePro(largTrim, hautTrim) {
  const zone = document.createElement("div");
  zone.className = "zone-rogne-pro";
  zone.style.left   = MARGE_TECHNIQUE_MM + "mm";
  zone.style.top    = MARGE_TECHNIQUE_MM + "mm";
  zone.style.width  = largTrim + "mm";
  zone.style.height = hautTrim + "mm";
  return zone;
}

// Traits de coupe aux quatre angles, décalés de 5 mm du format rogné.
// Les traits ne mordent jamais sur la zone de fond perdu.
function ajouterReperesCoupe(feuille, largTrim, hautTrim) {
  const M = MARGE_TECHNIQUE_MM;
  const d = DECALAGE_REPERE_MM;
  const L = LONGUEUR_REPERE_MM;

  const trait = (sens, styles) => {
    const t = document.createElement("div");
    t.className = "repere-pro repere-" + sens;
    Object.assign(t.style, styles);
    feuille.appendChild(t);
  };

  [M, M + largTrim].forEach((x, ix) => {
    [M, M + hautTrim].forEach((y, iy) => {
      // trait horizontal, prolongeant le bord haut ou bas vers l'extérieur
      trait("h", {
        left: (ix === 0 ? x - d - L : x + d) + "mm",
        top: y + "mm", width: L + "mm", height: "0mm"
      });
      // trait vertical, prolongeant le bord gauche ou droit vers l'extérieur
      trait("v", {
        left: x + "mm",
        top: (iy === 0 ? y - d - L : y + d) + "mm",
        width: "0mm", height: L + "mm"
      });
    });
  });
}

// Repères de pli : verticaux, de part et d'autre du dos.
function ajouterReperesPli(feuille, hautTrim, positionsMm) {
  const M = MARGE_TECHNIQUE_MM;
  const d = DECALAGE_REPERE_MM;
  const L = LONGUEUR_REPERE_MM;
  positionsMm.forEach((x) => {
    [M - d - L, M + hautTrim + d].forEach((y) => {
      const t = document.createElement("div");
      t.className = "repere-pro repere-v repere-pli-pro";
      t.style.left = (M + x) + "mm";
      t.style.top = y + "mm";
      t.style.width = "0mm";
      t.style.height = L + "mm";
      feuille.appendChild(t);
    });
  });
}

// Page intérieure : recto = page impaire (petit fond à gauche).
function creerPagePro(contenu, numero, f, margeInt, margeExt) {
  const recto = numero % 2 === 1;
  const feuille = creerFeuillePro(f.larg, f.haut);
  const zone = creerZoneRognePro(f.larg, f.haut);

  zone.style.paddingTop = f.margeV + "mm";
  zone.style.paddingLeft = (recto ? margeInt : margeExt) + "mm";
  zone.style.paddingRight = (recto ? margeExt : margeInt) + "mm";

  const texte = document.createElement("div");
  texte.className = "texte-impression";
  texte.style.height = (f.haut - f.margeV - PIED_PRO_MM + TOLERANCE_PRO_MM) + "mm";
  texte.innerHTML = contenu || "";
  zone.appendChild(texte);

  const num = document.createElement("div");
  num.className = "numero-impression numero-pro";
  num.style.bottom = FOLIO_PRO_MM + "mm";
  num.textContent = numero;
  zone.appendChild(num);

  feuille.appendChild(zone);
  ajouterReperesCoupe(feuille, f.larg, f.haut);
  return feuille;
}

// ----- La tranche (le dos du livre) -----
//
// Troisième face visible d'un livre relié, et la seule qu'on voie une fois
// rangé dans une bibliothèque. Elle se règle donc comme les deux autres, à
// ceci près qu'elle est haute et étroite : pas d'image de fond ici, une
// bande de quelques millimètres n'en montrerait rien.
//
// Chaque réglage peut valoir « comme la couverture » (valeur nulle) : un
// livre déjà écrit garde exactement l'aspect qu'il avait, sans migration.

function donneesTranche(livre) {
  const t = (livre && livre.tranche) || {};
  const couv = (livre && livre.couverture) || {};
  return {
    fond: t.fond || couv.fond || "#1a1a2e",
    texte: t.texte || couv.texte || "#ffffff",
    // Le contenu par défaut est celui d'avant ce réglage : « Titre — Auteur ».
    contenu: typeof t.contenu === "string" && t.contenu.trim()
      ? t.contenu
      : [livre && livre.titre, livre && livre.auteur].filter(Boolean).join(" — "),
    // Sens de lecture. Les deux existent en rayon : de haut en bas chez la
    // plupart des éditeurs actuels, de bas en haut dans la tradition
    // française. On garde le premier par défaut, qui est ce que le dos
    // faisait avant d'être réglable.
    sens: t.sens === "montant" ? "montant" : "descendant",
    taille: Number(t.taille) > 0 ? Number(t.taille) : 10,
    // Blocs facultatifs, dans l'ordre où ils se posent sur le dos.
    // Tous vides par défaut : un livre déjà écrit ne change pas d'aspect.
    bandeau: Number(t.bandeau) > 0 ? Number(t.bandeau) : 0,
    // Image du bandeau : la sienne si on lui en a donné une, sinon celle de
    // la couverture, qui se prolonge alors sur le dos.
    imageChemin: t.imageChemin || null,
    pastille: typeof t.pastille === "string" ? t.pastille : "",
    pastilleFond: t.pastilleFond || "#22c55e",
    pastilleTexte: t.pastilleTexte || "#0b1220",
    pastilleTaille: Number(t.pastilleTaille) > 0 ? Number(t.pastilleTaille) : 9,
    surtitre: typeof t.surtitre === "string" ? t.surtitre : "",
    surtitreTaille: Number(t.surtitreTaille) > 0 ? Number(t.surtitreTaille) : 6,
    credits: typeof t.credits === "string" ? t.credits : "",
    creditsTaille: Number(t.creditsTaille) > 0 ? Number(t.creditsTaille) : 5.5,
    pied: typeof t.pied === "string" ? t.pied : "",
    piedTaille: Number(t.piedTaille) > 0 ? Number(t.piedTaille) : 6,
    // En dessous de 6 mm, l'usage est de laisser le dos nu : le texte
    // tomberait sur les plis. On peut passer outre en connaissance de cause.
    forcerTexte: !!t.forcerTexte
  };
}

// Le texte tient-il sur ce dos ? En dessous de 6 mm, non — sauf insistance.
function tranchePorteTexte(reglages, dosMm) {
  return !!reglages.contenu.trim() && (dosMm >= 6 || reglages.forcerTexte);
}

// Le dos, tel qu'il s'imprime. Un seul constructeur sert la planche de
// couverture ET l'aperçu du panneau de réglage : ce qu'on voit à l'écran est
// exactement ce qui sortira, à l'échelle près.
//
// L'ordre des blocs est celui d'un livre en rayon : le bandeau d'image en
// tête, la pastille de tome, le titre au centre, les crédits en dessous, la
// marque de l'éditeur au pied.
function construireDosLivre(livre, dosMm, hautMm, promessesImages) {
  const r = donneesTranche(livre);
  const dos = document.createElement("div");
  dos.className = "dos-pro";
  dos.style.width = dosMm + "mm";
  dos.style.height = hautMm + "mm";
  dos.style.background = r.fond;
  dos.style.color = r.texte;

  const montant = r.sens === "montant";
  // Un texte tourné se lit dans le sens choisi ; la pastille et le pied
  // restent droits, comme sur les livres qu'ils imitent.
  const tourne = (el) => {
    el.classList.add("dos-vertical");
    if (montant) el.classList.add("montant");
    return el;
  };

  // 1) Bandeau : le haut de l'image de couverture, qui se prolonge sur le dos.
  const cheminBandeau = r.imageChemin ||
    (livre.couverture && livre.couverture.imageChemin) || null;
  if (r.bandeau > 0 && cheminBandeau) {
    const bande = document.createElement("div");
    bande.className = "dos-bandeau";
    bande.style.height = r.bandeau + "mm";
    const img = document.createElement("img");
    bande.appendChild(img);
    dos.appendChild(bande);
    chargerImageCouverture(img, cheminBandeau, promessesImages);
  }

  // 2) Pastille : le numéro de tome, droit, sur son propre aplat.
  if (r.pastille.trim()) {
    const p = document.createElement("div");
    p.className = "dos-pastille";
    p.style.background = r.pastilleFond;
    p.style.color = r.pastilleTexte;
    p.style.fontSize = r.pastilleTaille + "pt";
    p.textContent = r.pastille;
    dos.appendChild(p);
  }

  // 3) Le titre, au centre, éventuellement précédé d'un surtitre en plus
  //    petit — les deux côte à côte sur la largeur du dos.
  const centre = document.createElement("div");
  centre.className = "dos-centre";
  if (tranchePorteTexte(r, dosMm)) {
    const groupe = tourne(document.createElement("div"));
    groupe.className += " dos-titre-groupe";

    if (r.surtitre.trim()) {
      const st = document.createElement("div");
      st.className = "dos-ligne";
      st.style.fontSize = r.surtitreTaille + "pt";
      st.textContent = r.surtitre;
      groupe.appendChild(st);
    }
    const t = document.createElement("div");
    t.className = "dos-ligne dos-titre";
    t.style.fontSize = r.taille + "pt";
    t.textContent = r.contenu;
    groupe.appendChild(t);

    centre.appendChild(groupe);
  }
  dos.appendChild(centre);

  // 4) Crédits : une colonne par ligne saisie (« Scénariste YC »).
  const lignes = r.credits.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lignes.length && tranchePorteTexte(r, dosMm)) {
    const groupe = tourne(document.createElement("div"));
    groupe.className += " dos-credits";
    groupe.style.fontSize = r.creditsTaille + "pt";
    lignes.forEach((l) => {
      const d = document.createElement("div");
      d.className = "dos-ligne";
      d.textContent = l;
      groupe.appendChild(d);
    });
    dos.appendChild(groupe);
  }

  // 5) Pied : la marque de l'éditeur, droite comme la pastille.
  if (r.pied.trim()) {
    const p = document.createElement("div");
    p.className = "dos-pied";
    p.style.fontSize = r.piedTaille + "pt";
    p.textContent = r.pied;
    dos.appendChild(p);
  }

  return dos;
}

// L'image de couverture, résolue depuis GitHub comme pour les autres faces.
// Sans tableau de promesses (aperçu à l'écran), on n'attend rien.
function chargerImageCouverture(img, chemin, promessesImages) {
  const poser = (url) => { img.src = url; };
  if (cacheImagesURL[chemin]) {
    poser(cacheImagesURL[chemin]);
    return;
  }
  const token = localStorage.getItem("gh_token");
  const promesse = new Promise((resoudre) => {
    const secours = setTimeout(resoudre, 8000);
    img.onload = () => { clearTimeout(secours); resoudre(); };
    img.onerror = () => { clearTimeout(secours); img.remove(); resoudre(); };
    obtenirUrlImage(chemin, token).then((url) => {
      cacheImagesURL[chemin] = url;
      poser(url);
    }).catch(() => { clearTimeout(secours); img.remove(); resoudre(); });
  });
  if (promessesImages) promessesImages.push(promesse);
}

// ----- Réglage de la tranche -----
//
// La couverture et la 4e ouvrent une vue entière : elles ont une image de
// fond à cadrer. La tranche, elle, s'ajuste sur un panneau, avec l'aperçu à
// côté des champs — un aperçu qui n'est pas une imitation : c'est le dos
// réel, construit par le même code que la planche d'impression, simplement
// réduit à l'échelle.

const HAUTEUR_APERCU_DOS = 300; // px

function ouvrirTranche() {
  if (modeApercu || modeCouverture) return;
  flushSpread();

  const livre = livreActuel();
  if (!livre) return;
  if (!livre.tranche) livre.tranche = {};
  const t = livre.tranche;
  const d = donneesTranche(livre);
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];

  const ancien = document.getElementById("dialogueTranche");
  if (ancien) ancien.remove();

  // Épaisseur d'aperçu : celle qu'aura le dos pour le nombre de pages actuel.
  const dosMm = epaisseurDosMm((livre.pages || []).length, GRAMMAGE_DEFAUT, MAIN_DEFAUT);
  const aImage = !!(livre.couverture && livre.couverture.imageChemin);

  const champ = (id, libelle, valeur, attrs) =>
    '<label class="tr-champ"><span>' + libelle + "</span>" +
    '<input id="' + id + '" value="' + echapperTitre(valeur) + '" ' + (attrs || "") + "></label>";

  const nombre = (id, libelle, valeur, min, max) =>
    '<label class="tr-champ tr-court"><span>' + libelle + "</span>" +
    '<input type="number" id="' + id + '" value="' + valeur + '" min="' + min +
    '" max="' + max + '" step="0.5"></label>';

  let html = '<div class="modal-impression-carte ci-carte tr-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>La tranche</h3>" +
    '<p class="mi-intro">Le dos du livre : la seule face visible une fois rangé ' +
    "dans une bibliothèque. Chaque bloc est facultatif — laissez vide ce dont " +
    "vous ne voulez pas.</p>" +
    '<div class="tranche-atelier">' +
      '<div class="tranche-reglages">' +

      '<fieldset class="tr-bloc"><legend>Fond</legend>' +
        '<div class="tranche-duo">' +
          '<label>Couleur <input type="color" id="trFond" value="' + d.fond + '"></label>' +
          '<label>Texte <input type="color" id="trTexte" value="' + d.texte + '"></label>' +
          '<button type="button" class="btn-lien" id="trReset">Comme la couverture</button>' +
        "</div>" +
        '<div class="tranche-duo">' +
          nombre("trBandeau", "Bandeau d'image (mm)", d.bandeau, 0, 200) +
          '<label class="btn-fichier">Choisir une image' +
            '<input type="file" id="trImage" accept="image/*" hidden></label>' +
          '<button type="button" class="btn-lien" id="trImageRetirer">Retirer</button>' +
        "</div>" +
        '<p class="aide-champ" id="trImageNote"></p>' +
      "</fieldset>" +

      '<fieldset class="tr-bloc"><legend>Pastille</legend>' +
        '<div class="tranche-duo">' +
          champ("trPastille", "Texte", d.pastille, 'maxlength="6" class="tr-mini"') +
          '<label>Fond <input type="color" id="trPastilleFond" value="' + d.pastilleFond + '"></label>' +
          '<label>Texte <input type="color" id="trPastilleTexte" value="' + d.pastilleTexte + '"></label>' +
          nombre("trPastilleTaille", "pt", d.pastilleTaille, 4, 24) +
        "</div>" +
        '<p class="aide-champ">Le numéro de tome, posé droit sur son aplat de couleur.</p>' +
      "</fieldset>" +

      '<fieldset class="tr-bloc"><legend>Titre</legend>' +
        '<div class="tranche-duo">' +
          champ("trSurtitre", "Surtitre", d.surtitre) +
          nombre("trSurtitreTaille", "pt", d.surtitreTaille, 4, 24) +
        "</div>" +
        '<div class="tranche-duo">' +
          champ("trContenu", "Titre", d.contenu) +
          nombre("trTaille", "pt", d.taille, 4, 36) +
        "</div>" +
        '<div class="tranche-duo">' +
          '<label>Sens <select id="trSens">' +
            '<option value="descendant">De haut en bas</option>' +
            '<option value="montant">De bas en haut</option>' +
          "</select></label>" +
          '<label class="tranche-case"><input type="checkbox" id="trForcer"' +
            (d.forcerTexte ? " checked" : "") + "> Écrire même sur un dos très fin</label>" +
        "</div>" +
        '<p class="aide-champ">Le surtitre se pose à côté du titre, en travers du dos. ' +
          "Vide, le titre reprend « Titre — Auteur ».</p>" +
      "</fieldset>" +

      '<fieldset class="tr-bloc"><legend>Crédits et éditeur</legend>' +
        '<label class="tr-champ tr-large"><span>Crédits</span>' +
          '<textarea id="trCredits" rows="2">' + echapperTitre(d.credits) + "</textarea></label>" +
        '<div class="tranche-duo">' +
          nombre("trCreditsTaille", "pt", d.creditsTaille, 4, 20) +
          champ("trPied", "Éditeur (au pied)", d.pied) +
          nombre("trPiedTaille", "pt", d.piedTaille, 4, 20) +
        "</div>" +
        '<p class="aide-champ">Une ligne par colonne : « Scénariste YC » puis ' +
          "« Dessinateur RAK HYUN » donnent deux colonnes côte à côte.</p>" +
      "</fieldset>" +

      "</div>" +
      '<div class="tranche-apercu">' +
        '<div class="tranche-scene" id="trScene"></div>' +
        "<small id='trLegende'></small>" +
        '<p class="aide-champ" id="trNoteDos"></p>' +
      "</div>" +
    "</div>" +
    '<div class="ci-actions">' +
      '<button class="ci-annuler">Annuler</button>' +
      '<button class="ci-generer">Enregistrer</button>' +
    "</div></div>";

  const fond = document.createElement("div");
  fond.id = "dialogueTranche";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  fond.addEventListener("click", (e) => { if (e.target === fond) fond.remove(); });
  document.body.appendChild(fond);

  fond.querySelector("#trSens").value = d.sens;

  const val = (id) => fond.querySelector("#" + id).value;
  const num = (id, defaut) => {
    const n = parseFloat(val(id));
    return isFinite(n) && n >= 0 ? n : defaut;
  };

  const lire = () => ({
    fond: val("trFond"),
    texte: val("trTexte"),
    bandeau: aImage ? num("trBandeau", 0) : 0,
    pastille: val("trPastille"),
    pastilleFond: val("trPastilleFond"),
    pastilleTexte: val("trPastilleTexte"),
    pastilleTaille: num("trPastilleTaille", d.pastilleTaille),
    surtitre: val("trSurtitre"),
    surtitreTaille: num("trSurtitreTaille", d.surtitreTaille),
    contenu: val("trContenu"),
    taille: num("trTaille", d.taille),
    sens: val("trSens"),
    credits: val("trCredits"),
    creditsTaille: num("trCreditsTaille", d.creditsTaille),
    pied: val("trPied"),
    piedTaille: num("trPiedTaille", d.piedTaille),
    forcerTexte: fond.querySelector("#trForcer").checked
  });

  // L'aperçu : le VRAI dos, construit par le constructeur d'impression sur
  // un livre provisoire, puis réduit. Aucune imitation à maintenir en
  // parallèle du rendu réel.
  const rafraichir = () => {
    const r = lire();
    // L'image reste celle qui est enregistrée : elle s'envoie à part, pas au
    // moment d'appuyer sur « Enregistrer ».
    const provisoire = Object.assign({}, livre,
      { tranche: Object.assign({}, r, { imageChemin: t.imageChemin || null }) });
    const scene = fond.querySelector("#trScene");
    scene.innerHTML = "";

    // Un dos très fin resterait un trait : l'aperçu ne descend pas sous 3 mm,
    // la légende donnant l'épaisseur réelle juste en dessous.
    const dosApercu = Math.max(dosMm, 3);
    const dos = construireDosLivre(provisoire, dosApercu, f.haut, null);
    const echelle = HAUTEUR_APERCU_DOS / (f.haut * PX_PAR_MM);
    dos.style.transform = "scale(" + echelle + ")";
    dos.style.transformOrigin = "top left";
    scene.style.height = HAUTEUR_APERCU_DOS + "px";
    scene.style.width = (dosApercu * PX_PAR_MM * echelle) + "px";
    scene.appendChild(dos);

    fond.querySelector("#trLegende").textContent =
      "Dos de " + dosMm.toFixed(1).replace(".", ",") + " mm · " + (livre.pages || []).length + " pages";
    fond.querySelector("#trNoteDos").textContent = dosMm >= 6
      ? "Assez épais pour porter du texte."
      : "Sous 6 mm, l'usage est de laisser le dos nu : le texte tomberait sur les plis.";
  };

  fond.querySelectorAll("input, select, textarea").forEach((c) => {
    c.addEventListener("input", rafraichir);
    c.addEventListener("change", rafraichir);
  });

  fond.querySelector("#trReset").onclick = () => {
    const couv = livre.couverture || {};
    fond.querySelector("#trFond").value = couv.fond || "#1a1a2e";
    fond.querySelector("#trTexte").value = couv.texte || "#ffffff";
    rafraichir();
  };

  // Le bandeau n'a de sens que s'il y a une image à montrer — la sienne ou,
  // à défaut, celle de la couverture.
  const majImage = () => {
    const propre = !!t.imageChemin;
    const source = propre ? "sienne" : (aImage ? "couverture" : "aucune");
    fond.querySelector("#trBandeau").disabled = source === "aucune";
    fond.querySelector("#trImageRetirer").style.display = propre ? "" : "none";
    fond.querySelector("#trImageNote").textContent =
      source === "sienne"
        ? "Image propre à la tranche. « Retirer » revient à celle de la couverture."
        : source === "couverture"
          ? "À défaut d'image propre, le haut de celle de la couverture se prolonge sur le dos. 0 mm = aucun bandeau."
          : "Aucune image disponible : choisissez-en une, ou donnez-en une à la couverture.";
  };

  fond.querySelector("#trImage").addEventListener("change", (e) => {
    envoyerImageTranche(e, livre, t, () => { majImage(); rafraichir(); },
      fond.querySelector("#trImageNote"));
  });

  fond.querySelector("#trImageRetirer").onclick = () => {
    const ancien = t.imageChemin;
    t.imageChemin = null;
    if (ancien) {
      supprimerFichierGithub(ancien, localStorage.getItem("gh_token"),
        "Retrait de l'image de tranche").catch(() => {});
      delete cacheImagesURL[ancien];
    }
    marquerModifie();
    planifierBrouillon();
    majImage();
    rafraichir();
  };

  majImage();
  rafraichir();

  fond.querySelector(".mi-fermer").onclick = () => fond.remove();
  fond.querySelector(".ci-annuler").onclick = () => fond.remove();
  fond.querySelector(".ci-generer").onclick = () => {
    const r = lire();
    const couv = livre.couverture || {};
    // Ce qui vaut le réglage par défaut n'est pas enregistré : la tranche
    // continue alors de suivre la couverture et le titre du livre.
    t.fond = r.fond === (couv.fond || "#1a1a2e") ? null : r.fond;
    t.texte = r.texte === (couv.texte || "#ffffff") ? null : r.texte;
    const parDefaut = [livre.titre, livre.auteur].filter(Boolean).join(" — ");
    t.contenu = r.contenu.trim() === parDefaut ? "" : r.contenu;

    t.bandeau = r.bandeau;
    t.pastille = r.pastille;
    t.pastilleFond = r.pastilleFond;
    t.pastilleTexte = r.pastilleTexte;
    t.pastilleTaille = r.pastilleTaille;
    t.surtitre = r.surtitre;
    t.surtitreTaille = r.surtitreTaille;
    t.taille = r.taille;
    t.sens = r.sens;
    t.credits = r.credits;
    t.creditsTaille = r.creditsTaille;
    t.pied = r.pied;
    t.piedTaille = r.piedTaille;
    t.forcerTexte = r.forcerTexte;

    fond.remove();
    marquerModifie();
    planifierBrouillon();
    const message = document.getElementById("message");
    if (message) {
      message.textContent = "Tranche enregistrée.";
      setTimeout(() => {
        if (message.textContent.indexOf("Tranche") !== -1) message.textContent = "";
      }, 3000);
    }
  };
}

// Envoi de l'image de tranche. Elle vit dans le même dossier que celles des
// couvertures, sous un nom qui lui est propre : remplacer l'une ne touche
// jamais l'autre.
function envoyerImageTranche(event, livre, tranche, surFin, note) {
  const fichier = event.target.files[0];
  event.target.value = "";
  if (!fichier) return;

  const token = localStorage.getItem("gh_token");
  const ancien = tranche.imageChemin;

  const lecteur = new FileReader();
  lecteur.onload = async (e) => {
    const dataUrl = e.target.result;
    const extension = extraireExtensionDataUrl(dataUrl);
    const chemin = obtenirPrefixeImagesUtilisateur() + "/" + livre.id + "_tranche." + extension;

    if (note) note.textContent = "Envoi de l'image en cours…";
    try {
      await uploaderImageBase64(chemin, dataUrl, token,
        "Image de tranche — " + (livre.titre || livre.id));
      if (ancien && ancien !== chemin) {
        supprimerFichierGithub(ancien, token, "Remplacement de l'image de tranche").catch(() => {});
        delete cacheImagesURL[ancien];
      }
      tranche.imageChemin = chemin;
      cacheImagesURL[chemin] = dataUrl;   // aperçu immédiat, sans requête
      marquerModifie();
      planifierBrouillon();
      surFin();
    } catch (erreur) {
      if (note) note.textContent = erreur.message;
    }
  };
  lecteur.readAsDataURL(fichier);
}

// Couverture ouverte à plat : 4e de couverture | dos | 1re de couverture.
function creerCouverturePlat(livre, f, dosMm, promessesImages) {
  const largTrim = 2 * f.larg + dosMm;
  const feuille = creerFeuillePro(largTrim, f.haut);
  const zone = creerZoneRognePro(largTrim, f.haut);
  zone.classList.add("couv-plat");

  // Le fond déborde dans le fond perdu : la zone de 5 mm ne doit jamais
  // rester blanche une fois rognée. Le débord est posé sur la FEUILLE et non
  // dans la zone rognée, qui est en overflow:hidden et le découperait.
  const fondCouleur = (livre.couverture && livre.couverture.fond) || "#1a1a2e";
  const debord = document.createElement("div");
  debord.className = "debord-pro";
  debord.style.left   = (MARGE_TECHNIQUE_MM - FOND_PERDU_MM) + "mm";
  debord.style.top    = (MARGE_TECHNIQUE_MM - FOND_PERDU_MM) + "mm";
  debord.style.width  = (largTrim + 2 * FOND_PERDU_MM) + "mm";
  debord.style.height = (f.haut + 2 * FOND_PERDU_MM) + "mm";
  debord.style.background = fondCouleur;
  feuille.appendChild(debord);

  zone.appendChild(creerPanneauCouverture(livre, "quatrieme", f, promessesImages));

  zone.appendChild(construireDosLivre(livre, dosMm, f.haut, promessesImages));

  zone.appendChild(creerPanneauCouverture(livre, "couverture", f, promessesImages));

  feuille.appendChild(zone);
  ajouterReperesCoupe(feuille, largTrim, f.haut);
  ajouterReperesPli(feuille, f.haut, [f.larg, f.larg + dosMm]);
  return feuille;
}

// Un panneau de couverture au format rogné, réutilisant le rendu existant.
function creerPanneauCouverture(livre, mode, f, promessesImages) {
  const panneau = creerCouvertureImpression(livre, mode, f, promessesImages);
  panneau.classList.remove("page-impression");
  panneau.classList.add("panneau-couv-pro");
  return panneau;
}
