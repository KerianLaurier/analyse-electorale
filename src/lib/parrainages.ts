"use client";

import { useQuery } from "@tanstack/react-query";
import { dataUrl } from "@/lib/data-url";

export const SEUIL = 500; // parrainages requis pour se présenter

export type ParrainageCandidat = {
  id: string;
  nom: string;
  nuance: string;
  total: number;
  /** Cumul hebdomadaire (aligné sur `dates`). */
  weekly: number[];
};

export type ParrainagesData = {
  demo: boolean;
  updatedAt: string;
  dates: string[];
  candidats: ParrainageCandidat[];
  /** Total de parrainages par département (somme candidats) — pour la carte. */
  byDept: Record<string, number>;
};

/** Codes département : métropole (01–95 hors 20, + 2A/2B) + outre-mer. */
function deptCodes(): string[] {
  const codes: string[] = [];
  for (let i = 1; i <= 95; i++) {
    if (i === 20) continue;
    codes.push(String(i).padStart(2, "0"));
  }
  codes.push("2A", "2B", "971", "972", "973", "974", "976");
  return codes;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Candidats fictifs (aperçu) — noms neutres, nuances couvrant le spectre.
const DEMO_CANDIDATS: { id: string; nom: string; nuance: string; total: number }[] = [
  { id: "c1", nom: "É. Renaud", nuance: "ENS", total: 742 },
  { id: "c2", nom: "M. Lefèvre", nuance: "RN", total: 611 },
  { id: "c3", nom: "S. Garnier", nuance: "FI", total: 548 },
  { id: "c4", nom: "C. Marchand", nuance: "LR", total: 517 },
  { id: "c5", nom: "T. Bonnet", nuance: "ECO", total: 489 },
  { id: "c6", nom: "N. Perrin", nuance: "SOC", total: 421 },
  { id: "c7", nom: "P. Girard", nuance: "REC", total: 296 },
  { id: "c8", nom: "J. Lemoine", nuance: "DLF", total: 173 },
];

const DEMO_DATES = [
  "2027-01-28", "2027-02-04", "2027-02-11", "2027-02-18",
  "2027-02-25", "2027-03-04", "2027-03-11", "2027-03-18",
];

/** Jeu de données d'aperçu déterministe (en attendant l'open data 2027). */
function buildDemo(): ParrainagesData {
  const codes = deptCodes();
  const byDept: Record<string, number> = {};
  for (const c of codes) byDept[c] = 0;

  const candidats: ParrainageCandidat[] = DEMO_CANDIDATS.map((c, ci) => {
    const r = rng(ci * 7919 + 17);
    // Cumul hebdo : croissance régulière jusqu'au total final.
    const weekly = DEMO_DATES.map((_, wi) => {
      const f = Math.min(1, 0.28 + (wi / (DEMO_DATES.length - 1)) * 0.72);
      return Math.round(c.total * f);
    });
    weekly[weekly.length - 1] = c.total;
    // Répartition du total par département (pondérée aléatoirement).
    const weights = codes.map(() => 0.3 + r());
    const sum = weights.reduce((a, b) => a + b, 0);
    codes.forEach((code, idx) => {
      byDept[code] += Math.round((c.total * weights[idx]) / sum);
    });
    return { id: c.id, nom: c.nom, nuance: c.nuance, total: c.total, weekly };
  });

  return {
    demo: true,
    updatedAt: DEMO_DATES[DEMO_DATES.length - 1],
    dates: DEMO_DATES,
    candidats: candidats.sort((a, b) => b.total - a.total),
    byDept,
  };
}

/**
 * Parrainages présidentiels 2027. Tente l'open data réel
 * (`/parrainages/2027.json`, Conseil constitutionnel) ; à défaut, renvoie un
 * **aperçu démo** déterministe clairement signalé (`demo: true`). Dès que le
 * fichier réel est déposé, l'aperçu disparaît automatiquement.
 */
export function useParrainages() {
  return useQuery({
    queryKey: ["parrainages-2027"],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ParrainagesData> => {
      try {
        const res = await fetch(dataUrl("/parrainages/2027.json"));
        if (res.ok) {
          const real = (await res.json()) as ParrainagesData;
          return { ...real, demo: false };
        }
      } catch {
        /* pas encore de données réelles */
      }
      return buildDemo();
    },
  });
}
