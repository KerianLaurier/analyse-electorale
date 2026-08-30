"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, TrendingUp } from "lucide-react";
import { Spinner } from "@appica/ui-react/spinner";
import { SCRUTIN_META, parseScrutin, type ScrutinFamily } from "@/lib/url-state";
import { BLOCS, blocById, marginDiagnostic, type BlocId } from "@/lib/analysis";
import { nuanceLabel } from "@/lib/nuances";
import { fmtInt, fmtPct } from "@/lib/format";
import { useScrutinNationalParticipation } from "@/lib/queries";
import {
  NUANCE_TO_BLOC,
  TERRITORY_LABELS,
  useNationalBlocHistory,
  useTerritoryHistory,
  type NationalPoint,
  type TerritoryPoint,
} from "@/lib/territory-analysis";
import { blocSharesFromCandidates } from "@/lib/projection";
import { KpiCard } from "@/components/kpi-card";
import { ErrorState } from "@/components/error-state";
import { usePerimetre } from "@/app/(app)/analyser/analyser-shell";
import { perimetreKey, type Perimetre } from "@/app/(app)/analyser/perimetre";

/**
 * Lentille DIAGNOSTIC — « où j'en suis ».
 *
 * Sur un territoire : qui est en tête, avec quelle marge, quelle participation,
 * et le rapport de force par bloc scrutin après scrutin. Sur la France : les
 * mêmes questions à l'échelle nationale.
 */

const fmtPts = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;

/** Périmètre restreint à un territoire (la France a ses propres vues). */
type Territoire = Extract<Perimetre, { scope: "territoire" }>;

/** Lien vers la fiche détaillée du territoire (fiche dédiée ou explorateur). */
function ficheHref(sel: Territoire): string {
  if (sel.type === "circo") return `/circo/${encodeURIComponent(sel.code)}`;
  if (sel.type === "commune") return `/commune/${encodeURIComponent(sel.code)}`;
  const maille = sel.type === "region" ? "regions" : "departements";
  return `/explorer?maille=${maille}&code=${encodeURIComponent(sel.code)}`;
}

export function DiagnosticView() {
  const perimetre = usePerimetre();
  if (perimetre.scope === "france") return <NationalDiagnostic />;
  return <TerritoryDiagnostic key={perimetreKey(perimetre)} sel={perimetre} />;
}

// ─── Territoire ───────────────────────────────────────────────────────────────

function TerritoryDiagnostic({ sel }: { sel: Territoire }) {
  const history = useTerritoryHistory(sel.type, sel.code);

  if (history.isLoading) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-lg bg-surface shadow-card">
        <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Spinner currentColor className="size-4" /> Analyse de {sel.label}…
        </p>
      </div>
    );
  }
  if (history.isError) {
    return (
      <ErrorState
        message="Impossible de charger l'historique électoral de ce territoire."
        onRetry={() => void history.refetch()}
      />
    );
  }
  const points = history.data ?? [];
  if (points.length === 0) {
    return (
      <div className="grid min-h-[240px] place-items-center rounded-lg bg-surface p-8 text-center shadow-card">
        <p className="text-[13px] text-muted-foreground">
          Aucun résultat électoral disponible pour « {sel.label} ».
        </p>
      </div>
    );
  }

  return (
    <>
      <DiagnosticSection sel={sel} history={points} />
      <ForceSection history={points} />
    </>
  );
}

// ─── France ───────────────────────────────────────────────────────────────────

/**
 * Diagnostic national : le rapport de force par bloc aux derniers scrutins,
 * reconstitué depuis les fichiers détail des 18 régions.
 */
