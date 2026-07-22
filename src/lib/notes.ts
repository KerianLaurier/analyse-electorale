"use client";

import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity, onIdentityChange } from "@/lib/identity";
import { getQueryClient } from "@/providers/query-provider";
import { toast } from "@/components/toaster";

/**
 * Notes de terrain — persistées côté serveur (table `notes`). Personnelles
 * ou partagées avec l'équipe (visibles par tous les membres via RLS, éditables
 * par leur auteur).
 *
 * Adossé à TanStack Query (cf. migration des stores, pilote `pins`). API publique
 * inchangée ; mutations optimistes via le cache, rollback + toast d'erreur.
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

const NOTES_KEY = ["notes"] as const;
const EMPTY: Note[] = [];

const notesQuery = {
  queryKey: NOTES_KEY,
  queryFn: fetchNotes,
  staleTime: 5 * 60 * 1000,
};

function mapRow(r: Row, myUserId: string | null): Note {
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

async function fetchNotes(): Promise<Note[]> {
  const { userId } = await getIdentity();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error; // remonte l'échec de lecture → état d'erreur
  return (data ?? []).map((r) => mapRow(r as Row, userId));
}

let identityWired = false;
function ensureIdentityWired() {
  if (identityWired || typeof window === "undefined") return;
  identityWired = true;
  onIdentityChange(() => {
    void getQueryClient().invalidateQueries({ queryKey: NOTES_KEY });
  });
}

export async function reloadNotes(): Promise<void> {
  await getQueryClient().refetchQueries({ queryKey: NOTES_KEY, type: "all" });
}

export type NewNote = {
  title?: string | null;
  body: string;
  shared?: boolean;
  context?: NoteContext | null;
};

/** Ajoute une note. Renvoie false en cas d'échec (le formulaire reste rempli). */
export async function addNote(input: NewNote): Promise<boolean> {
  const { userId, teamId } = await getIdentity();
  if (!userId) return false;
  const supabase = createClient();
  const team_id = input.shared && teamId ? teamId : null;
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
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
  if (error || !data) {
    toast.error("Impossible d'ajouter la note — vérifiez votre connexion puis réessayez.");
    return false;
  }
  getQueryClient().setQueryData<Note[]>(NOTES_KEY, (old) => [mapRow(data as Row, userId), ...(old ?? [])]);
  return true;
}

export type NotePatch = { title?: string | null; body?: string; shared?: boolean };

export async function updateNote(id: string, patch: NotePatch): Promise<void> {
  const qc = getQueryClient();
  const { teamId } = await getIdentity();
  const current = qc.getQueryData<Note[]>(NOTES_KEY) ?? [];
  const idx = current.findIndex((n) => n.id === id);
  if (idx < 0) return;
  const prev = current[idx];
  const next: Note = { ...prev, updatedAt: Date.now() };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.body !== undefined) next.body = patch.body;
  if (patch.shared !== undefined) {
    next.teamId = patch.shared && teamId ? teamId : null;
    next.shared = next.teamId != null;
  }
  // Tri par updated_at desc : la note éditée remonte en tête.
  qc.setQueryData<Note[]>(NOTES_KEY, [next, ...current.slice(0, idx), ...current.slice(idx + 1)]);

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.body !== undefined) dbPatch.body = patch.body;
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && teamId ? teamId : null;

  const supabase = createClient();
  const { error } = await supabase.from("notes").update(dbPatch).eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: NOTES_KEY }); // rollback : on recharge l'état serveur
    toast.error("Modification non enregistrée — réessayez.");
  }
}

export async function deleteNote(id: string): Promise<void> {
  const qc = getQueryClient();
  qc.setQueryData<Note[]>(NOTES_KEY, (old) => (old ?? []).filter((n) => n.id !== id));
  const supabase = createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: NOTES_KEY }); // rollback : la note réapparaît
    toast.error("Suppression impossible — réessayez.");
  }
}

function useNotesQuery() {
  ensureIdentityWired();
  return useQuery(notesQuery);
}

export function useNotes(): Note[] {
  return useNotesQuery().data ?? EMPTY;
}

/** État de chargement d'un onglet : `loaded` (après hydratation), `error`, `retry`. */
export function useLoadState() {
  const q = useNotesQuery();
  const hydrated = useHydrated();
  return { loaded: q.isSuccess && hydrated, error: q.isError, retry: () => { void q.refetch(); } };
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  return useLoadState().loaded;
}
