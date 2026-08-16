// Petit bouton flottant, indépendant du reste du site, pour revenir au
// tableau de bord du portail central (Team53FR). Ajouté sur toutes les
// pages ; ne dépend d'aucune autre fonction ni feuille de style du site.
(function () {
  var lien = document.createElement("a");
  lien.href = "../../tableau-de-bord.html";
  lien.title = "Retour à l'accueil des sites";
  lien.setAttribute("aria-label", "Retour à l'accueil des sites");
  lien.textContent = "🏠";
  lien.style.cssText =
    "position:fixed;left:14px;bottom:14px;z-index:9999;" +
    "width:40px;height:40px;border-radius:50%;" +
    "background:rgba(30,30,30,.62);color:#fff;" +
    "display:flex;align-items:center;justify-content:center;" +
    "font-size:18px;line-height:1;text-decoration:none;" +
    "box-shadow:0 2px 10px rgba(0,0,0,.28);" +
    "-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);";
  lien.addEventListener("mouseenter", function () { lien.style.background = "rgba(30,30,30,.85)"; });
  lien.addEventListener("mouseleave", function () { lien.style.background = "rgba(30,30,30,.62)"; });

  function ajouter() { document.body.appendChild(lien); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ajouter);
  } else {
    ajouter();
  }
})();
