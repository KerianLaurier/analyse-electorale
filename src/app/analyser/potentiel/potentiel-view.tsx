"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Choropleth } from "@/components/map";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";
import {
  BLOCS,
  blocById,
  useBlocShare,
  useSocioFeaturesCirco,
  ridgeResiduals,
  type BlocId,
  type OverPerfRow,
} from "@/lib/analysis";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

const ELECTIONS = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
  (s) => SCRUTIN_META[s].family !== "sociologie" && SCRUTIN_META[s].mailles.includes("circonscriptions"),
);

const fmtPct = (v: number) => `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const fmtPts = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

const UNDER = "#2563eb"; // sous-performance (réserve)
const OVER = "#dc2626"; // sur-performance (bastion)

export function PotentielView() {
  const [scrutin, setScrutin] = useState<Scrutin>("legis-2024-t1");
  const [blocId, setBlocId] = useState<BlocId>("rn");

  const bloc = blocById(blocId);
  const share = useBlocShare(scrutin, "circonscriptions", bloc.codes, true);
  const features = useSocioFeaturesCirco(true);

  const { target, libelles } = useMemo(() => {
    const target = new Map<string, number>();
    const libelles = new Map<string, string>();
    for (const row of share.data ?? []) {
      target.set(row.code, row.value);
      libelles.set(row.code, row.libelle ?? row.code);
    }
    return { target, libelles };
  }, [share.data]);

  const model = useMemo(
    () => (features.data && target.size > 0 ? ridgeResiduals(features.data, target) : { rows: [], r2: 0, n: 0 }),
    [features.data, target],
  );

  const sorted = useMemo(() => [...model.rows].sort((a, b) => b.residual - a.residual), [model.rows]);
  const over = sorted.slice(0, 60);
  const under = [...sorted].reverse().slice(0, 60);
  const maxAbs = useMemo(
    () => Math.max(0.03, ...model.rows.map((r) => Math.abs(r.residual))),
    [model.rows],
  );

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (model.rows.length === 0) return undefined;
    const m = maxAbs;
    return {
      stateKey: "resid",
      data: model.rows.map((r) => ({ code: r.code, value: r.residual })),
      paint: [
        "interpolate", ["linear"], ["feature-state", "resid"],
        -m, UNDER, -m / 2, "#93c5fd", 0, "#f1f5f9", m / 2, "#fca5a5", m, OVER,
      ] as unknown as Choropleth["paint"],
    };
  }, [model.rows, maxAbs]);

  const isLoading = share.isFetching || features.isFetching;

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="flex items-end justify-between gap-4 px-2 pt-2">
        <div>
          <Link href="/analyser" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Analyser
          </Link>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Potentiel électoral</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Score d&apos;un bloc modélisé par la sociologie (régression sur 10 indicateurs INSEE) → sur / sous-performance par circonscription.
          </p>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-4 shadow-card">
        <select
          value={scrutin}
          onChange={(e) => setScrutin(e.target.value as Scrutin)}
          className="rounded-pill bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground outline-none"
        >
          {ELECTIONS.map((s) => (
            <option key={s} value={s} className="bg-surface text-foreground">{SCRUTIN_META[s].short}</option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-border" />
        <div className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: bloc.color }} />
          <select value={blocId} onChange={(e) => setBlocId(e.target.value as BlocId)} className="bg-transparent text-[12px] font-medium text-foreground/80 outline-none">
            {BLOCS.map((b) => <option key={b.id} value={b.id} className="bg-surface text-foreground">{b.label}</option>)}
          </select>
        </div>
      </div>

      <div className="anim-stagger grid grid-cols-4 gap-2">
        <KPICard label="Circonscriptions" value={fmtInt(model.n)} />
        <KPICard label="Vote expliqué par la socio (R²)" value={model.n ? `${Math.round(model.r2 * 100)} %` : "—"} hint="qualité du modèle" />
        <KPICard label="Sur-performance max" value={sorted[0] ? fmtPts(sorted[0].residual) : "—"} hint={sorted[0] ? libelles.get(sorted[0].code) : undefined} accent="over" />
        <KPICard label="Sous-performance max" value={sorted.length ? fmtPts(sorted[sorted.length - 1].residual) : "—"} hint={sorted.length ? libelles.get(sorted[sorted.length - 1].code) : undefined} accent="under" />
      </div>

      <div className="grid min-h-[460px] grid-cols-[1fr_1fr_420px] gap-2">
        <PerfList title="Bastions" subtitle="sur-performance vs profil" icon={TrendingUp} color={OVER} rows={over} libelles={libelles} positive />
        <PerfList title="Réserves de voix" subtitle="sous-performance vs profil" icon={TrendingDown} color={UNDER} rows={under} libelles={libelles} positive={false} />
        <div className="flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Carte</p>
            <p className="mt-0.5 text-[13px] font-medium">Écart au potentiel sociologique</p>
          </div>
          <div className="relative min-h-0 flex-1">
            <MapView className="h-full w-full" maille="circonscriptions" choropleth={choropleth} />
          </div>
          <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: OVER }} />Sur-performe</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: UNDER }} />Sous-performe</span>
            <span className="ml-auto text-[10px] text-muted-foreground/70">{bloc.label} · {SCRUTIN_META[scrutin].short}</span>
          </div>
        </div>
      </div>

      <p className="px-2 text-[10.5px] text-muted-foreground/70">
        Modèle indicatif : on régresse la part du bloc sur 10 indicateurs INSEE (revenus, inégalités, âge, chômage, CSP, diplômes) agrégés par circonscription. Le résidu (sur / sous-performance) reflète tout ce que la sociologie n&apos;explique pas (implantation, candidat, dynamique locale). Corrélation ≠ causalité.
      </p>
    </div>
  );
}

function PerfList({
  title, subtitle, icon: Icon, color, rows, libelles, positive,
}: {
  title: string; subtitle: string; icon: typeof TrendingUp; color: string;
  rows: OverPerfRow[]; libelles: Map<string, string>; positive: boolean;
}) {
  const shown = rows.filter((r) => (positive ? r.residual > 0 : r.residual < 0));
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: `${color}1a`, color }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-[13px] font-medium leading-tight">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="grid h-full place-items-center text-[12px] text-muted-foreground">—</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shown.map((r) => (
              <li key={r.code} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[12px]">
                <span className="truncate text-foreground/80" title={libelles.get(r.code) ?? r.code}>
                  {libelles.get(r.code) ?? r.code}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="text-[10.5px] text-muted-foreground">{fmtPct(r.actual)}</span>
                  <span className="font-semibold" style={{ color }}>{fmtPts(r.residual)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "over" | "under" }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-[24px] font-semibold leading-none tracking-tight tabular-nums", accent === "over" && "text-destructive", accent === "under" && "text-[color:#2563eb]")} title={value}>{value}</p>
      {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground/80" title={hint}>{hint}</p>}
    </div>
  );
}
