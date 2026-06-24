"use client";

import { useQuery } from "@tanstack/react-query";
import { dataUrl } from "@/lib/data-url";
import type { Scrutin } from "@/lib/url-state";

// Détail départemental figé (build-territory-detail.py) : candidats triés voix desc.
type DeptDetail = { l: string | null; i: number; v: number; e: number; c: [string | null, string | null, number, number][] };

export type SoireeCand = { label: string; nuance: string; voix: number };

export type SoireeDept = {
  code: string;
  libelle: string;
  inscrits: number;
  votants: number;
  exprimes: number;
  /** Nuance arrivée en tête dans le département. */
  winner: string;
  cands: SoireeCand[];
};

/**
 * Données départementales d'un scrutin pour le « mode soirée » : résultats par
 * candidat/nuance + totaux. Triées dans un ordre de dépouillement plausible (du
 * plus petit au plus grand département, comme un vrai soir d'élection) — ce qui
 * permet de simuler honnêtement le remplissage par sommes partielles réelles.
 *
 * Prêt à brancher un flux temps réel : il suffirait de remplacer cette source
 * par les remontées live (même forme de données) et de piloter la progression
 * par le taux de dépouillement réel.
 */
export function useSoireeData(scrutin: Scrutin, enabled = true) {
  return useQuery({
    enabled,
    staleTime: 60 * 60 * 1000,
    queryKey: ["soiree", scrutin],
    queryFn: async (): Promise<SoireeDept[]> => {
      const res = await fetch(dataUrl(`/electoral/detail/${scrutin}_departements.json`));
      if (!res.ok) return [];
      const data = (await res.json()) as Record<string, DeptDetail>;

      const depts: SoireeDept[] = [];
      for (const [code, t] of Object.entries(data)) {
        if (!(t.i > 0)) continue;
        const cands: SoireeCand[] = t.c
          .filter(([, nuance]) => nuance != null)
          .map(([label, nuance, voix]) => ({ label: label ?? "", nuance: nuance ?? "", voix }))
          .sort((a, b) => b.voix - a.voix);
        const byNuance = new Map<string, number>();
        for (const c of cands) byNuance.set(c.nuance, (byNuance.get(c.nuance) ?? 0) + c.voix);
        let winner = "";
        let best = -1;
        for (const [n, v] of byNuance) if (v > best) [best, winner] = [v, n];
        depts.push({
          code,
          libelle: t.l ?? code,
          inscrits: t.i,
          votants: t.v,
          exprimes: t.e,
          winner,
          cands,
        });
      }
      depts.sort((a, b) => a.inscrits - b.inscrits);
      return depts;
    },
  });
}
