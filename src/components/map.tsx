"use client";

import { useEffect, useRef } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
  type DataDrivenPropertyValueSpecification,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import { type Maille, MAILLE_ORDER, TILES } from "@/lib/map-config";

const FRANCE_CENTER: [number, number] = [2.4, 46.6];
const FRANCE_ZOOM = 5;

let protocolRegistered = false;
function registerPmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

function buildStyle(origin: string): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    // Fond raster CARTO Positron — basemap sobre, peu d'infos, labels FR discrets.
    "basemap": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    },
  };

  for (const maille of MAILLE_ORDER) {
    const cfg = TILES[maille];
    sources[maille] = {
      type: "vector",
      url: `pmtiles://${origin}${cfg.path}`,
      promoteId: { [cfg.sourceLayer]: cfg.promoteId },
    };
  }

  const layers: StyleSpecification["layers"] = [
    { id: "basemap", type: "raster", source: "basemap" },
  ];

  for (const maille of MAILLE_ORDER) {
    const cfg = TILES[maille];
    layers.push(
      {
        id: `${maille}-fill`,
        type: "fill",
        source: maille,
        "source-layer": cfg.sourceLayer,
        minzoom: cfg.minzoom,
        maxzoom: cfg.maxzoom + 1,
        paint: {
          // Default fill (no data) — light tint of the layer color.
          "fill-color": cfg.color,
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.3,
            ["boolean", ["feature-state", "hover"], false], 0.4,
            0.08,
          ],
        },
        layout: {
          visibility: maille === "regions" ? "visible" : "none",
        },
      },
      {
        id: `${maille}-line`,
        type: "line",
        source: maille,
        "source-layer": cfg.sourceLayer,
        minzoom: cfg.minzoom,
        maxzoom: cfg.maxzoom + 1,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#0f172a",
            cfg.color,
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 2.5,
            ["boolean", ["feature-state", "hover"], false], 2,
            0.6,
          ],
          "line-opacity": 0.9,
        },
        layout: {
          visibility: maille === "regions" ? "visible" : "none",
        },
      },
    );
  }

  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
  choropleth?: Choropleth | null;
  selectedCode?: string | null;
};

export function Map({
  className,
  maille = "regions",
  onFeatureClick,
  choropleth,
  selectedCode,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  const hoveredFeatureRef = useRef<{
    source: string;
    sourceLayer: string;
    id: number | string;
  } | null>(null);
  const choroplethRef = useRef<Choropleth | null>(null);
  const choroplethMailleRef = useRef<Maille | null>(null);
  const onFeatureClickRef = useRef(onFeatureClick);
  const selectedRef = useRef<{ maille: Maille; code: string | number } | null>(null);

  // Keep the latest click callback accessible from the long-lived init effect.
  useEffect(() => {
    onFeatureClickRef.current = onFeatureClick;
  }, [onFeatureClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    registerPmtilesProtocol();

    const origin = typeof window === "undefined" ? "" : window.location.origin;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(origin),
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      attributionControl: { compact: true },
      maxZoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

    mapRef.current = map;
    map.on("load", () => {
      styleLoadedRef.current = true;
    });

    for (const m of MAILLE_ORDER) {
      const layerId = `${m}-fill`;
      const cfg = TILES[m];

      map.on("mousemove", layerId, (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        map.getCanvas().style.cursor = "pointer";
        const prev = hoveredFeatureRef.current;
        if (prev) {
          map.setFeatureState(
            { source: prev.source, sourceLayer: prev.sourceLayer, id: prev.id },
            { hover: false },
          );
        }
        if (feature.id !== undefined) {
          hoveredFeatureRef.current = {
            source: m,
            sourceLayer: cfg.sourceLayer,
            id: feature.id as number | string,
          };
          map.setFeatureState(hoveredFeatureRef.current, { hover: true });
        }
      });

      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
        const prev = hoveredFeatureRef.current;
        if (prev) {
          map.setFeatureState(
            { source: prev.source, sourceLayer: prev.sourceLayer, id: prev.id },
            { hover: false },
          );
        }
        hoveredFeatureRef.current = null;
      });

      map.on("click", layerId, (e) => {
        const cb = onFeatureClickRef.current;
        if (!e.features?.length || !cb) return;
        cb({
          maille: m,
          properties: e.features[0].properties ?? {},
        });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            cfg.color,
            choropleth.paint,
          ] as DataDrivenPropertyValueSpecification<string>;
          map.setPaintProperty(fillLayer, "fill-color", paint);
          map.setPaintProperty(fillLayer, "fill-opacity", [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.95,
            ["boolean", ["feature-state", "hover"], false], 0.85,
            0.65,
          ]);

          for (const entry of choropleth.data) {
            map.setFeatureState(
              { source: m, sourceLayer: cfg.sourceLayer, id: entry.code },
              { [choropleth.stateKey]: entry.value },
            );
          }
        } else {
          map.setPaintProperty(fillLayer, "fill-color", cfg.color);
          map.setPaintProperty(fillLayer, "fill-opacity", [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.3,
            ["boolean", ["feature-state", "hover"], false], 0.4,
            0.08,
          ]);
        }
      }

      choroplethRef.current = choropleth ?? null;
      choroplethMailleRef.current = choropleth ? maille : null;

      // Ré-applique "selected" (bulk clear l'a nettoyé).
      const sel = selectedRef.current;
      if (sel) {
        const selCfg = TILES[sel.maille];
        map.setFeatureState(
          { source: sel.maille, sourceLayer: selCfg.sourceLayer, id: sel.code },
          { selected: true },
        );
      }
    };

    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [choropleth, maille]);

  // "selected" feature-state — pour highlight de l'élément sélectionné.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      // Clear previous selected.
      const prev = selectedRef.current;
      if (prev) {
        const prevCfg = TILES[prev.maille];
        map.setFeatureState(
          { source: prev.maille, sourceLayer: prevCfg.sourceLayer, id: prev.code },
          { selected: false },
        );
        selectedRef.current = null;
      }
      // Apply new selected.
      if (selectedCode) {
        const cfg = TILES[maille];
        map.setFeatureState(
          { source: maille, sourceLayer: cfg.sourceLayer, id: selectedCode },
          { selected: true },
        );
        selectedRef.current = { maille, code: selectedCode };
      }
    };
    if (styleLoadedRef.current || map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [selectedCode, maille]);

  return <div ref={containerRef} className={className} />;
}
