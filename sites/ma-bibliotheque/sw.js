// Service worker de « Ma Bibliothèque » — met en cache la coquille de
// l'appli (HTML/CSS/JS/icônes) pour un repli hors-ligne. Les données
// elles-mêmes (livres, images de couverture, recherches GitHub/Google
// Books/Open Library/BnF/AniList/Wikidata) ne sont JAMAIS mises en cache
// ici : la bibliothèque doit toujours refléter l'état le plus récent, donc
// tout appel vers un autre domaine passe directement au réseau sans
// interception.
//
// IMPORTANT — historique d'un bug réel : la coquille était servie en
// « cache d'abord », qui ne se rafraîchit QUE quand ce fichier sw.js change
// d'octets (c'est ce qui déclenche la réinstallation). Un changement de
// collection.html/js/css seul ne suffisait pas : une fonctionnalité
// pourtant retirée du code source restait visible indéfiniment sur les
// appareils ayant déjà installé l'app. Passé en « réseau d'abord » : cette
// app a de toute façon besoin du réseau en permanence (API GitHub), donc le
// réseau est presque toujours disponible — autant s'en servir pour rester à
// jour, et ne retomber sur le cache qu'en dernier recours (hors-ligne).
const CACHE_NOM = "ma-bibliotheque-v2";
const FICHIERS_COQUILLE = [
  "./",
  "./index.html",
  "./connexion.html",
  "./collection.html",
  "./style.css",
  "./script.js",
  "./collection.js",
  "./manifest.json",
  "./icone-192.png",
  "./icone-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOM).then((cache) => cache.addAll(FICHIERS_COQUILLE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_NOM).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jamais d'interception pour un autre domaine (GitHub, Google Books,
  // Open Library, BnF, AniList, Wikidata, CDN du lecteur de code-barres...).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((reponse) => {
        // Toujours la version fraîche quand le réseau répond ; on la garde
        // aussi en cache pour un repli hors-ligne la prochaine fois.
        const copie = reponse.clone();
        caches.open(CACHE_NOM).then((cache) => cache.put(event.request, copie));
        return reponse;
      })
      .catch(() => caches.match(event.request))
  );
});
