"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { Slider } from "@appica/ui-react/slider";
import { Button } from "@appica/ui-react/button";
import { Spinner } from "@appica/ui-react/spinner";
import { cn } from "@/lib/utils";
import type { Choropleth } from "@/components/map";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";
import { BLOCS, useCircoBlocMatrix, type BlocId, type CircoBlocRow } from "@/lib/analysis";
import { KpiCard as KPICard } from "@/components/kpi-card";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

const BASELINE: Scrutin = "legis-2024-t1";
const AUTRES_COLOR = "#cbd5e1";
const pct = (v: number) => `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

type Targets = Record<BlocId, number>; // parts 0..1

function winnerBloc(shares: Record<BlocId, number>): BlocId | "autres" {
  let best: BlocId | "autres" = "autres";
  let bestV = 0;
  for (const b of BLOCS) {
    if (shares[b.id] > bestV) {
      bestV = shares[b.id];
      best = b.id;
    }
  }
  return best;
}

export function SimulateurView() {
  const matrix = useCircoBlocMatrix(BASELINE, true);
  const [targets, setTargets] = useState<Targets | null>(null);

  const national = matrix.data?.national;
  // Référence stable pour les useMemo en aval.
  const circos = useMemo(() => matrix.data?.circos ?? [], [matrix.data]);

  // Curseurs : valeurs éditées par l'utilisateur, sinon rapport de force national
  // observé (dérivé pendant le rendu — pas d'effet d'initialisation à recâbler).
  const effectiveTargets = targets ?? national ?? null;

  const baselineSeats = useMemo(() => seatCount(circos, (c) => c.shares), [circos]);

  const projectedSeats = useMemo(() => {
    if (!national || !effectiveTargets) return null;
    return seatCount(circos, (c) => adjust(c.shares, effectiveTargets, national));
  }, [circos, national, effectiveTargets]);

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (!national || !effectiveTargets || circos.length === 0) return undefined;
    const entries: (string)[] = [];
    for (const b of BLOCS) entries.push(b.id, b.color);
    return {
      stateKey: "bloc",
      data: circos.map((c) => ({ code: c.code, value: winnerBloc(adjust(c.shares, effectiveTargets, national)) })),
      paint: ["match", ["feature-state", "bloc"], ...entries, AUTRES_COLOR] as unknown as Choropleth["paint"],
    };
  }, [circos, national, effectiveTargets]);

  const total = circos.length;
  const majorite = Math.floor(total / 2) + 1;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Simulateur législatif</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Rapport de force national par bloc → projection siège par siège (swing uniforme sur {SCRUTIN_META[BASELINE].short}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {matrix.isFetching && <Spinner currentColor className="size-4 text-muted-foreground" />}
          {national && (
            <Button
              type="button"
              onClick={() => setTargets({ ...national })}
              className="gap-1.5 rounded-md border text-[12px]" variant="soft" size="sm">
              <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-2">
        {/* Curseurs */}
        <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Hypothèses nationales</p>
          {!national || !effectiveTargets ? (
            <p className="text-[12px] text-muted-foreground">Chargement de la base…</p>
          ) : (
            BLOCS.map((b) => {
              const val = effectiveTargets[b.id];
              const delta = val - national[b.id];
              return (
                <div key={b.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      {b.label}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {pct(val)}
                      <span className={cn("ml-1.5 text-[10.5px] font-medium", delta >= 0 ? "text-success" : "text-destructive")}>
                        {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}
                      </span>
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={0.6}
                    step={0.005}
                    value={val}
                    onValueChange={(v: number | readonly number[]) =>
                      setTargets({ ...effectiveTargets, [b.id]: Array.isArray(v) ? v[0] : (v as number) })
                    }
                    className="w-full"
                    aria-label={`Score visé · ${b.label}`}
                    thumbAriaLabel={`Score visé · ${b.label}`}
                  />
                </div>
              );
            })
          )}
          <p className="mt-1 text-[10.5px] text-muted-foreground/70">
            Base nationale = {SCRUTIN_META[BASELINE].short}. Modèle de report uniforme : l&apos;écart national est appliqué identiquement à chaque circonscription. Indicatif.
          </p>
        </div>

        {/* Résultats */}
        <div className="flex flex-col gap-2">
          <div className="anim-stagger grid grid-cols-3 gap-2">
            <KPICard label="Circonscriptions" value={`${total}`} />
            <KPICard label="Majorité absolue" value={`${majorite}`} hint="sièges requis" />
            <KPICard
              label="Bloc en tête"
              value={projectedSeats ? leadLabel(projectedSeats) : "—"}
              hint={projectedSeats ? `${leadSeats(projectedSeats)} sièges` : undefined}
            />
          </div>

          <div className="rounded-lg bg-surface p-4 shadow-card">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Projection des sièges (en tête par circonscription)
            </p>
            <div className="mt-3 flex flex-col gap-2.5">
              {projectedSeats &&
                [...BLOCS, { id: "autres" as const, label: "Autres", color: AUTRES_COLOR, codes: [] }].map((b) => {
                  const seats = projectedSeats[b.id] ?? 0;
                  const base = baselineSeats[b.id] ?? 0;
                  const delta = seats - base;
                  const w = total > 0 ? (seats / total) * 100 : 0;
                  if (seats === 0 && base === 0) return null;
                  return (
                    <div key={b.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                          {b.label}
                        </span>
                        <span className="tabular-nums">
                          <span className="font-semibold">{seats}</span>
                          <span className={cn("ml-2 text-[11px] font-medium", delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                            {delta > 0 ? "+" : ""}{delta} vs base
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-soft/60">
                        <span className="block h-full rounded-pill transition-[width] duration-500" style={{ width: `${w}%`, background: b.color }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex min-h-[320px] flex-col overflow-hidden rounded-lg bg-surface shadow-card">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Carte</p>
              <p className="mt-0.5 text-[13px] font-medium">Bloc en tête par circonscription (projeté)</p>
            </div>
            <div className="relative min-h-0 flex-1">
              <MapView className="h-full w-full" maille="circonscriptions" choropleth={choropleth} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modèle ───────────────────────────────────────────────────────────────────

function adjust(
  base: Record<BlocId, number>,
  targets: Targets,
  national: Record<BlocId, number>,
): Record<BlocId, number> {
  const out = {} as Record<BlocId, number>;
  for (const b of BLOCS) out[b.id] = Math.max(0, base[b.id] + (targets[b.id] - national[b.id]));
  return out;
}

function seatCount(
  circos: CircoBlocRow[],
  sharesOf: (c: CircoBlocRow) => Record<BlocId, number>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of circos) {
    const w = winnerBloc(sharesOf(c));
    counts[w] = (counts[w] ?? 0) + 1;
  }
  return counts;
}

function leadLabel(seats: Record<string, number>): string {
  const e = Object.entries(seats).filter(([k]) => k !== "autres").sort((a, b) => b[1] - a[1])[0];
  if (!e) return "—";
  return BLOCS.find((b) => b.id === e[0])?.label ?? e[0];
}
function leadSeats(seats: Record<string, number>): number {
  const e = Object.entries(seats).filter(([k]) => k !== "autres").sort((a, b) => b[1] - a[1])[0];
  return e ? e[1] : 0;
}

