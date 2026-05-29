"use client";

import { useQuery } from "@tanstack/react-query";
import { inseeUrl, parquetUrl, query } from "@/lib/duckdb";
import type { Maille } from "@/lib/map-config";
import { SCRUTIN_META, isElection, type Scrutin } from "@/lib/url-state";

const FILOSOFI_PARQUET = "filosofi_2021_commune.parquet";
const RP_PARQUET = "rp_2022_commune.parquet";

const aggUrl = (
  scrutin: Scrutin,
  kind: "territoires" | "candidats",
  maille?: Maille,
) =>
  parquetUrl(`agg/${scrutin}${maille === "bureaux" ? "_bureaux" : ""}_${kind}.parquet`);

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
  decile1: number | null;
  decile9: number | null;
  interdecile: number | null;
  partPensions: number | null;
  partPrestations: number | null;
  partChomage: number | null;
  menagesImposes: number | null;
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
      const url = aggUrl(scrutin, "candidats", maille);
      const rows = await query<{ code: string; nuance: string }>(
        `
        WITH s AS (
          SELECT code, nuance, SUM(voix) AS v
          FROM read_parquet('${url}')
          WHERE maille = ? AND nuance IS NOT NULL
          GROUP BY code, nuance
        )
        SELECT code, nuance FROM s
        QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY v DESC) = 1
      `,
        [maille],
      );
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
      const url = aggUrl(scrutin, "territoires", maille);
      const numer = metric === "participation" ? "votants" : "abstentions";
      const rows = await query<{ code: string; value: number }>(
        `
        SELECT code, CAST(${numer} AS DOUBLE) / inscrits AS value
        FROM read_parquet('${url}')
        WHERE maille = ? AND inscrits > 0
      `,
        [maille],
      );
      return rows
        .filter((r) => r.code && Number.isFinite(r.value))
        .map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Détail complet d'un territoire pour un scrutin (chiffres clés + candidats).
 * Fonction pure réutilisable (hors hook) — `maille`/`code` sont liés en
 * paramètres, jamais interpolés (cf. `query`).
 */
export async function fetchScrutinDetail(
  scrutin: Scrutin,
  maille: Maille,
  code: string,
): Promise<ScrutinDetail | null> {
  const terr = aggUrl(scrutin, "territoires", maille);
  const cand = aggUrl(scrutin, "candidats", maille);

  const headerRows = await query<{
    libelle: string | null;
    inscrits: number;
    votants: number;
    exprimes: number;
    abstentions: number;
    blancs: number;
    nuls: number;
  }>(
    `
        SELECT libelle, inscrits, votants, exprimes, abstentions, blancs, nuls
        FROM read_parquet('${terr}')
        WHERE maille = ? AND code = ?
        LIMIT 1
      `,
    [maille, code],
  );
  if (headerRows.length === 0) return null;
  const h = headerRows[0];
  const exprimes = Number(h.exprimes ?? 0);
  const inscrits = Number(h.inscrits ?? 0);

  const candRows = await query<{
    label: string | null;
    nuance: string | null;
    voix: number;
    elu: boolean;
  }>(
    `
        SELECT label, nuance, voix, elu
        FROM read_parquet('${cand}')
        WHERE maille = ? AND code = ? AND voix IS NOT NULL
        ORDER BY voix DESC
      `,
    [maille, code],
  );

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
}

