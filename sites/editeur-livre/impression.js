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
      "Imprimez la couverture avec « Couverture du livret », pliez-la en deux et glissez le cahier dedans avant d'agrafer.",
      "Agrafez sur le pli, avec deux agrafes réparties (une agrafeuse à long bras aide beaucoup ; sinon, agrafez à plat puis pliez).",
      "Facultatif : égalisez le bord extérieur au massicot, les feuilles intérieures dépassant toujours un peu."
    ],
    bon: ["Rapide, sans colle ni matériel particulier.", "Les pages tombent dans l'ordre toutes seules.", "Idéal pour une nouvelle, un carnet, un tirage d'essai."],
    limites: ["La couverture s'imprime à part, avec « Couverture du livret » : elle se plie autour du cahier au lieu d'y être intercalée.",
              "Le nombre de pages est complété à un multiple de 4 (des pages blanches sont ajoutées si besoin).",
              "Au-delà d'une quarantaine de pages, le pli gonfle et les pages centrales ressortent nettement.",
              "Le dos est agrafé, pas plat : le livre ne tient pas debout comme un roman."],
    reglages: "Dans la fenêtre d'impression : format paysage, échelle 100 % (surtout pas « ajuster à la page »), et recto-verso « retourner sur les bords courts »."
  },
  doscolle: {
    titre: "Le dos collé, comment ça marche",
    schema: true,
    principe: "Seul le texte sort ici : la couverture s'imprime à part, avec « Couverture seule ». " +
              "Les feuilles sont encollées sur la tranche, comme un vrai roman de poche. Deux façons " +
              "de les imprimer : UNE PAGE par feuille, dans l'ordre de lecture, rien à découper ; ou DEUX " +
              "PAGES par feuille, à couper au milieu — moitié moins de papier. Dans ce second cas les " +
              "pages ne sont pas côte à côte dans l'ordre : la colonne de gauche porte la première moitié " +
              "du livre, celle de droite la seconde, pour qu'après la coupe chaque tas reste continu et " +
              "que l'un se pose sous l'autre.",
    etapes: [
      "Imprimez en recto-verso, dans l'ordre. Si votre imprimante ne le fait pas seule, choisissez « En deux fois ».",
      "Deux pages par feuille : coupez la feuille en son milieu. Quand le papier le permet — un poche sur A4, un grand roman sur A3 —, une bande blanche de 6 mm sépare les deux pages : c'est votre marge d'erreur, elle absorbe le décalage recto-verso de l'imprimante et l'on coupe n'importe où dedans. Un roman sur A4 fait 298 mm de large à lui seul : les deux pages s'y touchent, et la coupe demande alors d'être soignée.",
      "Repères : avec « L'autre sens », des traits fins marquent l'endroit exact où couper. Avec « Comme le livret », la feuille sort nue — à vous de viser le milieu.",
      "Posez ensuite le tas de DROITE sous celui de GAUCHE. Ne mélangez pas les deux moitiés.",
      "Si les deux faces d'une même page ne se correspondent pas, c'est le sens de retournement qui est en cause : reprenez avec l'autre réponse à « Comment vos feuilles se retournent-elles ? ». La feuille d'essai tranche la question en une feuille.",
      "Coupez les feuilles sur les lignes qui font le tour de la zone imprimée : la page retrouve alors son format exact. La coupe emporte la ligne avec elle, il n'en reste rien.",
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
              "entourés des lignes de coupe qui disent où passer la lame : " +
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

// Le panneau d'impression ne lit plus de table de boutons : il pose ses
// questions dans l'ordre et traduit les réponses en appel d'export (voir
// actionImpression()). Les modes d'emploi détaillés, eux, restent dans
// AIDE_IMPRESSION ci-dessus.

// SchÃ©ma Â« bords longs / bords courts Â».
//
// La feuille du mode Â« deux pages Â» est en PAYSAGE : ses grands bords sont
// donc le haut et le bas. Un retournement sur les grands bords fait pivoter
// la feuille autour d'un axe horizontal, et la moitiÃ© gauche revient Ã 
// gauche ; sur les petits bords, l'axe est vertical et les deux moitiÃ©s
// s'Ã©changent. Un schÃ©ma dessinÃ© sur une feuille portrait dirait l'inverse :
// celui-ci reprend la feuille telle qu'elle sort de l'imprimante.
function schemaBordsHtml() {
  const feuille = (x, gauche, droite, etiquette, couleur, fond) =>
    '<g>' +
      '<rect x="' + x + '" y="24" width="118" height="84" rx="5" fill="' + fond +
        '" stroke="' + couleur + '" stroke-width="2"/>' +
      '<line x1="' + (x + 59) + '" y1="24" x2="' + (x + 59) + '" y2="108" ' +
        'stroke="#b9b0a2" stroke-width="1.4" stroke-dasharray="4 3"/>' +
      '<text x="' + (x + 30) + '" y="72" font-size="17" font-weight="700" ' +
        'fill="' + couleur + '" text-anchor="middle">' + gauche + "</text>" +
      '<text x="' + (x + 89) + '" y="72" font-size="17" font-weight="700" ' +
        'fill="' + couleur + '" text-anchor="middle">' + droite + "</text>" +
      '<text x="' + (x + 59) + '" y="123" font-size="10" font-weight="600" ' +
        'fill="#6b6255" text-anchor="middle">' + etiquette + "</text>" +
    "</g>";

  const fleche = (x, couleur, id) =>
    '<path d="M ' + x + ' 50 q 14 16 0 32" fill="none" stroke="' + couleur +
      '" stroke-width="1.8" marker-end="url(#' + id + ')"/>';

  // Variante Â« grands bords Â» : axe horizontal, marquÃ© en haut et en bas.
  const longs =
    '<svg viewBox="0 0 300 140" class="mi-schema-svg" role="img" ' +
      'aria-label="Retournement sur les grands bords : la moitiÃ© gauche reste Ã  gauche">' +
      '<defs><marker id="flLong" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">' +
        '<path d="M0,0 L7,3.5 L0,7 z" fill="#b5401e"/></marker></defs>' +
      // les grands bords, Ã©pais : c'est autour d'eux que la feuille bascule
      '<line x1="10" y1="20" x2="128" y2="20" stroke="#b5401e" stroke-width="3.5"/>' +
      '<line x1="10" y1="112" x2="128" y2="112" stroke="#b5401e" stroke-width="3.5"/>' +
      '<line x1="172" y1="20" x2="290" y2="20" stroke="#b5401e" stroke-width="3.5"/>' +
      '<line x1="172" y1="112" x2="290" y2="112" stroke="#b5401e" stroke-width="3.5"/>' +
      feuille(10, "A", "B", "RECTO", "#b5401e", "#ffffff") +
      fleche(140, "#b5401e", "flLong") +
      feuille(172, "A", "B", "VERSO", "#b5401e", "#fdf4ef") +
    "</svg>";

  // Variante Â« petits bords Â» : axe vertical, marquÃ© Ã  gauche et Ã  droite.
  const courts =
    '<svg viewBox="0 0 300 140" class="mi-schema-svg" role="img" ' +
      'aria-label="Retournement sur les petits bords : la moitiÃ© gauche passe Ã  droite">' +
      '<defs><marker id="flCourt" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">' +
        '<path d="M0,0 L7,3.5 L0,7 z" fill="#2e6f6b"/></marker></defs>' +
      '<line x1="6" y1="24" x2="6" y2="108" stroke="#2e6f6b" stroke-width="3.5"/>' +
      '<line x1="132" y1="24" x2="132" y2="108" stroke="#2e6f6b" stroke-width="3.5"/>' +
      '<line x1="168" y1="24" x2="168" y2="108" stroke="#2e6f6b" stroke-width="3.5"/>' +
      '<line x1="294" y1="24" x2="294" y2="108" stroke="#2e6f6b" stroke-width="3.5"/>' +
      feuille(10, "A", "B", "RECTO", "#2e6f6b", "#ffffff") +
      fleche(140, "#2e6f6b", "flCourt") +
      feuille(172, "B", "A", "VERSO", "#2e6f6b", "#f1f7f6") +
    "</svg>";

  return '<div class="mi-detail-bloc mi-schema">' +
    "<h5>Bords longs ou bords courts ?</h5>" +
    "<p>La feuille sort en PAYSAGE : ses grands bords sont le haut et le bas, " +
    "ses petits bords la gauche et la droite. <b>A</b> et <b>B</b> sont les deux " +
    "moitiÃ©s que vous allez sÃ©parer d'un coup de massicot. Le <b>trait Ã©pais</b> " +
    "montre les bords autour desquels la feuille bascule â€” c'est lÃ  toute la " +
    "diffÃ©rence entre les deux rÃ©glages.</p>" +
    '<div class="mi-schema-paire">' +
      '<div class="mi-schema-carte">' +
        '<span class="mi-schema-etiquette longs">Bords longs</span>' + longs +
        '<p class="mi-schema-legende"><span class="mi-schema-trait longs"></span> ' +
        "les grands bords : le haut et le bas</p>" +
        "<p>La feuille bascule autour d'un axe horizontal, comme on tourne " +
        "la page d'un calendrier mural. <b>La moitiÃ© gauche reste Ã  gauche</b> : " +
        "le dos de A tombe bien derriÃ¨re A.</p>" +
      "</div>" +
      '<div class="mi-schema-carte">' +
        '<span class="mi-schema-etiquette courts">Bords courts</span>' + courts +
        '<p class="mi-schema-legende"><span class="mi-schema-trait courts"></span> ' +
        "les petits bords : la gauche et la droite</p>" +
        "<p>La feuille pivote autour d'un axe vertical, comme on tourne la page " +
        "d'un livre. <b>Les deux moitiÃ©s s'Ã©changent</b> : le dos de A se retrouve " +
        "Ã  droite, et l'imposition doit en tenir compte.</p>" +
      "</div>" +
    "</div>" +
    "<p class=\"mi-schema-astuce\">Le rÃ©glage se trouve dans les options recto-verso de " +
    "votre imprimante. Vous n'avez qu'Ã  prendre le bouton du mÃªme nom. En cas de doute, " +
    "imprimez deux feuilles d'essai : si le dos d'une page appartient Ã  une autre partie " +
    "du livre, reprenez avec l'autre bouton.</p>" +
  "</div>";
}

// Construit le mode d'emploi dépliable d'une catégorie.
function construireAideHtml(aide) {
  if (!aide) return "";
  const liste = (titre, items, classe) =>
    '<div class="mi-detail-bloc"><h5 class="' + (classe || "") + '">' + titre + "</h5><ul>" +
    items.map(x => "<li>" + x + "</li>").join("") + "</ul></div>";

  return '<div class="mi-detail ouvert">' +
    "<h5>" + aide.titre + "</h5>" +
    "<p>" + aide.principe + "</p>" +
    '<div class="mi-detail-bloc"><h5>Assemblage, pas à pas</h5><ol>' +
      aide.etapes.map(e => "<li>" + e + "</li>").join("") +
    "</ol></div>" +
    (aide.schema ? schemaBordsHtml() : "") +
    '<div class="mi-detail-colonnes">' +
      liste("Ce que ça apporte", aide.bon, "vert") +
      liste("À savoir", aide.limites, "orange") +
    "</div>" +
    '<p class="mi-reglages"><strong>Réglages d\'impression :</strong> ' + aide.reglages + "</p>" +
  "</div>";
}

// =====================================================================
//  Panneau d'impression, en deux temps
//
//  Il présentait huit boutons d'un coup, tous de la même taille, dont les
//  libellés ne se distinguaient que par un détail (« bords longs », « en deux
//  fois »). Impossible de savoir lequel prendre sans lire les huit.
//
//  On pose donc les questions dans l'ordre où elles se décident vraiment :
//  d'abord LA RELIURE — le seul choix qui engage vraiment, et dont dépend tout
//  le reste —, puis ce qu'on imprime et comment, sur un formulaire où chaque
//  réponse s'explique. Un seul bouton pour lancer, et un résumé qui dit ce
//  qu'on va obtenir avant de cliquer.
// =====================================================================

const RELIURES = {
  livret: {
    nom: "Livret à agrafer",
    resume: "On plie la pile en deux et on agrafe au centre.",
    detail: "Rapide, sans colle ni matériel. Idéal jusqu'à une quarantaine de pages.",
    aideCle: "livret"
  },
  doscolle: {
    nom: "Dos collé",
    resume: "On encolle la tranche, comme un vrai roman de poche.",
    detail: "Aucune limite de pages, dos plat qui tient debout sur une étagère.",
    aideCle: "doscolle"
  }
};

// L'état du formulaire, conservé tant que le panneau reste ouvert.
let choixImpression = {
  reliure: null,        // "livret" | "doscolle"
  quoi: "texte",        // "texte" | "couverture"
  disposition: "une",   // dos collé : "une" | "deux" pages par feuille
  imprimante: "auto",   // "auto" | "passes"
  // « court » par défaut, et non « long » : c'est l'hypothèse que fait déjà,
  // sans le dire, l'imposition du livret — une feuille pliée met forcément le
  // dos de sa moitié droite à gauche du verso. Le livret marchant sur la
  // plupart des imprimantes, partir de la même hypothèse pour la coupe donne
  // le bon ordre du premier coup, au lieu de sortir un livre mélangé.
  retournement: "court" // deux pages : "long" | "court"
};

function ouvrirPanneauImpression() {
  fermerPanneauImpression();
  // On repart du cas courant : le texte du livre, une page par feuille. Ce
  // qu'on imprime change à chaque fois, alors que le comportement de
  // l'imprimante — recto-verso, sens de retournement — reste le même d'une
  // séance à l'autre : ces deux réponses-là sont conservées.
  choixImpression.reliure = null;
  choixImpression.quoi = "texte";
  choixImpression.disposition = "une";

  const fond = document.createElement("div");
  fond.id = "panneauImpression";
  fond.className = "modal-impression";
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerPanneauImpression(); });
  document.body.appendChild(fond);

  dessinerPanneauImpression();
}

