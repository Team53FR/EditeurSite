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
      riviere: "#2f77a6", route: "#7a5230", texteMer: "#1d4a68",
      grille: "rgba(255,255,255,0.22)", cadre: "#0b0f13"
    },
    parchemin: {
      nom: "Parchemin", mer: "#dac79d", mer2: "#cdb98c", glow: "rgba(238,226,192,0.85)",
      encre: "#3a2a1a", hors: "#1d1710", halo: "rgba(243,230,196,0.82)", teinte: "rgba(226,190,124,0.42)",
      riviere: "#587f8f", route: "#5a3d22", texteMer: "#566b6b",
      grille: "rgba(58,42,26,0.22)", cadre: "#2a1d10"
    },
    // Le style des cartes illustrées : la « mer » est le parchemin lui-même, le
    // bleu ne vit qu'autour des côtes ; la terre a une falaise, un cadre orné.
    illustre: {
      nom: "Illustré", mer: "#e6cd97", mer2: "#dcbf84",
      glow: "rgba(30,116,214,0.92)", glowPx: 44, glowDouble: true,
      encre: "#2a1c0e", hors: "#1d1710", halo: "rgba(246,234,204,0.88)", teinte: "rgba(235,200,130,0.26)",
      riviere: "#2f86d6", route: "#6b4a2b", texteMer: "#2c5d91",
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
    { id: "cime",     nom: "Cimes neigeuses", couleur: "#e4eaec", decor: "cime",    type: "terre" },
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

  // ----- Décors : les petits dessins semés sur un trait -----
  // Tous se dessinent en coordonnées du monde, centrés sur (x, y), de taille s.
  function cercle(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }

  // Un arbre feuillu : une touffe de disques, trois verts au hasard, une lumière
  // en haut à gauche et une ombre en bas.
  function foret(ctx, x, y, s, r) {
    if (r > 0.88) { taiga(ctx, x, y, s, r); return; }
    ctx.lineWidth = s * 0.06;
    ctx.fillStyle = r < 0.3 ? "#376d34" : r < 0.6 ? "#3f7c3a" : "#336636";
    ctx.strokeStyle = "rgba(18,42,16,0.92)";
    ctx.beginPath();
    cercle(ctx, x - s * 0.2, y - s * 0.02, s * 0.3);
    cercle(ctx, x + s * 0.2, y - s * 0.02, s * 0.3);
    cercle(ctx, x, y - s * 0.27, s * 0.34);
    cercle(ctx, x - s * 0.08, y + s * 0.1, s * 0.28);
    cercle(ctx, x + s * 0.1, y + s * 0.1, s * 0.27);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(14,36,14,0.32)";
    ctx.beginPath();
    cercle(ctx, x + s * 0.12, y + s * 0.14, s * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgba(196,232,128,0.26)";
    ctx.beginPath();
    cercle(ctx, x - s * 0.1, y - s * 0.34, s * 0.17);
    cercle(ctx, x - s * 0.24, y - s * 0.06, s * 0.1);
    ctx.fill();
  }

  function taiga(ctx, x, y, s) {
    ctx.lineWidth = s * 0.08;
    ctx.fillStyle = "#2f6a45";
    ctx.strokeStyle = "rgba(18,44,28,0.9)";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.55);
    ctx.lineTo(x + s * 0.3, y + s * 0.3);
    ctx.lineTo(x - s * 0.3, y + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function colline(ctx, x, y, s) {
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = "rgba(70,62,30,0.85)";
    ctx.fillStyle = "rgba(210,206,128,0.95)";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.18);
    ctx.quadraticCurveTo(x, y - s * 0.6, x + s * 0.5, y + s * 0.18);
    ctx.fill();
    ctx.stroke();
  }

  function pic(ctx, x, y, s, r, neige) {
    var w = s * (0.55 + r * 0.2), h = s * (0.62 + r * 0.25);
    ctx.lineJoin = "round";
    ctx.lineWidth = s * 0.06;
    ctx.strokeStyle = "rgba(52,48,40,0.95)";
    ctx.fillStyle = neige ? "#dfe6e8" : "#a39d8d";
    ctx.beginPath();
    ctx.moveTo(x - w, y + h * 0.5);
    ctx.lineTo(x, y - h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = neige ? "#aebbc2" : "#7d7767";
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.lineTo(x + w * 0.12, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    // Hachures sur la face dans l'ombre, parallèles à son arête claire.
    ctx.lineWidth = s * 0.035;
    ctx.strokeStyle = neige ? "rgba(70,86,98,0.55)" : "rgba(34,30,24,0.5)";
    ctx.beginPath();
    var sommetY = y - h * 0.5, baseY = y + h * 0.5;
    [0.34, 0.56, 0.78].forEach(function (t) {
      ctx.moveTo(x + (w - 0) * t, sommetY + (baseY - sommetY) * t);
      ctx.lineTo(x + w * 0.12 * t, sommetY + (baseY - sommetY) * t);
    });
    ctx.stroke();
    ctx.lineWidth = s * 0.06;
    ctx.strokeStyle = "rgba(52,48,40,0.95)";
    ctx.beginPath();
    ctx.moveTo(x - w, y + h * 0.5);
    ctx.lineTo(x, y - h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.closePath();
    ctx.stroke();
    if (!neige) {
      ctx.fillStyle = "#f4f7f8";
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.5);
      ctx.lineTo(x - w * 0.26, y - h * 0.5 + h * 0.28);
      ctx.lineTo(x + w * 0.04, y - h * 0.5 + h * 0.2);
      ctx.lineTo(x + w * 0.26, y - h * 0.5 + h * 0.28);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Un pic seul, ou — une fois sur cinq — un massif : un grand pic encadré de deux
  // plus petits, ce qui donne aux chaînes de montagnes leur rythme irrégulier.
  function montagne(ctx, x, y, s, r) {
    if (r > 0.8) {
      pic(ctx, x - s * 0.5, y + s * 0.14, s * 0.55, r, false);
      pic(ctx, x + s * 0.52, y + s * 0.12, s * 0.5, 1 - r, false);
      pic(ctx, x, y - s * 0.02, s * 1.2, r, false);
    } else pic(ctx, x, y, s, r, false);
  }
  function cime(ctx, x, y, s, r) { pic(ctx, x, y, s, r, true); }

  function dune(ctx, x, y, s) {
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(150,118,52,0.85)";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.1);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.3, x, y + s * 0.05);
    ctx.quadraticCurveTo(x + s * 0.2, y + s * 0.3, x + s * 0.5, y - s * 0.05);
    ctx.stroke();
  }

  function marais(ctx, x, y, s) {
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(48,78,52,0.9)";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.15, y + s * 0.1); ctx.lineTo(x - s * 0.2, y - s * 0.3);
    ctx.moveTo(x, y + s * 0.1); ctx.lineTo(x, y - s * 0.4);
    ctx.moveTo(x + s * 0.15, y + s * 0.1); ctx.lineTo(x + s * 0.2, y - s * 0.3);
    ctx.moveTo(x - s * 0.4, y + s * 0.18); ctx.lineTo(x + s * 0.4, y + s * 0.18);
    ctx.stroke();
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

  function herbe(ctx, x, y, s) {
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(60,96,40,0.55)";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s * 0.3); ctx.lineTo(x, y); ctx.lineTo(x + s * 0.35, y - s * 0.3);
    ctx.stroke();
  }

  // `taille` : taille d'un décor par rapport à celle du pinceau ; `k` : combien
  // par pas de pinceau ; `pas` : écart entre deux pas, en tailles de pinceau.
  var DECORS = {
    herbe:    { taille: 0.12, k: 2,   pas: 0.5,  dessiner: herbe },
    foret:    { taille: 0.32, k: 6,   pas: 0.3,  dessiner: foret },
    taiga:    { taille: 0.3,  k: 4.5, pas: 0.32, dessiner: taiga },
    colline:  { taille: 0.30, k: 2,   pas: 0.4,  dessiner: colline },
    montagne: { taille: 0.42, k: 1.9, pas: 0.38, dessiner: montagne },
    cime:     { taille: 0.42, k: 1.9, pas: 0.38, dessiner: cime },
    volcan:   { taille: 0.42, k: 2.4, pas: 0.38, dessiner: volcan },
    dune:     { taille: 0.30, k: 2,   pas: 0.4,  dessiner: dune },
    marais:   { taille: 0.24, k: 2,   pas: 0.4,  dessiner: marais }
  };

  // ----- Types d'objets -----
  var TYPES_LIGNES = {
    riviere:   { nom: "Rivière",   px: 2.4 },
    route:     { nom: "Route",     px: 1.8 },
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
  function tracerTrait(lc, t, mat) {
    var p = t.pts;
    var terre = mat.type === "terre";
    lc.globalCompositeOperation = terre ? "source-over" : "destination-out";
    lc.fillStyle = lc.strokeStyle = terre ? mat.couleur : "#000";
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

  var tampon = [];
  function decorer(lc, t, mat, zoom, X0, Y0, X1, Y1) {
    var d = DECORS[mat.decor];
    if (!d) return;
    var s = t.taille * d.taille;
    if (s * zoom < 3) return;              // trop petit pour être lisible : à plat
    var seed = t.seed | 0;
    var rayon = t.taille * 0.5 * 0.88;
    var p = t.pts;
    var nuage = !!t.nuage;
    // Un nuage de disques (carte générée) recouvre déjà ses voisins : moins de décors par disque.
    var k = nuage ? Math.max(1, d.k * 0.5) : d.k;
    var entier = Math.floor(k), frac = k - entier;
    tampon.length = 0;

    function emettre(cx, cy, idx) {
      if (cx < X0 - rayon || cx > X1 + rayon || cy < Y0 - rayon || cy > Y1 + rayon) return;
      var n = entier + (frac > 0 && alea(seed, idx * 16 + 15) < frac ? 1 : 0);
      for (var q = 0; q < n; q++) {
        var a = alea(seed, idx * 16 + q * 3), b = alea(seed, idx * 16 + q * 3 + 1), c = alea(seed, idx * 16 + q * 3 + 2);
        var ang = a * TAU, r = Math.sqrt(b) * rayon;
        tampon.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, s * (0.75 + 0.5 * c), c);
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

    var n4 = tampon.length / 4;
    if (!n4) return;
    var ordre = new Array(n4);
    for (var o = 0; o < n4; o++) ordre[o] = o;
    // De haut en bas : un décor plus bas recouvre celui du dessus.
    ordre.sort(function (a, b) { return tampon[a * 4 + 1] - tampon[b * 4 + 1]; });
    for (var m = 0; m < n4; m++) {
      var q4 = ordre[m] * 4;
      d.dessiner(lc, tampon[q4], tampon[q4 + 1], tampon[q4 + 2], tampon[q4 + 3]);
    }
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
    if (l.type === "route") return { c: l.couleur || th.route, tiret: [3.2, 2.4], lisse: l.lisse !== false, min: 1.2, halo: false };
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

  function serpenter(l) {
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
    var amp = onde * 0.3 * (l.meandre || 0);
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
  function pointsAffiches(l) {
    if (l.type !== "riviere" || !l.pts || l.pts.length < 4 || !(l.meandre > 0 || l.delta)) return l.pts;
    var cle = l.pts.join(",") + "|" + l.meandre + "|" + l.taille + "|" + l.id;
    var c = cacheRivieres && cacheRivieres.get(l);
    if (c && c.cle === cle) return c.out;
    var out = serpenter(l);
    if (cacheRivieres) cacheRivieres.set(l, { cle: cle, out: out });
    return out;
  }

  // Une rivière s'élargit de la source (35 %) à l'embouchure (125 %) : tracée par
  // tronçons de largeur croissante, les contours d'abord (sans quoi chaque
  // tronçon mordrait sur le remplissage du précédent).
  function tracerRiviere(ctx, l, st, lw, vue) {
    var d = pointsAffiches(l), m = d.length / 2;
    if (m < 2) return;
    var troncons = l.delta ? Math.min(28, Math.max(1, Math.floor(m / 6))) : 1;
    function passe(extra, couleur) {
      ctx.strokeStyle = couleur;
      for (var k = 0; k < troncons; k++) {
        var a = Math.floor(k * (m - 1) / troncons), b = Math.floor((k + 1) * (m - 1) / troncons);
        var t = (k + 0.5) / troncons;
        ctx.lineWidth = (l.delta ? lw * (0.35 + 0.9 * t) : lw) + extra;
        ctx.beginPath();
        ctx.moveTo(d[2 * a], d[2 * a + 1]);
        for (var j = a + 1; j <= b; j++) ctx.lineTo(d[2 * j], d[2 * j + 1]);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    passe(2 / vue.zoom, "rgba(14,42,84,0.7)");
    passe(0, st.c);
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

  function dessinerLignes(ctx, carte, vue, th, X0, Y0, X1, Y1) {
    var lignes = carte.lignes || [];
    ["riviere", "route", "muraille", "frontiere"].forEach(function (type) {
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
        if (type === "riviere" && (l.meandre > 0 || l.delta)) { tracerRiviere(ctx, l, st, lw, vue); continue; }
        if (type === "muraille") { tracerMuraille(ctx, l, st, lw, vue, th); continue; }
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
    var traits = carte.traits || [];
    for (var i = 0; i < traits.length; i++) {
      var t = traits[i];
      if (!t.bb) t.bb = boiteTrait(t.pts, t.taille);
      if (!chevauche(t.bb, X0, Y0, X1, Y1)) continue;
      var mat = MAT[t.mat];
      if (!mat) continue;
      tracerTrait(lc, t, mat);
      if (!opts.rapide && mat.type === "terre" && mat.decor) decorer(lc, t, mat, vue.zoom, X0, Y0, X1, Y1);
    }
    lc.restore();
    if (!opts.rapide) {
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = "source-atop";
      lc.fillStyle = motifGrain(lc);
      lc.fillRect(0, 0, pw, ph);
      lc.globalCompositeOperation = "source-over";
    }

    // Assemblage : halo d'eau peu profonde, trait de côte, puis la terre.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

    // Lignes, grille, teinte du thème.
    ctx.setTransform(z, 0, 0, z, tx, ty);
    if (opts.grille) dessinerGrille(ctx, carte, vue, th);
    dessinerLignes(ctx, carte, vue, th, X0, Y0, X1, Y1);
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
    ctx.save();
    ctx.setTransform(z, 0, 0, z, vue.largeur * dpr / 2 - vue.cx * z, vue.hauteur * dpr / 2 - vue.cy * z);
    if (mat.type === "terre") {
      ctx.globalAlpha = 0.92;
      tracerTrait(ctx, t, mat);
      if (mat.decor) {
        var m = t.taille;
        decorer(ctx, t, mat, vue.zoom, vue.cx - vue.largeur / 2 / vue.zoom - m, vue.cy - vue.hauteur / 2 / vue.zoom - m,
          vue.cx + vue.largeur / 2 / vue.zoom + m, vue.cy + vue.hauteur / 2 / vue.zoom + m);
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
    styleLigne: styleLigne, pointsAffiches: pointsAffiches,
    icone: icone, iconeAuto: iconeAuto,
    dessiner: dessiner, carteEntiere: carteEntiere, vignette: vignette, apercuTrait: apercuTrait
  };
})();
