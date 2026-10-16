// Recto-verso : une image au recto, une grille de cartes à message au verso —
// sur une feuille, ou sur deux feuilles collées (l'image se prolonge de l'une à l'autre).
//
// Tout se passe dans le navigateur : l'image est lue par FileReader et ne part
// nulle part (aucun appel réseau dans ce site). Rien n'est non plus gardé sur le
// site — le « projet » est un fichier JSON que l'on enregistre soi-même.
//
// La feuille est dessinée en MILLIMÈTRES (voir style.css) : l'écran la réduit
// par un simple « scale », l'impression la sort à l'échelle 1.
//
// Vocabulaire : la « toile » est l'ensemble des feuilles collées (une feuille, ou
// deux côte à côte / empilées). L'image du recto est posée sur la toile ; chaque
// feuille n'en montre que sa part. Chaque feuille a son propre verso.
(function () {
  "use strict";

  const PX_PAR_MM = 96 / 25.4;
  const FORMATS = { A3: [297, 420], A4: [210, 297], A5: [148, 210] };
  const POLICES = {
    garamond: { famille: '"EB Garamond", Georgia, serif', style: "normal" },
    garamondItalique: { famille: '"EB Garamond", Georgia, serif', style: "italic" },
    sans: { famille: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', style: "normal" }
  };
  const ASSEMBLAGES = { seule: 1, cote: 2, pile: 2 };
  const MODELES = [[2, 2], [2, 3], [2, 4], [3, 3], [3, 4], [3, 5], [4, 5], [4, 6]];
  const TAILLE_MIN_AUTO = 5;          // pt : plancher du rétrécissement automatique

  const etat = {
    format: "A4", paysage: false, assemblage: "seule",
    image: null, largeurImg: 0, hauteurImg: 0,
    ajustement: "remplir", zoom: 1, dx: 0, dy: 0, fondRecto: "#ffffff",
    colonnes: 3, lignes: 5, marge: 0, traits: true,
    police: "garamond", taille: 16, couleur: "#241d15", fondVerso: "#ffffff",
    textes: [],          // messages de la feuille 1, carte par carte
    textes2: [],         // ceux de la feuille 2
    face: "recto"
  };
  let echelle = 1;                    // réduction de la toile à l'écran
  let urlImage = null;                // adresse locale (blob:) de l'image affichée

  const $ = (id) => document.getElementById(id);
  const el = {
    scene: $("scene"), mise: $("mise"), retourne: $("retourne"),
    ensR: $("ensembleRecto"), ensV: $("ensembleVerso"),
    depot: $("zoneDepot"), zone: $("zone"), impression: $("zoneImpression"),
    fichierImage: $("fichierImage"), fichierProjet: $("fichierProjet"),
    stylePage: $("stylePage"),
    images: [], grilles: []
  };

  const borne = (v, mini, maxi) => Math.min(maxi, Math.max(mini, v));
  const arrondi = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const fr = (v) => String(arrondi(v, 1)).replace(".", ",");
  const nbFeuilles = () => ASSEMBLAGES[etat.assemblage] || 1;
  const textesDe = (s) => (s === 0 ? etat.textes : etat.textes2);

  function dimensions() {
    const [a, b] = FORMATS[etat.format];
    return etat.paysage ? { W: b, H: a } : { W: a, H: b };
  }
  // La toile : une feuille, ou deux collées.
  function toile() {
    const { W, H } = dimensions();
    if (etat.assemblage === "cote") return { CW: W * 2, CH: H };
    if (etat.assemblage === "pile") return { CW: W, CH: H * 2 };
    return { CW: W, CH: H };
  }
  // Où la feuille s (0 ou 1) commence sur la toile, en mm.
  function decalage(s) {
    const { W, H } = dimensions();
    if (etat.assemblage === "cote") return { x: s * W, y: 0 };
    if (etat.assemblage === "pile") return { x: 0, y: s * H };
    return { x: 0, y: 0 };
  }

  // ----- Structure : une ou deux feuilles de chaque côté -----
  function etiquette(texte) {
    const e = document.createElement("span");
    e.className = "etiquette-feuille ecran-seulement";
    e.textContent = texte;
    return e;
  }

  function construireStructure() {
    const n = nbFeuilles();
    document.documentElement.dataset.assemblage = etat.assemblage;
    [el.ensR, el.ensV].forEach((ens) => ens.querySelectorAll(".face, .joint").forEach((x) => x.remove()));
    el.images = [];
    el.grilles = [];
    for (let s = 0; s < n; s++) {
      const recto = document.createElement("div");
      recto.className = "face face-recto";
      recto.dataset.feuille = String(s + 1);
      const img = document.createElement("img");
      img.className = "image-recto";
      img.alt = "";
      img.draggable = false;
      img.hidden = true;
      recto.appendChild(img);
      if (n > 1) recto.appendChild(etiquette("Feuille " + (s + 1)));
      el.ensR.insertBefore(recto, el.depot);
      el.images.push(img);

      const verso = document.createElement("div");
      verso.className = "face face-verso";
      verso.dataset.feuille = String(s + 1);
      const grille = document.createElement("div");
      grille.className = "grille";
      grille.dataset.feuille = String(s);
      verso.appendChild(grille);
      if (n > 1) verso.appendChild(etiquette("Feuille " + (s + 1)));
      el.ensV.appendChild(verso);
      el.grilles.push(grille);
    }
    if (n > 1) [el.ensR, el.ensV].forEach((ens) => { const j = document.createElement("span"); j.className = "joint"; ens.appendChild(j); });
    const legende = $("legendeFeuilles");
    legende.hidden = n < 2;
    legende.textContent = etat.assemblage === "cote"
      ? "Les deux feuilles se collent bord à bord. Au verso, la feuille 1 (à gauche au recto) se retrouve à droite, comme une vraie feuille retournée."
      : etat.assemblage === "pile"
        ? "Les deux feuilles se collent l'une au-dessus de l'autre : la feuille 1 est en haut, au recto comme au verso."
        : "";
    $("champImpression").hidden = n < 2;
    $("indiceImpression").hidden = n < 2;
    if (n < 2) $("choixImpression").value = "toutes";
  }

  // ----- Toile : taille, réduction à l'écran, page d'impression -----
  function majFeuille() {
    const { W, H } = dimensions();
    const { CW, CH } = toile();
    const racine = document.documentElement.style;
    racine.setProperty("--W", W + "mm");
    racine.setProperty("--H", H + "mm");
    racine.setProperty("--CW", CW + "mm");
    racine.setProperty("--CH", CH + "mm");
    // La page imprimée est UNE feuille, même quand la toile en compte deux.
    el.stylePage.textContent = "@page { size: " + W + "mm " + H + "mm; margin: 0; }";

    const largeurDispo = Math.max(200, el.zone.clientWidth - 4);
    const hauteurDispo = Math.max(320, window.innerHeight - 150);
    echelle = Math.min(largeurDispo / (CW * PX_PAR_MM), hauteurDispo / (CH * PX_PAR_MM));
    el.scene.style.width = arrondi(CW * PX_PAR_MM * echelle, 2) + "px";
    el.scene.style.height = arrondi(CH * PX_PAR_MM * echelle, 2) + "px";
    el.mise.style.transform = "scale(" + echelle + ")";
    // Un trait de 0,25 mm tombe sous le pixel une fois la feuille réduite : on
    // l'épaissit à l'écran seulement (l'impression remet 0,25 mm).
    racine.setProperty("--t-ecran", arrondi(Math.max(0.25, 1.2 / (echelle * PX_PAR_MM)), 3) + "mm");

    const n = nbFeuilles();
    $("infoFeuille").textContent = FORMATS[etat.format].join(" × ") + " mm — " + (etat.paysage ? "paysage" : "portrait") +
      (n > 1 ? " — 2 feuilles collées : " + fr(CW) + " × " + fr(CH) + " mm" : "");
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

  // ----- Recto : placement de l'image sur la toile -----
  function majImage() {
    const { CW, CH } = toile();
    el.ensR.style.background = etat.fondRecto;
    el.ensR.querySelectorAll(".face-recto").forEach((f) => { f.style.background = etat.fondRecto; });
    const avec = !!etat.image;
    el.images.forEach((img) => { img.hidden = !avec; });
    el.depot.hidden = avec;
    el.ensR.classList.toggle("avec-image", avec);
    $("reglagesImage").hidden = !avec;
    $("btnRetirerImage").hidden = !avec;
    $("btnImage").textContent = avec ? "Changer d'image…" : "Choisir une image…";
    $("champFondRecto").hidden = etat.ajustement !== "ajuster";
    if (!avec) return;

    const w = etat.largeurImg, h = etat.hauteurImg;
    const base = etat.ajustement === "remplir" ? Math.max(CW / w, CH / h) : Math.min(CW / w, CH / h);   // mm par pixel
    const s = base * etat.zoom;
    const lw = w * s, lh = h * s;
    // On ne laisse pas glisser l'image hors de la toile : en mode « remplir »,
    // elle doit toujours la couvrir entièrement.
    const maxX = etat.ajustement === "remplir" ? Math.max(0, (lw - CW) / 2) : CW / 2;
    const maxY = etat.ajustement === "remplir" ? Math.max(0, (lh - CH) / 2) : CH / 2;
    etat.dx = borne(etat.dx, -maxX, maxX);
    etat.dy = borne(etat.dy, -maxY, maxY);
    // Chaque feuille porte sa propre copie de l'image, décalée de sa position sur la
    // toile : c'est ce qui permet d'imprimer les feuilles séparément. Elles
    // partagent la même adresse locale, l'image n'est donc décodée qu'une fois.
    el.images.forEach((img, i) => {
      const o = decalage(i);
      if (img.getAttribute("src") !== (urlImage || etat.image)) img.src = urlImage || etat.image;
      img.style.width = arrondi(lw, 3) + "mm";
      img.style.height = arrondi(lh, 3) + "mm";
      img.style.left = arrondi((CW - lw) / 2 + etat.dx - o.x, 3) + "mm";
      img.style.top = arrondi((CH - lh) / 2 + etat.dy - o.y, 3) + "mm";
    });

    const ppp = Math.round(25.4 / s);
    const verdict = ppp >= 250 ? "très bonne netteté" : ppp >= 150 ? "netteté correcte" : "faible : l'impression risque d'être floue";
    $("infoImage").textContent = w + " × " + h + " px — environ " + ppp + " ppp sur la toile (" + verdict + ").";
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

  // dataUrl reste dans l'état (c'est lui qu'on enregistre) ; l'affichage passe par une
  // adresse blob: locale, pour ne pas recopier une image de plusieurs Mo dans chaque <img>.
  function poserImage(dataUrl, recentrer, apres) {
    const test = new Image();
    test.onload = () => {
      const suite = (url) => {
        if (urlImage) URL.revokeObjectURL(urlImage);
        urlImage = url;
        etat.image = dataUrl;
        etat.largeurImg = test.naturalWidth;
        etat.hauteurImg = test.naturalHeight;
        if (recentrer) { etat.dx = 0; etat.dy = 0; etat.zoom = 1; }
        synchroniserControles();
        majImage();
        if (apres) apres();
      };
      fetch(dataUrl).then((r) => r.blob()).then((b) => suite(URL.createObjectURL(b))).catch(() => suite(null));
    };
    test.onerror = () => alert("Cette image ne peut pas être affichée par le navigateur.");
    test.src = dataUrl;
  }

  // Glisser l'image sur la toile pour la cadrer.
  (function () {
    let depart = null;
    el.ensR.addEventListener("pointerdown", (e) => {
      if (!etat.image || e.button > 0) return;
      depart = { x: e.clientX, y: e.clientY, dx: etat.dx, dy: etat.dy };
      el.ensR.setPointerCapture(e.pointerId);
      el.ensR.classList.add("glisse");
    });
    el.ensR.addEventListener("pointermove", (e) => {
      if (!depart) return;
      const k = echelle * PX_PAR_MM;
      etat.dx = depart.dx + (e.clientX - depart.x) / k;
      etat.dy = depart.dy + (e.clientY - depart.y) / k;
      majImage();
    });
    const fin = () => { depart = null; el.ensR.classList.remove("glisse"); };
    el.ensR.addEventListener("pointerup", fin);
    el.ensR.addEventListener("pointercancel", fin);
  })();

  // Déposer une image sur la feuille ou sur la page.
  ["dragenter", "dragover"].forEach((nom) => document.addEventListener(nom, (e) => {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1) {
      e.preventDefault();
      el.ensR.classList.add("survol");
    }
  }));
  ["dragleave", "drop"].forEach((nom) => document.addEventListener(nom, () => el.ensR.classList.remove("survol")));
  document.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    chargerImage(e.dataTransfer.files[0]);
    retourner("recto");
  });

  // ----- Verso : la grille de cartes de chaque feuille -----
  const ECRITURE_BRUTE = (function () {
    const test = document.createElement("div");
    try { test.contentEditable = "plaintext-only"; } catch (e) { /* navigateur ancien */ }
    return test.contentEditable === "plaintext-only";
  })();

  function construireGrilles() {
    const { colonnes, lignes } = etat;
    el.grilles.forEach((grille, s) => {
      grille.innerHTML = "";
      grille.style.gridTemplateColumns = "repeat(" + colonnes + ", 1fr)";
      grille.style.gridTemplateRows = "repeat(" + lignes + ", 1fr)";
      const textes = textesDe(s);
      for (let i = 0; i < colonnes * lignes; i++) {
        const carte = document.createElement("div");
        carte.className = "carte";
        const texte = document.createElement("div");
        texte.className = "texte";
        texte.contentEditable = ECRITURE_BRUTE ? "plaintext-only" : "true";
        texte.spellcheck = true;
        texte.lang = "fr";
        texte.dataset.f = String(s);
        texte.dataset.i = String(i);
        texte.setAttribute("role", "textbox");
        texte.setAttribute("aria-multiline", "true");
        texte.setAttribute("aria-label", (nbFeuilles() > 1 ? "Feuille " + (s + 1) + ", " : "") + "carte " + (i + 1));
        texte.textContent = textes[i] || "";
        texte.classList.toggle("vide", !texte.textContent);
        carte.appendChild(texte);
        grille.appendChild(carte);
      }
    });
    majStyleVerso();
    majInfosCartes();
    requestAnimationFrame(ajusterTous);
  }

  el.ensV.addEventListener("input", (e) => {
    const texte = e.target.closest(".texte");
    if (!texte) return;
    textesDe(Number(texte.dataset.f))[Number(texte.dataset.i)] = texte.innerText.replace(/\n+$/, "");
    texte.classList.toggle("vide", !texte.textContent);
    ajuster(texte);
  });
  el.ensV.addEventListener("click", (e) => {
    const carte = e.target.closest(".carte");
    if (carte && e.target === carte) carte.querySelector(".texte").focus();
  });
  // Sans « plaintext-only », Entrée crée des <div> et le collage garde la mise
  // en forme : on force le texte brut à la main.
  if (!ECRITURE_BRUTE) {
    el.ensV.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.classList.contains("texte")) {
        e.preventDefault();
        document.execCommand("insertText", false, "\n");
      }
    });
    el.ensV.addEventListener("paste", (e) => {
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
    el.ensV.querySelectorAll(".texte").forEach(ajuster);
  }

  function majStyleVerso() {
    const p = POLICES[etat.police] || POLICES.garamond;
    const f = el.ensV.style;
    f.setProperty("--fond-verso", etat.fondVerso);
    f.setProperty("--police-texte", p.famille);
    f.setProperty("--style-texte", p.style);
    f.setProperty("--couleur-texte", etat.couleur);
    f.setProperty("--trait", etat.traits ? "#cfcfcf" : "transparent");
    f.setProperty("--marge", etat.marge + "mm");
  }

  function majInfosCartes() {
    const { W, H } = dimensions();
    const par = etat.colonnes * etat.lignes;
    const n = par * nbFeuilles();
    const l = (W - 2 * etat.marge) / etat.colonnes, h = (H - 2 * etat.marge) / etat.lignes;
    $("infoCartes").textContent = (nbFeuilles() > 1 ? n + " cartes (" + par + " par feuille)" : n + (n > 1 ? " cartes" : " carte")) +
      " de " + fr(l) + " × " + fr(h) + " mm";
    document.querySelectorAll("#modeles .puce").forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.c) === etat.colonnes && Number(b.dataset.l) === etat.lignes));
    });
  }

  // Une ligne par carte, dans l'ordre de lecture : la feuille 1, puis la feuille 2.
  function repartirListe() {
    const lignes = $("listeMessages").value.replace(/\r/g, "").split("\n");
    while (lignes.length && lignes[lignes.length - 1].trim() === "") lignes.pop();
    const par = etat.colonnes * etat.lignes;
    const n = par * nbFeuilles();
    if (lignes.length > n && !confirm("La liste compte " + lignes.length + " messages pour " + n + " cartes : les " + (lignes.length - n) + " derniers seront ignorés. Continuer ?")) return;
    for (let i = 0; i < n; i++) textesDe(Math.floor(i / par))[i % par] = (lignes[i] || "").trim();
    construireGrilles();
  }

  // ----- Retourner la feuille -----
  function retourner(face) {
    etat.face = face === "verso" || face === "recto" ? face : (etat.face === "recto" ? "verso" : "recto");
    el.retourne.classList.toggle("verso", etat.face === "verso");
    // La face cachée ne doit pas non plus recevoir le clavier.
    el.ensR.inert = etat.face === "verso";
    el.ensV.inert = etat.face === "recto";
    document.querySelectorAll("#segFace button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valeur === etat.face)));
  }

  // ----- Impression -----
  // Au moment d'imprimer, on pose dans #zoneImpression une copie de chaque face, dans
  // l'ordre d'une impression recto-verso : recto 1, verso 1, recto 2, verso 2. Les deux
  // côtés de la toile n'ont pas cet ordre à l'écran (un ensemble recto, un ensemble
  // verso), et une mise en page en grille ou en flex pour les réordonner coupe mal les
  // pages selon le navigateur : des blocs ordinaires, l'un après l'autre, ne risquent rien.
  function copieFace(face, ensemble) {
    const c = face.cloneNode(true);
    c.removeAttribute("aria-label");
    c.querySelectorAll(".etiquette-feuille").forEach((x) => x.remove());
    c.querySelectorAll(".texte").forEach((t) => {
      t.removeAttribute("contenteditable");
      t.removeAttribute("role");
      t.removeAttribute("aria-label");
      t.classList.remove("vide", "trop-long");
    });
    // Les variables (police, couleurs, marge…) sont posées sur l'ensemble : la copie les reprend.
    const enveloppe = document.createElement("div");
    enveloppe.className = "copie";
    enveloppe.style.cssText = ensemble.style.cssText;
    enveloppe.appendChild(c);
    return enveloppe;
  }

  let impressionPrete = false;
  function preparerImpression() {
    el.impression.innerHTML = "";
    const choix = $("choixImpression").value;
    const rectos = el.ensR.querySelectorAll(".face-recto"), versos = el.ensV.querySelectorAll(".face-verso");
    for (let s = 0; s < nbFeuilles(); s++) {
      if (choix !== "toutes" && Number(choix) !== s + 1) continue;
      el.impression.appendChild(copieFace(rectos[s], el.ensR));
      el.impression.appendChild(copieFace(versos[s], el.ensV));
    }
    impressionPrete = true;
  }
  function finImpression() {
    el.impression.innerHTML = "";
    impressionPrete = false;
  }
  window.addEventListener("beforeprint", () => { if (!impressionPrete) preparerImpression(); });
  window.addEventListener("afterprint", finImpression);

  function imprimer() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    preparerImpression();
    // On attend que les images copiées soient décodées : sans cela, l'aperçu
    // d'impression pourrait s'ouvrir avant elles et montrer un recto vide.
    const attentes = Array.prototype.map.call(el.impression.querySelectorAll("img"), (i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()));
    Promise.all(attentes).then(() => window.print());
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
      const messages = (v) => (Array.isArray(v) ? v.slice(0, 144).map((t) => (typeof t === "string" ? t.slice(0, 2000) : "")) : []);
      etat.format = FORMATS[p.format] ? p.format : "A4";
      etat.paysage = p.paysage === true;
      etat.assemblage = ASSEMBLAGES[p.assemblage] ? p.assemblage : "seule";   // un projet d'avant les deux feuilles n'en a pas
      etat.ajustement = p.ajustement === "ajuster" ? "ajuster" : "remplir";
      etat.zoom = nombre(p.zoom, 1, 4, 1);
      etat.dx = nombre(p.dx, -2000, 2000, 0);
      etat.dy = nombre(p.dy, -2000, 2000, 0);
      etat.fondRecto = couleur(p.fondRecto, "#ffffff");
      etat.colonnes = Math.round(nombre(p.colonnes, 1, 12, 3));
      etat.lignes = Math.round(nombre(p.lignes, 1, 12, 5));
      etat.marge = nombre(p.marge, 0, 30, 0);
      etat.traits = p.traits !== false;
      etat.police = POLICES[p.police] ? p.police : "garamond";
      etat.taille = nombre(p.taille, 6, 48, 16);
      etat.couleur = couleur(p.couleur, "#241d15");
      etat.fondVerso = couleur(p.fondVerso, "#ffffff");
      etat.textes = messages(p.textes);
      etat.textes2 = messages(p.textes2);
      const fin = () => { construireStructure(); synchroniserControles(); majFeuille(); construireGrilles(); majImage(); };
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
    marquer("segAssemblage", etat.assemblage);
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

  lierSegment("segFormat", (v) => { etat.format = v; synchroniserControles(); majFeuille(); construireGrilles(); });
  lierSegment("segOrientation", (v) => { etat.paysage = v === "paysage"; synchroniserControles(); majFeuille(); construireGrilles(); });
  lierSegment("segAssemblage", (v) => {
    etat.assemblage = v;
    etat.dx = 0; etat.dy = 0;               // la toile change de taille : on recadre
    construireStructure();
    synchroniserControles();
    majFeuille();
    construireGrilles();
  });
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
    if (urlImage) { URL.revokeObjectURL(urlImage); urlImage = null; }
    el.images.forEach((img) => img.removeAttribute("src"));
    synchroniserControles(); majImage();
  });
  $("btnRecentrer").addEventListener("click", () => { etat.dx = 0; etat.dy = 0; etat.zoom = 1; synchroniserControles(); majImage(); });
  $("curseurZoom").addEventListener("input", (e) => { etat.zoom = Number(e.target.value) / 100; $("valZoom").textContent = e.target.value + " %"; majImage(); });
  $("fondRecto").addEventListener("input", (e) => { etat.fondRecto = e.target.value; majImage(); });

  function changerGrille() {
    etat.colonnes = Math.round(borne(Number($("colonnes").value) || 1, 1, 12));
    etat.lignes = Math.round(borne(Number($("lignes").value) || 1, 1, 12));
    construireGrilles();
  }
  $("colonnes").addEventListener("input", changerGrille);
  $("lignes").addEventListener("input", changerGrille);
  $("colonnes").addEventListener("change", () => { $("colonnes").value = etat.colonnes; });
  $("lignes").addEventListener("change", () => { $("lignes").value = etat.lignes; });
  MODELES.forEach(([c, l]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "puce"; b.dataset.c = c; b.dataset.l = l;
    b.textContent = c + " × " + l + " (" + c * l + ")";
    b.addEventListener("click", () => { etat.colonnes = c; etat.lignes = l; synchroniserControles(); construireGrilles(); });
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
    if ((etat.textes.some(Boolean) || etat.textes2.some(Boolean)) && !confirm("Vider le texte de toutes les cartes ?")) return;
    etat.textes = [];
    etat.textes2 = [];
    construireGrilles();
  });

  $("btnImprimer").addEventListener("click", imprimer);
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

  construireStructure();
  synchroniserControles();
  majFeuille();
  construireGrilles();
  retourner("recto");
  chargerPolices().then(ajusterTous);
})();
