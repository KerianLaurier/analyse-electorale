"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@appica/ui-react/hooks/use-theme";
import * as maplibregl from "maplibre-gl";
import {
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
  type StyleSpecification,
  type DataDrivenPropertyValueSpecification,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import { type Maille, MAILLE_ORDER, TILES, communeTileIds, communeCityCode } from "@/lib/map-config";
import {
  type BasemapPalette,
  BASEMAP_PALETTES,
  BASEMAP_SOURCE,
  basemapOverLayers,
  basemapPaintUpdates,
  basemapSource,
  basemapUnderLayers,
} from "@/lib/map-basemap";
import { dataUrl } from "@/lib/data-url";

const FRANCE_CENTER: [number, number] = [2.4, 46.6];
const FRANCE_ZOOM = 5;

/** Ids de tuile à highlight pour une sélection (étend les villes PLM à leurs arrondissements). */
function selectionIds(maille: Maille, code: string | number): Array<string | number> {
  return maille === "communes" ? communeTileIds(String(code)) : [code];
}

/** Normalise le `code` d'une feature de tuile (arrondissement PLM → ville) pour le survol/clic. */
function normProps(maille: Maille, props: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const p = props ?? {};
  if (maille === "communes" && p.code != null) return { ...p, code: communeCityCode(String(p.code)) };
  return p;
}

let protocolRegistered = false;
function registerPmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

// ── Palette par thème ─────────────────────────────────────────────────────────
// L'app expose un thème sombre (Appica UI, `.dark` sur <html>) : la carte doit
// suivre, sinon elle reste un rectangle blanc éblouissant en mode sombre. Les
// couleurs de fond/masque/villes sont alignées sur les tokens de globals.css
// (canvas sombre #0a0a0c, cf. themeColor du layout).
type MapPalette = {
  /** Fond de carte ET masque « monde moins France » (même couleur, opaque). */
  background: string;
  /** Bordure France (seule ligne visible hors hover). */
  contour: string;
  /** Remplissage des territoires sans donnée. */
  noData: string;
  /** Points/labels villes par rang (1 grandes villes, 3 préfectures, 4 sous-préf). */
  city: Record<1 | 3 | 4, string>;
  /** Halo des labels villes (même famille que le fond). */
  cityHalo: string;
  /** Liseré des points villes. */
  cityStroke: string;
  /** Épaisseur du trait de séparation entre territoires (hors survol/sélection). */
  separatorWidth: number;
  /** Opacité de ce trait. */
  separatorOpacity: number;
  /**
   * Opacité des aplats électoraux. Volontairement < 1 : le fond de carte
   * (routes, rivières, villages) doit rester lisible SOUS la couleur, sinon on
   * ne sait plus où l'on est passé le niveau régional.
   */
  fillOpacity: number;
  /** Territoires sans donnée : quasi transparents, on laisse voir le fond. */
  fillOpacityNoData: number;
  fillOpacityHover: number;
  fillOpacitySelected: number;
  /** Couleurs du fond de carte Plan IGN (cf. src/lib/map-basemap.ts). */
  basemap: BasemapPalette;
};

const PALETTES: Record<"light" | "dark", MapPalette> = {
  light: {
    background: "#ffffff",
    contour: "#888888",
    noData: "#f0f0f0",
    city: { 1: "#222222", 3: "#333333", 4: "#555555" },
    cityHalo: "rgba(255,255,255,0.9)",
    cityStroke: "#ffffff",
    // Fond clair : les aplats se détachent seuls, séparation par la couleur
    // uniquement (parti pris du style projetelections).
    separatorWidth: 0,
    separatorOpacity: 0,
    fillOpacity: 0.62,
    fillOpacityNoData: 0.2,
    fillOpacityHover: 0.82,
    fillOpacitySelected: 0.76,
    basemap: BASEMAP_PALETTES.light,
  },
  dark: {
    background: "#0a0a0c",
    contour: "#52525b",
    noData: "#232327",
    city: { 1: "#e4e4e7", 3: "#c0c0c8", 4: "#9c9ca4" },
    cityHalo: "rgba(10,10,12,0.9)",
    cityStroke: "#0a0a0c",
    // Fond sombre : les nuances les plus foncées (RN #13294b) tombent à ~1,3:1
    // de contraste avec le fond — de vastes zones rurales se lisaient comme du
    // vide. Aucun fond ne règle ça (toute teinte sombre reste proche du marine),
    // d'où un liseré clair qui délimite les territoires quelle que soit la
    // couleur de remplissage.
    separatorWidth: 0.5,
    separatorOpacity: 0.35,
    // Un peu plus opaque qu'en clair : sur fond sombre, les nuances perdent
    // vite leur identité quand on les dilue.
    fillOpacity: 0.7,
    fillOpacityNoData: 0.25,
    fillOpacityHover: 0.88,
    fillOpacitySelected: 0.82,
    basemap: BASEMAP_PALETTES.dark,
  },
};

const CITY_RANKS = [1, 3, 4] as const;

/** Épaisseur du trait : survol/sélection priment sur la séparation de base. */
const lineWidthExpr = (p: MapPalette) => [
  "case",
  ["boolean", ["feature-state", "selected"], false], 3,
  ["boolean", ["feature-state", "hover"], false], 2,
  p.separatorWidth,
];
const lineOpacityExpr = (p: MapPalette) => [
  "case",
  ["boolean", ["feature-state", "selected"], false], 1,
  ["boolean", ["feature-state", "hover"], false], 0.9,
  p.separatorOpacity,
];

/**
 * Opacité d'un aplat électoral. Semi-transparente pour laisser lire le fond de
 * carte ; les territoires SANS donnée s'effacent presque complètement, ceux qui
 * sont survolés ou sélectionnés remontent au contraire vers l'opaque.
 *
 * `stateKey` est la clé de feature-state de la choroplèthe courante (null quand
 * aucune donnée n'est chargée : tout est alors « sans donnée »).
 */
const fillOpacityExpr = (p: MapPalette, maille: Maille, stateKey: string | null): DataDrivenPropertyValueSpecification<number> => {
  // Les bureaux de vote sont de tout petits polygones : un poil plus opaques,
  // sinon ils se dissolvent dans le fond.
  const withData = Math.min(1, p.fillOpacity + (maille === "bureaux" ? 0.05 : 0));
  const base: DataDrivenPropertyValueSpecification<number> = stateKey
    ? ["case", ["==", ["feature-state", stateKey], null], p.fillOpacityNoData, withData]
    : p.fillOpacityNoData;
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false], p.fillOpacitySelected,
    ["boolean", ["feature-state", "hover"], false], p.fillOpacityHover,
    base,
  ];
};

