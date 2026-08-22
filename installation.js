// ===== Installation de l'application =====
// Un site web ne peut pas livrer un fichier d'app : il s'INSTALLE.
// Sur Android/Chrome le navigateur propose l'installation via
// beforeinstallprompt, que l'on retient pour l'offrir sur ce bouton.
// Safari iOS n'expose rien de tel : on y explique le geste à faire.
(function () {
  const encart = document.getElementById("encart-app");
  const detail = document.getElementById("encart-app-detail");
  const bouton = document.getElementById("btn-installer");
  const fermer = document.getElementById("btn-fermer-encart");
  let invite = null;

  const dejaInstallee = () =>
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  const estIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ se presente comme un Mac tactile
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Masque volontairement pose : on ne re-propose pas a chaque visite.
  if (dejaInstallee() || localStorage.getItem("team53_encart_app") === "masque") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();          // on declenche nous-memes, sur le bouton
    invite = e;
    encart.hidden = false;
  });

  if (estIOS()) {
    detail.textContent = "Sur iPhone : bouton Partager, puis « Sur l'écran d'accueil ».";
    bouton.hidden = true;
    encart.hidden = false;
  }

  bouton.addEventListener("click", async () => {
    if (!invite) return;
    bouton.disabled = true;
    invite.prompt();
    try { await invite.userChoice; } catch (e) { /* choix indisponible */ }
    invite = null;
    encart.hidden = true;
  });

  fermer.addEventListener("click", () => {
    encart.hidden = true;
    localStorage.setItem("team53_encart_app", "masque");
  });

  window.addEventListener("appinstalled", () => { encart.hidden = true; });
})();
