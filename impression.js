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
const PIED_PAGE_MM = 12;    // zone réservée au numéro de page

function exporterImpression() {
  flushSpread();
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
    window.print();
  });
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
    ${mode === "couverture" && afficherTitre ? `<div class="titre-impression" style="color:${couleurTexte}">${livre.titre || ""}</div>` : ""}
    ${afficherAuteur ? `<div class="auteur-impression" style="color:${couleurTexte}">${livre.auteur || ""}</div>` : ""}
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
