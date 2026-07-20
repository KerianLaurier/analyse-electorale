"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCS, blocById, type BlocId } from "@/lib/analysis";
import { SCRUTIN_META, parseScrutin, type ScrutinFamily } from "@/lib/url-state";
import {
  applyProportionalSwing,
  blocSharesFromCandidates,
  fitLinear,
  fragilityIndex,
  projectBlocShares,
  votesToFlip,
  type BlocProjection,
  type BlocSharesFull,
} from "@/lib/projection";
import {
  NUANCE_TO_BLOC,
  useNationalBlocHistory,
  type TerritoryPoint,
  type TerritoryType,
} from "@/lib/territory-analysis";
import { fmtInt, fmtPct } from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";

const fmtPts = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;

const AUTRE_COLOR = "#94a3b8";
const colorOf = (bloc: BlocId | "autre") =>
  bloc === "autre" ? AUTRE_COLOR : blocById(bloc).color;
const labelOf = (bloc: BlocId | "autre") =>
  bloc === "autre" ? "Autres" : blocById(bloc).label;

type Family = Extract<ScrutinFamily, "presidentielle" | "legislative">;
const FAMILY_TARGET: Record<Family, { year: number; label: string }> = {
  presidentielle: { year: 2027, label: "Présidentielle 2027" },
  legislative: { year: 2029, label: "Législatives (au plus tard 2029)" },
};

// Positionnement partagé avec la fiche stratégique circo.
const BLOC_KEY = "mvc:strategie:bloc";

/** Points 1er tour d'une famille → historique (année, parts par bloc). */
function familyHistory(history: TerritoryPoint[], family: Family) {
  return history
    .filter((p) => {
      const parsed = parseScrutin(p.scrutin);
      return parsed.family === family && parsed.tour === 1 && p.exprimes > 0;
    })
    .map((p) => ({
      year: parseScrutin(p.scrutin).year ?? 0,
      scrutin: p.scrutin,
      shares: blocSharesFromCandidates(p.candidates, NUANCE_TO_BLOC),
      participation: p.participation,
      inscrits: p.inscrits,
      exprimes: p.exprimes,
      votants: p.votants,
    }));
}

/**
 * Analyse prédictive du territoire : projection tendancielle par bloc à la
 * prochaine échéance (présidentielle 2027 / législatives ≤ 2029), ajustable
 * par un scénario national (swing proportionnel) et une hypothèse de
 * participation. Tout est recalculé instantanément côté client.
 */
