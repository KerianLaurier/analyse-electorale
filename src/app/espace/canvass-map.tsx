"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useTerritoryBounds, type LngLatBounds } from "@/lib/queries";
import type { Choropleth } from "@/components/map";
import type { Sector, CampaignTarget } from "@/lib/campaign";
import type { SectorAgg } from "@/lib/canvass";

const Map = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] items-center justify-center rounded-lg border border-foreground/5 bg-surface text-[13px] text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement de la carte…
    </div>
  ),
});

// Vert (travaillé) / ambre (en cours) / gris (à faire) / défaut (hors plan).
const COVERAGE_PAINT = [
  "match",
  ["feature-state", "coverage"],
  3, "#16a34a",
  2, "#f59e0b",
  1, "#cbd5e1",
  "#e2e8f0",
] as unknown as Choropleth["paint"];

export function CanvassMap({
  target,
  sectors,
  agg,
}: {
  target: CampaignTarget;
  sectors: Sector[];
  agg: Map<string, SectorAgg>;
}) {
  const bounds = useTerritoryBounds(target);

  const choropleth = useMemo<Choropleth>(() => {
    const data = sectors
      .filter((s) => s.bureauCode)
      .map((s) => {
        const met = agg.get(s.id)?.met ?? 0;
        const value = met > 0 || s.status === "done" ? 3 : s.status === "doing" ? 2 : 1;
        return { code: s.bureauCode as string, value };
      });
    return { stateKey: "coverage", paint: COVERAGE_PAINT, data };
  }, [sectors, agg]);

  return (
    <div>
      <Map
        maille="bureaux"
        choropleth={choropleth}
        bounds={(bounds.data as LngLatBounds | null) ?? null}
        className="h-[440px] w-full overflow-hidden rounded-lg border border-foreground/5"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <Legend color="#16a34a" label="Travaillé" />
        <Legend color="#f59e0b" label="En cours" />
        <Legend color="#cbd5e1" label="À faire" />
        <span>· Chaque polygone = un bureau de vote du territoire.</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> {label}
    </span>
  );
}
