"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Loader2,
  Crosshair,
  Plus,
  Check,
  Info,
  Swords,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCircoBureaux,
  scoreBureaux,
  useTerritoryBounds,
  type TargetBureau,
  type TargetReason,
  type CircoTimelinePoint,
  type LngLatBounds,
} from "@/lib/queries";
import { BLOCS, blocById, type BlocId } from "@/lib/analysis";
import { useHasTeam, addSectorsBulk } from "@/lib/campaign";
import { SCRUTIN_META, type Scrutin, type ScrutinFamily } from "@/lib/url-state";
import { nuanceLabel } from "@/lib/nuances";
import type { Choropleth } from "@/components/map";

const TerritoryMap = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-black/5 bg-surface text-[13px] text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement de la carte…
    </div>
  ),
});

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const fmtPts = (n: number) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`;

// Ordre chronologique des scrutins (ancien → récent).
const CHRONO: Scrutin[] = [
  "presid-2017-t1", "presid-2017-t2",
  "legis-2022-t1", "legis-2022-t2",
  "presid-2022-t1", "presid-2022-t2",
  "legis-2024-t1", "legis-2024-t2",
];

// Index nuance → bloc (codes définis dans analysis.ts).
const NUANCE_TO_BLOC = new Map<string, BlocId>();
for (const b of BLOCS) for (const c of b.codes) NUANCE_TO_BLOC.set(c, b.id);

type BlocShares = Record<BlocId, number> & { autre: number };

/** Part de chaque bloc (somme des % des candidats du bloc) pour un scrutin. */
function blocShares(point: CircoTimelinePoint): BlocShares {
  const out = { rn: 0, gauche: 0, ecolo: 0, centre: 0, droite: 0, autre: 0 } as BlocShares;
  for (const c of point.candidates) {
    const bloc = c.nuance ? NUANCE_TO_BLOC.get(c.nuance) : undefined;
    if (bloc) out[bloc] += c.pct;
    else out.autre += c.pct;
  }
  return out;
}

const REASON: Record<TargetReason, { label: string; className: string } | null> = {
  bascule: { label: "Bascule à portée", className: "bg-amber-100 text-amber-700" },
  bastion: { label: "Bastion à mobiliser", className: "bg-emerald-100 text-emerald-700" },
  conquete: { label: "À conquérir", className: "bg-sky-100 text-sky-700" },
  reservoir: { label: "Réservoir d’abstention", className: "bg-warm/15 text-warm" },
  dispute: { label: "Très disputé", className: "bg-amber-100 text-amber-700" },
  defavorable: { label: "Peu favorable", className: "bg-surface-soft text-muted-foreground" },
  neutre: null,
};

function priorityBucket(p: number): 3 | 2 | 1 {
  if (p >= 66) return 3;
  if (p >= 40) return 2;
  return 1;
}
function priorityClass(p: number): string {
  if (p >= 66) return "bg-red-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-slate-400";
}

// Rouge (prioritaire) / ambre (intermédiaire) / gris (faible) / défaut (hors score).
const PRIORITY_PAINT = [
  "match",
  ["feature-state", "priority"],
  3, "#ef4444",
  2, "#f59e0b",
  1, "#94a3b8",
  "#e2e8f0",
] as unknown as Choropleth["paint"];

const BLOC_KEY = "mvc:strategie:bloc";

export function CircoStrategie({
  code,
  history,
}: {
  code: string;
  history: CircoTimelinePoint[];
}) {
  const byScrutin = useMemo(() => {
    const m = new Map<Scrutin, CircoTimelinePoint>();
    for (const p of history) m.set(p.scrutin, p);
    return m;
  }, [history]);

  const latestLegis = byScrutin.get("legis-2024-t2") ?? byScrutin.get("legis-2024-t1") ?? null;
  const top = latestLegis?.candidates ?? [];
  const winner = top[0] ?? null;
  const runnerUp = top[1] ?? null;
  const margin = winner && runnerUp ? winner.pct - runnerUp.pct : null;

  // Diagnostic de marginalité.
  const diag =
    margin == null
      ? { label: "Données partielles", tone: "text-muted-foreground" }
      : margin < 0.05
      ? { label: "Ultra-marginale", tone: "text-red-600" }
      : margin < 0.1
      ? { label: "Disputée", tone: "text-amber-600" }
      : margin < 0.2
      ? { label: "Orientée", tone: "text-sky-600" }
      : { label: "Acquise", tone: "text-emerald-600" };

  // ── Bureaux prioritaires ────────────────────────────────────────────────
  const [bloc, setBloc] = useState<BlocId | "">(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem(BLOC_KEY) as BlocId | "") || "";
  });
  function changeBloc(v: BlocId | "") {
    setBloc(v);
    try {
      localStorage.setItem(BLOC_KEY, v);
    } catch {
      /* quota / indispo */
    }
  }

  const raw = useCircoBureaux(code);
  const bureaux = useMemo<TargetBureau[]>(
    () => (raw.data ? scoreBureaux(raw.data, bloc || null) : []),
    [raw.data, bloc],
  );
  const topBureaux = useMemo(() => bureaux.slice(0, 8), [bureaux]);

  const bounds = useTerritoryBounds({ type: "circo", id: code });
  const choropleth = useMemo<Choropleth>(
    () => ({
      stateKey: "priority",
      paint: PRIORITY_PAINT,
      data: bureaux.map((b) => ({ code: b.code, value: priorityBucket(b.priority) })),
    }),
    [bureaux],
  );

  const totalInscrits = bureaux.reduce((s, b) => s + b.inscrits, 0);
  const avgAbst = bureaux.length ? bureaux.reduce((s, b) => s + b.abstentionRate, 0) / bureaux.length : 0;

  const hasTeam = useHasTeam();
  const [pushing, setPushing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function pushToPlan() {
    if (pushing || bureaux.length === 0) return;
    setPushing(true);
    setNotice(null);
    const added = await addSectorsBulk(
      bureaux.map((b) => ({ name: b.name, registered: b.inscrits, bureauCode: b.code, priority: b.priority })),
    );
    setPushing(false);
    setNotice(
      added > 0
        ? `${added} bureau${added > 1 ? "x" : ""} ajouté${added > 1 ? "s" : ""} au plan de terrain (QG ▸ Campagne).`
        : "Ces bureaux sont déjà dans votre plan de terrain.",
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* ── Synthèse ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/5 bg-white/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Diagnostic stratégique
            </p>
            <p className={cn("mt-0.5 text-[20px] font-semibold tracking-tight", diag.tone)}>
              {diag.label}
            </p>
          </div>
          {winner && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                En tête (législatives 2024)
              </p>
              <p className="text-[13px] font-medium">
                {winner.label || nuanceLabel(winner.nuance)}
                <span className="ml-1.5 text-muted-foreground">· {fmtPct(winner.pct)}</span>
              </p>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KPI
            label="Marge 1er / 2e"
            value={margin != null ? `+${fmtPts(margin)}` : "—"}
            hint={runnerUp ? `vs ${runnerUp.label || nuanceLabel(runnerUp.nuance)}` : undefined}
          />
          <KPI label="Participation" value={latestLegis ? fmtPct(latestLegis.participation) : "—"} />
          <KPI label="Inscrits" value={latestLegis ? fmtInt(latestLegis.inscrits) : "—"} />
          <KPI label="Bureaux de vote" value={raw.data ? fmtInt(raw.data.length) : "…"} />
        </div>
      </section>

      {/* ── Rapport de force par bloc ──────────────────────────────────── */}
      <section>
        <SectionTitle icon={TrendingUp}>Rapport de force par bloc</SectionTitle>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {BLOCS.map((b) => (
            <Legend key={b.id} color={b.color} label={b.label} />
          ))}
          <Legend color="#cbd5e1" label="Autres" />
        </div>
        <div className="mt-3 flex flex-col gap-4 sm:grid sm:grid-cols-2">
          {(["presidentielle", "legislative"] as ScrutinFamily[]).map((family) => {
            const points = CHRONO.map((s) => byScrutin.get(s)).filter(
              (p): p is CircoTimelinePoint => !!p && SCRUTIN_META[p.scrutin].family === family,
            );
            if (points.length === 0) return null;
            return (
              <div key={family} className="rounded-2xl border border-black/5 bg-white/60 p-4">
                <p className="mb-2.5 text-[12px] font-medium">
                  {family === "presidentielle" ? "Présidentielles" : "Législatives"}
                </p>
                <div className="flex flex-col gap-2.5">
                  {points.map((p) => (
                    <BlocStack key={p.scrutin} point={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Marginalité / 2d tour ──────────────────────────────────────── */}
      {winner && runnerUp && margin != null && (
        <section>
          <SectionTitle icon={Swords}>Second tour — rapport de force</SectionTitle>
          <div className="mt-3 rounded-2xl border border-black/5 bg-white/60 p-5">
            <Duel a={winner} b={runnerUp} />
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              {margin < 0.1 ? (
                <>
                  Siège <strong className="text-foreground">à portée</strong> : il manque{" "}
                  <strong className="text-foreground">{fmtPts(margin)}</strong> au 2<sup>e</sup> pour
                  basculer (≈ {fmtInt((margin * (latestLegis?.exprimes ?? 0)) / 2)} voix à reporter).
                </>
              ) : (
                <>
                  Avance confortable de <strong className="text-foreground">{fmtPts(margin)}</strong> du
                  candidat en tête sur son poursuivant.
                </>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ── Bureaux prioritaires ───────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionTitle icon={Crosshair}>Bureaux prioritaires</SectionTitle>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Où concentrer le porte-à-porte, selon votre positionnement.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
              Mon positionnement
            </span>
            <select
              value={bloc}
              onChange={(e) => changeBloc(e.target.value as BlocId | "")}
              className="min-w-[200px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
            >
              <option value="">Indifférent (générique)</option>
              {BLOCS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {raw.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calcul des bureaux prioritaires…
          </div>
        ) : bureaux.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-black/5 bg-white/60 p-5 text-[13px] text-muted-foreground">
            Pas de données bureau de vote pour cette circonscription.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <KPI label="Bureaux" value={fmtInt(bureaux.length)} />
              <KPI label="Inscrits cumulés" value={fmtInt(totalInscrits)} />
              <KPI label="Abstention moy." value={fmtPct(avgAbst)} />
            </div>

            <div className="mt-4">
              <TerritoryMap
                maille="bureaux"
                choropleth={choropleth}
                bounds={(bounds.data as LngLatBounds | null) ?? null}
                className="h-[420px] w-full overflow-hidden rounded-2xl border border-black/5"
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <Legend color="#ef4444" label="Prioritaire" />
                <Legend color="#f59e0b" label="Intermédiaire" />
                <Legend color="#94a3b8" label="Faible" />
                <span>· Chaque polygone = un bureau de vote.</span>
              </div>
            </div>

            <ul className="mt-4 flex flex-col divide-y divide-border/60">
              {topBureaux.map((b) => (
                <BureauRow key={b.code} b={b} />
              ))}
            </ul>
            {bureaux.length > topBureaux.length && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                + {bureaux.length - topBureaux.length} autres bureaux dans le plan complet.
              </p>
            )}

            {/* Import QG */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {hasTeam ? (
                <button
                  type="button"
                  onClick={pushToPlan}
                  disabled={pushing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-warm px-4 py-2 text-[13px] font-medium text-on-dark transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Importer dans mon QG
                </button>
              ) : (
                <Link
                  href="/auth/team"
                  className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.08]"
                >
                  <Info className="h-4 w-4" /> Créer une équipe pour planifier le terrain
                </Link>
              )}
              {notice && (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-emerald-700">
                  <Check className="h-4 w-4" /> {notice}
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function BlocStack({ point }: { point: CircoTimelinePoint }) {
  const shares = blocShares(point);
  const segments = [
    ...BLOCS.map((b) => ({ key: b.id, color: b.color, value: shares[b.id] })),
    { key: "autre", color: "#cbd5e1", value: shares.autre },
  ].filter((s) => s.value > 0.001);
  return (
    <div className="flex items-center gap-2">
      <span className="w-[88px] shrink-0 text-[11px] text-muted-foreground">
        {SCRUTIN_META[point.scrutin].short}
      </span>
      <div className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.04]">
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

function Duel({
  a,
  b,
}: {
  a: { label: string; nuance: string | null; pct: number };
  b: { label: string; nuance: string | null; pct: number };
}) {
  const total = a.pct + b.pct || 1;
  const aShare = a.pct / total;
  const aBloc = a.nuance ? blocById(NUANCE_TO_BLOC.get(a.nuance) ?? "centre") : null;
  const bBloc = b.nuance ? blocById(NUANCE_TO_BLOC.get(b.nuance) ?? "centre") : null;
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-medium">{a.label || nuanceLabel(a.nuance)}</span>
        <span className="font-medium">{b.label || nuanceLabel(b.nuance)}</span>
      </div>
      <div className="mt-1.5 flex h-3 overflow-hidden rounded-full">
        <span style={{ width: `${aShare * 100}%`, background: aBloc?.color ?? "#64748b" }} />
        <span style={{ width: `${(1 - aShare) * 100}%`, background: bBloc?.color ?? "#94a3b8" }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[12px] tabular-nums text-muted-foreground">
        <span>{fmtPct(a.pct)}</span>
        <span>{fmtPct(b.pct)}</span>
      </div>
    </div>
  );
}

function BureauRow({ b }: { b: TargetBureau }) {
  const reason = REASON[b.reason];
  return (
    <li className="flex items-center gap-3 py-2.5 text-[12.5px]">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityClass(b.priority))} />
      <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
      {reason && (
        <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium sm:inline", reason.className)}>
          {reason.label}
        </span>
      )}
      <span className="shrink-0 text-[11px] text-muted-foreground">{fmtInt(b.inscrits)} insc.</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">abst. {fmtPct(b.abstentionRate, 0)}</span>
      <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums">{Math.round(b.priority)}</span>
    </li>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Crosshair; children: React.ReactNode }) {
  return (
    <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </h2>
  );
}

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="truncate text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> {label}
    </span>
  );
}
