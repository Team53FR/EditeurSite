// Galerie : la liste des cartes, la création, l'import et l'export.
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var grille = $("grille");
  var message = $("message");
  var dlg = $("dlgNouvelle");

  function dire(texte, erreur) {
    message.textContent = texte || "";
    message.classList.toggle("erreur", !!erreur);
  }

  function nombre(n) { return Number(n).toLocaleString("fr-FR"); }

  function date(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  function pluriel(n, un, plusieurs) { return n + " " + (n > 1 ? plusieurs : un); }

  function telecharger(blob, nom) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function nomFichier(nom) {
    return (nom || "carte").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "carte";
  }

  // ----- Les cartes -----
  function tuile(meta, rang) {
    var a = document.createElement("article");
    a.className = "tuile";

    var visuel = document.createElement("a");
    visuel.className = "tuile-visuel";
    visuel.href = "editeur.html?id=" + encodeURIComponent(meta.id);
    visuel.setAttribute("aria-label", "Ouvrir « " + meta.nom + " »");
    if (meta.vignette) {
      var img = document.createElement("img");
      img.src = meta.vignette;
      img.alt = "";
      visuel.appendChild(img);
    }
    var num = document.createElement("span");
    num.className = "tuile-num";
    num.textContent = String(rang);
    var pastille = document.createElement("span");
    pastille.className = "tuile-pastille";
    pastille.textContent = nombre(meta.largeur) + " × " + nombre(meta.hauteur) + " km";
    visuel.appendChild(num);
    visuel.appendChild(pastille);
    a.appendChild(visuel);

    var corps = document.createElement("div");
    corps.className = "tuile-corps";
    var titre = document.createElement("h3");
    titre.textContent = meta.nom || "Sans titre";
    corps.appendChild(titre);

    function ligne(libelle, valeur) {
      var p = document.createElement("p");
      var l = document.createElement("span");
      l.className = "lib";
      l.textContent = libelle;
      p.appendChild(l);
      p.appendChild(document.createTextNode(" " + valeur));
      corps.appendChild(p);
    }
    var detail = [];
    if (meta.nbLieux) detail.push(pluriel(meta.nbLieux, "lieu", "lieux"));
    if (meta.nbEtiquettes) detail.push(pluriel(meta.nbEtiquettes, "nom", "noms"));
    if (meta.nbLignes) detail.push(pluriel(meta.nbLignes, "tracé", "tracés"));
    ligne("Contenu", detail.length ? detail.join(" · ") : "carte vierge");
    ligne("Modifiée", date(meta.majLe));
    a.appendChild(corps);

    var actions = document.createElement("div");
    actions.className = "tuile-actions";
    [
      ["Ouvrir", function () { location.href = "editeur.html?id=" + encodeURIComponent(meta.id); }],
      ["Renommer", function () { renommer(meta); }],
      ["Dupliquer", function () { dupliquer(meta); }],
      ["Exporter", function () { exporter(meta); }],
      ["Supprimer", function () { supprimer(meta); }]
    ].forEach(function (def) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "lien-action" + (def[0] === "Supprimer" ? " danger" : "");
      b.textContent = def[0];
      b.addEventListener("click", def[1]);
      actions.appendChild(b);
    });
    a.appendChild(actions);
    return a;
  }

  function afficher() {
    return Stockage.lister().then(function (liste) {
      grille.innerHTML = "";
      liste.forEach(function (meta, i) { grille.appendChild(tuile(meta, i + 1)); });
      $("vide").hidden = liste.length > 0;
    }).catch(function (e) {
      dire(e.message || "Impossible de lire les cartes.", true);
    });
  }

  function renommer(meta) {
    var nom = prompt("Nouveau nom de la carte :", meta.nom || "");
    if (nom == null || !nom.trim()) return;
    Stockage.lire(meta.id).then(function (carte) {
      carte.nom = nom.trim().slice(0, 80);
      return Stockage.ecrire(carte);
    }).then(afficher).catch(function (e) { dire(e.message, true); });
  }

  function dupliquer(meta) {
    Stockage.lire(meta.id).then(function (carte) {
      var copie = JSON.parse(JSON.stringify(carte));
      copie.id = Stockage.nouvelId();
      copie.nom = (carte.nom || "Sans titre") + " (copie)";
      copie.creeLe = copie.majLe = Date.now();
      return Stockage.ecrire(copie);
    }).then(afficher).catch(function (e) { dire(e.message, true); });
  }

  function exporter(meta) {
    Stockage.lire(meta.id).then(function (carte) {
      var blob = new Blob([JSON.stringify(carte)], { type: "application/json" });
      telecharger(blob, nomFichier(carte.nom) + ".worldmap.json");
    }).catch(function (e) { dire(e.message, true); });
  }

  function supprimer(meta) {
    if (!confirm("Supprimer « " + (meta.nom || "Sans titre") + " » ?\n\nCette action est définitive : pensez à l'exporter d'abord si vous voulez en garder une copie.")) return;
    Stockage.supprimer(meta.id).then(afficher).catch(function (e) { dire(e.message, true); });
  }

  // ----- Import -----
  $("btnImporter").addEventListener("click", function () { $("fichierImport").click(); });
  $("fichierImport").addEventListener("change", function (ev) {
    var f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var carte = JSON.parse(lecteur.result);
        if (!carte || typeof carte.largeur !== "number" || typeof carte.hauteur !== "number") throw new Error("Ce fichier n'est pas une carte WorldMap.");
        carte.traits = Array.isArray(carte.traits) ? carte.traits : [];
        carte.lignes = Array.isArray(carte.lignes) ? carte.lignes : [];
        carte.etiquettes = Array.isArray(carte.etiquettes) ? carte.etiquettes : [];
        carte.lieux = Array.isArray(carte.lieux) ? carte.lieux : [];
        carte.lacs = Array.isArray(carte.lacs) ? carte.lacs : [];
        carte.tampons = Array.isArray(carte.tampons) ? carte.tampons.filter(function (t) { return Moteur.TAMPONS.some(function (x) { return x.id === t.type; }); }) : [];
        if (!(carte.zbFixe > 0)) Moteur.fixerEchelleDecors(carte);
        carte.id = Stockage.nouvelId();
        carte.nom = String(carte.nom || "Carte importée").slice(0, 80);
        carte.majLe = Date.now();
        carte.creeLe = carte.creeLe || carte.majLe;
        Stockage.ecrire(carte).then(function () { dire("Carte importée."); return afficher(); })
          .catch(function (e) { dire(e.message, true); });
      } catch (e) {
        dire(e.message || "Fichier illisible.", true);
      }
    };
    lecteur.readAsText(f);
  });

  // ----- Nouvelle carte -----
  function choisir(groupe, bouton) {
    groupe.querySelectorAll(".choix-btn").forEach(function (b) { b.classList.toggle("actif", b === bouton); });
  }
  function actif(groupe, attribut) {
    var b = groupe.querySelector(".choix-btn.actif");
    return b ? b.getAttribute(attribut) : null;
  }

  $("btnNouvelle").addEventListener("click", function () {
    $("nMessage").textContent = "";
    $("nNom").value = "";
    dlg.showModal();
    $("nNom").focus();
  });
  $("nAnnuler").addEventListener("click", function () { dlg.close(); });

  $("nTailles").addEventListener("click", function (ev) {
    var b = ev.target.closest(".choix-btn");
    if (!b) return;
    choisir($("nTailles"), b);
    $("nLarg").value = b.dataset.l;
    $("nHaut").value = b.dataset.h;
  });
  ["nLarg", "nHaut"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      $("nTailles").querySelectorAll(".choix-btn").forEach(function (b) { b.classList.remove("actif"); });
    });
  });
  $("nThemes").addEventListener("click", function (ev) {
    var b = ev.target.closest(".choix-btn");
    if (b) choisir($("nThemes"), b);
  });
  $("nDepart").addEventListener("click", function (ev) {
    var b = ev.target.closest(".choix-btn");
    if (b) choisir($("nDepart"), b);
  });

  $("formNouvelle").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var largeur = parseFloat($("nLarg").value), hauteur = parseFloat($("nHaut").value);
    if (!(largeur >= 50 && largeur <= 40000 && hauteur >= 50 && hauteur <= 40000)) {
      $("nMessage").textContent = "La largeur et la hauteur doivent être comprises entre 50 et 40 000 km.";
      return;
    }
    var carte = {
      id: Stockage.nouvelId(),
      nom: $("nNom").value.trim().slice(0, 80) || "Nouvelle carte",
      largeur: largeur,
      hauteur: hauteur,
      theme: actif($("nThemes"), "data-theme") || "atlas",
      traits: [], lignes: [], etiquettes: [], lieux: [], lacs: [], tampons: [],
      vue: null,
      creeLe: Date.now(),
      majLe: Date.now(),
      version: 1
    };
    Moteur.fixerEchelleDecors(carte);       // les décors automatiques gardent leur place, quelle que soit la taille ensuite
    if (actif($("nDepart"), "data-depart") === "aleatoire") {
      Generateur.monde(carte, Math.floor(Math.random() * 1e9));
    }
    $("nCreer").disabled = true;
    // Les polices doivent être prêtes avant le premier rendu (la vignette).
    var polices = document.fonts && document.fonts.load ? document.fonts.load("700 20px 'EB Garamond'") : Promise.resolve();
    Promise.resolve(polices).catch(function () {}).then(function () {
      carte.vignette = Moteur.vignette(carte);
      return Stockage.ecrire(carte);
    }).then(function () {
      location.href = "editeur.html?id=" + encodeURIComponent(carte.id);
    }).catch(function (e) {
      $("nCreer").disabled = false;
      $("nMessage").textContent = e.message || "Création impossible.";
    });
  });

  afficher();
})();
