// Service worker du portail Team53FR.
//
// Le portail et ses sites (éditeur de livre, Ma Bibliothèque, Droid
// Fortnite) vivent sur la même origine : une seule app installée les
// couvre tous, la portée étant la racine.
//
// Stratégie « réseau d'abord », comme pour Ma Bibliothèque, et pour la même
// raison — apprise à ses dépens : en « cache d'abord », la coquille ne se
// rafraîchit QUE lorsque ce fichier sw.js change d'octets, si bien qu'une
// page modifiée restait périmée indéfiniment sur les appareils ayant déjà
// installé l'app. Ces sites ont de toute façon besoin du réseau en
// permanence (API GitHub) : autant s'en servir pour rester à jour, et ne
// retomber sur le cache qu'en dernier recours, hors connexion.
//
// Les données ne sont JAMAIS mises en cache : tout appel vers un autre
// domaine (Supabase en tête) passe directement au réseau, sans interception.
// La coquille seule est conservée — un livre affiché depuis un cache périmé
// pourrait être réécrit par-dessus la version fraîche et perdre du texte.

// v2 : changement de nom et d'icone de l'app — sans ce renommage,
// l'ancienne icone resterait servie depuis le cache deja installe.
// v3 : les polices ne viennent plus de Google mais du dépôt. Sans ce
// renommage, les appareils où l'app est installée continueraient de servir
// depuis leur cache un HTML qui appelle fonts.googleapis.com — le transfert
// d'adresse IP que l'on vient justement de supprimer.
const CACHE_NOM = "site-guide-v3";

// Seule la coquille du portail est préchargée. Les pages des sites se
// mettent en cache à mesure qu'on les visite (voir le gestionnaire fetch) :
// les lister ici les ferait rouiller à chaque fichier ajouté ou renommé.
const FICHIERS_COQUILLE = [
  "./",
  "./index.html",
  "./connexion.html",
  "./tableau-de-bord.html",
  "./compte.html",
  "./compte.js",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icone-192.png",
  "./icone-512.png",
  // Les polices sont maintenant servies par le site : à la différence de
  // Google, on peut les mettre en cache, et la typographie tient donc aussi
  // hors ligne. Seul le latin est préchargé — le latin-ext, quatre fois plus
  // lourd, se chargera au besoin par le gestionnaire fetch.
  "./polices/polices.css",
  "./polices/eb-garamond-normal-latin.woff2",
  "./polices/eb-garamond-italique-latin.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOM).then((cache) =>
      // Un fichier manquant ne doit pas faire échouer toute l'installation.
      Promise.all(FICHIERS_COQUILLE.map((f) => cache.add(f).catch(() => {})))
    )
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
  const requete = event.request;

  // Les écritures ne se rejouent pas depuis un cache.
  if (requete.method !== "GET") return;

  // Jamais d'interception hors de notre origine (Supabase, couvertures...).
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(requete)
      .then((reponse) => {
        // Version fraîche dès que le réseau répond, doublée en cache pour
        // le prochain démarrage hors connexion.
        if (reponse && reponse.status === 200 && reponse.type === "basic") {
          const copie = reponse.clone();
          caches.open(CACHE_NOM).then((cache) => cache.put(requete, copie));
        }
        return reponse;
      })
      .catch(() =>
        caches.match(requete).then((cache) =>
          // Une navigation sans rien en cache retombe sur l'accueil, plutôt
          // que sur la page d'erreur du navigateur.
          cache || (requete.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});
