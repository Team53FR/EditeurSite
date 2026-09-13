// =====================================================================
//  L'attente : dire qu'on travaille, et empêcher d'y toucher
// =====================================================================
//
//  Une sauvegarde part sur le réseau et met parfois plusieurs secondes.
//  Jusqu'ici rien ne le disait : le bouton restait cliquable, la page
//  restait vivante, et l'on pouvait relancer l'action, changer de page ou
//  fermer l'éditeur pendant que l'écriture était en vol — c'est-à-dire
//  perdre du travail sans jamais comprendre pourquoi.
//
//  Ce voile répond aux deux besoins d'un coup : il DIT ce qui se passe et
//  il INTERDIT le reste. Il se pose au-dessus de tout (le bouton de retour
//  au portail monte déjà à 9999) et avale clics, touches et molette.
//
//  Trois précautions, qui font toute la différence à l'usage :
//   — il n'apparaît qu'après un court délai, sinon une action instantanée
//     ne produirait qu'un clignotement désagréable ;
//   — il se compte, pour qu'une action imbriquée dans une autre ne le
//     referme pas trop tôt ;
//   — au bout de quelques secondes il l'admet, plutôt que de laisser
//     croire que tout est bloqué.
//
//  Fichier autonome : aucune dépendance, ni script ni feuille de style.
//  Il est recopié tel quel dans chaque site.