function NationalDiagnostic() {
  const national = useNationalBlocHistory();
  const points = useMemo(
    () => [...(national.data ?? [])].sort((a, b) => a.year - b.year),
    [national.data],
  );

  if (national.isLoading) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-lg bg-surface shadow-card">
        <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Spinner currentColor className="size-4" /> Analyse nationale…
        </p>
      </div>
    );
  }
  if (national.isError || points.length === 0) {
    return (
      <ErrorState
        message="Impossible de charger le rapport de force national."
        onRetry={() => void national.refetch()}
      />
    );
  }

  const last = points[points.length - 1];
  const ranked = BLOCS.map((b) => ({ bloc: b.id, share: last.shares[b.id] ?? 0 })).sort(
    (a, b) => b.share - a.share,
  );
  const [first, second] = ranked;
  const marge = first && second ? first.share - second.share : null;

  // Plus forte évolution entre les deux derniers scrutins de même famille.
  const move = (() => {
    const fam = SCRUTIN_META[last.scrutin].family;
    const same = points.filter((p) => SCRUTIN_META[p.scrutin].family === fam);
    if (same.length < 2) return null;
    const prev = same[same.length - 2];
    let best: { bloc: BlocId; delta: number } | null = null;
    for (const b of BLOCS) {
      const delta = (last.shares[b.id] ?? 0) - (prev.shares[b.id] ?? 0);
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { bloc: b.id, delta };
    }
    return best ? { ...best, from: prev.year, to: last.year } : null;
  })();

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="anim-stagger grid grid-cols-2 gap-2 lg:grid-cols-4">
          <KpiCard
            label={`Bloc en tête · ${SCRUTIN_META[last.scrutin].short}`}
            value={first ? blocById(first.bloc).label : "—"}
            hint={first ? `${fmtPct(first.share)} des exprimés` : undefined}
          />
          <KpiCard
            label="Marge 1er / 2e bloc"
            value={marge != null ? fmtPts(marge) : "—"}
            hint={second ? `devant ${blocById(second.bloc).label}` : undefined}
            accent={marge != null && marge < 0.05 ? "negative" : undefined}
          />
          <KpiCard
            label="Suffrages exprimés"
            value={fmtInt(last.exprimes)}
            hint={SCRUTIN_META[last.scrutin].short}
          />
          <KpiCard
            label="Scrutins couverts"
            value={String(points.length)}
            hint="1ers tours, 2017 → 2024"
          />
        </div>

        <div className="rounded-lg bg-surface p-3.5 shadow-card">
          <p className="text-[12.5px] leading-relaxed text-foreground/80">
            <strong>France entière</strong> : {first ? blocById(first.bloc).label : "—"} en tête au{" "}
            {SCRUTIN_META[last.scrutin].short}
            {marge != null && second ? (
              <> avec {fmtPts(marge)} d&apos;avance sur {blocById(second.bloc).label}.</>
            ) : (
              "."
            )}
            {move && Math.abs(move.delta) >= 0.01 && (
              <>
                {" "}Dynamique {move.from} → {move.to} : {blocById(move.bloc).label}{" "}
                <strong>{fmtPts(move.delta)}</strong>.
              </>
            )}{" "}
            Choisissez un territoire ci-dessus pour descendre au local.
          </p>
        </div>
      </section>

      <section className="rounded-lg bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Rapport de force national par bloc
          </h2>
          <BlocLegend />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {points.map((p) => (
            <NationalBlocStack key={p.scrutin} point={p} />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          1ers tours uniquement · somme des voix par nuance sur les 18 régions.
        </p>
      </section>
    </>
  );
}

function BlocLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {BLOCS.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: b.color }} /> {b.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <span className="h-2 w-2 rounded-sm bg-[#cbd5e1]" /> Autres
      </span>
    </div>
  );
}

