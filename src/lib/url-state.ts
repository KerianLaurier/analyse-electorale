"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MAILLE_ORDER, type Maille } from "@/lib/map-config";

// Anciens LayerId — conservés en interne pour driver les queries existantes.
export type LayerId =
  | "none"
  | "participation-legis-2024"
  | "nuance-legis-2024"
  | "participation-presid-2022"
  | "vote-dominant-presid-2022"
  | "revenu-median-commune"
  | "taux-pauvrete-commune";

// Nouvelle granularité UI : scrutin × coloration. Plus proche du design.
export type Scrutin =
  | "presid-2022-t1"
  | "presid-2022-t2"
  | "legis-2024"
  | "sociologie";

export type Coloration =
  | "vainqueur"
  | "score"
  | "abstention"
  | "revenu"
  | "pauvrete";

const SCRUTINS: ReadonlySet<Scrutin> = new Set<Scrutin>([
  "presid-2022-t1",
  "presid-2022-t2",
  "legis-2024",
  "sociologie",
]);
const COLORATIONS: ReadonlySet<Coloration> = new Set<Coloration>([
  "vainqueur",
  "score",
  "abstention",
  "revenu",
  "pauvrete",
]);
const MAILLE_SET: ReadonlySet<Maille> = new Set<Maille>(MAILLE_ORDER);

export const SCRUTIN_LABELS: Record<Scrutin, { short: string; long: string }> = {
  "presid-2022-t1": { short: "Prés. 2022 · T1", long: "PRÉS. 2022 · 1ER TOUR" },
  "presid-2022-t2": { short: "Prés. 2022 · T2", long: "PRÉS. 2022 · 2ND TOUR" },
  "legis-2024":     { short: "Légis. 2024",      long: "LÉGIS. 2024 · 1ER TOUR" },
  "sociologie":     { short: "Sociologie",       long: "INSEE FILOSOFI 2021" },
};

export const COLORATION_LABELS: Record<Coloration, string> = {
  vainqueur: "Vainqueur",
  score: "% Score",
  abstention: "Abstention",
  revenu: "Revenu médian",
  pauvrete: "Taux de pauvreté",
};

/**
 * Combos (scrutin × coloration) couverts par les données actuelles.
 * Tout ce qui n'est pas listé renvoie `null` côté `resolveLayer` → la couche
 * affichera "Non disponible" dans l'UI au lieu de planter.
 */
const COMBO_TO_LAYER: Partial<Record<`${Scrutin}|${Coloration}`, LayerId>> = {
  "presid-2022-t1|vainqueur": "vote-dominant-presid-2022",
  "presid-2022-t1|score": "participation-presid-2022",
  "legis-2024|vainqueur": "nuance-legis-2024",
  "legis-2024|score": "participation-legis-2024",
  "sociologie|revenu": "revenu-median-commune",
  "sociologie|pauvrete": "taux-pauvrete-commune",
};

export function resolveLayer(scrutin: Scrutin, coloration: Coloration): LayerId | null {
  return COMBO_TO_LAYER[`${scrutin}|${coloration}`] ?? null;
}

export type ExplorerState = {
  maille: Maille;
  scrutin: Scrutin;
  coloration: Coloration;
  code: string | null;
};

export type ExplorerStatePatch = Partial<{
  maille: Maille;
  scrutin: Scrutin;
  coloration: Coloration;
  code: string | null;
}>;

export function useExplorerUrlState(): ExplorerState & {
  update: (patch: ExplorerStatePatch) => void;
} {
  const router = useRouter();
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
      coloration: colorationParam && COLORATIONS.has(colorationParam) ? colorationParam : "vainqueur",
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
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { ...state, update };
}
