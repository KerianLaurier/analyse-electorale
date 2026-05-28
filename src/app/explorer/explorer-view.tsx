"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, X, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Maille,
  MAILLE_LABELS,
  MAILLE_ORDER,
} from "@/lib/map-config";
import {
  useParticipationCirco,
  useWinningNuanceCirco,
  useParticipationCommunePresid2022T1,
  useWinningCandidateCommunePresid2022T1,
  useRevenuMedianCommune,
  useTauxPauvreteCommune,
  useSociologieCommune,
  useCircoDetail,
  type WinningNuanceRow,
  type CommuneNumericRow,
} from "@/lib/queries";
import type { Choropleth } from "@/components/map";
import {
  NUANCES,
  buildNuanceMatchExpression,
  nuanceColor,
  nuanceLabel,
  presid2022Nuance,
  PRESID_2022_NUANCE,
} from "@/lib/nuances";
import {
  useExplorerUrlState,
  resolveLayer,
  type Scrutin,
  type Coloration,
  type LayerId,
  SCRUTIN_LABELS,
} from "@/lib/url-state";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

// ─── Données statiques pour l'UI ───────────────────────────────────────────

const MAILLE_COUNTS: Record<Maille, number> = {
  regions: 18,
  departements: 96,
  circonscriptions: 559,
  communes: 35798,
};

// Bureau de vote n'a pas (encore) de PMTiles, mais on l'affiche pour respecter
// le design — désactivé.
const MAILLE_EXTRA: Array<{ id: string; label: string; count: number; disabled: true }> = [
  { id: "bureau", label: "Bureau de vote", count: 69682, disabled: true },
];

const SCRUTINS: { id: Scrutin; label: string; comingSoon?: boolean }[] = [
  { id: "presid-2022-t2", label: "Prés. 2022 · T2", comingSoon: true },
  { id: "presid-2022-t1", label: "Prés. 2022 · T1" },
  { id: "legis-2024", label: "Légis. 2024" },
];

const COLORATIONS: { id: Coloration; label: string; comingSoon?: boolean }[] = [
  { id: "vainqueur", label: "Vainqueur" },
  { id: "score", label: "% Score" },
  { id: "abstention", label: "Abstention", comingSoon: true },
];

// Candidats listés par scrutin (pour la section "CANDIDATS").
const CANDIDATES_BY_SCRUTIN: Record<Scrutin, string[]> = {
  "presid-2022-t1": Object.keys(PRESID_2022_NUANCE),
  "presid-2022-t2": ["MACRON", "LE PEN"],
  "legis-2024": [], // Pas pertinent au niveau national, géré par circo
  "sociologie": [],
};

// ─── Couleurs choroplèthes ─────────────────────────────────────────────────

