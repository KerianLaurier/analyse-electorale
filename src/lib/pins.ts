"use client";

import { useMemo } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity } from "@/lib/identity";
import {
  getPrivateQueryClient as getQueryClient,
  usePrivateQuery as useQuery,
} from "@/lib/private-query";
import { toast } from "@/components/toaster";

/**
 * Territoires & personnes épinglés — persistés côté serveur (table `pins`).
 * Une épingle peut être personnelle (team_id null) ou partagée avec l'équipe
 * (team_id = équipe du compte). La RLS renvoie les épingles perso + celles
 * partagées par les coéquipiers.
 *
 * Adossé à TanStack Query. L'API publique exportée est INCHANGÉE. Écritures
 * optimistes avec rollback + toast d'erreur.
 */

export type PinType = "commune" | "circo" | "bureau" | "elu" | "candidat";

export type PinScope = "none" | "personal" | "team";

export type Pin = {
  type: PinType;
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  addedAt: number;
  /** Épingle visible parce que partagée par l'équipe. */
  shared: boolean;
  /** L'épingle (choisie pour l'affichage) appartient au compte courant. */
  mine: boolean;
};

export const PIN_TYPE_LABELS: Record<PinType, string> = {
  commune: "Commune",
  circo: "Circonscription",
  bureau: "Bureau de vote",
  elu: "Élu",
  candidat: "Candidat",
};

type Row = {
  type: string;
  item_id: string;
  label: string;
  sublabel: string | null;
  href: string;
  created_at: string;
  user_id: string;
  team_id: string | null;
};

/** Données brutes mises en cache : lignes + contexte d'identité pour le calcul. */
type PinsData = {
  rows: Row[];
  userId: string | null;
  teamId: string | null;
};

const PINS_KEY = ["pins"] as const;
const EMPTY: Pin[] = [];

const pinsQuery = {
  queryKey: PINS_KEY,
  queryFn: fetchPins,
  staleTime: 5 * 60 * 1000,
};

async function fetchPins(): Promise<PinsData> {
  const { userId, teamId } = await getIdentity();
  if (!userId) return { rows: [], userId: null, teamId: null };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pins")
    .select("type,item_id,label,sublabel,href,created_at,user_id,team_id")
    .order("created_at", { ascending: false });
  if (error) throw error; // remonte l'échec de lecture → état d'erreur
  return { rows: (data ?? []) as Row[], userId, teamId };
}

const key = (type: string, id: string) => `${type}:${id}`;

