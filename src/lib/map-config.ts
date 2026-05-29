export const MAILLE_ORDER = [
  "regions",
  "departements",
  "circonscriptions",
  "communes",
  "bureaux",
] as const;

export type Maille = (typeof MAILLE_ORDER)[number];

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
