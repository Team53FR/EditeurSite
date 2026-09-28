// =====================================================================
//  Pied de page légal, commun aux quatre propriétés
// =====================================================================
//
//  Les mentions légales doivent rester accessibles depuis n'importe quelle
//  page. Plutôt que de recopier quatre liens dans une vingtaine de fichiers
//  HTML — et de devoir tous les rouvrir au moindre changement —, ce script
//  les pose lui-même. Une seule ligne à ajouter par page.
//
//  Il emporte son propre style : les quatre sites n'ont aucune variable de
//  couleur en commun, et le pied doit s'accorder à chacun. D'où le
//  « color: inherit » et l'opacité, qui le rendent discret sur un fond clair
//  comme sur le noir de Droid Fortnite, sans rien savoir de la palette.
//
//  Une page qui n'en veut pas — un plein écran d'édition, une liseuse, une
//  planche d'impression — porte l'attribut « data-sans-pied » sur son <body>.

(function () {
  // La racine se déduit de l'adresse de CE script : les pages vivent à deux
  // profondeurs différentes (le portail, puis sites/<nom>/), et coder les
  // « ../../ » en dur dans chaque page finirait par se tromper.
  const moi = document.currentScript;
  const racine = moi ? moi.src.replace(/pied-legal\.js(\?.*)?$/, "") : "";

  const LIENS = [
    ["mentions-legales.html", "Mentions légales"],
    ["confidentialite.html", "Confidentialité"],
    ["cookies.html", "Cookies"],
    ["conditions-utilisation.html", "Conditions d'utilisation"]
  ];

  const STYLE = `
/* Le corps passe en colonne pour que le pied se pose SOUS le contenu et non
 * derrière : plusieurs pages ont un bloc en « min-height: 100% » (la carte de
 * connexion centrée, notamment) qui, sans cela, remplirait à lui seul tout
 * l'écran et repousserait le pied sous la ligne de flottaison — une barre de
 * défilement apparaîtrait sur une page qui n'en avait pas. La règle est posée
 * par le script, donc uniquement là où un pied existe vraiment. */
body.a-pied-legal {
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: 100%;
}
body.a-pied-legal > .page-centree {
  flex: 1 0 auto;
  min-height: 0;
}
.pied-legal {
  margin-top: auto;
  padding: 18px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  text-align: center;
  font-size: 12.5px;
  line-height: 1.9;
  color: inherit;
  opacity: .6;
}
.pied-legal a {
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
  padding: 0 9px;
}
.pied-legal a:hover { text-decoration: underline; }
.pied-legal .pied-legal-sep { opacity: .5; }
@media print { .pied-legal { display: none; } }
`;

  function poser() {
    const corps = document.body;
    if (!corps || corps.dataset.sansPied !== undefined) return;
    if (document.querySelector(".pied-legal")) return;   // déjà posé

    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const pied = document.createElement("footer");
    pied.className = "pied-legal";
    LIENS.forEach(([fichier, libelle], i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "pied-legal-sep";
        sep.textContent = "·";
        pied.appendChild(sep);
      }
      const a = document.createElement("a");
      a.href = racine + fichier;
      a.textContent = libelle;
      pied.appendChild(a);
    });
    corps.appendChild(pied);
    corps.classList.add("a-pied-legal");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", poser);
  } else {
    poser();
  }
})();
