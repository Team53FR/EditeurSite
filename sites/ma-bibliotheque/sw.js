// Service worker de « Ma Bibliothèque » — met seulement en cache la coquille
// de l'appli (HTML/CSS/JS/icônes) pour un chargement instantané, même hors
// ligne. Les données elles-mêmes (livres, images de couverture, recherches
// GitHub/Google Books/Open Library/BnF/AniList/Wikidata) ne sont JAMAIS mises
// en cache ici : la bibliothèque doit toujours refléter l'état le plus
// récent, donc tout appel vers un autre domaine passe directement au réseau
// sans interception.
const CACHE_NOM = "ma-bibliotheque-v1";
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
    caches.match(event.request).then((reponse) => reponse || fetch(event.request))
  );
});
