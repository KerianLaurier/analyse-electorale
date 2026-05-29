"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Map as MapIcon } from "lucide-react";
import {
  useCommuneHistory,
  useSociologieCommune,
  useDemographieCommune,
  type CircoTimelinePoint,
  type CommuneSociologie,
  type DemographieCommune,
} from "@/lib/queries";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const fmtEuro = (n: number) => `${fmtInt(n)} €`;

const FR = { revenuMedian: 22040, tauxPauvrete: 14.4 };

const DISPLAY_ORDER: Scrutin[] = [
  "presid-2017-t1", "presid-2017-t2",
  "legis-2022-t1", "legis-2022-t2",
  "municipales-2026-t1", "municipales-2026-t2",
  "presid-2022-t1", "presid-2022-t2",
  "legis-2024-t1", "legis-2024-t2",
];

export function CommuneFiche({ insee }: { insee: string }) {
  const history = useCommuneHistory(insee);
  const socio = useSociologieCommune(insee);
  const demo = useDemographieCommune(insee);

  const byScrutin = useMemo(() => {
    const map = new Map<Scrutin, CircoTimelinePoint>();
    for (const p of history.data ?? []) map.set(p.scrutin, p);
    return map;
  }, [history.data]);

  const ordered = useMemo(
    () =>
      DISPLAY_ORDER.map((s) => byScrutin.get(s)).filter(
        (p): p is CircoTimelinePoint => !!p,
      ),
    [byScrutin],
  );

  const libelle =
    byScrutin.get("legis-2024-t2")?.libelle ?? (history.data ?? [])[0]?.libelle ?? null;
  const latest = byScrutin.get("presid-2022-t2") ?? ordered[ordered.length - 1];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/explorer"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Explorer
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-black/5 pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Commune · INSEE {insee}
          </p>
          <h1 className="mt-0.5 truncate text-[22px] font-semibold tracking-tight">
            {libelle ?? `Commune ${insee}`}
          </h1>
        </div>
        <Link
          href={`/explorer?maille=communes&scrutin=presid-2022-t2&code=${encodeURIComponent(insee)}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <MapIcon className="h-3.5 w-3.5" />
          Voir sur la carte
        </Link>
      </header>

      {history.isLoading ? (
        <Loading />
      ) : ordered.length === 0 && !socio.data ? (
        <Empty insee={insee} />
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KPI
              label="Revenu médian disponible"
              value={socio.data?.revenuMedian != null ? fmtEuro(socio.data.revenuMedian) : "—"}
              hint={`France : ${fmtEuro(FR.revenuMedian)}`}
              delta={
                socio.data?.revenuMedian != null
                  ? socio.data.revenuMedian - FR.revenuMedian
                  : null
              }
              deltaFmt={(d) => `${d >= 0 ? "+" : ""}${fmtInt(d)} €`}
              goodWhenPositive
            />
            <KPI
              label="Taux de pauvreté"
              value={
                socio.data?.tauxPauvrete != null
                  ? `${socio.data.tauxPauvrete.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
                  : "—"
              }
              hint={`France : ${FR.tauxPauvrete} %`}
              delta={
                socio.data?.tauxPauvrete != null ? socio.data.tauxPauvrete - FR.tauxPauvrete : null
              }
              deltaFmt={(d) => `${d >= 0 ? "+" : ""}${d.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`}
              goodWhenPositive={false}
            />
            <KPI
              label="Inscrits (dernier scrutin)"
              value={latest ? fmtInt(latest.inscrits) : "—"}
              hint={latest ? `Participation ${fmtPct(latest.participation, 0)}` : undefined}
            />
          </section>

          {demo.data && <DemographieSection demo={demo.data} />}

          {socio.data && <SociologieSection socio={socio.data} />}

          {ordered.length > 0 && (
            <section>
              <SectionTitle>Historique des scrutins</SectionTitle>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ordered.map((point) => (
                  <ScrutinRow key={point.scrutin} point={point} />
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Résultats communaux agrégés depuis les bureaux de vote (MinInt). Le
                gagnant local peut différer du résultat de la circonscription.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DemographieSection({ demo }: { demo: DemographieCommune }) {
  const pct = (v: number | null) =>
    v != null ? `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : null;
  const items: { label: string; value: string | null; hint?: string }[] = [
    { label: "Population", value: demo.population != null ? fmtInt(demo.population) : null, hint: "municipale (RP 2022)" },
    { label: "65 ans et +", value: pct(demo.part65plus), hint: "part de la population" },
    { label: "Moins de 15 ans", value: pct(demo.partMoins15), hint: "part de la population" },
    { label: "Taux de chômage", value: pct(demo.tauxChomage), hint: "actifs 15-64 ans" },
    { label: "Cadres", value: pct(demo.partCadres), hint: "des actifs occupés" },
    { label: "Ouvriers", value: pct(demo.partOuvriers), hint: "des actifs occupés" },
    { label: "Diplômés du supérieur", value: pct(demo.partDiplomeSup), hint: "des 15 ans et +" },
  ].filter((i) => i.value != null);

  if (items.length === 0) return null;

  return (
    <section>
      <SectionTitle>Démographie — INSEE Recensement 2022</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border border-black/5 bg-white/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{i.label}</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{i.value}</p>
            {i.hint && <p className="text-[10px] text-muted-foreground">{i.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function SociologieSection({ socio }: { socio: CommuneSociologie }) {
  const pct1 = (v: number | null) =>
    v != null ? `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : null;
  const items: { label: string; value: string | null; hint?: string }[] = [
    { label: "1er décile (D1)", value: socio.decile1 != null ? fmtEuro(socio.decile1) : null, hint: "niveau de vie des plus modestes" },
    { label: "9e décile (D9)", value: socio.decile9 != null ? fmtEuro(socio.decile9) : null, hint: "niveau de vie des plus aisés" },
    { label: "Rapport interdécile", value: socio.interdecile != null ? `${socio.interdecile.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}×` : null, hint: "D9 / D1 — inégalités" },
    { label: "Ménages imposés", value: pct1(socio.menagesImposes), hint: "aisance fiscale" },
    { label: "Pensions / retraites", value: pct1(socio.partPensions), hint: "part du revenu disponible" },
    { label: "Prestations sociales", value: pct1(socio.partPrestations), hint: "part du revenu disponible" },
    { label: "Indemnités chômage", value: pct1(socio.partChomage), hint: "part du revenu disponible" },
  ].filter((i) => i.value != null);

  if (items.length === 0) return null;

  return (
    <section>
      <SectionTitle>Sociologie — INSEE Filosofi 2021</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border border-black/5 bg-white/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{i.label}</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{i.value}</p>
            {i.hint && <p className="text-[10px] text-muted-foreground">{i.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ScrutinRow({ point }: { point: CircoTimelinePoint }) {
  const winner = point.candidates[0];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 px-3.5 py-3">
      <div className="w-[128px] shrink-0">
        <p className="text-[12px] font-medium leading-tight">{SCRUTIN_META[point.scrutin].short}</p>
        <p className="text-[10px] text-muted-foreground">Part. {fmtPct(point.participation, 0)}</p>
      </div>
      {winner ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: nuanceColor(winner.nuance) }}
          />
          <span className="min-w-0 flex-1 truncate text-[12px]">
            {winner.label || nuanceLabel(winner.nuance)}
          </span>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums">{fmtPct(winner.pct)}</span>
        </div>
      ) : (
        <span className="flex-1 text-[12px] text-muted-foreground">Données indisponibles</span>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

function KPI({
  label,
  value,
  hint,
  delta,
  deltaFmt,
  goodWhenPositive,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaFmt?: (d: number) => string;
  goodWhenPositive?: boolean;
}) {
  const good = delta != null && goodWhenPositive != null ? delta >= 0 === goodWhenPositive : null;
  return (
    <div className="rounded-2xl border border-black/5 bg-white/60 p-4">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <p className="text-[18px] font-semibold tabular-nums tracking-tight">{value}</p>
        {delta != null && deltaFmt && (
          <span
            className={
              "text-[11px] font-medium tabular-nums " +
              (good == null ? "text-muted-foreground" : good ? "text-emerald-600" : "text-rose-600")
            }
          >
            {deltaFmt(delta)}
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement de la commune…
    </div>
  );
}

function Empty({ insee }: { insee: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-black/5 bg-white/60 p-8 text-center">
      <p className="text-[13px] font-medium">Aucune donnée pour la commune {insee}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Vérifie le code INSEE (5 caractères, ex. « 26198 ») ou explore la carte.
      </p>
      <Link
        href="/explorer?maille=communes&scrutin=presid-2022-t2"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <MapIcon className="h-3.5 w-3.5" />
        Ouvrir l&apos;explorateur
      </Link>
    </div>
  );
}
