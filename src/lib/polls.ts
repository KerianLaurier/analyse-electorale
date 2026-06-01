"use client";

import { useQuery } from "@tanstack/react-query";

export type Poll = {
  sondeur: string;
  date: string; // ISO
  echantillon: number | null;
  valeurs: Record<string, number>;
};

export type PollsData = {
  source: string;
  source_url: string;
  generated_at: string;
  candidates: string[];
  instituts: string[];
  n_polls: number;
  polls: Poll[];
};

export function usePolls2027() {
  return useQuery({
    queryKey: ["polls-2027"],
    queryFn: async (): Promise<PollsData> => {
      const res = await fetch("/sondages/polls-2027.json");
      if (!res.ok) throw new Error("Sondages 2027 introuvables");
      return (await res.json()) as PollsData;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export type SeriesPoint = { date: string; value: number };

/**
 * Construit, pour UN institut donné, une série temporelle par candidat
 * (moyenne des valeurs d'une même date — plusieurs hypothèses par vague).
 * « Même institut, même donnée » : on ne mélange jamais deux instituts.
 */
export function buildSeries(polls: Poll[], institut: string): Map<string, SeriesPoint[]> {
  const byCand = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const p of polls) {
    if (p.sondeur !== institut) continue;
    for (const [cand, val] of Object.entries(p.valeurs)) {
      let dates = byCand.get(cand);
      if (!dates) {
        dates = new Map();
        byCand.set(cand, dates);
      }
      const cur = dates.get(p.date) ?? { sum: 0, n: 0 };
      cur.sum += val;
      cur.n += 1;
      dates.set(p.date, cur);
    }
  }
  const out = new Map<string, SeriesPoint[]>();
  for (const [cand, dates] of byCand) {
    const pts = [...dates.entries()]
      .map(([date, { sum, n }]) => ({ date, value: Math.round((sum / n) * 10) / 10 }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    out.set(cand, pts);
  }
  return out;
}

/** Couleur d'un candidat selon le bloc (parti entre parenthèses du libellé). */
export function candidateColor(label: string): string {
  const p = label.toLowerCase();
  if (/\brn\b|\(rec\)|\(dlf\)|bardella|le pen|zemmour/.test(p)) return "#13294b"; // RN / ext. droite
  if (/\(lr\)|retailleau/.test(p)) return "#1e40af"; // droite
  if (/\(re\)|\(hor\)|\(ren\)|attal|philippe|macron/.test(p)) return "#f0a020"; // centre
  if (/\(le\)|\(eelv\)|tondelier|jadot/.test(p)) return "#16a34a"; // écolo
  if (/\(lfi\)|\(pcf\)|\(ps\)|\(pp\)|\(lo\)|m[ée]lenchon|roussel|glucksmann|faure/.test(p)) return "#dc2626"; // gauche
  return "#8a8a93";
}

/** Libellé court (sans le parti). */
export function candidateShort(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*/g, "").replace(/\[[a-z0-9]\]/g, "").trim() || label;
}
