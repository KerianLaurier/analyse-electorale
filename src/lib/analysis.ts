"use client";

import { useQuery } from "@tanstack/react-query";
import { inseeUrl, parquetUrl, query } from "@/lib/duckdb";
import type { Maille } from "@/lib/map-config";
import type { Scrutin } from "@/lib/url-state";

const aggUrl = (scrutin: Scrutin, kind: "territoires" | "candidats") =>
  parquetUrl(`agg/${scrutin}_${kind}.parquet`);

const FILOSOFI_PARQUET = "filosofi_2021_commune.parquet";

// ─── Blocs politiques (regroupements de nuances comparables entre scrutins) ───
// Chaque bloc agrège les codes de nuance équivalents (présidentielle, légis. et
// listes municipales préfixées « L ») pour permettre une comparaison cohérente
// d'un scrutin à l'autre.

export type BlocId = "rn" | "gauche" | "centre" | "droite" | "ecolo";

export const BLOCS: { id: BlocId; label: string; color: string; codes: string[] }[] = [
  {
    id: "rn",
    label: "RN / extrême droite",
    color: "#13294b",
    codes: ["RN", "UXD", "REC", "EXD", "DSV", "DLF", "LRN", "LUXD", "LREC", "LEXD", "LDSV"],
  },
  {
    id: "gauche",
    label: "Gauche / NFP",
    color: "#dc2626",
    codes: [
      "EXG", "DXG", "COM", "FI", "SOC", "RDG", "DVG", "UG", "NUP",
      "LEXG", "LCOM", "LFI", "LSOC", "LRDG", "LDVG", "LUG",
    ],
  },
  {
    id: "ecolo",
    label: "Écologistes",
    color: "#16a34a",
    codes: ["ECO", "VEC", "LECO", "LVEC"],
  },
  {
    id: "centre",
    label: "Centre / majorité",
    color: "#f59e0b",
    codes: ["ENS", "MDM", "HOR", "DVC", "UDI", "UC", "UDC", "LREN", "LMDM", "LHOR", "LDVC", "LUDI", "LUC"],
  },
  {
    id: "droite",
    label: "Droite (LR)",
    color: "#1e40af",
    codes: ["LR", "DVD", "LLR", "LUD", "LUDR", "LDVD"],
  },
];

export function blocById(id: BlocId) {
  return BLOCS.find((b) => b.id === id) ?? BLOCS[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TerritoryValue = { code: string; libelle: string | null; value: number };
export type TerritoryWinner = { code: string; libelle: string | null; nuance: string };

// ─── Part d'un bloc (voix du bloc / exprimés) par territoire ───────────────────

export function useBlocShare(
  scrutin: Scrutin,
  maille: Maille,
  codes: string[] | null,
  enabled = true,
) {
  const codeKey = codes ? codes.join(",") : "";
  return useQuery({
    enabled: enabled && !!codes && codes.length > 0,
    queryKey: ["bloc-share", scrutin, maille, codeKey],
    queryFn: async (): Promise<TerritoryValue[]> => {
      const terr = aggUrl(scrutin, "territoires");
      const cand = aggUrl(scrutin, "candidats");
      const inList = (codes ?? []).map((c) => `'${c}'`).join(", ");
      const rows = await query<{ code: string; libelle: string | null; value: number }>(`
        WITH terr AS (
          SELECT code, any_value(libelle) AS libelle, SUM(exprimes) AS exprimes
          FROM read_parquet('${terr}')
          WHERE maille = '${maille}'
          GROUP BY code
          HAVING SUM(exprimes) > 0
        ),
        bloc AS (
          SELECT code, SUM(voix) AS v
          FROM read_parquet('${cand}')
          WHERE maille = '${maille}' AND nuance IN (${inList})
          GROUP BY code
        )
        SELECT t.code, t.libelle,
               CAST(COALESCE(b.v, 0) AS DOUBLE) / t.exprimes AS value
        FROM terr t LEFT JOIN bloc b USING (code)
      `);
      return rows.map((r) => ({
        code: String(r.code),
        libelle: r.libelle ?? null,
        value: Number(r.value),
      }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Participation par territoire ──────────────────────────────────────────────

export function useParticipationByMaille(scrutin: Scrutin, maille: Maille, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["analysis-participation", scrutin, maille],
    queryFn: async (): Promise<TerritoryValue[]> => {
      const terr = aggUrl(scrutin, "territoires");
      const rows = await query<{ code: string; libelle: string | null; value: number }>(`
        SELECT code, any_value(libelle) AS libelle,
               CAST(SUM(votants) AS DOUBLE) / SUM(inscrits) AS value
        FROM read_parquet('${terr}')
        WHERE maille = '${maille}'
        GROUP BY code
        HAVING SUM(inscrits) > 0
      `);
      return rows.map((r) => ({
        code: String(r.code),
        libelle: r.libelle ?? null,
        value: Number(r.value),
      }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Nuance gagnante par territoire (pour les bascules) ────────────────────────

export function useWinnerByMaille(scrutin: Scrutin, maille: Maille, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["analysis-winner", scrutin, maille],
    queryFn: async (): Promise<TerritoryWinner[]> => {
      const terr = aggUrl(scrutin, "territoires");
      const cand = aggUrl(scrutin, "candidats");
      const rows = await query<{ code: string; libelle: string | null; nuance: string }>(`
        WITH s AS (
          SELECT code, nuance, SUM(voix) AS v
          FROM read_parquet('${cand}')
          WHERE maille = '${maille}' AND nuance IS NOT NULL
          GROUP BY code, nuance
          QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY v DESC) = 1
        ),
        terr AS (
          SELECT code, any_value(libelle) AS libelle
          FROM read_parquet('${terr}') WHERE maille = '${maille}' GROUP BY code
        )
        SELECT s.code, t.libelle, s.nuance
        FROM s LEFT JOIN terr t USING (code)
      `);
      return rows
        .filter((r) => r.code && r.nuance)
        .map((r) => ({ code: String(r.code), libelle: r.libelle ?? null, nuance: String(r.nuance) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie commune (revenu / pauvreté) pour la corrélation ────────────────

export type SocioIndicator = "revenu" | "pauvrete";

export function useSocioByCommune(indicator: SocioIndicator, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["analysis-socio", indicator],
    queryFn: async (): Promise<Map<string, number>> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      const col = indicator === "revenu" ? "MED_SL" : "PR_MD60";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${col} AS value
        FROM read_parquet('${url}')
        WHERE ${col} IS NOT NULL
      `);
      const m = new Map<string, number>();
      for (const r of rows) m.set(String(r.code), Number(r.value));
      return m;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ─── Pearson ───────────────────────────────────────────────────────────────────

export function pearson(pairs: Array<[number, number]>): number {
  const n = pairs.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) {
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const dx = Math.sqrt(n * sxx - sx * sx);
  const dy = Math.sqrt(n * syy - sy * sy);
  if (dx === 0 || dy === 0) return 0;
  return cov / (dx * dy);
}
