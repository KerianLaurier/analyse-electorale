"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Notes de terrain — persistées côté serveur (table `notes`). Personnelles
 * ou partagées avec l'équipe (visibles par tous les membres via RLS, éditables
 * par leur auteur).
 */

export type NoteContext = { type: string; id: string; label: string; href: string };

export type Note = {
  id: string;
  authorId: string;
  title: string | null;
  body: string;
  context: NoteContext | null;
  teamId: string | null;
  shared: boolean;
  mine: boolean;
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  user_id: string;
  team_id: string | null;
  title: string | null;
  body: string;
  context_type: string | null;
  context_id: string | null;
  context_label: string | null;
  context_href: string | null;
  created_at: string;
  updated_at: string;
};

let myUserId: string | null = null;
let myTeamId: string | null = null;
let notes: Note[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: Note[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(r: Row): Note {
  return {
    id: r.id,
    authorId: r.user_id,
    title: r.title,
    body: r.body,
    context: r.context_type && r.context_id
      ? {
          type: r.context_type,
          id: r.context_id,
          label: r.context_label ?? r.context_id,
          href: r.context_href ?? "#",
        }
      : null,
    teamId: r.team_id,
    shared: r.team_id != null,
    mine: r.user_id === myUserId,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  myUserId = user?.id ?? null;
  if (!user) {
    myTeamId = null;
    notes = [];
    emit();
    return;
  }
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  myTeamId = (prof?.team_id as string | null) ?? null;
  const { data } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  notes = (data ?? []).map((r) => mapRow(r as Row));
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  createClient().auth.onAuthStateChange(() => void load());
}

export async function reloadNotes(): Promise<void> {
  await load();
}

export type NewNote = {
  title?: string | null;
  body: string;
  shared?: boolean;
  context?: NoteContext | null;
};

export async function addNote(input: NewNote): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  const team_id = input.shared && myTeamId ? myTeamId : null;
  const { data } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      team_id,
      title: input.title ?? null,
      body: input.body,
      context_type: input.context?.type ?? null,
      context_id: input.context?.id ?? null,
      context_label: input.context?.label ?? null,
      context_href: input.context?.href ?? null,
    })
    .select("*")
    .single();
  if (data) {
    notes = [mapRow(data as Row), ...notes];
    emit();
  }
}

export type NotePatch = { title?: string | null; body?: string; shared?: boolean };

export async function updateNote(id: string, patch: NotePatch): Promise<void> {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return;
  const prev = notes[idx];
  const next: Note = { ...prev, updatedAt: Date.now() };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.body !== undefined) next.body = patch.body;
  if (patch.shared !== undefined) {
    next.teamId = patch.shared && myTeamId ? myTeamId : null;
    next.shared = next.teamId != null;
  }
  notes = [next, ...notes.slice(0, idx), ...notes.slice(idx + 1)];
  emit();

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.body !== undefined) dbPatch.body = patch.body;
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && myTeamId ? myTeamId : null;

  const supabase = createClient();
  const { error } = await supabase.from("notes").update(dbPatch).eq("id", id);
  if (error) await load();
}

export async function deleteNote(id: string): Promise<void> {
  notes = notes.filter((n) => n.id !== id);
  emit();
  const supabase = createClient();
  await supabase.from("notes").delete().eq("id", id);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useNotes(): Note[] {
  return useSyncExternalStore(subscribe, () => notes, () => EMPTY);
}
