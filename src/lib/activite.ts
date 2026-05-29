"use client";

import { useQuery } from "@tanstack/react-query";

export type ActiviteScrutin = {
  numero: string | null;
  date: string | null;
  titre: string | null;
  sort: string | null;
  type: string | null;
};

export type DeputeActivite = {
  /** Positions alignées sur `scrutins` : P/C/A/N/. (1 caractère par scrutin). */
  v: string;
  /** Participation (P/C/A sur le total des scrutins). */
  p: number;
  /** Loyauté au groupe (null si non calculable). */
  l: number | null;
  present: number;
};

export type ActivitePayload = {
  source: string;
  legislature: number;
  generated_at: string;
  n_scrutins: number;
  scrutins: ActiviteScrutin[];
  deputes: Record<string, DeputeActivite>;
};

export type VotePosition = "pour" | "contre" | "abstention" | "nonVotant" | "absent";

const CHAR_TO_POSITION: Record<string, VotePosition> = {
  P: "pour",
  C: "contre",
  A: "abstention",
  N: "nonVotant",
  ".": "absent",
};

export function decodePosition(char: string): VotePosition {
  return CHAR_TO_POSITION[char] ?? "absent";
}

export const POSITION_META: Record<VotePosition, { label: string; color: string; bg: string }> = {
  pour: { label: "Pour", color: "#047857", bg: "#ecfdf5" },
  contre: { label: "Contre", color: "#b91c1c", bg: "#fef2f2" },
  abstention: { label: "Abstention", color: "#a16207", bg: "#fefce8" },
  nonVotant: { label: "Non-votant", color: "#64748b", bg: "#f1f5f9" },
  absent: { label: "Absent", color: "#94a3b8", bg: "#f8fafc" },
};

/** Activité parlementaire (votes solennels & motions de censure, open data AN). */
export function useDeputesActivite(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["deputes-activite"],
    queryFn: async (): Promise<ActivitePayload> => {
      const res = await fetch("/an/deputes-activite.json");
      if (!res.ok) throw new Error("Activité parlementaire introuvable");
      return (await res.json()) as ActivitePayload;
    },
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