function fermerPanneauImpression() {
  const p = document.getElementById("panneauImpression");
  if (p) p.remove();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerPanneauImpression();
});

function dessinerPanneauImpression() {
  const fond = document.getElementById("panneauImpression");
  if (!fond) return;
  fond.innerHTML = '<div class="modal-impression-carte mi-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    (choixImpression.reliure ? etapeReglages() : etapeReliure()) +
    "</div>";
  fond.querySelector(".mi-fermer").onclick = fermerPanneauImpression;
  if (choixImpression.reliure) brancherReglages(fond);
  else brancherChoixReliure(fond);
}

// ----- Étape 1 : la reliure -----

function etapeReliure() {
  const carte = (cle, r) =>
    '<button class="mi-reliure" data-reliure="' + cle + '">' +
      illustrationReliure(cle) +
      "<span class='mi-reliure-nom'>" + r.nom + "</span>" +
      "<span class='mi-reliure-resume'>" + r.resume + "</span>" +
      "<span class='mi-reliure-detail'>" + r.detail + "</span>" +
    "</button>";

  return "<h3>Imprimer votre livre</h3>" +
    '<p class="mi-intro">Comment voulez-vous relier votre livre ? Le reste des ' +
    "réglages en découle — vous n'aurez plus qu'à répondre à deux ou trois questions.</p>" +
    '<div class="mi-reliures">' +
      carte("livret", RELIURES.livret) +
      carte("doscolle", RELIURES.doscolle) +
    "</div>" +
    '<p class="mi-pied-lien">Pas sûr ? <a href="montage.html" target="_blank" rel="noopener">' +
    "Le guide du montage</a> compare les deux, photos à l'appui.</p>";
}

