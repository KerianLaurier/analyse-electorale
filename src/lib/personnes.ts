"use client";

import { useQuery } from "@tanstack/react-query";
import { normalize } from "@/lib/search";

export type Personne = {
  nom: string;
  prenom: string | null;
  sexe: "M" | "F" | null;
};

/** Index nominatif (législatives 2024) — clé « {dept}__{slug(nom)}__{nuance} ». */
export type PersonnesIndex = Record<string, Personne>;

export function usePersonnesIndex(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["personnes-2024"],
    queryFn: async (): Promise<PersonnesIndex> => {
      const res = await fetch("/electoral/personnes-2024.json");
      if (!res.ok) throw new Error("Index personnes introuvable");
      return (await res.json()) as PersonnesIndex;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/** Dépt à partir d'un code circo (ex. « 2602 » → « 26 », « 97101 » → « 971 »). */
export function deptFromCirco(code: string): string {
  return code.length > 2 ? code.slice(0, code.length - 2) : code;
}

/** Clé d'enrichissement, alignée sur scripts/pipeline/build-personnes.py. */
export function personneKey(dept: string, nom: string, nuance: string | null): string {
  return `${dept}__${normalize(nom)}__${nuance ?? ""}`;
}

/** Recherche l'enrichissement nominatif d'un candidat dans son département. */
export function lookupPersonne(
  index: PersonnesIndex | undefined,
  dept: string,
  nom: string,
  nuance: string | null,
): Personne | null {
  if (!index) return null;
  return index[personneKey(dept, nom, nuance)] ?? null;
}

/** Slug URL d'un candidat (espaces → tirets). « LE PEN » → « le-pen ». */
export function candidatSlug(label: string): string {
  return normalize(label).replace(/\s+/g, "-");
}

/** Affiche « Prénom NOM » si le prénom est connu, sinon le nom seul. */
export function displayName(nom: string, personne: Personne | null): string {
  if (personne?.prenom) return `${personne.prenom} ${capitalizeNom(nom)}`;
  return capitalizeNom(nom);
}

/** « POLLET » → « Pollet », « LE PEN » → « Le Pen » (les noms MinInt sont en CAPS). */
export function capitalizeNom(nom: string): string {
  return nom
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s'-])([a-zà-ÿ])/g, (_, sep, ch) => sep + ch.toLocaleUpperCase("fr-FR"));
}
