import { describe, it, expect } from "vitest";
import { pearson, ridgeResiduals } from "@/lib/stats";

describe("pearson", () => {
  it("renvoie +1 pour une corrélation positive parfaite", () => {
    expect(pearson([[0, 0], [1, 2], [2, 4], [3, 6]])).toBeCloseTo(1, 10);
  });

  it("renvoie −1 pour une corrélation négative parfaite", () => {
    expect(pearson([[0, 6], [1, 4], [2, 2], [3, 0]])).toBeCloseTo(-1, 10);
  });

  it("renvoie 0 quand une variable est constante (variance nulle)", () => {
    expect(pearson([[1, 5], [2, 5], [3, 5]])).toBe(0);
  });

  it("renvoie 0 pour moins de 2 points", () => {
    expect(pearson([])).toBe(0);
    expect(pearson([[1, 1]])).toBe(0);
  });

  it("calcule une corrélation partielle dans [-1, 1]", () => {
    const r = pearson([[1, 2], [2, 1], [3, 4], [4, 3], [5, 6]]);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe("ridgeResiduals", () => {
  it("renvoie un résultat vide si trop peu d'observations (n < p + 2)", () => {
    const features = new Map([["a", [1, 2]], ["b", [3, 4]]]);
    const target = new Map([["a", 0.5], ["b", 0.6]]);
    const out = ridgeResiduals(features, target);
    expect(out.rows).toEqual([]);
    expect(out.r2).toBe(0);
    expect(out.n).toBe(2);
  });

  it("ignore les territoires sans cible ou avec feature non finie", () => {
    const features = new Map([
      ["a", [1, 0]],
      ["b", [2, 1]],
      ["c", [3, 0]],
      ["d", [4, 1]],
      ["e", [Number.NaN, 0]], // feature non finie → exclu
    ]);
    const target = new Map([
      ["a", 0.1],
      ["b", 0.2],
      ["c", 0.3],
      ["d", 0.4],
      // "e" présent dans features mais sa feature est NaN → exclu
    ]);
    const out = ridgeResiduals(features, target);
    expect(out.n).toBe(4);
    expect(out.rows.map((r) => r.code).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("produit un R² élevé quand la cible est une fonction linéaire des features", () => {
    // y = 0.5 * x1 (+ bruit nul) → la régression doit très bien ajuster.
    const features = new Map<string, number[]>();
    const target = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const x = i;
      features.set(`c${i}`, [x, (i % 5)]);
      target.set(`c${i}`, 0.5 * x);
    }
    const out = ridgeResiduals(features, target, 0.01);
    expect(out.n).toBe(30);
    expect(out.r2).toBeGreaterThan(0.95);
    // résidu = actual − predicted, cohérent
    for (const row of out.rows) {
      expect(row.residual).toBeCloseTo(row.actual - row.predicted, 10);
    }
  });
});
