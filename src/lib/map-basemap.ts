import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  VectorSourceSpecification,
} from "maplibre-gl";

/**
 * Fond de carte de repérage — tuiles vectorielles « Plan IGN » de la
 * Géoplateforme (data.geopf.fr).
 *
 * Pourquoi : la carte n'affichait que des aplats électoraux sur un fond uni.
 * Passé le niveau régional, plus rien ne permettait de se situer — aucune
 * rivière, aucune route, aucun village.
 *
 * Le fond est coupé en deux, de part et d'autre des aplats électoraux :
 *   — SOUS les aplats, la matière (végétation, tissu urbain, plans d'eau,
 *     desserte locale, voies ferrées) : elle teinte le sol, on accepte qu'elle
 *     s'atténue sous la couleur ;
 *   — AU-DESSUS, le squelette de repérage (cours d'eau, grands axes, puis les
 *     toponymes). Même semi-transparents, les aplats effacent complètement un
 *     trait gris clair : ces repères-là doivent passer par-dessus, sinon
 *     « se repérer » redevient impossible dès qu'un territoire est coloré.
 *
 * Pourquoi l'IGN plutôt qu'un fournisseur tiers : service public, sans clé
 * d'API, sans quota contractuel, Licence Ouverte (usage commercial autorisé),
 * CORS ouvert — et couverture strictement France + DROM, ce qui colle au
 * périmètre de l'app (le masque « monde moins France » reste en place).
 *
 * On n'utilise PAS le style IGN prêt à l'emploi (425 couches, thème clair
 * uniquement) : on redessine une poignée de couches à partir du même schéma de
 * tuiles, pour rester sobre et suivre le thème clair/sombre de l'app. Le schéma
 * (source-layers, champ `symbo`, valeurs) est publié dans
 * https://data.geopf.fr/tms/1.0.0/PLAN.IGN/metadata.json.
 */

export const BASEMAP_SOURCE = "plan-ign";

export const BASEMAP_ATTRIBUTION =
  'Fond de carte © <a href="https://www.ign.fr">IGN</a> — <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence">Licence Ouverte</a>';

export const basemapSource: VectorSourceSpecification = {
  type: "vector",
  tiles: ["https://data.geopf.fr/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf"],
  minzoom: 0,
  maxzoom: 18,
  attribution: BASEMAP_ATTRIBUTION,
};

export type BasemapPalette = {
  /** Plans d'eau (lacs, bassins, lagons) — sous les aplats. */
  water: string;
  /** Forêts, landes, vignes — sous les aplats. */
  vegetation: string;
  /** Tissu urbain et zones d'activité — sous les aplats. */
  urban: string;
  /** Desserte locale / routes non classées — sous les aplats. */
  road: string;
  /** Voies ferrées — sous les aplats. */
  rail: string;
  /** Cours d'eau et canaux — repères tracés PAR-DESSUS les aplats. */
  waterRef: string;
  waterRefOpacity: number;
  /** Autoroutes, routes principales et régionales — par-dessus les aplats. */
  roadRef: string;
  roadRefOpacity: number;
  /** Toponymes (communes, hameaux) — par-dessus les aplats. */
  label: string;
  labelHalo: string;
};

export const BASEMAP_PALETTES: Record<"light" | "dark", BasemapPalette> = {
  light: {
    water: "#cfdeeb",
    vegetation: "#dfe9d8",
    urban: "#e4e1e2",
    road: "#d2d1d6",
    rail: "#cfcfd6",
    // Repères posés sur la couleur : assez soutenus pour survivre à un aplat,
    // assez transparents pour ne pas dominer la donnée.
    waterRef: "#3f77a4",
    waterRefOpacity: 0.55,
    roadRef: "#5f5d66",
    roadRefOpacity: 0.5,
    label: "#3f3f46",
    labelHalo: "rgba(255,255,255,0.92)",
  },
  dark: {
    water: "#172735",
    vegetation: "#111a15",
    urban: "#1d1d24",
    road: "#31313a",
    rail: "#33333c",
    waterRef: "#6ba3cf",
    waterRefOpacity: 0.5,
    roadRef: "#c4c4d0",
    roadRefOpacity: 0.45,
    label: "#b0b0ba",
    labelHalo: "rgba(10,10,12,0.9)",
  },
};

/** Filtre « le champ `symbo` fait partie de cette liste ». */
function symboIn(values: string[]): FilterSpecification {
  return ["in", ["get", "symbo"], ["literal", values]] as FilterSpecification;
}

/** Interpolation linéaire d'une largeur de trait en fonction du zoom. */
function byZoom(stops: Array<[number, number]>): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], ...stops.flat()] as unknown as ExpressionSpecification;
}

