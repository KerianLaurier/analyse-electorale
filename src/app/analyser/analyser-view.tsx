"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { GitCompare, Activity, ArrowRight, Loader2, Layers, Crosshair, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Maille, MAILLE_LABELS } from "@/lib/map-config";
import type { Choropleth } from "@/components/map";
import { nuanceColor, buildNuanceMatchExpression } from "@/lib/nuances";
import { SCRUTIN_META, maillesFor, type Scrutin } from "@/lib/url-state";
import {
  BLOCS,
  blocById,
  useBlocShare,
  useParticipationByMaille,
  useWinnerByMaille,
  useSocioByCommune,
  pearson,
  type BlocId,
  type SocioIndicator,
  type TerritoryValue,
  type TerritoryWinner,
} from "@/lib/analysis";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

// ─── Constantes ────────────────────────────────────────────────────────────────

const ELECTIONS = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
  (s) => SCRUTIN_META[s].family !== "sociologie",
);

type Mode = "comparaison" | "correlation";
type Metric = "bloc" | "participation" | "bascule";

const METRICS: { id: Metric; label: string }[] = [
  { id: "bloc", label: "Évolution d'un bloc" },
  { id: "participation", label: "Participation" },
  { id: "bascule", label: "Changement de vainqueur" },
];

const DIVERGING_NEG = "#2563eb";
const DIVERGING_MID = "#f1f5f9";
const DIVERGING_POS = "#dc2626";

