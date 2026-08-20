export const MAILLE_ORDER = [
  "regions",
  "departements",
  "circonscriptions",
  "communes",
  "bureaux",
] as const;

export type Maille = (typeof MAILLE_ORDER)[number];

// ── Paris / Lyon / Marseille (PLM) ────────────────────────────────────────────
// Les tuiles « communes » sont découpées par arrondissement (75101–75120,
// 69381–69389, 13201–13216), alors que les résultats électoraux sont agrégés au
// niveau ville (75056, 69123, 13055). Sans pont, le polygone ville n'est jamais
// apparié → couleur de base (turquoise) confondue avec une nuance. On relie les
// deux sens : coloration ville → arrondissements, clic arrondissement → ville.
function arrRange(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(start + i));
}
const CITY_TO_ARRONDISSEMENTS: Record<string, string[]> = {
  "75056": arrRange(75101, 20), // Paris
  "69123": arrRange(69381, 9), // Lyon
  "13055": arrRange(13201, 16), // Marseille
};
const ARRONDISSEMENT_TO_CITY: Record<string, string> = {};
for (const [city, arr] of Object.entries(CITY_TO_ARRONDISSEMENTS)) {
  for (const a of arr) ARRONDISSEMENT_TO_CITY[a] = city;
}
/** Codes de tuile (arrondissements PLM) à colorer pour un code commune de données. */
export function communeTileIds(code: string): string[] {
  return CITY_TO_ARRONDISSEMENTS[code] ?? [code];
}
/** Code commune de données (ville) pour un code de tuile (arrondissement PLM). */
export function communeCityCode(tileCode: string): string {
  return ARRONDISSEMENT_TO_CITY[tileCode] ?? tileCode;
}

type TileConfig = {
  path: string;
  sourceLayer: string;
  promoteId: string;
  /**
   * Zoom minimal de l'archive PMTiles. Sert de plancher de zoom à la carte
   * (cf. src/components/map.tsx) : en dessous, aucune tuile n'existe et la
   * couche n'est tout simplement pas dessinée.
   */
  minzoom: number;
  color: string;
  /** Mention de source affichée par le contrôle d'attribution MapLibre. */
  attribution: string;
};

// Attribution des contours administratifs (tuiles générées par build-tiles.sh
// depuis france-geojson, données IGN/INSEE, Licence Ouverte). MapLibre dédoublonne
// les chaînes identiques : une seule mention à l'écran pour les 4 mailles.
const ADMIN_ATTRIBUTION =
  'Contours © <a href="https://www.insee.fr">INSEE</a> / <a href="https://www.ign.fr">IGN</a>';
// Contours des bureaux de vote : Etalab / REU (Licence Ouverte 2.0).
const BUREAUX_ATTRIBUTION =
  'Bureaux de vote © <a href="https://www.data.gouv.fr/fr/datasets/proposition-de-contours-des-bureaux-de-vote/">Etalab / REU</a>';

export const TILES: Record<Maille, TileConfig> = {
  regions: {
    path: "/tiles/regions.pmtiles",
    sourceLayer: "regions",
    promoteId: "code",
    minzoom: 0,
    color: "#6366f1",
    attribution: ADMIN_ATTRIBUTION,
  },
  departements: {
    path: "/tiles/departements.pmtiles",
    sourceLayer: "departements",
    promoteId: "code",
    minzoom: 0,
    color: "#8b5cf6",
    attribution: ADMIN_ATTRIBUTION,
  },
  circonscriptions: {
    path: "/tiles/circonscriptions.pmtiles",
    sourceLayer: "circonscriptions",
    promoteId: "codeCirconscription",
    minzoom: 0,
    color: "#0ea5e9",
    attribution: ADMIN_ATTRIBUTION,
  },
  communes: {
    path: "/tiles/communes.pmtiles",
    sourceLayer: "communes",
    promoteId: "code",
    // ⚠ Doit rester ≥ au min_zoom de l'archive PMTiles déployée (6 aujourd'hui,
    // cf. build-tiles.sh) : en dessous, MapLibre demande des tuiles qui
    // n'existent pas et n'affiche RIEN. Pour une apparition plus précoce,
    // rebuild `communes` avec un minimum-zoom plus bas PUIS réuploader le
    // storage avant d'abaisser cette valeur.
    minzoom: 6,
    color: "#14b8a6",
    attribution: ADMIN_ATTRIBUTION,
  },
  // Contours officiels des bureaux de vote (Etalab / REU INSEE), PMTiles servi
  // directement par data.gouv.fr — pas de copie locale (351 Mo). CORS vérifié
  // 2026-08-18 : GET + préflight OPTIONS (Range) renvoient bien
  // Access-Control-Allow-Origin (origine reflétée). Un proxy-cache Cloudflare
  // (workers/pmtiles-proxy, supprimé, cf. historique git) reste une option si
  // les 502 intermittents de data.gouv.fr devenaient gênants. Le code de
  // jointure `codeBureauVote` (« 01001_0001 ») correspond aux agrégats
  // public/electoral/agg/{scrutin}_bureaux_*.parquet. Cf. scripts/pipeline/sources.json.
  bureaux: {
    path: "https://object.files.data.gouv.fr/data-pipeline-open/reu/reu-france-entiere-2022-06-01-v2.pmtiles",
    sourceLayer: "repertoire-unique-electoral-polygons",
    promoteId: "codeBureauVote",
    minzoom: 9,
    color: "#db2777",
    attribution: BUREAUX_ATTRIBUTION,
  },
};

export const MAILLE_LABELS: Record<Maille, string> = {
  regions: "Région",
  departements: "Département",
  circonscriptions: "Circonscription",
  communes: "Commune",
  bureaux: "Bureau de vote",
};
