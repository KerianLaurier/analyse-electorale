"use client";

import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity } from "@/lib/identity";
import {
  getPrivateQueryClient as getQueryClient,
  usePrivateQuery as useQuery,
} from "@/lib/private-query";
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
export type TaskKind =
  | "communication"
  | "logistique"
  | "demarche"
  | "mobilisation"
  | "autre";

export type TaskContext = {
  type: string;
  id: string;
  label: string;
  href: string;
};

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
  updatedAt?: string;
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
  updated_at: string;
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
    context:
      r.context_type && r.context_id
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
    updatedAt: r.updated_at,
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

export async function reloadTasks(): Promise<void> {
  const privateClient = getQueryClient();
  await privateClient.refetchQueries({ queryKey: TASKS_KEY, type: "all" });
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
  const privateClient = getQueryClient();
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
    toast.error(
      "Impossible d'ajouter la tâche — vérifiez votre connexion puis réessayez.",
    );
    return false;
  }
  privateClient.setQueryData<Task[]>(TASKS_KEY, (old) => [
    mapRow(data as Row, userId),
    ...(old ?? []),
  ]);
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
  const { teamId, userId } = await getIdentity();
  const privateClient = getQueryClient();
  const qc = privateClient;
  await qc.cancelQueries({ queryKey: TASKS_KEY });
  const current = qc.getQueryData<Task[]>(TASKS_KEY) ?? [];
  const idx = current.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const prev = current[idx];
  if (!prev.updatedAt || prev.updatedAt.startsWith("pending:")) {
    toast.error("Rechargez les tâches avant de les modifier.");
    return;
  }
  const next: Task = { ...prev, updatedAt: `pending:${crypto.randomUUID()}` };
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
  qc.setQueryData<Task[]>(TASKS_KEY, [
    ...current.slice(0, idx),
    next,
    ...current.slice(idx + 1),
  ]);

  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
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
  if (patch.shared !== undefined)
    dbPatch.team_id = patch.shared && teamId ? teamId : null;

  const supabase = createClient();
  let result;
  try {
    result = await supabase
      .from("tasks")
      .update(dbPatch)
      .eq("id", id)
      .eq("updated_at", prev.updatedAt)
      .select("*")
      .maybeSingle();
  } catch {
    result = { data: null, error: new Error("network failure") };
  }
  const { data, error } = result;
  if (error || !data) {
    // Restaurer uniquement cette entité et uniquement notre état optimiste.
    qc.setQueryData<Task[]>(TASKS_KEY, (rows) =>
      rows?.map((task) => (task.updatedAt === next.updatedAt ? prev : task)),
    );
    toast.error(
      error
        ? "Modification non enregistrée — réessayez."
        : "Cette tâche a changé. Rechargez-la avant de réessayer.",
    );
    void qc.invalidateQueries({ queryKey: TASKS_KEY });
    return;
  }
  const saved = mapRow(data as Row, userId);
  qc.setQueryData<Task[]>(TASKS_KEY, (rows) =>
    rows?.map((task) => (task.updatedAt === next.updatedAt ? saved : task)),
  );
}

export async function deleteTask(id: string): Promise<void> {
  const qc = getQueryClient();
  await qc.cancelQueries({ queryKey: TASKS_KEY });
  const previous = qc
    .getQueryData<Task[]>(TASKS_KEY)
    ?.find((task) => task.id === id);
  if (!previous?.updatedAt || previous.updatedAt.startsWith("pending:")) {
    toast.error("Attendez la sauvegarde puis rechargez les tâches.");
    return;
  }
  qc.setQueryData<Task[]>(TASKS_KEY, (rows) =>
    rows?.filter((task) => task.id !== id),
  );
  let result;
  try {
    result = await createClient()
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("updated_at", previous.updatedAt)
      .select("id")
      .maybeSingle();
  } catch {
    result = { data: null, error: new Error("network failure") };
  }
  const { data, error } = result;
  if (error || !data) {
    qc.setQueryData<Task[]>(TASKS_KEY, (rows) =>
      rows?.some((task) => task.id === id) ? rows : [previous, ...(rows ?? [])],
    );
    toast.error(
      error
        ? "Suppression impossible — réessayez."
        : "La tâche a changé ; rechargez-la avant de supprimer.",
    );
    void qc.invalidateQueries({ queryKey: TASKS_KEY });
  }
}

function useTasksQuery() {
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
