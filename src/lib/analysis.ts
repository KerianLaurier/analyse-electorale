"use client";

import { useQuery } from "@tanstack/react-query";
import { inseeUrl, parquetUrl, query } from "@/lib/duckdb";
import type { Maille } from "@/lib/map-config";
import type { Scrutin } from "@/lib/url-state";

const aggUrl = (scrutin: Scrutin, kind: "territoires" | "candidats", maille?: Maille) =>
  parquetUrl(`agg/${scrutin}${maille === "bureaux" ? "_bureaux" : ""}_${kind}.parquet`);

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
      const terr = aggUrl(scrutin, "territoires", maille);
      const cand = aggUrl(scrutin, "candidats", maille);
      const blocCodes = codes ?? [];
      const inList = blocCodes.map(() => "?").join(", ");
      const rows = await query<{ code: string; libelle: string | null; value: number }>(
        `
        WITH terr AS (
          SELECT code, any_value(libelle) AS libelle, SUM(exprimes) AS exprimes
          FROM read_parquet('${terr}')
          WHERE maille = ?
          GROUP BY code
          HAVING SUM(exprimes) > 0
        ),
        bloc AS (
          SELECT code, SUM(voix) AS v
          FROM read_parquet('${cand}')
          WHERE maille = ? AND nuance IN (${inList})
          GROUP BY code
        )
        SELECT t.code, t.libelle,
               CAST(COALESCE(b.v, 0) AS DOUBLE) / t.exprimes AS value
        FROM terr t LEFT JOIN bloc b USING (code)
      `,
        [maille, maille, ...blocCodes],
      );
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
      const terr = aggUrl(scrutin, "territoires", maille);
      const rows = await query<{ code: string; libelle: string | null; value: number }>(
        `
        SELECT code, any_value(libelle) AS libelle,
               CAST(SUM(votants) AS DOUBLE) / SUM(inscrits) AS value
        FROM read_parquet('${terr}')
        WHERE maille = ?
        GROUP BY code
        HAVING SUM(inscrits) > 0
      `,
        [maille],
      );
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
      const terr = aggUrl(scrutin, "territoires", maille);
      const cand = aggUrl(scrutin, "candidats", maille);
      const rows = await query<{ code: string; libelle: string | null; nuance: string }>(
        `
        WITH s AS (
          SELECT code, nuance, SUM(voix) AS v
          FROM read_parquet('${cand}')
          WHERE maille = ? AND nuance IS NOT NULL
          GROUP BY code, nuance
          QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY v DESC) = 1
        ),
        terr AS (
          SELECT code, any_value(libelle) AS libelle
          FROM read_parquet('${terr}') WHERE maille = ? GROUP BY code
        )
        SELECT s.code, t.libelle, s.nuance
        FROM s LEFT JOIN terr t USING (code)
      `,
        [maille, maille],
      );
      return rows
        .filter((r) => r.code && r.nuance)
        .map((r) => ({ code: String(r.code), libelle: r.libelle ?? null, nuance: String(r.nuance) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie & démographie commune (catalogue) pour la corrélation ─────────

const RP_PARQUET = "rp_2022_commune.parquet";

export type SocioIndicator =
  | "revenu" | "pauvrete" | "inegalites" | "prestations" | "pensions"
  | "age65" | "chomage" | "cadres" | "ouvriers" | "diplome";

export type SocioUnit = "euro" | "pct" | "ratio";

type SocioMeta = {
  id: SocioIndicator;
  label: string;
  source: "filosofi" | "rp";
  column: string;
  unit: SocioUnit;
};

/** Catalogue des indicateurs croisables avec le vote (liste blanche de colonnes). */
export const SOCIO_INDICATORS: SocioMeta[] = [
  { id: "revenu", label: "Revenu médian", source: "filosofi", column: "MED_SL", unit: "euro" },
  { id: "pauvrete", label: "Taux de pauvreté", source: "filosofi", column: "PR_MD60", unit: "pct" },
  { id: "inegalites", label: "Inégalités (D9/D1)", source: "filosofi", column: "IR_D9_D1_SL", unit: "ratio" },
  { id: "prestations", label: "Prestations sociales", source: "filosofi", column: "S_SOC_BEN_DI", unit: "pct" },
  { id: "pensions", label: "Pensions / retraites", source: "filosofi", column: "S_RET_PEN_DI", unit: "pct" },
  { id: "age65", label: "Part des 65 ans +", source: "rp", column: "part65plus", unit: "pct" },
  { id: "chomage", label: "Taux de chômage", source: "rp", column: "tauxChomage", unit: "pct" },
  { id: "cadres", label: "Part de cadres", source: "rp", column: "partCadres", unit: "pct" },
  { id: "ouvriers", label: "Part d'ouvriers", source: "rp", column: "partOuvriers", unit: "pct" },
  { id: "diplome", label: "Diplômés du supérieur", source: "rp", column: "partDiplomeSup", unit: "pct" },
];

export function socioMeta(id: SocioIndicator): SocioMeta {
  return SOCIO_INDICATORS.find((s) => s.id === id) ?? SOCIO_INDICATORS[0];
}

export function useSocioByCommune(indicator: SocioIndicator, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["analysis-socio", indicator],
    queryFn: async (): Promise<Map<string, number>> => {
      const meta = socioMeta(indicator);
      const url = inseeUrl(meta.source === "rp" ? RP_PARQUET : FILOSOFI_PARQUET);
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${meta.column} AS value
        FROM read_parquet('${url}')
        WHERE ${meta.column} IS NOT NULL
      `);
      const m = new Map<string, number>();
      for (const r of rows) m.set(String(r.code), Number(r.value));
      return m;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ─── Marginalité : circonscriptions les plus disputées (écart 1er / 2e) ────────

export type MarginRow = {
  code: string;
  libelle: string | null;
  leader: string;
  leaderNuance: string;
  runnerNuance: string | null;
  leaderPct: number;
  marginPts: number; // (voix1 - voix2) / exprimés
};

export function useMarginalite(scrutin: Scrutin, maille: Maille = "circonscriptions", enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["marginalite", scrutin, maille],
    queryFn: async (): Promise<MarginRow[]> => {
      const terr = aggUrl(scrutin, "territoires", maille);
      const cand = aggUrl(scrutin, "candidats", maille);
      const rows = await query<{
        code: string;
        libelle: string | null;
        leader: string | null;
        leaderNuance: string | null;
        runnerNuance: string | null;
        leaderPct: number;
        marginPts: number;
      }>(
        `
        WITH top AS (
          SELECT code, label, nuance, voix,
                 ROW_NUMBER() OVER (PARTITION BY code ORDER BY voix DESC) AS rn
          FROM read_parquet('${cand}')
          WHERE maille = ? AND voix IS NOT NULL
          QUALIFY rn <= 2
        ),
        piv AS (
          SELECT code,
            MAX(CASE WHEN rn = 1 THEN voix END) AS v1,
            MAX(CASE WHEN rn = 1 THEN label END) AS l1,
            MAX(CASE WHEN rn = 1 THEN nuance END) AS n1,
            MAX(CASE WHEN rn = 2 THEN voix END) AS v2,
            MAX(CASE WHEN rn = 2 THEN nuance END) AS n2
          FROM top GROUP BY code
        ),
        terr AS (
          SELECT code, any_value(libelle) AS libelle, SUM(exprimes) AS exp
          FROM read_parquet('${terr}') WHERE maille = ? GROUP BY code
        )
        SELECT p.code, t.libelle, p.l1 AS leader, p.n1 AS leaderNuance, p.n2 AS runnerNuance,
               CAST(p.v1 AS DOUBLE) / t.exp AS leaderPct,
               CAST(p.v1 - COALESCE(p.v2, 0) AS DOUBLE) / t.exp AS marginPts
        FROM piv p JOIN terr t USING (code)
        WHERE t.exp > 0 AND p.v1 IS NOT NULL
        ORDER BY marginPts ASC
      `,
        [maille, maille],
      );
      return rows.map((r) => ({
        code: String(r.code),
        libelle: r.libelle ?? null,
        leader: r.leader ?? "",
        leaderNuance: r.leaderNuance ?? "",
        runnerNuance: r.runnerNuance ?? null,
        leaderPct: Number(r.leaderPct),
        marginPts: Number(r.marginPts),
      }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Matrice circo × bloc (pour le simulateur de report) ───────────────────────

export type CircoBlocRow = {
  code: string;
  libelle: string | null;
  exp: number;
  shares: Record<BlocId, number>;
};
export type CircoBlocMatrix = {
  circos: CircoBlocRow[];
  national: Record<BlocId, number>;
};

export function useCircoBlocMatrix(scrutin: Scrutin, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["circo-bloc-matrix", scrutin],
    queryFn: async (): Promise<CircoBlocMatrix> => {
      const terr = aggUrl(scrutin, "territoires");
      const cand = aggUrl(scrutin, "candidats");
      const sums = BLOCS.map((b) => {
        const inList = b.codes.map((c) => `'${c}'`).join(", ");
        return `SUM(CASE WHEN nuance IN (${inList}) THEN voix ELSE 0 END) AS "${b.id}"`;
      }).join(",\n");
      const rows = await query<Record<string, number | string | null>>(`
        WITH bloc AS (
          SELECT code, ${sums}
          FROM read_parquet('${cand}')
          WHERE maille = 'circonscriptions' AND voix IS NOT NULL
          GROUP BY code
        ),
        terr AS (
          SELECT code, any_value(libelle) AS libelle, SUM(exprimes) AS exp
          FROM read_parquet('${terr}') WHERE maille = 'circonscriptions' GROUP BY code
        )
        SELECT t.code, t.libelle, t.exp, ${BLOCS.map((b) => `b."${b.id}"`).join(", ")}
        FROM terr t JOIN bloc b USING (code)
        WHERE t.exp > 0
      `);
      const circos: CircoBlocRow[] = [];
      const totals: Record<string, number> = {};
      let totalExp = 0;
      for (const r of rows) {
        const exp = Number(r.exp);
        const shares = {} as Record<BlocId, number>;
        for (const b of BLOCS) {
          const v = Number(r[b.id] ?? 0);
          shares[b.id] = exp > 0 ? v / exp : 0;
          totals[b.id] = (totals[b.id] ?? 0) + v;
        }
        totalExp += exp;
        circos.push({ code: String(r.code), libelle: (r.libelle as string) ?? null, exp, shares });
      }
      const national = {} as Record<BlocId, number>;
      for (const b of BLOCS) national[b.id] = totalExp > 0 ? (totals[b.id] ?? 0) / totalExp : 0;
      return { circos, national };
    },
    staleTime: 60 * 60 * 1000,
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
