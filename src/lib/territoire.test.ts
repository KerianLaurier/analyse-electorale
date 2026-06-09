import { describe, expect, it } from "vitest";
import { deptFromCirco, deptFromInsee, territoryFrom, DEPT_NAMES } from "./territoire";

describe("deptFromCirco", () => {
  it("extrait le département métropolitain", () => {
    expect(deptFromCirco("1507")).toBe("15");
    expect(deptFromCirco("0101")).toBe("01");
  });
  it("gère l'outre-mer (codes à 5 chiffres)", () => {
    expect(deptFromCirco("97101")).toBe("971");
  });
  it("gère la Corse", () => {
    expect(deptFromCirco("2A01")).toBe("2A");
  });
  it("rejette les codes invalides", () => {
    expect(deptFromCirco("")).toBeNull();
    expect(deptFromCirco("01")).toBeNull();
  });
});

describe("deptFromInsee", () => {
  it("extrait le département d'un code commune", () => {
    expect(deptFromInsee("15014")).toBe("15");
  });
  it("gère la Corse et l'outre-mer", () => {
    expect(deptFromInsee("2A004")).toBe("2A");
    expect(deptFromInsee("97411")).toBe("974");
  });
});

describe("territoryFrom", () => {
  it("renvoie null sans cible", () => {
    expect(territoryFrom(null)).toBeNull();
    expect(territoryFrom(undefined)).toBeNull();
  });

  it("circo : département + requête presse départementale", () => {
    const t = territoryFrom({ type: "circo", id: "1502", label: "2e circonscription", href: "/circo/1502" });
    expect(t).not.toBeNull();
    expect(t?.circoCode).toBe("1502");
    expect(t?.deptName).toBe("Cantal");
    expect(t?.newsQuery).toBe("Cantal");
    expect(t?.shortLabel).toBe("2e circonscription · Cantal");
  });

  it("commune : requête presse communale", () => {
    const t = territoryFrom({ type: "commune", id: "15014", label: "Aurillac", href: "/commune/15014" });
    expect(t?.communeName).toBe("Aurillac");
    expect(t?.newsQuery).toBe("Aurillac");
    expect(t?.deptName).toBe("Cantal");
  });

  it("bureau : retombe sur la commune du libellé", () => {
    const t = territoryFrom({ type: "bureau", id: "15014_0001", label: "Bureau 0001 · Aurillac", href: "/bureau/15014_0001" });
    expect(t?.communeName).toBe("Aurillac");
    expect(t?.newsQuery).toBe("Aurillac");
  });

  it("élu : veille sur la personne, circo conservée", () => {
    const t = territoryFrom({ type: "elu", id: "1502", label: "Jean Dupont", href: "/elu/1502" });
    expect(t?.circoCode).toBe("1502");
    expect(t?.newsQuery).toBe("Jean Dupont");
  });

  it("candidat : circo extraite de l'id composite", () => {
    const t = territoryFrom({
      type: "candidat",
      id: "legis-2024-t2__1502__jean-dupont",
      label: "Jean Dupont",
      href: "/candidat/x",
    });
    expect(t?.circoCode).toBe("1502");
    expect(t?.deptName).toBe("Cantal");
    expect(t?.newsQuery).toBe("Jean Dupont");
  });

  it("ne duplique pas le département dans le libellé court", () => {
    const t = territoryFrom({ type: "commune", id: "75056", label: "Paris", href: "/commune/75056" });
    expect(t?.shortLabel).toBe("Paris");
  });
});

describe("DEPT_NAMES", () => {
  it("couvre métropole + Corse + outre-mer", () => {
    expect(Object.keys(DEPT_NAMES).length).toBeGreaterThanOrEqual(101);
    expect(DEPT_NAMES["2B"]).toBe("Haute-Corse");
    expect(DEPT_NAMES["976"]).toBe("Mayotte");
  });
});
