"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, X, Search, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Maille, MAILLE_LABELS } from "@/lib/map-config";
import {
  useScrutinWinner,
  useScrutinMetric,
  useScrutinDetail,
  useScrutinNationalParticipation,
  useRevenuMedianCommune,
  useTauxPauvreteCommune,
  useSociologieCommune,
  type WinningNuanceRow,
  type NumericRow,
  type ScrutinDetail,
  type CommuneSociologie,
} from "@/lib/queries";
import type { Choropleth } from "@/components/map";
import { buildNuanceMatchExpression, nuanceColor, nuanceLabel } from "@/lib/nuances";
import {
  useExplorerUrlState,
  type Scrutin,
  type Coloration,
  SCRUTIN_META,
  COLORATION_LABELS,
  colorationsFor,
  maillesFor,
  isElection,
} from "@/lib/url-state";
import { CommandPalette } from "@/components/command-palette";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

// ─── Données statiques UI ─────────────────────────────────────────────────────

const MAILLE_COUNTS: Record<Maille, number> = {
  regions: 18,
  departements: 96,
  circonscriptions: 559,
  communes: 35798,
};

const SCRUTIN_GROUPS: { label: string; items: Scrutin[] }[] = [
  { label: "Présidentielle", items: ["presid-2022-t1", "presid-2022-t2", "presid-2017-t1", "presid-2017-t2"] },
  { label: "Législatives", items: ["legis-2024-t1", "legis-2024-t2", "legis-2022-t1", "legis-2022-t2"] },
  { label: "Municipales", items: ["municipales-2026-t1", "municipales-2026-t2"] },
  { label: "Données INSEE", items: ["sociologie"] },
];

const FR = { revenuMedian: 22040, tauxPauvrete: 14.4 };

// ─── Couleurs choroplèthes ─────────────────────────────────────────────────────

const PARTICIPATION_STOPS: Array<[number, string]> = [
  [0.3, "#f1f5f9"],
  [0.5, "#93c5fd"],
  [0.65, "#2563eb"],
  [0.8, "#1e3a8a"],
];
const ABSTENTION_STOPS: Array<[number, string]> = [
  [0.15, "#f1f5f9"],
  [0.3, "#fcd34d"],
  [0.45, "#f97316"],
  [0.6, "#7f1d1d"],
];
const REVENU_STOPS: Array<[number, string]> = [
  [12000, "#fef3c7"],
  [18000, "#bbf7d0"],
  [24000, "#34d399"],
  [30000, "#047857"],
  [40000, "#064e3b"],
];
const PAUVRETE_STOPS: Array<[number, string]> = [
  [0, "#f0fdf4"],
  [10, "#fef9c3"],
  [20, "#fb923c"],
  [30, "#dc2626"],
  [50, "#7f1d1d"],
];

function continuousChoropleth(
  stateKey: string,
  stops: Array<[number, string]>,
  rows: NumericRow[],
): Choropleth {
  return {
    stateKey,
    data: rows.map((r) => ({ code: r.code, value: r.value })),
    paint: [
      "interpolate",
      ["linear"],
      ["feature-state", stateKey],
      ...stops.flat(),
    ] as unknown as Choropleth["paint"],
  };
}

function nuanceChoropleth(rows: WinningNuanceRow[]): Choropleth {
  return {
    stateKey: "nuance",
    data: rows.map((r) => ({ code: r.code, value: r.nuance })),
    paint: buildNuanceMatchExpression() as unknown as Choropleth["paint"],
  };
}

