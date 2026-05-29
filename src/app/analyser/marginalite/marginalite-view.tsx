"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Choropleth } from "@/components/map";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";
import { useMarginalite, type MarginRow } from "@/lib/analysis";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

const LEGIS: Scrutin[] = ["legis-2024-t1", "legis-2024-t2", "legis-2022-t1", "legis-2022-t2"];
const fmtPts = (v: number) => {
  const p = v * 100;
  const d = Math.abs(p) < 1 ? 2 : 1;
  return `${p.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} pts`;
};
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

const MARGIN_STOPS: Array<[number, string]> = [
  [0, "#b91c1c"],
  [0.05, "#f97316"],
  [0.12, "#fcd34d"],
  [0.25, "#bbf7d0"],
  [0.45, "#e5e7eb"],
];

export function MarginaliteView() {
  const [scrutin, setScrutin] = useState<Scrutin>("legis-2024-t1");
  const [seuil, setSeuil] = useState(10); // points

  const q = useMarginalite(scrutin, "circonscriptions", true);
  const rows = q.data ?? [];

  const disputed = useMemo(() => rows.filter((r) => r.marginPts * 100 <= seuil), [rows, seuil]);

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (rows.length === 0) return undefined;
    return {
      stateKey: "margin",
      data: rows.map((r) => ({ code: r.code, value: r.marginPts })),
      paint: ["interpolate", ["linear"], ["feature-state", "margin"], ...MARGIN_STOPS.flat()] as unknown as Choropleth["paint"],
    };
  }, [rows]);

  const median = useMemo(() => {
    if (rows.length === 0) return 0;
    const s = [...rows].sort((a, b) => a.marginPts - b.marginPts);
    return s[Math.floor(s.length / 2)].marginPts;
  }, [rows]);

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="flex items-end justify-between gap-4 px-2 pt-2">
        <div>
          <Link href="/analyser" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Analyser
          </Link>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Sièges marginaux</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Circonscriptions les plus disputées — écart entre le 1er et le 2e.</p>
        </div>
        {q.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface p-4 shadow-card">
        <select
          value={scrutin}
          onChange={(e) => setScrutin(e.target.value as Scrutin)}
          className="rounded-pill bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground outline-none"
        >
          {LEGIS.map((s) => (
            <option key={s} value={s} className="bg-surface text-foreground">{SCRUTIN_META[s].short}</option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-border" />
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          Marge cible ≤ <span className="font-semibold text-foreground tabular-nums">{seuil} pts</span>
          <input type="range" min={1} max={30} value={seuil} onChange={(e) => setSeuil(Number(e.target.value))} className="w-40 accent-[color:var(--warm)]" />
        </label>
      </div>

      <div className="anim-stagger grid grid-cols-4 gap-2">
        <KPICard label="Circonscriptions" value={fmtInt(rows.length)} />
        <KPICard label={`Marginales (≤ ${seuil} pts)`} value={fmtInt(disputed.length)} accent="negative" />
        <KPICard label="Marge médiane" value={fmtPts(median)} />
        <KPICard
          label="La plus serrée"
          value={rows[0] ? fmtPts(rows[0].marginPts) : "—"}
          hint={rows[0]?.libelle ?? undefined}
        />
      </div>

      <div className="grid min-h-[440px] grid-cols-[1fr_420px] gap-2">
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Classement · {fmtInt(disputed.length)} circonscriptions ≤ {seuil} pts
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {disputed.length === 0 ? (
              <p className="grid h-full place-items-center text-[12px] text-muted-foreground">Aucune circonscription sous ce seuil.</p>
            ) : (
              <ul className="anim-stagger flex flex-col gap-1.5">
                {disputed.slice(0, 80).map((r) => (
                  <MarginRowItem key={r.code} row={r} seuil={seuil} />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Carte</p>
            <p className="mt-0.5 text-[13px] font-medium">Marginalité par circonscription</p>
          </div>
          <div className="relative min-h-0 flex-1">
            <MapView className="h-full w-full" maille="circonscriptions" choropleth={choropleth} />
          </div>
          <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#b91c1c" }} />Très disputé</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#e5e7eb" }} />Acquis</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarginRowItem({ row, seuil }: { row: MarginRow; seuil: number }) {
  const widthPct = Math.min(100, (row.marginPts * 100 / seuil) * 100);
  return (
    <li className="grid grid-cols-[160px_1fr_64px] items-center gap-3 text-[12px]">
      <span className="truncate text-foreground/80" title={row.libelle ?? row.code}>{row.libelle ?? row.code}</span>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: nuanceColor(row.leaderNuance) }} />
          <span className="text-muted-foreground" title={nuanceLabel(row.leaderNuance)}>{row.leaderNuance}</span>
        </span>
        <span className="text-muted-foreground/50">vs</span>
        <span className="inline-flex items-center gap-1 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: nuanceColor(row.runnerNuance ?? "") }} />
          <span className="text-muted-foreground" title={nuanceLabel(row.runnerNuance ?? "")}>{row.runnerNuance ?? "—"}</span>
        </span>
        <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-pill bg-surface-soft/60">
          <span className="block h-full rounded-pill bg-destructive/80" style={{ width: `${100 - widthPct}%` }} />
        </div>
      </div>
      <span className="text-right font-semibold tabular-nums text-foreground">{fmtPts(row.marginPts)}</span>
    </li>
  );
}

function KPICard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "positive" | "negative" }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-[24px] font-semibold leading-none tracking-tight tabular-nums", accent === "negative" && "text-destructive", accent === "positive" && "text-success")} title={value}>{value}</p>
      {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground/80" title={hint}>{hint}</p>}
    </div>
  );
}