export function useScrutinDetail(
  scrutin: Scrutin | null,
  maille: Maille,
  code: string | null,
) {
  return useQuery({
    enabled: !!scrutin && !!code,
    queryKey: ["scrutin-detail", scrutin, maille, code],
    queryFn: (): Promise<ScrutinDetail | null> =>
      scrutin && code ? fetchScrutinDetail(scrutin, maille, code) : Promise.resolve(null),
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Historique d'une circonscription (tous scrutins couvrant la maille) ──────

export type CircoTimelinePoint = ScrutinDetail & { scrutin: Scrutin };

/**
 * Récupère, pour une circonscription donnée, le détail de chaque scrutin
 * disponible à la maille circonscriptions (présidentielles + législatives),
 * en parallèle. Sert la fiche /circo/[code].
 */
export function useCircoHistory(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["circo-history", code],
    queryFn: async (): Promise<CircoTimelinePoint[]> => {
      if (!code) return [];
      const scrutins = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
        (s) => isElection(s) && SCRUTIN_META[s].mailles.includes("circonscriptions"),
      );
      const results = await Promise.all(
        scrutins.map(async (s) => {
          const detail = await fetchScrutinDetail(s, "circonscriptions", code);
          return detail ? { ...detail, scrutin: s } : null;
        }),
      );
      return results.filter((r): r is CircoTimelinePoint => r !== null);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Historique d'une commune : chaque scrutin disponible à la maille communes
 * (présidentielles + législatives + municipales), lectures en parallèle.
 * Sert la fiche /commune/[insee].
 */
export function useCommuneHistory(insee: string | null) {
  return useQuery({
    enabled: !!insee,
    queryKey: ["commune-history", insee],
    queryFn: async (): Promise<CircoTimelinePoint[]> => {
      if (!insee) return [];
      const scrutins = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
        (s) => isElection(s) && SCRUTIN_META[s].mailles.includes("communes"),
      );
      const results = await Promise.all(
        scrutins.map(async (s) => {
          const detail = await fetchScrutinDetail(s, "communes", insee);
          return detail ? { ...detail, scrutin: s } : null;
        }),
      );
      return results.filter((r): r is CircoTimelinePoint => r !== null);
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

/** Colonnes Filosofi exposables en choroplèthe (liste blanche — jamais d'entrée libre). */
const SOCIO_COLUMNS = [
  "MED_SL", "PR_MD60", "D1_SL", "D9_SL", "IR_D9_D1_SL",
  "S_RET_PEN_DI", "S_SOC_BEN_DI", "S_EI_DI_UNE", "S_HH_TAX",
] as const;
export type SocioColumn = (typeof SOCIO_COLUMNS)[number];

/** Choroplèthe sociologie générique pour une colonne Filosofi par commune. */
export function useSocioColumnCommune(column: SocioColumn, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "socio", column],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(FILOSOFI_PARQUET);
      // Liste blanche : `column` est une union typée, on revérifie par sécurité.
      const col: SocioColumn = SOCIO_COLUMNS.includes(column) ? column : "MED_SL";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${col} AS value
        FROM read_parquet('${url}')
        WHERE ${col} IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

const numOrNull = (v: number | null | undefined) => (v != null ? Number(v) : null);

/** Indicateurs sociologie pour une commune (pour la fiche). */
export function useSociologieCommune(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["sociologie-commune", code],
    queryFn: async (): Promise<CommuneSociologie | null> => {
      if (!code) return null;
      const url = inseeUrl(FILOSOFI_PARQUET);
      const rows = await query<Record<SocioColumn, number | null> & { code: string }>(
        `
        SELECT code, ${SOCIO_COLUMNS.join(", ")}
        FROM read_parquet('${url}')
        WHERE code = ?
      `,
        [code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        code: String(r.code),
        revenuMedian: numOrNull(r.MED_SL),
        tauxPauvrete: numOrNull(r.PR_MD60),
        decile1: numOrNull(r.D1_SL),
        decile9: numOrNull(r.D9_SL),
        interdecile: numOrNull(r.IR_D9_D1_SL),
        partPensions: numOrNull(r.S_RET_PEN_DI),
        partPrestations: numOrNull(r.S_SOC_BEN_DI),
        partChomage: numOrNull(r.S_EI_DI_UNE),
        menagesImposes: numOrNull(r.S_HH_TAX),
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Démographie INSEE (Recensement RP 2022, niveau commune) ──────────────────

export type DemographieCommune = {
  code: string;
  population: number | null;
  part65plus: number | null;
  partMoins15: number | null;
  tauxChomage: number | null;
  partCadres: number | null;
  partOuvriers: number | null;
  partDiplomeSup: number | null;
};

/** Colonnes RP exposables en choroplèthe (liste blanche). */
const RP_COLUMNS = [
  "part65plus", "partMoins15", "tauxChomage",
  "partCadres", "partOuvriers", "partDiplomeSup",
] as const;
export type RpColumn = (typeof RP_COLUMNS)[number];

/** Choroplèthe démographique générique pour une colonne RP par commune. */
export function useRpColumnCommune(column: RpColumn, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["choropleth", "rp", column],
    queryFn: async (): Promise<CommuneNumericRow[]> => {
      const url = inseeUrl(RP_PARQUET);
      const col: RpColumn = RP_COLUMNS.includes(column) ? column : "part65plus";
      const rows = await query<{ code: string; value: number }>(`
        SELECT code, ${col} AS value
        FROM read_parquet('${url}')
        WHERE ${col} IS NOT NULL
      `);
      return rows.map((r) => ({ code: String(r.code), value: Number(r.value) }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Indicateurs démographiques RP pour une commune (pour la fiche). */
export function useDemographieCommune(code: string | null) {
  return useQuery({
    enabled: !!code,
    queryKey: ["demographie-commune", code],
    queryFn: async (): Promise<DemographieCommune | null> => {
      if (!code) return null;
      const url = inseeUrl(RP_PARQUET);
      const rows = await query<Record<string, number | null> & { code: string }>(
        `
        SELECT code, population, part65plus, partMoins15, tauxChomage,
               partCadres, partOuvriers, partDiplomeSup
        FROM read_parquet('${url}')
        WHERE code = ?
      `,
        [code],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        code: String(r.code),
        population: numOrNull(r.population),
        part65plus: numOrNull(r.part65plus),
        partMoins15: numOrNull(r.partMoins15),
        tauxChomage: numOrNull(r.tauxChomage),
        partCadres: numOrNull(r.partCadres),
        partOuvriers: numOrNull(r.partOuvriers),
        partDiplomeSup: numOrNull(r.partDiplomeSup),
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}
