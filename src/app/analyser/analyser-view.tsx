"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Crosshair,
  ExternalLink,
  Gauge,
  Layers,
  PieChart,
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users2,
} from "lucide-react";
import { Spinner } from "@appica/ui-react/spinner";
import { cn } from "@/lib/utils";
import { SCRUTIN_META, parseScrutin, type ScrutinFamily } from "@/lib/url-state";
import { BLOCS, blocById, marginDiagnostic, type BlocId } from "@/lib/analysis";
import { nuanceLabel } from "@/lib/nuances";
import { fmtInt, fmtPct } from "@/lib/format";
import { useScrutinNationalParticipation } from "@/lib/queries";
import { useCampaign } from "@/lib/campaign";
import { territoryFrom } from "@/lib/territoire";
import {
  NUANCE_TO_BLOC,
  TERRITORY_LABELS,
  usePotentielCirco,
  usePotentielTerritory,
  useSocioProfile,
  useTerritoryHistory,
  type PotentielBlocRow,
  type TerritoryPoint,
  type TerritoryType,
} from "@/lib/territory-analysis";
import { blocSharesFromCandidates } from "@/lib/projection";
import { KpiCard } from "@/components/kpi-card";
import { ErrorState } from "@/components/error-state";
import { TerritoryPicker, type TerritorySel } from "@/app/analyser/territory-picker";
import { ProjectionSection } from "@/app/analyser/projection-section";

const fmtPts = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;

const TERRITORY_TYPES = new Set<TerritoryType>(["region", "departement", "circo", "commune"]);

// ─── État d'URL (analyse partageable : /analyser?t=circo&c=1502&l=…) ──────────

function useAnalyserUrlState(): {
  sel: TerritorySel | null;
  setSel: (s: TerritorySel) => void;
} {
  const pathname = usePathname();
  const params = useSearchParams();

  const sel = useMemo<TerritorySel | null>(() => {
    const type = params.get("t") as TerritoryType | null;
    const code = params.get("c");
    if (!type || !TERRITORY_TYPES.has(type) || !code) return null;
    return { type, code, label: params.get("l") ?? code };
  }, [params]);

  const setSel = useCallback(
    (s: TerritorySel) => {
      const next = new URLSearchParams();
      next.set("t", s.type);
      next.set("c", s.code);
      next.set("l", s.label);
      // Routing « shallow » natif (cf. useExplorerUrlState) : pas de requête RSC
      // au changement de territoire, les données viennent de React Query.
      window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
    },
    [pathname],
  );

  return { sel, setSel };
}

/** Lien vers la fiche détaillée du territoire (fiche dédiée ou explorateur). */
function ficheHref(sel: TerritorySel): string {
  if (sel.type === "circo") return `/circo/${encodeURIComponent(sel.code)}`;
  if (sel.type === "commune") return `/commune/${encodeURIComponent(sel.code)}`;
  const maille = sel.type === "region" ? "regions" : "departements";
  return `/explorer?maille=${maille}&code=${encodeURIComponent(sel.code)}`;
}

// ─── Vue ──────────────────────────────────────────────────────────────────────

