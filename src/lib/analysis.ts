"use client";

import { useQuery } from "@tanstack/react-query";
import { dataUrl } from "@/lib/data-url";
import type { Maille } from "@/lib/map-config";
import type { Scrutin } from "@/lib/url-state";

// ─── Lecture des agrégats figés (JSON statique précalculé, sans DuckDB-WASM) ───
// analysis/{scrutin}_{maille}.json (agrégat par nuance), choro/*.json (colonnes),
// detail/{scrutin}_{maille}.json (candidats) — cf. scripts/pipeline/build-*.py.
type AnalysisEntry = {
  l: string | null; e: number; v: number; i: number; nu: Record<string, number>;
};
type AnalysisFile = Record<string, AnalysisEntry>;
type ColumnFile = Record<string, Record<string, number>>;
type DetailEntry = { l: string | null; e: number; c: [string | null, string | null, number, number][] };

const jsonCache = new Map<string, Promise<unknown>>();
function loadJson<T>(path: string): Promise<T> {
  let p = jsonCache.get(path);
  if (!p) {
    // Éviction en cas d'échec : une erreur réseau transitoire ne doit pas rester
    // mémorisée jusqu'au rechargement (promesse rejetée figée dans le cache).
    p = fetch(dataUrl(path))
      .then((r) => {
        if (!r.ok) throw new Error(`agrégat figé introuvable: ${path} (HTTP ${r.status})`);
        return r.json();
      })
      .catch((e) => {
        jsonCache.delete(path);
        throw e;
      });
    jsonCache.set(path, p);
  }
  return p as Promise<T>;
}
const loadAnalysis = (scrutin: Scrutin, maille: Maille) =>
  loadJson<AnalysisFile>(`/electoral/analysis/${scrutin}_${maille}.json`);
const loadColumnFile = (name: string) => loadJson<ColumnFile>(`/electoral/choro/${name}.json`);
const loadDetailAll = (scrutin: Scrutin, maille: Maille) =>
  loadJson<Record<string, DetailEntry>>(`/electoral/detail/${scrutin}_${maille}.json`);

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

/**
 * Diagnostic de marginalité d'un siège à partir de l'écart 1er/2e (en part des
 * exprimés, 0..1). Partagé par la fiche circo et l'onglet « Mon territoire ».
 */
