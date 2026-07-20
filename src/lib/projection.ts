// Fonctions prédictives pures (aucune dépendance React / réseau) — projections
// tendancielles par bloc, scénarios de swing national et bascule de siège.
// Testées isolément dans `projection.test.ts`.

import type { BlocId } from "@/lib/analysis";

/** Parts par bloc + reste hors blocs (« autre »), en fraction des exprimés. */
export type BlocSharesFull = Record<BlocId | "autre", number>;

export const PROJ_BLOC_IDS: (BlocId | "autre")[] = [
  "rn", "gauche", "ecolo", "centre", "droite", "autre",
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Parts par bloc d'un scrutin depuis ses candidats (nuance → bloc). */
export function blocSharesFromCandidates(
  candidates: Array<{ nuance: string | null; pct: number }>,
  nuanceToBloc: Map<string, BlocId>,
): BlocSharesFull {
  const out: BlocSharesFull = { rn: 0, gauche: 0, ecolo: 0, centre: 0, droite: 0, autre: 0 };
  for (const c of candidates) {
    const bloc = c.nuance ? nuanceToBloc.get(c.nuance) : undefined;
    if (bloc) out[bloc] += c.pct;
    else out.autre += c.pct;
  }
  return out;
}

export type LinearFit = { slope: number; intercept: number; rms: number };

/** Moindres carrés y = slope·x + intercept + RMS des résidus. `null` si n < 2. */
export function fitLinear(points: Array<[number, number]>): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of points) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  let ss = 0;
  for (const [x, y] of points) ss += (y - (slope * x + intercept)) ** 2;
  return { slope, intercept, rms: Math.sqrt(ss / n) };
}

export type BlocProjection = {
  bloc: BlocId | "autre";
  /** Dernière part observée. */
  last: number;
  /** Part projetée à l'année cible (clampée puis normalisée à somme 1). */
  projected: number;
  /** Fourchette basse/haute (même normalisation que `projected`). */
  low: number;
  high: number;
  /** Pente annuelle de la tendance (points de part / an). */
  slopePerYear: number;
};

/**
 * Projection tendancielle des parts par bloc à une année cible : droite de
 * tendance par bloc sur l'historique (année, part), clampée à [0,1] puis
 * normalisée pour que la somme reste 1. La fourchette reflète l'incertitude :
 * large avec 2 points (extrapolation sèche), resserrée avec 3+ (résidus).
 */
export function projectBlocShares(
  history: Array<{ year: number; shares: BlocSharesFull }>,
  targetYear: number,
): BlocProjection[] | null {
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => a.year - b.year);
  const last = sorted[sorted.length - 1];

  const raw = PROJ_BLOC_IDS.map((bloc) => {
    const pts: Array<[number, number]> = sorted.map((h) => [h.year, h.shares[bloc] ?? 0]);
    const lastVal = last.shares[bloc] ?? 0;
    const fit = fitLinear(pts);
    let projected = lastVal;
    let band = 0.08; // 1 seul point : statu quo, incertitude large
    let slope = 0;
    if (fit) {
      slope = fit.slope;
      projected = clamp01(fit.slope * targetYear + fit.intercept);
      band =
        pts.length === 2
          ? Math.max(0.03, Math.abs(projected - lastVal) * 0.5)
          : Math.max(0.02, 2 * fit.rms);
    }
    return { bloc, last: lastVal, projected, band, slope };
  });

  const sum = raw.reduce((s, r) => s + r.projected, 0);
  const k = sum > 0 ? 1 / sum : 1;
  return raw.map((r) => ({
    bloc: r.bloc,
    last: r.last,
    projected: r.projected * k,
    low: clamp01((r.projected - r.band) * k),
    high: clamp01((r.projected + r.band) * k),
    slopePerYear: r.slope,
  }));
}

/**
 * Swing proportionnel : applique au territoire l'évolution nationale supposée
 * de chaque bloc (part locale × cible nationale / référence nationale). Repli
 * additif si la référence est quasi nulle. « autre » est conservé tel quel,
 * puis l'ensemble est renormalisé à la masse locale initiale.
 */
export function applyProportionalSwing(
  local: BlocSharesFull,
  nationalRef: Record<BlocId, number>,
  nationalTarget: Record<BlocId, number>,
): BlocSharesFull {
  const out = { ...local };
  for (const bloc of PROJ_BLOC_IDS) {
    if (bloc === "autre") continue;
    const ref = nationalRef[bloc] ?? 0;
    const tgt = nationalTarget[bloc] ?? 0;
    out[bloc] = ref > 0.005 ? local[bloc] * (tgt / ref) : clamp01(local[bloc] + (tgt - ref));
  }
  const massLocal = PROJ_BLOC_IDS.reduce((s, b) => s + local[b], 0);
  const massOut = PROJ_BLOC_IDS.reduce((s, b) => s + out[b], 0);
  if (massOut > 0 && massLocal > 0) {
    const k = massLocal / massOut;
    for (const bloc of PROJ_BLOC_IDS) out[bloc] *= k;
  }
  return out;
}

/**
 * Voix à faire basculer pour renverser le 1er : la moitié de l'écart de voix,
 * arrondie au-dessus (chaque voix reprise compte double). `margin` en part des
 * exprimés (0..1).
 */
export function votesToFlip(margin: number, exprimes: number): number {
  if (!(exprimes > 0) || margin <= 0) return 0;
  return Math.floor((margin * exprimes) / 2) + 1;
}

export type Fragility = { score: number; label: string };

/**
 * Indice de fragilité du siège / de la position de tête (0 = verrouillé,
 * 100 = ultra-disputé) : marge 1er/2e (dominante) ajustée par la dynamique
 * relative du poursuivant (pentes annuelles en points de part).
 */
export function fragilityIndex(
  margin: number | null,
  leaderSlope = 0,
  runnerSlope = 0,
): Fragility | null {
  if (margin == null) return null;
  const base = 100 * clamp01(1 - Math.min(margin, 0.25) / 0.25);
  // Le poursuivant progresse plus vite → +, l'inverse → − (borné à ±10).
  const trendAdj = Math.max(-10, Math.min(10, (runnerSlope - leaderSlope) * 1000));
  const score = Math.round(Math.max(0, Math.min(100, base + trendAdj)));
  const label =
    score >= 75 ? "Très fragile" : score >= 50 ? "Fragile" : score >= 25 ? "Orientée" : "Solide";
  return { score, label };
}
