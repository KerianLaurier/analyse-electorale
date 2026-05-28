"use client";

import { useQuery } from "@tanstack/react-query";

export type SearchEntryType = "region" | "departement" | "circo" | "commune";

export type SearchEntry = {
  type: SearchEntryType;
  code: string;
  nom: string;
  departement?: string;
  codeDepartement?: string;
};

/** Index complet — chargé à la demande (lazy) lors de la 1re ouverture de Cmd+K. */
export function useSearchIndex(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ["search-index"],
    queryFn: async (): Promise<SearchEntry[]> => {
      const res = await fetch("/search-index.json");
      if (!res.ok) throw new Error("Search index introuvable");
      return (await res.json()) as SearchEntry[];
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 jour
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/** Normalise une chaîne pour matching (lowercase, accents supprimés). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Recherche multi-token :
 *  - on splitte la requête en tokens (espaces)
 *  - chaque token doit matcher quelque part dans (nom ∪ département ∪ code)
 * Scoring :
 *  - 4 = code exact
 *  - 3 = la concaténation nom+dept commence par la requête complète
 *  - 2 = nom commence par le 1er token
 *  - 1 = tous les tokens matchent (substring)
 */
export function searchEntries(
  index: SearchEntry[],
  query: string,
  limit = 30,
): SearchEntry[] {
  const qFull = normalize(query);
  if (!qFull) return [];
  const tokens = qFull.split(/\s+/).filter(Boolean);

  const results: Array<{ entry: SearchEntry; score: number }> = [];
  for (const e of index) {
    const code = e.code.toLowerCase();
    if (code === qFull) {
      results.push({ entry: e, score: 4 });
      continue;
    }
    const nom = normalize(e.nom);
    const dept = e.departement ? normalize(e.departement) : "";
    const haystack = `${nom} ${dept} ${code}`;

    // Tous les tokens doivent matcher quelque part.
    let allMatch = true;
    for (const t of tokens) {
      if (!haystack.includes(t)) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) continue;

    let score = 1;
    if (`${nom} ${dept}`.startsWith(qFull) || `${dept} ${nom}`.startsWith(qFull)) {
      score = 3;
    } else if (nom.startsWith(tokens[0])) {
      score = 2;
    }
    results.push({ entry: e, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.nom.localeCompare(b.entry.nom, "fr");
  });

  return results.slice(0, limit).map((r) => r.entry);
}

export const TYPE_LABELS: Record<SearchEntryType, string> = {
  region: "Région",
  departement: "Département",
  circo: "Circonscription",
  commune: "Commune",
};

/** Maille Explorer correspondant à un type d'entrée. */
export function mailleForType(type: SearchEntryType): string {
  switch (type) {
    case "region":
      return "regions";
    case "departement":
      return "departements";
    case "circo":
      return "circonscriptions";
    case "commune":
      return "communes";
  }
}
