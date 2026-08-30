"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCampaign } from "@/lib/campaign";
import { territoryFrom } from "@/lib/territoire";
import {
  FRANCE,
  LENTILLES,
  lentilleFromPathname,
  lentilleHref,
  perimetreFromParams,
  perimetreKindLabel,
  perimetreLabel,
  perimetreQuery,
  type Perimetre,
} from "@/app/(app)/analyser/perimetre";
import { TerritoryPicker } from "@/app/(app)/analyser/territory-picker";

/**
 * Coquille d'Analyser : un périmètre, cinq lentilles.
 *
 * Le sélecteur de territoire et la barre de lentilles vivent ici, au-dessus des
 * pages : changer de lentille conserve le périmètre, et changer de périmètre
 * conserve la lentille. C'est ce qui manquait à l'ancienne organisation, où
 * chaque outil repartait de son propre état.
 */

const PerimetreCtx = createContext<Perimetre | null>(null);

/** Périmètre courant. Toujours défini — la France est le repli. */
export function usePerimetre(): Perimetre {
  return useContext(PerimetreCtx) ?? FRANCE;
}

export function AnalyserShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const lentille = lentilleFromPathname(pathname);

  // Défaut quand l'URL ne porte pas de territoire : la cible de campagne du QG
  // si elle est territorialisable, sinon la France.
  const campaign = useCampaign();
  const campaignPerimetre = useMemo<Perimetre | null>(() => {
    const t = territoryFrom(campaign?.target);
    if (!t) return null;
    if (t.circoCode) return { scope: "territoire", type: "circo", code: t.circoCode, label: t.shortLabel };
    if (t.target.type === "commune")
      return { scope: "territoire", type: "commune", code: t.target.id, label: t.target.label };
    if (t.target.type === "bureau") {
      const insee = t.target.id.split("_")[0] ?? "";
      return insee
        ? { scope: "territoire", type: "commune", code: insee, label: t.communeName ?? t.target.label }
        : null;
    }
    return null;
  }, [campaign?.target]);

  const perimetre = perimetreFromParams(params) ?? campaignPerimetre ?? FRANCE;

  // Routing « shallow » natif : changer de périmètre ne déclenche pas de
  // requête RSC — les données viennent de React Query, déjà en cache.
  const setPerimetre = useCallback(
    (p: Perimetre) => {
      window.history.replaceState(null, "", `${pathname}${perimetreQuery(p)}`);
    },
    [pathname],
  );

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-canvas">
      <header className="border-b border-border/60 px-4 pt-6 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Analyser
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
            {perimetreLabel(perimetre)}
          </h1>
          <span className="rounded-pill bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {perimetreKindLabel(perimetre)}
          </span>
        </div>

        <div className="mt-4">
          <TerritoryPicker
            value={perimetre}
            campaign={campaignPerimetre}
            onChange={setPerimetre}
          />
        </div>

        {/* Cinq lentilles sur le même périmètre. Elles ne disparaissent jamais :
            quand une analyse n'existe pas à cette échelle, la page l'explique et
            propose l'échelle qui convient — plutôt qu'un onglet qui s'évapore. */}
        <nav aria-label="Lentilles d’analyse" className="-mb-px mt-5 flex gap-1 overflow-x-auto">
          {LENTILLES.map((l) => {
            const active = l.id === lentille.id;
            return (
              <Link
                key={l.id}
                href={lentilleHref(l, perimetre)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-w-max flex-col border-b-2 px-3 py-2.5 text-[13px] font-medium leading-tight transition-colors",
                  active
                    ? "border-warm text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {l.label}
                <span className="hidden text-[10.5px] font-normal text-muted-foreground sm:block">
                  {l.question}
                </span>
              </Link>
            );
          })}
        </nav>
      </header>

      <PerimetreCtx.Provider value={perimetre}>
        <div className="flex flex-1 flex-col gap-3 px-4 py-5 sm:px-6">{children}</div>
      </PerimetreCtx.Provider>
    </div>
  );
}

/**
 * Encart affiché quand une lentille n'a rien à montrer à cette échelle — avec
 * le geste qui débloque, plutôt qu'une impasse.
 */
export function EchelleIndisponible({
  titre,
  explication,
  action,
}: {
  titre: string;
  explication: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-lg bg-surface p-8 text-center shadow-card">
      <div className="max-w-md">
        <p className="text-[13px] font-medium">{titre}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{explication}</p>
        {action && <div className="mt-3 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