(function () {
  var DELAI_AVANT_AFFICHAGE = 180;   // ms — en deçà, on ne montre rien
  var DELAI_MESSAGE_LONG = 8000;     // ms — au-delà, on rassure

  var profondeur = 0;                // actions en cours (imbrication)
  var voile = null;
  var minuteurAffichage = null;
  var minuteurLong = null;
  var libelleCourant = "";
  var detailCourant = "";

  var style = document.createElement("style");
  style.textContent = [
    ".voile-attente{position:fixed;inset:0;z-index:100000;display:flex;",
    "align-items:center;justify-content:center;padding:24px;",
    "background:rgba(38,31,24,.42);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);",
    "opacity:0;animation:voile-apparait .18s ease forwards;cursor:progress;}",
    "@keyframes voile-apparait{to{opacity:1}}",
    ".voile-attente-carte{display:flex;align-items:center;gap:16px;max-width:420px;",
    "padding:20px 24px;border-radius:14px;background:#fffdf8;color:#2b2622;",
    "border:1px solid #e6ddc9;box-shadow:0 10px 40px rgba(40,28,14,.28);",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}",
    ".voile-attente-rouet{flex-shrink:0;width:26px;height:26px;border-radius:50%;",
    "border:2.5px solid #e6ddc9;border-top-color:#8a4b38;",
    "animation:voile-tourne .8s linear infinite;}",
    "@keyframes voile-tourne{to{transform:rotate(360deg)}}",
    ".voile-attente-texte{min-width:0;}",
    ".voile-attente-titre{margin:0;font-family:'EB Garamond',Georgia,serif;",
    "font-size:17px;font-weight:600;line-height:1.25;}",
    ".voile-attente-detail{margin:3px 0 0;font-size:12.5px;line-height:1.45;color:#6f6455;}",
    "@media (prefers-reduced-motion:reduce){",
    ".voile-attente{animation:none;opacity:1}.voile-attente-rouet{animation-duration:2s}}",
    "@media print{.voile-attente{display:none !important}}"
  ].join("");

  function poserStyle() {
    if (!style.parentNode) (document.head || document.documentElement).appendChild(style);
  }

  // Le voile avale tout ce qui pourrait atteindre la page derrière lui.
  // Le clic est arrêté par le voile lui-même ; le clavier, lui, ne vise
  // aucun élément en particulier — il faut donc l'intercepter à la racine.
  function avaler(e) {
    if (voile && voile.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function avalerTouche(e) {
    // On laisse passer les raccourcis du navigateur lui-même (F5, F12,
    // Ctrl+Maj+I…) : bloquer la page ne veut pas dire prendre en otage
    // le navigateur de quelqu'un.
    if (e.key && e.key.indexOf("F") === 0 && e.key.length > 1) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function afficher() {
    poserStyle();
    if (voile) return;
    voile = document.createElement("div");
    voile.className = "voile-attente";
    voile.setAttribute("role", "alert");
    voile.setAttribute("aria-live", "assertive");
    voile.setAttribute("aria-busy", "true");
    voile.innerHTML =
      '<div class="voile-attente-carte">' +
        '<div class="voile-attente-rouet"></div>' +
        '<div class="voile-attente-texte">' +
          '<p class="voile-attente-titre"></p>' +
          '<p class="voile-attente-detail"></p>' +
        "</div>" +
      "</div>";
    document.body.appendChild(voile);
    ecrire();

    ["click", "mousedown", "mouseup", "dblclick", "contextmenu",
     "touchstart", "touchend", "wheel"].forEach(function (t) {
      document.addEventListener(t, avaler, true);
    });
    document.addEventListener("keydown", avalerTouche, true);
    document.addEventListener("keypress", avalerTouche, true);

    minuteurLong = setTimeout(function () {
      var d = voile && voile.querySelector(".voile-attente-detail");
      if (d) d.textContent = "C'est plus long que d'habitude — le serveur répond lentement. " +
        "Laissez faire, l'opération n'est pas perdue.";
    }, DELAI_MESSAGE_LONG);
  }

  function ecrire() {
    if (!voile) return;
    voile.querySelector(".voile-attente-titre").textContent = libelleCourant || "Un instant…";
    var d = voile.querySelector(".voile-attente-detail");
    d.textContent = detailCourant || "";
    d.style.display = detailCourant ? "" : "none";
  }

  function retirer() {
    if (minuteurAffichage) { clearTimeout(minuteurAffichage); minuteurAffichage = null; }
    if (minuteurLong) { clearTimeout(minuteurLong); minuteurLong = null; }
    if (!voile) return;
    ["click", "mousedown", "mouseup", "dblclick", "contextmenu",
     "touchstart", "touchend", "wheel"].forEach(function (t) {
      document.removeEventListener(t, avaler, true);
    });
    document.removeEventListener("keydown", avalerTouche, true);
    document.removeEventListener("keypress", avalerTouche, true);
    voile.remove();
    voile = null;
  }

  // ----- API -----

  // Ouvre le voile (ou approfondit une attente déjà ouverte).
  window.ouvrirAttente = function (libelle, detail) {
    libelleCourant = libelle || "Un instant…";
    detailCourant = detail || "";
    profondeur++;
    if (voile) { ecrire(); return; }
    if (minuteurAffichage) return;
    minuteurAffichage = setTimeout(function () {
      minuteurAffichage = null;
      if (profondeur > 0) afficher();
    }, DELAI_AVANT_AFFICHAGE);
  };

  // Change ce qui est écrit, sans toucher au décompte : pour une action en
  // plusieurs temps (« Envoi de l'image… » puis « Enregistrement… »).
  window.majAttente = function (libelle, detail) {
    if (profondeur === 0) return;
    if (libelle != null) libelleCourant = libelle;
    if (detail != null) detailCourant = detail;
    ecrire();
  };

  // Referme une attente. `tout` force la fermeture quel que soit le
  // décompte : filet de sécurité si un appel s'est perdu en route.
  window.fermerAttente = function (tout) {
    profondeur = tout ? 0 : Math.max(0, profondeur - 1);
    if (profondeur === 0) retirer();
  };

  // Le raccourci qui évite d'oublier le « finally » : quoi qu'il arrive,
  // succès, erreur ou exception, le voile se referme.
  window.pendantAttente = function (libelle, travail, detail) {
    window.ouvrirAttente(libelle, detail);
    var p;
    try {
      p = typeof travail === "function" ? travail() : travail;
    } catch (e) {
      window.fermerAttente();
      throw e;
    }
    return Promise.resolve(p).then(
      function (v) { window.fermerAttente(); return v; },
      function (e) { window.fermerAttente(); throw e; }
    );
  };

  // ----- Les attentes SANS réseau -----
  //
  // Repaginer un livre de quatre cents pages prend deux secondes, et ces
  // deux secondes-là sont pires que celles du réseau : le calcul monopolise
  // le fil d'exécution, la page se fige, plus rien ne répond. On croit avoir
  // planté l'éditeur.
  //
  // Le voile ordinaire n'y peut rien : il s'affiche par un minuteur, et un
  // minuteur ne se déclenche jamais pendant un calcul qui ne rend jamais la
  // main. Il faut donc l'afficher TOUT DE SUITE, laisser le navigateur le
  // peindre — d'où les deux images demandées, la seconde garantissant que la
  // première a bien été rendue —, et seulement alors se lancer dans le
  // calcul.
  function attendreUneImage() {
    return new Promise(function (ok) {
      var fait = false;
      function fini() { if (!fait) { fait = true; ok(); } }
      requestAnimationFrame(function () { requestAnimationFrame(fini); });
      // Filet indispensable : dans un onglet en arrière-plan, le navigateur
      // ne peint pas et requestAnimationFrame ne se déclenche JAMAIS. Sans ce
      // minuteur, l'action resterait suspendue indéfiniment, voile affiché —
      // il suffisait de changer d'onglet après avoir cliqué. Il n'y a alors
      // rien à peindre : on part sans attendre l'image.
      setTimeout(fini, 60);
    });
  }

  window.pendantAttenteLourde = function (libelle, travail, detail) {
    libelleCourant = libelle || "Un instant…";
    detailCourant = detail || "";
    profondeur++;
    poserStyle();
    if (!voile) afficher(); else ecrire();
    return attendreUneImage().then(function () {
      try {
        return travail();
      } finally {
        window.fermerAttente();
      }
    });
  };

  // Même service qu'envelopperAttente, pour les actions qui calculent au lieu
  // d'attendre le réseau.
  window.envelopperAttenteLourde = function (actions) {
    Object.keys(actions).forEach(function (nom) {
      var origine = window[nom];
      if (typeof origine !== "function") {
        if (window.console) console.warn("envelopperAttenteLourde : « " + nom + " » introuvable");
        return;
      }
      var libelle = actions[nom], detail = "";
      if (Array.isArray(libelle)) { detail = libelle[1]; libelle = libelle[0]; }
      window[nom] = function () {
        var args = arguments, self = this;
        return window.pendantAttenteLourde(libelle, function () {
          return origine.apply(self, args);
        }, detail);
      };
    });
  };

  // Enveloppe d'un coup plusieurs actions déjà écrites, par leur nom :
  //   envelopperAttente({ sauvegarder: "Enregistrement du livre…" })
  // Le corps de l'action n'a pas à être touché — et l'on voit d'un seul
  // endroit la liste de ce qui, dans une page, prend du temps.
  //
  // Une action qui pose une question AVANT d'aller sur le réseau (un
  // « confirm ») reste correcte : le fil d'exécution est bloqué pendant la
  // question, donc le minuteur d'affichage ne peut pas se déclencher ; et
  // si l'on répond « non », la promesse se règle en micro-tâche, donc avant
  // tout minuteur. Aucun clignotement.
  window.envelopperAttente = function (actions) {
    Object.keys(actions).forEach(function (nom) {
      var origine = window[nom];
      if (typeof origine !== "function") {
        if (window.console) console.warn("envelopperAttente : « " + nom + " » introuvable");
        return;
      }
      var libelle = actions[nom], detail = "";
      if (Array.isArray(libelle)) { detail = libelle[1]; libelle = libelle[0]; }
      window[nom] = function () {
        var args = arguments, self = this;
        return window.pendantAttente(libelle, function () {
          return origine.apply(self, args);
        }, detail);
      };
    });
  };

  // Une page qu'on quitte n'a plus d'attente à afficher : sans cela, un
  // retour arrière depuis le cache du navigateur ressusciterait le voile
  // sur une page qui, elle, ne travaille plus.
  window.addEventListener("pageshow", function (e) { if (e.persisted) window.fermerAttente(true); });
})();
