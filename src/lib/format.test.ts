import { describe, it, expect } from "vitest";
import { fmtInt, fmtEuro, fmtPct } from "@/lib/format";

describe("fmtInt", () => {
  it("arrondit et groupe les milliers (séparateur fr-FR)", () => {
    // Le séparateur de milliers fr-FR varie selon l'ICU (espace fine/insécable) :
    // on vérifie les chiffres groupés sans dépendre du caractère exact.
    expect(fmtInt(11134.4)).toMatch(/^11.134$/);
    expect(fmtInt(999)).toBe("999");
  });

  it("arrondit au plus proche", () => {
    expect(fmtInt(0.5)).toBe("1");
    expect(fmtInt(2.4)).toBe("2");
  });
});

describe("fmtEuro", () => {
  it("ajoute le symbole € après l'entier formaté", () => {
    expect(fmtEuro(22040)).toMatch(/^22.040 €$/);
  });
});

describe("fmtPct", () => {
  it("convertit une fraction 0..1 en pourcentage à 1 décimale par défaut", () => {
    expect(fmtPct(0.5)).toBe("50,0 %");
    expect(fmtPct(0.1234)).toBe("12,3 %");
  });

  it("respecte le nombre de décimales demandé", () => {
    expect(fmtPct(0.5, 0)).toBe("50 %");
    expect(fmtPct(0.12345, 2)).toBe("12,35 %");
  });
});
