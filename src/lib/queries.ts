"use client";

import { useQuery } from "@tanstack/react-query";
import { inseeUrl, parquetUrl, query } from "@/lib/duckdb";

const CIRCO_PARQUET = "legislatives_2024_t1_circo.parquet";
const PRESID_T1_PARQUET = "presidentielle_2022_t1.parquet";
const FILOSOFI_PARQUET = "filosofi_2021_commune.parquet";
const MAX_CANDIDATS = 19; // largeur max constatée dans le dataset MinInt
const N_PRESID_2022_T1 = 12;
const CODE_SQL = `lpad("Code département", 2, '0') || right("Code circonscription législative", 2)`;
// Code INSEE commune reconstruit depuis le fichier prés. (dept 2-digit pour métropole).
// Limite connue : les DOM (dept ZA/ZB/...) ne matchent pas la maille communes GeoJSON.
const COMMUNE_INSEE_SQL = `"Code du département" || "Code de la commune"`;

/** Convertit "71,20%" → 0.712. */
const PCT_SQL = (col: string) =>
  `TRY_CAST(replace(replace("${col}", '%', ''), ',', '.') AS DOUBLE) / 100`;

/** Construit un UNION ALL qui aplatit les 19 blocs candidats. */
function buildCandidatesUnion(url: string): string {
  const parts = [];
  for (let n = 1; n <= MAX_CANDIDATS; n++) {
    parts.push(`
      SELECT
        ${CODE_SQL} AS code,
        "Nuance candidat ${n}"  AS nuance,
        "Nom candidat ${n}"     AS nom,
        "Prénom candidat ${n}"  AS prenom,
        TRY_CAST(replace("Voix ${n}", ' ', '') AS BIGINT) AS voix,
        ${PCT_SQL(`% Voix/exprimés ${n}`)} AS pct_exp,
        "Elu ${n}" AS elu_flag
      FROM read_parquet('${url}')
      WHERE "Nuance candidat ${n}" IS NOT NULL
    `);
  }
  return parts.join(" UNION ALL ");
}

export type ParticipationRow = { code: string; participation: number };
export type WinningNuanceRow = { code: string; nuance: string };
export type CandidateRow = {
  nom: string;
  prenom: string;
  nuance: string;
  voix: number;
  pct_exp: number;
  elu: boolean;
};
export type CircoDetail = {
  code: string;
  libelle: string;
  departement: string;
  inscrits: number;
  votants: number;
  exprimes: number;
  participation: number;
  candidates: CandidateRow[];
};

/**
 * Taux de participation au 1er tour des législatives 2024, par circonscription.
 * Normalise le code circo au format GeoJSON ("0104" = dpt 01 + circo 04).
 */
