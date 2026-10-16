// Recto-verso : une image au recto, une grille de cartes à message au verso.
//
// Tout se passe dans le navigateur : l'image est lue par FileReader et ne part
// nulle part (aucun appel réseau dans ce site). Rien n'est non plus gardé sur le
// site — le « projet » est un fichier JSON que l'on enregistre soi-même.
//
// La feuille est dessinée en MILLIMÈTRES (voir style.css) : l'écran la réduit
// par un simple « scale », l'impression la sort à l'échelle 1.
(function () {
  "use strict";

  const PX_PAR_MM = 96 / 25.4;
  const FORMATS = { A3: [297, 420], A4: [210, 297], A5: [148, 210] };
  const POLICES = {
    garamond: { famille: '"EB Garamond", Georgia, serif', style: "normal" },
    garamondItalique: { famille: '"EB Garamond", Georgia, serif', style: "italic" },
    sans: { famille: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', style: "normal" }
  };
  const MODELES = [[2, 2], [2, 3], [2, 4], [3, 3], [3, 4], [3, 5], [4, 5], [4, 6]];
  const TAILLE_MIN_AUTO = 5;          // pt : plancher du rétrécissement automatique

  const etat = {
    format: "A4", paysage: false,
    image: null, largeurImg: 0, hauteurImg: 0,
    ajustement: "remplir", zoom: 1, dx: 0, dy: 0, fondRecto: "#ffffff",
    colonnes: 3, lignes: 5, marge: 0, traits: true,
    police: "garamond", taille: 16, couleur: "#241d15", fondVerso: "#ffffff",
    textes: [],
    face: "recto"
  };
  let echelle = 1;                    // réduction de la feuille à l'écran

  const $ = (id) => document.getElementById(id);
  const el = {
    scene: $("scene"), mise: $("mise"), retourne: $("retourne"),
    faceRecto: $("faceRecto"), faceVerso: $("faceVerso"), grille: $("grille"),
    img: $("imageRecto"), depot: $("zoneDepot"), zone: $("zone"),
    fichierImage: $("fichierImage"), fichierProjet: $("fichierProjet"),
    stylePage: $("stylePage")
  };

  const borne = (v, mini, maxi) => Math.min(maxi, Math.max(mini, v));
  const arrondi = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const fr = (v) => String(arrondi(v, 1)).replace(".", ",");

  function dimensions() {
    const [a, b] = FORMATS[etat.format];
    return etat.paysage ? { W: b, H: a } : { W: a, H: b };
  }

  // ----- Feuille : taille, réduction à l'écran, page d'impression -----
  function majFeuille() {
    const { W, H } = dimensions();
    const racine = document.documentElement.style;
    racine.setProperty("--W", W + "mm");
    racine.setProperty("--H", H + "mm");
    el.stylePage.textContent = "@page { size: " + W + "mm " + H + "mm; margin: 0; }";

    const largeurDispo = Math.max(200, el.zone.clientWidth - 4);
    const hauteurDispo = Math.max(320, window.innerHeight - 150);
    echelle = Math.min(largeurDispo / (W * PX_PAR_MM), hauteurDispo / (H * PX_PAR_MM));
    el.scene.style.width = arrondi(W * PX_PAR_MM * echelle, 2) + "px";
    el.scene.style.height = arrondi(H * PX_PAR_MM * echelle, 2) + "px";
    el.mise.style.transform = "scale(" + echelle + ")";
    // Un trait de 0,25 mm tombe sous le pixel une fois la feuille réduite : on
    // l'épaissit à l'écran seulement (l'impression remet 0,25 mm).
    racine.setProperty("--t-ecran", arrondi(Math.max(0.25, 1.2 / (echelle * PX_PAR_MM)), 3) + "mm");

    $("infoFeuille").textContent = FORMATS[etat.format].join(" × ") + " mm" + " — " + (etat.paysage ? "paysage" : "portrait");
    majImage();
    majInfosCartes();
    majAide();
  }

  function majAide() {
    const bord = etat.paysage ? "court" : "long";
    $("aideImpression").textContent =
      "Dans la fenêtre d'impression : recto-verso, retourner sur le bord " + bord +
      ", marges « aucune », échelle 100 %. Le verso est dessiné tel qu'on le voit en retournant la feuille " +
      "— la carte en haut à gauche du verso est donc derrière la partie en haut à droite du recto. " +
      "Faites un essai sur du brouillon : les imprimantes ne se retournent pas toutes pareil.";
  }

  // ----- Recto : placement de l'image -----
  function majImage() {
    const { W, H } = dimensions();
    el.faceRecto.style.background = etat.fondRecto;
    const avec = !!etat.image;
    el.img.hidden = !avec;
    el.depot.hidden = avec;
    el.faceRecto.classList.toggle("avec-image", avec);
    $("reglagesImage").hidden = !avec;
    $("btnRetirerImage").hidden = !avec;
    $("btnImage").textContent = avec ? "Changer d'image…" : "Choisir une image…";
    $("champFondRecto").hidden = etat.ajustement !== "ajuster";
    if (!avec) return;

    const w = etat.largeurImg, h = etat.hauteurImg;
    const base = etat.ajustement === "remplir" ? Math.max(W / w, H / h) : Math.min(W / w, H / h);   // mm par pixel
    const s = base * etat.zoom;
    const lw = w * s, lh = h * s;
    // On ne laisse pas glisser l'image hors de la feuille : en mode « remplir »,
    // elle doit toujours la couvrir entièrement.
    const maxX = etat.ajustement === "remplir" ? Math.max(0, (lw - W) / 2) : W / 2;
    const maxY = etat.ajustement === "remplir" ? Math.max(0, (lh - H) / 2) : H / 2;
    etat.dx = borne(etat.dx, -maxX, maxX);
    etat.dy = borne(etat.dy, -maxY, maxY);
    if (el.img.getAttribute("src") !== etat.image) el.img.src = etat.image;
    el.img.style.width = arrondi(lw, 3) + "mm";
    el.img.style.height = arrondi(lh, 3) + "mm";
    el.img.style.left = arrondi((W - lw) / 2 + etat.dx, 3) + "mm";
    el.img.style.top = arrondi((H - lh) / 2 + etat.dy, 3) + "mm";

    const ppp = Math.round(25.4 / s);
    const verdict = ppp >= 250 ? "très bonne netteté" : ppp >= 150 ? "netteté correcte" : "faible : l'impression risque d'être floue";
    $("infoImage").textContent = w + " × " + h + " px — environ " + ppp + " ppp sur la feuille (" + verdict + ").";
  }

  function chargerImage(fichier) {
    if (!fichier || !/^image\//.test(fichier.type)) {
      alert("Ce fichier n'est pas une image.");
      return;
    }
    const lecteur = new FileReader();
    lecteur.onerror = () => alert("Impossible de lire ce fichier.");
    lecteur.onload = () => poserImage(String(lecteur.result), true);
    lecteur.readAsDataURL(fichier);
  }

  function poserImage(dataUrl, recentrer, apres) {
    const test = new Image();
    test.onload = () => {
      etat.image = dataUrl;
      etat.largeurImg = test.naturalWidth;
      etat.hauteurImg = test.naturalHeight;
      if (recentrer) { etat.dx = 0; etat.dy = 0; etat.zoom = 1; }
      synchroniserControles();
      majImage();
      if (apres) apres();
    };
    test.onerror = () => alert("Cette image ne peut pas être affichée par le navigateur.");
    test.src = dataUrl;
  }

  // Glisser l'image sur la feuille pour la cadrer.
  (function () {
    let depart = null;
    el.faceRecto.addEventListener("pointerdown", (e) => {
      if (!etat.image || e.button > 0) return;
      depart = { x: e.clientX, y: e.clientY, dx: etat.dx, dy: etat.dy };
      el.faceRecto.setPointerCapture(e.pointerId);
      el.faceRecto.classList.add("glisse");
    });
    el.faceRecto.addEventListener("pointermove", (e) => {
      if (!depart) return;
      const k = echelle * PX_PAR_MM;
      etat.dx = depart.dx + (e.clientX - depart.x) / k;
      etat.dy = depart.dy + (e.clientY - depart.y) / k;
      majImage();
    });
    const fin = () => { depart = null; el.faceRecto.classList.remove("glisse"); };
    el.faceRecto.addEventListener("pointerup", fin);
    el.faceRecto.addEventListener("pointercancel", fin);
  })();

  // Déposer une image sur la feuille ou sur la page.
  ["dragenter", "dragover"].forEach((nom) => document.addEventListener(nom, (e) => {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1) {
      e.preventDefault();
      el.faceRecto.classList.add("survol");
    }
  }));
  ["dragleave", "drop"].forEach((nom) => document.addEventListener(nom, () => el.faceRecto.classList.remove("survol")));
  document.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    chargerImage(e.dataTransfer.files[0]);
    retourner("recto");
  });

  // ----- Verso : la grille de cartes -----
  const ECRITURE_BRUTE = (function () {
    const test = document.createElement("div");
    try { test.contentEditable = "plaintext-only"; } catch (e) { /* navigateur ancien */ }
    return test.contentEditable === "plaintext-only";
  })();

  function construireGrille() {
    const { colonnes, lignes } = etat;
    el.grille.innerHTML = "";
    el.grille.style.gridTemplateColumns = "repeat(" + colonnes + ", 1fr)";
    el.grille.style.gridTemplateRows = "repeat(" + lignes + ", 1fr)";
    for (let i = 0; i < colonnes * lignes; i++) {
      const carte = document.createElement("div");
      carte.className = "carte";
      const texte = document.createElement("div");
      texte.className = "texte";
      texte.contentEditable = ECRITURE_BRUTE ? "plaintext-only" : "true";
      texte.spellcheck = true;
      texte.lang = "fr";
      texte.dataset.i = String(i);
      texte.setAttribute("role", "textbox");
      texte.setAttribute("aria-multiline", "true");
      texte.setAttribute("aria-label", "Carte " + (i + 1));
      texte.textContent = etat.textes[i] || "";
      texte.classList.toggle("vide", !texte.textContent);
      carte.appendChild(texte);
      el.grille.appendChild(carte);
    }
    majStyleVerso();
    majInfosCartes();
    requestAnimationFrame(ajusterTous);
  }

  el.grille.addEventListener("input", (e) => {
    const texte = e.target.closest(".texte");
    if (!texte) return;
    etat.textes[Number(texte.dataset.i)] = texte.innerText.replace(/\n+$/, "");
    texte.classList.toggle("vide", !texte.textContent);
    ajuster(texte);
  });
  el.grille.addEventListener("click", (e) => {
    const carte = e.target.closest(".carte");
    if (carte && e.target === carte) carte.querySelector(".texte").focus();
  });
  // Sans « plaintext-only », Entrée crée des <div> et le collage garde la mise
  // en forme : on force le texte brut à la main.
  if (!ECRITURE_BRUTE) {
    el.grille.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.classList.contains("texte")) {
        e.preventDefault();
        document.execCommand("insertText", false, "\n");
      }
    });
    el.grille.addEventListener("paste", (e) => {
      if (!e.target.classList.contains("texte")) return;
      e.preventDefault();
      const brut = (e.clipboardData || window.clipboardData).getData("text");
      document.execCommand("insertText", false, brut);
    });
  }

  // Un texte trop long pour sa carte rapetisse jusqu'à y tenir.
  function ajuster(texte) {
    const carte = texte.parentElement;
    const cs = getComputedStyle(carte);
    const dispoH = carte.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const dispoL = carte.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let t = etat.taille;
    texte.style.fontSize = t + "pt";
    if (!texte.textContent) { texte.classList.remove("trop-long"); return; }
    while (t > TAILLE_MIN_AUTO && (texte.scrollHeight > dispoH + 0.5 || texte.scrollWidth > dispoL + 0.5)) {
      t -= 0.5;
      texte.style.fontSize = t + "pt";
    }
    texte.classList.toggle("trop-long", texte.scrollHeight > dispoH + 0.5 || texte.scrollWidth > dispoL + 0.5);
  }
  function ajusterTous() {
    el.grille.querySelectorAll(".texte").forEach(ajuster);
  }

  function majStyleVerso() {
    const p = POLICES[etat.police] || POLICES.garamond;
    const f = el.faceVerso.style;
    f.background = etat.fondVerso;
    f.setProperty("--police-texte", p.famille);
    f.setProperty("--style-texte", p.style);
    f.setProperty("--couleur-texte", etat.couleur);
    f.setProperty("--trait", etat.traits ? "#cfcfcf" : "transparent");
    el.grille.style.setProperty("--marge", etat.marge + "mm");
  }

  function majInfosCartes() {
    const { W, H } = dimensions();
    const n = etat.colonnes * etat.lignes;
    const l = (W - 2 * etat.marge) / etat.colonnes, h = (H - 2 * etat.marge) / etat.lignes;
    $("infoCartes").textContent = n + (n > 1 ? " cartes" : " carte") + " de " + fr(l) + " × " + fr(h) + " mm";
    document.querySelectorAll("#modeles .puce").forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.c) === etat.colonnes && Number(b.dataset.l) === etat.lignes));
    });
  }

  function repartirListe() {
    const lignes = $("listeMessages").value.replace(/\r/g, "").split("\n");
    while (lignes.length && lignes[lignes.length - 1].trim() === "") lignes.pop();
    const n = etat.colonnes * etat.lignes;
    if (lignes.length > n && !confirm("La liste compte " + lignes.length + " messages pour " + n + " cartes : les " + (lignes.length - n) + " derniers seront ignorés. Continuer ?")) return;
    for (let i = 0; i < n; i++) etat.textes[i] = (lignes[i] || "").trim();
    construireGrille();
  }

  // ----- Retourner la feuille -----
  function retourner(face) {
    etat.face = face === "verso" || face === "recto" ? face : (etat.face === "recto" ? "verso" : "recto");
    el.retourne.classList.toggle("verso", etat.face === "verso");
    // La face cachée ne doit pas non plus recevoir le clavier.
    el.faceRecto.inert = etat.face === "verso";
    el.faceVerso.inert = etat.face === "recto";
    document.querySelectorAll("#segFace button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valeur === etat.face)));
  }

  // ----- Projet : enregistrer / ouvrir -----
  function enregistrerProjet() {
    const copie = Object.assign({}, etat);
    delete copie.face;
    copie.version = 1;
    const blob = new Blob([JSON.stringify(copie)], { type: "application/json" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = "recto-verso.json";
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
  }

  function ouvrirProjet(fichier) {
    const lecteur = new FileReader();
    lecteur.onerror = () => alert("Impossible de lire ce fichier.");
    lecteur.onload = () => {
      let p;
      try { p = JSON.parse(String(lecteur.result)); } catch (e) { p = null; }
      if (!p || typeof p !== "object" || p.version !== 1) { alert("Ce fichier n'est pas un projet Recto-verso."); return; }
      const nombre = (v, mini, maxi, defaut) => (typeof v === "number" && isFinite(v) ? borne(v, mini, maxi) : defaut);
      const couleur = (v, defaut) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : defaut);
      etat.format = FORMATS[p.format] ? p.format : "A4";
      etat.paysage = p.paysage === true;
      etat.ajustement = p.ajustement === "ajuster" ? "ajuster" : "remplir";
      etat.zoom = nombre(p.zoom, 1, 4, 1);
      etat.dx = nombre(p.dx, -1000, 1000, 0);
      etat.dy = nombre(p.dy, -1000, 1000, 0);
      etat.fondRecto = couleur(p.fondRecto, "#ffffff");
      etat.colonnes = Math.round(nombre(p.colonnes, 1, 12, 3));
      etat.lignes = Math.round(nombre(p.lignes, 1, 12, 5));
      etat.marge = nombre(p.marge, 0, 30, 0);
      etat.traits = p.traits !== false;
      etat.police = POLICES[p.police] ? p.police : "garamond";
      etat.taille = nombre(p.taille, 6, 48, 16);
      etat.couleur = couleur(p.couleur, "#241d15");
      etat.fondVerso = couleur(p.fondVerso, "#ffffff");
      etat.textes = Array.isArray(p.textes) ? p.textes.slice(0, 144).map((t) => (typeof t === "string" ? t.slice(0, 2000) : "")) : [];
      const fin = () => { synchroniserControles(); majFeuille(); construireGrille(); };
      if (typeof p.image === "string" && /^data:image\//.test(p.image)) {
        poserImage(p.image, false, fin);
      } else {
        etat.image = null; etat.largeurImg = 0; etat.hauteurImg = 0;
        fin();
      }
    };
    lecteur.readAsText(fichier);
  }

  // ----- Panneau de réglages -----
  function synchroniserControles() {
    const marquer = (idGroupe, valeur) => document.querySelectorAll("#" + idGroupe + " button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valeur === valeur)));
    marquer("segFormat", etat.format);
    marquer("segOrientation", etat.paysage ? "paysage" : "portrait");
    marquer("segAjustement", etat.ajustement);
    marquer("segFace", etat.face);
    $("curseurZoom").value = Math.round(etat.zoom * 100);
    $("valZoom").textContent = Math.round(etat.zoom * 100) + " %";
    $("fondRecto").value = etat.fondRecto;
    $("colonnes").value = etat.colonnes;
    $("lignes").value = etat.lignes;
    $("curseurMarge").value = etat.marge;
    $("valMarge").textContent = etat.marge + " mm";
    $("caseTraits").checked = etat.traits;
    $("choixPolice").value = etat.police;
    $("curseurTaille").value = etat.taille;
    $("valTaille").textContent = etat.taille + " pt";
    $("couleurTexte").value = etat.couleur;
    $("fondVerso").value = etat.fondVerso;
  }

  function lierSegment(idGroupe, quand) {
    $(idGroupe).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) quand(b.dataset.valeur);
    });
  }

  lierSegment("segFormat", (v) => { etat.format = v; synchroniserControles(); majFeuille(); construireGrille(); });
  lierSegment("segOrientation", (v) => { etat.paysage = v === "paysage"; synchroniserControles(); majFeuille(); construireGrille(); });
  lierSegment("segAjustement", (v) => { etat.ajustement = v; etat.dx = 0; etat.dy = 0; synchroniserControles(); majImage(); });
  lierSegment("segFace", (v) => retourner(v));
  $("btnRetourner").addEventListener("click", () => retourner());

  $("btnImage").addEventListener("click", () => el.fichierImage.click());
  el.depot.addEventListener("click", () => el.fichierImage.click());
  el.fichierImage.addEventListener("change", () => {
    if (el.fichierImage.files[0]) chargerImage(el.fichierImage.files[0]);
    el.fichierImage.value = "";
  });
  $("btnRetirerImage").addEventListener("click", () => {
    etat.image = null; etat.largeurImg = 0; etat.hauteurImg = 0; etat.dx = 0; etat.dy = 0; etat.zoom = 1;
    el.img.removeAttribute("src");
    synchroniserControles(); majImage();
  });
  $("btnRecentrer").addEventListener("click", () => { etat.dx = 0; etat.dy = 0; etat.zoom = 1; synchroniserControles(); majImage(); });
  $("curseurZoom").addEventListener("input", (e) => { etat.zoom = Number(e.target.value) / 100; $("valZoom").textContent = e.target.value + " %"; majImage(); });
  $("fondRecto").addEventListener("input", (e) => { etat.fondRecto = e.target.value; majImage(); });

  function changerGrille() {
    etat.colonnes = Math.round(borne(Number($("colonnes").value) || 1, 1, 12));
    etat.lignes = Math.round(borne(Number($("lignes").value) || 1, 1, 12));
    construireGrille();
  }
  $("colonnes").addEventListener("input", changerGrille);
  $("lignes").addEventListener("input", changerGrille);
  $("colonnes").addEventListener("change", () => { $("colonnes").value = etat.colonnes; });
  $("lignes").addEventListener("change", () => { $("lignes").value = etat.lignes; });
  MODELES.forEach(([c, l]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "puce"; b.dataset.c = c; b.dataset.l = l;
    b.textContent = c + " × " + l + " (" + c * l + ")";
    b.addEventListener("click", () => { etat.colonnes = c; etat.lignes = l; synchroniserControles(); construireGrille(); });
    $("modeles").appendChild(b);
  });
  $("curseurMarge").addEventListener("input", (e) => { etat.marge = Number(e.target.value); $("valMarge").textContent = e.target.value + " mm"; majStyleVerso(); majInfosCartes(); ajusterTous(); });
  $("caseTraits").addEventListener("change", (e) => { etat.traits = e.target.checked; majStyleVerso(); });

  $("choixPolice").addEventListener("change", (e) => { etat.police = e.target.value; majStyleVerso(); chargerPolices().then(ajusterTous); ajusterTous(); });
  $("curseurTaille").addEventListener("input", (e) => { etat.taille = Number(e.target.value); $("valTaille").textContent = e.target.value + " pt"; ajusterTous(); });
  $("couleurTexte").addEventListener("input", (e) => { etat.couleur = e.target.value; majStyleVerso(); });
  $("fondVerso").addEventListener("input", (e) => { etat.fondVerso = e.target.value; majStyleVerso(); });
  $("btnRepartir").addEventListener("click", repartirListe);
  $("btnViderCartes").addEventListener("click", () => {
    if (etat.textes.some(Boolean) && !confirm("Vider le texte de toutes les cartes ?")) return;
    etat.textes = [];
    construireGrille();
  });

  $("btnImprimer").addEventListener("click", () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.print();
  });
  $("btnEnregistrer").addEventListener("click", enregistrerProjet);
  $("btnOuvrir").addEventListener("click", () => el.fichierProjet.click());
  el.fichierProjet.addEventListener("change", () => {
    if (el.fichierProjet.files[0]) ouvrirProjet(el.fichierProjet.files[0]);
    el.fichierProjet.value = "";
  });

  // La police se charge à la demande : tant qu'elle n'est pas là, les mesures
  // d'« ajuster » se feraient sur une police de repli.
  function chargerPolices() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('16pt "EB Garamond"'),
      document.fonts.load('italic 16pt "EB Garamond"')
    ]).catch(() => {});
  }

  let planif = null;
  window.addEventListener("resize", () => {
    clearTimeout(planif);
    planif = setTimeout(majFeuille, 80);
  });

  synchroniserControles();
  majFeuille();
  construireGrille();
  retourner("recto");
  chargerPolices().then(ajusterTous);
})();
