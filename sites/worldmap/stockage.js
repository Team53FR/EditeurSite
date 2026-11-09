// Stockage des cartes, entièrement dans le navigateur (IndexedDB) : aucun
// compte, rien n'est envoyé nulle part. Deux magasins :
//  - « cartes » : la carte complète (traits, lignes, étiquettes, lieux) ;
//  - « meta »   : de quoi afficher la galerie (nom, taille, vignette, comptes),
//    pour ne pas relire des cartes entières rien que pour les lister.
(function () {
  var NOM_BASE = "worldmap";
  var VERSION = 1;
  var base = null;

  function ouvrir() {
    if (base) return base;
    base = new Promise(function (resoudre, rejeter) {
      if (!window.indexedDB) { rejeter(new Error("Ce navigateur ne permet pas d'enregistrer les cartes.")); return; }
      var req = indexedDB.open(NOM_BASE, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("cartes")) db.createObjectStore("cartes", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
      };
      req.onsuccess = function () { resoudre(req.result); };
      req.onerror = function () { base = null; rejeter(req.error || new Error("Ouverture de la base impossible.")); };
    });
    return base;
  }

  // Exécute `travail(magasins)` dans une transaction et rend le résultat de la
  // dernière requête une fois la transaction terminée.
  function transaction(noms, mode, travail) {
    return ouvrir().then(function (db) {
      return new Promise(function (resoudre, rejeter) {
        var t = db.transaction(noms, mode);
        var magasins = {};
        noms.forEach(function (n) { magasins[n] = t.objectStore(n); });
        var requete = travail(magasins);
        t.oncomplete = function () { resoudre(requete ? requete.result : undefined); };
        t.onerror = function () { rejeter(t.error); };
        t.onabort = function () { rejeter(t.error || new Error("Enregistrement interrompu.")); };
      });
    });
  }

  function metaDe(carte) {
    return {
      id: carte.id,
      nom: carte.nom,
      largeur: carte.largeur,
      hauteur: carte.hauteur,
      theme: carte.theme,
      vignette: carte.vignette || null,
      creeLe: carte.creeLe,
      majLe: carte.majLe,
      nbLieux: (carte.lieux || []).length,
      nbEtiquettes: (carte.etiquettes || []).length,
      nbLignes: (carte.lignes || []).length
    };
  }

  window.Stockage = {
    nouvelId: function () {
      return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    lister: function () {
      return transaction(["meta"], "readonly", function (m) { return m.meta.getAll(); })
        .then(function (liste) {
          return (liste || []).sort(function (a, b) { return (b.majLe || 0) - (a.majLe || 0); });
        });
    },
    lire: function (id) {
      return transaction(["cartes"], "readonly", function (m) { return m.cartes.get(id); });
    },
    ecrire: function (carte) {
      return transaction(["cartes", "meta"], "readwrite", function (m) {
        m.meta.put(metaDe(carte));
        return m.cartes.put(carte);
      });
    },
    supprimer: function (id) {
      return transaction(["cartes", "meta"], "readwrite", function (m) {
        m.meta.delete(id);
        return m.cartes.delete(id);
      });
    }
  };
})();
