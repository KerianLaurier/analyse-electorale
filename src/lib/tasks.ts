"use client";

import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity, onIdentityChange } from "@/lib/identity";
import { getQueryClient } from "@/providers/query-provider";
import { toast } from "@/components/toaster";

/**
 * Actions de terrain (tâches) d'une équipe de campagne — persistées côté
 * serveur (table `tasks`). Personnelles (team_id null) ou partagées avec
 * l'équipe (visibles & modifiables par tous les membres via RLS).
 *
 * Adossé à TanStack Query (cf. migration des stores, pilote `pins`). API publique
 * inchangée ; mutations optimistes via le cache, rollback + toast d'erreur.
 */

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "med" | "high";
export type TaskKind = "communication" | "logistique" | "demarche" | "mobilisation" | "autre";

export type TaskContext = { type: string; id: string; label: string; href: string };

export type Task = {
  id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  kind: TaskKind;
  dueDate: string | null;
  assignee: string | null;
  context: TaskContext | null;
  teamId: string | null;
  shared: boolean;
  mine: boolean;
  createdAt: number;
  doneAt: number | null;
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Fait",
};
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Basse",
  med: "Normale",
  high: "Haute",
};
export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  communication: "Communication",
  logistique: "Logistique",
  demarche: "Démarche / admin",
  mobilisation: "Mobilisation",
  autre: "Autre",
};

type Row = {
  id: string;
  user_id: string;
  team_id: string | null;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  kind: TaskKind;
  due_date: string | null;
  assignee: string | null;
  context_type: string | null;
  context_id: string | null;
  context_label: string | null;
  context_href: string | null;
  created_at: string;
  done_at: string | null;
};

const TASKS_KEY = ["tasks"] as const;
const EMPTY: Task[] = [];

const tasksQuery = {
  queryKey: TASKS_KEY,
  queryFn: fetchTasks,
  staleTime: 5 * 60 * 1000,
};

function mapRow(r: Row, myUserId: string | null): Task {
  return {
    id: r.id,
    title: r.title,
    details: r.details,
    status: r.status,
    priority: r.priority,
    kind: r.kind,
    dueDate: r.due_date,
    assignee: r.assignee,
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
    doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
  };
}

async function fetchTasks(): Promise<Task[]> {
  const { userId } = await getIdentity();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error; // remonte l'échec de lecture → état d'erreur (au lieu d'un vide silencieux)
  return (data ?? []).map((r) => mapRow(r as Row, userId));
}

let identityWired = false;
function ensureIdentityWired() {
  if (identityWired || typeof window === "undefined") return;
  identityWired = true;
  onIdentityChange(() => {
    void getQueryClient().invalidateQueries({ queryKey: TASKS_KEY });
  });
}

export async function reloadTasks(): Promise<void> {
  await getQueryClient().refetchQueries({ queryKey: TASKS_KEY, type: "all" });
}

export type NewTask = {
  title: string;
  details?: string | null;
  priority?: TaskPriority;
  kind?: TaskKind;
  dueDate?: string | null;
  assignee?: string | null;
  shared?: boolean;
  context?: TaskContext | null;
};

/** Ajoute une tâche. Renvoie false en cas d'échec (le formulaire reste rempli). */
export async function addTask(input: NewTask): Promise<boolean> {
  const { userId, teamId } = await getIdentity();
  if (!userId) return false;
  const supabase = createClient();
  const team_id = input.shared && teamId ? teamId : null;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      team_id,
      title: input.title,
      details: input.details ?? null,
      priority: input.priority ?? "med",
      kind: input.kind ?? "autre",
      due_date: input.dueDate ?? null,
      assignee: input.assignee ?? null,
      context_type: input.context?.type ?? null,
      context_id: input.context?.id ?? null,
      context_label: input.context?.label ?? null,
      context_href: input.context?.href ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    toast.error("Impossible d'ajouter la tâche — vérifiez votre connexion puis réessayez.");
    return false;
  }
  getQueryClient().setQueryData<Task[]>(TASKS_KEY, (old) => [mapRow(data as Row, userId), ...(old ?? [])]);
  return true;
}

export type TaskPatch = {
  status?: TaskStatus;
  priority?: TaskPriority;
  kind?: TaskKind;
  dueDate?: string | null;
  assignee?: string | null;
  title?: string;
  details?: string | null;
  shared?: boolean;
};

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const qc = getQueryClient();
  const { teamId } = await getIdentity();
  const current = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
  const idx = current.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const prev = current[idx];
  const next: Task = { ...prev };
  if (patch.status !== undefined) {
    next.status = patch.status;
    next.doneAt = patch.status === "done" ? Date.now() : null;
  }
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate;
  if (patch.assignee !== undefined) next.assignee = patch.assignee;
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.details !== undefined) next.details = patch.details;
  if (patch.shared !== undefined) {
    next.teamId = patch.shared && teamId ? teamId : null;
    next.shared = next.teamId != null;
  }
  qc.setQueryData<Task[]>(TASKS_KEY, [...current.slice(0, idx), next, ...current.slice(idx + 1)]);

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) {
    dbPatch.status = patch.status;
    dbPatch.done_at = patch.status === "done" ? new Date().toISOString() : null;
  }
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.kind !== undefined) dbPatch.kind = patch.kind;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
  if (patch.assignee !== undefined) dbPatch.assignee = patch.assignee;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.details !== undefined) dbPatch.details = patch.details;
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && teamId ? teamId : null;

  const supabase = createClient();
  const { error } = await supabase.from("tasks").update(dbPatch).eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: TASKS_KEY }); // rollback : on recharge l'état serveur
    toast.error("Modification non enregistrée — réessayez.");
  }
}

export async function deleteTask(id: string): Promise<void> {
  const qc = getQueryClient();
  qc.setQueryData<Task[]>(TASKS_KEY, (old) => (old ?? []).filter((t) => t.id !== id));
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: TASKS_KEY }); // rollback : la tâche réapparaît
    toast.error("Suppression impossible — réessayez.");
  }
}

function useTasksQuery() {
  ensureIdentityWired();
  return useQuery(tasksQuery);
}

export function useTasks(): Task[] {
  return useTasksQuery().data ?? EMPTY;
}

/** État de chargement d'un onglet : `loaded` (après hydratation), `error`, `retry`. */
export function useLoadState() {
  const q = useTasksQuery();
  const hydrated = useHydrated();
  // `loaded` seulement après hydratation → premier rendu client = HTML serveur.
  return { loaded: q.isSuccess && hydrated, error: q.isError, retry: () => { void q.refetch(); } };
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  return useLoadState().loaded;
}