function pickName(props: Record<string, unknown>): string {
  for (const key of ["nom", "NOM", "libelle", "LIBELLE", "nomCirconscription", "name"]) {
    const value = props[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "Sans nom";
}
function pickCode(props: Record<string, unknown>): string | null {
  for (const key of ["code", "codeCirconscription", "CODE", "INSEE_COM", "insee", "id"]) {
    const value = props[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return null;
}

function openSearchPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

// ─── Formatage ────────────────────────────────────────────────────────────────

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const fmtEuro = (n: number) => `${fmtInt(n)} €`;

// ─── Composant principal ────────────────────────────────────────────────────

function ExplorerView() {
  const { maille, scrutin, coloration, code, update } = useExplorerUrlState();
  const [lastClicked, setLastClicked] = useState<{ code: string; name: string; maille: Maille } | null>(null);

  // Recale maille & coloration sur ce qui est disponible pour le scrutin courant.
  useEffect(() => {
    const validM = maillesFor(scrutin);
    const validC = colorationsFor(scrutin);
    const patch: { maille?: Maille; coloration?: Coloration } = {};
    if (!validM.includes(maille)) patch.maille = validM[0];
    if (!validC.includes(coloration)) patch.coloration = validC[0];
    if (Object.keys(patch).length) update(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrutin]);

  const election = isElection(scrutin);

  const winner = useScrutinWinner(scrutin, maille, election && coloration === "vainqueur");
  const participation = useScrutinMetric(
    scrutin,
    maille,
    "participation",
    election && coloration === "participation",
  );
  const abstention = useScrutinMetric(
    scrutin,
    maille,
    "abstention",
    election && coloration === "abstention",
  );
  const revenu = useRevenuMedianCommune(scrutin === "sociologie" && coloration === "revenu");
  const pauvrete = useTauxPauvreteCommune(scrutin === "sociologie" && coloration === "pauvrete");

  const choropleth = useMemo<Choropleth | undefined>(() => {
    switch (coloration) {
      case "vainqueur":
        return winner.data ? nuanceChoropleth(winner.data) : undefined;
      case "participation":
        return participation.data
          ? continuousChoropleth("participation", PARTICIPATION_STOPS, participation.data)
          : undefined;
      case "abstention":
        return abstention.data
          ? continuousChoropleth("abstention", ABSTENTION_STOPS, abstention.data)
          : undefined;
      case "revenu":
        return revenu.data ? continuousChoropleth("revenu", REVENU_STOPS, revenu.data) : undefined;
      case "pauvrete":
        return pauvrete.data
          ? continuousChoropleth("pauvrete", PAUVRETE_STOPS, pauvrete.data)
          : undefined;
      default:
        return undefined;
    }
  }, [coloration, winner.data, participation.data, abstention.data, revenu.data, pauvrete.data]);

  const isLoading =
    winner.isFetching ||
    participation.isFetching ||
    abstention.isFetching ||
    revenu.isFetching ||
    pauvrete.isFetching;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-canvas">
      <ControlsPanel
        maille={maille}
        scrutin={scrutin}
        coloration={coloration}
        update={update}
        isLoading={isLoading}
      />

      <div className="relative flex-1">
        <MapTopBar scrutin={scrutin} onOpenSearch={openSearchPalette} />
        <MapView
          className="h-full w-full"
          maille={maille}
          choropleth={choropleth}
          selectedCode={code}
          onFeatureClick={({ maille: m, properties }) => {
            const c = pickCode(properties);
            if (!c) return;
            setLastClicked({ code: c, name: pickName(properties), maille: m });
            update({ code: c, maille: m });
          }}
        />
        <MapBottomLegend
          scrutin={scrutin}
          coloration={coloration}
          winnerRows={coloration === "vainqueur" ? winner.data : undefined}
        />
      </div>

      <aside className="z-10 flex w-[340px] shrink-0 flex-col border-l border-black/5 bg-white/70 backdrop-blur">
        <FicheTerritoire
          code={code}
          maille={maille}
          scrutin={scrutin}
          lastClicked={lastClicked}
          onClear={() => update({ code: null })}
        />
      </aside>

      <CommandPalette />
    </div>
  );
}

// ─── Panneau de contrôle (gauche) ─────────────────────────────────────────────

function ControlsPanel({
  maille,
  scrutin,
  coloration,
  update,
  isLoading,
}: {
  maille: Maille;
  scrutin: Scrutin;
  coloration: Coloration;
  update: (p: { maille?: Maille; scrutin?: Scrutin; coloration?: Coloration; code?: string | null }) => void;
  isLoading: boolean;
}) {
  const mailles = maillesFor(scrutin);
  const colorations = colorationsFor(scrutin);

  return (
    <div className="z-10 flex w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-black/5 bg-white/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight">Explorer</h2>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <Section title="Scrutin">
        <div className="flex flex-col gap-3">
          {SCRUTIN_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map((id) => (
                <RadioRow
                  key={id}
                  active={scrutin === id}
                  label={SCRUTIN_META[id].short}
                  onClick={() => update({ scrutin: id, code: null })}
                />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Coloration">
        <div className="flex flex-wrap gap-1.5">
          {colorations.map((c) => (
            <Pill key={c} active={coloration === c} onClick={() => update({ coloration: c })}>
              {COLORATION_LABELS[c]}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Maille">
        <div className="flex flex-col gap-1">
          {mailles.map((m) => (
            <button
              key={m}
              onClick={() => update({ maille: m, code: null })}
              className={cn(
                "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors",
                maille === m ? "bg-black text-white" : "hover:bg-black/[0.04]",
              )}
            >
              <span>{MAILLE_LABELS[m]}</span>
              <span className={cn("text-[10px] tabular-nums", maille === m ? "text-white/60" : "text-muted-foreground")}>
                {fmtInt(MAILLE_COUNTS[m])}
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function RadioRow({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors",
        active ? "bg-warm/15 font-medium text-foreground" : "hover:bg-black/[0.04]",
      )}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
          active ? "border-warm" : "border-black/20",
        )}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-warm" />}
      </span>
      {label}
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-black text-white" : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

// ─── Barre supérieure carte ────────────────────────────────────────────────────

function MapTopBar({ scrutin, onOpenSearch }: { scrutin: Scrutin; onOpenSearch: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
      <div className="pointer-events-auto rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground shadow-sm backdrop-blur">
        {SCRUTIN_META[scrutin].long}
      </div>
      <button
        onClick={onOpenSearch}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[12px] text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        Rechercher un territoire
        <kbd className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
    </div>
  );
}

// ─── Légende ───────────────────────────────────────────────────────────────────

function MapBottomLegend({
  scrutin,
  coloration,
  winnerRows,
}: {
  scrutin: Scrutin;
  coloration: Coloration;
  winnerRows?: WinningNuanceRow[];
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[280px] rounded-xl bg-white/90 p-3 shadow-sm backdrop-blur">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {COLORATION_LABELS[coloration]}
      </p>
      {coloration === "vainqueur" ? (
        <NuanceMiniLegend rows={winnerRows ?? []} />
      ) : coloration === "participation" ? (
        <ContinuousMiniLegend stops={PARTICIPATION_STOPS} fmt={(v) => fmtPct(v, 0)} />
      ) : coloration === "abstention" ? (
        <ContinuousMiniLegend stops={ABSTENTION_STOPS} fmt={(v) => fmtPct(v, 0)} />
      ) : coloration === "revenu" ? (
        <ContinuousMiniLegend stops={REVENU_STOPS} fmt={(v) => `${Math.round(v / 1000)}k`} />
      ) : (
        <ContinuousMiniLegend stops={PAUVRETE_STOPS} fmt={(v) => `${v}%`} />
      )}
    </div>
  );
}

function NuanceMiniLegend({ rows }: { rows: WinningNuanceRow[] }) {
  const present = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.nuance, (counts.get(r.nuance) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  if (present.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Sélectionne une coloration disponible.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {present.map(([nuance]) => (
        <div key={nuance} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: nuanceColor(nuance) }} />
          <span className="truncate text-[11px] text-foreground">{nuanceLabel(nuance)}</span>
        </div>
      ))}
    </div>
  );
}

function ContinuousMiniLegend({
  stops,
  fmt,
}: {
  stops: Array<[number, string]>;
  fmt: (v: number) => string;
}) {
  const gradient = `linear-gradient(90deg, ${stops.map((s) => s[1]).join(", ")})`;
  return (
    <div className="flex flex-col gap-1">
      <div className="h-2.5 w-full rounded-full" style={{ background: gradient }} />
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{fmt(stops[0][0])}</span>
        <span>{fmt(stops[stops.length - 1][0])}</span>
      </div>
    </div>
  );
}

// ─── Fiche territoire (droite) ──────────────────────────────────────────────────

type FicheTab = "resultats" | "socio" | "france";

function FicheTerritoire({
  code,
  maille,
  scrutin,
  lastClicked,
  onClear,
}: {
  code: string | null;
  maille: Maille;
  scrutin: Scrutin;
  lastClicked: { code: string; name: string; maille: Maille } | null;
  onClear: () => void;
}) {
  const election = isElection(scrutin);
  const isCommune = maille === "communes";
  const [tab, setTab] = useState<FicheTab>(election ? "resultats" : "socio");

  const detail = useScrutinDetail(election ? scrutin : null, maille, code);
  const socio = useSociologieCommune(isCommune ? code : null);
  const nationalPart = useScrutinNationalParticipation(election ? scrutin : null);

  useEffect(() => {
    setTab(election ? "resultats" : isCommune ? "socio" : "france");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, scrutin]);

  if (!code) return <FicheEmpty />;

  const cachedName = lastClicked?.code === code ? lastClicked.name : null;
  const displayName = cachedName ?? detail.data?.libelle ?? `Code ${code}`;

  const tabs: { id: FicheTab; label: string; enabled: boolean }[] = [
    { id: "resultats", label: "Résultats", enabled: election },
    { id: "socio", label: "Socio-démo", enabled: isCommune },
    { id: "france", label: "vs France", enabled: election || isCommune },
  ];
  const active = tabs.find((t) => t.id === tab && t.enabled) ?? tabs.find((t) => t.enabled);
  const tabId = active?.id ?? "resultats";

  const loading =
    (election && detail.isFetching && !detail.data) || (isCommune && socio.isFetching && !socio.data);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-black/5 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {MAILLE_LABELS[maille]}
          </p>
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{displayName}</h3>
        </div>
        <button
          onClick={onClear}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-black/5 px-3 pt-2">
        {tabs.filter((t) => t.enabled).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-2.5 pb-2 pt-1 text-[12px] font-medium transition-colors",
              tabId === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tabId === t.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-warm" />}
          </button>
        ))}
      </div>

      <div key={`${tabId}-${code}`} className="anim-fade-in min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <FicheLoading />
        ) : tabId === "resultats" ? (
          detail.data ? <ResultsBlock detail={detail.data} /> : <FicheUnavailable />
        ) : tabId === "socio" ? (
          <SocioBlock socio={socio.data ?? null} />
        ) : (
          <FranceBlock detail={detail.data ?? null} socio={socio.data ?? null} nationalPart={nationalPart.data ?? null} />
        )}
      </div>
    </div>
  );
}

function ResultsBlock({ detail }: { detail: ScrutinDetail }) {
  const top = detail.candidates.slice(0, 6);
  const winner = top[0];
  const maxPct = Math.max(...top.map((c) => c.pct), 0.0001);

  return (
    <div className="flex flex-col gap-5">
      {winner && (
        <div>
          <p className="text-[11px] text-muted-foreground">Arrive en tête</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[26px] font-semibold leading-none tracking-tight">
              {fmtPct(winner.pct)}
            </span>
            <span className="truncate text-[13px] font-medium" style={{ color: nuanceColor(winner.nuance) }}>
              {winner.label || nuanceLabel(winner.nuance)}
            </span>
          </div>
        </div>
      )}

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
                style={{ width: `${(c.pct / maxPct) * 100}%`, background: nuanceColor(c.nuance) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Participation" value={fmtPct(detail.participation)} />
        <KPICard label="Inscrits" value={fmtInt(detail.inscrits)} />
        <KPICard label="Votants" value={fmtInt(detail.votants)} />
        <KPICard label="Exprimés" value={fmtInt(detail.exprimes)} />
      </div>
    </div>
  );
}

function SocioBlock({ socio }: { socio: CommuneSociologie | null }) {
  if (!socio || (socio.revenuMedian == null && socio.tauxPauvrete == null)) {
    return <p className="text-[12px] text-muted-foreground">Données INSEE indisponibles pour ce territoire.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {socio.revenuMedian != null && (
        <KPICard
          label="Revenu médian disponible"
          value={fmtEuro(socio.revenuMedian)}
          hint={`France : ${fmtEuro(FR.revenuMedian)}`}
        />
      )}
      {socio.tauxPauvrete != null && (
        <KPICard
          label="Taux de pauvreté"
          value={`${socio.tauxPauvrete.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}
          hint={`France : ${FR.tauxPauvrete} %`}
        />
      )}
    </div>
  );
}

function FranceBlock({
  detail,
  socio,
  nationalPart,
}: {
  detail: ScrutinDetail | null;
  socio: CommuneSociologie | null;
  nationalPart: number | null;
}) {
  const rows: { label: string; local: number; national: number; fmt: (n: number) => string; pts?: boolean }[] = [];
  if (detail && nationalPart != null) {
    rows.push({ label: "Participation", local: detail.participation, national: nationalPart, fmt: (n) => fmtPct(n, 1), pts: true });
  }
  if (socio?.revenuMedian != null) {
    rows.push({ label: "Revenu médian", local: socio.revenuMedian, national: FR.revenuMedian, fmt: fmtEuro });
  }
  if (socio?.tauxPauvrete != null) {
    rows.push({ label: "Taux de pauvreté", local: socio.tauxPauvrete, national: FR.tauxPauvrete, fmt: (n) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`, pts: true });
  }

  if (rows.length === 0) {
    return <p className="text-[12px] text-muted-foreground">Comparaison indisponible pour ce territoire.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const delta = r.local - r.national;
        const up = delta >= 0;
        const deltaStr = r.pts
          ? `${up ? "+" : ""}${(delta * (r.label === "Participation" ? 100 : 1)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`
          : `${up ? "+" : ""}${((delta / r.national) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
        return (
          <div key={r.label} className="rounded-xl border border-black/5 bg-white/60 p-3">
            <p className="text-[11px] text-muted-foreground">{r.label}</p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold tabular-nums">{r.fmt(r.local)}</span>
              <span className={cn("text-[11px] font-medium tabular-nums", up ? "text-emerald-600" : "text-rose-600")}>
                {deltaStr}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">France : {r.fmt(r.national)}</p>
          </div>
        );
      })}
    </div>
  );
}

function KPICard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FicheEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Aucune sélection
      </p>
      <p className="text-[13px] text-muted-foreground">Clique sur un territoire pour ouvrir sa fiche.</p>
    </div>
  );
}

function FicheUnavailable() {
  return <p className="text-[12px] text-muted-foreground">Résultats indisponibles à cette maille.</p>;
}

function FicheLoading() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-6 w-2/3 animate-pulse rounded bg-black/[0.06]" />
      <div className="h-2 w-full animate-pulse rounded bg-black/[0.06]" />
      <div className="h-2 w-5/6 animate-pulse rounded bg-black/[0.06]" />
      <div className="h-2 w-4/6 animate-pulse rounded bg-black/[0.06]" />
    </div>
  );
}

export default ExplorerView;
export { ExplorerView };
