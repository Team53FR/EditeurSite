const NOM_FICHIER_BIBLIO = "bibliotheque.json";

let bibliotheque = null;
let shaBiblio = null;
let livreId = null;
let indexLivre = -1;
let indexSpread = 0;
let coteActif = "gauche";
let selectionSauvegardee = null;

async function chargerLivre() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  livreId = sessionStorage.getItem("livre_id");

  if (!token || !livreId) {
    window.location.href = "bibliotheque.html";
    return;
  }

  try {
    const { contenu, sha } = await lireFichierJSON(NOM_FICHIER_BIBLIO, token);
    bibliotheque = contenu;
    shaBiblio = sha;

    indexLivre = bibliotheque.livres.findIndex(l => l.id === livreId);
    if (indexLivre === -1) {
      message.textContent = "Livre introuvable.";
      return;
    }

    const livre = livreActuel();
    if (!livre.pages || livre.pages.length === 0) {
      livre.pages = [{ id: "p1", contenu: "" }];
    }

    document.getElementById("titreLivre").textContent = livre.titre || "Mon livre";
    indexSpread = 0;

    document.execCommand("defaultParagraphSeparator", false, "p");

    const pageGauche = document.getElementById("pageGauche");
    const pageDroite = document.getElementById("pageDroite");

    pageGauche.addEventListener("keydown", (e) => { intercepterEntree(e); bloquerSiPlein(e, pageGauche); });
    pageDroite.addEventListener("keydown", (e) => { intercepterEntree(e); bloquerSiPlein(e, pageDroite); });
    pageGauche.addEventListener("focus", () => { coteActif = "gauche"; });
    pageDroite.addEventListener("focus", () => { coteActif = "droite"; });
    pageGauche.addEventListener("blur", sauvegarderSelection);
    pageDroite.addEventListener("blur", sauvegarderSelection);
    document.addEventListener("selectionchange", lireTailleCourrante);

    afficherSpread();
    afficherSommaire();
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function livreActuel() {
  return bibliotheque.livres[indexLivre];
}

function formater(commande, valeur) {
  document.execCommand(commande, false, valeur || null);
}

function sauvegarderSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    selectionSauvegardee = sel.getRangeAt(0).cloneRange();
  }
}

function restaurerSelection() {
  if (!selectionSauvegardee) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(selectionSauvegardee);
  return true;
}

function appliquerTaille(pt) {
  const val = parseInt(pt);
  if (!val || val < 6 || val > 72) return;

  restaurerSelection();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);

  // Extraire le contenu sélectionné
  const fragment = range.extractContents();

  // Supprimer les font-size existants dans la sélection pour éviter les conflits
  fragment.querySelectorAll("span[style]").forEach(el => {
    el.style.fontSize = "";
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });

  // Envelopper dans un span avec la nouvelle taille
  const span = document.createElement("span");
  span.style.fontSize = val + "pt";
  span.appendChild(fragment);

  range.insertNode(span);

  // Replacer la sélection sur le span inséré
  const nouvelRange = document.createRange();
  nouvelRange.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(nouvelRange);
}

// ----- Blocage en fin de page -----

function afficherPagePleine() {
  document.getElementById("message").textContent = "Page pleine — utilisez Suivant → pour continuer sur la page suivante.";
  setTimeout(() => { document.getElementById("message").textContent = ""; }, 3000);
}

function lireTailleCourrante() {
  const input = document.getElementById("inputTaille");
  // Ne pas écraser l'input si l'utilisateur est en train de le modifier
  if (input && document.activeElement === input) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  let noeud = sel.anchorNode;
  if (noeud && noeud.nodeType === Node.TEXT_NODE) noeud = noeud.parentElement;
  while (noeud) {
    const fs = window.getComputedStyle(noeud).fontSize;
    if (fs) {
      const pt = Math.round(parseFloat(fs) / 1.333);
      if (input) input.value = pt;
      return;
    }
    noeud = noeud.parentElement;
  }
}

function intercepterEntree(e) {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  document.execCommand("insertLineBreak");
}