/** Liste affichée (dédupliquée par item, mes épingles prioritaires sur celles d'équipe). */
function toDisplay(data: PinsData): Pin[] {
  const chosen = new Map<string, Row>();
  for (const r of data.rows) {
    const k = key(r.type, r.item_id);
    const prev = chosen.get(k);
    if (!prev) {
      chosen.set(k, r);
      continue;
    }
    const prevMine = prev.user_id === data.userId;
    const curMine = r.user_id === data.userId;
    if (curMine && !prevMine) chosen.set(k, r);
  }
  return [...chosen.values()]
    .map((r) => ({
      type: r.type as PinType,
      id: r.item_id,
      label: r.label,
      sublabel: r.sublabel ?? undefined,
      href: r.href,
      addedAt: new Date(r.created_at).getTime(),
      shared: r.team_id != null,
      mine: r.user_id === data.userId,
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** Scope de MA propre épingle pour cet item (ignore celles des coéquipiers). */
function myScopeOf(type: PinType, id: string, data: PinsData): PinScope {
  const mine = data.rows.find(
    (r) => r.type === type && r.item_id === id && r.user_id === data.userId,
  );
  if (!mine) return "none";
  return mine.team_id != null ? "team" : "personal";
}

/** Recalcule les lignes après une écriture optimiste (upsert / suppression). */
function applyOptimistic(
  data: PinsData,
  pin: Omit<Pin, "addedAt" | "shared" | "mine">,
  scope: PinScope,
): PinsData {
  const userId = data.userId;
  let rows = data.rows.filter(
    (r) =>
      !(r.type === pin.type && r.item_id === pin.id && r.user_id === userId),
  );
  if (scope !== "none" && userId) {
    rows = [
      {
        type: pin.type,
        item_id: pin.id,
        label: pin.label,
        sublabel: pin.sublabel ?? null,
        href: pin.href,
        created_at: new Date().toISOString(),
        user_id: userId,
        team_id: scope === "team" ? data.teamId : null,
      },
      ...rows,
    ];
  }
  return { ...data, rows };
}

/** Définit le scope de mon épingle : aucune / perso / partagée équipe. */
export async function setPinScope(
  pin: Omit<Pin, "addedAt" | "shared" | "mine">,
  scope: PinScope,
): Promise<void> {
  const { userId, teamId } = await getIdentity();
  const privateClient = getQueryClient();
  if (!userId) return;
  if (scope === "team" && !teamId) scope = "personal"; // garde-fou : pas d'équipe

  const qc = privateClient;
  const base: PinsData = qc.getQueryData<PinsData>(PINS_KEY) ?? {
    rows: [],
    userId,
    teamId,
  };
  qc.setQueryData<PinsData>(
    PINS_KEY,
    applyOptimistic({ ...base, userId, teamId }, pin, scope),
  );

  const supabase = createClient();
  if (scope === "none") {
    const { error } = await supabase
      .from("pins")
      .delete()
      .eq("user_id", userId)
      .eq("type", pin.type)
      .eq("item_id", pin.id);
    if (error) {
      await qc.invalidateQueries({ queryKey: PINS_KEY }); // rollback : l'épingle réapparaît
      toast.error("Épingle non retirée — réessayez.");
    }
    return;
  }
  const { error } = await supabase.from("pins").upsert(
    {
      user_id: userId,
      type: pin.type,
      item_id: pin.id,
      label: pin.label,
      sublabel: pin.sublabel ?? null,
      href: pin.href,
      team_id: scope === "team" ? teamId : null,
    },
    { onConflict: "user_id,type,item_id" },
  );
  if (error) {
    await qc.invalidateQueries({ queryKey: PINS_KEY }); // rollback : on recharge l'état serveur
    toast.error("Épingle non enregistrée — réessayez.");
  }
}

/** Épingle / désépingle (personnel). Renvoie le nouvel état épinglé. */
export async function togglePin(
  pin: Omit<Pin, "addedAt" | "shared" | "mine">,
): Promise<boolean> {
  const privateClient = getQueryClient();
  const data = privateClient.getQueryData<PinsData>(PINS_KEY);
  const current = data ? myScopeOf(pin.type, pin.id, data) : "none";
  if (current === "none") {
    await setPinScope(pin, "personal");
    return true;
  }
  await setPinScope(pin, "none");
  return false;
}

export async function removePin(type: PinType, id: string): Promise<void> {
  const privateClient = getQueryClient();
  const data = privateClient.getQueryData<PinsData>(PINS_KEY);
  const p = data
    ? toDisplay(data).find((x) => x.type === type && x.id === id && x.mine)
    : undefined;
  if (p) await setPinScope(p, "none");
}

/** Force un rechargement (ex. après création / changement d'équipe). */
export async function reloadPins(): Promise<void> {
  const privateClient = getQueryClient();
  await privateClient.refetchQueries({ queryKey: PINS_KEY, type: "all" });
}

/** Y a-t-il une épingle (perso ou équipe) visible pour cet item ? (synchrone) */
export function isPinned(type: PinType, id: string): boolean {
  const data = getQueryClient().getQueryData<PinsData>(PINS_KEY);
  if (!data) return false;
  return toDisplay(data).some((p) => p.type === type && p.id === id);
}

function usePinsData(): PinsData | undefined {
  return useQuery(pinsQuery).data;
}

/** Liste réactive des épingles visibles (perso + équipe, dédupliquées). */
export function usePins(): Pin[] {
  const data = usePinsData();
  return useMemo(() => (data ? toDisplay(data) : EMPTY), [data]);
}

/** État réactif : une épingle (perso ou équipe) existe-t-elle pour cet item ? */
export function useIsPinned(type: PinType, id: string): boolean {
  return usePins().some((p) => p.type === type && p.id === id);
}

/** Scope réactif de MON épingle pour cet item. */
export function useMyPinScope(type: PinType, id: string): PinScope {
  const data = usePinsData();
  return data ? myScopeOf(type, id, data) : "none";
}

/** Identifiant réactif de l'équipe du compte (null si aucune). */
export function useMyTeamId(): string | null {
  return usePinsData()?.teamId ?? null;
}

/** État de chargement d'un onglet : `loaded` (après hydratation), `error`, `retry`. */
export function useLoadState() {
  const q = useQuery(pinsQuery);
  const hydrated = useHydrated();
  return {
    loaded: q.isSuccess && hydrated,
    error: q.isError,
    retry: () => {
      void q.refetch();
    },
  };
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  return useLoadState().loaded;
}
