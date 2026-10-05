// =====================================================================
//  Notes de livre : une page d'idées par livre
// =====================================================================
//
//  Une page de texte libre par livre, pour y poser ce qu'on ne veut pas
//  oublier : personnages, intrigues, pistes, répliques. Privée — elle ne
//  paraît jamais avec le livre, même publié (voir chargerNotesLivre dans
//  script.js pour la raison).
//
//  Le module est partagé par la bibliothèque et par l'éditeur, qui n'ont ni
//  les mêmes feuilles de style ni les mêmes variables : la fenêtre construit
//  donc son propre balisage et n'emprunte que ses couleurs, avec une valeur de
//  repli pour chacune (voir notes.css).
//
//  Enregistrement AUTOMATIQUE. Une page d'idées s'écrit au fil de l'eau ; un
//  bouton « Enregistrer » qu'on oublie, c'est une idée perdue. On enregistre
//  donc peu après la dernière frappe, et à la fermeture.

(function () {
  "use strict";

  const DELAI_MS = 700;   // pause après la dernière frappe, avant d'enregistrer

  // Un seul jeu de notes ouvert à la fois : null quand la fenêtre est fermée.
  let etat = null;

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
      "Vos idées pour ce livre : personnages, intrigues, pistes. Visibles de vous seul, " +
      "jamais publiées avec le livre. Enregistrement automatique.");

    // Le message de conflit : masqué tant qu'il n'y a rien à dire.
    const alerte = creer("div", "notes-alerte");
    alerte.setAttribute("role", "alert");
    alerte.hidden = true;

    const texte = document.createElement("textarea");
    texte.className = "notes-texte";
    texte.setAttribute("aria-label", "Notes du livre");
    texte.placeholder = "Une idée, un personnage, une scène à écrire…";
    texte.spellcheck = true;
    texte.disabled = true;                  // le temps de lire les notes existantes
    texte.value = "";

    const pied = creer("div", "notes-pied");
    const statut = creer("span", "notes-etat attente", "Chargement…");
    statut.setAttribute("aria-live", "polite");
    const mots = creer("span", "notes-mots", "");
    pied.append(statut, mots);

    carte.append(entete, aide, alerte, texte, pied);
    fond.appendChild(carte);
    document.body.appendChild(fond);

    etat = {
      livreId, fond, carte, texte, statut, mots, alerte,
      version: null,           // version lue ; null = les notes n'existent pas encore
      enregistre: "",          // le dernier texte connu du serveur
      minuteur: null,
      enVol: null,             // la promesse de l'enregistrement en cours, ou null
      conflit: false,
      charge: false,
      retourFocus
    };

    // ----- état affiché -----
    const dire = (message, nature) => {
      statut.textContent = message;
      statut.className = "notes-etat " + (nature || "");
    };
    const majMots = () => {
      const n = compterMotsTexte(texte.value);
      mots.textContent = n + (n > 1 ? " mots" : " mot");
    };
    etat.dire = dire;
    etat.majMots = majMots;

    // ----- lecture -----
    const lire = async () => {
      dire("Chargement…", "attente");
      alerte.hidden = true;
      try {
        const notes = await chargerNotesLivre(livreId);
        if (etat === null || etat.livreId !== livreId) return;   // fermée entre-temps
        etat.version = notes.version;
        etat.enregistre = notes.contenu;
        texte.value = notes.contenu;
        texte.disabled = false;
        etat.charge = true;
        majMots();
        dire("Enregistré", "ok");
        texte.focus();
        texte.setSelectionRange(texte.value.length, texte.value.length);
      } catch (e) {
        if (etat === null) return;
        dire("Lecture impossible : " + e.message, "erreur");
        afficherAlerte("Les notes n'ont pas pu être lues : " + e.message, [
          ["Réessayer", lire]
        ]);
      }
    };

    // ----- écriture -----
    texte.addEventListener("input", () => {
      majMots();
      if (etat.conflit) return;             // on attend que l'auteur tranche
      if (texte.value === etat.enregistre) {
        clearTimeout(etat.minuteur);
        dire("Enregistré", "ok");
        return;
      }
      dire("Modifié…", "attente");
      clearTimeout(etat.minuteur);
      etat.minuteur = setTimeout(enregistrer, DELAI_MS);
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

  // Les boutons de l'alerte : [[libellé, action], …].
  function afficherAlerte(message, actions) {
    const alerte = etat.alerte;
    alerte.innerHTML = "";
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

  // Enregistre le texte courant. Rend true si, à la fin, tout ce qui est écrit
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
      while (etat && etat.charge && !etat.conflit && etat.texte.value !== etat.enregistre) {
        const envoye = etat.texte.value;
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

  // Conflit : on jette le texte local au profit de celui du serveur.
  async function rechargerNotes() {
    try {
      const notes = await chargerNotesLivre(etat.livreId);
      etat.version = notes.version;
      etat.enregistre = notes.contenu;
      etat.texte.value = notes.contenu;
      etat.conflit = false;
      etat.alerte.hidden = true;
      etat.majMots();
      etat.dire("Enregistré", "ok");
      etat.texte.focus();
    } catch (e) {
      etat.dire("Lecture impossible : " + e.message, "erreur");
    }
  }

  // Conflit : on garde son texte. On relit seulement la version du serveur, pour
  // pouvoir écrire par-dessus — c'est un choix explicite de l'auteur, pas un
  // écrasement silencieux.
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
    fermerNotesLivre();
  }

  // Tab reste dans la fenêtre : derrière, la page continue d'exister, et le
  // clavier irait s'y perdre.
  function piegerTab(e) {
    const cibles = [...etat.carte.querySelectorAll("button, textarea")]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!cibles.length) return;
    const premier = cibles[0], dernier = cibles[cibles.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  // Quitter la page avec un texte non enregistré : le navigateur prévient.
  window.addEventListener("beforeunload", (e) => {
    if (etat && (etat.enVol || (etat.charge && etat.texte.value !== etat.enregistre))) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  window.ouvrirNotesLivre = ouvrirNotesLivre;
  window.fermerNotesLivre = fermerNotesLivre;
})();
