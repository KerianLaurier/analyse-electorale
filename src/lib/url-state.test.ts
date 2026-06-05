import { describe, it, expect } from "vitest";
import {
  parseScrutin,
  isElection,
  yearsFor,
  toursFor,
  scrutinFor,
  defaultScrutinFor,
  colorationsFor,
  maillesFor,
} from "@/lib/url-state";

describe("parseScrutin", () => {
  it("décompose un identifiant élection en famille / année / tour", () => {
    expect(parseScrutin("presid-2022-t1")).toEqual({
      family: "presidentielle",
      year: 2022,
      tour: 1,
    });
    expect(parseScrutin("legis-2024-t2")).toEqual({
      family: "legislative",
      year: 2024,
      tour: 2,
    });
  });

  it("renvoie année/tour null pour les couches non électorales", () => {
    expect(parseScrutin("sociologie")).toEqual({ family: "sociologie", year: null, tour: null });
    expect(parseScrutin("potentiel")).toEqual({ family: "potentiel", year: null, tour: null });
  });
});

describe("isElection", () => {
  it("vrai pour un scrutin réel, faux pour les couches dérivées", () => {
    expect(isElection("presid-2017-t1")).toBe(true);
    expect(isElection("municipales-2026-t2")).toBe(true);
    expect(isElection("sociologie")).toBe(false);
    expect(isElection("tendances")).toBe(false);
    expect(isElection("potentiel")).toBe(false);
  });
});

describe("yearsFor", () => {
  it("renvoie les années d'une famille en ordre décroissant", () => {
    expect(yearsFor("presidentielle")).toEqual([2022, 2017]);
    expect(yearsFor("legislative")).toEqual([2024, 2022]);
    expect(yearsFor("municipale")).toEqual([2026]);
  });
});

describe("toursFor", () => {
  it("renvoie les tours disponibles en ordre croissant", () => {
    expect(toursFor("presidentielle", 2022)).toEqual([1, 2]);
    expect(toursFor("legislative", 2024)).toEqual([1, 2]);
  });

  it("renvoie un tableau vide pour une année absente", () => {
    expect(toursFor("presidentielle", 1999)).toEqual([]);
  });
});

describe("scrutinFor", () => {
  it("reconstruit l'identifiant depuis famille × année × tour", () => {
    expect(scrutinFor("presidentielle", 2022, 1)).toBe("presid-2022-t1");
    expect(scrutinFor("legislative", 2024, 2)).toBe("legis-2024-t2");
    expect(scrutinFor("municipale", 2026, 1)).toBe("municipales-2026-t1");
  });

  it("renvoie null pour une combinaison inexistante", () => {
    expect(scrutinFor("presidentielle", 2030, 1)).toBeNull();
  });
});

describe("defaultScrutinFor", () => {
  it("renvoie l'année la plus récente au 1er tour pour une élection", () => {
    expect(defaultScrutinFor("presidentielle")).toBe("presid-2022-t1");
    expect(defaultScrutinFor("legislative")).toBe("legis-2024-t1");
  });

  it("renvoie la couche elle-même pour les familles non électorales", () => {
    expect(defaultScrutinFor("sociologie")).toBe("sociologie");
    expect(defaultScrutinFor("tendances")).toBe("tendances");
    expect(defaultScrutinFor("potentiel")).toBe("potentiel");
  });
});

describe("colorationsFor", () => {
  it("propose vainqueur/participation/abstention pour une élection", () => {
    expect(colorationsFor("presid-2022-t1")).toEqual(["vainqueur", "participation", "abstention"]);
  });

  it("propose les colorations potentiel par bloc", () => {
    expect(colorationsFor("potentiel")).toEqual([
      "pot-rn",
      "pot-gauche",
      "pot-ecolo",
      "pot-centre",
      "pot-droite",
    ]);
  });

  it("propose les indicateurs sociologiques", () => {
    expect(colorationsFor("sociologie")).toContain("revenu");
    expect(colorationsFor("sociologie")).toContain("nouveaux-arrivants");
  });
});

describe("maillesFor", () => {
  it("inclut la maille bureaux pour les élections récentes", () => {
    expect(maillesFor("legis-2024-t1")).toContain("bureaux");
  });

  it("exclut la circonscription pour les municipales", () => {
    expect(maillesFor("municipales-2026-t1")).not.toContain("circonscriptions");
  });

  it("limite la sociologie à la maille communes", () => {
    expect(maillesFor("sociologie")).toEqual(["communes"]);
  });
});