export function ProjectionSection({
  type,
  history,
}: {
  type: TerritoryType;
  history: TerritoryPoint[];
}) {
  const [family, setFamily] = useState<Family>("legislative");
  const national = useNationalBlocHistory();

  const [bloc, setBloc] = useState<BlocId | "">(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem(BLOC_KEY) as BlocId | "") || "";
  });
  function changeBloc(v: BlocId | "") {
    setBloc(v);
    try { localStorage.setItem(BLOC_KEY, v); } catch { /* quota / indispo */ }
  }

  const target = FAMILY_TARGET[family];
  const local = useMemo(() => familyHistory(history, family), [history, family]);
  const localLast = local.length ? local[local.length - 1] : null;

  // Projection tendancielle locale (droite par bloc, normalisée).
  const localProj = useMemo(
    () => projectBlocShares(local.map(({ year, shares }) => ({ year, shares })), target.year),
    [local, target.year],
  );

  // Baseline + projection nationales (pour le scénario de swing).
  const nat = useMemo(() => {
    const pts = (national.data ?? [])
      .filter((p) => SCRUTIN_META[p.scrutin].family === family)
      .sort((a, b) => a.year - b.year);
    if (pts.length === 0) return null;
    const ref = pts[pts.length - 1];
    const proj = projectBlocShares(pts.map(({ year, shares }) => ({ year, shares })), target.year);
    return { ref, proj };
  }, [national.data, family, target.year]);

  // Hypothèses nationales du scénario (en % 0..100), par bloc.
  const defaultScenario = useMemo(() => {
    const out = {} as Record<BlocId, number>;
    for (const b of BLOCS) {
      const p = nat?.proj?.find((r) => r.bloc === b.id);
      out[b.id] = Math.round(((p?.projected ?? nat?.ref.shares[b.id] ?? 0) * 100) * 2) / 2;
    }
    return out;
  }, [nat]);
  const [scenario, setScenario] = useState<Record<BlocId, number> | null>(null);
  const [participationPct, setParticipationPct] = useState<number | null>(null);
  const effScenario = scenario ?? defaultScenario;

  // Participation projetée (tendance locale, bornée à un couloir plausible).
  const projectedParticipation = useMemo(() => {
    const pts: Array<[number, number]> = local.map((p) => [p.year, p.participation]);
    const fit = fitLinear(pts);
    const raw = fit ? fit.slope * target.year + fit.intercept : localLast?.participation ?? 0.5;
    return Math.min(0.9, Math.max(0.25, raw));
  }, [local, localLast, target.year]);
  const effParticipation = (participationPct ?? Math.round(projectedParticipation * 100)) / 100;

  // Scénario appliqué au territoire (swing proportionnel sur la dernière photo).
  const scenarioShares = useMemo<BlocSharesFull | null>(() => {
    if (!localLast || !nat) return null;
    const natTarget = {} as Record<BlocId, number>;
    for (const b of BLOCS) natTarget[b.id] = (effScenario[b.id] ?? 0) / 100;
    const refShares = {} as Record<BlocId, number>;
    for (const b of BLOCS) refShares[b.id] = nat.ref.shares[b.id] ?? 0;
    return applyProportionalSwing(localLast.shares, refShares, natTarget);
  }, [localLast, nat, effScenario]);

  // Classement scénario + grandeurs de campagne (voix, bascule).
  const outcome = useMemo(() => {
    if (!scenarioShares || !localLast) return null;
    const ranked = BLOCS
      .map((b) => ({ bloc: b.id as BlocId | "autre", share: scenarioShares[b.id] }))
      .concat([{ bloc: "autre", share: scenarioShares.autre }])
      .sort((a, b) => b.share - a.share);
    const [first, second] = ranked;
    const margin = first && second ? first.share - second.share : null;
    // Exprimés estimés : inscrits × participation × (exprimés/votants observés).
    const expRatio = localLast.votants > 0 ? localLast.exprimes / localLast.votants : 0.95;
    const exprimes = Math.round(localLast.inscrits * effParticipation * expRatio);
    return { ranked, first, second, margin, exprimes };
  }, [scenarioShares, localLast, effParticipation]);

  // Fragilité de la position de tête : marge scénario + dynamiques locales.
  const fragility = useMemo(() => {
    if (!outcome?.first || outcome.margin == null || !localProj) return null;
    const slopeOf = (b: BlocId | "autre") =>
      localProj.find((p) => p.bloc === b)?.slopePerYear ?? 0;
    return fragilityIndex(outcome.margin, slopeOf(outcome.first.bloc), slopeOf(outcome.second.bloc));
  }, [outcome, localProj]);

  // Écart du bloc suivi à la tête (voix manquantes ou avance).
  const myGap = useMemo(() => {
    if (!bloc || !outcome || !scenarioShares) return null;
    const mine = scenarioShares[bloc];
    const best = outcome.ranked.find((r) => r.bloc !== bloc);
    if (best == null) return null;
    const lead = outcome.ranked[0];
    if (lead.bloc === bloc) {
      return { leading: true, pts: mine - best.share, votes: votesToFlip(mine - best.share, outcome.exprimes) };
    }
    const gap = lead.share - mine;
    return { leading: false, pts: gap, votes: votesToFlip(gap, outcome.exprimes) };
  }, [bloc, outcome, scenarioShares]);

  if (local.length === 0) {
    return (
      <section className="rounded-lg bg-surface p-4 shadow-card">
        <SectionHeader />
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          Pas de données de 1er tour disponibles pour cette famille de scrutins sur ce territoire.
        </p>
      </section>
    );
  }

  const maxShare = Math.max(
    0.3,
    ...(localProj ?? []).map((p) => p.high),
    ...(scenarioShares ? BLOCS.map((b) => scenarioShares[b.id]) : []),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-3 shadow-card">
        <SectionHeader />
        <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
          {(Object.keys(FAMILY_TARGET) as Family[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFamily(f); setScenario(null); setParticipationPct(null); }}
              aria-pressed={family === f}
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                family === f
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "presidentielle" ? "Présidentielle 2027" : "Législatives"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Projection tendancielle ─────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Projection tendancielle · {target.label}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Prolongement de la tendance locale ({local.map((p) => p.year).join(" → ")}), fourchette d&apos;incertitude incluse.
              Le scénario national (à droite) s&apos;affiche en repère.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {(localProj ?? [])
              .filter((p) => p.bloc !== "autre" || p.last > 0.02)
              .sort((a, b) => b.projected - a.projected)
              .map((p) => (
                <ProjBar
                  key={p.bloc}
                  proj={p}
                  scenario={scenarioShares ? scenarioShares[p.bloc] : null}
                  max={maxShare}
                />
              ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2.5 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-foreground/70" /> Projection
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-foreground/15" /> Fourchette
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-px bg-foreground/60" /> Dernier score
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rotate-45 border border-foreground/60" /> Scénario
            </span>
          </div>
        </div>

        {/* ── Scénario national ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Scénario national
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Hypothèse de score national par bloc, répercutée sur le territoire (swing proportionnel).
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setScenario(null); setParticipationPct(null); }}
              className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-surface-soft/70 px-2 py-1 text-[10.5px] font-medium text-muted-foreground hover:text-foreground"
              title="Revenir au scénario tendanciel"
            >
              <RotateCcw className="h-3 w-3" /> Tendanciel
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {BLOCS.map((b) => (
              <label key={b.id} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-[11.5px]">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
                  <span className="truncate text-muted-foreground">{b.label}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={0.5}
                  value={effScenario[b.id]}
                  onChange={(e) =>
                    setScenario({ ...effScenario, [b.id]: Number(e.target.value) })
                  }
                  className="h-1.5 w-full accent-[var(--warm)]"
                  aria-label={`Score national supposé · ${b.label}`}
                />
                <span className="text-right font-medium tabular-nums">
                  {effScenario[b.id].toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                </span>
              </label>
            ))}
            <label className="mt-1 grid grid-cols-[110px_1fr_44px] items-center gap-2 border-t border-border/60 pt-2 text-[11.5px]">
              <span className="text-muted-foreground">Participation</span>
              <input
                type="range"
                min={25}
                max={90}
                step={1}
                value={Math.round(effParticipation * 100)}
                onChange={(e) => setParticipationPct(Number(e.target.value))}
                className="h-1.5 w-full accent-[var(--warm)]"
                aria-label="Hypothèse de participation"
              />
              <span className="text-right font-medium tabular-nums">
                {Math.round(effParticipation * 100)} %
              </span>
            </label>
          </div>

          <label className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11.5px]">
            <span className="text-muted-foreground">Mon positionnement</span>
            <select
              value={bloc}
              onChange={(e) => changeBloc(e.target.value as BlocId | "")}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] outline-none"
            >
              <option value="">—</option>
              {BLOCS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── Résultat du scénario ────────────────────────────────────────── */}
      {outcome && (
        <div className="anim-stagger grid grid-cols-2 gap-2 lg:grid-cols-4">
          <KpiCard
            label="En tête (scénario)"
            value={labelOf(outcome.first.bloc)}
            hint={`${fmtPct(outcome.first.share)} des exprimés`}
          />
          <KpiCard
            label="Marge sur le 2e"
            value={outcome.margin != null ? fmtPts(outcome.margin) : "—"}
            hint={
              outcome.margin != null
                ? `≈ ${fmtInt(votesToFlip(outcome.margin, outcome.exprimes))} voix à faire basculer`
                : undefined
            }
            accent={outcome.margin != null && outcome.margin < 0.05 ? "negative" : undefined}
          />
          <KpiCard
            label="Fragilité de la position"
            value={fragility ? `${fragility.score} / 100` : "—"}
            hint={fragility?.label}
            accent={fragility && fragility.score >= 50 ? "negative" : undefined}
          />
          <KpiCard
            label="Exprimés estimés"
            value={fmtInt(outcome.exprimes)}
            hint={`participation ${Math.round(effParticipation * 100)} %`}
          />
        </div>
      )}

      {bloc && myGap && outcome && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg p-3.5 text-[12.5px] shadow-card",
            myGap.leading ? "bg-success/10" : "bg-warm/10",
          )}
        >
          <Sparkles className={cn("h-4 w-4", myGap.leading ? "text-success" : "text-warm")} />
          {myGap.leading ? (
            <span>
              Dans ce scénario, <strong>{blocById(bloc).label}</strong> est en tête avec{" "}
              <strong>{fmtPts(myGap.pts)}</strong> d&apos;avance — ne pas perdre plus de{" "}
              <strong>{fmtInt(myGap.votes)} voix</strong> au profit du poursuivant.
            </span>
          ) : (
            <span>
              Dans ce scénario, il manque <strong>{fmtPts(myGap.pts)}</strong> à{" "}
              <strong>{blocById(bloc).label}</strong> pour prendre la tête — soit{" "}
              <strong>≈ {fmtInt(myGap.votes)} voix</strong> à convaincre
              {type === "circo" ? " sur la circonscription" : " sur le territoire"}.
            </span>
          )}
        </div>
      )}

      <p className="px-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
        Méthode : projection = droite de tendance par bloc sur les 1ers tours locaux, normalisée à 100 % ;
        scénario = dernière photo locale ajustée proportionnellement à l&apos;hypothèse nationale
        (référence {nat ? SCRUTIN_META[nat.ref.scrutin].short : "—"}) ; voix estimées = inscrits × participation × part d&apos;exprimés.
        Modèle indicatif fondé uniquement sur les résultats passés — il n&apos;anticipe ni candidatures, ni alliances, ni événements de campagne.
      </p>
    </section>
  );
}

