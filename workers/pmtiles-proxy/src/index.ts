/**
 * Cloudflare Worker — proxy CORS pour PMTiles data.gouv.fr
 *
 * Problème : object.files.data.gouv.fr n'envoie pas Access-Control-Allow-Origin,
 * donc le navigateur bloque les requêtes cross-origin depuis l'app Mouvancia.
 *
 * Ce worker forwarde les requêtes (y compris Range Requests, critiques pour
 * PMTiles) en ajoutant les headers CORS manquants.
 *
 * Usage :
 *   https://<worker>.workers.dev/reu/reu-france-entiere-2022-06-01-v2.pmtiles
 *   → proxy vers
 *   https://object.files.data.gouv.fr/data-pipeline-open/reu/reu-france-entiere-2022-06-01-v2.pmtiles
 *
 * Déploiement :
 *   1. Créer un compte Cloudflare (gratuit)
 *   2. npm install -g wrangler && wrangler login
 *   3. cd workers/pmtiles-proxy && wrangler deploy
 *
 * Test local :
 *   wrangler dev
 */

const UPSTREAM_BASE = "https://object.files.data.gouv.fr/data-pipeline-open";

// Durée de cache navigateur (PMTiles change rarement).
const CACHE_CONTROL = "public, max-age=86400";

// Headers CORS à injecter sur toutes les réponses.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, If-Modified-Since, If-None-Match",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified",
};

const worker = {
  async fetch(request: Request): Promise<Response> {
    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    // path = "/reu/reu-france-entiere-2022-06-01-v2.pmtiles"
    const path = url.pathname;
    if (!path || path === "/" || !path.endsWith(".pmtiles")) {
      return new Response("Not Found — expected /<dir>/<file>.pmtiles", {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    const upstreamUrl = `${UPSTREAM_BASE}${path}${url.search}`;

    // Forward la requête en préservant les headers Range / If-* (cache + PMTiles).
    const forwardHeaders = new Headers();
    for (const h of ["Range", "If-Modified-Since", "If-None-Match", "Accept-Encoding"]) {
      const v = request.headers.get(h);
      if (v) forwardHeaders.set(h, v);
    }

    let upstream: Response;
    try {
      // `cf` est une extension Cloudflare du RequestInit standard — non typée
      // dans lib.dom. On la cast en `RequestInit & { cf?: unknown }`.
      const init = {
        method: request.method,
        headers: forwardHeaders,
        // Cloudflare met en cache automatiquement selon les headers upstream.
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: { "200": 86400, "206": 86400, "304": 3600 },
        },
      } as RequestInit & { cf?: unknown };
      upstream = await fetch(upstreamUrl, init);
    } catch (err) {
      return new Response(`Upstream fetch failed: ${(err as Error).message}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }

    // Re-construit la réponse avec CORS + cache.
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    if (!headers.has("Cache-Control")) headers.set("Cache-Control", CACHE_CONTROL);
    // S'assurer que les Range Requests sont bien exposées (PMTiles en dépend).
    if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};

export default worker;
