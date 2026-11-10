// Éditeur de carte : vue (déplacement, zoom), outils, historique, panneaux,
// enregistrement automatique et export.
//
// Les coordonnées « monde » sont en kilomètres, celles de l'écran en pixels CSS
// relatifs à la scène. Le pinceau se règle en PIXELS ÉCRAN : zoomer avant de
// peindre donne donc, sans rien régler, un trait plus fin dans le monde — c'est
// ce qui permet de détailler une zone à l'infini.
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var scene = $("scene"), cvCarte = $("cvCarte"), cvSur = $("cvSurcouche"), saisie = $("saisie");

  var NIVEAU_MIN = 0.25, NIVEAU_MAX = 15;

  var E = {
    carte: null,
    vue: { cx: 0, cy: 0, zoom: 1 },
    outil: "pinceau",
    materiau: "plaine",
    taillePx: 40,
    densite: 2,              // pinceau : décors du terrain (0 aucun, 1 clairsemé, 2 normal, 3 dense)
    echDecor: 1,             // pinceau : taille des décors (0 petits, 1 normaux, 2 grands)
    eclaircir: 0,            // gomme à décors : 0 retire tout, 1 n'en laisse que quelques-uns
    finesse: "auto",         // pinceau : finesse des décors (0 à 4, ou « auto » : d'après le zoom)
    rugosite: 0,             // pinceau et gomme : bord découpé (0 = bord lisse)
    tampon: "arbre",         // outil Décors : le décor posé à la main
    taillePxTampon: 36,
    variation: 0.3,          // outil Décors : écart de taille d'un décor à l'autre
    typeLigne: "riviere",
    couleurFrontiere: "#8a2b2b",
    epaisseurPx: 2.4,
    meandre: 0.6,            // rivières : amplitude des méandres (0 = droit)
    delta: true,             // rivières : s'élargissent vers l'embouchure
    fermer: false,           // frontières : refermer en territoire coloré
    styleEtiq: "pays",
    taillePxEtiq: 30,
    typeLieu: "ville",
    selection: null,         // { coll, obj }
    grille: false,
    ligneEnCours: null,      // { type, pts, taille }
    curseur: null,           // { x, y } en px scène
    espace: false,
    histo: { pile: [], reprise: [] },
    edition: null,
    modifie: false,
    minuteurSauve: 0
  };

  var W = 1, H = 1, DPR = 1;

  // ----- Utilitaires -----
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function nouvelId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nb(n, d) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: d == null ? 0 : d }); }
  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  function formatKm(v) {
    if (v >= 100) return nb(v, 0) + " km";
    if (v >= 1) return nb(v, 1) + " km";
    if (v >= 0.01) return nb(v * 1000, 0) + " m";
    return nb(v * 1000, 1) + " m";
  }

  function themeActuel() { return Moteur.THEMES[E.carte.theme] || Moteur.THEMES.atlas; }

  function tailleScene() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, scene.clientWidth);
    H = Math.max(1, scene.clientHeight);
  }

  function vueComplete() {
    return { cx: E.vue.cx, cy: E.vue.cy, zoom: E.vue.zoom, largeur: W, hauteur: H, dpr: DPR };
  }

  function versMonde(px, py) {
    return [E.vue.cx + (px - W / 2) / E.vue.zoom, E.vue.cy + (py - H / 2) / E.vue.zoom];
  }
  function versEcran(x, y) {
    return [(x - E.vue.cx) * E.vue.zoom + W / 2, (y - E.vue.cy) * E.vue.zoom + H / 2];
  }

  function zoomMin() { return Moteur.zoomAjuste(E.carte, vueComplete()) * NIVEAU_MIN; }
  function zoomMax() { return Moteur.zoomAjuste(E.carte, vueComplete()) * NIVEAU_MAX; }
  function niveauActuel() { return Moteur.niveau(E.carte, vueComplete()); }

  function ajusterVue() {
    var c = E.carte;
    // Scène pas encore mesurée (onglet caché, panneau replié) : le zoom calculé serait
    // minuscule. On le refera dès que la scène aura une vraie taille.
    E.ajusterQuandMesuree = W <= 2 || H <= 2;
    E.vue.zoom = Moteur.zoomAjuste(c, vueComplete());
    E.vue.cx = c.largeur / 2;
    E.vue.cy = c.hauteur / 2;
  }

  // ----- Rendu -----
  //
  // Le rendu complet est calculé dans une image de travail un peu plus grande que l'écran
  // (une marge de 15 % de chaque côté), puis simplement recopiée à l'écran. Pendant un
  // geste (déplacement, molette, pincement), on ne recalcule RIEN : on recopie cette même
  // image décalée et agrandie — instantané, et c'est la vraie carte, pas un brouillon
  // simplifié qui changerait d'aspect. Le rendu complet suit dès que le geste se calme.
  var MARGE_CACHE = 0.15;
  var cache = { cv: document.createElement("canvas"), vue: null };
  var rafId = 0, veutComplet = false, minuteurComplet = 0;

  function rendre(pendantGeste) {
    if (!E.carte) return;
    if (pendantGeste && cache.vue) {
      demanderImage(false);
      clearTimeout(minuteurComplet);
      minuteurComplet = setTimeout(function () { demanderImage(true); }, 140);
    } else {
      clearTimeout(minuteurComplet);
      demanderImage(true);
    }
  }

  function demanderImage(complet) {
    if (complet) veutComplet = true;
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      if (veutComplet) { veutComplet = false; rendreComplet(); }
      afficherCache();
      surcouche();
      dessinerMini();
    });
  }

  function rendreComplet() {
    var v = {
      cx: E.vue.cx, cy: E.vue.cy, zoom: E.vue.zoom,
      largeur: Math.round(W * (1 + 2 * MARGE_CACHE)), hauteur: Math.round(H * (1 + 2 * MARGE_CACHE)), dpr: DPR
    };
    Moteur.dessiner(cache.cv, E.carte, v, { grille: E.grille });
    cache.vue = v;
  }

  // Recopie l'image de travail à l'écran, à la position et à l'échelle de la vue actuelle.
  function afficherCache() {
    var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
    if (cvCarte.width !== pw || cvCarte.height !== ph) { cvCarte.width = pw; cvCarte.height = ph; }
    var ctx = cvCarte.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = themeActuel().hors;
    ctx.fillRect(0, 0, pw, ph);
    var c = cache.vue;
    if (!c) return;
    var s = E.vue.zoom / c.zoom;
    var cx = ((c.cx - E.vue.cx) * E.vue.zoom + W / 2) * DPR, cy = ((c.cy - E.vue.cy) * E.vue.zoom + H / 2) * DPR;
    var dw = c.largeur * s * DPR, dh = c.hauteur * s * DPR;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cache.cv, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  function infosVue() {
    $("niveauZoom").textContent = "×" + nb(niveauActuel(), niveauActuel() < 10 ? 1 : 0);
    var pas = Moteur.joli(110 / E.vue.zoom);
    var px = pas * E.vue.zoom;
    $("echelle").innerHTML = '<div class="regle" style="width:' + px.toFixed(0) + 'px"></div>' + formatKm(pas);
    majLibelleTaille();
    majLibelleFinesse();
  }

  function vueChangee() {
    var c = E.carte;
    E.vue.cx = borne(E.vue.cx, -c.largeur * 0.25, c.largeur * 1.25);
    E.vue.cy = borne(E.vue.cy, -c.hauteur * 0.25, c.hauteur * 1.25);
    infosVue();
    rendre(true);
  }

  function zoomerVers(px, py, facteur) {
    var av = versMonde(px, py);
    E.vue.zoom = borne(E.vue.zoom * facteur, zoomMin(), zoomMax());
    var ap = versMonde(px, py);
    E.vue.cx += av[0] - ap[0];
    E.vue.cy += av[1] - ap[1];
    vueChangee();
  }

  // ----- Surcouche : tout ce qui n'est pas dans la carte -----
  function surcouche() {
    var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
    if (cvSur.width !== pw || cvSur.height !== ph) { cvSur.width = pw; cvSur.height = ph; }
    var ctx = cvSur.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    if (!E.carte) return;

    if (geste && geste.type === "trait" && !geste.affiner) Moteur.apercuTrait(ctx, geste.trait, vueComplete());

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (geste && geste.affiner) {
      // La zone à affiner : un voile clair, le terrain reste visible dessous.
      var pa = geste.trait.pts;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.strokeStyle = ctx.fillStyle = "rgba(255,244,200,0.4)";
      ctx.lineWidth = geste.trait.taille * E.vue.zoom;
      ctx.beginPath();
      var s0 = versEcran(pa[0], pa[1]);
      if (pa.length <= 2) { ctx.arc(s0[0], s0[1], geste.trait.taille * E.vue.zoom / 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(s0[0], s0[1]); for (var ia = 2; ia < pa.length; ia += 2) { var sa2 = versEcran(pa[ia], pa[ia + 1]); ctx.lineTo(sa2[0], sa2[1]); } ctx.stroke(); }
    }
    if (geste && geste.type === "tampons") {
      geste.poses.forEach(function (t) {
        var s0 = versEcran(t.x, t.y - t.s * 0.3), px = t.s * E.vue.zoom;
        Moteur.apercuDecor(ctx, t.type, t.v, s0[0], s0[1], px);
      });
    }
    if (geste && geste.type === "lac") {
      // Le contour du lac en cours : une ligne, refermée en pointillé sur le point de départ.
      ctx.beginPath();
      for (var il = 0; il < geste.pts.length; il += 2) {
        var sl = versEcran(geste.pts[il], geste.pts[il + 1]);
        if (il === 0) ctx.moveTo(sl[0], sl[1]); else ctx.lineTo(sl[0], sl[1]);
      }
      ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.stroke();
      ctx.lineTo(versEcran(geste.pts[0], geste.pts[1])[0], versEcran(geste.pts[0], geste.pts[1])[1]);
      ctx.fillStyle = "rgba(60,140,220,0.4)"; ctx.fill();
    }
    ligneEnCoursSurcouche(ctx);
    selectionSurcouche(ctx);
    curseurSurcouche(ctx);
  }

  function curseurSurcouche(ctx) {
    var c = E.curseur;
    if (!c || (geste && geste.type !== "trait" && geste.type !== "mainLevee")) return;
    if (E.outil === "tampon") {
      ctx.globalAlpha = 0.65;
      Moteur.apercuDecor(ctx, E.tampon, 0, c.x, c.y, E.taillePxTampon);
      ctx.globalAlpha = 1;
    } else if (E.outil === "pinceau" || E.outil === "gomme") {
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(1, E.taillePx / 2), 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();
    } else if (E.outil === "ligne") {
      // Un anneau doré là où le prochain point s'accrochera à une voie existante.
      var acc = accrocher(c, E.ligneEnCours ? E.ligneEnCours.type : E.typeLigne);
      if (acc) {
        var sa = versEcran(acc[0], acc[1]);
        ctx.beginPath();
        ctx.arc(sa[0], sa[1], 7, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(216,179,108,0.95)";
        ctx.stroke();
      }
    } else if (E.outil === "lieu") {
      var thc = themeActuel();
      ctx.globalAlpha = 0.6;
      if (E.typeLieu !== "image") Moteur.iconeAuto(ctx, E.typeLieu, c.x, c.y, Moteur.tailleIcone({ type: E.typeLieu }, thc), thc);
      ctx.globalAlpha = 1;
    }
  }

  function ligneEnCoursSurcouche(ctx) {
    var l = E.ligneEnCours;
    if (!l) return;
    var th = Moteur.THEMES[E.carte.theme] || Moteur.THEMES.atlas;
    var st = Moteur.styleLigne(l, th);
    var pts = l.pts.slice();
    if (E.curseur) { var m = versMonde(E.curseur.x, E.curseur.y); pts.push(m[0], m[1]); }
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    for (var i = 0; i < pts.length; i += 2) {
      var s = versEcran(pts[i], pts[i + 1]);
      if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
    }
    ctx.strokeStyle = st.c;
    ctx.lineWidth = Math.max(l.taille * E.vue.zoom, 1.6);
    ctx.setLineDash(st.tiret ? st.tiret.map(function (v) { return v * Math.max(l.taille * E.vue.zoom, 1.6); }) : []);
    ctx.stroke();
    ctx.setLineDash([]);
    for (var j = 0; j < l.pts.length; j += 2) {
      var p = versEcran(l.pts[j], l.pts[j + 1]);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#1c2a6b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function selectionSurcouche(ctx) {
    var sel = E.selection;
    if (!sel) return;
    ctx.strokeStyle = "#ffd36b";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 2;
    if (sel.coll === "lieux") {
      // Caché à ce niveau de zoom : le cercle de sélection n'a rien à entourer.
      if (!Moteur.visibleLieu(sel.obj, niveauActuel())) return;
      var s = versEcran(sel.obj.x, sel.obj.y);
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(s[0], s[1], Moteur.tailleIcone(sel.obj, themeActuel()) / 2 + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (sel.coll === "etiquettes") {
      var e = sel.obj, b = Moteur.boiteEtiquette(e), sc = versEcran(e.x, e.y);
      var w = b.w * E.vue.zoom, h = b.h * E.vue.zoom;
      // Hors des tailles où le texte est dessiné (6 à 1 400 px), il n'y a rien à entourer.
      if (e.taille * E.vue.zoom < 6 || e.taille * E.vue.zoom > 1400) return;
      ctx.save();
      ctx.translate(sc[0], sc[1]);
      if (e.angle) ctx.rotate(e.angle * Math.PI / 180);
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(-w / 2 - 4, -h / 2 - 2 + (b.dy || 0) * E.vue.zoom, w + 8, h + 4);   // `dy` : la flèche d'un nom courbe
      ctx.restore();
    } else if (sel.coll === "tampons") {
      var t = sel.obj, st = versEcran(t.x, t.y - t.s * 0.3), cote = Moteur.tailleTampon(t, E.vue.zoom) * E.vue.zoom;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(st[0] - cote * 0.48, st[1] - cote * 0.48, cote * 0.96, cote * 0.96);
      ctx.setLineDash([]);
    } else if (sel.coll === "lignes" || sel.coll === "lacs") {
      var p = sel.obj.pts;
      ctx.strokeStyle = "#1c2a6b";
      for (var i = 0; i < p.length; i += 2) {
        var v = versEcran(p[i], p[i + 1]);
        ctx.beginPath();
        ctx.rect(v[0] - 5, v[1] - 5, 10, 10);
        ctx.fillStyle = "#ffd36b";
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // ----- Historique -----
  function collection(nom) { return E.carte[nom]; }

  function faire(a) {
    if (a.t === "lot") { a.actions.forEach(faire); return; }
    var arr = collection(a.coll);
    if (a.t === "ajout") arr.splice(Math.min(a.idx, arr.length), 0, a.obj);
    else if (a.t === "suppr") { var i = arr.indexOf(a.obj); if (i >= 0) arr.splice(i, 1); }
    else if (a.t === "modif") remplacer(arr, a.id, a.apres);
  }
  function defaire(a) {
    if (a.t === "lot") { a.actions.slice().reverse().forEach(defaire); return; }
    var arr = collection(a.coll);
    if (a.t === "ajout") { var i = arr.indexOf(a.obj); if (i >= 0) arr.splice(i, 1); }
    else if (a.t === "suppr") arr.splice(Math.min(a.idx, arr.length), 0, a.obj);
    else if (a.t === "modif") remplacer(arr, a.id, a.avant);
  }
  function remplacer(arr, id, valeurs) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        var o = arr[i];
        Object.keys(o).forEach(function (k) { delete o[k]; });
        Object.assign(o, cloner(valeurs));
        if (o.pts && o.taille != null && o.bb) o.bb = Moteur.boiteTrait(o.pts, o.taille);
        return;
      }
    }
  }

  function apresHistorique() {
    if (E.selection && collection(E.selection.coll).indexOf(E.selection.obj) < 0) E.selection = null;
    majBoutonsHisto();
    panneauSelection();
    infosCarte();
    majIndex();
    rendre();
    marquer();
  }

  function executer(a) {
    cloreEdition();
    faire(a);
    E.histo.pile.push(a);
    if (E.histo.pile.length > 300) E.histo.pile.shift();
    E.histo.reprise.length = 0;
    apresHistorique();
  }
  function enregistrer(a) {
    E.histo.pile.push(a);
    if (E.histo.pile.length > 300) E.histo.pile.shift();
    E.histo.reprise.length = 0;
    majBoutonsHisto();
  }
  function annuler() {
    cloreEdition();
    var a = E.histo.pile.pop();
    if (!a) return;
    defaire(a);
    E.histo.reprise.push(a);
    apresHistorique();
  }
  function refaire() {
    cloreEdition();
    var a = E.histo.reprise.pop();
    if (!a) return;
    faire(a);
    E.histo.pile.push(a);
    apresHistorique();
  }
  function majBoutonsHisto() {
    $("btnAnnuler").disabled = !E.histo.pile.length;
    $("btnRefaire").disabled = !E.histo.reprise.length;
  }

  function ajouter(coll, obj) { executer({ t: "ajout", coll: coll, obj: obj, idx: collection(coll).length }); }
  // Plusieurs objets en un seul pas d'historique (une traînée de décors, par exemple).
  function ajouterLot(coll, objets) {
    if (!objets.length) return;
    var base = collection(coll).length;
    executer({ t: "lot", actions: objets.map(function (o, i) { return { t: "ajout", coll: coll, obj: o, idx: base + i }; }) });
  }
  function dupliquer(coll, obj) {
    var copie = cloner(obj), d = 26 / E.vue.zoom;
    copie.id = nouvelId(coll.charAt(0));
    delete copie.carteId;                 // la carte détaillée d'un lieu ne se partage pas
    if (copie.pts) for (var i = 0; i < copie.pts.length; i += 2) { copie.pts[i] += d; copie.pts[i + 1] += d; }
    else { copie.x += d; copie.y += d; }
    ajouter(coll, copie);
    choisirOutil("selection");
    selectionner(coll, copie);
  }
  function supprimerObjet(coll, obj) {
    var idx = collection(coll).indexOf(obj);
    if (idx < 0) return;
    if (E.selection && E.selection.obj === obj) E.selection = null;
    executer({ t: "suppr", coll: coll, obj: obj, idx: idx });
  }

  // Modification d'un champ (panneau) : appliquée aussitôt, enregistrée dans
  // l'historique en un seul pas quand les réglages se calment.
  function editer(fn) {
    var sel = E.selection;
    if (!sel) return;
    if (!E.edition || E.edition.obj !== sel.obj) {
      cloreEdition();
      E.edition = { coll: sel.coll, obj: sel.obj, avant: JSON.stringify(sel.obj) };
    }
    fn(sel.obj);
    if (sel.obj.pts && sel.obj.taille != null && sel.obj.bb) sel.obj.bb = Moteur.boiteTrait(sel.obj.pts, sel.obj.taille);
    rendre();
    marquer();
    clearTimeout(E.minuteurEdition);
    E.minuteurEdition = setTimeout(cloreEdition, 700);
  }
  function cloreEdition() {
    clearTimeout(E.minuteurEdition);
    var ed = E.edition;
    if (!ed) return;
    E.edition = null;
    var apres = JSON.stringify(ed.obj);
    if (apres === ed.avant) return;
    enregistrer({ t: "modif", coll: ed.coll, id: ed.obj.id, avant: JSON.parse(ed.avant), apres: JSON.parse(apres) });
  }

  // ----- Sélection et recherche d'objets -----
  function selectionner(coll, obj) {
    cloreEdition();
    E.selection = obj ? { coll: coll, obj: obj } : null;
    panneauSelection();
    majIndex();
    surcouche();
  }

  function distanceSegment(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    var t = l2 ? borne(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1) : 0;
    var x = x0 + dx * t, y = y0 + dy * t;
    return { d: Math.hypot(px - x, py - y), x: x, y: y, t: t };
  }

  function trouver(px, py) {
    var z = E.vue.zoom, niv = niveauActuel(), w = versMonde(px, py), i;
    var lieux = E.carte.lieux;
    for (i = lieux.length - 1; i >= 0; i--) {
      var l = lieux[i];
      if (!Moteur.visibleLieu(l, niv)) continue;
      var s = versEcran(l.x, l.y);
      if (Math.hypot(s[0] - px, s[1] - py) <= Moteur.tailleIcone(l, themeActuel()) / 2 + 6) return { coll: "lieux", obj: l };
    }
    var et = E.carte.etiquettes;
    for (i = et.length - 1; i >= 0; i--) {
      var e = et[i];
      var tpx = e.taille * z;
      if (!e.texte || tpx < 6 || tpx > 1400) continue;
      var b = Moteur.boiteEtiquette(e);
      var dx = w[0] - e.x, dy = w[1] - e.y;
      var a = -(e.angle || 0) * Math.PI / 180;
      var lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= b.w / 2 + 4 / z && Math.abs(ly - (b.dy || 0)) <= b.h / 2 + 2 / z) return { coll: "etiquettes", obj: e };
    }
    var li = E.carte.lignes;
    for (i = li.length - 1; i >= 0; i--) {
      var ln = li[i];
      var seuil = Math.max(7, ln.taille * z / 2 + 4) / z;
      var aff = Moteur.pointsAffiches(ln);   // le tracé tel qu'il est dessiné (méandres compris)
      for (var j = 0; j + 3 < aff.length; j += 2) {
        if (distanceSegment(w[0], w[1], aff[j], aff[j + 1], aff[j + 2], aff[j + 3]).d <= seuil) return { coll: "lignes", obj: ln };
      }
    }
    // Les décors posés à la main : du premier plan vers le fond.
    var tp = E.carte.tampons, meilleur = null;
    for (i = 0; i < tp.length; i++) {
      // (x, yc) : le centre du décor, fixe ; `ts` : sa taille à ce zoom (plafonnée à l'écran).
      var t = tp[i], ts = Moteur.tailleTampon(t, z), yc = t.y - t.s * 0.3;
      if (ts * z < 6) continue;
      if (Math.abs(w[0] - t.x) <= ts * 0.42 && Math.abs(w[1] - yc) <= ts * 0.45 && (!meilleur || t.y > meilleur.y)) meilleur = t;
    }
    if (meilleur) return { coll: "tampons", obj: meilleur };
    // Les lacs en dernier : au-dessous des tracés (une route sur un lac se clique avant lui).
    var lacs = E.carte.lacs;
    for (i = lacs.length - 1; i >= 0; i--) {
      if (lacs[i].pts && lacs[i].pts.length >= 6 && Moteur.dansPolygone(w[0], w[1], lacs[i].pts)) return { coll: "lacs", obj: lacs[i] };
    }
    return null;
  }

  function sommetProche(ligne, px, py) {
    for (var i = 0; i < ligne.pts.length; i += 2) {
      var s = versEcran(ligne.pts[i], ligne.pts[i + 1]);
      if (Math.hypot(s[0] - px, s[1] - py) <= 10) return i;
    }
    return -1;
  }

  // ----- Saisie de texte sur la carte -----
  var rappelSaisie = null;
  var saisieVidePermise = false;
  function demanderTexte(px, py, valeur, rappel, videPermis) {
    rappelSaisie = rappel;
    saisieVidePermise = !!videPermis;
    saisie.placeholder = videPermis ? "Nom (facultatif)" : "";
    saisie.hidden = false;
    saisie.style.left = borne(px, 90, Math.max(90, W - 90)) + "px";
    saisie.style.top = borne(py, 22, Math.max(22, H - 22)) + "px";
    saisie.value = valeur || "";
    saisie.focus();
    saisie.select();
  }
  function fermerSaisie(valider) {
    if (saisie.hidden) return;
    var texte = saisie.value.trim();
    var r = rappelSaisie;
    rappelSaisie = null;
    saisie.hidden = true;
    if (valider && (texte || saisieVidePermise) && r) r(texte);
    scene.focus && scene.focus();
  }
  saisie.addEventListener("keydown", function (ev) {
    ev.stopPropagation();
    if (ev.key === "Enter") { ev.preventDefault(); fermerSaisie(true); }
    else if (ev.key === "Escape") { ev.preventDefault(); fermerSaisie(false); }
  });
  saisie.addEventListener("blur", function () { fermerSaisie(false); });

  // ----- Gestes -----
  var ptrs = {};
  var geste = null;
  var pinch = null;

  function posEvt(ev) {
    var r = scene.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function tailleMondePinceau() { return Math.max(E.taillePx / E.vue.zoom, 1e-6); }

  // La finesse des décors du prochain trait : chaque cran les rend deux fois plus petits (et
  // quatre fois plus nombreux). En « auto », elle suit le zoom : peindre de près donne des
  // décors fins, peindre de loin des décors visibles de loin. Une fois peints, ils ne
  // changent plus — ils sont fixés dans le monde.
  function finesseActuelle() {
    if (E.finesse !== "auto") return E.finesse;
    // L'échelle générale de la carte compte déjà pour un ou deux crans : on vise des décors
    // de taille normale À L'ÉCRAN au zoom où l'on peint.
    var generale = typeof E.carte.finesse === "number" ? E.carte.finesse : 1;
    return borne(Math.round(Math.log(Math.max(niveauActuel(), 0.01)) / Math.LN2) - generale, 0, Moteur.FINESSE_MAX);
  }

  // Un décor posé à la main : sa taille est celle de l'écran au moment du clic, puis il
  // appartient au monde (il grandit quand on s'approche, comme un vrai relief).
  function nouveauTampon(w) {
    var s = E.taillePxTampon / E.vue.zoom * (1 + (Math.random() - 0.5) * 2 * E.variation * 0.6);
    return { id: nouvelId("d"), type: E.tampon, v: Math.floor(Math.random() * 12), x: w[0], y: w[1] + s * 0.3, s: s };
  }

  function commencerPan(p) {
    geste = { type: "pan", x: p.x, y: p.y };
    scene.classList.add("saisit");
  }

  function surBas(ev) {
    if (ev.target !== cvSur) return;
    if (!E.carte) return;
    var p = posEvt(ev);
    try { scene.setPointerCapture(ev.pointerId); } catch (e) { /* ignoré */ }
    ptrs[ev.pointerId] = p;
    var n = Object.keys(ptrs).length;
    if (n === 2) { demarrerPinch(); return; }
    if (n > 2) return;
    if (!saisie.hidden) fermerSaisie(false);

    if (ev.button === 1 || (ev.button === 0 && (E.outil === "main" || E.espace))) { ev.preventDefault(); commencerPan(p); return; }
    if (ev.button !== 0) return;

    var w = versMonde(p.x, p.y);
    switch (E.outil) {
      case "pinceau":
      case "gomme":
        geste = {
          type: "trait",
          trait: Moteur.nouveauTrait(E.outil === "gomme" ? "eau" : E.materiau, tailleMondePinceau(), [w[0], w[1]], false),
          dernier: w
        };
        if (E.outil === "pinceau" && E.materiau === "@affiner") { geste.affiner = true; geste.trait.mat = "@affiner"; geste.trait.fin = finesseActuelle(); surcouche(); break; }
        if (E.outil === "pinceau" && E.materiau === "@eclaircir") { geste.affiner = true; geste.trait.mat = "@eclaircir"; geste.trait.dens = E.eclaircir; surcouche(); break; }
        if (E.rugosite > 0) geste.trait.rug = E.rugosite;
        if (E.outil === "pinceau") {
          if (E.densite !== 2) geste.trait.dens = E.densite;
          if (E.echDecor !== 1) geste.trait.ech = E.echDecor;
          var fin = finesseActuelle();
          if (fin > 0) geste.trait.fin = fin;
        }
        surcouche();
        break;
      case "tampon":
        geste = { type: "tampons", poses: [nouveauTampon(w)], dernier: p };
        surcouche();
        break;
      case "ligne":
        ajouterPointLigne(p, w);
        // Glisser sans relâcher : le tracé suit la main (un point tous les 16 px).
        geste = { type: "mainLevee", dernier: p };
        break;
      case "lac":
        geste = { type: "lac", pts: [w[0], w[1]], dernier: w };
        break;
      case "etiquette":
      case "lieu":
        geste = { type: "clic", x: p.x, y: p.y };
        break;
      case "selection":
        debutSelection(p, w);
        break;
    }
  }

  // Un contour tracé à main levée compte des centaines de points : on n'en garde que
  // ceux qui sont à plus de 6 px les uns des autres, 48 au plus, de quoi le modifier ensuite.
  function simplifierContour(pts) {
    var min = 6 / E.vue.zoom, out = [pts[0], pts[1]];
    for (var i = 2; i < pts.length; i += 2) {
      if (Math.hypot(pts[i] - out[out.length - 2], pts[i + 1] - out[out.length - 1]) >= min) out.push(pts[i], pts[i + 1]);
    }
    while (out.length / 2 > 48) {
      var reduit = [];
      for (var k = 0; k < out.length; k += 4) reduit.push(out[k], out[k + 1]);
      out = reduit;
    }
    return out;
  }

  function debutSelection(p, w) {
    var sel = E.selection;
    if (sel && (sel.coll === "lignes" || sel.coll === "lacs")) {
      var i = sommetProche(sel.obj, p.x, p.y);
      if (i >= 0) { geste = { type: "sommet", obj: sel.obj, coll: sel.coll, i: i, avant: JSON.stringify(sel.obj) }; return; }
    }
    var hit = trouver(p.x, p.y);
    if (hit) {
      selectionner(hit.coll, hit.obj);
      if (hit.coll === "lieux" || hit.coll === "etiquettes" || hit.coll === "tampons") {
        geste = { type: "deplace", coll: hit.coll, obj: hit.obj, avant: JSON.stringify(hit.obj), dx: hit.obj.x - w[0], dy: hit.obj.y - w[1], bouge: false };
      } else if (hit.coll === "lacs") {
        geste = { type: "deplaceLac", obj: hit.obj, avant: JSON.stringify(hit.obj), x0: w[0], y0: w[1], base: hit.obj.pts.slice(), bouge: false };
      } else {
        geste = { type: "clic", x: p.x, y: p.y, selectionne: true };
      }
    } else {
      geste = { type: "clic", x: p.x, y: p.y, vide: true };
    }
  }

  // Accroche : un point posé près d'une voie existante (route ou sentier pour une voie,
  // rivière pour une rivière) se colle exactement dessus — sur son extrémité d'abord,
  // sinon sur le tracé tel qu'il est dessiné. L'embranchement rejoint ainsi la route au
  // lieu de s'arrêter à côté, et les deux chaussées se fondent.
  var FAMILLES = { route: "voie", pavee: "voie", sentier: "voie", riviere: "riviere" };
  function accrocher(p, type) {
    var famille = FAMILLES[type];
    if (!famille) return null;
    var w = versMonde(p.x, p.y), meilleur = null, dMin = 13;
    E.carte.lignes.forEach(function (l) {
      if (FAMILLES[l.type] !== famille || l === E.ligneEnCours || !l.pts || l.pts.length < 4) return;
      var d = Moteur.pointsAffiches(l);
      [[d[0], d[1]], [d[d.length - 2], d[d.length - 1]]].forEach(function (b) {
        var s = versEcran(b[0], b[1]), e = Math.hypot(s[0] - p.x, s[1] - p.y);
        if (e < dMin + 3) { dMin = e - 3; meilleur = b; }
      });
      for (var j = 0; j + 3 < d.length; j += 2) {
        var r = distanceSegment(w[0], w[1], d[j], d[j + 1], d[j + 2], d[j + 3]);
        var e = r.d * E.vue.zoom;
        if (e < dMin) { dMin = e; meilleur = [r.x, r.y]; }
      }
    });
    return meilleur;
  }

  function ajouterPointLigne(p, w) {
    var accroche = accrocher(p, E.ligneEnCours ? E.ligneEnCours.type : E.typeLigne);
    if (accroche) w = accroche;
    if (!E.ligneEnCours) {
      var th = E.typeLigne;
      E.ligneEnCours = {
        id: nouvelId("l"), type: th, pts: [], taille: E.epaisseurPx / E.vue.zoom,
        couleur: th === "frontiere" ? E.couleurFrontiere : null
      };
      if (th === "riviere") { E.ligneEnCours.meandre = E.meandre; E.ligneEnCours.delta = E.delta; }
      if (th === "frontiere" && E.fermer) E.ligneEnCours.ferme = true;
    }
    var pts = E.ligneEnCours.pts;
    if (pts.length >= 2) {
      var der = versEcran(pts[pts.length - 2], pts[pts.length - 1]);
      if (Math.hypot(der[0] - p.x, der[1] - p.y) < 3) return;
    }
    pts.push(w[0], w[1]);
    surcouche();
  }

  function terminerLigne() {
    var l = E.ligneEnCours;
    E.ligneEnCours = null;
    if (l && l.pts.length >= 4) {
      if (!l.couleur) delete l.couleur;
      ajouter("lignes", l);
      selectionner("lignes", l);
    } else surcouche();
  }

  function surDeplacement(ev) {
    var p = posEvt(ev);
    E.curseur = p;
    if (ptrs[ev.pointerId]) ptrs[ev.pointerId] = p;

    if (pinch && Object.keys(ptrs).length >= 2) { majPinch(); return; }

    var w = versMonde(p.x, p.y);
    $("coords").textContent = nb(w[0], 1) + " ; " + nb(w[1], 1) + " km";

    if (!geste) { surcouche(); return; }
    switch (geste.type) {
      case "pan":
        E.vue.cx -= (p.x - geste.x) / E.vue.zoom;
        E.vue.cy -= (p.y - geste.y) / E.vue.zoom;
        geste.x = p.x; geste.y = p.y;
        vueChangee();
        break;
      case "trait":
        var d = Math.hypot(w[0] - geste.dernier[0], w[1] - geste.dernier[1]) * E.vue.zoom;
        if (d >= 2.2) {
          geste.trait.pts.push(w[0], w[1]);
          geste.dernier = w;
          surcouche();
        }
        break;
      case "tampons":
        var ecart = Math.max(10, E.taillePxTampon * 0.55);
        if (Math.hypot(p.x - geste.dernier.x, p.y - geste.dernier.y) >= ecart) {
          // Un peu de désordre de part et d'autre du geste : un bosquet, pas un alignement.
          var jx = (Math.random() - 0.5) * ecart * 0.7, jy = (Math.random() - 0.5) * ecart * 0.7;
          geste.poses.push(nouveauTampon(versMonde(p.x + jx, p.y + jy)));
          geste.dernier = p;
          surcouche();
        }
        break;
      case "mainLevee":
        if (E.ligneEnCours && Math.hypot(p.x - geste.dernier.x, p.y - geste.dernier.y) >= 16) {
          E.ligneEnCours.pts.push(w[0], w[1]);
          geste.dernier = p;
          geste.trace = true;
        }
        surcouche();
        break;
      case "lac":
        if (Math.hypot(w[0] - geste.dernier[0], w[1] - geste.dernier[1]) * E.vue.zoom >= 5) {
          geste.pts.push(w[0], w[1]);
          geste.dernier = w;
          surcouche();
        }
        break;
      case "deplaceLac":
        var ddx = w[0] - geste.x0, ddy = w[1] - geste.y0;
        for (var q = 0; q < geste.base.length; q += 2) {
          geste.obj.pts[q] = geste.base[q] + ddx;
          geste.obj.pts[q + 1] = geste.base[q + 1] + ddy;
        }
        geste.bouge = true;
        rendre();
        break;
      case "clic":
        if (Math.hypot(p.x - geste.x, p.y - geste.y) > 5) {
          if (geste.selectionne) { geste = { type: "rien" }; break; }
          commencerPan({ x: geste.x, y: geste.y });
          surDeplacement(ev);
        }
        break;
      case "deplace":
        geste.obj.x = w[0] + geste.dx;
        geste.obj.y = w[1] + geste.dy;
        geste.bouge = true;
        rendre();
        break;
      case "sommet":
        geste.obj.pts[geste.i] = w[0];
        geste.obj.pts[geste.i + 1] = w[1];
        geste.bouge = true;
        rendre();
        break;
      default:
        surcouche();
    }
  }

  function surHaut(ev) {
    var p = posEvt(ev);
    delete ptrs[ev.pointerId];
    try { scene.releasePointerCapture(ev.pointerId); } catch (e) { /* ignoré */ }
    if (pinch) { if (Object.keys(ptrs).length < 2) pinch = null; if (!Object.keys(ptrs).length) geste = null; return; }
    var g = geste;
    geste = null;
    scene.classList.remove("saisit");
    if (!g) return;

    switch (g.type) {
      case "trait":
        g.trait.bb = Moteur.boiteTrait(g.trait.pts, g.trait.taille);
        if (g.affiner) {
          var zone = { id: g.trait.id, taille: g.trait.taille, pts: g.trait.pts, bb: g.trait.bb };
          if (g.trait.mat === "@eclaircir") zone.dens = g.trait.dens; else zone.fin = g.trait.fin;
          ajouter("finesses", zone);
        }
        else ajouter("traits", g.trait);
        break;
      case "tampons":
        ajouterLot("tampons", g.poses);
        break;
      case "mainLevee":
        // Un tracé dessiné d'un seul geste se termine au relâchement.
        if (g.trace && E.ligneEnCours && E.ligneEnCours.pts.length >= 6) terminerLigne();
        break;
      case "lac":
        if (g.pts.length >= 6) {
          var lac = { id: nouvelId("w"), pts: simplifierContour(g.pts) };
          ajouter("lacs", lac);
          selectionner("lacs", lac);
          choisirOutil("selection");
        }
        break;
      case "deplaceLac":
        if (g.bouge) {
          enregistrer({ t: "modif", coll: "lacs", id: g.obj.id, avant: JSON.parse(g.avant), apres: cloner(g.obj) });
          marquer();
        }
        break;
      case "clic":
        if (g.vide) selectionner(null, null);
        else if (E.outil === "etiquette") creerEtiquetteA(p);
        else if (E.outil === "lieu") creerLieuA(p);
        break;
      case "deplace":
        if (g.bouge) {
          enregistrer({ t: "modif", coll: g.coll, id: g.obj.id, avant: JSON.parse(g.avant), apres: cloner(g.obj) });
          marquer();
          panneauSelection();
        }
        break;
      case "sommet":
        if (g.bouge) {
          g.obj.bb && (g.obj.bb = Moteur.boiteTrait(g.obj.pts, g.obj.taille));
          enregistrer({ t: "modif", coll: g.coll || "lignes", id: g.obj.id, avant: JSON.parse(g.avant), apres: cloner(g.obj) });
          marquer();
        }
        break;
    }
    rendre();
  }

  function surAnnulation(ev) {
    delete ptrs[ev.pointerId];
    pinch = null;
    geste = null;
    scene.classList.remove("saisit");
    surcouche();
  }

  function demarrerPinch() {
    geste = null;
    var ids = Object.keys(ptrs);
    var a = ptrs[ids[0]], b = ptrs[ids[1]];
    pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2
    };
  }
  function majPinch() {
    var ids = Object.keys(ptrs);
    var a = ptrs[ids[0]], b = ptrs[ids[1]];
    var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    E.vue.cx -= (cx - pinch.cx) / E.vue.zoom;
    E.vue.cy -= (cy - pinch.cy) / E.vue.zoom;
    zoomerVers(cx, cy, d / pinch.dist);
    pinch.dist = d; pinch.cx = cx; pinch.cy = cy;
  }

  scene.addEventListener("pointerdown", surBas);
  scene.addEventListener("pointermove", surDeplacement);
  scene.addEventListener("pointerup", surHaut);
  scene.addEventListener("pointercancel", surAnnulation);
  scene.addEventListener("pointerleave", function () { E.curseur = null; surcouche(); });
  scene.addEventListener("contextmenu", function (ev) {
    ev.preventDefault();
    if (ev.target.closest && ev.target.closest("#menuContexte")) return;
    if (E.ligneEnCours) {
      // Pendant un tracé, le clic droit retire le dernier point.
      E.ligneEnCours.pts.length -= 2;
      if (!E.ligneEnCours.pts.length) E.ligneEnCours = null;
      surcouche();
      return;
    }
    var p = posEvt(ev);
    var hit = trouver(p.x, p.y);
    if (hit) {
      choisirOutil("selection");
      selectionner(hit.coll, hit.obj);
      ouvrirMenu(p, hit.coll, hit.obj);
    } else fermerMenu();
  });

  // ----- Menu du clic droit sur un objet -----
  var TYPES_VILLE = { capitale: 1, ville: 1, village: 1, port: 1, fort: 1 };
  var NOMS_COLL = { lieux: "Lieu", etiquettes: "Nom", lignes: "Tracé", lacs: "Lac", tampons: "Décor" };

  function fermerMenu() { $("menuContexte").hidden = true; }

  function ouvrirMenu(p, coll, obj) {
    var m = $("menuContexte");
    m.innerHTML = "";
    var titre = NOMS_COLL[coll], actions = [];
    if (coll === "lieux") {
      var estVille = !!TYPES_VILLE[obj.type];
      titre = obj.nom || (Moteur.TYPES_LIEUX[obj.type] || {}).nom || titre;
      actions.push(["Renommer", function () {
        var s = versEcran(obj.x, obj.y);
        demanderTexte(s[0], s[1], obj.nom, function (t) { editer(function (o) { o.nom = t; }); panneauSelection(); majIndex(); }, true);
      }]);
      actions.push([obj.carteId ? (estVille ? "Ouvrir la carte de la ville" : "Ouvrir la carte du lieu") : (estVille ? "Éditer la ville…" : "Éditer le lieu…"),
        function () { ouvrirCarteDuLieu(obj); }]);
    } else if (coll === "etiquettes") {
      titre = obj.texte || titre;
      actions.push(["Modifier le texte", function () {
        var s = versEcran(obj.x, obj.y);
        demanderTexte(s[0], s[1], obj.texte, function (t) { editer(function (o) { o.texte = t; }); panneauSelection(); });
      }]);
    } else if (coll === "lignes") titre = (Moteur.TYPES_LIGNES[obj.type] || {}).nom || titre;
    else if (coll === "tampons") {
      Moteur.TAMPONS.forEach(function (t) { if (t.id === obj.type) titre = t.nom; });
      actions.push(["Autre forme", function () { editer(function (o) { o.v = (o.v || 0) + 1; }); }]);
    }
    actions.push(["Dupliquer", function () { dupliquer(coll, obj); }]);
    actions.push(["Supprimer", function () { supprimerObjet(coll, obj); }, true]);
    m.appendChild(el("div", { classe: "titre-menu", texte: titre }));
    actions.forEach(function (it) {
      var b = el("button", { type: "button", role: "menuitem", classe: it[2] ? "danger" : "", texte: it[0] });
      b.addEventListener("click", function () { fermerMenu(); it[1](); });
      m.appendChild(b);
    });
    m.hidden = false;
    m.style.left = borne(p.x, 4, Math.max(4, W - m.offsetWidth - 4)) + "px";
    m.style.top = borne(p.y, 4, Math.max(4, H - m.offsetHeight - 4)) + "px";
  }

  // Un clic ailleurs, la molette ou un déplacement referment le menu.
  document.addEventListener("pointerdown", function (ev) {
    if (!ev.target.closest || !ev.target.closest("#menuContexte")) fermerMenu();
  }, true);
  scene.addEventListener("wheel", fermerMenu, { passive: true });

  // « Éditer la ville » : chaque lieu peut avoir sa propre carte, plus détaillée. Créée
  // à la première demande (une plaine à l'échelle du lieu, même style que la carte
  // mère), puis rouverte ensuite. La carte fille garde un lien vers sa mère.
  var TAILLES_LIEUX = {              // largeur × hauteur de la carte du lieu, en km
    capitale: [4, 2.8], ville: [2.4, 1.7], village: [0.9, 0.63], port: [2.2, 1.55],
    fort: [1.2, 0.85], donjon: [1, 0.7], temple: [0.8, 0.56], ruine: [0.8, 0.56],
    tour: [0.4, 0.28], mine: [0.8, 0.56], navire: [0.3, 0.21]
  };

  function carteDuLieu(mere, lieu) {
    var t = TAILLES_LIEUX[lieu.type] || [2, 1.4];
    var enfant = {
      id: Stockage.nouvelId(),
      nom: lieu.nom || Moteur.TYPES_LIEUX[lieu.type].nom,
      largeur: t[0], hauteur: t[1],
      theme: mere.theme,
      traits: [], lignes: [], etiquettes: [], lieux: [], lacs: [], tampons: [],
      vue: null,
      parent: { carteId: mere.id, lieuId: lieu.id, nom: mere.nom },
      creeLe: Date.now(), majLe: Date.now(), version: 1
    };
    // De la terre partout : un seul trait, assez épais pour couvrir toute la carte. Elle
    // se couvre d'herbe à la bonne échelle, comme n'importe quel terrain.
    var fond = Moteur.nouveauTrait("plaine", t[1] * 1.3, [0, t[1] / 2, t[0], t[1] / 2], false);
    enfant.traits.push(fond);
    enfant.vignette = Moteur.vignette(enfant);
    return enfant;
  }

  function ouvrirCarteDuLieu(lieu) {
    cloreEdition();
    function creer() {
      var enfant = carteDuLieu(E.carte, lieu);
      lieu.carteId = enfant.id;
      marquer();
      Stockage.ecrire(enfant).then(function () { allerVers("editeur.html?id=" + encodeURIComponent(enfant.id)); })
        .catch(function (e) { etat("Création impossible : " + (e && e.message ? e.message : "erreur")); });
    }
    if (!lieu.carteId) { creer(); return; }
    Stockage.lire(lieu.carteId).then(function (c) {
      if (c) allerVers("editeur.html?id=" + encodeURIComponent(lieu.carteId));
      else creer();                  // la carte du lieu a été supprimée : on en recrée une
    }).catch(creer);
  }

  // Enregistre la carte courante, puis change de page.
  function allerVers(url) {
    sauvegarder().then(function () { E.modifie = false; location.href = url; });
  }
  scene.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var p = posEvt(ev);
    var dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
    zoomerVers(p.x, p.y, Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0018)));
  }, { passive: false });

  scene.addEventListener("dblclick", function (ev) {
    var p = posEvt(ev);
    if (E.outil === "ligne" && E.ligneEnCours) { terminerLigne(); return; }
    if (E.outil !== "selection") return;
    var sel = E.selection;
    if (sel && (sel.coll === "lignes" || sel.coll === "lacs")) {
      // Double-clic sur un tracé (ou un lac) sélectionné : un sommet de plus à cet endroit.
      var w = versMonde(p.x, p.y), pts = sel.obj.pts, seuil = 9 / E.vue.zoom;
      var nSeg = sel.coll === "lacs" ? pts.length / 2 : pts.length / 2 - 1;
      for (var j = 0; j < nSeg; j++) {
        var j2 = ((j + 1) % (pts.length / 2)) * 2;
        var r = distanceSegment(w[0], w[1], pts[2 * j], pts[2 * j + 1], pts[j2], pts[j2 + 1]);
        if (r.d <= seuil) { editer(function (o) { o.pts.splice(2 * j + 2, 0, r.x, r.y); }); surcouche(); return; }
      }
    }
    if (sel && (sel.coll === "lieux" || sel.coll === "etiquettes")) {
      var hit = trouver(p.x, p.y);
      if (hit && hit.obj === sel.obj) {
        var champ = sel.coll === "lieux" ? "nom" : "texte";
        demanderTexte(p.x, p.y, sel.obj[champ], function (t) { editer(function (o) { o[champ] = t; }); panneauSelection(); });
      }
    }
  });

  // ----- Création d'objets -----
  function creerEtiquetteA(p) {
    var w = versMonde(p.x, p.y);
    var defaut = { pays: "Nouveau pays", region: "Région", mer: "Mer", libre: "Texte" }[E.styleEtiq] || "Texte";
    demanderTexte(p.x, p.y, defaut, function (texte) {
      var e = { id: nouvelId("e"), texte: texte, x: w[0], y: w[1], taille: E.taillePxEtiq / E.vue.zoom, angle: 0, style: E.styleEtiq };
      ajouter("etiquettes", e);
      choisirOutil("selection");     // l'élément est posé : on rend la main
      selectionner("etiquettes", e);
    });
  }

  function creerLieuA(p) {
    var w = versMonde(p.x, p.y);
    var type = E.typeLieu, tp = Moteur.TYPES_LIEUX[type];
    var poser = function (nom, image) {
      var l = { id: nouvelId("p"), type: type, nom: nom, x: w[0], y: w[1] };
      if (image) l.image = image;
      // Posé en zoomant : on ne veut le voir qu'à ce niveau et au-delà.
      var niv = niveauActuel();
      if (niv > 1 && (niv > tp.niv * 1.5 || niv < tp.niv)) l.niv = Math.round(niv * 0.6 * 10) / 10;
      else if (niv < tp.niv) l.niv = 0;          // posé de loin : il doit se voir de loin
      ajouter("lieux", l);
      choisirOutil("selection");     // le lieu est posé : on rend la main (sinon le fantôme reste collé au curseur)
      selectionner("lieux", l);
    };
    if (type === "image") { choisirImage(function (cle) { poser("", cle); }); return; }
    demanderTexte(p.x, p.y, tp.repere ? "" : tp.nom, function (nom) { poser(nom); }, tp.repere);
  }

  // ----- Panneau : outil -----
  var OUTILS_INFO = {
    selection: "Sélection",
    main: "Main",
    pinceau: "Terrains",
    gomme: "Gomme",
    tampon: "Décors",
    ligne: "Tracés",
    lac: "Lacs",
    etiquette: "Noms",
    lieu: "Lieux"
  };

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "texte") n.textContent = attrs[k];
      else if (k === "classe") n.className = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function champCurseur(libelle, min, max, pas, valeur, format, surChange, id) {
    var valeurEl = el("span", { classe: "valeur", texte: format(valeur) });
    var champ = el("input", { type: "range", min: min, max: max, step: pas, value: valeur });
    if (id) champ.id = id;
    champ.addEventListener("input", function () {
      var v = parseFloat(champ.value);
      valeurEl.textContent = format(v);
      surChange(v);
    });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }, [valeurEl]), champ]);
  }

  function champTexte(libelle, valeur, surChange, indice) {
    var champ = el("input", { type: "text", value: valeur || "", maxlength: "80" });
    if (indice) champ.placeholder = indice;
    champ.addEventListener("input", function () { surChange(champ.value); });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }), champ]);
  }

  function champNotes(libelle, valeur, surChange) {
    var champ = el("textarea", { rows: "3", maxlength: "2000" });
    champ.value = valeur || "";
    champ.addEventListener("input", function () { surChange(champ.value); });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }), champ]);
  }

  function champChoix(libelle, options, valeur, surChange) {
    var s = el("select");
    options.forEach(function (o) {
      var op = el("option", { value: o[0], texte: o[1] });
      if (String(o[0]) === String(valeur)) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener("change", function () { surChange(s.value); });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }), s]);
  }

  // Quelques choix côte à côte, comme des touches : plus rapide qu'une liste déroulante.
  function champSegments(libelle, options, valeur, surChange) {
    var barre = el("div", { classe: "segments", role: "group" });
    options.forEach(function (o) {
      var b = el("button", { type: "button", texte: o[1], "aria-pressed": String(o[0] === valeur) });
      b.addEventListener("click", function () {
        barre.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        surChange(o[0]);
      });
      barre.appendChild(b);
    });
    return el("div", { classe: "champ-p" }, [el("span", { texte: libelle }), barre]);
  }

  function champCase(libelle, valeur, surChange) {
    var c = el("input", { type: "checkbox" });
    c.checked = !!valeur;
    c.addEventListener("change", function () { surChange(c.checked); });
    return el("div", { classe: "champ-p" }, [el("label", { classe: "case" }, [c, el("span", { texte: libelle })])]);
  }

  // `surRetour` : affiche un bouton « Par défaut » qui retire la couleur personnalisée.
  function champCouleur(libelle, valeur, surChange, surRetour) {
    var c = el("input", { type: "color", value: valeur });
    c.addEventListener("input", function () { surChange(c.value); });
    var ligne = el("div", { classe: "ligne-couleur" }, [c]);
    if (surRetour) ligne.appendChild(el("button", { type: "button", classe: "btn", texte: "Par défaut", onclick: surRetour }));
    return el("div", { classe: "champ-p" }, [el("span", { texte: libelle }), ligne]);
  }

  function sousTitre(texte) { return el("h3", { classe: "sous-titre", texte: texte }); }

  function majLibelleFinesse() {
    var out = $("libFinesse");
    if (!out) return;
    var fin = finesseActuelle();
    out.textContent = (E.finesse === "auto" ? "Auto : à ce zoom, ×" + Math.pow(2, fin) + ". " : "") +
      (fin === 0 ? "Décors à l'échelle de la carte entière." : "Décors " + Math.pow(2, fin) + " fois plus petits : pour détailler une région vue de près.");
  }

  function majLibelleTaille() {
    var out = $("libTaillePinceau");
    if (out) out.textContent = "≈ " + formatKm((E.outil === "tampon" ? E.taillePxTampon : E.taillePx) / E.vue.zoom) + " dans le monde, à ce zoom";
  }

  // La pastille d'un terrain : sa couleur, et un échantillon de son décor.
  function pastilleTerrain(m) {
    var cv = el("canvas", { width: "68", height: "68", classe: "pastille-mat" });
    var c = cv.getContext("2d");
    c.scale(2, 2);
    if (m.type === "eau") {
      var g = c.createLinearGradient(0, 0, 34, 34);
      g.addColorStop(0, "#5a9cc0"); g.addColorStop(1, "#356f93");
      c.fillStyle = g; c.fillRect(0, 0, 34, 34);
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1.2;
      [11, 19, 27].forEach(function (y) { c.beginPath(); c.moveTo(5, y); c.quadraticCurveTo(11, y - 4, 17, y); c.quadraticCurveTo(23, y + 4, 29, y); c.stroke(); });
      return cv;
    }
    c.fillStyle = m.couleur; c.fillRect(0, 0, 34, 34);
    var d = Moteur.DECORS[m.decor];
    if (d) {
      var ch = d.apercu ? [d.apercu, 1, 40] : d.choix[0], grand = ch[2] > 22;
      if (grand) Moteur.apercuDecor(c, ch[0], 1, 17, 17, 30);
      else { Moteur.apercuDecor(c, ch[0], 0, 10, 12, 17); Moteur.apercuDecor(c, ch[0], 1, 24, 15, 17); Moteur.apercuDecor(c, ch[0], 2, 15, 25, 17); }
    }
    return cv;
  }

  function panneauOutil() {
    var zone = $("optionsOutil");
    zone.innerHTML = "";
    $("titreOutil").textContent = OUTILS_INFO[E.outil];
    document.querySelectorAll(".outil").forEach(function (b) { b.classList.toggle("actif", b.dataset.outil === E.outil); });
    scene.className = "scene " + (E.outil === "main" ? "main" : E.outil === "selection" ? "selection" : "");

    if (E.outil === "pinceau") {
      Moteur.GROUPES_MATERIAUX.forEach(function (groupe) {
        zone.appendChild(sousTitre(groupe));
        var pal = el("div", { classe: "palette" });
        Moteur.MATERIAUX.forEach(function (m) {
          if (m.groupe !== groupe) return;
          var b = el("button", { type: "button", classe: "mat" + (m.id === E.materiau ? " actif" : ""), title: m.nom }, [pastilleTerrain(m), el("span", { texte: m.nom })]);
          b.addEventListener("click", function () { E.materiau = m.id; panneauOutil(); });
          pal.appendChild(b);
        });
        zone.appendChild(pal);
      });
    }
    if (E.outil === "pinceau") {
      // « Affiner » : repasser sur un terrain déjà peint pour en changer la finesse des
      // décors, sans toucher au terrain lui-même.
      zone.appendChild(sousTitre("Détail"));
      var palA = el("div", { classe: "palette" });
      var bA = el("button", { type: "button", classe: "mat" + (E.materiau === "@affiner" ? " actif" : ""), title: "Change la taille des décors d'une zone sans repeindre le terrain" },
        [el("span", { classe: "plus-image", style: "width:34px;height:34px;font-size:19px", texte: "⁂" }), el("span", { texte: "Affiner les décors" })]);
      bA.addEventListener("click", function () { E.materiau = "@affiner"; panneauOutil(); });
      palA.appendChild(bA);
      var bE = el("button", { type: "button", classe: "mat" + (E.materiau === "@eclaircir" ? " actif" : ""), title: "Retire les arbres, pics ou rochers d'une zone sans repeindre le terrain" },
        [el("span", { classe: "plus-image", style: "width:34px;height:34px;font-size:19px", texte: "∅" }), el("span", { texte: "Gomme à décors" })]);
      bE.addEventListener("click", function () { E.materiau = "@eclaircir"; panneauOutil(); });
      palA.appendChild(bE);
      if (E.carte.finesses.length) {
        var bR = el("button", { type: "button", classe: "mat", title: "Retire toutes les zones affinées ou éclaircies : les décors reprennent les réglages de leur terrain" }, [el("span", { texte: "Retirer ces zones (" + E.carte.finesses.length + ")" })]);
        bR.addEventListener("click", function () {
          executer({ t: "lot", actions: E.carte.finesses.map(function (o, i) { return { t: "suppr", coll: "finesses", obj: o, idx: i }; }).reverse() });
          panneauOutil();
        });
        palA.appendChild(bR);
      }
      zone.appendChild(palA);
    }
    if (E.outil === "pinceau" || E.outil === "gomme") {
      zone.appendChild(sousTitre("Pinceau"));
      zone.appendChild(champCurseur("Taille", 3, 240, 1, E.taillePx, function (v) { return Math.round(v) + " px"; },
        function (v) { E.taillePx = v; majLibelleTaille(); surcouche(); }));
      zone.appendChild(el("p", { classe: "aide", id: "libTaillePinceau" }));
      if (!(E.outil === "pinceau" && E.materiau.charAt(0) === "@")) zone.appendChild(champCurseur("Bord", 0, 1, 0.05, E.rugosite, function (v) { return v === 0 ? "lisse" : v < 0.5 ? "irrégulier" : "découpé"; },
        function (v) { E.rugosite = v; }));
      if (E.outil === "pinceau" && E.materiau === "@affiner") {
        zone.appendChild(champSegments("Finesse (échelle des décors)", [["auto", "Auto"], [0, "×1"], [1, "×2"], [2, "×4"], [3, "×8"], [4, "×16"]], E.finesse, function (v) { E.finesse = v; majLibelleFinesse(); }));
        zone.appendChild(el("p", { classe: "aide", id: "libFinesse" }));
        zone.appendChild(el("p", { classe: "aide", texte: "Passez sur une région déjà peinte : ses arbres, ses pics et ses collines prennent cette finesse, le terrain ne change pas. En Auto, zoomez d'abord sur la région : les décors seront à la bonne taille pour ce zoom." }));
        majLibelleFinesse();
        majLibelleTaille();
        return;
      }
      if (E.outil === "pinceau" && E.materiau === "@eclaircir") {
        zone.appendChild(champSegments("Ce qu'il reste", [[0, "Rien"], [1, "Quelques décors"]], E.eclaircir, function (v) { E.eclaircir = v; }));
        zone.appendChild(el("p", { classe: "aide", texte: "Passez sur une région : ses arbres, ses pics ou ses rochers disparaissent (ou se raréfient), le terrain ne change pas. Pour ouvrir une clairière, dégager un col, faire de la place à une ville." }));
        majLibelleTaille();
        return;
      }
      if (E.outil === "pinceau" && Moteur.MAT[E.materiau].decor) {
        zone.appendChild(champSegments("Décors du terrain", [[0, "Aucun"], [1, "Rares"], [2, "Normal"], [3, "Dense"]], E.densite, function (v) { E.densite = v; }));
        zone.appendChild(champSegments("Taille des décors", [[0, "Petits"], [1, "Normaux"], [2, "Grands"]], E.echDecor, function (v) { E.echDecor = v; }));
        zone.appendChild(champSegments("Finesse (échelle des décors)", [["auto", "Auto"], [0, "×1"], [1, "×2"], [2, "×4"], [3, "×8"], [4, "×16"]], E.finesse, function (v) { E.finesse = v; majLibelleFinesse(); }));
        zone.appendChild(el("p", { classe: "aide", id: "libFinesse" }));
      }
      zone.appendChild(el("p", { classe: "aide", texte: E.outil === "gomme"
        ? "Efface la terre : la mer réapparaît. Un bord découpé donne des anses et des caps. Zoomez pour ciseler la côte."
        : "Le terrain se couvre de ses décors (arbres, pics, dunes…), fixés une fois pour toutes : zoomer ou dézoomer n'en ajoute ni n'en retire aucun, comme sur une carte imprimée. Pour en changer la quantité, repassez avec une autre densité (ou « Aucun »)." }));
      majLibelleTaille();
      majLibelleFinesse();
    }

    if (E.outil === "tampon") {
      var palT = el("div", { classe: "palette palette-3" });
      Moteur.TAMPONS.forEach(function (t) {
        var cv = el("canvas", { width: "88", height: "88" });
        cv.style.width = cv.style.height = "44px";
        var c2 = cv.getContext("2d");
        c2.scale(2, 2);
        Moteur.apercuDecor(c2, t.id, 0, 22, 22, 42);
        var b = el("button", { type: "button", classe: "mat mat-haut" + (t.id === E.tampon ? " actif" : ""), title: t.nom }, [cv, el("span", { texte: t.nom })]);
        b.addEventListener("click", function () { E.tampon = t.id; panneauOutil(); });
        palT.appendChild(b);
      });
      zone.appendChild(palT);
      zone.appendChild(champCurseur("Taille", 12, 260, 1, E.taillePxTampon, function (v) { return Math.round(v) + " px"; },
        function (v) { E.taillePxTampon = v; majLibelleTaille(); surcouche(); }));
      zone.appendChild(el("p", { classe: "aide", id: "libTaillePinceau" }));
      zone.appendChild(champCurseur("Variation de taille", 0, 1, 0.05, E.variation, function (v) { return Math.round(v * 100) + " %"; }, function (v) { E.variation = v; }));
      zone.appendChild(el("p", { classe: "aide", texte: "Cliquez pour poser un décor, glissez pour en semer plusieurs. Un décor posé appartient au monde : sa taille est celle de l'écran au moment où vous le posez, puis il grandit et rétrécit avec le zoom. Les décors du terrain lui laissent la place." }));
      majLibelleTaille();
    }

    if (E.outil === "ligne") {
      var types = Object.keys(Moteur.TYPES_LIGNES).map(function (k) { return [k, Moteur.TYPES_LIGNES[k].nom]; });
      zone.appendChild(champChoix("Type de tracé", types, E.typeLigne, function (v) {
        E.typeLigne = v;
        E.epaisseurPx = Moteur.TYPES_LIGNES[v].px;
        panneauOutil();
      }));
      if (E.typeLigne === "frontiere") {
        zone.appendChild(champCouleur("Couleur de la frontière", E.couleurFrontiere, function (v) { E.couleurFrontiere = v; }));
        zone.appendChild(champCase("Territoire : refermer et colorer l'intérieur", E.fermer, function (v) { E.fermer = v; }));
      }
      zone.appendChild(champCurseur("Épaisseur", 1, 14, 0.2, E.epaisseurPx, function (v) { return nb(v, 1) + " px"; }, function (v) { E.epaisseurPx = v; }));
      if (E.typeLigne === "riviere") {
        zone.appendChild(champCurseur("Méandres", 0, 1, 0.05, E.meandre, function (v) { return v === 0 ? "droite" : Math.round(v * 100) + " %"; }, function (v) { E.meandre = v; }));
        zone.appendChild(champCase("S'élargit vers l'embouchure", E.delta, function (v) { E.delta = v; }));
      }
      var aides = {
        falaise: "Les hachures descendent à droite du sens du tracé : dessinez dans l'autre sens pour retourner la pente (ou « Inverser » une fois le tracé sélectionné).",
        pavee: "Une route de pierre : elle rejoint les autres voies et reçoit un pont au-dessus de l'eau.",
        maritime: "Un pointillé pour les routes des navires."
      };
      if (aides[E.typeLigne]) zone.appendChild(el("p", { classe: "aide", texte: aides[E.typeLigne] }));
      zone.appendChild(el("p", { classe: "aide", texte: "Cliquez pour poser les points, ou glissez pour tracer à main levée. Double-clic ou Entrée pour terminer, clic droit pour retirer le dernier point, Échap pour annuler." }));
    }

    if (E.outil === "etiquette") {
      var styles = Object.keys(Moteur.STYLES_ETIQ).map(function (k) { return [k, Moteur.STYLES_ETIQ[k].nom]; });
      zone.appendChild(champChoix("Style", styles, E.styleEtiq, function (v) { E.styleEtiq = v; }));
      zone.appendChild(champCurseur("Taille du texte", 12, 160, 1, E.taillePxEtiq, function (v) { return Math.round(v) + " px"; }, function (v) { E.taillePxEtiq = v; }));
      zone.appendChild(el("p", { classe: "aide", texte: "Cliquez sur la carte, tapez le nom, Entrée. La taille est celle de l'écran au moment où vous cliquez : le texte grandit et rétrécit avec le zoom. Une fois posé, il peut être incliné, courbé, espacé." }));
    }

    if (E.outil === "lieu") {
      var thp = themeActuel();
      Moteur.CATEGORIES_LIEUX.forEach(function (cat) {
        zone.appendChild(sousTitre(cat));
        var pal2 = el("div", { classe: "palette palette-3" });
        Object.keys(Moteur.TYPES_LIEUX).forEach(function (k) {
          var tp = Moteur.TYPES_LIEUX[k];
          if (tp.cat !== cat || tp.cache) return;
          var cv = el("canvas", { width: "88", height: "88" });
          cv.style.width = cv.style.height = "44px";
          var c2 = cv.getContext("2d");
          c2.scale(2, 2);
          var t0 = Moteur.tailleIcone({ type: k }, thp);
          Moteur.iconeAuto(c2, k, 22, 22, Math.min(40, Math.max(14, t0 * 0.7)), thp);
          var b = el("button", { type: "button", classe: "mat mat-haut" + (k === E.typeLieu ? " actif" : ""), title: tp.nom }, [cv, el("span", { texte: tp.nom })]);
          b.addEventListener("click", function () { E.typeLieu = k; panneauOutil(); });
          pal2.appendChild(b);
        });
        if (cat === "Repères") {
          var bi = el("button", { type: "button", classe: "mat mat-haut" + (E.typeLieu === "image" ? " actif" : ""), title: "Votre propre image : blason, dessin, pictogramme" },
            [el("span", { classe: "plus-image", texte: "+" }), el("span", { texte: "Image…" })]);
          bi.addEventListener("click", function () { E.typeLieu = "image"; panneauOutil(); });
          pal2.appendChild(bi);
        }
        zone.appendChild(pal2);
      });
      zone.appendChild(el("p", { classe: "aide", texte: E.typeLieu === "image"
        ? "Cliquez sur la carte, puis choisissez un fichier image (PNG, JPEG, SVG…). Elle est enregistrée avec la carte."
        : "Cliquez sur la carte pour poser le lieu. Les capitales se voient de loin, les cabanes seulement en zoomant : chaque lieu a son niveau d'apparition, réglable une fois posé, comme son nom, sa taille et ses couleurs." }));
    }

    if (E.outil === "lac") zone.appendChild(el("p", { classe: "aide", texte: "Dessinez le contour du lac à main levée, en maintenant le bouton : il se referme tout seul au relâchement. On peut ensuite le déplacer, le remodeler, l'agrandir. Les rivières et les routes qui le traversent s'y raccordent." }));
    if (E.outil === "main") zone.appendChild(el("p", { classe: "aide", texte: "Faites glisser pour déplacer la carte. La molette zoome, Espace + glisser déplace avec n'importe quel outil." }));
    if (E.outil === "selection") zone.appendChild(el("p", { classe: "aide", texte: "Cliquez un lieu, un nom, un décor ou un tracé pour le régler, le déplacer ou le supprimer. Double-clic pour renommer ; sur un tracé, double-clic ajoute un point. Clic droit : dupliquer, supprimer. Ctrl+D duplique." }));
  }

  // ----- Panneau : sélection -----
  function panneauSelection() {
    var bloc = $("blocSelection"), zone = $("optionsSelection");
    var sel = E.selection;
    zone.innerHTML = "";
    bloc.hidden = !sel;
    if (!sel) return;
    var o = sel.obj;
    var th = themeActuel();
    $("titreSelection").textContent = NOMS_COLL[sel.coll] || "Sélection";

    if (sel.coll === "lieux") {
      var tp = Moteur.TYPES_LIEUX[o.type] || Moteur.TYPES_LIEUX.ville;
      zone.appendChild(champTexte("Nom", o.nom, function (v) { editer(function (x) { x.nom = v; }); majIndex(); }));
      zone.appendChild(champTexte("Sous-titre", o.sousTitre, function (v) { editer(function (x) { if (v) x.sousTitre = v; else delete x.sousTitre; }); }, "Cité des marchands, an 312…"));
      if (o.type === "image") {
        zone.appendChild(el("div", { classe: "rangee" }, [
          el("button", { type: "button", classe: "btn", texte: "Changer l'image…", onclick: function () { choisirImage(function (cle) { editer(function (x) { x.image = cle; }); }); } })
        ]));
      } else {
        var groupes = Moteur.CATEGORIES_LIEUX.map(function (cat) {
          return [cat, Object.keys(Moteur.TYPES_LIEUX).filter(function (k) { return Moteur.TYPES_LIEUX[k].cat === cat && !Moteur.TYPES_LIEUX[k].cache; })];
        });
        var selType = el("select");
        groupes.forEach(function (g) {
          var og = el("optgroup", { label: g[0] });
          g[1].forEach(function (k) { var op = el("option", { value: k, texte: Moteur.TYPES_LIEUX[k].nom }); if (k === o.type) op.selected = true; og.appendChild(op); });
          selType.appendChild(og);
        });
        selType.addEventListener("change", function () { editer(function (x) { x.type = selType.value; delete x.niv; }); panneauSelection(); majIndex(); });
        zone.appendChild(el("label", { classe: "champ-p" }, [el("span", { texte: "Type" }), selType]));
      }

      zone.appendChild(sousTitre("Apparence"));
      zone.appendChild(champCurseur("Taille", 0.4, 3, 0.05, o.ech || 1, function (v) { return "×" + nb(v, 2); },
        function (v) { editer(function (x) { x.ech = v; }); }));
      if (o.type !== "image") {
        zone.appendChild(champCouleur(tp.repere ? "Couleur" : "Couleur (toits, bannière)", o.couleur || (tp.repere ? "#b5362a" : "#a8452f"),
          function (v) { editer(function (x) { x.couleur = v; }); },
          o.couleur ? function () { editer(function (x) { delete x.couleur; }); panneauSelection(); } : null));
      }
      zone.appendChild(champCase("Retourner (miroir)", o.miroir, function (v) { editer(function (x) { if (v) x.miroir = true; else delete x.miroir; }); }));

      zone.appendChild(sousTitre("Nom sur la carte"));
      zone.appendChild(champCase("Afficher le nom", !o.sansNom, function (v) { editer(function (x) { if (v) delete x.sansNom; else x.sansNom = true; }); }));
      zone.appendChild(champSegments("Position", [["", "Auto"], ["bas", "Bas"], ["haut", "Haut"], ["gauche", "Gauche"], ["droite", "Droite"]], o.posNom || "",
        function (v) { editer(function (x) { if (v) x.posNom = v; else delete x.posNom; }); }));
      zone.appendChild(champSegments("Style", [["", "Normal"], ["italique", "Italique"], ["maj", "Capitales"]], o.styleNom || (tp.maj ? "maj" : ""),
        function (v) { editer(function (x) { x.styleNom = v; }); }));
      zone.appendChild(champCurseur("Taille du nom", 0.5, 2.5, 0.05, o.tailleNom || 1, function (v) { return "×" + nb(v, 2); },
        function (v) { editer(function (x) { x.tailleNom = v; }); }));
      zone.appendChild(champCouleur("Couleur du nom", o.couleurNom || th.encre, function (v) { editer(function (x) { x.couleurNom = v; }); },
        o.couleurNom ? function () { editer(function (x) { delete x.couleurNom; }); panneauSelection(); } : null));

      zone.appendChild(sousTitre("Visibilité"));
      var niv = typeof o.niv === "number" ? o.niv : tp.niv;
      zone.appendChild(champCurseur("Visible à partir du zoom", 0, 15, 0.1, Math.min(niv, 15), function (v) { return v === 0 ? "toujours" : "×" + nb(v, 1); },
        function (v) { editer(function (x) { x.niv = v; }); }));
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", texte: "Dès ce zoom (×" + nb(niveauActuel(), 1) + ")", onclick: function () { editer(function (x) { x.niv = Math.round(niveauActuel() * 0.9 * 10) / 10; }); panneauSelection(); } }),
        el("button", { type: "button", classe: "btn", texte: "Toujours", onclick: function () { editer(function (x) { x.niv = 0; }); panneauSelection(); } })
      ]));
      zone.appendChild(el("p", { classe: "aide", texte: "En dessous du niveau choisi, le lieu disparaît. Si deux noms se gênent, le moins important attend que l'on zoome." }));

      zone.appendChild(sousTitre("Notes"));
      zone.appendChild(champNotes("Pour vous (jamais sur la carte)", o.notes, function (v) { editer(function (x) { if (v) x.notes = v; else delete x.notes; }); }));
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", onclick: function () { ouvrirCarteDuLieu(o); },
          texte: o.carteId ? "Ouvrir sa carte" : (TYPES_VILLE[o.type] ? "Éditer la ville…" : "Éditer le lieu…") })
      ]));
    } else if (sel.coll === "etiquettes") {
      zone.appendChild(champTexte("Texte", o.texte, function (v) { editer(function (x) { x.texte = v; }); }));
      zone.appendChild(champChoix("Style", Object.keys(Moteur.STYLES_ETIQ).map(function (k) { return [k, Moteur.STYLES_ETIQ[k].nom]; }), o.style,
        function (v) { editer(function (x) { x.style = v; delete x.espace; }); panneauSelection(); }));
      zone.appendChild(champCurseur("Taille", 6, 400, 1, borne(o.taille * E.vue.zoom, 6, 400), function (v) { return Math.round(v) + " px"; },
        function (v) { editer(function (x) { x.taille = v / E.vue.zoom; }); }));
      zone.appendChild(champCurseur("Orientation", -180, 180, 1, o.angle || 0, function (v) { return Math.round(v) + "°"; },
        function (v) { editer(function (x) { x.angle = v; }); }));
      zone.appendChild(champCurseur("Courbure", -100, 100, 1, o.courbe || 0, function (v) { return v === 0 ? "droit" : (v > 0 ? "⌢ " : "⌣ ") + Math.abs(Math.round(v)) + " %"; },
        function (v) { editer(function (x) { if (v) x.courbe = v; else delete x.courbe; }); }));
      var stE = Moteur.STYLES_ETIQ[o.style] || Moteur.STYLES_ETIQ.libre;
      zone.appendChild(champCurseur("Espacement des lettres", 0, 1.5, 0.02, typeof o.espace === "number" ? o.espace : stE.espace, function (v) { return Math.round(v * 100) + " %"; },
        function (v) { editer(function (x) { x.espace = v; }); }));
      zone.appendChild(champCurseur("Opacité", 0.15, 1, 0.05, o.opacite == null ? 1 : o.opacite, function (v) { return Math.round(v * 100) + " %"; },
        function (v) { editer(function (x) { if (v < 1) x.opacite = v; else delete x.opacite; }); }));
      zone.appendChild(champCouleur("Couleur", o.couleur || (stE.mer ? th.texteMer : th.encre), function (v) { editer(function (x) { x.couleur = v; }); },
        o.couleur ? function () { editer(function (x) { delete x.couleur; }); panneauSelection(); } : null));
    } else if (sel.coll === "lignes") {
      zone.appendChild(champChoix("Type", Object.keys(Moteur.TYPES_LIGNES).map(function (k) { return [k, Moteur.TYPES_LIGNES[k].nom]; }), o.type,
        function (v) { editer(function (x) { x.type = v; }); panneauSelection(); }));
      zone.appendChild(champCouleur("Couleur", Moteur.styleLigne(o, th).c, function (v) { editer(function (x) { x.couleur = v; }); },
        o.couleur ? function () { editer(function (x) { delete x.couleur; }); panneauSelection(); } : null));
      zone.appendChild(champCurseur("Épaisseur", 0.3, 14, 0.1, Math.max(0.3, Math.min(14, o.taille * E.vue.zoom)), function (v) { return nb(v, 1) + " px"; },
        function (v) { editer(function (x) { x.taille = v / E.vue.zoom; }); }));
      if (o.type === "riviere") {
        zone.appendChild(champCurseur("Méandres", 0, 1, 0.05, o.meandre || 0, function (v) { return v === 0 ? "droite" : Math.round(v * 100) + " %"; },
          function (v) { editer(function (x) { x.meandre = v; }); }));
        zone.appendChild(champCase("S'élargit vers l'embouchure", o.delta, function (v) { editer(function (x) { x.delta = v; }); }));
      }
      if (Moteur.VOIES[o.type]) {
        var defaut = { route: 0.16, pavee: 0.06, sentier: 0.26 }[o.type];
        zone.appendChild(champCurseur("Sinuosité", 0, 1, 0.02, typeof o.meandre === "number" ? o.meandre : defaut, function (v) { return v === 0 ? "droite" : Math.round(v * 100) + " %"; },
          function (v) { editer(function (x) { x.meandre = v; }); }));
      }
      if (o.type === "falaise") {
        zone.appendChild(champCurseur("Longueur des hachures", 0.4, 3, 0.1, o.hachures || 1, function (v) { return "×" + nb(v, 1); },
          function (v) { editer(function (x) { x.hachures = v; }); }));
      }
      if (o.type === "frontiere") {
        zone.appendChild(champCase("Territoire : refermer et colorer", o.ferme, function (v) { editer(function (x) { if (v) x.ferme = true; else delete x.ferme; }); panneauSelection(); }));
        if (o.ferme) zone.appendChild(champCurseur("Opacité du fond", 0, 0.6, 0.02, o.fond == null ? 0.16 : o.fond, function (v) { return v === 0 ? "aucun" : Math.round(v * 100) + " %"; },
          function (v) { editer(function (x) { x.fond = v; }); }));
      }
      if (o.type === "riviere" || o.type === "frontiere" || o.type === "falaise" || o.type === "maritime") {
        zone.appendChild(champCase("Courbes adoucies", Moteur.styleLigne(o, th).lisse && o.lisse !== false, function (v) { editer(function (x) { x.lisse = v; }); }));
      }
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", texte: "Inverser le sens", onclick: function () {
          editer(function (x) { var r = []; for (var i = x.pts.length - 2; i >= 0; i -= 2) r.push(x.pts[i], x.pts[i + 1]); x.pts = r; });
        } })
      ]));
      zone.appendChild(el("p", { classe: "aide", texte: "Glissez un carré pour déplacer un point. Double-clic sur le tracé pour en ajouter un." }));
    } else if (sel.coll === "tampons") {
      zone.appendChild(champChoix("Décor", Moteur.TAMPONS.map(function (t) { return [t.id, t.nom]; }), o.type,
        function (v) { editer(function (x) { x.type = v; }); }));
      zone.appendChild(champCurseur("Taille", 8, 600, 1, borne(o.s * E.vue.zoom, 8, 600), function (v) { return Math.round(v) + " px"; },
        function (v) { editer(function (x) { var pied = x.y - x.s * 0.3; x.s = v / E.vue.zoom; x.y = pied + x.s * 0.3; }); }));
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", texte: "Autre forme", onclick: function () { editer(function (x) { x.v = (x.v || 0) + 1; }); } })
      ]));
      zone.appendChild(el("p", { classe: "aide", texte: "Glissez le décor pour le déplacer. « Autre forme » en change le dessin." }));
    } else if (sel.coll === "lacs") {
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", texte: "Plus petit", onclick: function () { echelleLac(o, 1 / 1.15); } }),
        el("button", { type: "button", classe: "btn", texte: "Plus grand", onclick: function () { echelleLac(o, 1.15); } })
      ]));
      zone.appendChild(el("p", { classe: "aide", texte: "Glissez le lac pour le déplacer, un carré pour changer sa forme. Double-clic sur le bord pour ajouter un point. Une route qui le traverse reçoit un pont." }));
    }

    zone.appendChild(el("div", { classe: "rangee rangee-fin" }, [
      el("button", { type: "button", classe: "btn", texte: "Dupliquer", onclick: function () { dupliquer(sel.coll, o); } }),
      el("button", { type: "button", classe: "btn danger", texte: "Supprimer", onclick: function () { supprimerObjet(sel.coll, o); } })
    ]));
  }

  // ----- Images personnalisées -----
  //
  // L'image choisie est réduite à 256 px de côté au plus et gardée dans la carte, en
  // data-URL : elle voyage avec le fichier exporté, sans rien envoyer nulle part.
  function choisirImage(rappel) {
    var champ = $("fichierImage");
    champ.value = "";
    champ.onchange = function () {
      var f = champ.files && champ.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 256 / Math.max(im.naturalWidth || 256, im.naturalHeight || 256));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round((im.naturalWidth || 256) * k));
        cv.height = Math.max(1, Math.round((im.naturalHeight || 256) * k));
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var cle = nouvelId("i");
        E.carte.images = E.carte.images || {};
        E.carte.images[cle] = cv.toDataURL("image/png");
        rappel(cle);
        marquer();
        rendre();
      };
      im.onerror = function () { URL.revokeObjectURL(url); etat("Cette image n'a pas pu être lue."); };
      im.src = url;
    };
    champ.click();
  }

  // Les images qui ne servent plus à aucun lieu ne sont pas gardées dans le fichier.
  function nettoyerImages() {
    var c = E.carte;
    if (!c.images) return;
    var utiles = {};
    c.lieux.forEach(function (l) { if (l.image) utiles[l.image] = true; });
    // Un lieu supprimé peut revenir par « Annuler » : on garde ce que l'historique connaît.
    var garder = function (a) {
      if (a.t === "lot") { a.actions.forEach(garder); return; }
      [a.obj, a.avant, a.apres].forEach(function (o) { if (o && o.image) utiles[o.image] = true; });
    };
    E.histo.pile.forEach(garder); E.histo.reprise.forEach(garder);
    Object.keys(c.images).forEach(function (k) { if (!utiles[k]) delete c.images[k]; });
  }

  // ----- Index des lieux -----
  function majIndex() {
    var zone = $("indexLieux");
    if (!zone) return;
    var filtre = ($("filtreLieux").value || "").trim().toLowerCase();
    zone.innerHTML = "";
    var liste = E.carte.lieux.filter(function (l) {
      var tp = Moteur.TYPES_LIEUX[l.type] || {};
      return !filtre || (l.nom || "").toLowerCase().indexOf(filtre) >= 0 || (tp.nom || "").toLowerCase().indexOf(filtre) >= 0;
    }).sort(function (a, b) { return (a.nom || "").localeCompare(b.nom || "", "fr"); });
    $("compteLieux").textContent = E.carte.lieux.length ? "(" + E.carte.lieux.length + ")" : "";
    if (!liste.length) { zone.appendChild(el("p", { classe: "aide", texte: E.carte.lieux.length ? "Aucun lieu ne correspond." : "Aucun lieu pour l'instant : outil Lieux (P)." })); return; }
    liste.slice(0, 300).forEach(function (l) {
      var tp = Moteur.TYPES_LIEUX[l.type] || Moteur.TYPES_LIEUX.ville;
      var b = el("button", { type: "button", classe: "ligne-index" + (E.selection && E.selection.obj === l ? " actif" : "") },
        [el("strong", { texte: l.nom || "(sans nom)" }), el("span", { texte: tp.nom })]);
      b.addEventListener("click", function () { allerAuLieu(l); });
      zone.appendChild(b);
    });
  }

  // Centre la vue sur un lieu, assez près pour qu'il soit visible, et le sélectionne.
  function allerAuLieu(l) {
    var tp = Moteur.TYPES_LIEUX[l.type] || Moteur.TYPES_LIEUX.ville;
    var min = typeof l.niv === "number" ? l.niv : tp.niv;
    if (niveauActuel() < min * 1.2) E.vue.zoom = borne(Moteur.zoomAjuste(E.carte, vueComplete()) * Math.max(min * 1.3, 1), zoomMin(), zoomMax());
    E.vue.cx = l.x; E.vue.cy = l.y;
    choisirOutil("selection");
    selectionner("lieux", l);
    vueChangee();
  }

  function infosCarte() {
    var c = E.carte;
    $("infosCarte").innerHTML =
      "<div><span>Taille</span><strong>" + nb(c.largeur, c.largeur < 100 ? 2 : 0) + " × " + nb(c.hauteur, c.hauteur < 100 ? 2 : 0) + " km</strong></div>" +
      "<div><span>Style</span><strong>" + (Moteur.THEMES[c.theme] || Moteur.THEMES.atlas).nom + "</strong></div>" +
      "<div><span>Lieux</span><strong>" + c.lieux.length + "</strong></div>" +
      "<div><span>Noms</span><strong>" + c.etiquettes.length + "</strong></div>" +
      "<div><span>Tracés</span><strong>" + c.lignes.length + "</strong></div>" +
      "<div><span>Lacs</span><strong>" + c.lacs.length + "</strong></div>" +
      "<div><span>Décors posés</span><strong>" + c.tampons.length + "</strong></div>" +
      "<div><span>Coups de pinceau</span><strong>" + c.traits.length + "</strong></div>";
  }

  function choisirOutil(o) {
    if (E.ligneEnCours && o !== "ligne") terminerLigne();
    E.outil = o;
    if (o !== "selection") selectionner(null, null);
    panneauOutil();
    surcouche();
  }

  document.querySelectorAll(".outil").forEach(function (b) {
    b.addEventListener("click", function () { choisirOutil(b.dataset.outil); });
  });

  // ----- Enregistrement -----
  function etat(texte) { $("etatSauvegarde").textContent = texte; }

  function marquer() {
    E.modifie = true;
    etat("Modifications non enregistrées…");
    clearTimeout(E.minuteurSauve);
    E.minuteurSauve = setTimeout(sauvegarder, 1500);
    infosCarte();
    majMini();
  }

  function sauvegarder() {
    clearTimeout(E.minuteurSauve);
    if (!E.carte || !E.modifie) return Promise.resolve();
    cloreEdition();
    var c = E.carte;
    c.majLe = Date.now();
    c.vue = { cx: E.vue.cx, cy: E.vue.cy, zoom: E.vue.zoom };
    nettoyerImages();
    try { c.vignette = Moteur.vignette(c); } catch (e) { /* la vignette n'est pas vitale */ }
    E.modifie = false;
    return Stockage.ecrire(c).then(function () {
      if (!E.modifie) etat("Enregistré");
    }).catch(function (e) {
      E.modifie = true;
      etat("Enregistrement impossible : " + (e && e.message ? e.message : "erreur"));
    });
  }

  window.addEventListener("pagehide", function () { if (E.modifie) sauvegarder(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && E.modifie) sauvegarder(); });
  window.addEventListener("beforeunload", function (ev) { if (E.modifie) { sauvegarder(); ev.preventDefault(); ev.returnValue = ""; } });

  $("lienRetour").addEventListener("click", function (ev) {
    if (!E.modifie) return;
    ev.preventDefault();
    var url = this.href;
    sauvegarder().then(function () { E.modifie = false; location.href = url; });
  });

  $("nomCarte").addEventListener("input", function () {
    E.carte.nom = $("nomCarte").value.slice(0, 80) || "Sans titre";
    marquer();
  });

  // ----- Boutons de la barre -----
  $("btnAnnuler").addEventListener("click", annuler);
  $("btnRefaire").addEventListener("click", refaire);
  $("btnZoomPlus").addEventListener("click", function () { zoomerVers(W / 2, H / 2, 1.6); });
  $("btnZoomMoins").addEventListener("click", function () { zoomerVers(W / 2, H / 2, 1 / 1.6); });
  $("btnAjuster").addEventListener("click", function () { ajusterVue(); vueChangee(); });
  $("btnGrille").addEventListener("click", function () {
    E.grille = !E.grille;
    this.setAttribute("aria-pressed", String(E.grille));
    rendre();
  });

  // ----- Réglages de la carte -----
  var dlgReg = $("dlgReglages");
  $("btnReglages").addEventListener("click", function () {
    var th = $("rgTheme");
    th.innerHTML = "";
    Object.keys(Moteur.THEMES).forEach(function (k) {
      var op = document.createElement("option");
      op.value = k; op.textContent = Moteur.THEMES[k].nom;
      if (k === E.carte.theme) op.selected = true;
      th.appendChild(op);
    });
    $("rgNom").value = E.carte.nom;
    $("rgLarg").value = E.carte.largeur;
    $("rgHaut").value = E.carte.hauteur;
    $("rgFinesse").value = String(typeof E.carte.finesse === "number" ? E.carte.finesse : 1);
    var orn = E.carte.ornements || {};
    $("rgRose").value = orn.rose || "";
    $("rgEchelle").checked = !!orn.echelle;
    $("rgTitre").checked = !!orn.titre;
    $("rgMessage").textContent = "";
    dlgReg.showModal();
  });
  $("rgAnnuler").addEventListener("click", function () { dlgReg.close(); });
  $("formReglages").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var l = parseFloat($("rgLarg").value), h = parseFloat($("rgHaut").value);
    if (!(l >= 0.05 && l <= 40000 && h >= 0.05 && h <= 40000)) {
      $("rgMessage").textContent = "La largeur et la hauteur doivent être comprises entre 0,05 et 40 000 km.";
      return;
    }
    E.carte.finesse = parseInt($("rgFinesse").value, 10) || 0;
    if ($("rgRose").value || $("rgEchelle").checked || $("rgTitre").checked) {
      E.carte.ornements = { rose: $("rgRose").value, echelle: $("rgEchelle").checked, titre: $("rgTitre").checked };
    } else delete E.carte.ornements;
    E.carte.nom = $("rgNom").value.trim().slice(0, 80) || "Sans titre";
    E.carte.largeur = l;
    E.carte.hauteur = h;
    E.carte.theme = $("rgTheme").value;
    $("nomCarte").value = E.carte.nom;
    dlgReg.close();
    marquer();
    majMini();
    infosVue();
    panneauOutil();
    panneauSelection();
    rendre();
  });

  // ----- Export -----
  var dlgExp = $("dlgExport");
  $("btnExporter").addEventListener("click", function () { $("exMessage").textContent = ""; dlgExp.showModal(); });
  $("exFermer").addEventListener("click", function () { dlgExp.close(); });

  function nomFichier() {
    return (E.carte.nom || "carte").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "carte";
  }
  function telecharger(blob, nom) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  // L'image : la carte entière ou la vue actuelle. « Symboles » règle la taille des
  // décors, des lieux et des noms dans l'image : « comme à l'écran » dessine la carte
  // comme sur un écran de 2 048 px de large (une image plus grande est alors plus nette,
  // pas plus chargée) ; « fins » donne une carte plus fouillée, aux symboles plus petits.
  $("exPng").addEventListener("click", function () {
    var c = E.carte;
    var largeur = parseInt($("exLarg").value, 10);
    var vueSeule = $("exZone").value === "vue";
    var ratio = vueSeule ? H / W : c.hauteur / c.largeur;
    var hauteur = Math.round(largeur * ratio);
    if (hauteur > 16000 || largeur * hauteur > 70e6) {
      $("exMessage").textContent = "Cette image serait trop haute pour cette largeur : choisissez une taille plus petite.";
      return;
    }
    $("exMessage").textContent = "Préparation de l'image…";
    var dpr = $("exSymboles").value === "fins" ? 1 : Math.max(1, largeur / 2048);
    var vue = vueSeule
      ? { cx: E.vue.cx, cy: E.vue.cy, zoom: E.vue.zoom * (largeur / dpr) / W, largeur: largeur / dpr, hauteur: hauteur / dpr, dpr: dpr }
      : { cx: c.largeur / 2, cy: c.hauteur / 2, zoom: largeur / dpr / c.largeur, largeur: largeur / dpr, hauteur: hauteur / dpr, dpr: dpr };
    Moteur.preparerImages(c).then(function () {
      try {
        var cv = document.createElement("canvas");
        Moteur.dessiner(cv, c, vue, { cle: "export", grille: $("exGrille").checked });
        cv.toBlob(function (blob) {
          if (!blob) { $("exMessage").textContent = "Le navigateur n'a pas pu produire cette image : essayez une taille plus petite."; return; }
          telecharger(blob, nomFichier() + (vueSeule ? "-detail" : "") + ".png");
          $("exMessage").textContent = "Image enregistrée dans vos téléchargements (" + cv.width + " × " + cv.height + " px).";
        }, "image/png");
      } catch (e) {
        $("exMessage").textContent = "Export impossible : " + (e.message || "erreur");
      }
    });
  });

  $("exJson").addEventListener("click", function () {
    cloreEdition();
    var copie = cloner(E.carte);
    delete copie.vignette;
    telecharger(new Blob([JSON.stringify(copie)], { type: "application/json" }), nomFichier() + ".worldmap.json");
    $("exMessage").textContent = "Fichier enregistré dans vos téléchargements. Importez-le depuis « Mes cartes » pour le rouvrir.";
  });

  // ----- Minicarte -----
  //
  // La carte entière en petit, avec le cadre de ce que l'on regarde : de près, on sait
  // toujours où l'on est. Cliquer ou glisser dedans déplace la vue. Elle est redessinée
  // (rendu complet, en petit) une seconde après la dernière modification.
  var mini = { cv: $("miniCarte"), fond: null, minuteur: 0, ouverte: true };

  function majMini() {
    clearTimeout(mini.minuteur);
    if (!mini.ouverte || !E.carte) return;
    mini.minuteur = setTimeout(function () {
      var c = E.carte, larg = 190, haut = Math.round(larg * c.hauteur / c.largeur);
      if (haut > 190) { haut = 190; larg = Math.round(haut * c.largeur / c.hauteur); }
      $("mini").style.width = larg + "px";
      mini.fond = Moteur.carteEntiere(c, larg * 2, "mini");
      mini.l = larg; mini.h = haut;
      dessinerMini();
    }, 900);
  }

  function dessinerMini() {
    if (!mini.ouverte || !mini.fond) return;
    var cv = mini.cv, d = 2;
    if (cv.width !== mini.l * d || cv.height !== mini.h * d) { cv.width = mini.l * d; cv.height = mini.h * d; cv.style.height = mini.h + "px"; }
    var ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(mini.fond, 0, 0, cv.width, cv.height);
    var k = cv.width / E.carte.largeur;
    var x = (E.vue.cx - W / 2 / E.vue.zoom) * k, y = (E.vue.cy - H / 2 / E.vue.zoom) * k, w = W / E.vue.zoom * k, h = H / E.vue.zoom * k;
    // Le cadre de la vue ; tout petit, il devient une mire pour rester visible.
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(20,10,0,0.75)";
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffd36b";
    ctx.strokeRect(x, y, w, h);
    if (w < 14 || h < 14) {
      var cx = x + w / 2, cy = y + h / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 5, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15, cy);
      ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 5); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15);
      ctx.stroke();
    }
  }

  function allerDepuisMini(ev) {
    var r = mini.cv.getBoundingClientRect();
    E.vue.cx = (ev.clientX - r.left) / r.width * E.carte.largeur;
    E.vue.cy = (ev.clientY - r.top) / r.height * E.carte.hauteur;
    vueChangee();
  }
  mini.cv.addEventListener("pointerdown", function (ev) {
    ev.stopPropagation();
    try { mini.cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignoré */ }
    mini.glisse = true;
    allerDepuisMini(ev);
  });
  mini.cv.addEventListener("pointermove", function (ev) { if (mini.glisse) { ev.stopPropagation(); allerDepuisMini(ev); } });
  ["pointerup", "pointercancel"].forEach(function (n) { mini.cv.addEventListener(n, function (ev) { ev.stopPropagation(); mini.glisse = false; }); });
  $("btnMini").addEventListener("click", function () {
    mini.ouverte = !mini.ouverte;
    $("mini").classList.toggle("repliee", !mini.ouverte);
    this.setAttribute("aria-pressed", String(mini.ouverte));
    if (mini.ouverte) majMini();
  });
  ["pointerdown", "wheel", "dblclick", "contextmenu"].forEach(function (n) {
    $("mini").addEventListener(n, function (ev) { ev.stopPropagation(); });
  });

  // ----- Clavier -----
  function enSaisie(ev) {
    // Un curseur ou une case qui garde le focus ne doit pas avaler les raccourcis : seuls
    // les champs où l'on tape du texte les suspendent.
    var t = ev.target;
    if (!t) return false;
    if (t.tagName === "INPUT") return ["range", "checkbox", "color", "radio", "button", "file"].indexOf(t.type) < 0;
    return t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
  }

  window.addEventListener("keydown", function (ev) {
    if (!E.carte || enSaisie(ev) || document.querySelector("dialog[open]")) return;
    var k = ev.key, mod = ev.ctrlKey || ev.metaKey;

    if (mod && (k === "z" || k === "Z")) { ev.preventDefault(); if (ev.shiftKey) refaire(); else annuler(); return; }
    if (mod && (k === "y" || k === "Y")) { ev.preventDefault(); refaire(); return; }
    if (mod && (k === "d" || k === "D")) { ev.preventDefault(); if (E.selection) dupliquer(E.selection.coll, E.selection.obj); return; }
    if (mod) return;

    if (k === " ") { E.espace = true; scene.classList.add("main"); ev.preventDefault(); return; }
    if (k === "Escape") {
      if (!$("menuContexte").hidden) fermerMenu();
      else if (E.ligneEnCours) { E.ligneEnCours = null; surcouche(); }
      else if (E.selection) selectionner(null, null);
      else if (E.outil !== "selection") choisirOutil("selection");   // Échap : quitter l'outil
      return;
    }
    if (k === "Enter" && E.ligneEnCours) { terminerLigne(); return; }
    if ((k === "Delete" || k === "Backspace") && E.selection) { ev.preventDefault(); supprimerObjet(E.selection.coll, E.selection.obj); return; }
    if (k === "Backspace" && E.ligneEnCours) { E.ligneEnCours.pts.length -= 2; if (!E.ligneEnCours.pts.length) E.ligneEnCours = null; surcouche(); return; }

    var outils = { v: "selection", h: "main", b: "pinceau", e: "gomme", d: "tampon", l: "ligne", k: "lac", t: "etiquette", p: "lieu" };
    var o = outils[k.toLowerCase()];
    if (o) { choisirOutil(o); return; }
    if (k === "g" || k === "G") { $("btnGrille").click(); return; }
    if (k === "0") { $("btnAjuster").click(); return; }
    if (k === "+" || k === "=") { $("btnZoomPlus").click(); return; }
    if (k === "-") { $("btnZoomMoins").click(); return; }
    if (k === "m" || k === "M") { $("btnMini").click(); return; }
    if (k === "[" || k === "]") {
      var f = k === "]" ? 1.15 : 1 / 1.15;
      if (E.outil === "tampon") { E.taillePxTampon = borne(E.taillePxTampon * f, 12, 260); panneauOutil(); }
      else {
        E.taillePx = borne(E.taillePx * f, 3, 240);
        if (E.outil === "pinceau" || E.outil === "gomme") panneauOutil();
      }
      surcouche();
    }
  });
  window.addEventListener("keyup", function (ev) {
    if (ev.key === " ") { E.espace = false; if (E.outil !== "main") scene.classList.remove("main"); }
  });

  // ----- Démarrage -----
  function erreurChargement(texte) {
    scene.innerHTML = "";
    var p = document.createElement("p");
    p.style.cssText = "color:#ece6d6;padding:30px;font-size:17px";
    p.innerHTML = texte + ' <a href="index.html" style="color:#e0b050">Retour à mes cartes</a>';
    scene.appendChild(p);
  }

  function demarrer(carte) {
    carte.traits = carte.traits || [];
    carte.lignes = carte.lignes || [];
    carte.etiquettes = carte.etiquettes || [];
    carte.lieux = carte.lieux || [];
    carte.lacs = carte.lacs || [];
    carte.tampons = carte.tampons || [];
    carte.finesses = carte.finesses || [];
    Moteur.surImage = function () { rendre(); };
    $("filtreLieux").addEventListener("input", majIndex);
    carte.theme = Moteur.THEMES[carte.theme] ? carte.theme : "atlas";
    E.carte = carte;
    document.title = carte.nom + " — WorldMap";
    $("nomCarte").value = carte.nom;
    if (carte.parent && carte.parent.carteId) {
      var lp = $("lienParent");
      lp.hidden = false;
      lp.textContent = "↑ " + (carte.parent.nom || "Carte mère");
      lp.title = "Revenir à la carte dont celle-ci est le détail";
      lp.href = "editeur.html?id=" + encodeURIComponent(carte.parent.carteId);
      lp.addEventListener("click", function (ev) { ev.preventDefault(); allerVers(lp.href); });
    }
    tailleScene();
    if (carte.vue && carte.vue.zoom > 0) { E.vue.cx = carte.vue.cx; E.vue.cy = carte.vue.cy; E.vue.zoom = borne(carte.vue.zoom, zoomMin(), zoomMax()); }
    else ajusterVue();
    panneauOutil();
    panneauSelection();
    infosCarte();
    majIndex();
    majBoutonsHisto();
    infosVue();
    etat("Enregistré");
    rendre();
    majMini();
    var apresRedim = function () {
      tailleScene();
      if (E.ajusterQuandMesuree && W > 2 && H > 2) ajusterVue();
      infosVue();
      rendre();
    };
    if ("ResizeObserver" in window) new ResizeObserver(apresRedim).observe(scene);
    else window.addEventListener("resize", apresRedim);
  }

  var id = new URLSearchParams(location.search).get("id");
  if (!id) { erreurChargement("Aucune carte demandée."); return; }

  var polices = document.fonts && document.fonts.load
    ? Promise.all([
        document.fonts.load("700 20px 'EB Garamond'"),
        document.fonts.load("600 20px 'EB Garamond'"),
        document.fonts.load("italic 500 20px 'EB Garamond'")
      ]).catch(function () {})
    : Promise.resolve();

  Promise.all([Stockage.lire(id), polices]).then(function (r) {
    if (!r[0]) { erreurChargement("Cette carte n'existe pas (ou a été supprimée)."); return; }
    demarrer(r[0]);
  }).catch(function (e) {
    erreurChargement(e && e.message ? e.message : "Impossible de lire la carte.");
  });
})();
