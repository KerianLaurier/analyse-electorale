// Fonctions statistiques pures (aucune dépendance React/DuckDB) — isolées de
// `analysis.ts` pour rester testables sans charger `@duckdb/duckdb-wasm`.

export type OverPerfRow = { code: string; actual: number; predicted: number; residual: number };

/** Résout A·x = b (élimination de Gauss avec pivot partiel). */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  // Après élimination complète, M est diagonale : x[i] = M[i][n] / M[i][i].
  return M.map((row, i) => row[n] / M[i][i]);
}

/**
 * Régression ridge : modélise `target` (part du bloc) par les features socio.
 * Renvoie, par territoire, le score prédit par la sociologie et le résidu
 * (sur/sous-performance), plus le R² du modèle.
 */
export function ridgeResiduals(
  features: Map<string, number[]>,
  target: Map<string, number>,
  lambda = 1,
): { rows: OverPerfRow[]; r2: number; n: number } {
  const codes: string[] = [];
  const X: number[][] = [];
  const y: number[] = [];
  for (const [code, f] of features) {
    const t = target.get(code);
    if (t == null || f.some((v) => !Number.isFinite(v))) continue;
    codes.push(code);
    X.push(f);
    y.push(t);
  }
  const n = codes.length;
  const p = X[0]?.length ?? 0;
  if (n < p + 2) return { rows: [], r2: 0, n };

  // Standardisation des features (z-score) pour le conditionnement.
  const mean = new Array(p).fill(0);
  const sd = new Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += X[i][j];
    mean[j] = s / n;
  }
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (X[i][j] - mean[j]) ** 2;
    sd[j] = Math.sqrt(s / n) || 1;
  }
  const Z = X.map((row) => row.map((v, j) => (v - mean[j]) / sd[j]));
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  const yc = y.map((v) => v - ybar);

  // (ZᵀZ + λI) β = Zᵀ yc
  const A: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const rhs = new Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < p; k++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += Z[i][j] * Z[i][k];
      A[j][k] = s + (j === k ? lambda : 0);
    }
    let sb = 0;
    for (let i = 0; i < n; i++) sb += Z[i][j] * yc[i];
    rhs[j] = sb;
  }
  const beta = solveLinearSystem(A, rhs);
  if (!beta) return { rows: [], r2: 0, n };

  const rows: OverPerfRow[] = codes.map((code, i) => {
    let pred = ybar;
    for (let j = 0; j < p; j++) pred += Z[i][j] * beta[j];
    return { code, actual: y[i], predicted: pred, residual: y[i] - pred };
  });
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += rows[i].residual ** 2;
    ssTot += (y[i] - ybar) ** 2;
  }
  return { rows, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, n };
}

/** Coefficient de corrélation de Pearson. Renvoie 0 si n < 2 ou variance nulle. */
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
