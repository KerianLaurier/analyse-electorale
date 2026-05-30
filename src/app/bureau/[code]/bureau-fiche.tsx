"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Building2, Loader2, Map as MapIcon } from "lucide-react";
import { useBureauHistory, type CircoTimelinePoint } from "@/lib/queries";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { SCRUTIN_META, type Scrutin, type ScrutinFamily } from "@/lib/url-state";

const FAMILY_GROUPS: { family: ScrutinFamily; label: string }[] = [
  { family: "presidentielle", label: "Présidentielles" },
  { family: "legislative", label: "Législatives" },
];

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

const DISPLAY_ORDER: Scrutin[] = [
  "presid-2017-t1", "presid-2017-t2",
  "legis-2022-t1", "legis-2022-t2",
  "presid-2022-t1", "presid-2022-t2",
  "legis-2024-t1", "legis-2024-t2",
];

/** « 01001_0001 » → { insee: "01001", num: "0001" } */
function decode(code: string): { insee: string; num: string } {
  const [insee = "", num = ""] = code.split("_");
  return { insee, num };
}

export function BureauFiche({ code }: { code: string }) {
  const history = useBureauHistory(code);
  const { insee, num } = decode(code);

  const byScrutin = useMemo(() => {
    const map = new Map<Scrutin, CircoTimelinePoint>();
    for (const p of history.data ?? []) map.set(p.scrutin, p);
    return map;
  }, [history.data]);

  const ordered = useMemo(
    () => DISPLAY_ORDER.map((s) => byScrutin.get(s)).filter((p): p is CircoTimelinePoint => !!p),
    [byScrutin],
  );

  const libelle = (history.data ?? [])[0]?.libelle ?? null;
  // « Bureau 0001 · Commune » → on isole le nom de commune.
  const communeName = libelle?.includes(" · ") ? libelle.split(" · ").slice(1).join(" · ") : null;
  const latest = byScrutin.get("legis-2024-t2") ?? ordered[ordered.length - 1];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
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
            Bureau de vote
          </p>
          <h1 className="mt-0.5 truncate text-[22px] font-semibold tracking-tight">
            Bureau {num}
            {communeName && (
              <span className="ml-2 text-[15px] font-medium text-muted-foreground">· {communeName}</span>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {insee && (
            <Link
              href={`/commune/${encodeURIComponent(insee)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-black/[0.08]"
            >
              <Building2 className="h-3.5 w-3.5" />
              Commune
            </Link>
          )}
          <Link
            href={`/explorer?maille=bureaux&scrutin=legis-2024-t2&code=${encodeURIComponent(code)}`}
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
          {latest && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPI label="Inscrits" value={fmtInt(latest.inscrits)} hint={SCRUTIN_META[latest.scrutin].short} />
              <KPI label="Votants" value={fmtInt(latest.votants)} />
              <KPI label="Exprimés" value={fmtInt(latest.exprimes)} />
              <KPI label="Participation" value={fmtPct(latest.participation)} />
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
          <p className="text-[10px] text-muted-foreground">
            Résultats au bureau de vote (MinInt). Contours issus du Répertoire Électoral Unique
            (REU 2022) — le rattachement peut différer pour les bureaux re-numérotés depuis.
          </p>

          {latest && (
            <section>
              <SectionTitle>Détail — {SCRUTIN_META[latest.scrutin].short}</SectionTitle>
              <div className="mt-2 rounded-2xl border border-black/5 bg-white/60 p-5">
                <ResultBars detail={latest} />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ScrutinRow({ point }: { point: CircoTimelinePoint }) {
  const winner = point.candidates[0];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 px-3.5 py-3">
      <div className="w-[112px] shrink-0">
        <p className="text-[12px] font-medium leading-tight">{SCRUTIN_META[point.scrutin].short}</p>
        <p className="text-[10px] text-muted-foreground">Part. {fmtPct(point.participation, 0)}</p>
      </div>
      {winner ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: nuanceColor(winner.nuance) }} />
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
              <span className="truncate">{c.label || nuanceLabel(c.nuance)}</span>
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

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement du bureau…
    </div>
  );
}

function Empty({ code }: { code: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-black/5 bg-white/60 p-8 text-center">
      <p className="text-[13px] font-medium">Aucune donnée pour le bureau {code}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Format attendu : « {`{INSEE}_{numéro}`} » (ex. « 01001_0001 »).
      </p>
      <Link
        href="/explorer?maille=bureaux&scrutin=legis-2024-t2"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <MapIcon className="h-3.5 w-3.5" />
        Ouvrir l&apos;explorateur
      </Link>
    </div>
  );
}