// Routes : `routier_route` porte le réseau au sol, `routier_route_sup` les
// ouvrages en surélévation (ponts, viaducs). Sans ce second source-layer, une
// autoroute se coupe à chaque franchissement — trou de plusieurs centaines de
// mètres sur un viaduc. Les tunnels (`routier_route_sou`) restent non dessinés.
const ROAD_SOURCE_LAYERS = ["routier_route", "routier_route_sup"] as const;

const ROAD_CLASSES = [
  {
    key: "motorway",
    minzoom: 6,
    symbo: [
      "AUTOROU_PEAGE", "AUTOROU_LIBRE",
      "BRET_AUTO_PEAGE_1", "BRET_AUTO_PEAGE_2", "BRET_AUTO_PEAGE_3",
      "BRET_AUTO_LIBRE_1", "BRET_AUTO_LIBRE_2", "BRET_AUTO_LIBRE_3",
    ],
    ref: true,
    width: [[6, 0.7], [8, 1.2], [10, 1.7], [12, 2.5], [14, 3.6]] as Array<[number, number]>,
  },
  {
    key: "primary",
    minzoom: 7,
    symbo: ["PRINCIPALE_1", "PRINCIPALE_2", "PRINCIPALE_3", "PRINCIPALE_4", "BRET_PRINCIPALE"],
    ref: true,
    width: [[7, 0.6], [9, 1], [11, 1.5], [14, 2.8]] as Array<[number, number]>,
  },
  {
    key: "secondary",
    // z9 et pas z8 : à l'échelle départementale, le réseau régional saturait
    // la lecture des aplats. Autoroutes + routes principales suffisent là.
    minzoom: 9,
    symbo: ["REGIONALE_1", "REGIONALE_2", "REGIONALE_3", "REGIONALE_4", "BRET_REGIONALE"],
    ref: true,
    width: [[9, 0.5], [11, 0.9], [14, 2.1]] as Array<[number, number]>,
  },
  {
    key: "local",
    minzoom: 10,
    symbo: ["LOCALE_1", "LOCALE_2", "LOCALE_3", "LOCALE_4", "BRET_LOCALE", "BRET_LOCALE_1"],
    ref: false,
    width: [[10, 0.4], [12, 0.8], [14, 1.5]] as Array<[number, number]>,
  },
  {
    key: "minor",
    minzoom: 12,
    symbo: ["NON_CLASSEE", "NON_CLASSEE_4", "NON_CLASSEE_RESTREINT", "NON_REVETUE_CARRO"],
    ref: false,
    width: [[12, 0.4], [14, 1]] as Array<[number, number]>,
  },
] as const;

/** Couches routières d'une famille (grands axes ou desserte locale). */
function roadLayers(p: BasemapPalette, ref: boolean): LayerSpecification[] {
  const layers: LayerSpecification[] = [];
  for (const cls of ROAD_CLASSES) {
    if (cls.ref !== ref) continue;
    for (const sourceLayer of ROAD_SOURCE_LAYERS) {
      layers.push({
        id: `bm-road-${cls.key}-${sourceLayer}`,
        type: "line",
        source: BASEMAP_SOURCE,
        "source-layer": sourceLayer,
        minzoom: cls.minzoom,
        filter: symboIn([...cls.symbo]),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ref ? p.roadRef : p.road,
          "line-width": byZoom([...cls.width]),
          ...(ref ? { "line-opacity": p.roadRefOpacity } : {}),
        },
      });
    }
  }
  return layers;
}

/**
 * Matière du fond, dessinée SOUS les aplats électoraux.
 * Chaque famille n'apparaît qu'à partir du zoom où elle aide vraiment : la vue
 * France (z5) reste un aplat propre, le détail arrive en zoomant.
 */
export function basemapUnderLayers(p: BasemapPalette): LayerSpecification[] {
  const layers: LayerSpecification[] = [
    {
      id: "bm-vegetation",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "ocs_vegetation_surf",
      minzoom: 7,
      filter: symboIn([
        "ZONE_BOISEE",
        "ZONE_FORET_FERMEE_FEUIL",
        "ZONE_FORET_FERMEE_CONI",
        "ZONE_FORET_FERMEE_MIXTE",
        "ZONE_FORET_OUVERTE",
        "ZONE_PEUPLERAIE",
        "ZONE_LANDE_LIGNEUSE",
        "ZONE_VIGNE",
      ]),
      paint: { "fill-color": p.vegetation },
    },
    {
      id: "bm-urban",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "bati_zone_surf",
      minzoom: 7,
      filter: symboIn(["ZONE_BATI", "ZONE_INDUS_ACTI"]),
      paint: { "fill-color": p.urban },
    },
    {
      id: "bm-water-fill",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "hydro_surf",
      filter: symboIn(["SURFACE_D_EAU", "BASSIN", "ZONE_MARINE", "LAGON"]),
      paint: { "fill-color": p.water },
    },
  ];

  layers.push(...roadLayers(p, false));

  layers.push({
    id: "bm-rail",
    type: "line",
    source: BASEMAP_SOURCE,
    "source-layer": "ferre",
    minzoom: 9,
    filter: symboIn([
      "VF_1", "VF_2", "VF_3", "VF_4",
      "VF_ELEC_1", "VF_ELEC_2", "VF_ELEC_3", "VF_ELEC_4",
    ]),
    paint: {
      "line-color": p.rail,
      "line-width": byZoom([[9, 0.3], [12, 0.6], [14, 1.1]]),
    },
  });

  return layers;
}