export function useParticipationCirco(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "participation", CIRCO_PARQUET],
    queryFn: async (): Promise<ParticipationRow[]> => {
      const url = parquetUrl(CIRCO_PARQUET);
      const rows = await query<{ code: string; participation: number }>(
        `
        SELECT
          ${CODE_SQL} AS code,
          ${PCT_SQL("% Votants")} AS participation
        FROM read_parquet('${url}')
        WHERE "Code circonscription législative" IS NOT NULL
        `,
      );
      return rows
        .filter((r) => r.code && Number.isFinite(r.participation))
        .map((r) => ({ code: r.code, participation: Number(r.participation) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Nuance politique gagnante au T1 par circonscription : on aplatit les 19
 * blocs candidats (UNION ALL) puis on garde le top score par circo via
 * QUALIFY ROW_NUMBER().
 */
export function useWinningNuanceCirco(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "winning-nuance", CIRCO_PARQUET],
    queryFn: async (): Promise<WinningNuanceRow[]> => {
      const url = parquetUrl(CIRCO_PARQUET);
      const sql = `
        WITH candidates AS (
          ${buildCandidatesUnion(url)}
        )
        SELECT code, nuance
        FROM candidates
        WHERE voix IS NOT NULL
        QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY voix DESC) = 1
      `;
      const rows = await query<{ code: string; nuance: string }>(sql);
      return rows.filter((r) => r.code && r.nuance);
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Construit le UNION ALL des 12 blocs candidats pour la présidentielle 2022 T1,
 * en s'appuyant sur les colonnes nommées `Nom_N`, `Voix_N` (générées par le pipeline).
 */
function buildPresid2022T1CandidatesUnion(url: string): string {
  const parts: string[] = [];
  for (let n = 1; n <= N_PRESID_2022_T1; n++) {
    parts.push(`
      SELECT
        ${COMMUNE_INSEE_SQL} AS commune,
        "Nom_${n}" AS nom,
        TRY_CAST(replace("Voix_${n}", ' ', '') AS BIGINT) AS voix
      FROM read_parquet('${url}')
      WHERE "Nom_${n}" IS NOT NULL
    `);
  }
  return parts.join(" UNION ALL ");
}

export type CommuneParticipationRow = { code: string; participation: number };
export type CommuneCandidateRow = { code: string; candidate: string };
export type CommuneNumericRow = { code: string; value: number };
export type CommuneSociologie = {
  code: string;
  revenuMedian: number | null;
  tauxPauvrete: number | null;
};
export type CommuneDetail = {
  code: string;
  libelle: string;
  inscrits: number;
  votants: number;
  exprimes: number;
  participation: number;
  candidates: { nom: string; voix: number; pct: number }[];
};

/**
 * Détail présidentielle 2022 (1er tour) pour une commune : chiffres clés +
 * tous les candidats agrégés depuis les bureaux de vote de la commune.
 */
export function useCommuneDetail(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["commune-detail-presid", code],
    queryFn: async (): Promise<CommuneDetail | null> => {
      if (!code) return null;
      const url = parquetUrl(PRESID_T1_PARQUET);

      const headerRows = await query<{
        libelle: string;
        inscrits: number;
        votants: number;
        exprimes: number;
      }>(`
        SELECT
          any_value("Libellé de la commune") AS libelle,
          SUM(TRY_CAST(replace("Inscrits", ' ', '') AS BIGINT)) AS inscrits,
          SUM(TRY_CAST(replace("Votants",  ' ', '') AS BIGINT)) AS votants,
          SUM(TRY_CAST(replace("Exprimés", ' ', '') AS BIGINT)) AS exprimes
        FROM read_parquet('${url}')
        WHERE ${COMMUNE_INSEE_SQL} = '${code}'
      `);
      if (headerRows.length === 0 || !headerRows[0].inscrits) return null;
      const h = headerRows[0];
      const exprimes = Number(h.exprimes ?? 0);

      const candRows = await query<{ nom: string; voix: number }>(`
        WITH bureau AS (${buildPresid2022T1CandidatesUnion(url)}),
        agg AS (
          SELECT nom, SUM(voix) AS voix
          FROM bureau
          WHERE commune = '${code}'
          GROUP BY nom
        )
        SELECT nom, voix FROM agg WHERE voix IS NOT NULL ORDER BY voix DESC
      `);

      return {
        code,
        libelle: String(h.libelle ?? ""),
        inscrits: Number(h.inscrits ?? 0),
        votants: Number(h.votants ?? 0),
        exprimes,
        participation:
          Number(h.inscrits) > 0 ? Number(h.votants) / Number(h.inscrits) : 0,
        candidates: candRows.map((c) => ({
          nom: String(c.nom ?? ""),
          voix: Number(c.voix ?? 0),
          pct: exprimes > 0 ? Number(c.voix) / exprimes : 0,
        })),
      };
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Participation présidentielle 2022 T1 — agrégée à la commune. */
export function useParticipationCommunePresid2022T1(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "participation-presid-2022-t1-commune"],
    queryFn: async (): Promise<CommuneParticipationRow[]> => {
      const url = parquetUrl(PRESID_T1_PARQUET);
      const rows = await query<{
        code: string;
        votants: number;
        inscrits: number;
      }>(`
        SELECT
          ${COMMUNE_INSEE_SQL} AS code,
          SUM(TRY_CAST(replace("Inscrits", ' ', '') AS BIGINT)) AS inscrits,
          SUM(TRY_CAST(replace("Votants",  ' ', '') AS BIGINT)) AS votants
        FROM read_parquet('${url}')
        GROUP BY code
        HAVING inscrits > 0
      `);
      return rows.map((r) => ({
        code: String(r.code),
        participation: Number(r.votants) / Number(r.inscrits),
      }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Vote dominant présidentielle 2022 T1 — agrégé à la commune. */
export function useWinningCandidateCommunePresid2022T1(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "winning-presid-2022-t1-commune"],
    queryFn: async (): Promise<CommuneCandidateRow[]> => {
      const url = parquetUrl(PRESID_T1_PARQUET);
      const sql = `
        WITH bureau AS (${buildPresid2022T1CandidatesUnion(url)}),
        commune_sum AS (
          SELECT commune, nom, SUM(voix) AS voix
          FROM bureau
          GROUP BY commune, nom
        )
        SELECT commune AS code, nom AS candidate
        FROM commune_sum
        WHERE voix IS NOT NULL
        QUALIFY ROW_NUMBER() OVER (PARTITION BY commune ORDER BY voix DESC) = 1
      `;
      const rows = await query<{ code: string; candidate: string }>(sql);
      return rows
        .filter((r) => r.code && r.candidate)
        .map((r) => ({ code: String(r.code), candidate: String(r.candidate) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie INSEE (Filosofi 2021, niveau commune) ─────────────────────────

/** Niveau de vie médian (en €) par commune — indicateur Filosofi MED_SL. */
export function useRevenuMedianCommune(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "revenu-median-commune"],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, MED_SL AS value
        FROM read_parquet('${url}')
        WHERE MED_SL IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Taux de pauvreté (en %, seuil 60% médiane) par commune — indicateur PR_MD60. */
export function useTauxPauvreteCommune(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "taux-pauvrete-commune"],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, PR_MD60 AS value
        FROM read_parquet('${url}')
        WHERE PR_MD60 IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Récupère les 2 indicateurs sociologie pour une commune donnée (pour la fiche). */
export function useSociologieCommune(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["sociologie-commune", code],
    queryFn: async (): Promise<CommuneSociologie | null> => {
      if (!code) return null;
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<{
        code: string;
        MED_SL: number | null;
        PR_MD60: number | null;
      }>(`
        SELECT code, MED_SL, PR_MD60
        FROM read_parquet('${url}')
        WHERE code = '${code}'
      `);
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        code: String(r.code),
        revenuMedian: r.MED_SL != null ? Number(r.MED_SL) : null,
        tauxPauvrete: r.PR_MD60 != null ? Number(r.PR_MD60) : null,
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Détail complet d'une circonscription (chiffres clés + tous les candidats). */
export function useCircoDetail(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["circo-detail", code, CIRCO_PARQUET],
    queryFn: async (): Promise<CircoDetail | null> => {
      if (!code) return null;
      const url = parquetUrl(CIRCO_PARQUET);
      const headerRows = await query<{
        code: string;
        libelle: string;
        departement: string;
        inscrits: number;
        votants: number;
        exprimes: number;
        participation: number;
      }>(`
        SELECT
          ${CODE_SQL} AS code,
          "Libellé circonscription législative" AS libelle,
          "Libellé département" AS departement,
          TRY_CAST(replace("Inscrits", ' ', '') AS BIGINT) AS inscrits,
          TRY_CAST(replace("Votants",  ' ', '') AS BIGINT) AS votants,
          TRY_CAST(replace("Exprimés", ' ', '') AS BIGINT) AS exprimes,
          ${PCT_SQL("% Votants")} AS participation
        FROM read_parquet('${url}')
        WHERE ${CODE_SQL} = '${code}'
      `);
      if (headerRows.length === 0) return null;
      const header = headerRows[0];

      const candRows = await query<{
        nom: string;
        prenom: string;
        nuance: string;
        voix: number;
        pct_exp: number;
        elu_flag: string | null;
      }>(`
        WITH candidates AS (${buildCandidatesUnion(url)})
        SELECT nom, prenom, nuance, voix, pct_exp, elu_flag
        FROM candidates
        WHERE code = '${code}' AND voix IS NOT NULL
        ORDER BY voix DESC
      `);

      return {
        code: String(header.code),
        libelle: String(header.libelle ?? ""),
        departement: String(header.departement ?? ""),
        inscrits: Number(header.inscrits ?? 0),
        votants: Number(header.votants ?? 0),
        exprimes: Number(header.exprimes ?? 0),
        participation: Number(header.participation ?? 0),
        candidates: candRows.map((c) => ({
          nom: String(c.nom ?? ""),
          prenom: String(c.prenom ?? ""),
          nuance: String(c.nuance ?? ""),
          voix: Number(c.voix ?? 0),
          pct_exp: Number(c.pct_exp ?? 0),
          elu: c.elu_flag != null && String(c.elu_flag).trim() !== "",
        })),
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}
