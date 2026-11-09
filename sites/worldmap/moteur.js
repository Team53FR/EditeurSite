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
  var MATERIAUX = [
    { id: "plaine",   nom: "Plaine",         couleur: "#9bb96a", decor: "herbe",    type: "terre" },
    { id: "foret",    nom: "Forêt",          couleur: "#5f9148", decor: "foret",    type: "terre" },
    { id: "taiga",    nom: "Taïga",          couleur: "#4f7f5c", decor: "taiga",    type: "terre" },
    { id: "colline",  nom: "Collines",       couleur: "#b6b46c", decor: "colline",  type: "terre" },
    { id: "montagne", nom: "Montagnes",      couleur: "#9a9486", decor: "montagne", type: "terre" },
    { id: "cime",     nom: "Cimes neigeuses", couleur: "#d6dde0", decor: "cime",    type: "terre" },
    { id: "volcan",   nom: "Volcan",         couleur: "#8a6b49", decor: "volcan",   type: "terre" },
    { id: "desert",   nom: "Désert",         couleur: "#e0c887", decor: "dune",     type: "terre" },
    { id: "steppe",   nom: "Steppe",         couleur: "#c9b872", decor: "herbe",    type: "terre" },
    { id: "marais",   nom: "Marais",         couleur: "#6f8a66", decor: "marais",   type: "terre" },
    { id: "glace",    nom: "Glace",          couleur: "#eef4f6", decor: null,       type: "terre" },
    { id: "cendres",  nom: "Terres arides",  couleur: "#7d6a5a", decor: null,       type: "terre" },
    { id: "eau",      nom: "Eau (creuser)",  couleur: "#4a8bb0", decor: null,       type: "eau" }
  ];
  var MAT = {};
  MATERIAUX.forEach(function (m) { MAT[m.id] = m; });

  // ----- Décors : peints une fois, semés ensuite -----
  //
  // Chaque décor (arbre, conifère, pic, colline, dune…) est PEINTÉ une seule fois dans un
  // petit canvas — dégradés, ombre au sol, touches de lumière, aucun contour de dessin
  // animé — puis simplement collé des centaines de fois. C'est plus beau, et bien plus
  // rapide que de retracer chaque arbre à chaque image. Quatre définitions (64, 128, 256
  // et 512 px) suivent le zoom, pour que rien ne devienne flou en s'approchant.
  var SPRITES = {};
  var ZPX = 1;   // pixels de l'appareil par unité du monde, pendant le rendu en cours

  function tailleSprite(px) { return px <= 64 ? 64 : px <= 128 ? 128 : px <= 256 ? 256 : 512; }

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

  function peintArbre(g, v) {
    var R = function (i) { return alea(500 + v, i); };
    var T = [["#a8cc5c", "#548f39", "#27552b"], ["#b4cf62", "#5f9c3b", "#2f5e2c"], ["#8fb74f", "#498638", "#224a2c"],
             ["#c0d46c", "#68a23f", "#376531"], ["#9abf56", "#4f8e3c", "#26522c"]][v % 5];
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
      g.fillStyle = i % 3 ? "rgba(218,240,132,0.3)" : "rgba(10,38,14,0.3)";
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

  function peintHerbe(g, v) {
    var R = function (i) { return alea(1100 + v, i); };
    for (var i = 0; i < 7; i++) {
      var x = (R(i) - 0.5) * 30, h = 10 + R(10 + i) * 10, c = (R(20 + i) - 0.5) * 12;
      g.strokeStyle = i % 2 ? "rgba(76,118,46,0.85)" : "rgba(132,170,76,0.8)";
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(x, 30); g.quadraticCurveTo(x + c * 0.4, 30 - h * 0.6, x + c, 30 - h); g.stroke();
    }
  }

  var PEINTRES = {
    arbre: peintArbre, conifere: peintConifere,
    montagne: function (g, v) { peintMontagne(g, v, false); },
    cime: function (g, v) { peintMontagne(g, v, true); },
    colline: peintColline, dune: peintDune, marais: peintMarais, herbe: peintHerbe
  };
  var VARIANTES = { arbre: 6, conifere: 4, montagne: 6, cime: 6, colline: 4, dune: 4, marais: 3, herbe: 3 };

  // Colle un décor peint : (x, y) est le point où il touche le sol, s la taille de sa boîte.
  function colle(ctx, type, v, x, y, s) {
    var S = tailleSprite(s * ZPX);
    ctx.drawImage(spriteCanvas(type, v, S), x - s / 2, y - s * 0.81, s, s);
  }
  function sprite(type) {
    var n = VARIANTES[type];
    return function (ctx, x, y, s, r) { colle(ctx, type, Math.min(n - 1, Math.floor(r * n)), x, y, s); };
  }
  function foret(ctx, x, y, s, r) {
    if (r > 0.9) colle(ctx, "conifere", Math.floor((r - 0.9) * 40) % VARIANTES.conifere, x, y, s);
    else colle(ctx, "arbre", Math.min(VARIANTES.arbre - 1, Math.floor(r / 0.9 * VARIANTES.arbre)), x, y, s);
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

  // `taille` : taille d'un décor par rapport à celle du pinceau ; `k` : combien
  // par pas de pinceau ; `pas` : écart entre deux pas, en tailles de pinceau.
  // `espace` : distance minimale entre deux décors, en fraction de leur taille moyenne
  // (les arbres se serrent en canopée, les montagnes se laissent de la place).
  var DECORS = {
    herbe:    { taille: 0.16, k: 2,   pas: 0.5,  espace: 0.6,  dessiner: sprite("herbe") },
    foret:    { taille: 0.42, k: 7,   pas: 0.3,  espace: 0.42, dessiner: foret },
    taiga:    { taille: 0.42, k: 6,   pas: 0.3,  espace: 0.42, dessiner: sprite("conifere") },
    colline:  { taille: 0.46, k: 3,   pas: 0.4,  espace: 0.62, dessiner: sprite("colline") },
    montagne: { taille: 0.72, k: 2.4, pas: 0.36, espace: 0.58, dessiner: sprite("montagne") },
    cime:     { taille: 0.72, k: 2.4, pas: 0.36, espace: 0.58, dessiner: sprite("cime") },
    volcan:   { taille: 0.42, k: 3,   pas: 0.38, espace: 0.55, dessiner: volcan },
    dune:     { taille: 0.46, k: 3,   pas: 0.4,  espace: 0.62, dessiner: sprite("dune") },
    marais:   { taille: 0.36, k: 3,   pas: 0.4,  espace: 0.6,  dessiner: sprite("marais") }
  };

  // ----- Types d'objets -----
  var TYPES_LIGNES = {
    riviere:   { nom: "Rivière",   px: 2.4 },
    route:     { nom: "Route",     px: 3 },
    sentier:   { nom: "Sentier",   px: 1.4 },
    muraille:  { nom: "Muraille",  px: 5 },
    frontiere: { nom: "Frontière", px: 2.4 }
  };

  // `niv` : niveau de zoom à partir duquel le lieu apparaît (0 = toujours).
  // 1 correspond à la carte entière tenant dans l'écran.
  var TYPES_LIEUX = {
    // `px` : taille du pictogramme ; `pxIll` : taille du dessin du style Illustré.
    capitale: { nom: "Capitale",   px: 22, pxIll: 84, police: 17, niv: 0,   maj: true },
    ville:    { nom: "Ville",      px: 15, pxIll: 62, police: 14, niv: 0.6 },
    port:     { nom: "Port",       px: 14, pxIll: 66, police: 13, niv: 1.2 },
    fort:     { nom: "Forteresse", px: 15, pxIll: 58, police: 13, niv: 1.5 },
    donjon:   { nom: "Donjon",     px: 14, pxIll: 50, police: 12, niv: 2 },
    village:  { nom: "Village",    px: 10, pxIll: 42, police: 12, niv: 2.5 },
    temple:   { nom: "Temple",     px: 14, pxIll: 52, police: 12, niv: 3 },
    ruine:    { nom: "Ruines",     px: 13, pxIll: 52, police: 12, niv: 3 },
    tour:     { nom: "Tour",       px: 12, pxIll: 46, police: 12, niv: 4 },
    mine:     { nom: "Mine",       px: 12, pxIll: 46, police: 12, niv: 4 },
    navire:   { nom: "Navire",     px: 14, pxIll: 40, police: 12, niv: 1.2 }
  };

  var STYLES_ETIQ = {
    pays:   { nom: "Pays",    poids: "700", italique: false, maj: true,  espace: 0.3 },
    region: { nom: "Région",  poids: "600", italique: false, maj: true,  espace: 0.18 },
    mer:    { nom: "Mer",     poids: "500", italique: true,  maj: false, espace: 0.22, mer: true },
    libre:  { nom: "Libre",   poids: "500", italique: false, maj: false, espace: 0 }
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
    } else if (p.length <= 2) {
      lc.beginPath();
      lc.moveTo(p[0] + r, p[1]);
      lc.arc(p[0], p[1], r, 0, TAU);
      lc.fill();
    } else {
      lc.beginPath();
      lc.moveTo(p[0], p[1]);
      for (var j = 2; j < p.length; j += 2) lc.lineTo(p[j], p[j + 1]);
      lc.stroke();
    }
    lc.globalCompositeOperation = "source-over";
  }

  // Sème les décors d'un trait dans `liste`, sans les dessiner : ils seront posés tous
  // ensemble par poserDecors, une fois connus le terrain final et les voisins.
  function semer(t, mat, zoom, X0, Y0, X1, Y1, liste) {
    var d = DECORS[mat.decor];
    if (!d || t.sansDecor) return;         // `sansDecor` : un fond de terre, pas un coup de pinceau
    var s = t.taille * d.taille;
    if (s * zoom < 3) return;              // trop petit pour être lisible : à plat
    var seed = t.seed | 0;
    var rayon = t.taille * 0.5 * 0.92;
    var p = t.pts;
    var nuage = !!t.nuage;
    // Un nuage de disques (carte générée) recouvre déjà ses voisins : moins de décors par disque.
    var k = nuage ? Math.max(1, d.k * 0.5) : d.k;
    var entier = Math.floor(k), frac = k - entier;

    function emettre(cx, cy, idx) {
      if (cx < X0 - rayon - s || cx > X1 + rayon + s || cy < Y0 - rayon - s || cy > Y1 + rayon + s) return;
      var n = entier + (frac > 0 && alea(seed, idx * 16 + 15) < frac ? 1 : 0);
      for (var q = 0; q < n; q++) {
        var a = alea(seed, idx * 16 + q * 3), b = alea(seed, idx * 16 + q * 3 + 1), c = alea(seed, idx * 16 + q * 3 + 2);
        var ang = a * TAU, r = Math.sqrt(b) * rayon;
        liste.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, s: s * (0.75 + 0.5 * c), r: c, d: d, mat: t.mat });
      }
    }

    if (nuage || p.length <= 2) {
      for (var i = 0; i < p.length; i += 2) emettre(p[i], p[i + 1], i >> 1);
    } else {
      var pas = t.taille * d.pas, prochain = 0, parcouru = 0, idx = 0;
      for (var j = 0; j + 3 < p.length; j += 2) {
        var dx = p[j + 2] - p[j], dy = p[j + 3] - p[j + 1];
        var L = Math.sqrt(dx * dx + dy * dy);
        if (L === 0) continue;
        while (prochain <= parcouru + L) {
          var f = (prochain - parcouru) / L;
          emettre(p[j] + dx * f, p[j + 1] + dy * f, idx++);
          prochain += pas;
        }
        parcouru += L;
      }
    }
  }

  // Pose les décors semés, en trois règles :
  //  - un décor ne pousse que là où SON terrain est resté visible : pas sous un terrain
  //    peint après lui (fini les sapins coupés net par la neige), ni dans l'eau, un lac,
  //    une rivière, ni sur une route (le masque le dit) ;
  //  - il ne chevauche pas ses voisins : les plus grands d'abord (une montagne garde sa
  //    place), chaque type demande son espace (`espace`, une fraction de la taille), un peu
  //    moins en profondeur qu'en largeur, comme des objets posés au sol ;
  //  - on peint du fond vers l'avant, tous terrains confondus.
  function poserDecors(lc, liste, masque, details) {
    if (!liste.length) return;
    liste.sort(function (a, b) { return b.s - a.s; });
    var cellule = liste[0].s, grille = {}, gardes = [];
    for (var i = 0; i < liste.length; i++) {
      var st = liste[i];
      if (masque) {
        var sous = materiauEn(masque, st.x, st.y);
        if (sous !== undefined && sous !== st.mat) continue;   // inconnu (hors masque) : on le garde
        // Ni le pied ni le corps du décor sur une route : une montagne coupée par la
        // chaussée n'a pas de sens.
        if (routeEn(masque, st.x, st.y) || routeEn(masque, st.x, st.y - st.s * 0.35)) continue;
      }
      // Ni sur un petit lieu ni sur son chemin.
      if (genePourDetails(details, st.x, st.y, st.s)) continue;
      var gx = Math.floor(st.x / cellule), gy = Math.floor(st.y / cellule), libre = true;
      for (var ax = gx - 1; ax <= gx + 1 && libre; ax++) {
        for (var ay = gy - 1; ay <= gy + 1 && libre; ay++) {
          var voisins = grille[ax + "," + ay];
          if (!voisins) continue;
          for (var k = 0; k < voisins.length; k++) {
            var o = voisins[k];
            var min = (st.s + o.s) * 0.5 * Math.max(st.d.espace, o.d.espace);
            var dx = st.x - o.x, dy = (st.y - o.y) * 0.85;
            if (dx * dx + dy * dy < min * min) { libre = false; break; }
          }
        }
      }
      if (!libre) continue;
      var cle = gx + "," + gy;
      (grille[cle] || (grille[cle] = [])).push(st);
      gardes.push(st);
    }
    gardes.sort(function (a, b) { return a.y - b.y; });
    for (var j = 0; j < gardes.length; j++) gardes[j].d.dessiner(lc, gardes[j].x, gardes[j].y, gardes[j].s, gardes[j].r);
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
    if (l.type === "sentier") return { c: l.couleur || "#b79a62", tiret: null, lisse: true, min: 1.3, halo: false };
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
    if (l.type === "sentier") return typeof l.meandre === "number" ? l.meandre : 0.26;
    return 0;
  }

  function pointsAffiches(l) {
    if (!l.pts || l.pts.length < 4) return l.pts;
    // Routes, sentiers et rivières passent tous par le lissage (et leurs méandres).
    if (l.type !== "route" && l.type !== "sentier" && l.type !== "riviere") return l.pts;
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
    voies.forEach(function (v) { v.d = pointsAffiches(v.l); v.sentier = v.l.type === "sentier"; });
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
      ctx.strokeStyle = v.sentier ? "rgba(70,48,24,0.32)" : "rgba(60,40,18,0.5)";
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
      ctx.strokeStyle = "rgba(255,246,214,0.32)";
      ctx.lineWidth = v.lw * 0.5;
      ctx.stroke();
    });
    // 4) Les ornières : deux sillons de charrette (et non un marquage au sol, qui ferait
    //    route moderne).
    voies.forEach(function (v) {
      if (v.sentier || v.lw * vue.zoom < 4.5) return;
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
      tracerTrait(c, t, mat, "rgb(" + ((MATERIAUX.indexOf(mat) + 1) * 18) + ",0,0)");
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
      if ((l.type !== "route" && l.type !== "sentier") || !l.pts || l.pts.length < 4) return;
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
    var m = MATERIAUX[Math.round(masque.data[i] / 18) - 1];
    return m ? m.id : null;
  }

  // Y a-t-il une route (ou ses abords) sous ce point ?
  function routeEn(masque, wx, wy) {
    if (!masque) return false;
    var sx = Math.floor((wx * masque.z + masque.tx) / masque.ech), sy = Math.floor((wy * masque.z + masque.ty) / masque.ech);
    if (sx < 0 || sy < 0 || sx >= masque.mw || sy >= masque.mh) return false;
    return masque.data[(sy * masque.mw + sx) * 4 + 1] > 128;
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
      if ((r.type !== "route" && r.type !== "sentier") || !r.pts || r.pts.length < 4) return;
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

  // ----- Détails qui apparaissent en zoomant -----
  //
  // Chemins et petits lieux (cabanes, campements, fermes, menhirs, grottes…) ne sont écrits
  // nulle part : ils sont tirés du hasard, dans une grille d'« octaves » — chaque octave est
  // une grille deux fois plus fine que la précédente, et n'apparaît (en fondu) que lorsque
  // ses cases deviennent assez grandes à l'écran. Plus on zoome, plus il y en a, à
  // l'endroit où le terrain s'y prête (un camp en forêt, une ferme en plaine…), et toujours
  // au même endroit : tout vient d'une graine, pas d'un état.
  var POIS = {   // matériau → [type, probabilité par case]
    foret:    [["cabane", 0.07], ["camp", 0.05], ["ruines", 0.02]],
    taiga:    [["cabane", 0.07], ["camp", 0.05]],
    plaine:   [["ferme", 0.1], ["menhirs", 0.02]],
    steppe:   [["ferme", 0.06], ["camp", 0.03]],
    colline:  [["menhirs", 0.06], ["cabane", 0.03]],
    montagne: [["grotte", 0.06], ["cabane", 0.02]],
    cime:     [["grotte", 0.03]],
    volcan:   [["grotte", 0.04]],
    desert:   [["ruines", 0.05], ["oasis", 0.03]],
    marais:   [["pilotis", 0.07]],
    glace:    [["camp", 0.03]]
  };
  var NIVEAU_DETAILS = 2.8;

  function dessinerPOI(ctx, type, x, y, s, th) {
    ctx.save();
    ctx.translate(x, y - s * 0.3);
    ctx.scale(s / 100, s / 100);
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = th.encre;
    var c = ctx;
    switch (type) {
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
      case "camp":
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
      case "ruines":
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
    }
    ctx.restore();
  }

  // Projection d'un point sur un segment : distance et point le plus proche.
  function projSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    var x = ax + dx * t, y = ay + dy * t;
    return { d: Math.hypot(px - x, py - y), x: x, y: y };
  }

  // ----- Le terrain sous un point, sans écran -----
  //
  // Le masque ne connaît que ce qui est (presque) à l'écran. Les petits lieux et leurs
  // chemins, eux, doivent exister partout et toujours au même endroit : un chemin qui part
  // d'une cabane visible vers une ferme hors champ ne doit pas changer de destination quand
  // on déplace la vue. D'où cette interrogation directe des objets de la carte, rendue
  // rapide par un index en grille de chaque trait (calculé une fois, gardé tant que le
  // trait ne change pas).
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
          else if (projSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]).d <= r) return true;
        }
      }
    }
    return false;
  }

  var boitesAffichees = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function boiteAffichee(d) {
    var b = boitesAffichees && boitesAffichees.get(d);
    if (!b) { b = boiteTrait(d, 0); if (boitesAffichees) boitesAffichees.set(d, b); }
    return b;
  }

  // L'identifiant du terrain sous un point du monde, ou null : de l'eau (mer, gomme, lac,
  // rivière) ou hors de la carte.
  function terrainEn(carte, x, y) {
    if (x < 0 || y < 0 || x > carte.largeur || y > carte.hauteur) return null;
    var i, lacs = carte.lacs || [];
    for (i = 0; i < lacs.length; i++) {
      var lp = lacs[i].pts;
      if (!lp || lp.length < 6) continue;
      var lb = boiteTrait(lp, 0);              // pas de cache : un lac se remodèle sur place
      if (x >= lb[0] && x <= lb[2] && y >= lb[1] && y <= lb[3] && dansPolygone(x, y, lp)) return null;
    }
    var lignes = carte.lignes || [];
    for (i = 0; i < lignes.length; i++) {
      var rv = lignes[i];
      if (rv.type !== "riviere" || !rv.pts || rv.pts.length < 4) continue;
      var d = pointsAffiches(rv), b = boiteAffichee(d), lw = (rv.taille || 0) * 0.7;
      if (x < b[0] - lw || x > b[2] + lw || y < b[1] - lw || y > b[3] + lw) continue;
      for (var q = 0; q + 3 < d.length; q += 2) if (projSegment(x, y, d[q], d[q + 1], d[q + 2], d[q + 3]).d <= lw) return null;
    }
    var traits = carte.traits || [];
    for (i = traits.length - 1; i >= 0; i--) {
      var t = traits[i];
      if (!t.bb) t.bb = boiteTrait(t.pts, t.taille);
      if (x < t.bb[0] || x > t.bb[2] || y < t.bb[1] || y > t.bb[3]) continue;
      if (!couvre(t, x, y)) continue;
      var m = MAT[t.mat];
      return !m || m.type === "eau" ? null : m.id;
    }
    return null;
  }

  // La voie (route ou sentier) la plus proche de (x, y) dans le rayon `rayon`.
  function voieProche(carte, x, y, rayon) {
    var best = null, dMin = rayon;
    (carte.lignes || []).forEach(function (l) {
      if ((l.type !== "route" && l.type !== "sentier") || !l.pts || l.pts.length < 4) return;
      var d = pointsAffiches(l), b = boiteAffichee(d);
      if (x < b[0] - dMin || x > b[2] + dMin || y < b[1] - dMin || y > b[3] + dMin) return;
      for (var q = 0; q + 3 < d.length; q += 2) {
        var r = projSegment(x, y, d[q], d[q + 1], d[q + 2], d[q + 3]);
        if (r.d < dMin) { dMin = r.d; best = { x: r.x, y: r.y, d: r.d, l: l }; }
      }
    });
    return best;
  }

  // ----- Les petits lieux qui apparaissent en zoomant -----
  //
  // Un petit lieu dépend de SA case (octave k, colonne i, rangée j) et de rien d'autre : ni
  // de la vue, ni du zoom, ni des cases voisines affichées. Il apparaît (en fondu) quand
  // les cases de son octave deviennent assez grandes à l'écran, et reste ensuite à sa place.
  // Son chemin mène à la voie la plus proche, sinon au petit lieu le plus proche d'une
  // octave AUSSI GROSSIÈRE OU PLUS que la sienne — jamais plus fine : en zoomant, de
  // nouveaux lieux s'accrochent aux anciens, mais aucun chemin existant ne change de but.
  function poiCase(carte, memo, seed, g0, k, i, j) {
    var cle = k + "|" + i + "|" + j;
    if (cle in memo) return memo[cle];
    var res = null;
    var g = g0 / Math.pow(2, k), sk = seed + k * 7919;
    var h = function (n) { return alea(sk + n * 131, (i * 73856093) ^ (j * 19349663)); };
    var px = (i + 0.2 + 0.6 * h(20)) * g, py = (j + 0.2 + 0.6 * h(21)) * g;
    var mat = terrainEn(carte, px, py), table = mat && POIS[mat];
    if (table) {
      var r = h(22), cumul = 0, type = null;
      for (var n = 0; n < table.length; n++) { cumul += table[n][1] * 1.7; if (r < cumul) { type = table[n][0]; break; } }
      if (type && !voieProche(carte, px, py, g * 0.12)) {
        res = { x: px, y: py, type: type, k: k, g: g, graine: h(24), echelle: 0.9 + 0.2 * h(23) };
        // Pas collé à un lieu de l'auteur, ni à un petit lieu d'une octave plus grossière.
        var lieux = carte.lieux || [];
        for (var q = 0; q < lieux.length && res; q++) if (Math.hypot(lieux[q].x - px, lieux[q].y - py) < g * 0.5) res = null;
        for (var kk = 0; kk < k && res; kk++) {
          var gg = g0 / Math.pow(2, kk), ci = Math.floor(px / gg), cj = Math.floor(py / gg);
          for (var a = ci - 1; a <= ci + 1 && res; a++) {
            for (var b = cj - 1; b <= cj + 1 && res; b++) {
              var o = poiCase(carte, memo, seed, g0, kk, a, b);
              if (o && Math.hypot(o.x - px, o.y - py) < g * 0.45) res = null;
            }
          }
        }
      }
    }
    memo[cle] = res;
    return res;
  }

  function cheminDe(carte, memo, seed, g0, p) {
    var R = p.g * 1.3, cible = null, dMin = R;
    var v = voieProche(carte, p.x, p.y, R);
    if (v) { cible = [v.x, v.y]; dMin = v.d; }
    else {
      for (var kk = 0; kk <= p.k; kk++) {
        var gg = g0 / Math.pow(2, kk);
        var a0 = Math.floor((p.x - R) / gg), a1 = Math.floor((p.x + R) / gg), b0 = Math.floor((p.y - R) / gg), b1 = Math.floor((p.y + R) / gg);
        for (var a = a0; a <= a1; a++) {
          for (var b = b0; b <= b1; b++) {
            var o = poiCase(carte, memo, seed, g0, kk, a, b);
            if (!o || o === p) continue;
            var e = Math.hypot(o.x - p.x, o.y - p.y);
            if (e > 0 && e < dMin) { dMin = e; cible = [o.x, o.y]; }
          }
        }
      }
    }
    if (!cible) return null;
    // Le coude du chemin dépend de la PAIRE de lieux, pas du sens : si deux lieux se
    // choisissent l'un l'autre, leurs deux chemins sont la même courbe (et non deux arcs
    // qui dessineraient un fuseau).
    var A = [p.x, p.y], B = cible;
    var premier = (A[0] < B[0] || (A[0] === B[0] && A[1] < B[1])) ? A : B, second = premier === A ? B : A;
    var h1 = alea(seed + 9, Math.floor(premier[0] * 977) ^ Math.floor(second[1] * 613));
    var h2 = alea(seed + 10, Math.floor(second[0] * 977) ^ Math.floor(premier[1] * 613));
    var mx = (p.x + cible[0]) / 2 + (h1 - 0.5) * dMin * 0.4;
    var my = (p.y + cible[1]) / 2 + (h2 - 0.5) * dMin * 0.4;
    var trace = [];
    for (var s = 0; s <= 12; s++) {
      var t = s / 12, aa = (1 - t) * (1 - t), bb = 2 * t * (1 - t), cc = t * t;
      var x = aa * p.x + bb * mx + cc * cible[0], y = aa * p.y + bb * my + cc * cible[1];
      if (s > 0 && s < 12 && terrainEn(carte, x, y) === null) return null;   // de l'eau sur le trajet : pas de chemin
      trace.push(x, y);
    }
    return trace;
  }

  // Les petits lieux et leurs chemins pour cette vue : calculés AVANT les décors (qui
  // doivent s'en écarter), dessinés après. On prend aussi deux cases de marge autour de
  // l'écran, pour que le chemin d'une cabane juste hors champ soit bien visible.
  function preparerDetails(carte, vue, th, masque, tx, ty, z, pw, ph, dpr) {
    var L = carte.largeur, H = carte.hauteur, M = Math.max(L, H);
    var seed = hashTexte(String(carte.id || "x")) & 0x3fffffff;
    var g0 = M / 16, memo = {}, places = [];
    for (var k = 0; k < 18; k++) {
      var g = g0 / Math.pow(2, k), cellPx = g * z;
      if (cellPx < 96 * dpr) break;                              // les octaves suivantes sont plus fines encore
      var fondu = Math.min(1, (cellPx - 96 * dpr) / (80 * dpr));
      var i0 = Math.max(0, Math.floor(-tx / cellPx) - 2), i1 = Math.min(Math.ceil(L / g), Math.floor((pw - tx) / cellPx) + 2);
      var j0 = Math.max(0, Math.floor(-ty / cellPx) - 2), j1 = Math.min(Math.ceil(H / g), Math.floor((ph - ty) / cellPx) + 2);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 1500) continue;
      var taille = Math.min(110 * dpr, Math.max(38 * dpr, cellPx * 0.16));
      for (var i = i0; i <= i1; i++) {
        for (var j = j0; j <= j1; j++) {
          var p = poiCase(carte, memo, seed, g0, k, i, j);
          if (!p) continue;
          var place = { x: p.x, y: p.y, type: p.type, taille: taille * p.echelle, fondu: fondu, g: p.g };
          place.trace = cheminDe(carte, memo, seed, g0, p);
          place.largeur = Math.max(1.6 * dpr, Math.min(5 * dpr, place.taille * 0.07));
          places.push(place);
        }
      }
    }
    return { places: places, z: z, tx: tx, ty: ty };
  }

  // Un décor tombe-t-il sur un petit lieu ou sur son chemin ? (Il s'en écarte alors.)
  function genePourDetails(details, x, y, s) {
    if (!details) return false;
    var z = details.z;
    for (var i = 0; i < details.places.length; i++) {
      var p = details.places[i], rayon = p.taille / z * 0.55 + s * 0.3;
      if (Math.abs(p.x - x) < rayon && Math.abs(p.y - y) < rayon && Math.hypot(p.x - x, p.y - y) < rayon) return true;
      if (!p.trace) continue;
      var marge = p.largeur / z + s * 0.25;
      for (var q = 0; q + 3 < p.trace.length; q += 2) {
        if (projSegment(x, y, p.trace[q], p.trace[q + 1], p.trace[q + 2], p.trace[q + 3]).d < marge) return true;
      }
    }
    return false;
  }

  function dessinerDetails(ctx, details, th, carte) {
    if (!details || !details.places.length) return;
    var z = details.z, tx = details.tx, ty = details.ty;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(tx, ty, carte.largeur * z, carte.hauteur * z);
    ctx.clip();
    ctx.lineCap = ctx.lineJoin = "round";
    // Les chemins, comme les sentiers de l'auteur : bord sombre puis pas en pointillé.
    [["rgba(70,48,24,0.4)", 2, false], ["rgba(196,166,108,0.95)", 0, true]].forEach(function (passe) {
      details.places.forEach(function (p) {
        if (!p.trace) return;
        ctx.globalAlpha = p.fondu;
        ctx.beginPath();
        for (var q = 0; q < p.trace.length; q += 2) {
          var sx = p.trace[q] * z + tx, sy = p.trace[q + 1] * z + ty;
          if (q === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = passe[0];
        ctx.lineWidth = p.largeur + passe[1] * p.largeur * 0.6;
        ctx.setLineDash(passe[2] ? [p.largeur * 2.4, p.largeur * 1.2] : []);
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);
    details.places.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (p) {
      ctx.globalAlpha = p.fondu;
      dessinerPOI(ctx, p.type, p.x * z + tx, p.y * z + ty, p.taille, th);
    });
    ctx.restore();
  }

  function dessinerLignes(ctx, carte, vue, th, X0, Y0, X1, Y1, masque) {
    var lignes = carte.lignes || [];
    var voies = [];
    ["riviere", "sentier", "route", "muraille", "frontiere"].forEach(function (type) {
      for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        if (l.type !== type || !l.pts || l.pts.length < 4) continue;
        var bb = boiteTrait(l.pts, 0);
        var marge = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 0.1 + (l.taille || 0) * 40;
        if (!chevauche([bb[0] - marge, bb[1] - marge, bb[2] + marge, bb[3] + marge], X0, Y0, X1, Y1)) continue;
        var st = styleLigne(l, th);
        var lw = Math.max(l.taille || 0, st.min / vue.zoom);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (type === "riviere") continue;     // creusées dans la terre (creuserEaux), comme la mer
        if (type === "muraille") { tracerMuraille(ctx, l, st, lw, vue, th); continue; }
        if (type === "route" || type === "sentier") { voies.push({ l: l, st: st, lw: lw }); continue; }
        if (st.halo) {
          cheminLigne(ctx, l.pts, st.lisse);
          ctx.setLineDash([]);
          ctx.strokeStyle = st.c;
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = lw * 4;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        cheminLigne(ctx, l.pts, st.lisse);
        ctx.strokeStyle = st.c;
        ctx.lineWidth = lw;
        ctx.setLineDash(st.tiret ? st.tiret.map(function (v) { return v * lw; }) : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Sentiers et routes ensemble (leurs croisements se fondent), puis les ponts, avant
      // les murailles et les frontières.
      if (type === "route") {
        tracerVoies(ctx, voies, vue);
        dessinerPonts(ctx, carte, vue, th, masque);
      }
    });
  }

  // ----- Étiquettes -----
  var mesureur = null;
  var cacheLargeurs = {};
  function largeurEtiquette(e) {
    var st = STYLES_ETIQ[e.style] || STYLES_ETIQ.libre;
    var texte = st.maj ? String(e.texte).toUpperCase() : String(e.texte);
    var cle = (e.style || "") + "|" + texte;
    if (cacheLargeurs[cle] != null) return cacheLargeurs[cle];
    if (!mesureur) mesureur = document.createElement("canvas").getContext("2d");
    mesureur.font = (st.italique ? "italic " : "") + st.poids + " 100px " + POLICE;
    if ("letterSpacing" in mesureur) mesureur.letterSpacing = (100 * st.espace) + "px";
    var w = mesureur.measureText(texte).width / 100;
    if (Object.keys(cacheLargeurs).length > 500) cacheLargeurs = {};
    cacheLargeurs[cle] = w;
    return w;
  }
  // Boîte de l'étiquette en unités du monde (largeur, hauteur), pour la sélection.
  function boiteEtiquette(e) {
    return { w: largeurEtiquette(e) * e.taille, h: e.taille * 1.1 };
  }

  function dessinerEtiquettes(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr) {
    var liste = carte.etiquettes || [];
    if (!liste.length) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i];
      if (!e.texte) continue;
      var px = e.taille * z;
      if (px < 6 * dpr || px > 1400 * dpr) continue;
      var sx = e.x * z + tx, sy = e.y * z + ty;
      var demi = largeurEtiquette(e) * px / 2 + px;
      if (sx + demi < 0 || sx - demi > pw || sy + demi < 0 || sy - demi > ph) continue;
      var st = STYLES_ETIQ[e.style] || STYLES_ETIQ.libre;
      var texte = st.maj ? String(e.texte).toUpperCase() : String(e.texte);
      ctx.save();
      ctx.translate(sx, sy);
      if (e.angle) ctx.rotate(e.angle * Math.PI / 180);
      ctx.font = (st.italique ? "italic " : "") + st.poids + " " + px + "px " + POLICE;
      var espace = px * st.espace;
      if ("letterSpacing" in ctx) ctx.letterSpacing = espace + "px";
      var dec = "letterSpacing" in ctx ? espace / 2 : 0;
      ctx.lineWidth = Math.max(2, px * 0.18);
      ctx.strokeStyle = th.halo;
      ctx.strokeText(texte, dec, 0);
      ctx.fillStyle = e.couleur || (st.mer ? th.texteMer : th.encre);
      ctx.fillText(texte, dec, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ----- Lieux -----
  function icone(ctx, type, x, y, s, th) {
    var r = s / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = Math.max(1.2, s * 0.1);
    ctx.strokeStyle = th.encre;
    ctx.fillStyle = PAPIER;
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
        ctx.fillStyle = "#b5362a"; ctx.fill();
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
  var PIERRE = "#c4bdab", OMBRE = "rgba(52,38,20,0.2)", TOIT = "#a8452f", MURMAISON = "#ecdfbd", BOIS = "#6a4a2a";

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
    c.fillStyle = "#b5362a";
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

  function iconeIllustree(ctx, type, x, y, s, th) {
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
        c.fillStyle = "#b5362a";
        c.beginPath(); c.moveTo(-10, -36); c.lineTo(3, -32); c.lineTo(-10, -28); c.closePath(); c.fill(); c.stroke();
        break;
      default:
        ombreSol(c, 0, 31, 30, 7);
        maison(c, 0, 30, 30, 20);
    }
    ctx.restore();
  }

  // Le pictogramme ou le dessin, selon le thème de la carte.
  function iconeAuto(ctx, type, x, y, s, th) {
    if (th.lieuxIllustres) iconeIllustree(ctx, type, x, y, s, th);
    else icone(ctx, type, x, y, s, th);
  }

  function visibleLieu(l, nivActuel) {
    var tp = TYPES_LIEUX[l.type] || TYPES_LIEUX.ville;
    var min = typeof l.niv === "number" ? l.niv : tp.niv;
    return nivActuel >= min;
  }
  function tailleIcone(l, th) {
    var tp = TYPES_LIEUX[l.type] || TYPES_LIEUX.ville;
    return (th && th.lieuxIllustres ? tp.pxIll : tp.px) * (l.ech || 1);
  }

  function dessinerLieux(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr) {
    var liste = carte.lieux || [];
    if (!liste.length) return;
    var niv = niveau(carte, vue);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (var i = 0; i < liste.length; i++) {
      var l = liste[i];
      if (!visibleLieu(l, niv)) continue;
      var sx = l.x * z + tx, sy = l.y * z + ty;
      if (sx < -200 || sx > pw + 200 || sy < -100 || sy > ph + 100) continue;
      var tp = TYPES_LIEUX[l.type] || TYPES_LIEUX.ville;
      var s = tailleIcone(l, th) * dpr;
      iconeAuto(ctx, l.type, sx, sy, s, th);
      if (l.nom) {
        var f = tp.police * (l.ech || 1) * dpr;
        ctx.font = (tp.maj ? "700 " : "600 ") + f + "px " + POLICE;
        if ("letterSpacing" in ctx) ctx.letterSpacing = (tp.maj ? f * 0.1 : 0) + "px";
        var texte = tp.maj ? l.nom.toUpperCase() : l.nom;
        ctx.lineWidth = Math.max(2, f * 0.22);
        ctx.strokeStyle = th.halo;
        ctx.strokeText(texte, sx, sy + s / 2 + f * 0.75);
        ctx.fillStyle = th.encre;
        ctx.fillText(texte, sx, sy + s / 2 + f * 0.75);
      }
    }
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
    // 1) Les aplats de tous les traits, et les décors semés au passage (pas encore posés).
    var traits = carte.traits || [];
    var semis = [];
    for (var i = 0; i < traits.length; i++) {
      var t = traits[i];
      if (!t.bb) t.bb = boiteTrait(t.pts, t.taille);
      if (!chevauche(t.bb, X0, Y0, X1, Y1)) continue;
      var mat = MAT[t.mat];
      if (!mat) continue;
      tracerTrait(lc, t, mat);
      if (!opts.rapide && mat.type === "terre" && mat.decor) semer(t, mat, vue.zoom, X0, Y0, X1, Y1, semis);
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
    // Il sert aux décors, aux ponts et aux détails ; jamais pendant un déplacement.
    var niv = niveau(carte, vue);
    var masque = opts.rapide ? null : construireMasque(carte, vue, pw, ph, tx, ty, z, X0, Y0, X1, Y1);
    // Les petits lieux qui apparaissent en zoomant : choisis maintenant, pour que les
    // décors s'en écartent ; dessinés plus loin, au-dessus des routes.
    var details = (masque && niv >= NIVEAU_DETAILS) ? preparerDetails(carte, vue, th, masque, tx, ty, z, pw, ph, dpr) : null;

    // 2) Transitions : les couleurs des terrains se fondent les unes dans les autres
    //    (flou appliqué à la couleur seulement, la côte reste nette).
    if (!opts.rapide) fondreTransitions(lc, cvT, carte, z, dpr, pw, ph, opts.cle || "principal");

    if (!opts.rapide) {
      // 3) Les décors, posés en une fois : seulement là où leur terrain est resté visible,
      //    sans se chevaucher, du fond vers l'avant.
      lc.save();
      lc.setTransform(z, 0, 0, z, tx, ty);
      lc.beginPath();
      lc.rect(0, 0, carte.largeur, carte.hauteur);
      lc.clip();
      poserDecors(lc, semis, masque, details);
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
    dessinerDetails(ctx, details, th, carte);
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

    // Textes et icônes, en pixels écran : nets à toute échelle.
    dessinerEtiquettes(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr);
    dessinerLieux(ctx, carte, vue, th, tx, ty, z, pw, ph, dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // La carte entière dans un canvas de `largeurPx` de large.
  function carteEntiere(carte, largeurPx, cle) {
    var h = Math.max(1, Math.round(largeurPx * carte.hauteur / carte.largeur));
    var cv = document.createElement("canvas");
    var vue = { cx: carte.largeur / 2, cy: carte.hauteur / 2, zoom: largeurPx / carte.largeur, largeur: largeurPx, hauteur: h, dpr: 1 };
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
      ctx.globalAlpha = 0.92;
      tracerTrait(ctx, t, mat);
      if (mat.decor) {
        var m = t.taille, semis = [];
        semer(t, mat, vue.zoom, vue.cx - vue.largeur / 2 / vue.zoom - m, vue.cy - vue.hauteur / 2 / vue.zoom - m,
          vue.cx + vue.largeur / 2 / vue.zoom + m, vue.cy + vue.hauteur / 2 / vue.zoom + m, semis);
        poserDecors(ctx, semis, null);
      }
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
    ctx.restore();
  }

  window.Moteur = {
    THEMES: THEMES, MATERIAUX: MATERIAUX, MAT: MAT,
    TYPES_LIGNES: TYPES_LIGNES, TYPES_LIEUX: TYPES_LIEUX, STYLES_ETIQ: STYLES_ETIQ,
    POLICE: POLICE,
    alea: alea, joli: joli,
    niveau: niveau, zoomAjuste: zoomAjuste,
    boiteTrait: boiteTrait, nouveauTrait: nouveauTrait,
    boiteEtiquette: boiteEtiquette, visibleLieu: visibleLieu, tailleIcone: tailleIcone,
    styleLigne: styleLigne, pointsAffiches: pointsAffiches, dansPolygone: dansPolygone,
    icone: icone, iconeAuto: iconeAuto,
    dessiner: dessiner, carteEntiere: carteEntiere, vignette: vignette, apercuTrait: apercuTrait
  };
})();