// Deux petits dessins valent mieux qu'un paragraphe : l'un montre le pli
// agrafé, l'autre la pile encollée.
function illustrationReliure(cle) {
  if (cle === "livret") {
    return '<svg class="mi-reliure-dessin" viewBox="0 0 80 56" aria-hidden="true">' +
      '<path d="M40 8 L14 14 L14 46 L40 40 Z" fill="#fff" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M40 8 L66 14 L66 46 L40 40 Z" fill="#faf6ec" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<line x1="40" y1="8" x2="40" y2="40" stroke="currentColor" stroke-width="2"/>' +
      '<rect x="37" y="14" width="6" height="3" rx="1" fill="currentColor"/>' +
      '<rect x="37" y="30" width="6" height="3" rx="1" fill="currentColor"/>' +
    "</svg>";
  }
  return '<svg class="mi-reliure-dessin" viewBox="0 0 80 56" aria-hidden="true">' +
    '<rect x="18" y="10" width="44" height="36" rx="2" fill="#fff" stroke="currentColor" stroke-width="2"/>' +
    '<line x1="26" y1="10" x2="26" y2="46" stroke="currentColor" stroke-width="2"/>' +
    '<line x1="34" y1="14" x2="54" y2="14" stroke="currentColor" stroke-width="1.4" opacity=".5"/>' +
    '<line x1="34" y1="22" x2="54" y2="22" stroke="currentColor" stroke-width="1.4" opacity=".5"/>' +
    '<line x1="34" y1="30" x2="48" y2="30" stroke="currentColor" stroke-width="1.4" opacity=".5"/>' +
    '<rect x="18" y="10" width="8" height="36" rx="2" fill="currentColor" opacity=".18"/>' +
  "</svg>";
}

function brancherChoixReliure(fond) {
  fond.querySelectorAll(".mi-reliure").forEach((b) => {
    b.onclick = () => {
      choixImpression.reliure = b.dataset.reliure;
      // Un livret n'a qu'une disposition possible : deux pages pliées.
      if (choixImpression.reliure === "livret") choixImpression.disposition = "une";
      dessinerPanneauImpression();
    };
  });
}

// ----- Étape 2 : les réglages -----

function etapeReglages() {
  const c = choixImpression;
  const r = RELIURES[c.reliure];
  const texte = c.quoi === "texte";
  const deux = texte && c.reliure === "doscolle" && c.disposition === "deux";

  const groupe = (titre, aide, options, nomChamp) =>
    '<div class="mi-groupe"><h4>' + titre + "</h4>" +
    (aide ? '<p class="mi-groupe-aide">' + aide + "</p>" : "") +
    '<div class="mi-options">' +
      options.map((o) =>
        '<label class="mi-option' + (o.valeur === c[nomChamp] ? " actif" : "") + '">' +
          '<input type="radio" name="' + nomChamp + '" value="' + o.valeur + '"' +
            (o.valeur === c[nomChamp] ? " checked" : "") + ">" +
          "<span class='mi-option-nom'>" + o.nom + "</span>" +
          "<span class='mi-option-detail'>" + o.detail + "</span>" +
        "</label>").join("") +
    "</div></div>";

  let html = '<button class="mi-retour" type="button">← Changer de reliure</button>' +
    "<h3>" + r.nom + "</h3>" +
    '<p class="mi-intro">' + r.resume + "</p>";

  html += groupe("Que voulez-vous imprimer ?", "", [
    { valeur: "texte", nom: "Le texte du livre",
      detail: "Toutes les pages, dans l'ordre voulu par la reliure." },
    { valeur: "couverture", nom: "La couverture",
      detail: c.reliure === "livret"
        ? "4e et 1re sur une feuille, à plier autour du cahier."
        : "4e, dos et 1re à plat, avec les traits de pli." }
  ], "quoi");

  if (texte && c.reliure === "doscolle") {
    html += groupe("Combien de pages par feuille ?", "", [
      { valeur: "une", nom: "Une page par feuille", detail: "Rien à découper. Le plus simple." },
      { valeur: "deux", nom: "Deux pages par feuille",
        detail: "Deux fois moins de papier, mais il faut couper la pile au milieu." }
    ], "disposition");
  }

  if (texte) {
    html += groupe("Votre imprimante fait-elle le recto-verso ?", "", [
      { valeur: "auto", nom: "Oui, toute seule", detail: "Elle retourne les feuilles d'elle-même." },
      { valeur: "passes", nom: "Non, en deux fois",
        detail: "Les rectos d'abord ; on remet la pile dans le bac pour les versos." }
    ], "imprimante");
  }

  if (deux) {
    html += groupe("Comment vos feuilles se retournent-elles ?",
      "C'est la seule chose que ce panneau ne peut pas deviner, et elle décide " +
      "de l'ordre des pages une fois la pile coupée. Le plus sûr n'est pas de " +
      "chercher le réglage dans le pilote : <b>si le mode livret vous donne un " +
      "cahier dans le bon ordre, gardez « comme le livret »</b> — les deux " +
      "reliures dépendent exactement du même comportement.", [
      { valeur: "court", nom: "Comme le livret",
        detail: "Les deux moitiés s'échangent au verso (retournement sur les petits bords). " +
                "À garder si vos livrets sortent bien." },
      { valeur: "long", nom: "L'autre sens",
        detail: "La moitié gauche reste à gauche (retournement sur les grands bords)." }
    ], "retournement");
    html += '<p class="mi-groupe-aide">Dans le doute, imprimez d\'abord la ' +
      '<b>feuille d\'essai</b> : une seule feuille qui vous dit lequel des deux ' +
      "choisir, sans y laisser tout un livre.</p>" +
      '<div class="mi-essai"><button class="mi-feuille-essai" type="button">' +
      "Imprimer la feuille d'essai</button></div>";
    html += '<details class="mi-details-schema"><summary>Voir la différence en image</summary>' +
      schemaBordsHtml() + "</details>";
  }

  html += '<p class="mi-resume">' + resumeImpression() + "</p>";

  html += '<details class="mi-details-guide"><summary>Comment assembler le livre ensuite ?</summary>' +
    construireAideHtml(AIDE_IMPRESSION[r.aideCle]) + "</details>";

  html += '<div class="mi-actions">' +
    '<button class="mi-lancer" type="button">Imprimer</button>' +
  "</div>";

  return html;
}

