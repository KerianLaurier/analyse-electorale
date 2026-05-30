"use client";

import Link from "next/link";
import { ListTodo, CheckCircle2, Star, StickyNote, CalendarClock, MapPin, Flag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasks, TASK_KIND_LABELS, type Task } from "@/lib/tasks";
import { useNotes } from "@/lib/notes";
import { usePins } from "@/lib/pins";
import { memberName, type WsContext } from "@/app/espace/types";
import type { Tab } from "@/app/espace/espace-view";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDue = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export function EspaceOverview({ ctx, setTab }: { ctx: WsContext; setTab: (t: Tab) => void }) {
  const tasks = useTasks();
  const notes = useNotes();
  const pins = usePins();

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const upcoming = active
    .filter((t) => t.dueDate != null)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 5);
  const highPrio = active.filter((t) => t.priority === "high").slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={ListTodo} label="Actions en cours" value={active.length} onClick={() => setTab("tasks")} accent />
        <Stat icon={CheckCircle2} label="Actions faites" value={done.length} onClick={() => setTab("tasks")} />
        <Stat icon={Star} label="Épingles" value={pins.length} onClick={() => setTab("pins")} />
        <Stat icon={StickyNote} label="Notes" value={notes.length} onClick={() => setTab("notes")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Échéances proches */}
        <Panel title="Échéances proches" icon={CalendarClock} onSeeAll={() => setTab("tasks")}>
          {upcoming.length === 0 ? (
            <Empty>Aucune échéance planifiée.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {upcoming.map((t) => (
                <TaskLine key={t.id} task={t} ctx={ctx} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Priorités hautes */}
        <Panel title="Priorités hautes" icon={Flag} onSeeAll={() => setTab("tasks")}>
          {highPrio.length === 0 ? (
            <Empty>Aucune action prioritaire en attente.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {highPrio.map((t) => (
                <TaskLine key={t.id} task={t} ctx={ctx} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Notes récentes */}
      <Panel title="Notes récentes" icon={StickyNote} onSeeAll={() => setTab("notes")}>
        {notes.length === 0 ? (
          <Empty>Aucune note de terrain pour l’instant.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {notes.slice(0, 4).map((n) => (
              <li key={n.id} className="rounded-lg border border-black/5 bg-canvas/40 p-3">
                {n.title && <p className="truncate text-[13px] font-medium">{n.title}</p>}
                <p className="line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>
                {n.context && (
                  <Link href={n.context.href} className="mt-1 inline-flex items-center gap-1 text-[11px] text-warm hover:underline">
                    <MapPin className="h-3 w-3" /> {n.context.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  onClick,
  accent,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-4 text-left shadow-card transition-colors",
        accent ? "border-warm/30 bg-warm/[0.06] hover:bg-warm/[0.1]" : "border-black/5 bg-surface hover:border-warm/30",
      )}
    >
      <Icon className={cn("h-4 w-4", accent ? "text-warm" : "text-muted-foreground")} />
      <span className="mt-1 text-[24px] font-semibold tabular-nums leading-none tracking-tight">{value}</span>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </button>
  );
}

function Panel({
  title,
  icon: Icon,
  onSeeAll,
  children,
}: {
  title: string;
  icon: typeof ListTodo;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/5 bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </h2>
        <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-warm hover:underline">
          Tout voir <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {children}
    </section>
  );
}

function TaskLine({ task, ctx }: { task: Task; ctx: WsContext }) {
  const overdue = task.dueDate != null && task.dueDate < todayISO();
  return (
    <li className="flex items-center gap-2 py-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{TASK_KIND_LABELS[task.kind]}</span>
      {task.assignee && (
        <span className="shrink-0 text-[11px] text-muted-foreground">· {memberName(ctx.members, task.assignee)}</span>
      )}
      {task.dueDate && (
        <span className={cn("shrink-0 text-[11px]", overdue ? "font-semibold text-red-600" : "text-muted-foreground")}>
          {fmtDue(task.dueDate)}
        </span>
      )}
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-4 text-[12.5px] text-muted-foreground">{children}</p>;
}
