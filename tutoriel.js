// ===== Moteur de visite guidée (tutoriel pas à pas) =====
//
// Usage :
//   lancerTutoriel([
//     { cible: "#monElement", titre: "…", texte: "…" },   // cible = sélecteur CSS
//     { cible: null,          titre: "…", texte: "…" },   // cible null = carte centrée
//   ], { cle: "tuto_xxx_v1", forcer: false });
//
// - Sans "forcer", le tutoriel ne se relance pas s'il a déjà été terminé
//   (mémorisé dans localStorage sous la clé donnée).
// - "forcer: true" le rejoue toujours (bouton « ? »).

(function () {
  let etat = null;

  function cibler(sel) {
    if (!sel) return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  window.lancerTutoriel = function (etapes, options) {
    options = options || {};
    if (!etapes || !etapes.length) return;
    if (options.cle && !options.forcer) {
      try { if (localStorage.getItem(options.cle) === "1") return; } catch (e) {}
    }
    fermer();
    etat = { etapes, options, i: 0, els: construire() };
    montrer(0);
    window.addEventListener("resize", repositionner);
    window.addEventListener("scroll", repositionner, true);
    document.addEventListener("keydown", surTouche, true);
  };

  function construire() {
    const bloqueur = document.createElement("div");
    bloqueur.className = "tuto-bloqueur";

    const spot = document.createElement("div");
    spot.className = "tuto-spot";

    const carte = document.createElement("div");
    carte.className = "tuto-carte";
    carte.innerHTML =
      '<h4 class="tuto-titre"></h4>' +
      '<p class="tuto-texte"></p>' +
      '<div class="tuto-actions">' +
        '<span class="tuto-compteur"></span>' +
        '<button class="tuto-btn fantome" data-act="passer">Passer</button>' +
        '<button class="tuto-btn fantome" data-act="prec">Précédent</button>' +
        '<button class="tuto-btn primaire" data-act="suiv">Suivant</button>' +
      '</div>';

    document.body.appendChild(bloqueur);
    document.body.appendChild(spot);
    document.body.appendChild(carte);

    carte.addEventListener("click", (e) => {
      const a = e.target.getAttribute("data-act");
      if (a) action(a);
    });
    return { bloqueur, spot, carte };
  }

  function action(a) {
    if (!etat) return;
    if (a === "passer") { fermerEtMarquer(); return; }
    if (a === "prec") { montrer(etat.i - 1); return; }
    if (a === "suiv") {
      if (etat.i >= etat.etapes.length - 1) fermerEtMarquer();
      else montrer(etat.i + 1);
    }
  }

  function surTouche(e) {
    if (!etat) return;
    if (e.key === "Escape") { e.preventDefault(); fermerEtMarquer(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); action("suiv"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); action("prec"); }
  }

  function montrer(i) {
    if (!etat) return;
    i = Math.max(0, Math.min(etat.etapes.length - 1, i));
    etat.i = i;
    const et = etat.etapes[i];
    const { carte } = etat.els;

    carte.querySelector(".tuto-titre").textContent = et.titre || "";
    carte.querySelector(".tuto-texte").textContent = et.texte || "";
    carte.querySelector(".tuto-compteur").textContent = (i + 1) + " / " + etat.etapes.length;
    carte.querySelector('[data-act="prec"]').style.visibility = i === 0 ? "hidden" : "visible";
    carte.querySelector('[data-act="suiv"]').textContent =
      i === etat.etapes.length - 1 ? "Terminer" : "Suivant";

    const cible = cibler(et.cible);
    if (cible && cible.scrollIntoView) {
      cible.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }
    // Laisser le temps au défilement avant de positionner la surbrillance.
    setTimeout(() => positionner(et, cibler(et.cible)), cible ? 280 : 0);
  }

  function positionner(et, cible) {
    if (!etat) return;
    const { spot, carte } = etat.els;
    if (cible && cible.getBoundingClientRect) {
      const r = cible.getBoundingClientRect();
      const pad = 6;
      spot.style.display = "block";
      spot.style.left = (r.left - pad) + "px";
      spot.style.top = (r.top - pad) + "px";
      spot.style.width = (r.width + 2 * pad) + "px";
      spot.style.height = (r.height + 2 * pad) + "px";
      placerCarte(r);
    } else {
      spot.style.display = "none";
      carte.style.left = "50%";
      carte.style.top = "50%";
      carte.style.transform = "translate(-50%, -50%)";
    }
  }

  function placerCarte(r) {
    const { carte } = etat.els;
    carte.style.transform = "none";
    const cw = carte.offsetWidth, ch = carte.offsetHeight, m = 14;
    const vw = window.innerWidth, vh = window.innerHeight;

    // Ordre d'essai : sous la cible, au-dessus, à droite, à gauche, sinon
    // par-dessus (cas d'une cible qui occupe presque tout l'écran).
    let top, left;
    if (r.bottom + m + ch <= vh) {
      top = r.bottom + m;
      left = r.left + r.width / 2 - cw / 2;
    } else if (r.top - m - ch >= 0) {
      top = r.top - m - ch;
      left = r.left + r.width / 2 - cw / 2;
    } else if (r.right + m + cw <= vw) {
      left = r.right + m;
      top = r.top + r.height / 2 - ch / 2;
    } else if (r.left - m - cw >= 0) {
      left = r.left - m - cw;
      top = r.top + r.height / 2 - ch / 2;
    } else {
      left = r.left + r.width / 2 - cw / 2;
      top = r.top + r.height / 2 - ch / 2;
    }

    left = Math.max(m, Math.min(left, vw - cw - m));
    top = Math.max(m, Math.min(top, vh - ch - m));

    carte.style.left = left + "px";
    carte.style.top = top + "px";
  }

  function repositionner() {
    if (!etat) return;
    const et = etat.etapes[etat.i];
    positionner(et, cibler(et.cible));
  }

  function fermer() {
    document.querySelectorAll(".tuto-bloqueur, .tuto-spot, .tuto-carte").forEach(e => e.remove());
    window.removeEventListener("resize", repositionner);
    window.removeEventListener("scroll", repositionner, true);
    document.removeEventListener("keydown", surTouche, true);
    etat = null;
  }

  function fermerEtMarquer() {
    if (etat && etat.options && etat.options.cle) {
      try { localStorage.setItem(etat.options.cle, "1"); } catch (e) {}
    }
    fermer();
  }
})();
