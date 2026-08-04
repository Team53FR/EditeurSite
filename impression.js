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
              "pour cela que la première feuille montre la fin du livre à gauche.",
    etapes: [
      "Imprimez en recto-verso. Si votre imprimante ne le fait pas seule, choisissez « En deux fois » : les rectos sortent d'abord, puis vous remettez la pile dans le bac pour les versos.",
      "Ne changez surtout pas l'ordre des feuilles en les récupérant.",
      "Pliez toute la pile en deux d'un seul geste, bien au milieu.",
      "Agrafez sur le pli, avec deux agrafes réparties (une agrafeuse à long bras aide beaucoup ; sinon, agrafez à plat puis pliez).",
      "Facultatif : égalisez le bord extérieur au massicot, les feuilles intérieures dépassant toujours un peu."
    ],
    bon: ["Rapide, sans colle ni matériel particulier.", "Les pages tombent dans l'ordre toutes seules.", "Idéal pour une nouvelle, un carnet, un tirage d'essai."],
    limites: ["Le nombre de pages est complété à un multiple de 4 (des pages blanches sont ajoutées si besoin).",
              "Au-delà d'une quarantaine de pages, le pli gonfle et les pages centrales ressortent nettement.",
              "Le dos est agrafé, pas plat : le livre ne tient pas debout comme un roman."],
    reglages: "Dans la fenêtre d'impression : format paysage, échelle 100 % (surtout pas « ajuster à la page »), et recto-verso « retourner sur les bords courts »."
  },
  doscolle: {
    titre: "Le dos collé, comment ça marche",
    principe: "Une seule page par feuille, imprimée recto-verso, dans l'ordre de lecture. " +
              "Les feuilles sont ensuite encollées sur la tranche, comme un vrai roman de poche.",
    etapes: [
      "Imprimez en recto-verso, dans l'ordre. Si votre imprimante ne le fait pas seule, choisissez « En deux fois ».",
      "Empilez les feuilles dans l'ordre, puis tapotez la pile sur une table pour aligner parfaitement le bord de reliure.",
      "Serrez la pile entre deux planchettes, en laissant dépasser 2 à 3 mm du bord à encoller.",
      "Encollez la tranche (colle vinylique blanche, ou colle thermofusible), en croisant les passages. Laissez sécher sous presse au moins une heure.",
      "Collez la couverture par-dessus, puis marquez le pli du dos avec un plioir."
    ],
    bon: ["Aucune limite de pages : c'est le procédé des vrais livres.", "Dos plat, le livre tient debout sur une étagère.", "Rendu le plus proche d'un ouvrage édité."],
    limites: ["Demande de la colle, une presse improvisée et du temps de séchage.",
              "Le collage doit être régulier, sous peine de pages qui se détachent.",
              "Une marge intérieure est réservée à la reliure : ne réduisez pas les marges."],
    reglages: "Dans la fenêtre d'impression : échelle 100 % (surtout pas « ajuster à la page »), et recto-verso « retourner sur les bords longs »."
  }
};

const MODES_IMPRESSION = [
  {
    categorie: "Livret à agrafer", aideCle: "livret",
    aide: "Deux pages par feuille. On plie la pile en deux et on agrafe au centre.",
    choix: [
      { libelle: "Recto-verso automatique", detail: "Votre imprimante retourne les feuilles toute seule.",
        action: "exporterLivret", mode: "auto" },
      { libelle: "En deux fois", detail: "Sans recto-verso : les rectos d'abord, puis les versos.",
        action: "exporterLivret", mode: "passes" }
    ]
  },
  {
    categorie: "Page à page (dos collé)", aideCle: "doscolle",
    aide: "Une page par feuille, à relier ou à faire relier.",
    choix: [
      { libelle: "Recto-verso automatique", detail: "Votre imprimante retourne les feuilles toute seule.",
        action: "exporterImpression", mode: "auto" },
      { libelle: "En deux fois", detail: "Sans recto-verso : les rectos d'abord, puis les versos.",
        action: "exporterImpression", mode: "passes" }
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
  stylePage.textContent = `@page { size: ${f.larg}mm ${f.haut}mm; margin: 0; }`;

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  // La somme des deux marges reste identique à l'éditeur pour que le bloc
  // de texte garde exactement la même largeur (pas de re-débordement).
  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);

  const promessesImages = [];

  // Feuille 1 : couverture (recto) + intérieur de couverture blanc (verso)
  zone.appendChild(creerCouvertureImpression(livre, "couverture", f, promessesImages));
  zone.appendChild(creerPageBlancheImpression(f));

  // Corps du livre : page impaire = recto (droite), page paire = verso (gauche)
  const pages = livre.pages || [];
  pages.forEach((page, i) => {
    zone.appendChild(creerPageTexteImpression(page, i + 1, f, margeInt, margeExt));
  });

  // Compléter pour que la 4e de couverture tombe au verso de la dernière feuille
  if (pages.length % 2 === 1) zone.appendChild(creerPageBlancheImpression(f));
  zone.appendChild(creerPageBlancheImpression(f));
  zone.appendChild(creerCouvertureImpression(livre, "quatrieme", f, promessesImages));

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
  stylePage.textContent = `@page { size: ${f.larg * 2}mm ${f.haut}mm; margin: 0; }`;

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);
  const promessesImages = [];

  // Suite logique du livret : chaque entrée = une demi-feuille.
  // Position 1 = couverture, position 2 = son verso blanc, puis le texte,
  // des blanches de complément (total multiple de 4), et la 4e en dernier.
  const suite = [];
  suite.push({ type: "couverture" });
  suite.push({ type: "blanche" });
  (livre.pages || []).forEach((page, i) => suite.push({ type: "texte", page, numero: i + 1 }));
  while ((suite.length + 2) % 4 !== 0) suite.push({ type: "blanche" });
  suite.push({ type: "blanche" });
  suite.push({ type: "quatrieme" });

  const total = suite.length;

  // Imposition : feuille k, recto = [dernière-2k | 2k+1], verso = [2k+2 | dernière-2k-1]
  for (let k = 0; k < total / 4; k++) {
    zone.appendChild(creerFaceLivret(suite[total - 2 * k - 1], suite[2 * k], livre, f, margeInt, margeExt, promessesImages));
    zone.appendChild(creerFaceLivret(suite[2 * k + 1], suite[total - 2 * k - 2], livre, f, margeInt, margeExt, promessesImages));
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

function creerFaceLivret(demiGauche, demiDroite, livre, f, margeInt, margeExt, promessesImages) {
  const feuille = document.createElement("div");
  feuille.className = "feuille-impression";
  feuille.style.width = (f.larg * 2) + "mm";
  feuille.style.height = f.haut + "mm";
  feuille.appendChild(creerDemiPageLivret(demiGauche, livre, f, margeInt, margeExt, promessesImages));
  feuille.appendChild(creerDemiPageLivret(demiDroite, livre, f, margeInt, margeExt, promessesImages));
  return feuille;
}

function creerDemiPageLivret(demi, livre, f, margeInt, margeExt, promessesImages) {
  if (!demi || demi.type === "blanche") return creerPageBlancheImpression(f);
  if (demi.type === "couverture") return creerCouvertureImpression(livre, "couverture", f, promessesImages);
  if (demi.type === "quatrieme") return creerCouvertureImpression(livre, "quatrieme", f, promessesImages);
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
        const token = sessionStorage.getItem("gh_token");
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