const fmtPts = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;
const fmtPct = (v: number) =>
  `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

// ─── Vue ────────────────────────────────────────────────────────────────────

export function AnalyserView() {
  const [mode, setMode] = useState<Mode>("comparaison");

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="flex items-end justify-between gap-4 px-2 pt-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Analyser
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
            {mode === "comparaison" ? "Comparer des scrutins" : "Sociologie & vote"}
          </h1>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface p-0.5 shadow-card">
          {([
            { id: "comparaison", label: "Comparaison", icon: GitCompare },
            { id: "correlation", label: "Corrélation", icon: Activity },
          ] as const).map((m) => {
            const active = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-2">
        <ToolLink href="/analyser/comparateur" icon={Layers} title="Comparateur" desc="Un territoire, tous les scrutins" />
        <ToolLink href="/analyser/marginalite" icon={Crosshair} title="Sièges marginaux" desc="Circonscriptions les plus disputées" />
        <ToolLink href="/analyser/simulateur" icon={SlidersHorizontal} title="Simulateur" desc="Projection de sièges par bloc" />
      </div>

      {mode === "comparaison" ? <ComparaisonMode /> : <CorrelationMode />}
    </div>
  );
}

function ToolLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: typeof Layers;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2 shadow-card transition-colors hover:bg-surface-soft"
    >
      <span className="grid h-7 w-7 place-items-center rounded-md bg-warm/15 text-warm">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex flex-col">
        <span className="text-[12px] font-semibold leading-tight">{title}</span>
        <span className="text-[10.5px] leading-tight text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Mode Comparaison
// ═══════════════════════════════════════════════════════════════════════════

function ComparaisonMode() {
  const [scrutinA, setScrutinA] = useState<Scrutin>("presid-2022-t1");
  const [scrutinB, setScrutinB] = useState<Scrutin>("legis-2024-t1");
  const [maille, setMaille] = useState<Maille>("departements");
  const [metric, setMetric] = useState<Metric>("bloc");
  const [blocId, setBlocId] = useState<BlocId>("rn");

  const availableMailles = useMemo(() => {
    const a = new Set(maillesFor(scrutinA));
    return maillesFor(scrutinB).filter((m) => a.has(m));
  }, [scrutinA, scrutinB]);

  useEffect(() => {
    if (!availableMailles.includes(maille)) setMaille(availableMailles[0] ?? "departements");
  }, [availableMailles, maille]);

  const bloc = blocById(blocId);
  const numeric = metric !== "bascule";
  const useBloc = metric === "bloc";

  const blocA = useBlocShare(scrutinA, maille, useBloc ? bloc.codes : null, useBloc);
  const blocB = useBlocShare(scrutinB, maille, useBloc ? bloc.codes : null, useBloc);
  const partA = useParticipationByMaille(scrutinA, maille, metric === "participation");
  const partB = useParticipationByMaille(scrutinB, maille, metric === "participation");
  const winA = useWinnerByMaille(scrutinA, maille, metric === "bascule");
  const winB = useWinnerByMaille(scrutinB, maille, metric === "bascule");

  const srcA = useBloc ? blocA : partA;
  const srcB = useBloc ? blocB : partB;

  const isLoading =
    (numeric && (srcA.isFetching || srcB.isFetching)) ||
    (metric === "bascule" && (winA.isFetching || winB.isFetching));

  // Lignes numériques (bloc / participation)
  const numericRows = useMemo(() => {
    if (!numeric || !srcA.data || !srcB.data) return [];
    const mapA = new Map<string, TerritoryValue>(srcA.data.map((r) => [r.code, r]));
    const out: { code: string; libelle: string; a: number; b: number; delta: number }[] = [];
    for (const rb of srcB.data) {
      const ra = mapA.get(rb.code);
      if (!ra) continue;
      out.push({
        code: rb.code,
        libelle: rb.libelle ?? ra.libelle ?? rb.code,
        a: ra.value,
        b: rb.value,
        delta: rb.value - ra.value,
      });
    }
    out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    return out;
  }, [numeric, srcA.data, srcB.data]);

  // Lignes bascule
  const flipRows = useMemo(() => {
    if (metric !== "bascule" || !winA.data || !winB.data) return [];
    const mapA = new Map<string, TerritoryWinner>(winA.data.map((r) => [r.code, r]));
    const out: { code: string; libelle: string; from: string; to: string; flipped: boolean }[] = [];
    for (const rb of winB.data) {
      const ra = mapA.get(rb.code);
      if (!ra) continue;
      out.push({
        code: rb.code,
        libelle: rb.libelle ?? ra.libelle ?? rb.code,
        from: ra.nuance,
        to: rb.nuance,
        flipped: ra.nuance !== rb.nuance,
      });
    }
    return out;
  }, [metric, winA.data, winB.data]);

  const maxAbs = useMemo(
    () => Math.max(0.05, ...numericRows.map((r) => Math.abs(r.delta))),
    [numericRows],
  );

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (numeric) {
      if (numericRows.length === 0) return undefined;
      const m = maxAbs;
      return {
        stateKey: "delta",
        data: numericRows.map((r) => ({ code: r.code, value: r.delta })),
        paint: [
          "interpolate",
          ["linear"],
          ["feature-state", "delta"],
          -m, DIVERGING_NEG,
          -m / 2, "#93c5fd",
          0, DIVERGING_MID,
          m / 2, "#fca5a5",
          m, DIVERGING_POS,
        ] as unknown as Choropleth["paint"],
      };
    }
    const flips = flipRows.filter((r) => r.flipped);
    if (flips.length === 0) return undefined;
    return {
      stateKey: "nuance",
      data: flips.map((r) => ({ code: r.code, value: r.to })),
      paint: buildNuanceMatchExpression() as unknown as Choropleth["paint"],
    };
  }, [numeric, numericRows, flipRows, maxAbs]);

  // KPIs
  const numericKpis = useMemo(() => {
    if (!numeric || numericRows.length === 0) return null;
    const mean = numericRows.reduce((s, r) => s + r.delta, 0) / numericRows.length;
    const up = numericRows.filter((r) => r.delta > 0).length;
    const top = [...numericRows].sort((a, b) => b.delta - a.delta)[0];
    return { n: numericRows.length, mean, up, topName: top.libelle, topDelta: top.delta };
  }, [numeric, numericRows]);

  const flipKpis = useMemo(() => {
    if (metric !== "bascule") return null;
    const flips = flipRows.filter((r) => r.flipped);
    const trans = new Map<string, number>();
    for (const f of flips) {
      const k = `${f.from}→${f.to}`;
      trans.set(k, (trans.get(k) ?? 0) + 1);
    }
    const main = [...trans.entries()].sort((a, b) => b[1] - a[1])[0];
    return { n: flipRows.length, flips: flips.length, main: main ? main[0] : "—", mainN: main ? main[1] : 0 };
  }, [metric, flipRows]);

  const metricLabel = useBloc ? bloc.label : metric === "participation" ? "participation" : "vainqueur";

  return (
    <>
      {/* Paramètres */}
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <ScrutinSelect value={scrutinA} onChange={setScrutinA} accent />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <ScrutinSelect value={scrutinB} onChange={setScrutinB} accent />
          <span className="mx-1 h-5 w-px bg-border" />
          <PillGroup
            options={availableMailles.map((m) => ({ id: m, label: MAILLE_LABELS[m] }))}
            value={maille}
            onChange={(v) => setMaille(v as Maille)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PillGroup
            options={METRICS}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
          />
          {useBloc && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <BlocSelect value={blocId} onChange={setBlocId} />
            </>
          )}
          {isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* KPIs */}
      <div className="anim-stagger grid grid-cols-4 gap-2">
        {numeric ? (
          <>
            <KPICard label={`${MAILLE_LABELS[maille]}s analysés`} value={numericKpis ? fmtInt(numericKpis.n) : "—"} />
            <KPICard
              label={`Évolution moyenne · ${metricLabel}`}
              value={numericKpis ? fmtPts(numericKpis.mean) : "—"}
              accent={numericKpis ? (numericKpis.mean >= 0 ? "positive" : "negative") : undefined}
            />
            <KPICard label="Territoires en hausse" value={numericKpis ? `${fmtInt(numericKpis.up)} / ${fmtInt(numericKpis.n)}` : "—"} />
            <KPICard
              label="Plus forte hausse"
              value={numericKpis ? fmtPts(numericKpis.topDelta) : "—"}
              hint={numericKpis?.topName}
            />
          </>
        ) : (
          <>
            <KPICard label={`${MAILLE_LABELS[maille]}s analysés`} value={flipKpis ? fmtInt(flipKpis.n) : "—"} />
            <KPICard label="Territoires basculés" value={flipKpis ? fmtInt(flipKpis.flips) : "—"} accent="positive" />
            <KPICard label="Bascule principale" value={flipKpis ? transLabel(flipKpis.main) : "—"} hint={flipKpis ? `${flipKpis.mainN} territoires` : undefined} />
            <KPICard label="Stabilité" value={flipKpis && flipKpis.n ? fmtPct(1 - flipKpis.flips / flipKpis.n) : "—"} hint="inchangés" />
          </>
        )}
      </div>

      {/* Classement + carte */}
      <div className="grid min-h-[420px] grid-cols-[1fr_420px] gap-2">
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {metric === "bascule" ? "Territoires qui ont basculé" : "Plus forts mouvements"}
              </p>
              <p className="mt-0.5 text-[14px] font-medium">
                {SCRUTIN_META[scrutinA].short} → {SCRUTIN_META[scrutinB].short}
                {numeric ? ` · ${metricLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {numeric ? (
              <NumericList rows={numericRows.slice(0, 40)} maxAbs={maxAbs} blocColor={useBloc ? bloc.color : DIVERGING_POS} />
            ) : (
              <FlipList rows={flipRows.filter((r) => r.flipped).slice(0, 60)} />
            )}
          </div>
          {numeric && (
            <div className="flex items-center gap-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: DIVERGING_POS }} />Hausse</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: DIVERGING_NEG }} />Baisse</span>
              <span className="ml-auto text-[10.5px] text-muted-foreground/70">Source · MI · data.gouv.fr</span>
            </div>
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Carte</p>
            <p className="mt-0.5 text-[13px] font-medium">
              {metric === "bascule" ? "Bascules par territoire" : `Écart · ${metricLabel}`}
            </p>
          </div>
          <div className="relative min-h-0 flex-1">
            <MapView className="h-full w-full" maille={maille} choropleth={choropleth} />
          </div>
        </div>
      </div>
    </>
  );
}

function NumericList({
  rows,
  maxAbs,
  blocColor,
}: {
  rows: { code: string; libelle: string; a: number; b: number; delta: number }[];
  maxAbs: number;
  blocColor: string;
}) {
  if (rows.length === 0) return <EmptyHint />;
  return (
    <ul className="anim-stagger flex flex-col gap-1.5">
      {rows.map((r) => {
        const pos = r.delta >= 0;
        const widthPct = Math.min(50, (Math.abs(r.delta) / maxAbs) * 50);
        return (
          <li key={r.code} className="grid grid-cols-[150px_1fr_72px] items-center gap-3 text-[12px]">
            <span className="truncate text-foreground/80" title={r.libelle}>{r.libelle}</span>
            <div className="relative h-2 rounded-pill bg-surface-soft/60">
              <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <span
                className="absolute top-0 h-full rounded-pill transition-[width,left] duration-500 ease-out"
                style={{
                  left: pos ? "50%" : `calc(50% - ${widthPct}%)`,
                  width: `${widthPct}%`,
                  background: pos ? blocColor : DIVERGING_NEG,
                }}
              />
            </div>
            <span className={cn("text-right font-semibold tabular-nums", pos ? "text-foreground" : "text-muted-foreground")}>
              {fmtPts(r.delta)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FlipList({ rows }: { rows: { code: string; libelle: string; from: string; to: string }[] }) {
  if (rows.length === 0) return <EmptyHint label="Aucune bascule sur ce périmètre." />;
  return (
    <ul className="anim-stagger flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.code} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-surface-soft/50">
          <span className="w-[150px] truncate text-foreground/80" title={r.libelle}>{r.libelle}</span>
          <NuanceChip code={r.from} />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <NuanceChip code={r.to} />
        </li>
      ))}
    </ul>
  );
}

function NuanceChip({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-soft/70 px-2 py-0.5 text-[11px] font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: nuanceColor(code) }} />
      {code}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Mode Corrélation
// ═══════════════════════════════════════════════════════════════════════════

function CorrelationMode() {
  const [scrutin, setScrutin] = useState<Scrutin>("presid-2022-t1");
  const [blocId, setBlocId] = useState<BlocId>("rn");
  const [indicator, setIndicator] = useState<SocioIndicator>("revenu");

  const bloc = blocById(blocId);
  const share = useBlocShare(scrutin, "communes", bloc.codes, true);
  const socio = useSocioByCommune(indicator, true);

  const { points, r, n } = useMemo(() => {
    if (!share.data || !socio.data) return { points: [] as Array<[number, number]>, r: 0, n: 0 };
    const pairs: Array<[number, number]> = [];
    for (const row of share.data) {
      const s = socio.data.get(row.code);
      if (s == null) continue;
      pairs.push([s, row.value]);
    }
    return { points: pairs, r: pearson(pairs), n: pairs.length };
  }, [share.data, socio.data]);

  const isLoading = share.isFetching || socio.isFetching;
  const indicatorLabel = indicator === "revenu" ? "Revenu médian (€)" : "Taux de pauvreté (%)";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-4 shadow-card">
        <ScrutinSelect value={scrutin} onChange={setScrutin} accent />
        <span className="mx-1 h-5 w-px bg-border" />
        <BlocSelect value={blocId} onChange={setBlocId} />
        <span className="mx-1 h-5 w-px bg-border" />
        <PillGroup
          options={[
            { id: "revenu", label: "Revenu médian" },
            { id: "pauvrete", label: "Taux de pauvreté" },
          ]}
          value={indicator}
          onChange={(v) => setIndicator(v as SocioIndicator)}
        />
        {isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="anim-stagger grid grid-cols-4 gap-2">
        <KPICard label="Communes croisées" value={fmtInt(n)} />
        <KPICard
          label="Corrélation (Pearson r)"
          value={n ? r.toFixed(2) : "—"}
          accent={r >= 0 ? "positive" : "negative"}
        />
        <KPICard label="Intensité" value={strength(r)} hint={r >= 0 ? "relation positive" : "relation négative"} />
        <KPICard label="Bloc analysé" value={bloc.label} />
      </div>

      <div className="grid min-h-[420px] grid-cols-[1fr_320px] gap-2">
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Nuage de points · {indicatorLabel} × part {bloc.label}
          </p>
          <Scatter points={points} indicator={indicator} color={bloc.color} />
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Lecture</p>
          <p className="text-[13px] leading-relaxed text-foreground/80">
            {n === 0
              ? "Chargement des données…"
              : `Sur ${fmtInt(n)} communes, la part du bloc « ${bloc.label} » à ${SCRUTIN_META[scrutin].short} ${
                  Math.abs(r) < 0.15
                    ? "n'est quasiment pas corrélée"
                    : r > 0
                      ? "augmente"
                      : "diminue"
                } avec ${indicator === "revenu" ? "le revenu médian" : "le taux de pauvreté"} (r = ${r.toFixed(2)}, ${strength(r).toLowerCase()}).`}
          </p>
          <p className="mt-auto text-[10.5px] text-muted-foreground/70">
            Vote · MI · data.gouv.fr — Revenus · INSEE Filosofi 2021. Corrélation ≠ causalité.
          </p>
        </div>
      </div>
    </>
  );
}

function Scatter({
  points,
  indicator,
  color,
}: {
  points: Array<[number, number]>;
  indicator: SocioIndicator;
  color: string;
}) {
  const W = 760;
  const H = 360;
  const PAD = 40;
  const sample = useMemo(() => {
    if (points.length <= 1500) return points;
    const step = points.length / 1500;
    const out: Array<[number, number]> = [];
    for (let i = 0; i < points.length; i += step) out.push(points[Math.floor(i)]);
    return out;
  }, [points]);

  const bounds = useMemo(() => {
    if (points.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, maxY = 0;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, maxY: Math.max(maxY, 0.1) };
  }, [points]);

  if (!bounds) {
    return <div className="grid h-[360px] place-items-center text-[12px] text-muted-foreground">Chargement…</div>;
  }

  const sx = (x: number) =>
    PAD + ((x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - (y / bounds.maxY) * (H - 2 * PAD);
  const fmtX = (x: number) => (indicator === "revenu" ? `${Math.round(x / 1000)}k€` : `${Math.round(x)}%`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {/* axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4d4d8" strokeWidth={1} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#d4d4d8" strokeWidth={1} />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const yv = bounds.maxY * t;
        return (
          <g key={t}>
            <line x1={PAD} y1={sy(yv)} x2={W - PAD} y2={sy(yv)} stroke="#f0efe9" strokeWidth={1} />
            <text x={PAD - 6} y={sy(yv) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {Math.round(yv * 100)}%
            </text>
          </g>
        );
      })}
      {[bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX].map((xv, i) => (
        <text key={i} x={sx(xv)} y={H - PAD + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {fmtX(xv)}
        </text>
      ))}
      {sample.map(([x, y], i) => (
        <circle key={i} cx={sx(x)} cy={sy(y)} r={1.6} fill={color} fillOpacity={0.35} />
      ))}
    </svg>
  );
}

// ─── Primitives partagées ──────────────────────────────────────────────────

function ScrutinSelect({
  value,
  onChange,
  accent,
}: {
  value: Scrutin;
  onChange: (s: Scrutin) => void;
  accent?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Scrutin)}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] font-medium outline-none transition-colors",
        accent
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-surface text-foreground/80",
      )}
    >
      {ELECTIONS.map((s) => (
        <option key={s} value={s} className="bg-surface text-foreground">
          {SCRUTIN_META[s].short}
        </option>
      ))}
    </select>
  );
}

function BlocSelect({ value, onChange }: { value: BlocId; onChange: (b: BlocId) => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-2.5 py-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: blocById(value).color }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BlocId)}
        className="bg-transparent text-[12px] font-medium text-foreground/80 outline-none"
      >
        {BLOCS.map((b) => (
          <option key={b.id} value={b.id} className="bg-surface text-foreground">
            {b.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-pill px-2.5 py-1 text-[11.5px] font-medium transition-colors",
            value === o.id
              ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KPICard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-[24px] font-semibold leading-none tracking-tight tabular-nums",
          accent === "positive" && "text-success",
          accent === "negative" && "text-destructive",
        )}
        title={value}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground/80" title={hint}>{hint}</p>}
    </div>
  );
}

function EmptyHint({ label = "Sélectionne des paramètres disponibles." }: { label?: string }) {
  return <p className="grid h-full place-items-center text-[12px] text-muted-foreground">{label}</p>;
}

function transLabel(s: string) {
  return s; // "RN→ENS" déjà lisible
}

function strength(r: number) {
  const a = Math.abs(r);
  if (a < 0.15) return "Négligeable";
  if (a < 0.35) return "Faible";
  if (a < 0.55) return "Modérée";
  if (a < 0.75) return "Forte";
  return "Très forte";
}
