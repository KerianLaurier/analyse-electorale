/**
 * Base d'URL des données statiques (Parquet, PMTiles, JSON pré-calculés).
 *
 * Par défaut, ces fichiers sont servis depuis `/public` (même origine que l'app).
 * Ils pèsent ~95 Mo et sont aujourd'hui versionnés dans git — ce qui gonfle le
 * dépôt à chaque rafraîchissement du pipeline. En définissant
 * `NEXT_PUBLIC_DATA_URL` (ex. l'URL publique d'un bucket Supabase Storage), on
 * les sert depuis un object store et on peut les SORTIR du dépôt.
 *
 * `path` est un chemin absolu façon `/electoral/x.parquet`. On renvoie :
 *  - `${BASE}${path}` si la base est configurée ;
 *  - une URL absolue (origine courante) côté navigateur — DuckDB-WASM (httpfs)
 *    exige une URL absolue pour ses range requests ;
 *  - le chemin relatif côté serveur (SSR), suffisant pour un `fetch`.
 *
 * Indépendant de `src/lib/env.ts` à dessein : lecture directe de la variable
 * `NEXT_PUBLIC_*` (inlinée au build), pour que cette migration soit autonome.
 */
const BASE = process.env.NEXT_PUBLIC_DATA_URL?.replace(/\/$/, "") ?? "";

export function dataUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (BASE) return `${BASE}${p}`;
  if (typeof window === "undefined") return p;
  return `${window.location.origin}${p}`;
}
