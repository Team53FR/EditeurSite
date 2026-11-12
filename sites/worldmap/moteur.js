// Moteur de rendu de WorldMap.
//
// Une carte est faite d'objets VECTORIELS (traits de pinceau, lignes,
// étiquettes, lieux) exprimés en unités du monde — des kilomètres. Rien n'est
// une image figée : la carte se redessine à n'importe quel niveau de zoom, ce
// qui rend le zoom « infini » possible. On peut donc peindre un continent au
// gros pinceau, puis zoomer sur une vallée et y poser quelques arbres.
//
// `dessiner(cible, carte, vue, options)` est une fonction pure : elle sert à
// l'écran, à la vignette de la galerie et à l'export PNG, avec la même image.
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var POLICE = "'EB Garamond', Georgia, serif";
  var PAPIER = "#f4ecd6";

  // ----- Hasard stable -----
  // Un décor (arbres, montagnes) ne doit pas changer d'aspect quand on zoome ou
  // qu'on se déplace : chaque élément tire son hasard de (graine du trait, rang).
  function alea(a, b) {
    var h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ----- Thèmes : la palette générale de la carte -----
  var THEMES = {
    atlas: {
      nom: "Atlas", mer: "#3f7a9c", mer2: "#336a8a", glow: "rgba(160,214,232,0.62)",
      encre: "#1f2a33", hors: "#10151a", halo: "rgba(240,246,248,0.78)", teinte: null,
      riviere: "#2f77a6", route: "#7a5230", texteMer: "#1d4a68", lacClair: "#6fb3e0", lacFonce: "#2f6fa6",
      grille: "rgba(255,255,255,0.22)", cadre: "#0b0f13"
    },
    parchemin: {
      nom: "Parchemin", mer: "#dac79d", mer2: "#cdb98c", glow: "rgba(238,226,192,0.85)",
      encre: "#3a2a1a", hors: "#1d1710", halo: "rgba(243,230,196,0.82)", teinte: "rgba(226,190,124,0.42)",
      riviere: "#587f8f", route: "#5a3d22", texteMer: "#566b6b", lacClair: "#9ab9c0", lacFonce: "#587f8f", eauDouce: "#7f9fa6",
      grille: "rgba(58,42,26,0.22)", cadre: "#2a1d10"
    },
    // Le style des cartes illustrées : la « mer » est le parchemin lui-même, le
    // bleu ne vit qu'autour des côtes ; la terre a une falaise, un cadre orné.
    illustre: {
      // La mer : un bleu-gris de vieille carte au large (on voit bien que c'est de l'eau), un
      // bleu franc le long des côtes — le même que l'eau des rivières, pour qu'elles s'y
      // jettent sans frontière.
      nom: "Illustré", mer: "#a9bec0", mer2: "#91aab3",
      glow: "rgba(36,112,200,0.95)", glowPx: 64, glowDouble: true,
      encre: "#2a1c0e", hors: "#1d1710", halo: "rgba(246,234,204,0.88)", teinte: "rgba(235,200,130,0.26)",
      riviere: "#2f86d6", route: "#6b4a2b", texteMer: "#2c5d91", lacClair: "#4f9fe0", lacFonce: "#1f6cc2", eauDouce: "#2f7cc9",
      grille: "rgba(58,42,26,0.25)", cadre: "#3a2a14",
      falaise: "#3a2a14", papier: true, orne: true, lieuxIllustres: true,
      vagues: [{ r: 10, a: 0.5 }, { r: 22, a: 0.28 }], vagueCouleur: "rgb(16,64,140)"
    }
  };

  // Le style des cartes enluminées, peintes comme une illustration : la terre est un plateau
  // (falaise épaisse, ombre le long des côtes), ses couleurs sont plus denses, les décors
  // sont cernés d'encre et un peu plus grands, la mer est le parchemin et le bleu ne tient
  // qu'en une bande le long des rivages.
  THEMES.enlumine = {
    nom: "Enluminé", mer: "#e6cd92", mer2: "#dcbf7e",
    glow: "rgba(30,118,222,0.96)", glowPx: 92, glowDouble: true, glowTriple: true,
    encre: "#22160a", hors: "#1d1710", halo: "rgba(248,236,204,0.9)", teinte: "rgba(236,196,120,0.2)",
    riviere: "#2f86d6", route: "#6b4a2b", texteMer: "#2a5a94", lacClair: "#58a8ea", lacFonce: "#1f6cc2", eauDouce: "#3186da",
    grille: "rgba(58,42,26,0.25)", cadre: "#3a2a14",
    falaise: "#3b2812", falaisePx: 13, ombreCote: "rgba(34,24,4,0.6)",
    papier: true, orne: true, orneRiche: true, lieuxIllustres: true,
    encreDecors: true, echDecors: 1.22,
    glowMin: 44, vagues: [{ r: 8, a: 0.42 }], vagueCouleur: "rgb(12,58,140)",
    couleurs: {
      plaine: "#8ea343", foret: "#47752b", taiga: "#3c6a45", colline: "#98a04a", montagne: "#8f8878", cime: "#cdd3d6",
      volcan: "#b58a4f", desert: "#d8b670", steppe: "#b8a658", marais: "#5c784c", cendres: "#a8804a", champs: "#a6ae4a",
      savane: "#c1ab55", automne: "#9a7833", jungle: "#326b31", morte: "#7b6f56", rocaille: "#9b917b", plage: "#e5cf98", toundra: "#989e7a",
      ville: "#bfa878", faubourg: "#a9a866"
    }
  };

  // Le plan vu du dessus, comme un plan de village dessiné : terre verte à plat, eau
  // turquoise et ses lignes de rivage, arbres en touffes rondes, toits vus d'en haut (et
  // orientés), champs bruns à sillons séparés par des bandes d'herbe, chemins clairs.
  THEMES.plan = {
    nom: "Plan (vue du dessus)", mer: "#5f9ca8", mer2: "#2f6277",
    glow: "rgba(150,208,212,0.6)", glowPx: 44, glowMin: 24,
    encre: "#1c2622", hors: "#12181a", halo: "rgba(240,246,236,0.88)", teinte: null,
    riviere: "#4f93a3", route: "#e6dfc4", texteMer: "#0f3340", lacClair: "#74b3bf", lacFonce: "#3f7f92",
    grille: "rgba(20,40,40,0.25)", cadre: "#10181a",
    lieuxIllustres: true, encreDecors: true, dessus: true, echDecors: 1.15,
    voie: "#e6dfc4", rive: { c: "#d9d1a8", px: 4.5 },
    vagues: [{ r: 10, a: 0.62 }, { r: 21, a: 0.34 }], vagueCouleur: "rgb(228,246,246)",
    champsPx: 75,                         // parcelles de champ larges, comme sur un plan de village
    cultures: [[146, 117, 106], [156, 124, 110], [136, 110, 102], [150, 126, 116]],
    sansDecor: { herbe: true, seche: true },
    couleurs: {
      plaine: "#9cc584", foret: "#8fbd7c", taiga: "#86b07c", colline: "#a8c784", montagne: "#a9a898", cime: "#d6dcd8",
      volcan: "#9a8672", desert: "#dccf9c", steppe: "#bccb8a", marais: "#7fa98c", cendres: "#8f8478", champs: "#9cc584",
      savane: "#c3cc8c", automne: "#a9bd7c", jungle: "#7fb074", morte: "#a3ad8c", rocaille: "#b3b3a0", plage: "#e2d9b0", toundra: "#b0bfa0",
      ville: "#a4cb8c", faubourg: "#a0c888", glace: "#e9f1f0"
    }
  };

  // ----- Matériaux : ce qu'on peut peindre -----
  // « terre » colore ; « eau » creuse la terre déjà peinte (mers, lacs, gomme).
  // `groupe` range la palette de l'éditeur ; `decor` renvoie à la table DECORS.
  // L'ORDRE COMPTE : le rang d'un matériau est son code dans le masque (et 25 au plus).
  var MATERIAUX = [
    { id: "plaine",   nom: "Plaine",          couleur: "#9bb96a", decor: "herbe",    type: "terre", groupe: "Plaines" },
    { id: "foret",    nom: "Forêt",           couleur: "#5f9148", decor: "foret",    type: "terre", groupe: "Forêts" },
    { id: "taiga",    nom: "Taïga",           couleur: "#4f7f5c", decor: "taiga",    type: "terre", groupe: "Forêts" },
    { id: "colline",  nom: "Collines",        couleur: "#b6b46c", decor: null,       type: "terre", groupe: "Reliefs", retire: true },
    { id: "montagne", nom: "Montagnes",       couleur: "#9a9486", decor: "montagne", type: "terre", groupe: "Reliefs" },
    { id: "cime",     nom: "Cimes neigeuses", couleur: "#d6dde0", decor: "cime",     type: "terre", groupe: "Reliefs" },
    { id: "volcan",   nom: "Volcan",          couleur: "#8a6b49", decor: "volcan",   type: "terre", groupe: "Reliefs" },
    { id: "desert",   nom: "Désert",          couleur: "#e0c887", decor: "seche",    type: "terre", groupe: "Terres arides" },
    { id: "steppe",   nom: "Steppe",          couleur: "#c9b872", decor: "seche",    type: "terre", groupe: "Plaines" },
    { id: "marais",   nom: "Marais",          couleur: "#6f8a66", decor: "marais",   type: "terre", groupe: "Eaux et froid" },
    { id: "glace",    nom: "Glace",           couleur: "#eef4f6", decor: "glace",    type: "terre", groupe: "Eaux et froid" },
    { id: "cendres",  nom: "Terres brûlées",  couleur: "#7d6a5a", decor: "cendres",  type: "terre", groupe: "Terres arides" },
    { id: "eau",      nom: "Eau (creuser)",   couleur: "#4a8bb0", decor: null,       type: "eau",   groupe: "Eaux et froid" },
    { id: "champs",   nom: "Champs",          couleur: "#b7c06a", decor: "champs",   type: "terre", groupe: "Plaines" },
    { id: "savane",   nom: "Savane",          couleur: "#cdbf6e", decor: "savane",   type: "terre", groupe: "Plaines" },
    { id: "automne",  nom: "Forêt d'automne", couleur: "#a98a45", decor: "automne",  type: "terre", groupe: "Forêts" },
    { id: "jungle",   nom: "Jungle",          couleur: "#3f7f3e", decor: "jungle",   type: "terre", groupe: "Forêts" },
    { id: "morte",    nom: "Forêt morte",     couleur: "#857a62", decor: "morte",    type: "terre", groupe: "Forêts" },
    { id: "rocaille", nom: "Rocaille",        couleur: "#a89f8c", decor: "rocaille", type: "terre", groupe: "Reliefs" },
    { id: "plage",    nom: "Sable",           couleur: "#ecdcab", decor: null,       type: "terre", groupe: "Terres arides" },
    { id: "toundra",  nom: "Toundra",         couleur: "#a9ad8c", decor: "toundra",  type: "terre", groupe: "Eaux et froid" },
    { id: "ville",    nom: "Ville (quartiers)", couleur: "#c4b08a", decor: "ville",  type: "terre", groupe: "Bâti" },
    { id: "faubourg", nom: "Faubourg",        couleur: "#b3b077", decor: "faubourg", type: "terre", groupe: "Bâti" }
  ];
  var MAT = {};
  MATERIAUX.forEach(function (m, i) { MAT[m.id] = m; m.code = i + 1; });
  var GROUPES_MATERIAUX = ["Plaines", "Forêts", "Reliefs", "Terres arides", "Eaux et froid", "Bâti"];

  // ----- Décors : peints une fois, semés ensuite -----
  //
  // Chaque décor (arbre, conifère, pic, rocher…) est PEINTÉ une seule fois dans un
  // petit canvas — dégradés, ombre au sol, touches de lumière, aucun contour de dessin
  // animé — puis simplement collé des centaines de fois. C'est plus beau, et bien plus
  // rapide que de retracer chaque arbre à chaque image. Quatre définitions (64, 128, 256
  // et 512 px) suivent le zoom, pour que rien ne devienne flou en s'approchant.
  var SPRITES = {};
  // Réglages du thème pendant le rendu en cours : couleurs des terrains, décors cernés d'encre,
  // taille des décors.
  var COULEURS = null, ENCRE_DECORS = false, ECH_THEME = 1, SANS_OMBRE = false, DESSUS = false, SANS_DECOR = null, CULTURES_THEME = null, CHAMPS_PX = 0;
  var ZPX = 1;   // pixels de l'appareil par unité du monde, pendant le rendu en cours

  function tailleSprite(px) { return px <= 64 ? 64 : px <= 128 ? 128 : px <= 256 ? 256 : px <= 512 ? 512 : 1024; }

  function spriteCanvas(type, v, S) {
    var dessus = DESSUS && PEINTRES_DESSUS[type];
    var cle = type + "|" + v + "|" + S + (dessus ? "|d" : ENCRE_DECORS ? "|e" : "");
    if (SPRITES[cle]) return SPRITES[cle];
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    g.scale(S / 100, S / 100);          // une boîte de 100 × 100 centrée ; le sol est vers y = +31
    g.lineJoin = g.lineCap = "round";
    // Vu du dessus : le décor a son propre dessin (et son propre cerne).
    if (dessus) { dessus(g, v); SPRITES[cle] = c; return c; }
    if (!ENCRE_DECORS) { PEINTRES[type](g, v); SPRITES[cle] = c; return c; }
    // Décor enluminé : couleurs assombries, puis cerné d'encre (sa silhouette, décalée dans
    // huit directions, glissée dessous). Pas d'ombre au sol : le cerne en tient lieu.
    SANS_OMBRE = true;
    PEINTRES[type](g, v);
    SANS_OMBRE = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(46,34,0,0.16)";
    g.fillRect(0, 0, S, S);
    var sil = document.createElement("canvas");
    sil.width = sil.height = S;
    var sg = sil.getContext("2d");
    sg.drawImage(c, 0, 0);
    sg.globalCompositeOperation = "source-in";
    sg.fillStyle = "#1c1206";
    sg.fillRect(0, 0, S, S);
    var fin = document.createElement("canvas");
    fin.width = fin.height = S;
    var fg = fin.getContext("2d"), e = Math.max(0.7, S * 0.011);
    fg.globalAlpha = type === "herbe" || type === "seche" ? 0.25 : 0.7;
    for (var k = 0; k < 8; k++) fg.drawImage(sil, Math.cos(k * Math.PI / 4) * e, Math.sin(k * Math.PI / 4) * e);
    fg.globalAlpha = 1;
    fg.drawImage(c, 0, 0);
    SPRITES[cle] = fin;
    return fin;
  }

  function ombreDecor(g, cx, cy, rx, ry, a) {
    if (SANS_OMBRE) return;
    g.fillStyle = "rgba(14,26,10," + a + ")";
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
  }

  var FEUILLAGES = {
    vert: [["#a8cc5c", "#548f39", "#27552b"], ["#b4cf62", "#5f9c3b", "#2f5e2c"], ["#8fb74f", "#498638", "#224a2c"],
           ["#c0d46c", "#68a23f", "#376531"], ["#9abf56", "#4f8e3c", "#26522c"]],
    automne: [["#f2c15a", "#d98a2b", "#8a4a1c"], ["#f0a24a", "#c9602a", "#7a2f1a"], ["#f4d66a", "#d9a02e", "#8e5a1c"],
              ["#e98a4a", "#b8442a", "#6e2418"], ["#e6c860", "#b98f2e", "#6f561c"]],
    jungle: [["#7fc45a", "#2f7f3a", "#12401f"], ["#6fb85a", "#27743a", "#0f3a22"], ["#8fcf5f", "#3a8a3a", "#17472a"],
             ["#62ad5c", "#226a3c", "#0d3320"], ["#9ad06a", "#3f8f42", "#1a4a26"]]
  };
  function peintArbre(g, v, famille) {
    var R = function (i) { return alea(500 + v, i); };
    var T = FEUILLAGES[famille || "vert"][v % 5];
    ombreDecor(g, 7, 29, 31, 8, 0.4);
    g.fillStyle = "#4b3623";
    g.beginPath(); g.moveTo(-3.6, 31); g.lineTo(-2.2, 4); g.lineTo(2.2, 4); g.lineTo(3.6, 31); g.closePath(); g.fill();
    [[-17, 3, 23], [17, 1, 22], [-9, 15, 20], [11, 14, 19], [0, -19, 26], [0, -3, 25]].forEach(function (b, i) {
      var cx = b[0] + (R(i) - 0.5) * 6, cy = b[1] + (R(i + 9) - 0.5) * 6, r = b[2] * (0.9 + R(i + 18) * 0.2);
      var gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.38, r * 0.1, cx, cy, r);
      gr.addColorStop(0, T[0]); gr.addColorStop(0.55, T[1]); gr.addColorStop(1, T[2]);
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    });
    for (var i = 0; i < 30; i++) {          // le feuillage : des touches claires et sombres
      var a = R(40 + i) * TAU, d = Math.sqrt(R(80 + i)) * 31;
      g.fillStyle = i % 3 ? (famille === "automne" ? "rgba(255,236,150,0.3)" : "rgba(218,240,132,0.3)") : "rgba(10,38,14,0.3)";
      g.beginPath(); g.ellipse(Math.cos(a) * d, -5 + Math.sin(a) * d * 0.85, 3.3, 2.2, R(120 + i) * 3, 0, TAU); g.fill();
    }
  }

  function peintConifere(g, v) {
    var R = function (i) { return alea(600 + v, i); };
    ombreDecor(g, 6, 29, 26, 7, 0.4);
    g.fillStyle = "#44301f"; g.fillRect(-2.6, 20, 5.2, 11);
    for (var k = 0; k < 4; k++) {
      var y0 = 27 - k * 16.5, w = 29 - k * 6 + (R(k) - 0.5) * 3, h = 25;
      var gr = g.createLinearGradient(-w, 0, w, 0);
      gr.addColorStop(0, "#63a06a"); gr.addColorStop(0.5, "#2f6a42"); gr.addColorStop(1, "#173c29");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, y0 - h);
      g.lineTo(w, y0 - 1.5);
      for (var j = 4; j >= 0; j--) g.lineTo(-w + (2 * w) * j / 4, y0 + (j % 2 ? 2.5 : -1.5));
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(190,230,170,0.22)"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, y0 - h + 2); g.lineTo(-w * 0.78, y0 - 3); g.stroke();
    }
  }

  // Une arête, pas un cône : deux ou trois sommets d'inégale hauteur, une silhouette
  // irrégulière, la face au soleil (à gauche) claire et l'autre dans l'ombre, des ravines,
  // et une neige qui suit le relief au lieu d'un chapeau posé dessus.
  function peintMontagne(g, v, neige) {
    var R = function (i) { return alea(700 + v + (neige ? 50 : 0), i); };
    var base = 31, W = 46, i;
    var nb = 2 + Math.floor(R(1) * 2);
    var sommets = [];
    for (i = 0; i < nb; i++) {
      if (i === 0) sommets.push({ x: (R(2) - 0.5) * 10, h: 60 + R(4) * 14, w: 30 + R(6) * 8 });
      else sommets.push({ x: (i % 2 ? -1 : 1) * (15 + R(3 + i) * 12), h: 30 + R(5 + i) * 18, w: 17 + R(7 + i) * 8 });
    }
    var N = 46, prof = [];
    for (i = 0; i <= N; i++) {
      var x = -W + 2 * W * i / N, h = 0;
      sommets.forEach(function (s) {
        var hh = s.h * Math.max(0, 1 - Math.pow(Math.abs(x - s.x) / s.w, 1.15));
        if (hh > h) h = hh;
      });
      if (h > 0) h += (R(20 + i) - 0.5) * 3.4 * Math.min(1, h / 12);
      prof.push([x, base - Math.max(0, h)]);
    }
    var silhouette = function () {
      g.beginPath();
      g.moveTo(-W, base);
      prof.forEach(function (p) { g.lineTo(p[0], p[1]); });
      g.lineTo(W, base);
      g.closePath();
    };
    ombreDecor(g, 8, 30, 46, 8, 0.28);
    var gr = g.createLinearGradient(-W, -40, W, 30);
    gr.addColorStop(0, "#d3ccb8"); gr.addColorStop(0.55, "#a39a85"); gr.addColorStop(1, "#6a6252");
    silhouette(); g.fillStyle = gr; g.fill();
    g.save();
    silhouette(); g.clip();
    sommets.forEach(function (s) {
      g.fillStyle = "rgba(34,28,20,0.3)";                      // le versant à l'ombre
      g.beginPath(); g.moveTo(s.x, base - s.h - 2); g.lineTo(s.x + s.w * 1.05, base); g.lineTo(s.x + s.w * 0.08, base); g.closePath(); g.fill();
      g.strokeStyle = "rgba(255,250,235,0.35)"; g.lineWidth = 1.2; // l'arête éclairée
      g.beginPath(); g.moveTo(s.x, base - s.h); g.lineTo(s.x + s.w * 0.08, base - s.h * 0.35); g.stroke();
    });
    g.strokeStyle = "rgba(40,34,26,0.28)"; g.lineWidth = 1;     // les ravines
    g.beginPath();
    for (i = 0; i < 10; i++) {
      var s0 = sommets[i % nb], x1 = s0.x + (R(60 + i) - 0.5) * s0.w * 0.6, y1 = base - s0.h * (0.5 + R(70 + i) * 0.3);
      g.moveTo(x1, y1);
      g.quadraticCurveTo(x1 + (R(80 + i) - 0.5) * 6, (y1 + base) / 2, x1 + (R(90 + i) - 0.3) * 14, base - 2);
    }
    g.stroke();
    // Les facettes : de chaque sommet descendent des pans de roche, tour à tour clairs et
    // sombres — le massif a du volume, pas seulement deux versants.
    sommets.forEach(function (s0, q) {
      var nf = 5;
      for (var f = 0; f < nf; f++) {
        var a0 = -1 + 2 * f / nf, a1 = -1 + 2 * (f + 1) / nf, hm = s0.h * (0.35 + R(110 + q * 9 + f) * 0.3);
        g.fillStyle = f % 2 ? "rgba(26,20,12,0.2)" : "rgba(255,250,236,0.16)";
        g.beginPath();
        g.moveTo(s0.x, base - s0.h);
        g.lineTo(s0.x + a0 * s0.w * 0.95, base);
        g.lineTo(s0.x + (a0 + a1) / 2 * s0.w * 0.7, base - hm);
        g.lineTo(s0.x + a1 * s0.w * 0.95, base);
        g.closePath(); g.fill();
      }
    });
    var limite = neige ? 0.42 : 0.7;                             // au-dessus de cette fraction, il neige
    sommets.forEach(function (s, k) {
      if (!neige && k > 0 && s.h < 44) return;                  // les petits sommets restent nus
      var hNeige = s.h * limite;
      var haut = prof.filter(function (p) { return base - p[1] > hNeige && Math.abs(p[0] - s.x) < s.w; });
      if (haut.length < 2) return;
      var gn = g.createLinearGradient(s.x - s.w * 0.5, base - s.h, s.x + s.w * 0.6, base - hNeige);
      gn.addColorStop(0, "#ffffff"); gn.addColorStop(1, "#c3d2df");
      g.fillStyle = gn;
      g.beginPath();
      g.moveTo(haut[0][0], haut[0][1]);
      haut.forEach(function (p) { g.lineTo(p[0], p[1]); });
      var xd = haut[haut.length - 1][0], xg = haut[0][0];
      for (var j = 1; j < 7; j++) g.lineTo(xd + (xg - xd) * j / 7, base - hNeige + (j % 2 ? 3 + R(100 + j + k * 10) * 5 : -1));
      g.closePath();
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = "rgba(86,116,146,0.3)";                      // l'ombre sur la neige
      g.beginPath(); g.moveTo(s.x, base - s.h - 2); g.lineTo(s.x + s.w, base); g.lineTo(s.x + s.w * 0.08, base); g.closePath(); g.fill();
      g.restore();
    });
    g.restore();
    silhouette(); g.strokeStyle = "rgba(46,40,30,0.42)"; g.lineWidth = 1; g.stroke();
  }

  function peintMarais(g, v) {
    var R = function (i) { return alea(1000 + v, i); };
    g.fillStyle = "rgba(30,66,68,0.55)";
    g.beginPath(); g.ellipse(0, 24, 36, 10, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(130,180,170,0.35)";
    g.beginPath(); g.ellipse(-6, 22, 22, 5, 0, 0, TAU); g.fill();
    for (var i = 0; i < 9; i++) {
      var x = (R(i) - 0.5) * 56, h = 14 + R(10 + i) * 16, c = (R(20 + i) - 0.5) * 9;
      g.strokeStyle = i % 2 ? "#3d5c35" : "#6d8c4f"; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(x, 28); g.quadraticCurveTo(x + c, 28 - h * 0.55, x + c * 1.6, 28 - h); g.stroke();
      if (i % 3 === 0) { g.fillStyle = "#5b3f26"; g.beginPath(); g.ellipse(x + c * 1.6, 28 - h - 2, 1.8, 4, 0, 0, TAU); g.fill(); }
    }
  }

  function peintHerbe(g, v, seche) {
    var R = function (i) { return alea(1100 + v, i); };
    // Une touffe qui remplit sa case : à 13 px, ce sont encore des brins et non une tache.
    for (var i = 0; i < 5; i++) {
      var x = (R(i) - 0.5) * 50, h = 22 + R(10 + i) * 24, c = (R(20 + i) - 0.5) * 26;
      g.strokeStyle = seche ? (i % 2 ? "rgba(140,112,48,0.85)" : "rgba(196,170,92,0.85)") : (i % 2 ? "rgba(76,118,46,0.85)" : "rgba(132,170,76,0.8)");
      g.lineWidth = 4.2;
      g.beginPath(); g.moveTo(x, 30); g.quadraticCurveTo(x + c * 0.4, 30 - h * 0.6, x + c, 30 - h); g.stroke();
    }
  }

  function peintPalmier(g, v) {
    var R = function (i) { return alea(1200 + v, i); };
    ombreDecor(g, 8, 30, 24, 6, 0.36);
    var penche = (R(1) - 0.5) * 16, hx = penche, hy = -22 - R(2) * 8;
    g.strokeStyle = "#6b4a2a"; g.lineWidth = 4.2;
    g.beginPath(); g.moveTo(0, 31); g.quadraticCurveTo(penche * 0.2, 6, hx, hy); g.stroke();
    g.strokeStyle = "rgba(255,230,180,0.25)"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-1, 30); g.quadraticCurveTo(penche * 0.2 - 1, 6, hx - 1, hy); g.stroke();
    for (var i = 0; i < 9; i++) {
      var a = -Math.PI * (0.02 + 0.96 * i / 8) + (R(10 + i) - 0.5) * 0.25, L = 25 + R(20 + i) * 9;
      var ex = hx + Math.cos(a) * L, ey = hy + Math.sin(a) * L * 0.62 + 11;
      var mx = hx + Math.cos(a) * L * 0.55, my = hy + Math.sin(a) * L * 0.75 - 5;
      g.strokeStyle = i % 2 ? "#2f7a34" : "#4f9f3f"; g.lineWidth = 4.4;
      g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
      g.strokeStyle = "rgba(190,236,140,0.4)"; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(hx, hy - 1); g.quadraticCurveTo(mx, my - 1.5, ex, ey - 1); g.stroke();
    }
    g.fillStyle = "#5a3a1c";
    g.beginPath(); g.arc(hx - 2, hy + 3, 2.4, 0, TAU); g.arc(hx + 2.5, hy + 3.5, 2.2, 0, TAU); g.fill();
  }

  // L'acacia des savanes : un tronc fin, une couronne plate et large.
  function peintAcacia(g, v) {
    var R = function (i) { return alea(1300 + v, i); };
    ombreDecor(g, 8, 30, 34, 6, 0.3);
    g.strokeStyle = "#5a4026"; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(0, 31); g.quadraticCurveTo(2, 14, -1, 0); g.moveTo(0, 12); g.quadraticCurveTo(10, 4, 16, -2);
    g.moveTo(0, 9); g.quadraticCurveTo(-9, 3, -17, -1); g.stroke();
    [[-20, -5, 17, 7], [18, -6, 18, 7], [0, -11, 24, 9], [-8, -2, 14, 6], [9, -2, 14, 6]].forEach(function (b, i) {
      var gr = g.createLinearGradient(0, b[1] - b[3], 0, b[1] + b[3]);
      gr.addColorStop(0, i % 2 ? "#a9b85a" : "#b9c468"); gr.addColorStop(1, "#56702f");
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(b[0] + (R(i) - 0.5) * 4, b[1], b[2], b[3], 0, 0, TAU); g.fill();
    });
  }

  function peintMort(g, v) {
    var R = function (i) { return alea(1400 + v, i); };
    ombreDecor(g, 6, 30, 18, 5, 0.3);
    g.strokeStyle = "#4a4036"; g.lineCap = "round";
    var branche = function (x, y, a, L, w, n) {
      var ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      if (n <= 0) return;
      branche(ex, ey, a - 0.45 - R(n * 7 + 1) * 0.4, L * 0.62, w * 0.62, n - 1);
      branche(ex, ey, a + 0.4 + R(n * 7 + 2) * 0.4, L * 0.58, w * 0.62, n - 1);
    };
    branche(0, 31, -Math.PI / 2 + (R(1) - 0.5) * 0.3, 24, 4.4, 3);
    g.strokeStyle = "rgba(210,200,180,0.35)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-1.2, 30); g.lineTo(-1.2, 10); g.stroke();
  }

  function peintRocher(g, v, sombre) {
    var R = function (i) { return alea(1500 + v, i); };
    ombreDecor(g, 5, 29, 30, 6, 0.3);
    var blocs = v % 3 === 0 ? [[-12, 20, 26], [14, 16, 18]] : v % 3 === 1 ? [[0, 26, 34]] : [[-16, 15, 18], [4, 24, 28], [22, 12, 14]];
    blocs.forEach(function (b, k) {
      var x = b[0], h = b[1], w = b[2];
      var gr = g.createLinearGradient(x - w / 2, 30 - h, x + w / 2, 30);
      if (sombre) { gr.addColorStop(0, "#6a625c"); gr.addColorStop(1, "#2c2624"); }
      else { gr.addColorStop(0, "#d9d2c0"); gr.addColorStop(0.6, "#a59c88"); gr.addColorStop(1, "#6f6656"); }
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - w / 2, 30);
      g.lineTo(x - w * 0.42, 30 - h * (0.55 + R(k * 5) * 0.2));
      g.lineTo(x - w * 0.12, 30 - h);
      g.lineTo(x + w * 0.22, 30 - h * (0.82 + R(k * 5 + 1) * 0.15));
      g.lineTo(x + w * 0.46, 30 - h * 0.4);
      g.lineTo(x + w / 2, 30);
      g.closePath(); g.fill();
      g.fillStyle = "rgba(30,24,16,0.26)";
      g.beginPath(); g.moveTo(x - w * 0.12, 30 - h); g.lineTo(x + w * 0.22, 30 - h * 0.85); g.lineTo(x + w * 0.46, 30 - h * 0.4); g.lineTo(x + w / 2, 30); g.lineTo(x + w * 0.05, 30); g.closePath(); g.fill();
      g.strokeStyle = "rgba(40,32,22,0.45)"; g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x - w / 2, 30); g.lineTo(x - w * 0.42, 30 - h * 0.6); g.lineTo(x - w * 0.12, 30 - h); g.lineTo(x + w * 0.22, 30 - h * 0.85); g.lineTo(x + w * 0.46, 30 - h * 0.4); g.lineTo(x + w / 2, 30);
      g.stroke();
    });
  }

  // Une parcelle cultivée, vue de biais : un parallélogramme rayé de sillons.
  function peintChamp(g, v) {
    var R = function (i) { return alea(1600 + v, i); };
    var teintes = [["#d9c85a", "#b79f3a"], ["#a9c452", "#7f9f3a"], ["#c9a85a", "#a07e3a"], ["#8fb04a", "#6a8a34"], ["#e2d27a", "#c2ac4a"]][v % 5];
    var dx = 8 + R(1) * 6, w = 40 + R(2) * 6, y0 = 6, y1 = 30;
    var forme = function () {
      g.beginPath(); g.moveTo(-w + dx, y0); g.lineTo(w + dx, y0 - 3); g.lineTo(w - dx, y1 - 2); g.lineTo(-w - dx, y1); g.closePath();
    };
    forme(); g.fillStyle = teintes[0]; g.fill();
    g.save(); forme(); g.clip();
    g.strokeStyle = teintes[1]; g.lineWidth = 1.6;
    var n = 7 + (v % 3);
    for (var i = 1; i < n; i++) {
      var t = i / n;
      if (v % 2) { g.beginPath(); g.moveTo(-w - dx + 2 * w * t + dx * 2, y0 - 4); g.lineTo(-w - dx + 2 * w * t, y1 + 2); g.stroke(); }
      else { g.beginPath(); g.moveTo(-w - dx, y0 + (y1 - y0) * t); g.lineTo(w + dx, y0 + (y1 - y0) * t - 3); g.stroke(); }
    }
    g.restore();
    forme(); g.strokeStyle = "rgba(70,58,20,0.5)"; g.lineWidth = 1.1; g.stroke();
  }

  function peintGlacon(g, v) {
    var R = function (i) { return alea(1700 + v, i); };
    ombreDecor(g, 5, 29, 28, 5, 0.18);
    [[-14, 22, 20], [8, 30, 24], [24, 14, 12]].slice(0, 2 + (v % 2)).forEach(function (b, k) {
      var x = b[0], h = b[1] * (0.8 + R(k) * 0.3), w = b[2];
      var gr = g.createLinearGradient(x - w / 2, 30 - h, x + w / 2, 30);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#a9cfe6");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - w / 2, 30); g.lineTo(x - w * 0.3, 30 - h * 0.7); g.lineTo(x, 30 - h); g.lineTo(x + w * 0.34, 30 - h * 0.55); g.lineTo(x + w / 2, 30); g.closePath(); g.fill();
      g.fillStyle = "rgba(70,120,170,0.28)";
      g.beginPath(); g.moveTo(x, 30 - h); g.lineTo(x + w * 0.34, 30 - h * 0.55); g.lineTo(x + w / 2, 30); g.lineTo(x + w * 0.05, 30); g.closePath(); g.fill();
      g.strokeStyle = "rgba(90,140,180,0.6)"; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x - w / 2, 30); g.lineTo(x - w * 0.3, 30 - h * 0.7); g.lineTo(x, 30 - h); g.lineTo(x + w * 0.34, 30 - h * 0.55); g.lineTo(x + w / 2, 30); g.stroke();
    });
  }

  // Le cône d'un volcan, à poser à la main (tampon) : cratère rougeoyant, coulées, panache.
  function peintCratere(g, v) {
    var R = function (i) { return alea(1800 + v, i); };
    ombreDecor(g, 8, 30, 46, 8, 0.3);
    var forme = function () {
      g.beginPath(); g.moveTo(-46, 31); g.quadraticCurveTo(-24, 22, -12, -14); g.lineTo(12, -14); g.quadraticCurveTo(24, 22, 46, 31); g.closePath();
    };
    var gr = g.createLinearGradient(-40, -10, 40, 30);
    gr.addColorStop(0, "#8a7462"); gr.addColorStop(0.5, "#5a4a40"); gr.addColorStop(1, "#2e2622");
    forme(); g.fillStyle = gr; g.fill();
    g.save(); forme(); g.clip();
    g.fillStyle = "rgba(20,14,10,0.3)";
    g.beginPath(); g.moveTo(2, -14); g.lineTo(12, -14); g.quadraticCurveTo(24, 22, 46, 31); g.lineTo(10, 31); g.closePath(); g.fill();
    for (var i = 0; i < 3; i++) {
      var x0 = -8 + i * 8 + (R(i) - 0.5) * 4, x1 = x0 + (i - 1) * 16 + (R(10 + i) - 0.5) * 8;
      g.strokeStyle = "#c23c10"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x0, -13); g.quadraticCurveTo(x0 + (x1 - x0) * 0.2, 6, x1, 16 + R(20 + i) * 12); g.stroke();
      g.strokeStyle = "#ffb03a"; g.lineWidth = 1.6; g.stroke();
    }
    g.restore();
    g.fillStyle = "#ff8a1c"; g.beginPath(); g.ellipse(0, -14, 12, 3.4, 0, 0, TAU); g.fill();
    g.fillStyle = "#ffe08a"; g.beginPath(); g.ellipse(0, -14, 7, 1.8, 0, 0, TAU); g.fill();
    [[-3, -24, 9], [5, -33, 11], [-2, -43, 8]].forEach(function (b) {
      g.fillStyle = "rgba(90,84,80,0.5)"; g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill();
    });
    forme(); g.strokeStyle = "rgba(30,22,16,0.5)"; g.lineWidth = 1; g.stroke();
  }

  // Un bouquet d'aiguilles d'obsidienne : des flèches noires, penchées, d'inégale hauteur,
  // une arête claire sur le flanc au soleil et, parfois, la lueur de la lave à leur pied.
  function peintAiguilles(g, v) {
    var R = function (i) { return alea(1900 + v, i); };
    ombreDecor(g, 6, 30, 40, 7, 0.34);
    var n = 5 + (v % 3), liste = [];
    for (var i = 0; i < n; i++) {
      var centre = 1 - Math.abs(i - (n - 1) / 2) / (n / 2);
      liste.push({ x: -34 + 68 * i / (n - 1) + (R(i) - 0.5) * 8, h: 24 + centre * 46 * (0.6 + R(10 + i) * 0.5), w: 9 + R(20 + i) * 7, p: (R(30 + i) - 0.5) * 14 });
    }
    if (v % 2 === 0) {
      var lave = g.createRadialGradient(0, 28, 1, 0, 28, 30);
      lave.addColorStop(0, "rgba(255,170,40,0.9)"); lave.addColorStop(1, "rgba(255,90,10,0)");
      g.fillStyle = lave; g.beginPath(); g.ellipse(0, 28, 34, 9, 0, 0, TAU); g.fill();
    }
    liste.sort(function (a, b) { return a.h - b.h; }).reverse().forEach(function (a) {
      var gr = g.createLinearGradient(a.x - a.w, 0, a.x + a.w, 0);
      gr.addColorStop(0, "#4a4442"); gr.addColorStop(0.45, "#221d1c"); gr.addColorStop(1, "#0c0a0a");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(a.x - a.w, 31); g.lineTo(a.x - a.w * 0.5 + a.p * 0.4, 31 - a.h * 0.55); g.lineTo(a.x + a.p, 31 - a.h);
      g.lineTo(a.x + a.w * 0.45 + a.p * 0.5, 31 - a.h * 0.5); g.lineTo(a.x + a.w, 31);
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(150,140,138,0.55)"; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(a.x - a.w * 0.7, 29); g.lineTo(a.x - a.w * 0.4 + a.p * 0.4, 31 - a.h * 0.55); g.lineTo(a.x + a.p, 31 - a.h); g.stroke();
    });
  }

  // ----- Décors vus du dessus -----
  //
  // Un arbre vu d'en haut : une touffe de boules de feuillage, cernée d'encre sur son
  // pourtour seulement (le cerne est tracé d'abord, les boules le recouvrent à l'intérieur),
  // quelques arcs pour le volume, et son ombre portée vers le sud-est.
  var FEUILLES_DESSUS = {
    arbre: ["#4b8166", "#3d7059", "#33614d"], tropical: ["#3f7a58", "#33694c", "#295a41"], conifere: ["#356a60", "#2c5c54", "#244e48"],
    automne: ["#c98a3e", "#b5722f", "#9a5a28"], palmier: ["#5a9460", "#4a8452", "#3c7346"], acacia: ["#8fa35a", "#7d924e", "#6b8043"]
  };
  function arbreDessus(famille) {
    return function (g, v) {
      var R = function (i) { return alea(2100 + v, i); }, T = FEUILLES_DESSUS[famille];
      var boules = [[0, 0, 21]], n = 6 + (v % 2), i;
      for (i = 0; i < n; i++) {
        var a = i / n * TAU + R(i) * 0.6, d = 17 + R(10 + i) * 6;
        boules.push([Math.cos(a) * d, Math.sin(a) * d, 13 + R(20 + i) * 6]);
      }
      var passe = function (dx, dy, extra, couleur) {
        g.fillStyle = couleur;
        g.beginPath();
        boules.forEach(function (b) { g.moveTo(b[0] + dx + b[2] + extra, b[1] + dy); g.arc(b[0] + dx, b[1] + dy, b[2] + extra, 0, TAU); });
        g.fill();
      };
      passe(7, 9, 0, "rgba(16,30,28,0.3)");          // l'ombre
      passe(0, 0, 2.6, "#1c2622");                    // le cerne
      passe(0, 0, 0, T[1]);
      boules.forEach(function (b, q) {               // le volume : un côté clair, des arcs sombres
        g.fillStyle = q % 2 ? T[0] : T[2];
        g.globalAlpha = 0.55;
        g.beginPath(); g.arc(b[0] - b[2] * 0.2, b[1] - b[2] * 0.22, b[2] * 0.62, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = "rgba(20,40,32,0.5)"; g.lineWidth = 1.4;
        g.beginPath(); g.arc(b[0], b[1], b[2] * 0.82, 0.2, 1.7); g.stroke();
      });
    };
  }
  function rocherDessus(g, v, sombre) {
    var R = function (i) { return alea(2200 + v, i); };
    [[-12, 4, 17], [14, -4, 13], [4, 16, 10]].slice(0, 2 + v % 2).forEach(function (b, k) {
      var pts = [];
      for (var j = 0; j < 7; j++) { var a = j / 7 * TAU, r = b[2] * (0.75 + R(k * 9 + j) * 0.4); pts.push([b[0] + Math.cos(a) * r, b[1] + Math.sin(a) * r]); }
      var trace = function (dx, dy) { g.beginPath(); pts.forEach(function (q, j) { if (j) g.lineTo(q[0] + dx, q[1] + dy); else g.moveTo(q[0] + dx, q[1] + dy); }); g.closePath(); };
      trace(4, 5); g.fillStyle = "rgba(16,30,28,0.28)"; g.fill();
      trace(0, 0); g.fillStyle = sombre ? "#5a5552" : "#b9b6a6"; g.fill(); g.strokeStyle = "#1c2622"; g.lineWidth = 2.2; g.stroke();
    });
  }
  // Un massif vu du dessus : un polygone irrégulier, découpé en facettes qui partent du sommet
  // et sont éclairées du nord-ouest (claires d'un côté, sombres de l'autre) — l'ombrage d'un
  // relief sur un plan. Les cimes ont une calotte blanche.
  function montagneDessus(neige) {
    return function (g, v) {
      var R = function (i) { return alea(2300 + v + (neige ? 40 : 0), i); };
      var n = 9, pts = [], i;
      for (i = 0; i < n; i++) { var a = i / n * TAU + R(i) * 0.5, r = 30 + R(10 + i) * 14; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.92]); }
      var c = [(R(30) - 0.5) * 8, (R(31) - 0.5) * 8];
      var trace = function (dx, dy, k) { g.beginPath(); pts.forEach(function (q, j) { var X = c[0] + (q[0] - c[0]) * (k || 1) + dx, Y = c[1] + (q[1] - c[1]) * (k || 1) + dy; if (j) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); };
      trace(6, 8); g.fillStyle = "rgba(16,30,28,0.3)"; g.fill();
      trace(0, 0); g.fillStyle = "#8d8a7c"; g.fill();
      var facettes = function (k, clair, sombre) {
        for (var j = 0; j < n; j++) {
          var p0 = pts[j], p1 = pts[(j + 1) % n], mx = (p0[0] + p1[0]) / 2 - c[0], my = (p0[1] + p1[1]) / 2 - c[1];
          var lum = (-mx - my) / ((Math.hypot(mx, my) || 1) * 1.414);
          g.fillStyle = lum > 0 ? clair + (0.1 + 0.38 * lum) + ")" : sombre + (0.12 - 0.34 * lum) + ")";
          g.beginPath();
          g.moveTo(c[0], c[1]);
          g.lineTo(c[0] + (p0[0] - c[0]) * k, c[1] + (p0[1] - c[1]) * k);
          g.lineTo(c[0] + (p1[0] - c[0]) * k, c[1] + (p1[1] - c[1]) * k);
          g.closePath(); g.fill();
        }
      };
      facettes(1, "rgba(255,252,236,", "rgba(26,22,16,");
      g.strokeStyle = "rgba(40,34,26,0.45)"; g.lineWidth = 1;
      g.beginPath(); pts.forEach(function (q) { g.moveTo(c[0], c[1]); g.lineTo(q[0], q[1]); }); g.stroke();
      if (neige) {
        g.save(); trace(0, 0, 0.55); g.fillStyle = "rgba(248,251,252,0.94)"; g.fill(); g.clip();
        for (var j = 0; j < n; j++) {
          var p0 = pts[j], p1 = pts[(j + 1) % n], mx = (p0[0] + p1[0]) / 2 - c[0], my = (p0[1] + p1[1]) / 2 - c[1];
          var lum = (-mx - my) / ((Math.hypot(mx, my) || 1) * 1.414);
          if (lum < 0) { g.fillStyle = "rgba(96,128,160," + (0.14 - 0.3 * lum) + ")"; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.closePath(); g.fill(); }
        }
        g.restore();
      }
      trace(0, 0); g.strokeStyle = "#1c2622"; g.lineWidth = 2.2; g.stroke();
    };
  }
  // Une place : un disque (ou un carré) de terre battue, son pavage en pointillé et, au
  // milieu, une fontaine ou un monument. Posée sous les maisons et les arbres.
  function peintPlace(g, v) {
    var carre = v % 2 === 1, R = 46;
    var forme = function (k) { g.beginPath(); if (carre) { var q = R * k * 0.9; g.rect(-q, -q, 2 * q, 2 * q); } else g.arc(0, 0, R * k, 0, TAU); };
    forme(1); g.fillStyle = "#d9cfae"; g.fill(); g.strokeStyle = "rgba(70,58,36,0.6)"; g.lineWidth = 2.4; g.stroke();
    forme(0.84); g.strokeStyle = "rgba(100,86,56,0.45)"; g.lineWidth = 5; g.setLineDash([2.5, 4]); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(16,30,28,0.28)"; g.beginPath(); g.arc(3, 4, 12, 0, TAU); g.fill();
    g.fillStyle = "#bdb8a8"; g.strokeStyle = "#1c2622"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = "#6aa6b2"; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = "#c9c4b4"; g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill();
  }

  function reduit(f, k) { return function (g, v) { g.save(); g.scale(k, k); f(g, v); g.restore(); }; }

  // Le reste des décors, vus du dessus.
  function mortDessus(g, v) {
    var R = function (i) { return alea(2600 + v, i); };
    var branche = function (x, y, a, L, w, n) {
      var ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      if (n > 0) { branche(ex, ey, a - 0.5 - R(n * 5 + 1) * 0.4, L * 0.66, w * 0.7, n - 1); branche(ex, ey, a + 0.45 + R(n * 5 + 2) * 0.4, L * 0.62, w * 0.7, n - 1); }
    };
    var tout = function () { for (var k = 0; k < 6; k++) branche(0, 0, k / 6 * TAU + R(k) * 0.8, 17 + R(10 + k) * 7, 3.6, 3); };
    g.lineCap = "round";
    g.save(); g.translate(5, 6); g.strokeStyle = "rgba(16,30,28,0.28)"; tout(); g.restore();
    g.strokeStyle = "#4a4036"; tout();
    g.fillStyle = "#3a3028"; g.strokeStyle = "#1c2622"; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 4.4, 0, TAU); g.fill(); g.stroke();
  }
  function maraisDessus(g, v) {
    var R = function (i) { return alea(2700 + v, i); }, pts = [], i;
    for (i = 0; i < 10; i++) { var a = i / 10 * TAU, r = 30 + R(i) * 10; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.78]); }
    var blob = function () { g.beginPath(); pts.forEach(function (q, j) { if (j) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); };
    var gr = g.createRadialGradient(-6, -4, 3, 0, 0, 40); gr.addColorStop(0, "#74aaa2"); gr.addColorStop(1, "#4f7f7e");
    blob(); g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(28,48,44,0.6)"; g.lineWidth = 1.6; g.stroke();
    for (i = 0; i < 5; i++) {
      var cx = (R(20 + i) - 0.5) * 40, cy = (R(30 + i) - 0.5) * 26;
      for (var j = 0; j < 7; j++) { var b = j / 7 * TAU + R(40 + i * 7 + j); g.strokeStyle = j % 2 ? "#3d5c35" : "#6d8c4f"; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(b) * (5 + R(50 + j) * 4), cy + Math.sin(b) * (5 + R(60 + j) * 4)); g.stroke(); }
      g.fillStyle = "#5b3f26"; g.beginPath(); g.arc(cx, cy, 1.6, 0, TAU); g.fill();
    }
  }
  function glaconDessus(g, v) {
    var R = function (i) { return alea(2800 + v, i); }, n = 8, pts = [], i;
    for (i = 0; i < n; i++) { var a = i / n * TAU + R(i) * 0.4, r = 22 + R(10 + i) * 14; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.9]); }
    var trace = function (dx, dy) { g.beginPath(); pts.forEach(function (q, j) { if (j) g.lineTo(q[0] + dx, q[1] + dy); else g.moveTo(q[0] + dx, q[1] + dy); }); g.closePath(); };
    trace(5, 6); g.fillStyle = "rgba(20,60,90,0.28)"; g.fill();
    trace(0, 0); g.fillStyle = "#e6f0f4"; g.fill();
    for (i = 0; i < n; i++) {
      var p0 = pts[i], p1 = pts[(i + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, lum = (-mx - my) / ((Math.hypot(mx, my) || 1) * 1.414);
      g.fillStyle = lum > 0 ? "rgba(255,255,255," + (0.2 + 0.4 * lum) + ")" : "rgba(80,130,170," + (0.1 - 0.3 * lum) + ")";
      g.beginPath(); g.moveTo(0, 0); g.lineTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.closePath(); g.fill();
    }
    trace(0, 0); g.strokeStyle = "#5f87a0"; g.lineWidth = 1.8; g.stroke();
  }
  function cratereDessus(g, v) {
    g.fillStyle = "rgba(16,30,28,0.3)"; g.beginPath(); g.arc(6, 8, 42, 0, TAU); g.fill();
    var gr = g.createRadialGradient(-12, -14, 4, 0, 0, 44); gr.addColorStop(0, "#9a8574"); gr.addColorStop(1, "#40342e");
    g.fillStyle = gr; g.strokeStyle = "#1c2622"; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, 42, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = "rgba(30,22,16,0.4)"; g.lineWidth = 1.2; g.beginPath();
    for (var i = 0; i < 12; i++) { var a = i / 12 * TAU + v; g.moveTo(Math.cos(a) * 17, Math.sin(a) * 17); g.lineTo(Math.cos(a) * 41, Math.sin(a) * 41); }
    g.stroke();
    g.fillStyle = "#2c2420"; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.fill();
    var lave = g.createRadialGradient(0, 0, 1, 0, 0, 13); lave.addColorStop(0, "#ffe08a"); lave.addColorStop(0.5, "#ff8a1c"); lave.addColorStop(1, "#c23c10");
    g.fillStyle = lave; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill();
  }
  function champDessus(g, v) {
    var R = function (i) { return alea(2900 + v, i); }, a = (R(1) - 0.5) * 0.7, teintes = ["#94776a", "#9c7c6c", "#886f64", "#a08572"];
    g.save(); g.rotate(a);
    g.fillStyle = "rgba(16,30,28,0.22)"; g.fillRect(-38, -24, 80, 54);
    g.fillStyle = teintes[v % teintes.length]; g.fillRect(-40, -28, 80, 56);
    g.strokeStyle = "rgba(60,40,32,0.5)"; g.lineWidth = 1.4; g.beginPath();
    for (var i = 1; i < 12; i++) { g.moveTo(-40, -28 + i * 4.7); g.lineTo(40, -28 + i * 4.7); }
    g.stroke();
    g.strokeStyle = "#1c2622"; g.lineWidth = 2; g.strokeRect(-40, -28, 80, 56);
    g.restore();
  }
  function herbeDessus(seche) {
    return function (g, v) {
      var R = function (i) { return alea(3000 + v, i); };
      g.lineCap = "round";
      for (var i = 0; i < 9; i++) {
        var a = i / 9 * TAU + R(i) * 0.5, L = 12 + R(10 + i) * 10;
        g.strokeStyle = seche ? (i % 2 ? "#a08848" : "#c4aa5c") : (i % 2 ? "#4c762e" : "#84aa4c"); g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.4) * L * 0.6, Math.sin(a + 0.4) * L * 0.6, Math.cos(a) * L, Math.sin(a) * L); g.stroke();
      }
    };
  }

  var PEINTRES_DESSUS = {
    mort: mortDessus, marais: maraisDessus, glacon: glaconDessus, cratere: cratereDessus, champ: champDessus,
    herbe: herbeDessus(false), seche: herbeDessus(true),
    // Vus d'en haut, ils occupent toute la boîte du dessin de profil : on les réduit pour qu'ils
    // gardent la même emprise sur la carte.
    montagne: reduit(montagneDessus(false), 0.62), cime: reduit(montagneDessus(true), 0.62),
    basalte: function (g, v) { rocherDessus(g, v, true); }, aiguilles: function (g, v) { rocherDessus(g, v + 1, true); },
    arbre: arbreDessus("arbre"), tropical: arbreDessus("tropical"), conifere: arbreDessus("conifere"),
    automne: arbreDessus("automne"), palmier: arbreDessus("palmier"), acacia: arbreDessus("acacia"), rocher: function (g, v) { rocherDessus(g, v, false); }
  };

  // Une maison vue du dessus : un toit rectangulaire (long côté `w`, tourné de `a`), ses
  // deux pans séparés par le faîte, les rangs de bardeaux, et son ombre. Dessinée en
  // vectoriel (et non collée) : chaque maison a sa propre orientation.
  var TOITS_DESSUS = ["#b98a68", "#a97c5e", "#c29472", "#b08064", "#9c7458", "#6f8496", "#bd8e6c", "#7b8ea0"];
  function maisonDessus(lc, x, y, w, h, a, v, fin, couleur) {
    var u = Math.max(Math.max(w, h) / 60, fin || 0);
    lc.save();
    lc.translate(x, y);
    lc.save();
    lc.translate(h * 0.16, h * 0.2); lc.rotate(a);
    lc.fillStyle = "rgba(16,30,28,0.32)"; lc.fillRect(-w / 2, -h / 2, w, h);
    lc.restore();
    lc.rotate(a);
    lc.lineJoin = "round";
    lc.fillStyle = couleur || TOITS_DESSUS[v % TOITS_DESSUS.length];
    lc.fillRect(-w / 2, -h / 2, w, h);
    lc.fillStyle = "rgba(20,14,8,0.16)"; lc.fillRect(-w / 2, 0, w, h / 2);       // le pan à l'ombre
    lc.strokeStyle = "rgba(40,26,16,0.45)"; lc.lineWidth = u * 0.9;
    lc.beginPath();
    for (var q = 1, n = Math.max(3, Math.round(w / h * 4)); q < n; q++) { lc.moveTo(-w / 2 + w * q / n, -h / 2); lc.lineTo(-w / 2 + w * q / n, h / 2); }
    lc.stroke();
    lc.strokeStyle = "#1c2622"; lc.lineWidth = u * 2.2;
    lc.strokeRect(-w / 2, -h / 2, w, h);
    lc.lineWidth = u * 1.4;
    lc.beginPath(); lc.moveTo(-w / 2, 0); lc.lineTo(w / 2, 0); lc.stroke();
    lc.restore();
  }

  // Les maisons d'un quartier, à semer par centaines : toits de tuiles de teintes variées
  // (rouge, brun, ardoise), une grande bâtisse à deux corps, un clocher.
  var TOITS_VILLE = ["#a8452f", "#b5552f", "#8f3b2a", "#9a5a36", "#6f6a72", "#b0603a"];
  function peintMaisonVille(g, v, genre) {
    g.lineWidth = 2.2; g.strokeStyle = "#2a1c0e"; g.lineJoin = "round";
    var avant = TOIT;
    TOIT = TOITS_VILLE[v % TOITS_VILLE.length];
    ombreDecor(g, 4, 31, 30, 6, 0.3);
    if (genre === "clocher") {
      maison(g, -12, 31, 34, 22);
      tourPierre(g, 14, 31, 18, 50, 24);
      g.beginPath(); g.moveTo(14, -43); g.lineTo(14, -52); g.moveTo(10, -48); g.lineTo(18, -48); g.stroke();
    } else if (genre === "batisse") {
      maison(g, -14, 28, 34, 26);
      maison(g, 14, 31, 40, 30);
    } else {
      var w = 44 + (v % 3) * 6, h = 26 + (v % 2) * 6;
      maison(g, 0, 31, w, h);
    }
    TOIT = avant;
  }

  var PEINTRES = {
    arbre: peintArbre, conifere: peintConifere,
    automne: function (g, v) { peintArbre(g, v, "automne"); },
    tropical: function (g, v) { peintArbre(g, v, "jungle"); },
    palmier: peintPalmier, acacia: peintAcacia, mort: peintMort,
    montagne: function (g, v) { peintMontagne(g, v, false); },
    cime: function (g, v) { peintMontagne(g, v, true); },
    marais: peintMarais, herbe: peintHerbe,
    seche: function (g, v) { peintHerbe(g, v, true); },
    rocher: function (g, v) { peintRocher(g, v, false); },
    basalte: function (g, v) { peintRocher(g, v, true); },
    champ: peintChamp, glacon: peintGlacon, cratere: peintCratere, aiguilles: peintAiguilles,
    maison: function (g, v) { peintMaisonVille(g, v, "maison"); },
    batisse: function (g, v) { peintMaisonVille(g, v, "batisse"); },
    clocher: function (g, v) { peintMaisonVille(g, v, "clocher"); },
    place: peintPlace
  };
  var VARIANTES = { arbre: 6, conifere: 4, automne: 6, tropical: 6, palmier: 4, acacia: 4, mort: 4, montagne: 6, cime: 6,
    marais: 3, herbe: 3, seche: 3, rocher: 6, basalte: 6, champ: 6, glacon: 4, cratere: 2, aiguilles: 6, maison: 12, batisse: 6, clocher: 4, place: 2 };

  // Colle un décor peint : (x, y) est le point où il touche le sol, s la taille de sa boîte.
  function colle(ctx, type, v, x, y, s) {
    var S = tailleSprite(s * ZPX);
    ctx.drawImage(spriteCanvas(type, v, S), x - s / 2, y - s * 0.81, s, s);
  }
  function variante(type, r) {
    var n = VARIANTES[type];
    return Math.min(n - 1, Math.floor(r * n));
  }

  // ----- Table des décors -----
  //
  // Les tailles sont en PIXELS ÉCRAN : un arbre fait une trentaine de pixels quel que soit
  // le zoom (voir « Décors qui s'adaptent au zoom »). `C` : le côté minimal d'une case, donc
  // la MOITIÉ de l'écart le plus lâche entre deux décors (il varie de 1,4 C à 2 C) ;
  // `p` : la part des emplacements réellement occupés ; `marge` : de combien le décor se
  // tient à l'intérieur de son terrain (fraction de sa taille) ; `choix` : [décor, poids,
  // taille] — un terrain peut mêler plusieurs décors.
  var DECORS = {
    herbe:    { C: 16,   p: 0.2,  marge: 0.1,  choix: [["herbe", 1, 17]] },
    seche:    { C: 17,   p: 0.2,  marge: 0.1,  choix: [["seche", 1, 17]] },
    // Les parcelles sont dessinées à part (voir « Champs ») ; ici, les arbres isolés entre elles.
    champs:   { C: 17,   p: 0.05, marge: 0.1,  choix: [["arbre", 1, 24]], apercu: "champ" },
    savane:   { C: 17,   p: 0.8,  marge: 0.15, choix: [["acacia", 0.3, 36], ["seche", 0.7, 15]] },
    foret:    { C: 8.5, p: 1,    marge: 0.12, choix: [["arbre", 0.68, 28], ["tropical", 0.2, 31], ["conifere", 0.12, 28]] },
    automne:  { C: 8.5, p: 1,    marge: 0.12, choix: [["automne", 1, 28]] },
    taiga:    { C: 8.5, p: 1,    marge: 0.12, choix: [["conifere", 1, 28]] },
    jungle:   { C: 8.5,   p: 1,    marge: 0.12, choix: [["tropical", 0.72, 29], ["palmier", 0.28, 33]] },
    morte:    { C: 12,   p: 0.8,  marge: 0.12, choix: [["mort", 1, 27]] },
    // Une chaîne : de grands massifs et, serrés entre eux, des pics plus petits. La marge
    // est faible pour qu'une crête étroite, vue de loin, porte déjà sa rangée de sommets.
    montagne: { C: 24,   p: 0.94, marge: 0.05, choix: [["montagne", 0.4, 170], ["montagne", 0.6, 104]] },
    cime:     { C: 24,   p: 0.94, marge: 0.05, choix: [["cime", 0.4, 170], ["cime", 0.6, 104]] },
    volcan:   { C: 21,   p: 0.62, marge: 0.2,  choix: [["aiguilles", 0.5, 84], ["basalte", 0.5, 24]] },
    rocaille: { C: 13,   p: 0.8,  marge: 0.15, choix: [["rocher", 1, 24]] },
    cendres:  { C: 19,   p: 0.5,  marge: 0.15, choix: [["basalte", 0.6, 20], ["mort", 0.4, 24]] },
    toundra:  { C: 15,   p: 0.5,  marge: 0.1,  choix: [["rocher", 0.35, 15], ["seche", 0.65, 14]] },
    // Une ville qui s'étale : des maisons serrées, quelques grandes bâtisses et clochers.
    // Tracer une route à travers ouvre une rue (les maisons s'en écartent d'elles-mêmes).
    // `rues` : ces terrains ne sèment pas leurs maisons au hasard, ils les alignent le long
    // d'un réseau de rues (voir « Villes »). `parCote` : maisons par côté d'îlot ; `vide` :
    // part des emplacements laissés libres ; `coeur` : ce qu'on trouve au milieu d'un îlot.
    ville:    { C: 10,   p: 1,    marge: 0.1,  choix: [["maison", 1, 27]],
                rues: { parCote: 4, vide: 0.04, rue: "#d8c596", coeur: [["clocher", 0.08, 5.2], ["batisse", 0.2, 4.4], ["arbre", 0.45, 2.5]] } },
    faubourg: { C: 10,   p: 1,    marge: 0.1,  choix: [["maison", 1, 27]],
                rues: { parCote: 3, vide: 0.42, rue: "#cbb98a", coeur: [["champ", 0.45, 4.6], ["arbre", 0.4, 2.6]] } },
    glace:    { C: 24,   p: 0.45, marge: 0.2,  choix: [["glacon", 1, 24]] },
    marais:   { C: 15,   p: 0.75, marge: 0.2,  choix: [["marais", 1, 30]] }
  };
  // Réglages du pinceau : densité (aucun, clairsemé, normal, dense) et taille des décors.
  var DENSITES = [0, 0.4, 1, 1.8], ECHELLES = [0.7, 1, 1.45];

  // Tampons : les mêmes décors, posés un par un à la main (un pic isolé, un bosquet…).
  // Un tampon appartient au monde — il grandit quand on s'approche — mais pas sans fin : au-
  // delà d'une taille d'écran (`max`, en px), il la garde, comme un symbole. Sans cela, un
  // pic posé sur la carte du continent deviendrait un mur une fois qu'on zoome sur sa vallée.
  var TAMPONS = [
    { id: "arbre", nom: "Feuillu" }, { id: "conifere", nom: "Sapin" }, { id: "automne", nom: "Arbre d'automne" },
    { id: "tropical", nom: "Arbre tropical" }, { id: "palmier", nom: "Palmier" }, { id: "acacia", nom: "Acacia" },
    { id: "mort", nom: "Arbre mort" }, { id: "montagne", nom: "Montagne", max: 230 }, { id: "cime", nom: "Pic enneigé", max: 230 },
    { id: "cratere", nom: "Volcan", max: 230 }, { id: "aiguilles", nom: "Aiguilles noires", max: 170 },
    { id: "rocher", nom: "Rochers" }, { id: "basalte", nom: "Roche sombre" }, { id: "glacon", nom: "Glace" },
    { id: "champ", nom: "Champ" }, { id: "maison", nom: "Maison" }, { id: "batisse", nom: "Bâtisse" }, { id: "clocher", nom: "Église" }, { id: "place", nom: "Place" }, { id: "marais", nom: "Roseaux" }, { id: "herbe", nom: "Herbes" }, { id: "seche", nom: "Herbes sèches" }
  ];

  var BATIMENTS = { maison: 1, batisse: 1.5, clocher: 1.8 };      // tampons orientables en vue du dessus
  var MAX_TAMPON = {};
  TAMPONS.forEach(function (t) { MAX_TAMPON[t.id] = t.max || 120; });
  // La taille d'un tampon dans le monde, à ce zoom (px CSS par unité).
  function tailleTampon(t) { return t.s; }

  // ----- Types d'objets -----
  var TYPES_LIGNES = {
    riviere:   { nom: "Rivière",        px: 2.4 },
    route:     { nom: "Route",          px: 3 },
    pavee:     { nom: "Route pavée",    px: 3.4 },
    sentier:   { nom: "Sentier",        px: 1.4 },
    maisons:   { nom: "Rue bordée de maisons", px: 2.4 },
    falaise:   { nom: "Falaise",        px: 1.6 },
    muraille:  { nom: "Muraille",       px: 5 },
    frontiere: { nom: "Frontière",      px: 2.4 },
    maritime:  { nom: "Route maritime", px: 1.6 },
    ponton:    { nom: "Ponton",         px: 4 }
  };
  // Les voies : elles se rejoignent, portent des ponts, et les décors s'en écartent.
  var VOIES = { route: true, pavee: true, sentier: true, maisons: true };

  // `niv` : niveau de zoom à partir duquel le lieu apparaît (0 = toujours).
  // 1 correspond à la carte entière tenant dans l'écran.
  // `px` : taille du pictogramme ; `pxIll` : taille du dessin (style Illustré, et types
  // qui n'ont pas de pictogramme) ; `cat` : rangement dans la palette de l'éditeur.
  var TYPES_LIEUX = {
    capitale:  { nom: "Capitale",   px: 22, pxIll: 100, police: 17, niv: 0,   maj: true, cat: "Cités" },
    ville:     { nom: "Ville",      px: 15, pxIll: 82, police: 14, niv: 0.6, cat: "Cités" },
    village:   { nom: "Village",    px: 10, pxIll: 56, police: 12, niv: 2.5, cat: "Cités" },
    port:      { nom: "Port",       px: 14, pxIll: 66, police: 13, niv: 1.2, cat: "Cités" },
    ferme:     { nom: "Ferme",      pxIll: 44, police: 12, niv: 4, cat: "Cités" },
    cabane:    { nom: "Cabane",     pxIll: 38, police: 12, niv: 5, cat: "Cités" },
    campement: { nom: "Campement",  pxIll: 40, police: 12, niv: 5, cat: "Cités" },
    pilotis:   { nom: "Pilotis",    pxIll: 40, police: 12, niv: 5, cat: "Cités" },
    fort:      { nom: "Forteresse", px: 15, pxIll: 70, police: 13, niv: 1.5, cat: "Ouvrages" },
    tour:      { nom: "Tour",       px: 12, pxIll: 46, police: 12, niv: 4, cat: "Ouvrages" },
    temple:    { nom: "Temple",     px: 14, pxIll: 52, police: 12, niv: 3, cat: "Ouvrages" },
    mine:      { nom: "Mine",       px: 12, pxIll: 46, police: 12, niv: 4, cat: "Ouvrages" },
    moulin:    { nom: "Moulin",     pxIll: 46, police: 12, niv: 4, cat: "Ouvrages" },
    phare:     { nom: "Phare",      pxIll: 50, police: 12, niv: 3, cat: "Ouvrages" },
    auberge:   { nom: "Auberge",    pxIll: 44, police: 12, niv: 4, cat: "Ouvrages" },
    puits:     { nom: "Puits",      pxIll: 34, police: 12, niv: 6, cat: "Ouvrages" },
    donjon:    { nom: "Donjon",     px: 14, pxIll: 50, police: 12, niv: 2, cat: "Mystères" },
    ruine:     { nom: "Ruines",     px: 13, pxIll: 52, police: 12, niv: 3, cat: "Mystères" },
    vestiges:  { nom: "Vestiges",   pxIll: 40, police: 12, niv: 5, cat: "Mystères" },
    grotte:    { nom: "Grotte",     pxIll: 42, police: 12, niv: 4, cat: "Mystères" },
    menhirs:   { nom: "Menhirs",    pxIll: 40, police: 12, niv: 5, cat: "Mystères" },
    portail:   { nom: "Portail",    pxIll: 46, police: 12, niv: 4, cat: "Mystères" },
    cimetiere: { nom: "Cimetière",  pxIll: 42, police: 12, niv: 5, cat: "Mystères" },
    bataille:  { nom: "Bataille",   pxIll: 40, police: 12, niv: 3, cat: "Mystères" },
    oasis:     { nom: "Oasis",      pxIll: 44, police: 12, niv: 4, cat: "Nature" },
    ancien:    { nom: "Arbre ancien", pxIll: 54, police: 12, niv: 4, cat: "Nature" },
    navire:    { nom: "Navire",     px: 14, pxIll: 40, police: 12, niv: 1.2, cat: "Nature" },
    epave:     { nom: "Épave",      pxIll: 42, police: 12, niv: 4, cat: "Nature" },
    point:     { nom: "Point",      px: 9,  pxIll: 9,  police: 12, niv: 2, cat: "Repères", repere: true },
    croix:     { nom: "Croix",      px: 14, pxIll: 16, police: 12, niv: 2, cat: "Repères", repere: true },
    etoile:    { nom: "Étoile",     px: 17, pxIll: 20, police: 12, niv: 2, cat: "Repères", repere: true },
    drapeau:   { nom: "Drapeau",    px: 18, pxIll: 24, police: 12, niv: 2, cat: "Repères", repere: true },
    image:     { nom: "Image",      px: 48, pxIll: 56, police: 13, niv: 1, cat: "Repères", cache: true }
  };
  var CATEGORIES_LIEUX = ["Cités", "Ouvrages", "Mystères", "Nature", "Repères"];

  var STYLES_ETIQ = {
    pays:    { nom: "Pays",     poids: "700", italique: false, maj: true,  espace: 0.3 },
    region:  { nom: "Région",   poids: "600", italique: false, maj: true,  espace: 0.18 },
    mer:     { nom: "Mer",      poids: "500", italique: true,  maj: false, espace: 0.22, mer: true },
    relief:  { nom: "Relief",   poids: "600", italique: true,  maj: false, espace: 0.14 },
    lieudit: { nom: "Lieu-dit", poids: "500", italique: true,  maj: false, espace: 0.04 },
    libre:   { nom: "Libre",    poids: "500", italique: false, maj: false, espace: 0 }
  };

  // ----- Géométrie de base -----
  // Le zoom qui montre toute la carte dans la vue (avec un peu d'air autour), et
  // le « niveau » qui en découle : 1 = la carte entière, 10 = dix fois plus près.
  // Relatif à la vue et non fixe : une carte garde le même aspect, les mêmes lieux
  // visibles, sur un téléphone comme sur un grand écran ou dans un export.
  function zoomAjuste(carte, vue) {
    return Math.min(vue.largeur / carte.largeur, vue.hauteur / carte.hauteur) * 0.92;
  }
  function niveau(carte, vue) { return vue.zoom / zoomAjuste(carte, vue); }

  function joli(v) {
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var m = v / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  function boiteTrait(pts, taille) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < pts.length; i += 2) {
      if (pts[i] < x0) x0 = pts[i];
      if (pts[i] > x1) x1 = pts[i];
      if (pts[i + 1] < y0) y0 = pts[i + 1];
      if (pts[i + 1] > y1) y1 = pts[i + 1];
    }
    var m = taille / 2;
    return [x0 - m, y0 - m, x1 + m, y1 + m];
  }

  function nouveauTrait(mat, taille, pts, nuage) {
    return {
      id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      mat: mat,
      taille: taille,
      pts: pts,
      nuage: !!nuage,
      seed: Math.floor(Math.random() * 2147483647),
      bb: boiteTrait(pts, taille)
    };
  }

  function chevauche(bb, x0, y0, x1, y1) {
    return !(bb[2] < x0 || bb[0] > x1 || bb[3] < y0 || bb[1] > y1);
  }

  // ----- Traits de pinceau -----
  //
  // Un trait « rugueux » (`rug`, 0 à 1) n'a pas le bord lisse d'un pinceau rond : son contour
  // est fait de polygones irréguliers semés le long du tracé, d'où des côtes découpées, avec
  // anses et caps. Le relief du bord suit la taille du pinceau : zoomer puis repasser au
  // petit pinceau cisèle la côte plus finement. La forme est calculée une fois par trait.
  var formesRugueuses = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function formeRugueuse(t) {
    var p = t.pts, cle = p.length + "|" + t.taille + "|" + t.rug + "|" + p[0] + "|" + p[p.length - 1];
    var c = formesRugueuses && formesRugueuses.get(t);
    if (c && c.cle === cle) return c.chemin;
    var chemin = new Path2D(), r = t.taille / 2, rug = Math.max(0, Math.min(1, t.rug)), graine = t.seed | 0, rang = 0;
    var blob = function (x, y) {
      var n = 9, ox = (alea(graine, rang * 13 + 11) - 0.5) * r * 0.24 * rug, oy = (alea(graine, rang * 13 + 12) - 0.5) * r * 0.24 * rug;
      for (var j = 0; j < n; j++) {
        var ang = (j + alea(graine, rang * 13 + j) * 0.6) / n * TAU;
        var rr = r * (0.88 - 0.42 * rug * alea(graine + 7, rang * 13 + j));
        var qx = x + ox + Math.cos(ang) * rr, qy = y + oy + Math.sin(ang) * rr;
        if (j === 0) chemin.moveTo(qx, qy); else chemin.lineTo(qx, qy);
      }
      chemin.closePath();
      rang++;
    };
    if (p.length <= 2) blob(p[0], p[1]);
    else {
      var pas = t.taille * 0.2, prochain = 0, parcouru = 0;
      for (var i = 0; i + 3 < p.length; i += 2) {
        var dx = p[i + 2] - p[i], dy = p[i + 3] - p[i + 1], L = Math.hypot(dx, dy);
        if (!L) continue;
        while (prochain <= parcouru + L) {
          var f = (prochain - parcouru) / L;
          blob(p[i] + dx * f, p[i + 1] + dy * f);
          prochain += pas;
        }
        parcouru += L;
      }
      blob(p[p.length - 2], p[p.length - 1]);
    }
    if (formesRugueuses) formesRugueuses.set(t, { cle: cle, chemin: chemin });
    return chemin;
  }

  // `couleur` : remplace celle du matériau (le masque des matériaux peint chaque matériau
  // d'une couleur-code pour savoir, plus tard, ce qu'il y a sous un point).
  function tracerTrait(lc, t, mat, couleur) {
    var p = t.pts;
    var terre = mat.type === "terre";
    lc.globalCompositeOperation = terre ? "source-over" : "destination-out";
    lc.fillStyle = lc.strokeStyle = terre ? (couleur || (COULEURS && COULEURS[mat.id]) || mat.couleur) : "#000";
    lc.lineWidth = t.taille;
    lc.lineCap = "round";
    lc.lineJoin = "round";
    var r = t.taille / 2;
    if (t.nuage && p.length > 2) {
      // Un nuage (carte générée) : chaque disque devient un polygone irrégulier. Les
      // côtes y gagnent leurs anses et leurs caps au lieu d'une suite de cercles.
      var graine = t.seed | 0;
      lc.beginPath();
      for (var n = 0, d = 0; n < p.length; n += 2, d++) {
        for (var j = 0; j < 9; j++) {
          var ang = j / 9 * TAU, rr = r * (0.78 + 0.34 * alea(graine, d * 9 + j));
          var qx = p[n] + Math.cos(ang) * rr, qy = p[n + 1] + Math.sin(ang) * rr;
          if (j === 0) lc.moveTo(qx, qy); else lc.lineTo(qx, qy);
        }
        lc.closePath();
      }
      lc.fill();
    } else if (t.rug > 0 && typeof Path2D !== "undefined") {
      if (p.length > 2) {
        lc.lineWidth = t.taille * (1 - 0.5 * Math.min(1, t.rug));     // le cœur du trait, sans trou
        lc.beginPath();
        lc.moveTo(p[0], p[1]);
        for (var q = 2; q < p.length; q += 2) lc.lineTo(p[q], p[q + 1]);
        lc.stroke();
      }
      lc.fill(formeRugueuse(t), "nonzero");
    } else if (p.length <= 2) {
      lc.beginPath();
      lc.moveTo(p[0] + r, p[1]);
      lc.arc(p[0], p[1], r, 0, TAU);
      lc.fill();
    } else {
      lc.beginPath();
      lc.moveTo(p[0], p[1]);
      for (var k = 2; k < p.length; k += 2) lc.lineTo(p[k], p[k + 1]);
      lc.stroke();
    }
    lc.globalCompositeOperation = "source-over";
  }

  // ----- Décors qui s'adaptent au zoom -----
  //
  // Un décor n'appartient pas à un coup de pinceau : il naît du TERRAIN, à l'endroit où on
  // regarde. Le monde est découpé en cases, de plus en plus fines (chaque niveau coupe les
  // cases du précédent en quatre) ; chaque case contient UN emplacement de décor. Quand une
  // case est coupée en quatre, l'emplacement qu'elle contenait reste où il était (la
  // sous-case où il tombe en hérite) et les trois autres sous-cases en reçoivent un nouveau.
  //
  // Conséquences : les décors gardent une taille lisible à l'écran à tous les zooms (une
  // forêt vue de très loin ou de très près reste une forêt, jamais trois arbres géants et
  // flous) ; en zoomant, les décors déjà visibles ne bougent pas et de nouveaux poussent
  // entre eux, d'abord minuscules — rien n'apparaît ni ne disparaît d'un coup ; et le nombre
  // de décors à dessiner ne dépend que de la taille de l'écran, pas de celle du monde.
  // Tout vient d'un hachage de la case : aucun décor n'est enregistré.
  var CASE0 = 65536;                        // côté d'une case du niveau 0, en unités du monde
  var memoCases = new Map();

  function pointCase(k, i, j) {
    var cle = (k * 2097152 + i) * 2097152 + j;
    var v = memoCases.get(cle);
    if (v) return v;
    var D = CASE0 / Math.pow(2, k);
    if (k > 0) {
      var parent = pointCase(k - 1, i >> 1, j >> 1);
      if (Math.floor(parent.x / D) === i && Math.floor(parent.y / D) === j) { memoCases.set(cle, parent); return parent; }
    }
    var g = k * 7919 + 17, h = (i * 73856093) ^ (j * 19349663);
    v = {
      x: (i + 0.14 + 0.72 * alea(g, h)) * D, y: (j + 0.14 + 0.72 * alea(g + 1, h)) * D, k: k,
      r: alea(g + 2, h), r2: alea(g + 3, h), r3: alea(g + 4, h)
    };
    memoCases.set(cle, v);
    return v;
  }

  // Le zoom de référence d'une carte : celui où elle tient dans 1 400 px. C'est à cette
  // échelle que les décors ont leur taille « normale » ; il ne dépend ni de l'écran ni de la vue.
  // `carte.finesse` (0, 1 ou 2 ; 1 par défaut) règle l'échelle générale des décors : à 1, un
  // arbre fait une quinzaine de pixels à la vue d'ensemble — une carte fouillée, qui supporte
  // d'être regardée de près.
  //
  // Cette échelle est FIGÉE dans la carte (`carte.zbFixe`) dès qu'elle est ouverte ou créée :
  // agrandir ou rétrécir la carte ne la change pas, donc ne déplace aucun décor automatique.
  // Seul le réglage « Échelle des décors » la recalcule (`fixerEchelleDecors`), à la demande.
  function zoomBaseCalcule(carte) {
    var fin = typeof carte.finesse === "number" ? carte.finesse : 1;
    return 1400 / Math.max(carte.largeur, carte.hauteur) * Math.pow(2, fin);
  }
  function zoomBase(carte) { return carte.zbFixe > 0 ? carte.zbFixe : zoomBaseCalcule(carte); }
  function fixerEchelleDecors(carte) { carte.zbFixe = zoomBaseCalcule(carte); return carte.zbFixe; }
  var FINESSE_MAX = 4;

  // Le niveau de cases d'un terrain : fixé par la carte et par la finesse du trait (`fin` :
  // chaque cran divise par deux la taille des décors), JAMAIS par le zoom de la vue.
  function niveauDecor(zb, C, fin) { return Math.max(0, Math.floor(Math.log(CASE0 * zb * Math.pow(2, fin) / C) / Math.LN2)); }

  // Rassemble dans `liste` les décors à dessiner pour cette vue : { x, y, s, sprite } en
  // unités du monde. Les décors sont FIXÉS DANS LE MONDE, comme sur une carte imprimée :
  // même nombre, mêmes places, même taille (en km) à tous les zooms — zoomer les agrandit,
  // rien n'apparaît ni ne disparaît. Seule exception, la lisibilité : quand des décors
  // feraient moins de quelques pixels (une forêt fine vue de très loin), on en dessine un
  // sur quatre, deux fois plus grand, aux mêmes endroits — la forêt reste une forêt.
  // `tampons` : les décors posés à la main, dont les autres s'écartent.
  // ----- Ce qu'il y a sous un point du monde (sans écran, sans zoom) -----
  //
  // Pour qu'un décor automatique ne bouge ni ne disparaisse en zoomant, sa présence ne peut
  // dépendre que de la carte : jamais d'une image calculée à l'échelle de l'écran. On interroge
  // donc les objets eux-mêmes, en unités du monde : les lacs et les rivières creusent, le trait
  // le plus récent qui couvre le point donne le terrain, les zones « Affiner / Gomme à décors »
  // ajustent la finesse et la densité. Les listes d'objets sont d'abord réduites à la zone qui
  // nous intéresse (`contexteZone`), si bien qu'une interrogation ne parcourt que quelques objets.
  var indexTraits = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function indexTrait(t) {
    var p = t.pts, cle = p.length + "|" + t.taille + "|" + p[0] + "|" + p[p.length - 1];
    var c = indexTraits && indexTraits.get(t);
    if (c && c.cle === cle) return c;
    var cell = Math.max(t.taille, 1e-9), r = t.taille / 2, grille = {}, i;
    var ajoute = function (gx, gy, v) { var k = gx + "," + gy; (grille[k] || (grille[k] = [])).push(v); };
    if (t.nuage || p.length <= 2) {
      for (i = 0; i < p.length; i += 2) ajoute(Math.floor(p[i] / cell), Math.floor(p[i + 1] / cell), i);
    } else {
      for (i = 0; i + 3 < p.length; i += 2) {
        var gx0 = Math.floor((Math.min(p[i], p[i + 2]) - r) / cell), gx1 = Math.floor((Math.max(p[i], p[i + 2]) + r) / cell);
        var gy0 = Math.floor((Math.min(p[i + 1], p[i + 3]) - r) / cell), gy1 = Math.floor((Math.max(p[i + 1], p[i + 3]) + r) / cell);
        for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) ajoute(gx, gy, i);
      }
    }
    c = { cle: cle, cell: cell, grille: grille };
    if (indexTraits) indexTraits.set(t, c);
    return c;
  }

  function couvre(t, x, y) {
    var ix = indexTrait(t), r = t.taille / 2, p = t.pts, dabs = t.nuage || p.length <= 2;
    var gx = Math.floor(x / ix.cell), gy = Math.floor(y / ix.cell);
    for (var ax = gx - 1; ax <= gx + 1; ax++) {
      for (var ay = gy - 1; ay <= gy + 1; ay++) {
        var l = ix.grille[ax + "," + ay];
        if (!l) continue;
        for (var q = 0; q < l.length; q++) {
          var i = l[q];
          if (dabs) { if (Math.hypot(p[i] - x, p[i + 1] - y) <= r * 0.92) return true; }
          else if (distSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r) return true;
        }
      }
    }
    return false;
  }

  // Les objets qui touchent le rectangle (x0, y0, x1, y1), réduits à ce qui compte pour les décors.
  function contexteZone(carte, x0, y0, x1, y1) {
    var ctx = { traits: [], lacs: [], rivieres: [], voies: [], zones: [] };
    (carte.traits || []).forEach(function (t) {
      if (!t.bb) t.bb = boiteTrait(t.pts, t.taille);
      if (chevauche(t.bb, x0, y0, x1, y1)) ctx.traits.push(t);
    });
    (carte.lacs || []).forEach(function (l) {
      if (!l.pts || l.pts.length < 6) return;
      var bb = boiteTrait(l.pts, 0);
      if (chevauche(bb, x0, y0, x1, y1)) ctx.lacs.push({ l: l, bb: bb });
    });
    (carte.lignes || []).forEach(function (l) {
      if (!l.pts || l.pts.length < 4 || (l.type !== "riviere" && !VOIES[l.type])) return;
      var d = pointsAffiches(l), m = (l.taille || 0) * 1.5, bb = boiteTrait(d, 0);
      if (!chevauche([bb[0] - m, bb[1] - m, bb[2] + m, bb[3] + m], x0, y0, x1, y1)) return;
      (l.type === "riviere" ? ctx.rivieres : ctx.voies).push({ l: l, d: d, bb: bb, m: m });
    });
    (carte.finesses || []).forEach(function (f) { if (f.bb && chevauche(f.bb, x0, y0, x1, y1)) ctx.zones.push(f); });
    return ctx;
  }

  var SANS_TERRAIN = { eau: true, t: null, m: null };
  // Le terrain en (x, y) : { eau: true } (mer, gomme, lac, rivière, hors carte) ou { eau: false, t, m }.
  function sonde(ctx, carte, x, y, demiMin) {
    if (x < 0 || y < 0 || x > carte.largeur || y > carte.hauteur) return SANS_TERRAIN;
    var i, q;
    for (i = 0; i < ctx.lacs.length; i++) {
      var lb = ctx.lacs[i].bb;
      if (x >= lb[0] && x <= lb[2] && y >= lb[1] && y <= lb[3] && dansPolygone(x, y, ctx.lacs[i].l.pts)) return SANS_TERRAIN;
    }
    for (i = 0; i < ctx.rivieres.length; i++) {
      var rv = ctx.rivieres[i], rb = rv.bb, demi = Math.max((rv.l.taille || 0) * (rv.l.delta ? 0.65 : 0.5), demiMin || 0);
      if (x < rb[0] - demi || x > rb[2] + demi || y < rb[1] - demi || y > rb[3] + demi) continue;
      for (q = 0; q + 3 < rv.d.length; q += 2) if (distSeg(x, y, rv.d[q], rv.d[q + 1], rv.d[q + 2], rv.d[q + 3]) <= demi) return SANS_TERRAIN;
    }
    for (i = ctx.traits.length - 1; i >= 0; i--) {
      var t = ctx.traits[i], b = t.bb;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3] || !couvre(t, x, y)) continue;
      var m = MAT[t.mat];
      return !m || m.type === "eau" ? SANS_TERRAIN : { eau: false, t: t, m: m };
    }
    return SANS_TERRAIN;
  }

  // Distance d'un point à la voie la plus proche, moins la demi-largeur de cette voie (négatif :
  // sur la voie). La largeur est celle de la carte (`taille`), pas celle dessinée à l'écran.
  function distVoie(ctx, x, y) {
    var best = Infinity;
    for (var i = 0; i < ctx.voies.length; i++) {
      var v = ctx.voies[i], b = v.bb, m = v.m + best;
      if (best < Infinity && (x < b[0] - m || x > b[2] + m || y < b[1] - m || y > b[3] + m)) continue;
      var demi = (v.l.taille || 0) * 0.6;
      for (var q = 0; q + 3 < v.d.length; q += 2) {
        var d = distSeg(x, y, v.d[q], v.d[q + 1], v.d[q + 2], v.d[q + 3]) - demi;
        if (d < best) best = d;
      }
    }
    return best;
  }

  // La zone « Affiner / Gomme à décors » qui couvre ce point (la plus récente), ou null.
  function zoneEn(ctx, x, y) {
    var res = null;
    for (var i = 0; i < ctx.zones.length; i++) {
      var f = ctx.zones[i];
      if (f.rect) { if (x >= f.rect[0] && x <= f.rect[2] && y >= f.rect[1] && y <= f.rect[3]) res = f; continue; }
      var p = f.pts, r = f.taille / 2, ok = false, q;
      if (p.length <= 2) ok = Math.hypot(p[0] - x, p[1] - y) <= r;
      else for (q = 0; q + 3 < p.length && !ok; q += 2) ok = distSeg(x, y, p[q], p[q + 1], p[q + 2], p[q + 3]) <= r;
      if (ok) res = f;
    }
    return res;
  }

  // Réglages d'un point : finesse, densité, taille des décors (la zone prime sur le trait).
  function reglagesEn(q, zone) {
    var t = q.t;
    return {
      fin: Math.min(FINESSE_MAX, zone && zone.fin != null ? zone.fin : (t.fin || 0)),
      dens: zone && zone.dens != null ? zone.dens : (t.sansDecor ? 0 : (t.dens == null ? 2 : t.dens)),
      ech: t.ech == null ? 1 : t.ech
    };
  }

  // ----- Les décors du terrain, décidés une fois pour toutes -----
  //
  // Chaque case des grilles emboîtées (pointCase) porte un emplacement. On décide, pour chacun, en
  // coordonnées du monde, s'il porte un décor : le terrain dessous, sa densité, son écart à la
  // lisière du biome, aux voies. Rien de cela ne dépend du zoom : même décor, même place, même
  // taille en km, à toutes les échelles. Le résultat est gardé par tuile ; quand un objet change
  // (un coup de pinceau, un lac déplacé…), seules les tuiles qu'il touche sont recalculées.
  var TUILE = 24;                                    // côté d'une tuile, en cases
  var CACHE_DECORS = { sig: "", tuiles: new Map(), objets: new Map(), total: 0 };

  function invaliderDecors(bb) {
    CACHE_DECORS.tuiles.forEach(function (tu, cle) {
      if (chevauche(tu.bbm, bb[0], bb[1], bb[2], bb[3])) { CACHE_DECORS.total -= tu.entrees.length + 1; CACHE_DECORS.tuiles.delete(cle); }
    });
  }

  // Compare les objets qui influencent les décors à ce qu'ils étaient au rendu précédent.
  function synchroniserDecors(carte) {
    var C = CACHE_DECORS, sig = [carte.id, carte.largeur, carte.hauteur, zoomBase(carte)].join("|");
    if (C.sig !== sig || C.total > 900000) { C.sig = sig; C.tuiles.clear(); C.objets.clear(); C.total = 0; }
    var vus = {};
    var voir = function (id, signature, bb) {
      vus[id] = true;
      var o = C.objets.get(id);
      if (!o) { C.objets.set(id, { sig: signature, bb: bb }); invaliderDecors(bb); }
      else if (o.sig !== signature) { invaliderDecors(o.bb); invaliderDecors(bb); o.sig = signature; o.bb = bb; }
    };
    var somme = function (p, ini) { var n = ini; for (var i = 0; i < p.length; i++) n += p[i] * (1 + (i % 7) * 0.137); return n; };
    (carte.traits || []).forEach(function (t, i) {
      if (!t.bb) t.bb = boiteTrait(t.pts, t.taille);
      var p = t.pts, mid = p.length >> 2 << 1;
      var m = MAT[t.mat];
      voir("t" + (t.id || i), p.length * 1.1 + t.taille * 7.3 + p[0] + p[p.length - 1] * 3.1 + p[mid] * 1.7 + (t.dens == null ? 9 : t.dens) * 17 + (t.ech == null ? 9 : t.ech) * 29 +
        (t.fin || 0) * 31 + (m ? m.code : 0) * 37 + (t.sansDecor ? 1000 : 0) + (t.rug || 0) * 13, t.bb);
    });
    (carte.lacs || []).forEach(function (l, i) {
      if (l.pts && l.pts.length >= 6) voir("w" + (l.id || i), somme(l.pts, 0), boiteTrait(l.pts, 0));
    });
    (carte.lignes || []).forEach(function (l, i) {
      if (!l.pts || l.pts.length < 4 || (l.type !== "riviere" && !VOIES[l.type])) return;
      var m = (l.taille || 0) * 2;
      voir("l" + (l.id || i), somme(l.pts, (l.taille || 0) * 11 + (l.meandre || 0) * 5 + (l.delta ? 3 : 0) + (l.lisse === false ? 7 : 0) + (l.type === "riviere" ? 1 : 2)),
        (function (bb) { return [bb[0] - m, bb[1] - m, bb[2] + m, bb[3] + m]; })(boiteTrait(l.pts, 0)));
    });
    (carte.finesses || []).forEach(function (f, i) {
      voir("f" + (f.id || i), f.rect ? somme(f.rect, 5 + (f.dens == null ? 9 : f.dens)) : somme(f.pts, f.taille * 3 + (f.fin == null ? 9 : f.fin) + (f.dens == null ? 9 : f.dens) * 7), f.bb || [0, 0, 0, 0]);
    });
    C.objets.forEach(function (o, id) { if (!vus[id]) { invaliderDecors(o.bb); C.objets.delete(id); } });
  }

  // Les arbres qui ne touchent jamais la lisière : au cœur d'une forêt, le sol reste uni.
  var FORET_PROFONDE = { arbre: 1, conifere: 1, automne: 1, tropical: 1, palmier: 1, acacia: 1, mort: 1 };
  // La part des NS directions, à la distance R, où le terrain est le même que celui de `q`.
  function fractionDedans(ctx, carte, q, pt, R, NS, grand) {
    var dans = 0;
    for (var w = 0; w < NS; w++) {
      var an = (w + pt.r3) * 2 * Math.PI / NS, px = pt.x + Math.cos(an) * R, py = pt.y + Math.sin(an) * R * 0.6;
      var qq = sonde(ctx, carte, px, py);
      if (qq.eau || qq.m !== q.m) continue;
      if (grand && distVoie(ctx, px, py) < 0) continue;
      dans++;
    }
    return dans / NS;
  }
  function calculerTuile(carte, k, ti, tj, zb) {
    var D = CASE0 / Math.pow(2, k), x0 = ti * TUILE * D, y0 = tj * TUILE * D, x1 = x0 + TUILE * D, y1 = y0 + TUILE * D, pad = 10 * D;
    var tu = { entrees: [], bbm: [x0 - pad, y0 - pad, x1 + pad, y1 + pad] };
    var ctx = contexteZone(carte, tu.bbm[0], tu.bbm[1], tu.bbm[2], tu.bbm[3]);
    if (!ctx.traits.length) return tu;
    var L = carte.largeur, H = carte.hauteur;
    for (var cj = tj * TUILE; cj < (tj + 1) * TUILE; cj++) {
      for (var ci = ti * TUILE; ci < (ti + 1) * TUILE; ci++) {
        var pt = pointCase(k, ci, cj);
        if (pt.x > L || pt.y > H) continue;
        var q = sonde(ctx, carte, pt.x, pt.y);
        if (q.eau) continue;
        var dd = DECORS[q.m.decor];
        if (!dd || dd.rues) continue;                                 // les villes ont leur propre plan
        var rg = reglagesEn(q, zoneEn(ctx, pt.x, pt.y));
        if (niveauDecor(zb, dd.C, rg.fin) !== k) continue;            // ce terrain est à un autre niveau
        if (pt.r >= dd.p * DENSITES[rg.dens]) continue;
        var ch = dd.choix[0], cumul = 0, n;
        for (n = 0; n < dd.choix.length; n++) { cumul += dd.choix[n][1]; if (pt.r2 < cumul) { ch = dd.choix[n]; break; } }
        // Sa taille dans le monde : proportionnelle à la case, donc fixe.
        var s = ch[2] / dd.C * D * 0.72 * ECHELLES[rg.ech] * (0.82 + 0.36 * pt.r3);
        var grand = ch[2] >= 40;
        if (distVoie(ctx, pt.x, pt.y) < (grand ? 0.45 : 0.22) * s) continue;       // pas sur une voie
        // Un décor se fond dans la lisière de son terrain au lieu de s'arrêter net : à l'intérieur
        // il est plein ; près du bord il s'éclaircit et rapetisse (sujets clairsemés, plus petits).
        var f = fractionDedans(ctx, carte, q, pt, Math.max(dd.marge * s, s * 1.2), 8, grand);
        if (f < 0.25) continue;                                         // sur le bord : rien
        var fond = Math.min(1, (f - 0.25) / 0.6);
        // Au cœur d'une grande forêt (tout autour, à trois tailles d'arbre, le même terrain) :
        // fond uni, sans arbre. Un bosquet, lui, garde tous ses arbres.
        if (fond >= 1 && FORET_PROFONDE[ch[0]] && fractionDedans(ctx, carte, q, pt, s * 3.5, 12, grand) >= 1) continue;
        if (fond < 1 && pt.r2 > fond + 0.1) continue;                     // au bord, seuls quelques sujets restent
        tu.entrees.push({ x: pt.x, y: pt.y, s: s * (0.45 + 0.55 * fond), sprite: ch[0], r: pt.r3, alpha: fond < 1 ? 0.25 + 0.75 * fond : null });
      }
    }
    return tu;
  }

  // Rassemble dans `liste` les décors à dessiner pour cette vue : { x, y, s, sprite, r }.
  // Tous les décors de la carte existent en permanence : la vue ne fait que choisir ceux qu'elle
  // montre. Aucun n'est regroupé, déplacé ou supprimé selon le zoom — un décor trop petit pour
  // se lire (moins d'un pixel) est simplement invisible, et grandit avec le zoom.
  // `tampons` : les décors posés à la main, dont les autres s'écartent.
  // (`masque` ne sert plus qu'à vérifier qu'on dessine pour de vrai, pas pendant un geste.)
  function semerDecors(carte, vue, masque, X0, Y0, X1, Y1, tampons, liste) {
    liste.rues = [];
    if (!masque) return;
    var zoom = vue.zoom, zb = zoomBase(carte), i;
    if (memoCases.size > 400000) memoCases.clear();
    synchroniserDecors(carte);
    // Quels niveaux de cases ? Ceux des terrains visibles, à chacune des finesses présentes.
    var Cs = {}, fins = { 0: true }, ville = false;
    (carte.traits || []).forEach(function (t) {
      var mat = MAT[t.mat], d = mat && DECORS[mat.decor];
      if (!d || t.sansDecor || t.dens === 0 || !t.bb || !chevauche(t.bb, X0, Y0, X1, Y1)) return;
      if (d.rues) ville = true;
      Cs[d.C] = true;
      fins[Math.min(FINESSE_MAX, t.fin || 0)] = true;
    });
    (carte.finesses || []).forEach(function (f) { if (f.fin != null && f.bb && chevauche(f.bb, X0, Y0, X1, Y1)) fins[Math.min(FINESSE_MAX, f.fin)] = true; });
    var niveaux = {};
    Object.keys(Cs).forEach(function (c) { Object.keys(fins).forEach(function (f) { niveaux[niveauDecor(zb, parseFloat(c), parseInt(f, 10))] = true; }); });
    // Une petite grille des tampons, pour s'en écarter sans tout comparer.
    var gt = null, gc = 0;
    if (tampons && tampons.length) {
      gc = 80 / zoom; gt = {};
      tampons.forEach(function (tp) {
        var r = tp.s * 0.42, a0 = Math.floor((tp.x - r) / gc), a1 = Math.floor((tp.x + r) / gc), b0 = Math.floor((tp.y - tp.s * 0.3 - r) / gc), b1 = Math.floor((tp.y + r * 0.4) / gc);
        if ((a1 - a0) * (b1 - b0) > 400) return;
        for (var a = a0; a <= a1; a++) for (var b = b0; b <= b1; b++) { var kk = a + "," + b; (gt[kk] || (gt[kk] = [])).push(tp); }
      });
    }
    var L = carte.largeur, H = carte.hauteur, C = CACHE_DECORS;
    Object.keys(niveaux).forEach(function (cle) {
      var k = parseInt(cle, 10), D = CASE0 / Math.pow(2, k), T = TUILE * D, m = 10 * D;
      var ti0 = Math.max(0, Math.floor((X0 - m) / T)), ti1 = Math.min(Math.floor(L / T), Math.floor((X1 + m) / T));
      var tj0 = Math.max(0, Math.floor((Y0 - m) / T)), tj1 = Math.min(Math.floor(H / T), Math.floor((Y1 + m) / T));
      if ((ti1 - ti0 + 1) * (tj1 - tj0 + 1) > 4000) return;
      for (var tj = tj0; tj <= tj1; tj++) {
        for (var ti = ti0; ti <= ti1; ti++) {
          var cleT = k + "|" + ti + "|" + tj, tu = C.tuiles.get(cleT);
          if (!tu) { tu = calculerTuile(carte, k, ti, tj, zb); C.tuiles.set(cleT, tu); C.total += tu.entrees.length + 1; }
          for (var q = 0; q < tu.entrees.length; q++) {
            var en = tu.entrees[q], s = en.s * ECH_THEME;
            if (s * zoom < 0.7) continue;                                   // plus petit qu'un pixel : invisible
            if (en.x < X0 - s || en.x > X1 + s || en.y < Y0 - s * 0.2 || en.y > Y1 + s) continue;
            if (SANS_DECOR && SANS_DECOR[en.sprite]) continue;
            if (gt) {
              var voisins = gt[Math.floor(en.x / gc) + "," + Math.floor(en.y / gc)], libre = true;
              if (voisins) {
                for (var u = 0; u < voisins.length && libre; u++) {
                  var tp = voisins[u];
                  if (Math.hypot(tp.x - en.x, (tp.y - tp.s * 0.12 - en.y) * 1.3) < tp.s * 0.36 + s * 0.2) libre = false;
                }
                if (!libre) continue;
              }
            }
            liste.push({ x: en.x, y: en.y, s: s, sprite: en.sprite, r: en.r, alpha: en.alpha });
          }
        }
      }
      if (ville) semerVille(carte, zb, zoom, k, X0, Y0, X1, Y1, liste);
    });
  }

  // ----- Villes -----
  //
  // Une ville n'est pas un tas de maisons : elle a des rues, et les maisons les bordent.
  // Le plan est un quadrillage déformé (comme celui des champs : chaque carrefour est
  // déplacé par son hachage, les rues ne sont ni droites ni parallèles). Chaque case est un
  // ÎLOT : ses quatre côtés sont des rues, les maisons s'alignent en rang le long de chacun,
  // tournées vers la rue, et le cœur de l'îlot est une cour — un arbre, une grande bâtisse,
  // parfois l'église sur sa place. Un faubourg a le même plan, en plus lâche : des maisons
  // espacées, des jardins et des parcelles au milieu.
  // Les maisons vont dans `liste` (triées et peintes avec les autres décors) ; les rues dans
  // `liste.rues`, peintes dans la terre avant les décors. Une route tracée par l'auteur
  // reste prioritaire : les maisons s'en écartent.
  // Les carrefours d'une ville sont moins déplacés que ceux des champs : des rues qui se
  // rejoignent sous un angle très aigu feraient deux routes presque confondues.
  var VILLE_GIGUE = 0.4;
  function semerVille(carte, zb, zoom, k, X0, Y0, X1, Y1, liste) {
    var debut = liste.length;
    // Un îlot fait huit cases de côté : quatre maisons le long de chaque rue.
    var kb = k - 3;
    if (kb < 0) return;
    var Dk = CASE0 / Math.pow(2, k), B = CASE0 / Math.pow(2, kb), m = B;
    var ctx = contexteZone(carte, X0 - 3 * B, Y0 - 3 * B, X1 + 3 * B, Y1 + 3 * B);
    if (!ctx.traits.length) return;
    var i0 = Math.max(0, Math.floor((X0 - m) / B)), i1 = Math.min(Math.floor(carte.largeur / B), Math.floor((X1 + m) / B));
    var j0 = Math.max(0, Math.floor((Y0 - m) / B)), j1 = Math.min(Math.floor(carte.hauteur / B), Math.floor((Y1 + m) / B));
    // Ce point est-il en ville (à ce niveau de finesse) ? Renvoie sa fiche, ou null.
    var enVille = function (x, y) {
      var q = sonde(ctx, carte, x, y);
      if (q.eau) return null;
      var dd = DECORS[q.m.decor];
      if (!dd || !dd.rues) return null;
      var rg = reglagesEn(q, zoneEn(ctx, x, y));
      if (!DENSITES[rg.dens]) return null;                            // « Aucun » : pas de ville non plus
      if (niveauDecor(zb, dd.C, rg.fin) !== k) return null;
      return { dd: dd, route: distVoie(ctx, x, y) < Dk * 0.4, ech: ECHELLES[rg.ech], dens: DENSITES[rg.dens], mat: q.m.id };
    };
    for (var cj = j0; cj <= j1; cj++) {
      for (var ci = i0; ci <= i1; ci++) {
        var c = [coinChamp(kb, ci, cj, kb, VILLE_GIGUE), coinChamp(kb, ci + 1, cj, kb, VILLE_GIGUE), coinChamp(kb, ci + 1, cj + 1, kb, VILLE_GIGUE), coinChamp(kb, ci, cj + 1, kb, VILLE_GIGUE)];
        var cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, cy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
        var ici = enVille(cx, cy);
        var h = (ci * 73856093) ^ (cj * 19349663), g = kb * 41 + 3;
        for (var q = 0; q < 4; q++) {
          var a = c[q], b = c[(q + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
          var va = enVille(a[0], a[1]), vb = enVille(b[0], b[1]);
          // La rue : seulement si ses deux bouts sont en ville (elle ne part pas dans les champs).
          if (va && vb && ici) liste.rues.push([a[0], a[1], b[0], b[1], Dk * 0.95, ici.dd.rues.rue]);
          if (!ici) continue;
          // Le rang de maisons de ce côté, en retrait de la rue, vers l'intérieur de l'îlot.
          var nx = -dy / L, ny = dx / L;
          if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
          var N = ici.dd.rues.parCote;
          for (var r = 0; r < N; r++) {
            var hr = alea(g + q * 7 + r, h), t = 0.17 + 0.66 * (N > 1 ? r / (N - 1) : 0.5) + (hr - 0.5) * 0.05;
            if (alea(g + 60 + q * 7 + r, h) < ici.dd.rues.vide) continue;
            var x = a[0] + dx * t + nx * Dk * 1.45, y = a[1] + dy * t + ny * Dk * 1.45;
            var v = enVille(x, y);
            if (!v || v.route || v.mat !== ici.mat || alea(g + 90 + q * 7 + r, h) >= v.dens) continue;
            // (La maison n'occupe que la moitié de la largeur de sa vignette.)
            var s = Dk * 2.9 * v.ech * ECH_THEME * (0.9 + 0.2 * hr);
            if (s * zoom < 0.7) continue;
            if (DESSUS) {
              // Pignon sur rue, le plus souvent ; parfois le long de la rue.
              var long = Dk * 3 * v.ech * (0.85 + 0.5 * hr), travers = alea(g + 150 + q * 7 + r, h) < 0.7;
              liste.push({ x: x + (travers ? nx * Dk * 0.2 : 0), y: y + (travers ? ny * Dk * 0.2 : 0),
                maison: { w: long, h: Dk * 1.84 * v.ech, a: Math.atan2(dy, dx) + (travers ? Math.PI / 2 : 0) + (hr - 0.5) * 0.16, v: Math.floor(alea(g + 120 + q * 7 + r, h) * 40) } });
              continue;
            }
            liste.push({ x: x, y: y + s * 0.16, s: s, sprite: "maison", r: alea(g + 120 + q * 7 + r, h) });
          }
        }
        if (!ici) continue;
        // Le cœur de l'îlot.
        var tirage = alea(g + 200, h), cumul = 0, coeur = ici.dd.rues.coeur;
        for (var n = 0; n < coeur.length; n++) {
          cumul += coeur[n][1];
          if (tirage < cumul) {
            var sc = Dk * coeur[n][2] * ici.ech * ECH_THEME;
            if (DESSUS && (coeur[n][0] === "clocher" || coeur[n][0] === "batisse")) {
              if (!ici.route) liste.push({ x: cx, y: cy, maison: { w: Dk * 2.6 * ici.ech, h: Dk * 1.5 * ici.ech, a: alea(g + 202, h) * Math.PI, v: 5 } });
              break;
            }
            if (DESSUS && coeur[n][0] === "champ") break;
            if (sc * zoom >= 0.7 && !ici.route && tirage / cumul < ici.dens + 0.01) liste.push({ x: cx, y: cy + sc * 0.25, s: sc, sprite: coeur[n][0], r: alea(g + 201, h) });
            break;
          }
        }
      }
    }
    purgerMaisons(liste, debut);
  }

  // Les maisons de ville ne s'écrasent ni sur une rue ni les unes sur les autres : celles qui
  // mordraient sont écartées (test exact, par rectangles orientés ; une grille pour aller vite).
  function purgerMaisons(liste, debut) {
    var rues = liste.rues || [], mais = [], cs = 1e-9;
    for (var i = debut; i < liste.length; i++) if (liste[i].maison) {
      mais.push(liste[i]); cs = Math.max(cs, Math.hypot(liste[i].maison.w, liste[i].maison.h));
    }
    if (!mais.length) return;
    var rectRues = rues.map(function (r) {
      var dx = r[2] - r[0], dy = r[3] - r[1];
      return { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, w: Math.hypot(dx, dy), h: r[4], a: Math.atan2(dy, dx) };
    });
    var grille = {}, ok = new Set();
    mais.forEach(function (o) {
      var p = { x: o.x, y: o.y, w: o.maison.w, h: o.maison.h, a: o.maison.a }, q;
      for (q = 0; q < rectRues.length; q++) if (maisonsSeChevauchent(rectRues[q], p, 0)) return;
      var gx = Math.floor(p.x / cs), gy = Math.floor(p.y / cs);
      for (var ax = gx - 1; ax <= gx + 1; ax++) for (var ay = gy - 1; ay <= gy + 1; ay++) {
        var vs = grille[ax + "," + ay];
        if (vs) for (q = 0; q < vs.length; q++) if (maisonsSeChevauchent(vs[q], p, 0)) return;
      }
      (grille[gx + "," + gy] || (grille[gx + "," + gy] = [])).push(p);
      ok.add(o);
    });
    var garde = liste.slice(debut).filter(function (o) { return !o.maison || ok.has(o); });
    liste.length = debut;
    garde.forEach(function (o) { liste.push(o); });
  }

  // Les rues d'une ville, peintes dans la terre : un bord sombre, la chaussée de terre claire.
  function peindreRues(lc, rues, zoom) {
    if (!rues || !rues.length) return;
    lc.save();
    lc.globalCompositeOperation = "source-atop";
    lc.lineCap = lc.lineJoin = "round";
    [["rgba(70,50,24,0.5)", 1.5], [null, 1]].forEach(function (passe) {
      rues.forEach(function (r) {
        if (r[4] * zoom < 0.7) return;
        lc.strokeStyle = passe[0] || r[5];
        lc.lineWidth = r[4] * passe[1];
        lc.beginPath(); lc.moveTo(r[0], r[1]); lc.lineTo(r[2], r[3]); lc.stroke();
      });
    });
    lc.restore();
    lc.globalCompositeOperation = "source-over";
  }

  // ----- Rues bordées de maisons -----
  //
  // Le tracé « Rue bordée de maisons » est une rue dont on dessine le fil : les maisons se
  // rangent d'elles-mêmes de part et d'autre (ou d'un seul côté), tournées vers la rue —
  // pignon sur rue le plus souvent. Déplacer un point de la rue déplace ses maisons.
  // `l.maison` : taille d'une maison (monde) ; `l.cote` : "deux", "gauche" ou "droite" ;
  // `l.espace` : écart entre maisons (1 = serrées).
  function distSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }

  // Une maison de village mesure environ 9 m de long (et 6,5 m de large) : c'est sa taille
  // réelle, en kilomètres du monde, à tous les zooms — l'échelle graphique la montre en mètres.
  var MAISON_KM = 0.018;
  // Deux maisons (rectangles orientés de longueur w, largeur h, angle a) se recouvrent-elles
  // (à `marge` près) ? Test des axes séparateurs : exact, contrairement à un simple cercle.
  function maisonsSeChevauchent(p, q, marge) {
    var cp = Math.cos(p.a), sp = Math.sin(p.a), cq = Math.cos(q.a), sq = Math.sin(q.a);
    var dx = q.x - p.x, dy = q.y - p.y, axes = [[cp, sp], [-sp, cp], [cq, sq], [-sq, cq]];
    for (var i = 0; i < 4; i++) {
      var ax = axes[i][0], ay = axes[i][1];
      var rp = p.w / 2 * Math.abs(ax * cp + ay * sp) + p.h / 2 * Math.abs(-ax * sp + ay * cp);
      var rq = q.w / 2 * Math.abs(ax * cq + ay * sq) + q.h / 2 * Math.abs(-ax * sq + ay * cq);
      if (Math.abs(dx * ax + dy * ay) > rp + rq + marge) return false;
    }
    return true;
  }

  // Toutes les maisons des rues sont d'abord PROPOSÉES (tout le long de chaque rue, quelle que
  // soit la vue : leur place ne dépend pas de ce qu'on regarde), puis triées : une maison qui
  // mordrait sur une voie (la sienne dans un virage, ou une autre à un carrefour), sur une
  // place ou sur une maison déjà posée est écartée. Les carrefours restent ainsi dégagés.
  function maisonsDesRues(carte, vue, masque, X0, Y0, X1, Y1) {
    var th = THEMES[carte.theme] || THEMES.atlas, voies = [], rues = [], i;
    (carte.lignes || []).forEach(function (l) {
      if (!VOIES[l.type] || !l.pts || l.pts.length < 4) return;
      var d = pointsAffiches(l), st = styleLigne(l, th), lw = Math.max(l.taille || 0, st.min / vue.zoom);
      var vo = { l: l, d: d, lw: lw, bb: boiteTrait(d, 0) };
      voies.push(vo);
      if (l.type === "maisons") rues.push(vo);
    });
    if (!rues.length) return [];
    var places = (carte.tampons || []).filter(function (t) { return t.type === "place"; });
    var ctxH = contexteZone(carte, X0 - 1e9, Y0 - 1e9, X1 + 1e9, Y1 + 1e9);
    var cand = [], Wmax = 0;
    rues.forEach(function (vo) {
      var l = vo.l, d = vo.d, m = d.length / 2, W = l.maison || MAISON_KM;
      if (W * vue.zoom < 0.7) return;
      Wmax = Math.max(Wmax, W);
      // Hors vue (avec une grande marge) : inutile de calculer cette rue.
      var mg = W * 8 + 200 / vue.zoom;
      if (!chevauche(boiteTrait(d, 0), X0 - mg, Y0 - mg, X1 + mg, Y1 + mg)) return;
      var lw = vo.lw, h = hashTexte(String(l.id || ""));
      var cotes = l.cote === "gauche" ? [-1] : l.cote === "droite" ? [1] : [-1, 1];
      var pas = W * 1.45 * (l.espace || 1), prochain = pas * 0.55, parcouru = 0, rang = 0;
      for (var k = 0; k + 1 < m; k++) {
        var dx = d[2 * k + 2] - d[2 * k], dy = d[2 * k + 3] - d[2 * k + 1], L = Math.hypot(dx, dy);
        if (!L) continue;
        while (prochain <= parcouru + L) {
          var f = (prochain - parcouru) / L, x = d[2 * k] + dx * f, y = d[2 * k + 1] + dy * f;
          cotes.forEach(function (cote) {
            var hr = alea(h, rang * 4 + cote + 1), travers = alea(h + 1, rang * 4 + cote + 1) < 0.7;
            if (alea(h + 2, rang * 4 + cote + 1) < 0.08) return;                 // une dent creuse, de temps en temps
            var long = W * (1 + 0.38 * hr), large = W * 0.74, ext = (travers ? long : large) / 2;
            var recul = lw / 2 + ext + W * 0.22;
            cand.push({ x: x - dy / L * cote * recul, y: y + dx / L * cote * recul, w: long, h: large, ext: ext, vo: vo,
              a: Math.atan2(dy, dx) + (travers ? Math.PI / 2 : 0) + (hr - 0.5) * 0.14, v: Math.floor(hr * 40) });
          });
          prochain += pas * (0.9 + 0.25 * alea(h + 3, rang));
          rang++;
        }
        parcouru += L;
      }
    });
    // Le tri : voies, places, puis maisons déjà posées (grille).
    var gardees = [], grille = {}, cell = Math.max(Wmax * 2.4, 1e-9);
    cand.forEach(function (c) {
      var r = Math.hypot(c.w, c.h) / 2 * 0.8, q;
      for (i = 0; i < voies.length; i++) {
        var vo = voies[i], bb = vo.bb, marge = Math.max(c.w, c.h) + vo.lw;
        if (c.x < bb[0] - marge || c.x > bb[2] + marge || c.y < bb[1] - marge || c.y > bb[3] + marge) continue;
        var besoin = vo.lw / 2 + (vo === c.vo ? c.ext : Math.max(c.w, c.h) * 0.45), d2 = vo.d;
        for (q = 0; q + 3 < d2.length; q += 2) if (distSeg(c.x, c.y, d2[q], d2[q + 1], d2[q + 2], d2[q + 3]) < besoin * 0.98) return;
      }
      for (i = 0; i < places.length; i++) if (Math.hypot(c.x - places[i].x, c.y - (places[i].y - places[i].s * 0.3)) < places[i].s * 0.47 + r * 0.5) return;
      var gx = Math.floor(c.x / cell), gy = Math.floor(c.y / cell);
      for (var ax = gx - 1; ax <= gx + 1; ax++) for (var ay = gy - 1; ay <= gy + 1; ay++) {
        var vs = grille[ax + "," + ay];
        if (vs) for (q = 0; q < vs.length; q++) if (maisonsSeChevauchent(vs[q], c, Wmax * 0.04)) return;
      }
      c.r = r;
      (grille[gx + "," + gy] || (grille[gx + "," + gy] = [])).push(c);
      gardees.push(c);
    });
    // Dans la vue, hors de l'eau.
    var out = [];
    gardees.forEach(function (c) {
      var W2 = c.w * 2;
      if (c.x < X0 - W2 || c.x > X1 + W2 || c.y < Y0 - W2 || c.y > Y1 + W2) return;
      if (sonde(ctxH, carte, c.x, c.y).eau) return;
      out.push({ x: c.x, y: c.y, w: c.w, h: c.h, a: c.a, v: c.v });
    });
    return out;
  }

  // Peint les décors (semés et tampons), du fond vers l'avant.
  var FONDS = { place: true };         // décors posés AU SOL : peints avant tout le reste
  function peindreDecors(lc, liste) {
    liste.sort(function (a, b) { return (FONDS[b.sprite] ? 1 : 0) - (FONDS[a.sprite] ? 1 : 0) || a.y - b.y; });
    for (var i = 0; i < liste.length; i++) {
      var o = liste[i];
      if (o.maison) { maisonDessus(lc, o.x, o.y, o.maison.w, o.maison.h, o.maison.a, o.maison.v); continue; }
      // Un décor en fondu (près de la lisière de son terrain) est d'autant transparent.
      var fondu = o.alpha != null && o.alpha < 1;
      if (fondu) { lc.save(); lc.globalAlpha = o.alpha; }
      if (o.rot) {
        // Un décor tourné : on le colle autour de son centre (le dessin est centré à 0,31 s au-dessus de son pied).
        lc.save();
        lc.translate(o.x, o.y - o.s * 0.31);
        lc.rotate(o.rot);
        colle(lc, o.sprite, o.v != null ? o.v % VARIANTES[o.sprite] : variante(o.sprite, o.r), 0, o.s * 0.31, o.s);
        lc.restore();
      } else {
        colle(lc, o.sprite, o.v != null ? o.v % VARIANTES[o.sprite] : variante(o.sprite, o.r), o.x, o.y, o.s);
      }
      if (fondu) lc.restore();
    }
  }

  // ----- Champs -----
  //
  // Le terrain « Champs » est un damier de parcelles : un quadrillage déformé (chaque coin
  // est déplacé par son hachage), où chaque case reçoit une culture — blé, prairie, labour —
  // et ses sillons. Pour que rien ne saute en zoomant, tout est hiérarchique, comme les
  // décors : une parcelle qui se divise transmet d'abord sa couleur à ses quatre filles, qui
  // prennent peu à peu la leur ; les nouveaux coins sortent de leur alignement en douceur ;
  // les sillons des filles apparaissent pendant que ceux de la mère s'effacent.
  var CULTURES = [[214, 196, 92], [150, 178, 70], [196, 160, 86], [124, 160, 62], [226, 210, 122], [168, 136, 84], [176, 192, 84]];

  function coinChamp(k, i, j, kFin, f) {
    while (k > 0 && !(i & 1) && !(j & 1)) { k--; i >>= 1; j >>= 1; }
    var D = CASE0 / Math.pow(2, k), amp = 0.21 * D * (k >= kFin ? f : 1), h = (i * 73856093) ^ (j * 19349663);
    return [i * D + (alea(k * 31 + 5, h) - 0.5) * 2 * amp, j * D + (alea(k * 31 + 6, h) - 0.5) * 2 * amp];
  }
  function cultureDe(k, i, j) { var C = CULTURES_THEME || CULTURES; return C[Math.floor(alea(k * 53 + 9, (i * 73856093) ^ (j * 19349663)) * C.length)]; }
  function cultureDeAncienne(k, i, j) { return CULTURES[Math.floor(alea(k * 53 + 9, (i * 73856093) ^ (j * 19349663)) * CULTURES.length)]; }

  function dessinerChamps(lc, carte, vue, masque, X0, Y0, X1, Y1, encre) {
    if (!masque) return;
    var visible = false, traits = carte.traits || [];
    for (var t = 0; t < traits.length && !visible; t++) if (traits[t].mat === "champs" && traits[t].bb && chevauche(traits[t].bb, X0, Y0, X1, Y1)) visible = true;
    if (!visible) return;
    var zoom = vue.zoom, u = 1 / zoom;
    // Le découpage est fixé par la carte (parcelles d'une quinzaine de pixels à la vue
    // d'ensemble), pas par le zoom : zoomer agrandit les mêmes parcelles.
    var kFin = Math.floor(Math.log(CASE0 * zoomBase(carte) * 2 / (CHAMPS_PX || 30)) / Math.LN2), f = 1;
    if (CASE0 / Math.pow(2, kFin) * zoom < 1.5) return;                  // des parcelles de moins d'un pixel et demi : à peine un grain
    var DC = CASE0 / Math.pow(2, kFin), ctxC = contexteZone(carte, X0 - 3 * DC, Y0 - 3 * DC, X1 + 3 * DC, Y1 + 3 * DC);
    var enChamp = function (x, y) { var q = sonde(ctxC, carte, x, y); return !q.eau && q.m.id === "champs"; };
    var polygone = function (c) {
      lc.beginPath();
      lc.moveTo(c[0][0], c[0][1]); lc.lineTo(c[1][0], c[1][1]); lc.lineTo(c[2][0], c[2][1]); lc.lineTo(c[3][0], c[3][1]);
      lc.closePath();
    };
    // Les sillons d'une parcelle : des traits parallèles, dans un sens tiré au hasard.
    var sillons = function (c, k, i, j, D, alpha) {
      if (alpha < 0.04) return;
      var h = (i * 73856093) ^ (j * 19349663), ang = Math.floor(alea(k * 17 + 3, h) * 4) * Math.PI / 4 + (alea(k * 17 + 4, h) - 0.5) * 0.3;
      var cx = (c[0][0] + c[2][0]) / 2, cy = (c[0][1] + c[2][1]) / 2, pas = D / 7, dx = Math.cos(ang), dy = Math.sin(ang);
      lc.save();
      polygone(c); lc.clip();
      lc.globalAlpha = alpha;
      lc.strokeStyle = "rgba(70,56,14,0.5)";
      lc.lineWidth = Math.max(0.7 * u, pas * 0.16);
      lc.beginPath();
      for (var q = -7; q <= 7; q++) {
        var ox = cx - dy * q * pas, oy = cy + dx * q * pas;
        lc.moveTo(ox - dx * D, oy - dy * D); lc.lineTo(ox + dx * D, oy + dy * D);
      }
      lc.stroke();
      lc.restore();
    };
    var D = CASE0 / Math.pow(2, kFin), m = D;
    var i0 = Math.max(0, Math.floor((X0 - m) / D)), i1 = Math.min(Math.floor(carte.largeur / D), Math.floor((X1 + m) / D));
    var j0 = Math.max(0, Math.floor((Y0 - m) / D)), j1 = Math.min(Math.floor(carte.hauteur / D), Math.floor((Y1 + m) / D));
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 60000) return;
    lc.save();
    lc.globalCompositeOperation = "source-atop";
    lc.lineJoin = "round";
    var cases = [], meres = {};
    for (var cj = j0; cj <= j1; cj++) {
      for (var ci = i0; ci <= i1; ci++) {
        var c = [coinChamp(kFin, ci, cj, kFin, f), coinChamp(kFin, ci + 1, cj, kFin, f), coinChamp(kFin, ci + 1, cj + 1, kFin, f), coinChamp(kFin, ci, cj + 1, kFin, f)];
        if (CULTURES_THEME) {
          // Vue du dessus : chaque parcelle est en retrait, une bande d'herbe les sépare.
          var mx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, my = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
          c = c.map(function (q) { return [mx + (q[0] - mx) * 0.88, my + (q[1] - my) * 0.88]; });
        }
        // Toute la parcelle doit être dans les champs : la lisière reste un simple fondu.
        if (!enChamp(c[0][0], c[0][1]) || !enChamp(c[1][0], c[1][1]) || !enChamp(c[2][0], c[2][1]) || !enChamp(c[3][0], c[3][1])) continue;
        var a = cultureDe(kFin - 1, ci >> 1, cj >> 1), b = cultureDe(kFin, ci, cj);
        polygone(c);
        lc.fillStyle = "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," + Math.round(a[1] + (b[1] - a[1]) * f) + "," + Math.round(a[2] + (b[2] - a[2]) * f) + ")";
        lc.globalAlpha = 0.86;
        lc.fill();
        cases.push([c, ci, cj]);
        meres[(ci >> 1) + "," + (cj >> 1)] = [ci >> 1, cj >> 1];
      }
    }
    // Sillons : ceux des mères s'effacent, ceux des filles apparaissent.
    Object.keys(meres).forEach(function (cle) {
      var mi = meres[cle][0], mj = meres[cle][1];
      var c = [coinChamp(kFin, 2 * mi, 2 * mj, kFin, f), coinChamp(kFin, 2 * mi + 2, 2 * mj, kFin, f), coinChamp(kFin, 2 * mi + 2, 2 * mj + 2, kFin, f), coinChamp(kFin, 2 * mi, 2 * mj + 2, kFin, f)];
      if (!enChamp(c[0][0], c[0][1]) || !enChamp(c[1][0], c[1][1]) || !enChamp(c[2][0], c[2][1]) || !enChamp(c[3][0], c[3][1])) return;
      sillons(c, kFin - 1, mi, mj, D * 2, 1 - f);
    });
    cases.forEach(function (e) { sillons(e[0], kFin, e[1], e[2], D, f); });
    // Les haies : le bord des parcelles. Celles qui séparent deux mères sont déjà là ; les
    // nouvelles apparaissent avec la division.
    cases.forEach(function (e) {
      var c = e[0], ci = e[1], cj = e[2];
      for (var q = 0; q < 4; q++) {
        var ancienne = q === 0 ? !(cj & 1) : q === 1 ? !!(ci & 1) : q === 2 ? !!(cj & 1) : !(ci & 1);
        lc.globalAlpha = ancienne ? 1 : f;
        if (CULTURES_THEME) lc.globalAlpha = 1;
        lc.strokeStyle = CULTURES_THEME ? "#1c2622" : encre ? "rgba(40,48,10,0.62)" : "rgba(64,72,24,0.42)";
        lc.lineWidth = (encre ? 1.5 : 1.2) * u;
        lc.beginPath(); lc.moveTo(c[q][0], c[q][1]); lc.lineTo(c[(q + 1) % 4][0], c[(q + 1) % 4][1]); lc.stroke();
      }
    });
    lc.restore();
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = "source-over";
  }

  // ----- Fissures de lave -----
  //
  // Sur les terres volcaniques, un réseau de fissures rougeoyantes. Il s'appuie sur les mêmes
  // cases emboîtées que les décors : chaque emplacement est relié à celui de la case qui le
  // contient, au niveau au-dessus — d'où un réseau en ARBRE, de grosses coulées qui se
  // ramifient en fissures de plus en plus fines. En zoomant, les coulées restent en place,
  // s'épaississent doucement, et de nouvelles ramifications apparaissent en fondu.
  function fissuresLave(lc, carte, vue, masque, X0, Y0, X1, Y1) {
    if (!masque) return;
    var volcan = MAT.volcan, visible = false, traits = carte.traits || [];
    for (var t = 0; t < traits.length && !visible; t++) if (traits[t].mat === "volcan" && traits[t].bb && chevauche(traits[t].bb, X0, Y0, X1, Y1)) visible = true;
    if (!visible) return;
    var zoom = vue.zoom, u = 1 / zoom;
    // Réseau fixé par la carte : mêmes fissures, de même largeur (en km), à tous les zooms.
    var zr = zoomBase(carte) * 2, niveauReel = Math.floor(Math.log(CASE0 * zr / 46) / Math.LN2), kFin = niveauReel, f = 1;
    u = 1 / zr;
    var DL = CASE0 / Math.pow(2, Math.max(1, kFin - 5)), ctxL = contexteZone(carte, X0 - 2 * DL, Y0 - 2 * DL, X1 + 2 * DL, Y1 + 2 * DL);
    var surLave = function (x, y) { var q = sonde(ctxL, carte, x, y); return !q.eau && q.m.id === "volcan"; };
    var segments = [];
    for (var k = Math.max(1, kFin - 5); k <= kFin; k++) {
      var D = CASE0 / Math.pow(2, k), m = D * 2;
      var i0 = Math.max(0, Math.floor((X0 - m) / D)), i1 = Math.min(Math.floor(carte.largeur / D), Math.floor((X1 + m) / D));
      var j0 = Math.max(0, Math.floor((Y0 - m) / D)), j1 = Math.min(Math.floor(carte.hauteur / D), Math.floor((Y1 + m) / D));
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) continue;
      var age = niveauReel - k;                       // 0 : tout juste née ; grandit avec le zoom
      var largeur = Math.min(7, 1.3 * Math.pow(1.55, age)) * u, alpha = 1;
      if (largeur * zoom < 0.45) continue;            // trop fine pour être vue à ce zoom
      for (var cj = j0; cj <= j1; cj++) {
        for (var ci = i0; ci <= i1; ci++) {
          var p = pointCase(k, ci, cj);
          if (p.k !== k || p.r2 > 0.7) continue;      // un emplacement hérité est déjà relié plus haut
          var q = pointCase(k - 1, ci >> 1, cj >> 1);
          if (!surLave(p.x, p.y) || !surLave(q.x, q.y)) continue;
          // Deux coudes entre les deux bouts : une fissure, pas un trait à la règle.
          var dx = q.x - p.x, dy = q.y - p.y, e = Math.hypot(dx, dy) * 0.22;
          var ax = p.x + dx * 0.33 - dy / (e * 4.5 || 1) * e * (p.r - 0.5) * 2, ay = p.y + dy * 0.33 + dx / (e * 4.5 || 1) * e * (p.r - 0.5) * 2;
          var bx = p.x + dx * 0.67 - dy / (e * 4.5 || 1) * e * (p.r3 - 0.5) * 2, by = p.y + dy * 0.67 + dx / (e * 4.5 || 1) * e * (p.r3 - 0.5) * 2;
          if (!surLave(ax, ay) || !surLave(bx, by)) continue;
          segments.push({ pts: [p.x, p.y, ax, ay, bx, by, q.x, q.y], w: largeur, a: alpha });
        }
      }
    }
    if (!segments.length) return;
    lc.save();
    lc.lineCap = lc.lineJoin = "round";
    // Trois passes : la roche brûlée autour, la lave, puis son cœur incandescent.
    [["rgba(58,26,8,0.6)", 2.6], ["#e2560f", 1.25], ["#ffc23a", 0.5]].forEach(function (passe) {
      segments.forEach(function (sg) {
        lc.globalAlpha = sg.a;
        lc.strokeStyle = passe[0];
        lc.lineWidth = sg.w * passe[1];
        lc.beginPath();
        lc.moveTo(sg.pts[0], sg.pts[1]);
        for (var n = 2; n < 8; n += 2) lc.lineTo(sg.pts[n], sg.pts[n + 1]);
        lc.stroke();
      });
    });
    lc.restore();
    lc.globalAlpha = 1;
  }

  // ----- Texture du sol -----
  //
  // Un aplat de couleur reste plat quand on s'en approche. On lui ajoute de légères marbrures
  // accrochées au MONDE (elles suivent le déplacement et le zoom), à deux échelles fondues
  // l'une dans l'autre : en zoomant, les marbrures grossissent, pâlissent, et de plus fines
  // prennent le relais — le sol a toujours du grain, à toutes les distances.
  var tuileSol = null;
  function motifSol(ctx) {
    if (!tuileSol) {
      var c = document.createElement("canvas"), T = 256;
      c.width = c.height = T;
      var g = c.getContext("2d"), i, x, y, r, rg;
      for (i = 0; i < 46; i++) {
        x = alea(31, i * 5) * T; y = alea(31, i * 5 + 1) * T; r = 14 + alea(31, i * 5 + 2) * 46;
        var clair = alea(31, i * 5 + 3) > 0.5, a = 0.05 + alea(31, i * 5 + 4) * 0.07;
        [-T, 0, T].forEach(function (dx) {
          [-T, 0, T].forEach(function (dy) {
            rg = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
            rg.addColorStop(0, clair ? "rgba(255,250,214," + a + ")" : "rgba(40,36,10," + a + ")");
            rg.addColorStop(1, clair ? "rgba(255,250,214,0)" : "rgba(40,36,10,0)");
            g.fillStyle = rg;
            g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
          });
        });
      }
      for (i = 0; i < 900; i++) {
        g.fillStyle = alea(33, i * 3) > 0.5 ? "rgba(255,255,230,0.09)" : "rgba(30,30,0,0.09)";
        g.fillRect(alea(33, i * 3 + 1) * T, alea(33, i * 3 + 2) * T, 1.5, 1.5);
      }
      tuileSol = c;
    }
    return ctx.createPattern(tuileSol, "repeat");
  }

  function textureSol(lc, tx, ty, z, pw, ph) {
    if (typeof DOMMatrix === "undefined") return;
    var motif = motifSol(lc);
    if (!motif.setTransform) return;
    var niveauReel = Math.log(CASE0 * z / 300) / Math.LN2, k = Math.floor(niveauReel), f = niveauReel - k;
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = "source-atop";
    [[k, 1 - f], [k + 1, f]].forEach(function (n) {
      var e = CASE0 / Math.pow(2, n[0]) * z / 256;
      motif.setTransform(new DOMMatrix([e, 0, 0, e, tx, ty]));
      lc.globalAlpha = n[1];
      lc.fillStyle = motif;
      lc.fillRect(0, 0, pw, ph);
    });
    lc.restore();
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = "source-over";
  }

  // Les terrains se fondent les uns dans les autres : la couche de terre est recopiée
  // floutée PAR-DESSUS elle-même (« source-atop » : seulement là où il y a déjà de la
  // terre), si bien que les couleurs se mélangent aux frontières alors que la côte, elle,
  // reste nette. Le fondu vaut à peu près 1/600 de la carte, borné à l'écran.
  function fondreTransitions(lc, cvT, carte, z, dpr, pw, ph, cle) {
    if (!("filter" in lc)) return;
    var flou = Math.min(22 * dpr, Math.max(2 * dpr, Math.max(carte.largeur, carte.hauteur) / 600 * z));
    var copie = couche(cle + "-fondu", pw, ph);
    var cc = copie.getContext("2d");
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.clearRect(0, 0, pw, ph);
    cc.drawImage(cvT, 0, 0);
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = "source-atop";
    lc.filter = "blur(" + flou.toFixed(1) + "px)";
    lc.drawImage(copie, 0, 0);
    lc.restore();
    lc.filter = "none";
    lc.globalCompositeOperation = "source-over";
  }

  // ----- Grain du papier, posé sur la terre -----
  var grain = null;
  function motifGrain(ctx) {
    if (!grain) {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var g = c.getContext("2d");
      for (var i = 0; i < 2600; i++) {
        var clair = alea(7, i * 3) > 0.5;
        g.fillStyle = clair ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
        var x = alea(7, i * 3 + 1) * 128, y = alea(7, i * 3 + 2) * 128;
        g.fillRect(x, y, 1.6, 1.6);
      }
      grain = c;
    }
    return ctx.createPattern(grain, "repeat");
  }

  // Canvas de travail, gardés d'un rendu au suivant (une réallocation par image
  // serait visible). `cle` sépare l'écran principal des rendus ponctuels.
  var travail = {};
  function couche(cle, w, h) {
    var c = travail[cle];
    if (!c) c = travail[cle] = document.createElement("canvas");
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  // Dessine `src` avec une ombre portée : l'astuce du décalage fait dessiner
  // l'ombre seule, à l'endroit exact de la silhouette.
  function ombre(ctx, src, couleur, flou, dx, dy, decale) {
    ctx.save();
    ctx.shadowColor = couleur;
    ctx.shadowBlur = flou;
    ctx.shadowOffsetX = decale + dx;
    ctx.shadowOffsetY = dy;
    ctx.drawImage(src, -decale, 0);
    ctx.restore();
  }

  // Un halo : l'ombre floue de la silhouette de la terre. Un flou est une basse fréquence : on le
  // calcule sur une image réduite (jusqu'à 16 fois moins de pixels pour un flou de 90 px, et un flou
  // de 90 px est ce qui coûtait le plus cher du rendu), puis on l'étire. Le résultat ne se distingue
  // pas de l'original. `memo` garde, pour ce rendu, les silhouettes déjà réduites.
  function halo(ctx, cvT, couleur, rayons, pw, ph) {
    var groupes = {}, memo = {};
    rayons.forEach(function (r) { var F = Math.max(1, Math.min(4, Math.round(r / 12))); (groupes[F] || (groupes[F] = [])).push(r); });
    Object.keys(groupes).forEach(function (cle) {
      var F = parseInt(cle, 10), liste = groupes[F];
      if (F === 1) { liste.forEach(function (r) { ombre(ctx, cvT, couleur, r, 0, 0, pw + 64); }); return; }
      var w = Math.max(1, Math.ceil(pw / F)), h = Math.max(1, Math.ceil(ph / F)), src = memo[F];
      if (!src) {
        src = memo[F] = couche("halo-src" + F, w, h);
        var sc = src.getContext("2d");
        sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = "source-over"; sc.clearRect(0, 0, w, h);
        sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = "medium";
        sc.drawImage(cvT, 0, 0, w, h);
      }
      // Les halos de même couleur et de même finesse s'additionnent sur la même petite image,
      // qu'on n'étire qu'une fois.
      var bas = couche("halo-bas" + F, w, h), bc = bas.getContext("2d");
      bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, w, h);
      liste.forEach(function (r) { ombre(bc, src, couleur, r / F, 0, 0, w + 64); });
      ctx.save();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";       // un halo est flou : un filtre simple suffit
      ctx.drawImage(bas, 0, 0, pw, ph);
      ctx.restore();
    });
  }

  // ----- Lignes : rivières, routes, frontières -----
  function styleLigne(l, th) {
    if (l.type === "riviere") return { c: l.couleur || th.riviere, tiret: null, lisse: l.lisse !== false, min: 1.4, halo: false };
    if (l.type === "maisons") return { c: l.couleur || th.voie || "#d2bb86", tiret: null, lisse: true, min: 2, halo: false };
    if (l.type === "route") return { c: l.couleur || th.voie || "#d6bd84", tiret: null, lisse: l.lisse !== false, min: 3, halo: false };
    if (l.type === "pavee") return { c: l.couleur || "#bdb6a6", tiret: null, lisse: true, min: 2.6, halo: false };
    if (l.type === "sentier") return { c: l.couleur || th.voie || "#c2a56c", tiret: null, lisse: true, min: 2, halo: false };
    if (l.type === "falaise") return { c: l.couleur || "#4a3620", tiret: null, lisse: true, min: 1.2, halo: false };
    if (l.type === "ponton") return { c: l.couleur || "#a98558", tiret: null, lisse: false, min: 3, halo: false };
    if (l.type === "maritime") return { c: l.couleur || th.texteMer, tiret: [3.2, 3.2], lisse: true, min: 1.3, halo: false };
    if (l.type === "muraille") return { c: l.couleur || "#c9c2b0", tiret: null, lisse: false, min: 3, halo: false };
    return { c: l.couleur || "#8a2b2b", tiret: [5, 2.2, 1.2, 2.2], lisse: !!l.lisse, min: 1.6, halo: true };
  }

  function cheminLigne(ctx, p, lisse) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (!lisse || p.length < 6) {
      for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      return;
    }
    for (var j = 2; j < p.length - 2; j += 2) {
      ctx.quadraticCurveTo(p[j], p[j + 1], (p[j] + p[j + 2]) / 2, (p[j + 1] + p[j + 3]) / 2);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  }

  // ----- Rivières qui serpentent -----
  //
  // Le tracé posé par l'auteur ne donne que le cours général : le moteur le lisse
  // (Catmull-Rom, qui passe par les points posés) puis y ajoute des méandres, deux
  // ondes de longueurs voisines, dont la longueur d'onde suit la largeur de la
  // rivière — comme dans la nature, où un méandre mesure une douzaine de largeurs.
  // Le décalage s'éteint aux deux bouts : la source et l'embouchure restent où
  // l'on a cliqué. Tout est déterministe (graine = identifiant), donc stable.
  var cacheRivieres = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function hashTexte(t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  }

  function catmull(a, b, c, d, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }

  function serpenter(l, force) {
    var p = l.pts, n = p.length / 2, i, s;
    var dense = [];
    for (i = 0; i < n - 1; i++) {
      var i0 = i > 0 ? i - 1 : i, i3 = i + 2 < n ? i + 2 : i + 1;
      for (s = 0; s < 14; s++) {
        var t = s / 14;
        dense.push(catmull(p[2 * i0], p[2 * i], p[2 * i + 2], p[2 * i3], t),
                   catmull(p[2 * i0 + 1], p[2 * i + 1], p[2 * i + 3], p[2 * i3 + 1], t));
      }
    }
    dense.push(p[2 * n - 2], p[2 * n - 1]);
    var m = dense.length / 2, cum = [0];
    for (i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(dense[2 * i] - dense[2 * i - 2], dense[2 * i + 1] - dense[2 * i - 1]);
    var total = cum[m - 1];
    if (!(total > 0)) return p;

    var onde = Math.max((l.taille || 1) * 14, total / 60);
    var amp = onde * 0.26 * force;
    var ph3 = alea(hashTexte(String(l.id || "")), 3) * TAU;
    var h = hashTexte(String(l.id || "")), ph1 = alea(h, 1) * TAU, ph2 = alea(h, 2) * TAU;
    var out = [];
    for (i = 0; i < m; i++) {
      var a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
      var tx = dense[2 * b] - dense[2 * a], ty = dense[2 * b + 1] - dense[2 * a + 1];
      var tl = Math.hypot(tx, ty) || 1;
      var env = Math.min(1, cum[i] / (onde * 0.8), (total - cum[i]) / (onde * 0.8));
      env = env * env * (3 - 2 * env);
      // Des méandres inégaux : amples par endroits, presque droits ailleurs, comme un vrai
      // cours d'eau — une onde lente module l'amplitude des deux autres.
      var module = 0.45 + 0.85 * (0.5 + 0.5 * Math.sin(cum[i] / (onde * 4.3) * TAU + ph3));
      var off = amp * env * module * (Math.sin(cum[i] / onde * TAU + ph1) * 0.75 + Math.sin(cum[i] / (onde * 0.57) * TAU + ph2) * 0.25);
      out.push(dense[2 * i] - ty / tl * off, dense[2 * i + 1] + tx / tl * off);
    }
    return out;
  }

  // Les points tels qu'ils sont dessinés (et donc tels qu'on les clique).
  // Force des méandres : une rivière la règle (0 = droite) ; routes et sentiers ondulent
  // légèrement d'eux-mêmes, comme un chemin tracé à la main plutôt qu'à la règle.
  function forceMeandres(l) {
    if (l.type === "riviere") return l.meandre || 0;
    if (l.type === "route") return typeof l.meandre === "number" ? l.meandre : 0.16;
    if (l.type === "pavee") return typeof l.meandre === "number" ? l.meandre : 0.06;
    if (l.type === "sentier") return typeof l.meandre === "number" ? l.meandre : 0.26;
    if (l.type === "maisons") return typeof l.meandre === "number" ? l.meandre : 0;
    return 0;
  }

  function pointsAffiches(l) {
    if (!l.pts || l.pts.length < 4) return l.pts;
    // Routes, sentiers et rivières passent tous par le lissage (et leurs méandres).
    // Falaises et routes maritimes aussi, mais sans méandres : une simple courbe.
    if (!VOIES[l.type] && l.type !== "riviere" && l.type !== "falaise" && l.type !== "maritime") return l.pts;
    if ((l.type === "falaise" || l.type === "maritime") && l.lisse === false) return l.pts;
    var force = forceMeandres(l);
    var cle = l.pts.join(",") + "|" + force + "|" + l.taille + "|" + l.id;
    var c = cacheRivieres && cacheRivieres.get(l);
    if (c && c.cle === cle) return c.out;
    var out = serpenter(l, force);
    if (cacheRivieres) cacheRivieres.set(l, { cle: cle, out: out });
    return out;
  }

  // La forme d'une rivière, tracée avec le style courant du contexte : elle s'élargit de la
  // source (35 %) à l'embouchure (125 %), par tronçons. Sert à creuser la terre, à peindre
  // l'eau douce et à remplir le masque — une seule forme pour les trois.
  // `extra` : largeur ajoutée ; `min` : largeur minimale (unités du monde).
  function traceRiviereEau(c, l, vue, extra, min) {
    var d = pointsAffiches(l), m = d.length / 2;
    if (m < 2) return;
    var lw = Math.max(l.taille || 0, 1.4 / vue.zoom);
    c.lineCap = c.lineJoin = "round";
    c.setLineDash([]);
    c.fillStyle = c.strokeStyle;
    // Un filet continu, de la largeur minimale : la rivière n'est jamais interrompue.
    c.lineWidth = Math.max(l.delta ? lw * 0.18 : lw, min || 0) + (extra || 0);
    c.beginPath();
    c.moveTo(d[0], d[1]);
    for (var j = 1; j < m; j++) c.lineTo(d[2 * j], d[2 * j + 1]);
    c.stroke();
    if (!l.delta) return;
    // Le corps de la rivière : un ruban dont la largeur croît de la source (un filet) à
    // l'embouchure, sans paliers, et ondule un peu — des biefs larges, des passages resserrés.
    var h = hashTexte(String(l.id || "")), p1 = alea(h, 7) * TAU, p2 = alea(h, 8) * TAU;
    var cum = [0], i;
    for (i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(d[2 * i] - d[2 * i - 2], d[2 * i + 1] - d[2 * i - 1]);
    var total = cum[m - 1] || 1, gauche = [], droite = [];
    for (i = 0; i < m; i++) {
      var t = cum[i] / total;
      var w = lw * (0.18 + 1.07 * Math.pow(t, 0.75)) * (1 + 0.16 * Math.sin(cum[i] / (lw * 9) + p1) + 0.08 * Math.sin(cum[i] / (lw * 3.7) + p2));
      w = Math.max(w, min || 0) + (extra || 0);
      var a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
      var tx = d[2 * b] - d[2 * a], ty = d[2 * b + 1] - d[2 * a + 1], tl = Math.hypot(tx, ty) || 1;
      gauche.push(d[2 * i] - ty / tl * w / 2, d[2 * i + 1] + tx / tl * w / 2);
      droite.push(d[2 * i] + ty / tl * w / 2, d[2 * i + 1] - tx / tl * w / 2);
      if (i === m - 1) { c.beginPath(); c.arc(d[2 * i], d[2 * i + 1], w / 2, 0, TAU); c.fill(); }   // l'embouchure, arrondie
    }
    c.beginPath();
    c.moveTo(gauche[0], gauche[1]);
    for (i = 1; i < m; i++) c.lineTo(gauche[2 * i], gauche[2 * i + 1]);
    for (i = m - 1; i >= 0; i--) c.lineTo(droite[2 * i], droite[2 * i + 1]);
    c.closePath();
    c.fill();
  }

  // Lacs et rivières CREUSENT la terre, exactement comme la mer : la côte, le halo d'eau
  // peu profonde et la falaise les bordent d'eux-mêmes, et là où une rivière (ou un lac)
  // touche la mer, il n'y a plus de frontière — c'est la même eau.
  function creuserEaux(lc, carte, vue, X0, Y0, X1, Y1) {
    lc.globalCompositeOperation = "destination-out";
    lc.fillStyle = lc.strokeStyle = "#000";
    (carte.lacs || []).forEach(function (lac) {
      if (lac.pts && lac.pts.length >= 6 && cheminFerme(lc, lac.pts)) lc.fill();
    });
    (carte.lignes || []).forEach(function (l) {
      if (l.type !== "riviere" || !l.pts || l.pts.length < 4) return;
      traceRiviereEau(lc, l, vue, 0, 1.3 / vue.zoom);
    });
    lc.globalCompositeOperation = "source-over";
  }

  // Sous la terre (donc visible seulement là où elle est creusée) : l'eau douce, pour les
  // thèmes dont la « mer » est du papier. Sans elle, un lac du style Illustré aurait un
  // cœur de parchemin. Le thème Atlas n'en a pas besoin : sa mer est déjà bleue.
  function eauxDouces(ctx, carte, vue, th, X0, Y0, X1, Y1) {
    if (!th.eauDouce) return;
    (carte.lacs || []).forEach(function (lac) {
      if (!lac.pts || lac.pts.length < 6) return;
      var bb = boiteTrait(lac.pts, 0);
      if (!chevauche(bb, X0, Y0, X1, Y1)) return;
      var cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, ray = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2;
      var gr = ctx.createRadialGradient(cx - ray * 0.2, cy - ray * 0.25, ray * 0.05, cx, cy, ray * 1.05);
      gr.addColorStop(0, th.lacClair);
      gr.addColorStop(1, th.eauDouce);
      if (cheminFerme(ctx, lac.pts)) {
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.strokeStyle = th.eauDouce;
        ctx.lineWidth = 4 / vue.zoom;
        ctx.stroke();
      }
    });
    ctx.strokeStyle = th.eauDouce;
    (carte.lignes || []).forEach(function (l) {
      if (l.type !== "riviere" || !l.pts || l.pts.length < 4) return;
      traceRiviereEau(ctx, l, vue, 3 / vue.zoom, 1.3 / vue.zoom);
    });
  }

  // Muraille : ombre au sol, contour, pierre, créneaux en tirets sur le faîte, puis des
  // tours à toit conique aux deux bouts et tous les neuf largeurs. Les tours
  // grandissent avec le zoom ; trop petites, elles disparaissent.
  // Un ponton : des planches en travers, deux rives de bois, des pieux enfoncés de chaque côté
  // et son ombre sur l'eau. On le trace de la berge vers le large.
  function tracerPonton(ctx, l, st, lw, vue) {
    var p = l.pts, zoom = vue.zoom, px = lw * zoom;
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    var chemin = function (q) { cheminLigne(ctx, q || p, false); };
    ctx.save(); ctx.translate(lw * 0.22, lw * 0.3);
    chemin(); ctx.strokeStyle = "rgba(8,30,44,0.35)"; ctx.lineWidth = lw * 1.1; ctx.stroke();
    ctx.restore();
    chemin(); ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw + 2 / zoom; ctx.stroke();
    chemin(); ctx.strokeStyle = st.c; ctx.lineWidth = lw; ctx.stroke();
    if (px >= 5) {
      chemin(); ctx.strokeStyle = "rgba(58,36,14,0.55)"; ctx.lineWidth = lw * 0.96;
      ctx.setLineDash([Math.max(0.5 / zoom, lw * 0.045), lw * 0.2]); ctx.stroke(); ctx.setLineDash([]);
      chemin(); ctx.strokeStyle = "rgba(255,236,200,0.18)"; ctx.lineWidth = lw * 0.3; ctx.stroke();
    }
    if (px >= 7) {
      ctx.lineCap = "round";
      [-1, 1].forEach(function (c) {
        chemin(decaler(p, c * lw * 0.52)); ctx.strokeStyle = "#2a1a0b"; ctx.lineWidth = lw * 0.22;
        ctx.setLineDash([0.001, lw * 1.3]); ctx.stroke();
      });
      ctx.setLineDash([]);
    }
  }

  // ----- Murailles -----
  //
  // Une muraille s'ouvre d'elle-même là où une route ou un chemin la traverse : le mur est
  // interrompu et une porte — deux tours de garde de part et d'autre de la voie — prend sa
  // place. Les tours d'angle et d'intervalle ne sont posées qu'ailleurs. `l.portes = false`
  // supprime les portes ; `l.ecartTours` (en largeurs de mur) règle l'écart des tours.
  // Vue du dessus (thème `dessus`), le mur est une bande de pierre à créneaux et ses tours
  // sont rondes, à toit conique vu d'en haut ; sinon, les tours de profil de toujours.
  function cumulChemin(p) {
    var m = p.length / 2, cum = [0];
    for (var i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
    return { d: p, cum: cum, m: m, total: cum[m - 1] };
  }

  // Les portes d'une muraille : [{ s (abscisse sur le mur), G (largeur de l'ouverture) }].
  function portesMuraille(carte, l, lw, vue, th) {
    if (!carte || l.portes === false || !l.pts || l.pts.length < 4) return [];
    var ch = cumulChemin(l.pts), out = [], p = l.pts;
    (carte.lignes || []).forEach(function (v) {
      if (!VOIES[v.type] || !v.pts || v.pts.length < 4) return;
      var d = pointsAffiches(v), vw = Math.max(v.taille || 0, styleLigne(v, th).min / vue.zoom);
      for (var i = 0; i + 1 < ch.m; i++) {
        var ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * i + 2], by = p[2 * i + 3], L = ch.cum[i + 1] - ch.cum[i];
        if (!L) continue;
        var x0 = Math.min(ax, bx) - vw, x1 = Math.max(ax, bx) + vw, y0 = Math.min(ay, by) - vw, y1 = Math.max(ay, by) + vw;
        var r1x = bx - ax, r1y = by - ay;
        for (var j = 0; j + 3 < d.length; j += 2) {
          var cx = d[j], cy = d[j + 1], ex = d[j + 2], ey = d[j + 3];
          if (Math.max(cx, ex) < x0 || Math.min(cx, ex) > x1 || Math.max(cy, ey) < y0 || Math.min(cy, ey) > y1) continue;
          var r2x = ex - cx, r2y = ey - cy, den = r1x * r2y - r1y * r2x;
          if (Math.abs(den) < 1e-12) continue;
          var t = ((cx - ax) * r2y - (cy - ay) * r2x) / den, u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          out.push({ s: ch.cum[i] + t * L, vw: vw });
        }
      }
    });
    out.sort(function (a, b) { return a.s - b.s; });
    var res = [];
    out.forEach(function (g) {
      g.G = Math.max(lw * 2.8, g.vw * 2.4 + lw * 1.2);
      var der = res[res.length - 1];
      if (der && g.s - der.s < (g.G + der.G) / 2 + lw) return;           // une seule porte par franchissement
      res.push(g);
    });
    return res;
  }

  // Une tour vue du dessus : ombre, cerne, pierre, couronne de créneaux, toit à pans.
  // `carre` : tour de garde d'une porte (carrée, tournée de `ang`) ; sinon tour ronde.
  function tourDessus(ctx, x, y, r, carre, ang, pierre, toit, zoom) {
    var forme = function (k) {
      ctx.beginPath();
      if (carre) {
        var c = Math.cos(ang), sn = Math.sin(ang), q = r * k;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (m, n) {
          var X = x + c * m[0] * q - sn * m[1] * q, Y = y + sn * m[0] * q + c * m[1] * q;
          if (n) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        });
        ctx.closePath();
      }
      else ctx.arc(x, y, r * k, 0, TAU);
    };
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineJoin = "round";
    ctx.translate(r * 0.28, r * 0.36); forme(1.04); ctx.fillStyle = "rgba(16,30,28,0.34)"; ctx.fill(); ctx.translate(-r * 0.28, -r * 0.36);
    forme(1); ctx.fillStyle = pierre; ctx.fill(); ctx.strokeStyle = "#1c2622"; ctx.lineWidth = Math.max(r * 0.2, 1.4 / zoom); ctx.stroke();
    if (r * zoom >= 5) {
      forme(0.8); ctx.strokeStyle = "rgba(40,34,26,0.65)"; ctx.lineWidth = r * 0.17; ctx.setLineDash([r * 0.3, r * 0.22]); ctx.stroke(); ctx.setLineDash([]);   // les créneaux
    }
    forme(0.6); ctx.fillStyle = toit; ctx.fill(); ctx.strokeStyle = "#1c2622"; ctx.lineWidth = Math.max(r * 0.13, 1 / zoom); ctx.stroke();
    if (r * zoom >= 5) {
      ctx.strokeStyle = "rgba(50,24,12,0.5)"; ctx.lineWidth = r * 0.08;     // les arêtes du toit
      ctx.beginPath();
      if (carre) { var cc = Math.cos(ang), ss = Math.sin(ang), q = r * 0.6; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) { ctx.moveTo(x, y); ctx.lineTo(x + cc * k[0] * q - ss * k[1] * q, y + ss * k[0] * q + cc * k[1] * q); }); }
      else for (var i = 0; i < 8; i++) { var a = i * TAU / 8 + 0.4; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,246,226,0.16)";          // le versant éclairé
      forme(0.6); ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(x - r, y - r, r * 1.1, r * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  function tracerMuraille(ctx, l, st, lw, vue, th, carte) {
    var p = l.pts, n = p.length, px = lw * vue.zoom, dessus = !!th.dessus;
    var ch = cumulChemin(p), portes = portesMuraille(carte, l, lw, vue, th), zoom = vue.zoom;
    var pierre = l.couleur || (dessus ? "#cdc6b1" : st.c);
    // Les tronçons de mur, entre les portes.
    var troncons = [], debut = 0;
    portes.forEach(function (g) {
      if (g.s - g.G / 2 - debut > lw * 0.3) troncons.push([debut, g.s - g.G / 2]);
      debut = g.s + g.G / 2;
    });
    if (ch.total - debut > lw * 0.3) troncons.push([debut, ch.total]);
    var parties = troncons.map(function (t) { return sousChemin(p, ch.cum, t[0], t[1]); });
    var trace = function (f) { parties.forEach(function (q) { cheminLigne(ctx, q, false); f(q); }); };
    ctx.setLineDash([]);
    ctx.lineCap = dessus ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.save();
    ctx.translate(lw * 0.22, lw * 0.34);
    ctx.strokeStyle = dessus ? "rgba(16,30,28,0.32)" : "rgba(40,28,10,0.3)";
    ctx.lineWidth = lw * 1.2;
    trace(function () { ctx.stroke(); });
    ctx.restore();
    ctx.strokeStyle = dessus ? "#1c2622" : th.encre;
    ctx.lineWidth = lw + 2 / zoom;
    trace(function () { ctx.stroke(); });
    ctx.strokeStyle = pierre;
    ctx.lineWidth = lw;
    trace(function () { ctx.stroke(); });
    if (dessus) {
      // Vue du dessus : le chemin de ronde, plus clair, ses deux rangées de créneaux et les
      // joints des pierres en travers.
      if (px >= 4) {
        ctx.strokeStyle = "rgba(255,252,240,0.26)"; ctx.lineWidth = lw * 0.42;
        trace(function () { ctx.stroke(); });
      }
      if (px >= 6) {
        ctx.lineCap = "butt";
        [-1, 1].forEach(function (cote) {
          ctx.strokeStyle = "rgba(48,42,34,0.5)"; ctx.lineWidth = lw * 0.2;
          ctx.setLineDash([lw * 0.34, lw * 0.3]);
          parties.forEach(function (q) { var o = decaler(q, cote * lw * 0.4); cheminLigne(ctx, o, false); ctx.stroke(); });
        });
        ctx.setLineDash([]);
      }
    } else if (px >= 5) {
      ctx.strokeStyle = "rgba(40,30,18,0.55)";
      ctx.lineWidth = lw * 0.16;
      ctx.setLineDash([lw * 0.5, lw * 0.5]);
      trace(function () { ctx.stroke(); });
      ctx.setLineDash([]);
    }
    if (px < 4) return;

    // Les tours : aux deux bouts, aux angles, puis à intervalles réguliers — jamais dans une porte.
    var ecart = (l.ecartTours || 1) * lw * 9, abscisses = [0, ch.total], i, s;
    for (s = ecart; s < ch.total - ecart * 0.45; s += ecart) abscisses.push(s);
    for (i = 1; i + 1 < ch.m; i++) {
      var ux = p[2 * i] - p[2 * i - 2], uy = p[2 * i + 1] - p[2 * i - 1], vx = p[2 * i + 2] - p[2 * i], vy = p[2 * i + 3] - p[2 * i + 1];
      var cosA = (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1);
      if (cosA < 0.92) abscisses.push(ch.cum[i]);          // un angle de plus de 23° : tour d'angle
    }
    var objets = [];
    abscisses.forEach(function (a) {
      for (var q = 0; q < portes.length; q++) if (Math.abs(a - portes[q].s) < portes[q].G / 2 + lw * 1.6) return;
      for (var r = 0; r < objets.length; r++) if (Math.abs(objets[r].s - a) < lw * 2.2) return;     // pas deux tours collées
      var pt = pointChemin(ch, a);
      objets.push({ s: a, x: pt.x, y: pt.y, ang: Math.atan2(pt.uy, pt.ux), garde: false });
    });
    // Les portes : une tour de garde de chaque côté de l'ouverture.
    portes.forEach(function (g) {
      [-1, 1].forEach(function (cote) {
        var pt = pointChemin(ch, g.s + cote * g.G / 2);
        objets.push({ s: g.s + cote * g.G / 2, x: pt.x, y: pt.y, ang: Math.atan2(pt.uy, pt.ux), garde: true, porte: g, cote: cote });
      });
    });
    objets.sort(function (a, b) { return a.y - b.y; });
    var toit = l.couleurToit || (dessus ? "#a8613f" : null);
    objets.forEach(function (o) {
      if (dessus) { tourDessus(ctx, o.x, o.y, lw * (o.garde ? 1.12 : 0.95), o.garde, o.ang, pierre, toit, zoom); return; }
      var u = lw * 2.3 / 16 * (o.garde ? 1.3 : 1);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.scale(u, u);
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = th.encre;
      tourPierre(ctx, 0, 5, 16, o.garde ? 24 : 20, o.garde ? 12 : 11);
      ctx.restore();
    });
    if (!dessus) {
      // De profil, l'arche de la porte entre ses deux tours.
      portes.forEach(function (g) {
        var pt = pointChemin(ch, g.s), u = lw * 2.3 / 16;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.scale(u, u);
        ctx.lineWidth = 1.2; ctx.strokeStyle = th.encre; ctx.lineJoin = "round";
        porte(ctx, 0, 6, Math.min(14, g.G / u * 0.5), 15);
        ctx.restore();
      });
    }
  }

  // ----- Routes et sentiers -----
  //
  // Une route de terre battue : fossés sombres de chaque côté, chaussée sableuse, milieu
  // plus clair (usé par les roues), et — assez grande — quelques pavés. Un sentier est
  // un simple filet de pas, en pointillé.
  //
  // Toutes les voies sont tracées ENSEMBLE, couche par couche : d'abord tous les
  // bas-côtés, puis toutes les chaussées, puis les milieux usés et les ornières. Ainsi,
  // là où un embranchement rejoint une route, les deux chaussées se fondent en une seule
  // au lieu que le bord sombre de l'une passe en travers de l'autre.
  // `voies` : [{ l, st, lw }].
  function tracerVoies(ctx, voies, vue) {
    if (!voies.length) return;
    var u = 1 / vue.zoom;
    voies.forEach(function (v) { v.d = pointsAffiches(v.l); v.sentier = v.l.type === "sentier" || v.l.type === "maisons"; v.pavee = v.l.type === "pavee"; });
    var chemin = function (d) {
      ctx.beginPath();
      ctx.moveTo(d[0], d[1]);
      for (var i = 2; i < d.length; i += 2) ctx.lineTo(d[i], d[i + 1]);
    };
    var passe = function (filtre, couleur, largeur, tirets) {
      voies.forEach(function (v) {
        if (!filtre(v)) return;
        var lw = largeur(v);
        if (!(lw > 0)) return;
        chemin(v.d);
        ctx.strokeStyle = typeof couleur === "function" ? couleur(v) : couleur;
        ctx.lineWidth = lw;
        ctx.setLineDash(tirets ? tirets(v) : []);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    };
    var toutes = function () { return true; }, routes = function (v) { return !v.sentier; }, terre = function (v) { return !v.sentier && !v.pavee; };
    ctx.setLineDash([]);
    ctx.lineCap = ctx.lineJoin = "round";
    // 1) Le talus : une ombre large et douce, puis le bord net de la voie.
    passe(toutes, "rgba(40,28,10,0.16)", function (v) { return v.lw + 5 * u; });
    passe(toutes, function (v) { return v.pavee ? "rgba(46,42,36,0.8)" : "rgba(74,50,22,0.72)"; }, function (v) { return v.lw + (v.sentier ? 1.2 : 2) * u; });
    // 2) La chaussée : les sentiers d'abord, les routes par-dessus (un sentier qui rejoint
    //    une route s'y fond).
    passe(function (v) { return v.sentier; }, function (v) { return v.st.c; }, function (v) { return v.lw; });
    passe(routes, function (v) { return v.st.c; }, function (v) { return v.lw; });
    // 3) Le milieu, usé et plus clair.
    passe(toutes, function (v) { return v.pavee ? "rgba(255,255,250,0.2)" : "rgba(255,244,208,0.34)"; }, function (v) { return v.lw * (v.sentier ? 0.42 : 0.52); });
    // 4) Les détails, quand la voie est assez large à l'écran pour qu'on les lise.
    ctx.lineCap = "butt";
    //    Pavés : des joints en travers.
    passe(function (v) { return v.pavee && v.lw * vue.zoom >= 4; }, "rgba(60,54,46,0.42)", function (v) { return v.lw * 0.86; },
      function (v) { return [Math.max(0.5 * u, v.lw * 0.07), v.lw * 0.5]; });
    //    Terre battue : des cailloux semés sur les bords (pointillés très courts, décalés).
    [-0.34, 0.34].forEach(function (k, rang) {
      voies.forEach(function (v) {
        if (v.pavee || v.lw * vue.zoom < 4) return;
        var o = decaler(v.d, v.lw * k);
        chemin(o);
        ctx.strokeStyle = "rgba(96,68,34,0.5)";
        ctx.lineWidth = Math.max(0.9 * u, v.lw * 0.1);
        ctx.setLineDash([v.lw * 0.12, v.lw * (rang ? 0.83 : 0.61)]);
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    //    Routes : deux ornières de charrette.
    [-0.2, 0.2].forEach(function (k) {
      voies.forEach(function (v) {
        if (v.sentier || v.pavee || v.lw * vue.zoom < 5) return;
        chemin(decaler(v.d, v.lw * k));
        ctx.strokeStyle = "rgba(104,74,38,0.34)";
        ctx.lineWidth = v.lw * 0.09;
        ctx.stroke();
      });
    });
    void terre;
  }

  // Les voies visibles, avec leur style et leur largeur : pour les peindre dans la terre.
  function voiesVisibles(carte, vue, th, X0, Y0, X1, Y1) {
    var out = [];
    (carte.lignes || []).forEach(function (l) {
      if (!VOIES[l.type] || !l.pts || l.pts.length < 4) return;
      var bb = boiteTrait(l.pts, 0);
      var marge = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 0.1 + (l.taille || 0) * 40;
      if (!chevauche([bb[0] - marge, bb[1] - marge, bb[2] + marge, bb[3] + marge], X0, Y0, X1, Y1)) return;
      var st = styleLigne(l, th);
      out.push({ l: l, st: st, lw: Math.max(l.taille || 0, st.min / vue.zoom) });
    });
    return out;
  }

  // Une polyligne décalée latéralement de `e` (à droite du sens de parcours).
  function decaler(d, e) {
    var out = [], m = d.length / 2;
    for (var i = 0; i < m; i++) {
      var a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
      var tx = d[2 * b] - d[2 * a], ty = d[2 * b + 1] - d[2 * a + 1], l = Math.hypot(tx, ty) || 1;
      out.push(d[2 * i] - ty / l * e, d[2 * i + 1] + tx / l * e);
    }
    return out;
  }

  // ----- Lacs -----
  //
  // Un lac est un contour fermé, lissé. Il creuse la terre comme la mer (creuserEaux) :
  // sa rive, son halo et sa falaise sont ceux de la côte.
  function cheminFerme(ctx, p) {
    var n = p.length / 2;
    if (n < 3) return false;
    ctx.beginPath();
    ctx.moveTo((p[2 * n - 2] + p[0]) / 2, (p[2 * n - 1] + p[1]) / 2);
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      ctx.quadraticCurveTo(p[2 * i], p[2 * i + 1], (p[2 * i] + p[2 * j]) / 2, (p[2 * i + 1] + p[2 * j + 1]) / 2);
    }
    ctx.closePath();
    return true;
  }

  function dansPolygone(x, y, p) {
    var dedans = false, n = p.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dedans = !dedans;
    }
    return dedans;
  }

  // ----- Ponts -----
  //
  // Un pont n'est pas un objet posé à côté de la route : c'est la route elle-même, le temps
  // de franchir l'eau. On suit donc la route (son tracé affiché, méandres compris), on
  // repère les tronçons au-dessus de l'eau (mer, lac, rivière : le masque le dit), on
  // réunit ceux que sépare à peine une langue de terre (une rivière qui serpente sous la
  // route ne donne qu'un pont), on les prolonge un peu sur chaque rive, et le tablier est
  // tracé le long de ce tronçon de route — courbe comprise — à peine plus large qu'elle.

  // Le morceau d'une polyligne compris entre les abscisses s0 et s1 (en longueur parcourue).
  function sousChemin(d, cum, s0, s1) {
    var out = [], m = d.length / 2;
    var point = function (s) {
      var i = 1;
      while (i < m - 1 && cum[i] < s) i++;
      var a = cum[i - 1], b = cum[i], f = b > a ? (s - a) / (b - a) : 0;
      f = Math.max(0, Math.min(1, f));
      return [d[2 * i - 2] + (d[2 * i] - d[2 * i - 2]) * f, d[2 * i - 1] + (d[2 * i + 1] - d[2 * i - 1]) * f];
    };
    var p0 = point(s0);
    out.push(p0[0], p0[1]);
    for (var i = 0; i < m; i++) if (cum[i] > s0 && cum[i] < s1) out.push(d[2 * i], d[2 * i + 1]);
    var p1 = point(s1);
    out.push(p1[0], p1[1]);
    return out;
  }

  // Le pont, le long du chemin `p` : son ombre sur l'eau, deux parapets de pierre, et
  // entre eux le tablier — de la couleur de la voie, qui semble ainsi se poursuivre —,
  // des planches (sentier) ou des dalles en travers, et une pile ronde à chaque coin.
  function pontLe(ctx, p, W, vue, couleur, bois) {
    var u = 1 / vue.zoom, n = p.length / 2;
    if (n < 2) return;
    var chemin = function () {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    };
    var px = W * vue.zoom;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.save();
    ctx.translate(W * 0.14, W * 0.3);
    chemin(); ctx.strokeStyle = "rgba(6,24,54,0.34)"; ctx.lineWidth = W * 1.06; ctx.stroke();
    ctx.restore();
    chemin(); ctx.strokeStyle = "#2c2014"; ctx.lineWidth = W; ctx.stroke();                         // le cerne
    chemin(); ctx.strokeStyle = bois ? "#8a6238" : "#bdb5a2"; ctx.lineWidth = W - Math.min(W * 0.16, 1.6 * u); ctx.stroke();   // les parapets
    chemin(); ctx.strokeStyle = bois ? "#5c3f20" : "#6f6858"; ctx.lineWidth = W * 0.68; ctx.stroke();  // leur ombre intérieure
    chemin(); ctx.strokeStyle = bois ? "#b08a56" : couleur; ctx.lineWidth = W * 0.6; ctx.stroke();     // le tablier
    if (!bois) { chemin(); ctx.strokeStyle = "rgba(255,246,214,0.28)"; ctx.lineWidth = W * 0.3; ctx.stroke(); }
    if (px >= 6) {
      chemin();
      ctx.strokeStyle = bois ? "rgba(58,36,14,0.6)" : "rgba(70,60,44,0.32)";
      ctx.lineWidth = W * 0.6;
      ctx.setLineDash(bois ? [Math.max(0.5 * u, W * 0.05), W * 0.17] : [Math.max(0.5 * u, W * 0.05), W * 0.38]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (px >= 8) {
      var r = W * 0.15;
      [[0, 1], [n - 1, n - 2]].forEach(function (e) {
        var x = p[2 * e[0]], y = p[2 * e[0] + 1], dx = x - p[2 * e[1]], dy = y - p[2 * e[1] + 1], l = Math.hypot(dx, dy) || 1;
        var nx = -dy / l * W * 0.46, ny = dx / l * W * 0.46;
        [[x + nx, y + ny], [x - nx, y - ny]].forEach(function (c) {
          ctx.fillStyle = "#2c2014"; ctx.beginPath(); ctx.arc(c[0], c[1], r * 1.25, 0, TAU); ctx.fill();
          ctx.fillStyle = bois ? "#9a7244" : "#d2cab6"; ctx.beginPath(); ctx.arc(c[0], c[1], r * 0.85, 0, TAU); ctx.fill();
        });
      });
    }
    ctx.restore();
  }

  function dessinerPonts(ctx, carte, vue, th, masque) {
    if (!masque) return;                               // pendant un déplacement : pas de ponts
    var L = carte.largeur, H = carte.hauteur;
    (carte.lignes || []).forEach(function (r) {
      if (!VOIES[r.type] || !r.pts || r.pts.length < 4) return;
      var d = pointsAffiches(r), m = d.length / 2;
      var bbR = boiteTrait(d, 0), mR = 8 / vue.zoom + (r.taille || 0) * 6;
      var ctxP = contexteZone(carte, bbR[0] - mR, bbR[1] - mR, bbR[2] + mR, bbR[3] + mR);
      var lw = Math.max(r.taille || 0, (r.type === "sentier" || r.type === "maisons" ? 1.3 : 2.4) / vue.zoom);
      // Un peu plus large que la route ET que ses bas-côtés : la route y entre sans déborder.
      var W = Math.max(lw * (r.type === "sentier" ? 2 : 1.7), lw + 4.5 / vue.zoom);
      var couleurVoie = styleLigne(r, th).c;
      // Abscisses cumulées le long de la route.
      var cum = [0];
      for (var i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(d[2 * i] - d[2 * i - 2], d[2 * i + 1] - d[2 * i - 1]);
      var total = cum[m - 1];
      if (!(total > 0)) return;
      // Échantillonnage : de l'eau sous la route ?
      var pas = Math.max(lw * 0.4, 1.2 / vue.zoom), troncons = [], debut = -1, seg = 1;
      for (var s = 0; s <= total + pas * 0.5; s += pas) {
        var sc = Math.min(s, total);
        while (seg < m - 1 && cum[seg] < sc) seg++;
        var a = cum[seg - 1], b = cum[seg], f = b > a ? (sc - a) / (b - a) : 0;
        var x = d[2 * seg - 2] + (d[2 * seg] - d[2 * seg - 2]) * f, y = d[2 * seg - 1] + (d[2 * seg + 1] - d[2 * seg - 1]) * f;
        var eau = x >= 0 && y >= 0 && x <= L && y <= H && sonde(ctxP, carte, x, y, 1.2 / vue.zoom).eau;
        if (eau && debut < 0) debut = sc;
        if (!eau && debut >= 0) { troncons.push([debut, sc]); debut = -1; }
      }
      if (debut >= 0) troncons.push([debut, total]);
      if (!troncons.length) return;
      // Une langue de terre de moins de trois largeurs entre deux eaux : un seul pont.
      var fusion = [troncons[0].slice()];
      for (var k = 1; k < troncons.length; k++) {
        var der = fusion[fusion.length - 1];
        if (troncons[k][0] - der[1] < lw * 3) der[1] = troncons[k][1];
        else fusion.push(troncons[k].slice());
      }
      fusion.forEach(function (t) {
        var s0 = Math.max(0, t[0] - lw * 0.9), s1 = Math.min(total, t[1] + lw * 0.9);
        if (s1 - s0 < lw) return;
        pontLe(ctx, sousChemin(d, cum, s0, s1), W, vue, couleurVoie, r.type === "sentier");
      });
    });
  }

  // Une falaise : la crête, puis des hachures qui descendent du côté droit du tracé
  // (dessiner dans l'autre sens retourne la pente). Une hachure sur deux est plus courte.
  function tracerFalaise(ctx, l, st, lw, vue) {
    var d = pointsAffiches(l), m = d.length / 2;
    ctx.setLineDash([]);
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = st.c;
    ctx.beginPath();
    ctx.moveTo(d[0], d[1]);
    for (var i = 2; i < d.length; i += 2) ctx.lineTo(d[i], d[i + 1]);
    ctx.lineWidth = lw * 1.3;
    ctx.stroke();
    if (lw * vue.zoom < 0.9) return;
    var pas = lw * 2.4, long = lw * 6 * (l.hachures || 1), prochain = pas * 0.5, parcouru = 0, rang = 0;
    ctx.beginPath();
    for (var j = 0; j + 1 < m; j++) {
      var dx = d[2 * j + 2] - d[2 * j], dy = d[2 * j + 3] - d[2 * j + 1], L = Math.hypot(dx, dy);
      if (!L) continue;
      while (prochain <= parcouru + L) {
        var f = (prochain - parcouru) / L, x = d[2 * j] + dx * f, y = d[2 * j + 1] + dy * f;
        var e = long * (rang % 2 ? 0.55 : 1);
        ctx.moveTo(x, y);
        ctx.lineTo(x - dy / L * e + dx / L * e * 0.12, y + dx / L * e + dy / L * e * 0.12);
        prochain += pas; rang++;
      }
      parcouru += L;
    }
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
  }

  function dessinerLignes(ctx, carte, vue, th, X0, Y0, X1, Y1, masque) {
    var lignes = carte.lignes || [];
    var voies = [];
    ["riviere", "falaise", "voies", "ponton", "muraille", "frontiere", "maritime"].forEach(function (type) {
      for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        if ((type === "voies" ? !VOIES[l.type] : l.type !== type) || !l.pts || l.pts.length < 4) continue;
        var bb = boiteTrait(l.pts, 0);
        var marge = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 0.1 + (l.taille || 0) * 40;
        if (!chevauche([bb[0] - marge, bb[1] - marge, bb[2] + marge, bb[3] + marge], X0, Y0, X1, Y1)) continue;
        var st = styleLigne(l, th);
        var lw = Math.max(l.taille || 0, st.min / vue.zoom);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (type === "riviere") continue;     // creusées dans la terre (creuserEaux), comme la mer
        if (type === "muraille") { tracerMuraille(ctx, l, st, lw, vue, th, carte); continue; }
        if (type === "falaise") { tracerFalaise(ctx, l, st, lw, vue); continue; }
        if (type === "ponton") { tracerPonton(ctx, l, st, lw, vue); continue; }
        if (type === "voies") continue;       // peintes dans la terre, sous les arbres (voir dessiner)
        var pts = type === "maritime" ? pointsAffiches(l) : l.pts;
        var tracer = function () {
          if (l.ferme && pts.length >= 6) {
            // Un territoire : la frontière se referme sur elle-même.
            if (st.lisse) cheminFerme(ctx, pts);
            else { cheminLigne(ctx, pts, false); ctx.closePath(); }
          } else cheminLigne(ctx, pts, type === "maritime" ? false : st.lisse);
        };
        if (l.ferme && pts.length >= 6 && l.fond !== 0) {
          tracer();
          ctx.fillStyle = st.c;
          ctx.globalAlpha = l.fond == null ? 0.16 : l.fond;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (st.halo) {
          tracer();
          ctx.setLineDash([]);
          ctx.strokeStyle = st.c;
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = lw * 4;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        tracer();
        ctx.strokeStyle = st.c;
        ctx.lineWidth = lw;
        if (type === "maritime") ctx.lineCap = "butt";
        ctx.setLineDash(st.tiret ? st.tiret.map(function (v) { return v * lw; }) : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Sentiers et routes ensemble (leurs croisements se fondent), puis les ponts, avant
      // les murailles et les frontières.
      if (type === "voies") dessinerPonts(ctx, carte, vue, th, masque);
    });
  }

  // ----- Étiquettes -----
  //
  // Un nom peut suivre un arc (`courbe`, de −100 à 100 : le texte s'incurve vers le haut ou
  // vers le bas, jusqu'au demi-cercle) — pour épouser une chaîne de montagnes ou une baie.
  // Les lettres sont alors posées une à une le long de l'arc.
  var mesureur = null;
  var cacheLargeurs = {};
  function espaceEtiquette(e, st) { return typeof e.espace === "number" ? e.espace : st.espace; }
  function texteEtiquette(e, st) { return st.maj ? String(e.texte).toUpperCase() : String(e.texte); }
  function policeEtiquette(st, px) { return (st.italique ? "italic " : "") + st.poids + " " + px + "px " + POLICE; }

  // Largeur du texte pour une taille de 1 (espacement compris).
  function largeurEtiquette(e) {
    var st = STYLES_ETIQ[e.style] || STYLES_ETIQ.libre;
    var texte = texteEtiquette(e, st), esp = espaceEtiquette(e, st);
    var cle = (e.style || "") + "|" + esp + "|" + texte;
    if (cacheLargeurs[cle] != null) return cacheLargeurs[cle];
    if (!mesureur) mesureur = document.createElement("canvas").getContext("2d");
    mesureur.font = policeEtiquette(st, 100);
    if ("letterSpacing" in mesureur) mesureur.letterSpacing = "0px";
    var w = (mesureur.measureText(texte).width + 100 * esp * Math.max(0, texte.length - 1)) / 100;
    if (Object.keys(cacheLargeurs).length > 500) cacheLargeurs = {};
    cacheLargeurs[cle] = w;
    return w;
  }
  // Boîte de l'étiquette en unités du monde (largeur, hauteur), pour la sélection.
  function boiteEtiquette(e) {
    var w = largeurEtiquette(e) * e.taille, h = e.taille * 1.1;
    if (e.courbe) {
      // L'arc : sa corde est plus courte que le texte, sa flèche s'ajoute à la hauteur.
      var theta = Math.abs(e.courbe) / 100 * Math.PI, R = w / theta;
      return { w: 2 * R * Math.sin(theta / 2) + e.taille * 0.6, h: h + R * (1 - Math.cos(theta / 2)), dy: (e.courbe > 0 ? 1 : -1) * R * (1 - Math.cos(theta / 2)) / 2 };
    }
    return { w: w, h: h, dy: 0 };
  }

  // ----- Noms qui suivent un tracé -----
  //
  // Un nom peut être attaché à un tracé (`ligne` : son identifiant) : il s'écrit alors le
  // long de la rivière ou de la route, lettre à lettre, centré à la fraction `pos` de sa
  // longueur et décalé de `ecart` hauteurs de texte sur le côté. Le tracé suivi est celui
  // qui est dessiné (méandres compris). Si le texte irait de droite à gauche, il est écrit
  // dans l'autre sens : un nom ne se lit jamais la tête en bas.
  function cheminEtiquette(carte, e) {
    if (!e.ligne) return null;
    var lignes = carte.lignes || [], l = null;
    for (var i = 0; i < lignes.length; i++) if (lignes[i].id === e.ligne) { l = lignes[i]; break; }
    if (!l || !l.pts || l.pts.length < 4) return null;
    var d = pointsAffiches(l), m = d.length / 2, cum = [0];
    for (i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(d[2 * i] - d[2 * i - 2], d[2 * i + 1] - d[2 * i - 1]);
    return cum[m - 1] > 0 ? { d: d, cum: cum, total: cum[m - 1], m: m } : null;
  }
  // Le point du chemin à l'abscisse s (prolongé en ligne droite au-delà des bouts), et sa
  // direction.
  function pointChemin(ch, s) {
    var i = 1;
    while (i < ch.m - 1 && ch.cum[i] < s) i++;
    var a = ch.cum[i - 1], b = ch.cum[i], dx = ch.d[2 * i] - ch.d[2 * i - 2], dy = ch.d[2 * i + 1] - ch.d[2 * i - 1], L = b - a || 1;
    var f = (s - a) / L;
    return { x: ch.d[2 * i - 2] + dx * f, y: ch.d[2 * i - 1] + dy * f, ux: dx / L, uy: dy / L };
  }
  function ecartEtiquette(e) { return (typeof e.ecart === "number" ? e.ecart : -0.85) * e.taille; }
  // Où est le nom, et sous quel angle (degrés) : ses propres x, y, angle, ou ceux que lui
  // donne le tracé qu'il suit. Sert à la sélection dans l'éditeur.
  function poseEtiquette(carte, e) {
    var ch = cheminEtiquette(carte, e);
    if (!ch) return { x: e.x, y: e.y, angle: e.angle || 0, suit: false };
    var p = pointChemin(ch, (e.pos == null ? 0.5 : e.pos) * ch.total), sens = p.ux < 0 ? -1 : 1, ec = ecartEtiquette(e);
    return { x: p.x - p.uy * sens * ec, y: p.y + p.ux * sens * ec, angle: Math.atan2(p.uy * sens, p.ux * sens) * 180 / Math.PI, suit: true };
  }
  // La fraction du tracé la plus proche d'un point : pour faire glisser le nom le long.
  function positionSurLigne(carte, e, wx, wy) {
    var ch = cheminEtiquette(carte, e);
    if (!ch) return null;
    var best = 0, dMin = Infinity;
    for (var i = 1; i < ch.m; i++) {
      var ax = ch.d[2 * i - 2], ay = ch.d[2 * i - 1], dx = ch.d[2 * i] - ax, dy = ch.d[2 * i + 1] - ay, l2 = dx * dx + dy * dy;
      var t = l2 ? Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / l2)) : 0;
      var dd = Math.hypot(wx - ax - dx * t, wy - ay - dy * t);
      if (dd < dMin) { dMin = dd; best = (ch.cum[i - 1] + (ch.cum[i] - ch.cum[i - 1]) * t) / ch.total; }
    }
    return best;
  }

  function dessinerEtiquettes(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr) {
    var liste = carte.etiquettes || [];
    if (!liste.length) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i];
      if (!e.texte) continue;
      var px = e.taille * z;
      if (px < 6 * dpr || px > 1400 * dpr) continue;
      var chemin = cheminEtiquette(carte, e), pose = chemin ? poseEtiquette(carte, e) : e;
      var sx = pose.x * z + tx, sy = pose.y * z + ty;
      var largeur = largeurEtiquette(e) * px;
      var demi = largeur / 2 + px * 2;
      if (sx + demi < 0 || sx - demi > pw || sy + demi < 0 || sy - demi > ph) continue;
      var st = STYLES_ETIQ[e.style] || STYLES_ETIQ.libre;
      var texte = texteEtiquette(e, st), espace = px * espaceEtiquette(e, st);
      ctx.save();
      if (!chemin) {
        ctx.translate(sx, sy);
        if (e.angle) ctx.rotate(e.angle * Math.PI / 180);
      }
      ctx.globalAlpha = e.opacite == null ? 1 : e.opacite;
      ctx.font = policeEtiquette(st, px);
      ctx.lineWidth = Math.max(2, px * 0.18);
      ctx.strokeStyle = th.halo;
      ctx.fillStyle = e.couleur || (st.mer ? th.texteMer : th.encre);
      // Les lettres une à une : l'espacement et la courbure sont ainsi les mêmes partout
      // (tous les navigateurs n'ont pas `letterSpacing` sur un canvas).
      var lettres = Array.from(texte), avances = [], k;
      for (k = 0; k < lettres.length; k++) avances.push(ctx.measureText(lettres[k]).width);
      var theta = e.courbe && !chemin ? e.courbe / 100 * Math.PI : 0, R = theta ? largeur / Math.abs(theta) : 0, sens = theta > 0 ? 1 : -1;
      // Le long d'un tracé : l'abscisse du milieu (en unités du monde), le sens de lecture.
      var s0 = 0, lecture = 1, ecartM = 0;
      if (chemin) {
        s0 = (e.pos == null ? 0.5 : e.pos) * chemin.total;
        lecture = pointChemin(chemin, s0).ux < 0 ? -1 : 1;
        ecartM = ecartEtiquette(e);
      }
      for (var passe = 0; passe < 2; passe++) {
        var x = -largeur / 2;
        for (k = 0; k < lettres.length; k++) {
          var cx = x + avances[k] / 2;
          if (chemin) {
            var pc = pointChemin(chemin, s0 + lecture * cx / z);
            ctx.save();
            ctx.translate((pc.x - pc.uy * lecture * ecartM) * z + tx, (pc.y + pc.ux * lecture * ecartM) * z + ty);
            ctx.rotate(Math.atan2(pc.uy * lecture, pc.ux * lecture));
            if (passe === 0) ctx.strokeText(lettres[k], 0, 0); else ctx.fillText(lettres[k], 0, 0);
            ctx.restore();
          } else if (theta) {
            var phi = cx / R;
            ctx.save();
            ctx.translate(R * Math.sin(phi), sens * (R - R * Math.cos(phi)));
            ctx.rotate(sens * phi);
            if (passe === 0) ctx.strokeText(lettres[k], 0, 0); else ctx.fillText(lettres[k], 0, 0);
            ctx.restore();
          } else if (passe === 0) ctx.strokeText(lettres[k], cx, 0);
          else ctx.fillText(lettres[k], cx, 0);
          x += avances[k] + espace;
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ----- Lieux -----
  function icone(ctx, type, x, y, s, th, accent) {
    var r = s / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = Math.max(1.2, s * 0.1);
    ctx.strokeStyle = th.encre;
    ctx.fillStyle = accent && type !== "capitale" ? accent : PAPIER;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    switch (type) {
      case "village":
        ctx.arc(0, 0, r * 0.78, 0, TAU);
        ctx.fill(); ctx.stroke();
        break;
      case "ville":
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, TAU);
        ctx.fillStyle = th.encre; ctx.fill();
        break;
      case "capitale":
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
          var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.3 : r * 0.72;
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fillStyle = accent || "#b5362a"; ctx.fill();
        break;
      case "point":
        ctx.arc(0, 0, r * 0.8, 0, TAU);
        ctx.fillStyle = accent || th.encre; ctx.fill();
        ctx.strokeStyle = PAPIER; ctx.lineWidth = Math.max(1, s * 0.16); ctx.stroke();
        break;
      case "croix":
        ctx.lineWidth = Math.max(2.4, s * 0.3); ctx.strokeStyle = PAPIER;
        ctx.moveTo(-r * 0.75, -r * 0.75); ctx.lineTo(r * 0.75, r * 0.75); ctx.moveTo(r * 0.75, -r * 0.75); ctx.lineTo(-r * 0.75, r * 0.75);
        ctx.stroke();
        ctx.lineWidth = Math.max(1.4, s * 0.16); ctx.strokeStyle = accent || "#b5362a"; ctx.stroke();
        break;
      case "etoile":
        for (var e = 0; e < 10; e++) {
          var ae = -Math.PI / 2 + e * Math.PI / 5, re = e % 2 ? r * 0.42 : r;
          if (e === 0) ctx.moveTo(Math.cos(ae) * re, Math.sin(ae) * re); else ctx.lineTo(Math.cos(ae) * re, Math.sin(ae) * re);
        }
        ctx.closePath();
        ctx.fillStyle = accent || "#e0b23a"; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.07); ctx.stroke();
        break;
      case "drapeau":
        ctx.moveTo(-r * 0.5, r); ctx.lineTo(-r * 0.5, -r); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r); ctx.quadraticCurveTo(r * 0.1, -r * 1.15, r * 0.9, -r * 0.7); ctx.lineTo(r * 0.55, -r * 0.3);
        ctx.lineTo(r * 0.9, r * 0.05); ctx.quadraticCurveTo(r * 0.1, -r * 0.3, -r * 0.5, -r * 0.05); ctx.closePath();
        ctx.fillStyle = accent || "#b5362a"; ctx.fill(); ctx.stroke();
        break;
      case "fort":
        ctx.moveTo(-r, r * 0.8); ctx.lineTo(-r, -r * 0.5); ctx.lineTo(-r * 0.6, -r * 0.5); ctx.lineTo(-r * 0.6, -r * 0.8);
        ctx.lineTo(-r * 0.2, -r * 0.8); ctx.lineTo(-r * 0.2, -r * 0.5); ctx.lineTo(r * 0.2, -r * 0.5); ctx.lineTo(r * 0.2, -r * 0.8);
        ctx.lineTo(r * 0.6, -r * 0.8); ctx.lineTo(r * 0.6, -r * 0.5); ctx.lineTo(r, -r * 0.5); ctx.lineTo(r, r * 0.8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case "port":
        ctx.arc(0, -r * 0.7, r * 0.22, 0, TAU);
        ctx.moveTo(0, -r * 0.48); ctx.lineTo(0, r * 0.8);
        ctx.moveTo(-r * 0.45, -r * 0.2); ctx.lineTo(r * 0.45, -r * 0.2);
        ctx.moveTo(-r * 0.8, r * 0.2); ctx.quadraticCurveTo(-r * 0.7, r * 0.9, 0, r * 0.8);
        ctx.quadraticCurveTo(r * 0.7, r * 0.9, r * 0.8, r * 0.2);
        ctx.stroke();
        break;
      case "tour":
        ctx.moveTo(-r * 0.5, r); ctx.lineTo(-r * 0.5, -r * 0.6); ctx.lineTo(-r * 0.75, -r * 0.6); ctx.lineTo(-r * 0.75, -r);
        ctx.lineTo(-r * 0.25, -r); ctx.lineTo(-r * 0.25, -r * 0.75); ctx.lineTo(r * 0.25, -r * 0.75); ctx.lineTo(r * 0.25, -r);
        ctx.lineTo(r * 0.75, -r); ctx.lineTo(r * 0.75, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.6); ctx.lineTo(r * 0.5, r);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case "temple":
        ctx.moveTo(-r, -r * 0.15); ctx.lineTo(0, -r); ctx.lineTo(r, -r * 0.15); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, 0); ctx.lineTo(-r * 0.6, r * 0.8);
        ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.8);
        ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.6, r * 0.8);
        ctx.moveTo(-r, r * 0.9); ctx.lineTo(r, r * 0.9);
        ctx.stroke();
        break;
      case "ruine":
        ctx.moveTo(-r * 0.7, r * 0.9); ctx.lineTo(-r * 0.7, -r * 0.1);
        ctx.arc(-r * 0.1, -r * 0.1, r * 0.6, Math.PI, Math.PI * 1.55);
        ctx.moveTo(r * 0.5, r * 0.9); ctx.lineTo(r * 0.5, r * 0.1); ctx.lineTo(r * 0.8, -r * 0.1); ctx.lineTo(r * 0.8, r * 0.9);
        ctx.stroke();
        break;
      case "donjon":
        ctx.moveTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.8, 0); ctx.arc(0, 0, r * 0.8, Math.PI, 0); ctx.lineTo(r * 0.8, r * 0.85);
        ctx.closePath();
        ctx.fillStyle = th.encre; ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.32, r * 0.85); ctx.lineTo(-r * 0.32, r * 0.15); ctx.arc(0, r * 0.15, r * 0.32, Math.PI, 0); ctx.lineTo(r * 0.32, r * 0.85);
        ctx.closePath();
        ctx.fillStyle = PAPIER; ctx.fill();
        break;
      case "mine":
        ctx.moveTo(-r * 0.7, r * 0.8); ctx.lineTo(r * 0.5, -r * 0.5);
        ctx.moveTo(-r * 0.7, -r * 0.1); ctx.quadraticCurveTo(0, -r, r * 0.8, -r * 0.1);
        ctx.stroke();
        break;
      case "navire":
        ctx.moveTo(-r, r * 0.25); ctx.lineTo(r, r * 0.25); ctx.lineTo(r * 0.6, r * 0.85); ctx.lineTo(-r * 0.6, r * 0.85);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, r * 0.25); ctx.lineTo(0, -r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.9); ctx.lineTo(r * 0.85, r * 0.1); ctx.lineTo(r * 0.1, r * 0.1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      default:
        ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ----- Lieux illustrés -----
  //
  // Le style Illustré remplace les pictogrammes par de petits dessins : maisons
  // à toit rouge, tours coniques, remparts à créneaux, bateau, ruines… Tout se
  // dessine dans une boîte de 100 × 100 centrée sur le lieu (le sol est vers
  // y = +32), mise à l'échelle : les proportions ne dépendent pas de la taille.
  var PIERRE = "#c4bdab", OMBRE = "rgba(52,38,20,0.2)", TOIT_DEFAUT = "#a8452f", MURMAISON = "#ecdfbd", BOIS = "#6a4a2a";
  var TOIT = TOIT_DEFAUT, FANION = "#b5362a";      // remplacés, le temps d'un dessin, par la couleur du lieu

  function ombreSol(c, cx, cy, rx, ry) {
    c.fillStyle = "rgba(40,28,10,0.28)";
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    c.fill();
  }

  // Une maison : murs clairs à colombages, toit de tuiles à deux pans (l'un dans l'ombre),
  // fenêtres, porte, et une cheminée une fois sur deux. (x, y) : le milieu de sa base.
  function maison(c, x, y, w, h) {
    var lw = c.lineWidth;
    c.fillStyle = MURMAISON;
    c.beginPath(); c.rect(x - w / 2, y - h, w, h); c.fill(); c.stroke();
    c.fillStyle = OMBRE;
    c.fillRect(x, y - h, w / 2, h);
    // Colombages, fenêtres et porte.
    c.save();
    c.strokeStyle = "rgba(92,62,30,0.75)"; c.lineWidth = lw * 0.6;
    c.beginPath();
    c.moveTo(x - w / 2, y - h * 0.52); c.lineTo(x + w / 2, y - h * 0.52);
    c.moveTo(x - w * 0.22, y - h); c.lineTo(x - w * 0.22, y - h * 0.52);
    c.moveTo(x + w * 0.24, y - h); c.lineTo(x + w * 0.24, y);
    c.stroke();
    c.restore();
    c.fillStyle = "#3a2a1c";
    c.fillRect(x - w * 0.4, y - h * 0.9, w * 0.13, h * 0.26);
    c.fillRect(x + w * 0.3, y - h * 0.9, w * 0.13, h * 0.26);
    c.fillStyle = BOIS;
    c.fillRect(x - w * 0.1, y - h * 0.46, w * 0.2, h * 0.46);
    // La cheminée, derrière le toit.
    if (Math.round(x * 7 + y * 3) % 2 === 0) {
      c.fillStyle = PIERRE;
      c.beginPath(); c.rect(x + w * 0.2, y - h - w * 0.5, w * 0.13, w * 0.3); c.fill(); c.stroke();
    }
    c.fillStyle = TOIT;
    c.beginPath();
    c.moveTo(x - w / 2 - 2.5, y - h); c.lineTo(x, y - h - w * 0.52); c.lineTo(x + w / 2 + 2.5, y - h);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(40,20,8,0.28)";
    c.beginPath(); c.moveTo(x, y - h - w * 0.52); c.lineTo(x + w / 2 + 2.5, y - h); c.lineTo(x, y - h); c.closePath(); c.fill();
    // Les rangs de tuiles.
    c.save();
    c.strokeStyle = "rgba(60,24,10,0.4)"; c.lineWidth = lw * 0.5;
    c.beginPath();
    for (var r = 1; r <= 2; r++) {
      var f = r / 3;
      c.moveTo(x - (w / 2 + 2.5) * f, y - h - w * 0.52 * (1 - f)); c.lineTo(x + (w / 2 + 2.5) * f, y - h - w * 0.52 * (1 - f));
    }
    c.stroke();
    c.restore();
  }

  // Les assises d'un mur de pierre, entre (x0, y0) et (x1, y1) : joints horizontaux et
  // verticaux décalés d'un rang à l'autre.
  function assises(c, x0, y0, x1, y1, pas) {
    c.save();
    c.strokeStyle = "rgba(70,58,40,0.34)"; c.lineWidth = c.lineWidth * 0.5;
    c.beginPath();
    var rang = 0;
    for (var y = y0 + pas; y < y1 - 0.5; y += pas, rang++) { c.moveTo(x0, y); c.lineTo(x1, y); }
    rang = 0;
    for (var yy = y0; yy < y1 - 0.5; yy += pas, rang++) {
      for (var x = x0 + pas * (rang % 2 ? 0.6 : 1.3); x < x1 - 0.5; x += pas * 1.5) { c.moveTo(x, yy); c.lineTo(x, Math.min(y1, yy + pas)); }
    }
    c.stroke();
    c.restore();
  }

  // Tour de pierre à toit conique : (x, y) est le milieu de sa base.
  function tourPierre(c, x, y, w, h, hToit) {
    c.fillStyle = PIERRE;
    c.beginPath(); c.rect(x - w / 2, y - h, w, h); c.fill(); c.stroke();
    if (w >= 12) assises(c, x - w / 2, y - h, x + w / 2, y, Math.max(4, w * 0.22));
    c.fillStyle = OMBRE;
    c.fillRect(x, y - h, w / 2, h);
    c.fillStyle = "#2a1c10";
    c.fillRect(x - w * 0.07, y - h * 0.72, w * 0.14, h * 0.2);
    if (h > 30) c.fillRect(x - w * 0.07, y - h * 0.4, w * 0.14, h * 0.14);
    // L'encorbellement sous le toit.
    c.fillStyle = PIERRE;
    c.beginPath(); c.rect(x - w / 2 - 1.5, y - h - 1, w + 3, 3.4); c.fill(); c.stroke();
    c.fillStyle = TOIT;
    c.beginPath();
    c.moveTo(x - w / 2 - 2.5, y - h - 1); c.lineTo(x, y - h - hToit); c.lineTo(x + w / 2 + 2.5, y - h - 1);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(40,20,8,0.28)";
    c.beginPath(); c.moveTo(x, y - h - hToit); c.lineTo(x + w / 2 + 2.5, y - h - 1); c.lineTo(x, y - h - 1); c.closePath(); c.fill();
  }

  // Rempart à créneaux entre x0 et x1, de hauteur h au-dessus de la ligne de sol yBase.
  function rempart(c, x0, x1, yBase, h, n) {
    var pas = (x1 - x0) / n;
    c.fillStyle = PIERRE;
    c.beginPath(); c.rect(x0, yBase - h, x1 - x0, h); c.fill(); c.stroke();
    for (var i = 0; i < n; i += 2) {
      c.beginPath(); c.rect(x0 + i * pas, yBase - h - 3.2, pas, 3.2); c.fill(); c.stroke();
    }
    assises(c, x0, yBase - h, x1, yBase, Math.max(4, h * 0.26));
    c.fillStyle = OMBRE;
    c.fillRect(x0, yBase - h * 0.35, x1 - x0, h * 0.35);
  }

  function drapeau(c, x, y) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 15); c.stroke();
    c.fillStyle = FANION;
    c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x + 10, y - 11.5); c.lineTo(x, y - 8); c.closePath(); c.fill(); c.stroke();
  }

  // La porte d'une enceinte : une arche sombre et sa herse.
  function porte(c, x, y, w, h) {
    c.fillStyle = "#231710";
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h + w / 2); c.arc(x, y - h + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w / 2, y); c.closePath(); c.fill(); c.stroke();
    c.save();
    c.strokeStyle = "rgba(190,170,130,0.5)"; c.lineWidth = c.lineWidth * 0.5;
    c.beginPath();
    for (var q = -1; q <= 1; q++) { c.moveTo(x + q * w * 0.25, y); c.lineTo(x + q * w * 0.25, y - h * 0.72); }
    c.moveTo(x - w / 2, y - h * 0.4); c.lineTo(x + w / 2, y - h * 0.4);
    c.stroke();
    c.restore();
  }

  // Un château : le donjon et ses tours derrière, la courtine à créneaux devant, la porte à
  // herse, deux tours d'angle. La capitale y ajoute un second rang de tours, les toits de
  // la ville haute et des bannières.
  function chateau(c, grand) {
    ombreSol(c, 0, 35, 49, 8);
    if (grand) {
      tourPierre(c, -30, 12, 11, 30, 12);
      tourPierre(c, 30, 12, 11, 30, 12);
      dessinerMaisons(c, [[-13, 14, 13, 9], [13, 14, 13, 9]]);
    }
    tourPierre(c, 0, 20, grand ? 28 : 24, grand ? 54 : 40, grand ? 21 : 16);
    tourPierre(c, -19, 22, 13, grand ? 42 : 36, 13);
    tourPierre(c, 19, 22, 13, grand ? 42 : 36, 13);
    rempart(c, -38, 38, 34, 21, 11);
    porte(c, 0, 34, 15, 17);
    tourPierre(c, -40, 36, 16, 44, 14);
    tourPierre(c, 40, 36, 16, 44, 14);
    if (grand) { drapeau(c, 0, -34 - 21 + 4); drapeau(c, -40, -8 - 14 + 4); drapeau(c, 40, -8 - 14 + 4); }
    else drapeau(c, 0, -20 - 16 + 4);
  }

  function dessinerMaisons(c, liste) {
    liste.slice().sort(function (a, b) { return a[1] - b[1]; }).forEach(function (m) { maison(c, m[0], m[1], m[2], m[3]); });
  }

  function iconeIllustree(ctx, type, x, y, s, th, accent) {
    TOIT = accent || TOIT_DEFAUT;
    FANION = accent || "#b5362a";
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 100, s / 100);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = th.encre;
    var c = ctx, i;
    switch (type) {
      case "capitale": chateau(c, true); break;
      case "fort": chateau(c, false); break;
      case "ville":
        // Une ville close : l'église et son clocher, trois rangs de toits, l'enceinte et
        // sa porte au premier plan.
        ombreSol(c, 0, 35, 49, 8);
        tourPierre(c, -40, 20, 10, 24, 10);
        tourPierre(c, 40, 20, 10, 24, 10);
        dessinerMaisons(c, [[-24, 2, 15, 10], [-6, 0, 15, 10], [26, 3, 16, 11]]);
        tourPierre(c, 9, 6, 11, 34, 20);
        c.beginPath(); c.moveTo(9, -48); c.lineTo(9, -55); c.moveTo(6, -52); c.lineTo(12, -52); c.stroke();
        dessinerMaisons(c, [[-32, 15, 17, 11], [-13, 14, 17, 12], [5, 16, 16, 11], [24, 15, 18, 12], [-22, 26, 18, 12], [-2, 27, 19, 13], [19, 26, 18, 12]]);
        rempart(c, -44, 44, 36, 11, 15);
        porte(c, 0, 36, 10, 10);
        tourPierre(c, -45, 37, 11, 24, 10);
        tourPierre(c, 45, 37, 11, 24, 10);
        break;
      case "village":
        // Un hameau : cinq maisons autour de la place, un arbre.
        ombreSol(c, 0, 31, 42, 7);
        dessinerMaisons(c, [[-4, 8, 17, 11], [20, 12, 20, 13], [-26, 14, 20, 13], [10, 30, 24, 16], [-18, 32, 22, 14]]);
        c.fillStyle = "#5a4026"; c.fillRect(34, 22, 3, 10);
        [[35.5, 18, 8, "#5f9c3b"], [31, 22, 6, "#4a8636"], [40, 22, 6, "#3f7a32"]].forEach(function (f) { c.fillStyle = f[3]; c.beginPath(); c.arc(f[0], f[1], f[2], 0, TAU); c.fill(); c.stroke(); });
        break;
      case "tour":
        ombreSol(c, 0, 35, 20, 6);
        tourPierre(c, 0, 35, 26, 62, 24);
        drapeau(c, 0, -51 + 4);
        break;
      case "port":
        ombreSol(c, -8, 32, 40, 8);
        dessinerMaisons(c, [[-36, 16, 22, 15], [-14, 22, 20, 14], [-32, 33, 24, 15]]);
        c.fillStyle = BOIS;
        c.beginPath(); c.rect(-6, 28, 24, 4); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(10, 22); c.lineTo(42, 22); c.lineTo(35, 31); c.lineTo(17, 31); c.closePath(); c.fill(); c.stroke();
        c.lineWidth = 1.8; c.beginPath(); c.moveTo(26, 22); c.lineTo(26, -10); c.stroke(); c.lineWidth = 1.4;
        c.fillStyle = "#f3ecd4";
        c.beginPath(); c.moveTo(27, -8); c.lineTo(27, 20); c.lineTo(45, 20); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(25, -2); c.lineTo(25, 19); c.lineTo(12, 19); c.closePath(); c.fill(); c.stroke();
        break;
      case "ruine":
        ombreSol(c, 0, 33, 44, 8);
        c.fillStyle = PIERRE;
        c.beginPath();
        c.moveTo(-36, 33); c.lineTo(-36, -8); c.lineTo(-31, -13); c.lineTo(-27, -7); c.lineTo(-23, -11); c.lineTo(-21, 33);
        c.closePath(); c.fill(); c.stroke();
        c.beginPath();
        c.moveTo(14, 33); c.lineTo(14, 8); c.lineTo(19, 3); c.lineTo(23, 9); c.lineTo(28, 6); c.lineTo(30, 33);
        c.closePath(); c.fill(); c.stroke();
        c.lineWidth = 9; c.strokeStyle = th.encre;
        c.beginPath(); c.arc(-14, -4, 20, Math.PI * 1.02, Math.PI * 1.62); c.stroke();
        c.lineWidth = 6.4; c.strokeStyle = PIERRE;
        c.beginPath(); c.arc(-14, -4, 20, Math.PI * 1.02, Math.PI * 1.62); c.stroke();
        c.lineWidth = 1.4; c.strokeStyle = th.encre;
        c.fillStyle = "#b3ab98";
        c.beginPath(); c.rect(-4, 14, 12, 19); c.fill(); c.stroke();
        for (i = 0; i < 5; i++) {
          c.beginPath();
          c.moveTo(-8 + i * 11, 33); c.lineTo(-6 + i * 11, 28); c.lineTo(-1 + i * 11, 31); c.lineTo(0 + i * 11, 33);
          c.closePath(); c.fill(); c.stroke();
        }
        break;
      case "donjon":
        ombreSol(c, 0, 34, 42, 7);
        c.fillStyle = "#8f897c";
        c.beginPath(); c.moveTo(-42, 34); c.quadraticCurveTo(-44, -26, 0, -28); c.quadraticCurveTo(44, -26, 42, 34); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = OMBRE;
        c.beginPath(); c.moveTo(0, -28); c.quadraticCurveTo(44, -26, 42, 34); c.lineTo(8, 34); c.quadraticCurveTo(14, 0, 0, -28); c.closePath(); c.fill();
        c.fillStyle = "#2a1c10";
        c.beginPath(); c.moveTo(-13, 34); c.lineTo(-13, 12); c.arc(0, 12, 13, Math.PI, 0); c.lineTo(13, 34); c.closePath(); c.fill(); c.stroke();
        var lueur = c.createRadialGradient(0, 24, 1, 0, 24, 13);
        lueur.addColorStop(0, "rgba(255,170,60,0.95)"); lueur.addColorStop(1, "rgba(255,120,20,0)");
        c.fillStyle = lueur; c.fillRect(-13, 8, 26, 26);
        break;
      case "temple":
        ombreSol(c, 0, 34, 42, 7);
        c.fillStyle = "#e4ddca";
        [[-40, 28, 80, 6], [-35, 22, 70, 6]].forEach(function (m) { c.beginPath(); c.rect(m[0], m[1], m[2], m[3]); c.fill(); c.stroke(); });
        for (i = 0; i < 5; i++) { c.beginPath(); c.rect(-30 + i * 15 - 3.5, -6, 7, 28); c.fill(); c.stroke(); }
        c.beginPath(); c.rect(-36, -12, 72, 6); c.fill(); c.stroke();
        c.fillStyle = "#d6cdb4";
        c.beginPath(); c.moveTo(-40, -12); c.lineTo(0, -34); c.lineTo(40, -12); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = OMBRE;
        c.beginPath(); c.moveTo(0, -34); c.lineTo(40, -12); c.lineTo(0, -12); c.closePath(); c.fill();
        break;
      case "mine":
        ombreSol(c, 0, 34, 40, 7);
        c.fillStyle = "#8f897c";
        c.beginPath(); c.moveTo(-40, 34); c.quadraticCurveTo(-40, -10, 0, -16); c.quadraticCurveTo(40, -10, 40, 34); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = OMBRE;
        c.beginPath(); c.moveTo(0, -16); c.quadraticCurveTo(40, -10, 40, 34); c.lineTo(10, 34); c.quadraticCurveTo(14, 6, 0, -16); c.closePath(); c.fill();
        c.fillStyle = "#2a1c10";
        c.beginPath(); c.rect(-14, 6, 28, 28); c.fill(); c.stroke();
        c.fillStyle = BOIS;
        c.beginPath(); c.rect(-17, 3, 6, 31); c.fill(); c.stroke();
        c.beginPath(); c.rect(11, 3, 6, 31); c.fill(); c.stroke();
        c.beginPath(); c.rect(-18, 1, 36, 6); c.fill(); c.stroke();
        c.strokeStyle = "#c9a15a"; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(-8, 34); c.lineTo(-4, 14); c.moveTo(8, 34); c.lineTo(4, 14); c.stroke();
        break;
      case "navire":
        // Sur l'eau : pas d'ombre au sol, mais un sillage d'écume.
        c.strokeStyle = "rgba(255,255,255,0.85)";
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(-46, 33); c.quadraticCurveTo(-32, 27, -16, 33);
        c.moveTo(14, 35); c.quadraticCurveTo(30, 29, 46, 35);
        c.stroke();
        c.strokeStyle = th.encre;
        c.lineWidth = 1.4;
        c.fillStyle = BOIS;
        c.beginPath(); c.moveTo(-36, 14); c.lineTo(36, 14); c.lineTo(25, 31); c.lineTo(-25, 31); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = OMBRE;
        c.beginPath(); c.moveTo(0, 14); c.lineTo(36, 14); c.lineTo(25, 31); c.lineTo(0, 31); c.closePath(); c.fill();
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(-10, 14); c.lineTo(-10, -36); c.moveTo(13, 14); c.lineTo(13, -26); c.stroke();
        c.lineWidth = 1.4;
        c.fillStyle = "#f3ecd4";
        c.beginPath(); c.moveTo(-11, -32); c.quadraticCurveTo(-38, -10, -36, 12); c.lineTo(-11, 12); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(12, -22); c.quadraticCurveTo(36, -6, 34, 12); c.lineTo(12, 12); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = FANION;
        c.beginPath(); c.moveTo(-10, -36); c.lineTo(3, -32); c.lineTo(-10, -28); c.closePath(); c.fill(); c.stroke();
        break;
      case "moulin":
        ombreSol(c, 0, 33, 30, 7);
        c.fillStyle = MURMAISON;
        c.beginPath(); c.moveTo(-15, 33); c.lineTo(-10, -6); c.lineTo(10, -6); c.lineTo(15, 33); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = OMBRE; c.beginPath(); c.moveTo(0, -6); c.lineTo(10, -6); c.lineTo(15, 33); c.lineTo(0, 33); c.closePath(); c.fill();
        c.fillStyle = TOIT; c.beginPath(); c.moveTo(-13, -6); c.lineTo(0, -22); c.lineTo(13, -6); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = BOIS; c.fillRect(-4, 20, 8, 13);
        c.save(); c.translate(0, -8); c.rotate(0.5);
        for (i = 0; i < 4; i++) {
          c.rotate(Math.PI / 2);
          c.strokeStyle = th.encre; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -34); c.stroke();
          c.lineWidth = 1.1; c.fillStyle = "#f3ecd4"; c.beginPath(); c.rect(1, -34, 9, 24); c.fill(); c.stroke();
        }
        c.restore();
        c.fillStyle = th.encre; c.beginPath(); c.arc(0, -8, 2.6, 0, TAU); c.fill();
        break;
      case "phare":
        ombreSol(c, 0, 34, 26, 6);
        c.fillStyle = "#8f897c"; c.beginPath(); c.moveTo(-24, 34); c.quadraticCurveTo(-18, 22, 0, 22); c.quadraticCurveTo(18, 22, 24, 34); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#f3ecd4"; c.beginPath(); c.moveTo(-10, 26); c.lineTo(-6.5, -22); c.lineTo(6.5, -22); c.lineTo(10, 26); c.closePath(); c.fill(); c.stroke();
        c.save(); c.beginPath(); c.moveTo(-10, 26); c.lineTo(-6.5, -22); c.lineTo(6.5, -22); c.lineTo(10, 26); c.closePath(); c.clip();
        c.fillStyle = TOIT; c.fillRect(-12, 10, 24, 8); c.fillRect(-12, -8, 24, 8);
        c.fillStyle = OMBRE; c.fillRect(0, -24, 12, 52);
        c.restore();
        var halo = c.createRadialGradient(0, -28, 1, 0, -28, 22);
        halo.addColorStop(0, "rgba(255,226,120,0.95)"); halo.addColorStop(1, "rgba(255,210,90,0)");
        c.fillStyle = halo; c.beginPath(); c.arc(0, -28, 22, 0, TAU); c.fill();
        c.fillStyle = "#ffe98a"; c.beginPath(); c.rect(-5.5, -33, 11, 11); c.fill(); c.stroke();
        c.fillStyle = TOIT; c.beginPath(); c.moveTo(-8, -33); c.lineTo(0, -42); c.lineTo(8, -33); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-9, -22); c.lineTo(9, -22); c.stroke();
        break;
      case "auberge":
        ombreSol(c, 0, 32, 38, 7);
        maison(c, -4, 32, 44, 22);
        c.fillStyle = "#ffd98a"; c.fillRect(-20, 15, 7, 7); c.fillRect(6, 15, 7, 7);
        c.strokeRect(-20, 15, 7, 7); c.strokeRect(6, 15, 7, 7);
        c.fillStyle = PIERRE; c.beginPath(); c.rect(8, -12, 7, 14); c.fill(); c.stroke();
        c.lineWidth = 1.8; c.beginPath(); c.moveTo(28, 32); c.lineTo(28, -4); c.lineTo(40, -4); c.stroke(); c.lineWidth = 1.4;
        c.fillStyle = FANION; c.beginPath(); c.rect(31, -2, 11, 11); c.fill(); c.stroke();
        c.strokeStyle = "rgba(120,120,120,0.55)"; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(12, -14); c.quadraticCurveTo(18, -26, 10, -34); c.quadraticCurveTo(4, -42, 12, -50); c.stroke();
        break;
      case "puits":
        ombreSol(c, 0, 33, 26, 6);
        c.fillStyle = PIERRE; c.beginPath(); c.rect(-16, 12, 32, 21); c.fill(); c.stroke();
        c.fillStyle = OMBRE; c.fillRect(0, 12, 16, 21);
        c.strokeStyle = "rgba(60,46,26,0.4)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-16, 22); c.lineTo(16, 22); c.moveTo(-5, 12); c.lineTo(-5, 22); c.moveTo(6, 22); c.lineTo(6, 33); c.stroke();
        c.strokeStyle = th.encre; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-13, 12); c.lineTo(-13, -14); c.moveTo(13, 12); c.lineTo(13, -14); c.stroke();
        c.lineWidth = 1.4; c.fillStyle = TOIT; c.beginPath(); c.moveTo(-21, -12); c.lineTo(0, -30); c.lineTo(21, -12); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 4); c.stroke();
        c.fillStyle = BOIS; c.beginPath(); c.rect(-4, 4, 8, 7); c.fill(); c.stroke();
        break;
      case "portail":
        ombreSol(c, 0, 34, 34, 7);
        var magie = c.createRadialGradient(0, 8, 2, 0, 8, 24);
        magie.addColorStop(0, "rgba(220,200,255,0.98)"); magie.addColorStop(0.6, accent || "rgba(140,90,220,0.85)"); magie.addColorStop(1, "rgba(60,30,120,0.9)");
        c.fillStyle = magie; c.beginPath(); c.moveTo(-17, 34); c.lineTo(-17, 6); c.arc(0, 6, 17, Math.PI, 0); c.lineTo(17, 34); c.closePath(); c.fill();
        c.fillStyle = PIERRE;
        c.beginPath(); c.moveTo(-27, 34); c.lineTo(-27, 6); c.arc(0, 6, 27, Math.PI, 0); c.lineTo(27, 34); c.lineTo(17, 34); c.lineTo(17, 6); c.arc(0, 6, 17, 0, Math.PI, true); c.lineTo(-17, 34); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = "rgba(60,46,26,0.45)"; c.lineWidth = 1;
        for (i = 0; i < 7; i++) { var ap = Math.PI + i * Math.PI / 6; c.beginPath(); c.moveTo(Math.cos(ap) * 17, 6 + Math.sin(ap) * 17); c.lineTo(Math.cos(ap) * 27, 6 + Math.sin(ap) * 27); c.stroke(); }
        c.beginPath(); c.moveTo(-27, 20); c.lineTo(-17, 20); c.moveTo(17, 20); c.lineTo(27, 20); c.stroke();
        break;
      case "cimetiere":
        ombreSol(c, 0, 33, 38, 7);
        [[-24, 30, 13, 20], [-4, 26, 15, 26], [18, 31, 13, 19], [8, 34, 11, 14]].forEach(function (t, q) {
          c.fillStyle = "#b9b3a2";
          c.beginPath(); c.moveTo(t[0] - t[2] / 2, t[1]); c.lineTo(t[0] - t[2] / 2, t[1] - t[3] + t[2] / 2); c.arc(t[0], t[1] - t[3] + t[2] / 2, t[2] / 2, Math.PI, 0); c.lineTo(t[0] + t[2] / 2, t[1]); c.closePath(); c.fill(); c.stroke();
          c.fillStyle = OMBRE; c.fillRect(t[0], t[1] - t[3] + t[2] / 2, t[2] / 2, t[3] - t[2] / 2);
          if (q === 1) { c.beginPath(); c.moveTo(t[0], t[1] - t[3] + 5); c.lineTo(t[0], t[1] - 8); c.moveTo(t[0] - 4, t[1] - t[3] + 10); c.lineTo(t[0] + 4, t[1] - t[3] + 10); c.stroke(); }
        });
        break;
      case "bataille":
        c.lineCap = "round";
        [[-1, 1], [1, 1]].forEach(function (d) {
          c.save(); c.scale(d[0], 1); c.rotate(-0.72);
          c.strokeStyle = th.encre; c.lineWidth = 7.4; c.beginPath(); c.moveTo(0, 30); c.lineTo(0, -34); c.stroke();
          c.strokeStyle = "#dcdcd6"; c.lineWidth = 4.6; c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -33); c.stroke();
          c.strokeStyle = accent || "#8e6a2a"; c.lineWidth = 4.6; c.beginPath(); c.moveTo(0, 30); c.lineTo(0, 14); c.stroke();
          c.strokeStyle = th.encre; c.lineWidth = 6.4; c.beginPath(); c.moveTo(-10, 13); c.lineTo(10, 13); c.stroke();
          c.strokeStyle = "#c9a15a"; c.lineWidth = 3.6; c.beginPath(); c.moveTo(-10, 13); c.lineTo(10, 13); c.stroke();
          c.restore();
        });
        break;
      case "ancien":
        ombreSol(c, 4, 33, 38, 8);
        c.fillStyle = "#5a4026";
        c.beginPath(); c.moveTo(-10, 33); c.quadraticCurveTo(-5, 18, -7, 2); c.lineTo(7, 2); c.quadraticCurveTo(5, 18, 11, 33); c.closePath(); c.fill(); c.stroke();
        [[-22, -4, 20], [22, -6, 19], [-10, -24, 20], [12, -26, 19], [0, -10, 24]].forEach(function (b2, q) {
          var gr = c.createRadialGradient(b2[0] - b2[2] * 0.3, b2[1] - b2[2] * 0.4, b2[2] * 0.1, b2[0], b2[1], b2[2]);
          gr.addColorStop(0, "#b9d86a"); gr.addColorStop(0.6, accent || "#5a9a3c"); gr.addColorStop(1, "#27552b");
          c.fillStyle = gr; c.beginPath(); c.arc(b2[0], b2[1], b2[2], 0, TAU); c.fill();
          if (q === 4) { c.strokeStyle = "rgba(20,50,20,0.35)"; c.lineWidth = 1; c.stroke(); }
        });
        break;
      case "epave":
        c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-44, 32); c.quadraticCurveTo(-30, 27, -18, 32); c.moveTo(16, 34); c.quadraticCurveTo(30, 29, 44, 34); c.stroke();
        c.strokeStyle = th.encre; c.lineWidth = 1.4;
        c.save(); c.rotate(-0.34);
        c.fillStyle = BOIS; c.beginPath(); c.moveTo(-34, 6); c.lineTo(30, 6); c.lineTo(20, 26); c.lineTo(-22, 26); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#1f150b"; c.beginPath(); c.moveTo(-6, 10); c.lineTo(4, 12); c.lineTo(0, 22); c.lineTo(-9, 19); c.closePath(); c.fill();
        c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, 6); c.lineTo(-10, -32); c.stroke();
        c.lineWidth = 1.2; c.fillStyle = "rgba(240,232,208,0.9)";
        c.beginPath(); c.moveTo(-10, -30); c.lineTo(8, -20); c.lineTo(2, -12); c.lineTo(10, -4); c.lineTo(-7, -2); c.closePath(); c.fill(); c.stroke();
        c.restore();
        break;
      case "cabane":
        ombreSol(c, 2, 30, 34, 7);
        c.fillStyle = BOIS; c.beginPath(); c.rect(-20, 6, 40, 24); c.fill(); c.stroke();
        c.strokeStyle = "rgba(40,26,10,0.5)"; c.beginPath(); c.moveTo(-20, 14); c.lineTo(20, 14); c.moveTo(-20, 22); c.lineTo(20, 22); c.stroke();
        c.strokeStyle = th.encre; c.fillStyle = "#5b3d22";
        c.beginPath(); c.moveTo(-26, 8); c.lineTo(0, -16); c.lineTo(26, 8); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#2a1c10"; c.fillRect(-5, 16, 10, 14);
        c.strokeStyle = "rgba(120,120,120,0.55)"; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(12, -10); c.quadraticCurveTo(18, -24, 10, -34); c.quadraticCurveTo(4, -42, 12, -50); c.stroke();
        break;
      case "campement":
        ombreSol(c, 0, 30, 38, 7);
        c.fillStyle = "#e9dcb8";
        c.beginPath(); c.moveTo(-28, 30); c.lineTo(-10, -12); c.lineTo(8, 30); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#2a1c10"; c.beginPath(); c.moveTo(-14, 30); c.lineTo(-10, 8); c.lineTo(-6, 30); c.closePath(); c.fill();
        c.fillStyle = "#d9caa0";
        c.beginPath(); c.moveTo(6, 30); c.lineTo(20, 0); c.lineTo(34, 30); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = "#4a331c"; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(-2, 34); c.lineTo(12, 30); c.moveTo(12, 34); c.lineTo(-2, 30); c.stroke();
        c.fillStyle = "#ff9a2a"; c.beginPath(); c.moveTo(2, 30); c.quadraticCurveTo(-2, 22, 5, 16); c.quadraticCurveTo(7, 24, 10, 30); c.closePath(); c.fill();
        break;
      case "ferme":
        ombreSol(c, 0, 31, 42, 7);
        c.strokeStyle = "rgba(60,48,16,0.5)"; c.lineWidth = 1;
        [["#b9b84a", -44, 20], ["#8fae45", -44, 10], ["#c8b04a", 18, 22], ["#9cb74b", 20, 12]].forEach(function (f) {
          c.fillStyle = f[0]; c.beginPath(); c.moveTo(f[1], f[2]); c.lineTo(f[1] + 28, f[2] - 3); c.lineTo(f[1] + 26, f[2] + 7); c.lineTo(f[1] - 3, f[2] + 9); c.closePath(); c.fill(); c.stroke();
        });
        c.lineWidth = 1.5; c.strokeStyle = th.encre;
        maison(c, 0, 26, 28, 18);
        break;
      case "menhirs":
        ombreSol(c, 2, 31, 30, 6);
        [[-16, 8, 11, 30], [0, 0, 13, 40], [17, 10, 10, 26]].forEach(function (p) {
          c.fillStyle = "#a9a392";
          c.beginPath(); c.moveTo(p[0] - p[2] / 2, 31); c.lineTo(p[0] - p[2] / 2 + 1, 31 - p[3] * 0.8); c.quadraticCurveTo(p[0], 31 - p[3] - 2, p[0] + p[2] / 2 - 1, 31 - p[3] * 0.85); c.lineTo(p[0] + p[2] / 2, 31); c.closePath(); c.fill(); c.stroke();
          c.fillStyle = OMBRE; c.fillRect(p[0], 31 - p[3] * 0.85, p[2] / 2, p[3] * 0.85);
        });
        break;
      case "grotte":
        ombreSol(c, 0, 31, 36, 6);
        c.fillStyle = "#8f897c";
        c.beginPath(); c.moveTo(-34, 31); c.quadraticCurveTo(-36, -18, 0, -20); c.quadraticCurveTo(36, -18, 34, 31); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#1f150b"; c.beginPath(); c.moveTo(-11, 31); c.lineTo(-11, 14); c.arc(0, 14, 11, Math.PI, 0); c.lineTo(11, 31); c.closePath(); c.fill();
        break;
      case "vestiges":
        ombreSol(c, 0, 31, 36, 6);
        c.fillStyle = "#b3ab98";
        c.beginPath(); c.moveTo(-30, 31); c.lineTo(-30, 8); c.lineTo(-22, 2); c.lineTo(-16, 10); c.lineTo(-8, 4); c.lineTo(-2, 31); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(6, 31); c.lineTo(8, 14); c.lineTo(18, 18); c.lineTo(26, 8); c.lineTo(32, 31); c.closePath(); c.fill(); c.stroke();
        break;
      case "oasis":
        c.fillStyle = "#3d8fc4"; c.beginPath(); c.ellipse(0, 26, 30, 8, 0, 0, TAU); c.fill(); c.stroke();
        [[-18, 24, -34], [16, 24, -42]].forEach(function (p) {
          c.strokeStyle = "#5a3d22"; c.lineWidth = 3; c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[0] + 4, p[1] / 2, p[0] + 2, p[2]); c.stroke();
          c.strokeStyle = "#3f7a34"; c.lineWidth = 3.2;
          for (var a = 0; a < 5; a++) { c.beginPath(); c.moveTo(p[0] + 2, p[2]); c.quadraticCurveTo(p[0] + 2 + (a - 2) * 9, p[2] - 8, p[0] + 2 + (a - 2) * 13, p[2] + 6); c.stroke(); }
        });
        break;
      case "pilotis":
        c.fillStyle = "rgba(30,66,68,0.6)"; c.beginPath(); c.ellipse(0, 30, 34, 8, 0, 0, TAU); c.fill();
        c.strokeStyle = "#4a331c"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-18, 12); c.lineTo(-18, 32); c.moveTo(18, 12); c.lineTo(18, 32); c.moveTo(0, 12); c.lineTo(0, 32); c.stroke();
        c.lineWidth = 1.5; c.strokeStyle = th.encre;
        c.fillStyle = BOIS; c.beginPath(); c.rect(-22, -6, 44, 18); c.fill(); c.stroke();
        c.fillStyle = "#5b3d22"; c.beginPath(); c.moveTo(-28, -4); c.lineTo(0, -26); c.lineTo(28, -4); c.closePath(); c.fill(); c.stroke();
        break;
      default:
        ombreSol(c, 0, 31, 30, 7);
        maison(c, 0, 30, 30, 20);
    }
    ctx.restore();
  }

  // ----- Lieux vus du dessus (style Plan) -----
  var ICONES_DESSUS = { village: 1, ville: 1, capitale: 1, fort: 1, tour: 1, port: 1, temple: 1, ruine: 1, cabane: 1, ferme: 1,
    auberge: 1, moulin: 1, phare: 1, puits: 1, menhirs: 1, donjon: 1, grotte: 1, mine: 1, navire: 1, campement: 1,
    pilotis: 1, vestiges: 1, portail: 1, cimetiere: 1, bataille: 1, oasis: 1, ancien: 1, epave: 1 };

  function iconeDessus(ctx, type, x, y, s, th, accent) {
    var k = 100 / s, lw = Math.max(1.5, k * 1.2), pierre = "#cdc6b1", toitT = accent || "#a8613f", ombre = "rgba(16,30,28,0.3)";
    var toit = function (px, py, w, h, a, v) { maisonDessus(ctx, px, py, w, h, a, v, k * 0.6, accent || null); };
    var tour = function (px, py, r, carre) { tourDessus(ctx, px, py, r, !!carre, 0, pierre, toitT, 1 / k); };
    var disque = function (cx, cy, r, fond) {
      ctx.fillStyle = ombre; ctx.beginPath(); ctx.arc(cx + 4, cy + 5, r, 0, TAU); ctx.fill();
      ctx.fillStyle = fond; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.stroke();
    };
    var enceinte = function (r, sol) {                       // une enceinte ronde : sol, mur de pierre
      ctx.fillStyle = ombre; ctx.beginPath(); ctx.arc(4, 5, r + 3, 0, TAU); ctx.fill();
      ctx.fillStyle = sol; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#1c2622"; ctx.lineWidth = 6 + lw; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = pierre; ctx.lineWidth = 6; ctx.stroke();
    };
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 100, s / 100);
    ctx.lineJoin = ctx.lineCap = "round";
    var i;
    switch (type) {
      case "village":
        [[-18, -8, 22, 14, 0.2], [10, -16, 18, 12, -0.3], [22, 8, 20, 13, 0.5], [-8, 16, 20, 13, -0.2], [-30, 12, 15, 11, 0.6]].forEach(function (m, q) { toit(m[0], m[1], m[2], m[3], m[4], q * 7 + 2); });
        disque(-2, -2, 5, "#4b8166");
        break;
      case "ville":
        enceinte(44, "#c9bd92");
        for (i = 0; i < 9; i++) { var a = i * TAU / 9 + 0.3, r = 25 + (i % 2) * 6; toit(Math.cos(a) * r, Math.sin(a) * r, 17, 11, a + Math.PI / 2, i * 5 + 1); }
        toit(0, 0, 26, 15, 0.3, 5);
        [[0, -44], [44, 0], [0, 44], [-44, 0]].forEach(function (q) { tour(q[0], q[1], 6.5); });
        break;
      case "capitale":
        enceinte(47, "#c9bd92");
        for (i = 0; i < 12; i++) { var a2 = i * TAU / 12 + 0.2, r2 = 30 + (i % 2) * 6; toit(Math.cos(a2) * r2, Math.sin(a2) * r2, 15, 10, a2 + Math.PI / 2, i * 3 + 4); }
        for (i = 0; i < 8; i++) tour(Math.cos(i * TAU / 8) * 47, Math.sin(i * TAU / 8) * 47, 6.5);
        tour(0, 0, 14, true);
        break;
      case "fort":
        ctx.fillStyle = ombre; ctx.fillRect(-35, -34, 76, 76);
        ctx.fillStyle = "#c9bd92"; ctx.fillRect(-38, -38, 76, 76);
        ctx.strokeStyle = "#1c2622"; ctx.lineWidth = 9 + lw; ctx.strokeRect(-38, -38, 76, 76);
        ctx.strokeStyle = pierre; ctx.lineWidth = 9; ctx.strokeRect(-38, -38, 76, 76);
        toit(0, 0, 32, 22, 0.1, 6);
        [[-38, -38], [38, -38], [38, 38], [-38, 38]].forEach(function (q) { tour(q[0], q[1], 10); });
        break;
      case "tour": tour(0, 0, 26); break;
      case "port":
        [[-30, -8, 24, 15, 0.1], [-12, 12, 20, 13, -0.2], [-36, 14, 16, 11, 0.4]].forEach(function (m, q) { toit(m[0], m[1], m[2], m[3], m[4], q * 5 + 3); });
        ctx.fillStyle = ombre; ctx.fillRect(2, 2, 46, 10);
        ctx.fillStyle = "#a98558"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.fillRect(-2, -3, 48, 10); ctx.strokeRect(-2, -3, 48, 10);
        ctx.fillStyle = "#8f6a45"; ctx.beginPath(); ctx.ellipse(32, -18, 14, 5.5, 0.08, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(20, -11); ctx.quadraticCurveTo(10, -9, 4, -12); ctx.stroke();
        break;
      case "temple":
        ctx.fillStyle = ombre; ctx.fillRect(-26, -9, 64, 26); ctx.fillRect(-8, -27, 26, 62);
        ctx.fillStyle = "#d6cdb4"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.rect(-30, -12, 60, 24); ctx.rect(-12, -30, 24, 60); ctx.fill(); ctx.stroke();
        ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeStyle = "rgba(70,60,44,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.stroke();
        break;
      case "ruine":
        ctx.fillStyle = ombre; ctx.beginPath(); ctx.arc(4, 5, 4, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#1c2622"; ctx.lineWidth = 9 + lw; ctx.setLineDash([16, 8]); ctx.strokeRect(-32, -24, 64, 48);
        ctx.strokeStyle = "#b9b3a2"; ctx.lineWidth = 9; ctx.strokeRect(-32, -24, 64, 48); ctx.setLineDash([]);
        [[-8, 4, 5], [10, -6, 4], [18, 10, 3.4], [-20, 8, 3]].forEach(function (q) { disque(q[0], q[1], q[2], "#b9b3a2"); });
        break;
      case "cabane": toit(0, 0, 40, 26, 0.15, 2); break;
      case "ferme":
        ctx.fillStyle = "#9a7a64"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw;
        ctx.save(); ctx.rotate(-0.12); ctx.fillRect(-42, -30, 50, 38); ctx.strokeRect(-42, -30, 50, 38);
        ctx.strokeStyle = "rgba(40,24,16,0.45)"; ctx.lineWidth = 1.2; ctx.beginPath(); for (i = 1; i < 7; i++) { ctx.moveTo(-42, -30 + i * 5.4); ctx.lineTo(8, -30 + i * 5.4); } ctx.stroke(); ctx.restore();
        toit(22, -6, 34, 22, 0.1, 8); toit(26, 22, 20, 14, -0.1, 3);
        break;
      case "auberge": toit(-4, -6, 46, 26, 0.08, 4); toit(14, 16, 24, 16, 0.08, 1); break;
      case "moulin":
        disque(0, 0, 11, pierre);
        ctx.fillStyle = "#f0ead2"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw;
        for (i = 0; i < 4; i++) { ctx.save(); ctx.rotate(0.55 + i * Math.PI / 2); ctx.beginPath(); ctx.rect(-3.4, -40, 6.8, 29); ctx.fill(); ctx.stroke(); ctx.restore(); }
        disque(0, 0, 4, "#7a5a3a");
        break;
      case "phare":
        ctx.fillStyle = "#6c6a62"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(0, 4, 34, 28, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
        var lueur = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); lueur.addColorStop(0, "rgba(255,230,130,0.95)"); lueur.addColorStop(1, "rgba(255,210,90,0)");
        ctx.fillStyle = lueur; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
        tour(0, 0, 12);
        break;
      case "puits": disque(0, 0, 18, pierre); disque(0, 0, 10, "#6aa6b2"); break;
      case "menhirs":
        for (i = 0; i < 8; i++) { var am = i * TAU / 8; ctx.save(); ctx.translate(Math.cos(am) * 30, Math.sin(am) * 30); ctx.rotate(am);
          ctx.fillStyle = ombre; ctx.beginPath(); ctx.ellipse(3, 3, 5.5, 8, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = "#b3b0a2"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 8, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
        disque(0, 0, 6, "#9b9889");
        break;
      case "donjon": case "grotte": case "mine":
        rocherDessus(ctx, type === "mine" ? 2 : 1, false);
        ctx.fillStyle = "#141010"; ctx.beginPath(); ctx.ellipse(0, 8, 11, 7, 0, 0, TAU); ctx.fill();
        if (type === "mine") { ctx.fillStyle = "#8a6238"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.beginPath(); ctx.rect(-16, 2, 5, 12); ctx.rect(11, 2, 5, 12); ctx.rect(-16, -1, 32, 5); ctx.fill(); ctx.stroke(); }
        break;
      case "navire":
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-44, -4); ctx.quadraticCurveTo(-52, 0, -44, 4); ctx.moveTo(-36, -8); ctx.quadraticCurveTo(-48, 0, -36, 8); ctx.stroke();
        ctx.fillStyle = ombre; ctx.beginPath(); ctx.moveTo(-32, 5); ctx.quadraticCurveTo(0, 22, 40, 4); ctx.quadraticCurveTo(0, -10, -32, 5); ctx.fill();
        ctx.fillStyle = "#8f6a45"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(-36, 0); ctx.quadraticCurveTo(-6, -17, 40, 0); ctx.quadraticCurveTo(-6, 17, -36, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f0ead2"; ctx.beginPath(); ctx.ellipse(-8, 0, 3.4, 13, 0, 0, TAU); ctx.ellipse(12, 0, 3, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
        break;
      case "campement":
        toit(-14, -6, 24, 17, 0.35, 0); toit(14, 6, 22, 16, -0.4, 0); toit(-4, 20, 18, 13, 0.1, 0);
        break;
      case "pilotis":
        ctx.fillStyle = ombre; ctx.fillRect(-8, 4, 56, 12);
        ctx.fillStyle = "#a98558"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.fillRect(-12, 0, 56, 11); ctx.strokeRect(-12, 0, 56, 11);
        ctx.fillStyle = "#2a1a0b"; [[-12, 0], [44, 0], [-12, 11], [44, 11]].forEach(function (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 2.6, 0, TAU); ctx.fill(); });
        toit(-6, -10, 42, 26, 0.04, 6);
        break;
      case "vestiges":
        [[-22, -8, 10], [8, -16, 8], [20, 8, 11], [-8, 14, 9], [-28, 14, 6]].forEach(function (q) { disque(q[0], q[1], q[2], "#b9b3a2"); });
        ctx.strokeStyle = "#1c2622"; ctx.lineWidth = 7 + lw; ctx.setLineDash([10, 9]); ctx.beginPath(); ctx.moveTo(-34, -22); ctx.lineTo(26, -26); ctx.stroke();
        ctx.strokeStyle = "#cdc6b1"; ctx.lineWidth = 7; ctx.stroke(); ctx.setLineDash([]);
        break;
      case "portail":
        ctx.fillStyle = ombre; ctx.beginPath(); ctx.arc(4, 5, 30, 0, TAU); ctx.fill();
        var magie = ctx.createRadialGradient(0, 0, 2, 0, 0, 24); magie.addColorStop(0, "rgba(232,214,255,0.98)"); magie.addColorStop(0.6, accent || "rgba(140,90,220,0.9)"); magie.addColorStop(1, "rgba(60,30,120,0.95)");
        ctx.fillStyle = magie; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#1c2622"; ctx.lineWidth = 9 + lw; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
        ctx.strokeStyle = pierre; ctx.lineWidth = 9; ctx.stroke();
        [[-28, 0], [28, 0]].forEach(function (q) { disque(q[0], q[1], 7, "#b9b3a2"); });
        break;
      case "cimetiere":
        ctx.fillStyle = "rgba(196,206,176,0.85)"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.fillRect(-42, -32, 84, 64); ctx.strokeRect(-42, -32, 84, 64);
        for (var gi = 0; gi < 3; gi++) for (var gj = 0; gj < 3; gj++) {
          var gx = -26 + gi * 26, gy = -18 + gj * 18;
          ctx.fillStyle = ombre; ctx.fillRect(gx - 4 + 3, gy - 6 + 3, 8, 12);
          ctx.fillStyle = "#b9b3a2"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw * 0.8; ctx.fillRect(gx - 4, gy - 6, 8, 12); ctx.strokeRect(gx - 4, gy - 6, 8, 12);
        }
        break;
      case "bataille":
        [[-1, 1], [1, 1]].forEach(function (d) {
          ctx.save(); ctx.rotate(d[0] * 0.75);
          ctx.fillStyle = ombre; ctx.fillRect(-2.5 + 3, -36 + 3, 6, 56);
          ctx.fillStyle = "#dcdcd6"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw; ctx.fillRect(-3, -36, 6, 50); ctx.strokeRect(-3, -36, 6, 50);
          ctx.fillStyle = accent || "#8e6a2a"; ctx.fillRect(-14, 12, 28, 6); ctx.strokeRect(-14, 12, 28, 6); ctx.fillRect(-3, 18, 6, 14); ctx.strokeRect(-3, 18, 6, 14);
          ctx.restore();
        });
        [[-30, 22], [32, -18], [26, 26], [-34, -14]].forEach(function (q) { disque(q[0], q[1], 4, "#8e2b22"); });
        break;
      case "oasis":
        ctx.fillStyle = "#ead9a0"; ctx.strokeStyle = "rgba(120,96,40,0.5)"; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(0, 0, 44, 33, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#5aa6c0"; ctx.strokeStyle = "#1c2622"; ctx.beginPath(); ctx.ellipse(0, 0, 28, 19, 0, 0, TAU); ctx.fill(); ctx.stroke();
        [[-30, -16], [30, -14], [-24, 20], [26, 20]].forEach(function (q) {
          for (var pi = 0; pi < 7; pi++) { var pa = pi / 7 * TAU; ctx.strokeStyle = pi % 2 ? "#2f7a34" : "#4f9f3f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(pa) * 11, q[1] + Math.sin(pa) * 11); ctx.stroke(); }
          disque(q[0], q[1], 2.6, "#5a3a1c");
        });
        break;
      case "ancien":
        ctx.save(); ctx.scale(1.3, 1.3); PEINTRES_DESSUS.arbre(ctx, 3); ctx.restore();
        break;
      case "epave":
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(0, 0, 44, 20, -0.15, 0.3, 5.9); ctx.stroke();
        ctx.fillStyle = ombre; ctx.beginPath(); ctx.moveTo(-34, 4); ctx.quadraticCurveTo(-4, 22, 34, 4); ctx.lineTo(24, -6); ctx.quadraticCurveTo(-4, -12, -34, 4); ctx.fill();
        ctx.fillStyle = "#7a5a3a"; ctx.strokeStyle = "#1c2622"; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(-36, 0); ctx.quadraticCurveTo(-6, -16, 30, -6); ctx.lineTo(18, 6); ctx.lineTo(24, 12); ctx.quadraticCurveTo(-6, 16, -36, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(40,24,12,0.55)"; ctx.lineWidth = 1.4; ctx.beginPath();
        for (i = 0; i < 5; i++) { ctx.moveTo(-26 + i * 10, -8 + i * 1.2); ctx.lineTo(-26 + i * 10, 8 - i * 0.6); }
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  // Le pictogramme ou le dessin, selon le thème de la carte. Les repères (point, croix,
  // étoile, drapeau) restent des pictogrammes partout ; les types sans pictogramme
  // (moulin, grotte, campement…) sont dessinés dans tous les thèmes.
  function estDessine(type, th) {
    var tp = TYPES_LIEUX[type];
    if (tp && tp.repere) return false;
    return !!(th && th.lieuxIllustres) || !tp || !tp.px;
  }
  function iconeAuto(ctx, type, x, y, s, th, accent) {
    if (th.dessus && ICONES_DESSUS[type]) iconeDessus(ctx, type, x, y, s, th, accent);
    else if (estDessine(type, th)) iconeIllustree(ctx, type, x, y, s, th, accent);
    else icone(ctx, type, x, y, s, th, accent);
  }

  function visibleLieu(l, nivActuel) {
    var tp = TYPES_LIEUX[l.type] || TYPES_LIEUX.ville;
    var min = typeof l.niv === "number" ? l.niv : tp.niv;
    return nivActuel >= min;
  }
  function tailleIcone(l, th) {
    var tp = TYPES_LIEUX[l.type] || TYPES_LIEUX.ville;
    return (estDessine(l.type, th) ? tp.pxIll : tp.px) * (l.ech || 1);
  }

  // ----- Images personnalisées -----
  //
  // Un lieu peut porter une image importée par l'auteur (un blason, un dessin). Elle est
  // gardée dans la carte (`carte.images`, des data-URL réduites à 256 px) et décodée une
  // fois ; tant qu'elle ne l'est pas, le lieu est dessiné sans elle, puis `surImage`
  // prévient l'éditeur qu'il peut redessiner.
  var imagesDecodees = {};
  function imageDe(carte, cle) {
    var src = carte.images && carte.images[cle];
    // Jamais d'adresse distante (un fichier importé pourrait en contenir) : rien ne sort d'ici.
    if (typeof src !== "string" || src.indexOf("data:image/") !== 0) return null;
    var im = imagesDecodees[src];
    if (!im) {
      im = imagesDecodees[src] = new Image();
      im.onload = function () { if (Moteur.surImage) Moteur.surImage(); };
      im.src = src;
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  // Toutes les images d'une carte, prêtes : à attendre avant un export ou une vignette.
  function preparerImages(carte) {
    var cles = Object.keys(carte.images || {});
    return Promise.all(cles.map(function (cle) {
      if (imageDe(carte, cle)) return null;
      var im = imagesDecodees[carte.images[cle]];
      if (!im) return null;
      return new Promise(function (ok) { im.addEventListener("load", ok); im.addEventListener("error", ok); });
    }));
  }

  function dessinerIconeLieu(ctx, carte, l, sx, sy, s, th) {
    if (l.a) {
      // Un lieu tourné : tout est dessiné autour de son centre (le nom, lui, reste droit).
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(l.a * Math.PI / 180);
      dessinerIconeLieu0(ctx, carte, l, 0, 0, s, th);
      ctx.restore();
    } else dessinerIconeLieu0(ctx, carte, l, sx, sy, s, th);
  }
  function dessinerIconeLieu0(ctx, carte, l, sx, sy, s, th) {
    if (l.type === "image") {
      var im = imageDe(carte, l.image);
      if (im) {
        var k = s / Math.max(im.naturalWidth, im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
        ctx.save();
        ctx.translate(sx, sy);
        if (l.miroir) ctx.scale(-1, 1);
        ctx.drawImage(im, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else icone(ctx, "point", sx, sy, 10 * (s / 56), th, l.couleur);
      return;
    }
    if (l.miroir) {
      ctx.save();
      ctx.translate(sx, sy); ctx.scale(-1, 1);
      iconeAuto(ctx, l.type, 0, 0, s, th, l.couleur);
      ctx.restore();
    } else iconeAuto(ctx, l.type, sx, sy, s, th, l.couleur);
  }

  // Le nom d'un lieu : sa police, et la boîte qu'il occuperait à chacune des quatre
  // positions (dessous, à droite, dessus, à gauche).
  function boiteNom(pos, sx, sy, s, w, f, h) {
    var r = s / 2 + f * 0.35;
    if (pos === "haut") return [sx - w / 2, sy - r - h, w, h];
    if (pos === "droite") return [sx + r, sy - h / 2, w, h];
    if (pos === "gauche") return [sx - r - w, sy - h / 2, w, h];
    return [sx - w / 2, sy + r, w, h];
  }
  function seTouchent(a, b) { return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]; }

  // Les lieux, en pixels écran. Trois soins de cartographe : un lieu apparaît en fondu
  // quand on atteint son niveau de zoom ; ceux du sud passent devant ceux du nord ; et les
  // noms ne se recouvrent pas — le plus important est écrit d'abord, les suivants cherchent
  // une place libre autour de leur icône (dessous, à droite, dessus, à gauche) et, s'il
  // n'y en a aucune, attendent que l'on zoome.
  function dessinerLieux(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr) {
    var liste = carte.lieux || [];
    if (!liste.length) return;
    var niv = niveau(carte, vue), visibles = [];
    for (var i = 0; i < liste.length; i++) {
      var l = liste[i];
      if (!visibleLieu(l, niv)) continue;
      var sx = l.x * z + tx, sy = l.y * z + ty;
      if (sx < -260 * dpr || sx > pw + 260 * dpr || sy < -160 * dpr || sy > ph + 160 * dpr) continue;
      var tp = TYPES_LIEUX[l.type] || TYPES_LIEUX.ville;
      var min = typeof l.niv === "number" ? l.niv : tp.niv;
      visibles.push({ l: l, tp: tp, sx: sx, sy: sy, s: tailleIcone(l, th) * dpr, min: min,
        alpha: min > 0 ? Math.min(1, 0.2 + (niv / min - 1) / 0.14 * 0.8) : 1 });
    }
    if (!visibles.length) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = "round";
    visibles.sort(function (a, b) { return a.sy - b.sy; });
    visibles.forEach(function (v) {
      ctx.globalAlpha = v.alpha;
      dessinerIconeLieu(ctx, carte, v.l, v.sx, v.sy, v.s, th);
    });
    // Les noms : du plus important au moins important.
    var ordre = visibles.slice().sort(function (a, b) { return (a.min - b.min) || ((b.l.ech || 1) - (a.l.ech || 1)); });
    var prises = ordre.map(function (v) { return [v.sx - v.s * 0.36, v.sy - v.s * 0.36, v.s * 0.72, v.s * 0.72]; });
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ordre.forEach(function (v, rang) {
      var l = v.l, tp = v.tp;
      if (!l.nom || l.sansNom) return;
      var f = tp.police * (l.ech || 1) * (l.tailleNom || 1) * dpr;
      var maj = l.styleNom === "maj" || (tp.maj && l.styleNom == null), italique = l.styleNom === "italique";
      var texte = maj ? l.nom.toUpperCase() : l.nom;
      ctx.font = (italique ? "italic " : "") + (maj ? "700 " : "600 ") + f + "px " + POLICE;
      var w = ctx.measureText(texte).width + (maj ? f * 0.1 * texte.length : 0);
      var fs = f * 0.78, ws = 0;
      if (l.sousTitre) {
        ctx.font = "italic 500 " + fs + "px " + POLICE;
        ws = ctx.measureText(l.sousTitre).width;
      }
      var h = f * 1.15 + (l.sousTitre ? fs * 1.1 : 0), W = Math.max(w, ws);
      var essais = l.posNom ? [l.posNom] : ["bas", "droite", "haut", "gauche"], boite = null, pos = null;
      for (var e = 0; e < essais.length && !boite; e++) {
        var b = boiteNom(essais[e], v.sx, v.sy, v.s, W, f, h), libre = true;
        for (var q = 0; q < prises.length && libre; q++) if (q !== rang && seTouchent(b, prises[q])) libre = false;
        if (libre || l.posNom) { boite = b; pos = essais[e]; }
      }
      if (!boite) return;
      prises.push(boite);
      ctx.globalAlpha = v.alpha;
      ctx.textAlign = pos === "droite" ? "left" : pos === "gauche" ? "right" : "center";
      var ax = pos === "droite" ? boite[0] : pos === "gauche" ? boite[0] + boite[2] : boite[0] + boite[2] / 2;
      var ay = boite[1] + f * 0.58;
      ctx.font = (italique ? "italic " : "") + (maj ? "700 " : "600 ") + f + "px " + POLICE;
      if ("letterSpacing" in ctx) ctx.letterSpacing = (maj ? f * 0.1 : 0) + "px";
      ctx.lineWidth = Math.max(2, f * 0.22);
      ctx.strokeStyle = th.halo;
      ctx.strokeText(texte, ax, ay);
      ctx.fillStyle = l.couleurNom || th.encre;
      ctx.fillText(texte, ax, ay);
      if (l.sousTitre) {
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        ctx.font = "italic 500 " + fs + "px " + POLICE;
        ctx.lineWidth = Math.max(2, fs * 0.22);
        ctx.strokeText(l.sousTitre, ax, ay + f * 0.6 + fs * 0.5);
        ctx.fillText(l.sousTitre, ax, ay + f * 0.6 + fs * 0.5);
      }
    });
    ctx.restore();
  }

  // ----- Grille -----
  function dessinerGrille(ctx, carte, vue, th) {
    var pas = joli(110 / vue.zoom);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, carte.largeur, carte.hauteur);
    ctx.clip();
    ctx.strokeStyle = th.grille;
    ctx.lineWidth = 1 / vue.zoom;
    ctx.beginPath();
    for (var x = pas; x < carte.largeur; x += pas) { ctx.moveTo(x, 0); ctx.lineTo(x, carte.hauteur); }
    for (var y = pas; y < carte.hauteur; y += pas) { ctx.moveTo(0, y); ctx.lineTo(carte.largeur, y); }
    ctx.stroke();
    ctx.restore();
  }

  // ----- Vagues le long des côtes -----
  //
  // Des filets qui suivent la côte à distance fixe en pixels : la silhouette de la terre
  // est élargie (copies décalées dans 12 directions), puis on en retire la même
  // silhouette moins épaisse — il reste un anneau, qu'on teinte. Travaillé à demi-résolution :
  // quatre fois moins de pixels, et des filets fins n'ont pas besoin de plus.
  function ondesCotieres(ctx, cvT, th, dpr, pw, ph) {
    var demi = couche("ondes", Math.max(1, Math.ceil(pw / 2)), Math.max(1, Math.ceil(ph / 2)));
    var tc = demi.getContext("2d");
    var DIR = 12;
    th.vagues.forEach(function (v) {
      var rr = v.r * dpr / 2, e = 0.8 * dpr / 2, k, a;
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.globalCompositeOperation = "source-over";
      tc.clearRect(0, 0, demi.width, demi.height);
      for (k = 0; k < DIR; k++) {
        a = k * TAU / DIR;
        tc.drawImage(cvT, Math.cos(a) * (rr + e), Math.sin(a) * (rr + e), demi.width, demi.height);
      }
      tc.globalCompositeOperation = "destination-out";
      for (k = 0; k < DIR; k++) {
        a = k * TAU / DIR;
        tc.drawImage(cvT, Math.cos(a) * (rr - e), Math.sin(a) * (rr - e), demi.width, demi.height);
      }
      tc.globalCompositeOperation = "source-in";
      tc.fillStyle = th.vagueCouleur;
      tc.fillRect(0, 0, demi.width, demi.height);
      tc.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalAlpha = v.a;
      ctx.drawImage(demi, 0, 0, pw, ph);
      ctx.restore();
    });
  }

  // ----- Parchemin : taches du papier et cadre orné -----
  var papier = null;
  function motifPapier(ctx) {
    if (!papier) {
      var c = document.createElement("canvas");
      c.width = c.height = 512;
      var g = c.getContext("2d");
      var i, x, y, r, rg, sombre;
      for (i = 0; i < 70; i++) {
        x = alea(11, i * 5) * 512; y = alea(11, i * 5 + 1) * 512; r = 40 + alea(11, i * 5 + 2) * 150;
        sombre = alea(11, i * 5 + 3) > 0.45;
        rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, sombre ? "rgba(120,78,28," + (0.05 + alea(11, i * 5 + 4) * 0.08) + ")" : "rgba(255,244,210,0.12)");
        rg.addColorStop(1, "rgba(120,78,28,0)");
        g.fillStyle = rg;
        // Dessinée aussi de l'autre côté du bord : le motif se raccorde en se répétant.
        [-512, 0, 512].forEach(function (dx) {
          [-512, 0, 512].forEach(function (dy) {
            g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
          });
        });
      }
      for (i = 0; i < 4500; i++) {
        g.fillStyle = "rgba(90,58,20," + (0.03 + alea(13, i * 3 + 2) * 0.06) + ")";
        g.fillRect(alea(13, i * 3) * 512, alea(13, i * 3 + 1) * 512, 1.4, 1.4);
      }
      papier = c;
    }
    return ctx.createPattern(papier, "repeat");
  }

  // Les taches sont accrochées au monde : elles suivent le déplacement et le zoom.
  function tachesPapier(ctx, carte, tx, ty, z) {
    var motif = motifPapier(ctx);
    var echelle = Math.max(carte.largeur, carte.hauteur) / 3 / 512 * z;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (motif.setTransform && typeof DOMMatrix !== "undefined") motif.setTransform(new DOMMatrix([echelle, 0, 0, echelle, tx, ty]));
    ctx.fillStyle = motif;
    ctx.fillRect(tx, ty, carte.largeur * z, carte.hauteur * z);
    ctx.restore();
  }

  // Double filet et petits ornements aux quatre coins, d'épaisseur constante à l'écran.
  function cadreOrne(ctx, carte, vue, th) {
    var u = 1 / vue.zoom;
    if (carte.largeur * vue.zoom < 160) return;
    var m = 11 * u, L = carte.largeur, H = carte.hauteur;
    ctx.save();
    ctx.strokeStyle = th.cadre;
    ctx.fillStyle = th.cadre;
    ctx.lineWidth = 1.4 * u;
    ctx.strokeRect(m, m, L - 2 * m, H - 2 * m);
    ctx.lineWidth = 0.8 * u;
    ctx.strokeRect(m * 1.5, m * 1.5, L - 3 * m, H - 3 * m);
    var coins = [[m, m, 1, 1], [L - m, m, -1, 1], [m, H - m, 1, -1], [L - m, H - m, -1, -1]];
    if (th.orneRiche) {
      // Des volutes dans les coins et un fleuron au milieu de chaque côté.
      ctx.lineWidth = 1.1 * u;
      coins.forEach(function (c) {
        [[1, 0], [0, 1]].forEach(function (d) {
          var bx = c[0] + c[2] * (30 + d[0] * 26) * u, by = c[1] + c[3] * (30 + d[1] * 26) * u;
          ctx.beginPath();
          ctx.moveTo(c[0] + c[2] * 26 * u * (d[0] ? 1 : 0.4), c[1] + c[3] * 26 * u * (d[1] ? 1 : 0.4));
          ctx.bezierCurveTo(bx, by - c[3] * 14 * u * d[0], bx + c[2] * 12 * u, by + c[3] * 12 * u, bx - c[2] * 4 * u * d[0], by - c[3] * 4 * u * d[1]);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(bx - c[2] * 4 * u * d[0], by - c[3] * 4 * u * d[1], 2 * u, 0, TAU); ctx.fill();
        });
      });
      [[L / 2, m * 1.25, 1, 0], [L / 2, H - m * 1.25, 1, 0], [m * 1.25, H / 2, 0, 1], [L - m * 1.25, H / 2, 0, 1]].forEach(function (f) {
        ctx.beginPath();
        ctx.moveTo(f[0] - f[2] * 22 * u, f[1] - f[3] * 22 * u);
        ctx.quadraticCurveTo(f[0] - f[3] * 9 * u, f[1] - f[2] * 9 * u, f[0] + f[2] * 22 * u, f[1] + f[3] * 22 * u);
        ctx.quadraticCurveTo(f[0] + f[3] * 9 * u, f[1] + f[2] * 9 * u, f[0] - f[2] * 22 * u, f[1] - f[3] * 22 * u);
        ctx.fill();
      });
    }
    coins.forEach(function (c) {
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.arc(c[0] + c[2] * 15 * u, c[1] + c[3] * 15 * u, 11 * u, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c[0] + c[2] * 15 * u, c[1] + c[3] * 15 * u, 3.2 * u, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  // ----- Ornements : rose des vents, échelle, cartouche -----
  //
  // Ils font partie de la carte (ils sont dans l'image exportée) et sont à sa mesure : leur
  // taille est une fraction du petit côté, pas un nombre de pixels. `carte.ornements` :
  // { rose: "hg" | "hd" | "bg" | "bd" | "", echelle: bool, titre: bool }.
  function roseDesVents(ctx, cx, cy, R, th) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = "round";
    ctx.strokeStyle = th.cadre; ctx.fillStyle = "rgba(246,236,208,0.55)";
    ctx.lineWidth = R * 0.022;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = R * 0.012;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (var g = 0; g < 32; g++) { var ag = g * TAU / 32; ctx.moveTo(Math.cos(ag) * R * 0.7, Math.sin(ag) * R * 0.7); ctx.lineTo(Math.cos(ag) * R * (g % 2 ? 0.74 : 0.78), Math.sin(ag) * R * (g % 2 ? 0.74 : 0.78)); }
    ctx.stroke();
    // Seize pointes : les quatre grandes, les quatre moyennes, les huit petites — chacune
    // en deux moitiés, l'une claire et l'autre sombre.
    [[8, 0.5, 0.46, 0.09, TAU / 16], [4, 0.66, 0.5, 0.13, TAU / 8], [4, 1, 0.5, 0.17, 0]].forEach(function (serie) {
      for (var k = 0; k < serie[0]; k++) {
        var a = serie[4] + k * TAU / serie[0] - Math.PI / 2, L = R * serie[1], l = R * serie[3];
        var px = Math.cos(a) * L, py = Math.sin(a) * L;
        [-1, 1].forEach(function (cote) {
          var b = a + cote * Math.PI / 2 * 0.999, bx = Math.cos(a + cote * Math.PI / 4) * l * 1.3, by = Math.sin(a + cote * Math.PI / 4) * l * 1.3;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bx, by); ctx.lineTo(px, py); ctx.closePath();
          ctx.fillStyle = cote < 0 ? "#f3e7c2" : (serie[1] === 1 && k === 0 ? "#8e2b22" : th.cadre);
          ctx.fill(); ctx.lineWidth = R * 0.012; ctx.stroke();
          void b;
        });
      }
    });
    ctx.fillStyle = "#f3e7c2"; ctx.beginPath(); ctx.arc(0, 0, R * 0.07, 0, TAU); ctx.fill(); ctx.lineWidth = R * 0.015; ctx.stroke();
    ctx.font = "700 " + (R * 0.3) + "px " + POLICE;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = R * 0.07; ctx.strokeStyle = th.halo; ctx.strokeText("N", 0, -R * 1.2);
    ctx.fillStyle = th.cadre; ctx.fillText("N", 0, -R * 1.2);
    ctx.restore();
  }

  function dessinerOrnements(ctx, carte, vue, th) {
    var o = carte.ornements;
    if (!o) return;
    var L = carte.largeur, H = carte.hauteur, m = Math.min(L, H);
    if (m * vue.zoom < 220) return;                          // carte minuscule à l'écran : rien
    ctx.save();
    if (o.rose) {
      var R = m * 0.085, mx = m * 0.05 + R, my = m * 0.05 + R * 1.45;
      roseDesVents(ctx, o.rose.charAt(1) === "g" ? mx : L - mx, o.rose.charAt(0) === "h" ? my : H - mx, R, th);
    }
    if (o.echelle) {
      // Une longueur ronde, proche du cinquième de la largeur, en quatre cases alternées.
      var d = joli(L * 0.18), h = m * 0.011;
      var aGauche = o.rose !== "bg";
      var x0 = aGauche ? m * 0.06 : L - m * 0.06 - d, y0 = H - m * 0.075;
      ctx.lineWidth = m * 0.0016; ctx.strokeStyle = th.cadre;
      for (var c = 0; c < 4; c++) {
        ctx.fillStyle = c % 2 ? "#f3e7c2" : th.cadre;
        ctx.fillRect(x0 + d * c / 4, y0, d / 4, h);
      }
      ctx.strokeRect(x0, y0, d, h);
      // Les libellés sont écrits en pixels d'écran (une police ne suit pas la transformation
      // du monde) : on calcule leur place à l'écran, puis on rend la transformation.
      var T = ctx.getTransform(), fs = m * 0.024 * T.a, enM = d < 1;
      var nb = function (v) { return enM ? String(Math.round(v * 1000)) : String(nombreFr(v)); };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = "600 " + fs + "px " + POLICE;
      ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round"; ctx.textAlign = "center";
      [[0, "0"], [d / 2, nb(d / 2)], [d, enM ? Math.round(d * 1000) + " m" : nb(d) + " km"]].forEach(function (g) {
        var wx = x0 + g[0], wy = y0 - m * 0.008;
        var px = T.a * wx + T.c * wy + T.e, py = T.b * wx + T.d * wy + T.f;
        ctx.lineWidth = fs * 0.28; ctx.strokeStyle = th.halo; ctx.strokeText(g[1], px, py);
        ctx.fillStyle = th.cadre; ctx.fillText(g[1], px, py);
      });
      ctx.setTransform(T.a, T.b, T.c, T.d, T.e, T.f);
    }
    if (o.titre && carte.nom) {
      // Le cartouche : un ruban de parchemin en haut de la carte, au nom de celle-ci.
      var f = m * 0.052, texte = String(carte.nom).toUpperCase();
      ctx.font = "700 " + f + "px " + POLICE;
      if ("letterSpacing" in ctx) ctx.letterSpacing = (f * 0.14) + "px";
      var w = ctx.measureText(texte).width + f * 1.6, hh = f * 1.55, cx = L / 2, cy = m * 0.05 + hh / 2, q = f * 0.55;
      var ruban = function (x, sens) {
        ctx.beginPath();
        ctx.moveTo(x, cy - hh * 0.36); ctx.lineTo(x + sens * q * 2.2, cy - hh * 0.36); ctx.lineTo(x + sens * q * 1.5, cy + hh * 0.08);
        ctx.lineTo(x + sens * q * 2.2, cy + hh * 0.52); ctx.lineTo(x, cy + hh * 0.52); ctx.closePath();
        ctx.fillStyle = "#c9ab6e"; ctx.fill(); ctx.stroke();
      };
      ctx.lineWidth = m * 0.0022; ctx.strokeStyle = th.cadre; ctx.lineJoin = "round";
      ruban(cx - w / 2 + q * 0.3, -1); ruban(cx + w / 2 - q * 0.3, 1);
      var gr = ctx.createLinearGradient(0, cy - hh / 2, 0, cy + hh / 2);
      gr.addColorStop(0, "#f6ebc8"); gr.addColorStop(1, "#dcc590");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.rect(cx - w / 2, cy - hh / 2, w, hh); ctx.fill(); ctx.stroke();
      ctx.lineWidth = m * 0.001;
      ctx.strokeRect(cx - w / 2 + f * 0.14, cy - hh / 2 + f * 0.14, w - f * 0.28, hh - f * 0.28);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = th.cadre;
      ctx.fillText(texte, cx + f * 0.07, cy + f * 0.04);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    }
    ctx.restore();
  }
  function nombreFr(v) { return Number(v).toLocaleString("fr-FR", { maximumFractionDigits: v < 10 ? 2 : 0 }); }

  // ----- Rendu complet -----
  //
  // vue : { cx, cy (point du monde au centre), zoom (px CSS par unité),
  //         largeur, hauteur (px CSS), dpr }
  // options : { rapide (sans décors ni effets, pendant un déplacement),
  //             grille, cle (canvas de travail) }
  function dessiner(cv, carte, vue, options) {
    var opts = options || {};
    // Calques masqués (`opts.cacher` : { decors, tampons, lignes, lacs, etiquettes, lieux,
    // ornements }) : on dessine une copie de la carte où ces collections sont vides — tout
    // le reste du rendu (masque, ponts, creusement) suit de lui-même.
    var cache = opts.cacher, sansDecors = false;
    if (cache) {
      var copie = Object.assign({}, carte);
      ["tampons", "lignes", "lacs", "etiquettes", "lieux"].forEach(function (k) { if (cache[k]) copie[k] = []; });
      if (cache.ornements) copie.ornements = null;
      sansDecors = !!cache.decors;
      carte = copie;
    }
    var th = THEMES[carte.theme] || THEMES.atlas;
    COULEURS = th.couleurs || null; ENCRE_DECORS = !!th.encreDecors; ECH_THEME = th.echDecors || 1;
    DESSUS = !!th.dessus; SANS_DECOR = th.sansDecor || null; CULTURES_THEME = th.cultures || null; CHAMPS_PX = th.champsPx || 0;
    var dpr = vue.dpr || 1;
    var pw = Math.max(1, Math.round(vue.largeur * dpr));
    var ph = Math.max(1, Math.round(vue.hauteur * dpr));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }

    var ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
    ctx.fillStyle = th.hors;
    ctx.fillRect(0, 0, pw, ph);

    var z = vue.zoom * dpr;
    ZPX = z;
    var tx = pw / 2 - vue.cx * z, ty = ph / 2 - vue.cy * z;
    var X0 = vue.cx - vue.largeur / 2 / vue.zoom, X1 = vue.cx + vue.largeur / 2 / vue.zoom;
    var Y0 = vue.cy - vue.hauteur / 2 / vue.zoom, Y1 = vue.cy + vue.hauteur / 2 / vue.zoom;

    // La mer : tout le rectangle de la carte, en léger dégradé.
    ctx.setTransform(z, 0, 0, z, tx, ty);
    var gd = ctx.createLinearGradient(0, 0, carte.largeur * 0.4, carte.hauteur);
    gd.addColorStop(0, th.mer);
    gd.addColorStop(1, th.mer2);
    ctx.fillStyle = gd;
    ctx.fillRect(0, 0, carte.largeur, carte.hauteur);
    if (th.papier && !opts.rapide) tachesPapier(ctx, carte, tx, ty, z);

    // La terre, sur sa propre couche : l'eau la creuse, la gomme aussi.
    var cvT = couche(opts.cle || "principal", pw, ph);
    var lc = cvT.getContext("2d");
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = "source-over";
    lc.clearRect(0, 0, pw, ph);
    lc.setTransform(z, 0, 0, z, tx, ty);
    lc.save();
    lc.beginPath();
    lc.rect(0, 0, carte.largeur, carte.hauteur);
    lc.clip();
    // 1) Les aplats de tous les traits.
    var traits = carte.traits || [];
    for (var i = 0; i < traits.length; i++) {
      var t = traits[i];
      if (!t.bb) t.bb = boiteTrait(t.pts, t.taille);
      if (!chevauche(t.bb, X0, Y0, X1, Y1)) continue;
      var mat = MAT[t.mat];
      if (!mat) continue;
      tracerTrait(lc, t, mat);
    }
    // La terre telle qu'elle est AVANT d'être creusée : l'eau douce ne doit exister que
    // dans son contour (sinon une rivière tracée jusqu'à la mer y déborde en pointe).
    var terreAvant = null;
    // L'eau douce n'est visible que dans le creux de la terre, et ses bords sont cachés sous elle :
    // sur un grand écran (ou un écran à haute densité), on la calcule à demi-résolution.
    var FE = pw * ph > 1500000 ? 2 : 1, we = Math.max(1, Math.ceil(pw / FE)), he = Math.max(1, Math.ceil(ph / FE));
    if (th.eauDouce) {
      terreAvant = couche((opts.cle || "principal") + "-avant", we, he);
      var ta = terreAvant.getContext("2d");
      ta.setTransform(1, 0, 0, 1, 0, 0);
      ta.clearRect(0, 0, we, he);
      ta.imageSmoothingEnabled = true;
      ta.drawImage(cvT, 0, 0, we, he);
    }
    // Lacs et rivières creusent la terre (encore dans le cadre de la carte).
    creuserEaux(lc, carte, vue, X0, Y0, X1, Y1);
    lc.restore();

    // Le masque des matériaux (ce qu'il y a sous chaque point : terrain, eau, route).
    // Il sert aux décors et aux ponts ; jamais pendant un déplacement.
    // (Plus d'image du terrain à l'échelle de l'écran : décors et ponts interrogent le monde.)
    var masque = opts.rapide ? null : true;

    // 2) Transitions : les couleurs des terrains se fondent les unes dans les autres
    //    (flou appliqué à la couleur seulement, la côte reste nette).
    if (!opts.rapide) fondreTransitions(lc, cvT, carte, z, dpr, pw, ph, opts.cle || "principal");

    if (!opts.rapide) {
      // 3) Le grain du sol, accroché au monde, puis les décors : ceux du terrain (semés
      //    selon le zoom) et ceux posés à la main (tampons), du fond vers l'avant.
      textureSol(lc, tx, ty, z, pw, ph);
      var decors = [], visibles = [], mT = 0;
      (carte.tampons || []).forEach(function (tp) {
        if (!PEINTRES[tp.type]) return;
        // Le centre du décor ne bouge pas : c'est autour de lui que la taille est plafonnée.
        var s = tailleTampon(tp, vue.zoom), y = tp.y - tp.s * 0.3 + s * 0.3;
        if (tp.x + s < X0 || tp.x - s > X1 || y + s < Y0 || y - s > Y1 || s * vue.zoom < 0.7) return;
        // Les décors du terrain s'écartent des tampons. La place, dessinée à plat et centrée, est
        // traitée à part : on retire ensuite tout décor dont le dessin la recouvre.
        if (tp.type !== "place") visibles.push({ x: tp.x, y: y, s: s });
        if (DESSUS && BATIMENTS[tp.type]) {
          // Vu du dessus, une maison posée à la main est un toit, orientable (`a`, en degrés).
          var kb = BATIMENTS[tp.type];
          decors.push({ x: tp.x, y: tp.y - tp.s * 0.3, maison: { w: s * 0.62 * kb, h: s * 0.4 * kb, a: (tp.a || 0) * Math.PI / 180, v: tp.v || 0 } });
        } else decors.push({ x: tp.x, y: y, s: s, sprite: tp.type, v: tp.v || 0, rot: tp.a ? tp.a * Math.PI / 180 : 0, alpha: tp.alpha });
      });
      // Les maisons des rues : les arbres leur laissent la place.
      maisonsDesRues(carte, vue, masque, X0, Y0, X1, Y1).forEach(function (mz) {
        visibles.push({ x: mz.x, y: mz.y + mz.w * 0.5, s: mz.w * 2.4 });
        if (DESSUS) decors.push({ x: mz.x, y: mz.y, maison: mz });
        else decors.push({ x: mz.x, y: mz.y + mz.w * 0.55, s: mz.w * 2.5, sprite: "maison", v: mz.v });
      });
      var nAvant = decors.length;
      if (!sansDecors) semerDecors(carte, vue, masque, X0, Y0, X1, Y1, visibles, decors);
      // Rien ne pousse sur une place : on retire les décors semés (arbres, collines, maisons…)
      // dont le dessin mord sur elle.
      (carte.tampons || []).forEach(function (tp) {
        if (tp.type !== "place") return;
        var pcx = tp.x, pcy = tp.y - tp.s * 0.3, R = tp.s * 0.5;
        for (var q = decors.length - 1; q >= nAvant; q--) {
          var o = decors[q], cx = o.x, cy = o.maison ? o.y : o.y - (o.s || 0) * 0.31, rayon = o.maison ? Math.max(o.maison.w, o.maison.h) * 0.5 : (o.s || 0) * 0.32;
          if (Math.hypot(cx - pcx, cy - pcy) < R + rayon) decors.splice(q, 1);
        }
      });
      lc.save();
      lc.setTransform(z, 0, 0, z, tx, ty);
      lc.beginPath();
      lc.rect(0, 0, carte.largeur, carte.hauteur);
      lc.clip();
      dessinerChamps(lc, carte, vue, masque, X0, Y0, X1, Y1, !!th.encreDecors);
      peindreRues(lc, decors.rues, vue.zoom);
      fissuresLave(lc, carte, vue, masque, X0, Y0, X1, Y1);
      // Routes et sentiers sont peints DANS la terre, avant les décors : les arbres qui les
      // bordent passent devant, au lieu d'un ruban posé par-dessus la forêt. « source-atop » :
      // jamais sur l'eau — là, c'est le pont qui prend le relais.
      lc.globalCompositeOperation = "source-atop";
      tracerVoies(lc, voiesVisibles(carte, vue, th, X0, Y0, X1, Y1), vue);
      lc.globalCompositeOperation = "source-over";
      peindreDecors(lc, decors);
      lc.restore();
      // L'ombre des rivages (style Enluminé) : la silhouette de l'EAU projette une ombre
      // sur la terre, qui s'assombrit vers la côte, les lacs et les rivières.
      if (th.ombreCote) {
        var cvM = couche((opts.cle || "principal") + "-mer", pw, ph), mc = cvM.getContext("2d");
        mc.setTransform(1, 0, 0, 1, 0, 0);
        mc.globalCompositeOperation = "source-over";
        mc.fillStyle = "#000";
        mc.fillRect(0, 0, pw, ph);
        mc.globalCompositeOperation = "destination-out";
        mc.drawImage(cvT, 0, 0);
        mc.globalCompositeOperation = "source-over";
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.globalCompositeOperation = "source-atop";
        ombre(lc, cvM, th.ombreCote, Math.max(4 * dpr, Math.min(13 * dpr, z * 8)), 0, 0, pw + 64);
        lc.globalCompositeOperation = "source-over";
      }
      // 4) Le grain du papier.
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = "source-atop";
      lc.fillStyle = motifGrain(lc);
      lc.fillRect(0, 0, pw, ph);
      lc.globalCompositeOperation = "source-over";
    }

    // L'eau douce (thèmes à mer de papier) : peinte à part, gardée seulement là où il y
    // avait de la terre avant le creusement, puis posée sous la terre.
    if (terreAvant) {
      var cvE = couche((opts.cle || "principal") + "-eaux", we, he), ec = cvE.getContext("2d");
      ec.setTransform(1, 0, 0, 1, 0, 0);
      ec.globalCompositeOperation = "source-over";
      ec.clearRect(0, 0, we, he);
      ec.setTransform(z / FE, 0, 0, z / FE, tx / FE, ty / FE);
      eauxDouces(ec, carte, vue, th, X0, Y0, X1, Y1);
      ec.setTransform(1, 0, 0, 1, 0, 0);
      ec.globalCompositeOperation = "destination-in";
      ec.drawImage(terreAvant, 0, 0);
      ec.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";
      ctx.drawImage(cvE, 0, 0, pw, ph);
      ctx.restore();
    }

    // Assemblage : halo d'eau peu profonde, trait de côte, puis la terre. Le tout reste
    // dans le rectangle de la carte : une terre qui touche le bord (carte d'une ville)
    // ne doit pas faire déborder son halo bleu sur la table.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx, ty, carte.largeur * z, carte.hauteur * z);
    ctx.clip();
    if (!opts.rapide) {
      var decale = pw + 64;
      var glow = th.glowPx
        ? Math.min(th.glowPx * dpr, Math.max((th.glowMin || 14) * dpr, z * 40))
        : Math.max(5 * dpr, Math.min(30 * dpr, z * 18));
      var rayonsHalo = [glow];
      if (th.glowDouble) rayonsHalo.push(glow * 0.45);
      if (th.glowTriple) rayonsHalo.push(glow, glow * 0.16);
      halo(ctx, cvT, th.glow, rayonsHalo, pw, ph);
      if (th.vagues) ondesCotieres(ctx, cvT, th, dpr, pw, ph);
      // La falaise : la silhouette de la terre, décalée vers le bas, donne du relief.
      if (th.falaise) {
        var hf = Math.max(2 * dpr, Math.min((th.falaisePx || 7) * dpr, z * (th.falaisePx ? 6 : 3)));
        // Une falaise épaisse est tracée en plusieurs pas : décalée d'un seul coup, elle
        // laisserait un jour entre la terre et son socle dans les anses étroites.
        for (var pasF = Math.max(1, Math.ceil(hf / (5 * dpr))), qf = 1; qf <= pasF; qf++) ombre(ctx, cvT, th.falaise, 0, 0, hf * qf / pasF, decale);
      }
      // La grève : un liseré de sable tout autour de la terre.
      if (th.rive) {
        var rg = Math.min(th.rive.px * dpr, Math.max(1.5 * dpr, z * 6));
        for (var kg = 0; kg < 8; kg++) ombre(ctx, cvT, th.rive.c, 0, Math.cos(kg * TAU / 8) * rg, Math.sin(kg * TAU / 8) * rg, decale);
      }
      // Le contour : un trait d'un pixel et demi. Quatre décalages en diagonale suffisent (chaque
      // décalage est une passe sur toute l'image, et il y en avait huit).
      var r = Math.max(1, 1.1 * dpr) * 1.1;
      for (var k = 0; k < 4; k++) {
        var a = Math.PI / 4 + k * Math.PI / 2;
        ombre(ctx, cvT, th.encre, 0, Math.cos(a) * r, Math.sin(a) * r, decale);
      }
    }
    ctx.drawImage(cvT, 0, 0);
    ctx.restore();

    // Lignes, grille, teinte du thème.
    ctx.setTransform(z, 0, 0, z, tx, ty);
    if (opts.grille) dessinerGrille(ctx, carte, vue, th);
    dessinerLignes(ctx, carte, vue, th, X0, Y0, X1, Y1, masque);
    if (th.papier && !opts.rapide) {
      // Bords du parchemin plus sombres, comme une feuille vieillie.
      var rayon = Math.hypot(carte.largeur, carte.hauteur) / 2;
      var vg = ctx.createRadialGradient(carte.largeur / 2, carte.hauteur / 2, rayon * 0.5, carte.largeur / 2, carte.hauteur / 2, rayon);
      vg.addColorStop(0, "rgba(70,40,10,0)");
      vg.addColorStop(1, "rgba(70,40,10,0.38)");
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, carte.largeur, carte.hauteur);
      ctx.clip();
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, carte.largeur, carte.hauteur);
      ctx.restore();
    }
    if (th.teinte) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = th.teinte;
      ctx.fillRect(tx, ty, carte.largeur * z, carte.hauteur * z);
      ctx.restore();
    }

    // Cadre de la carte.
    ctx.strokeStyle = th.cadre;
    ctx.lineWidth = Math.max(2.5 / vue.zoom, 0);
    ctx.strokeRect(0, 0, carte.largeur, carte.hauteur);
    if (th.orne) cadreOrne(ctx, carte, vue, th);
    if (!opts.rapide) dessinerOrnements(ctx, carte, vue, th);

    // Textes et icônes, en pixels écran : nets à toute échelle.
    dessinerEtiquettes(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr);
    dessinerLieux(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // La carte entière dans un canvas de `largeurPx` de large. Elle est dessinée comme sur un
  // écran de 1 100 px puis réduite : une vignette montre la carte telle qu'on la voit en
  // l'ouvrant, pas trois arbres énormes.
  function carteEntiere(carte, largeurPx, cle) {
    var ref = Math.max(largeurPx, 1100), h = ref * carte.hauteur / carte.largeur;
    var cv = document.createElement("canvas");
    var vue = { cx: carte.largeur / 2, cy: carte.hauteur / 2, zoom: ref / carte.largeur, largeur: ref, hauteur: h, dpr: largeurPx / ref };
    dessiner(cv, carte, vue, { cle: cle || "ponctuel" });
    return cv;
  }

  function vignette(carte) {
    var cv = carteEntiere(carte, 480, "vignette");
    try { return cv.toDataURL("image/jpeg", 0.78); } catch (e) { return null; }
  }

  // Trait en cours de tracé, sur la couche de dessin de l'éditeur.
  function apercuTrait(ctx, t, vue) {
    var mat = MAT[t.mat];
    if (!mat) return;
    var dpr = vue.dpr || 1, z = vue.zoom * dpr;
    ZPX = z;
    ctx.save();
    ctx.setTransform(z, 0, 0, z, vue.largeur * dpr / 2 - vue.cx * z, vue.hauteur * dpr / 2 - vue.cy * z);
    if (mat.type === "terre") {
      ctx.globalAlpha = 0.9;
      tracerTrait(ctx, t, mat);
    } else {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = ctx.fillStyle = mat.couleur;
      ctx.lineWidth = t.taille;
      ctx.lineCap = ctx.lineJoin = "round";
      var p = t.pts;
      ctx.beginPath();
      if (p.length <= 2) { ctx.arc(p[0], p[1], t.taille / 2, 0, TAU); ctx.fill(); }
      else { ctx.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  // Un décor peint, centré dans une case de `s` px : pour les palettes de l'éditeur.
  function apercuDecor(ctx, sprite, v, x, y, s) {
    var avant = ZPX;
    ZPX = 2;
    if (PEINTRES[sprite]) colle(ctx, sprite, v || 0, x, y + s * 0.31, s);
    ZPX = avant;
  }

  // Les décors automatiques d'une vue, rendus en objets ordinaires (des tampons) : chacun peut
  // ensuite être déplacé, tourné, redimensionné ou supprimé. `tampons` : les décors déjà posés,
  // dont les nouveaux s'écartent comme à l'écran. Rend aussi le rectangle couvert, à retirer des
  // décors automatiques (sans quoi ils s'afficheraient en double).
  function figerDecors(carte, vue, tampons) {
    var th = THEMES[carte.theme] || THEMES.atlas;
    COULEURS = th.couleurs || null; ENCRE_DECORS = !!th.encreDecors; ECH_THEME = th.echDecors || 1;
    DESSUS = !!th.dessus; SANS_DECOR = th.sansDecor || null; CULTURES_THEME = th.cultures || null; CHAMPS_PX = th.champsPx || 0;
    var pw = Math.max(1, Math.round(vue.largeur)), ph = Math.max(1, Math.round(vue.hauteur)), z = vue.zoom;
    ZPX = z;
    var tx = pw / 2 - vue.cx * z, ty = ph / 2 - vue.cy * z;
    var X0 = vue.cx - vue.largeur / 2 / z, X1 = vue.cx + vue.largeur / 2 / z, Y0 = vue.cy - vue.hauteur / 2 / z, Y1 = vue.cy + vue.hauteur / 2 / z;
    var masque = true;
    var liste = [];
    var evite = (tampons || []).filter(function (t) { return t.type !== "place"; }).map(function (t) { return { x: t.x, y: t.y, s: t.s }; });
    semerDecors(carte, vue, masque, X0, Y0, X1, Y1, evite, liste);
    X0 = Math.max(0, X0); Y0 = Math.max(0, Y0); X1 = Math.min(carte.largeur, X1); Y1 = Math.min(carte.hauteur, Y1);
    var out = [];
    liste.forEach(function (o) {
      if (o.x < X0 || o.x > X1 || o.y < Y0 || o.y > Y1) return;
      if (o.maison) {
        var sm = o.maison.w / 0.62;
        out.push({ type: "maison", v: o.maison.v, x: o.x, y: o.y + sm * 0.3, s: sm, a: Math.round(o.maison.a * 180 / Math.PI * 10) / 10 });
      } else out.push({ type: o.sprite, v: o.v != null ? o.v : variante(o.sprite, o.r), x: o.x, y: o.y, s: o.s, alpha: o.alpha });
    });
    var rues = (liste.rues || []).filter(function (r) {
      return Math.max(r[0], r[2]) >= X0 && Math.min(r[0], r[2]) <= X1 && Math.max(r[1], r[3]) >= Y0 && Math.min(r[1], r[3]) <= Y1;
    });
    return { objets: out, rect: [X0, Y0, X1, Y1], rues: rues };
  }

  window.Moteur = {
    figerDecors: figerDecors, fixerEchelleDecors: fixerEchelleDecors,
    THEMES: THEMES, MATERIAUX: MATERIAUX, MAT: MAT, GROUPES_MATERIAUX: GROUPES_MATERIAUX,
    DECORS: DECORS, TAMPONS: TAMPONS, VOIES: VOIES,
    TYPES_LIGNES: TYPES_LIGNES, TYPES_LIEUX: TYPES_LIEUX, CATEGORIES_LIEUX: CATEGORIES_LIEUX, STYLES_ETIQ: STYLES_ETIQ,
    POLICE: POLICE,
    alea: alea, joli: joli, distSeg: distSeg,
    niveau: niveau, zoomAjuste: zoomAjuste,
    boiteTrait: boiteTrait, nouveauTrait: nouveauTrait,
    boiteEtiquette: boiteEtiquette, poseEtiquette: poseEtiquette, positionSurLigne: positionSurLigne, visibleLieu: visibleLieu, tailleIcone: tailleIcone,
    styleLigne: styleLigne, pointsAffiches: pointsAffiches, dansPolygone: dansPolygone,
    icone: icone, iconeAuto: iconeAuto, dessinerIconeLieu: dessinerIconeLieu,
    apercuDecor: apercuDecor, BATIMENTS: BATIMENTS, tailleTampon: tailleTampon, FINESSE_MAX: FINESSE_MAX, preparerImages: preparerImages, surImage: null,
    dessiner: dessiner, carteEntiere: carteEntiere, vignette: vignette, apercuTrait: apercuTrait
  };
})();