export function AnalyserView() {
  const { sel: urlSel, setSel } = useAnalyserUrlState();

  // Défaut : la cible de campagne du QG (si définie et territorialisable).
  const campaign = useCampaign();
  const campaignSel = useMemo<TerritorySel | null>(() => {
    const t = territoryFrom(campaign?.target);
    if (!t) return null;
    if (t.circoCode) return { type: "circo", code: t.circoCode, label: t.shortLabel };
    if (t.target.type === "commune") return { type: "commune", code: t.target.id, label: t.target.label };
    if (t.target.type === "bureau") {
      const insee = t.target.id.split("_")[0] ?? "";
      return insee ? { type: "commune", code: insee, label: t.communeName ?? t.target.label } : null;
    }
    return null;
  }, [campaign?.target]);

  const sel = urlSel ?? campaignSel;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="px-2 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Analyser
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
          Analyse de territoire
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Diagnostic, rapport de force, sociologie et projections — sur le territoire de votre choix.
        </p>
      </div>

      <TerritoryPicker value={sel} campaign={campaignSel} onChange={setSel} />

      {sel ? (
        <TerritoryAnalysis key={`${sel.type}-${sel.code}`} sel={sel} />
      ) : (
        <div className="grid min-h-[320px] place-items-center rounded-lg bg-surface p-8 text-center shadow-card">
          <div className="max-w-md">
            <Search className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[13px] font-medium">Choisissez votre territoire cible</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Recherchez une commune, une circonscription, un département ou une région pour obtenir
              son diagnostic électoral complet et ses projections. Définir une cible de campagne dans{" "}
              <Link href="/espace" className="font-medium text-warm hover:underline">
                votre QG
              </Link>{" "}
              la sélectionnera automatiquement ici.
            </p>
          </div>
        </div>
      )}

      <ToolsFooter />
    </div>
  );
}

// ─── Analyse d'un territoire sélectionné ──────────────────────────────────────

function TerritoryAnalysis({ sel }: { sel: TerritorySel }) {
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
    <div className="flex flex-col gap-3">
      <DiagnosticSection sel={sel} history={points} />
      <ForceSection history={points} />
      <SocioPotentielSection sel={sel} />
      <ProjectionSection type={sel.type} history={points} />
    </div>
  );
}

// ─── 1. Diagnostic ────────────────────────────────────────────────────────────

