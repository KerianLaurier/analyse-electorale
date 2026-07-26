"use client";

// État d'URL de l'explorateur (hook client). Le catalogue des scrutins vit dans
// `@/lib/scrutins` — module isomorphe, lisible depuis le serveur. On le
// ré-exporte ici pour ne pas changer les nombreux points d'appel clients ; le
// code SERVEUR, lui, doit importer `@/lib/scrutins` directement.
import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MAILLE_ORDER, type Maille } from "@/lib/map-config";
import { SCRUTIN_META, type Scrutin, type Coloration } from "@/lib/scrutins";

export * from "@/lib/scrutins";

const SCRUTINS = new Set<Scrutin>(Object.keys(SCRUTIN_META) as Scrutin[]);
const COLORATIONS = new Set<Coloration>([
  "vainqueur",
  "participation",
  "abstention",
  "bloc-gauche",
  "bloc-ecolo",
  "bloc-centre",
  "bloc-droite",
  "bloc-rn",
  "revenu",
  "pauvrete",
  "inegalites",
  "prestations",
  "pensions",
  "age65",
  "chomage",
  "cadres",
  "diplome",
  "ouvriers",
  "densite",
  "jeunes",
  "evopop",
  "proprietaires",
  "ressecondaires",
  "logvacants",
  "monoparentales",
  "personnes-seules",
  "nouveaux-arrivants",
  "evo-abstention",
  "dynamique-rn",
  "dynamique-gauche",
  "legis-abstention",
  "legis-rn",
  "legis-gauche",
  "pot-rn",
  "pot-gauche",
  "pot-ecolo",
  "pot-centre",
  "pot-droite",
]);
const MAILLE_SET: ReadonlySet<Maille> = new Set<Maille>(MAILLE_ORDER);

export type ExplorerState = {
  maille: Maille;
  scrutin: Scrutin;
  coloration: Coloration;
  code: string | null;
};

export type ExplorerStatePatch = Partial<ExplorerState>;

export function useExplorerUrlState(): ExplorerState & {
  update: (patch: ExplorerStatePatch) => void;
} {
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo<ExplorerState>(() => {
    const mailleParam = params.get("maille") as Maille | null;
    const scrutinParam = params.get("scrutin") as Scrutin | null;
    const colorationParam = params.get("coloration") as Coloration | null;
    const codeParam = params.get("code");
    return {
      maille: mailleParam && MAILLE_SET.has(mailleParam) ? mailleParam : "regions",
      scrutin: scrutinParam && SCRUTINS.has(scrutinParam) ? scrutinParam : "presid-2022-t1",
      coloration:
        colorationParam && COLORATIONS.has(colorationParam) ? colorationParam : "vainqueur",
      code: codeParam && codeParam.length > 0 ? codeParam : null,
    };
  }, [params]);

  const update = useCallback(
    (patch: ExplorerStatePatch) => {
      const next = new URLSearchParams(params.toString());
      if (patch.maille !== undefined) next.set("maille", patch.maille);
      if (patch.scrutin !== undefined) next.set("scrutin", patch.scrutin);
      if (patch.coloration !== undefined) next.set("coloration", patch.coloration);
      if (patch.code !== undefined) {
        if (patch.code === null) next.delete("code");
        else next.set("code", patch.code);
      }
      const qs = next.toString();
      // Routing « shallow » natif : `history.replaceState` est intégré au routeur
      // Next (usePathname/useSearchParams se resynchronisent) SANS déclencher de
      // requête RSC. `router.replace` en refaisait une à chaque clic sur la carte
      // ou changement de filtre — ~1 aller-retour réseau par interaction.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname],
  );

  return { ...state, update };
}
