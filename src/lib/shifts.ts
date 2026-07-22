"use client";

import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity, onIdentityChange } from "@/lib/identity";
import { getQueryClient } from "@/providers/query-provider";

/**
 * Permanences / créneaux de terrain d'une campagne — table `shifts` + table
 * `shift_signups` (inscriptions des bénévoles). Personnels ou partagés équipe
 * (RLS). Tout membre peut s'inscrire / se désinscrire d'un créneau d'équipe.
 *
 * Adossé à TanStack Query (cf. migration des stores, pilote `pins`). API publique
 * inchangée ; inscriptions optimistes, créations/éditions par refetch.
 */

export type ShiftKind = "porte" | "boitage" | "collage" | "tractage" | "permanence" | "reunion" | "autre";

export type Shift = {
  id: string;
  title: string;
  kind: ShiftKind;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  capacity: number | null;
  notes: string | null;
  teamId: string | null;
  shared: boolean;
  mine: boolean;
  signups: string[];
  joined: boolean;
  createdAt: number;
};

export const SHIFT_KIND_LABELS: Record<ShiftKind, string> = {
  porte: "Porte-à-porte",
  boitage: "Boîtage",
  collage: "Collage / affichage",
  tractage: "Tractage",
  permanence: "Permanence",
  reunion: "Réunion",
  autre: "Autre",
};

type ShiftRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  title: string;
  kind: ShiftKind;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  notes: string | null;
  created_at: string;
};

type SignupRow = { shift_id: string; user_id: string };

const SHIFTS_KEY = ["shifts"] as const;
const EMPTY: Shift[] = [];

const shiftsQuery = {
  queryKey: SHIFTS_KEY,
  queryFn: fetchShifts,
  staleTime: 5 * 60 * 1000,
};

async function fetchShifts(): Promise<Shift[]> {
  const { userId } = await getIdentity();
  if (!userId) return [];
  const supabase = createClient();
  const [{ data: rows, error: e1 }, { data: signupRows, error: e2 }] = await Promise.all([
    supabase.from("shifts").select("*").order("date", { ascending: true }),
    supabase.from("shift_signups").select("shift_id, user_id"),
  ]);
  if (e1 || e2) throw e1 ?? e2; // remonte l'échec de lecture → état d'erreur

  const byShift = new Map<string, string[]>();
  for (const s of (signupRows ?? []) as SignupRow[]) {
    const arr = byShift.get(s.shift_id) ?? [];
    arr.push(s.user_id);
    byShift.set(s.shift_id, arr);
  }

  return ((rows ?? []) as ShiftRow[]).map((r) => {
    const signups = byShift.get(r.id) ?? [];
    return {
      id: r.id,
      title: r.title,
      kind: r.kind,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      location: r.location,
      capacity: r.capacity,
      notes: r.notes,
      teamId: r.team_id,
      shared: r.team_id != null,
      mine: r.user_id === userId,
      signups,
      joined: signups.includes(userId),
      createdAt: new Date(r.created_at).getTime(),
    };
  });
}

let identityWired = false;
function ensureIdentityWired() {
  if (identityWired || typeof window === "undefined") return;
  identityWired = true;
  onIdentityChange(() => {
    void getQueryClient().invalidateQueries({ queryKey: SHIFTS_KEY });
  });
}

export type NewShift = {
  title: string;
  kind?: ShiftKind;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  capacity?: number | null;
  notes?: string | null;
  shared?: boolean;
};

export async function addShift(input: NewShift): Promise<void> {
  const { userId, teamId } = await getIdentity();
  if (!userId) return;
  const supabase = createClient();
  const team_id = input.shared && teamId ? teamId : null;
  const { data } = await supabase
    .from("shifts")
    .insert({
      user_id: userId,
      team_id,
      title: input.title,
      kind: input.kind ?? "porte",
      date: input.date,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      location: input.location ?? null,
      capacity: input.capacity ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (data) await getQueryClient().refetchQueries({ queryKey: SHIFTS_KEY, type: "all" });
}

export type ShiftPatch = {
  title?: string;
  kind?: ShiftKind;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  capacity?: number | null;
  notes?: string | null;
  shared?: boolean;
};

export async function updateShift(id: string, patch: ShiftPatch): Promise<void> {
  const { teamId } = await getIdentity();
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.kind !== undefined) dbPatch.kind = patch.kind;
  if (patch.date !== undefined) dbPatch.date = patch.date;
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime;
  if (patch.location !== undefined) dbPatch.location = patch.location;
  if (patch.capacity !== undefined) dbPatch.capacity = patch.capacity;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && teamId ? teamId : null;
  const supabase = createClient();
  await supabase.from("shifts").update(dbPatch).eq("id", id);
  await getQueryClient().refetchQueries({ queryKey: SHIFTS_KEY, type: "all" });
}

export async function deleteShift(id: string): Promise<void> {
  const qc = getQueryClient();
  qc.setQueryData<Shift[]>(SHIFTS_KEY, (old) => (old ?? []).filter((s) => s.id !== id));
  const supabase = createClient();
  await supabase.from("shifts").delete().eq("id", id);
}

function setJoinedLocal(id: string, joined: boolean, userId: string) {
  const qc = getQueryClient();
  qc.setQueryData<Shift[]>(SHIFTS_KEY, (old) => {
    if (!old) return old;
    const idx = old.findIndex((s) => s.id === id);
    if (idx < 0) return old;
    const s = old[idx];
    const signups = joined
      ? s.signups.includes(userId) ? s.signups : [...s.signups, userId]
      : s.signups.filter((u) => u !== userId);
    return [...old.slice(0, idx), { ...s, signups, joined }, ...old.slice(idx + 1)];
  });
}

export async function joinShift(id: string): Promise<void> {
  const { userId } = await getIdentity();
  if (!userId) return;
  const shift = getQueryClient().getQueryData<Shift[]>(SHIFTS_KEY)?.find((s) => s.id === id);
  setJoinedLocal(id, true, userId);
  const supabase = createClient();
  await supabase
    .from("shift_signups")
    .insert({ shift_id: id, user_id: userId, team_id: shift?.teamId ?? null });
}

export async function leaveShift(id: string): Promise<void> {
  const { userId } = await getIdentity();
  if (!userId) return;
  setJoinedLocal(id, false, userId);
  const supabase = createClient();
  await supabase.from("shift_signups").delete().eq("shift_id", id).eq("user_id", userId);
}

function useShiftsQuery() {
  ensureIdentityWired();
  return useQuery(shiftsQuery);
}

export function useShifts(): Shift[] {
  return useShiftsQuery().data ?? EMPTY;
}

/** État de chargement d'un onglet : `loaded` (après hydratation), `error`, `retry`. */
export function useLoadState() {
  const q = useShiftsQuery();
  const hydrated = useHydrated();
  return { loaded: q.isSuccess && hydrated, error: q.isError, retry: () => { void q.refetch(); } };
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  return useLoadState().loaded;
}
