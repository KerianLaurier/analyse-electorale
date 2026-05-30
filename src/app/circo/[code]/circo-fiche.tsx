"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Loader2, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCircoHistory, type CircoTimelinePoint } from "@/lib/queries";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { candidatSlug } from "@/lib/personnes";
import { SCRUTIN_META, type Scrutin, type ScrutinFamily } from "@/lib/url-state";
import { ExportButton } from "@/components/export-button";
import { PinButton } from "@/components/pin-button";
import { downloadCsv, type CsvRow } from "@/lib/export";

const candidatHref = (scrutin: Scrutin, code: string, label: string) =>
  `/candidat/${encodeURIComponent(`${scrutin}__${code}__${candidatSlug(label)}`)}`;

const FAMILY_GROUPS: { family: ScrutinFamily; label: string }[] = [
  { family: "presidentielle", label: "Présidentielles" },
  { family: "legislative", label: "Législatives" },
];

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const fmtPts = (n: number) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`;

/** « 2602 » → { dept: "26", num: 2 } ; gère l'outre-mer (codes à 5 chiffres). */
function decodeCircoCode(code: string): { dept: string; num: number | null } {
  const dept = code.length > 2 ? code.slice(0, code.length - 2) : code;
  const num = Number(code.slice(-2));
  return { dept, num: Number.isFinite(num) ? num : null };
}

const ORDINAL = (n: number) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);

export function CircoFiche({ code }: { code: string }) {
  const history = useCircoHistory(code);
  const { dept, num } = decodeCircoCode(code);

  const byScrutin = useMemo(() => {
    const map = new Map<Scrutin, CircoTimelinePoint>();
    for (const p of history.data ?? []) map.set(p.scrutin, p);
    return map;
  }, [history.data]);

  const latestLegis = byScrutin.get("legis-2024-t2") ?? byScrutin.get("legis-2024-t1");
  const deputy = latestLegis?.candidates.find((c) => c.elu) ?? latestLegis?.candidates[0] ?? null;
  const libelle = latestLegis?.libelle ?? (history.data ?? [])[0]?.libelle ?? null;

  // Ordre chronologique d'affichage (anciens → récents) pour la frise.
  const ordered = useMemo(() => {
    const order: Scrutin[] = [
      "presid-2017-t1", "presid-2017-t2",
      "legis-2022-t1", "legis-2022-t2",
      "presid-2022-t1", "presid-2022-t2",
      "legis-2024-t1", "legis-2024-t2",
    ];
    return order.map((s) => byScrutin.get(s)).filter((p): p is CircoTimelinePoint => !!p);
  }, [byScrutin]);

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
            Circonscription législative
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">
            {num != null ? `${ORDINAL(num)} circonscription` : `Circonscription ${code}`}
            <span className="ml-2 text-[15px] font-medium text-muted-foreground">
              · dépt {dept}
            </span>
          </h1>
          {libelle && num == null && (
            <p className="text-[13px] text-muted-foreground">{libelle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PinButton
            pin={{ type: "circo", id: code, label: num != null ? `${ORDINAL(num)} circonscription` : `Circonscription ${code}`, sublabel: `Circonscription · dépt ${dept}`, href: `/circo/${code}` }}
          />
          {ordered.length > 0 && <ExportButton onClick={exportCsv} />}
          <Link
            href={`/explorer?maille=circonscriptions&scrutin=legis-2024-t2&code=${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <MapIcon className="h-3.5 w-3.5" />
            Voir sur la carte
          </Link>
        </div>
      </header>

      {history.isLoading ? (
        <Loading />
      ) : ordered.length === 0 ? (
        <Empty code={code} />
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {deputy && latestLegis && (
            <section>
              <SectionTitle>Député·e en exercice (législatives 2024)</SectionTitle>
              <Link
                href={`/elu/${encodeURIComponent(code)}`}
                className="mt-2 flex flex-wrap items-center gap-4 rounded-2xl border border-black/5 bg-white/60 p-5 transition-colors hover:bg-white"
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
              <div className="mt-2 rounded-2xl border border-black/5 bg-white/60 p-5">
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
    </div>
  );
}

function ScrutinRow({ point }: { point: CircoTimelinePoint }) {
  const top = point.candidates;
  const winner = top[0];
  const margin = top.length >= 2 ? top[0].pct - top[1].pct : top[0]?.pct ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 px-3.5 py-3">
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
        className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground"
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
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
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
    <div className="rounded-xl border border-black/5 bg-white/60 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement de la circonscription…
    </div>
  );
}

function Empty({ code }: { code: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-black/5 bg-white/60 p-8 text-center">
      <p className="text-[13px] font-medium">Aucune donnée pour la circonscription {code}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Vérifie le code (format INSEE, ex. « 2602 ») ou explore la carte.
      </p>
      <Link
        href="/explorer?maille=circonscriptions&scrutin=legis-2024-t2"
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5",
          "text-[12px] font-medium text-white transition-opacity hover:opacity-90",
        )}
      >
        <MapIcon className="h-3.5 w-3.5" />
        Ouvrir l&apos;explorateur
      </Link>
    </div>
  );
}
