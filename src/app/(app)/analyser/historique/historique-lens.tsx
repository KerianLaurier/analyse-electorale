"use client";

import { TERRITORY_MAILLE } from "@/lib/territory-analysis";
import { usePerimetre, EchelleIndisponible } from "@/app/(app)/analyser/analyser-shell";
import { perimetreKey } from "@/app/(app)/analyser/perimetre";
import { ComparateurView } from "@/app/(app)/analyser/comparateur/comparateur-view";

/**
 * Lentille HISTORIQUE — « comment on en est arrivé là ».
 *
 * Reprend l'ancien « Comparateur de scrutins », mais sur le périmètre courant
 * au lieu d'un territoire choisi séparément (et d'un défaut codé en dur).
 */
export function HistoriqueLens() {
  const perimetre = usePerimetre();

  if (perimetre.scope === "france") {
    return (
      <EchelleIndisponible
        titre="Choisissez un territoire"
        explication="La frise superpose les scrutins d'un même territoire pour en repérer les bascules — elle n'a pas d'équivalent à l'échelle nationale. Le rapport de force national, lui, est sur la lentille Diagnostic."
      />
    );
  }

  return (
    <ComparateurView
      key={perimetreKey(perimetre)}
      maille={TERRITORY_MAILLE[perimetre.type]}
      code={perimetre.code}
      label={perimetre.label}
    />
  );
}
