import { describe, it, expect } from "vitest";
import {
  deptFromCirco,
  personneKey,
  candidatSlug,
  capitalizeNom,
  displayName,
} from "@/lib/personnes";

describe("deptFromCirco", () => {
  it("retire les 2 derniers chiffres (numéro de circonscription)", () => {
    expect(deptFromCirco("2602")).toBe("26");
    expect(deptFromCirco("7501")).toBe("75");
  });

  it("gère les DOM (codes à 3 chiffres de département)", () => {
    expect(deptFromCirco("97101")).toBe("971");
  });

  it("gère la Corse (départements alphanumériques)", () => {
    expect(deptFromCirco("2A01")).toBe("2A");
    expect(deptFromCirco("2B02")).toBe("2B");
  });

  it("renvoie le code tel quel s'il fait 2 caractères ou moins", () => {
    expect(deptFromCirco("75")).toBe("75");
  });
});

describe("candidatSlug", () => {
  it("normalise et remplace les espaces par des tirets", () => {
    expect(candidatSlug("LE PEN")).toBe("le-pen");
    expect(candidatSlug("MÉLENCHON")).toBe("melenchon");
  });

  it("aplatit la ponctuation interne (tiret du nom composé)", () => {
    expect(candidatSlug("DUPONT-AIGNAN")).toBe("dupont-aignan");
  });
});

describe("capitalizeNom", () => {
  it("met une majuscule en début de chaque mot", () => {
    expect(capitalizeNom("POLLET")).toBe("Pollet");
    expect(capitalizeNom("LE PEN")).toBe("Le Pen");
  });

  it("respecte les tirets et apostrophes", () => {
    expect(capitalizeNom("DUPONT-AIGNAN")).toBe("Dupont-Aignan");
    expect(capitalizeNom("D'ORNANO")).toBe("D'Ornano");
  });

  it("gère les accents (locale fr)", () => {
    expect(capitalizeNom("ÉMILE")).toBe("Émile");
  });
});

describe("personneKey", () => {
  it("construit la clé dept__slug(nom)__nuance", () => {
    expect(personneKey("26", "LE PEN", "RN")).toBe("26__le pen__RN");
  });

  it("met une chaîne vide quand la nuance est nulle", () => {
    expect(personneKey("75", "MACRON", null)).toBe("75__macron__");
  });
});

describe("displayName", () => {
  it("préfixe le prénom quand il est connu", () => {
    expect(displayName("POLLET", { nom: "POLLET", prenom: "Marie", sexe: "F" })).toBe("Marie Pollet");
  });

  it("renvoie le nom capitalisé seul sans enrichissement", () => {
    expect(displayName("LE PEN", null)).toBe("Le Pen");
    expect(displayName("MACRON", { nom: "MACRON", prenom: null, sexe: "M" })).toBe("Macron");
  });
});
