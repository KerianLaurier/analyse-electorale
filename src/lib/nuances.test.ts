import { describe, it, expect } from "vitest";
import {
  nuanceColor,
  nuanceLabel,
  presid2022Nuance,
  presid2017Nuance,
  buildNuanceMatchExpression,
  NUANCES,
} from "@/lib/nuances";

const FALLBACK = "#cbd5e1";

describe("nuanceColor", () => {
  it("renvoie la couleur officielle d'un code connu", () => {
    expect(nuanceColor("RN")).toBe(NUANCES.RN.color);
    expect(nuanceColor("FI")).toBe(NUANCES.FI.color);
  });

  it("renvoie la couleur de repli pour un code inconnu ou vide", () => {
    expect(nuanceColor("ZZZ")).toBe(FALLBACK);
    expect(nuanceColor(null)).toBe(FALLBACK);
    expect(nuanceColor(undefined)).toBe(FALLBACK);
    expect(nuanceColor("")).toBe(FALLBACK);
  });
});

describe("nuanceLabel", () => {
  it("renvoie le libellé d'un code connu", () => {
    expect(nuanceLabel("ENS")).toBe(NUANCES.ENS.label);
  });

  it("renvoie le code brut si inconnu, et « — » si vide", () => {
    expect(nuanceLabel("ZZZ")).toBe("ZZZ");
    expect(nuanceLabel(null)).toBe("—");
  });
});

describe("presid2022Nuance", () => {
  it("mappe un nom de candidat (insensible à la casse/espaces) vers sa nuance", () => {
    expect(presid2022Nuance("Le Pen")).toBe("RN");
    expect(presid2022Nuance("  macron ")).toBe("ENS");
    expect(presid2022Nuance("MÉLENCHON")).toBe("FI");
  });

  it("renvoie null pour un nom inconnu ou vide", () => {
    expect(presid2022Nuance("INCONNU")).toBeNull();
    expect(presid2022Nuance(null)).toBeNull();
  });
});

describe("presid2017Nuance", () => {
  it("mappe les candidats de 2017", () => {
    expect(presid2017Nuance("Fillon")).toBe("LR");
    expect(presid2017Nuance("Hamon")).toBe("SOC");
  });

  it("renvoie null pour un nom absent du millésime 2017", () => {
    expect(presid2017Nuance("Zemmour")).toBeNull();
  });
});

describe("buildNuanceMatchExpression", () => {
  it("produit une expression MapLibre match terminée par le fallback", () => {
    const expr = buildNuanceMatchExpression();
    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["feature-state", "nuance"]);
    expect(expr[expr.length - 1]).toBe(FALLBACK);
    // 2 éléments (code, couleur) par nuance entre l'entrée et le fallback.
    const pairs = expr.length - 3;
    expect(pairs).toBe(Object.keys(NUANCES).length * 2);
  });
});
