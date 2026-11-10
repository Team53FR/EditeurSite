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

  // ----- Matériaux : ce qu'on peut peindre -----
  // « terre » colore ; « eau » creuse la terre déjà peinte (mers, lacs, gomme).
  // `groupe` range la palette de l'éditeur ; `decor` renvoie à la table DECORS.
  // L'ORDRE COMPTE : le rang d'un matériau est son code dans le masque (et 25 au plus).
  var MATERIAUX = [
    { id: "plaine",   nom: "Plaine",          couleur: "#9bb96a", decor: "herbe",    type: "terre", groupe: "Plaines" },
    { id: "foret",    nom: "Forêt",           couleur: "#5f9148", decor: "foret",    type: "terre", groupe: "Forêts" },
    { id: "taiga",    nom: "Taïga",           couleur: "#4f7f5c", decor: "taiga",    type: "terre", groupe: "Forêts" },
    { id: "colline",  nom: "Collines",        couleur: "#b6b46c", decor: "colline",  type: "terre", groupe: "Reliefs" },
    { id: "montagne", nom: "Montagnes",       couleur: "#9a9486", decor: "montagne", type: "terre", groupe: "Reliefs" },
    { id: "cime",     nom: "Cimes neigeuses", couleur: "#d6dde0", decor: "cime",     type: "terre", groupe: "Reliefs" },
    { id: "volcan",   nom: "Volcan",          couleur: "#8a6b49", decor: "volcan",   type: "terre", groupe: "Reliefs" },
    { id: "desert",   nom: "Désert",          couleur: "#e0c887", decor: "dune",     type: "terre", groupe: "Terres arides" },
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
    { id: "toundra",  nom: "Toundra",         couleur: "#a9ad8c", decor: "toundra",  type: "terre", groupe: "Eaux et froid" }
  ];
  var MAT = {};
  MATERIAUX.forEach(function (m, i) { MAT[m.id] = m; m.code = i + 1; });
  var GROUPES_MATERIAUX = ["Plaines", "Forêts", "Reliefs", "Terres arides", "Eaux et froid"];

  // ----- Décors : peints une fois, semés ensuite -----
  //
  // Chaque décor (arbre, conifère, pic, colline, dune…) est PEINTÉ une seule fois dans un
  // petit canvas — dégradés, ombre au sol, touches de lumière, aucun contour de dessin
  // animé — puis simplement collé des centaines de fois. C'est plus beau, et bien plus
  // rapide que de retracer chaque arbre à chaque image. Quatre définitions (64, 128, 256
  // et 512 px) suivent le zoom, pour que rien ne devienne flou en s'approchant.
  var SPRITES = {};
  var ZPX = 1;   // pixels de l'appareil par unité du monde, pendant le rendu en cours

  function tailleSprite(px) { return px <= 64 ? 64 : px <= 128 ? 128 : px <= 256 ? 256 : px <= 512 ? 512 : 1024; }

  function spriteCanvas(type, v, S) {
    var cle = type + "|" + v + "|" + S;
    if (SPRITES[cle]) return SPRITES[cle];
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    g.scale(S / 100, S / 100);          // une boîte de 100 × 100 centrée ; le sol est vers y = +31
    g.lineJoin = g.lineCap = "round";
    PEINTRES[type](g, v);
    SPRITES[cle] = c;
    return c;
  }

  function ombreDecor(g, cx, cy, rx, ry, a) {
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

  function peintColline(g, v) {
    var R = function (i) { return alea(800 + v, i); };
    ombreDecor(g, 6, 28, 40, 7, 0.26);
    // Une colline basse et douce, plus large que haute, au sommet décentré.
    var w = 42 + R(1) * 8, h = 20 + R(2) * 9, dec = (R(3) - 0.5) * 0.5;
    var forme = function () {
      g.beginPath(); g.moveTo(-w, 29);
      g.bezierCurveTo(-w * (0.65 - dec), 29 - h * 1.3, w * (0.35 + dec), 29 - h * 1.4, w, 29);
      g.closePath();
    };
    var gr = g.createLinearGradient(-w * 0.6, -h * 0.4, w * 0.7, 30);
    gr.addColorStop(0, "#cfd384"); gr.addColorStop(0.5, "#a3ab5a"); gr.addColorStop(1, "#6f7a3c");
    forme(); g.fillStyle = gr; g.fill();
    g.save(); forme(); g.clip();
    g.fillStyle = "rgba(40,48,16,0.18)";                       // le versant à l'ombre
    g.beginPath(); g.ellipse(w * 0.55, 26, w * 0.6, h * 1.1, 0, 0, TAU); g.fill();
    for (var i = 0; i < 26; i++) {
      g.strokeStyle = i % 3 ? "rgba(96,110,40,0.45)" : "rgba(236,232,150,0.45)";
      g.lineWidth = 1.2;
      var x = (R(20 + i) - 0.5) * 2 * w * 0.9, y = 29 - R(50 + i) * h * 0.85;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R(80 + i) - 0.5) * 5, y - 3.2); g.stroke();
    }
    g.restore();
  }

  function peintDune(g, v) {
    var R = function (i) { return alea(900 + v, i); };
    ombreDecor(g, 4, 28, 42, 6, 0.2);
    var gr = g.createLinearGradient(-40, -10, 30, 30);
    gr.addColorStop(0, "#f4e2a8"); gr.addColorStop(1, "#cdb06a");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-42, 28); g.bezierCurveTo(-28, 2 + R(1) * 6, 0, -6 + R(2) * 6, 12, 12); g.bezierCurveTo(22, 22, 34, 20, 44, 28); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-12, 28); g.bezierCurveTo(0, 12, 14, 6 + R(3) * 6, 28, 18); g.bezierCurveTo(36, 24, 42, 26, 46, 28); g.closePath();
    g.fillStyle = "rgba(205,176,106,0.75)"; g.fill();
    g.strokeStyle = "rgba(150,108,40,0.4)"; g.lineWidth = 1.2;       // l'arête de la dune
    g.beginPath(); g.moveTo(-34, 22); g.bezierCurveTo(-24, 6, -2, -2, 12, 12); g.stroke();
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

  var PEINTRES = {
    arbre: peintArbre, conifere: peintConifere,
    automne: function (g, v) { peintArbre(g, v, "automne"); },
    tropical: function (g, v) { peintArbre(g, v, "jungle"); },
    palmier: peintPalmier, acacia: peintAcacia, mort: peintMort,
    montagne: function (g, v) { peintMontagne(g, v, false); },
    cime: function (g, v) { peintMontagne(g, v, true); },
    colline: peintColline, dune: peintDune, marais: peintMarais, herbe: peintHerbe,
    seche: function (g, v) { peintHerbe(g, v, true); },
    rocher: function (g, v) { peintRocher(g, v, false); },
    basalte: function (g, v) { peintRocher(g, v, true); },
    champ: peintChamp, glacon: peintGlacon, cratere: peintCratere
  };
  var VARIANTES = { arbre: 6, conifere: 4, automne: 6, tropical: 6, palmier: 4, acacia: 4, mort: 4, montagne: 6, cime: 6,
    colline: 4, dune: 4, marais: 3, herbe: 3, seche: 3, rocher: 6, basalte: 6, champ: 6, glacon: 4, cratere: 2 };

  // Colle un décor peint : (x, y) est le point où il touche le sol, s la taille de sa boîte.
  function colle(ctx, type, v, x, y, s) {
    var S = tailleSprite(s * ZPX);
    ctx.drawImage(spriteCanvas(type, v, S), x - s / 2, y - s * 0.81, s, s);
  }
  function variante(type, r) {
    var n = VARIANTES[type];
    return Math.min(n - 1, Math.floor(r * n));
  }

  // Terres volcaniques : aiguilles d'obsidienne, fissures de lave, cailloux sombres.
  function volcan(ctx, x, y, s, r) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (r < 0.4) {
      var w = s * 0.34, h = s * (0.75 + r * 0.6);
      ctx.fillStyle = "#1f1a19";
      ctx.strokeStyle = "#0b0909";
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.moveTo(x - w, y + h * 0.35);
      ctx.lineTo(x - w * 0.55, y - h * 0.18);
      ctx.lineTo(x - w * 0.32, y - h * 0.1);
      ctx.lineTo(x, y - h * 0.52);
      ctx.lineTo(x + w * 0.22, y - h * 0.08);
      ctx.lineTo(x + w * 0.58, y - h * 0.26);
      ctx.lineTo(x + w, y + h * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(140,128,128,0.55)";
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.9, y + h * 0.3); ctx.lineTo(x - w * 0.52, y - h * 0.14); ctx.lineTo(x, y - h * 0.48);
      ctx.stroke();
      ctx.strokeStyle = "#ff9a2a";
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.05, y + h * 0.33); ctx.lineTo(x + w * 0.08, y + h * 0.05); ctx.lineTo(x - w * 0.02, y - h * 0.2);
      ctx.stroke();
    } else if (r < 0.75) {
      var chemin = function () {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y);
        ctx.lineTo(x - s * 0.22, y - s * 0.12);
        ctx.lineTo(x, y + s * 0.06);
        ctx.lineTo(x + s * 0.26, y - s * 0.1);
        ctx.lineTo(x + s * 0.5, y + s * 0.05);
      };
      ctx.strokeStyle = "#c23c10";
      ctx.lineWidth = s * 0.1;
      chemin(); ctx.stroke();
      ctx.strokeStyle = "#ff8a1c";
      ctx.lineWidth = s * 0.06;
      chemin(); ctx.stroke();
      ctx.strokeStyle = "#ffd86a";
      ctx.lineWidth = s * 0.026;
      chemin(); ctx.stroke();
    } else {
      ctx.fillStyle = "#2a2220";
      ctx.strokeStyle = "#0b0909";
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y + s * 0.12); ctx.lineTo(x - s * 0.18, y - s * 0.1); ctx.lineTo(x - s * 0.02, y + s * 0.12);
      ctx.moveTo(x + s * 0.02, y + s * 0.14); ctx.lineTo(x + s * 0.14, y - s * 0.04); ctx.lineTo(x + s * 0.3, y + s * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
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
    champs:   { C: 15,   p: 1,    marge: 0.3,  choix: [["champ", 1, 46]] },
    savane:   { C: 17,   p: 0.8,  marge: 0.15, choix: [["acacia", 0.3, 36], ["seche", 0.7, 15]] },
    foret:    { C: 8.5, p: 1,    marge: 0.12, choix: [["arbre", 0.9, 28], ["conifere", 0.1, 28]] },
    automne:  { C: 8.5, p: 1,    marge: 0.12, choix: [["automne", 1, 28]] },
    taiga:    { C: 8.5, p: 1,    marge: 0.12, choix: [["conifere", 1, 28]] },
    jungle:   { C: 8.5,   p: 1,    marge: 0.12, choix: [["tropical", 0.72, 29], ["palmier", 0.28, 33]] },
    morte:    { C: 12,   p: 0.8,  marge: 0.12, choix: [["mort", 1, 27]] },
    colline:  { C: 19,   p: 0.85, marge: 0.25, choix: [["colline", 1, 46]] },
    montagne: { C: 22,   p: 0.9,  marge: 0.28, choix: [["montagne", 1, 64]] },
    cime:     { C: 22,   p: 0.9,  marge: 0.28, choix: [["cime", 1, 64]] },
    volcan:   { C: 21,   p: 0.7,  marge: 0.2,  choix: [["@volcan", 1, 30]] },
    rocaille: { C: 13,   p: 0.8,  marge: 0.15, choix: [["rocher", 1, 24]] },
    dune:     { C: 20,   p: 0.7,  marge: 0.25, choix: [["dune", 1, 44]] },
    cendres:  { C: 19,   p: 0.5,  marge: 0.15, choix: [["basalte", 0.6, 20], ["mort", 0.4, 24]] },
    toundra:  { C: 15,   p: 0.5,  marge: 0.1,  choix: [["rocher", 0.35, 15], ["seche", 0.65, 14]] },
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
    { id: "cratere", nom: "Volcan", max: 230 }, { id: "colline", nom: "Colline", max: 170 }, { id: "dune", nom: "Dune", max: 170 },
    { id: "rocher", nom: "Rochers" }, { id: "basalte", nom: "Roche sombre" }, { id: "glacon", nom: "Glace" },
    { id: "champ", nom: "Champ" }, { id: "marais", nom: "Roseaux" }, { id: "herbe", nom: "Herbes" }, { id: "seche", nom: "Herbes sèches" }
  ];

  var MAX_TAMPON = {};
  TAMPONS.forEach(function (t) { MAX_TAMPON[t.id] = t.max || 120; });
  // La taille d'un tampon dans le monde, à ce zoom (px CSS par unité).
  function tailleTampon(t, zoom) { return Math.min(t.s, MAX_TAMPON[t.type] / zoom); }

  // ----- Types d'objets -----
  var TYPES_LIGNES = {
    riviere:   { nom: "Rivière",        px: 2.4 },
    route:     { nom: "Route",          px: 3 },
    pavee:     { nom: "Route pavée",    px: 3.4 },
    sentier:   { nom: "Sentier",        px: 1.4 },
    falaise:   { nom: "Falaise",        px: 1.6 },
    muraille:  { nom: "Muraille",       px: 5 },
    frontiere: { nom: "Frontière",      px: 2.4 },
    maritime:  { nom: "Route maritime", px: 1.6 }
  };
  // Les voies : elles se rejoignent, portent des ponts, et les décors s'en écartent.
  var VOIES = { route: true, pavee: true, sentier: true };

  // `niv` : niveau de zoom à partir duquel le lieu apparaît (0 = toujours).
  // 1 correspond à la carte entière tenant dans l'écran.
  // `px` : taille du pictogramme ; `pxIll` : taille du dessin (style Illustré, et types
  // qui n'ont pas de pictogramme) ; `cat` : rangement dans la palette de l'éditeur.
  var TYPES_LIEUX = {
    capitale:  { nom: "Capitale",   px: 22, pxIll: 84, police: 17, niv: 0,   maj: true, cat: "Cités" },
    ville:     { nom: "Ville",      px: 15, pxIll: 62, police: 14, niv: 0.6, cat: "Cités" },
    village:   { nom: "Village",    px: 10, pxIll: 42, police: 12, niv: 2.5, cat: "Cités" },
    port:      { nom: "Port",       px: 14, pxIll: 66, police: 13, niv: 1.2, cat: "Cités" },
    ferme:     { nom: "Ferme",      pxIll: 44, police: 12, niv: 4, cat: "Cités" },
    cabane:    { nom: "Cabane",     pxIll: 38, police: 12, niv: 5, cat: "Cités" },
    campement: { nom: "Campement",  pxIll: 40, police: 12, niv: 5, cat: "Cités" },
    pilotis:   { nom: "Pilotis",    pxIll: 40, police: 12, niv: 5, cat: "Cités" },
    fort:      { nom: "Forteresse", px: 15, pxIll: 58, police: 13, niv: 1.5, cat: "Ouvrages" },
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
    lc.fillStyle = lc.strokeStyle = terre ? (couleur || mat.couleur) : "#000";
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

  // Ce que le masque dit d'un point : l'indice du pixel, ou -1 hors du masque.
  function pixelMasque(masque, wx, wy) {
    var sx = Math.floor((wx * masque.z + masque.tx) / masque.ech), sy = Math.floor((wy * masque.z + masque.ty) / masque.ech);
    if (sx < 0 || sy < 0 || sx >= masque.mw || sy >= masque.mh) return -1;
    return (sy * masque.mw + sx) * 4;
  }

  // Rassemble dans `liste` les décors à dessiner pour cette vue : { x, y, s, sprite, v } en
  // unités du monde. `tampons` : les décors posés à la main, dont les autres s'écartent.
  function semerDecors(carte, vue, masque, X0, Y0, X1, Y1, tampons, liste) {
    if (!masque) return;
    var zoom = vue.zoom, data = masque.data, mw = masque.mw, mh = masque.mh;
    if (memoCases.size > 400000) memoCases.clear();
    // Quels écarts (C × échelle) faut-il parcourir ? Ceux des traits visibles.
    var ecarts = {}, traits = carte.traits || [], i;
    for (i = 0; i < traits.length; i++) {
      var t = traits[i], mat = MAT[t.mat], d = mat && DECORS[mat.decor];
      if (!d || t.sansDecor || t.dens === 0 || !t.bb || !chevauche(t.bb, X0, Y0, X1, Y1)) continue;
      ecarts[d.C * ECHELLES[t.ech == null ? 1 : t.ech]] = true;
    }
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
    var L = carte.largeur, H = carte.hauteur;
    Object.keys(ecarts).forEach(function (cleEcart) {
      var Ce = parseFloat(cleEcart);
      var niveauReel = Math.log(CASE0 * zoom / Ce) / Math.LN2;
      var k = Math.max(0, Math.floor(niveauReel)), f = niveauReel - k;
      var D = CASE0 / Math.pow(2, k), m = 80 / zoom;
      var i0 = Math.max(0, Math.floor((X0 - m) / D)), i1 = Math.min(Math.floor(L / D), Math.floor((X1 + m) / D));
      var j0 = Math.max(0, Math.floor((Y0 - m) / D)), j1 = Math.min(Math.floor(H / D), Math.floor((Y1 + m) / D));
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 450000) return;
      // Un nouveau venu grandit pendant que l'on zoome ; les anciens ont leur taille.
      var pousse = Math.min(1, f / 0.6); pousse = pousse * pousse * (3 - 2 * pousse);
      for (var cj = j0; cj <= j1; cj++) {
        for (var ci = i0; ci <= i1; ci++) {
          var pt = pointCase(k, ci, cj);
          if (pt.k === k && pousse < 0.06) continue;                   // un nouveau venu, encore invisible
          var px = pixelMasque(masque, pt.x, pt.y);
          if (px < 0 || data[px + 3] < 128) continue;                 // hors masque, ou de l'eau
          if (data[px + 1] > 128) continue;                           // une route
          var mt = MATERIAUX[Math.round(data[px] / 10) - 1];
          var dd = mt && DECORS[mt.decor];
          if (!dd) continue;
          var code = Math.round(data[px + 2] / 20) - 1;               // densité × 3 + échelle
          if (code < 0) continue;
          var ech = ECHELLES[code % 3], dens = DENSITES[Math.floor(code / 3)];
          if (Math.abs(dd.C * ech - Ce) > 1e-6) continue;             // ce terrain a un autre écart             // ce terrain a un autre écart
          if (pt.r >= dd.p * dens) continue;
          // Quel décor, parmi ceux du terrain ?
          var ch = dd.choix[0], cumul = 0;
          for (var q = 0; q < dd.choix.length; q++) { cumul += dd.choix[q][1]; if (pt.r2 < cumul) { ch = dd.choix[q]; break; } }
          var taillePx = ch[2] * ech * (0.82 + 0.36 * pt.r3) * (pt.k === k ? pousse : 1);
          if (taillePx < 3.5) continue;
          var s = taillePx / zoom;
          // Bien à l'intérieur de son terrain : les quatre voisins disent la même chose.
          var e = Math.max(1, Math.round(dd.marge * taillePx * masque.z / zoom / masque.ech));
          var sx = (px / 4) % mw, sy = Math.floor(px / 4 / mw), ok = true;
          for (var w = 0; w < 4 && ok; w++) {
            var nx = sx + (w === 0 ? -e : w === 1 ? e : 0), ny = sy + (w === 2 ? -e : w === 3 ? Math.round(e * 0.5) : 0);
            if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
            var np = (ny * mw + nx) * 4;
            if (data[np] !== data[px] || data[np + 3] < 128 || (w !== 2 && data[np + 1] > 128)) ok = false;
          }
          if (!ok) continue;
          if (gt) {
            var voisins = gt[Math.floor(pt.x / gc) + "," + Math.floor(pt.y / gc)];
            if (voisins) {
              for (var u = 0; u < voisins.length && ok; u++) {
                var tp = voisins[u];
                if (Math.hypot(tp.x - pt.x, (tp.y - tp.s * 0.12 - pt.y) * 1.3) < tp.s * 0.36 + s * 0.2) ok = false;
              }
              if (!ok) continue;
            }
          }
          liste.push({ x: pt.x, y: pt.y, s: s, sprite: ch[0], r: pt.r3 });
        }
      }
    });
  }

  // Peint les décors (semés et tampons), du fond vers l'avant.
  function peindreDecors(lc, liste) {
    liste.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < liste.length; i++) {
      var o = liste[i];
      if (o.sprite === "@volcan") volcan(lc, o.x, o.y - o.s * 0.2, o.s, o.r);
      else colle(lc, o.sprite, o.v != null ? o.v % VARIANTES[o.sprite] : variante(o.sprite, o.r), o.x, o.y, o.s);
    }
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

  // ----- Lignes : rivières, routes, frontières -----
  function styleLigne(l, th) {
    if (l.type === "riviere") return { c: l.couleur || th.riviere, tiret: null, lisse: l.lisse !== false, min: 1.4, halo: false };
    if (l.type === "route") return { c: l.couleur || "#d9c48e", tiret: null, lisse: true, min: 2.4, halo: false };
    if (l.type === "pavee") return { c: l.couleur || "#bdb6a6", tiret: null, lisse: true, min: 2.6, halo: false };
    if (l.type === "sentier") return { c: l.couleur || "#b79a62", tiret: null, lisse: true, min: 1.3, halo: false };
    if (l.type === "falaise") return { c: l.couleur || "#4a3620", tiret: null, lisse: true, min: 1.2, halo: false };
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
    var amp = onde * 0.3 * force;
    var h = hashTexte(String(l.id || "")), ph1 = alea(h, 1) * TAU, ph2 = alea(h, 2) * TAU;
    var out = [];
    for (i = 0; i < m; i++) {
      var a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
      var tx = dense[2 * b] - dense[2 * a], ty = dense[2 * b + 1] - dense[2 * a + 1];
      var tl = Math.hypot(tx, ty) || 1;
      var env = Math.min(1, cum[i] / (onde * 0.8), (total - cum[i]) / (onde * 0.8));
      env = env * env * (3 - 2 * env);
      var off = amp * env * (Math.sin(cum[i] / onde * TAU + ph1) * 0.75 + Math.sin(cum[i] / (onde * 0.57) * TAU + ph2) * 0.25);
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
    var troncons = l.delta ? Math.min(28, Math.max(1, Math.floor(m / 6))) : 1;
    c.lineCap = c.lineJoin = "round";
    c.setLineDash([]);
    for (var k = 0; k < troncons; k++) {
      var a = Math.floor(k * (m - 1) / troncons), b = Math.floor((k + 1) * (m - 1) / troncons);
      var t = (k + 0.5) / troncons;
      c.lineWidth = Math.max(l.delta ? lw * (0.35 + 0.9 * t) : lw, min || 0) + (extra || 0);
      c.beginPath();
      c.moveTo(d[2 * a], d[2 * a + 1]);
      for (var j = a + 1; j <= b; j++) c.lineTo(d[2 * j], d[2 * j + 1]);
      c.stroke();
    }
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
  function tracerMuraille(ctx, l, st, lw, vue, th) {
    var p = l.pts, n = p.length;
    var px = lw * vue.zoom;
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(lw * 0.22, lw * 0.34);
    cheminLigne(ctx, p, false);
    ctx.strokeStyle = "rgba(40,28,10,0.3)";
    ctx.lineWidth = lw * 1.2;
    ctx.stroke();
    ctx.restore();
    cheminLigne(ctx, p, false);
    ctx.strokeStyle = th.encre;
    ctx.lineWidth = lw + 2 / vue.zoom;
    ctx.stroke();
    cheminLigne(ctx, p, false);
    ctx.strokeStyle = st.c;
    ctx.lineWidth = lw;
    ctx.stroke();
    if (px >= 5) {
      cheminLigne(ctx, p, false);
      ctx.strokeStyle = "rgba(40,30,18,0.55)";
      ctx.lineWidth = lw * 0.16;
      ctx.setLineDash([lw * 0.5, lw * 0.5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (px < 4) return;

    var tours = [], pas = lw * 9, prochain = 0, parcouru = 0;
    for (var i = 0; i + 3 < n; i += 2) {
      var dx = p[i + 2] - p[i], dy = p[i + 3] - p[i + 1], L = Math.hypot(dx, dy);
      if (!L) continue;
      while (prochain <= parcouru + L) {
        var f = (prochain - parcouru) / L;
        tours.push(p[i] + dx * f, p[i + 1] + dy * f);
        prochain += pas;
      }
      parcouru += L;
    }
    tours.push(p[n - 2], p[n - 1]);
    var ordre = [];
    for (var t = 0; t < tours.length; t += 2) ordre.push(t);
    ordre.sort(function (a, b) { return tours[a + 1] - tours[b + 1]; });
    var u = lw * 2.3 / 16;
    ordre.forEach(function (t) {
      ctx.save();
      ctx.translate(tours[t], tours[t + 1]);
      ctx.scale(u, u);
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = th.encre;
      tourPierre(ctx, 0, 5, 16, 20, 11);
      ctx.restore();
    });
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
    voies.forEach(function (v) { v.d = pointsAffiches(v.l); v.sentier = v.l.type === "sentier"; v.pavee = v.l.type === "pavee"; });
    var chemin = function (d) {
      ctx.beginPath();
      ctx.moveTo(d[0], d[1]);
      for (var i = 2; i < d.length; i += 2) ctx.lineTo(d[i], d[i + 1]);
    };
    ctx.setLineDash([]);
    ctx.lineCap = ctx.lineJoin = "round";
    // 1) Les bas-côtés.
    voies.forEach(function (v) {
      chemin(v.d);
      ctx.strokeStyle = v.sentier ? "rgba(70,48,24,0.32)" : v.pavee ? "rgba(44,40,34,0.62)" : "rgba(60,40,18,0.5)";
      ctx.lineWidth = v.lw + (v.sentier ? 1.6 : 2.4) * u;
      ctx.stroke();
    });
    // 2) Les chaussées : les sentiers d'abord, les routes par-dessus.
    voies.filter(function (v) { return v.sentier; }).concat(voies.filter(function (v) { return !v.sentier; })).forEach(function (v) {
      chemin(v.d);
      ctx.strokeStyle = v.st.c;
      ctx.lineWidth = v.lw;
      if (v.sentier) ctx.setLineDash([v.lw * 2.4, v.lw * 1.2]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    // 3) Le milieu des routes, plus clair, usé par les roues.
    voies.forEach(function (v) {
      if (v.sentier) return;
      chemin(v.d);
      ctx.strokeStyle = v.pavee ? "rgba(255,255,250,0.22)" : "rgba(255,246,214,0.32)";
      ctx.lineWidth = v.lw * 0.5;
      ctx.stroke();
    });
    // 3 bis) Les joints des pavés : un pointillé aussi large que la chaussée.
    voies.forEach(function (v) {
      if (!v.pavee || v.lw * vue.zoom < 4) return;
      chemin(v.d);
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(60,54,46,0.42)";
      ctx.lineWidth = v.lw * 0.86;
      ctx.setLineDash([Math.max(0.5 * u, v.lw * 0.07), v.lw * 0.5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = "round";
    });
    // 4) Les ornières : deux sillons de charrette (et non un marquage au sol, qui ferait
    //    route moderne).
    voies.forEach(function (v) {
      if (v.sentier || v.pavee || v.lw * vue.zoom < 4.5) return;
      [-0.24, 0.24].forEach(function (k) {
        var o = decaler(v.d, v.lw * k);
        chemin(o);
        ctx.strokeStyle = "rgba(110,80,42,0.3)";
        ctx.lineWidth = v.lw * 0.09;
        ctx.stroke();
      });
    });
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

  // ----- Ce qu'il y a sous un point : le masque des matériaux -----
  //
  // Pour poser un pont sur la mer, ou un campement dans la forêt, il faut savoir quel
  // matériau recouvre un point. Les traits sont tous repeints, en petit (un tiers de la
  // définition), chacun d'une couleur-code ; l'eau creuse comme à l'écran. Une lecture de
  // pixels, une fois par image : bien moins cher que de tester chaque trait un à un.
  //
  // Le masque déborde de l'écran d'un cinquième de chaque côté : ce qui se trouve juste
  // au-delà du bord (le bout d'une route, la base d'une montagne) doit être connu, sans
  // quoi « hors du masque » se confondait avec « dans l'eau » — et des ponts naissaient
  // au bord de l'écran.
  function construireMasque(carte, vue, pw, ph, tx, ty, z, X0, Y0, X1, Y1) {
    var ech = 2, marge = Math.round(Math.max(pw, ph) * 0.2);
    var mw = Math.max(1, Math.ceil((pw + 2 * marge) / ech)), mh = Math.max(1, Math.ceil((ph + 2 * marge) / ech));
    var mx = marge / z;                  // la même marge, en unités du monde
    X0 -= mx; Y0 -= mx; X1 += mx; Y1 += mx;
    tx += marge; ty += marge;
    var cv = couche("masque", mw, mh);
    var c = cv.getContext("2d", { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, mw, mh);
    c.setTransform(z / ech, 0, 0, z / ech, tx / ech, ty / ech);
    c.save();
    c.beginPath();
    c.rect(0, 0, carte.largeur, carte.hauteur);
    c.clip();
    var traits = carte.traits || [];
    for (var i = 0; i < traits.length; i++) {
      var t = traits[i], mat = MAT[t.mat];
      if (!mat || !t.bb || !chevauche(t.bb, X0, Y0, X1, Y1)) continue;
      // Rouge : le terrain ; bleu : les réglages de décor du trait (densité × 3 + échelle + 1).
      var densT = t.sansDecor ? 0 : (t.dens == null ? 2 : t.dens), echT = t.ech == null ? 1 : t.ech;
      tracerTrait(c, t, mat, "rgb(" + (mat.code * 10) + ",0," + ((densT * 3 + echT + 1) * 20) + ")");
    }

    var u = ech / z;                     // un pixel du masque, en unités du monde
    // Lacs et rivières : c'est de l'eau, on creuse — un peu plus large que le dessin,
    // pour qu'aucun arbre ne pousse les racines dans l'eau.
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = c.strokeStyle = "#000";
    c.lineCap = c.lineJoin = "round";
    (carte.lacs || []).forEach(function (lac) {
      if (!lac.pts || lac.pts.length < 6 || !cheminFerme(c, lac.pts)) return;
      c.fill();
      c.lineWidth = 3 * u;
      c.stroke();
    });
    (carte.lignes || []).forEach(function (l) {
      if (l.type !== "riviere" || !l.pts || l.pts.length < 4) return;
      traceRiviereEau(c, l, vue, 3 * u, 2.5 * u);
    });
    // Routes et sentiers : un drapeau dans le canal vert, AJOUTÉ (« lighter ») sans rien
    // effacer — sous une route, l'eau reste de l'eau (d'où les ponts) et la terre reste
    // la terre ; les décors, eux, s'en écartent.
    c.globalCompositeOperation = "lighter";
    c.strokeStyle = "rgb(0,255,0)";
    (carte.lignes || []).forEach(function (l) {
      if (!VOIES[l.type] || !l.pts || l.pts.length < 4) return;
      var d = pointsAffiches(l), lw = Math.max(l.taille || 0, (l.type === "sentier" ? 1.3 : 2.4) / vue.zoom);
      c.lineWidth = lw + 8 * u;
      c.beginPath();
      c.moveTo(d[0], d[1]);
      for (var q = 2; q < d.length; q += 2) c.lineTo(d[q], d[q + 1]);
      c.stroke();
    });
    c.globalCompositeOperation = "source-over";
    c.restore();
    return { data: c.getImageData(0, 0, mw, mh).data, mw: mw, mh: mh, ech: ech, tx: tx, ty: ty, z: z };
  }

  // L'identifiant du matériau sous un point du monde ; null : de l'eau (mer, lac, rivière) ;
  // undefined : on ne sait pas (pas de masque, ou point hors du masque). Les deux derniers
  // ne se confondent JAMAIS : « inconnu » n'est pas « de l'eau ».
  function materiauEn(masque, wx, wy) {
    if (!masque) return undefined;
    var sx = Math.floor((wx * masque.z + masque.tx) / masque.ech), sy = Math.floor((wy * masque.z + masque.ty) / masque.ech);
    if (sx < 0 || sy < 0 || sx >= masque.mw || sy >= masque.mh) return undefined;
    var i = (sy * masque.mw + sx) * 4;
    if (masque.data[i + 3] < 128) return null;
    var m = MATERIAUX[Math.round(masque.data[i] / 10) - 1];
    return m ? m.id : null;
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

  // Le tablier, le long du chemin `p` : ombre sur l'eau, garde-corps (le bord sombre),
  // planches (un pointillé aussi large que le tablier, donc perpendiculaire au tracé),
  // poteaux aux deux bouts.
  function pontLe(ctx, p, W, vue) {
    var u = 1 / vue.zoom, n = p.length / 2;
    if (n < 2) return;
    var chemin = function () {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    };
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.save();
    ctx.translate(W * 0.16, W * 0.34);
    chemin(); ctx.strokeStyle = "rgba(6,28,60,0.32)"; ctx.lineWidth = W; ctx.stroke();
    ctx.restore();
    chemin(); ctx.strokeStyle = "#3e2a16"; ctx.lineWidth = W; ctx.stroke();
    chemin(); ctx.strokeStyle = "#9c7748"; ctx.lineWidth = W * 0.72; ctx.stroke();
    if (W * vue.zoom >= 5) {
      chemin();
      ctx.strokeStyle = "rgba(62,40,18,0.55)";
      ctx.lineWidth = W * 0.72;
      ctx.setLineDash([Math.max(0.5 * u, W * 0.05), Math.max(1.5 * u, W * 0.2)]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (W * vue.zoom >= 7) {
      ctx.fillStyle = "#2a1a0b";
      var q = W * 0.2;
      [[0, 1], [n - 1, n - 2]].forEach(function (e) {
        var x = p[2 * e[0]], y = p[2 * e[0] + 1], dx = x - p[2 * e[1]], dy = y - p[2 * e[1] + 1], l = Math.hypot(dx, dy) || 1;
        var nx = -dy / l * W / 2, ny = dx / l * W / 2;
        ctx.fillRect(x + nx - q / 2, y + ny - q / 2, q, q);
        ctx.fillRect(x - nx - q / 2, y - ny - q / 2, q, q);
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
      var lw = Math.max(r.taille || 0, (r.type === "sentier" ? 1.3 : 2.4) / vue.zoom);
      // Un peu plus large que la route ET que ses bas-côtés : la route y entre sans déborder.
      var W = Math.max(lw * (r.type === "sentier" ? 1.6 : 1.3), lw + 3.2 / vue.zoom);
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
        var eau = x >= 0 && y >= 0 && x <= L && y <= H && materiauEn(masque, x, y) === null;
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
        pontLe(ctx, sousChemin(d, cum, s0, s1), W, vue);
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
    ["riviere", "falaise", "voies", "muraille", "frontiere", "maritime"].forEach(function (type) {
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
        if (type === "muraille") { tracerMuraille(ctx, l, st, lw, vue, th); continue; }
        if (type === "falaise") { tracerFalaise(ctx, l, st, lw, vue); continue; }
        if (type === "voies") { voies.push({ l: l, st: st, lw: lw }); continue; }
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
      if (type === "voies") {
        tracerVoies(ctx, voies, vue);
        dessinerPonts(ctx, carte, vue, th, masque);
      }
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
      var sx = e.x * z + tx, sy = e.y * z + ty;
      var largeur = largeurEtiquette(e) * px;
      var demi = largeur / 2 + px * 2;
      if (sx + demi < 0 || sx - demi > pw || sy + demi < 0 || sy - demi > ph) continue;
      var st = STYLES_ETIQ[e.style] || STYLES_ETIQ.libre;
      var texte = texteEtiquette(e, st), espace = px * espaceEtiquette(e, st);
      ctx.save();
      ctx.translate(sx, sy);
      if (e.angle) ctx.rotate(e.angle * Math.PI / 180);
      ctx.globalAlpha = e.opacite == null ? 1 : e.opacite;
      ctx.font = policeEtiquette(st, px);
      ctx.lineWidth = Math.max(2, px * 0.18);
      ctx.strokeStyle = th.halo;
      ctx.fillStyle = e.couleur || (st.mer ? th.texteMer : th.encre);
      // Les lettres une à une : l'espacement et la courbure sont ainsi les mêmes partout
      // (tous les navigateurs n'ont pas `letterSpacing` sur un canvas).
      var lettres = Array.from(texte), avances = [], k;
      for (k = 0; k < lettres.length; k++) avances.push(ctx.measureText(lettres[k]).width);
      var theta = e.courbe ? e.courbe / 100 * Math.PI : 0, R = theta ? largeur / Math.abs(theta) : 0, sens = theta > 0 ? 1 : -1;
      for (var passe = 0; passe < 2; passe++) {
        var x = -largeur / 2;
        for (k = 0; k < lettres.length; k++) {
          var cx = x + avances[k] / 2;
          if (theta) {
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

  function maison(c, x, y, w, h) {
    c.fillStyle = MURMAISON;
    c.beginPath(); c.rect(x - w / 2, y - h, w, h); c.fill(); c.stroke();
    c.fillStyle = OMBRE;
    c.fillRect(x, y - h, w / 2, h);
    c.fillStyle = TOIT;
    c.beginPath();
    c.moveTo(x - w / 2 - 2, y - h); c.lineTo(x, y - h - w * 0.5); c.lineTo(x + w / 2 + 2, y - h);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = OMBRE;
    c.beginPath(); c.moveTo(x, y - h - w * 0.5); c.lineTo(x + w / 2 + 2, y - h); c.lineTo(x, y - h); c.closePath(); c.fill();
    c.fillStyle = BOIS;
    c.fillRect(x - w * 0.09, y - h * 0.45, w * 0.18, h * 0.45);
  }

  // Tour de pierre à toit conique : (x, y) est le milieu de sa base.
  function tourPierre(c, x, y, w, h, hToit) {
    c.fillStyle = PIERRE;
    c.beginPath(); c.rect(x - w / 2, y - h, w, h); c.fill(); c.stroke();
    c.fillStyle = OMBRE;
    c.fillRect(x, y - h, w / 2, h);
    c.fillStyle = "#3a2a1a";
    c.fillRect(x - w * 0.07, y - h * 0.68, w * 0.14, h * 0.2);
    c.fillStyle = TOIT;
    c.beginPath();
    c.moveTo(x - w / 2 - 2, y - h); c.lineTo(x, y - h - hToit); c.lineTo(x + w / 2 + 2, y - h);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = OMBRE;
    c.beginPath(); c.moveTo(x, y - h - hToit); c.lineTo(x + w / 2 + 2, y - h); c.lineTo(x, y - h); c.closePath(); c.fill();
  }

  // Rempart à créneaux entre x0 et x1, de hauteur h au-dessus de la ligne de sol yBase.
  function rempart(c, x0, x1, yBase, h, n) {
    var pas = (x1 - x0) / n;
    c.fillStyle = PIERRE;
    c.beginPath(); c.rect(x0, yBase - h, x1 - x0, h); c.fill(); c.stroke();
    for (var i = 0; i < n; i += 2) {
      c.beginPath(); c.rect(x0 + i * pas, yBase - h - 3.2, pas, 3.2); c.fill(); c.stroke();
    }
    c.fillStyle = OMBRE;
    c.fillRect(x0, yBase - h * 0.35, x1 - x0, h * 0.35);
  }

  function drapeau(c, x, y) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 15); c.stroke();
    c.fillStyle = FANION;
    c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x + 10, y - 11.5); c.lineTo(x, y - 8); c.closePath(); c.fill(); c.stroke();
  }

  function chateau(c, grand) {
    ombreSol(c, 0, 34, 47, 8);
    tourPierre(c, 0, 20, grand ? 30 : 24, grand ? 52 : 38, grand ? 20 : 16);
    tourPierre(c, -20, 22, 13, 38, 13);
    tourPierre(c, 20, 22, 13, 38, 13);
    rempart(c, -38, 38, 33, 21, 11);
    c.fillStyle = "#2a1c10";
    c.beginPath(); c.moveTo(-7, 33); c.lineTo(-7, 24); c.arc(0, 24, 7, Math.PI, 0); c.lineTo(7, 33); c.closePath(); c.fill(); c.stroke();
    tourPierre(c, -40, 35, 16, 44, 14);
    tourPierre(c, 40, 35, 16, 44, 14);
    if (grand) drapeau(c, 0, -32 - 20 + 4);
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
        ombreSol(c, 0, 31, 47, 9);
        tourPierre(c, 0, 8, 17, 34, 15);
        dessinerMaisons(c, [[-34, 14, 22, 15], [-6, 12, 18, 12], [32, 14, 22, 16], [-22, 28, 24, 16], [8, 30, 26, 18], [36, 31, 18, 12]]);
        break;
      case "village":
        ombreSol(c, 0, 29, 36, 7);
        dessinerMaisons(c, [[16, 12, 22, 15], [-20, 15, 24, 16], [-2, 31, 28, 19]]);
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

  // Le pictogramme ou le dessin, selon le thème de la carte. Les repères (point, croix,
  // étoile, drapeau) restent des pictogrammes partout ; les types sans pictogramme
  // (moulin, grotte, campement…) sont dessinés dans tous les thèmes.
  function estDessine(type, th) {
    var tp = TYPES_LIEUX[type];
    if (tp && tp.repere) return false;
    return !!(th && th.lieuxIllustres) || !tp || !tp.px;
  }
  function iconeAuto(ctx, type, x, y, s, th, accent) {
    if (estDessine(type, th)) iconeIllustree(ctx, type, x, y, s, th, accent);
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
      ctx.font = "600 " + (m * 0.024) + "px " + POLICE;
      ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
      [[0, "0", "center"], [d / 2, String(nombreFr(d / 2)), "center"], [d, nombreFr(d) + " km", "center"]].forEach(function (g) {
        ctx.textAlign = g[2];
        ctx.lineWidth = m * 0.006; ctx.strokeStyle = th.halo; ctx.strokeText(g[1], x0 + g[0], y0 - m * 0.008);
        ctx.fillStyle = th.cadre; ctx.fillText(g[1], x0 + g[0], y0 - m * 0.008);
      });
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
    var th = THEMES[carte.theme] || THEMES.atlas;
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
    if (th.eauDouce) {
      terreAvant = couche((opts.cle || "principal") + "-avant", pw, ph);
      var ta = terreAvant.getContext("2d");
      ta.setTransform(1, 0, 0, 1, 0, 0);
      ta.clearRect(0, 0, pw, ph);
      ta.drawImage(cvT, 0, 0);
    }
    // Lacs et rivières creusent la terre (encore dans le cadre de la carte).
    creuserEaux(lc, carte, vue, X0, Y0, X1, Y1);
    lc.restore();

    // Le masque des matériaux (ce qu'il y a sous chaque point : terrain, eau, route).
    // Il sert aux décors et aux ponts ; jamais pendant un déplacement.
    var masque = opts.rapide ? null : construireMasque(carte, vue, pw, ph, tx, ty, z, X0, Y0, X1, Y1);

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
        if (tp.x + s < X0 || tp.x - s > X1 || y + s < Y0 || y - s > Y1 || s * vue.zoom < 2.5) return;
        visibles.push({ x: tp.x, y: y, s: s });
        decors.push({ x: tp.x, y: y, s: s, sprite: tp.type, v: tp.v || 0 });
      });
      semerDecors(carte, vue, masque, X0, Y0, X1, Y1, visibles, decors);
      lc.save();
      lc.setTransform(z, 0, 0, z, tx, ty);
      lc.beginPath();
      lc.rect(0, 0, carte.largeur, carte.hauteur);
      lc.clip();
      peindreDecors(lc, decors);
      lc.restore();
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
      var cvE = couche((opts.cle || "principal") + "-eaux", pw, ph), ec = cvE.getContext("2d");
      ec.setTransform(1, 0, 0, 1, 0, 0);
      ec.globalCompositeOperation = "source-over";
      ec.clearRect(0, 0, pw, ph);
      ec.setTransform(z, 0, 0, z, tx, ty);
      eauxDouces(ec, carte, vue, th, X0, Y0, X1, Y1);
      ec.setTransform(1, 0, 0, 1, 0, 0);
      ec.globalCompositeOperation = "destination-in";
      ec.drawImage(terreAvant, 0, 0);
      ec.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cvE, 0, 0);
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
        ? Math.min(th.glowPx * dpr, Math.max(14 * dpr, z * 40))
        : Math.max(5 * dpr, Math.min(30 * dpr, z * 18));
      ombre(ctx, cvT, th.glow, glow, 0, 0, decale);
      if (th.glowDouble) ombre(ctx, cvT, th.glow, glow * 0.45, 0, 0, decale);
      if (th.vagues) ondesCotieres(ctx, cvT, th, dpr, pw, ph);
      // La falaise : la silhouette de la terre, décalée vers le bas, donne du relief.
      if (th.falaise) ombre(ctx, cvT, th.falaise, 0, 0, Math.max(2 * dpr, Math.min(7 * dpr, z * 3)), decale);
      var r = Math.max(1, 1.1 * dpr);
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4;
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
    if (sprite === "@volcan") volcan(ctx, x, y, s * 0.9, 0.2);
    else if (PEINTRES[sprite]) colle(ctx, sprite, v || 0, x, y + s * 0.31, s);
    ZPX = avant;
  }

  window.Moteur = {
    THEMES: THEMES, MATERIAUX: MATERIAUX, MAT: MAT, GROUPES_MATERIAUX: GROUPES_MATERIAUX,
    DECORS: DECORS, TAMPONS: TAMPONS, VOIES: VOIES,
    TYPES_LIGNES: TYPES_LIGNES, TYPES_LIEUX: TYPES_LIEUX, CATEGORIES_LIEUX: CATEGORIES_LIEUX, STYLES_ETIQ: STYLES_ETIQ,
    POLICE: POLICE,
    alea: alea, joli: joli,
    niveau: niveau, zoomAjuste: zoomAjuste,
    boiteTrait: boiteTrait, nouveauTrait: nouveauTrait,
    boiteEtiquette: boiteEtiquette, visibleLieu: visibleLieu, tailleIcone: tailleIcone,
    styleLigne: styleLigne, pointsAffiches: pointsAffiches, dansPolygone: dansPolygone,
    icone: icone, iconeAuto: iconeAuto, dessinerIconeLieu: dessinerIconeLieu,
    apercuDecor: apercuDecor, tailleTampon: tailleTampon, preparerImages: preparerImages, surImage: null,
    dessiner: dessiner, carteEntiere: carteEntiere, vignette: vignette, apercuTrait: apercuTrait
  };
})();
