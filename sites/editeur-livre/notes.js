// =====================================================================
//  Notes de livre : des pages d'idées rangées par onglets
// =====================================================================
//
//  Un jeu de notes par livre, découpé en onglets (personnages, intrigues,
//  pistes…), pour y poser ce qu'on ne veut pas oublier. Privé — il ne paraît
//  jamais avec le livre, même publié (voir chargerNotesLivre dans script.js
//  pour la raison).
//
//  Le module est partagé par la bibliothèque et par l'éditeur, qui n'ont ni
//  les mêmes feuilles de style ni les mêmes variables : la fenêtre construit
//  donc son propre balisage et n'emprunte que ses couleurs, avec une valeur de
//  repli pour chacune (voir notes.css).
//
//  Enregistrement AUTOMATIQUE. Une page d'idées s'écrit au fil de l'eau ; un
//  bouton « Enregistrer » qu'on oublie, c'est une idée perdue. On enregistre
//  donc peu après la dernière frappe, et à la fermeture.
//
//  ----- Format de stockage -----
//
//  Tout tient dans la colonne `contenu` (texte) de livre_notes, sous la forme
//  d'un JSON  {"v":2,"onglets":[{"id","titre","texte"}, …]}. Les notes écrites
//  avant les onglets sont du texte brut : on les lit comme un premier onglet
//  « Notes », et le format ne change qu'à la prochaine modification — ouvrir
//  des notes n'écrit jamais rien.
//
//  `texte` est du texte à balisage MINIMAL : des retours à la ligne, et seulement
//  <b> et <i> (gras, italique, par Ctrl+B et Ctrl+I). Tout < & > du texte est
//  échappé, donc une balise ne peut venir que de ce balisage. À la lecture on
//  reconstruit le contenu nœud par nœud (createTextNode, createElement) : on ne
//  confie JAMAIS ce texte à innerHTML. Même une ligne trafiquée à la main dans
//  la base ne produirait que du texte inerte, pas du code.

