"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Permanences / créneaux de terrain d'une campagne — table `shifts` + table
 * `shift_signups` (inscriptions des bénévoles). Personnels ou partagés équipe
 * (RLS). Tout membre peut s'inscrire / se désinscrire d'un créneau d'équipe.
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

let myUserId: string | null = null;
let myTeamId: string | null = null;
let shifts: Shift[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: Shift[] = [];

function emit() {
  listeners.forEach((l) => l());
}

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  myUserId = user?.id ?? null;
  if (!user) {
    myTeamId = null;
    shifts = [];
    emit();
    return;
  }
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  myTeamId = (prof?.team_id as string | null) ?? null;

  const [{ data: rows }, { data: signupRows }] = await Promise.all([
    supabase.from("shifts").select("*").order("date", { ascending: true }),
    supabase.from("shift_signups").select("shift_id, user_id"),
  ]);

  const byShift = new Map<string, string[]>();
  for (const s of (signupRows ?? []) as SignupRow[]) {
    const arr = byShift.get(s.shift_id) ?? [];
    arr.push(s.user_id);
    byShift.set(s.shift_id, arr);
  }

  shifts = ((rows ?? []) as ShiftRow[]).map((r) => {
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
      mine: r.user_id === myUserId,
      signups,
      joined: myUserId != null && signups.includes(myUserId),
      createdAt: new Date(r.created_at).getTime(),
    };
  });
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  createClient().auth.onAuthStateChange(() => void load());
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  const team_id = input.shared && myTeamId ? myTeamId : null;
  const { data } = await supabase
    .from("shifts")
    .insert({
      user_id: user.id,
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
  if (data) await load();
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
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.kind !== undefined) dbPatch.kind = patch.kind;
  if (patch.date !== undefined) dbPatch.date = patch.date;
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime;
  if (patch.location !== undefined) dbPatch.location = patch.location;
  if (patch.capacity !== undefined) dbPatch.capacity = patch.capacity;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && myTeamId ? myTeamId : null;
  const supabase = createClient();
  await supabase.from("shifts").update(dbPatch).eq("id", id);
  await load();
}

export async function deleteShift(id: string): Promise<void> {
  shifts = shifts.filter((s) => s.id !== id);
  emit();
  const supabase = createClient();
  await supabase.from("shifts").delete().eq("id", id);
}

function setJoinedLocal(id: string, joined: boolean) {
  const idx = shifts.findIndex((s) => s.id === id);
  if (idx < 0 || !myUserId) return;
  const s = shifts[idx];
  const signups = joined
    ? s.signups.includes(myUserId) ? s.signups : [...s.signups, myUserId]
    : s.signups.filter((u) => u !== myUserId);
  shifts = [...shifts.slice(0, idx), { ...s, signups, joined }, ...shifts.slice(idx + 1)];
  emit();
}

export async function joinShift(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  const shift = shifts.find((s) => s.id === id);
  setJoinedLocal(id, true);
  await supabase
    .from("shift_signups")
    .insert({ shift_id: id, user_id: user.id, team_id: shift?.teamId ?? null });
}

export async function leaveShift(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  setJoinedLocal(id, false);
  await supabase.from("shift_signups").delete().eq("shift_id", id).eq("user_id", user.id);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useShifts(): Shift[] {
  return useSyncExternalStore(subscribe, () => shifts, () => EMPTY);
}
