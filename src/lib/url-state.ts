"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MAILLE_ORDER, type Maille } from "@/lib/map-config";

// ─── Scrutins disponibles ─────────────────────────────────────────────────────
// L'identifiant correspond directement au nom des Parquet agrégés
// (public/electoral/agg/{scrutin}_territoires.parquet & _candidats.parquet).

export type Scrutin =
  | "presid-2017-t1"
  | "presid-2017-t2"
  | "presid-2022-t1"
  | "presid-2022-t2"
  | "legis-2022-t1"
  | "legis-2022-t2"
  | "legis-2024-t1"
  | "legis-2024-t2"
  | "municipales-2026-t1"
  | "municipales-2026-t2"
  | "sociologie";

export type Coloration =
  | "vainqueur"
  | "participation"
  | "abstention"
  | "revenu"
  | "pauvrete";

export type ScrutinFamily =
  | "presidentielle"
  | "legislative"
  | "municipale"
  | "sociologie";

type ScrutinMeta = {
  short: string;
  long: string;
  family: ScrutinFamily;
  mailles: Maille[];
};

const ALL_MAILLES: Maille[] = ["regions", "departements", "circonscriptions", "communes"];
const NO_CIRCO: Maille[] = ["regions", "departements", "communes"];

export const SCRUTIN_META: Record<Scrutin, ScrutinMeta> = {
  "presid-2017-t1": { short: "Prés. 2017 · T1", long: "PRÉSIDENTIELLE 2017 · 1ER TOUR", family: "presidentielle", mailles: ALL_MAILLES },
  "presid-2017-t2": { short: "Prés. 2017 · T2", long: "PRÉSIDENTIELLE 2017 · 2ND TOUR", family: "presidentielle", mailles: ALL_MAILLES },
  "presid-2022-t1": { short: "Prés. 2022 · T1", long: "PRÉSIDENTIELLE 2022 · 1ER TOUR", family: "presidentielle", mailles: ALL_MAILLES },
  "presid-2022-t2": { short: "Prés. 2022 · T2", long: "PRÉSIDENTIELLE 2022 · 2ND TOUR", family: "presidentielle", mailles: ALL_MAILLES },
  "legis-2022-t1": { short: "Légis. 2022 · T1", long: "LÉGISLATIVES 2022 · 1ER TOUR", family: "legislative", mailles: ALL_MAILLES },
  "legis-2022-t2": { short: "Légis. 2022 · T2", long: "LÉGISLATIVES 2022 · 2ND TOUR", family: "legislative", mailles: ALL_MAILLES },
  "legis-2024-t1": { short: "Légis. 2024 · T1", long: "LÉGISLATIVES 2024 · 1ER TOUR", family: "legislative", mailles: ALL_MAILLES },
  "legis-2024-t2": { short: "Légis. 2024 · T2", long: "LÉGISLATIVES 2024 · 2ND TOUR", family: "legislative", mailles: ALL_MAILLES },
  "municipales-2026-t1": { short: "Municip. 2026 · T1", long: "MUNICIPALES 2026 · 1ER TOUR", family: "municipale", mailles: NO_CIRCO },
  "municipales-2026-t2": { short: "Municip. 2026 · T2", long: "MUNICIPALES 2026 · 2ND TOUR", family: "municipale", mailles: NO_CIRCO },
  "sociologie": { short: "Sociologie", long: "INSEE FILOSOFI 2021", family: "sociologie", mailles: ["communes"] },
};

/** Conservé pour compatibilité : { short, long } par scrutin. */
export const SCRUTIN_LABELS: Record<Scrutin, { short: string; long: string }> =
  Object.fromEntries(
    Object.entries(SCRUTIN_META).map(([k, v]) => [k, { short: v.short, long: v.long }]),
  ) as Record<Scrutin, { short: string; long: string }>;

export const COLORATION_LABELS: Record<Coloration, string> = {
  vainqueur: "Vainqueur",
  participation: "Participation",
  abstention: "Abstention",
  revenu: "Revenu médian",
  pauvrete: "Taux de pauvreté",
};

export function isElection(scrutin: Scrutin): boolean {
  return scrutin !== "sociologie";
}

/** Colorations proposées pour un scrutin donné. */
export function colorationsFor(scrutin: Scrutin): Coloration[] {
  return scrutin === "sociologie"
    ? ["revenu", "pauvrete"]
    : ["vainqueur", "participation", "abstention"];
}

/** Mailles couvertes par les données d'un scrutin. */
export function maillesFor(scrutin: Scrutin): Maille[] {
  return SCRUTIN_META[scrutin].mailles;
}

const SCRUTINS = new Set<Scrutin>(Object.keys(SCRUTIN_META) as Scrutin[]);
const COLORATIONS = new Set<Coloration>([
  "vainqueur",
  "participation",
  "abstention",
  "revenu",
  "pauvrete",
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
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { ...state, update };
}