// Ce qu'on va obtenir, en une phrase, avant de cliquer.
function resumeImpression() {
  const c = choixImpression;
  if (c.quoi === "couverture") {
    return c.reliure === "livret"
      ? "Une seule feuille : 4e de couverture et 1re, à plier en deux autour du cahier."
      : "Une seule feuille : 4e de couverture, dos et 1re, avec les traits de pli et de coupe.";
  }
  const morceaux = [];
  if (c.reliure === "livret") {
    morceaux.push("Deux pages par feuille, dans l'ordre du pliage");
    morceaux.push("on plie toute la pile en deux et on agrafe sur le pli");
  } else if (c.disposition === "deux") {
    // « Séparées par une bande blanche » n'était vrai que sur les formats où
    // la gouttière tient : un roman fait déjà 298 mm de large sur une A4.
    morceaux.push("Deux pages par feuille");
    morceaux.push(c.retournement === "court"
      ? "la feuille sort sans repère, on la coupe en son milieu, puis on pose le tas de droite sous celui de gauche"
      : "on coupe sur les traits du milieu, puis on pose le tas de droite sous celui de gauche");
  } else {
    morceaux.push("Une page par feuille, dans l'ordre de lecture");
    morceaux.push("il n'y a rien à découper");
  }
  if (c.imprimante === "passes") {
    morceaux.push("les rectos sortent d'abord, une fenêtre vous guidera pour les versos");
  }
  return morceaux.join(" ; ") + ".";
}

function brancherReglages(fond) {
  fond.querySelector(".mi-retour").onclick = () => {
    choixImpression.reliure = null;
    dessinerPanneauImpression();
  };

  fond.querySelectorAll(".mi-option input").forEach((input) => {
    input.onchange = () => {
      choixImpression[input.name] = input.value;
      dessinerPanneauImpression();   // les questions suivantes en dépendent
    };
  });

  // La feuille d'essai ne ferme pas le panneau : on la lance, on va la
  // chercher, et l'on répond à la question sans avoir tout à refaire.
  const essai = fond.querySelector(".mi-feuille-essai");
  if (essai) essai.onclick = () => imprimerFeuilleEssai();

  fond.querySelector(".mi-lancer").onclick = () => {
    const action = actionImpression();
    fermerPanneauImpression();
    // Laisser la fenêtre se fermer avant d'ouvrir celle du navigateur.
    setTimeout(() => { window[action.fonction](action.mode); }, 50);
  };
}

// Traduit les réponses en appel d'export. Les fonctions d'export, elles, n'ont
// pas changé : ce panneau ne fait que choisir la bonne.
function actionImpression() {
  const c = choixImpression;
  if (c.quoi === "couverture") {
    return c.reliure === "livret"
      ? { fonction: "exporterCouvertureLivret", mode: "" }
      : { fonction: "exporterCouvertureSeule", mode: "" };
  }
  if (c.reliure === "livret") {
    return { fonction: "exporterLivret", mode: c.imprimante };
  }
  if (c.disposition === "deux") {
    // Le sens de retournement compte AUSSI en deux passes : c'est alors la
    // main qui retourne la pile, mais la question posée est la même — quelle
    // moitié du verso se retrouve derrière quelle moitié du recto. Le laisser
    // tomber ici, comme on le faisait, imposait en silence « grands bords » à
    // qui avait répondu « petits bords », et le livre sortait mélangé
    // (1, 8, 3, 10, 5, 12, 7, 2… au lieu de 1, 2, 3, 4…).
    const mode = (c.imprimante === "passes" ? "passes" : "auto") +
                 (c.retournement === "court" ? "-court" : "");
    return { fonction: "exporterDeuxPages", mode };
  }
  return { fonction: "exporterImpression", mode: c.imprimante };
}

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
// l'éditeur (64 px logiques), sinon la hauteur utile diffère de celle qui a
// servi à découper les pages et le texte se retrouve coupé à l'impression.
// On retire une petite tolérance (2 mm) pour absorber les écarts d'arrondi
// mm/px entre le rendu écran et le rendu imprimé ; le numéro de page reste
// à sa place (il est positionné à 6 mm du bas, indépendamment).
const TOLERANCE_MM = 2;
const PIED_PAGE_MM = 64 * 25.4 / 96 - TOLERANCE_MM; // ≈ 14,9 mm

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
// A4 portrait, mais bord à bord en largeur — impossible d'y tracer la ligne de
// coupe. La même A4 en paysage lui laisse 43 mm de chaque côté et 31 en haut
// et en bas, donc les quatre lignes au complet. Même feuille, même imprimante,
// juste tournée.
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

// Lignes de coupe tout autour de la zone imprimée : quatre traits qui
// traversent la feuille de part en part, chacun posé exactement sur un bord
// du livre.
//
// C'étaient des repères d'angle, à la manière des imprimeurs — quatre petites
// équerres dans les coins, et le massicot fait le reste. Sans massicot, il
// faut relier les repères à la règle avant de couper : autant tracer la ligne
// tout de suite. Elle se pose PILE sur le bord du livre, donc la coupe
// l'emporte avec elle : rien n'en reste sur la page finie.
//
// Un trait n'est tracé que si son bord tombe dans la feuille, et pas à
// l'extrême bord : une page aussi large que son papier — le poche en livret —
// n'a aucun blanc de ce côté, rien à y couper, et l'imprimante n'y déposerait
// de toute façon pas d'encre.
const BORD_MINI_MM = 1;   // distance minimale au bord de la feuille

