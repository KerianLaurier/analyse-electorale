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
  minzoom: number;
  maxzoom: number;
  color: string;
};

export const TILES: Record<Maille, TileConfig> = {
  regions: {
    path: "/tiles/regions.pmtiles",
    sourceLayer: "regions",
    promoteId: "code",
    minzoom: 0,
    maxzoom: 8,
    color: "#6366f1",
  },
  departements: {
    path: "/tiles/departements.pmtiles",
    sourceLayer: "departements",
    promoteId: "code",
    minzoom: 0,
    maxzoom: 9,
    color: "#8b5cf6",
  },
  circonscriptions: {
    path: "/tiles/circonscriptions.pmtiles",
    sourceLayer: "circonscriptions",
    promoteId: "codeCirconscription",
    minzoom: 0,
    maxzoom: 11,
    color: "#0ea5e9",
  },
  communes: {
    path: "/tiles/communes.pmtiles",
    sourceLayer: "communes",
    promoteId: "code",
    minzoom: 6,
    maxzoom: 13,
    color: "#14b8a6",
  },
  // Contours officiels des bureaux de vote (Etalab / REU INSEE), PMTiles servi
  // directement par data.gouv.fr — pas de copie locale (282 Mo). Le code de
  // jointture `codeBureauVote` (« 01001_0001 ») correspond aux agrégats
  // public/electoral/agg/{scrutin}_bureaux_*.parquet. Cf. scripts/pipeline/sources.json.
  bureaux: {
    path: "https://object.files.data.gouv.fr/data-pipeline-open/reu/reu-france-entiere-2022-06-01-v2.pmtiles",
    sourceLayer: "repertoire-unique-electoral-polygons",
    promoteId: "codeBureauVote",
    minzoom: 9,
    maxzoom: 14,
    color: "#db2777",
  },
};

export const MAILLE_LABELS: Record<Maille, string> = {
  regions: "Région",
  departements: "Département",
  circonscriptions: "Circonscription",
  communes: "Commune",
  bureaux: "Bureau de vote",
};
