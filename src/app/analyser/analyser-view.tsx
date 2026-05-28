"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Share2,
  Save,
  Plus,
  X,
  GitCompare,
  LineChart,
  Activity,
  Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Données mock (à brancher quand les queries swing seront prêtes) ────────

const SWING_ROWS = [
  { name: "Hauts-de-France",   value: 11.4, dir: "rn"  as const },
  { name: "Grand Est",         value:  8.7, dir: "rn"  as const },
  { name: "Bourgogne-FC",      value:  7.2, dir: "rn"  as const },
  { name: "Centre-VdL",        value:  5.1, dir: "rn"  as const },
  { name: "PACA",              value:  4.8, dir: "rn"  as const },
  { name: "Pays de la Loire",  value:  3.6, dir: "rn"  as const },
  { name: "Auvergne-RA",       value:  2.4, dir: "rn"  as const },
  { name: "Nouvelle-Aq.",      value:  1.1, dir: "rn"  as const },
  { name: "Bretagne",          value: -1.2, dir: "ren" as const },
  { name: "Normandie",         value: -1.8, dir: "ren" as const },
  { name: "Île-de-France",     value: -3.4, dir: "lfi" as const },
  { name: "Occitanie",         value: -0.6, dir: "lfi" as const },
];

const DIR_COLORS: Record<"rn" | "ren" | "lfi", string> = {
  rn:  "#1c1917",
  ren: "#f0a020",
  lfi: "#dc2626",
};

const DIR_LABELS: Record<"rn" | "ren" | "lfi", string> = {
  rn:  "Vers RN",
  ren: "Vers Ren.",
  lfi: "Vers LFI",
};

// ─── Vue ────────────────────────────────────────────────────────────────────

type AnalysisMode = "comparaison" | "correlation" | "serie" | "clusters";

const MODES: { id: AnalysisMode; label: string; icon: typeof GitCompare }[] = [
  { id: "comparaison", label: "Comparaison", icon: GitCompare },
  { id: "correlation", label: "Corrélation", icon: Activity },
  { id: "serie",       label: "Série temp.", icon: LineChart },
  { id: "clusters",    label: "Clusters",    icon: Grid3X3 },
];

export function AnalyserView() {
  const [mode, setMode] = useState<AnalysisMode>("comparaison");
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto bg-canvas p-3">
      {/* En-tête + actions */}
      <div className="flex items-end justify-between gap-4 px-2 pt-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Analyse · {today.toUpperCase()}
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
            Comparer des élections
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface p-0.5 shadow-card">
            {MODES.map((m) => {
              const active = mode === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
          <ActionButton icon={Share2} label="Partager" />
          <ActionButton icon={Save} label="Enregistrer" filled />
        </div>
      </div>

      {/* Paramètres */}
      <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Paramètres
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ParamPill
            label="Élection A · Prés. 2022 T2"
            removable
            primary
          />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <ParamPill label="Élection B · Législatives 2024" removable primary />
          <span className="ml-2 text-[12px] text-muted-foreground">·</span>
          <ParamPill label="Niveau · Département" />
          <ParamPill label="FR métropole" />
          <ParamPill label="Métrique · Swing pts" />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-pill border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Ajouter filtre
          </button>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="anim-stagger grid grid-cols-4 gap-2">
        <KPICard label="Régions analysées" value="13" hint="France métro." />
        <KPICard
          label="Swing moyen RN"
          value="+4.8 pts"
          hint="+1.4 vs estim."
          accent="positive"
        />
        <KPICard
          label="Régions basculées"
          value="4"
          hint="Hdf, GdE, Pdl, CvL"
        />
        <KPICard label="Corrélation revenu" value="0.78" hint="p < .001" />
      </div>

      {/* Deux blocs : mouvement + géographie */}
      <div className="grid grid-cols-[1fr_360px] gap-2">
        <SwingBlock />
        <GeoBlock />
      </div>

      <p className="px-2 pb-2 text-[10.5px] text-muted-foreground/80">
        Données mock pour cette pré-vue. Les queries de swing T1→T2 et de
        corrélation revenu seront branchées dans le prochain sprint.
      </p>
    </div>
  );
}

// ─── Blocs ────────────────────────────────────────────────────────────────

function SwingBlock() {
  const [unit, setUnit] = useState<"pts" | "pct" | "rang">("pts");
  const maxAbs = useMemo(
    () => Math.max(...SWING_ROWS.map((r) => Math.abs(r.value))),
    [],
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Mouvement par région
          </p>
          <p className="mt-0.5 text-[14px] font-medium">
            Swing Prés. 2022 → Légis. 2024
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
          {(["pts", "pct", "rang"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                unit === u
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {u === "pts" ? "Pts" : u === "pct" ? "%" : "Rang"}
            </button>
          ))}
        </div>
      </div>

      <ul className="anim-stagger flex flex-col gap-1.5">
        {SWING_ROWS.map((r) => (
          <SwingRow key={r.name} row={r} maxAbs={maxAbs} />
        ))}
      </ul>

      <div className="flex items-center gap-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        {(["rn", "ren", "lfi"] as const).map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: DIR_COLORS[d] }}
            />
            {DIR_LABELS[d]}
          </span>
        ))}
        <span className="ml-auto text-[10.5px] text-muted-foreground/70">
          Source · MI · data.gouv.fr
        </span>
      </div>
    </div>
  );
}

function SwingRow({
  row,
  maxAbs,
}: {
  row: { name: string; value: number; dir: "rn" | "ren" | "lfi" };
  maxAbs: number;
}) {
  const pos = row.value >= 0;
  const widthPct = Math.min(100, (Math.abs(row.value) / maxAbs) * 50);
  return (
    <li className="grid grid-cols-[140px_1fr_60px] items-center gap-3 text-[12px]">
      <span className="truncate text-foreground/80">{row.name}</span>
      <div className="relative h-2 rounded-pill bg-surface-soft/60">
        {/* Axe central */}
        <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
        <span
          className="absolute top-0 h-full rounded-pill transition-[width,left] duration-500 ease-out"
          style={{
            left: pos ? "50%" : `calc(50% - ${widthPct}%)`,
            width: `${widthPct}%`,
            background: DIR_COLORS[row.dir],
          }}
        />
      </div>
      <span
        className={cn(
          "text-right font-semibold tabular-nums",
          pos ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {pos ? "+" : ""}
        {row.value.toFixed(1)} pts
      </span>
    </li>
  );
}

function GeoBlock() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Géographie
          </p>
          <p className="mt-0.5 text-[14px] font-medium">Carte des écarts</p>
        </div>
        <Link
          href="/explorer?scrutin=legis-2024&coloration=vainqueur&maille=circonscriptions"
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Ouvrir →
        </Link>
      </div>
      <div className="grid place-items-center h-[260px] rounded-md border border-dashed border-border bg-surface-alt/60 text-[11px] text-muted-foreground">
        Aperçu carte — à brancher
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  filled,
}: {
  icon: typeof Share2;
  label: string;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
        filled
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border bg-surface text-foreground/80 hover:bg-surface-soft",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ParamPill({
  label,
  removable,
  primary,
}: {
  label: string;
  removable?: boolean;
  primary?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-medium",
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-surface text-foreground/80",
      )}
    >
      {label}
      {removable && (
        <button
          type="button"
          aria-label="Retirer"
          className={cn(
            "rounded-pill p-0.5 transition-colors",
            primary ? "hover:bg-white/10" : "hover:bg-surface-soft",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function KPICard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          accent === "positive" && "text-success",
          accent === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}
