"use client";

import { useQuery } from "@tanstack/react-query";
import { parquetUrl, query } from "@/lib/duckdb";
import type { Scrutin } from "@/lib/url-state";

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
      const candUrl = parquetUrl(`agg/${scrutin}_candidats.parquet`);
      const terrUrl = parquetUrl(`agg/${scrutin}_territoires.parquet`);

      const terr = await query<{ code: string; libelle: string | null; inscrits: number; votants: number; exprimes: number }>(
        `SELECT code, libelle, inscrits, votants, exprimes
         FROM read_parquet('${terrUrl}')
         WHERE maille = ? AND inscrits > 0`,
        ["departements"],
      );
      const cand = await query<{ code: string; nuance: string | null; label: string | null; voix: number }>(
        `SELECT code, nuance, label, SUM(voix) AS voix
         FROM read_parquet('${candUrl}')
         WHERE maille = ? AND nuance IS NOT NULL AND voix IS NOT NULL
         GROUP BY code, nuance, label`,
        ["departements"],
      );

      const byDept = new Map<string, SoireeCand[]>();
      for (const r of cand) {
        const code = String(r.code);
        const arr = byDept.get(code) ?? [];
        arr.push({ label: r.label ?? "", nuance: r.nuance ?? "", voix: Number(r.voix) });
        byDept.set(code, arr);
      }

      const depts: SoireeDept[] = terr.map((t) => {
        const cands = (byDept.get(String(t.code)) ?? []).sort((a, b) => b.voix - a.voix);
        const byNuance = new Map<string, number>();
        for (const c of cands) byNuance.set(c.nuance, (byNuance.get(c.nuance) ?? 0) + c.voix);
        let winner = "";
        let best = -1;
        for (const [n, v] of byNuance) if (v > best) [best, winner] = [v, n];
        return {
          code: String(t.code),
          libelle: t.libelle ?? String(t.code),
          inscrits: Number(t.inscrits),
          votants: Number(t.votants),
          exprimes: Number(t.exprimes),
          winner,
          cands,
        };
      });

      depts.sort((a, b) => a.inscrits - b.inscrits);
      return depts;
    },
  });
}
