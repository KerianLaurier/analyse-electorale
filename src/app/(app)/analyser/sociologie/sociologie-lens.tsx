"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePerimetre } from "@/app/(app)/analyser/analyser-shell";
import { perimetreKey } from "@/app/(app)/analyser/perimetre";
import { SocioPotentielSection } from "@/app/(app)/analyser/sociologie/socio-territoire";
import { SociologieView } from "@/app/(app)/analyser/sociologie/sociologie-view";
import { PotentielView } from "@/app/(app)/analyser/potentiel/potentiel-view";

/**
 * Lentille SOCIOLOGIE — « qui vote quoi », et où sont les réserves.
 *
 * Deux échelles, une même paire de questions :
 * - sur un territoire, le profil INSEE et le potentiel par bloc, côte à côte ;
 * - sur la France, la corrélation indicateur × vote (carte) et la sur /
 *   sous-performance par circonscription — les anciens outils « Sociologie » et
 *   « Potentiel national », qui vivaient chacun sur sa propre page.
 *
 * Ces deux analyses nationales portent chacune leur carte : les empiler
 * monterait deux instances MapLibre. Un sélecteur les alterne.
 */

type VueNationale = "correlations" | "potentiel";

const VUES: { id: VueNationale; label: string; hint: string }[] = [
  { id: "correlations", label: "Corrélations", hint: "Indicateur INSEE × vote" },
  { id: "potentiel", label: "Potentiel", hint: "Sur / sous-performance" },
];

export function SociologieLens() {
  const perimetre = usePerimetre();
  const [vue, setVue] = useState<VueNationale>("correlations");

  if (perimetre.scope === "territoire") {
    return <SocioPotentielSection key={perimetreKey(perimetre)} sel={perimetre} />;
  }

  return (
    <>
      <div className="inline-flex w-fit items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
        {VUES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVue(v.id)}
            aria-pressed={vue === v.id}
            title={v.hint}
            className={cn(
              "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
              vue === v.id
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {vue === "correlations" ? <SociologieView /> : <PotentielView />}
    </>
  );
}
