"use client";

import { useSyncExternalStore } from "react";
import { useTasks } from "@/lib/tasks";
import { useShifts } from "@/lib/shifts";
import { useCampaign, useSectors, voteGoal } from "@/lib/campaign";

/**
 * Centre de notifications — alertes dérivées (côté client) des données du QG :
 * échéances d'actions qui me sont assignées, permanences à venir / à pourvoir,
 * objectif de voix atteint. L'état « lu » (rejeté) est persisté en localStorage.
 */

export type NotifTone = "warn" | "info" | "success";

export type AppNotification = {
  id: string;
  kind: "task" | "shift" | "campaign";
  tone: NotifTone;
  title: string;
  detail?: string;
  href: string;
};

// ── Persistance de l'état « lu » ────────────────────────────────────────────
const DISMISS_KEY = "mvc:notifs:dismissed";
const EMPTY: string[] = [];
let dismissed: string[] = readDismissed();
const listeners = new Set<() => void>();

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function persist() {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed.slice(-200)));
  } catch {
    /* quota / indispo : on ignore */
  }
}
function emit() {
  listeners.forEach((l) => l());
}

export function dismissNotification(id: string) {
  if (dismissed.includes(id)) return;
  dismissed = [...dismissed, id];
  persist();
  emit();
}
export function dismissAll(ids: string[]) {
  const set = new Set(dismissed);
  let changed = false;
  for (const id of ids) if (!set.has(id)) { set.add(id); changed = true; }
  if (changed) {
    dismissed = [...set];
    persist();
    emit();
  }
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function useDismissed(): string[] {
  return useSyncExternalStore(subscribe, () => dismissed, () => EMPTY);
}

// ── Dérivation des notifications ────────────────────────────────────────────
const DAY = 86_400_000;
const todayISO = () => new Date().toISOString().slice(0, 10);
function daysUntil(iso: string): number {
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / DAY);
}
const whenLabel = (d: number) => (d <= 0 ? "Aujourd’hui" : d === 1 ? "Demain" : `Dans ${d} jours`);

export function useNotifications(meId: string | null): AppNotification[] {
  const tasks = useTasks();
  const shifts = useShifts();
  const campaign = useCampaign();
  const sectors = useSectors();
  const dism = useDismissed();
  const seen = new Set(dism);
  const out: AppNotification[] = [];

  if (meId) {
    // Actions qui me sont assignées (ou créées par moi sans assigné), à échéance
    for (const t of tasks) {
      if (t.status === "done" || !t.dueDate) continue;
      const forMe = t.assignee ? t.assignee === meId : t.mine;
      if (!forMe) continue;
      const d = daysUntil(t.dueDate);
      if (d < 0) {
        out.push({ id: `task:${t.id}:overdue`, kind: "task", tone: "warn", title: `Action en retard : ${t.title}`, detail: "Échéance dépassée", href: "/espace?tab=tasks" });
      } else if (d <= 2) {
        out.push({ id: `task:${t.id}:due`, kind: "task", tone: "info", title: `Échéance proche : ${t.title}`, detail: whenLabel(d), href: "/espace?tab=tasks" });
      }
    }

    // Permanences à venir
    for (const s of shifts) {
      const d = daysUntil(s.date);
      if (d < 0) continue;
      if (s.joined && d <= 2) {
        out.push({ id: `shift:${s.id}:mine`, kind: "shift", tone: "info", title: `Permanence : ${s.title}`, detail: whenLabel(d), href: "/espace?tab=shifts" });
      } else if (!s.joined && s.shared && d <= 3 && (s.capacity == null || s.signups.length < s.capacity)) {
        out.push({ id: `shift:${s.id}:open`, kind: "shift", tone: "warn", title: `Créneau à pourvoir : ${s.title}`, detail: `${s.signups.length}${s.capacity != null ? ` / ${s.capacity}` : ""} inscrits · ${whenLabel(d)}`, href: "/espace?tab=shifts" });
      }
    }
  }

  // Objectif de voix atteint
  const goal = voteGoal(campaign);
  if (goal && goal > 0) {
    const identified = sectors.reduce((a, x) => a + x.favorable, 0);
    if (identified >= goal) {
      out.push({ id: "campaign:goal", kind: "campaign", tone: "success", title: "Objectif de voix atteint 🎯", detail: `${new Intl.NumberFormat("fr-FR").format(identified)} voix identifiées`, href: "/espace?tab=campaign" });
    }
  }

  return out.filter((n) => !seen.has(n.id));
}