function DiagnosticSection({ sel, history }: { sel: TerritorySel; history: TerritoryPoint[] }) {
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

// ─── 3. Sociologie & potentiel ────────────────────────────────────────────────

function fmtSocioValue(v: number, unit: "euro" | "pct" | "ratio"): string {
  if (unit === "euro") return `${fmtInt(v)} €`;
  if (unit === "ratio") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}×`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function SocioPotentielSection({ sel }: { sel: TerritorySel }) {
  const socio = useSocioProfile(sel.type, sel.code);
  const potCirco = usePotentielCirco(sel.type === "circo" ? sel.code : null, sel.type === "circo");
  const potAutre = usePotentielTerritory(sel.type !== "circo" ? sel.type : null, sel.code);

  const potRows: PotentielBlocRow[] | null =
    sel.type === "circo" ? potCirco.data?.rows ?? null : potAutre.data ?? null;
  const potLoading = sel.type === "circo" ? potCirco.isLoading : potAutre.isLoading;

  return (
    <section className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {/* Profil sociologique */}
      <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-4 shadow-card">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Users2 className="h-3.5 w-3.5" /> Profil sociologique
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Indicateurs INSEE, écart à la moyenne nationale.
          </p>
        </div>
        {socio.isLoading ? (
          <p className="inline-flex items-center gap-1.5 py-4 text-[12px] text-muted-foreground">
            <Spinner currentColor className="size-3.5" /> Chargement du profil…
          </p>
        ) : socio.data && socio.data.length > 0 ? (
          <div className="grid gap-x-6 sm:grid-cols-2">
            {socio.data.map((r) => {
              const ratio = r.national ? r.value / r.national - 1 : 0;
              const pct = Math.round(ratio * 100);
              const tone =
                Math.abs(pct) < 5 ? "text-muted-foreground" : pct > 0 ? "text-success" : "text-destructive";
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 text-[12px]"
                >
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">{fmtSocioValue(r.value, r.unit)}</span>
                  <span
                    className={cn("w-14 shrink-0 text-right text-[10.5px] font-medium tabular-nums", tone)}
                    title="Écart à la moyenne nationale"
                  >
                    {pct >= 0 ? "+" : ""}{pct} %
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-[12px] text-muted-foreground">
            Données sociologiques indisponibles pour ce territoire.
          </p>
        )}
        {sel.type !== "circo" && socio.data && (
          <p className="text-[10px] text-muted-foreground/70">
            Filosofi 2021 · Recensement 2022{sel.type !== "commune" ? " — agrégat communal pondéré par la population (approximation pour médianes et taux)." : "."}
          </p>
        )}
      </div>

      {/* Potentiel par bloc */}
      <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-4 shadow-card">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> Potentiel par bloc
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Score attendu d&apos;après la sociologie vs score réel : où sont les réserves de voix.
          </p>
        </div>
        {potLoading ? (
          <p className="inline-flex items-center gap-1.5 py-4 text-[12px] text-muted-foreground">
            <Spinner currentColor className="size-3.5" /> Calcul du potentiel…
          </p>
        ) : potRows ? (
          <div className="flex flex-col">
            {potRows.map((r) => {
              const b = blocById(r.bloc);
              const pot = r.potentiel;
              return (
                <div
                  key={r.bloc}
                  className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-[12px]"
                >
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
                    <span className="truncate">{b.label}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {r.reel != null ? fmtPct(r.reel) : "—"}
                    {r.affinite != null && (
                      <span className="text-muted-foreground/70"> / attendu {fmtPct(r.affinite)}</span>
                    )}
                  </span>
                  {pot != null && (
                    <span
                      className={cn(
                        "w-28 shrink-0 rounded-pill px-2 py-0.5 text-right text-[10.5px] font-semibold tabular-nums",
                        pot >= 0.005
                          ? "bg-[#2563eb1a] text-[color:#2563eb]"
                          : pot <= -0.005
                            ? "bg-[#dc26261a] text-[color:#dc2626]"
                            : "bg-surface-soft/70 text-muted-foreground",
                      )}
                    >
                      {pot >= 0.005 ? `Réserves ${fmtPts(pot)}` : pot <= -0.005 ? `Sur-perf. ${fmtPts(-pot)}` : "À niveau"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-[12px] text-muted-foreground">
            Potentiel indisponible pour ce territoire.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/70">
          {sel.type === "circo"
            ? "Régression sur 10 indicateurs INSEE (législatives 2024 T1), toutes circonscriptions."
            : "Indice précalculé par commune (affinité sociologique − score réel), agrégé pondéré population."}{" "}
          Corrélation ≠ causalité.
        </p>
      </div>
    </section>
  );
}

// ─── Outils spécialisés (accès conservé) ──────────────────────────────────────

function ToolsFooter() {
  return (
    <div className="px-1 pb-2">
      <p className="px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Outils spécialisés
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ToolLink href="/analyser/comparateur" icon={Layers} title="Comparateur" desc="Un territoire, tous les scrutins" desktopOnly />
        <ToolLink href="/analyser/marginalite" icon={Crosshair} title="Sièges marginaux" desc="Circonscriptions les plus disputées" />
        <ToolLink href="/analyser/simulateur" icon={SlidersHorizontal} title="Simulateur" desc="Projection de sièges par bloc" desktopOnly />
        <ToolLink href="/analyser/potentiel" icon={BarChart3} title="Potentiel national" desc="Sur / sous-performance vs sociologie" />
        <ToolLink href="/analyser/sociologie" icon={PieChart} title="Sociologie" desc="Indicateurs INSEE × vote" />
        <ToolLink href="/analyser/ciblage" icon={Target} title="Ciblage terrain" desc="Bureaux prioritaires d'une circo" />
      </div>
    </div>
  );
}

function ToolLink({
  href,
  icon: Icon,
  title,
  desc,
  desktopOnly,
}: {
  href: string;
  icon: typeof Layers;
  title: string;
  desc: string;
  // Outils peu exploitables au doigt (tableaux/réglages larges) : masqués du
  // menu sur mobile, accessibles sur desktop (et toujours par URL directe).
  desktopOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2 shadow-card transition-colors hover:bg-surface-soft",
        desktopOnly && "hidden md:inline-flex",
      )}
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