function NationalBlocStack({ point }: { point: NationalPoint }) {
  const segments = [
    ...BLOCS.map((b) => ({ key: b.id, color: b.color, value: point.shares[b.id] ?? 0 })),
    { key: "autre", color: "#cbd5e1", value: point.shares.autre ?? 0 },
  ].filter((s) => s.value > 0.001);
  return (
    <div className="flex items-center gap-2">
      <span className="w-[92px] shrink-0 text-[10.5px] text-muted-foreground">
        {SCRUTIN_META[point.scrutin].short}
      </span>
      <div className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-pill bg-foreground/[0.04]">
        {segments.map((s) => (
          <span
            key={s.key}
            className="h-full"
            style={{ width: `${s.value * 100}%`, background: s.color }}
            title={`${(s.value * 100).toFixed(1)} %`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 1. Diagnostic ────────────────────────────────────────────────────────────

function DiagnosticSection({ sel, history }: { sel: Territoire; history: TerritoryPoint[] }) {
  const latest = history[history.length - 1];
  const nationalPart = useScrutinNationalParticipation(latest.scrutin);

  const winner = latest.candidates[0] ?? null;
  const runner = latest.candidates[1] ?? null;
  const margin = winner && runner ? winner.pct - runner.pct : null;
  const diag = marginDiagnostic(margin);

  const winnerName = winner ? winner.label || nuanceLabel(winner.nuance) : "—";
  const partDelta =
    nationalPart.data != null ? latest.participation - nationalPart.data : null;

  // Plus forte dynamique récente (dernier couple de 1ers tours d'une même famille).
  const topMove = useMemo(() => {
    for (const family of ["legislative", "presidentielle"] as ScrutinFamily[]) {
      const pts = history.filter((p) => {
        const parsed = parseScrutin(p.scrutin);
        return parsed.family === family && parsed.tour === 1 && p.exprimes > 0;
      });
      if (pts.length < 2) continue;
      const prev = blocSharesFromCandidates(pts[pts.length - 2].candidates, NUANCE_TO_BLOC);
      const now = blocSharesFromCandidates(pts[pts.length - 1].candidates, NUANCE_TO_BLOC);
      let best: { bloc: BlocId; delta: number } | null = null;
      for (const b of BLOCS) {
        const delta = now[b.id] - prev[b.id];
        if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { bloc: b.id, delta };
      }
      if (best) {
        return {
          ...best,
          from: parseScrutin(pts[pts.length - 2].scrutin).year,
          to: parseScrutin(pts[pts.length - 1].scrutin).year,
        };
      }
    }
    return null;
  }, [history]);

  return (
    <section className="flex flex-col gap-2">
      <div className="anim-stagger grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard
          label={`En tête · ${SCRUTIN_META[latest.scrutin].short}`}
          value={winnerName}
          hint={winner ? `${fmtPct(winner.pct)} des exprimés` : undefined}
        />
        <KpiCard
          label="Marge 1er / 2e"
          value={margin != null ? fmtPts(margin) : "—"}
          hint={diag.label}
          accent={margin != null && margin < 0.05 ? "negative" : undefined}
        />
        <KpiCard
          label="Participation"
          value={fmtPct(latest.participation)}
          hint={
            partDelta != null
              ? `${fmtPts(partDelta)} vs national`
              : SCRUTIN_META[latest.scrutin].short
          }
          accent={partDelta != null ? (partDelta >= 0 ? "positive" : "negative") : undefined}
        />
        <KpiCard label="Inscrits" value={fmtInt(latest.inscrits)} hint={sel.label} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-3.5 shadow-card">
        <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-foreground/80">
          <strong>{sel.label}</strong> ({TERRITORY_LABELS[sel.type].toLowerCase()}) :{" "}
          <strong>{winnerName}</strong> en tête au {SCRUTIN_META[latest.scrutin].short}
          {margin != null && runner ? (
            <>
              {" "}avec {fmtPts(margin)} d&apos;avance sur {runner.label || nuanceLabel(runner.nuance)} — position{" "}
              <span className={diag.tone}>{diag.label.toLowerCase()}</span>.
            </>
          ) : (
            "."
          )}
          {topMove && Math.abs(topMove.delta) >= 0.01 && (
            <>
              {" "}Dynamique {topMove.from} → {topMove.to} : {blocById(topMove.bloc).label}{" "}
              <strong>{fmtPts(topMove.delta)}</strong>.
            </>
          )}
        </p>
        <Link
          href={ficheHref(sel)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft/70 px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Fiche complète <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

// ─── 2. Rapport de force par bloc (historique) ───────────────────────────────

const FAMILY_TITLES: Partial<Record<ScrutinFamily, string>> = {
  presidentielle: "Présidentielles",
  legislative: "Législatives",
  europeenne: "Européennes",
  municipale: "Municipales",
};

function ForceSection({ history }: { history: TerritoryPoint[] }) {
  const families = useMemo(() => {
    const out: { family: ScrutinFamily; points: TerritoryPoint[] }[] = [];
    for (const family of Object.keys(FAMILY_TITLES) as ScrutinFamily[]) {
      const points = history.filter((p) => SCRUTIN_META[p.scrutin].family === family);
      if (points.length > 0) out.push({ family, points });
    }
    return out;
  }, [history]);

  return (
    <section className="rounded-lg bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Rapport de force par bloc
        </h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {BLOCS.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: b.color }} /> {b.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="h-2 w-2 rounded-sm bg-[#cbd5e1]" /> Autres
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {families.map(({ family, points }) => (
          <FamilyCard key={family} title={FAMILY_TITLES[family] ?? family} points={points} />
        ))}
      </div>
    </section>
  );
}

function FamilyCard({ title, points }: { title: string; points: TerritoryPoint[] }) {
  // Dynamique entre les deux derniers 1ers tours de la famille.
  const moves = useMemo(() => {
    const t1 = points.filter((p) => parseScrutin(p.scrutin).tour !== 2 && p.exprimes > 0);
    if (t1.length < 2) return null;
    const prev = blocSharesFromCandidates(t1[t1.length - 2].candidates, NUANCE_TO_BLOC);
    const now = blocSharesFromCandidates(t1[t1.length - 1].candidates, NUANCE_TO_BLOC);
    return BLOCS.map((b) => ({ bloc: b, delta: now[b.id] - prev[b.id] }))
      .filter((m) => Math.abs(m.delta) >= 0.005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
  }, [points]);

  return (
    <div className="rounded-lg border border-border/60 bg-surface-soft/30 p-3.5">
      <p className="text-[12px] font-medium">{title}</p>
      <div className="mt-2.5 flex flex-col gap-2">
        {points.map((p) => (
          <BlocStack key={p.scrutin} point={p} />
        ))}
      </div>
      {moves && moves.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
          {moves.map((m) => (
            <span
              key={m.bloc.id}
              className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-[10.5px] font-medium tabular-nums"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.bloc.color }} />
              {fmtPts(m.delta)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BlocStack({ point }: { point: TerritoryPoint }) {
  const shares = blocSharesFromCandidates(point.candidates, NUANCE_TO_BLOC);
  const segments = [
    ...BLOCS.map((b) => ({ key: b.id as string, color: b.color, value: shares[b.id] })),
    { key: "autre", color: "#cbd5e1", value: shares.autre },
  ].filter((s) => s.value > 0.001);
  return (
    <div className="flex items-center gap-2">
      <span className="w-[92px] shrink-0 text-[10.5px] text-muted-foreground">
        {SCRUTIN_META[point.scrutin].short}
      </span>
      <div className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-pill bg-foreground/[0.04]">
        {segments.map((s) => (
          <span
            key={s.key}
            className="h-full"
            style={{ width: `${s.value * 100}%`, background: s.color }}
            title={`${(s.value * 100).toFixed(1)} %`}
          />
        ))}
      </div>
    </div>
  );
}

