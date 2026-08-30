"use client";

import { Spinner } from "@appica/ui-react/spinner";
import { useTerritoryHistory } from "@/lib/territory-analysis";
import { ErrorState } from "@/components/error-state";
import { usePerimetre } from "@/app/(app)/analyser/analyser-shell";
import { perimetreKey, type Perimetre } from "@/app/(app)/analyser/perimetre";
import { ProjectionSection } from "@/app/(app)/analyser/projection-section";
import { SimulateurView } from "@/app/(app)/analyser/simulateur/simulateur-view";

/**
 * Lentille PROJECTION — « ce que donnerait 2027 ».
 *
 * - sur un territoire : projection tendancielle par bloc, ajustable par un
 *   scénario national et une hypothèse de participation ;
 * - sur la France : le simulateur de sièges (l'ancien outil « Simulateur »),
 *   qui répond à la même question à l'échelle de l'Assemblée.
 */
type Territoire = Extract<Perimetre, { scope: "territoire" }>;

export function ProjectionLens() {
  const perimetre = usePerimetre();
  if (perimetre.scope === "france") return <SimulateurView />;
  return <TerritoryProjection key={perimetreKey(perimetre)} sel={perimetre} />;
}

function TerritoryProjection({ sel }: { sel: Territoire }) {
  const history = useTerritoryHistory(sel.type, sel.code);

  if (history.isLoading) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-lg bg-surface shadow-card">
        <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Spinner currentColor className="size-4" /> Projection de {sel.label}…
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
          Pas assez d&apos;historique pour projeter « {sel.label} ».
        </p>
      </div>
    );
  }

  return <ProjectionSection type={sel.type} history={points} />;
}
