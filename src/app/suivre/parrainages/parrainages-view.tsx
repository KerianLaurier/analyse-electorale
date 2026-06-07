"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Stamp, Check, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Choropleth } from "@/components/map";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { fmtInt } from "@/lib/format";
import { formatDateFr } from "@/lib/sondages";
import { useParrainages, SEUIL, type ParrainageCandidat } from "@/lib/parrainages";
import { ErrorState } from "@/components/error-state";
import { InlineLoading } from "@/components/inline-loading";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">Chargement de la carte…</div>
  ),
});

export function ParrainagesView() {
  const q = useParrainages();
  const data = q.data;

  const maxDept = useMemo(() => {
    if (!data) return 0;
    return Math.max(1, ...Object.values(data.byDept));
  }, [data]);

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (!data) return undefined;
    const m = maxDept;
    return {
      stateKey: "parr",
      data: Object.entries(data.byDept).map(([code, value]) => ({ code, value })),
      paint: [
        "interpolate", ["linear"], ["feature-state", "parr"],
        0, "#efece4", m * 0.33, "#f6cd7e", m * 0.66, "#f0a020", m, "#b06a10",
      ] as unknown as Choropleth["paint"],
    };
  }, [data, maxDept]);

  const qualifies = data ? data.candidats.filter((c) => c.total >= SEUIL).length : 0;
  const totalParr = data ? data.candidats.reduce((s, c) => s + c.total, 0) : 0;

  return (
    <div className="anim-fade-in mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/suivre" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Suivre
      </Link>

      <header className="mt-3 border-b border-foreground/5 pb-5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Stamp className="h-3.5 w-3.5" /> Suivre
        </p>
        <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">Parrainages présidentiels 2027</h1>
        <p className="text-[12.5px] text-muted-foreground">
          Course aux 500 signatures d&apos;élus — suivi de l&apos;open data du Conseil constitutionnel.
        </p>
      </header>

      {q.isError ? (
        <ErrorState className="mt-10" message="Impossible de charger les parrainages." onRetry={() => void q.refetch()} />
      ) : q.isLoading || !data ? (
        <InlineLoading label="Chargement des parrainages…" />
      ) : (
        <>
          {data.demo && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-warm/30 bg-warm/[0.07] px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
              <p className="text-[12.5px] leading-relaxed text-foreground/80">
                <span className="font-semibold">Aperçu (démo)</span> — données illustratives. Les chiffres réels du
                <strong> Conseil constitutionnel</strong> s&apos;afficheront automatiquement dès l&apos;ouverture des
                parrainages (janvier 2027), avec mises à jour pluri-hebdomadaires.
              </p>
            </div>
          )}

          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPI label="Seuil requis" value={`${SEUIL}`} hint="signatures d'élus" />
            <KPI label="Candidat·es ≥ 500" value={`${qualifies}`} hint="qualifié·es" accent="positive" />
            <KPI label="Parrainages validés" value={fmtInt(totalParr)} />
            <KPI label="Dernière mise à jour" value={formatDateFr(data.updatedAt)} small />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_440px]">
            {/* Compteur par candidat */}
            <section>
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Compteur par candidat·e · évolution hebdo
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {data.candidats.map((c) => (
                  <CandidateRow key={c.id} c={c} />
                ))}
              </ul>
            </section>

            {/* Carte par département */}
            <section>
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Parrainages par département
              </h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
                <div className="relative h-[420px]">
                  <MapView className="h-full w-full" maille="departements" choropleth={choropleth} />
                </div>
                <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5 text-[10.5px] text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Faible</span>
                  <span className="h-2 flex-1 rounded-pill" style={{ background: "linear-gradient(90deg,#efece4,#f6cd7e,#f0a020,#b06a10)" }} />
                  <span>Élevé</span>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function CandidateRow({ c }: { c: ParrainageCandidat }) {
  const pct = Math.min(100, (c.total / SEUIL) * 100);
  const ok = c.total >= SEUIL;
  return (
    <li className="rounded-xl border border-border/70 bg-surface p-3.5 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: nuanceColor(c.nuance) }} />
        <span className="text-[13.5px] font-medium">{c.nom}</span>
        <span className="text-[11px] text-muted-foreground" title={nuanceLabel(c.nuance)}>{c.nuance}</span>
        <span className="ml-auto flex items-center gap-2">
          {ok && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[10.5px] font-semibold text-success">
              <Check className="h-3 w-3" /> Qualifié·e
            </span>
          )}
          <span className="text-[15px] font-semibold tabular-nums">{fmtInt(c.total)}</span>
          <span className="text-[11px] text-muted-foreground">/ {SEUIL}</span>
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-soft">
          <span
            className="block h-full rounded-pill"
            style={{ width: `${pct}%`, background: ok ? "var(--success)" : nuanceColor(c.nuance) }}
          />
        </div>
        <Sparkline values={c.weekly} color={nuanceColor(c.nuance)} />
      </div>
    </li>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 72, h = 22, max = Math.max(...values) || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 3) - 1.5}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KPI({ label, value, hint, accent, small }: { label: string; value: string; hint?: string; accent?: "positive"; small?: boolean }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate font-semibold leading-none tracking-tight tabular-nums", small ? "text-[15px]" : "text-[24px]", accent === "positive" && "text-success")} title={value}>
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
