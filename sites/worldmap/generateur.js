// Génération d'un monde aléatoire : un continent, ses reliefs, ses biomes, un
// volcan et quelques rivières qui descendent des montagnes vers la mer.
//
// Le résultat n'est pas une image mais des objets ordinaires (« nuages » de
// disques pour la terre, tracés pour les rivières) : on peut ensuite les
// repeindre, les creuser à l'eau ou ajouter ses propres détails, comme pour une
// carte dessinée à la main.
(function () {
  "use strict";

  var SEUIL_TERRE = 0.74;

  function bruit(x, y, g) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = Moteur.alea(g + xi * 31, yi), b = Moteur.alea(g + (xi + 1) * 31, yi);
    var c = Moteur.alea(g + xi * 31, yi + 1), d = Moteur.alea(g + (xi + 1) * 31, yi + 1);
    var haut = a + (b - a) * u, bas = c + (d - c) * u;
    return haut + (bas - haut) * v;
  }

  // Bruit fractal : plusieurs octaves, de plus en plus fines.
  function fbm(x, y, g) {
    var somme = 0, amp = 0.5, f = 1, total = 0;
    for (var o = 0; o < 5; o++) {
      somme += amp * bruit(x * f, y * f, g + o * 101);
      total += amp;
      amp *= 0.5;
      f *= 2;
    }
    return somme / total;
  }

  function monde(carte, graine) {
    var L = carte.largeur, H = carte.hauteur, M = Math.max(L, H);
    var N = 120;                       // cellules sur le grand côté
    var cell = M / N;
    var cols = Math.ceil(L / cell), rows = Math.ceil(H / cell);
    var echelle = 3.4;
    var g = graine | 0;

    var listes = { champs: [], plaine: [], steppe: [], desert: [], marais: [], foret: [], taiga: [], glace: [], colline: [], montagne: [], cime: [], volcan: [] };

    // Une valeur par cellule, pour les rivières : hauteur (−1 hors carte), position, altitude.
    var total = cols * rows;
    var HAUT = new Array(total), PX = new Array(total), PY = new Array(total), ALT = new Array(total);
    var hautMax = SEUIL_TERRE;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var idx = r * cols + c;
        HAUT[idx] = -1;
        var jx = (Moteur.alea(g, r * 4099 + c) - 0.5) * cell * 0.5;
        var jy = (Moteur.alea(g + 1, r * 4099 + c) - 0.5) * cell * 0.5;
        var x = (c + 0.5) * cell + jx, y = (r + 0.5) * cell + jy;
        if (x < 0 || y < 0 || x > L || y > H) continue;

        var nx = x / L, ny = y / H;
        var dx = (nx - 0.5) * 2, dy = (ny - 0.5) * 2;
        var d = Math.min(1, Math.sqrt(dx * dx * 0.9 + dy * dy * 1.1));
        var masque = 1 - Math.pow(d, 2.2);
        var e = fbm(x / M * echelle, y / M * echelle, g);
        var haut = e * 0.85 + masque * 0.5;
        HAUT[idx] = haut; PX[idx] = x; PY[idx] = y;
        if (haut > hautMax) hautMax = haut;
      }
    }

    // Deuxième passe : l'altitude est relative au sommet le plus haut de CETTE carte
    // (sinon, selon le hasard du bruit, les cimes recouvrent tout ou presque rien).
    for (var i2 = 0; i2 < total; i2++) {
      var haut2 = HAUT[i2];
      if (!(haut2 >= SEUIL_TERRE)) continue;           // la mer (ou hors carte)
      var px2 = PX[i2], py2 = PY[i2];
      var alt = (haut2 - SEUIL_TERRE) / Math.max(0.01, hautMax - SEUIL_TERRE);   // 0 (littoral) .. 1 (sommet)
      ALT[i2] = alt;
      var m = fbm(px2 / M * echelle * 1.3 + 40, py2 / M * echelle * 1.3 + 40, g + 999);
      var temp = 1 - Math.abs(py2 / H - 0.5) * 1.7 - alt * 0.35;

      listes.plaine.push(px2, py2);
      var biome = null;
      if (alt > 0.74) biome = alt > 0.93 ? "cime" : "montagne";
      else if (alt > 0.58) biome = "steppe";
      else if (temp < 0.22) biome = "glace";
      else if (m > 0.56) biome = temp > 0.5 ? (alt < 0.2 && m > 0.62 ? "marais" : "foret") : "taiga";
      else if (m < 0.4 && temp > 0.5) biome = "desert";
      else if (m < 0.47 && temp > 0.4) biome = "steppe";
      // Des terres cultivées dans les basses plaines tempérées, par plaques.
      else if (alt < 0.4 && temp > 0.42 && fbm(px2 / M * echelle * 3.1 + 90, py2 / M * echelle * 3.1 + 90, g + 555) > 0.55) biome = "champs";
      if (biome) listes[biome].push(px2, py2);
    }

    // Un volcan : un secteur de terre noire et de lave sur un massif.
    var massifs = [];
    for (var q = 0; q < total; q++) if (ALT[q] > 0.74) massifs.push(q);
    if (massifs.length) {
      var centre = massifs[Math.floor(Moteur.alea(g + 7, 1) * massifs.length)];
      for (var q2 = 0; q2 < total; q2++) {
        if (!(HAUT[q2] >= SEUIL_TERRE)) continue;
        if (Math.hypot(PX[q2] - PX[centre], PY[q2] - PY[centre]) < cell * 3.6) listes.volcan.push(PX[q2], PY[q2]);
      }
    }

    // Quelques îlots, posés en mer près des côtes.
    var ilots = [], proches = [];
    for (var u = 0; u < total; u++) if (HAUT[u] >= 0.58 && HAUT[u] < SEUIL_TERRE - 0.015) proches.push(u);
    var nbIles = Math.max(4, Math.min(9, Math.round(M / 900)));
    for (var ai = 0; ai < 80 && ilots.length < nbIles && proches.length; ai++) {
      var c0 = proches[Math.floor(Moteur.alea(g + 21, ai) * proches.length)];
      var libre = ilots.every(function (o) { return Math.hypot(PX[o] - PX[c0], PY[o] - PY[c0]) > cell * 9; });
      if (!libre) continue;
      ilots.push(c0);
      var nbDabs = 2 + Math.floor(Moteur.alea(g + 22, ai) * 3);
      for (var bi = 0; bi < nbDabs; bi++) {
        var ang = Moteur.alea(g + 23, ai * 7 + bi) * Math.PI * 2, d0 = bi ? cell * 0.9 : 0;
        listes.plaine.push(PX[c0] + Math.cos(ang) * d0, PY[c0] + Math.sin(ang) * d0);
      }
      listes.foret.push(PX[c0], PY[c0]);
    }

    // La plaine d'abord (la terre de base), puis les biomes par-dessus.
    var ordre = ["plaine", "champs", "steppe", "desert", "marais", "glace", "foret", "taiga", "colline", "montagne", "cime", "volcan"];
    ordre.forEach(function (mat) {
      var pts = listes[mat];
      if (!pts.length) return;
      var taille = mat === "plaine" ? cell * 2.3 : cell * 1.75;
      carte.traits.push(Moteur.nouveauTrait(mat, taille, pts, true));
    });

    // Rivières : de hautes terres vers la mer, en suivant toujours la pente.
    carte.lignes = carte.lignes || [];
    var departs = [];
    for (var s = 0; s < total; s++) if (ALT[s] > 0.55 && ALT[s] < 0.9) departs.push(s);
    var voulues = Math.max(3, Math.min(6, Math.round(M / 1500)));
    var choisis = [];
    for (var tentative = 0; tentative < 200 && choisis.length < voulues && departs.length; tentative++) {
      var cand = departs[Math.floor(Moteur.alea(g + 11, tentative) * departs.length)];
      var loin = choisis.every(function (o) { return Math.hypot(PX[o] - PX[cand], PY[o] - PY[cand]) > cell * 14; });
      if (!loin) continue;
      var pts = descendre(cand);
      if (pts.length < 12) continue;                // trop courte : un ruisseau perdu
      // Elle doit gagner la mer (sauf si l'on a beaucoup essayé) et ne pas tourner
      // en rond dans une cuvette : un tracé quatre fois plus long que la ligne
      // droite entre sa source et son embouchure fait des nœuds une fois sinueux.
      var longueur = 0, k;
      for (k = 2; k < pts.length; k += 2) longueur += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
      var corde = Math.hypot(pts[pts.length - 2] - pts[0], pts[pts.length - 1] - pts[1]);
      var mer = pts.mer;
      if (longueur > corde * 2.2 || (!mer && tentative < 120)) continue;
      choisis.push(cand);
      carte.lignes.push({
        id: "r" + (carte.lignes.length + 1) + Math.floor(Moteur.alea(g, tentative) * 1e6).toString(36),
        type: "riviere", pts: Array.prototype.slice.call(pts), taille: cell * 0.34, meandre: 0.38, delta: true
      });
    }

    // Quelques lacs, dans les basses terres, à bonne distance les uns des autres.
    carte.lacs = carte.lacs || [];
    var basses = [], lacsPos = [];
    for (var s2 = 0; s2 < total; s2++) if (ALT[s2] > 0.12 && ALT[s2] < 0.4) basses.push(s2);
    var nbLacs = Math.max(2, Math.min(5, Math.round(M / 1500)));
    for (var tl = 0; tl < 80 && lacsPos.length < nbLacs && basses.length; tl++) {
      var cl = basses[Math.floor(Moteur.alea(g + 41, tl) * basses.length)];
      if (!lacsPos.every(function (o) { return Math.hypot(PX[o] - PX[cl], PY[o] - PY[cl]) > cell * 14; })) continue;
      lacsPos.push(cl);
      var rl = cell * (1.5 + Moteur.alea(g + 42, tl) * 1.6), contour = [];
      for (var kl = 0; kl < 14; kl++) {
        var al = kl / 14 * Math.PI * 2, rr = rl * (0.72 + 0.5 * Moteur.alea(g + 43, tl * 20 + kl));
        contour.push(PX[cl] + Math.cos(al) * rr * 1.2, PY[cl] + Math.sin(al) * rr * 0.85);
      }
      carte.lacs.push({ id: "w" + (tl + 1) + Math.floor(Moteur.alea(g, tl + 9) * 1e6).toString(36), pts: contour });
    }

    // Des navires en pleine mer, à l'écart des côtes et des îlots.
    carte.lieux = carte.lieux || [];
    var mers = [], navires = [];
    for (var u2 = 0; u2 < total; u2++) {
      // En mer ouverte, mais à bonne distance du bord de la carte (un navire de 40 px
      // sur le cadre aurait l'air perdu).
      if (HAUT[u2] >= 0.45 && HAUT[u2] < 0.66 && PX[u2] > cell * 8 && PX[u2] < L - cell * 8 && PY[u2] > cell * 8 && PY[u2] < H - cell * 8) mers.push(u2);
    }
    var nbNav = Math.max(3, Math.min(8, Math.round(M / 800)));
    for (var tn = 0; tn < 150 && navires.length < nbNav && mers.length; tn++) {
      var cn = mers[Math.floor(Moteur.alea(g + 31, tn) * mers.length)];
      var degage = navires.every(function (o) { return Math.hypot(PX[o] - PX[cn], PY[o] - PY[cn]) > cell * 10; }) &&
        ilots.every(function (o) { return Math.hypot(PX[o] - PX[cn], PY[o] - PY[cn]) > cell * 3; });
      if (!degage) continue;
      navires.push(cn);
      carte.lieux.push({ id: "n" + (tn + 1) + Math.floor(Moteur.alea(g, tn + 5) * 1e6).toString(36), type: "navire", nom: "", x: PX[cn], y: PY[cn], niv: 1.6 });
    }

    function descendre(depart) {
      var cur = depart, pas = 0, vus = {}, brut = [];
      while (pas++ < 500) {
        vus[cur] = true;
        brut.push(cur);
        if (HAUT[cur] < SEUIL_TERRE) break;            // la mer : l'embouchure
        // Toujours vers le voisin le plus bas encore inexploré — même un peu plus
        // haut que soi dans une cuvette : l'eau la remplit et la déborde.
        var meilleur = -1, bh = Infinity;
        var cr = Math.floor(cur / cols), cc = cur % cols;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var rr = cr + dr, c2 = cc + dc;
            if (rr < 0 || c2 < 0 || rr >= rows || c2 >= cols) continue;
            var n = rr * cols + c2;
            if (vus[n] || HAUT[n] < 0) continue;
            if (HAUT[n] < bh) { bh = HAUT[n]; meilleur = n; }
          }
        }
        if (meilleur < 0) break;                       // plus aucune issue : la rivière s'y perd
        cur = meilleur;
      }
      // Un point sur quatre : le moteur lisse et fait serpenter le reste.
      var pts = [];
      for (var i = 0; i < brut.length; i++) {
        if (i % 4 === 0 || i === brut.length - 1) pts.push(PX[brut[i]], PY[brut[i]]);
      }
      pts.mer = HAUT[brut[brut.length - 1]] < SEUIL_TERRE;
      return pts;
    }
  }

  // ----- Village -----
  //
  // Un plan de village vu du dessus, posé en objets ordinaires (terrains, tracés, tampons) : une
  // côte à droite avec ses pontons, des champs à gauche, des bosquets, une place ronde au
  // centre d'où partent des ruelles courbes bordées de maisons. Tout se retouche ensuite à la
  // main (déplacer un point d'une ruelle déplace ses maisons). Pour le style « Plan ».
  function village(carte, graine) {
    var L = carte.largeur, H = carte.hauteur, g = graine | 0, A = Moteur.alea;
    carte.zbFixe = 1000 * 0.9 / Math.max(L, H);      // décors à la taille d'un village (cf. fixerEchelleDecors)
    carte.traits = []; carte.lignes = []; carte.tampons = []; carte.lieux = []; carte.etiquettes = []; carte.lacs = [];
    var id = function (p, i) { return p + i + Math.floor(A(g, i + 77) * 1e6).toString(36); };
    var echelle = L / 0.9, mai = 0.0125 * echelle;     // une maison : ~12 m sur une carte de 0,9 km
    // La terre : une bande dont le bord droit est la côte (le reste de la carte est la mer).
    var ys = [-0.1, 0.12, 0.3, 0.52, 0.75, 1.1], coteX = [], terre = [];
    ys.forEach(function (fy, i) {
      var cx = (0.7 + (A(g + 1, i) - 0.5) * 0.07) * L;
      coteX.push([fy * H, cx]);
      terre.push(cx - 0.55 * L, fy * H);
    });
    carte.traits.push({ id: id("vt", 0), mat: "plaine", pts: terre, taille: 1.1 * L });
    var cote = function (y) {                          // l'abscisse de la côte à une hauteur donnée
      for (var i = 0; i + 1 < coteX.length; i++) if (y <= coteX[i + 1][0]) {
        var t = (y - coteX[i][0]) / (coteX[i + 1][0] - coteX[i][0]);
        return coteX[i][1] + (coteX[i + 1][1] - coteX[i][1]) * Math.max(0, Math.min(1, t));
      }
      return coteX[coteX.length - 1][1];
    };
    // Les champs, le long du bord gauche.
    carte.traits.push({ id: id("vc", 1), mat: "champs", pts: [0.11 * L, -0.05 * H, 0.14 * L, 0.4 * H, 0.11 * L, 1.05 * H], taille: 0.3 * L });
    // La place et les ruelles.
    var px = 0.45 * L, py = 0.47 * H, r0 = 0.05 * L, ruelles = [];
    var n = 7 + Math.floor(A(g + 2, 0) * 3);
    for (var i = 0; i < n; i++) {
      var ang = (i + (A(g + 3, i) - 0.5) * 0.45) * Math.PI * 2 / n + 0.25, dx = Math.cos(ang), dy = Math.sin(ang);
      // Jusqu'où va-t-on : jusqu'au bord du monde bâti (champs, côte, haut et bas de la carte).
      var rmax = 1e9;
      if (dx > 1e-3) rmax = Math.min(rmax, (cote(py + dy * 0.2 * L) - 0.025 * L - px) / dx);
      if (dx < -1e-3) rmax = Math.min(rmax, (px - 0.32 * L) / -dx);
      if (dy > 1e-3) rmax = Math.min(rmax, (0.93 * H - py) / dy);
      if (dy < -1e-3) rmax = Math.min(rmax, (py - 0.07 * H) / -dy);
      var len = dx > 0.5 ? rmax * 0.97 : Math.min((0.17 + 0.17 * A(g + 4, i)) * L, rmax * 0.97);   // vers la mer : jusqu'à la côte
      if (len < r0 + 0.06 * L) continue;
      var courbe = (A(g + 5, i) - 0.5) * 0.9, pts = [];
      for (var t = 0; t <= 1.001; t += 1 / 3) {
        var a = ang + courbe * t * t, r = r0 + (len - r0) * t;
        pts.push(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      carte.lignes.push({ id: id("vr", i), type: "maisons", pts: pts, taille: 0.0035 * echelle, maison: mai, cote: "deux", espace: 0.95 + 0.3 * A(g + 11, i) });
      ruelles.push(pts);
    }
    // Des liaisons entre ruelles voisines : de simples chemins, qui font des îlots.
    for (var c = 0; c + 1 < ruelles.length; c++) {
      if (A(g + 12, c) < 0.3) continue;
      var u = ruelles[c], v = ruelles[c + 1], tt0 = 0.55 + 0.25 * A(g + 13, c) , k0 = Math.round(tt0 * 3) * 2;
      carte.lignes.push({ id: id("vl", c), type: "sentier", pts: [u[k0], u[k0 + 1], v[k0], v[k0 + 1]], taille: 0.0025 * echelle });
    }
    // Un demi-anneau de maisons autour de la place, côté des champs.
    var arc = [], a0 = Math.PI * 0.55 + A(g + 14, 0) * 0.5;
    for (var q = 0; q <= 6; q++) { var aq = a0 + q * 0.34; arc.push(px + Math.cos(aq) * 0.1 * L, py + Math.sin(aq) * 0.1 * L); }
    carte.lignes.push({ id: id("va", 0), type: "maisons", pts: arc, taille: 0.003 * echelle, maison: mai, cote: "gauche" });
    // Trois pontons, répartis le long de la côte.
    [0.2, 0.5, 0.8].forEach(function (fy, i2) {
      var yy = (fy + (A(g + 15, i2) - 0.5) * 0.1) * H, ap = (A(g + 16, i2) - 0.5) * 0.5;
      carte.lignes.push({ id: id("vp", i2), type: "ponton", pts: [cote(yy) - 0.012 * L, yy, cote(yy) + Math.cos(ap) * 0.1 * L, yy + Math.sin(ap) * 0.1 * L], taille: 0.0035 * echelle });
    });
    // La place ronde, et son arbre.
    var sp = 0.06 * L;
    carte.tampons.push({ id: id("vq", 0), type: "place", v: 0, x: px, y: py + sp * 0.3, s: sp, a: 0 });
    carte.tampons.push({ id: id("vq", 1), type: "arbre", v: 1, x: px, y: py, s: 0.022 * L, a: 0 });
    // Des bosquets, à l'écart des ruelles et de la place.
    var proche = function (x, y) {
      var m = Math.hypot(x - px, y - py) - 0.13 * L;
      ruelles.forEach(function (rp) {
        for (var q = 0; q + 3 < rp.length; q += 2) m = Math.min(m, Moteur.distSeg(x, y, rp[q], rp[q + 1], rp[q + 2], rp[q + 3]) - 0.035 * L);
      });
      return m;
    };
    // Les bosquets viennent à des endroits prévus (entre les champs et le village, aux coins) ;
    // chacun se réduit s'il serait trop près d'une ruelle, et disparaît s'il ne tient nulle part.
    var zones = [[0.25, 0.12], [0.23, 0.5], [0.26, 0.88], [0.36, 0.04], [0.58, 0.07], [0.6, 0.93], [0.45, 0.97], [0.3, 0.3], [0.31, 0.72]];
    zones.forEach(function (z, tt) {
      var bx = (z[0] + (A(g + 6, tt) - 0.5) * 0.06) * L, by = (z[1] + (A(g + 7, tt) - 0.5) * 0.1) * H;
      var rb = (0.045 + 0.06 * A(g + 8, tt)) * L;
      for (var essai = 0; essai < 5 && (proche(bx, by) < rb || bx > cote(by) - 0.04 * L); essai++) rb *= 0.78;
      if (proche(bx, by) < rb || bx > cote(by) - 0.04 * L || rb < 0.02 * L) return;
      carte.traits.push({ id: id("vb", tt + 10), mat: "foret", pts: [bx, by, bx + (A(g + 9, tt) - 0.5) * 0.08 * L, by + (A(g + 10, tt) - 0.5) * 0.08 * L], taille: rb * 2 });
    });
    return carte;
  }

  window.Generateur = { monde: monde, village: village };
})();
