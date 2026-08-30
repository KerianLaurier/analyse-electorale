"use client";

import { useCallback } from "react";
import Link from "next/link";
import { deptFromCirco } from "@/lib/territoire";
import { REGION_OF_DEPT } from "@/lib/territory-analysis";
import { usePerimetre, EchelleIndisponible } from "@/app/(app)/analyser/analyser-shell";
import { perimetreKey } from "@/app/(app)/analyser/perimetre";
import { CiblageView } from "@/app/(app)/analyser/ciblage/ciblage-view";
import { MarginaliteView } from "@/app/(app)/analyser/marginalite/marginalite-view";

/**
 * Lentille CIBLAGE — « où porter l'effort ».
 *
 * Une seule question, deux granularités selon le périmètre :
 * - **circonscription** → ses bureaux de vote classés par priorité ;
 * - **France, région, département** → les circonscriptions les plus disputées,
 *   restreintes au périmètre.
 *
 * C'est la fusion des anciens outils « Ciblage terrain » (une circo) et
 * « Sièges marginaux » (national) : le même geste, à l'échelle où l'on se
 * trouve, au lieu de deux pages sans lien entre elles.
 */
export function CiblageLens() {
  const perimetre = usePerimetre();

  // Restriction des circonscriptions au périmètre. Les codes circo portent leur
  // département en préfixe (`deptFromCirco`), et `REGION_OF_DEPT` remonte à la
  // région — aucune donnée supplémentaire à charger.
  const gardeDept = useCallback(
    (code: string) => deptFromCirco(code) === (perimetre.scope === "territoire" ? perimetre.code : null),
    [perimetre],
  );
  const gardeRegion = useCallback(
    (code: string) => {
      const dept = deptFromCirco(code);
      return !!dept && REGION_OF_DEPT[dept] === (perimetre.scope === "territoire" ? perimetre.code : null);
    },
    [perimetre],
  );

  if (perimetre.scope === "france") return <MarginaliteView />;

  if (perimetre.type === "circo") {
    return <CiblageView key={perimetreKey(perimetre)} circo={perimetre.code} />;
  }

  if (perimetre.type === "departement") {
    return <MarginaliteView key={perimetreKey(perimetre)} garde={gardeDept} perimetreLabel={perimetre.label} />;
  }

  if (perimetre.type === "region") {
    return <MarginaliteView key={perimetreKey(perimetre)} garde={gardeRegion} perimetreLabel={perimetre.label} />;
  }

  // Commune : le ciblage se fait au bureau de vote, et les bureaux sont
  // rattachés à une circonscription. On oriente plutôt que de laisser vide.
  return (
    <EchelleIndisponible
      titre="Le ciblage se joue à la circonscription"
      explication={`Les bureaux de vote sont classés par priorité à l'échelle d'une circonscription. Sélectionnez celle de ${perimetre.label} dans le sélecteur ci-dessus pour obtenir son plan de ciblage.`}
      action={
        <Link
          href={`/commune/${encodeURIComponent(perimetre.code)}`}
          className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ouvrir la fiche de {perimetre.label}
        </Link>
      }
    />
  );
}
