import { describe, it, expect } from "vitest";
import { marginDiagnostic, blocById, BLOCS } from "@/lib/analysis";

describe("marginDiagnostic", () => {
  it("classe selon l'écart 1er/2e (part des exprimés)", () => {
    expect(marginDiagnostic(0.02).label).toBe("Ultra-marginale");
    expect(marginDiagnostic(0.07).label).toBe("Disputée");
    expect(marginDiagnostic(0.15).label).toBe("Orientée");
    expect(marginDiagnostic(0.3).label).toBe("Acquise");
  });

  it("respecte les bornes (5 %, 10 %, 20 %)", () => {
    expect(marginDiagnostic(0.05).label).toBe("Disputée");
    expect(marginDiagnostic(0.1).label).toBe("Orientée");
    expect(marginDiagnostic(0.2).label).toBe("Acquise");
  });

  it("renvoie un état neutre pour une marge nulle (données partielles)", () => {
    const d = marginDiagnostic(null);
    expect(d.label).toBe("Données partielles");
    expect(d.tone).toBe("text-muted-foreground");
  });
});

describe("blocById", () => {
  it("retrouve un bloc par son identifiant", () => {
    expect(blocById("rn").id).toBe("rn");
    expect(blocById("gauche").id).toBe("gauche");
  });

  it("retombe sur le premier bloc pour un identifiant inconnu", () => {
    // @ts-expect-error test d'un identifiant hors union
    expect(blocById("inexistant")).toBe(BLOCS[0]);
  });
});
