"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Actions de terrain (tâches) d'une équipe de campagne — persistées côté
 * serveur (table `tasks`). Personnelles (team_id null) ou partagées avec
 * l'équipe (visibles & modifiables par tous les membres via RLS).
 */

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "med" | "high";
export type TaskKind = "porte" | "boitage" | "collage" | "evenement" | "reunion" | "appel" | "autre";

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
  porte: "Porte-à-porte",
  boitage: "Boîtage",
  collage: "Collage / affichage",
  evenement: "Événement",
  reunion: "Réunion",
  appel: "Phoning",
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

let myUserId: string | null = null;
let myTeamId: string | null = null;
let tasks: Task[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: Task[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(r: Row): Task {
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

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  myUserId = user?.id ?? null;
  if (!user) {
    myTeamId = null;
    tasks = [];
    emit();
    return;
  }
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  myTeamId = (prof?.team_id as string | null) ?? null;
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  tasks = (data ?? []).map((r) => mapRow(r as Row));
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  createClient().auth.onAuthStateChange(() => void load());
}

export async function reloadTasks(): Promise<void> {
  await load();
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

export async function addTask(input: NewTask): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  const team_id = input.shared && myTeamId ? myTeamId : null;
  const { data } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
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
  if (data) {
    tasks = [mapRow(data as Row), ...tasks];
    emit();
  }
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
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const prev = tasks[idx];
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
    next.teamId = patch.shared && myTeamId ? myTeamId : null;
    next.shared = next.teamId != null;
  }
  tasks = [...tasks.slice(0, idx), next, ...tasks.slice(idx + 1)];
  emit();

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
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && myTeamId ? myTeamId : null;

  const supabase = createClient();
  const { error } = await supabase.from("tasks").update(dbPatch).eq("id", id);
  if (error) await load();
}

export async function deleteTask(id: string): Promise<void> {
  tasks = tasks.filter((t) => t.id !== id);
  emit();
  const supabase = createClient();
  await supabase.from("tasks").delete().eq("id", id);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, () => tasks, () => EMPTY);
}
