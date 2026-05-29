"use client";

import { useQuery } from "@tanstack/react-query";

export type Depute = {
  circo: string;
  uid: string | null;
  civ: string | null;
  prenom: string | null;
  nom: string | null;
  sexe: "M" | "F" | null;
  groupe: string | null;
  groupeLib: string | null;
  groupeColor: string | null;
  position: string | null;
  depuis: string | null;
};

type DeputesPayload = {
  source: string;
  legislature: number;
  generated_at: string;
  n: number;
  deputes: Depute[];
};

/** Référentiel des députés en exercice (open data AN), indexé par circonscription. */
export function useDeputes(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["deputes-an"],
    queryFn: async (): Promise<Map<string, Depute>> => {
      const res = await fetch("/an/deputes.json");
      if (!res.ok) throw new Error("Référentiel députés introuvable");
      const payload = (await res.json()) as DeputesPayload;
      return new Map(payload.deputes.map((d) => [d.circo, d]));
    },
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