function ajouterTraitsDecoupe(feuille, largMm, hautMm, papier) {
  const margeX = (papier.larg - largMm) / 2;
  const margeY = (papier.haut - hautMm) / 2;

  const trait = (classe, gauche, haut, largeur, hauteur) => {
    const t = document.createElement("div");
    t.className = "trait-coupe " + classe;
    t.style.left = gauche + "mm";
    t.style.top = haut + "mm";
    if (largeur) t.style.width = largeur + "mm";
    if (hauteur) t.style.height = hauteur + "mm";
    feuille.appendChild(t);
  };

  const tientDans = (v, taille) => v >= BORD_MINI_MM && v <= taille - BORD_MINI_MM;

  // Les deux verticales : bords gauche et droit du livre, sur toute la hauteur.
  [margeX, margeX + largMm].forEach((x) => {
    if (tientDans(x, papier.larg)) trait("trait-v", x, 0, 0, papier.haut);
  });

  // Les deux horizontales : bords haut et bas, sur toute la largeur.
  [margeY, margeY + hautMm].forEach((y) => {
    if (tientDans(y, papier.haut)) trait("trait-h", 0, y, papier.larg, 0);
  });
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
  ouvrirAttente("Préparation de l'impression…",
    "Les pages et leurs images sont assemblées ; la fenêtre d'impression s'ouvrira toute seule.");

  Promise.all(promessesImages).finally(() => {
    if (message) message.textContent = "";
    fermerAttente();
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
  // entourée de ses lignes de coupe.
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
  ouvrirAttente("Préparation de l'impression…",
    "Les pages et leurs images sont assemblées ; la fenêtre d'impression s'ouvrira toute seule.");

  Promise.all(promessesImages).finally(() => {
    if (message) message.textContent = "";
    fermerAttente();
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
  if (demi.type === "essai") return creerDemiEssai(demi, f);
  return creerPageTexteImpression(demi.page, demi.numero, f, margeInt, margeExt);
}

// Une demi-feuille d'essai : une grande marque et, dessous, ce qu'elle veut
// dire. Rien d'autre — elle doit se lire à bout de bras.
function creerDemiEssai(demi, f) {
  const div = document.createElement("div");
  // Une lettre seule se lit en très grand ; une réponse de trois mots, non —
  // à la même taille elle passerait à la ligne et remplirait la demi-feuille.
  div.className = "page-impression page-essai" + (demi.reponse ? " essai-reponse" : "");
  div.style.width = f.larg + "mm";
  div.style.height = f.haut + "mm";
  div.innerHTML =
    '<div class="essai-marque">' + demi.marque + "</div>" +
    '<div class="essai-legende">' + demi.legende + "</div>";
  return div;
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
// dans editeur.js). Le folio y descend plus bas — 8 mm du bord rogné au lieu
// de 6 — pour respecter le blanc tournant : la bande doit donc être plus
// haute que celle de l'export normal, sans quoi le texte la rejoindrait.
const PIED_PRO_PX  = 72;
const PIED_PRO_MM  = PIED_PRO_PX * 25.4 / 96;      // ≈ 19,1 mm
const FOLIO_PRO_MM = 8;                            // > BLANC_TOURNANT_MM
// Le texte rendu à l'impression occupe quelques pixels de plus que dans le
// mesureur de pagination (justification et césure automatique, absentes du
// mesureur). L'export normal absorbe déjà cet écart par une tolérance ; on
// garde le même principe ici, en dimensionnant le pied pour que la tolérance
// ne fasse jamais descendre le texte sur la bande du folio :
//   bas du texte  = 210 - 20 - 172,9 = 17,1 mm du bord rogné
//   haut du folio = 8 + 4,7          = 12,7 mm du bord rogné
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
// pile, on pose la moitié droite sous la moitié gauche, et le livre est dans
// l'ordre.
//
// C'est ce qui rend l'imposition indispensable. Poser 1 et 2 côte à côte
// donnerait, après la coupe, deux tas où les pages sautent de deux en deux. La
// colonne de gauche porte donc la PREMIÈRE moitié du livre, celle de droite la
// SECONDE : chaque tas reste continu, et l'un se pose sous l'autre.
//
// Deux difficultés viennent de l'imprimante, pas du calcul :
//
//  1. Le sens de retournement. Sur les grands bords, la moitié gauche reste à
//     gauche au verso ; sur les petits bords, elle passe à droite et le livre
//     sort mélangé. Aucun réglage du navigateur ne le dit — c'est donc
//     l'auteur qui l'indique, et l'imposition s'y adapte.
//
//  2. Le registre recto-verso. Une imprimante familiale décale le verso d'un
//     ou deux millimètres. Une coupe unique au milieu tomberait juste d'un
//     côté et dans le texte de l'autre. On laisse donc une GOUTTIÈRE blanche
//     entre les deux pages, avec un trait de chaque côté : on coupe deux fois,
//     la bande centrale part, et chaque page garde son format exact quel que
//     soit le décalage.
const GOUTTIERE_MM = 6;

function exporterDeuxPages(mode) {
  flushSpread();
  repaginerTout();
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];

  // « auto » et « passes » disent comment imprimer ; « court » dit comment la
  // feuille se retourne. Les deux se combinent (« passes-court »).
  const passes = mode.indexOf("passes") !== -1;
  const bordsCourts = mode.indexOf("court") !== -1;

  let stylePage = document.getElementById("stylePageImpression");
  if (!stylePage) {
    stylePage = document.createElement("style");
    stylePage.id = "stylePageImpression";
    document.head.appendChild(stylePage);
  }

  // La gouttière élargit la planche de quelques millimètres. Si ces
  // millimètres obligent à passer au format de papier au-dessus — deux pages
  // de roman font déjà 298 mm sur une A4 —, on y renonce : demander de l'A3
  // pour six millimètres serait un remède pire que le mal.
  const aire = (pa) => (pa ? pa.larg * pa.haut : Infinity);
  const sansGouttiere = papierMinimal(2 * f.larg, f.haut, 2);
  const avecGouttiere = papierMinimal(2 * f.larg + GOUTTIERE_MM, f.haut, 2);
  const gouttiere = aire(avecGouttiere) <= aire(sansGouttiere) ? GOUTTIERE_MM : 0;
  const papier = gouttiere ? avecGouttiere : sansGouttiere;
  const largFeuille = 2 * f.larg + gouttiere;

  if (papier) reglerPagePapier(stylePage, papier);
  else stylePage.textContent = "@page { size: " + largFeuille + "mm " + f.haut + "mm; margin: 0; }";

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  const margeInt = f.margeH + DELTA_RELIURE_MM;
  const margeExt = Math.max(6, f.margeH - DELTA_RELIURE_MM);

  // Les faces, dans l'ordre de lecture — le texte seul, les couvertures
  // s'imprimant à part.
  const suite = [];
  (livre.pages || []).forEach((page, i) => suite.push({ type: "texte", page, numero: i + 1 }));
  // Une feuille porte quatre faces : le compte doit tomber juste, sinon la
  // coupe décale tout le second tas.
  while (suite.length % 4 !== 0) suite.push({ type: "blanche" });

  const moitie = suite.length / 2;

  // « Comme le livret » sort sans repères imprimés, à la demande : la
  // gouttière reste, mais la feuille est nue. L'autre sens les garde.
  const sansTraits = bordsCourts;

  for (let k = 0; k < suite.length / 4; k++) {
    const recto = creerFaceDeuxPages(suite[2 * k], suite[moitie + 2 * k],
                                     f, margeInt, margeExt, gouttiere, sansTraits);
    // Sur les petits bords, la feuille se retourne autour de son axe vertical :
    // ce qui était à gauche revient à droite. On échange donc les deux moitiés
    // du verso pour que chaque bande garde ses deux faces.
    const verso = bordsCourts
      ? creerFaceDeuxPages(suite[moitie + 2 * k + 1], suite[2 * k + 1],
                           f, margeInt, margeExt, gouttiere, sansTraits)
      : creerFaceDeuxPages(suite[2 * k + 1], suite[moitie + 2 * k + 1],
                           f, margeInt, margeExt, gouttiere, sansTraits);

    [recto, verso].forEach((face) => {
      zone.appendChild(papier ? poserSurPapier(face, papier, largFeuille, f.haut) : face);
    });
  }

  const message = document.getElementById("message");
  if (message) message.textContent = "Préparation de l'impression...";
  ouvrirAttente("Préparation de l'impression…",
    "Les pages et leurs images sont assemblées ; la fenêtre d'impression s'ouvrira toute seule.");
  setTimeout(() => {
    if (message) message.textContent = "";
    fermerAttente();
    lancerImpression(passes ? "passes" : "auto");
  }, 0);
}

// ----- La feuille d'essai -----
//
// Le sens de retournement est la seule inconnue de cette reliure, et personne
// ne peut y répondre de tête : le pilote ne le dit pas toujours, et en deux
// passes c'est la main qui décide. Le découvrir en imprimant tout un livre
// coûte cent feuilles ; le découvrir sur UNE feuille ne coûte rien.
//
// Le principe évite toute ambiguïté de manipulation. On ne demande pas de
// « retourner la feuille » — selon qu'on la tourne autour d'un bord ou de
// l'autre, on ne voit pas la même chose. On demande de la COUPER, ce qui est
// de toute façon le geste de cette reliure : une moitié porte le A, et son
// dos porte, écrit en toutes lettres, le réglage à choisir.
function imprimerFeuilleEssai() {
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];

  const aire = (pa) => (pa ? pa.larg * pa.haut : Infinity);
  const sansGouttiere = papierMinimal(2 * f.larg, f.haut, 2);
  const avecGouttiere = papierMinimal(2 * f.larg + GOUTTIERE_MM, f.haut, 2);
  const gouttiere = aire(avecGouttiere) <= aire(sansGouttiere) ? GOUTTIERE_MM : 0;
  const papier = gouttiere ? avecGouttiere : sansGouttiere;
  const largFeuille = 2 * f.larg + gouttiere;

  let stylePage = document.getElementById("stylePageImpression");
  if (!stylePage) {
    stylePage = document.createElement("style");
    stylePage.id = "stylePageImpression";
    document.head.appendChild(stylePage);
  }
  if (papier) reglerPagePapier(stylePage, papier);
  else stylePage.textContent = "@page { size: " + largFeuille + "mm " + f.haut + "mm; margin: 0; }";

  let zone = document.getElementById("zoneImpression");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zoneImpression";
  document.body.appendChild(zone);

  const marque = (m, l) => ({ type: "essai", marque: m, legende: l });
  const reponse = (m, l) => ({ type: "essai", marque: m, legende: l, reponse: true });

  // Recto : deux repères. Verso : les deux réponses possibles, chacune du
  // côté qui la désigne.
  // Sans repères de coupe : cet essai ne demande aucune précision, on coupe
  // la feuille à peu près en deux et l'on retourne la moitié qui porte le A.
  const recto = creerFaceDeuxPages(
    marque("A", "Coupez la feuille en deux, à peu près au milieu, puis regardez le DOS de cette moitié-ci."),
    marque("B", "Celle-ci ne sert qu'à faire la paire."),
    f, f.margeH, f.margeH, gouttiere, true);
  const verso = creerFaceDeuxPages(
    reponse("L'autre sens", "Si c'est ceci que vous lisez au dos du A, choisissez « L'autre sens »."),
    reponse("Comme le livret", "Si c'est ceci que vous lisez au dos du A, choisissez « Comme le livret »."),
    f, f.margeH, f.margeH, gouttiere, true);

  [recto, verso].forEach((face) => {
    zone.appendChild(papier ? poserSurPapier(face, papier, largFeuille, f.haut) : face);
  });

  // L'essai doit emprunter le MÊME chemin que l'impression réelle : en deux
  // passes, c'est justement la remise de la pile dans le bac qu'on teste.
  lancerImpression(choixImpression.imprimante === "passes" ? "passes" : "auto");
}

// Une face : deux pages séparées par la gouttière, avec ses traits de coupe.
//
// `sansTraits` laisse la gouttière mais retire les repères imprimés. La bande
// blanche continue de faire son office — elle absorbe le décalage recto-verso
// de l'imprimante, et l'on coupe n'importe où dedans — mais rien n'est tracé
// sur la feuille.
function creerFaceDeuxPages(demiGauche, demiDroite, f, margeInt, margeExt, gouttiere, sansTraits) {
  const feuille = document.createElement("div");
  feuille.className = "feuille-impression";
  feuille.style.width = (2 * f.larg + gouttiere) + "mm";
  feuille.style.height = f.haut + "mm";

  feuille.appendChild(creerDemiPageLivret(demiGauche, f, margeInt, margeExt));

  if (gouttiere > 0) {
    const bande = document.createElement("div");
    bande.className = "gouttiere-impression";
    bande.style.width = gouttiere + "mm";
    feuille.appendChild(bande);
  }

  feuille.appendChild(creerDemiPageLivret(demiDroite, f, margeInt, margeExt));

  // Les deux traits, posés DANS la gouttière : ils ne touchent aucune page, et
  // la bande qu'ils encadrent part avec la coupe.
  if (sansTraits) return feuille;

  if (gouttiere > 0) {
    [f.larg + 0.4, f.larg + gouttiere - 0.4].forEach((x) => {
      const trait = document.createElement("div");
      trait.className = "trait-milieu";
      trait.style.left = x + "mm";
      trait.style.height = f.haut + "mm";
      feuille.appendChild(trait);
    });
  } else {
    // Pas la place pour une gouttière : un seul trait, sur la ligne de coupe.
    const trait = document.createElement("div");
    trait.className = "trait-milieu";
    trait.style.left = f.larg + "mm";
    trait.style.height = f.haut + "mm";
    feuille.appendChild(trait);
  }

  return feuille;
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
  ouvrirDialogueCouvertureSeule(livre, f, nbPages, false);
}

// La même couverture, pour un cahier agrafé. Un livret n'a pas de dos plat :
// la planche vaut exactement deux pages, à plier en deux et à agrafer avec le
// cahier. Plutôt que de demander à l'auteur d'y penser et de saisir 0, le
// bouton du livret ouvre le panneau avec le dos déjà écarté.
function exporterCouvertureLivret() {
  flushSpread();
  const livre = livreActuel();
  const f = FORMATS[livre.format || "149x210"] || FORMATS["149x210"];
  ouvrirDialogueCouvertureSeule(livre, f, (livre.pages || []).length, true);
}

// Papiers courants pour les PAGES INTÉRIEURES. C'est leur épaisseur qui fait
// le dos, pas celle de la couverture : le dos entoure la pile des pages.
//
// La « main » (ou bouffant) dit combien un papier gonfle à grammage égal —
// un mot d'imprimeur qui ne dit rien à personne. On la range donc dans les
// réglages fins et on propose des papiers nommés, avec leur usage.
const PAPIERS_INTERIEUR = [
  { cle: "70",  nom: "Papier fin — 70 g",        grammage: 70,  main: 1.2 },
  { cle: "80",  nom: "Papier ordinaire — 80 g",  grammage: 80,  main: 1.2 },
  { cle: "90",  nom: "Un peu épais — 90 g",      grammage: 90,  main: 1.2 },
  { cle: "100", nom: "Épais — 100 g",            grammage: 100, main: 1.2 },
  { cle: "120", nom: "Très épais — 120 g",       grammage: 120, main: 1.2 }
];
const PAPIER_INTERIEUR_DEFAUT = "80";

function papierInterieur(cle) {
  return PAPIERS_INTERIEUR.find((p) => p.cle === cle) || PAPIERS_INTERIEUR[1];
}

function ouvrirDialogueCouvertureSeule(livre, f, nbPages, agrafe) {
  const ancien = document.getElementById("dialogueCouverture");
  if (ancien) ancien.remove();

  const papierPages = papierInterieur(PAPIER_INTERIEUR_DEFAUT);
  const dosCalcule = agrafe ? 0 : epaisseurDosMm(nbPages, papierPages.grammage, papierPages.main);
  const largSupport = (dosMm) => 2 * f.larg + dosMm + 2 * MARGE_TECHNIQUE_MM;
  const hautSupport = f.haut + 2 * MARGE_TECHNIQUE_MM;

  let html = '<div class="modal-impression-carte mi-carte" role="dialog" aria-modal="true">' +
    '<button class="mi-fermer" aria-label="Fermer">&#10005;</button>' +
    "<h3>" + (agrafe ? "La couverture du livret" : "La couverture") + "</h3>" +
    '<p class="mi-intro">' + (agrafe
      ? "Une seule feuille, ouverte à plat : la 4e de couverture et la 1re. " +
        "On la plie en deux et on l'agrafe avec le cahier."
      : "Une seule feuille, ouverte à plat : la 4e de couverture, le dos, la 1re. " +
        "Des traits marquent où plier et où couper.") + "</p>";

  // Le dessin dit en un coup d'œil ce qui va sortir de l'imprimante.
  html += '<div class="dc-apercu">' + schemaPlancheHtml(f, dosCalcule, agrafe) + "</div>";

  if (!agrafe) {
    html += '<div class="mi-groupe"><h4>Quelle épaisseur fera le dos ?</h4>' +
      '<p class="mi-groupe-aide">Le dos entoure la pile de vos pages : c\'est ' +
      "l'épaisseur de <b>leur</b> papier qui compte, pas celle de la couverture. " +
      "Choisissez le papier que vous mettrez dans le bac.</p>" +
      '<div class="dc-ligne">' +
        '<label class="tr-champ"><span>Papier de vos pages</span>' +
          '<select id="dcPapierPages">' +
            PAPIERS_INTERIEUR.map((pa) => '<option value="' + pa.cle + '"' +
              (pa.cle === PAPIER_INTERIEUR_DEFAUT ? " selected" : "") + ">" + pa.nom + "</option>").join("") +
          "</select></label>" +
        '<label class="tr-champ tr-court"><span>Dos obtenu</span>' +
          '<input type="number" id="dcDos" value="' + dosCalcule.toFixed(1) +
          '" min="0" max="60" step="0.1"> <small>mm</small></label>' +
      "</div>" +
      '<p class="mi-groupe-aide dc-calcul"></p>' +
      '<details class="mi-details-schema"><summary>Le dos ne tombe pas juste ?</summary>' +
        "<p>Le calcul part d'un papier moyen ; le vôtre gonfle peut-être un peu plus " +
        "ou un peu moins. La mesure vaut mieux que le calcul : <b>imprimez vos pages, " +
        "tassez la pile sur une table, mesurez son épaisseur à la règle</b> et reportez-la " +
        "dans « Dos obtenu ». La couverture elle-même ajoute une fraction de millimètre, " +
        "absorbée par les plis.</p>" +
        '<label class="tr-champ tr-court"><span>Main du papier</span>' +
          '<input type="number" id="dcMain" value="' + papierPages.main +
          '" min="0.8" max="2.5" step="0.05"></label>' +
        "<p>La « main » dit de combien un papier gonfle à grammage égal. 1,2 correspond " +
        "à un papier de bureau courant ; un papier bouffant de roman monte à 1,8.</p>" +
      "</details>" +
    "</div>";
  } else {
    html += '<p class="mi-groupe-aide">Un cahier agrafé n\'a pas de dos plat : la planche ' +
      "vaut exactement deux pages, et le pli tombe en son milieu. Pour un dos collé, " +
      "repassez par « La couverture » du dos collé.</p>" +
      '<input type="hidden" id="dcDos" value="0">';
  }

  html += '<div class="mi-groupe"><h4>Sur quelle feuille imprimez-vous ?</h4>' +
    '<div class="dc-ligne">' +
      '<label class="tr-champ"><span>Papier chargé dans l\'imprimante</span>' +
        '<select id="dcPapier">' +
          PAPIERS.map((pa) => '<option value="' + pa.cle + '">' + pa.nom +
            " — " + pa.larg + " × " + pa.haut + " mm</option>").join("") +
          '<option value="exact">Taille exacte de la planche (pour un PDF)</option>' +
        "</select></label>" +
      '<div class="tr-champ"><span>Planche à plat</span>' +
        '<strong class="dc-support">' + largSupport(dosCalcule).toFixed(0) +
        " × " + hautSupport + " mm</strong></div>" +
    "</div>" +
    '<p class="mi-groupe-aide dc-papier"></p>' +
  "</div>";

  html += '<p class="mi-resume">Dans la fenêtre d\'impression : échelle <b>100 %</b> ' +
    "(jamais « ajuster à la page »), marges « aucune », et décochez les en-têtes et " +
    "pieds de page du navigateur. Sans quoi les plis ne tomberaient plus au bon endroit.</p>";

  html += '<div class="mi-actions">' +
    '<button class="ci-annuler" type="button">Annuler</button>' +
    '<button class="mi-lancer" type="button">Imprimer la couverture</button>' +
  "</div></div>";

  const fond = document.createElement("div");
  fond.id = "dialogueCouverture";
  fond.className = "modal-impression";
  fond.innerHTML = html;
  fond.addEventListener("click", (e) => { if (e.target === fond) fond.remove(); });
  document.body.appendChild(fond);

  const champDos = fond.querySelector("#dcDos");
  const selPapier = fond.querySelector("#dcPapier");
  const selPages = fond.querySelector("#dcPapierPages");
  const champMain = fond.querySelector("#dcMain");

  const dosSaisi = () => {
    const v = parseFloat(champDos.value);
    return isFinite(v) && v >= 0 ? v : dosCalcule;
  };

  // Le dessin, la taille de planche et la remarque sur le papier suivent
  // chaque frappe : on voit tout de suite l'effet de ce qu'on change.
  const rafraichir = () => {
    const dosMm = dosSaisi();
    const l = largSupport(dosMm);

    fond.querySelector(".dc-apercu").innerHTML = schemaPlancheHtml(f, dosMm, agrafe);
    fond.querySelector(".dc-support").textContent = l.toFixed(0) + " × " + hautSupport + " mm";

    const calcul = fond.querySelector(".dc-calcul");
    if (calcul && selPages) {
      const pa = papierInterieur(selPages.value);
      const m = parseFloat(champMain && champMain.value) || pa.main;
      calcul.textContent = "Calculé pour " + nbPages + " pages, soit " +
        Math.ceil(nbPages / 2) + " feuilles de " + pa.grammage + " g/m² : " +
        epaisseurDosMm(nbPages, pa.grammage, m).toFixed(1).replace(".", ",") + " mm.";
    }

    const papier = papierParCle(selPapier.value);
    const note = fond.querySelector(".dc-papier");
    if (!papier) {
      note.textContent = "Taille exacte : à réserver au PDF. Sur une imprimante, le pilote " +
        "ramènerait la planche au format du papier chargé, et la couverture ne ferait plus " +
        "la bonne taille.";
      note.classList.add("dc-alerte");
    } else if (papier.larg < l || papier.haut < hautSupport) {
      const mieux = papierMinimal(l, hautSupport);
      note.textContent = "La planche ne tient pas sur cette feuille : elle serait rognée. " +
        "Prenez du " + (mieux ? mieux.nom : "plus grand") + ".";
      note.classList.add("dc-alerte");
    } else {
      note.textContent = "La planche tient sur cette feuille, à sa taille réelle.";
      note.classList.remove("dc-alerte");
    }
  };

  // Changer de papier recalcule le dos ; le modifier à la main fige la valeur.
  const recalculerDos = () => {
    const pa = papierInterieur(selPages.value);
    const m = parseFloat(champMain && champMain.value) || pa.main;
    champDos.value = epaisseurDosMm(nbPages, pa.grammage, m).toFixed(1);
    rafraichir();
  };
  if (selPages) selPages.onchange = recalculerDos;
  if (champMain) champMain.oninput = recalculerDos;
  champDos.oninput = rafraichir;
  selPapier.onchange = rafraichir;

  const parDefaut = papierMinimal(largSupport(dosCalcule), hautSupport);
  if (parDefaut) selPapier.value = parDefaut.cle;
  rafraichir();

  fond.querySelector(".mi-fermer").onclick = () => fond.remove();
  fond.querySelector(".ci-annuler").onclick = () => fond.remove();
  fond.querySelector(".mi-lancer").onclick = () => {
    const dosMm = dosSaisi();
    const papier = papierParCle(selPapier.value);
    fond.remove();
    // Aucune page intérieure à fournir : la planche de couverture n'en utilise pas.
    setTimeout(() => genererFichierImprimeur("couverture", dosMm, livre, f, [], papier), 50);
  };
}

// La planche vue de dessus : 4e de couverture, dos, 1re — avec le dos à
// l'échelle, pour qu'on voie tout de suite s'il est plausible.
function schemaPlancheHtml(f, dosMm, agrafe) {
  const H = 108;                      // hauteur du dessin, en px
  const echelle = H / f.haut;
  const largPan = f.larg * echelle;
  const largDos = Math.max(agrafe ? 1 : 2, dosMm * echelle);
  const total = 2 * largPan + largDos;

  const panneau = (x, etiquette) =>
    '<rect x="' + x.toFixed(1) + '" y="6" width="' + largPan.toFixed(1) + '" height="' + H +
      '" rx="2" fill="#fffdf8" stroke="currentColor" stroke-width="1.4"/>' +
    '<text x="' + (x + largPan / 2).toFixed(1) + '" y="' + (H / 2 + 10) +
      '" font-size="10" text-anchor="middle" fill="currentColor" opacity=".75">' + etiquette + "</text>";

  // Taille intrinsèque donnée en pixels : sans elle, le SVG s'étire à la
  // largeur du dialogue et grossit ses libellés jusqu'à l'absurde.
  const largeurPx = total + 4;
  const hauteurPx = H + 30;
  return '<svg width="' + largeurPx.toFixed(0) + '" height="' + hauteurPx +
    '" viewBox="0 0 ' + largeurPx.toFixed(1) + ' ' + hauteurPx + '" class="dc-schema" role="img" ' +
    'aria-label="La planche de couverture, à plat">' +
    panneau(2, "4e de couv.") +
    '<rect x="' + (2 + largPan).toFixed(1) + '" y="6" width="' + largDos.toFixed(1) +
      '" height="' + H + '" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="1.4"/>' +
    panneau(2 + largPan + largDos, "1re de couv.") +
    '<text x="' + (2 + largPan + largDos / 2).toFixed(1) + '" y="' + (H + 22) +
      '" font-size="9" text-anchor="middle" fill="currentColor">' +
      (agrafe ? "le pli" : "dos " + dosMm.toFixed(1).replace(".", ",") + " mm") + "</text>" +
  "</svg>";
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
  ouvrirAttente("Préparation du fichier…",
    "La planche et ses images sont assemblées ; la fenêtre d'impression s'ouvrira toute seule.");

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
      const largTrim = 2 * f.larg + dosMm;          // la couverture finie
      const largSupport = largTrim + 2 * MARGE_TECHNIQUE_MM;
      const hautSupport = f.haut + 2 * MARGE_TECHNIQUE_MM;
      // Sur une imprimante, la planche est centrée sur une feuille réelle pour
      // sortir à sa taille exacte. Pour l'imprimeur, c'est le support lui-même
      // qui doit faire cette taille : pas d'enveloppe.
      if (papier) {
        const planche = creerCouverturePlat(livre, f, dosMm, promessesImages, false);
        reglerPagePapier(stylePage, papier);
        // On cerne le format ROGNÉ, pas le support : le support n'est qu'un
        // porte-repères, et l'encadrer donnait deux rectangles concentriques
        // sur la feuille — dont un qu'il ne fallait surtout pas suivre.
        const feuilleP = poserSurPapier(planche, papier, largTrim, f.haut);
        ajouterLegendeCouverture(feuilleP, papier, largSupport, hautSupport, dosMm);
        zone.appendChild(feuilleP);
      } else {
        const planche = creerCouverturePlat(livre, f, dosMm, promessesImages, true);
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
    fermerAttente();
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
//
// `pointille` les distingue des traits de coupe. Chez un imprimeur, la
// convention du métier suffit ; chez soi, deux hairlines identiques à cinq
// millimètres l'une de l'autre — l'une à scier, l'autre à plier — ne se
// distinguent pas, et l'on coupe la couverture en trois.
//
// Ils restent DEHORS du format rogné : un pointillé qui traverserait le dos
// resterait imprimé sur le livre fini. La contrepartie est que la coupe les
// emporte, d'où la consigne de marquer les plis avant de couper.
function ajouterReperesPli(feuille, hautTrim, positionsMm, pointille) {
  const M = MARGE_TECHNIQUE_MM;
  const d = DECALAGE_REPERE_MM;
  const L = LONGUEUR_REPERE_MM;
  positionsMm.forEach((x) => {
    [M - d - L, M + hautTrim + d].forEach((y) => {
      const t = document.createElement("div");
      t.className = "repere-pro repere-v repere-pli-pro" + (pointille ? " repere-pli-tirets" : "");
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

    // Comme pour la couverture : le travail a lieu dans la réponse du lecteur
    // de fichier, c'est donc ici que le voile se pose.
    ouvrirAttente("Envoi de l'image…", "Le transfert d'une image prend quelques secondes.");
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
    } finally {
      fermerAttente();
    }
  };
  lecteur.readAsDataURL(fichier);
}

// Couverture ouverte à plat : 4e de couverture | dos | 1re de couverture.
// `pourImprimeur` : la planche part telle quelle chez un professionnel, avec
// les repères d'angle qu'attend son massicot. Chez soi, on coupe à la règle :
// ce sont alors les lignes pleines posées par poserSurPapier qui cernent la
// couverture, et la planche se contente d'indiquer ses plis.
function creerCouverturePlat(livre, f, dosMm, promessesImages, pourImprimeur) {
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
  if (pourImprimeur) ajouterReperesCoupe(feuille, largTrim, f.haut);
  ajouterReperesPli(feuille, f.haut, [f.larg, f.larg + dosMm], !pourImprimeur);
  return feuille;
}

// La légende, posée sur le BLANC DE LA FEUILLE, sous la planche — et non dans
// la marge technique, où elle passerait au travers des repères de pli.
// Elle ne survit pas non plus à la coupe, et c'est très bien : elle n'a plus
// rien à dire une fois la couverture détourée.
//
// Sans elle, la feuille porte deux sortes de repères qui se ressemblent, et
// rien ne dit lequel est un trait de scie et lequel est un pli.
function ajouterLegendeCouverture(feuilleP, papier, largSupport, hautSupport, dosMm) {
  const margeBasse = (papier.haut - hautSupport) / 2;
  if (margeBasse < 6) return;   // pas la place d'écrire quoi que ce soit

  const p = document.createElement("div");
  p.className = "legende-couv-pro";
  p.style.left = ((papier.larg - largSupport) / 2) + "mm";
  p.style.top = (papier.haut - margeBasse + 2) + "mm";
  p.style.width = largSupport + "mm";
  p.innerHTML =
    "<b>Trait plein</b> : couper — les quatre lignes font le tour de la couverture. &nbsp;·&nbsp; " +
    "<b>Pointillé</b> : plier" + (dosMm > 0 ? ", les deux bords du dos" : ", le pli central") +
    ". &nbsp;·&nbsp; Marquez les plis au crayon <b>avant</b> de couper : leurs repères sont hors de la couverture, la coupe les emporte.";
  feuilleP.appendChild(p);
}

// Un panneau de couverture au format rogné, réutilisant le rendu existant.
function creerPanneauCouverture(livre, mode, f, promessesImages) {
  const panneau = creerCouvertureImpression(livre, mode, f, promessesImages);
  panneau.classList.remove("page-impression");
  panneau.classList.add("panneau-couv-pro");
  return panneau;
}
