"use client";

import { useQuery } from "@tanstack/react-query";

// ─── Votes AN ───────────────────────────────────────────────────────────────

export type VoteAN = {
  numero: string | null;
  date: string | null;
  titre: string | null;
  sort: string | null;
  sort_libelle: string | null;
  type: string | null;
  demandeur: string | null;
  votants: number;
  exprimes: number;
  pour: number;
  contre: number;
  abstentions: number;
};

export type VotesANData = {
  source: string;
  source_url: string;
  legislature: number;
  generated_at: string;
  n_total: number;
  n_kept: number;
  votes: VoteAN[];
};

export function useVotesAN() {
  return useQuery({
    queryKey: ["suivi", "votes-an"],
    queryFn: async (): Promise<VotesANData> => {
      const res = await fetch("/suivi/votes-an.json");
      if (!res.ok) throw new Error("Votes AN introuvables");
      return (await res.json()) as VotesANData;
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Lois & PPL ─────────────────────────────────────────────────────────────

export type Loi = {
  uid: string | null;
  titre: string;
  type_code: string | null;
  type: string | null;
  date: string | null;
  date_depot: string | null;
  stade: string | null;
  n_actes: number;
  url: string | null;
};

export type LoisData = {
  source: string;
  source_url: string;
  legislature: number;
  generated_at: string;
  n_total: number;
  n_kept: number;
  lois: Loi[];
};

export function useLois() {
  return useQuery({
    queryKey: ["suivi", "lois"],
    queryFn: async (): Promise<LoisData> => {
      const res = await fetch("/suivi/lois.json");
      if (!res.ok) throw new Error("Lois introuvables");
      return (await res.json()) as LoisData;
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Agenda ─────────────────────────────────────────────────────────────────

export type AgendaEvent = {
  date: string;
  titre: string;
  type: "scrutin" | "echeance" | "campagne";
  scrutin?: string;
  detail?: string;
  passe?: boolean;
};

export type AgendaData = {
  source: string;
  generated_at: string;
  n: number;
  evenements: AgendaEvent[];
};

export function useAgenda() {
  return useQuery({
    queryKey: ["suivi", "agenda"],
    queryFn: async (): Promise<AgendaData> => {
      const res = await fetch("/suivi/agenda.json");
      if (!res.ok) throw new Error("Agenda introuvable");
      return (await res.json()) as AgendaData;
    },
    staleTime: 12 * 60 * 60 * 1000,
  });
}
