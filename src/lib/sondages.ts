"use client";

import { useQuery } from "@tanstack/react-query";

export type ScrutinCode =
  | "presidentielle"
  | "municipales"
  | "legislatives"
  | "europeennes"
  | "regionales"
  | "departementales"
  | "senatoriales"
  | "referendum"
  | "autre";

export type NatureCode = "intentions" | "popularite" | "barometre" | "thematique";

export type Notice = {
  numero: string | null;
  label: string;
  scrutin: ScrutinCode;
  scrutin_label: string;
  institut: string | null;
  media: string | null;
  nature: NatureCode;
  nature_label: string;
  date: string | null;
  pdf: string;
};

export type NoticesData = {
  source: string;
  source_url: string;
  license: string;
  generated_at: string;
  n_notices: number;
  by_scrutin: Record<string, number>;
  notices: Notice[];
};

export function useNotices() {
  return useQuery({
    queryKey: ["cncs-notices"],
    queryFn: async (): Promise<NoticesData> => {
      const res = await fetch("/sondages/notices.json");
      if (!res.ok) throw new Error("Notices CNCS introuvables");
      return (await res.json()) as NoticesData;
    },
    staleTime: 60 * 60 * 1000, // 1 h
  });
}

/** Nettoie le libellé brut CNCS pour l'affichage (retire institut + date). */
export function cleanLabel(notice: Notice): string {
  let s = notice.label;
  // Retire le préfixe scrutin (Pres, Mun, Leg…)
  s = s.replace(
    /^(pr[eé]s|mun|l[eé]g|euro|r[eé]g|d[eé]p|s[eé]nat)[a-zéè]*\.?\s*/i,
    "",
  );
  // Retire l'institut (en majuscules) s'il est détecté
  if (notice.institut) {
    const re = new RegExp(notice.institut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    s = s.replace(re, "");
  }
  // Retire la date finale "JJ mois"
  s = s.replace(
    /\s*\d{1,2}\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre).*$/i,
    "",
  );
  s = s.replace(/\s+/g, " ").trim();
  return s || notice.label;
}

export function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function relativeFr(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";

  // Passé vs futur
  const future = days < 0;
  const n = Math.abs(days);
  const fmt = (val: string) => (future ? `dans ${val}` : `il y a ${val}`);

  if (n === 1) return future ? "demain" : "hier";
  if (n < 31) return fmt(`${n} j`);
  const months = Math.round(n / 30);
  if (months < 12) return fmt(`${months} mois`);
  return fmt(`${Math.round(months / 12)} an(s)`);
}
