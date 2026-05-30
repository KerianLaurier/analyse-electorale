"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Territoires & personnes épinglés — persistés côté serveur (table `pins`).
 * Une épingle peut être personnelle (team_id null) ou partagée avec l'équipe
 * (team_id = équipe du compte). La RLS renvoie les épingles perso + celles
 * partagées par les coéquipiers. Store réactif (useSyncExternalStore) avec
 * écritures optimistes.
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

let myUserId: string | null = null;
let myTeamId: string | null = null;
let rows: Row[] = [];
let display: Pin[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: Pin[] = [];

function emit() {
  listeners.forEach((l) => l());
}

const key = (type: string, id: string) => `${type}:${id}`;

/** Recalcule la liste affichée (dédupliquée par item, mes épingles prioritaires). */
function recompute() {
  const chosen = new Map<string, Row>();
  for (const r of rows) {
    const k = key(r.type, r.item_id);
    const prev = chosen.get(k);
    if (!prev) {
      chosen.set(k, r);
      continue;
    }
    // Priorité à ma propre épingle pour refléter mon scope éditable.
    const prevMine = prev.user_id === myUserId;
    const curMine = r.user_id === myUserId;
    if (curMine && !prevMine) chosen.set(k, r);
  }
  display = [...chosen.values()]
    .map((r) => ({
      type: r.type as PinType,
      id: r.item_id,
      label: r.label,
      sublabel: r.sublabel ?? undefined,
      href: r.href,
      addedAt: new Date(r.created_at).getTime(),
      shared: r.team_id != null,
      mine: r.user_id === myUserId,
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  myUserId = user?.id ?? null;
  if (!user) {
    myTeamId = null;
    rows = [];
    recompute();
    emit();
    return;
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .single();
  myTeamId = (prof?.team_id as string | null) ?? null;

  const { data } = await supabase
    .from("pins")
    .select("type,item_id,label,sublabel,href,created_at,user_id,team_id")
    .order("created_at", { ascending: false });
  rows = (data ?? []) as Row[];
  recompute();
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  // Recharge quand la session change (connexion / déconnexion).
  createClient().auth.onAuthStateChange(() => void load());
}

/** Force un rechargement (ex. après création / changement d'équipe). */
export async function reloadPins(): Promise<void> {
  await load();
}

/** Y a-t-il une épingle (perso ou équipe) visible pour cet item ? */
export function isPinned(type: PinType, id: string): boolean {
  return display.some((p) => p.type === type && p.id === id);
}

/** Scope de MA propre épingle pour cet item (ignore celles des coéquipiers). */
function myScopeOf(type: PinType, id: string): PinScope {
  const mine = rows.find((r) => r.type === type && r.item_id === id && r.user_id === myUserId);
  if (!mine) return "none";
  return mine.team_id != null ? "team" : "personal";
}

function applyOptimistic(pin: Omit<Pin, "addedAt" | "shared" | "mine">, scope: PinScope) {
  rows = rows.filter((r) => !(r.type === pin.type && r.item_id === pin.id && r.user_id === myUserId));
  if (scope !== "none" && myUserId) {
    rows = [
      {
        type: pin.type,
        item_id: pin.id,
        label: pin.label,
        sublabel: pin.sublabel ?? null,
        href: pin.href,
        created_at: new Date().toISOString(),
        user_id: myUserId,
        team_id: scope === "team" ? myTeamId : null,
      },
      ...rows,
    ];
  }
  recompute();
  emit();
}

/** Définit le scope de mon épingle : aucune / perso / partagée équipe. */
export async function setPinScope(
  pin: Omit<Pin, "addedAt" | "shared" | "mine">,
  scope: PinScope,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  if (scope === "team" && !myTeamId) scope = "personal"; // garde-fou : pas d'équipe

  applyOptimistic(pin, scope);

  if (scope === "none") {
    await supabase.from("pins").delete().eq("user_id", user.id).eq("type", pin.type).eq("item_id", pin.id);
    return;
  }
  await supabase.from("pins").upsert(
    {
      user_id: user.id,
      type: pin.type,
      item_id: pin.id,
      label: pin.label,
      sublabel: pin.sublabel ?? null,
      href: pin.href,
      team_id: scope === "team" ? myTeamId : null,
    },
    { onConflict: "user_id,type,item_id" },
  );
}

/** Épingle / désépingle (personnel). Renvoie le nouvel état épinglé. */
export async function togglePin(pin: Omit<Pin, "addedAt" | "shared" | "mine">): Promise<boolean> {
  const current = myScopeOf(pin.type, pin.id);
  if (current === "none") {
    await setPinScope(pin, "personal");
    return true;
  }
  await setPinScope(pin, "none");
  return false;
}

export async function removePin(type: PinType, id: string): Promise<void> {
  const p = display.find((x) => x.type === type && x.id === id && x.mine);
  if (p) await setPinScope(p, "none");
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

/** Liste réactive des épingles visibles (perso + équipe, dédupliquées). */
export function usePins(): Pin[] {
  return useSyncExternalStore(subscribe, () => display, () => EMPTY);
}

/** État réactif : une épingle (perso ou équipe) existe-t-elle pour cet item ? */
export function useIsPinned(type: PinType, id: string): boolean {
  return usePins().some((p) => p.type === type && p.id === id);
}

/** Scope réactif de MON épingle pour cet item. */
export function useMyPinScope(type: PinType, id: string): PinScope {
  usePins(); // souscription au store
  return myScopeOf(type, id);
}

/** Identifiant réactif de l'équipe du compte (null si aucune). */
export function useMyTeamId(): string | null {
  usePins();
  return myTeamId;
}
