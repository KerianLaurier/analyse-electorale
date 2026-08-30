"use client";

import { Gauge, Users2 } from "lucide-react";
import { Spinner } from "@appica/ui-react/spinner";
import { cn } from "@/lib/utils";
import { blocById } from "@/lib/analysis";
import { fmtInt, fmtPct } from "@/lib/format";
import {
  usePotentielCirco,
  usePotentielTerritory,
  useSocioProfile,
  type PotentielBlocRow,
} from "@/lib/territory-analysis";
import type { Perimetre } from "@/app/(app)/analyser/perimetre";

/**
 * Volet sociologique d'un TERRITOIRE : profil INSEE (écart au national) et
 * potentiel par bloc (score attendu d'après la sociologie vs score réel).
 *
 * Son pendant national vit dans les vues `sociologie-view` (corrélations) et
 * `potentiel-view` (sur / sous-performance par circonscription) — même
 * question, autre échelle, même lentille.
 */

type Territoire = Extract<Perimetre, { scope: "territoire" }>;

const fmtPts = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;

// ─── 3. Sociologie & potentiel ────────────────────────────────────────────────

function fmtSocioValue(v: number, unit: "euro" | "pct" | "ratio"): string {
  if (unit === "euro") return `${fmtInt(v)} €`;
  if (unit === "ratio") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}×`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function SocioPotentielSection({ sel }: { sel: Territoire }) {
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