const PARTICIPATION_STOPS: Array<[number, string]> = [
  [0.3, "#f1f5f9"],
  [0.5, "#93c5fd"],
  [0.65, "#2563eb"],
  [0.8, "#1e3a8a"],
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
  rows: Array<{ code: string; value: number }>,
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

function nuanceChoropleth(
  rows: { code: string; nuance: string }[],
): Choropleth {
  return {
    stateKey: "nuance",
    data: rows.map((r) => ({ code: r.code, value: r.nuance })),
    paint: buildNuanceMatchExpression() as unknown as Choropleth["paint"],
  };
}

function presid2022ToNuanceRows(
  rows: { code: string; candidate: string }[],
): WinningNuanceRow[] {
  const out: WinningNuanceRow[] = [];
  for (const r of rows) {
    const n = presid2022Nuance(r.candidate);
    if (n) out.push({ code: r.code, nuance: n });
  }
  return out;
}

const FMT_INT = new Intl.NumberFormat("fr-FR");
const FMT_PCT = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

// ─── Helpers UI ────────────────────────────────────────────────────────────

function pickName(props: Record<string, unknown>): string {
  for (const key of [
    "nom",
    "NOM",
    "libelle",
    "LIBELLE",
    "nomCirconscription",
    "name",
  ]) {
    const value = props[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "Sans nom";
}
function pickCode(props: Record<string, unknown>): string | null {
  for (const key of [
    "code",
    "codeCirconscription",
    "CODE",
    "INSEE_COM",
    "insee",
    "id",
  ]) {
    const value = props[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return null;
}

// ─── ExplorerView ──────────────────────────────────────────────────────────

export function ExplorerView() {
  const { maille, scrutin, coloration, code, update } = useExplorerUrlState();
  const layer: LayerId | null = useMemo(
    () => resolveLayer(scrutin, coloration),
    [scrutin, coloration],
  );

  const [lastClicked, setLastClicked] = useState<{
    code: string;
    name: string;
    maille: Maille;
  } | null>(null);

  useEffect(() => {
    if (!code) setLastClicked(null);
    else if (lastClicked && lastClicked.code !== code) setLastClicked(null);
  }, [code, lastClicked]);

  // Auto-correction des combos invalides (scrutin × coloration sans données).
  // Si la combinaison courante n'a pas de layer correspondant, on bascule sur
  // la 1re coloration disponible pour ce scrutin (ou un scrutin de fallback).
  useEffect(() => {
    if (resolveLayer(scrutin, coloration) !== null) return;
    const tryColorations: Coloration[] = scrutin === "sociologie"
      ? ["revenu", "pauvrete"]
      : ["vainqueur", "score"];
    for (const c of tryColorations) {
      if (resolveLayer(scrutin, c) !== null) {
        update({ coloration: c });
        return;
      }
    }
    // Aucun coloration pour ce scrutin → fallback sur Légis. 2024 vainqueur.
    update({ scrutin: "legis-2024", coloration: "vainqueur" });
  }, [scrutin, coloration, update]);

  // ─── Queries (chacune active selon le layer résolu) ────────────────────
  const partLegis = useParticipationCirco(layer === "participation-legis-2024");
  const nuanceLegis = useWinningNuanceCirco(layer === "nuance-legis-2024");
  const partPresid = useParticipationCommunePresid2022T1(
    layer === "participation-presid-2022",
  );
  const votePresid = useWinningCandidateCommunePresid2022T1(
    layer === "vote-dominant-presid-2022",
  );
  const revenu = useRevenuMedianCommune(layer === "revenu-median-commune");
  const pauvrete = useTauxPauvreteCommune(layer === "taux-pauvrete-commune");

  const presidNuanceRows = useMemo<WinningNuanceRow[] | undefined>(() => {
    if (!votePresid.data) return undefined;
    return presid2022ToNuanceRows(votePresid.data);
  }, [votePresid.data]);

  const choropleth = useMemo<Choropleth | null>(() => {
    switch (layer) {
      case "participation-legis-2024":
        return partLegis.data
          ? continuousChoropleth(
              "participation",
              PARTICIPATION_STOPS,
              partLegis.data.map((r) => ({ code: r.code, value: r.participation })),
            )
          : null;
      case "nuance-legis-2024":
        return nuanceLegis.data ? nuanceChoropleth(nuanceLegis.data) : null;
      case "participation-presid-2022":
        return partPresid.data
          ? continuousChoropleth(
              "participation",
              PARTICIPATION_STOPS,
              partPresid.data.map((r) => ({ code: r.code, value: r.participation })),
            )
          : null;
      case "vote-dominant-presid-2022":
        return presidNuanceRows ? nuanceChoropleth(presidNuanceRows) : null;
      case "revenu-median-commune":
        return revenu.data ? continuousChoropleth("revenu", REVENU_STOPS, revenu.data) : null;
      case "taux-pauvrete-commune":
        return pauvrete.data ? continuousChoropleth("pauvrete", PAUVRETE_STOPS, pauvrete.data) : null;
      default:
        return null;
    }
  }, [
    layer,
    partLegis.data,
    nuanceLegis.data,
    partPresid.data,
    presidNuanceRows,
    revenu.data,
    pauvrete.data,
  ]);

  const activeQuery =
    layer === "participation-legis-2024"
      ? partLegis
      : layer === "nuance-legis-2024"
        ? nuanceLegis
        : layer === "participation-presid-2022"
          ? partPresid
          : layer === "vote-dominant-presid-2022"
            ? votePresid
            : layer === "revenu-median-commune"
              ? revenu
              : layer === "taux-pauvrete-commune"
                ? pauvrete
                : null;
  const isLoading = !!activeQuery?.isLoading;
  const isError = !!activeQuery?.error;

  // Vue dérivée pour la légende.
  const nuanceRowsForLegend: WinningNuanceRow[] | undefined =
    layer === "nuance-legis-2024"
      ? nuanceLegis.data
      : layer === "vote-dominant-presid-2022"
        ? presidNuanceRows
        : undefined;

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 gap-3 overflow-hidden bg-canvas p-3">
      {/* ── Panneau gauche ───────────────────────────────────────── */}
      <aside className="flex w-[288px] shrink-0 flex-col gap-5 overflow-y-auto rounded-lg bg-surface p-4 text-[13px] shadow-card">
        <ControlsPanel
          maille={maille}
          scrutin={scrutin}
          coloration={coloration}
          onMaille={(m) => update({ maille: m })}
          onScrutin={(s) => update({ scrutin: s })}
          onColoration={(c) => update({ coloration: c })}
        />
      </aside>

      {/* ── Centre : carte + top bar + fiche flottante ──────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface shadow-card">
        <MapTopBar
          scrutin={scrutin}
          coloration={coloration}
          maille={maille}
        />

        <div className="relative flex-1 overflow-hidden">
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

          {/* Légende choroplèthe en bas de la carte */}
          <MapBottomLegend
            isLoading={isLoading}
            isError={isError}
            coloration={coloration}
            nuanceRows={nuanceRowsForLegend}
          />

          {/* Fiche territoire flottante */}
          <div className="pointer-events-none absolute right-4 top-4 w-[380px] max-w-[calc(100%-2rem)]">
            <div
              key={code ?? "empty"}
              className="anim-pop-in pointer-events-auto flex max-h-[calc(100vh-180px)] flex-col gap-0 overflow-y-auto rounded-lg bg-surface p-5 text-[13px]"
              style={{
                boxShadow:
                  "0 24px 64px -16px rgba(10,10,12,0.16), 0 6px 18px rgba(10,10,12,0.06)",
              }}
            >
              <FicheTerritoire
                maille={maille}
                code={code}
                scrutin={scrutin}
                coloration={coloration}
                lastClicked={lastClicked}
                onClear={() => update({ code: null })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sous-composants
// ═══════════════════════════════════════════════════════════════════════════

function ControlsPanel({
  maille,
  scrutin,
  coloration,
  onMaille,
  onScrutin,
  onColoration,
}: {
  maille: Maille;
  scrutin: Scrutin;
  coloration: Coloration;
  onMaille: (m: Maille) => void;
  onScrutin: (s: Scrutin) => void;
  onColoration: (c: Coloration) => void;
}) {
  return (
    <>
      <Section
        eyebrow="Couche active"
        title="Niveau géographique"
        subtitle="Granularité d'agrégation."
      >
        <div className="-mx-1 flex flex-col">
          {MAILLE_ORDER.map((id) => (
            <RadioRow
              key={id}
              active={maille === id}
              label={MAILLE_LABELS[id]}
              count={MAILLE_COUNTS[id]}
              onClick={() => onMaille(id)}
            />
          ))}
          {MAILLE_EXTRA.map((extra) => (
            <RadioRow
              key={extra.id}
              active={false}
              label={extra.label}
              count={extra.count}
              disabled
              onClick={() => {}}
            />
          ))}
        </div>
      </Section>

      <Section eyebrow="Jeu de données" rightTag="1 actif">
        <div className="flex flex-col gap-1">
          {SCRUTINS.map((s) => (
            <PillRow
              key={s.id}
              label={s.label}
              active={scrutin === s.id}
              comingSoon={s.comingSoon}
              onClick={() => onScrutin(s.id)}
            />
          ))}
          <PillRow
            label="Sociologie INSEE"
            active={scrutin === "sociologie"}
            onClick={() => onScrutin("sociologie")}
            muted
          />
        </div>
      </Section>

      <Section eyebrow="Coloration">
        <SegmentedToggle
          options={
            scrutin === "sociologie"
              ? [
                  { id: "revenu", label: "Revenu" },
                  { id: "pauvrete", label: "Pauvreté" },
                ]
              : COLORATIONS.map((c) => ({
                  id: c.id,
                  label: c.label,
                  disabled: c.comingSoon || resolveLayer(scrutin, c.id) === null,
                  comingSoon: c.comingSoon,
                }))
          }
          value={coloration}
          onChange={(c) => onColoration(c as Coloration)}
        />
      </Section>

      <Section
        eyebrow={
          scrutin === "presid-2022-t1"
            ? "Candidats · 12"
            : scrutin === "presid-2022-t2"
              ? "Candidats · 2"
              : "Candidats"
        }
        rightTag={scrutin === "sociologie" ? undefined : "Sélection à venir"}
      >
        <CandidatesPreview scrutin={scrutin} />
      </Section>
    </>
  );
}

function CandidatesPreview({ scrutin }: { scrutin: Scrutin }) {
  const list = CANDIDATES_BY_SCRUTIN[scrutin];
  if (!list || list.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/80">
        {scrutin === "legis-2024"
          ? "Multi-candidats par circo, à brancher."
          : "—"}
      </p>
    );
  }
  const visible = list.slice(0, 3);
  const rest = list.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((nom) => {
        const code = presid2022Nuance(nom);
        return (
          <span
            key={nom}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border/70 bg-surface px-2 py-1 text-[12px] font-medium"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: code ? nuanceColor(code) : "#9ca3af" }}
            />
            {nom.charAt(0)}.{nom.slice(1).toLowerCase()}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="inline-flex items-center rounded-pill border border-border/70 bg-surface-alt px-2 py-1 text-[12px] text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}

function MapTopBar({
  scrutin,
  coloration,
  maille,
}: {
  scrutin: Scrutin;
  coloration: Coloration;
  maille: Maille;
}) {
  const title = `${SCRUTIN_LABELS[scrutin].long} · ${COLORATION_LABEL[coloration]}`;
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
      <div className="flex flex-col leading-tight">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {SCRUTIN_LABELS[scrutin].long}
        </p>
        <p className="text-[13px] font-medium text-foreground">
          {COLORATION_LABEL[coloration]} par {MAILLE_LABELS[maille].toLowerCase()}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1 rounded-pill bg-surface-soft/80 p-0.5 text-[12px]">
        {["Carte", "Tableau", "Liste"].map((label) => (
          <button
            key={label}
            type="button"
            disabled={label !== "Carte"}
            className={cn(
              "rounded-pill px-2.5 py-1 font-medium transition-colors",
              label === "Carte"
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                : "text-muted-foreground hover:text-foreground disabled:opacity-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
          );
        }}
        className="ml-2 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-surface-soft hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Commune, circo, code…</span>
        <kbd className="hidden rounded border border-border/80 bg-surface-alt px-1 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}

const COLORATION_LABEL: Record<Coloration, string> = {
  vainqueur: "Vainqueur",
  score: "% Score",
  abstention: "Abstention",
  revenu: "Revenu médian",
  pauvrete: "Taux de pauvreté",
};

function MapBottomLegend({
  isLoading,
  isError,
  coloration,
  nuanceRows,
}: {
  isLoading: boolean;
  isError: boolean;
  coloration: Coloration;
  nuanceRows?: WinningNuanceRow[];
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-md bg-surface/95 px-3 py-2 text-[11px] shadow-card backdrop-blur">
      {isLoading && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
        </span>
      )}
      {isError && (
        <span className="text-destructive">Erreur DuckDB-WASM.</span>
      )}
      {!isLoading && !isError && (
        <>
          {coloration === "vainqueur" && nuanceRows && (
            <NuanceMiniLegend rows={nuanceRows} />
          )}
          {(coloration === "score" || coloration === "abstention") && (
            <ContinuousMiniLegend stops={PARTICIPATION_STOPS} unit="%" />
          )}
          {coloration === "revenu" && (
            <ContinuousMiniLegend stops={REVENU_STOPS} unit="€" />
          )}
          {coloration === "pauvrete" && (
            <ContinuousMiniLegend stops={PAUVRETE_STOPS} unit="%" />
          )}
        </>
      )}
    </div>
  );
}

function NuanceMiniLegend({ rows }: { rows: WinningNuanceRow[] }) {
  const counts = useMemo(() => {
    const map = new globalThis.Map<string, number>();
    for (const r of rows) map.set(r.nuance, (map.get(r.nuance) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);
  return (
    <div className="pointer-events-auto flex items-center gap-3">
      {counts.map(([code, n]) => (
        <span key={code} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: nuanceColor(code) }}
          />
          <span className="font-medium">{nuanceLabel(code).split(" ")[0]}</span>
          <span className="text-muted-foreground">{n}</span>
        </span>
      ))}
    </div>
  );
}

function ContinuousMiniLegend({
  stops,
  unit,
}: {
  stops: Array<[number, string]>;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-24 rounded-pill"
        style={{
          background: `linear-gradient(to right, ${stops.map(([, c]) => c).join(", ")})`,
        }}
      />
      <span className="text-muted-foreground tabular-nums">
        {stops[0][0]}
        {unit} → {stops[stops.length - 1][0]}
        {unit}
      </span>
    </div>
  );
}

// ─── Fiche territoire ──────────────────────────────────────────────────────

function FicheTerritoire({
  maille,
  code,
  scrutin,
  coloration,
  lastClicked,
  onClear,
}: {
  maille: Maille;
  code: string | null;
  scrutin: Scrutin;
  coloration: Coloration;
  lastClicked: { code: string; name: string; maille: Maille } | null;
  onClear: () => void;
}) {
  const effectiveMaille = lastClicked?.code === code ? lastClicked.maille : maille;
  const isCirco = effectiveMaille === "circonscriptions";
  const isCommune = effectiveMaille === "communes";
  const circoDetail = useCircoDetail(isCirco ? code : null);
  const sociologie = useSociologieCommune(isCommune ? code : null);

  if (!code) {
    return (
      <div className="flex flex-col gap-2 py-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Aucune sélection
        </p>
        <p className="text-[13px] text-muted-foreground">
          Clique sur un territoire pour ouvrir sa fiche.
        </p>
      </div>
    );
  }

  const cachedName = lastClicked?.code === code ? lastClicked.name : null;
  const queryName = circoDetail.data
    ? `${circoDetail.data.libelle} (${circoDetail.data.departement})`
    : null;
  const displayName = cachedName ?? queryName ?? `Code ${code}`;
  const mailleBadge = MAILLE_LABELS[effectiveMaille].toUpperCase();

  const subheading =
    coloration === "vainqueur"
      ? `${SCRUTIN_LABELS[scrutin].long} · VAINQUEUR`
      : coloration === "score"
        ? `${SCRUTIN_LABELS[scrutin].long} · % SCORE`
        : SCRUTIN_LABELS[scrutin].long;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {mailleBadge} · {code}
          </p>
          <h2 className="text-[20px] font-semibold leading-tight">{displayName}</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Effacer la sélection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1 rounded-pill bg-surface-soft/70 p-0.5 text-[12px]">
        {["Résultats", "Socio-démo", "vs. France"].map((label) => (
          <button
            key={label}
            type="button"
            disabled={label !== "Résultats"}
            className={cn(
              "flex-1 rounded-pill px-2 py-1 font-medium transition-colors",
              label === "Résultats"
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                : "text-muted-foreground hover:text-foreground disabled:opacity-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {subheading}
      </p>

      {isCirco && circoDetail.data ? (
        <CircoFiche data={circoDetail.data} />
      ) : isCirco && circoDetail.isLoading ? (
        <FicheLoading />
      ) : isCommune && sociologie.data ? (
        <CommuneFiche
          name={displayName}
          revenu={sociologie.data.revenuMedian}
          pauvrete={sociologie.data.tauxPauvrete}
        />
      ) : isCommune && sociologie.isLoading ? (
        <FicheLoading />
      ) : (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Fiche détaillée disponible pour les communes et circonscriptions.
        </p>
      )}

      <div className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4">
        <button
          type="button"
          disabled
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[12px] font-medium text-foreground/70 hover:bg-surface-soft disabled:opacity-50"
        >
          Comparer
        </button>
        <button
          type="button"
          disabled
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Détails <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </>
  );
}

function FicheLoading() {
  return (
    <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
    </div>
  );
}

function CircoFiche({
  data,
}: {
  data: NonNullable<ReturnType<typeof useCircoDetail>["data"]>;
}) {
  const top2 = data.candidates.slice(0, 2);
  const winner = top2[0];
  const max = Math.max(...top2.map((c) => c.pct_exp), 0.01);
  const winnerColor = nuanceColor(winner?.nuance);
  const elu = data.candidates.find((c) => c.elu);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[44px] font-semibold leading-none tracking-tight tabular-nums">
          {FMT_PCT.format(winner?.pct_exp ?? 0)}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: winnerColor }}
          />
          {winner?.nom} {winner?.prenom} ·{" "}
          <span className="text-foreground/80">{nuanceLabel(winner?.nuance)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {top2.map((c) => (
          <div key={c.nom}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: nuanceColor(c.nuance) }}
                />
                <span className="font-medium">
                  {c.nom.charAt(0)}. {c.nom.slice(1).toLowerCase()}{" "}
                  {c.prenom ? `${c.prenom.charAt(0)}.` : ""}
                </span>
                <span className="text-muted-foreground">· {nuanceLabel(c.nuance)}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {FMT_PCT.format(c.pct_exp)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-surface-soft">
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${(c.pct_exp / max) * 100}%`,
                  background: nuanceColor(c.nuance),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Participation"
          value={FMT_PCT.format(data.participation)}
          hint={null}
        />
        <KPICard
          label="Inscrits"
          value={FMT_INT.format(data.inscrits)}
          hint={null}
        />
        <KPICard
          label="Votants"
          value={FMT_INT.format(data.votants)}
          hint={null}
        />
        <KPICard
          label="Exprimés"
          value={FMT_INT.format(data.exprimes)}
          hint={null}
        />
      </div>

      {elu && (
        <p className="text-[11px] text-muted-foreground">
          Élu·e : <span className="font-medium text-foreground">{elu.nom} {elu.prenom}</span>
        </p>
      )}
    </div>
  );
}

function CommuneFiche({
  revenu,
  pauvrete,
}: {
  name: string;
  revenu: number | null;
  pauvrete: number | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[44px] font-semibold leading-none tracking-tight tabular-nums">
          {revenu != null ? `${(revenu / 1000).toFixed(1)}k€` : "—"}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Niveau de vie médian
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Revenu médian"
          value={revenu != null ? `${FMT_INT.format(Math.round(revenu))} €` : "—"}
          hint="Médiane FR · 22.0 k€"
        />
        <KPICard
          label="Taux de pauvreté"
          value={pauvrete != null ? `${pauvrete.toFixed(1)} %` : "—"}
          hint="Médiane FR · 14.6 %"
        />
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string | null;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-surface-alt p-2.5">
      <p className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}

// ─── Primitives de panneau ────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  subtitle,
  rightTag,
  children,
}: {
  eyebrow: string;
  title?: string;
  subtitle?: string;
  rightTag?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </p>
        {rightTag && (
          <span className="text-[10px] text-muted-foreground/80">{rightTag}</span>
        )}
      </div>
      {title && (
        <p className="mt-0.5 text-[14px] font-medium text-foreground">{title}</p>
      )}
      {subtitle && (
        <p className="text-[11px] text-muted-foreground/80">{subtitle}</p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function RadioRow({
  active,
  label,
  count,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-[13px] transition-colors",
        active
          ? "text-foreground"
          : "text-foreground/65 hover:bg-surface-soft hover:text-foreground",
        disabled && "opacity-50 hover:bg-transparent",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-3.5 w-3.5 place-items-center rounded-full border transition-colors",
          active ? "border-primary" : "border-border",
        )}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      <span className="text-[11.5px] text-muted-foreground tabular-nums">
        {FMT_INT.format(count)}
      </span>
    </button>
  );
}

function PillRow({
  label,
  active,
  muted,
  comingSoon,
  onClick,
}: {
  label: string;
  active: boolean;
  muted?: boolean;
  comingSoon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={comingSoon ? "Bientôt" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(10,10,12,0.18)]"
          : muted
            ? "text-muted-foreground hover:bg-surface-soft hover:text-foreground"
            : "text-foreground/80 hover:bg-surface-soft",
        comingSoon && "opacity-60",
      )}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full transition-colors",
          active ? "bg-warm" : "bg-border",
        )}
      />
      <span className="flex-1 font-medium">{label}</span>
      {comingSoon && (
        <span className="rounded-pill bg-surface-soft px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
          Bientôt
        </span>
      )}
    </button>
  );
}

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string; disabled?: boolean; comingSoon?: boolean }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex w-full items-center gap-0.5 rounded-md bg-surface-soft/70 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => !opt.disabled && onChange(opt.id)}
          disabled={opt.disabled}
          title={opt.comingSoon ? "Bientôt" : opt.disabled ? "Non disponible pour ce scrutin" : undefined}
          className={cn(
            "flex-1 rounded-[7px] px-2 py-1 text-[12px] font-medium transition-all duration-200",
            value === opt.id
              ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
              : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Cleanup unused imports / types (referenced for completeness in other files).
void NUANCES;
