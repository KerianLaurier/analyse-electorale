"use client";

import { useQuery } from "@tanstack/react-query";
import { dataUrl } from "@/lib/data-url";
import type { Maille } from "@/lib/map-config";
import { SCRUTIN_META, SCRUTINS_CHRONO, isElection, parseScrutin, type Scrutin } from "@/lib/url-state";
import {
  fetchScrutinDetail,
  type ScrutinDetail,
} from "@/lib/queries";
import {
  BLOCS,
  SOCIO_INDICATORS,
  ridgeResiduals,
  useCircoBlocMatrix,
  useSocioFeaturesCirco,
  type BlocId,
  type SocioIndicator,
  type SocioUnit,
} from "@/lib/analysis";
import { blocSharesFromCandidates, type BlocSharesFull } from "@/lib/projection";
import { deptFromInsee } from "@/lib/territoire";

// ─── Territoire analysable (les 4 mailles de l'index de recherche) ────────────

export type TerritoryType = "region" | "departement" | "circo" | "commune";

export const TERRITORY_MAILLE: Record<TerritoryType, Maille> = {
  region: "regions",
  departement: "departements",
  circo: "circonscriptions",
  commune: "communes",
};

export const TERRITORY_LABELS: Record<TerritoryType, string> = {
  region: "Région",
  departement: "Département",
  circo: "Circonscription",
  commune: "Commune",
};

/** Nuance → bloc (index partagé par toutes les analyses de l'onglet). */
export const NUANCE_TO_BLOC = new Map<string, BlocId>();
for (const b of BLOCS) for (const c of b.codes) NUANCE_TO_BLOC.set(c, b.id);

/** Ordre chronologique des scrutins disponibles (ancien → récent). */
export const CHRONO: Scrutin[] = SCRUTINS_CHRONO;

export type TerritoryPoint = ScrutinDetail & { scrutin: Scrutin };

/**
 * Historique électoral complet d'un territoire, quelle que soit sa maille :
 * détail de chaque scrutin couvrant la maille, dans l'ordre chronologique.
 */
