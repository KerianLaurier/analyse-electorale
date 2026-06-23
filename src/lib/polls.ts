"use client";

import { useQuery } from "@tanstack/react-query";
import { dataUrl } from "@/lib/data-url";

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
      const res = await fetch(dataUrl("/sondages/polls-2027.json"));
      if (!res.ok) throw new Error("Sondages 2027 introuvables");
      return (await res.json()) as PollsData;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export type SeriesPoint = { date: string; value: number };

/**
 * Construit, pour UN institut donné, une série temporelle par candidat :
 * un point par vague (date), moyenne des hypothèses publiées ce jour-là.
 * `since` (ISO) filtre l'historique (ex. dernière année).
 * « Même institut, même donnée » : on ne mélange jamais deux instituts.
 */
export function buildSeries(polls: Poll[], institut: string, since?: string): Map<string, SeriesPoint[]> {
  const byCand = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const p of polls) {
    if (p.sondeur !== institut) continue;
    if (since && p.date < since) continue;
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

const accentless = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Couleur DISTINCTE par candidat (teinte proche de la famille, mais unique). */
const CANDIDATE_COLORS: Record<string, string> = {
  // Extrême droite / RN
  "le pen": "#1d2c54", "candidat rn": "#1d2c54", bardella: "#46598c", zemmour: "#7c3aed",
  // Droite
  retailleau: "#2563eb", "candidat lr": "#2563eb", "candidat rpr": "#1e3a8a", wauquiez: "#60a5fa",
  // Centre / macronie
  attal: "#f0a020", macron: "#d97706", "candidat re": "#f0a020", philippe: "#0d9488", villepin: "#b45309",
  // Gauche
  melenchon: "#dc2626", "candidat lfi": "#dc2626", "candidat evg": "#f87171",
  roussel: "#9f1239", glucksmann: "#db2777", "candidat ps / pp": "#db2777", faure: "#e11d48",
  // Écologistes
  tondelier: "#16a34a", jadot: "#4d7c0f", "candidat eelv": "#16a34a",
  // Divers
  "dupont-aignan": "#0891b2", arthaud: "#7f1d1d", poutou: "#991b1b", autre: "#9ca3af",
};
const FALLBACK = ["#0ea5e9", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

export function candidateColor(label: string): string {
  const k = accentless(candidateShort(label));
  if (CANDIDATE_COLORS[k]) return CANDIDATE_COLORS[k];
  // Couleur stable dérivée du nom (candidats hors liste).
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

/**
 * Éclaircit une couleur trop sombre pour rester lisible sur fond sombre
 * (mélange vers le blanc proportionnel au déficit de luminance). No-op en clair
 * ou si la couleur est déjà assez claire — la teinte (famille) est préservée.
 */
export function readableColor(hex: string, isDark: boolean): string {
  if (!isDark) return hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.4) return hex;
  const t = ((0.4 - lum) / 0.4) * 0.6; // jusqu'à 60 % vers le blanc
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Libellé court (sans le parti). */
export function candidateShort(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*/g, "").replace(/\[[a-z0-9]\]/g, "").trim() || label;
}
