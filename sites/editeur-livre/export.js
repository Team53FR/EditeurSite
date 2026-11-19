// =====================================================================
//  Exporter : un livre (et ses notes) en un fichier Markdown
// =====================================================================
//
//  Le fichier se lit tel quel, et se dépose dans une conversation ou un
//  Projet Claude. Tout se fait dans le navigateur, à partir de ce que le
//  compte peut déjà lire : rien n'est envoyé ailleurs, rien n'est écrit.
//
//  Le texte du livre est en HTML, par double-page (voir editeur.js). On le
//  convertit en Markdown, et un paragraphe coupé entre deux pages — repéré
//  par data-suite="1", comme dans fusionnerSuite — est recollé.

(function () {
  const BLOCS = /^(P|H[1-6]|UL|OL|LI|BLOCKQUOTE|DIV|HR|TABLE)$/;

  function enLigne(noeud) {
    let s = "";
    noeud.childNodes.forEach((n) => {
      if (n.nodeType === 3) { s += n.data.replace(/\s+/g, " "); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName;
      if (t === "BR") { s += "\n"; return; }
      const dedans = enLigne(n);
      if (!dedans.trim()) { s += dedans; return; }
      if (t === "B" || t === "STRONG") s += "**" + dedans.trim() + "**";
      else if (t === "I" || t === "EM") s += "*" + dedans.trim() + "*";
      else s += dedans;
    });
    return s;
  }

  // Un conteneur → une liste de blocs de texte (chaque bloc = un paragraphe,
  // un titre, un élément de liste…). `suite` marque un bloc qui prolonge le
  // précédent.
  function blocs(conteneur, sortie, prefixeListe) {
    let nu = "";
    const viderNu = () => { if (nu.trim()) sortie.push({ texte: nu.trim() }); nu = ""; };
    conteneur.childNodes.forEach((n) => {
      if (n.nodeType === 3) { nu += n.data.replace(/\s+/g, " "); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName;
      if (!BLOCS.test(t)) { nu += enLigne({ childNodes: [n] }); return; }
      viderNu();
      const suite = n.getAttribute("data-suite") === "1";
      if (/^H[1-6]$/.test(t)) {
        const txt = enLigne(n).replace(/\s+/g, " ").trim();
        if (txt) sortie.push({ texte: "#".repeat(Math.min(6, Number(t[1]) + 1)) + " " + txt });
      } else if (t === "UL" || t === "OL") {
        let i = 0;
        n.childNodes.forEach((li) => {
          if (li.nodeType !== 1) return;
          i++;
          const txt = enLigne(li).replace(/\s+/g, " ").trim();
          if (txt) sortie.push({ texte: (t === "OL" ? i + ". " : "- ") + txt, liste: true });
        });
      } else if (t === "BLOCKQUOTE") {
        const interne = [];
        blocs(n, interne);
        interne.forEach((b) => sortie.push({ texte: b.texte.split("\n").map((l) => "> " + l).join("\n") }));
      } else if (t === "HR") {
        sortie.push({ texte: "---" });
      } else if (t === "DIV" && [...n.children].some((c) => BLOCS.test(c.tagName))) {
        blocs(n, sortie);
      } else {
        const txt = enLigne(n).replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "  \n").trim();
        if (txt) sortie.push({ texte: txt, suite });
      }
    });
    viderNu();
  }

  function livreEnMarkdownTexte(spreads) {
    const tous = [];
    (spreads || []).forEach((html) => {
      const d = document.createElement("div");
      d.innerHTML = html || "";
      blocs(d, tous);
    });
    let sortie = "";
    tous.forEach((b, i) => {
      if (i === 0) sortie = b.texte;
      else if (b.suite) sortie += " " + b.texte;
      else if (b.liste && tous[i - 1].liste) sortie += "\n" + b.texte;
      else sortie += "\n\n" + b.texte;
    });
    return sortie;
  }

  // Les notes : JSON {"v":2,"onglets":[{titre,texte}]} ou, avant les onglets,
  // du texte brut. `texte` ne porte que <b>, <i> et des retours à la ligne,
  // le reste étant échappé (voir notes.js).
  function notesEnMarkdown(brut) {
    brut = brut || "";
    let onglets = null;
    if (brut.startsWith('{"v":2,')) {
      try {
        const d = JSON.parse(brut);
        if (d && Array.isArray(d.onglets)) {
          onglets = d.onglets.map((o) => ({
            titre: String((o && o.titre) || "Notes"),
            texte: String((o && o.texte) || "")
          }));
        }
      } catch (e) { /* illisible : lu comme du texte */ }
    }
    if (!onglets) onglets = [{ titre: "Notes", texte: brut.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }];
    return onglets.map((o) => {
      const d = document.createElement("div");
      d.innerHTML = o.texte.replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
      const corps = enLigne(d).replace(/[ \t]+\n/g, "\n").trim();
      return corps ? "### " + o.titre + "\n\n" + corps : "";
    }).filter(Boolean).join("\n\n");
  }

  async function livreEnMarkdown(livre) {
    const [complet, notes] = await Promise.all([
      chargerLivreComplet(livre.id),
      chargerNotesLivre(livre.id).catch(() => ({ contenu: "" }))
    ]);
    const entete = ["# " + (complet.titre || "Sans titre")];
    if (complet.auteur) entete.push("*" + complet.auteur + "*");
    const texte = livreEnMarkdownTexte(complet.spreads);
    const nt = notesEnMarkdown(notes.contenu);
    let md = entete.join("\n\n") + "\n\n" + (texte || "*(Ce livre est vide.)*");
    if (nt) md += "\n\n---\n\n## Notes de l'auteur\n\n" + nt;
    return md + "\n";
  }

  function telecharger(nom, md) {
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function nomFichier(titre) {
    return (String(titre || "livre").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "livre") + ".md";
  }

  // Exporte un livre. `bouton` (facultatif) est désactivé pendant le travail.
  window.exporterLivre = async function (id, bouton) {
    const livre = ((bibliotheque && bibliotheque.livres) || []).find((l) => l.id === id);
    if (!livre) return;
    if (bouton) bouton.disabled = true;
    try {
      telecharger(nomFichier(livre.titre), await livreEnMarkdown(livre));
    } catch (e) {
      alert("Export impossible : " + (e && e.message ? e.message : e));
    } finally {
      if (bouton) bouton.disabled = false;
    }
  };

  // Exporte toute la bibliothèque dans un seul fichier.
  window.exporterTout = async function (bouton) {
    const liste = (bibliotheque && bibliotheque.livres) || [];
    if (!liste.length) { alert("Aucun livre à exporter."); return; }
    const texte = bouton && bouton.textContent;
    if (bouton) bouton.disabled = true;
    try {
      const parties = [];
      for (let i = 0; i < liste.length; i++) {
        if (bouton) bouton.textContent = "Export " + (i + 1) + "/" + liste.length + "…";
        parties.push(await livreEnMarkdown(liste[i]));
      }
      telecharger("mes-livres.md", parties.join("\n\n\n"));
    } catch (e) {
      alert("Export impossible : " + (e && e.message ? e.message : e));
    } finally {
      if (bouton) { bouton.disabled = false; bouton.textContent = texte; }
    }
  };
})();