function SectionHeader() {
  return (
    <div>
      <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Analyse prédictive
      </h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Projections tendancielles et scénarios ajustables pour la prochaine échéance.
      </p>
    </div>
  );
}

/** Barre de projection d'un bloc : fourchette, projection, dernier score, scénario. */
function ProjBar({
  proj,
  scenario,
  max,
}: {
  proj: BlocProjection;
  scenario: number | null;
  max: number;
}) {
  const color = colorOf(proj.bloc);
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="grid grid-cols-[110px_1fr_110px] items-center gap-2 text-[11.5px] sm:grid-cols-[130px_1fr_130px]">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate text-foreground/80">{labelOf(proj.bloc)}</span>
      </span>
      <div className="relative h-4 rounded-pill bg-surface-soft/60">
        {/* fourchette */}
        <span
          className="absolute top-0 h-full rounded-pill"
          style={{ left: x(proj.low), width: `calc(${x(proj.high)} - ${x(proj.low)})`, background: `${color}26` }}
        />
        {/* projection */}
        <span
          className="absolute top-[3px] h-[10px] w-[3px] rounded-sm"
          style={{ left: x(proj.projected), background: color }}
        />
        {/* dernier score */}
        <span
          className="absolute top-0 h-full w-px bg-foreground/50"
          style={{ left: x(proj.last) }}
        />
        {/* scénario */}
        {scenario != null && (
          <span
            className="absolute top-[4px] h-2 w-2 -translate-x-1/2 rotate-45 border"
            style={{ left: x(scenario), borderColor: color, background: "var(--surface)" }}
          />
        )}
      </div>
      <span className="text-right tabular-nums">
        <span className="font-semibold">{fmtPct(proj.projected)}</span>
        <span className="text-[10px] text-muted-foreground">
          {" "}[{fmtPct(proj.low, 0)}–{fmtPct(proj.high, 0)}]
        </span>
      </span>
    </div>
  );
}
