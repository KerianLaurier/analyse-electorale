"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Map as MapIcon, Crosshair, Target, BarChart3 } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import { useCircoHistory, type CircoTimelinePoint } from "@/lib/queries";
import { CircoStrategie } from "./circo-strategie";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { candidatSlug } from "@/lib/personnes";
import { SCRUTIN_META, chronoFor, type Scrutin, type ScrutinFamily } from "@/lib/url-state";
import { ExportButton } from "@/components/export-button";
import { PinButton } from "@/components/pin-button";
import { ErrorState } from "@/components/error-state";
import { InlineLoading } from "@/components/inline-loading";
import { EmptyState } from "@/components/empty-state";
import { downloadCsv, type CsvRow } from "@/lib/export";
import { circoLabel, DEPT_NAMES } from "@/lib/territoire";
import { fmtInt, fmtPct } from "@/lib/format";

const candidatHref = (scrutin: Scrutin, code: string, label: string) =>
  `/candidat/${encodeURIComponent(`${scrutin}__${code}__${candidatSlug(label)}`)}`;

const FAMILY_GROUPS: { family: ScrutinFamily; label: string }[] = [
  { family: "presidentielle", label: "Présidentielles" },
  { family: "legislative", label: "Législatives" },
];

const fmtPts = (n: number) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`;

/** « 2602 » → { dept: "26", num: 2 } ; gère l'outre-mer (codes à 5 chiffres). */
function decodeCircoCode(code: string): { dept: string; num: number | null } {
  const dept = code.length > 2 ? code.slice(0, code.length - 2) : code;
  const num = Number(code.slice(-2));
  return { dept, num: Number.isFinite(num) ? num : null };
}

type CircoTab = "strategie" | "resultats";

export function CircoFiche({ code }: { code: string }) {
  const history = useCircoHistory(code);
  const { dept, num } = decodeCircoCode(code);
  const [tab, setTab] = useState<CircoTab>("strategie");

  const byScrutin = useMemo(() => {
    const map = new Map<Scrutin, CircoTimelinePoint>();
    for (const p of history.data ?? []) map.set(p.scrutin, p);
    return map;
  }, [history.data]);

  const latestLegis = byScrutin.get("legis-2024-t2") ?? byScrutin.get("legis-2024-t1");
  const deputy = latestLegis?.candidates.find((c) => c.elu) ?? latestLegis?.candidates[0] ?? null;
  const libelle = latestLegis?.libelle ?? (history.data ?? [])[0]?.libelle ?? null;

  // Ordre chronologique d'affichage (anciens → récents) pour la frise.
  const ordered = useMemo(
    () =>
      chronoFor("circonscriptions")
        .map((s) => byScrutin.get(s))
        .filter((p): p is CircoTimelinePoint => !!p),
    [byScrutin],
  );

  function exportCsv() {
    const rows: CsvRow[] = ordered.map((p) => {
      const w = p.candidates[0];
      return {
        Scrutin: SCRUTIN_META[p.scrutin].short,
        Type: SCRUTIN_META[p.scrutin].family,
        "Arrive en tête": w ? w.label || nuanceLabel(w.nuance) : "",
        Nuance: w?.nuance ?? "",
        "Part %": w ? Number((w.pct * 100).toFixed(1)) : "",
        "Participation %": Number((p.participation * 100).toFixed(1)),
        Inscrits: Math.round(p.inscrits),
        Exprimés: Math.round(p.exprimes),
      };
    });
    downloadCsv(`circo-${code}`, rows);
  }

  return (
    <div className="anim-fade-in mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/explorer"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Explorer
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-foreground/5 pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Circonscription législative
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">
            {circoLabel(code)}
          </h1>
          {libelle && num == null && (
            <p className="text-[13px] text-muted-foreground">{libelle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PinButton
            pin={{ type: "circo", id: code, label: circoLabel(code), sublabel: `Circonscription législative · ${DEPT_NAMES[dept] ?? dept}`, href: `/circo/${code}` }}
          />
          {ordered.length > 0 && <ExportButton onClick={exportCsv} />}
          <Link
            href={`/analyser/ciblage?circo=${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/[0.08]"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Ciblage terrain
          </Link>
          <Link
            href={`/explorer?maille=circonscriptions&scrutin=legis-2024-t2&code=${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <MapIcon className="h-3.5 w-3.5" />
            Voir sur la carte
          </Link>
        </div>
      </header>

      {history.isError ? (
        <ErrorState
          className="mt-10"
          message="Impossible de charger les résultats de cette circonscription."
          onRetry={() => void history.refetch()}
        />
      ) : history.isLoading ? (
        <InlineLoading label="Chargement de la circonscription…" />
      ) : ordered.length === 0 ? (
        <EmptyState
          title={`Aucune donnée pour la ${circoLabel(code)}`}
          description="Vérifie le code (format INSEE, ex. « 2602 ») ou explore la carte."
          action={{ href: "/explorer?maille=circonscriptions&scrutin=legis-2024-t2", label: "Ouvrir l'explorateur" }}
        />
      ) : (
        <>
          <nav className="mt-5 inline-flex items-center gap-1 rounded-pill bg-surface-soft/70 p-1 text-[13px]">
            {([
              { id: "strategie", label: "Stratégie", icon: Target },
              { id: "resultats", label: "Résultats", icon: BarChart3 },
            ] as const).map((t) => {
              const active = tab === t.id;
              return (
                <Button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 font-medium transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(10,10,12,0.18)]"
                      : "text-foreground/70 hover:text-foreground hover:bg-surface/60",
                  )} variant="ghost" size="sm">
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </Button>
              );
            })}
          </nav>

          {tab === "strategie" && <CircoStrategie code={code} history={history.data ?? []} />}

          {tab === "resultats" && (
            <div className="mt-6 flex flex-col gap-8">
          {deputy && latestLegis && (
            <section>
              <SectionTitle>Député·e en exercice (législatives 2024)</SectionTitle>
              <Link
                href={`/elu/${encodeURIComponent(code)}`}
                className="mt-2 flex flex-wrap items-center gap-4 rounded-2xl border border-foreground/5 bg-surface/60 p-5 transition-colors hover:bg-surface"
              >
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white"
                  style={{ background: nuanceColor(deputy.nuance) }}
                >
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold tracking-tight">
                    {deputy.label || nuanceLabel(deputy.nuance)}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {nuanceLabel(deputy.nuance)} · élu·e avec {fmtPct(deputy.pct)} des exprimés
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                    Participation
                  </p>
                  <p className="text-[16px] font-semibold tabular-nums">
                    {fmtPct(latestLegis.participation)}
                  </p>
                </div>
              </Link>
            </section>
          )}

          {FAMILY_GROUPS.map((g) => {
            const pts = ordered.filter((p) => SCRUTIN_META[p.scrutin].family === g.family);
            if (pts.length === 0) return null;
            return (
              <section key={g.family}>
                <SectionTitle>{g.label}</SectionTitle>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {pts.map((point) => (
                    <ScrutinRow key={point.scrutin} point={point} />
                  ))}
                </div>
              </section>
            );
          })}

          {latestLegis && (
            <section>
              <SectionTitle>
                Détail — {SCRUTIN_META[latestLegis.scrutin].short}
              </SectionTitle>
              <div className="mt-2 rounded-2xl border border-foreground/5 bg-surface/60 p-5">
                <ResultBars detail={latestLegis} />
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <KPI label="Inscrits" value={fmtInt(latestLegis.inscrits)} />
                  <KPI label="Votants" value={fmtInt(latestLegis.votants)} />
                  <KPI label="Exprimés" value={fmtInt(latestLegis.exprimes)} />
                  <KPI label="Blancs + nuls" value={fmtInt(latestLegis.blancs + latestLegis.nuls)} />
                </div>
              </div>
            </section>
          )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScrutinRow({ point }: { point: CircoTimelinePoint }) {
  const top = point.candidates;
  const winner = top[0];
  const margin = top.length >= 2 ? top[0].pct - top[1].pct : top[0]?.pct ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-foreground/5 bg-surface/60 px-3.5 py-3">
      <div className="w-[112px] shrink-0">
        <p className="text-[12px] font-medium leading-tight">{SCRUTIN_META[point.scrutin].short}</p>
        <p className="text-[10px] text-muted-foreground">Part. {fmtPct(point.participation, 0)}</p>
      </div>
      {winner ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: nuanceColor(winner.nuance) }}
          />
          {winner.label ? (
            <Link
              href={candidatHref(point.scrutin, point.code, winner.label)}
              className="min-w-0 flex-1 truncate text-[12px] hover:text-warm hover:underline"
            >
              {winner.label}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[12px]">{nuanceLabel(winner.nuance)}</span>
          )}
          <span className="shrink-0 text-[12px] font-semibold tabular-nums">{fmtPct(winner.pct)}</span>
        </div>
      ) : (
        <span className="flex-1 text-[12px] text-muted-foreground">Données indisponibles</span>
      )}
      <span
        className="shrink-0 rounded-full bg-foreground/[0.04] px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground"
        title="Avance du 1er sur le 2e (marginalité)"
      >
        +{fmtPts(margin)}
      </span>
    </div>
  );
}

function ResultBars({ detail }: { detail: CircoTimelinePoint }) {
  const top = detail.candidates.slice(0, 8);
  const max = Math.max(...top.map((c) => c.pct), 0.0001);
  return (
    <div className="flex flex-col gap-2.5">
      {top.map((c, i) => (
        <div key={`${c.label}-${i}`} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-1.5">
              {c.elu && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
              {c.label ? (
                <Link
                  href={candidatHref(detail.scrutin, detail.code, c.label)}
                  className="truncate hover:text-warm hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="truncate">{nuanceLabel(c.nuance)}</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{fmtPct(c.pct)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.05]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(c.pct / max) * 100}%`, background: nuanceColor(c.nuance) }}
            />
          </div>
        </div>
      ))}
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

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-foreground/5 bg-surface/60 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