export function useTerritoryHistory(type: TerritoryType | null, code: string | null) {
  const maille = type ? TERRITORY_MAILLE[type] : null;
  return useQuery({
    enabled: !!maille && !!code,
    queryKey: ["territory-analysis-history", maille, code],
    queryFn: async (): Promise<TerritoryPoint[]> => {
      const scrutins = CHRONO.filter(
        (s) => isElection(s) && SCRUTIN_META[s].mailles.includes(maille as Maille),
      );
      const results = await Promise.all(
        scrutins.map(async (s) => {
          const detail = await fetchScrutinDetail(s, maille as Maille, code as string);
          return detail ? { ...detail, scrutin: s } : null;
        }),
      );
      return results.filter((r): r is TerritoryPoint => r !== null);
    },
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Baseline nationale par bloc (pour le swing et la projection nationale) ────

// Scrutins de 1er tour utilisés pour les tendances nationales par famille.
export const NATIONAL_SCRUTINS: Scrutin[] = [
  "presid-2017-t1", "presid-2022-t1",
  "legis-2017-t1", "legis-2022-t1", "legis-2024-t1",
];

type DetailEntry = {
  l: string | null;
  i: number; v: number; e: number; a: number; b: number; n: number;
  c: [string | null, string | null, number, number][];
};

const jsonCache = new Map<string, Promise<unknown | null>>();
function loadJson<T>(path: string): Promise<T | null> {
  let p = jsonCache.get(path);
  if (!p) {
    p = fetch(dataUrl(path))
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null);
    jsonCache.set(path, p);
  }
  return p as Promise<T | null>;
}

export type NationalPoint = {
  scrutin: Scrutin;
  year: number;
  shares: BlocSharesFull;
  exprimes: number;
};

/**
 * Parts nationales par bloc pour les 1ers tours présidentiels et législatifs :
 * somme des voix par nuance sur les 18 régions (fichier détail régions).
 */
export function useNationalBlocHistory() {
  return useQuery({
    queryKey: ["national-bloc-history"],
    queryFn: async (): Promise<NationalPoint[]> => {
      const results = await Promise.all(
        NATIONAL_SCRUTINS.map(async (scrutin) => {
          const data = await loadJson<Record<string, DetailEntry>>(
            `/electoral/detail/${scrutin}_regions.json`,
          );
          if (!data) return null;
          let exprimes = 0;
          const byNuance = new Map<string, number>();
          for (const t of Object.values(data)) {
            exprimes += t.e;
            for (const [, nuance, voix] of t.c) {
              if (!nuance) continue;
              byNuance.set(nuance, (byNuance.get(nuance) ?? 0) + voix);
            }
          }
          if (!(exprimes > 0)) return null;
          const candidates = [...byNuance.entries()].map(([nuance, voix]) => ({
            nuance,
            pct: voix / exprimes,
          }));
          const shares = blocSharesFromCandidates(candidates, NUANCE_TO_BLOC);
          const { year } = parseScrutin(scrutin);
          return { scrutin, year: year ?? 0, shares, exprimes };
        }),
      );
      return results.filter((r): r is NationalPoint => r !== null);
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Profil sociologique vs national, pour les 4 mailles ──────────────────────

export type SocioProfileRow = {
  id: SocioIndicator;
  label: string;
  unit: SocioUnit;
  value: number;
  national: number;
};

type ColumnFile = Record<string, Record<string, number>>;

/** Région d'appartenance de chaque département (référentiel INSEE 2016, stable). */
export const REGION_OF_DEPT: Record<string, string> = {
  "01": "84", "02": "32", "03": "84", "04": "93", "05": "93", "06": "93",
  "07": "84", "08": "44", "09": "76", "10": "44", "11": "76", "12": "76",
  "13": "93", "14": "28", "15": "84", "16": "75", "17": "75", "18": "24",
  "19": "75", "2A": "94", "2B": "94", "21": "27", "22": "53", "23": "75",
  "24": "75", "25": "27", "26": "84", "27": "28", "28": "24", "29": "53",
  "30": "76", "31": "76", "32": "76", "33": "75", "34": "76", "35": "53",
  "36": "24", "37": "24", "38": "84", "39": "27", "40": "75", "41": "24",
  "42": "84", "43": "84", "44": "52", "45": "24", "46": "76", "47": "75",
  "48": "76", "49": "52", "50": "28", "51": "44", "52": "44", "53": "52",
  "54": "44", "55": "44", "56": "53", "57": "44", "58": "27", "59": "32",
  "60": "32", "61": "28", "62": "32", "63": "84", "64": "75", "65": "76",
  "66": "76", "67": "44", "68": "44", "69": "84", "70": "27", "71": "27",
  "72": "52", "73": "84", "74": "84", "75": "11", "76": "28", "77": "11",
  "78": "11", "79": "75", "80": "32", "81": "76", "82": "76", "83": "93",
  "84": "93", "85": "52", "86": "75", "87": "75", "88": "44", "89": "27",
  "90": "27", "91": "11", "92": "11", "93": "11", "94": "11", "95": "11",
  "971": "01", "972": "02", "973": "03", "974": "04", "976": "06",
};

/** Le code INSEE d'une commune appartient-il au périmètre demandé ? */
function communeInScope(insee: string, type: TerritoryType, code: string): boolean {
  if (type === "commune") return insee === code;
  const dept = deptFromInsee(insee);
  if (!dept) return false;
  if (type === "departement") return dept === code.toUpperCase();
  return REGION_OF_DEPT[dept] === code;
}

/**
 * Profil sociologique (10 indicateurs INSEE) d'un territoire, comparé au
 * national. Circonscription : agrégat précalculé + moyenne des circos.
 * Commune / département / région : indicateurs communaux, agrégés (moyenne
 * pondérée par la population — approximation assumée pour médianes et taux).
 */
export function useSocioProfile(type: TerritoryType | null, code: string | null) {
  return useQuery({
    enabled: !!type && !!code,
    queryKey: ["territory-socio-profile", type, code],
    queryFn: async (): Promise<SocioProfileRow[] | null> => {
      if (!type || !code) return null;

      if (type === "circo") {
        const data = await loadJson<ColumnFile>("/electoral/choro/socio_circo.json");
        if (!data) return null;
        const rows: SocioProfileRow[] = [];
        for (const meta of SOCIO_INDICATORS) {
          const col = data[meta.column] ?? {};
          const value = col[code];
          if (value == null || !Number.isFinite(value)) continue;
          let sum = 0;
          let n = 0;
          for (const v of Object.values(col)) {
            if (Number.isFinite(v)) { sum += v; n += 1; }
          }
          rows.push({ id: meta.id, label: meta.label, unit: meta.unit, value, national: n ? sum / n : 0 });
        }
        return rows.length ? rows : null;
      }

      const [filosofi, rp] = await Promise.all([
        loadJson<ColumnFile>("/electoral/choro/socio_filosofi_communes.json"),
        loadJson<ColumnFile>("/electoral/choro/socio_rp_communes.json"),
      ]);
      if (!filosofi || !rp) return null;
      const population = rp.population ?? {};

      const rows: SocioProfileRow[] = [];
      for (const meta of SOCIO_INDICATORS) {
        const col = (meta.source === "rp" ? rp : filosofi)[meta.column] ?? {};
        let locSum = 0, locW = 0, natSum = 0, natW = 0;
        for (const [insee, v] of Object.entries(col)) {
          if (!Number.isFinite(v)) continue;
          const w = population[insee] ?? 0;
          if (!(w > 0)) continue;
          natSum += v * w;
          natW += w;
          if (communeInScope(insee, type, code)) {
            locSum += v * w;
            locW += w;
          }
        }
        if (!(locW > 0) || !(natW > 0)) continue;
        rows.push({
          id: meta.id,
          label: meta.label,
          unit: meta.unit,
          value: locSum / locW,
          national: natSum / natW,
        });
      }
      return rows.length ? rows : null;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ─── Potentiel par bloc (affinité sociologique − score réel) ──────────────────

export type PotentielBlocRow = {
  bloc: BlocId;
  /** Score réel du bloc (législatives 2024 T1 pour les circos, cf. pipeline pour les communes). */
  reel: number | null;
  /** Score « attendu » d'après le profil sociologique. */
  affinite: number | null;
  /** affinité − réel : > 0 = réserves de voix, < 0 = sur-performance. */
  potentiel: number | null;
};

/**
 * Potentiel des 5 blocs pour une commune / un département / une région, depuis
 * l'indice précalculé par commune (pot_/aff_/reel_), agrégé pondéré population
 * au-delà de la commune.
 */
export function usePotentielTerritory(type: TerritoryType | null, code: string | null) {
  return useQuery({
    enabled: !!type && !!code && type !== "circo",
    queryKey: ["territory-potentiel", type, code],
    queryFn: async (): Promise<PotentielBlocRow[] | null> => {
      if (!type || !code) return null;
      const [pot, rp] = await Promise.all([
        loadJson<ColumnFile>("/electoral/choro/potentiel_communes.json"),
        loadJson<ColumnFile>("/electoral/choro/socio_rp_communes.json"),
      ]);
      if (!pot) return null;
      const population = rp?.population ?? {};

      const rows: PotentielBlocRow[] = [];
      for (const b of BLOCS) {
        const cols = {
          reel: pot[`reel_${b.id}`] ?? {},
          affinite: pot[`aff_${b.id}`] ?? {},
          potentiel: pot[`pot_${b.id}`] ?? {},
        };
        const agg: Record<keyof typeof cols, number | null> = { reel: null, affinite: null, potentiel: null };
        for (const key of Object.keys(cols) as (keyof typeof cols)[]) {
          const col = cols[key];
          if (type === "commune") {
            const v = col[code];
            agg[key] = v != null && Number.isFinite(v) ? v : null;
            continue;
          }
          let sum = 0, w = 0;
          for (const [insee, v] of Object.entries(col)) {
            if (!Number.isFinite(v) || !communeInScope(insee, type, code)) continue;
            const p = population[insee] ?? 0;
            if (!(p > 0)) continue;
            sum += v * p;
            w += p;
          }
          agg[key] = w > 0 ? sum / w : null;
        }
        rows.push({ bloc: b.id, ...agg });
      }
      return rows.some((r) => r.potentiel != null) ? rows : null;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export type PotentielCircoResult = { rows: PotentielBlocRow[]; r2: Record<BlocId, number> };

/**
 * Potentiel des 5 blocs pour UNE circonscription : régression ridge
 * (10 indicateurs socio → part du bloc, législatives 2024 T1) calculée sur
 * l'ensemble des circos, dont on lit la prédiction pour `code`.
 */
export function usePotentielCirco(code: string | null, enabled = true) {
  const matrix = useCircoBlocMatrix("legis-2024-t1", enabled && !!code);
  const features = useSocioFeaturesCirco(enabled && !!code);

  const isLoading = matrix.isLoading || features.isLoading;
  const isError = matrix.isError || features.isError;

  let data: PotentielCircoResult | null = null;
  if (code && matrix.data && features.data) {
    const rows: PotentielBlocRow[] = [];
    const r2 = {} as Record<BlocId, number>;
    for (const b of BLOCS) {
      const target = new Map<string, number>();
      for (const c of matrix.data.circos) target.set(c.code, c.shares[b.id]);
      const model = ridgeResiduals(features.data, target);
      r2[b.id] = model.r2;
      const row = model.rows.find((r) => r.code === code);
      rows.push({
        bloc: b.id,
        reel: row ? row.actual : null,
        affinite: row ? row.predicted : null,
        potentiel: row ? row.predicted - row.actual : null,
      });
    }
    data = rows.some((r) => r.potentiel != null) ? { rows, r2 } : null;
  }
  return { data, isLoading, isError };
}