function bloquerSiPlein(e, conteneur) {
  // Touches qui ne rajoutent pas de contenu : on laisse toujours passer
  const touchesAutorisees = [
    "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "Home", "End", "PageUp", "PageDown", "Tab", "Escape",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"
  ];
  if (touchesAutorisees.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;

  // Laisser le navigateur insérer le caractère, puis vérifier et annuler si ça déborde
  const snapshotHTML = conteneur.innerHTML;

  // Sauvegarde position curseur en offset texte absolu (résiste au innerHTML=)
  const sel = window.getSelection();
  let offsetSauvegarde = null;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (conteneur.contains(r.startContainer)) {
      function compterOffset(noeudCible, offsetCible) {
        let total = 0;
        const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode === noeudCible) return total + offsetCible;
          total += walker.currentNode.textContent.length;
        }
        return total;
      }
      offsetSauvegarde = compterOffset(r.startContainer, r.startOffset);
    }
  }

  requestAnimationFrame(() => {
    if (conteneur.scrollHeight > conteneur.clientHeight + 2) {
      // Rollback
      conteneur.innerHTML = snapshotHTML;
      // Restaurer le curseur via offset texte
      if (offsetSauvegarde !== null) {
        let total = 0;
        const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const len = walker.currentNode.textContent.length;
          if (total + len >= offsetSauvegarde) {
            const range = document.createRange();
            range.setStart(walker.currentNode, offsetSauvegarde - total);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            break;
          }
          total += len;
        }
      }
      afficherPagePleine();
    }
  });
}

// ----- Affichage -----

function assurerPageExiste(i) {
  const pages = livreActuel().pages;
  while (pages.length <= i) {
    pages.push({ id: "p" + (pages.length + 1) + "_" + Date.now(), contenu: "" });
  }
}

function flushSpread() {
  assurerPageExiste(indexSpread);
  assurerPageExiste(indexSpread + 1);
  livreActuel().pages[indexSpread].contenu = document.getElementById("pageGauche").innerHTML;
  livreActuel().pages[indexSpread + 1].contenu = document.getElementById("pageDroite").innerHTML;
}

function afficherSpread() {
  assurerPageExiste(indexSpread);
  const pages = livreActuel().pages;
  document.getElementById("pageGauche").innerHTML = pages[indexSpread] ? pages[indexSpread].contenu : "";
  document.getElementById("pageDroite").innerHTML = pages[indexSpread + 1] ? pages[indexSpread + 1].contenu : "";
  document.getElementById("numeroGauche").textContent = indexSpread + 1;
  document.getElementById("numeroDroite").textContent = pages[indexSpread + 1] ? indexSpread + 2 : "";
}

function afficherSommaire() {
  const pages = livreActuel().pages;
  const liste = document.getElementById("listePages");
  liste.innerHTML = "";

  pages.forEach((page, i) => {
    const li = document.createElement("li");
    li.textContent = "Page " + (i + 1);
    li.className = (i === indexSpread || i === indexSpread + 1) ? "actif" : "";
    li.onclick = () => allerAPage(i);
    liste.appendChild(li);
  });
}

function allerAPage(i) {
  flushSpread();
  indexSpread = i - (i % 2);
  afficherSpread();
  afficherSommaire();
}

function pagePrecedente() {
  flushSpread();
  if (indexSpread - 2 >= 0) {
    indexSpread -= 2;
    afficherSpread();
    afficherSommaire();
  }
}

function pageSuivante() {
  flushSpread();
  // Créer la nouvelle page si besoin
  assurerPageExiste(indexSpread + 2);
  indexSpread += 2;
  afficherSpread();
  afficherSommaire();
}

// ----- Sauvegarde -----

async function sauvegarder() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  flushSpread();

  // Nettoyer les pages vides en fin de livre (sauf la première)
  const pages = livreActuel().pages;
  while (pages.length > 1 && !pages[pages.length - 1].contenu.replace(/<[^>]+>/g, "").trim()) {
    pages.pop();
  }
  if (indexSpread >= pages.length) {
    indexSpread = Math.max(0, pages.length - 1 - ((pages.length - 1) % 2));
  }
  afficherSpread();
  afficherSommaire();

  const contenuEncode = btoa(unescape(encodeURIComponent(JSON.stringify(bibliotheque, null, 2))));
  const url = `https://api.github.com/repos/${PROPRIETAIRE}/${DEPOT_BDD}/contents/${NOM_FICHIER_BIBLIO}`;

  try {
    const reponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: "Mise à jour du livre",
        content: contenuEncode,
        sha: shaBiblio
      })
    });

    if (!reponse.ok) {
      throw new Error("Échec de la sauvegarde. Vérifie ton token.");
    }

    const data = await reponse.json();
    shaBiblio = data.content.sha;
    message.textContent = "Sauvegardé avec succès.";
  } catch (erreur) {
    message.textContent = erreur.message;
  }
}

function retourBibliotheque() {
  flushSpread();
  window.location.href = "bibliotheque.html";
}

function seDeconnecter() {
  sessionStorage.removeItem("gh_token");
  sessionStorage.removeItem("livre_id");
  window.location.href = "index.html";
}

chargerLivre();