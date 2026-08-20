"use client";

import { useMemo } from "react";
import { Spinner } from "@appica/ui-react/spinner";
import { cn } from "@/lib/utils";
import { SOCIO_INDICATORS, useSocioFeaturesCirco, type SocioUnit } from "@/lib/analysis";
import { fmtInt } from "@/lib/format";
import { ErrorState } from "@/components/error-state";

function fmtSocio(v: number, unit: SocioUnit): string {
  if (unit === "euro") return `${fmtInt(v)} €`;
  if (unit === "ratio") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}×`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/**
 * Profil sociologique d'une circonscription (10 indicateurs INSEE) comparé à la
 * moyenne nationale des circonscriptions. Partagé entre la fiche stratégique
 * circo et la page Analyser ▸ Sociologie.
 */
export function CircoSocioProfile({ code, className }: { code: string; className?: string }) {
  const features = useSocioFeaturesCirco();

  const rows = useMemo(() => {
    const feat = features.data;
    if (!feat) return null;
    const vec = feat.get(code);
    if (!vec) return null;
    const sums = new Array(SOCIO_INDICATORS.length).fill(0);
    const counts = new Array(SOCIO_INDICATORS.length).fill(0);
    for (const v of feat.values()) {
      v.forEach((x, i) => {
        if (Number.isFinite(x)) {
          sums[i] += x;
          counts[i] += 1;
        }
      });
    }
    return SOCIO_INDICATORS.map((meta, i) => {
      const national = counts[i] > 0 ? sums[i] / counts[i] : 0;
      return { meta, value: vec[i], national, ratio: national ? vec[i] / national - 1 : 0 };
    });
  }, [features.data, code]);

  if (features.isLoading) {
    return (
      <p className={cn("inline-flex items-center gap-1.5 text-[12px] text-muted-foreground", className)}>
        <Spinner currentColor className="size-3.5" /> Chargement du profil sociologique…
      </p>
    );
  }
  // Un ÉCHEC de chargement affichait le même message qu'une absence légitime de
  // données, sans moyen de réessayer : on ne pouvait pas distinguer « INSEE ne
  // couvre pas ce territoire » d'une panne réseau.
  if (features.isError) {
    return (
      <ErrorState
        className={className}
        message="Impossible de charger le profil sociologique."
        onRetry={() => void features.refetch()}
      />
    );
  }
  if (!rows) {
    return (
      <p className={cn("text-[12px] text-muted-foreground", className)}>
        Pas d’indicateurs INSEE pour cette circonscription — les 38 sièges d’outre-mer
        et des Français de l’étranger ne sont pas couverts par les bases Filosofi et
        Recensement à cette maille.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-x-6 gap-y-2 sm:grid-cols-2", className)}>
      {rows.map((r) => (
        <SocioRow key={r.meta.id} label={r.meta.label} value={fmtSocio(r.value, r.meta.unit)} ratio={r.ratio} />
      ))}
    </div>
  );
}

function SocioRow({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  const pct = Math.round(ratio * 100);
  const tone = Math.abs(pct) < 5 ? "text-muted-foreground" : pct > 0 ? "text-emerald-600" : "text-red-600";
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
      <span className={cn("w-16 shrink-0 text-right text-[11px] font-medium tabular-nums", tone)} title="Écart à la moyenne nationale des circonscriptions">
        {pct >= 0 ? "+" : ""}{pct} %
      </span>
    </div>
  );
}
