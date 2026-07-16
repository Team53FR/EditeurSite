const NOM_FICHIER_BIBLIO = "bibliotheque.json";

let bibliotheque = null;
let shaBiblio = null;
let livreId = null;
let indexLivre = -1;
let indexSpread = 0;
let coteActif = "gauche";
let minuteurSaisie = null;

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
    pageGauche.addEventListener("input", () => gererSaisie());
    pageDroite.addEventListener("input", () => gererSaisie());
    pageGauche.addEventListener("focus", () => coteActif = "gauche");
    pageDroite.addEventListener("focus", () => coteActif = "droite");

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
  gererSaisie();
}

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
  if (indexSpread + 2 < livreActuel().pages.length) {
    indexSpread += 2;
    afficherSpread();
    afficherSommaire();
  }
}

// ----- Gestion du curseur -----

function sauvegarderCurseur(conteneur) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!conteneur.contains(range.startContainer)) return null;

  // Calcule l'offset texte absolu depuis le début du conteneur
  function offsetAbsolu(noeud, offset) {
    let total = 0;
    const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode === noeud) return total + offset;
      total += walker.currentNode.textContent.length;
    }
    return total;
  }

  return {
    start: offsetAbsolu(range.startContainer, range.startOffset),
    end: offsetAbsolu(range.endContainer, range.endOffset)
  };
}

function restaurerCurseur(conteneur, sauvegarde) {
  if (!sauvegarde) return;
  const sel = window.getSelection();
  if (!sel) return;

  let total = 0, startNode = null, startOff = 0, endNode = null, endOff = 0;
  const walker = document.createTreeWalker(conteneur, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const len = walker.currentNode.textContent.length;
    if (!startNode && total + len >= sauvegarde.start) {
      startNode = walker.currentNode;
      startOff = sauvegarde.start - total;
    }
    if (!endNode && total + len >= sauvegarde.end) {
      endNode = walker.currentNode;
      endOff = sauvegarde.end - total;
    }
    if (startNode && endNode) break;
    total += len;
  }

  if (!startNode) return;
  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode || startNode, endNode ? endOff : startOff);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ----- Pagination automatique -----

function gererSaisie() {
  clearTimeout(minuteurSaisie);
  minuteurSaisie = setTimeout(() => {
    // Identifier sur quelle page se trouve le curseur
    const pageGauche = document.getElementById("pageGauche");
    const pageDroite = document.getElementById("pageDroite");
    const sel = window.getSelection();
    let conteneurActif = null;
    if (sel && sel.rangeCount > 0) {
      const ancre = sel.anchorNode;
      if (pageGauche.contains(ancre)) conteneurActif = pageGauche;
      else if (pageDroite.contains(ancre)) conteneurActif = pageDroite;
    }

    const curseur = conteneurActif ? sauvegarderCurseur(conteneurActif) : null;

    flushSpread();
    repaginerCascade(indexSpread);
    nettoyerPagesVides();
    afficherSpread();
    afficherSommaire();

    // Restaurer le curseur dans le bon conteneur
    if (curseur && conteneurActif) {
      // Après afficherSpread, les divs ont été réécrites : retrouver le bon élément
      const nouveauConteneur = conteneurActif.id === "pageGauche"
        ? document.getElementById("pageGauche")
        : document.getElementById("pageDroite");
      restaurerCurseur(nouveauConteneur, curseur);
    }
  }, 400);
}

function repaginerCascade(indexPage) {
  assurerPageExiste(indexPage);
  const pages = livreActuel().pages;
  const mesure = document.getElementById("mesureCachee");
  mesure.innerHTML = pages[indexPage].contenu;

  if (mesure.scrollHeight <= mesure.clientHeight + 1) {
    return;
  }

  const excedent = extraireExcedent(mesure);
  pages[indexPage].contenu = mesure.innerHTML;

  assurerPageExiste(indexPage + 1);
  pages[indexPage + 1].contenu = excedent + pages[indexPage + 1].contenu;

  repaginerCascade(indexPage + 1);
}

function extraireExcedent(conteneur) {
  const excedents = [];

  while (conteneur.scrollHeight > conteneur.clientHeight + 1) {
    if (conteneur.children.length > 1) {
      const dernier = conteneur.lastElementChild;
      conteneur.removeChild(dernier);
      excedents.unshift(dernier.outerHTML);
    } else if (conteneur.children.length === 1) {
      const reste = diviserBlocParMots(conteneur.firstElementChild, conteneur);
      if (reste) excedents.unshift(reste);
      break;
    } else {
      break;
    }
  }

  return excedents.join("");
}

function diviserBlocParMots(bloc, conteneur) {
  const mots = bloc.textContent.split(" ");
  if (mots.length <= 1) return null;

  let min = 0, max = mots.length, meilleur = 0;

  while (min <= max) {
    const mid = Math.floor((min + max) / 2);
    bloc.textContent = mots.slice(0, mid).join(" ");
    if (conteneur.scrollHeight <= conteneur.clientHeight + 1) {
      meilleur = mid;
      min = mid + 1;
    } else {
      max = mid - 1;
    }
  }

  bloc.textContent = mots.slice(0, meilleur).join(" ");
  const resteMots = mots.slice(meilleur);
  if (resteMots.length === 0) return null;

  const nouveauBloc = document.createElement("p");
  nouveauBloc.textContent = resteMots.join(" ");
  return nouveauBloc.outerHTML;
}

function remplirDepuis(indexPage) {
  const pages = livreActuel().pages;
  const mesure = document.getElementById("mesureCachee");

  let continuer = true;
  while (continuer && indexPage + 1 < pages.length) {
    continuer = false;
    const suivante = pages[indexPage + 1];
    if (!suivante || !suivante.contenu.replace(/<[^>]+>/g, "").trim()) break;

    const temp = document.createElement("div");
    temp.innerHTML = suivante.contenu;
    const premierBloc = temp.firstElementChild;
    if (!premierBloc) break;

    mesure.innerHTML = pages[indexPage].contenu + premierBloc.outerHTML;
    if (mesure.scrollHeight <= mesure.clientHeight + 1) {
      pages[indexPage].contenu = mesure.innerHTML;
      temp.removeChild(premierBloc);
      pages[indexPage + 1].contenu = temp.innerHTML;
      continuer = true;
    }
  }

  if (indexPage + 1 < pages.length) remplirDepuis(indexPage + 1);
}

function nettoyerPagesVides() {
  const pages = livreActuel().pages;
  if (pages.length === 0) {
    pages.push({ id: "p1", contenu: "" });
    return;
  }

  remplirDepuis(0);

  while (pages.length > 1 && !pages[pages.length - 1].contenu.replace(/<[^>]+>/g, "").trim()) {
    pages.pop();
  }

  if (indexSpread >= pages.length) {
    indexSpread = Math.max(0, pages.length - 1 - ((pages.length - 1) % 2));
  }
}

// ----- Sauvegarde -----

async function sauvegarder() {
  const token = sessionStorage.getItem("gh_token");
  const message = document.getElementById("message");

  flushSpread();
  repaginerCascade(indexSpread);
  nettoyerPagesVides();
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