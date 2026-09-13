/* Service worker MOUVANCIA — app shell hors-ligne + données figées en cache.
 *
 * Périmètre volontairement borné :
 *  - navigations : réseau d'abord, page /offline précachée en secours ;
 *  - assets immuables (/_next/static, /icons, fonts Google) : cache d'abord ;
 *  - données FIGÉES du storage Supabase (JSON choro/détail/analyses, publics
 *    et régénérés par pipeline) : stale-while-revalidate, plafonné ;
 *  - JAMAIS : /api/*, auth/REST Supabase (données personnelles, temps réel),
 *    requêtes Range (PMTiles), autres méthodes que GET.
 *
 * Bump VERSION pour invalider tous les caches à la prochaine activation.
 * Enregistré par src/components/pwa.tsx (production uniquement).
 */
const VERSION = "mvc-sw-v2";
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const DATA_MAX_ENTRIES = 120;
const DATA_MAX_BYTES_PER_ENTRY = 512 * 1024;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      // `reload` : ne jamais précacher une réponse elle-même issue d'un cache HTTP.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("mvc-sw-") && !key.startsWith(VERSION))
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function isImmutableAsset(url) {
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/")
    );
  }
  return url.hostname === "fonts.gstatic.com";
}

// JSON figés du bucket public `data` (choroplèthes, détails, analyses…).
function isFrozenData(url) {
  return (
    url.hostname.endsWith(".supabase.co") &&
    url.pathname.startsWith("/storage/v1/object/public/data/") &&
    url.pathname.endsWith(".json")
  );
}

async function cacheFirst(event, request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    // waitUntil : l'écriture survit même si le worker est arrêté juste après
    // la réponse.
    event.waitUntil(
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)),
    );
  }
  return response;
}

async function trimDataCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= DATA_MAX_ENTRIES) return;
  // Les entrées les plus anciennes d'abord (ordre d'insertion approximatif).
  for (const key of keys.slice(0, keys.length - DATA_MAX_ENTRIES)) {
    await cache.delete(key);
  }
}

async function staleWhileRevalidate(event, request) {
  let cache;
  let cached;
  try {
    cache = await caches.open(DATA_CACHE);
    cached = await cache.match(request);
  } catch {
    // Cache indisponible (mode privé, quota, stockage désactivé) : le réseau
    // reste la source de vérité et doit continuer à fonctionner.
    return fetch(request);
  }
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        // Un quota épuisé ne doit pas transformer un succès réseau en panne.
        // Sans taille fiable, laisser HTTP/CDN gérer le fichier volumineux.
        const length = Number(response.headers.get("content-length"));
        if (
          length > 0 &&
          length <= DATA_MAX_BYTES_PER_ENTRY &&
          !response.headers.get("content-encoding")
        ) {
          try {
            await cache.put(request, response.clone());
            await trimDataCache(cache);
          } catch {
            /* stockage facultatif ; la réponse réseau reste utilisable */
          }
        }
      }
      return response;
    })
    .catch(() => undefined);
  event.waitUntil(refresh); // la revalidation va au bout même après la réponse
  return cached ?? (await refresh) ?? Response.error();
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;
  // Supabase : seul le storage PUBLIC (données ouvertes) est éligible au cache.
  if (
    url.hostname.endsWith(".supabase.co") &&
    !url.pathname.startsWith("/storage/v1/object/public/")
  )
    return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(event, request));
    return;
  }
  if (isFrozenData(url)) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});
