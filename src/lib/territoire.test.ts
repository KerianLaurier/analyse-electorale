import { describe, expect, it } from "vitest";
import {
  deptFromCirco, deptFromInsee, territoryFrom, DEPT_NAMES, DEPT_OF,
  circoLabel, circoShortLabel, circoNumber, ordinalFem,
} from "./territoire";

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

describe("DEPT_OF", () => {
  it("couvre exactement les mêmes départements que DEPT_NAMES", () => {
    expect(Object.keys(DEPT_OF).sort()).toEqual(Object.keys(DEPT_NAMES).sort());
  });
  it("contracte correctement l'article selon genre et nombre", () => {
    expect(DEPT_OF["34"]).toBe("de l'Hérault"); // voyelle
    expect(DEPT_OF["69"]).toBe("du Rhône"); // masculin
    expect(DEPT_OF["26"]).toBe("de la Drôme"); // féminin
    expect(DEPT_OF["40"]).toBe("des Landes"); // pluriel
    expect(DEPT_OF["75"]).toBe("de Paris"); // sans article
  });
  it("ne produit jamais « de le » ni « de les »", () => {
    for (const v of Object.values(DEPT_OF)) {
      expect(v).not.toMatch(/^de l(e|es) /); // « de le » / « de les » → du / des
      expect(v).toMatch(/^(de|du|des|d')\b|^d'/);
    }
  });
});

describe("circoLabel", () => {
  it("nomme le département, comme on le dit à l'oral", () => {
    expect(circoLabel("3401")).toBe("1ʳᵉ circonscription de l'Hérault");
    expect(circoLabel("3402")).toBe("2ᵉ circonscription de l'Hérault");
    expect(circoLabel("6903")).toBe("3ᵉ circonscription du Rhône");
    expect(circoLabel("7501")).toBe("1ʳᵉ circonscription de Paris");
  });
  it("gère la Corse et l'outre-mer", () => {
    expect(circoLabel("2A01")).toBe("1ʳᵉ circonscription de la Corse-du-Sud");
    expect(circoLabel("97101")).toBe("1ʳᵉ circonscription de la Guadeloupe");
  });
  it("nomme l'outre-mer et les Français de l'étranger (codes à préfixe alpha)", () => {
    // 38 des 577 sièges sont codés « ZD03 » et non « 97403 » : sans la table des
    // zones, ces circonscriptions s'affichaient sans aucun territoire.
    expect(circoLabel("ZD03")).toBe("3ᵉ circonscription de La Réunion");
    expect(circoLabel("ZA01")).toBe("1ʳᵉ circonscription de la Guadeloupe");
    expect(circoLabel("ZB04")).toBe("4ᵉ circonscription de la Martinique");
    expect(circoLabel("ZC02")).toBe("2ᵉ circonscription de la Guyane");
    expect(circoLabel("ZM02")).toBe("2ᵉ circonscription de Mayotte");
    expect(circoLabel("ZN01")).toBe("1ʳᵉ circonscription de Nouvelle-Calédonie");
    expect(circoLabel("ZP03")).toBe("3ᵉ circonscription de Polynésie française");
    expect(circoLabel("ZS01")).toBe("1ʳᵉ circonscription de Saint-Pierre-et-Miquelon");
    expect(circoLabel("ZW01")).toBe("1ʳᵉ circonscription de Wallis-et-Futuna");
    expect(circoLabel("ZX01")).toBe("1ʳᵉ circonscription de Saint-Barthélemy et Saint-Martin");
    expect(circoLabel("ZZ11")).toBe("11ᵉ circonscription des Français de l'étranger");
  });

  it("dégrade proprement sur un code illisible", () => {
    expect(circoLabel("")).toBe("Circonscription ");
    expect(circoLabel("3400")).toBe("Circonscription de l'Hérault");
  });
});

describe("circoShortLabel", () => {
  it("reste compact pour les listes denses", () => {
    expect(circoShortLabel("3401")).toBe("1ʳᵉ circo. · Hérault");
    expect(circoShortLabel("6903")).toBe("3ᵉ circo. · Rhône");
    expect(circoShortLabel("ZZ05")).toBe("5ᵉ circo. · Français de l'étranger");
  });
});

describe("circoNumber / ordinalFem", () => {
  it("lit le numéro en fin de code", () => {
    expect(circoNumber("3401")).toBe(1);
    expect(circoNumber("97101")).toBe(1);
    expect(circoNumber("3412")).toBe(12);
    expect(circoNumber("34")).toBeNull();
  });
  it("accorde l'ordinal au féminin", () => {
    expect(ordinalFem(1)).toBe("1ʳᵉ");
    expect(ordinalFem(2)).toBe("2ᵉ");
  });
});