(function () {
  "use strict";

  const DELAI_MS = 700;        // pause après la dernière frappe, avant d'enregistrer
  const TAILLE_MAX = 200000;   // la limite de la colonne (voir schema.sql)
  const ONGLETS_MAX = 20;
  const TITRE_MAX = 40;
  const TITRE_DEFAUT = "Notes";

  // Un seul jeu de notes ouvert à la fois : null quand la fenêtre est fermée.
  let etat = null;

  // =====================================================================
  //  Format : de la page vers le texte stocké, et retour
  // =====================================================================

  const BLOCS = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/;
  const IGNORES = /^(SCRIPT|STYLE|TEMPLATE)$/;

  function echapper(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // Une seule passe : « &amp;lt; » doit redonner « &lt; », pas « < ».
  function desechapper(t) {
    return t.replace(/&(lt|gt|amp);/g, (m, nom) => ({ lt: "<", gt: ">", amp: "&" })[nom]);
  }

  // Le texte d'un onglet sans sa mise en forme (pour compter les mots).
  function texteBrut(texte) {
    return desechapper((texte || "").replace(/<\/?[bi]>/g, ""));
  }

  // Gras / italique d'un nœud, hérités de ses parents. Les navigateurs ne
  // posent pas tous <b> : certains (ou un texte collé) passent par un style.
  function formatDe(noeud, b, i) {
    const nom = noeud.nodeName, s = noeud.style || {};
    if (nom === "B" || nom === "STRONG") b = true;
    if (nom === "I" || nom === "EM") i = true;
    if (s.fontWeight) b = s.fontWeight === "bold" || s.fontWeight === "bolder" || parseInt(s.fontWeight, 10) >= 600;
    if (s.fontStyle) i = s.fontStyle === "italic" || s.fontStyle === "oblique";
    return [b, i];
  }

  // La page → des lignes, chacune une suite de morceaux {t, b, i}.
  //
  // Une zone modifiable n'a pas de structure fixe : Entrée fabrique des <div>
  // (ou des <br> selon le navigateur), et un texte collé ou tapé peut contenir de
  // vrais « \n ». On lit donc tout cela comme des LIGNES, et on ignore le reste
  // du balisage — il n'a pas de place dans le format.
  function lignesDepuisDOM(racine) {
    const lignes = [];
    let ligne = null;                       // ligne en cours ; null = aucune d'ouverte
    const ouvrir = () => { if (!ligne) { ligne = []; lignes.push(ligne); } return ligne; };
    const fermer = () => { ligne = null; };
    const estBloc = (n) => n === racine || BLOCS.test(n.nodeName);

    function enfants(parent, b, i) {
      const liste = [...parent.childNodes];
      liste.forEach((n, k) => {
        if (n.nodeType === 3) {
          const parties = n.data.split(/\r\n?|\n/);
          parties.forEach((p, j) => {
            if (j > 0) fermer();
            if (p) ouvrir().push({ t: p, b, i });
            else if (j < parties.length - 1) ouvrir();   // ligne vide entre deux « \n »
          });
          return;
        }
        if (n.nodeType !== 1 || IGNORES.test(n.nodeName)) return;
        if (n.nodeName === "BR") {
          // Un <br> qui clôt un bloc n'est qu'un bouche-trou : la ligne existe
          // déjà (vide), il ne la fait pas suivre d'une autre.
          const dernier = liste.slice(k + 1).every((s) => s.nodeType === 3 && !s.data);
          ouvrir();
          if (!(dernier && estBloc(parent))) fermer();
          return;
        }
        const [nb, ni] = formatDe(n, b, i);
        if (estBloc(n)) { fermer(); enfants(n, nb, ni); fermer(); }
        else enfants(n, nb, ni);
      });
    }
    enfants(racine, false, false);
    return lignes;
  }

  // Des lignes → le texte stocké. Les morceaux voisins de même forme sont
  // fusionnés : une phrase tapée lettre à lettre n'est pas N balises.
  function serialiser(lignes) {
    return lignes.map((morceaux) => {
      const fusion = [];
      morceaux.forEach((m) => {
        const d = fusion[fusion.length - 1];
        if (d && d.b === m.b && d.i === m.i) d.t += m.t;
        else fusion.push({ t: m.t, b: m.b, i: m.i });
      });
      return fusion.map((m) => {
        let s = echapper(m.t);
        if (m.i) s = "<i>" + s + "</i>";
        if (m.b) s = "<b>" + s + "</b>";
        return s;
      }).join("");
    }).join("\n");
  }

  // Une ligne stockée → ses morceaux. Une balise qu'on ne connaît pas (il ne
  // peut pas y en avoir : voir l'en-tête) resterait du texte.
  function morceauxDepuisLigne(ligne) {
    const morceaux = [];
    let b = false, i = false;
    ligne.split(/(<\/?[bi]>)/).forEach((m) => {
      if (m === "<b>") b = true;
      else if (m === "</b>") b = false;
      else if (m === "<i>") i = true;
      else if (m === "</i>") i = false;
      else if (m) morceaux.push({ t: desechapper(m), b, i });
    });
    return morceaux;
  }

  // Le texte stocké → la page, construite nœud par nœud.
  function remplir(editeur, texte) {
    editeur.replaceChildren();
    (texte || "").split("\n").forEach((ligne) => {
      const div = document.createElement("div");
      const morceaux = morceauxDepuisLigne(ligne);
      if (!morceaux.length) div.appendChild(document.createElement("br"));   // ligne vide visible
      morceaux.forEach((m) => {
        let n = document.createTextNode(m.t);
        if (m.i) { const e = document.createElement("i"); e.appendChild(n); n = e; }
        if (m.b) { const e = document.createElement("b"); e.appendChild(n); n = e; }
        div.appendChild(n);
      });
      editeur.appendChild(div);
    });
  }

  function texteDepuisPage(editeur) { return serialiser(lignesDepuisDOM(editeur)); }

  // ----- le document : la liste des onglets -----

  function nouvelId(onglets) {
    let id;
    do { id = "o" + Math.random().toString(36).slice(2, 8); }
    while (onglets.some((o) => o.id === id));
    return id;
  }

  // Le contenu de la colonne → des onglets. Ne lève jamais : ce qu'on ne sait
  // pas lire s'affiche comme du texte, plutôt que de disparaître.
  function lireContenu(brut) {
    brut = brut || "";
    if (brut.startsWith('{"v":2,')) {
      try {
        const d = JSON.parse(brut);
        if (d && Array.isArray(d.onglets) && d.onglets.length) {
          const onglets = [];
          d.onglets.forEach((o) => {
            o = o || {};
            let id = typeof o.id === "string" ? o.id : "";
            if (!id || onglets.some((x) => x.id === id)) id = nouvelId(onglets);
            onglets.push({
              id,
              titre: String(o.titre || "").trim().slice(0, TITRE_MAX) || TITRE_DEFAUT,
              texte: typeof o.texte === "string" ? o.texte.replace(/\r\n?/g, "\n") : ""
            });
          });
          return onglets;
        }
      } catch (e) { /* illisible : repli ci-dessous, en texte */ }
    }
    // Notes d'avant les onglets : du texte brut, donc à échapper. L'identifiant
    // est FIXE pour que deux ouvertures donnent le même document (sinon deux
    // appareils verraient chacun « du changement » dans des notes intactes).
    return [{ id: "n1", titre: TITRE_DEFAUT, texte: echapper(brut.replace(/\r\n?/g, "\n")) }];
  }

  function ecrireContenu(onglets) {
    return JSON.stringify({
      v: 2,
      onglets: onglets.map((o) => ({ id: o.id, titre: o.titre, texte: o.texte }))
    });
  }

  // =====================================================================
  //  La fenêtre
  // =====================================================================

  function compterMotsTexte(texte) {
    const t = (texte || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function creer(balise, classe, texte) {
    const el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte !== undefined) el.textContent = texte;
    return el;
  }

  function curseurALaFin(editeur) {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    const dernier = editeur.lastElementChild;
    if (!dernier) r.setStart(editeur, 0);
    else { r.selectNodeContents(dernier); r.collapse(dernier.textContent === ""); }   // vide : au début ; sinon : à la fin
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // `declencheur` est le bouton qui ouvre la fenêtre : c'est lui qui retrouve le
  // focus à la fermeture. On ne s'en remet pas à document.activeElement, car
  // plusieurs navigateurs (Safari en tête) ne donnent PAS le focus à un bouton
  // qu'on clique : l'élément actif serait alors la page elle-même, et le clavier
  // repartirait du haut de la page au lieu de l'endroit d'où l'on vient.
  function ouvrirNotesLivre(livreId, titreLivre, declencheur) {
    if (etat) return;                       // déjà ouvertes : pas de seconde fenêtre

    const retourFocus = declencheur || document.activeElement;

    const fond = creer("div", "notes-fond");
    const carte = creer("div", "notes-carte");
    carte.setAttribute("role", "dialog");
    carte.setAttribute("aria-modal", "true");
    carte.setAttribute("aria-labelledby", "notesTitre");

    const entete = creer("div", "notes-entete");
    const titre = creer("h3", "notes-titre", "Notes · " + (titreLivre || "Sans titre"));
    titre.id = "notesTitre";
    const fermer = creer("button", "notes-fermer", "✕");
    fermer.type = "button";
    fermer.setAttribute("aria-label", "Fermer les notes");
    entete.append(titre, fermer);

    const aide = creer("p", "notes-aide",
      "Vos idées pour ce livre, rangées par onglets. Ctrl+B met en gras, Ctrl+I en italique. " +
      "Visibles de vous seul, jamais publiées avec le livre. Enregistrement automatique.");

    // Le message de conflit : masqué tant qu'il n'y a rien à dire.
    const alerte = creer("div", "notes-alerte");
    alerte.setAttribute("role", "alert");
    alerte.hidden = true;

    const barre = creer("div", "notes-onglets");
    barre.setAttribute("role", "tablist");
    barre.setAttribute("aria-label", "Onglets de notes");

    // La zone d'écriture : une zone modifiable (et non un <textarea>, qui ne sait
    // pas montrer du gras). Elle ne reçoit que du texte, par remplir().
    const editeur = creer("div", "notes-texte");
    editeur.setAttribute("role", "textbox");
    editeur.setAttribute("aria-multiline", "true");
    editeur.setAttribute("aria-label", "Notes du livre");
    editeur.dataset.placeholder = "Une idée, un personnage, une scène à écrire…";
    editeur.spellcheck = true;
    editeur.contentEditable = "false";      // le temps de lire les notes existantes
    editeur.setAttribute("aria-disabled", "true");

    const pied = creer("div", "notes-pied");
    const statut = creer("span", "notes-etat attente", "Chargement…");
    statut.setAttribute("aria-live", "polite");
    const mots = creer("span", "notes-mots", "");
    pied.append(statut, mots);

    carte.append(entete, aide, alerte, barre, editeur, pied);
    fond.appendChild(carte);
    document.body.appendChild(fond);

    etat = {
      livreId, fond, carte, editeur, barre, statut, mots, alerte,
      onglets: [],             // [{id, titre, texte}] — `texte` de l'onglet actif est resynchronisé à la demande
      actifId: null,
      version: null,           // version lue ; null = les notes n'existent pas encore
      enregistre: "",          // le dernier contenu connu du serveur
      minuteur: null,
      enVol: null,             // la promesse de l'enregistrement en cours, ou null
      conflit: false,
      charge: false,
      renommage: null,         // {valider, annuler} pendant qu'on renomme un onglet
      retourFocus
    };

    // ----- état affiché -----
    etat.dire = (message, nature) => {
      statut.textContent = message;
      statut.className = "notes-etat " + (nature || "");
    };

    // ----- lecture -----
    const lire = async () => {
      etat.dire("Chargement…", "attente");
      alerte.hidden = true;
      try {
        const notes = await chargerNotesLivre(livreId);
        if (etat === null || etat.livreId !== livreId) return;   // fermée entre-temps
        etat.version = notes.version;
        etat.onglets = lireContenu(notes.contenu);
        etat.charge = true;
        activer(etat.onglets[0].id, { focus: true });
        // Le point de comparaison est ce qu'on VOIT, pas ce que le serveur a
        // envoyé : des notes d'avant les onglets (ou à peine normalisées) ne
        // doivent pas déclencher d'écriture à la seule ouverture.
        etat.enregistre = contenuCourant();
        etat.dire("Enregistré", "ok");
      } catch (e) {
        if (etat === null) return;
        etat.dire("Lecture impossible : " + e.message, "erreur");
        afficherAlerte("Les notes n'ont pas pu être lues : " + e.message, [
          ["Réessayer", lire]
        ]);
      }
    };

    // ----- écriture dans la zone -----
    editeur.addEventListener("input", () => {
      majMots();
      planifier();
    });

    // Ctrl+B / Ctrl+I, et rien d'autre : la mise en forme tient à ces deux
    // raccourcis. Le navigateur sait aussi souligner, barrer… des styles que le
    // format n'a pas — ils s'afficheraient puis disparaîtraient à la réouverture.
    editeur.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || !etat.charge) return;
      const touche = e.key.toLowerCase();
      if (touche === "u") { e.preventDefault(); return; }
      if (e.shiftKey) return;
      if (touche === "b" || touche === "i") {
        e.preventDefault();
        try { document.execCommand("styleWithCSS", false, false); } catch (x) { /* balise par défaut */ }
        document.execCommand(touche === "b" ? "bold" : "italic");
      }
    });
    editeur.addEventListener("beforeinput", (e) => {
      const t = e.inputType || "";
      if (t === "insertFromDrop" || (t.startsWith("format") && t !== "formatBold" && t !== "formatItalic")) {
        e.preventDefault();
      }
    });
    // Coller = du texte, jamais du balisage venu d'ailleurs. Déposer aussi est
    // refusé : ce serait la même porte, sans le même contrôle.
    editeur.addEventListener("paste", (e) => {
      e.preventDefault();
      const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
      if (t) document.execCommand("insertText", false, t.replace(/\r\n?/g, "\n"));
    });
    editeur.addEventListener("drop", (e) => e.preventDefault());

    // ----- onglets -----
    barre.addEventListener("keydown", (e) => {
      const nom = e.target.closest && e.target.closest(".notes-onglet-nom");
      if (!nom) return;
      const k = etat.onglets.findIndex((o) => o.id === nom.parentNode.dataset.id);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const cible = etat.onglets[k + (e.key === "ArrowRight" ? 1 : -1)];
        if (cible) { e.preventDefault(); activer(cible.id, { focusOnglet: true }); }
      } else if (e.key === "F2") {
        e.preventDefault();
        renommer(nom.parentNode.dataset.id);
      }
    });

    fermer.addEventListener("click", () => fermerNotesLivre());

    // Un clic sur le fond ferme, mais seulement s'il a COMMENCÉ sur le fond :
    // sélectionner du texte et relâcher la souris hors de la carte ne doit pas
    // fermer la fenêtre — et vider le geste de l'auteur.
    let debutSurFond = false;
    fond.addEventListener("mousedown", (e) => { debutSurFond = e.target === fond; });
    fond.addEventListener("click", (e) => {
      if (debutSurFond && e.target === fond) fermerNotesLivre();
    });

    // Les raccourcis de l'éditeur (annuler, rétablir, enregistrer le livre…) sont
    // posés sur document : sans cet arrêt, Ctrl+Z dans les notes annulerait le
    // texte DU LIVRE, derrière la fenêtre. Échap est traité à part, plus bas.
    carte.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { piegerTab(e); return; }
      if (e.key !== "Escape") e.stopPropagation();
    });

    document.addEventListener("keydown", surEchap, true);

    lire();
  }

  // ----- le contenu courant -----

  function ongletActif() { return etat.onglets.find((o) => o.id === etat.actifId); }

  // Reporte la zone d'écriture dans l'onglet actif : la page est la vérité tant
  // qu'on écrit, le tableau n'est qu'à jour après cet appel.
  function synchroniser() {
    const o = etat.charge && ongletActif();
    if (o) o.texte = texteDepuisPage(etat.editeur);
  }
  function contenuCourant() {
    synchroniser();
    return ecrireContenu(etat.onglets);
  }

  function majMots() {
    const brut = texteBrut(texteDepuisPage(etat.editeur));
    const n = compterMotsTexte(brut);
    etat.mots.textContent = n + (n > 1 ? " mots" : " mot");
    etat.editeur.dataset.vide = brut === "" ? "1" : "";
  }

  // Programme un enregistrement. En conflit, on attend que l'auteur tranche.
  function planifier() {
    if (!etat.charge || etat.conflit) return;
    etat.dire("Modifié…", "attente");
    clearTimeout(etat.minuteur);
    etat.minuteur = setTimeout(enregistrer, DELAI_MS);
  }

  // ----- gestion des onglets -----

  function activer(id, options) {
    options = options || {};
    if (etat.renommage) etat.renommage.valider();
    synchroniser();
    etat.actifId = id;
    remplir(etat.editeur, ongletActif().texte);
    etat.editeur.contentEditable = "true";
    etat.editeur.removeAttribute("aria-disabled");
    dessinerOnglets();
    majMots();
    if (options.focusOnglet) {
      const nom = nomDOnglet(id);
      if (nom) nom.focus();
    } else if (options.focus !== false) {
      etat.editeur.focus();
      curseurALaFin(etat.editeur);
    }
  }

  function elementOnglet(id) {
    return [...etat.barre.children].find((el) => el.dataset && el.dataset.id === id);
  }
  function nomDOnglet(id) {
    const el = elementOnglet(id);
    return el && el.querySelector(".notes-onglet-nom");
  }

  function dessinerOnglets() {
    const barre = etat.barre;
    barre.replaceChildren();
    etat.onglets.forEach((o) => {
      const actif = o.id === etat.actifId;
      const pastille = creer("div", "notes-onglet" + (actif ? " actif" : ""));
      pastille.dataset.id = o.id;
      pastille.setAttribute("role", "presentation");

      const nom = creer("button", "notes-onglet-nom", o.titre);
      nom.type = "button";
      nom.setAttribute("role", "tab");
      nom.setAttribute("aria-selected", actif ? "true" : "false");
      nom.tabIndex = actif ? 0 : -1;
      nom.title = actif ? o.titre + " — double-clic ou F2 pour renommer" : o.titre;
      nom.addEventListener("click", () => { if (o.id !== etat.actifId) activer(o.id); });
      nom.addEventListener("dblclick", () => renommer(o.id));
      pastille.appendChild(nom);

      // Les actions n'existent que sur l'onglet ouvert : elles portent sur lui.
      if (actif) {
        const ren = creer("button", "notes-onglet-act", "✎");
        ren.type = "button";
        ren.title = "Renommer l'onglet";
        ren.setAttribute("aria-label", "Renommer l'onglet « " + o.titre + " »");
        ren.addEventListener("click", () => renommer(o.id));
        pastille.appendChild(ren);

        if (etat.onglets.length > 1) {
          const sup = creer("button", "notes-onglet-act", "✕");
          sup.type = "button";
          sup.title = "Supprimer l'onglet";
          sup.setAttribute("aria-label", "Supprimer l'onglet « " + o.titre + " »");
          sup.addEventListener("click", () => supprimerOnglet(o.id));
          pastille.appendChild(sup);
        }
      }
      barre.appendChild(pastille);
    });

    const ajout = creer("button", "notes-onglet-ajout", "+");
    ajout.type = "button";
    ajout.setAttribute("aria-label", "Ajouter un onglet");
    const plein = etat.onglets.length >= ONGLETS_MAX;
    ajout.disabled = plein;
    ajout.title = plein ? ONGLETS_MAX + " onglets au maximum" : "Ajouter un onglet";
    ajout.addEventListener("click", ajouterOnglet);
    barre.appendChild(ajout);
  }

  function ajouterOnglet() {
    if (!etat.charge || etat.onglets.length >= ONGLETS_MAX) return;
    synchroniser();
    let n = etat.onglets.length + 1;
    while (etat.onglets.some((o) => o.titre === "Onglet " + n)) n++;
    const o = { id: nouvelId(etat.onglets), titre: "Onglet " + n, texte: "" };
    etat.onglets.push(o);
    activer(o.id, { focus: false });
    planifier();
    renommer(o.id);                       // le premier geste utile est de le nommer
  }

  function supprimerOnglet(id) {
    if (etat.onglets.length <= 1) return;
    synchroniser();
    const k = etat.onglets.findIndex((o) => o.id === id);
    const o = etat.onglets[k];
    // Un onglet vide part sans question ; un onglet écrit, jamais : ces notes
    // s'enregistrent toutes seules, il n'y aurait plus de retour en arrière.
    if (texteBrut(o.texte).trim() !== "" &&
        !confirm("Supprimer l'onglet « " + o.titre + " » ?\n\nTout ce qu'il contient sera perdu.")) return;
    etat.onglets.splice(k, 1);
    activer(etat.onglets[Math.max(0, k - 1)].id);
    planifier();
  }

  // Renomme sur place : le nom de l'onglet devient un champ.
  function renommer(id) {
    if (etat.renommage) etat.renommage.valider();
    const o = etat.onglets.find((x) => x.id === id);
    const pastille = elementOnglet(id);
    const nom = nomDOnglet(id);
    if (!o || !pastille || !nom) return;

    const champ = creer("input", "notes-onglet-saisie");
    champ.type = "text";
    champ.value = o.titre;
    champ.maxLength = TITRE_MAX;
    champ.setAttribute("aria-label", "Nom de l'onglet");
    nom.replaceWith(champ);
    champ.focus();
    champ.select();

    let fini = false;
    const terminer = (garder) => {
      if (fini) return;
      fini = true;
      etat.renommage = null;
      const nouveau = champ.value.trim().slice(0, TITRE_MAX);
      if (garder && nouveau && nouveau !== o.titre) { o.titre = nouveau; planifier(); }
      if (champ.isConnected) dessinerOnglets();
    };
    etat.renommage = { valider: () => terminer(true), annuler: () => terminer(false) };

    champ.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        terminer(true);
        etat.editeur.focus();
        curseurALaFin(etat.editeur);
      }
    });
    champ.addEventListener("blur", () => terminer(true));
  }

  // Les boutons de l'alerte : [[libellé, action], …].
  function afficherAlerte(message, actions) {
    const alerte = etat.alerte;
    alerte.replaceChildren();
    alerte.appendChild(creer("p", "notes-alerte-texte", message));
    const boutons = creer("div", "notes-alerte-actions");
    actions.forEach(([libelle, action]) => {
      const b = creer("button", "notes-bouton", libelle);
      b.type = "button";
      b.addEventListener("click", action);
      boutons.appendChild(b);
    });
    alerte.appendChild(boutons);
    alerte.hidden = false;
  }

  // Enregistre le contenu courant. Rend true si, à la fin, tout ce qui est écrit
  // est enregistré — c'est ce que fermer() attend pour se refermer.
  //
  // Un seul enregistrement à la fois : une frappe pendant l'envoi ne lance pas
  // un second envoi concurrent, qui partirait avec la MÊME version et se ferait
  // refuser comme un faux conflit. Elle attend la fin du premier, et le texte
  // est alors renvoyé avec la version à jour.
  async function enregistrer() {
    if (!etat) return true;
    clearTimeout(etat.minuteur);
    if (etat.enVol) return etat.enVol;

    etat.enVol = (async () => {
      while (etat && etat.charge && !etat.conflit) {
        const envoye = contenuCourant();
        if (envoye === etat.enregistre) break;
        if (envoye.length > TAILLE_MAX) {
          etat.dire("Trop long pour être enregistré : raccourcissez les notes.", "erreur");
          return false;
        }
        etat.dire("Enregistrement…", "attente");
        try {
          etat.version = await enregistrerNotesLivre(etat.livreId, envoye, etat.version);
          etat.enregistre = envoye;
        } catch (e) {
          if (!etat) return false;
          if (e.conflit) {
            etat.conflit = true;
            etat.dire("Modifiées ailleurs", "erreur");
            afficherAlerte(
              "Ces notes ont été modifiées ailleurs — un autre onglet ou un autre " +
              "appareil — depuis que vous les avez ouvertes. Rien n'a été écrasé.", [
                ["Recharger les notes", rechargerNotes],
                ["Garder ma version", garderMaVersion]
              ]);
          } else {
            etat.dire("Non enregistré : " + e.message, "erreur");
          }
          return false;
        }
      }
      if (!etat) return true;
      // Un conflit encore en attente n'est PAS un succès. La boucle ci-dessus
      // est sautée tant que l'auteur n'a pas tranché, et sans cette garde on
      // retombait ici : « Enregistré » affiché, l'alerte masquée, et fermer()
      // refermait la fenêtre — en jetant le texte que la base n'a jamais reçu.
      if (etat.conflit) return false;
      etat.dire("Enregistré", "ok");
      etat.alerte.hidden = true;
      return true;
    })();

    try { return await etat.enVol; }
    finally { if (etat) etat.enVol = null; }
  }

  // Conflit : on jette le contenu local au profit de celui du serveur.
  async function rechargerNotes() {
    try {
      const notes = await chargerNotesLivre(etat.livreId);
      const ancien = etat.actifId;
      // Plus d'onglet actif AVANT de réafficher : activer() reporte la page dans
      // l'onglet actif, et ici le tableau est déjà celui du serveur — le texte local
      // viendrait écraser, onglet de même identifiant, ce qu'on est en train de recharger.
      etat.actifId = null;
      etat.version = notes.version;
      etat.onglets = lireContenu(notes.contenu);
      etat.conflit = false;
      etat.alerte.hidden = true;
      activer(etat.onglets.some((o) => o.id === ancien) ? ancien : etat.onglets[0].id);
      etat.enregistre = contenuCourant();
      etat.dire("Enregistré", "ok");
    } catch (e) {
      etat.dire("Lecture impossible : " + e.message, "erreur");
    }
  }

  // Conflit : on garde son contenu. On relit seulement la version du serveur,
  // pour pouvoir écrire par-dessus — c'est un choix explicite de l'auteur, pas
  // un écrasement silencieux.
  async function garderMaVersion() {
    try {
      const notes = await chargerNotesLivre(etat.livreId);
      etat.version = notes.version;
      etat.conflit = false;
      etat.alerte.hidden = true;
      await enregistrer();
    } catch (e) {
      etat.dire("Lecture impossible : " + e.message, "erreur");
    }
  }

  // Ferme la fenêtre APRÈS avoir tout enregistré. Si l'enregistrement échoue, la
  // fenêtre reste ouverte : la refermer ferait perdre ce qui n'est pas parti.
  async function fermerNotesLivre() {
    if (!etat) return true;
    if (etat.fermeture) return etat.fermeture;

    // Un nom d'onglet en cours de saisie compte : on le valide avant d'enregistrer.
    // (Pas dans enregistrer() : l'enregistrement automatique couperait la saisie.)
    if (etat.renommage) etat.renommage.valider();
    etat.fermeture = (async () => {
      const tout = await enregistrer();
      if (!etat) return true;
      if (!tout) { etat.fermeture = null; return false; }

      document.removeEventListener("keydown", surEchap, true);
      etat.fond.remove();
      const retour = etat.retourFocus;
      etat = null;
      if (retour && typeof retour.focus === "function" && document.contains(retour)) retour.focus();
      return true;
    })();
    return etat.fermeture;
  }

  function surEchap(e) {
    if (e.key !== "Escape" || !etat) return;
    e.preventDefault();
    e.stopPropagation();
    // Pendant qu'on renomme un onglet, Échap annule le nom — pas la fenêtre.
    if (etat.renommage) { etat.renommage.annuler(); return; }
    fermerNotesLivre();
  }

  // Tab reste dans la fenêtre : derrière, la page continue d'exister, et le
  // clavier irait s'y perdre.
  function piegerTab(e) {
    const cibles = [...etat.carte.querySelectorAll('button, input, [contenteditable="true"]')]
      .filter((el) => !el.disabled && el.tabIndex >= 0 && el.offsetParent !== null);
    if (!cibles.length) return;
    const premier = cibles[0], dernier = cibles[cibles.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  // Quitter la page avec un contenu non enregistré : le navigateur prévient.
  window.addEventListener("beforeunload", (e) => {
    if (etat && (etat.enVol || (etat.charge && contenuCourant() !== etat.enregistre))) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  window.ouvrirNotesLivre = ouvrirNotesLivre;
  window.fermerNotesLivre = fermerNotesLivre;
  // Le format, exposé pour les tests : il n'agit sur rien en dehors de ses arguments.
  window.NotesFormat = { lignesDepuisDOM, serialiser, remplir, lireContenu, ecrireContenu, texteBrut };
})();
