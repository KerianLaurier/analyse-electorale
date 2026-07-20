import { describe, expect, it } from "vitest";
import {
  applyProportionalSwing,
  blocSharesFromCandidates,
  fitLinear,
  fragilityIndex,
  projectBlocShares,
  votesToFlip,
  type BlocSharesFull,
} from "@/lib/projection";
import type { BlocId } from "@/lib/analysis";

const shares = (
  rn: number, gauche: number, ecolo: number, centre: number, droite: number,
): BlocSharesFull => {
  const autre = Math.max(0, 1 - rn - gauche - ecolo - centre - droite);
  return { rn, gauche, ecolo, centre, droite, autre };
};

describe("blocSharesFromCandidates", () => {
  const map = new Map<string, BlocId>([["RN", "rn"], ["UG", "gauche"]]);
  it("agrège par bloc et met le reste dans « autre »", () => {
    const out = blocSharesFromCandidates(
      [
        { nuance: "RN", pct: 0.35 },
        { nuance: "UG", pct: 0.3 },
        { nuance: "REG", pct: 0.1 },
        { nuance: null, pct: 0.05 },
      ],
      map,
    );
    expect(out.rn).toBeCloseTo(0.35);
    expect(out.gauche).toBeCloseTo(0.3);
    expect(out.autre).toBeCloseTo(0.15);
  });
});

describe("fitLinear", () => {
  it("retrouve une droite exacte (rms 0)", () => {
    const fit = fitLinear([[2017, 0.2], [2022, 0.3], [2024, 0.34]]);
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(0.02, 5);
    expect(fit!.rms).toBeCloseTo(0, 5);
  });
  it("null si moins de 2 points ou x constant", () => {
    expect(fitLinear([[2022, 0.3]])).toBeNull();
    expect(fitLinear([[2022, 0.3], [2022, 0.4]])).toBeNull();
  });
});

describe("projectBlocShares", () => {
  it("prolonge la tendance et normalise à somme 1", () => {
    const history = [
      { year: 2017, shares: shares(0.2, 0.3, 0.05, 0.25, 0.15) },
      { year: 2022, shares: shares(0.3, 0.28, 0.05, 0.22, 0.1) },
      { year: 2024, shares: shares(0.34, 0.27, 0.05, 0.2, 0.09) },
    ];
    const proj = projectBlocShares(history, 2029)!;
    const total = proj.reduce((s, p) => s + p.projected, 0);
    expect(total).toBeCloseTo(1, 6);
    const rn = proj.find((p) => p.bloc === "rn")!;
    // Tendance haussière : la projection dépasse la dernière part observée.
    expect(rn.projected).toBeGreaterThan(rn.last);
    expect(rn.low).toBeLessThanOrEqual(rn.projected);
    expect(rn.high).toBeGreaterThanOrEqual(rn.projected);
  });

  it("jamais de part négative même sur tendance très baissière", () => {
    const history = [
      { year: 2017, shares: shares(0.05, 0.3, 0.05, 0.4, 0.15) },
      { year: 2022, shares: shares(0.01, 0.35, 0.05, 0.39, 0.15) },
    ];
    const proj = projectBlocShares(history, 2029)!;
    for (const p of proj) {
      expect(p.projected).toBeGreaterThanOrEqual(0);
      expect(p.low).toBeGreaterThanOrEqual(0);
    }
  });

  it("un seul point → statu quo, fourchette large", () => {
    const proj = projectBlocShares(
      [{ year: 2024, shares: shares(0.3, 0.3, 0.05, 0.2, 0.1) }],
      2029,
    )!;
    const rn = proj.find((p) => p.bloc === "rn")!;
    expect(rn.projected).toBeCloseTo(0.3, 2);
    expect(rn.high - rn.low).toBeGreaterThan(0.1);
  });

  it("historique vide → null", () => {
    expect(projectBlocShares([], 2029)).toBeNull();
  });
});

describe("applyProportionalSwing", () => {
  const nat: Record<BlocId, number> = { rn: 0.3, gauche: 0.28, ecolo: 0.05, centre: 0.22, droite: 0.1 };
  it("identité quand la cible égale la référence", () => {
    const local = shares(0.4, 0.2, 0.04, 0.2, 0.1);
    const out = applyProportionalSwing(local, nat, nat);
    for (const b of ["rn", "gauche", "ecolo", "centre", "droite", "autre"] as const) {
      expect(out[b]).toBeCloseTo(local[b], 6);
    }
  });
  it("amplifie proportionnellement un bloc en hausse nationale", () => {
    const local = shares(0.4, 0.2, 0.04, 0.2, 0.1);
    const out = applyProportionalSwing(local, nat, { ...nat, rn: 0.36 });
    expect(out.rn).toBeGreaterThan(local.rn);
    // Masse totale conservée.
    const mass = (s: BlocSharesFull) =>
      s.rn + s.gauche + s.ecolo + s.centre + s.droite + s.autre;
    expect(mass(out)).toBeCloseTo(mass(local), 6);
  });
});

describe("votesToFlip", () => {
  it("moitié de l'écart de voix + 1", () => {
    // 10 000 exprimés, marge 10 pts → 1 000 voix d'écart → 501 à reprendre.
    expect(votesToFlip(0.1, 10000)).toBe(501);
  });
  it("0 si marge nulle ou exprimés absents", () => {
    expect(votesToFlip(0, 10000)).toBe(0);
    expect(votesToFlip(0.1, 0)).toBe(0);
  });
});

describe("fragilityIndex", () => {
  it("marge serrée → très fragile ; marge large → solide", () => {
    expect(fragilityIndex(0.01)!.score).toBeGreaterThanOrEqual(75);
    expect(fragilityIndex(0.24)!.label).toBe("Solide");
    expect(fragilityIndex(null)).toBeNull();
  });
  it("un poursuivant en dynamique augmente le score", () => {
    const flat = fragilityIndex(0.1, 0, 0)!;
    const chasing = fragilityIndex(0.1, 0, 0.01)!;
    expect(chasing.score).toBeGreaterThan(flat.score);
  });
});