export function marginDiagnostic(margin: number | null): { label: string; tone: string } {
  if (margin == null) return { label: "Données partielles", tone: "text-muted-foreground" };
  if (margin < 0.05) return { label: "Ultra-marginale", tone: "text-red-600" };
  if (margin < 0.1) return { label: "Disputée", tone: "text-amber-600" };
  if (margin < 0.2) return { label: "Orientée", tone: "text-sky-600" };
  return { label: "Acquise", tone: "text-emerald-600" };
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
      const blocCodes = codes ?? [];
      const data = await loadAnalysis(scrutin, maille);
      const out: TerritoryValue[] = [];
      for (const [code, t] of Object.entries(data)) {
        if (!(t.e > 0)) continue;
        const v = blocCodes.reduce((s, n) => s + (t.nu[n] ?? 0), 0);
        out.push({ code, libelle: t.l, value: v / t.e });
      }
      return out;
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
      const data = await loadAnalysis(scrutin, maille);
      const out: TerritoryValue[] = [];
      for (const [code, t] of Object.entries(data)) {
        if (t.i > 0) out.push({ code, libelle: t.l, value: t.v / t.i });
      }
      return out;
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
      const data = await loadAnalysis(scrutin, maille);
      const out: TerritoryWinner[] = [];
      for (const [code, t] of Object.entries(data)) {
        let best = -1;
        let winner = "";
        // Départage déterministe sur la nuance (à voix égales) comme la choroplèthe.
        for (const [n, v] of Object.entries(t.nu)) {
          if (v > best || (v === best && n < winner)) {
            best = v;
            winner = n;
          }
        }
        if (winner) out.push({ code, libelle: t.l, nuance: winner });
      }
      return out;
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Sociologie & démographie commune (catalogue) pour la corrélation ─────────

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

/**
 * Indicateur socio par territoire, à la maille demandée.
 * - communes        : Filosofi / RP (données natives).
 * - circonscriptions : circo_socio.parquet (agrégat pondéré par population,
 *   cf. build-circo-socio.py) — toutes les colonnes dans un seul fichier.
 */
export function useSocioByMaille(
  indicator: SocioIndicator,
  maille: Maille,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: ["analysis-socio", indicator, maille],
    queryFn: async (): Promise<Map<string, number>> => {
      const meta = socioMeta(indicator);
      const file =
        maille === "circonscriptions"
          ? "socio_circo"
          : meta.source === "rp"
            ? "socio_rp_communes"
            : "socio_filosofi_communes";
      const data = await loadColumnFile(file);
      const col = data[meta.column] ?? {};
      const m = new Map<string, number>();
      for (const [code, value] of Object.entries(col)) m.set(code, value);
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
      // Niveau candidat (1er/2e) → fichier détail (candidats triés voix desc).
      const data = await loadDetailAll(scrutin, maille);
      const rows: MarginRow[] = [];
      for (const [code, t] of Object.entries(data)) {
        if (!(t.e > 0) || t.c.length === 0) continue;
        const [l1, n1, v1] = t.c[0];
        const top2 = t.c[1];
        const v2 = top2 ? top2[2] : 0;
        rows.push({
          code,
          libelle: t.l,
          leader: l1 ?? "",
          leaderNuance: n1 ?? "",
          runnerNuance: top2 ? top2[1] : null,
          leaderPct: v1 / t.e,
          marginPts: (v1 - v2) / t.e,
        });
      }
      rows.sort((a, b) => a.marginPts - b.marginPts);
      return rows;
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
      const data = await loadAnalysis(scrutin, "circonscriptions");
      const circos: CircoBlocRow[] = [];
      const totals: Record<string, number> = {};
      let totalExp = 0;
      for (const [code, t] of Object.entries(data)) {
        if (!(t.e > 0)) continue;
        const shares = {} as Record<BlocId, number>;
        for (const b of BLOCS) {
          const v = b.codes.reduce((s, n) => s + (t.nu[n] ?? 0), 0);
          shares[b.id] = v / t.e;
          totals[b.id] = (totals[b.id] ?? 0) + v;
        }
        totalExp += t.e;
        circos.push({ code, libelle: t.l, exp: t.e, shares });
      }
      const national = {} as Record<BlocId, number>;
      for (const b of BLOCS) national[b.id] = totalExp > 0 ? (totals[b.id] ?? 0) / totalExp : 0;
      return { circos, national };
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Potentiel : sur/sous-performance vs profil sociologique ──────────────────

/** Colonnes socio-démo utilisées comme prédicteurs (circo_socio.parquet). */
export const SOCIO_FEATURE_COLUMNS = [
  "MED_SL", "PR_MD60", "IR_D9_D1_SL", "S_SOC_BEN_DI", "S_RET_PEN_DI",
  "part65plus", "tauxChomage", "partCadres", "partOuvriers", "partDiplomeSup",
] as const;

/** Vecteur d'indicateurs socio-démo par circonscription (matrice de features). */
export function useSocioFeaturesCirco(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["socio-features-circo"],
    queryFn: async (): Promise<Map<string, number[]>> => {
      const data = await loadColumnFile("socio_circo");
      const codes = new Set<string>();
      for (const c of SOCIO_FEATURE_COLUMNS) for (const code in data[c] ?? {}) codes.add(code);
      const m = new Map<string, number[]>();
      for (const code of codes) {
        m.set(code, SOCIO_FEATURE_COLUMNS.map((c) => data[c]?.[code] ?? 0));
      }
      return m;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ─── Stats (régression ridge, Pearson) ──────────────────────────────────────
// Déplacées dans `@/lib/stats` (pures, sans dépendance DuckDB) pour être
// testables isolément ; ré-exportées ici pour ne pas casser les imports existants.
export { ridgeResiduals, pearson, type OverPerfRow } from "@/lib/stats";
