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

  var NIVEAU_MIN = 0.25, NIVEAU_MAX = 3000;

  var E = {
    carte: null,
    vue: { cx: 0, cy: 0, zoom: 1 },
    outil: "pinceau",
    materiau: "plaine",
    taillePx: 40,
    typeLigne: "riviere",
    couleurFrontiere: "#8a2b2b",
    epaisseurPx: 2.4,
    meandre: 0.6,            // rivières : amplitude des méandres (0 = droit)
    delta: true,             // rivières : s'élargissent vers l'embouchure
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

    if (geste && geste.type === "trait") Moteur.apercuTrait(ctx, geste.trait, vueComplete());

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
    if (!c || (geste && geste.type !== "trait")) return;
    if (E.outil === "pinceau" || E.outil === "gomme") {
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
      Moteur.iconeAuto(ctx, E.typeLieu, c.x, c.y, Moteur.tailleIcone({ type: E.typeLieu }, thc), thc);
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
      ctx.strokeRect(-w / 2 - 4, -h / 2 - 2, w + 8, h + 4);
      ctx.restore();
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
    var arr = collection(a.coll);
    if (a.t === "ajout") arr.splice(Math.min(a.idx, arr.length), 0, a.obj);
    else if (a.t === "suppr") { var i = arr.indexOf(a.obj); if (i >= 0) arr.splice(i, 1); }
    else if (a.t === "modif") remplacer(arr, a.id, a.apres);
  }
  function defaire(a) {
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
      if (Math.abs(lx) <= b.w / 2 + 4 / z && Math.abs(ly) <= b.h / 2 + 2 / z) return { coll: "etiquettes", obj: e };
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
  function demanderTexte(px, py, valeur, rappel) {
    rappelSaisie = rappel;
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
    if (valider && texte && r) r(texte);
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
        surcouche();
        break;
      case "ligne":
        ajouterPointLigne(p, w);
        geste = { type: "rien" };
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
      if (hit.coll === "lieux" || hit.coll === "etiquettes") {
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
  var FAMILLES = { route: "voie", sentier: "voie", riviere: "riviere" };
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
        ajouter("traits", g.trait);
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
    if (hit && hit.coll === "lieux") {
      selectionner("lieux", hit.obj);
      ouvrirMenu(p, hit.obj);
    } else fermerMenu();
  });

  // ----- Menu du clic droit sur un lieu -----
  var TYPES_VILLE = { capitale: 1, ville: 1, village: 1, port: 1, fort: 1 };

  function fermerMenu() { $("menuContexte").hidden = true; }

  function ouvrirMenu(p, lieu) {
    var m = $("menuContexte");
    m.innerHTML = "";
    var estVille = !!TYPES_VILLE[lieu.type];
    var nom = el("div", { classe: "titre-menu", texte: lieu.nom || Moteur.TYPES_LIEUX[lieu.type].nom });
    m.appendChild(nom);
    [
      ["Renommer", function () {
        var s = versEcran(lieu.x, lieu.y);
        demanderTexte(s[0], s[1], lieu.nom, function (t) { editer(function (o) { o.nom = t; }); panneauSelection(); });
      }],
      [lieu.carteId ? (estVille ? "Ouvrir la carte de la ville" : "Ouvrir la carte du lieu") : (estVille ? "Éditer la ville…" : "Éditer le lieu…"),
        function () { ouvrirCarteDuLieu(lieu); }],
      ["Supprimer", function () { supprimerObjet("lieux", lieu); }, true]
    ].forEach(function (it) {
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
      traits: [], lignes: [], etiquettes: [], lieux: [], lacs: [],
      vue: null,
      parent: { carteId: mere.id, lieuId: lieu.id, nom: mere.nom },
      creeLe: Date.now(), majLe: Date.now(), version: 1
    };
    // De la terre partout : un seul trait, assez épais pour couvrir toute la carte.
    var fond = Moteur.nouveauTrait("plaine", t[1] * 1.3, [0, t[1] / 2, t[0], t[1] / 2], false);
    fond.sansDecor = true;           // pas de touffes d'herbe géantes sur un fond de cette taille
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
      selectionner("etiquettes", e);
      choisirOutil("selection");     // l'élément est posé : on rend la main
    });
  }

  function creerLieuA(p) {
    var w = versMonde(p.x, p.y);
    var tp = Moteur.TYPES_LIEUX[E.typeLieu];
    demanderTexte(p.x, p.y, tp.nom, function (nom) {
      var l = { id: nouvelId("p"), type: E.typeLieu, nom: nom, x: w[0], y: w[1] };
      // Posé en zoomant : on ne veut le voir qu'à ce niveau et au-delà.
      var niv = niveauActuel();
      if (niv > tp.niv * 1.5 && niv > 1) l.niv = Math.round(niv * 0.6 * 10) / 10;
      ajouter("lieux", l);
      selectionner("lieux", l);
      choisirOutil("selection");     // le lieu est posé : on rend la main (sinon le fantôme reste collé au curseur)
    });
  }

  // ----- Panneau : outil -----
  var OUTILS_INFO = {
    selection: "Sélection",
    main: "Main",
    pinceau: "Pinceau",
    gomme: "Gomme",
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

  function champTexte(libelle, valeur, surChange) {
    var champ = el("input", { type: "text", value: valeur || "", maxlength: "80" });
    champ.addEventListener("input", function () { surChange(champ.value); });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }), champ]);
  }

  function champChoix(libelle, options, valeur, surChange) {
    var s = el("select");
    options.forEach(function (o) {
      var op = el("option", { value: o[0], texte: o[1] });
      if (o[0] === valeur) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener("change", function () { surChange(s.value); });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }), s]);
  }

  function champCase(libelle, valeur, surChange) {
    var c = el("input", { type: "checkbox" });
    c.checked = !!valeur;
    c.addEventListener("change", function () { surChange(c.checked); });
    return el("div", { classe: "champ-p" }, [el("label", { classe: "case" }, [c, el("span", { texte: libelle })])]);
  }

  function champCouleur(libelle, valeur, surChange) {
    var c = el("input", { type: "color", value: valeur });
    c.addEventListener("input", function () { surChange(c.value); });
    return el("label", { classe: "champ-p" }, [el("span", { texte: libelle }), c]);
  }

  function majLibelleTaille() {
    var out = $("libTaillePinceau");
    if (out) out.textContent = "≈ " + formatKm(E.taillePx / E.vue.zoom) + " de large dans le monde";
  }

  function panneauOutil() {
    var zone = $("optionsOutil");
    zone.innerHTML = "";
    $("titreOutil").textContent = OUTILS_INFO[E.outil];
    document.querySelectorAll(".outil").forEach(function (b) { b.classList.toggle("actif", b.dataset.outil === E.outil); });
    scene.className = "scene " + (E.outil === "main" ? "main" : E.outil === "selection" ? "selection" : "");

    if (E.outil === "pinceau") {
      var pal = el("div", { classe: "palette" });
      Moteur.MATERIAUX.forEach(function (m) {
        var b = el("button", { type: "button", classe: "mat" + (m.id === E.materiau ? " actif" : ""), title: m.nom }, [
          el("span", { classe: "pastille-mat", style: m.type === "eau"
            ? "background:repeating-linear-gradient(45deg,#4a8bb0,#4a8bb0 4px,#3a7a9f 4px,#3a7a9f 8px)"
            : "background:" + m.couleur }),
          el("span", { texte: m.nom })
        ]);
        b.addEventListener("click", function () { E.materiau = m.id; panneauOutil(); });
        pal.appendChild(b);
      });
      zone.appendChild(pal);
    }
    if (E.outil === "pinceau" || E.outil === "gomme") {
      zone.appendChild(champCurseur("Taille du pinceau", 3, 240, 1, E.taillePx, function (v) { return Math.round(v) + " px"; },
        function (v) { E.taillePx = v; majLibelleTaille(); surcouche(); }));
      zone.appendChild(el("p", { classe: "aide", id: "libTaillePinceau" }));
      zone.appendChild(el("p", { classe: "aide", texte: E.outil === "gomme"
        ? "Efface la terre : la mer réapparaît. Zoomez pour effacer avec précision."
        : "Zoomez avant de peindre pour travailler plus finement : la taille se règle en pixels à l'écran." }));
      majLibelleTaille();
    }

    if (E.outil === "ligne") {
      var types = Object.keys(Moteur.TYPES_LIGNES).map(function (k) { return [k, Moteur.TYPES_LIGNES[k].nom]; });
      zone.appendChild(champChoix("Type de tracé", types, E.typeLigne, function (v) {
        E.typeLigne = v;
        E.epaisseurPx = Moteur.TYPES_LIGNES[v].px;
        panneauOutil();
      }));
      if (E.typeLigne === "frontiere") zone.appendChild(champCouleur("Couleur de la frontière", E.couleurFrontiere, function (v) { E.couleurFrontiere = v; }));
      zone.appendChild(champCurseur("Épaisseur", 1, 14, 0.2, E.epaisseurPx, function (v) { return nb(v, 1) + " px"; }, function (v) { E.epaisseurPx = v; }));
      if (E.typeLigne === "riviere") {
        zone.appendChild(champCurseur("Méandres", 0, 1, 0.05, E.meandre, function (v) { return v === 0 ? "droite" : Math.round(v * 100) + " %"; }, function (v) { E.meandre = v; }));
        zone.appendChild(champCase("S'élargit vers l'embouchure", E.delta, function (v) { E.delta = v; }));
      }
      zone.appendChild(el("p", { classe: "aide", texte: "Cliquez pour poser les points. Double-clic ou Entrée pour terminer, clic droit pour retirer le dernier point, Échap pour annuler." }));
    }

    if (E.outil === "etiquette") {
      var styles = Object.keys(Moteur.STYLES_ETIQ).map(function (k) { return [k, Moteur.STYLES_ETIQ[k].nom]; });
      zone.appendChild(champChoix("Style", styles, E.styleEtiq, function (v) { E.styleEtiq = v; }));
      zone.appendChild(champCurseur("Taille du texte", 12, 160, 1, E.taillePxEtiq, function (v) { return Math.round(v) + " px"; }, function (v) { E.taillePxEtiq = v; }));
      zone.appendChild(el("p", { classe: "aide", texte: "Cliquez sur la carte, tapez le nom, Entrée. La taille est celle de l'écran au moment où vous cliquez : le texte grandit et rétrécit avec le zoom." }));
    }

    if (E.outil === "lieu") {
      var pal2 = el("div", { classe: "palette" });
      var thp = themeActuel();
      Object.keys(Moteur.TYPES_LIEUX).forEach(function (k) {
        var cv = el("canvas", { width: "72", height: "72" });
        cv.style.width = cv.style.height = "36px";
        var c2 = cv.getContext("2d");
        c2.scale(2, 2);
        Moteur.iconeAuto(c2, k, 18, 18, thp.lieuxIllustres ? 33 : 20, thp);
        cv.style.background = "#f4ecd6";
        cv.style.borderRadius = "6px";
        var b = el("button", { type: "button", classe: "mat" + (k === E.typeLieu ? " actif" : ""), title: Moteur.TYPES_LIEUX[k].nom }, [cv, el("span", { texte: Moteur.TYPES_LIEUX[k].nom })]);
        b.addEventListener("click", function () { E.typeLieu = k; panneauOutil(); });
        pal2.appendChild(b);
      });
      zone.appendChild(pal2);
      zone.appendChild(el("p", { classe: "aide", texte: "Les capitales se voient de loin, les villages seulement en zoomant : chaque lieu a son niveau d'apparition, réglable une fois posé." }));
    }

    if (E.outil === "lac") zone.appendChild(el("p", { classe: "aide", texte: "Dessinez le contour du lac à main levée, en maintenant le bouton : il se referme tout seul au relâchement. On peut ensuite le déplacer, le remodeler, l'agrandir. Les rivières et les routes qui le traversent s'y raccordent." }));
    if (E.outil === "main") zone.appendChild(el("p", { classe: "aide", texte: "Faites glisser pour déplacer la carte. La molette zoome, Espace + glisser déplace avec n'importe quel outil." }));
    if (E.outil === "selection") zone.appendChild(el("p", { classe: "aide", texte: "Cliquez un lieu, un nom ou un tracé pour le régler, le déplacer ou le supprimer. Double-clic pour renommer ; sur un tracé, double-clic ajoute un point." }));
  }

  // ----- Panneau : sélection -----
  function panneauSelection() {
    var bloc = $("blocSelection"), zone = $("optionsSelection");
    var sel = E.selection;
    zone.innerHTML = "";
    bloc.hidden = !sel;
    if (!sel) return;
    var o = sel.obj;

    if (sel.coll === "lieux") {
      zone.appendChild(champTexte("Nom", o.nom, function (v) { editer(function (x) { x.nom = v; }); }));
      zone.appendChild(champChoix("Type", Object.keys(Moteur.TYPES_LIEUX).map(function (k) { return [k, Moteur.TYPES_LIEUX[k].nom]; }), o.type,
        function (v) { editer(function (x) { x.type = v; delete x.niv; }); panneauSelection(); }));
      zone.appendChild(champCurseur("Taille", 0.5, 2.5, 0.1, o.ech || 1, function (v) { return "×" + nb(v, 1); },
        function (v) { editer(function (x) { x.ech = v; }); }));
      var niv = typeof o.niv === "number" ? o.niv : Moteur.TYPES_LIEUX[o.type].niv;
      zone.appendChild(champCurseur("Visible à partir du zoom", 0, 100, 0.1, Math.min(niv, 100), function (v) { return v === 0 ? "toujours" : "×" + nb(v, 1); },
        function (v) { editer(function (x) { x.niv = v; }); }));
      zone.appendChild(el("p", { classe: "aide", texte: "Zoom actuel : ×" + nb(niveauActuel(), 1) + ". En dessous du niveau choisi, le lieu disparaît." }));
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", onclick: function () { ouvrirCarteDuLieu(o); },
          texte: o.carteId ? "Ouvrir sa carte" : (TYPES_VILLE[o.type] ? "Éditer la ville…" : "Éditer le lieu…") })
      ]));
    } else if (sel.coll === "etiquettes") {
      zone.appendChild(champTexte("Texte", o.texte, function (v) { editer(function (x) { x.texte = v; }); }));
      zone.appendChild(champChoix("Style", Object.keys(Moteur.STYLES_ETIQ).map(function (k) { return [k, Moteur.STYLES_ETIQ[k].nom]; }), o.style,
        function (v) { editer(function (x) { x.style = v; }); }));
      zone.appendChild(champCurseur("Orientation", -180, 180, 1, o.angle || 0, function (v) { return Math.round(v) + "°"; },
        function (v) { editer(function (x) { x.angle = v; }); }));
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", texte: "Plus petit", onclick: function () { editer(function (x) { x.taille /= 1.15; }); } }),
        el("button", { type: "button", classe: "btn", texte: "Plus grand", onclick: function () { editer(function (x) { x.taille *= 1.15; }); } })
      ]));
      zone.appendChild(champCouleur("Couleur", o.couleur || (Moteur.THEMES[E.carte.theme] || Moteur.THEMES.atlas).encre, function (v) { editer(function (x) { x.couleur = v; }); }));
    } else if (sel.coll === "lignes") {
      zone.appendChild(champChoix("Type", Object.keys(Moteur.TYPES_LIGNES).map(function (k) { return [k, Moteur.TYPES_LIGNES[k].nom]; }), o.type,
        function (v) { editer(function (x) { x.type = v; }); panneauSelection(); }));
      var th = Moteur.THEMES[E.carte.theme] || Moteur.THEMES.atlas;
      zone.appendChild(champCouleur("Couleur", Moteur.styleLigne(o, th).c, function (v) { editer(function (x) { x.couleur = v; }); }));
      zone.appendChild(champCurseur("Épaisseur", 0.3, 14, 0.1, Math.max(0.3, Math.min(14, o.taille * E.vue.zoom)), function (v) { return nb(v, 1) + " px"; },
        function (v) { editer(function (x) { x.taille = v / E.vue.zoom; }); }));
      if (o.type === "riviere") {
        zone.appendChild(champCurseur("Méandres", 0, 1, 0.05, o.meandre || 0, function (v) { return v === 0 ? "droite" : Math.round(v * 100) + " %"; },
          function (v) { editer(function (x) { x.meandre = v; }); }));
        zone.appendChild(champCase("S'élargit vers l'embouchure", o.delta, function (v) { editer(function (x) { x.delta = v; }); }));
      }
      var lisse = Moteur.styleLigne(o, th).lisse;
      var caseLisse = el("input", { type: "checkbox" });
      caseLisse.checked = lisse;
      caseLisse.addEventListener("change", function () { editer(function (x) { x.lisse = caseLisse.checked; }); });
      zone.appendChild(el("div", { classe: "champ-p" }, [el("label", { classe: "case" }, [caseLisse, el("span", { texte: "Courbes adoucies" })])]));
      zone.appendChild(el("p", { classe: "aide", texte: "Glissez un carré pour déplacer un point. Double-clic sur le tracé pour en ajouter un." }));
    } else if (sel.coll === "lacs") {
      zone.appendChild(el("div", { classe: "rangee" }, [
        el("button", { type: "button", classe: "btn", texte: "Plus petit", onclick: function () { echelleLac(o, 1 / 1.15); } }),
        el("button", { type: "button", classe: "btn", texte: "Plus grand", onclick: function () { echelleLac(o, 1.15); } })
      ]));
      zone.appendChild(el("p", { classe: "aide", texte: "Glissez le lac pour le déplacer, un carré pour changer sa forme. Double-clic sur le bord pour ajouter un point. Une route qui le traverse reçoit un pont." }));
    }

    zone.appendChild(el("div", { classe: "rangee" }, [
      el("button", { type: "button", classe: "btn danger", texte: "Supprimer", onclick: function () { supprimerObjet(sel.coll, o); } })
    ]));
  }

  // Agrandit ou réduit un lac autour de son centre.
  function echelleLac(lac, f) {
    var n = lac.pts.length / 2, cx = 0, cy = 0;
    for (var i = 0; i < lac.pts.length; i += 2) { cx += lac.pts[i]; cy += lac.pts[i + 1]; }
    cx /= n; cy /= n;
    editer(function (o) {
      for (var k = 0; k < o.pts.length; k += 2) {
        o.pts[k] = cx + (o.pts[k] - cx) * f;
        o.pts[k + 1] = cy + (o.pts[k + 1] - cy) * f;
      }
    });
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
  }

  function sauvegarder() {
    clearTimeout(E.minuteurSauve);
    if (!E.carte || !E.modifie) return Promise.resolve();
    cloreEdition();
    var c = E.carte;
    c.majLe = Date.now();
    c.vue = { cx: E.vue.cx, cy: E.vue.cy, zoom: E.vue.zoom };
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
    $("rgMessage").textContent = "";
    dlgReg.showModal();
  });
  $("rgAnnuler").addEventListener("click", function () { dlgReg.close(); });
  $("formReglages").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var l = parseFloat($("rgLarg").value), h = parseFloat($("rgHaut").value);
    if (!(l >= 50 && l <= 40000 && h >= 50 && h <= 40000)) {
      $("rgMessage").textContent = "La largeur et la hauteur doivent être comprises entre 50 et 40 000 km.";
      return;
    }
    E.carte.nom = $("rgNom").value.trim().slice(0, 80) || "Sans titre";
    E.carte.largeur = l;
    E.carte.hauteur = h;
    E.carte.theme = $("rgTheme").value;
    $("nomCarte").value = E.carte.nom;
    dlgReg.close();
    marquer();
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

  $("exPng").addEventListener("click", function () {
    var c = E.carte;
    var largeur = parseInt($("exLarg").value, 10);
    var hauteur = Math.round(largeur * c.hauteur / c.largeur);
    if (hauteur > 16000 || largeur * hauteur > 70e6) {
      $("exMessage").textContent = "Cette carte est trop haute pour cette largeur : choisissez une image plus petite.";
      return;
    }
    $("exMessage").textContent = "Préparation de l'image…";
    setTimeout(function () {
      try {
        var cv = document.createElement("canvas");
        Moteur.dessiner(cv, c, { cx: c.largeur / 2, cy: c.hauteur / 2, zoom: largeur / c.largeur, largeur: largeur, hauteur: hauteur, dpr: 1 },
          { cle: "export", grille: $("exGrille").checked });
        cv.toBlob(function (blob) {
          if (!blob) { $("exMessage").textContent = "Le navigateur n'a pas pu produire cette image : essayez une taille plus petite."; return; }
          telecharger(blob, nomFichier() + ".png");
          $("exMessage").textContent = "Image enregistrée dans vos téléchargements.";
        }, "image/png");
      } catch (e) {
        $("exMessage").textContent = "Export impossible : " + (e.message || "erreur");
      }
    }, 30);
  });

  $("exJson").addEventListener("click", function () {
    cloreEdition();
    var copie = cloner(E.carte);
    delete copie.vignette;
    telecharger(new Blob([JSON.stringify(copie)], { type: "application/json" }), nomFichier() + ".worldmap.json");
    $("exMessage").textContent = "Fichier enregistré dans vos téléchargements. Importez-le depuis « Mes cartes » pour le rouvrir.";
  });

  // ----- Clavier -----
  function enSaisie(ev) {
    var t = ev.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
  }

  window.addEventListener("keydown", function (ev) {
    if (!E.carte || enSaisie(ev) || document.querySelector("dialog[open]")) return;
    var k = ev.key, mod = ev.ctrlKey || ev.metaKey;

    if (mod && (k === "z" || k === "Z")) { ev.preventDefault(); if (ev.shiftKey) refaire(); else annuler(); return; }
    if (mod && (k === "y" || k === "Y")) { ev.preventDefault(); refaire(); return; }
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

    var outils = { v: "selection", h: "main", b: "pinceau", e: "gomme", l: "ligne", k: "lac", t: "etiquette", p: "lieu" };
    var o = outils[k.toLowerCase()];
    if (o) { choisirOutil(o); return; }
    if (k === "g" || k === "G") { $("btnGrille").click(); return; }
    if (k === "0") { $("btnAjuster").click(); return; }
    if (k === "+" || k === "=") { $("btnZoomPlus").click(); return; }
    if (k === "-") { $("btnZoomMoins").click(); return; }
    if (k === "[" || k === "]") {
      E.taillePx = borne(E.taillePx * (k === "]" ? 1.15 : 1 / 1.15), 3, 240);
      if (E.outil === "pinceau" || E.outil === "gomme") panneauOutil();
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
    if (carte.vue && carte.vue.zoom > 0) { E.vue.cx = carte.vue.cx; E.vue.cy = carte.vue.cy; E.vue.zoom = carte.vue.zoom; }
    else ajusterVue();
    panneauOutil();
    panneauSelection();
    infosCarte();
    majBoutonsHisto();
    infosVue();
    etat("Enregistré");
    rendre();
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