/**
 * Style de la carte :
 *   — fond uni thémé,
 *   — matière du fond de carte Plan IGN (végétation, urbain, plans d'eau,
 *     desserte locale) — cf. src/lib/map-basemap.ts,
 *   — aplats électoraux SEMI-TRANSPARENTS par-dessus,
 *   — repères du fond (cours d'eau, grands axes, toponymes) repassés au-dessus
 *     des aplats pour rester lisibles,
 *   — « monde entier moins France » masqué opaque (GeoJSON statique),
 *   — villes repères (grandes villes / préfectures / sous-préfectures),
 *   — bordure France et survol blanc au sommet.
 */
function buildStyle(palette: MapPalette): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    // Fond de carte de repérage (tuiles vectorielles Plan IGN, sans clé d'API)
    [BASEMAP_SOURCE]: basemapSource,
    // Masque + contour France (générés par scripts/pipeline/build-france-mask.py)
    "france-contour": {
      type: "geojson",
      data: "/france_contour.geojson",
    },
    // Points villes (générés par scripts/pipeline/build-france-cities.py)
    "france-cities": {
      type: "geojson",
      data: "/france_cities.geojson",
      attribution: 'Villes © <a href="https://geo.api.gouv.fr">geo.api.gouv.fr</a>',
    },
  };

  for (const maille of MAILLE_ORDER) {
    const cfg = TILES[maille];
    // `path` : URL externe absolue (PMTiles officiel) → telle quelle ; sinon
    // résolue via `dataUrl` (object store si configuré, sinon origine courante).
    const tilesUrl = cfg.path.startsWith("http") ? cfg.path : dataUrl(cfg.path);
    sources[maille] = {
      type: "vector",
      url: `pmtiles://${tilesUrl}`,
      promoteId: { [cfg.sourceLayer]: cfg.promoteId },
      attribution: cfg.attribution,
    };
  }

  const layers: StyleSpecification["layers"] = [
    // 1. Fond uni thémé — la « terre » sous le fond de carte.
    {
      id: "background",
      type: "background",
      paint: { "background-color": palette.background },
    },
    // 1 bis. Fond de carte de repérage, sous les aplats électoraux.
    ...basemapUnderLayers(palette.basemap),
  ];

  // 2. Fills électoraux (une couche par maille, sans bordure visible).
  //
  // ⚠ Aucun `maxzoom` de COUCHE : la maille visible est pilotée par le
  // sélecteur d'échelle, pas par le zoom. Un plafond `cfg.maxzoom + 1` masquait
  // la couche au-delà (régions dès z9) — en revenant de « Commune » (zoomé) à
  // « Région », la carte redevenait vide alors que les données étaient
  // chargées. MapLibre sur-zoome nativement la dernière tuile disponible : le
  // plafond de l'archive PMTiles n'a pas à être répété ici.
  for (const maille of MAILLE_ORDER) {
    const cfg = TILES[maille];
    layers.push({
      id: `${maille}-fill`,
      type: "fill",
      source: maille,
      "source-layer": cfg.sourceLayer,
      minzoom: cfg.minzoom,
      paint: {
        // Default fill (no data) — gris neutre thémé, pas de teinte « couleur ».
        "fill-color": palette.noData,
        "fill-opacity": fillOpacityExpr(palette, maille, null) as unknown as number,
      },
      layout: {
        visibility: maille === "regions" ? "visible" : "none",
      },
    });
    // 3. Contours de séparation : invisibles en thème clair (line-width: 0, la
    //    couleur suffit à séparer), hairline en thème sombre (cf. palette).
    //    Cette couche porte aussi la bordure blanche du survol / de la sélection.
    layers.push({
      id: `${maille}-line`,
      type: "line",
      source: maille,
      "source-layer": cfg.sourceLayer,
      minzoom: cfg.minzoom,
      paint: {
        "line-color": "#ffffff",
        "line-width": lineWidthExpr(palette) as unknown as number,
        "line-opacity": lineOpacityExpr(palette) as unknown as number,
      },
      layout: {
        visibility: maille === "regions" ? "visible" : "none",
      },
    });
  }

  // 4. Repères du fond (cours d'eau, grands axes, toponymes) — AU-DESSUS des
  //    aplats, sinon la couleur les noie ; sous le masque, qui les coupe hors
  //    de France.
  layers.push(...basemapOverLayers(palette.basemap));

  // 5. Masque « monde moins France » — posé APRÈS les fills pour cacher les
  //    pays voisins, mais AVANT les villes pour ne pas les masquer.
  layers.push({
    id: "france-masque",
    type: "fill",
    source: "france-contour",
    filter: ["==", ["get", "masque"], true],
    paint: { "fill-color": palette.background, "fill-opacity": 1 },
  });

  // 6. Points + labels villes (3 niveaux de zoom).
  const cityRankConfigs = [
    { rank: 1, minzoom: 5, textSize: 11, circleRadius: 3, haloWidth: 1.5 },
    { rank: 3, minzoom: 7, textSize: 9,  circleRadius: 2, haloWidth: 1.2 },
    { rank: 4, minzoom: 9, textSize: 8,  circleRadius: 2, haloWidth: 1 },
  ] as const;
  for (const cfg of cityRankConfigs) {
    layers.push(
      {
        id: `city-dots-rank${cfg.rank}`,
        type: "circle",
        source: "france-cities",
        minzoom: cfg.minzoom,
        filter: ["==", ["get", "rank"], cfg.rank],
        paint: {
          "circle-radius": cfg.circleRadius,
          "circle-color": palette.city[cfg.rank],
          "circle-stroke-width": 1,
          "circle-stroke-color": palette.cityStroke,
        },
      },
      {
        id: `city-labels-rank${cfg.rank}`,
        type: "symbol",
        source: "france-cities",
        minzoom: cfg.minzoom,
        filter: ["==", ["get", "rank"], cfg.rank],
        layout: {
          "text-field": ["get", "nom"],
          "text-font": ["Noto Sans Regular"],
          "text-size": cfg.textSize,
          "text-anchor": "left",
          "text-offset": [0.5, 0],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": palette.city[cfg.rank],
          "text-halo-color": palette.cityHalo,
          "text-halo-width": cfg.haloWidth,
        },
      },
    );
  }

  // 7. Bordure France.
  layers.push({
    id: "france-contour-line",
    type: "line",
    source: "france-contour",
    filter: ["!", ["has", "masque"]],
    paint: { "line-color": palette.contour, "line-width": 1 },
  });

  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources,
    layers,
  };
}

