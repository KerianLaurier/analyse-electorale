"use client";

import { useMemo } from "react";
import { Button } from "@appica/ui-react/button";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { type Maille, MAILLE_LABELS } from "@/lib/map-config";
import { SCRUTIN_META, SCRUTINS_CHRONO, maillesFor, type Scrutin } from "@/lib/url-state";
import { useScrutinDetail } from "@/lib/queries";

// Ordre chronologique des scrutins (un même territoire superposé dans le
// temps) — filtré par maille juste en dessous.
const TIMELINE: Scrutin[] = SCRUTINS_CHRONO;


const fmtPct = (v: number) =>
  `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

/**
 * Tous les scrutins d'un même territoire, côte à côte et dans l'ordre.
 *
 * La maille et le code viennent du périmètre d'Analyser : cet écran n'a plus
 * son propre sélecteur ni son territoire par défaut codé en dur (« Nord »).
 * Les scrutins non disponibles à cette maille sont simplement absents de la
 * frise (`maillesFor`).
 */
export function ComparateurView({
  maille,
  code,
  label,
}: {
  maille: Maille;
  code: string;
  label: string;
}) {
  const timeline = useMemo(() => TIMELINE.filter((s) => maillesFor(s).includes(maille)), [maille]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">Tous les scrutins de {label}</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Superposer les scrutins d&apos;un même territoire pour repérer les bascules ·{" "}
          {MAILLE_LABELS[maille].toLowerCase()}.
        </p>
      </div>

      {timeline.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
          {timeline.map((s) => (
            <ScrutinCard key={s} scrutin={s} maille={maille} code={code} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[240px] place-items-center rounded-lg bg-surface p-8 text-center shadow-card">
          <p className="text-[13px] text-muted-foreground">
            Aucun scrutin disponible à cette maille.
          </p>
        </div>
      )}
    </div>
  );
}

function ScrutinCard({ scrutin, maille, code }: { scrutin: Scrutin; maille: Maille; code: string }) {
  const detail = useScrutinDetail(scrutin, maille, code);
  const top = detail.data?.candidates.slice(0, 3) ?? [];
  const winner = top[0];
  const max = Math.max(...top.map((c) => c.pct), 0.0001);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-3 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {SCRUTIN_META[scrutin].short}
      </p>
      {detail.isFetching && !detail.data ? (
        <div className="h-16 animate-pulse rounded bg-foreground/[0.05]" />
      ) : winner ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: nuanceColor(winner.nuance) }} />
              <span className="truncate" title={winner.label || nuanceLabel(winner.nuance)}>
                {winner.label || nuanceLabel(winner.nuance)}
              </span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold tabular-nums">{fmtPct(winner.pct)}</span>
          </div>
          <div className="flex flex-col gap-1">
            {top.map((c, i) => (
              <div key={`${c.label}-${i}`} className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-soft/60">
                  <span className="block h-full rounded-pill" style={{ width: `${(c.pct / max) * 100}%`, background: nuanceColor(c.nuance) }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground">{fmtPct(c.pct)}</span>
              </div>
            ))}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">
            Participation {detail.data ? fmtPct(detail.data.participation) : "—"}
          </p>
        </>
      ) : detail.isError ? (
        <Button
          type="button"
          onClick={() => void detail.refetch()}
          className="self-start text-[11px] underline-offset-2 hover:underline" variant="ghost" size="sm">
          Erreur — réessayer
        </Button>
      ) : (
        <p className="text-[11px] text-muted-foreground">Indisponible</p>
      )}
    </div>
  );
}
