"use client";

import { useQuery } from "@tanstack/react-query";
import { inseeUrl, parquetUrl, query } from "@/lib/duckdb";
import type { Maille } from "@/lib/map-config";
import type { Scrutin } from "@/lib/url-state";

const FILOSOFI_PARQUET = "filosofi_2021_commune.parquet";

const aggUrl = (scrutin: Scrutin, kind: "territoires" | "candidats") =>
  parquetUrl(`agg/${scrutin}_${kind}.parquet`);

// ─── Types partagés ───────────────────────────────────────────────────────────

export type WinningNuanceRow = { code: string; nuance: string };
export type NumericRow = { code: string; value: number };
export type CommuneNumericRow = NumericRow;

export type ScrutinCandidate = {
  label: string;
  nuance: string | null;
  voix: number;
  pct: number;
  elu: boolean;
};

export type ScrutinDetail = {
  code: string;
  libelle: string | null;
  inscrits: number;
  votants: number;
  exprimes: number;
  abstentions: number;
  blancs: number;
  nuls: number;
  participation: number;
  candidates: ScrutinCandidate[];
};

export type CommuneSociologie = {
  code: string;
  revenuMedian: number | null;
  tauxPauvrete: number | null;
};

// ─── Choroplèthes électorales (génériques, lisent les agrégats) ───────────────

/**
 * Nuance gagnante par territoire pour un scrutin × maille donné.
 * On somme les voix par nuance (gère le cas où plusieurs candidats partagent
 * une nuance, ex. extrême gauche en présidentielle) puis on garde le top.
 */
export function useScrutinWinner(scrutin: Scrutin, maille: Maille, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["scrutin-winner", scrutin, maille],
    queryFn: async (): Promise<WinningNuanceRow[]> => {
      const url = aggUrl(scrutin, "candidats");
      const rows = await query<{ code: string; nuance: string }>(`
        WITH s AS (
          SELECT code, nuance, SUM(voix) AS v
          FROM read_parquet('${url}')
          WHERE maille = '${maille}' AND nuance IS NOT NULL
          GROUP BY code, nuance
        )
        SELECT code, nuance FROM s
        QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY v DESC) = 1
      `);
      return rows.filter((r) => r.code && r.nuance);
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Participation ou abstention (rapport sur inscrits) par territoire. */
export function useScrutinMetric(
  scrutin: Scrutin,
  maille: Maille,
  metric: "participation" | "abstention",
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: ["scrutin-metric", scrutin, maille, metric],
    queryFn: async (): Promise<NumericRow[]> => {
      const url = aggUrl(scrutin, "territoires");
      const numer = metric === "participation" ? "votants" : "abstentions";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, CAST(${numer} AS DOUBLE) / inscrits AS value
        FROM read_parquet('${url}')
        WHERE maille = '${maille}' AND inscrits > 0
      `);
      return rows
        .filter((r) => r.code && Number.isFinite(r.value))
        .map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Détail complet d'un territoire pour un scrutin (chiffres clés + candidats). */
export function useScrutinDetail(
  scrutin: Scrutin | null,
  maille: Maille,
  code: string | null,
) {
  return useQuery({
    enabled: !!scrutin && !!code,
    queryKey: ["scrutin-detail", scrutin, maille, code],
    queryFn: async (): Promise<ScrutinDetail | null> => {
      if (!scrutin || !code) return null;
      const terr = aggUrl(scrutin, "territoires");
      const cand = aggUrl(scrutin, "candidats");

      const headerRows = await query<{
        libelle: string | null;
        inscrits: number;
        votants: number;
        exprimes: number;
        abstentions: number;
        blancs: number;
        nuls: number;
      }>(`
        SELECT libelle, inscrits, votants, exprimes, abstentions, blancs, nuls
        FROM read_parquet('${terr}')
        WHERE maille = '${maille}' AND code = '${code}'
        LIMIT 1
      `);
      if (headerRows.length === 0) return null;
      const h = headerRows[0];
      const exprimes = Number(h.exprimes ?? 0);
      const inscrits = Number(h.inscrits ?? 0);

      const candRows = await query<{
        label: string | null;
        nuance: string | null;
        voix: number;
        elu: boolean;
      }>(`
        SELECT label, nuance, voix, elu
        FROM read_parquet('${cand}')
        WHERE maille = '${maille}' AND code = '${code}' AND voix IS NOT NULL
        ORDER BY voix DESC
      `);

      return {
        code,
        libelle: h.libelle ?? null,
        inscrits,
        votants: Number(h.votants ?? 0),
        exprimes,
        abstentions: Number(h.abstentions ?? 0),
        blancs: Number(h.blancs ?? 0),
        nuls: Number(h.nuls ?? 0),
        participation: inscrits > 0 ? Number(h.votants) / inscrits : 0,
        candidates: candRows.map((c) => ({
          label: c.label ?? "",
          nuance: c.nuance ?? null,
          voix: Number(c.voix ?? 0),
          pct: exprimes > 0 ? Number(c.voix) / exprimes : 0,
          elu: Boolean(c.elu),
        })),
      };
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Participation nationale (métropole) d'un scrutin — pour les comparaisons. */
export function useScrutinNationalParticipation(scrutin: Scrutin | null, enabled = true) {
  return useQuery({
    enabled: enabled && !!scrutin,
    queryKey: ["scrutin-national-participation", scrutin],
    queryFn: async (): Promise<number | null> => {
      if (!scrutin) return null;
      const url = aggUrl(scrutin, "territoires");
      const rows = await query<{ value: number }>(`
        SELECT CAST(SUM(votants) AS DOUBLE) / SUM(inscrits) AS value
        FROM read_parquet('${url}')
        WHERE maille = 'departements' AND inscrits > 0
      `);
      const v = rows[0]?.value;
      return v != null && Number.isFinite(v) ? Number(v) : null;
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie INSEE (Filosofi 2021, niveau commune) ─────────────────────────

/** Niveau de vie médian (€) par commune — indicateur Filosofi MED_SL. */
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

/** Taux de pauvreté (%, seuil 60% médiane) par commune — indicateur PR_MD60. */
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

/** Indicateurs sociologie pour une commune (pour la fiche). */
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