export type ChoroplethEntry = {
  code: string | number;
  value: number | string;
};

export type Choropleth = {
  /** Nom de l'état (clé feature-state) injecté ; ex. "participation" */
  stateKey: string;
  /** Couleur sous forme d'expression MapLibre pour data-driven styling */
  paint: DataDrivenPropertyValueSpecification<string>;
  /** Valeurs à injecter (code feature → valeur) */
  data: ChoroplethEntry[];
};

type MapProps = {
  className?: string;
  maille?: Maille;
  onFeatureClick?: (info: { maille: Maille; properties: Record<string, unknown> }) => void;
  onFeatureHover?: (
    info: { maille: Maille; properties: Record<string, unknown>; point: { x: number; y: number } } | null,
  ) => void;
  choropleth?: Choropleth | null;
  selectedCode?: string | null;
  /** Cadrer la carte sur des bornes [ouest, sud, est, nord]. */
  bounds?: [number, number, number, number] | null;
};

export function Map({
  className,
  maille = "regions",
  onFeatureClick,
  onFeatureHover,
  choropleth,
  selectedCode,
  bounds,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  // Thème : `resolvedTheme` vaut undefined au premier rendu (le choix vit
  // dans le storage) → on démarre en clair, l'effet thème corrige juste après.
  const { resolvedTheme } = useTheme();
  const palette = PALETTES[resolvedTheme === "dark" ? "dark" : "light"];
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const hoveredFeatureRef = useRef<{
    source: string;
    sourceLayer: string;
    id: number | string;
  } | null>(null);
  const choroplethRef = useRef<Choropleth | null>(null);
  const choroplethMailleRef = useRef<Maille | null>(null);
  const onFeatureClickRef = useRef(onFeatureClick);
  const onFeatureHoverRef = useRef(onFeatureHover);
  const selectedRef = useRef<{ maille: Maille; code: string | number } | null>(null);
  // Application incrémentale des feature-states (perf : maille bureaux ~70k).
  const fsRafRef = useRef<number | null>(null);
  const fsTokenRef = useRef(0);

  // Keep the latest click callback accessible from the long-lived init effect.
  useEffect(() => {
    onFeatureClickRef.current = onFeatureClick;
  }, [onFeatureClick]);
  useEffect(() => {
    onFeatureHoverRef.current = onFeatureHover;
  }, [onFeatureHover]);

  useEffect(() => {
    if (!containerRef.current) return;
    // Le worker ESM importe son module partagé relatif. Turbopack ne copie
    // pas automatiquement ce second fichier ; predev/prebuild préparent les deux.
    maplibregl.setWorkerUrl(`/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    registerPmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(paletteRef.current),
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      attributionControl: { compact: true },
      maxZoom: 14,
    });

    // Zoom en bas à droite : le coin haut-droit est occupé par la recherche et
    // la fiche flottante du territoire sélectionné.
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

    mapRef.current = map;
    // Remise à zéro explicite : sur un remontage (StrictMode en dev, navigation
    // client), le drapeau d'une instance précédente ferait croire aux effets que
    // le style de la NOUVELLE carte est déjà chargé → paint/feature-states
    // appliqués trop tôt et silencieusement perdus.
    styleLoadedRef.current = false;
    map.on("load", () => {
      styleLoadedRef.current = true;
    });

    return () => {
      if (fsRafRef.current != null) cancelAnimationFrame(fsRafRef.current);
      fsRafRef.current = null;
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Bascule de thème : on retouche les paints (fond, masque, contour, villes)
  // sans reconstruire le style — les sources, feature-states et le zoom
  // survivent. Le gris « no data » des fills est retouché par l'effet
  // choroplèthe (qui dépend aussi de `palette`).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      // `once("load")` peut se déclencher après un démontage (la carte est alors
      // détruite) : on garde le même réflexe que les autres effets — ne toucher
      // qu'à des couches encore présentes.
      const set = (layer: string, prop: Parameters<MapLibreMap["setPaintProperty"]>[1], value: string | number) => {
        if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
      };
      set("background", "background-color", palette.background);
      set("france-masque", "fill-color", palette.background);
      set("france-contour-line", "line-color", palette.contour);
      // Trait de séparation : présent en sombre, nul en clair.
      for (const m of MAILLE_ORDER) {
        const line = `${m}-line`;
        if (!map.getLayer(line)) continue;
        map.setPaintProperty(line, "line-width", lineWidthExpr(palette) as unknown as number);
        map.setPaintProperty(line, "line-opacity", lineOpacityExpr(palette) as unknown as number);
      }
      for (const rank of CITY_RANKS) {
        set(`city-dots-rank${rank}`, "circle-color", palette.city[rank]);
        set(`city-dots-rank${rank}`, "circle-stroke-color", palette.cityStroke);
        set(`city-labels-rank${rank}`, "text-color", palette.city[rank]);
        set(`city-labels-rank${rank}`, "text-halo-color", palette.cityHalo);
      }
      // Fond de carte : eau, végétation, urbain, routes, toponymes.
      for (const { layer, prop, value } of basemapPaintUpdates(palette.basemap)) {
        // Clés issues des paints de couches typées StyleSpecification.
        set(layer, prop as Parameters<MapLibreMap["setPaintProperty"]>[1], value);
      }
    };
    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [palette]);

  // Interactions (survol / clic) : branchées UNIQUEMENT sur la maille visible.
  // Auparavant les 5 mailles étaient écoutées en permanence → MapLibre faisait 5
  // `queryRenderedFeatures` par événement souris (dont 4 sur des couches
  // masquées), pour un seul résultat exploitable.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const m = maille;
    const layerId = `${m}-fill`;
    const cfg = TILES[m];

    const clearHover = () => {
      const prev = hoveredFeatureRef.current;
      if (prev) {
        map.setFeatureState(
          { source: prev.source, sourceLayer: prev.sourceLayer, id: prev.id },
          { hover: false },
        );
      }
      hoveredFeatureRef.current = null;
    };

    const onMove = (e: MapLayerMouseEvent) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      map.getCanvas().style.cursor = "pointer";
      clearHover();
      if (feature.id !== undefined) {
        hoveredFeatureRef.current = {
          source: m,
          sourceLayer: cfg.sourceLayer,
          id: feature.id as number | string,
        };
        map.setFeatureState(hoveredFeatureRef.current, { hover: true });
      }
      onFeatureHoverRef.current?.({
        maille: m,
        properties: normProps(m, feature.properties),
        point: { x: e.point.x, y: e.point.y },
      });
    };

    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      clearHover();
      onFeatureHoverRef.current?.(null);
    };

    const onClick = (e: MapLayerMouseEvent) => {
      const cb = onFeatureClickRef.current;
      if (!e.features?.length || !cb) return;
      cb({ maille: m, properties: normProps(m, e.features[0].properties) });
    };

    map.on("mousemove", layerId, onMove);
    map.on("mouseleave", layerId, onLeave);
    map.on("click", layerId, onClick);
    return () => {
      map.off("mousemove", layerId, onMove);
      map.off("mouseleave", layerId, onLeave);
      map.off("click", layerId, onClick);
      // La carte peut déjà avoir été détruite (démontage) : ne toucher aux
      // feature-states que si l'instance est encore vivante.
      if (mapRef.current === map) clearHover();
      onFeatureHoverRef.current?.(null);
    };
  }, [maille]);

  // Maille visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      for (const m of MAILLE_ORDER) {
        const visible = m === maille ? "visible" : "none";
        if (map.getLayer(`${m}-fill`)) {
          map.setLayoutProperty(`${m}-fill`, "visibility", visible);
        }
        if (map.getLayer(`${m}-line`)) {
          map.setLayoutProperty(`${m}-line`, "visibility", visible);
        }
      }
    };
    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [maille]);

  // Plancher de zoom de la maille. Les archives PMTiles ne descendent pas
  // indéfiniment : `communes` commence à z6, `bureaux` à z9. Sous ce niveau
  // AUCUNE tuile n'existe — la couche n'est pas dessinée et la carte paraît
  // vide alors que les données sont bien chargées (légende remplie, survol
  // muet). C'était le symptôme « aucune couleur sur la carte » : depuis la vue
  // France (z5), choisir « Commune » ou « Bureau de vote » n'affichait plus
  // rien. On borne donc le zoom de la carte au plancher de la maille : MapLibre
  // y remonte immédiatement si on est en dessous, et interdit d'en redescendre.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMinZoom(TILES[maille].minzoom);
  }, [maille]);

  // Choropleth: applique les feature-state + ajuste le paint fill-color.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // 1) Reset previous feature-state. MapLibre interdit removeFeatureState
      // avec une clé sans id → on bulk-clear, puis on ré-applique "selected"
      // en fin d'effet si nécessaire.
      const prevMaille = choroplethMailleRef.current;
      if (prevMaille) {
        const prevCfg = TILES[prevMaille];
        map.removeFeatureState({
          source: prevMaille,
          sourceLayer: prevCfg.sourceLayer,
        });
      }

      // 2) Apply paint expression + fresh feature-state for the active maille.
      for (const m of MAILLE_ORDER) {
        const fillLayer = `${m}-fill`;
        if (!map.getLayer(fillLayer)) continue;

        const cfg = TILES[m];
        if (choropleth && m === maille) {
          const paint: DataDrivenPropertyValueSpecification<string> = [
            "case",
            ["==", ["feature-state", choropleth.stateKey], null],
            palette.noData,
            choropleth.paint,
          ] as DataDrivenPropertyValueSpecification<string>;
          map.setPaintProperty(fillLayer, "fill-color", paint);
          map.setPaintProperty(fillLayer, "fill-opacity", fillOpacityExpr(palette, m, choropleth.stateKey));

          // Application des feature-states. Pour les grosses mailles (bureaux,
          // ~70k entrées), on découpe par frames pour ne pas bloquer le thread
          // principal ; un token permet d'annuler si la maille/choroplèthe change.
          if (fsRafRef.current != null) {
            cancelAnimationFrame(fsRafRef.current);
            fsRafRef.current = null;
          }
          const token = ++fsTokenRef.current;
          const data = choropleth.data;
          const stateKey = choropleth.stateKey;
          const sourceLayer = cfg.sourceLayer;
          const CHUNK = 5000;
          const plm = maille === "communes";
          if (data.length <= CHUNK) {
            for (const entry of data) {
              const ids = plm ? communeTileIds(String(entry.code)) : [entry.code];
              for (const id of ids) map.setFeatureState({ source: m, sourceLayer, id }, { [stateKey]: entry.value });
            }
          } else {
            let i = 0;
            const step = () => {
              if (fsTokenRef.current !== token || !mapRef.current) return;
              const end = Math.min(i + CHUNK, data.length);
              for (; i < end; i++) {
                const entry = data[i];
                const ids = plm ? communeTileIds(String(entry.code)) : [entry.code];
                for (const id of ids) map.setFeatureState({ source: m, sourceLayer, id }, { [stateKey]: entry.value });
              }
              fsRafRef.current = i < data.length ? requestAnimationFrame(step) : null;
            };
            fsRafRef.current = requestAnimationFrame(step);
          }
        } else {
          map.setPaintProperty(fillLayer, "fill-color", palette.noData);
          map.setPaintProperty(fillLayer, "fill-opacity", fillOpacityExpr(palette, m, null));
        }
      }

      choroplethRef.current = choropleth ?? null;
      choroplethMailleRef.current = choropleth ? maille : null;

      // Ré-applique "selected" (bulk clear l'a nettoyé).
      const sel = selectedRef.current;
      if (sel) {
        const selCfg = TILES[sel.maille];
        for (const id of selectionIds(sel.maille, sel.code))
          map.setFeatureState({ source: sel.maille, sourceLayer: selCfg.sourceLayer, id }, { selected: true });
      }
    };

    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [choropleth, maille, palette]);

  // "selected" feature-state — pour highlight de l'élément sélectionné.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      // Clear previous selected.
      const prev = selectedRef.current;
      if (prev) {
        const prevCfg = TILES[prev.maille];
        for (const id of selectionIds(prev.maille, prev.code))
          map.setFeatureState({ source: prev.maille, sourceLayer: prevCfg.sourceLayer, id }, { selected: false });
        selectedRef.current = null;
      }
      // Apply new selected.
      if (selectedCode) {
        const cfg = TILES[maille];
        for (const id of selectionIds(maille, selectedCode))
          map.setFeatureState({ source: maille, sourceLayer: cfg.sourceLayer, id }, { selected: true });
        selectedRef.current = { maille, code: selectedCode };
      }
    };
    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [selectedCode, maille]);

  // Cadrage sur des bornes données.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const apply = () => {
      try {
        map.fitBounds(bounds, { padding: 30, maxZoom: 14, duration: 600 });
      } catch {
        /* bornes invalides : on ignore */
      }
    };
    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [bounds]);

  return <div ref={containerRef} className={className} />;
}