// Toponymes IGN. Les gros repères (10 plus grandes villes, préfectures,
// sous-préfectures) restent servis par `france_cities.geojson` : on ne reprend
// ici que les échelons plus fins, pour éviter les doublons de libellés.
//   • communes moyennes / chefs-lieux → à partir de z9
//   • hameaux, lieux-dits, quartiers  → à partir de z12
const LOCALITY_TYPOS = [
  "TYPO_A_5", "TYPO_A_6", "TYPO_A_7",
  "BAT_COMMUNE_5", "BAT_COMMUNE_5_T",
  "BAT_CHEF_LIEU_COM", "BAT_CHEF_LIEU_COM_T",
  "BAT_ANCIENNE_COM", "BAT_ANCIENNE_COM_T",
  "BAT_COMMUNE_ASSOCIEE", "BAT_COMMUNE_ASSOCIEE_T",
];
const HAMLET_TYPOS = [
  "TYPO_A_8", "TYPO_A_9", "TYPO_A_10", "TYPO_E_GE",
  "BAT_HAMEAU", "BAT_HAMEAU_T",
  "BAT_QUARTIER", "BAT_QUARTIER_T",
];

/**
 * Squelette de repérage, dessiné AU-DESSUS des aplats électoraux (mais sous le
 * masque, qui le coupe hors de France) : cours d'eau, grands axes, toponymes.
 * En dessous, la couleur les efface — c'est précisément ce qu'on corrige ici.
 */
export function basemapOverLayers(p: BasemapPalette): LayerSpecification[] {
  const layers: LayerSpecification[] = [
    {
      id: "bm-water-line",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "hydro_reseau",
      minzoom: 6,
      filter: symboIn(["COURS_D_EAU", "COURS_D_EAU_MOY", "COURS_D_EAU_LAR", "CANAL"]),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.waterRef,
        "line-opacity": p.waterRefOpacity,
        "line-width": byZoom([[6, 0.5], [8, 0.8], [10, 1.1], [12, 1.7], [14, 2.6]]),
      },
    },
    ...roadLayers(p, true),
  ];

  const tiers = [
    { key: "locality", minzoom: 9, typos: LOCALITY_TYPOS, size: byZoom([[9, 9.5], [12, 11], [14, 12]]) },
    { key: "hamlet", minzoom: 12, typos: HAMLET_TYPOS, size: byZoom([[12, 8.5], [14, 10]]) },
  ];
  layers.push(...tiers.map((tier): LayerSpecification => ({
    id: `bm-label-${tier.key}`,
    type: "symbol",
    source: BASEMAP_SOURCE,
    "source-layer": "toponyme_localite_ponc",
    minzoom: tier.minzoom,
    filter: ["in", ["get", "txt_typo"], ["literal", tier.typos]] as FilterSpecification,
    layout: {
      "text-field": ["get", "texte"],
      "text-font": ["Noto Sans Regular"],
      "text-size": tier.size,
      "text-max-width": 7,
      "text-padding": 2,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": p.label,
      "text-halo-color": p.labelHalo,
      "text-halo-width": 1.2,
    },
  })));

  return layers;
}

/**
 * Propriétés de peinture à ré-appliquer sur les couches du fond lors d'une
 * bascule de thème. Dérivé des couches elles-mêmes : impossible d'oublier une
 * propriété en ajoutant une couche. Seules les valeurs constantes sont émises —
 * les largeurs sont des expressions de zoom, indépendantes du thème.
 */
export function basemapPaintUpdates(
  p: BasemapPalette,
): Array<{ layer: string; prop: string; value: string | number }> {
  const updates: Array<{ layer: string; prop: string; value: string | number }> = [];
  for (const layer of [...basemapUnderLayers(p), ...basemapOverLayers(p)]) {
    const paint = (layer as { paint?: Record<string, unknown> }).paint;
    if (!paint) continue;
    for (const [prop, value] of Object.entries(paint)) {
      if (typeof value === "string" || typeof value === "number") {
        updates.push({ layer: layer.id, prop, value });
      }
    }
  }
  return updates;
}
